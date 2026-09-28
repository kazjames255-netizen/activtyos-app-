"use client";
import { useCallback, useEffect, useState } from "react";
import { get, put } from "@/lib/api";
import { useI18n } from "@/lib/i18n/provider";
import { useHubMessagesReady } from "@/lib/i18n/hubMessages";
import { pickPlural } from "@/lib/i18n/plural";
import { GAME_TITLE } from "./theme";
import { HOST_NAME } from "./characters/host";

// Tutor view of one child's Penguin Slide practice (docs C 6.2): a fact-strength heat map, slow-but-correct and wrong lists with the misconception ("often
// answers 48"), the response-time profile relative to the child's own baseline, practice quality, effort notes, productive vs total time, and a one-tap PIN of
// the tables to practise. Standalone on purpose: mount it anywhere a tutor looks at a student (Students panel / student page) with a tenant-scoped api path.
// HOOK: <PenguinTutorPanel childId={id} childName={name} /> - it calls GET /api/learning-hub/games/penguin-slide/facts and PUT .../pin (openapi tag hub-games).
interface Overview {
  facts: { key: string; op: string; a: number; b: number; thaw: number; attempts: number; correct: number; medianMs: number; band: string | null; oftenAnswers: number | null; errType: string | null }[];
  slowButCorrect: Overview["facts"]; wrong: Overview["facts"]; pinned: number[]; bests: Record<string, { fish: number; correct: number; answered: number; at: string }>;
  runs: { at: string; mode: string; answered: number; correct: number; fish: number; productiveSeconds: number; totalSeconds: number }[]; mtc: { at: string; score: number; total: number; timedOut: number }[];
  totals: { facts: number; secure: number; gold: number; fluent: number }; heat: Record<string, { thaw: number; recall: number }>;
  rtProfile: { rt0Ms: number; byTable: Record<string, number>; retrieval: number; reconstructed: number; calculated: number };
  misconceptions: { mix: Record<string, number>; flags: string[]; topConfusions: { fact: string; answered: number; times: number }[] };
  practice: { spacedDaysLast14: number; sessions: number; trials: number; accuracy: number | null; inBandRuns: number; productiveSeconds: number; totalSeconds: number };
  effort: { rapidGuessRuns: number; timeouts: number; note: string }; weekDays: number; weekGoal: number; mastery: { note: string };
}
const fmt = (k: string) => k.slice(2).replace("x", "×");
const CLS = ["#dcecff", "#a9c8f6", "#ffe9a8", "#ffd25a", "#ffb300"];

