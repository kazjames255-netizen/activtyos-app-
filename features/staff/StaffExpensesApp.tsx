"use client";

// Staff-facing "My expenses" — submit a claim, attach a receipt, and track what's
// been approved and reimbursed. Claims live on the server (/api/expense-claims),
// scoped to the signed-in person; a manager approves them into Money out. They
// used to stay on this phone only and never reach a manager (acceptance d24s8).
import { useEffect, useMemo, useState } from "react";
import { get as apiGet, post as apiPost, api } from "@/lib/api";
import { Button, Card, Input, Select } from "@/components/ui";
import { CollapsibleStats, LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { useI18n } from "@/lib/i18n/provider";

const CATS = ["Travel & mileage", "Equipment", "Activity materials", "Food & catering", "Training", "Other"];
type Status = "submitted" | "approved" | "paid" | "declined";
interface Claim { id: string; staffName?: string; date: string; category: string; amount: number; note: string; receiptUrl?: string; receiptName?: string; status: Status; submittedAt: string }

const gbp = (n: number) => "£" + (n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// label = catalogue key (translated at render)
const STATUS: Record<Status, { label: string; bg: string; ink: string }> = {
  submitted: { label: "staffp.expStatusSubmitted", bg: "#fff7e6", ink: "#b45309" },
  approved: { label: "staffp.expStatusApproved", bg: "#eaf4ff", ink: "#1d6fb8" },
  paid: { label: "staffp.expStatusPaid", bg: "#eafaf0", ink: "#0f7a43" },
  declined: { label: "staffp.expStatusDeclined", bg: "#fdecec", ink: "#c0392b" },
};
// Display labels for the stored categories (the stored value stays English).
const CAT_KEY: Record<string, string> = { "Travel & mileage": "staffp.expCatTravel", Equipment: "staffp.expCatEquipment", "Activity materials": "staffp.expCatMaterials", "Food & catering": "staffp.expCatFood", Training: "staffp.expCatTraining", Other: "staffp.expCatOther" };
const rich = (s: string) => s.split("**").map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p));
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
// Light fill + crisp inset outline so inputs clearly read as "type here" against
// white surfaces (the default --line border nearly vanishes). Focus still shows on top.
const FIELD_STYLE = { backgroundColor: "#f5f3fb", boxShadow: "inset 0 0 0 1.5px #c5bfd6" } as const;

