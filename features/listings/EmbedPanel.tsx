"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";

// "Add booking to your website": the embed codes for the provider's own site. One code for the WHOLE storefront (it reads the live
// listings every time it loads, so a listing appears when it goes live and disappears when it ends) and one code per LIVE listing.
// Replaces two native alert() boxes that cut the code off and could not be scrolled or copied from.

export interface EmbedListingRow { id: string; title: string; dates: string; linkOnly: boolean }

const DEFAULT_COLOUR = "#15b364";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
  return Promise.resolve(fallbackCopy(text));
}
function fallbackCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch { return false; }
}

export function EmbedPanel({ tenantId, rows, focusId, onClose }: { tenantId: string | null; rows: EmbedListingRow[]; focusId?: string | null; onClose: () => void }) {
  const t = useT();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [mode, setMode] = useState<"button" | "inline">("button");
  const [label, setLabel] = useState("");
  const [colour, setColour] = useState(DEFAULT_COLOUR);
  const [copied, setCopied] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const focusRow = useRef<HTMLDivElement>(null);
  const storeLabel = t("p9em.defaultStoreLabel");
  const listingLabel = t("p9em.defaultListingLabel");

  const snippet = (kind: "store" | "listing", id: string) => {
    const attrs: string[] = [`src="${origin}/embed.js"`, `data-${kind}="${esc(id)}"`];
    if (mode === "inline") attrs.push('data-mode="inline"');
    else if (label.trim()) attrs.push(`data-label="${esc(label.trim())}"`);
    if (mode === "button" && colour.toLowerCase() !== DEFAULT_COLOUR) attrs.push(`data-color="${esc(colour)}"`);
    return `<script ${attrs.join(" ")} async></script>`;
  };
  // Opens a sample page that loads the real embed.js with these options, in a new tab.
  const testUrl = (kind: "store" | "listing", id: string) => {
    const q = new URLSearchParams({ kind, id, mode, ...(label.trim() ? { label: label.trim() } : {}), color: colour });
    return `/embed-preview.html?${q.toString()}`;
  };

  // Dialog behaviour: focus in, Esc closes, Tab stays inside, focus goes back to where it came from.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    node?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !node) return;
      const f = Array.from(node.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,textarea,select,[tabindex]:not([tabindex="-1"])')).filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    const lock = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey, true); document.body.style.overflow = lock; prev?.focus?.(); };
  }, [onClose]);
  useEffect(() => {
    if (!focusId) return;
    const el = focusRow.current;
    el?.scrollIntoView({ block: "center" });
    el?.querySelector<HTMLElement>("button")?.focus();
  }, [focusId]);

  const doCopy = async (key: string, text: string) => {
    const ok = await copyText(text);
    if (ok) { setCopied(key); setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000); }
  };

  const previewBtnText = label.trim() || storeLabel;
  const storeCode = useMemo(() => (tenantId ? snippet("store", tenantId) : ""), [tenantId, mode, label, colour, origin]); // eslint-disable-line react-hooks/exhaustive-deps

  const codeBox = (code: string) => (
    <pre className="m-0 max-h-[132px] overflow-auto whitespace-pre-wrap break-all rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 text-[12.5px] leading-[1.5] text-[var(--ink)]" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }} tabIndex={0}>{code}</pre>
  );
  const copyBtn = (key: string, code: string) => (
    <Button sm variant="primary" onClick={() => void doCopy(key, code)}>{copied === key ? `✓ ${t("p9em.copied")}` : t("p9em.copy")}</Button>
  );

  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/55 p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-label={t("p9em.title")} tabIndex={-1}
        className="my-2 w-full max-w-[760px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--ink)] shadow-2xl outline-none sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="m-0 text-[22px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{t("p9em.title")}</h2>
            <p className="mb-0 mt-1 text-[14px] leading-relaxed text-[var(--ink-2)]">{t("p9em.intro")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("p9em.close")} className="flex-none rounded-full px-2 text-[26px] leading-none text-[var(--ink-3)] hover:text-[var(--ink)]">×</button>
        </div>

        {/* How it looks: shared by every code below. */}
        <Card className="mt-4 p-3.5">
          <div className="text-[12px] font-extrabold uppercase tracking-wider text-[var(--ink-3)]">{t("p9em.style")}</div>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t("p9em.style")}>
            {([["button", t("p9em.styleButton")], ["inline", t("p9em.styleInline")]] as const).map(([v, text]) => (
              <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)}
                className="min-h-[40px] rounded-full border-2 px-3.5 text-[13.5px] font-bold"
                style={mode === v ? { borderColor: "var(--brand, #1d3a8f)", background: "var(--brand-soft, #e6ecff)", color: "var(--brand-ink, #1d3a8f)" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
                {text}
              </button>
            ))}
          </div>
          {mode === "button" && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-[12px] font-bold text-[var(--ink-3)]">
                {t("p9em.buttonText")}
                <input value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} placeholder={storeLabel}
                  className="h-10 w-[200px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[14px] font-normal text-[var(--ink)]" />
              </label>
              <label className="grid gap-1 text-[12px] font-bold text-[var(--ink-3)]">
                {t("p9em.buttonColour")}
                <input type="color" value={colour} onChange={(e) => setColour(e.target.value)} className="h-10 w-[64px] cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1" />
              </label>
              <span className="inline-block rounded-xl px-5 py-3 text-[14px] font-bold text-white" style={{ background: colour }} aria-hidden="true">{previewBtnText}</span>
            </div>
          )}
        </Card>

        {/* Whole storefront */}
        <Card className="mt-3 p-3.5">
          <h3 className="m-0 text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("p9em.storeHead")}</h3>
          <p className="mb-2 mt-1 text-[13.5px] leading-relaxed text-[var(--ink-2)]">{t("p9em.storeBody")}</p>
          {tenantId ? (
            <>
              {codeBox(storeCode)}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {copyBtn("store", storeCode)}
                <a href={testUrl("store", tenantId)} target="_blank" rel="noreferrer" className="inline-flex min-h-[34px] items-center rounded-full border border-[var(--line)] px-3.5 text-[12.5px] font-bold text-[var(--ink-2)]">{t("p9em.test")}</a>
                <a href={`/store/${encodeURIComponent(tenantId)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[34px] items-center rounded-full border border-[var(--line)] px-3.5 text-[12.5px] font-bold text-[var(--ink-2)]">{t("p9em.openPreview")}</a>
              </div>
            </>
          ) : <p className="m-0 text-[13px] text-[var(--ink-3)]">{t("p9em.needListing")}</p>}
        </Card>

        {/* One code per live listing */}
        <Card className="mt-3 p-3.5">
          <h3 className="m-0 text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("p9em.listHead")}</h3>
          <p className="mb-2 mt-1 text-[13.5px] leading-relaxed text-[var(--ink-2)]">{t("p9em.listBody")}</p>
          {rows.length === 0 ? <p className="m-0 text-[13px] text-[var(--ink-3)]">{t("p9em.none")}</p> : (
            <div className="grid gap-2.5">
              {rows.map((r) => {
                const code = snippet("listing", r.id);
                const on = r.id === focusId;
                return (
                  <div key={r.id} ref={on ? focusRow : undefined} className="rounded-xl border p-3" style={{ borderColor: on ? "var(--brand, #1d3a8f)" : "var(--line)", background: on ? "var(--brand-soft, #f3f6ff)" : "transparent" }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[14.5px] font-extrabold">{r.title}</span>
                      <span className="rounded-full bg-[#e7f6ee] px-2 py-0.5 text-[11px] font-bold text-[#0f7a43]">{t("p9em.live")}</span>
                      {r.linkOnly && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-3)]">{t("p9em.linkOnly")}</span>}
                    </div>
                    {r.dates && <div className="mt-0.5 text-[12.5px] text-[var(--ink-3)]">{r.dates}</div>}
                    <div className="mt-2">{codeBox(code)}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {copyBtn(r.id, code)}
                      <a href={testUrl("listing", r.id)} target="_blank" rel="noreferrer" className="inline-flex min-h-[34px] items-center rounded-full border border-[var(--line)] px-3.5 text-[12.5px] font-bold text-[var(--ink-2)]">{t("p9em.test")}</a>
                      <a href={`/book/${encodeURIComponent(r.id)}?preview=1`} target="_blank" rel="noreferrer" className="inline-flex min-h-[34px] items-center rounded-full border border-[var(--line)] px-3.5 text-[12.5px] font-bold text-[var(--ink-2)]">{t("p9em.openPreview")}</a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="mt-3 p-3.5">
          <h3 className="m-0 text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("p9em.howHead")}</h3>
          <ul className="mb-0 mt-2 grid list-disc gap-1.5 pl-5 text-[13.5px] leading-relaxed text-[var(--ink-2)]">
            <li>{t("p9em.howWix")}</li>
            <li>{t("p9em.howWp")}</li>
            <li>{t("p9em.howSq")}</li>
            <li>{t("p9em.howHtml")}</li>
          </ul>
          <p className="mb-0 mt-2.5 text-[13px] leading-relaxed text-[var(--ink-3)]">{t("p9em.parentsNote")}</p>
        </Card>

        <div className="mt-4 flex justify-end"><Button onClick={onClose}>{t("p9em.close")}</Button></div>
      </div>
    </div>
  );
}
