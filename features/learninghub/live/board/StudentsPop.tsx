"use client";

import { FOCUS } from "../../teachKit";
import { useT } from "@/lib/i18n/provider";
import { Rich } from "./Rich";
import { BIcon } from "./boardIcons";
import { useCtrl } from "./BoardUi";
import type { BoardController } from "./controller";

// "Students can write" — the tutor picks who may write on the shared board:
// one student, some, everyone, or nobody. The set is broadcast and every peer
// enforces it (the reducer ignores anyone not on it).

export interface Attendee { childId: string; name: string }
const sw = `relative inline-flex h-7 w-12 flex-none items-center rounded-full border transition-colors motion-reduce:transition-none ${FOCUS}`;

export function StudentsPop({ ctrl, attendees, present, shown, close }: { ctrl: BoardController; attendees: Attendee[]; present: Set<string>; shown: (a: Attendee, i: number) => string; close: () => void }) {
  const t = useT();
  useCtrl(ctrl);
  const perm = ctrl.state.perm;
  const has = (id: string) => perm.all || perm.ids.includes(id);
  const set = (all: boolean, ids: string[], note?: string) => ctrl.setPermission(all, ids, note);
  const toggle = (a: Attendee) => {
    if (perm.all) set(false, attendees.filter((x) => x.childId !== a.childId).map((x) => x.childId));
    else if (perm.ids.includes(a.childId)) set(false, perm.ids.filter((i) => i !== a.childId));
    else set(false, [...perm.ids, a.childId]);
  };
  const order = attendees.map((a, i) => ({ a, i })).sort((x, y) => Number(present.has(y.a.childId)) - Number(present.has(x.a.childId)) || x.i - y.i);
  const count = perm.all ? attendees.length : perm.ids.filter((i) => attendees.some((a) => a.childId === i)).length;
  return (
    <div role="dialog" aria-label={t("hublive.bSp_dialogAria")} data-testid="board-students-pop" className="hub-pop w-[380px] max-w-full rounded-2xl border border-[var(--hub-warm-line)] bg-[var(--surface)] p-2.5 shadow-[var(--shadow)]">
      <div className="flex items-center gap-2 px-1 pb-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]"><BIcon name="users" size={18} /></span>
        <div className="min-w-0 flex-1"><div className="text-[14px] font-extrabold text-[var(--ink)]">{t("hublive.bSp_title")}</div><div className="text-[11.5px] text-[var(--ink-3)]">{count ? t("hublive.bSp_countOf", { n: count, total: attendees.length }) : t("hublive.bSp_onlyYou")}</div></div>
        <button type="button" onClick={close} aria-label={t("hublive.bClose")} className={`grid h-9 w-9 place-items-center rounded-lg text-[var(--ink-3)] hover:bg-[var(--hub-warm-2)] ${FOCUS}`}><BIcon name="close" size={16} /></button>
      </div>
      <div className="mb-2 flex gap-1.5">
        <button type="button" data-action="allow-all" aria-pressed={perm.all} onClick={() => set(true, [], t("hublive.bSp_noteAll"))} className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border px-2 text-[12.5px] font-extrabold ${FOCUS} ${perm.all ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand)]"}`}>{t("hublive.bEveryone")}</button>
        <button type="button" data-action="allow-none" aria-pressed={!perm.all && !perm.ids.length} onClick={() => set(false, [], t("hublive.bSp_noteNone"))} className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border px-2 text-[12.5px] font-extrabold ${FOCUS} ${!perm.all && !perm.ids.length ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand)]"}`}>{t("hublive.bSp_takeBack")}</button>
      </div>
      <ul className="m-0 max-h-[min(50vh,420px)] list-none space-y-1 overflow-y-auto p-0">
        {order.map(({ a, i }) => {
          const on = has(a.childId), here = present.has(a.childId), nm = shown(a, i);
          return (
            <li key={a.childId} className="flex items-center gap-2 rounded-xl px-1.5 py-0.5" data-student={a.childId}>
              <span className={`grid h-8 w-8 flex-none place-items-center rounded-full text-[12px] font-extrabold ${here ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "bg-[var(--hub-warm-2)] text-[var(--ink-3)]"}`} aria-hidden>{nm.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-[13px] font-bold text-[var(--ink)]">{nm}</div><div className="text-[11px] text-[var(--ink-3)]">{here ? t("hublive.bSp_inCall") : t("hublive.bSp_notHere")}</div></div>
              <button type="button" data-action="just-one" aria-label={t("hublive.bSp_just", { name: nm })} title={t("hublive.bSp_just", { name: nm })} onClick={() => set(false, [a.childId], t("hublive.bSp_noteJust", { name: nm }))} className={`inline-flex min-h-[44px] items-center rounded-lg px-2 text-[11.5px] font-bold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>{t("hublive.bSp_only")}</button>
              <button type="button" role="switch" aria-checked={on} aria-label={t("hublive.bSp_nameCanWrite", { name: nm })} data-switch={a.childId} onClick={() => toggle(a)} className={`${sw} ${on ? "border-[var(--green)] bg-[var(--green)]" : "border-[var(--hub-warm-line)] bg-[var(--hub-warm-2)]"}`}>
                <span className={`absolute h-5 w-5 rounded-full bg-white shadow transition-all motion-reduce:transition-none ${on ? "start-[24px]" : "start-[3px]"}`} />
              </button>
            </li>
          );
        })}
        {!attendees.length && <li className="px-2 py-3 text-center text-[12.5px] text-[var(--ink-3)]">{t("hublive.bSp_noStudents")}</li>}
      </ul>
      <p className="m-0 mt-2 px-1 text-[11.5px] leading-snug text-[var(--ink-3)]"><Rich text={t("hublive.bSp_help")} /></p>
    </div>
  );
}
