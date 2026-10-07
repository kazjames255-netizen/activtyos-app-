// Seeded random-action fuzzer for listings and bookings. Drives the REAL API on the local stack (test accounts only, Stripe TEST keys),
// takes a snapshot after every action and checks every invariant. A failure prints the seed and the shortest action trace that reproduces it.
//
//   server/node_modules/.bin/tsx server/tools/assure/fuzz.ts --seeds 50                  # seeds 1..50, all areas
//   server/node_modules/.bin/tsx server/tools/assure/fuzz.ts --seed 17                   # replay one seed
//   server/node_modules/.bin/tsx server/tools/assure/fuzz.ts --seeds 20 --area waitlist,money
//   server/node_modules/.bin/tsx server/tools/assure/fuzz.ts --seeds 20 --inject-bug capacity   # NEGATIVE CONTROL: must report FUZZ CAUGHT INJECTED BUG
//   server/node_modules/.bin/tsx server/tools/assure/fuzz.ts --list-areas
// Options: --steps N (default 30)  --from S (first seed, default 1)  --concurrency N (default 3)  --shrink  --strict-5xx  --verbose
// Exit: 0 clean (or injected bug caught), 1 violations (or injected bug missed), 2 inconclusive (harness errors).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { db } from "../../src/firebase";
import { takeSnapshot } from "./snapshot";
import type { ActionCtx, ActionDef, Invariant, Snapshot, Violation } from "./types";
import { assertTestEmail, buildWorld, mulberry32, sleep, type World } from "./world";

// ---------- args ----------
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string, d?: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const SEEDS = Number(opt("seeds", "50")); const FROM = Number(opt("from", "1")); const ONE = opt("seed");
const STEPS = Number(opt("steps", "30")); const CONC = Math.max(1, Number(opt("concurrency", "3")));
const AREA = (opt("area", "all") ?? "all").split(",").map((s) => s.trim()).filter(Boolean);
const INJECT = opt("inject-bug"); const SHRINK = flag("shrink"); const VERBOSE = flag("verbose");

// ---------- kit loading ----------
interface Kit { checkAll: (s: Snapshot) => Violation[]; real: boolean }
async function loadKit(): Promise<Kit> {
  const f = path.join(import.meta.dirname, "invariants.ts");
  if (fs.existsSync(f)) {
    const m = await import(pathToFileURL(f).href);
    const check = (m.checkAll ?? m.default?.checkAll) as ((s: Snapshot) => Violation[]) | undefined;
    const list = (m.INVARIANTS ?? m.default?.INVARIANTS) as Invariant[] | undefined;
    if (check) return { checkAll: check, real: true };
    if (list) return { checkAll: (s) => list.flatMap((i) => i.check(s)), real: true };
  }
  console.warn("[fuzz] invariants.ts not found: using the harness's own capacity rule only");
  return { checkAll: () => [], real: false };
}
/** The harness's own always-on safety net, independent of invariants.ts: no day or run may hold more places than its capacity. */
function builtInChecks(s: Snapshot): Violation[] {
  const out: Violation[] = [];
  for (const b of s.blocks) {
    const counts = (b as any).dayCounts ?? b.counts ?? {};
    if (b.capacityScope === "day") for (const [d, n] of Object.entries(counts as Record<string, number>)) if (n > b.capacity) out.push({ rule: "fz-over-capacity", severity: "capacity", message: `block ${b.id} holds ${n} places on ${d} but its day capacity is ${b.capacity}` });
    const booked = (b as any).bookedCount as number | undefined;
    if (b.capacityScope !== "day" && booked !== undefined && booked > b.capacity) out.push({ rule: "fz-over-capacity", severity: "capacity", message: `block ${b.id} holds ${booked} places but its capacity is ${b.capacity}` });
  }
  return out;
}

