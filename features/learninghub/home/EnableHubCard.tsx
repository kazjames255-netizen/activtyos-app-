"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { firstOff } from "@/lib/accessMap";
import type { TenantSettings } from "@/lib/settings";
import { useH } from "./homeI18n";

// F18 — the Learning Hub is opt-in, and while it is off its sidebar item is hidden, so a tutor has no way to discover it.
// This card sits on the operator's dashboard until they turn it on (or say "not now"). Turning it on is exactly what
// Setup → Features does: one switch in the tenant's settings.

const KEY = "aos.hub.enable-card.dismissed";
const dismissed = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };

export function EnableHubCard({ portal, settings, loading, save, first = false }: {
  portal: string;
  settings: TenantSettings;
  loading: boolean;
  save: (patch: { settings?: TenantSettings }) => Promise<void>;
  /** First-run mode (dashboard with no bookings or listings yet): the card leads the page, and once the hub is on it becomes an Open button. */
  first?: boolean;
}) {
  const { t } = useH();
  const router = useRouter();
  const [hidden, setHidden] = useState(dismissed);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Operators only (staff can't switch modules on: they ask a manager); and only once the settings have really loaded.
  if (!["company", "franchise", "freelancer"].includes(portal) || loading) return null;
  const off = firstOff(settings.features, ["learninghub"]);
  if (!off && first) {
    return (
      <section aria-label={t("hubshell.hm_hubName")} data-testid="open-hub-card" className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--brand-2)] bg-[var(--brand-soft)] p-4">
        <span aria-hidden className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-[var(--surface)] text-[22px]">📚</span>
        <div className="min-w-[220px] flex-1">
          <div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("hubshell.hm_readyTitle")}</div>
          <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--ink-2)]">{t("hubshell.hm_readyBody")}</p>
        </div>
        <Link href={`/${portal}/learninghub`} data-testid="open-hub-go" className="inline-flex min-h-[44px] items-center rounded-full px-5 text-[13px] font-extrabold text-white" style={{ background: "linear-gradient(180deg, var(--brand-2), var(--brand))" }}>{t("hubshell.hm_openHub")}</Link>
      </section>
    );
  }
  if (hidden && !first || !off) return null;

  const turnOn = async () => {
    setBusy(true); setErr(null);
    try { await save({ settings: { ...settings, features: { ...settings.features, learninghub: true } } }); router.push(`/${portal}/learninghub`); }
    catch (e) { setErr(e instanceof Error ? e.message : t("hubshell.hm_couldntTurnOn")); }
    finally { setBusy(false); }
  };
  const later = () => { try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ } setHidden(true); };

  return (
    <section aria-label={t("hubshell.hm_hubName")} data-testid="enable-hub-card" className={`${first ? "mb-3 border-[var(--brand-2)] bg-[var(--brand-soft)]" : "mt-3 border-[var(--line)] bg-[var(--surface)]"} flex flex-wrap items-center gap-3 rounded-2xl border p-4`}>
      <span aria-hidden className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-[var(--brand-soft)] text-[22px]">📚</span>
      <div className="min-w-[220px] flex-1">
        <div className="text-[14.5px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{first ? t("hubshell.hm_firstTitle") : t("hubshell.hm_enableTitle")}</div>
        <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--ink-2)]">{first ? t("hubshell.hm_firstBody") : t("hubshell.hm_enableBody")}</p>
        {err && <p role="alert" className="mt-1 text-[12px] text-[var(--red)]">{err}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void turnOn()} disabled={busy} data-testid="enable-hub-turn-on" className="min-h-[44px] rounded-full px-5 text-[13px] font-extrabold text-white disabled:opacity-60" style={{ background: "linear-gradient(180deg, var(--brand-2), var(--brand))" }}>{busy ? t("hubshell.hm_turningOn") : t("hubshell.hm_turnOnHub")}</button>
        <Link href={`/${portal}/setup`} className="inline-flex min-h-[44px] items-center rounded-full px-3 text-[12.5px] font-bold text-[var(--brand)] hover:underline">{t("hubshell.hm_orSetup")}</Link>
        {!first && <button type="button" onClick={later} className="min-h-[44px] rounded-full px-3 text-[12.5px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)]">{t("hubshell.hm_notNow")}</button>}
      </div>
    </section>
  );
}
