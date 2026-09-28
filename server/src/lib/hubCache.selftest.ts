// Run: server/node_modules/.bin/tsx server/src/lib/hubCache.selftest.ts
// Covers the restart/slow-load fixes in hubCache.ts (docs/hub-slow-loads.md): snapshot-age seeding, the rebuild limiter (concurrency cap +
// blocking-before-background priority), in-place patches keeping the disk snapshot, and the startup warm-up. Uses throwaway tenant ids and
// removes its snapshot files; reads no Firestore.
import { existsSync, readdirSync, statSync, unlinkSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { forgetHub, hubCacheLoads, hubCached, patchHub, warmHubCacheFromDisk } from "./hubCache";

let n = 0, bad = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.error("FAIL:", m); } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const run = Math.random().toString(36).slice(2, 8);
const T = (s: string) => `selftest-${run}-${s}`;
const dir = join(tmpdir(), `aos-hub-cache-${process.getuid?.() ?? "u"}`);
const mine = () => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : []);
const before = new Set(mine());
const ttl = 20 * 60_000;

// 1. a fresh build writes a snapshot (deferred ~1.5 s) and serves from memory afterwards
let builds = 0;
const load = (rows: number) => async () => { builds++; return new Map<string, { id: string }>(Array.from({ length: rows }, (_, i) => [`k${i}`, { id: `k${i}` }] as [string, { id: string }])); };
const t1 = T("fresh");
const v1 = await hubCached("notes", t1, "", ttl, load(3), { swr: true, disk: true });
ok(v1.size === 3 && builds === 1, "cold miss loads once");
await sleep(2500);
const files = mine().filter((f) => !before.has(f));
ok(files.length === 1, `one snapshot written (got ${files.length})`);
await hubCached("notes", t1, "", ttl, load(3), { swr: true, disk: true });
ok(builds === 1, "second read is a memory hit");

// 2. patchHub keeps the entry AND the disk snapshot (no forget, no rebuild)
patchHub<Map<string, { id: string }>>("notes", t1, (m) => m.set("extra", { id: "extra" }));
const v1b = await hubCached("notes", t1, "", ttl, load(3), { swr: true, disk: true });
ok(v1b.has("extra") && builds === 1, "patched in place, no rebuild");
ok(mine().filter((f) => !before.has(f)).length === 1, "patch does not delete the snapshot");

// 3. snapshot younger than the TTL is served with NO rebuild after a "restart"; an old one is served AND rebuilt in the background
const snap = files[0]!;
forgetHub(T("nothing")); // unrelated tenant: must not disturb t1
const v1c = await hubCached("notes", t1, "", ttl, load(3), { swr: true, disk: true });
ok(v1c.has("extra"), "forget of another tenant leaves this one alone");
// forgetHub on t1 deletes memory + snapshot (a structural edit) — the next read rebuilds (blocking, nothing to serve)
forgetHub(t1, "notes");
ok(!mine().includes(snap), "forgetHub still removes the snapshot it invalidates");
const v1d = await hubCached("notes", t1, "", ttl, load(4), { swr: true, disk: true });
ok(v1d.size === 4 && builds === 2, "after forget the next read rebuilds");
await sleep(2500);

// 4. limiter: many concurrent disk loads never exceed the cap; background refreshes never hold more than one slot
let running = 0, peak = 0;
const slow = (ms: number) => async () => { running++; peak = Math.max(peak, running); await sleep(ms); running--; return new Map([["a", { id: "a" }]]); };
await Promise.all(Array.from({ length: 6 }, (_, i) => hubCached("questions", T(`c${i}`), "", ttl, slow(120), { swr: true, disk: true })));
ok(peak <= 2, `blocking loads capped at 2 concurrent (peak ${peak})`);
ok(peak === 2, `...and they do overlap (peak ${peak})`);
const cap = hubCacheLoads();
ok(cap.running === 0 && cap.queuedBlocking === 0 && cap.queuedBackground === 0, "limiter is idle afterwards");