async function loadActions(): Promise<ActionDef[]> {
  const dir = path.join(import.meta.dirname, "actions");
  const out: ActionDef[] = [];
  for (const f of fs.readdirSync(dir).filter((x) => /\.(ts|mts|js)$/.test(x) && !x.startsWith("_")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    const list = (m.ACTIONS ?? m.default?.ACTIONS) as ActionDef[] | undefined;
    if (Array.isArray(list)) out.push(...list);
  }
  return out;
}

// ---------- one seed ----------
interface TraceStep { i: number; action: string; summary: string; skipped?: boolean }
interface SeedResult { seed: number; ok: boolean; harnessError?: string; violations: Violation[]; trace: TraceStep[]; failedAt?: number; caught?: boolean; warnings: string[]; ms: number }

function filterSnapshot(s: Snapshot, w: World): Snapshot {
  const lids = w.listingIds;
  const bookings = s.bookings.filter((b) => b.listingId && lids.has(b.listingId));
  const refs = new Set(bookings.map((b) => b.ref));
  const titles = [...w.listings.map((l) => l.title), ...(((w as any).__extraTitles as string[] | undefined) ?? [])];
  return {
    ...s,
    bookings,
    blocks: s.blocks.filter((b) => lids.has(b.listingId)),
    listings: s.listings.filter((l) => lids.has(l.id)),
    payments: s.payments.filter((p) => p.refs.some((r) => refs.has(r))),
    emailsSent: (s.emailsSent ?? []).filter((e) => titles.some((t) => e.subject.includes(t))),
    ...((s as any).walletEntries ? { walletEntries: (s as any).walletEntries.filter((e: any) => !e.ref || refs.has(e.ref)) } : {}),
  } as Snapshot;
}

async function runSeed(seed: number, kit: Kit, actions: ActionDef[], o: { steps: number; skip?: Set<number>; stopAfter?: number }): Promise<SeedResult> {
  const t0 = Date.now();
  const res: SeedResult = { seed, ok: true, violations: [], trace: [], warnings: [], ms: 0 };
  let w: World | undefined;
  try {
    const rng = mulberry32(seed * 7919 + 13);
    w = await buildWorld(seed, rng);
    assertTestEmail(w.op.email);
    const ctx: ActionCtx = { rng: w.rng, api: (m, u, b, as) => w!.api(m, u, b, as), world: w, log: (m) => VERBOSE && console.log(`   [${seed}] ${m}`) };
    const pool = actions.filter((a) => AREA.includes("all") || AREA.includes(a.area));
    if (!pool.length) throw new Error(`no actions for area ${AREA.join(",")}`);
    const injectAt = INJECT ? 3 : -1;
    const steps = Math.min(o.steps, o.stopAfter ?? o.steps);
    for (let i = 0; i < steps; i++) {
      // choose (consumes rng even when the step is skipped, so a replay with a skipped step keeps later choices the same)
      const ok = pool.filter((a) => { try { return a.applicable(ctx); } catch { return false; } });
      const bag = (ok.length ? ok : pool);
      const total = bag.reduce((n, a) => n + a.weight, 0);
      let r = w.rng() * total; let def = bag[bag.length - 1];
      for (const a of bag) { r -= a.weight; if (r <= 0) { def = a; break; } }
      if (o.skip?.has(i)) { res.trace.push({ i, action: def.id, summary: "(skipped)", skipped: true }); continue; }
      let summary = "";
      try { summary = (await def.run(ctx)).summary; }
      catch (e) { res.harnessError = `step ${i} ${def.id}: ${(e as Error).message.slice(0, 200)}`; res.trace.push({ i, action: def.id, summary: "HARNESS ERROR " + (e as Error).message.slice(0, 120) }); break; }
      res.trace.push({ i, action: def.id, summary });
      if (VERBOSE) console.log(`   [${seed}] #${i} ${def.id}: ${summary}`);

      if (INJECT === "capacity" && i === injectAt) await injectCapacityBug(w); // NEGATIVE CONTROL
      await sleep(350); // let fire-and-forget triggers (waitlist offers, emails) land before we look
      const found: Violation[] = [];
      for (const f of w.take5xx()) if (!(f.status === 503 && !flag("strict-5xx"))) found.push({ rule: "no-5xx", severity: "state", message: `${f.method} ${f.url} answered ${f.status} twice in a row: ${f.body}` });
      for (const v of ((w as any).__violations ?? []).splice(0)) found.push(v); // violations an action itself detected (privacy leaks, wrong refusals)
      const snap = filterSnapshot(await takeSnapshot(w.op.tenantId), w);
      const seen = new Set<string>();
      for (const v of [...kit.checkAll(snap), ...builtInChecks(snap)]) { const k = v.rule + v.message; if (!seen.has(k)) { seen.add(k); found.push(v); } }
      if (found.length) { res.ok = false; res.violations = found; res.failedAt = i; break; }
    }
    res.warnings = w.warnings.slice();
  } catch (e) {
    res.harnessError = `setup: ${(e as Error).message.slice(0, 240)}`;
  } finally { w?.release(); res.ms = Date.now() - t0; }
  return res;
}

/** NEGATIVE CONTROL: corrupt one block's counts directly in Firestore, so a working fuzzer must notice. */
async function injectCapacityBug(w: World) {
  const l = w.listings[0]; const b = (await db.collection("blocks").where("listingId", "==", l.id).get()).docs[0];
  if (!b) throw new Error("inject: no block to corrupt");
  const x = b.data() as any; const d = (x.sessions?.[0]?.date as string) ?? Object.keys(x.dayCounts ?? {})[0];
  await b.ref.update({ [`dayCounts.${d}`]: (x.capacity ?? 3) + 50, bookedCount: (x.bookedCount ?? 0) + 50 });
}

// ---------- shrink ----------
async function shrink(first: SeedResult, kit: Kit, actions: ActionDef[]): Promise<TraceStep[]> {
  const want = first.violations[0].rule; const upTo = (first.failedAt ?? STEPS - 1) + 1;
  const skip = new Set<number>(); let budget = 24;
  for (let i = upTo - 2; i >= 0 && budget > 0; i--) { // try dropping each earlier step, newest first
    const trial = new Set(skip); trial.add(i); budget--;
    const r = await runSeed(first.seed, kit, actions, { steps: upTo, skip: trial, stopAfter: upTo });
    if (!r.ok && r.violations.some((v) => v.rule === want)) skip.add(i);
  }
  return first.trace.filter((t) => t.i < upTo && !skip.has(t.i));
}

// ---------- main ----------
(async () => {
  const actions = await loadActions();
  const areas = [...new Set(actions.map((a) => a.area))].sort();
  if (flag("list-areas")) { console.log(`AREAS ${areas.length}: ${areas.join(", ")}`); process.exit(0); }
  if (!actions.length) { console.error("no actions found in server/tools/assure/actions"); process.exit(2); }
  const kit = await loadKit();
  const seeds = ONE ? [Number(ONE)] : Array.from({ length: SEEDS }, (_, i) => FROM + i);
  console.log(`fuzz: ${seeds.length} seed(s), ${INJECT ? 1 + 3 : STEPS} steps max, areas=${AREA.join(",")} (${actions.length} actions in ${areas.length} areas), invariants=${kit.real ? "invariants.ts" : "harness-only"}, concurrency=${CONC}`);
  const results: SeedResult[] = [];
  let next = 0;
  const worker = async () => {
    while (next < seeds.length) {
      const seed = seeds[next++];
      let r = await runSeed(seed, kit, actions, { steps: INJECT ? 6 : STEPS });
      if (r.harnessError && !INJECT) { await sleep(2000); const again = await runSeed(seed, kit, actions, { steps: INJECT ? 6 : STEPS }); if (!again.harnessError || again.ok === false) r = again; }
      results.push(r);
      process.stdout.write(r.harnessError ? "h" : r.ok ? "." : "x");
      if (VERBOSE) console.log(`\n seed ${seed}: ${r.harnessError ? "HARNESS ERROR " + r.harnessError : r.ok ? "clean" : r.violations[0]?.rule} in ${(r.ms / 1000).toFixed(1)}s`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONC, seeds.length) }, worker));
  process.stdout.write("\n");
  results.sort((a, b) => a.seed - b.seed);

  const bad = results.filter((r) => !r.ok);
  const harness = results.filter((r) => r.harnessError);
  const warnings = results.reduce((n, r) => n + r.warnings.length, 0);

  if (INJECT) {
    const caught = results.filter((r) => r.violations.some((v) => /capacity|count/i.test(v.rule + v.message)));
    if (caught.length === results.length && results.length > 0) { console.log(`FUZZ CAUGHT INJECTED BUG (${caught.length}/${results.length} seeds flagged: ${[...new Set(caught.flatMap((r) => r.violations.map((v) => v.rule)))].join(", ")})`); process.exit(0); }
    console.log(`FUZZ MISSED INJECTED BUG: only ${caught.length}/${results.length} seeds noticed (harness errors: ${harness.length})`);
    for (const r of results.filter((x) => !caught.includes(x)).slice(0, 5)) console.log(`  seed ${r.seed}: ${r.harnessError ?? "no violation reported"}`);
    process.exit(1);
  }

  const real = bad.filter((r) => !r.harnessError || r.violations.length);
  for (const r of real) {
    console.log(`\nVIOLATION seed=${r.seed} step=${r.failedAt}`);
    for (const v of r.violations.slice(0, 6)) console.log(`  [${v.severity}] ${v.rule}: ${v.message}${v.refs?.length ? ` (refs ${v.refs.join(",")})` : ""}`);
    let trace = r.trace.filter((t) => t.i <= (r.failedAt ?? 999));
    if (SHRINK) { console.log("  shrinking ..."); trace = await shrink(r, kit, actions); }
    console.log(`  replay: server/node_modules/.bin/tsx server/tools/assure/fuzz.ts --seed ${r.seed} --steps ${(r.failedAt ?? 0) + 1}${AREA.includes("all") ? "" : ` --area ${AREA.join(",")}`}`);
    console.log(`  ${SHRINK ? "shortest" : "full"} trace:`); for (const t of trace) console.log(`    ${String(t.i + 1).padStart(2)}. ${t.action}: ${t.summary}`);
  }
  for (const r of harness.filter((x) => !x.violations.length)) console.log(`\nHARNESS ERROR seed=${r.seed}: ${r.harnessError}`);
  const secs = results.reduce((n, r) => n + r.ms, 0) / 1000;
  console.log(`\nsummary: ${results.length} seeds, ${real.length} with violations, ${harness.filter((x) => !x.violations.length).length} harness errors, ${warnings} transient 5xx retried ok, ${(secs / Math.max(1, results.length)).toFixed(1)}s per seed`);
  if (real.length) { console.log(`FUZZ FOUND ${real.length} VIOLATING SEED(S): ${real.map((r) => r.seed).join(", ")}`); process.exit(1); }
  if (harness.length) { console.log(`FUZZ INCONCLUSIVE harness-errors=${harness.length} seeds=${results.length}`); process.exit(2); }
  console.log(`FUZZ CLEAN seeds=${results.length}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(2); });
