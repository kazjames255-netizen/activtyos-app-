// Self-test for sentences.ts. Run: server/node_modules/.bin/tsx features/learninghub/tools/languages/verbs/sentences.selftest.ts  (exit 1 on failure)
import { TABLES, tablesFor, generateSentences, jumble, tokens, checkSentence, buildFromPicks, buildOrderSentence, deMain, deTimeFront, deSub, deInverted, diagnoseOrder, DE_CLAUSES, type OrderSpec } from "./sentences";
import { fullMarks } from "../../engine/marking";

let n = 0; const fails: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => { n++; const a = JSON.stringify(got), b = JSON.stringify(want); if (a !== b) fails.push(`${label}: got ${a}, want ${b}`); };
const ok = (label: string, cond: boolean) => eq(label, cond, true);

// ── tables ──
for (const l of ["fr", "es", "de"] as const) {
  ok(`${l} has >= 6 tables`, tablesFor(l).length >= 6);
  const themes = new Set(tablesFor(l).map((t) => t.theme));
  for (const th of ["hobbies", "school", "family", "holidays", "town", "food"]) ok(`${l} has a ${th} table`, themes.has(th));
}
ok("table ids unique", new Set(TABLES.map((t) => t.id)).size === TABLES.length);
ok("every column has options and a label", TABLES.every((t) => t.columns.every((c) => c.label && c.options.length >= 1 && c.options.every((o) => o.t && o.en !== undefined))));
ok("enOrder is a permutation of the columns", TABLES.every((t) => !t.enOrder || [...t.enOrder].sort().join() === t.columns.map((_, i) => i).join()));

// ── building ──
const hob = TABLES.find((t) => t.id === "de-hobbies")!;
eq("de hobby build", buildFromPicks(hob, [0, 0, 0]), { target: "Ich spiele gern Tennis mit meinen Freunden.", en: "I like playing tennis with my friends." });
eq("fr elision join", buildFromPicks(TABLES.find((t) => t.id === "fr-hobbies")!, [0, 1, 1]).target, "J'aime jouer au foot avec mes amis.");
eq("fr school build", buildFromPicks(TABLES.find((t) => t.id === "fr-school")!, [0, 0, 1, 0]), { target: "Le lundi j'ai anglais à neuf heures.", en: "On Mondays I have English at nine o'clock." });
eq("es school build", buildFromPicks(TABLES.find((t) => t.id === "es-school")!, [1, 1, 4, 1]).target, "Los martes tenemos educación física por la tarde.");
const sch = TABLES.find((t) => t.id === "de-school")!;
eq("de school verb second after day + english reorder", buildFromPicks(sch, [0, 0, 0, 0]), { target: "Am Montag habe ich um neun Uhr Mathe.", en: "On Monday I have maths at nine o'clock." });
const hol = TABLES.find((t) => t.id === "de-hol-past")!;
eq("de Perfekt participle last", buildFromPicks(hol, [0, 0, 0, 0, 0]), { target: "Letzten Sommer bin ich mit meiner Familie nach Spanien gefahren.", en: "Last summer I went to Spain with my family." });
eq("de future infinitive last", buildFromPicks(TABLES.find((t) => t.id === "de-hol-future")!, [2, 1, 2, 1]).target, "Morgen werden wir nach Berlin fliegen.");

// ── generation: reproducible, distinct, within table ──
for (const t of TABLES.filter((x) => x.mode !== "order")) {
  const a = generateSentences(t, 42, 5), b = generateSentences(t, 42, 5);
  eq(`${t.id} deterministic`, a, b);
  eq(`${t.id} distinct`, new Set(a.map((x) => x.target)).size, a.length);
  ok(`${t.id} sentences end with a full stop and start upper-case`, a.every((x) => x.target.endsWith(".") && x.target[0] === x.target[0]!.toUpperCase()));
  ok(`${t.id} picks rebuild the same sentence`, a.every((x) => buildFromPicks(t, x.picks).target === x.target && buildFromPicks(t, x.picks).en === x.en));
}
ok("different seeds differ", JSON.stringify(generateSentences(hob, 1, 5)) !== JSON.stringify(generateSentences(hob, 2, 5)));
eq("n is capped by the table size", generateSentences(TABLES.find((t) => t.id === "fr-town")!, 3, 500).length, 15);

