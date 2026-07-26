"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { api, get as apiGet, post as apiPost, put as apiPut } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { Badge, Button, Card, FieldLabel, Input } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// Trips & visits — the off-site log every provider keeps: where, when, who's
// going, how they get there, the risk assessment and parental consent. Themed
// + stepped to match the Medication / Accidents pages, backed by /api/trips.
// ─────────────────────────────────────────────────────────────────────────

type Status = "planned" | "completed" | "cancelled";
interface Trip {
  id: string; destination: string; date: string; departTime?: string; returnTime?: string;
  listingId?: string; transport?: string; childNames: string[]; staff: string[]; headcount?: number;
  riskAssessment?: string; consentObtained: boolean; notes?: string; status: Status; createdByName?: string;
}

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;
const STAT = {
  planned: { label: "Planned", bg: "#eaf0fc", fg: "#1d3a8f" },
  completed: { label: "Completed", bg: "#e7f6ee", fg: "#0f7a43" },
  cancelled: { label: "Cancelled", bg: "#fdebec", fg: "#c02636" },
} as const;
const TRANSPORT = ["Minibus", "Coach", "Walking", "Public bus", "Train", "Parents drop-off", "Provider vehicles"];
const fmtDate = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const todayIso = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };

type Draft = Partial<Trip> & { children: string[]; staffList: string[] };
const emptyDraft = (): Draft => ({ destination: "", date: todayIso(), departTime: "", returnTime: "", transport: "", children: [], staffList: [], riskAssessment: "", consentObtained: false, notes: "", status: "planned" });

interface Booking { child?: string; listing?: string; listingId?: string }

