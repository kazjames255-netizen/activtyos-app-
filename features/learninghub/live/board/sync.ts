import type { CallLike, CallParticipant, InboxMsg, PadMsg, WbMessage } from "./callObject";
import type { Outbox } from "./controller";
import { PT, sorted, type BoardState, type Op, type Sender } from "./model";
import { MSG_BYTES, SLICE_PTS, elementOps, snapshotOps } from "./reducer";
import { boardDigest, packBytes, sanitizeHello, sanitizeNeed, sanitizeOps, sanitizePage, sanitizePtr } from "./wireGuard";

// The board's wire layer over Daily app messages (each < ~4 KB). Outgoing ops are
// queued and flushed every ~40 ms (consecutive point batches and edits of the same
// element are merged first); a whole board is chunked for late joiners. Incoming
// messages are turned into (ops, sender) for the controller, which applies them
// through the permission-checking reducer. WHO a sender is comes from Daily's own
// participant record (`owner` = holds the tutor's meeting token), never from the
// message body — and so does a STUDENT's identity (their child id): it comes from the
// `user_id` our server signs into their meeting token, never from `hello`. Every
// inbound message is sanitised (wireGuard.ts) before it reaches the reducer.

export interface Peer { id: string; tutor: boolean; name: string; cid?: string }
export interface LinkHandlers {
  onOps(ops: Op[], who: Sender, fromId: string): { gaps: { id: string; have: number }[] };
  onPtr(peer: Peer, ptr: NonNullable<WbMessage["ptr"]>): void;
  onGo(page: string, peer: Peer): void;
  onPeers(): void;
  /** A private pad message from the tutor (to a student) or from a student (to the tutor). */
  onPad(msg: PadMsg, peer: Peer, fromId: string): void;
  /** A peer appeared (joined the room, or introduced itself): the pad layer swaps snapshots with it. */
  onPeerSeen(peer: Peer): void;
  /** The element to resend when a peer reports a gap in it. */
  find(page: string, id: string): { pts?: number[] } | undefined;
  /** The page the tutor is on (sent to a peer that joins late, so they land where the tutor is). */
  getPage?(): string | undefined;
  /** The call's network dropped (`false`) / came back (`true`). */
  onConn?(ok: boolean): void;
  /** Some of what we tried to send did not fit a message (text was shortened / an element could not be sent). */
  onOversize?(clipped: number, dropped: number): void;
}

/** The child id a peer's token vouches for (`c:<childId>`), or undefined. Only a non-owner can be a student. */
export function cidFromUserId(uid: unknown): string | undefined {
  if (typeof uid !== "string") return undefined;
  const m = /^c:([\s\S]{1,100})$/.exec(uid);
  return m ? m[1] : undefined;
}

/** The ops that bring a peer's board UP TO the tutor's without wiping anything they hold (no `reset`, no page-list overwrite). */
export function mergeOps(s: BoardState): Op[] {
  const ops: Op[] = [];
  for (const p of s.pages) { ops.push({ op: "padd", id: p.id, bg: p.bg }); ops.push({ op: "bg", page: p.id, bg: p.bg, v: 0 }); }
  ops.push({ op: "perm", all: s.perm.all, ids: s.perm.ids });
  for (const p of s.pages) for (const el of sorted(p)) ops.push(...elementOps(p.id, { ...el, url: el.url }));
  return ops;
}

/** Timings (mutable so the self-test can run the heartbeat in milliseconds). */
export const tuning = { digestMs: 10_000, resyncMinMs: 45_000 };
/** Most ops a non-tutor peer may send us per second (a snapshot from the tutor is exempt). */
const PEER_OPS_PER_SEC = 800;

const firstName = (n: string | undefined) => (n ?? "").trim().split(/\s+/)[0] ?? "";
const FLUSH_MS = 40;

