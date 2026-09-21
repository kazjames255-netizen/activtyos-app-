"use client";

import { useState } from "react";
import Link from "next/link";
import { firstOff } from "@/lib/accessMap";
import type { TenantSettings } from "@/lib/settings";

// F18 — the Learning Hub is opt-in, and while it is off its sidebar item is hidden, so a tutor has no way to discover it.
// This card sits on the operator's dashboard until they turn it on (or say "not now"). Turning it on is exactly what
// Setup → Features does: one switch in the tenant's settings.

const KEY = "aos.hub.enable-card.dismissed";
const dismissed = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };

export function EnableHubCard({ portal, settings, loading, save }: {
  portal: string;
  settings: TenantSettings;
  loading: boolean;
  save: (patch: { settings?: TenantSettings }) => Promise<void>;
}) {
  const [hidden, setHidden] = useState(dismissed);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Operators only (staff can't switch modules on: they ask a manager); and only once the settings have really loaded.
  if (!["company", "franchise", "freelancer"].includes(portal) || loading || hidden || !firstOff(settings.features, ["learninghub"])) return null;

  const turnOn = async () => {
    setBusy(true); setErr(null);
    try { await save({ settings: { ...settings, features: { ...settings.features, learninghub: true } } }); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't turn it on"); }
    finally { setBusy(false); }
  };
  const later = () => { try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ } setHidden(true); };

  return (
    <section aria-label="Teaching Hub" data-testid="enable-hub-card" className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <span aria-hidden className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-[var(--brand-soft)] text-[22px]">📚</span>
      <div className="min-w-[220px] flex-1">
        <div className="text-[14.5px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Teach online? Turn on the Teaching Hub</div>
        <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--ink-2)]">Run live video lessons, set quizzes and homework, and follow each child&apos;s progress — for tutoring, catch-up and revision. It stays off until you switch it on.</p>
        {err && <p role="alert" className="mt-1 text-[12px] text-[var(--red)]">{err}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void turnOn()} disabled={busy} data-testid="enable-hub-turn-on" className="min-h-[44px] rounded-full px-5 text-[13px] font-extrabold text-white disabled:opacity-60" style={{ background: "linear-gradient(180deg, var(--brand-2), var(--brand))" }}>{busy ? "Turning on…" : "Turn on the Learning Hub"}</button>
        <Link href={`/${portal}/setup`} className="inline-flex min-h-[44px] items-center rounded-full px-3 text-[12.5px] font-bold text-[var(--brand)] hover:underline">Or see Setup → Features</Link>
        <button type="button" onClick={later} className="min-h-[44px] rounded-full px-3 text-[12.5px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)]">Not now</button>
      </div>
    </section>
  );
}