export function PenguinTutorPanel({ childId, childName, tenantQuery = "" }: { childId: string; childName?: string; tenantQuery?: string }) {
  const { locale, t: tt } = useI18n(); useHubMessagesReady(locale);
  const T = useCallback((k: string, v?: Record<string, string | number>) => tt(`hubgames.${k}`, { game: GAME_TITLE, mascot: HOST_NAME, ...v }), [tt]);
  const [o, setO] = useState<Overview | null>(null);
  const [pins, setPins] = useState<number[]>([]);
  const [err, setErr] = useState(""); const [saved, setSaved] = useState(false);
  const q = `?childId=${encodeURIComponent(childId)}${tenantQuery ? `&${tenantQuery}` : ""}`;
  const load = useCallback(() => { get<Overview>(`/api/learning-hub/games/penguin-slide/facts${q}`).then((d) => { setO(d); setPins(d.pinned); }).catch((e: Error) => setErr(e.message)); }, [q]);
  useEffect(load, [load]);
  const toggle = (n: number) => setPins((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length >= 6 ? p : [...p, n].sort((a, b) => a - b)));
  const save = async () => { setSaved(false); try { await put(`/api/learning-hub/games/penguin-slide/pin${tenantQuery ? `?${tenantQuery}` : ""}`, { childId, tables: pins }); setSaved(true); load(); } catch (e) { setErr((e as Error).message); } };
  if (err) return <div role="alert">{err}</div>;
  if (!o) return <div aria-busy="true">&hellip;</div>;
  const nums = Array.from({ length: 11 }, (_, i) => i + 2);
  const heat = (a: number, b: number) => o.heat[`${Math.min(a, b)}x${Math.max(a, b)}`]?.thaw ?? 0;
  const sec = (ms: number) => (ms / 1000).toFixed(1);
  // Nothing played yet: say so in one line instead of an empty grid and a page of zeros. Pinning tables still works (it sets what they will be given first).
  const played = o.practice.sessions > 0 || o.runs.length > 0 || o.totals.facts > 0;
  return (
    <section data-testid="ps-tutor" data-played={played ? "1" : "0"} style={{ display: "grid", gap: 14, fontFamily: "var(--ff, system-ui)" }}>
      <h3 style={{ margin: 0 }}>{T("tutor_title", { name: childName ?? "" })}</h3>
      {played
        ? <p style={{ margin: 0 }}>{T("tutor_summary", { fluent: o.totals.fluent, facts: o.totals.facts, days: o.weekDays, goal: o.weekGoal })}</p>
        : <p style={{ margin: 0 }} data-testid="ps-empty">{T("tutor_empty", { name: (childName ?? "").split(" ")[0] || "", game: GAME_TITLE })}</p>}
      <div>
        <b>{T("tutor_pin")}</b>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }} role="group" aria-label={T("tutor_pin")}>
          {nums.map((n) => <button key={n} type="button" aria-pressed={pins.includes(n)} onClick={() => toggle(n)} data-testid={`ps-pin-${n}`} style={{ minWidth: 44, minHeight: 44, borderRadius: 10, border: "2px solid #b8cdf0", background: pins.includes(n) ? "#3b57d6" : "#fff", color: pins.includes(n) ? "#fff" : "#1b2350", fontWeight: 800 }}>{n}</button>)}
          <button type="button" onClick={() => void save()} data-testid="ps-pin-save" style={{ minHeight: 44, borderRadius: 10, border: 0, background: "#ffce4a", padding: "0 16px", fontWeight: 800 }}>{T("tutor_save")}</button>
        </div>
        <small>{pins.length ? T("tutor_pinned", { tables: pins.join(", ") }) : T("tutor_pinned_none", { mascot: HOST_NAME })}{saved ? ` · ${T("saved_server")}` : ""}</small>
      </div>
      {played && <>
      <div>
        <b>{T("tutor_heat")}</b>
        <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 2 }}>{T("tutor_heat_key")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 2, maxWidth: 440, marginTop: 6 }} role="table" aria-label={T("tutor_heat")}>
          <span />{nums.map((n) => <span key={n} style={{ textAlign: "center", fontSize: 11, fontWeight: 800 }}>{n}</span>)}
          {nums.map((a) => (<div key={a} style={{ display: "contents" }}><span style={{ fontSize: 11, fontWeight: 800, textAlign: "center" }}>{a}</span>{nums.map((b) => { const s = heat(a, b); return <span key={b} title={`${a}×${b}: ${T(`state_${s}`)}`} aria-label={`${a}×${b}: ${T(`state_${s}`)}`} style={{ aspectRatio: "1", borderRadius: 4, background: CLS[s] }} />; })}</div>))}
        </div>
      </div>
      {o.slowButCorrect.length > 0 && <div><b>{T("tutor_slow")}</b><ul style={{ margin: "4px 0 0", paddingInlineStart: 18 }}>{o.slowButCorrect.map((f) => <li key={f.key}>{fmt(f.key)} · {sec(f.medianMs)} s</li>)}</ul></div>}
      {o.wrong.length > 0 && <div><b>{T("tutor_wrong")}</b><ul style={{ margin: "4px 0 0", paddingInlineStart: 18 }}>{o.wrong.map((f) => <li key={f.key}>{fmt(f.key)}{f.oftenAnswers ? ` · ${T("tutor_often", { n: f.oftenAnswers })}` : ""}{f.errType ? ` (${f.errType.replace(/_/g, " ")})` : ""}</li>)}</ul></div>}
      <details><summary style={{ cursor: "pointer", fontWeight: 800, minHeight: 44 }}>{T("tutor_more")}</summary><div style={{ display: "grid", gap: 10, marginTop: 6 }}>
      <div><b>{T("tutor_rt")}</b><div>{T("tutor_rt_line", { rt0: sec(o.rtProfile.rt0Ms), r: o.rtProfile.retrieval, c: o.rtProfile.reconstructed, k: o.rtProfile.calculated })}</div></div>
      <div><b>{T("tutor_practice")}</b><div>{T("tutor_practice_line", { days: o.practice.spacedDaysLast14, runs: o.practice.sessions, trials: o.practice.trials, acc: o.practice.accuracy === null ? "-" : Math.round(o.practice.accuracy * 100), prod: Math.round(o.practice.productiveSeconds / 60), total: Math.round(o.practice.totalSeconds / 60) })}</div><small>{T("tutor_effort", { g: o.effort.rapidGuessRuns, t: o.effort.timeouts })}</small></div>
      </div></details>
      {o.mtc.length > 0 && <div><b>{T("mtc_title")}</b><ul style={{ margin: "4px 0 0", paddingInlineStart: 18 }}>{o.mtc.map((m) => <li key={m.at}>{m.at.slice(0, 10)} · {T("mtc_score", { score: m.score, total: m.total })} · {T("tutor_timedout", { n: m.timedOut })}</li>)}</ul></div>}
      <small>{T("tutor_note")}</small>
      </>}
    </section>
  );
}
export { pickPlural };