/** Merge queued ops: contiguous `pts` of one stroke become one op; repeated `upd`s of one element keep the last. */
export function compact(ops: Op[]): Op[] {
  const out: Op[] = [];
  for (const op of ops) {
    const last = out[out.length - 1];
    if (op.op === "pts" && last && last.op === "pts" && last.id === op.id && last.page === op.page && last.from + last.pts.length / PT === op.from) {
      out[out.length - 1] = { ...last, pts: [...last.pts, ...op.pts] };
    } else if (op.op === "upd") {
      const i = out.findIndex((o) => o.op === "upd" && o.id === op.id && o.page === op.page);
      if (i >= 0) { const prev = out[i] as Extract<Op, { op: "upd" }>; out[i] = { ...op, patch: { ...prev.patch, ...op.patch } }; } else out.push(op);
    } else out.push(op);
  }
  return out;
}

/** Split any oversized `pts` op into slices that fit a message. */
export function sliceBig(ops: Op[]): Op[] {
  return ops.flatMap((op) => {
    if (op.op !== "pts" || op.pts.length / PT <= SLICE_PTS) return [op];
    const parts: Op[] = [];
    for (let i = 0; i * PT < op.pts.length; i += SLICE_PTS) parts.push({ ...op, from: op.from + i, pts: op.pts.slice(i * PT, (i + SLICE_PTS) * PT) });
    return parts;
  });
}

export class BoardLink implements Outbox {
  readonly peers = new Map<string, Peer>();
  private out: Op[] = [];
  private ptr: WbMessage["ptr"] | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private live = true;
  private listeners: [string, (e: never) => void][] = [];
  /** Tutor: the board is on the main stage (re-sent to anyone who joins late). */
  presenting = false;
  private pending = new Set<string>();
  private budget = new Map<string, { t: number; n: number }>();
  private lastResend = new Map<string, number>();
  private digestTimer: ReturnType<typeof setInterval> | null = null;
  private mismatch: string | null = null;
  private lastResync = 0;

  constructor(private call: CallLike, public self: { tutor: boolean; name: string; cid?: string }, private getState: () => BoardState, private h: LinkHandlers) {}

