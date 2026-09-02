"use client";

import { useMemo, useState } from "react";
import { post as apiPost } from "@/lib/api";
import { Button, Card } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";

// Bulk-add families from a spreadsheet: paste rows (straight from Excel / Google
// Sheets) or upload a CSV/TSV file, we detect the columns, create each family
// (POST /api/customers) and — if asked — email each a sign-up invite
// (POST /api/customers/:id/invite). Both endpoints already exist; this is the
// front end over them.

type Row = { firstName: string; lastName: string; email: string; phone: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Split delimited text into a grid. Picks the delimiter (tab / comma /
 *  semicolon) that appears most on the first line, and understands quoted
 *  fields that contain the delimiter. */
function parseGrid(text: string): string[][] {
  const t = text.replace(/\r\n?/g, "\n").trim();
  if (!t) return [];
  const first = t.split("\n")[0];
  const delim = ([["\t", first.split("\t").length], [",", first.split(",").length], [";", first.split(";").length]] as [string, number][])
    .sort((a, b) => b[1] - a[1])[0][0];
  const out: string[][] = [];
  for (const line of t.split("\n")) {
    if (!line.trim()) continue;
    const cells: string[] = []; let cur = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim) { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    out.push(cells.map((c) => c.trim()));
  }
  return out;
}

/** Turn the grid into {firstName,lastName,email,phone} rows — using a header
 *  row when there is one, otherwise guessing columns from content. */
function toRows(grid: string[][]): Row[] {
  if (!grid.length) return [];
  const head = grid[0].map((h) => h.toLowerCase());
  const headerRow = head.some((h) => /e-?mail|name|phone|mobile|first|last|surname/.test(h)) && !grid[0].some((c) => EMAIL_RE.test(c));
  const at = (re: RegExp) => head.findIndex((h) => re.test(h));
  const body = headerRow ? grid.slice(1) : grid;
  let cFirst = -1, cLast = -1, cName = -1, cEmail = -1, cPhone = -1;
  if (headerRow) {
    cFirst = at(/first|forename|given/); cLast = at(/last|surname|family/);
    cName = at(/^name$|full ?name|contact name/); cEmail = at(/e-?mail/); cPhone = at(/phone|mobile|tel|number/);
  } else {
    const cols = Math.max(...grid.map((r) => r.length));
    for (let c = 0; c < cols; c++) if (body.some((r) => EMAIL_RE.test(r[c] || ""))) { cEmail = c; break; }
    for (let c = 0; c < cols; c++) if (c !== cEmail && body.some((r) => /\d{5,}/.test((r[c] || "").replace(/\D/g, "")))) { cPhone = c; break; }
    cFirst = [0, 1, 2].find((c) => c !== cEmail && c !== cPhone) ?? 0;
    cLast = [1, 2, 3].find((c) => c !== cEmail && c !== cPhone && c !== cFirst) ?? -1;
  }
  const rows: Row[] = [];
  for (const r of body) {
    const email = ((cEmail >= 0 ? r[cEmail] : "") || r.find((c) => EMAIL_RE.test(c)) || "").trim().toLowerCase();
    let firstName = cFirst >= 0 ? (r[cFirst] || "").trim() : "";
    let lastName = cLast >= 0 ? (r[cLast] || "").trim() : "";
    if (cName >= 0 && !firstName) { const p = (r[cName] || "").trim().split(/\s+/); firstName = p[0] || ""; lastName = p.slice(1).join(" "); }
    if (!firstName && email) firstName = email.split("@")[0];
    if (!firstName && !email) continue;
    const phone = (cPhone >= 0 ? r[cPhone] : (r.find((c) => /\d{5,}/.test(c.replace(/\D/g, "")) && !EMAIL_RE.test(c)) || "")).trim();
    rows.push({ firstName: firstName || "Family", lastName, email, phone });
  }
  return rows;
}

type Result = { created: number; invited: number; noEmail: number; failed: number };

export function FamilyImport({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [text, setText] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  const rows = useMemo(() => toRows(parseGrid(text)), [text]);
  const withEmail = rows.filter((r) => EMAIL_RE.test(r.email)).length;

  async function readFile(f: File) {
    try { setText(await f.text()); } catch { /* ignore unreadable file */ }
  }

  function downloadTemplate() {
    const csv = "First name,Surname,Email,Phone (optional)\nSarah,Doyle,sarah@example.com,07700 900123\nTom,Ives,tom@example.com,\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "activityos-families-template.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function run() {
    if (!rows.length) return;
    setRunning(true); setProgress(0); setResult(null);
    let created = 0, invited = 0, noEmail = 0, failed = 0;
    for (const row of rows) {
      try {
        const body = { name: [row.firstName, row.lastName].filter(Boolean).join(" "), firstName: row.firstName, lastName: row.lastName, email: row.email, phone: row.phone, children: [] };
        const saved = await apiPost<{ id: string }>("/api/customers", body);
        created++;
        if (sendInvite) {
          if (EMAIL_RE.test(row.email)) { try { await apiPost(`/api/customers/${encodeURIComponent(saved.id)}/invite`, {}); invited++; } catch { /* invite can be re-sent from the row */ } }
          else noEmail++;
        }
      } catch { failed++; }
      setProgress(created + failed);
    }
    setResult({ created, invited, noEmail, failed });
    setRunning(false);
    onDone();
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && !running && onClose()} className="fixed inset-0 z-[9999] flex items-start justify-center overflow-auto bg-black/55 px-3.5 py-8">
      <Card className="w-full max-w-[620px] px-5 py-[18px]">
        <h3 className="m-0 font-[var(--ff-display)] text-[19px] leading-tight text-[var(--ink)]">{t("customers.importFamiliesTitle")}</h3>
        <p className="mt-1 mb-2 text-[12.5px] leading-[1.5] text-[var(--ink-3)]">
          Paste rows straight from <b>Excel or Google Sheets</b>, or upload a <b>CSV / TSV</b> file. We detect the columns
          (first name, surname, email, phone) — a header row helps but isn’t needed. Each becomes a family, and you can email
          them all a sign-up invite in one go.
        </p>
        <p className="mb-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 text-[11.5px] leading-[1.5] text-[var(--ink-2)]">
          📞 <b>Phone is optional.</b> Add it and it’s saved on the family’s record; leave it blank and you (or the family) can
          add it any time.
        </p>

        {result ? (
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[13px]">
            <div className="font-extrabold text-[#0f7a43]">{t("customers.doneCheck")}</div>
            <div className="mt-1 text-[var(--ink-2)]">
              {result.created} famil{result.created === 1 ? "y" : "ies"} added{result.invited ? ` · ${result.invited} sign-up invite${result.invited === 1 ? "" : "s"} sent` : ""}
              {result.noEmail ? ` · ${result.noEmail} had no email (added, not invited)` : ""}
              {result.failed ? ` · ${result.failed} failed` : ""}.
            </div>
            <div className="mt-3 text-right"><Button variant="primary" onClick={onClose}>{t("customers.close")}</Button></div>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2">
              <label className="cursor-pointer rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f]">
                {t("customers.chooseFile")}<input type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ""; }} />
              </label>
              <button type="button" onClick={downloadTemplate} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">{t("customers.downloadCsvTemplate")}</button>
              <span className="text-[11.5px] text-[var(--ink-3)]">{t("customers.orPasteBelow")}</span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              disabled={running}
              placeholder={"First name, Surname, Email, Phone\nSarah, Doyle, sarah@example.com, 07700 900123\nTom, Ives, tom@example.com, 07700 900456"}
              className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--brand)]"
            />

            {rows.length > 0 && (
              <div className="mt-3 rounded-lg border border-[var(--line)] overflow-hidden">
                <div className="bg-[var(--panel)] px-3 py-1.5 text-[11.5px] font-bold text-[var(--ink-2)]">
                  {rows.length} famil{rows.length === 1 ? "y" : "ies"} found · {withEmail} with an email
                </div>
                <div className="max-h-[180px] overflow-auto">
                  <table className="w-full text-[12px]">
                    <tbody>
                      {rows.slice(0, 8).map((r, i) => (
                        <tr key={i} className="border-t border-[var(--line)]">
                          <td className="px-3 py-1.5 font-semibold text-[var(--ink)]">{[r.firstName, r.lastName].filter(Boolean).join(" ")}</td>
                          <td className="px-3 py-1.5 text-[var(--ink-2)]">{EMAIL_RE.test(r.email) ? r.email : <span className="text-[var(--ink-3)]">{t("customers.noEmailShort")}</span>}</td>
                          <td className="px-3 py-1.5 text-[var(--ink-3)]">{r.phone}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > 8 && <div className="px-3 py-1.5 text-[11px] text-[var(--ink-3)]">{t("customers.andNMore", { n: rows.length - 8 })}</div>}
                </div>
              </div>
            )}

            <label className="mt-3 flex items-center gap-2 text-[12.5px] text-[var(--ink-2)]">
              <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} disabled={running} />
              {t("customers.emailInviteLabel")}
            </label>

            {running && (
              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
                  <div className="h-full bg-[var(--brand,#1d3a8f)] transition-all" style={{ width: `${rows.length ? Math.round((progress / rows.length) * 100) : 0}%` }} />
                </div>
                <div className="mt-1 text-[11.5px] text-[var(--ink-3)]">{t("customers.importingProgress", { done: progress, total: rows.length })}</div>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={onClose} disabled={running}>{t("customers.cancel")}</Button>
              <Button variant="primary" onClick={run} disabled={running || rows.length === 0}>
                {running ? t("customers.importingEllipsis") : sendInvite ? t("customers.importAndInvite", { n: rows.length || "" }) : t("customers.importN", { n: rows.length || "" })}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
