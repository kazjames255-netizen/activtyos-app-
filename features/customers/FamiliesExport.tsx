"use client";

import { useMemo, useState } from "react";
import { csvFilename, toCsv, type Col } from "@/features/bookings/helpers";
import { downloadCsv, printRows } from "@/features/bookings/exportFile";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";

// ─────────────────────────────────────────────────────────────────────────
// Export the families list — the same shape as the bookings wizard, and the
// same CSV and print machinery underneath, so escaping and Excel's quirks are
// solved once rather than twice.
//
// The filter that matters here is consent: an export of a marketing list must
// be able to say "only the people who agreed", and must say so on the file.
// ─────────────────────────────────────────────────────────────────────────

export type FamilyRow = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  locationId?: string;
  locationName?: string;
  marketingOptIn?: boolean;
  marketingOptInAt?: string;
  invitedAt?: string;
  children?: { name: string; age?: number; dob?: string }[];
  stage: string;
  bookings: number;
};

const COLUMNS: Col<FamilyRow>[] = [
  { key: "firstName", label: "First name", group: "Family", get: (r) => r.firstName ?? r.name.split(" ")[0] },
  { key: "lastName", label: "Surname", group: "Family", get: (r) => r.lastName ?? r.name.split(" ").slice(1).join(" ") },
  { key: "name", label: "Full name", group: "Family", get: (r) => r.name },
  { key: "email", label: "Email", group: "Family", get: (r) => r.email ?? "" },
  { key: "phone", label: "Phone", group: "Family", get: (r) => r.phone ?? "" },
  { key: "location", label: "Location", group: "Family", get: (r) => r.locationName ?? "" },
  { key: "stage", label: "Stage", group: "Pipeline", get: (r) => r.stage },
  { key: "bookings", label: "Bookings", group: "Pipeline", numeric: true, get: (r) => r.bookings },
  { key: "invitedAt", label: "Invited on", group: "Pipeline", get: (r) => (r.invitedAt ?? "").slice(0, 10) },
  { key: "marketing", label: "Marketing consent", group: "Marketing", get: (r) => (r.marketingOptIn ? "Yes" : "No") },
  { key: "marketingAt", label: "Consent given", group: "Marketing", get: (r) => (r.marketingOptInAt ?? "").slice(0, 10) },
  { key: "children", label: "Children", group: "Children", get: (r) => (r.children ?? []).map((k) => k.name).join("; ") },
  { key: "ages", label: "Ages", group: "Children", get: (r) => (r.children ?? []).map((k) => k.age ?? "").join("; ") },
  { key: "childCount", label: "Number of children", group: "Children", numeric: true, get: (r) => (r.children ?? []).length },
];

const PRESETS: { name: string; hint: string; keys: string[] }[] = [
  { name: "Everything", hint: "Every field", keys: COLUMNS.map((c) => c.key) },
  { name: "Mailing list", hint: "For a campaign — consent included", keys: ["firstName", "lastName", "email", "location", "marketing", "marketingAt"] },
  { name: "Phone list", hint: "Names and numbers", keys: ["name", "phone", "location", "stage"] },
  { name: "Pipeline", hint: "Where everyone has got to", keys: ["name", "email", "stage", "bookings", "invitedAt", "location"] },
];