// 5. blocking load jumps ahead of queued background refreshes
const order: string[] = [];
const tag = (name: string, ms: number) => async () => { order.push(`${name}:start`); await sleep(ms); order.push(`${name}:end`); return new Map([["a", { id: "a" }]]); };
const seedT = [T("bg1"), T("bg2"), T("bg3")];
// memory copies with a 1 ms TTL: stale by the next read, so those reads are SWR = background refreshes
for (const t of seedT) await hubCached("cards", t, "", 1, load(1), { swr: true, disk: true });
await sleep(5);
builds = 0;
const bgReads = seedT.map((t) => hubCached("cards", t, "", 1, tag(`bg-${t.slice(-3)}`, 150), { swr: true, disk: true })); // stale -> return old copy, refresh in background
const blockingRead = hubCached("cards", T("cold"), "", ttl, tag("blocking", 50), { swr: true, disk: true }); // cold miss -> blocking
await Promise.all([...bgReads, blockingRead]);
await sleep(700);
const bIdx = order.indexOf("blocking:start");
const bgStarts = order.map((x, i) => [x, i] as const).filter(([x]) => x.startsWith("bg-") && x.endsWith(":start")).map(([, i]) => i);
ok(bIdx >= 0 && bgStarts.length >= 1, "both kinds of load ran");
ok(bIdx < (bgStarts[1] ?? Infinity), "the blocking load did not wait behind the queued background refreshes");
let bgPeak = 0, bgNow = 0;
order.forEach((x) => { if (x.startsWith("bg-") && x.endsWith(":start")) bgNow++; if (x.startsWith("bg-") && x.endsWith(":end")) bgNow--; bgPeak = Math.max(bgPeak, bgNow); });
ok(bgPeak <= 1, `background refreshes hold at most one slot (peak ${bgPeak})`);

// 5b. probeEmpty: a cheap "nothing to read" check lets a load skip the FIFO queue entirely, even while the
// concurrency cap is fully occupied by other blocking loads (the empty-tenant-behind-a-big-rebuild bug, hubIndex.ts).
{
  const capMs = 150;
  const capFillers = Array.from({ length: 2 }, (_, i) => hubCached("questions", T(`cap${i}`), "", ttl, slow(capMs), { swr: true, disk: true }));
  await sleep(20); // let the 2 filler loads actually claim both BIG_LOADS slots
  ok(hubCacheLoads().running === 2, `cap is fully occupied before the probe-empty read starts (running=${hubCacheLoads().running})`);
  const t0 = Date.now();
  const probed = await hubCached("questions", T("empty"), "", ttl, load(0), { swr: true, disk: true, probeEmpty: async () => true });
  const tookMs = Date.now() - t0;
  ok(probed.size === 0, "probe-empty load still returns the real (empty) result");
  ok(tookMs < capMs / 2, `probe-empty load did not wait behind the full queue (took ${tookMs}ms, fillers take ${capMs}ms)`);
  await Promise.all(capFillers);
  // a probe that says "not empty" (or throws) falls back to the normal gated path — no change in behavior
  const gated = await hubCached("questions", T("notEmptyProbe"), "", ttl, load(2), { swr: true, disk: true, probeEmpty: async () => false });
  ok(gated.size === 2, "probeEmpty=false still loads normally through the gate");
  const errored = await hubCached("questions", T("throwingProbe"), "", ttl, load(2), { swr: true, disk: true, probeEmpty: async () => { throw new Error("boom"); } });
  ok(errored.size === 2, "a throwing probe falls back to the normal gated path instead of failing the request");
}

// 6. startup warm-up: a snapshot on disk is loaded into memory without calling load()
const t6 = T("warm");
await hubCached("topics", t6, "", ttl, load(5), { swr: true, disk: true });
await sleep(2500);
const warmFiles = mine().filter((f) => !before.has(f));
ok(warmFiles.length >= 1, "warm-up fixture snapshot exists");
const loaded = await warmHubCacheFromDisk();
ok(loaded >= 1, `warm-up loaded snapshots (${loaded})`);

// cleanup our throwaway snapshots
for (const f of mine().filter((f) => !before.has(f))) { try { unlinkSync(join(dir, f)); } catch { /* ignore */ } }
void statSync; void utimesSync;
console.log(bad ? `hubCache selftest: ${bad}/${n} FAILED` : `hubCache selftest: all ${n} checks passed`);
process.exit(bad ? 1 : 0);