// ── German word order builders (hand-written) ──
const m1 = DE_CLAUSES.mains[0]!, m2 = DE_CLAUSES.mains[1]!, m4 = DE_CLAUSES.mains[3]!, m6 = DE_CLAUSES.mains[5]!;
eq("main S-V", deMain(m1), "Ich spiele am Wochenende Tennis");
eq("time first -> inversion", deTimeFront(m1), "Am Wochenende spiele ich Tennis");
eq("Perfekt: participle at the end", deMain(m2), "Ich habe gestern Fußball gespielt");
eq("Perfekt inversion", deTimeFront(m2), "Gestern habe ich Fußball gespielt");
eq("separable prefix at the end (main)", deMain(m4), "Ich stehe um sieben Uhr auf");
eq("separable prefix at the end (time first)", deTimeFront(m4), "Um sieben Uhr stehe ich auf");
eq("noun subject", deTimeFront(m6), "Morgen kommt meine Schwester an");
const [weil1, , dass1, wenn1, obw1, weil6, dass7, weil8] = DE_CLAUSES.pairs;
eq("weil: verb at end", deSub("weil", weil1!.sub), "weil ich krank bin");
eq("dass: verb at end", deSub("dass", dass1!.sub), "dass er Fußball mag");
eq("wenn: single verb at end", deSub("wenn", wenn1!.sub), "wenn es regnet");
eq("obwohl: verb at end", deSub("obwohl", obw1!.sub), "obwohl ich müde bin");
eq("modal: infinitive then finite modal", deSub("weil", weil6!.sub), "weil sie nach Berlin fahren will");
eq("Perfekt in subordinate: participle then auxiliary", deSub("dass", dass7!.sub), "dass er gestern Tennis gespielt hat");
eq("separable verb rejoins in subordinate clause", deSub("weil", weil8!.sub), "weil ich früh aufstehe");
eq("inversion after a subordinate clause", deInverted(wenn1!.main), "gehen wir ins Kino");
const sentence = (o: OrderSpec) => buildOrderSentence(o).target;
eq("weil at the end", sentence({ variant: "sub-end", main: weil1!.main, sub: weil1!.sub, conj: "weil" }), "Ich bleibe zu Hause, weil ich krank bin.");
eq("weil first: verb-second in the main clause", sentence({ variant: "sub-first", main: weil1!.main, sub: weil1!.sub, conj: "weil" }), "Weil ich krank bin, bleibe ich zu Hause.");
eq("wenn first", sentence({ variant: "sub-first", main: wenn1!.main, sub: wenn1!.sub, conj: "wenn" }), "Wenn es regnet, gehen wir ins Kino.");
eq("obwohl first", sentence({ variant: "sub-first", main: obw1!.main, sub: obw1!.sub, conj: "obwohl" }), "Obwohl ich müde bin, spiele ich Tennis.");
eq("dass end", sentence({ variant: "sub-end", main: dass1!.main, sub: dass1!.sub, conj: "dass" }), "Er sagt, dass er Fußball mag.");
eq("english for sub-first", buildOrderSentence({ variant: "sub-first", main: weil1!.main, sub: weil1!.sub, conj: "weil" }).en, "Because I am ill, I stay at home.");
eq("english for time-front", buildOrderSentence({ variant: "time-front", main: m2 }).en, "Yesterday, I played football.");
eq("english for main", buildOrderSentence({ variant: "main", main: m2 }).en, "I played football yesterday.");

// ── word-order checker ──
const inv = (v: OrderSpec["variant"], main = m1) => ({ variant: v, main } as OrderSpec);
eq("main correct", diagnoseOrder("Ich spiele am Wochenende Tennis.", inv("main")), []);
eq("time-front correct", diagnoseOrder("Am Wochenende spiele ich Tennis", inv("time-front")), []);
ok("time-front with verb third is flagged", diagnoseOrder("Am Wochenende ich spiele Tennis", inv("time-front")).length >= 1);
ok("time-front missing inversion is flagged", diagnoseOrder("Am Wochenende ich spiele Tennis", inv("time-front")).some((x) => /SECOND/.test(x)));
ok("Perfekt participle not last is flagged", diagnoseOrder("Ich habe gespielt gestern Fußball", inv("main", m2)).some((x) => /END/.test(x)));
eq("Perfekt correct", diagnoseOrder("Ich habe gestern Fußball gespielt", inv("main", m2)), []);
ok("separable prefix missing at end is flagged", diagnoseOrder("Ich stehe auf um sieben Uhr", inv("main", m4)).some((x) => /END/.test(x)));
const subEnd = (p: typeof weil1) => ({ variant: "sub-end", main: p!.main, sub: p!.sub, conj: p!.conj } as OrderSpec);
const subFirst = (p: typeof weil1) => ({ variant: "sub-first", main: p!.main, sub: p!.sub, conj: p!.conj } as OrderSpec);
eq("weil-end correct", diagnoseOrder("Ich bleibe zu Hause, weil ich krank bin.", subEnd(weil1)), []);
ok("weil with verb second is flagged", diagnoseOrder("Ich bleibe zu Hause, weil ich bin krank.", subEnd(weil1)).some((x) => /LAST/.test(x)));
eq("weil-first correct", diagnoseOrder("Weil ich krank bin, bleibe ich zu Hause.", subFirst(weil1)), []);
ok("weil-first without inversion is flagged", diagnoseOrder("Weil ich krank bin, ich bleibe zu Hause.", subFirst(weil1)).some((x) => /main verb comes first/.test(x)));
eq("modal clause correct", diagnoseOrder("Sie lernt Deutsch, weil sie nach Berlin fahren will.", subEnd(weil6)), []);
ok("modal in wrong place flagged", diagnoseOrder("Sie lernt Deutsch, weil sie will nach Berlin fahren.", subEnd(weil6)).length >= 1);
eq("Perfekt in dass clause correct", diagnoseOrder("Ich glaube, dass er gestern Tennis gespielt hat.", subEnd(dass7)), []);
eq("separable in sub clause correct", diagnoseOrder("Ich bin müde, weil ich früh aufstehe.", subEnd(weil8)), []);
ok("separable split in sub clause flagged", diagnoseOrder("Ich bin müde, weil ich früh stehe auf.", subEnd(weil8)).length >= 1);

