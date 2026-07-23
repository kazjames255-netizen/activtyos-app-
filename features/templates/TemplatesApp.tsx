"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { Button, Card, Input } from "@/components/ui";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

const MERGE_FIELDS = ["{ParentName}", "{ChildName}", "{ProviderName}", "{ListingName}", "{SessionDate}", "{VenueName}", "{BookingRef}"];

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
    if (!name.trim() || !body.trim()) { setError("A name and a message are needed."); return; }
    setBusy(true); setError(null);
    try {
      const payload = { name: name.trim(), subject: subject.trim() || undefined, body: body.trim() };
      if (editing) await api(`/api/messages/templates/${encodeURIComponent(initial!.id)}`, { method: "PUT", body: JSON.stringify(payload) });
      else await apiPost("/api/messages/templates", payload);
      onDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); setBusy(false); }
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && onDone(false)} className="fixed inset-0 z-[9999] flex items-start justify-center overflow-auto bg-black/55 px-3.5 py-8" style={LIGHT_PALETTE}>
      <div className="w-full max-w-[560px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-[0_24px_60px_rgba(0,0,0,.4)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h3 className="m-0 text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{editing ? "Edit template" : "New template"}</h3>
          <button type="button" onClick={() => onDone(false)} className="cursor-pointer text-[20px] leading-none text-[var(--ink-3)]">×</button>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">Template name</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Booking confirmation" className="w-full" />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">Subject</div>
            <Input value={subject} onFocus={() => setFocus("subject")} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line (optional)" className="w-full" />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">Message</div>
            <textarea value={body} onFocus={() => setFocus("body")} onChange={(e) => setBody(e.target.value)} rows={7}
              placeholder="Write the message…" className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] leading-[1.5] text-[var(--ink)] outline-none focus:border-[var(--brand-2)]" />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">Insert a merge field (fills per recipient)</div>
            <div className="flex flex-wrap gap-1.5">
              {MERGE_FIELDS.map((f) => (
                <button key={f} type="button" onClick={() => insert(f)} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--brand-strong)] hover:bg-[var(--panel)]">{f}</button>
              ))}
            </div>
          </div>
          {error && <div className="text-[12.5px] text-[var(--red)]">{error}</div>}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-5 py-3.5">
          <Button onClick={() => onDone(false)}>← Back</Button>
          <Button variant="primary" onClick={save} disabled={busy}>{busy ? "Saving…" : editing ? "💾 Save changes" : "Create template"}</Button>
        </div>
      </div>
    </div>
  );
}

/** Message templates — presets (Head-Office-owned) plus the tenant's own. */
export function TemplatesApp() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ initial?: Template } | null>(null);
  const portalSeg = usePathname().split("/")[1] || "freelancer";

  const load = useCallback(() => {
    apiGet<Template[]>("/api/messages/templates").then(setTemplates).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function duplicate(t: Template) {
    try { await apiPost("/api/messages/templates", { name: `${t.name} (copy)`, subject: t.subject || undefined, body: t.body }); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t duplicate"); }
  }
  async function remove(t: Template) {
    if (!window.confirm(`Delete “${t.name}”?`)) return;
    try { await api(`/api/messages/templates/${encodeURIComponent(t.id)}`, { method: "DELETE" }); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t delete"); }
  }

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href={`/${portalSeg}/messages`} className="mb-1.5 inline-block text-[12px] font-bold text-[var(--brand-2)] no-underline">← Back to messages</Link>
          <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Message templates</h2>
          <p className="max-w-[640px] text-[12.5px] text-[var(--ink-3)]">Merge fields fill <b className="text-[var(--ink-2)]">per recipient</b> on send. Edit these to match your voice.</p>
        </div>
        <Button variant="primary" onClick={() => setModal({})}>＋ New template</Button>
      </div>

      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {modal && <TemplateModal initial={modal.initial} onDone={(changed) => { setModal(null); if (changed) load(); }} />}

      {!templates ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-extrabold">{t.name}</h3>
                  {t.preset && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">Preset</span>}
                </div>
                <div className="flex flex-none items-center gap-2 text-[12.5px] font-bold">
                  {!t.preset && <button type="button" onClick={() => setModal({ initial: t })} className="rounded-full border border-[var(--line)] px-3 py-1 hover:bg-[var(--panel)]">Edit</button>}
                  <button type="button" onClick={() => duplicate(t)} className="rounded-full border border-[var(--line)] px-3 py-1 hover:bg-[var(--panel)]">Duplicate</button>
                  {!t.preset && <button type="button" onClick={() => remove(t)} className="rounded-full border border-[var(--line)] px-3 py-1 text-[var(--red)] hover:bg-[var(--red-soft,#fdebec)]">Delete</button>}
                </div>
              </div>
              {t.subject && (
                <div className="mb-1.5 text-[13px] leading-[1.6]">
                  <span className="font-bold">Subject: </span><Highlight text={t.subject} />
                </div>
              )}
              <div className="whitespace-pre-wrap text-[13px] leading-[1.6] text-[var(--ink-2)]"><Highlight text={t.body} /></div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