  /** Start listening + introduce ourselves (and ask the tutor for the board if we're a student). */
  start() {
    const c = this.call;
    const joined = (e: { participant?: { session_id?: string; local?: boolean } }) => {
      const p = e?.participant;
      if (!p || p.local || !p.session_id) return;
      this.refresh();
      const pr = this.peers.get(p.session_id);
      if (pr) this.h.onPeerSeen(pr);
      // A new arrival: say hello so they know who we are; the tutor also hands them the board, the layout and the page.
      this.raw({ wb: 1, hello: { name: this.self.name } }, p.session_id);
      if (this.self.tutor) this.sendState(p.session_id, 700);
      else if (pr?.tutor) this.sendOwnTo(p.session_id); // the tutor (re)appeared: hand back what only we hold
    };
    const left = (e: { participant?: { session_id?: string } }) => { const id = e?.participant?.session_id; if (id) { this.peers.delete(id); this.budget.delete(id); this.h.onPeers(); } };
    const st = (e: { participant?: { session_id?: string } }) => { void e; this.refresh(); };
    const net = (e: { event?: string }) => {
      if (e?.event === "interrupted") this.h.onConn?.(false);
      else if (e?.event === "connected") { this.h.onConn?.(true); this.resync(); }
    };
    this.on("participant-joined", joined as never);
    this.on("participant-left", left as never);
    this.on("participant-updated", st as never);
    this.on("network-connection", net as never);
    this.refresh();
    // Introduce ourselves once we're really in the room (the board can mount a moment before the join finishes).
    const intro = () => {
      this.refresh();
      this.raw({ wb: 1, hello: { name: this.self.name } });
      if (!this.self.tutor) this.raw({ wb: 1, req: 1 });
      else setTimeout(() => this.rebroadcast(), 500); // a tutor (re)joining: bring everyone already there up to the tutor's copy
    };
    let state = "";
    try { state = c.meetingState?.() ?? "joined-meeting"; } catch { state = ""; }
    if (state === "joined-meeting") intro(); else this.on("joined-meeting", intro as never);
    // The tutor's heartbeat: a tiny fingerprint of the board, so a peer that drifted (a dropped message, a phantom stroke) heals itself.
    if (this.self.tutor) this.digestTimer = setInterval(() => { if (this.live && this.peers.size) this.raw({ wb: 1, dg: boardDigest(this.getState()) }); }, tuning.digestMs);
  }
  stop() {
    this.live = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.digestTimer) clearInterval(this.digestTimer);
    for (const [ev, cb] of this.listeners) { try { this.call.off(ev, cb as never); } catch { /* gone */ } }
    this.listeners = [];
  }
  private on(ev: string, cb: (e: never) => void) { try { this.call.on(ev, cb); this.listeners.push([ev, cb]); } catch { /* call gone */ } }

  private refresh() {
    let parts: Record<string, CallParticipant> = {};
    try { parts = this.call.participants() ?? {}; } catch { return; }
    let changed = false;
    for (const p of Object.values(parts)) {
      if (p.local) continue;
      const cur = this.peers.get(p.session_id);
      const tutor = !!p.owner;
      // A student's child id comes from the token our server minted (`user_id`); whatever they claim in a message is ignored.
      const next: Peer = { id: p.session_id, tutor, name: firstName(p.user_name) || cur?.name || "Guest", cid: tutor ? undefined : cidFromUserId(p.user_id) };
      if (!cur || cur.tutor !== next.tutor || cur.name !== next.name || cur.cid !== next.cid) { this.peers.set(p.session_id, next); changed = true; }
    }
    if (changed) this.h.onPeers();
  }

  private peer(fromId: string): Peer {
    let p = this.peers.get(fromId);
    if (!p) { this.refresh(); p = this.peers.get(fromId); }
    return p ?? { id: fromId, tutor: false, name: "Guest" };
  }
  senderOf(fromId: string): Sender {
    const p = this.peer(fromId);
    return p.tutor ? { tutor: true, own: "T" } : { tutor: false, own: `c:${p.cid ?? p.id}`, by: p.name, cid: p.cid };
  }

  // ── incoming ──
  /** A per-peer flood limit (the tutor is exempt). */
  private allow(fromId: string, tutor: boolean, cost: number): boolean {
    if (tutor) return true;
    const now = Date.now();
    let b = this.budget.get(fromId);
    if (!b || now - b.t > 1000) { b = { t: now, n: 0 }; this.budget.set(fromId, b); }
    b.n += cost;
    return b.n <= PEER_OPS_PER_SEC;
  }
  receive(m: InboxMsg) {
    if (!this.live) return;
    const { fromId } = m;
    const d = m.data as WbMessage | undefined;
    if (!d || typeof d !== "object" || d.wb !== 1 || typeof fromId !== "string") return;
    if (d.hello) {
      const hello = sanitizeHello(d.hello);
      if (hello) {
        const p = this.peer(fromId);
        // name: Daily's own record wins; cid: ONLY from the token (already in `p`) — hello.cid is ignored on purpose.
        const seen: Peer = { ...p, name: p.name && p.name !== "Guest" ? p.name : firstName(hello.name) || p.name };
        this.peers.set(fromId, seen);
        this.h.onPeers();
        this.h.onPeerSeen(seen);
      }
    }
    if (d.req && this.self.tutor) this.sendState(fromId, 0);
    if (d.need) { const need = sanitizeNeed(d.need); if (need && this.allow(fromId, this.peer(fromId).tutor, 160)) this.resend(fromId, need); }
    if (Array.isArray(d.ops) && d.ops.length) {
      const sender = this.senderOf(fromId);
      const ops = sanitizeOps(d.ops, sender);
      if (ops.length && this.allow(fromId, sender.tutor, ops.length)) {
        const res = this.h.onOps(ops, sender, fromId);
        for (const g of res.gaps) this.raw({ wb: 1, need: { page: pageOfGap(ops, g.id), id: g.id, have: g.have } }, fromId);
      }
    }
    if (d.pad && typeof d.pad === "object") {
      const peer = this.peer(fromId);
      const ops = d.pad.ops === undefined ? undefined : sanitizeOps(d.pad.ops, peer);
      if (this.allow(fromId, peer.tutor, ops?.length ?? 1)) {
        this.h.onPad({ ...(ops ? { ops } : {}), ...(typeof d.pad.done === "boolean" ? { done: d.pad.done } : {}), ...(d.pad.req ? { req: 1 as const } : {}) }, peer, fromId);
      }
    }
    if (d.ptr) { const ptr = sanitizePtr(d.ptr); if (ptr) this.h.onPtr(this.peer(fromId), ptr); }
    if (d.go !== undefined && this.peer(fromId).tutor) { const g = sanitizePage(d.go); if (g) this.h.onGo(g, this.peer(fromId)); }
    if (d.dg && !this.self.tutor && this.peer(fromId).tutor) this.onDigest(fromId, d.dg);
  }

  /** A stroke's missing points, from `have` on. `have` is peer-supplied: clamped, rate-limited and capped. */
  private resend(to: string, need: { page: string; id: string; have: number }) {
    const el = this.h.find(need.page, need.id);
    if (!el?.pts) return;
    const total = Math.floor(el.pts.length / PT);
    const have = Math.min(need.have, total);
    if (have >= total) return;
    const key = `${to}|${need.id}`, now = Date.now();
    if (now - (this.lastResend.get(key) ?? 0) < 400) return;
    this.lastResend.set(key, now);
    if (this.lastResend.size > 500) this.lastResend.clear();
    const ops: Op[] = [];
    for (let i = have; i < total && ops.length < 200; i += SLICE_PTS) ops.push({ op: "pts", page: need.page, id: need.id, from: i, pts: el.pts.slice(i * PT, (i + SLICE_PTS) * PT) });
    this.sendPacked(ops, to);
  }

  /** Student: compare the tutor's fingerprint with ours. The SAME mismatch twice running (and not just because we are mid-drawing) → ask for a fresh copy. */
  private onDigest(tutorId: string, dg: { n?: unknown; h?: unknown }) {
    if (typeof dg.n !== "number" || typeof dg.h !== "number") return;
    const mine = boardDigest(this.getState());
    if (mine.n === dg.n && mine.h === dg.h) { this.mismatch = null; return; }
    const sig = `${mine.n}:${mine.h}|${dg.n}:${dg.h}`;
    const now = Date.now();
    if (this.mismatch === sig && now - this.lastResync > tuning.resyncMinMs) { this.mismatch = null; this.lastResync = now; this.raw({ wb: 1, req: 1 }, tutorId); }
    else this.mismatch = sig;
  }

  // ── outgoing ──
  queue(...ops: Op[]) { this.out.push(...ops); this.schedule(); }
  setPtr(p: NonNullable<WbMessage["ptr"]>) { this.ptr = p; this.schedule(); }
  go(page: string) { this.raw({ wb: 1, go: page }); }
  present(on: boolean) { this.presenting = on; this.raw({ wb: 1, present: on }); }
  tutorPeer(): Peer | undefined { for (const p of this.peers.values()) if (p.tutor) return p; return undefined; }
  peerByCid(cid: string): Peer | undefined { for (const p of this.peers.values()) if (!p.tutor && p.cid === cid) return p; return undefined; }
  /** A private pad message. NEVER broadcast: it is addressed to exactly one session or dropped. */
  sendPad(msg: PadMsg, to: string | undefined) { if (!to || to === "*") return; this.raw({ wb: 1, pad: msg }, to); }
  private schedule() { if (!this.timer && this.live) this.timer = setTimeout(() => this.flush(), FLUSH_MS); }
  flush() {
    this.timer = null;
    if (!this.live) return;
    const ops = sliceBig(compact(this.out)); this.out = [];
    const ptr = this.ptr; this.ptr = null;
    const { packs, clipped, dropped } = packBytes(ops, MSG_BYTES - 200);
    if (clipped || dropped) this.h.onOversize?.(clipped, dropped);
    if (!packs.length && ptr) this.raw({ wb: 1, ptr });
    packs.forEach((p, i) => this.raw({ wb: 1, ops: p, ...(i === packs.length - 1 && ptr ? { ptr } : {}) }));
  }

  /**
   * Tutor: bring ONE peer up to date — the board (a full copy, starting with a `reset`, because a
   * peer that asks or just arrived wants exactly the tutor's copy), then whether the board is being
   * presented and which page the tutor is on. Requests that arrive while one is already queued are folded in.
   */
  private sendState(to: string, delay: number) {
    if (!this.self.tutor || !this.live || this.pending.has(to)) return;
    this.pending.add(to);
    setTimeout(() => {
      this.pending.delete(to);
      if (!this.live) return;
      if (this.presenting) this.raw({ wb: 1, present: true }, to);
      const ms = this.sendSnapshot(to);
      const page = this.h.getPage?.();
      if (page) setTimeout(() => { if (this.live) this.raw({ wb: 1, go: page }, to); }, ms + 40);
    }, delay);
  }
  /** Tutor (re)joined the call: everyone already there gets the tutor's copy MERGED in — never a `reset`, so nothing a student drew meanwhile is wiped by a stale saved copy. */
  private rebroadcast() {
    if (!this.self.tutor || !this.live) return;
    if (this.presenting) this.raw({ wb: 1, present: true });
    const ms = this.sendSnapshot(undefined, "merge");
    const page = this.h.getPage?.();
    if (page) setTimeout(() => { if (this.live) this.raw({ wb: 1, go: page }); }, ms + 40);
  }
  /** After a dropped connection: a student hands its own drawings to the tutor, then asks for the current board; the tutor merges its copy back in for everyone. */
  private resync() {
    if (!this.live) return;
    if (this.self.tutor) { this.rebroadcast(); return; }
    const t = this.tutorPeer();
    const now = Date.now();
    if (!t || now - this.lastResync < 3000) return;
    this.lastResync = now;
    this.sendOwnTo(t.id);
    setTimeout(() => { if (this.live) this.raw({ wb: 1, req: 1 }, t.id); }, 300);
  }
  /** A student re-sends what only it holds (its own drawings) to the tutor: adds are idempotent, so this only fills gaps. */
  private sendOwnTo(tutorId: string) {
    if (this.self.tutor || !this.self.cid) return;
    const own = `c:${this.self.cid}`;
    const ops: Op[] = [];
    for (const p of this.getState().pages) for (const el of sorted(p)) if (el.own === own) ops.push(...elementOps(p.id, el));
    if (ops.length) this.sendPacked(sliceBig(compact(ops)), tutorId);
  }
  /** Send the whole board (tutor only), paced so a big one doesn't flood the call. Returns how long the pacing takes (ms). */
  sendSnapshot(to?: string, mode: "full" | "merge" = "full"): number {
    if (!this.self.tutor || !this.live) return 0;
    const st = this.getState();
    return this.sendPacked(mode === "merge" ? mergeOps(st) : snapshotOps(st), to);
  }
  private sendPacked(ops: Op[], to?: string): number {
    const { packs } = packBytes(ops, MSG_BYTES - 200);
    packs.forEach((p, i) => setTimeout(() => { if (this.live) this.raw({ wb: 1, ops: p }, to); }, i * 14));
    return packs.length * 14;
  }
  private raw(msg: WbMessage, to?: string) {
    try {
      if (this.call.meetingState && this.call.meetingState() !== "joined-meeting") return;
      this.call.sendAppMessage(msg, to ?? "*");
    } catch { /* not connected right now — the periodic autosave + the next sync heal it */ }
  }
}

/** Which page an element belongs to (from the ops that reported the gap). */
function pageOfGap(ops: Op[], id: string): string {
  for (const o of ops) if (o.op === "pts" && o.id === id) return o.page;
  return "p1";
}