// ── order-table generation ──
const ord = TABLES.find((t) => t.mode === "order")!;
const items = generateSentences(ord, 7, 16);
ok("order table yields the requested number", items.length === 16);
ok("every order sentence passes its own checker", items.every((it) => it.accepted.every((a) => diagnoseOrder(a, { ...it.order!, variant: it.order!.variant }).length === 0 || a !== it.target)));
ok("target passes checker", items.every((it) => diagnoseOrder(it.target, it.order!).length === 0));
ok("target is accepted by checkSentence", items.every((it) => fullMarks(checkSentence(it.target, it.accepted))));
ok("order items carry a hint and english", items.every((it) => it.hint && it.en.endsWith(".")));
ok("all four variants occur", new Set(generateSentences(ord, 3, 40).map((i) => i.order!.variant)).size === 4);

// ── jumble ──
const s = "Am Wochenende spiele ich Tennis mit meinen Freunden.";
const j = jumble(s, 5);
eq("jumble is a permutation", [...j].sort(), [...tokens(s)].sort());
eq("jumble is deterministic", jumble(s, 5), jumble(s, 5));
ok("jumble differs from the original order", j.join(" ") !== tokens(s).join(" "));
ok("jumble differs across seeds (some)", [1, 2, 3, 4, 5, 6].some((k) => jumble(s, k).join(" ") !== j.join(" ")));
ok("jumble never returns the original for 20 seeds", Array.from({ length: 20 }, (_, k) => jumble("Ich bin müde", k + 1)).every((x) => x.join(" ") !== "Ich bin müde"));
eq("jumble strips punctuation", tokens("Weil ich krank bin, bleibe ich zu Hause."), ["Weil", "ich", "krank", "bin", "bleibe", "ich", "zu", "Hause"]);
eq("elided word stays one token", tokens("J'aime jouer au foot."), ["J'aime", "jouer", "au", "foot"]);
eq("single word jumble", jumble("Hola", 1), ["Hola"]);
eq("two-word jumble swaps", jumble("Hola amigo", 9), ["amigo", "Hola"]);
eq("identical words do not loop", jumble("no no", 1), ["no", "no"]);

// ── checkSentence ──
ok("exact answer full marks", fullMarks(checkSentence("Ich spiele gern Tennis.", ["Ich spiele gern Tennis."])));
ok("punctuation and capitals ignored", fullMarks(checkSentence("ich spiele gern tennis", ["Ich spiele gern Tennis."])));
ok("wrong word fails", !fullMarks(checkSentence("Ich spiele gern Fußball", ["Ich spiele gern Tennis."])));
ok("empty fails", !fullMarks(checkSentence("  ", ["Ich spiele gern Tennis."])));
ok("either accepted variant passes", fullMarks(checkSentence("Gestern habe ich Fußball gespielt", ["Ich habe gestern Fußball gespielt.", "Gestern habe ich Fußball gespielt."])));
ok("strict accents: missing accent fails", !fullMarks(checkSentence("Me gusta jugar al futbol", ["Me gusta jugar al fútbol."], { accents: "strict", lang: "es" })));
ok("warn accents: passes with a note", (() => { const r = checkSentence("Me gusta jugar al futbol", ["Me gusta jugar al fútbol."], { accents: "warn", lang: "es" }); return fullMarks(r) && r.feedback.some((f) => /accent/.test(f)); })());
ok("lenient accents: meaning-changing accent still fails (sí/si)", !fullMarks(checkSentence("si", ["sí"], { accents: "lenient", lang: "es" })));
ok("lenient accents: harmless accent passes", fullMarks(checkSentence("Estoy en la ciudad", ["Estoy en la ciudad."], { accents: "lenient", lang: "es" })));
ok("german ae fallback accepted", fullMarks(checkSentence("Ich bin muede", ["Ich bin müde."], { lang: "de" })));
ok("french elision apostrophe variants", fullMarks(checkSentence("J’aime nager", ["J'aime nager."], { lang: "fr" })));

console.log(`sentences.selftest: ${n - fails.length}/${n} checks passed`);
if (fails.length) { console.error(fails.join("\n")); process.exit(1); }
