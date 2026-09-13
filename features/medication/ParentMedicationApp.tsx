"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { get as apiGet, post as apiPost, put as apiPut } from "@/lib/api";
import { useI18n } from "@/lib/i18n/provider";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card, FieldLabel, Input, Select } from "@/components/ui";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

interface Provider { tenantId: string; name: string }
interface Child { id: string; name: string; sex?: string }
interface Booking { childId?: string; childName?: string; tenantId?: string; days?: string[] }
interface Med { id: string; tenantId?: string; childId?: string; childName: string; name: string; dose: string; route?: string; condition?: string; schedule?: string; asNeeded?: boolean; archived?: boolean; consentGranted?: boolean; source?: string; parentNote?: string }
interface Dose { id: string; medicationId?: string; date?: string; time?: string; doseGiven?: string; administeredByName?: string; notes?: string }

const when = (d?: string, t?: string, loc = "en-GB") => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString(loc, { day: "numeric", month: "short", timeZone: "UTC" }) + (t ? ` · ${t}` : "") : "");
const fmtDay = (d: string, loc = "en-GB") => new Date(`${d}T00:00:00Z`).toLocaleDateString(loc, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** A translated sentence with {placeholders} rendered bold — the consent line
 *  names the children and the provider, and word order differs by language. */
function Rich({ text, vars }: { text: string; vars: Record<string, string> }) {
  return <>{text.split(/(\{\w+\})/).map((part, i) => { const m = /^\{(\w+)\}$/.exec(part); return m && m[1] in vars ? <b key={i}>{vars[m[1]]}</b> : part; })}</>;
}
type Freq = "booked" | "chosen" | "asneeded";

// Blue for a boy, pink for a girl (matches the manual), neutral otherwise.
function genderStyle(sex?: string): { bg: string; fg: string; ring: string } {
  const s = (sex ?? "").trim().toLowerCase();
  if (s.startsWith("boy") || s === "male" || s === "m") return { bg: "#eaf0fc", fg: "#1d3a8f", ring: "#3f78d8" };
  if (s.startsWith("girl") || s === "female" || s === "f") return { bg: "#fdeaf1", fg: "#c01858", ring: "#EE1F63" };
  return { bg: "var(--panel)", fg: "var(--ink-2)", ring: "#8a86a3" };
}

export function ParentMedicationApp() {
  const { t, locale: lang } = useI18n();
  // Plain "en" formats dates the American way (Sep 12) — UK English is en-GB.
  const locale = lang === "en" ? "en-GB" : lang;
  const [providers, setProviders] = useState<Provider[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [meds, setMeds] = useState<Med[] | null>(null);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [openMed, setOpenMed] = useState<string | null>(null);
  const [noteEdit, setNoteEdit] = useState<{ id: string; text: string } | null>(null);
  const [f, setF] = useState({ tenantId: "", name: "", dose: "", condition: "", storage: "", notes: "", consent: false });
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));
  const [childIds, setChildIds] = useState<string[]>([]);
  const [freq, setFreq] = useState<Freq>("booked");
  const [dates, setDates] = useState<string[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [timeInput, setTimeInput] = useState("");
  const addTime = () => { if (timeInput && !times.includes(timeInput)) { setTimes([...times, timeInput].sort()); setTimeInput(""); } };
  const [todayStr] = useState(() => new Date().toISOString().slice(0, 10));
  // Dose emails — on until the parent mutes them. The switch used to be a
  // localStorage flag the server never saw, so "Stop notifying me" changed the
  // words on this screen and the emails kept coming. It's the family's
  // server-side preference now (/api/notifications/prefs, category
  // "medication"): muting stops the EMAIL; every dose still lands on the bell.
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    apiGet<{ muted?: Record<string, boolean> }>("/api/notifications/prefs").then((p) => setMuted(!!p.muted?.medication)).catch(() => {});
  }, []);
  const toggleMute = () => {
    const n = !muted;
    setMuted(n);
    apiPut("/api/notifications/prefs", { category: "medication", muted: n }).catch((e) => { setMuted(!n); setError(e instanceof Error ? e.message : "Couldn’t change that"); });
  };

  const load = useCallback(() => {
    apiGet<Med[]>("/api/medications").then(setMeds).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<Dose[]>("/api/medications/administrations").then(setDoses).catch(() => {});
    // Booked days feed the "days I pick" list — refreshed on the realtime hook
    // below so a new booking appears here without a reload.
    apiGet<Booking[]>("/api/my/bookings").then(setBookings).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    apiGet<Provider[]>("/api/my/providers").then((ps) => { setProviders(ps); if (ps[0]) setF((p) => ({ ...p, tenantId: ps[0].tenantId })); }).catch(() => {});
    apiGet<Child[]>("/api/my/children").then((cs) => { setChildren(cs); if (cs[0]) setChildIds([cs[0].id]); }).catch(() => {});
  }, [load]);
  useRealtime(["children", "bookings", "medications", "medicationAdmin"], load);

  const providerName = (id: string) => providers.find((p) => p.tenantId === id)?.name ?? t("care.yourProvider");
  const dosesFor = (medId: string) => doses.filter((d) => d.medicationId === medId);
  // The distinct booked session days for the picked children at the chosen provider.
  const bookedDays = [...new Set(
    bookings
      .filter((b) => b.tenantId === f.tenantId && (childIds.length === 0 || childIds.includes(b.childId ?? "")))
      .flatMap((b) => b.days ?? []),
  )].filter((d) => d >= todayStr).sort();
  const selectedNames = childIds.map((id) => children.find((c) => c.id === id)?.name).filter(Boolean).join(" & ") || t("care.yourChild");
  const canNext1 = childIds.length > 0 && !!f.tenantId && !!f.name.trim() && !!f.dose.trim();

  const toggleChild = (id: string) => setChildIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleDay = (d: string) => setDates((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d].sort()));

  async function authorise() {
    if (!f.tenantId || childIds.length === 0) { setError(t("care.errChooseProvider")); return; }
    if (!f.name.trim() || !f.dose.trim()) { setError(t("care.errNameDose")); return; }
    if (freq === "chosen" && dates.length === 0) { setError(t("care.errPickDays")); return; }
    if (!f.consent) { setError(t("care.errConsent")); return; }
    const base = freq === "booked" ? "On every booked day"
      : freq === "chosen" ? `On these days: ${dates.map((d) => fmtDay(d)).join(", ")}`
      : "Only when needed";
    const schedule = times.length ? `${base} · at ${times.join(", ")}` : base;
    setError(null); setOk(null);
    try {
      for (const cid of childIds) {
        const child = children.find((c) => c.id === cid);
        await apiPost("/api/medications/authorise", {
          tenantId: f.tenantId, childId: cid, childName: child?.name ?? "Child",
          name: f.name, dose: f.dose, condition: f.condition || undefined,
          schedule, asNeeded: freq === "asneeded", storage: f.storage || undefined,
          notes: f.notes || undefined,
        });
      }
      setF((p) => ({ ...p, name: "", dose: "", condition: "", storage: "", notes: "", consent: false }));
      setFreq("booked"); setDates([]); setTimes([]); setTimeInput("");
      setOpen(false); setOk(t("care.authorisedOk", { who: childIds.length > 1 ? t("care.nChildren", { n: childIds.length }) : selectedNames })); load();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t authorise"); }
  }
  async function saveNote(id: string, note: string) {
    try { await apiPost(`/api/medications/${encodeURIComponent(id)}/note`, { note: note.trim() }); setNoteEdit(null); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save note"); }
  }
  async function giveConsent(m: Med) {
    if (!confirm(t("care.giveConsentConfirm", { provider: m.tenantId ? providerName(m.tenantId) : t("care.yourProvider"), name: m.name, child: m.childName }))) return;
    try { await apiPost(`/api/medications/${encodeURIComponent(m.id)}/consent`, {}); setOk(t("care.consentGivenOk", { name: m.name })); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }
  async function withdraw(m: Med) {
    if (!confirm(t("care.withdrawConfirm", { name: m.name }))) return;
    try { await apiPost(`/api/medications/${encodeURIComponent(m.id)}/withdraw`, {}); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <style>{`@keyframes medGlow{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--glow,#1d3a8f) 55%,transparent)}50%{box-shadow:0 0 0 6px color-mix(in srgb,var(--glow,#1d3a8f) 0%,transparent)}}.med-flicker{animation:medGlow 1.7s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.med-flicker{animation:none}}`}</style>

      {/* Hero — matches the other portal pages (blue → white). */}
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">💊</span>
              {t("care.medTitle")}
            </div>
            <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">{t("care.medLede")}</p>
          </div>
          {providers.length > 0 && children.length > 0 && !open && (
            <button type="button" onClick={() => { setStep(1); setOpen(true); }} className="rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-[#1d3a8f] shadow-md transition-transform hover:-translate-y-px">{t("care.authoriseBtn")}</button>
          )}
        </div>
      </div>

      {/* How it works — clear, simple. */}
      {providers.length > 0 && children.length > 0 && (
        <div className="mb-3 rounded-xl border border-[var(--line)] bg-[#f4f8ff] px-3.5 py-2.5 text-[12.5px] leading-[1.55] text-[var(--ink-2)]">
          <b className="text-[var(--ink)]">{t("care.howTitle")}</b> {t("care.howBody")}
        </div>
      )}

      {/* Notify preference bar. */}
      {providers.length > 0 && children.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5">
          <span className="text-[12.5px] text-[var(--ink-2)]">{muted ? t("care.alertsOff") : t("care.alertsOn")}</span>
          <button type="button" onClick={toggleMute} className="rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors"
            style={muted ? { borderColor: "#1d3a8f", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
            {muted ? t("care.alertsTurnOn") : t("care.alertsTurnOff")}
          </button>
        </div>
      )}

      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {ok && <div className="mb-3 rounded-lg border border-[var(--line)] bg-[#eaf0fc] px-3 py-2 text-[12.5px] text-[#1d3a8f]">{ok}</div>}

      {children.length === 0 || providers.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{t("care.needChild")}</Card>
      ) : open && (
        <Card className="mb-3.5 p-4">
          <div className="mb-3 text-[13.5px] font-extrabold">{t("care.formTitle")}</div>

          {/* Step indicator */}
          <div className="mb-4 flex items-center">
            {([[1, t("care.stepMedicine")], [2, t("care.stepWhen")], [3, t("care.stepConsent")]] as [number, string][]).map(([n, label], i, arr) => (
              <div key={n} className={`flex items-center gap-2 ${i < arr.length - 1 ? "flex-1" : ""}`}>
                <button type="button" onClick={() => { if (n === 1 || canNext1) setStep(n); }} className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-extrabold transition-colors" style={step === n ? { background: "#1d3a8f", color: "#fff" } : step > n ? { background: "#e7f6ee", color: "#0f7a43" } : { background: "var(--panel)", color: "var(--ink-3)" }}>{step > n ? "✓" : n}</span>
                  <span className="hidden text-[13px] font-extrabold sm:inline" style={{ color: step === n ? "var(--ink)" : "var(--ink-3)" }}>{label}</span>
                </button>
                {i < arr.length - 1 && <span className="mx-2 h-1 flex-1 rounded-full" style={{ background: step > n ? "#0f7a43" : "var(--line)" }} />}
              </div>
            ))}
          </div>

          {step === 1 && (<>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div><FieldLabel>{t("care.provider")}</FieldLabel><Select value={f.tenantId} onChange={(e) => set({ tenantId: e.target.value })} className="w-full">{providers.map((p) => <option key={p.tenantId} value={p.tenantId}>{p.name}</option>)}</Select></div>
          </div>

          {/* Child picker — tick one or both; coloured by gender (blue boy / pink girl). */}
          <div className="mt-3">
            <FieldLabel>{children.length > 1 ? t("care.whichChildren") : t("care.whichChild")}</FieldLabel>
            <div className="mt-1 flex flex-wrap gap-2">
              {children.map((c) => {
                const on = childIds.includes(c.id);
                const g = genderStyle(c.sex);
                return (
                  <button key={c.id} type="button" onClick={() => toggleChild(c.id)}
                    className={`flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-[13px] font-extrabold transition-colors ${on ? "med-flicker" : ""}`}
                    style={on ? { borderColor: g.ring, background: g.ring, color: "#fff", ["--glow" as string]: g.ring } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-3)" }}>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold" style={on ? { background: "#fff", color: g.ring } : { background: "var(--ink-3)", color: "#fff" }}>{on ? "✓" : (c.name[0] ?? "?")}</span>
                    {c.name}
                  </button>
                );
              })}
            </div>
            {childIds.length > 1 && <p className="mt-1.5 text-[12px] font-bold text-[#1d3a8f]">{t("care.bothChildren")}</p>}
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <div><FieldLabel>{t("care.medicine")}</FieldLabel><Input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder={t("care.medicinePh")} className="w-full" /></div>
            <div><FieldLabel>{t("care.dose")}</FieldLabel><Input value={f.dose} onChange={(e) => set({ dose: e.target.value })} placeholder={t("care.dosePh")} className="w-full" /></div>
            <div><FieldLabel>{t("care.condition")}</FieldLabel><Input value={f.condition} onChange={(e) => set({ condition: e.target.value })} placeholder={t("care.conditionPh")} className="w-full" /></div>
            <div><FieldLabel>{t("care.storage")}</FieldLabel><Input value={f.storage} onChange={(e) => set({ storage: e.target.value })} placeholder={t("care.storagePh")} className="w-full" /></div>
          </div>
          </>)}

          {step === 2 && (<>
          {/* When to give — plain-English options. */}
          <div className="mt-3">
            <FieldLabel>{t("care.whenGive")}</FieldLabel>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {([["booked", t("care.freqBooked")], ["chosen", t("care.freqChosen")], ["asneeded", t("care.freqAsNeeded")]] as [Freq, string][]).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setFreq(id)} className="rounded-xl border-2 px-4 py-2.5 text-[13px] font-extrabold transition-colors"
                  style={freq === id ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "#cfe0f7", background: "#eef4fd", color: "#1d3a8f" }}>{label}</button>
              ))}
            </div>
            {freq === "booked" && <p className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">{t("care.freqBookedHint")}</p>}
            {freq === "asneeded" && <p className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">{t("care.freqAsNeededHint")}</p>}
            {freq === "chosen" && (
              <div className="mt-2">
                {bookedDays.length === 0 ? (
                  <p className="text-[11.5px] text-[var(--ink-3)]">{t("care.noBookedDays", { provider: providerName(f.tenantId) })}</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {bookedDays.map((d) => {
                        const on = dates.includes(d);
                        return <button key={d} type="button" onClick={() => toggleDay(d)} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors"
                          style={on ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{on ? "✓ " : ""}{fmtDay(d, locale)}</button>;
                      })}
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--ink-3)]">{childIds.length > 1 ? t("care.pickDaysHintMany") : t("care.pickDaysHintOne")}</p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-3">
            <FieldLabel>{t("care.setTimes")}</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="time" value={timeInput} onChange={(e) => setTimeInput(e.target.value)} className="w-auto" />
              <Button sm onClick={addTime}>{t("care.addTime")}</Button>
              <span className="text-[11px] text-[var(--ink-3)]">{t("care.timesHint")}</span>
            </div>
            {times.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {times.map((tm) => (
                  <span key={tm} className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf0fc] px-2.5 py-1 text-[11.5px] font-bold text-[#1d3a8f]">🕒 {tm}<button type="button" onClick={() => setTimes(times.filter((x) => x !== tm))} aria-label={t("care.removeTime")} className="text-[#1d3a8f]">✕</button></span>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3"><FieldLabel>{t("care.instructions")}</FieldLabel><Input value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder={t("care.instructionsPh")} className="w-full" /></div>
          </>)}

          {step === 3 && (
            <label className="flex items-start gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 text-[13px]"><input type="checkbox" checked={f.consent} onChange={(e) => set({ consent: e.target.checked })} className="mt-0.5" /><span><Rich text={t("care.consentText")} vars={{ children: selectedNames, provider: providerName(f.tenantId) }} /></span></label>
          )}

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
            <Button onClick={() => setOpen(false)}>{t("care.cancel")}</Button>
            <div className="flex gap-2">
              {step > 1 && <Button onClick={() => setStep(step - 1)}>{t("care.back")}</Button>}
              {step < 3 && <Button variant="solid" disabled={step === 1 && !canNext1} onClick={() => setStep(step + 1)}>{t("care.next")}</Button>}
              {step === 3 && <Button variant="solid" onClick={authorise}>{t("care.authorise")}</Button>}
            </div>
          </div>
        </Card>
      )}

      {!meds ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{t("care.loading")}</div>
      : meds.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{t("care.none")}</Card>
      : (
        <div className="flex flex-col gap-2">
          {meds.map((m) => {
            const md = dosesFor(m.id);
            return (
              <div key={m.id} data-ui="card" className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_6px_20px_-8px_rgba(16,24,40,.18)]">
                {/* Gradient header — matches the family cards. */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-white" style={{ background: "linear-gradient(120deg,#4f8bf5 0%,#7aa9f0 100%)" }}>
                  <span className="flex items-baseline gap-2">
                    <span className="text-[15.5px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{m.name}</span>
                    <span className="text-[12.5px] font-semibold text-white/80">{m.dose}{m.route ? ` · ${m.route}` : ""}</span>
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-white/85">{m.childName}{m.tenantId ? ` · ${providerName(m.tenantId)}` : ""}</span>
                </div>
                {/* Body */}
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {m.condition && <Badge tone={{ bg: "var(--panel)", fg: "var(--ink-2)" }}>{m.condition}</Badge>}
                    {m.asNeeded ? <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>{t("care.asNeeded")}</Badge> : m.schedule && <Badge tone={{ bg: "#e7f6ee", fg: "#0f7a43" }}>🔁 {m.schedule}</Badge>}
                    {m.consentGranted ? <Badge tone={{ bg: "#e7f6ee", fg: "#0f7a43" }}>{t("care.consentGiven")}</Badge>
                      : m.archived ? <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "var(--red,#c02636)" }}>{t("care.consentWithdrawn")}</Badge>
                      : <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>{t("care.awaitingConsent")}</Badge>}
                  </div>
                  {m.parentNote && noteEdit?.id !== m.id && <div className="mt-2.5 rounded-lg border border-[var(--line)] bg-[#f4f8ff] px-3 py-2 text-[12px] text-[var(--ink-2)]">📝 <b className="text-[var(--ink)]">{t("care.yourNote")}</b> {m.parentNote}</div>}
                  {noteEdit?.id === m.id && (
                    <div className="mt-2.5">
                      <textarea value={noteEdit.text} onChange={(e) => setNoteEdit({ id: m.id, text: e.target.value })} rows={2} placeholder={t("care.notePh")} className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[#1d3a8f]" />
                      <div className="mt-1.5 flex flex-wrap items-center gap-2"><Button sm variant="solid" onClick={() => saveNote(m.id, noteEdit.text)}>{t("care.saveNote")}</Button><Button sm onClick={() => setNoteEdit(null)}>{t("care.cancel")}</Button><span className="text-[11px] text-[var(--ink-3)]">{t("care.noteHint")}</span></div>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
                    <Button sm onClick={() => setOpenMed(openMed === m.id ? null : m.id)}>{openMed === m.id ? t("care.hideDoses") : t("care.dosesGiven", { n: md.length })}</Button>
                    <Button sm onClick={() => setNoteEdit(noteEdit?.id === m.id ? null : { id: m.id, text: m.parentNote ?? "" })}>{m.parentNote ? t("care.editNote") : t("care.addNote")}</Button>
                    {m.consentGranted && <Button sm variant="danger" onClick={() => withdraw(m)}>{t("care.withdraw")}</Button>}
                    {/* The provider added it (at drop-off, from a form) — the parent says yes here. */}
                    {!m.consentGranted && !m.archived && <Button sm variant="solid" onClick={() => giveConsent(m)}>{t("care.giveConsent")}</Button>}
                  </div>
                  {openMed === m.id && (
                    <div className="mt-2.5 rounded-xl bg-[var(--panel)] px-3 py-2.5">
                      {md.length === 0 ? <div className="text-[12px] text-[var(--ink-3)]">{t("care.noDoses")}</div> : (
                        <div className="flex flex-col gap-1.5">
                          {md.map((d) => (
                            <div key={d.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                              <span className="font-bold tabular-nums">{when(d.date, d.time, locale)}</span>
                              <span>{d.doseGiven}</span>
                              <span className="text-[var(--ink-3)]">{t("care.byName", { name: d.administeredByName ?? "" })}</span>
                              {d.notes && <span className="text-[var(--ink-3)]">· {d.notes}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
