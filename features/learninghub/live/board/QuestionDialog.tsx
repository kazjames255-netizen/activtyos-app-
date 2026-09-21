"use client";

import { useState } from "react";
import { Dialog, FOCUS } from "../../teachKit";
import { BIcon } from "./boardIcons";
import { ImagePicker } from "./ImagePicker";
import type { Attendee } from "./StudentsPop";

// "Set a question": one question (text and/or a picture) written at the top of every
// chosen student's private page.

export interface Question { text: string; image?: { imageId: string; url: string; w: number; h: number } }
export function QuestionDialog({ qs, attendees, shown, targets, onClose, onSend }: {
  qs: string; attendees: Attendee[]; shown: (a: Attendee, i: number) => string;
  /** Pre-ticked students (ids). */
  targets: string[]; onClose: () => void; onSend: (q: Question, to: string[]) => void;
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<Question["image"]>();
  const [picking, setPicking] = useState(false);
  const [to, setTo] = useState<Set<string>>(new Set(targets));
  const can = (text.trim() || image) && to.size > 0;
  return (
    <>
      <Dialog title="Set a question" subtitle="It appears at the top of each chosen student's page — they write their answer underneath." onClose={onClose} size="lg"
        footer={<>
          <button type="button" onClick={onClose} className={`inline-flex min-h-[44px] items-center rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] px-4 text-[13px] font-bold text-[var(--ink-2)] ${FOCUS}`}>Cancel</button>
          <button type="button" data-action="send-question" disabled={!can} onClick={() => onSend({ text: text.trim(), image }, [...to])} className={`inline-flex min-h-[44px] items-center rounded-xl px-5 text-[13px] font-extrabold text-white disabled:opacity-50 ${FOCUS}`} style={{ background: "linear-gradient(180deg, var(--brand-2), var(--brand))" }}>Send to {to.size} {to.size === 1 ? "student" : "students"}</button>
        </>}>
        <label className="block">
          <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Question</span>
          <textarea data-autofocus value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={400} placeholder="e.g. What is 3/4 + 1/8? Show your working." data-testid="question-text"
            className={`w-full resize-none rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] p-3 text-[14px] text-[var(--ink)] ${FOCUS}`} />
        </label>
        <div className="mt-2 flex items-center gap-2">
          <button type="button" onClick={() => setPicking(true)} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] px-3 text-[13px] font-bold text-[var(--ink-2)] hover:border-[var(--brand)] ${FOCUS}`}><BIcon name="image" size={17} />{image ? "Change picture" : "Add a picture"}</button>
          {image && <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={image.url} alt="" className="h-11 w-14 rounded-lg border border-[var(--hub-warm-line)] object-cover" /><button type="button" onClick={() => setImage(undefined)} className={`min-h-[44px] rounded-lg px-2 text-[12.5px] font-bold text-[var(--red)] ${FOCUS}`}>Remove</button></>}
        </div>
        <div className="mb-1.5 mt-4 flex items-center justify-between">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Send to</span>
          <button type="button" onClick={() => setTo(to.size === attendees.length ? new Set() : new Set(attendees.map((a) => a.childId)))} className={`min-h-[44px] rounded-lg px-2 text-[12.5px] font-bold text-[var(--brand)] ${FOCUS}`}>{to.size === attendees.length ? "None" : "Everyone"}</button>
        </div>
        <ul className="m-0 grid list-none grid-cols-2 gap-1.5 p-0 sm:grid-cols-3">
          {attendees.map((a, i) => {
            const on = to.has(a.childId);
            return (
              <li key={a.childId}>
                <label className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-2.5 text-[13px] font-bold ${on ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-2)]"}`}>
                  <input type="checkbox" checked={on} onChange={() => { const s = new Set(to); if (on) s.delete(a.childId); else s.add(a.childId); setTo(s); }} className="h-4 w-4 accent-[var(--brand)]" />
                  <span className="truncate">{shown(a, i)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </Dialog>
      {picking && <ImagePicker qs={qs} onClose={() => setPicking(false)} onPick={(x) => { setImage({ imageId: x.id, url: x.url, w: x.w, h: x.h }); setPicking(false); }} />}
    </>
  );
}
