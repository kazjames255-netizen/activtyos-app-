"use client";

import { dateLocale as dl } from "@/lib/i18n/format";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { Badge, Button, Card, FieldLabel, Input } from "@/components/ui";
import { ChildPicker, type ChildOption } from "@/components/pickers/ChildPicker";
import { SettingsLink } from "@/components/OperatorPage";
import { TourLauncher } from "@/features/common/TourLauncher";
import { useI18n, useT } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";
import { Rich } from "@/components/i18n/Rich";
import { scheduleLabel } from "./schedule";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

// ─────────────────────────────────────────────────────────────────────────
// Medication — authorised medicines (with parental consent) and the MAR
// (every dose given). You can't record a dose against a medication that
// isn't consented — the server enforces it; this UI reflects it. Staff
// administer and record; operators manage the authorisations. Simple by
// design — Kaz can restyle.
// ─────────────────────────────────────────────────────────────────────────

interface Med {
  id: string;
  childName: string;
  childId?: string;
  name: string;
  dose: string;
  route?: string;
  condition?: string;
  schedule?: string;
  instructions?: string;
  asNeeded: boolean;
  storage?: string;
  heldOnSite: boolean;
  expiryDate?: string;
  consentBy?: string;
  consentDate?: string;
  consentGranted: boolean;
  consentWithdrawnAt?: string;
  notes?: string;
  parentNote?: string;
  archived?: boolean;
}
interface AdminEvent {
  id: string;
  medicationId: string;
  medName: string;
  childName: string;
  date: string;
  time?: string;
  doseGiven: string;
  given?: boolean;
  administeredByName?: string;
  witnessedBy?: string;
  notes?: string;
}

