"use client";

// Head-office "Invite franchises" — the franchisor invites a franchisee (business
// name + territory + email), then tracks whether they've signed up. Franchisees
// join by invite only (never self-signup), so this is the HO's onboarding roster.

import { useCallback, useEffect, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { Button, Card, Input } from "@/components/ui";
import { useT, tNow } from "@/lib/i18n/provider";

interface Invite { token: string; role: string; createdAt: string; usedBy: string | null; sentTo?: string | null; franchiseName?: string | null; franchiseArea?: string | null }
interface Franchise { franchiseId: string; name: string; area: string | null }

export function FranchiseInvitesApp() {
  const t = useT();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiGet<Invite[]>("/api/invites").then((xs) => setInvites((xs ?? []).filter((i) => i.role === "franchise"))).catch((e) => setErr(e instanceof Error ? e.message : tNow("franchise.couldntLoadInvites")));
    apiGet<Franchise[]>("/api/franchises").then(setFranchises).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function invite() {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await apiPost<{ token: string; sentTo: string | null }>("/api/invites", {
        role: "franchise",
        ...(email.trim() ? { email: email.trim() } : {}),
        franchiseName: name.trim() || undefined,
        franchiseArea: area.trim() || undefined,
      });
      setMsg(r.sentTo ? t("franchise.inviteEmailedTo", { email: r.sentTo }) : t("franchise.inviteLinkCreated"));
      setName(""); setArea(""); setEmail(""); refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : t("franchise.couldntCreateInvite")); }
    setBusy(false);
  }
  function copy(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/signup?invite=${token}`).then(() => { setCopied(token); setTimeout(() => setCopied(null), 1500); });
  }

  const activeById = new Map(franchises.map((f) => [f.franchiseId, f]));
  const pending = (invites ?? []).filter((i) => !i.usedBy);
  const joined = (invites ?? []).filter((i) => i.usedBy);

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[#f7f7f8] p-5 text-[#171534]">
      <div className="mx-auto max-w-[860px]">
        <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,.5)]" style={{ background: "var(--hero-grad)" }}>
          <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[16px]">🤝</span>
            {t("franchise.inviteFranchises")}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-white/85">{t("franchise.inviteFranchisesLede")}</p>
        </div>

        {err && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#e21d27]">{err}</div>}
        {msg && <div className="mb-3 rounded-lg border border-[var(--line)] bg-[#eef8f1] px-3 py-2 text-[12.5px] font-bold text-[#0f7a43]">✓ {msg}</div>}

        <Card className="mb-3 p-4">
          <div className="mb-2.5 text-[13.5px] font-extrabold">{t("franchise.inviteNewFranchise")}</div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div><label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("franchise.franchiseBusinessName")}</label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("franchise.egApfActivityCamps")} className="w-full" /></div>
            <div><label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("franchise.areaTerritory")}</label><Input value={area} onChange={(e) => setArea(e.target.value)} placeholder={t("franchise.egManchester")} className="w-full" /></div>
            <div><label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("franchise.theirEmail")}</label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="them@email.com" className="w-full" /></div>
          </div>
          <div className="mt-3"><Button variant="primary" disabled={busy} onClick={invite}>{busy ? t("franchise.creating") : t("franchise.createInvite")}</Button></div>
        </Card>

        <Card className="mb-3 p-4">
          <div className="mb-2 text-[13.5px] font-extrabold">{t("franchise.signedUp")} <span className="font-bold text-[var(--ink-3)]">· {joined.length}</span></div>
          {!invites ? <div className="py-3 text-[12px] text-[var(--ink-3)]">{t("franchise.loading")}</div> : joined.length === 0 ? (
            <div className="py-3 text-[12px] text-[var(--ink-3)]">{t("franchise.noFranchisesSignedUp")}</div>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--line-2,#eef2f8)]">
              {joined.map((i) => {
                const active = i.usedBy ? activeById.get(i.usedBy) : null;
                return (
                  <div key={i.token} className="flex items-center gap-2 py-2 text-[12.5px]">
                    <span className="flex h-2 w-2 flex-none rounded-full bg-[#0f9d58]" />
                    <div className="min-w-0 flex-1"><span className="font-extrabold">{active?.name || i.franchiseName || t("franchise.franchiseFallback")}</span>{(active?.area || i.franchiseArea) && <span className="text-[var(--ink-3)]"> · {active?.area || i.franchiseArea}</span>}</div>
                    <span className="rounded-full bg-[#e2f4ea] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#0f7a43]">{t("franchise.activeBadge")}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-2 text-[13.5px] font-extrabold">{t("franchise.pendingInvites")} <span className="font-bold text-[var(--ink-3)]">· {pending.length}</span></div>
          {!invites ? <div className="py-3 text-[12px] text-[var(--ink-3)]">{t("franchise.loading")}</div> : pending.length === 0 ? (
            <div className="py-3 text-[12px] text-[var(--ink-3)]">{t("franchise.noInvitesWaiting")}</div>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--line-2,#eef2f8)]">
              {pending.map((i) => (
                <div key={i.token} className="flex flex-wrap items-center gap-2 py-2 text-[12.5px]">
                  <span className="flex h-2 w-2 flex-none rounded-full bg-[#b45309]" />
                  <div className="min-w-0 flex-1"><span className="font-extrabold">{i.franchiseName || t("franchise.franchiseFallback")}</span>{i.franchiseArea && <span className="text-[var(--ink-3)]"> · {i.franchiseArea}</span>}{i.sentTo && <span className="text-[var(--ink-3)]"> — {i.sentTo}</span>}</div>
                  <span className="rounded-full bg-[#fdf0e3] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#b45309]">{t("franchise.awaitingSignUp")}</span>
                  <button type="button" onClick={() => copy(i.token)} className="rounded-full border border-[var(--line)] px-3 py-0.5 text-[11px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{copied === i.token ? t("franchise.copied") : t("franchise.copyLink")}</button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