function TripForm({ existing, ratioTarget, onSaved, onCancel }: { existing?: Trip; ratioTarget: number; onSaved: () => void; onCancel: () => void }) {
  const isEdit = !!existing;
  const [d, setD] = useState<Draft>(existing ? { ...existing, children: existing.childNames, staffList: existing.staff } : emptyDraft());
  const [bkgs, setBkgs] = useState<Booking[]>([]);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staffInput, setStaffInput] = useState("");
  const set = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));
  useEffect(() => { apiGet<Booking[]>("/api/bookings").then(setBkgs).catch(() => {}); }, []);

  // Booked children — optionally filtered to a listing so a trip for one camp
  // only offers the kids on that camp.
  const listings = [...new Map(bkgs.filter((b) => b.listingId && b.listing).map((b) => [b.listingId!, b.listing!])).entries()];
  const childOptions = [...new Set(bkgs.filter((b) => b.child && (!d.listingId || b.listingId === d.listingId)).map((b) => b.child!.trim()))].sort();
  const toggleChild = (name: string) => set({ children: d.children.includes(name) ? d.children.filter((x) => x !== name) : [...d.children, name] });
  const addStaff = () => { const v = staffInput.trim(); if (v && !d.staffList.includes(v)) set({ staffList: [...d.staffList, v] }); setStaffInput(""); };
  const ratio = d.staffList.length > 0 ? d.children.length / d.staffList.length : Infinity;
  const understaffed = d.children.length > 0 && ratio > ratioTarget;

  async function save() {
    if (!d.destination?.trim() || !d.date) { setError("Add a destination and date."); return; }
    setBusy(true); setError(null);
    const body = {
      destination: d.destination, date: d.date, departTime: d.departTime || undefined, returnTime: d.returnTime || undefined,
      listingId: d.listingId || undefined, transport: d.transport || undefined, childNames: d.children, staff: d.staffList,
      riskAssessment: d.riskAssessment || undefined, consentObtained: !!d.consentObtained, notes: d.notes || undefined, status: d.status ?? "planned",
    };
    try {
      if (isEdit) await apiPut(`/api/trips/${encodeURIComponent(existing!.id)}`, body);
      else await apiPost("/api/trips", body);
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); setBusy(false); }
  }

  const canNext1 = !!d.destination?.trim() && !!d.date;
  const STEPS: [number, string][] = [[1, "Where & when"], [2, "Who's going"], [3, "Risk & consent"]];

  return (
    <Card className="mb-3.5 p-4">
      <div className="mb-3 text-[13.5px] font-extrabold">{isEdit ? "Edit trip" : "Plan a trip"}</div>
      <div className="mb-4 flex items-center">
        {STEPS.map(([n, label], i) => (
          <div key={n} className={`flex items-center gap-2 ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
            <button type="button" onClick={() => { if (n === 1 || canNext1) setStep(n); }} className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-extrabold transition-colors" style={step === n ? { background: "#1d3a8f", color: "#fff" } : step > n ? { background: "#e7f6ee", color: "#0f7a43" } : { background: "var(--panel)", color: "var(--ink-3)" }}>{step > n ? "✓" : n}</span>
              <span className="hidden text-[13px] font-extrabold sm:inline" style={{ color: step === n ? "var(--ink)" : "var(--ink-3)" }}>{label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="mx-2 h-1 flex-1 rounded-full" style={{ background: step > n ? "#0f7a43" : "var(--line)" }} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="sm:col-span-3"><FieldLabel>Where are you going?</FieldLabel><Input value={d.destination ?? ""} onChange={(e) => set({ destination: e.target.value })} placeholder="e.g. Woburn Safari Park" className="w-full" /></div>
          {listings.length > 0 && (
            <div className="sm:col-span-3"><FieldLabel>For which camp/club? (pulls the booked children)</FieldLabel>
              <select value={d.listingId ?? ""} onChange={(e) => set({ listingId: e.target.value || undefined, children: [] })} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px]">
                <option value="">All my bookings</option>
                {listings.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
          )}
          <div><FieldLabel>Date</FieldLabel><Input type="date" min={todayIso()} value={d.date ?? ""} onChange={(e) => set({ date: e.target.value })} className="w-full" /></div>
          <div><FieldLabel>Depart</FieldLabel><Input type="time" value={d.departTime ?? ""} onChange={(e) => set({ departTime: e.target.value })} className="w-full" /></div>
          <div><FieldLabel>Return</FieldLabel><Input type="time" value={d.returnTime ?? ""} onChange={(e) => set({ returnTime: e.target.value })} className="w-full" /></div>
          <div className="sm:col-span-3"><FieldLabel>Transport</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {TRANSPORT.map((t) => (
                <button key={t} type="button" onClick={() => set({ transport: t })} className="rounded-full border-2 px-3 py-1.5 text-[12px] font-bold transition-colors"
                  style={d.transport === t ? { borderColor: "#1d3a8f", background: "#eaf0fc", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{t}</button>
              ))}
            </div>
            <Input value={TRANSPORT.includes(d.transport ?? "") ? "" : d.transport ?? ""} onChange={(e) => set({ transport: e.target.value })} placeholder="…or type your own" className="mt-1.5 w-full" />
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <FieldLabel>Who&rsquo;s going? {d.listingId ? "(booked children on this listing)" : "(booked children)"}</FieldLabel>
          {childOptions.length > 0 ? (
            <div className="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1.5 [scrollbar-width:thin]">
              {childOptions.map((name) => {
                const on = d.children.includes(name);
                return (
                  <label key={name} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px]" style={on ? { background: "#eef4fd", color: "#1d3a8f", fontWeight: 700 } : { color: "var(--ink-2)" }}>
                    <input type="checkbox" checked={on} onChange={() => toggleChild(name)} />{name}
                  </label>
                );
              })}
            </div>
          ) : <div className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-3)]">No booked children found{d.listingId ? " for this listing" : ""} — you can still add staff and details.</div>}
          <div className="mt-1.5 text-[11.5px] font-semibold text-[#1d3a8f]">{d.children.length} child{d.children.length === 1 ? "" : "ren"} on the trip</div>

          <div className="mt-3"><FieldLabel>Staff on the trip</FieldLabel>
            <div className="flex gap-2"><Input value={staffInput} onChange={(e) => setStaffInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStaff(); } }} placeholder="Add a staff name…" className="flex-1" /><Button variant="solid" onClick={addStaff}>Add</Button></div>
            {d.staffList.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {d.staffList.map((s) => <span key={s} className="inline-flex items-center gap-1 rounded-full bg-[#eaf0fc] px-2.5 py-0.5 text-[12px] font-semibold text-[#1d3a8f]">{s}<button type="button" onClick={() => set({ staffList: d.staffList.filter((x) => x !== s) })} className="text-[#1d3a8f]/60 hover:text-[#1d3a8f]">✕</button></span>)}
              </div>
            )}
          </div>
          {d.staffList.length > 0 && (
            <div className="mt-2.5 rounded-lg px-3 py-2 text-[12px] font-semibold" style={understaffed ? { background: "#fdebec", color: "#c02636" } : { background: "#e7f6ee", color: "#0f7a43" }}>
              {understaffed ? `⚠️ ${d.children.length} children to ${d.staffList.length} staff — that's over your ${ratioTarget}:1 target. Add staff or split the trip.` : `✓ ${d.children.length} children to ${d.staffList.length} staff — within your ${ratioTarget}:1 target.`}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <>
          <div><FieldLabel>Risk assessment</FieldLabel><textarea value={d.riskAssessment ?? ""} onChange={(e) => set({ riskAssessment: e.target.value })} rows={3} placeholder="Route, hazards, headcounts, emergency plan, first aid kit, ratios…" className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-[#1d3a8f]" /></div>
          <label className="mt-3 flex items-center gap-2 text-[12.5px] font-bold"><input type="checkbox" checked={!!d.consentObtained} onChange={(e) => set({ consentObtained: e.target.checked })} />Parental consent obtained for every child on the trip</label>
          <div className="mt-2.5"><FieldLabel>Notes (optional)</FieldLabel><Input value={d.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. packed lunches needed; sun cream" className="w-full" /></div>
          {isEdit && (
            <div className="mt-3"><FieldLabel>Status</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {(["planned", "completed", "cancelled"] as Status[]).map((s) => (
                  <button key={s} type="button" onClick={() => set({ status: s })} className="rounded-xl border-2 px-4 py-2 text-[12.5px] font-extrabold transition-colors"
                    style={d.status === s ? { borderColor: STAT[s].fg, background: STAT[s].fg, color: "#fff" } : { borderColor: STAT[s].bg, background: STAT[s].bg, color: STAT[s].fg }}>{STAT[s].label}</button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {error && <div className="mt-3 text-[12.5px] font-bold text-[var(--red)]">{error}</div>}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <Button onClick={onCancel}>Cancel</Button>
        <div className="flex gap-2">
          {step > 1 && <Button onClick={() => setStep(step - 1)}>← Back</Button>}
          {step < 3 && <Button variant="solid" disabled={step === 1 && !canNext1} onClick={() => setStep(step + 1)}>Next →</Button>}
          {step === 3 && <Button variant="solid" disabled={busy} onClick={save}>{busy ? "Saving…" : isEdit ? "Save trip" : "Save trip"}</Button>}
        </div>
      </div>
    </Card>
  );
}

export function TripsApp() {
  const { settings } = useSettings();
  const ratioTarget = settings.trips?.ratioTarget ?? 8;
  const notifies = settings.trips?.notifyParent ?? true;
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const refresh = useCallback(() => { apiGet<Trip[]>("/api/trips").then((t) => { setTrips(t); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load")); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useRealtime(["trips"], refresh);

  async function remove(t: Trip) { if (!confirm(`Delete the trip to ${t.destination}?`)) return; try { await api(`/api/trips/${encodeURIComponent(t.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }

  const all = trips ?? [];
  const upcoming = all.filter((t) => t.status === "planned" && t.date >= todayIso()).length;
  const thisMonth = all.filter((t) => (t.date ?? "").slice(0, 7) === todayIso().slice(0, 7)).length;
  const consentPending = all.filter((t) => t.status === "planned" && !t.consentObtained).length;
  const tiles: [string, number][] = [["Upcoming", upcoming], ["This month", thisMonth], ["Consent pending", consentPending], ["Total", all.length]];
  const ql = q.trim().toLowerCase();
  const shown = useMemo(() => all.filter((t) => (!ql || t.destination.toLowerCase().includes(ql) || t.childNames.join(" ").toLowerCase().includes(ql)) && (!statusFilter || t.status === statusFilter))
    .sort((a, b) => (`${b.date}` < `${a.date}` ? -1 : 1)), [all, ql, statusFilter]);

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🚌</span>Trips &amp; visits
            </div>
            <p className="mt-1.5 max-w-[620px] text-[12.5px] leading-[1.5] text-white/85">Every off-site trip — where, when, who&rsquo;s going, transport, the risk assessment and parental consent, all in one place.</p>
          </div>
          {!adding && !editing && <button type="button" onClick={() => setAdding(true)} className="rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-[#1d3a8f] shadow-md transition-transform hover:-translate-y-px">＋ Plan a trip</button>}
        </div>
        {trips && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            {tiles.map(([label, v]) => (
              <div key={label} className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm">
                <div className="text-[20px] font-extrabold leading-none">{v}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {adding && <TripForm ratioTarget={ratioTarget} onSaved={() => { setAdding(false); refresh(); }} onCancel={() => setAdding(false)} />}
      {editing && <TripForm key={editing.id} existing={editing} ratioTarget={ratioTarget} onSaved={() => { setEditing(null); refresh(); }} onCancel={() => setEditing(null)} />}

      {trips && all.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {([["", "All"], ["planned", "Planned"], ["completed", "Completed"], ["cancelled", "Cancelled"]] as [string, string][]).map(([id, label]) => (
            <button key={label} type="button" onClick={() => setStatusFilter(id)} className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
              style={statusFilter === id ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>{label}</button>
          ))}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search destination or child…" className="ml-auto w-56 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] outline-none focus:border-[#1d3a8f]" />
        </div>
      )}

      {!trips ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : shown.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{all.length === 0 ? "No trips planned yet — plan your first off-site visit." : "No trips match."}</Card>
      : (
        <div className="flex flex-col gap-2.5">
          {shown.map((t) => {
            const st = STAT[t.status] ?? STAT.planned;
            const kids = t.headcount ?? t.childNames.length;
            const understaffed = kids > 0 && t.staff.length > 0 && kids / t.staff.length > ratioTarget;
            return (
              <Card key={t.id} className="overflow-hidden p-0">
                <div className="h-1.5 w-full" style={{ background: st.fg }} />
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-[16px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{t.destination}</span>
                        {t.transport && <span className="text-[12.5px] text-[var(--ink-2)]">· {t.transport}</span>}
                      </div>
                      <p className="mt-1 text-[12.5px] text-[var(--ink-2)]">{fmtDate(t.date)}{t.departTime ? ` · ${t.departTime}` : ""}{t.returnTime ? `–${t.returnTime}` : ""}</p>
                    </div>
                    <div className="flex flex-col items-start gap-1.5 sm:items-end">
                      <Badge tone={{ bg: st.bg, fg: st.fg }}>{st.label}</Badge>
                      <span className="text-[11.5px] text-[var(--ink-3)]">{kids} child{kids === 1 ? "" : "ren"} · {t.staff.length} staff</span>
                      {t.consentObtained ? <Badge tone={{ bg: "#e7f6ee", fg: "#0f7a43" }}>✓ consent obtained</Badge> : <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>consent pending</Badge>}
                      {understaffed && <Badge tone={{ bg: "#fdebec", fg: "#c02636" }}>⚠️ over {ratioTarget}:1 ratio</Badge>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
                    <Button sm onClick={() => setOpenId(openId === t.id ? null : t.id)}>{openId === t.id ? "Hide details" : "Details"}</Button>
                    <Button sm variant="solid" onClick={() => { setEditing(t); setAdding(false); setOpenId(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</Button>
                    {canManage && <Button sm variant="danger" onClick={() => remove(t)}>Delete</Button>}
                  </div>
                  {openId === t.id && (
                    <div className="mt-2.5 grid gap-x-6 gap-y-1.5 rounded-xl bg-[var(--panel)] px-3.5 py-3 text-[12px] sm:grid-cols-2">
                      {t.transport && <div><span className="text-[var(--ink-3)]">Transport: </span><b>{t.transport}</b></div>}
                      <div><span className="text-[var(--ink-3)]">Ratio: </span><b>{t.staff.length ? `${kids}:${t.staff.length} (${(kids / t.staff.length).toFixed(1)} per staff)` : "no staff added"}</b></div>
                      {t.childNames.length > 0 && <div className="sm:col-span-2"><span className="text-[var(--ink-3)]">Children: </span><b>{t.childNames.join(", ")}</b></div>}
                      {t.staff.length > 0 && <div className="sm:col-span-2"><span className="text-[var(--ink-3)]">Staff: </span><b>{t.staff.join(", ")}</b></div>}
                      {t.riskAssessment && <div className="sm:col-span-2"><span className="text-[var(--ink-3)]">Risk assessment: </span><b>{t.riskAssessment}</b></div>}
                      {t.notes && <div className="sm:col-span-2"><span className="text-[var(--ink-3)]">Notes: </span><b>{t.notes}</b></div>}
                      {t.createdByName && <div><span className="text-[var(--ink-3)]">Planned by: </span><b>{t.createdByName}</b></div>}
                    </div>
                  )}
                  {notifies && t.status === "planned" && !t.consentObtained && (
                    <div className="mt-2.5 rounded-lg bg-[#f4f8ff] px-3 py-2 text-[11.5px] text-[var(--ink-2)]">📨 Parents of the children on this trip are asked for consent in their area, and reminded until they give it.</div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