export function FamiliesExport({
  rows,
  stages,
  locations,
  onClose,
}: {
  rows: FamilyRow[];
  stages: { key: string; label: string }[];
  locations: { id: string; name: string }[];
  onClose: () => void;
}) {
  const t = useT();
  const [text, setText] = useState("");
  const [stage, setStage] = useState<string[]>([]);
  const [locs, setLocs] = useState<string[]>([]);
  const [consent, setConsent] = useState<"" | "yes" | "no">("");
  const [invited, setInvited] = useState<"" | "yes" | "no">("");
  const [contact, setContact] = useState<"" | "email" | "phone">("");
  const [keys, setKeys] = useState<string[]>(PRESETS[1].keys);
  const [format, setFormat] = useState<"csv" | "pdf">("csv");

  const shown = useMemo(() => {
    const q = text.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && ![r.name, r.email ?? "", r.phone ?? "", ...(r.children ?? []).map((k) => k.name)].join(" ").toLowerCase().includes(q))
        return false;
      if (stage.length && !stage.includes(r.stage)) return false;
      if (locs.length && !locs.includes(r.locationId ?? "")) return false;
      if (consent === "yes" && !r.marketingOptIn) return false;
      if (consent === "no" && r.marketingOptIn) return false;
      if (invited === "yes" && !r.invitedAt) return false;
      if (invited === "no" && r.invitedAt) return false;
      if (contact === "email" && !(r.email ?? "").includes("@")) return false;
      if (contact === "phone" && (r.phone ?? "").replace(/\D/g, "").length < 10) return false;
      return true;
    });
  }, [rows, text, stage, locs, consent, invited, contact]);

  const cols = COLUMNS.filter((c) => keys.includes(c.key));
  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const subtitle = [
    `${shown.length} famil${shown.length === 1 ? "y" : "ies"}`,
    consent === "yes" ? t("customers.consentedOnly") : null,
    stage.length ? stage.map((k) => stages.find((s) => s.key === k)?.label ?? k).join(", ") : null,
    locs.length ? locs.map((id) => locations.find((l) => l.id === id)?.name ?? id).join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const run = () => {
    if (!shown.length || !cols.length) return;
    if (format === "csv") downloadCsv(csvFilename("families"), toCsv(shown, cols));
    else printRows(shown, cols, t("customers.familiesTitle"), subtitle);
    onClose();
  };

  const chip = (on: boolean) =>
    "cursor-pointer rounded-full border px-2.5 py-[3px] text-[11.5px] font-semibold transition-colors " +
    (on
      ? "border-[var(--brand)] bg-[var(--brand)] text-white"
      : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--ink-3)]");
  const lab = "mb-1 block text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-[var(--ink-3)]";

  const tri = (
    label: string,
    value: string,
    set: (v: never) => void,
    opts: [string, string][],
  ) => (
    <div className="mb-3">
      <label className={lab}>{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {opts.map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => set((value === v ? "" : v) as never)}
            className={chip(value === v)}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-auto bg-black/55 px-3.5 py-8"
    >
      <div className="w-full max-w-[1000px] rounded-2xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] shadow-[0_24px_60px_rgba(0,0,0,.5)]">
        <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-5 py-3.5">
          <div>
            <h3 className="m-0 font-[var(--ff-display)] text-[17px] font-extrabold">{t("customers.exportFamiliesTitle")}</h3>
            <div className="text-[11.5px] text-[var(--ink-3)]">
              {t("customers.exportSubtitle")}
            </div>
          </div>
          <span onClick={onClose} className="ml-auto cursor-pointer text-[22px] text-[var(--ink-3)]">
            ×
          </span>
        </div>

        <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
          <div>
            <b className="mb-2 block text-[13px]">{t("customers.step1Which")}</b>

            <label className={lab}>{t("customers.nameEmailPhoneChild")}</label>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Doyle"
              className="mb-3 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] outline-none"
            />

            <label className={lab}>{t("customers.stageWord")} {stage.length ? `(${stage.length})` : t("customers.dashAll")}</label>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {stages.map((s) => (
                <button key={s.key} type="button" onClick={() => toggle(stage, s.key, setStage)} className={chip(stage.includes(s.key))}>
                  {s.label}
                </button>
              ))}
            </div>

            {locations.length > 0 && (
              <>
                <label className={lab}>{t("customers.locationWord")} {locs.length ? `(${locs.length})` : t("customers.dashAll")}</label>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {locations.map((l) => (
                    <button key={l.id} type="button" onClick={() => toggle(locs, l.id, setLocs)} className={chip(locs.includes(l.id))}>
                      {l.name}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* The one that stops an unlawful mailshot. */}
            {tri(t("customers.marketingConsent"), consent, setConsent as (v: never) => void, [
              ["yes", t("customers.agreedToHear")],
              ["no", t("customers.hasntAgreed")],
            ])}
            {tri(t("customers.signupLinkLabel"), invited, setInvited as (v: never) => void, [
              ["yes", t("customers.invited")],
              ["no", t("customers.notInvited")],
            ])}
            {tri(t("customers.hasA"), contact, setContact as (v: never) => void, [
              ["email", t("customers.emailAddress")],
              ["phone", t("customers.phoneNumber")],
            ])}
          </div>

          <div>
            <div className="mb-2 flex items-baseline gap-2">
              <b className="text-[13px]">{t("customers.step2What")}</b>
              <span className="text-[11px] text-[var(--ink-3)]">{t("customers.nColumns", { n: keys.length })}</span>
            </div>

            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => {
                const on = p.keys.length === keys.length && p.keys.every((k) => keys.includes(k));
                return (
                  <button key={p.name} type="button" title={p.hint} onClick={() => setKeys(p.keys)} className={chip(on)}>
                    {p.name}
                  </button>
                );
              })}
            </div>

            <div className="max-h-[300px] overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
              {["Family", "Pipeline", "Marketing", "Children"].map((g) => (
                <div key={g} className="mb-2 last:mb-0">
                  <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.07em] text-[var(--ink-3)]">{g}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {COLUMNS.filter((c) => c.group === g).map((c) => (
                      <button key={c.key} type="button" onClick={() => toggle(keys, c.key, setKeys)} className={chip(keys.includes(c.key))}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 pb-1">
          <div className="mb-1.5 flex items-baseline gap-2">
            <b className="text-[13px]">{t("customers.step3Check")}</b>
            <span className="text-[11px] text-[var(--ink-3)]">{t("customers.firstOf", { a: Math.min(3, shown.length), b: shown.length })}</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
            {shown.length === 0 || cols.length === 0 ? (
              <div className="p-4 text-center text-[12px] text-[var(--ink-3)]">
                {cols.length === 0 ? t("customers.chooseOneColumn") : t("customers.nobodyMatchesFilters")}
              </div>
            ) : (
              <table className="w-full border-collapse text-[11.5px]">
                <thead>
                  <tr>
                    {cols.map((c) => (
                      <th key={c.key} className="whitespace-nowrap border-b border-[var(--line)] px-2.5 py-1.5 text-left text-[9.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(0, 3).map((r) => (
                    <tr key={r.id}>
                      {cols.map((c) => (
                        <td key={c.key} className="max-w-[220px] truncate border-b border-[var(--line)] px-2.5 py-1.5 last:border-0">
                          {String(c.get(r) ?? "") || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 px-5 py-4">
          <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--surface)] p-0.5">
            {(
              [
                ["csv", t("customers.csvExcel")],
                ["pdf", t("customers.pdfPrint")],
              ] as ["csv" | "pdf", string][]
            ).map(([f, l]) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className="rounded-full px-3 py-1 text-[11.5px] font-bold transition-colors"
                style={format === f ? { background: "var(--brand)", color: "#fff" } : { color: "var(--ink-3)" }}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="text-[11.5px] text-[var(--ink-3)]">{subtitle}</div>

          <div className="ml-auto flex gap-2">
            <Button onClick={onClose}>{t("customers.cancel")}</Button>
            <Button variant="primary" disabled={!shown.length || !cols.length} onClick={run}>
              {format === "csv" ? t("customers.downloadCsvBtn") : t("customers.openPrintPdf")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
