"use client";

// First-run checklist for brand-new providers (company / freelancer / franchise).
// Every step ticks itself from real data (venues, blocks, listings, settings,
// Stripe status, invites) — no new server routes. Shown at the top of the
// Dashboard and as the empty state of Bookings; hidden for good once the
// provider has a published listing AND a booking, or taps Hide (remembered per
// tenant in localStorage).
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { peekMe, getMe } from "@/components/auth/PortalGuard";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";

type StepId = "venue" | "block" | "listing" | "pay" | "cancel" | "team";
interface Facts { venues: number; blocks: number; listings: number; bookings: number; payChosen: boolean; cancelChosen: boolean; team: number }
interface Stored { hidden?: boolean; visited?: StepId[] }

const OPERATOR_PORTALS = ["company", "franchise", "freelancer"];
const storeKey = (tenant: string) => `aos.firstrun.v1.${tenant}`;
function readStore(tenant: string): Stored {
  try { return JSON.parse(window.localStorage.getItem(storeKey(tenant)) || "{}") as Stored; } catch { return {}; }
}
function writeStore(tenant: string, s: Stored) {
  try { window.localStorage.setItem(storeKey(tenant), JSON.stringify(s)); } catch { /* storage blocked — checklist just reappears next visit */ }
}

export function FirstRunChecklist({ variant = "dashboard" }: { variant?: "dashboard" | "bookings" }) {
  const t = useT();
  const router = useRouter();
  const portal = (usePathname() ?? "/").split("/")[1] || "";
  const [me, setMe] = useState(() => peekMe());
  useEffect(() => { getMe().then(setMe).catch(() => {}); }, []);
  // A franchisee shares the head office's tenant id, so its franchise id is part of the key.
  const tenant = me?.tenantId ? `${me.tenantId}${me.franchiseId ? `.${me.franchiseId}` : ""}` : "";
  const [facts, setFacts] = useState<Facts | null>(null);
  const [store, setStore] = useState<Stored>({});
  const enabled = OPERATOR_PORTALS.includes(portal) && !!tenant;

  useEffect(() => { if (enabled) setStore(readStore(tenant)); }, [enabled, tenant]);

  const load = useCallback(() => {
    if (!enabled) return;
    const safe = <T,>(p: Promise<T>, d: T) => p.catch(() => d);
    Promise.all([
      safe(apiGet<{ venues?: unknown[]; settings?: { payMethods?: unknown[]; cancellationPolicies?: unknown[]; billing?: { bankAccount?: string; sortCode?: string; iban?: string } } } | null>("/api/library"), null),
      safe(apiGet<unknown[]>("/api/block-bundles"), []),
      safe(apiGet<unknown[]>("/api/listings?mine=1"), []),
      safe(apiGet<unknown[]>("/api/bookings"), []),
      safe(apiGet<{ connected?: boolean; chargesEnabled?: boolean }>("/api/payments/status"), {}),
      portal === "freelancer" ? Promise.resolve([] as { role: string }[]) : safe(apiGet<{ role: string }[]>("/api/invites"), []),
    ]).then(([lib, blocks, listings, bookings, stripe, invites]) => {
      setFacts({
        venues: lib?.venues?.length ?? 0,
        blocks: blocks?.length ?? 0,
        listings: listings?.length ?? 0,
        bookings: bookings?.length ?? 0,
        // "Chosen" = saved something of their own, or Stripe is live.
        payChosen: !!stripe?.chargesEnabled || !!lib?.settings?.payMethods?.length || !!lib?.settings?.billing?.bankAccount || !!lib?.settings?.billing?.iban,
        cancelChosen: !!lib?.settings?.cancellationPolicies?.length,
        team: (invites ?? []).filter((i) => i.role === "staff").length,
      });
    });
  }, [enabled, portal]);
  useEffect(load, [load]);
  useRealtime(["bookings", "blocks", "listings"], load);

  if (!enabled || !facts || store.hidden) return null;
  // Established providers never see it.
  if (facts.listings > 0 && facts.bookings > 0) return null;
  // On Bookings it's the empty state — only when there's nothing to list.
  if (variant === "bookings" && facts.bookings > 0) return null;

  const visited = new Set(store.visited ?? []);
  const base = `/${portal}`;
  const steps: { id: StepId; done: boolean; href: string }[] = [
    { id: "venue", done: facts.venues > 0, href: `${base}/listings?tab=locations` },
    { id: "block", done: facts.blocks > 0, href: `${base}/blocks` },
    { id: "listing", done: facts.listings > 0, href: `${base}/listings` },
    { id: "pay", done: facts.payChosen || visited.has("pay"), href: `${base}/getpaid` },
    { id: "cancel", done: facts.cancelChosen || visited.has("cancel"), href: `${base}/setup?tab=cancel` },
    ...(portal === "freelancer" ? [] : [{ id: "team" as StepId, done: facts.team > 0, href: `${base}/staff` }]),
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const nextId = steps.find((s) => !s.done)?.id;
  const pct = Math.round((doneCount / steps.length) * 100);

  const hide = () => { const n = { ...store, hidden: true }; setStore(n); writeStore(tenant, n); };
  const go = (s: { id: StepId; href: string }) => {
    if (s.id === "pay" || s.id === "cancel") {
      const n = { ...store, visited: Array.from(new Set([...(store.visited ?? []), s.id])) };
      setStore(n); writeStore(tenant, n);
    }
    router.push(s.href);
  };

  return (
    <section data-testid="first-run-checklist" className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--ink)] shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>
            {allDone ? t("p9fr.doneTitle") : t("p9fr.title")}
          </h2>
          <p className="mt-1 text-[14px] leading-snug text-[var(--ink-2)]">{allDone ? t("p9fr.doneBody") : t("p9fr.sub")}</p>
        </div>
        <Button onClick={hide} data-testid="first-run-hide" className="!h-10 !px-4 !text-[14px]">{t("p9fr.hide")}</Button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--line)]" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}>
          <div className="h-full rounded-full bg-[var(--brand,#2f5fd0)] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="whitespace-nowrap text-[14px] font-bold" data-testid="first-run-progress">{t("p9fr.progress", { n: doneCount, total: steps.length })}</span>
      </div>
      <ol className="mt-3 grid gap-2">
        {steps.map((s, i) => (
          <li key={s.id} data-testid={`first-run-step-${s.id}`} data-done={s.done ? "1" : "0"}
            className={"flex flex-wrap items-center gap-3 rounded-xl border px-3 py-3 " + (s.done ? "border-[var(--line)] bg-[var(--panel)]" : s.id === nextId ? "border-[var(--brand,#2f5fd0)] bg-[var(--surface)]" : "border-[var(--line)] bg-[var(--surface)]")}>
            <span aria-hidden className={"flex h-8 w-8 flex-none items-center justify-center rounded-full text-[15px] font-extrabold " + (s.done ? "bg-[#0f7a43] text-white" : "bg-[var(--line)] text-[var(--ink-2)]")}>{s.done ? "✓" : i + 1}</span>
            <div className="min-w-[10rem] flex-1">
              <div className={"text-[15px] font-bold leading-snug " + (s.done ? "text-[var(--ink-3)] line-through" : "")}>{t(`p9fr.${s.id}`)}</div>
              <div className="text-[14px] leading-snug text-[var(--ink-2)]">{t(`p9fr.${s.id}Hint`)}</div>
            </div>
            <button type="button" onClick={() => go(s)}
              className={"min-h-[44px] w-full rounded-xl px-4 text-[15px] font-bold sm:w-auto " + (s.done ? "border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]" : "bg-[var(--brand,#2f5fd0)] text-white hover:brightness-110")}>
              {s.done ? t("p9fr.review") : t(`p9fr.${s.id}Btn`)}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
