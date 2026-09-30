"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { MERGE_FIELDS } from "@/lib/merge-fields";
import { Button, Card, Input } from "@/components/ui";
import { useT, tNow } from "@/lib/i18n/provider";
import { RichB } from "@/features/common/richB";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;


interface Template { id: string; name: string; subject?: string; body: string; preset?: boolean }

// Render text with {MergeField} tokens shown as highlighted chips.
function Highlight({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{[A-Za-z]+\})/g).map((p, i) =>
        /^\{[A-Za-z]+\}$/.test(p)
          ? <span key={i} className="rounded bg-[var(--brand-soft)] px-1 py-[1px] text-[12.5px] font-semibold text-[var(--brand-strong)]">{p}</span>
          : <span key={i}>{p}</span>,
      )}
    </>
  );
}

function TemplateModal({ initial, onDone }: { initial?: Template; onDone: (changed: boolean) => void }) {
  const t = useT();
  const editing = !!initial && !initial.preset && initial.id;
  const [name, setName] = useState(initial?.name ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<"subject" | "body">("body");

  const insert = (f: string) =>
    focus === "subject" ? setSubject((s) => (s ? `${s} ` : "") + f) : setBody((b) => (b ? `${b} ` : "") + f);

  async function save() {
    if (!name.trim() || !body.trim()) { setError(t("p8em.tplNeedNameBody")); return; }
    setBusy(true); setError(null);
    try {
      const payload = { name: name.trim(), subject: subject.trim() || undefined, body: body.trim() };
      if (editing) await api(`/api/messages/templates/${encodeURIComponent(initial!.id)}`, { method: "PUT", body: JSON.stringify(payload) });
      else await apiPost("/api/messages/templates", payload);
      onDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : t("p8em.cSaveFailed")); setBusy(false); }
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && onDone(false)} className="fixed inset-0 z-[9999] flex items-start justify-center overflow-auto bg-black/55 px-3.5 py-8" style={LIGHT_PALETTE}>
      <div className="w-full max-w-[560px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-[0_24px_60px_rgba(0,0,0,.4)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h3 className="m-0 text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{editing ? t("p8em.tplEdit") : t("p8em.tplNew")}</h3>
          <button type="button" onClick={() => onDone(false)} className="cursor-pointer text-[20px] leading-none text-[var(--ink-3)]">×</button>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t("p8em.tplName")}</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("p8em.tplNamePh")} className="w-full" />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t("p8em.cSubject")}</div>
            <Input value={subject} onFocus={() => setFocus("subject")} onChange={(e) => setSubject(e.target.value)} placeholder={t("p8em.tplSubjectPh")} className="w-full" />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t("p8em.cMessage")}</div>
            <textarea value={body} onFocus={() => setFocus("body")} onChange={(e) => setBody(e.target.value)} rows={7}
              placeholder={t("p8em.tplBodyPh")} className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] leading-[1.5] text-[var(--ink)] outline-none focus:border-[var(--brand-2)]" />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t("p8em.tplInsertMerge")}</div>
            <div className="flex flex-col gap-1">
              {MERGE_FIELDS.map((f) => (
                <button key={f.token} type="button" onClick={() => insert(f.token)} className="flex items-baseline gap-2 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-start hover:bg-[var(--panel)]">
                  <span className="w-[112px] flex-none text-[11.5px] font-bold text-[var(--brand-strong)]">{f.token}</span>
                  <span className="text-[11.5px] text-[var(--ink-3)]">{f.desc}{f.bookingScoped ? t("p8em.tplNeedsBooking") : ""}</span>
                </button>
              ))}
            </div>
          </div>
          {error && <div className="text-[12.5px] text-[var(--red)]">{error}</div>}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-5 py-3.5">
          <Button onClick={() => onDone(false)}>{t("p8em.cBack")}</Button>
          <Button variant="primary" onClick={save} disabled={busy}>{busy ? t("p8em.cSaving") : editing ? t("p8em.tplSaveChanges") : t("p8em.tplCreate")}</Button>
        </div>
      </div>
    </div>
  );
}

/** Message templates — presets (Head-Office-owned) plus the tenant's own. */
export function TemplatesApp() {
  const t = useT();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ initial?: Template } | null>(null);
  const portalSeg = usePathname().split("/")[1] || "freelancer";

  const load = useCallback(() => {
    apiGet<Template[]>("/api/messages/templates").then(setTemplates).catch((e) => setError(e instanceof Error ? e.message : tNow("p8em.cLoadFailed")));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function duplicate(tp: Template) {
    try { await apiPost("/api/messages/templates", { name: `${tp.name} (copy)`, subject: tp.subject || undefined, body: tp.body }); load(); }
    catch (e) { setError(e instanceof Error ? e.message : t("p8em.tplDupFailed")); }
  }
  async function remove(tp: Template) {
    if (!window.confirm(t("p8em.tplDeleteConfirm", { name: tp.name }))) return;
    try { await api(`/api/messages/templates/${encodeURIComponent(tp.id)}`, { method: "DELETE" }); load(); }
    catch (e) { setError(e instanceof Error ? e.message : t("p8em.cDeleteFailed")); }
  }

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href={`/${portalSeg}/messages`} className="mb-1.5 inline-block text-[12px] font-bold text-[var(--brand-2)] no-underline">{t("p8em.tplBackToMessages")}</Link>
          <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("p8em.tplTitle")}</h2>
          <p className="max-w-[640px] text-[12.5px] text-[var(--ink-3)]"><RichB text={t("p8em.tplIntro")} className="text-[var(--ink-2)]" /></p>
        </div>
        <Button variant="primary" onClick={() => setModal({})}>{t("p8em.tplNewBtn")}</Button>
      </div>

      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {modal && <TemplateModal initial={modal.initial} onDone={(changed) => { setModal(null); if (changed) load(); }} />}

      {!templates ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8em.cLoading")}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((tp) => (
            <Card key={tp.id} className="p-4">
              <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-extrabold">{tp.name}</h3>
                  {tp.preset && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t("p8em.cPreset")}</span>}
                </div>
                <div className="flex flex-none items-center gap-2 text-[12.5px] font-bold">
                  {!tp.preset && <button type="button" onClick={() => setModal({ initial: tp })} className="rounded-full border border-[var(--line)] px-3 py-1 hover:bg-[var(--panel)]">{t("p8em.cEdit")}</button>}
                  <button type="button" onClick={() => duplicate(tp)} className="rounded-full border border-[var(--line)] px-3 py-1 hover:bg-[var(--panel)]">{t("p8em.cDuplicate")}</button>
                  {!tp.preset && <button type="button" onClick={() => remove(tp)} className="rounded-full border border-[var(--line)] px-3 py-1 text-[var(--red)] hover:bg-[var(--red-soft,#fdebec)]">{t("p8em.cDelete")}</button>}
                </div>
              </div>
              {tp.subject && (
                <div className="mb-1.5 text-[13px] leading-[1.6]">
                  <span className="font-bold">{t("p8em.tplSubjectLabel")}</span><Highlight text={tp.subject} />
                </div>
              )}
              <div className="whitespace-pre-wrap text-[13px] leading-[1.6] text-[var(--ink-2)]"><Highlight text={tp.body} /></div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
