// Q2 scratch: defect metrics over a dump (temporary; deleted at the end)
import fs from "node:fs";
import { definitionalBlank, slashAdjacent, distractorClash, adjectiveLike } from "./clozeGuard";
import { fixLang, badPronunciationKeyword } from "./oakFixes";
const all = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as any[];
const M: Record<string, number> = {}; const ex: Record<string, string[]> = {};
const hit = (k: string, e: string) => { M[k] = (M[k] ?? 0) + 1; (ex[k] ??= []).length < 3 && ex[k].push(e); };
let clozes = 0, kwq = 0, matches = 0, decks = 0, plans = 0;
const vowel = (w: string) => /^[aeiou]/i.test(w);
for (const l of all) {
  decks++;
  for (const s of l.slides) for (const b of s.blocks) {
    const items: { q: string; options: string[]; answer: number }[] = b.t === "choice" ? [b] : b.t === "choices" ? b.items : [];
    for (const c of items) {
      const cl = c.q.includes("_____");
      if (!cl) { kwq++; continue; }
      clozes++;
      const i = c.q.indexOf("_____"), before = c.q.slice(0, i), after = c.q.slice(i + 5), ans = c.options[c.answer];
      if (!definitionalBlank(before, after)) hit("cloze non-definitional (blank merely mentioned)", `${l.slug}: ${c.q.slice(0, 80)}`);
      if (slashAdjacent(before, after)) hit("cloze blank glued to a slash", `${l.slug}: ${c.q.slice(0, 80)}`);
      const caps = c.options.map((o) => /^\p{Lu}/u.test(o)); if (new Set(caps).size > 1) hit("cloze option capitalisation gives the answer away", `${l.slug}: ${c.options.join(" | ")}`);
      if (/\b(a|an)\s*$/i.test(before) && new Set(c.options.map(vowel)).size > 1) hit("cloze a/an disagrees with an option", `${l.slug}: ${before.slice(-20)}[${c.options.join("|")}]`);
      c.options.forEach((o, k) => { if (k !== c.answer && distractorClash(ans, o, after)) hit("cloze wrong option in the answer's confusable family / adjective pair", `${l.slug}: ${ans} vs ${o}`); });
    }
    if (b.t === "match") matches++;
    // keywords with a bad pronunciation example shown
    if (b.t === "define") for (const it of b.items) if (badPronunciationKeyword(it.term, it.def)) hit("keyword card with wrong pronunciation example", `${l.slug}: ${it.term} = ${it.def}`);
  }
  // typos still present in deck / plan text
  const txt = JSON.stringify(l.slides) + JSON.stringify(l.plan ?? {}) + JSON.stringify(l.facts);
  if (fixLang(txt) !== txt) hit("lessons whose text still holds an Oak typo from the correction table", l.slug);
  if (l.plan) {
    plans++;
    for (const st of l.plan.steps) {
      for (const e of st.examples ?? []) hit("arithmetic 'worked example' in an English/language plan", `${l.slug}: ${e}`);
      if (st.kind === "teach" && /^Can you explain “/.test(st.checkFor?.ask ?? "")) hit("plan asks 'Can you explain “<activity heading>”?'", `${l.slug}: ${st.checkFor.ask.slice(0, 70)}`);
      if (st.kind === "warmup" && /What does “\[/.test(st.checkFor?.ask ?? "")) hit("plan asks what a sound-symbol '[x]' MEANS", `${l.slug}: ${st.checkFor.ask}`);
    }
    const alltxt = [...l.plan.commonMistakes.flatMap((m: any) => [m.mistake, m.fix]), ...l.plan.watchOut].join(" ");
    if (/\bpages? \d|https?:|\bour\b[^.]{0,30}\bcurricul|\bcycles?\b|\b(?:first|second|third|final|last|next|main) (?:practice |writing |reading )?tasks?\b|\baudio\b/i.test(alltxt)) hit("tutor tip / mistake refers to Oak's pages, cycles, tasks, audio or curriculum", l.slug);
  }
}
const per100 = (n: number, d: number) => (d ? ((100 * n) / d).toFixed(2) : "-");
console.log(`lessons ${decks}, plans ${plans}, cloze items ${clozes}, which-key-word items ${kwq}, match blocks ${matches}`);
for (const [k, v] of Object.entries(M).sort()) console.log(`${String(v).padStart(6)}  ${k}   [per 100 cloze: ${per100(v, clozes)}]`, "\n        e.g.", ex[k].join(" || ").slice(0, 300));