const nowTime = () => {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(t.getHours())}:${p(t.getMinutes())}`;
};
const todayIso = () => {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
};
const fmt = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(dl(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
// The parent-approved day labels live in `schedule` ("On these days: Mon 27 Jul,
// …"). A dose on a day not in that list is flagged but still allowed — the day
// label here must match how the parent's form formats them.
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(dl(), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const BOOKED_SCHEDULE = "On every booked day"; // dynamic — approved = the child's current bookings
// `booked` is the child's live set of booked ISO days (recomputed from bookings)
// — only needed for the dynamic BOOKED_SCHEDULE. A fixed "On these days: …" list
// is parsed from the schedule string. Everything else is always approved.
const approvedForDay = (m: { schedule?: string }, iso: string, booked?: Set<string>) => {
  if (m.schedule === BOOKED_SCHEDULE) return booked ? booked.has(iso) : true;
  if (m.schedule?.startsWith("On these days")) return m.schedule.includes(dayLabel(iso));
  return true;
};

type MedDraft = Partial<Med> & { childName: string; name: string; dose: string };
const emptyMed = (): MedDraft => ({ childName: "", name: "", dose: "", asNeeded: false, heldOnSite: false, consentGranted: false });

function MedForm({ onSaved, onCancel, initialChild }: { onSaved: () => void; onCancel: () => void; initialChild?: string }) {
  const t = useT();
  const [d, setD] = useState<MedDraft>(() => ({ ...emptyMed(), childName: initialChild ?? "" }));
  const [freq, setFreq] = useState<"booked" | "chosen" | "asneeded">("booked");
  const [pickedDays, setPickedDays] = useState<string[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [timeInput, setTimeInput] = useState("");
  const [expiryNA, setExpiryNA] = useState(false);
  const [step, setStep] = useState(1);
  const addTime = () => { if (timeInput && !times.includes(timeInput)) { setTimes([...times, timeInput].sort()); setTimeInput(""); } };
  const [bkgs, setBkgs] = useState<{ child?: string; childId?: string; days?: string[] }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<MedDraft>) => setD((p) => ({ ...p, ...patch }));
  // The picked child's upcoming booked days, from this tenant's bookings — the
  // same list the parent sees, so "Only on the days I pick" matches both ends.
  useEffect(() => { apiGet<{ child?: string; childId?: string; days?: string[] }[]>("/api/bookings").then(setBkgs).catch(() => {}); }, []);
  const forChild = bkgs.filter((b) => (b.child ?? "").trim().toLowerCase() === (d.childName ?? "").trim().toLowerCase());
  const bookedDays = [...new Set(forChild.flatMap((b) => b.days ?? []))].filter((x) => x >= todayIso()).sort();
  // Resolve the picked child's id from their bookings so the med (and its doses)
  // link to the child → they reach the parent's Medication view.
  const linkedChildId = forChild.find((b) => b.childId)?.childId;
  const childOptions: ChildOption[] = [...new Map(bkgs.filter((b) => b.child).map((b) => [b.child!.trim().toLowerCase(), { name: b.child!, childId: b.childId }])).values()];

  async function save() {
    if (!d.childName?.trim() || !d.name?.trim() || !d.dose?.trim()) {
      setError(t("p7med.errRequired"));
      return;
    }
    if (freq === "chosen" && pickedDays.length === 0) { setError(t("p7med.errTickDays")); return; }
    setBusy(true);
    setError(null);
    // Same schedule strings as the parent form (so "On these days: …" reads and
    // flags the same on both ends). "Every day" isn't date-bound, so it covers
    // any new days the parent books later.
    const base = freq === "booked" ? BOOKED_SCHEDULE
      : freq === "chosen" ? `On these days: ${pickedDays.map(dayLabel).join(", ")}`
      : "Only when needed";
    const schedule = times.length ? `${base} · at ${times.join(", ")}` : base;
    try {
      await apiPost("/api/medications", { ...d, childId: linkedChildId ?? d.childId, asNeeded: freq === "asneeded", schedule });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("p7med.errSave"));
      setBusy(false);
    }
  }
  const canNext1 = !!d.childName?.trim() && !!d.name?.trim() && !!d.dose?.trim();
  const STEPS: [number, string][] = [[1, t("p7med.stepMedicine")], [2, t("p7med.stepWhen")], [3, t("p7med.stepConsent")]];

  return (
    <Card className="mb-3.5 p-4">
      <div className="mb-3 text-[13.5px] font-extrabold">{t("p7med.formTitle")}</div>

      {/* Big step indicator */}
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
          <div className="sm:col-span-3">
            <FieldLabel>{t("p7med.childBooked")}</FieldLabel>
            <ChildPicker value={d.childName} options={childOptions} onPick={(name, childId) => set({ childName: name, childId })} />
            {d.childName.trim() && !d.childId && (
              <div className="mt-1.5 rounded-lg border border-[#f0c36d] bg-[#fff7e6] px-3 py-2 text-[11.5px] text-[#8a5a00]">
                <Rich text={t("p7med.notBooked", { name: d.childName.trim() })} />
              </div>
            )}
          </div>
          <div><FieldLabel>{t("p7med.stepMedicine")}</FieldLabel><Input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder={t("p7med.phMedicine")} className="w-full" /></div>
          <div><FieldLabel>{t("p7med.lblDose")}</FieldLabel><Input value={d.dose} onChange={(e) => set({ dose: e.target.value })} placeholder={t("p7med.phDose")} className="w-full" /></div>
          <div><FieldLabel>{t("p7med.lblCondition")}</FieldLabel><Input value={d.condition ?? ""} onChange={(e) => set({ condition: e.target.value })} placeholder={t("p7med.phCondition")} className="w-full" /></div>
        </div>
      )}

      {step === 2 && (
        <>
          <div>
            <FieldLabel>{t("p7med.whenGive")}</FieldLabel>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {([["booked", t("p7med.optBooked")], ["chosen", t("p7med.optChosen")], ["asneeded", t("p7med.optNeeded")]] as ["booked" | "chosen" | "asneeded", string][]).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setFreq(id)} className="rounded-xl border-2 px-4 py-2.5 text-[13px] font-extrabold transition-colors"
                  style={freq === id ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "#cfe0f7", background: "#eef4fd", color: "#1d3a8f" }}>{label}</button>
              ))}
            </div>
            {freq === "booked" && <p className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">{t("p7med.hintBooked")}</p>}
            {freq === "asneeded" && <p className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">{t("p7med.hintNeeded")}</p>}
            {freq === "chosen" && (
              <div className="mt-2">
                {!d.childName?.trim() ? (
                  <p className="text-[11.5px] text-[var(--ink-3)]">{t("p7med.pickChildStep1")}</p>
                ) : bookedDays.length === 0 ? (
                  <p className="text-[11.5px] text-[var(--ink-3)]">{t("p7med.noUpcomingDays", { name: d.childName })}</p>
                ) : (
                  <>
                    <div className="mb-1.5 flex items-center gap-2">
                      <button type="button" onClick={() => setPickedDays(pickedDays.length === bookedDays.length ? [] : [...bookedDays])} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">{pickedDays.length === bookedDays.length ? t("p7med.clearAll") : t("p7med.selectAll")}</button>
                      <span className="text-[11px] text-[var(--ink-3)]">{t("p7med.upcomingDays")}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {bookedDays.map((day) => {
                        const on = pickedDays.includes(day);
                        return <button key={day} type="button" onClick={() => setPickedDays(on ? pickedDays.filter((x) => x !== day) : [...pickedDays, day].sort())} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors"
                          style={on ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{on ? "✓ " : ""}{dayLabel(day)}</button>;
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="mt-3">
              <FieldLabel>{t("p7med.setTimes")}</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="time" value={timeInput} onChange={(e) => setTimeInput(e.target.value)} className="w-auto" />
                <Button sm onClick={addTime}>{t("p7med.addTime")}</Button>
                <span className="text-[11px] text-[var(--ink-3)]">{t("p7med.timesHint")}</span>
              </div>
              {times.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {times.map((tm) => (
                    <span key={tm} className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf0fc] px-2.5 py-1 text-[11.5px] font-bold text-[#1d3a8f]">🕒 {tm}<button type="button" onClick={() => setTimes(times.filter((x) => x !== tm))} aria-label={t("p7med.removeTime")} className="text-[#1d3a8f]">✕</button></span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <div><FieldLabel>{t("p7med.lblStorage")}</FieldLabel><Input value={d.storage ?? ""} onChange={(e) => set({ storage: e.target.value })} placeholder={t("p7med.phStorage")} className="w-full" /></div>
            <div>
              <div className="flex items-center justify-between">
                <FieldLabel>{t("p7med.lblExpiry")}</FieldLabel>
                <button type="button" onClick={() => { const n = !expiryNA; setExpiryNA(n); if (n) set({ expiryDate: "" }); }} className="text-[11px] font-bold" style={{ color: expiryNA ? "#1d3a8f" : "var(--ink-3)" }}>{expiryNA ? t("p7med.naDone") : t("p7med.naShort")}</button>
              </div>
              {expiryNA ? (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[13px] text-[var(--ink-3)]">{t("p7med.notApplicable")}</div>
              ) : (
                <>
                  <Input type="date" value={d.expiryDate ?? ""} onChange={(e) => set({ expiryDate: e.target.value })} className="w-full" />
                  {d.expiryDate && d.expiryDate < todayIso() && <span className="mt-1 inline-block text-[11px] font-bold text-[#c02636]">{t("p7med.expiredWarn")}</span>}
                </>
              )}
            </div>
          </div>
          <div className="mt-2.5"><FieldLabel>{t("p7med.lblInstructions")}</FieldLabel><Input value={d.instructions ?? ""} onChange={(e) => set({ instructions: e.target.value })} placeholder={t("p7med.phInstructions")} className="w-full" /></div>
        </>
      )}

      {step === 3 && (
        <>
          <label className="flex items-center gap-2 text-[13px] font-bold">
            <input type="checkbox" checked={!!d.consentGranted} onChange={(e) => set({ consentGranted: e.target.checked })} />
            {t("p7med.consentCheck")}
          </label>
          <label className="mt-2 flex items-center gap-2 text-[12.5px]">
            <input type="checkbox" checked={!!d.heldOnSite} onChange={(e) => set({ heldOnSite: e.target.checked })} />
            {t("p7med.heldOnSite")}
          </label>
          {!d.consentGranted && <div className="mt-2 text-[11.5px] text-[var(--ink-3)]">{t("p7med.noConsentHint")}</div>}
        </>
      )}

      {error && <div className="mt-3 text-[12.5px] font-bold text-[var(--red)]">{error}</div>}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <Button onClick={onCancel}>{t("common.cancel")}</Button>
        <div className="flex gap-2">
          {step > 1 && <Button onClick={() => setStep(step - 1)}>{t("p7med.btnBack")}</Button>}
          {step < 3 && <Button variant="solid" disabled={step === 1 && !canNext1} onClick={() => setStep(step + 1)}>{t("p7med.btnNext")}</Button>}
          {step === 3 && <Button variant="solid" disabled={busy} onClick={save}>{busy ? t("p7med.btnSaving") : t("p7med.btnSaveMed")}</Button>}
        </div>
      </div>
    </Card>
  );
}

function AdministerForm({ med, onDone, requireWitness, booked }: { med: Med; onDone: (recorded: boolean, given?: boolean) => void; requireWitness?: boolean; booked?: Set<string> }) {
  const t = useT();
  const [dose, setDose] = useState(med.dose);
  const [given, setGiven] = useState(true);
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState(nowTime());
  const [witnessedBy, setWitnessedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stampNow = () => { setDate(todayIso()); setTime(nowTime()); };
  async function give() {
    if (!date) { setError(t("p7med.pickDay")); return; }
    if (requireWitness && !witnessedBy.trim()) { setError(t("p7med.witnessReq")); return; }
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/medications/${encodeURIComponent(med.id)}/administer`, { date, time, given, doseGiven: given ? dose : "Not given", witnessedBy, notes }) /* stored value stays English */;
      onDone(true, given);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("p7med.errRecord"));
      setBusy(false);
    }
  }
  return (
    <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-extrabold">{t("p7med.recordDoseOf", { name: med.name })}</span>
        <span className="ms-1 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p7med.givenQ")}</span>
        <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--surface)] p-0.5">
          <button type="button" onClick={() => setGiven(true)} className="rounded-full px-3 py-1 text-[12px] font-bold" style={given ? { background: "#0f7a43", color: "#fff" } : { color: "var(--ink-3)" }}>{t("p7med.yesBtn")}</button>
          <button type="button" onClick={() => setGiven(false)} className="rounded-full px-3 py-1 text-[12px] font-bold" style={!given ? { background: "#c02636", color: "#fff" } : { color: "var(--ink-3)" }}>{t("p7med.noBtn")}</button>
        </div>
        <button type="button" onClick={stampNow} className="ms-auto rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[12px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f]">{t("p7med.nowBtn")}</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        <div><FieldLabel>{t("p7med.lblDose")}</FieldLabel><Input value={dose} onChange={(e) => setDose(e.target.value)} className="w-full" /></div>
        <div><FieldLabel>{t("p7med.lblDayGiven")}</FieldLabel><Input type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} className="w-full" /></div>
        <div><FieldLabel>{t("p7med.lblTime")}</FieldLabel><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full" /></div>
        <div><FieldLabel>{t("p7med.lblWitnessed")}{requireWitness ? " *" : ""}</FieldLabel><Input value={witnessedBy} onChange={(e) => setWitnessedBy(e.target.value)} placeholder={requireWitness ? t("p7med.phRequired") : ""} className="w-full" /></div>
        <div><FieldLabel>{t("p7med.lblNotes")}</FieldLabel><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("p7med.phNotes")} className="w-full" /></div>
      </div>
      {!approvedForDay(med, date, booked) && <div className="mt-1.5 rounded-lg bg-[#fbeede] px-3 py-1.5 text-[11.5px] font-bold text-[#a9660a]">{med.schedule === BOOKED_SCHEDULE ? t("p7med.offBooked", { date: fmt(date) }) : t("p7med.offParent", { date: fmt(date) })}</div>}
      {error && <div className="mt-1.5 text-[12px] font-bold text-[var(--red)]">{error}</div>}
      <div className="mt-2 flex gap-2"><Button sm variant={given ? "solid" : "danger"} disabled={busy} onClick={give}>{busy ? t("p7med.btnRecording") : given ? t("p7med.btnConfirmGiven") : t("p7med.btnRecordNotGiven")}</Button><Button sm onClick={() => onDone(false)}>{t("common.cancel")}</Button></div>
    </div>
  );
}

