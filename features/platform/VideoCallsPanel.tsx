"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STAGES, type Lead, type Stage } from "./SalesApp";

// Every demo video call someone's actually booked from the public /demo
// page's slot picker, soonest first — the simplest honest "demo calendar":
// real bookings in order, not a decorative grid that duplicates the board.
// Reuses the SAME leads list (and click-to-open) as the Pipeline tab, so a
// row opens the identical lead detail — full contact info, the "wants to
// see" checklist and any message they left, notes, activity history — not a
// second, narrower view of the same lead.
// Availability itself (the weekly template, blocked-out dates) is managed on
// the separate "Demo slots" tab — see DemoSlotsPanel.tsx.

const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });

export function VideoCallsPanel({ leads, onOpen, onMove }: { leads: Lead[]; onOpen: (l: Lead) => void; onMove: (id: string, s: Stage) => void }) {
  const router = useRouter();
  const now = Date.now();
  const booked = leads.filter((l) => l.slotAt && new Date(l.slotAt).getTime() >= now).sort((a, b) => (a.slotAt! < b.slotAt! ? -1 : 1));

  const byDay = booked.reduce<Record<string, Lead[]>>((acc, l) => {
    const key = dayKey.format(new Date(l.slotAt!));
    (acc[key] ??= []).push(l);
    return acc;
  }, {});

  // "Attended?" is a quick post-call triage, not a stored field: No moves
  // the lead straight to Lost; Yes just reveals the same "move to any stage"
  // control the Pipeline cards have, for whichever stage the call actually
  // earned. `revealed` only tracks which rows have clicked Yes this session.
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <div className="mt-4">
      <h3 className="text-[15px] font-extrabold text-[var(--ink)]">📹 Upcoming video calls</h3>
      <p className="mt-0.5 max-w-[560px] text-[12px] text-[var(--ink-3)]">Every demo video call booked from the public page, soonest first — click one for everything they wrote when booking. Manage when calls can be booked on the <b>Demo slots</b> tab.</p>

      <div className="mt-3 flex flex-col gap-4">
        {booked.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-[12.5px] text-[var(--ink-3)]">No video calls booked yet.</div>
        ) : Object.entries(byDay).map(([day, rows]) => (
          <div key={day}>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{dayFmt.format(new Date(rows[0].slotAt!))}</div>
            <ul className="overflow-hidden rounded-xl border border-[var(--line)]">
              {rows.map((l, i) => {
                const showMove = revealed[l.id] || l.stage !== "demo";
                return (
                  <li key={l.id} data-ui="card" className={`flex flex-wrap items-center gap-3 px-3.5 py-2.5 ${i > 0 ? "border-t border-[var(--line)]" : ""}`}>
                    <div className="flex min-w-0 flex-1 cursor-pointer items-center gap-3" onClick={() => onOpen(l)}>
                      {l.videoRoom ? (
                        <button type="button" onClick={(e) => { e.stopPropagation(); router.push(`/platform/call/${l.id}`); }}
                          className="rounded-full bg-[#eef4fd] px-2.5 py-1 text-[11.5px] font-extrabold text-[#1d3a8f] hover:bg-[#dde8fb]">
                          📹 Video call · {timeFmt.format(new Date(l.slotAt!))}
                        </button>
                      ) : (
                        <span className="rounded-full bg-[#eef4fd] px-2.5 py-1 text-[11.5px] font-extrabold text-[#1d3a8f]">📹 Video call · {timeFmt.format(new Date(l.slotAt!))}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-extrabold text-[var(--ink)]">{l.business}</div>
                        <div className="truncate text-[11px] text-[var(--ink-3)]">{l.contactName} · {l.email}{l.phone ? ` · ${l.phone}` : ""}</div>
                      </div>
                      <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10.5px] font-bold capitalize text-[var(--ink-3)]">{l.plan}</span>
                    </div>
                    {l.stage === "lost" ? (
                      <span className="rounded-full bg-[#fdebec] px-2.5 py-1 text-[11px] font-extrabold text-[#c02636]">✗ No-show — Lost</span>
                    ) : !showMove ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-[var(--ink-3)]">Attended?</span>
                        <button type="button" onClick={() => setRevealed((r) => ({ ...r, [l.id]: true }))}
                          className="rounded-full bg-[#e7f6ee] px-3 py-1 text-[11px] font-extrabold text-[#0f7a43] hover:brightness-95">✓ Yes</button>
                        <button type="button" onClick={() => onMove(l.id, "lost")}
                          className="rounded-full bg-[#fdebec] px-3 py-1 text-[11px] font-extrabold text-[#c02636] hover:brightness-95">✗ No</button>
                      </div>
                    ) : (
                      <select
                        value={l.stage}
                        onChange={(e) => onMove(l.id, e.target.value as Stage)}
                        className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-[11px] font-bold text-[var(--ink-2)]"
                      >
                        {STAGES.map((s) => <option key={s.id} value={s.id}>Move to: {s.label}</option>)}
                      </select>
                    )}
                    <span className="text-[var(--ink-3)]">›</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