export function StaffExpensesApp() {
  const { t, locale: appLocale } = useI18n();
  const locale = appLocale === "en" ? "en-GB" : appLocale; // for dates — plain "en" formats US-style
  const catLabel = (c: string) => (CAT_KEY[c] ? t(CAT_KEY[c]) : c);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ date: todayISO(), category: CATS[0], amount: "", note: "", receipt: "", receiptName: "" });
  const reload = () => apiGet<Claim[]>("/api/expense-claims").then((c) => setClaims(Array.isArray(c) ? c : [])).catch(() => setErr("Couldn't load your claims"));
  useEffect(() => { void reload(); }, []);

  // The server returns only this person's claims.
  const mine = useMemo(() => [...claims].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)), [claims]);
  const sum = (f: (c: Claim) => boolean) => mine.filter(f).reduce((a, c) => a + c.amount, 0);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => setForm((s) => ({ ...s, receipt: String(r.result), receiptName: f.name })); r.readAsDataURL(f);
  };
  const submit = async () => {
    const amount = parseFloat(form.amount); if (!amount || amount <= 0) return;
    setBusy(true); setErr(null);
    try {
      // Receipt photo or PDF → a private file (only the business sees it).
      let receiptUrl: string | undefined;
      if (form.receipt.startsWith("data:image/") || form.receipt.startsWith("data:application/pdf;")) receiptUrl = (await apiPost<{ url: string }>("/api/uploads", { dataUrl: form.receipt, purpose: "private" })).url;
      await apiPost("/api/expense-claims", { date: form.date, category: form.category, amount, note: form.note.trim(), ...(receiptUrl ? { receiptUrl, receiptName: form.receiptName } : {}) });
      setOpen(false); setForm({ date: todayISO(), category: CATS[0], amount: "", note: "", receipt: "", receiptName: "" });
      await reload();
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't send your claim"); }
    setBusy(false);
  };
  const remove = async (id: string) => { try { await api(`/api/expense-claims/${id}`, { method: "DELETE" }); await reload(); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't withdraw it"); } };

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title={t("staffp.expTitle")} icon="💷" lede={t("staffp.expLede")} actions={<Button variant="primary" onClick={() => setOpen(true)}>{t("staffp.expNewBtn")}</Button>} />

      <CollapsibleStats id="staff-expenses">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t("staffp.expStatClaims"), String(mine.length), t("staffp.expAllTime")],
          [t("staffp.expStatAwaiting"), gbp(sum((c) => c.status === "submitted")), t("staffp.expNotYet")],
          [t("staffp.expStatusApproved"), gbp(sum((c) => c.status === "approved")), t("staffp.expAwaitingPay")],
          [t("staffp.expStatusPaid"), gbp(sum((c) => c.status === "paid")), t("staffp.expPaidBack")],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</div>
            <div className="mt-1 text-[22px] font-extrabold tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{value}</div>
            <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">{sub}</div>
          </div>
        ))}
      </div>
      </CollapsibleStats>

      <Card className="mt-4 p-0">
        {mine.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-[var(--ink-3)]">{rich(t("staffp.expNone"))}</div>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {mine.map((c) => { const st = STATUS[c.status]; return (
              <li key={c.id} className="flex items-center gap-3 p-3.5">
                <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[var(--panel)] text-[16px]">🧾</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate text-[14px] font-extrabold text-[var(--ink)]">{catLabel(c.category)}</span>
                    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: st.bg, color: st.ink }}>{t(st.label)}</span></div>
                  <div className="text-[12px] text-[var(--ink-3)]">{new Date(c.date + "T00:00:00").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}{c.note ? ` · ${c.note}` : ""}{c.receiptUrl ? <> · <a href={c.receiptUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-[#1d3a8f] hover:underline">📎 {c.receiptName || "receipt"}</a></> : ""}</div>
                </div>
                <div className="text-right"><div className="text-[15px] font-extrabold tabular-nums text-[var(--ink)]">{gbp(c.amount)}</div>
                  {c.status === "submitted" && <button type="button" onClick={() => remove(c.id)} className="text-[11px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">{t("staffp.expWithdraw")}</button>}</div>
              </li>
            ); })}
          </ul>
        )}
      </Card>
      {err && !open && <p className="mt-3 text-[12px] font-bold text-[#c0392b]">{err}</p>}
      <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">{t("staffp.expFooter")}</p>

      {open && (
        <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh]" onClick={() => setOpen(false)} style={LIGHT_PALETTE}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 text-[16px] font-extrabold text-[var(--ink)]">{t("staffp.expModalTitle")}</div>
            <div className="grid gap-3">
              <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-[var(--ink-3)]">{t("staffp.expDate")}</span><Input type="date" value={form.date} onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))} className="w-full" style={FIELD_STYLE} /></label>
              <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-[var(--ink-3)]">{t("staffp.expCategory")}</span><Select value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} className="w-full" style={FIELD_STYLE}>{CATS.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}</Select></label>
              <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-[var(--ink-3)]">{t("staffp.expAmount")}</span><Input type="number" inputMode="decimal" step="0.01" min="0" value={form.amount} onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))} placeholder="0.00" className="w-full" style={FIELD_STYLE} /></label>
              <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-[var(--ink-3)]">{t("staffp.expFor")}</span><Input value={form.note} onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))} placeholder={t("staffp.expForPh")} className="w-full" style={FIELD_STYLE} /></label>
              <label className="cursor-pointer rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)] p-3 text-center text-[12.5px] font-bold text-[#1d3a8f]">
                {form.receiptName ? `📎 ${form.receiptName}` : t("staffp.expAttach")}
                <input type="file" accept="image/*,application/pdf,.pdf" className="hidden" onChange={onFile} />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2"><Button onClick={() => setOpen(false)}>{t("staffp.expCancel")}</Button><Button variant="primary" onClick={() => void submit()} disabled={busy || !(parseFloat(form.amount) > 0)}>{busy ? "…" : t("staffp.expSubmit")}</Button></div>
            {err && <p className="mt-2 text-[12px] font-bold text-[#c0392b]">{err}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
