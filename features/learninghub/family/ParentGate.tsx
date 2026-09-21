"use client";

import { useMemo, useRef, useState } from "react";
import { Dialog, FOCUS } from "../teachKit";
import { Button } from "@/components/ui";

// The way out of kid mode: a small sum a grown-up does without thinking and a young child can't just guess (no hold-to-exit to
// discover by accident). Wrong answer = a fresh sum. Nothing is stored; this is an accident guard, not security.

const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
function makeSum() { const a = rnd(13, 19), b = rnd(6, 9); return { text: `${a} × ${b}`, answer: a * b }; }

export function ParentGate({ name, onUnlock, onClose }: { name: string; onUnlock: () => void; onClose: () => void }) {
  const [sum, setSum] = useState(makeSum);
  const [val, setVal] = useState("");
  const [wrong, setWrong] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const label = useMemo(() => `What is ${sum.text}?`, [sum]);
  const check = () => {
    if (Number(val.trim()) === sum.answer) { onUnlock(); return; }
    setWrong(true); setVal(""); setSum(makeSum()); input.current?.focus();
  };
  return (
    <Dialog title="Grown-ups only" subtitle={`Leave ${name}'s screen`} onClose={onClose} id="hub-parent-gate"
      footer={<><Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={onClose}>Stay here</Button><Button variant="solid" className={`min-h-[44px] ${FOCUS}`} onClick={check} data-testid="kid-gate-unlock">Unlock</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); check(); }}>
        <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">To go back to the family menu, answer this:</p>
        <label htmlFor="kid-gate-answer" className="mt-3 block text-[22px] font-extrabold text-[var(--ink)]" data-testid="kid-gate-sum">{label}</label>
        <input ref={input} id="kid-gate-answer" inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={val} onChange={(e) => { setVal(e.target.value.replace(/[^0-9]/g, "")); setWrong(false); }} data-autofocus
          className="mt-2 min-h-[48px] w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[18px] font-bold text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
        {wrong && <p role="alert" className="m-0 mt-2 text-[13px] font-bold text-[var(--red)]">Not quite. Here is a new one.</p>}
      </form>
    </Dialog>
  );
}
