"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Card } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// Trips (parent side) — the trips their children are on, with the consent
// action (the accidents-acknowledge of trips). The API resolves which trips
// belong to this family; consent is per child, timestamped, and the
// provider's planner updates live as answers land.
// ─────────────────────────────────────────────────────────────────────────

interface TripChild { childId: string; name: string; consent: "granted" | "pending" | "declined"; consentAt: string | null }
interface Trip {
  id: string; provider: string; destination: string; date: string;
  departTime: string | null; returnTime: string | null; transport: string | null;
  cost: string | null; payBy: string | null; status: string; askConsent: boolean;
  children: TripChild[];
}

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const CONSENT_META: Record<TripChild["consent"], { label: string; bg: string; fg: string }> = {
  granted: { label: "Consent given ✓", bg: "#e7f6ee", fg: "#0f7a43" },
  pending: { label: "Consent needed", bg: "#fdf3d8", fg: "#9a5a00" },
  declined: { label: "Not going", bg: "#eef0f5", fg: "#6b6880" },
};

export function ParentTripsApp() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // `${tripId}_${childId}`

  const refresh = useCallback(() => {
    apiGet<Trip[]>("/api/my/trips").then((r) => { setTrips(r); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["notifications", "bookings"], refresh);

  async function answer(trip: Trip, child: TripChild, decision: "granted" | "declined") {
    const key = `${trip.id}_${child.childId}`;
    setBusy(key); setError(null);
    try { await apiPost(`/api/my/trips/${encodeURIComponent(trip.id)}/consent`, { childId: child.childId, decision }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save your answer"); }
    finally { setBusy(null); }
  }

  const today = new Date().toISOString().slice(0, 10);
  const outstanding = (trips ?? []).flatMap((t) =>
    t.askConsent && t.status === "planned" && t.date >= today ? t.children.filter((c) => c.consent === "pending").map((c) => ({ t, c })) : [],
  );

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-3 text-[var(--ink)] sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🚌</span>Trips & visits
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">Off-site trips your children are on — where, when, how they travel, and your consent.</p>
      </div>

      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c02636]">{error}</div>}

      {outstanding.length > 0 && (
        <div className="mb-3 rounded-xl border-2 border-[#f0b100] bg-[#fff8e6] px-4 py-3 text-[12.5px] font-bold text-[#7a5800]">
          {outstanding.length === 1 ? "1 trip needs your consent" : `${outstanding.length} consents needed`} — answer below so the provider can finish planning.
        </div>
      )}

      {trips === null ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading trips…</div>
      ) : trips.length === 0 ? (
        <Card className="p-6 text-center text-[12.5px] text-[var(--ink-3)]">
          No trips yet — when a provider plans an off-site trip with your child on it, it appears here.
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {trips.map((t) => {
            const upcoming = t.date >= today && t.status === "planned";
            return (
              <Card key={t.id} className="p-4" data-ui="card">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t.destination}</span>
                  <span className="text-[12px] text-[var(--ink-3)]">{fmtDate(t.date)}</span>
                  {t.status === "completed" && <span className="rounded-full bg-[#eef0f5] px-2 py-0.5 text-[10.5px] font-bold text-[#6b6880]">Completed</span>}
                  <span className="ml-auto text-[11.5px] text-[var(--ink-3)]">{t.provider}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--ink-2)]">
                  {t.departTime && <span>Departs {t.departTime}</span>}
                  {t.returnTime && <span>Back {t.returnTime}</span>}
                  {t.transport && <span>{t.transport}</span>}
                  {t.cost && <span className="font-bold">£{t.cost}{t.payBy ? ` · pay by ${t.payBy}` : ""}</span>}
                </div>

                <div className="mt-3 flex flex-col gap-2 border-t border-[var(--line)] pt-3">
                  {t.children.map((c) => {
                    const meta = CONSENT_META[c.consent];
                    const key = `${t.id}_${c.childId}`;
                    return (
                      <div key={c.childId} className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-bold">{c.name}</span>
                        <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>
                        {c.consentAt && <span className="text-[10.5px] text-[var(--ink-3)]">{new Date(c.consentAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                        {t.askConsent && upcoming && c.consent === "pending" && (
                          <span className="ml-auto flex gap-1.5">
                            <button
                              onClick={() => void answer(t, c, "granted")}
                              disabled={busy === key}
                              className="cursor-pointer rounded-full bg-[#15b364] px-3 py-1 text-[11.5px] font-extrabold text-white transition-transform hover:-translate-y-px disabled:opacity-60"
                            >
                              {busy === key ? "Saving…" : "Give consent"}
                            </button>
                            <button
                              onClick={() => void answer(t, c, "declined")}
                              disabled={busy === key}
                              className="cursor-pointer rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[11.5px] font-bold text-[var(--ink-2)] disabled:opacity-60"
                            >
                              Not going
                            </button>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
