"use client";

// Shared computation behind the first-run checklist: the Dashboard card
// (FirstRunChecklist) and the persistent shell banner (SetupBanner) both read
// from here so they never double-fetch. Facts are cached at module level with a
// 60s TTL per tenant (one set of reads per minute per tab, not per navigation),
// and an established provider (published listing + a booking) is remembered in
// localStorage so those reads stop altogether.
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { peekMe, getMe } from "@/components/auth/PortalGuard";

export type StepId = "venue" | "block" | "listing" | "pay" | "cancel" | "team";
interface Facts { venues: number; blocks: number; listings: number; bookings: number; payChosen: boolean; cancelChosen: boolean; team: number }
export interface FirstRunStored { hidden?: boolean; visited?: StepId[] }
export interface FirstRunStep { id: StepId; done: boolean; href: string }

export const OPERATOR_PORTALS = ["company", "franchise", "freelancer"];
const TTL = 60_000;
const storeKey = (tenant: string) => `aos.firstrun.v1.${tenant}`;
const doneKey = (tenant: string) => `aos.firstrun.established.v1.${tenant}`;
const snoozeKey = (tenant: string) => `aos.firstrun.snooze.v1.${tenant}`;

function lsGet(k: string): string | null { try { return window.localStorage.getItem(k); } catch { return null; } }
function lsSet(k: string, v: string) { try { window.localStorage.setItem(k, v); } catch { /* storage blocked: just reappears */ } }
function readStore(tenant: string): FirstRunStored {
  try { return JSON.parse(lsGet(storeKey(tenant)) || "{}") as FirstRunStored; } catch { return {}; }
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

const cache = new Map<string, { at: number; facts: Facts | null; p?: Promise<void> }>();
const listeners = new Set<() => void>();
const bump = () => listeners.forEach((f) => f());

function fetchFacts(tenant: string, portal: string, force: boolean) {
  const c = cache.get(tenant) ?? { at: 0, facts: null };
  cache.set(tenant, c);
  if (c.p) return;
  if (!force && c.facts && Date.now() - c.at < TTL) return;
  const safe = <T,>(p: Promise<T>, d: T) => p.catch(() => d);
  c.p = Promise.all([
    safe(apiGet<{ venues?: unknown[]; settings?: { payMethods?: unknown[]; cancellationPolicies?: unknown[]; billing?: { bankAccount?: string; sortCode?: string; iban?: string } } } | null>("/api/library"), null),
    safe(apiGet<unknown[]>("/api/block-bundles"), []),
    safe(apiGet<unknown[]>("/api/listings?mine=1"), []),
    safe(apiGet<unknown[]>("/api/bookings"), []),
    safe(apiGet<{ connected?: boolean; chargesEnabled?: boolean }>("/api/payments/status"), {}),
    portal === "freelancer" ? Promise.resolve([] as { role: string }[]) : safe(apiGet<{ role: string }[]>("/api/invites"), []),
  ]).then(([lib, blocks, listings, bookings, stripe, invites]) => {
    c.facts = {
      venues: lib?.venues?.length ?? 0,
      blocks: blocks?.length ?? 0,
      listings: listings?.length ?? 0,
      bookings: bookings?.length ?? 0,
      // "Chosen" = saved something of their own, or Stripe is live.
      payChosen: !!stripe?.chargesEnabled || !!lib?.settings?.payMethods?.length || !!lib?.settings?.billing?.bankAccount || !!lib?.settings?.billing?.iban,
      cancelChosen: !!lib?.settings?.cancellationPolicies?.length,
      team: (invites ?? []).filter((i) => i.role === "staff").length,
    };
    c.at = Date.now();
    if (c.facts.listings > 0 && c.facts.bookings > 0) lsSet(doneKey(tenant), "1");
  }).finally(() => { c.p = undefined; bump(); });
}

export function useFirstRunSteps() {
  const pathname = usePathname() ?? "/";
  const portal = pathname.split("/")[1] || "";
  const [me, setMe] = useState(() => peekMe());
  useEffect(() => { getMe().then(setMe).catch(() => {}); }, []);
  // A franchisee shares the head office's tenant id, so its franchise id is part of the key.
  const tenant = me?.tenantId ? `${me.tenantId}${me.franchiseId ? `.${me.franchiseId}` : ""}` : "";
  const [, setTick] = useState(0);
  useEffect(() => {
    const f = () => setTick((n) => n + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);

  const established = !!tenant && typeof window !== "undefined" && lsGet(doneKey(tenant)) === "1";
  const enabled = OPERATOR_PORTALS.includes(portal) && !!tenant && !established;

  useEffect(() => { if (enabled) fetchFacts(tenant, portal, false); }, [enabled, tenant, portal, pathname]);
  // Server-side changes refetch (shared listener), but only for a tenant still being set up.
  const onRt = useCallback(() => { if (enabled) fetchFacts(tenant, portal, true); }, [enabled, tenant, portal]);
  useRealtime(["bookings", "blocks", "listings"], onRt);

  const store = tenant && typeof window !== "undefined" ? readStore(tenant) : {};
  const facts = tenant ? cache.get(tenant)?.facts ?? null : null;
  const base = `/${portal}`;
  const visited = new Set(store.visited ?? []);

  let steps: FirstRunStep[] = [];
  let hasBooking = false;
  if (facts) {
    hasBooking = facts.bookings > 0;
    steps = [
      { id: "venue", done: facts.venues > 0, href: `${base}/listings?tab=locations&add=1` },
      { id: "block", done: facts.blocks > 0, href: `${base}/blocks` },
      { id: "listing", done: facts.listings > 0, href: `${base}/listings` },
      { id: "pay", done: facts.payChosen || visited.has("pay"), href: `${base}/billing?tab=paid` },
      { id: "cancel", done: facts.cancelChosen || visited.has("cancel"), href: `${base}/setup?tab=cancel` },
      ...(portal === "freelancer" ? [] : [{ id: "team" as StepId, done: facts.team > 0, href: `${base}/staff` }]),
    ];
  }
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = steps.length > 0 && doneCount === steps.length;
  const next = steps.find((s) => !s.done) ?? null;
  const isEstablished = established || (!!facts && facts.listings > 0 && facts.bookings > 0);
  const snoozed = !!tenant && typeof window !== "undefined" && lsGet(snoozeKey(tenant)) === today();

  const persist = (n: FirstRunStored) => { if (tenant) { lsSet(storeKey(tenant), JSON.stringify(n)); bump(); } };
  return {
    enabled: OPERATOR_PORTALS.includes(portal) && !!tenant,
    ready: !!facts, portal, steps, doneCount, allDone, next, hasBooking,
    established: isEstablished, store, snoozed,
    hideCard: () => persist({ ...store, hidden: true }),
    snoozeToday: () => { if (tenant) { lsSet(snoozeKey(tenant), today()); bump(); } },
    // Pay + cancel have no data signal until saved, so opening them counts as reviewed.
    markVisited: (id: StepId) => { if (id === "pay" || id === "cancel") persist({ ...store, visited: Array.from(new Set([...(store.visited ?? []), id])) }); },
  };
}