export function MedicationApp() {
  const t = useT();
  const { locale } = useI18n();
  const { settings } = useSettings();
  const med = settings.medication ?? {};
  // Deep-link from the Register: ?child=Name opens the add form pre-filled.
  const searchParams = useSearchParams();
  const presetChild = searchParams.get("child") ?? "";
  const [role, setRole] = useState("");
  const [meds, setMeds] = useState<Med[] | null>(null);
  const [admins, setAdmins] = useState<AdminEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(!!presetChild);
  const [administering, setAdministering] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [logging, setLogging] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<{ id: string; given: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(null), 4500); };
  // Only leads/managers record doses when the setting is on (staff are blocked).
  const [lead, setLead] = useState(false);
  const canRecord = !(med.leadsOnly && role === "staff" && !lead);
  const parentMsg = (given: boolean) => {
    const informed = given ? (med.informParentGiven ?? true) : (med.informParentMissed ?? true);
    return `${given ? t("p7med.adminLogged") : t("p7med.loggedNotGiven")}${informed ? " " + t("p7med.parentInformed") : ""}`;
  };

  const [bkgs, setBkgs] = useState<{ child?: string; days?: string[]; listing?: string }[]>([]);
  const [listingFilter, setListingFilter] = useState("");
  const refresh = useCallback(() => {
    // Fetch archived too so they're never lost — the UI shows Active / Archived.
    apiGet<Med[]>("/api/medications?includeArchived=1").then((m) => { setMeds(m); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : t("p7med.errLoad")));
    apiGet<AdminEvent[]>("/api/medications/administrations").then(setAdmins).catch(() => {});
    // Bookings power the dynamic "On every booked day" approval check.
    apiGet<{ child?: string; days?: string[]; listing?: string }[]>("/api/bookings").then(setBkgs).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string; lead?: boolean }>("/api/me").then((me) => { setRole(me.role); setLead(me.lead === true); setCanManage(["company", "freelancer", "franchise"].includes(me.role)); }).catch(() => {}); }, []);
  useRealtime(["medications", "medicationAdmin", "bookings"], refresh);
  // Bookings grouped by child (lower-cased name), one pass — bookedDaysFor/listingsFor used
  // to each re-filter the whole `bkgs` array per medication row (dozens of meds × the
  // tenant's full booking history, every render). Recomputed whenever bkgs changes, so a
  // new booking still immediately widens what "On every booked day" approves.
  const bkgsByChild = useMemo(() => {
    const m = new Map<string, { child?: string; days?: string[]; listing?: string }[]>();
    for (const b of bkgs) { const k = (b.child ?? "").trim().toLowerCase(); (m.get(k) ?? m.set(k, []).get(k)!).push(b); }
    return m;
  }, [bkgs]);
  const bookedDaysFor = (name: string) => new Set((bkgsByChild.get((name ?? "").trim().toLowerCase()) ?? []).flatMap((b) => b.days ?? []));

  async function setArchived(m: Med, archived: boolean) {
    try { await api(`/api/medications/${encodeURIComponent(m.id)}`, { method: "PUT", body: JSON.stringify({ archived }) }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : t("p7med.errFailed")); }
  }
  // Only a record entered by mistake can be deleted: once a dose is recorded or
  // the parent has withdrawn consent it stays, archived (the server enforces it — d12s6).
  async function removeMed(m: Med) {
    if (!window.confirm(t("p7med.deleteConfirm", { med: m.name, child: m.childName }))) return;
    try { await api(`/api/medications/${encodeURIComponent(m.id)}`, { method: "DELETE" }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : t("p7med.errDelete")); }
  }
  // One-tap log for the common case — stamps today + now with the given/not-given
  // outcome. The detailed form ("with time / notes") handles back-dating etc.
  async function quickLog(m: Med, given: boolean) {
    setLogging(m.id);
    setError(null);
    try { await apiPost(`/api/medications/${encodeURIComponent(m.id)}/administer`, { date: todayIso(), time: nowTime(), given, doseGiven: given ? m.dose : "Not given" }); flash(parentMsg(given)); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : t("p7med.errRecord")); }
    finally { setLogging(null); }
  }

  // One pass over `admins` grouped by medication id — this used to be `admins.filter(...)`
  // called per rendered medication row (dosesFor(m.id) below), rescanning the whole
  // administration history (every dose, every child, every day it's ever been given) once
  // per medication on every render.
  const dosesByMed = useMemo(() => {
    const m = new Map<string, AdminEvent[]>();
    for (const a of admins) (m.get(a.medicationId) ?? m.set(a.medicationId, []).get(a.medicationId)!).push(a);
    return m;
  }, [admins]);
  const dosesFor = (id: string) => dosesByMed.get(id) ?? [];
  const active = (meds ?? []).filter((m) => !m.archived);
  const archivedMeds = (meds ?? []).filter((m) => m.archived);
  const consented = active.filter((m) => m.consentGranted).length;
  const needsConsent = active.filter((m) => !m.consentGranted).length;
  const dosesToday = admins.filter((a) => a.date === todayIso()).length;
  const tiles: [string, string | number][] = [[t("p7med.tileOnFile"), active.length], [t("p7med.tileWithConsent"), consented], [t("p7med.tileNeedsConsent"), needsConsent], [t("p7med.tileDosesToday"), dosesToday]];
  const ql = q.trim().toLowerCase();
  const listingsFor = (name: string) => (bkgsByChild.get((name ?? "").trim().toLowerCase()) ?? []).map((b) => b.listing).filter(Boolean) as string[];
  const allListings = [...new Set(bkgs.map((b) => b.listing).filter(Boolean) as string[])].sort();
  const shown = (showArchived ? archivedMeds : active)
    .filter((m) => !ql || m.childName.toLowerCase().includes(ql) || m.name.toLowerCase().includes(ql))
    .filter((m) => !listingFilter || listingsFor(m.childName).includes(listingFilter));

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-3 sm:-m-5 sm:p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* Hero — matches the other portal pages (blue → white). */}
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">💊</span>
              {t("p7nav.medication")}
            </div>
            <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">{t("p7med.subtitle")}</p>
          </div>
          <div className="flex flex-none flex-wrap items-center gap-2">
            <TourLauncher view="medication" compact />
            <SettingsLink />
            {!adding && (
              <button type="button" onClick={() => setAdding(true)} className="rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-[#1d3a8f] shadow-md transition-transform hover:-translate-y-px">
                {t("p7med.adminBtn")}
              </button>
            )}
          </div>
        </div>
        {meds && (
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

      {notice && <div className="mb-3 rounded-lg border border-[#bfe6cf] bg-[#e7f6ee] px-3 py-2 text-[12.5px] font-bold text-[#0f7a43]">{notice}</div>}
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {adding && <MedForm initialChild={presetChild} onSaved={() => { setAdding(false); refresh(); }} onCancel={() => setAdding(false)} />}

      {meds && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {([[false, t("p7med.tabActive"), active.length], [true, t("p7med.tabArchived"), archivedMeds.length]] as [boolean, string, number][]).map(([arch, label, n]) => (
            <button key={label} type="button" onClick={() => setShowArchived(arch)}
              className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
              style={showArchived === arch ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
              {label} <span className={showArchived === arch ? "text-white/70" : "text-[var(--ink-3)]"}>{n}</span>
            </button>
          ))}
          {allListings.length > 0 && (
            <select value={listingFilter} onChange={(e) => setListingFilter(e.target.value)}
              className="ms-auto rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] font-bold outline-none focus:border-[#1d3a8f]">
              <option value="">{t("p7bkl.allListings")}</option>
              {allListings.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("p7med.searchPh")}
            className={`${allListings.length > 0 ? "" : "ms-auto "}w-56 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] outline-none focus:border-[#1d3a8f]`} />
        </div>
      )}

      {!meds ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{t("p7med.loadingWord")}</div>
      ) : shown.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{showArchived ? t("p7med.noArchived") : t("p7med.noMeds")}</Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((m) => {
            const doses = dosesFor(m.id);
            const givenToday = doses.filter((a) => a.date === todayIso() && a.given !== false && a.doseGiven !== "Not given");
            return (
              <Card key={m.id} className="p-4">
                {/* Header — identity on the left, status on the right */}
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-[16px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{m.childName}</span>
                      <span className="text-[13.5px] text-[var(--ink-2)]">{m.name} <span className="text-[var(--ink-3)]">· {m.dose}</span></span>
                    </div>
                    {m.condition && <div className="mt-1"><Badge tone={{ bg: "var(--panel)", fg: "var(--ink-2)" }}>{m.condition}</Badge></div>}
                  </div>
                  <div className="flex flex-col items-start gap-1.5 sm:items-end">
                    {m.consentGranted ? (
                      <Badge tone={{ bg: "#eaf0fc", fg: "#1d3a8f" }}>{t("p7med.consentOnFile")}</Badge>
                    ) : m.consentWithdrawnAt ? (
                      <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" }}>{t("p7med.consentRemoved")}</Badge>
                    ) : (
                      <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" }}>{t("p7med.noConsentBadge")}</Badge>
                    )}
                    {m.expiryDate && m.expiryDate < todayIso() && <Badge tone={{ bg: "#fdebec", fg: "#c02636" }}>{t("p7med.expiredBadge")}</Badge>}
                    {givenToday.length > 0 && (() => { const tms = givenToday.map((a) => a.time).filter(Boolean).sort().join(", "); return <Badge tone={{ bg: "#0f7a43", fg: "#ffffff" }}>{t("p7med.givenToday")}{tms ? ` · ${tms}` : ` · ${givenToday.length}×`}</Badge>; })()}
                    {doses.length > 0
                      ? <span className="text-[11.5px] font-bold text-[#0f7a43]">{pickPlural(t, locale, "p7med.dosesRec", doses.length)}</span>
                      : <span className="text-[11.5px] text-[var(--ink-3)]">{t("p7med.noDosesYet")}</span>}
                  </div>
                </div>

                {/* When */}
                <div className="mt-3">
                  {m.asNeeded ? <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>{t("p7med.asNeededBadge")}</Badge> : m.schedule && <Badge tone={{ bg: "#e7f6ee", fg: "#0f7a43" }}>🔁 {scheduleLabel(t, m.schedule)}</Badge>}
                </div>

                {/* Details */}
                {(m.instructions || m.parentNote) && (
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    {m.instructions && <div className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] leading-snug text-[var(--ink-2)]">📋 <b>{t("p7med.howToGive")}</b> {m.instructions}</div>}
                    {m.parentNote && <div className="rounded-lg bg-[#f4f8ff] px-3 py-2 text-[12px] leading-snug text-[var(--ink-2)]">📝 <b>{t("p7med.parentNoteLbl")}</b> {m.parentNote}</div>}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
                  {m.archived ? (
                    <span className="text-[11.5px] font-bold text-[var(--ink-3)]">{t("p7med.archivedNoNew")}</span>
                  ) : m.consentGranted ? (
                    !canRecord ? (
                      <span className="text-[11.5px] font-bold text-[var(--ink-3)]">{t("p7med.onlyLeads")}</span>
                    ) : med.requireWitness ? (
                      <>
                        <Button sm variant="solid" onClick={() => setAdministering(administering === m.id ? null : m.id)}>{administering === m.id ? t("p7med.closeWord") : t("p7med.recordDoseBtn")}</Button>
                        <span className="text-[11px] text-[var(--ink-3)]">{t("p7med.witnessRequired")}</span>
                      </>
                    ) : confirm?.id === m.id ? (
                      <>
                        <span className="text-[11.5px] font-bold text-[var(--ink)]">{t("p7med.confirmLine", { med: m.name, child: m.childName, state: "\u0001" }).split("\u0001")[0]}<span style={{ color: confirm.given ? "#0f7a43" : "#c02636" }}>{confirm.given ? t("p7med.stateGiven") : t("p7med.stateNotGiven")}</span>{t("p7med.confirmLine", { med: m.name, child: m.childName, state: "\u0001" }).split("\u0001")[1]}</span>
                        {!approvedForDay(m, todayIso(), bookedDaysFor(m.childName)) && <span className="rounded-full bg-[#fbeede] px-2 py-0.5 text-[10.5px] font-bold text-[#a9660a]">⚠️ {m.schedule === BOOKED_SCHEDULE ? t("p7med.notBookedToday") : t("p7med.notParentDays")}</span>}
                        <Button sm variant={confirm.given ? "solid" : "danger"} disabled={logging === m.id} onClick={() => { const g = confirm.given; setConfirm(null); quickLog(m, g); }}>{logging === m.id ? t("p7med.btnRecording") : t("p7med.confirmBtn")}</Button>
                        <Button sm onClick={() => setConfirm(null)}>{t("common.cancel")}</Button>
                      </>
                    ) : (
                      <>
                        <span className="text-[11.5px] font-bold text-[var(--ink-3)]">{t("p7med.givenQ")}</span>
                        <Button sm variant="solid" onClick={() => setConfirm({ id: m.id, given: true })}>{t("p7med.yesBtn")}</Button>
                        <Button sm variant="danger" onClick={() => setConfirm({ id: m.id, given: false })}>{t("p7med.noBtn")}</Button>
                        <button type="button" onClick={() => setAdministering(administering === m.id ? null : m.id)} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">{administering === m.id ? t("p7med.closeWord") : t("p7med.withTimeNotes")}</button>
                      </>
                    )
                  ) : (
                    <span className="text-[11.5px] font-bold text-[#c02636]">{t("p7med.consentNeeded")}</span>
                  )}
                  <Button sm onClick={() => setOpenId(openId === m.id ? null : m.id)}>{openId === m.id ? t("p7med.hideWord") : t("p7med.historyN", { n: doses.length })}</Button>
                  {canManage && (m.archived
                    ? m.consentWithdrawnAt
                      ? <span className="text-[11px] text-[var(--ink-3)]">{t("p7med.withdrewConsent")}</span>
                      : <>
                          <Button sm variant="solid" onClick={() => setArchived(m, false)}>{t("p7med.restoreBtn")}</Button>
                          {doses.length === 0 && <Button sm variant="danger" onClick={() => removeMed(m)}>{t("p7med.deleteBtn")}</Button>}
                        </>
                    : <Button sm variant="danger" onClick={() => setArchived(m, true)}>{t("p7med.archiveBtn")}</Button>)}
                </div>
                {administering === m.id && <AdministerForm med={m} requireWitness={!!med.requireWitness} booked={bookedDaysFor(m.childName)} onDone={(recorded, g) => { setAdministering(null); if (recorded) flash(parentMsg(g ?? true)); refresh(); }} />}
                {openId === m.id && (
                  <div className="mt-2 border-t border-[var(--line)] pt-2">
                    {doses.length === 0 ? (
                      <div className="text-[12px] text-[var(--ink-3)]">{t("p7med.noDosesRecorded")}</div>
                    ) : (
                      doses.map((a) => (
                        <div key={a.id} className="flex flex-wrap items-center gap-x-1.5 border-b border-dashed border-[var(--line)] py-1 text-[12px] last:border-b-0">
                          {(() => { const notGiven = a.given === false || a.doseGiven === "Not given"; return <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={notGiven ? { background: "#fdebec", color: "#c02636" } : { background: "#e7f6ee", color: "#0f7a43" }}>{notGiven ? t("p7med.notGivenBadge") : t("p7med.givenBadge")}</span>; })()}
                          <b>{fmt(a.date)}{a.time ? ` · ${a.time}` : ""}</b> — {a.doseGiven === "Not given" ? t("p7med.notGivenWord") : a.doseGiven}
                          <span className="text-[var(--ink-3)]">· {t("p7med.byWho", { name: a.administeredByName ?? "" })}{a.witnessedBy ? `, ${t("p7med.witnessedWho", { name: a.witnessedBy })}` : ""}{a.notes ? ` · ${a.notes}` : ""}</span>
                        </div>
                      ))
                    )}
                    {(m.consentBy || m.expiryDate || m.storage) && (
                      <div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">
                        {m.consentBy && `${m.consentDate ? t("p7med.consentOnDate", { name: m.consentBy, date: fmt(m.consentDate.slice(0, 10)) }) : t("p7med.consentByLine", { name: m.consentBy })}. `}
                        {m.storage && `${t("p7med.storedLine", { s: m.storage })} `}
                        {m.expiryDate && t("p7med.expiresLine", { date: fmt(m.expiryDate) })}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
