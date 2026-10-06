"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Card } from "@/components/ui";
import { LEGAL_DOCS, TERMS_VERSION } from "@/lib/legal";

const display: CSSProperties = { fontFamily: "var(--ff-display)" };
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Reads the date printed on the live page: "Last updated: 5 September 2026" or "Version 2026-09-05". Returns ISO (yyyy-mm-dd) or null. */
function dateOf(html: string): { iso: string | null; text: string | null } {
  const text = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ").replace(/&middot;|&#183;/g, "·").replace(/\s+/g, " ");
  const v = /Version\s+(\d{4}-\d{2}-\d{2})/i.exec(text);
  if (v) return { iso: v[1], text: v[0] };
  const m = /Last updated:?\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i.exec(text);
  if (m) {
    const mi = MONTHS.indexOf(m[2].toLowerCase());
    if (mi >= 0) return { iso: `${m[3]}-${String(mi + 1).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`, text: m[0] };
  }
  return { iso: null, text: null };
}

export function ManualLegal() {
  const [live, setLive] = useState<Record<string, { iso: string | null; text: string | null; draft: boolean } | "error">>({});
  useEffect(() => {
    let dead = false;
    LEGAL_DOCS.forEach((d) => {
      fetch(d.href, { cache: "no-store" })
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
        .then((html) => { if (!dead) setLive((p) => ({ ...p, [d.id]: { ...dateOf(html), draft: /·\s*Draft/i.test(html.replace(/<[^>]+>/g, " ")) } })); })
        .catch(() => { if (!dead) setLive((p) => ({ ...p, [d.id]: "error" })); });
    });
    return () => { dead = true; };
  }, []);

  const signupDocs = ["terms", "dpa"] as const;
  return (
    <>
      <div className="mb-5 overflow-hidden rounded-2xl p-6 text-white" style={{ background: "linear-gradient(120deg, #1d3a8f, #6d3fd0)" }}>
        <div className="text-[12px] font-extrabold uppercase tracking-wider opacity-80">Page 2</div>
        <h1 className="m-0 mt-1 text-[28px] font-extrabold" style={display}>Legal documents</h1>
        <p className="m-0 mt-2 max-w-[62ch] text-[15px] leading-relaxed opacity-90">Each document exists in one place only: the website page. Sign-up and this page link to it and read its date live, so a change on the website shows here straight away. Nothing is copied.</p>
      </div>

      <div className="grid gap-3">
        {LEGAL_DOCS.map((d) => {
          const l = live[d.id];
          const ok = l && l !== "error";
          const inSyncApplies = signupDocs.includes(d.id as (typeof signupDocs)[number]);
          const synced = ok && l.iso ? l.iso === TERMS_VERSION : null;
          return (
            <Card key={d.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="m-0 text-[18px] font-extrabold text-[var(--ink)]" style={display}>{d.title}</h2>
                  <p className="m-0 mt-1 text-[14px] leading-relaxed text-[var(--ink-2)]">{d.covers}</p>
                  <dl className="m-0 mt-2 grid gap-1 text-[13px] text-[var(--ink-2)]">
                    <div><dt className="inline font-bold text-[var(--ink)]">Edit it here: </dt><dd className="m-0 inline"><code>{d.file}</code></dd></div>
                    <div><dt className="inline font-bold text-[var(--ink)]">Shown to people at: </dt><dd className="m-0 inline">{d.where}</dd></div>
                    <div>
                      <dt className="inline font-bold text-[var(--ink)]">Live right now: </dt>
                      <dd className="m-0 inline">
                        {!l ? "checking…" : l === "error" ? "could not load the page" : (l.text ?? "no date printed on the page") + (l.draft ? " (marked Draft)" : "")}
                      </dd>
                    </div>
                  </dl>
                  {inSyncApplies && ok && l.iso && (
                    <p className="m-0 mt-2 text-[13px] font-bold" style={{ color: synced ? "var(--green, #0f7a43)" : "#b91c1c" }}>
                      {synced ? `In sync: sign-up records version ${TERMS_VERSION}, the same as the page.` : `Out of sync: sign-up records version ${TERMS_VERSION} but the page says ${l.iso}. Update TERMS_VERSION in lib/legal.ts so new providers accept the current text.`}
                    </p>
                  )}
                </div>
                <a href={d.href} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center rounded-full px-5 text-[14px] font-bold text-white" style={{ background: "#1d3a8f" }}>Open the live page</a>
              </div>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-1 mt-8 text-[22px] font-extrabold text-[var(--ink)]" style={display}>How a change flows</h2>
      <ol className="m-0 grid gap-2 pl-5 text-[14px] leading-relaxed text-[var(--ink-2)]">
        <li>Edit the English wording in the website page (the path shown on each card above). English is the binding version.</li>
        <li>Update the translated copies in <code>public/v2/i18n</code> (the website checker, <code>node scripts/i18n-v2/check.mjs</code>, flags any language that is out of step).</li>
        <li>If the Terms or the DPA changed in substance, change the date on the page and <code>TERMS_VERSION</code> in <code>lib/legal.ts</code> to the same date. New providers then record the new version at sign-up, and this page turns green.</li>
        <li>Nothing else needs editing: the sign-up checkbox links to the live pages, and this manual reads them live.</li>
      </ol>

      <h2 className="mb-1 mt-8 text-[22px] font-extrabold text-[var(--ink)]" style={display}>Other places people see legal or data wording</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4"><h3 className="m-0 mb-1 text-[16px] font-extrabold text-[var(--ink)]" style={display}>Sign-up checkbox</h3><p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">Providers tick agreement to the Terms and DPA and confirm they have read the Privacy Policy. The version in <code>lib/legal.ts</code> is stored with the account.</p></Card>
        <Card className="p-4"><h3 className="m-0 mb-1 text-[16px] font-extrabold text-[var(--ink)]" style={display}>Parents&apos; privacy page in the app</h3><p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">This is not the policy text. It lets a person download their data or ask for it to be deleted. It reads from the server, not from these pages.</p></Card>
        <Card className="p-4"><h3 className="m-0 mb-1 text-[16px] font-extrabold text-[var(--ink)]" style={display}>Old links</h3><p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">Old addresses such as <code>/terms.html</code> and <code>/privacy.html</code> redirect to the pages above, so there is no second copy that can drift.</p></Card>
        <Card className="p-4"><h3 className="m-0 mb-1 text-[16px] font-extrabold text-[var(--ink)]" style={display}>Still to do</h3><p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">All three documents are marked Draft. Have them reviewed by a solicitor, and register with the ICO, before outside providers use the platform.</p></Card>
      </div>
    </>
  );
}
