// Run: server/node_modules/.bin/tsx features/learninghub/games/applied/core.selftest.ts
import { cleanAnswers, generateForm, GAME_IDS, ITEMS_PER_RUN, markForm, nextLevel, sanitize, type Answer, type GameId } from "./core";

let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.error("FAIL", m); } };

for (const gameId of GAME_IDS) {
  for (let level = 1 as const as number; level <= 5; level++) {
    const seed = 1000 + level * 7 + gameId.length;
    const items = generateForm(gameId, seed, level as 1 | 2 | 3 | 4 | 5);
    ok(items.length === ITEMS_PER_RUN, `${gameId} L${level}: item count`);
    ok(new Set(items.map((i) => i.id)).size === items.length, `${gameId} L${level}: unique ids`);
    const again = generateForm(gameId, seed, level as 1 | 2 | 3 | 4 | 5);
    ok(JSON.stringify(again) === JSON.stringify(items), `${gameId} L${level}: deterministic from seed`);

    const out = sanitize(items);
    ok(!("answer" in (out[0] as object)), `${gameId} L${level}: sanitize strips answer`);

    // A perfect run: answer every item correctly.
    const perfect: Answer[] = items.map((it) => ({ id: it.id, value: it.answer, ms: 4000 }));
    const cleanedPerfect = cleanAnswers(perfect, items.map((i) => i.id));
    ok(cleanedPerfect !== null, `${gameId} L${level}: cleanAnswers accepts a well-formed submission`);
    const resPerfect = markForm(items, cleanedPerfect);
    ok(resPerfect.score === items.length, `${gameId} L${level}: perfect answers score full marks (got ${resPerfect.score}/${items.length})`);

    // A dishonest client claiming all-correct via a fabricated result object still only gets marked from the real answers:
    // simulate "lie" by sending obviously wrong values and confirming the server-side mark disagrees.
    const allWrong: Answer[] = items.map((it) => ({ id: it.id, value: typeof it.answer === "number" ? it.answer + 999 : "___nope___", ms: 500 }));
    const resWrong = markForm(items, allWrong);
    ok(resWrong.score === 0, `${gameId} L${level}: all-wrong answers score zero (got ${resWrong.score})`);

    // Missing / malformed submissions are rejected outright.
    ok(cleanAnswers([{ id: items[0]!.id, value: 1, ms: 10 }], items.map((i) => i.id)) === null, `${gameId} L${level}: short submission rejected`);
    ok(cleanAnswers("not an array", items.map((i) => i.id)) === null, `${gameId} L${level}: garbage submission rejected`);
  }
}

// Level adaptation moves in the right direction and stays in [1,5].
ok(nextLevel(3, 8, 8) === 4, "nextLevel: strong run goes up");
ok(nextLevel(3, 1, 8) === 2, "nextLevel: weak run goes down");
ok(nextLevel(3, 6, 8) === 3, "nextLevel: mid run holds");
ok(nextLevel(5, 8, 8) === 5, "nextLevel: caps at 5");
ok(nextLevel(1, 0, 8) === 1, "nextLevel: floors at 1");

if (fails) { console.error(`${fails} FAILED`); process.exit(1); } else console.log(`OK: applied core (${GAME_IDS.length} games x 5 levels)`);
