import type { PadMsg } from "./callObject";
import type { Outbox } from "./controller";
import { TUTOR, newId, newState, nextV, sorted, type BoardState, type El, type Op, type Sender } from "./model";
import { applyAll, elementOps, MSG_BYTES } from "./reducer";
import { packBytes } from "./wireGuard";
import { compact, sliceBig, type BoardLink, type Peer } from "./sync";

// Student scratch pads ("workings"): each student has a PRIVATE page they write
// on, visible only to them and the tutor. Pads travel over targeted app messages
// (student → the tutor's session, tutor → that student's session) and are never
// broadcast; on receipt a student accepts pad traffic only from the tutor and the
// tutor only from students. The tutor holds every pad, sees them update live,
// annotates over them (own "T" elements the student can't edit), sets a question
// at the top, and can put a pad on the main board as a read-only page.
// Pure TypeScript (no React/DOM) so the routing rules are self-tested.

export const PAD_PAGE = "pad";
export interface PadInfo {
  cid: string; name: string; state: BoardState;
  /** The student pressed "Done ✓". */
  done: boolean;
  /** Last time anything arrived / last time they drew (ms epoch; 0 = never). */
  lastAt: number; lastStrokeAt: number;
  /** Bumps on every change (tiles redraw on it). */
  v: number;
}

export function newPadState(): BoardState {
  const s = newState();
  s.pages[0]!.id = PAD_PAGE;
  s.perm = { all: true, ids: [] }; // a pad is always open to its own student (edits limited to their own elements by the reducer)
  return s;
}

export interface PadRole { tutor: boolean; cid?: string; name: string }
export interface PadFrom { tutor: boolean; id: string; cid?: string; name: string }

export class PadHub {
  pads = new Map<string, PadInfo>();
  version = 0;
  private subs = new Set<() => void>();
  constructor(public role: PadRole) { if (!role.tutor) this.pad(role.cid ?? "me", role.name); }

  subscribe = (fn: () => void) => { this.subs.add(fn); return () => { this.subs.delete(fn); }; };
  private bump() { this.version++; this.subs.forEach((f) => f()); }

  pad(cid: string, name?: string): PadInfo {
    let p = this.pads.get(cid);
    if (!p) { p = { cid, name: name ?? "Student", state: newPadState(), done: false, lastAt: 0, lastStrokeAt: 0, v: 0 }; this.pads.set(cid, p); }
    else if (name && p.name !== name) p.name = name;
    return p;
  }
  /** A student's own pad. */
  get own(): PadInfo | undefined { return this.role.tutor ? undefined : this.pads.get(this.role.cid ?? "me"); }

  /** Handle a pad message. Enforces who may send to whom — anything else is dropped. */
  receive(from: PadFrom, msg: PadMsg): { accepted: boolean; changed: boolean; gaps: { id: string; have: number }[] } {
    const no = { accepted: false, changed: false, gaps: [] };
    let pad: PadInfo, who: Sender;
    if (this.role.tutor) {
      if (from.tutor) return no; // the tutor's own pads are never fed by another "tutor"
      const key = from.cid ?? from.id;
      pad = this.pad(key, from.name);
      who = { tutor: false, own: `c:${key}`, by: from.name, cid: key };
    } else {
      if (!from.tutor) return no; // a student never accepts pad traffic from another student
      pad = this.own ?? this.pad(this.role.cid ?? "me", this.role.name);
      who = TUTOR;
    }
    let changed = false, gaps: { id: string; have: number }[] = [];
    if (msg.ops?.length) {
      const r = applyAll(pad.state, msg.ops as Op[], who);
      changed = r.changed; gaps = r.gaps;
      const now = Date.now();
      pad.lastAt = now;
      if (this.role.tutor && (msg.ops as Op[]).some((o) => o.op === "add" || o.op === "pts" || o.op === "upd")) pad.lastStrokeAt = now;
    }
    if (typeof msg.done === "boolean" && this.role.tutor && pad.done !== msg.done) { pad.done = msg.done; changed = true; pad.lastAt = Date.now(); }
    if (changed) { pad.v++; this.bump(); }
    return { accepted: true, changed, gaps };
  }

  /** The student marks their work finished / not finished. */
  setDone(link: BoardLink | null, done: boolean) {
    const p = this.own;
    if (!p || this.role.tutor) return;
    p.done = done; p.v++; this.bump();
    link?.sendPad({ done }, link.tutorPeer()?.id);
  }

  /** Local edits made through a pad's controller also count as activity for the tutor's tiles. */
  touch(cid: string) { const p = this.pads.get(cid); if (p) { p.v++; p.lastAt = Date.now(); this.bump(); } }

  /** A peer showed up: the two ends of a pad swap what only they hold, so a refresh/rejoin never loses work. */
  onPeerSeen(link: BoardLink, peer: Peer) {
    if (this.role.tutor && !peer.tutor) {
      const pad = this.pads.get(peer.cid ?? peer.id);
      if (pad) sendPadOps(link, peer.id, snapshotOps(pad.state, (own) => own === "T"));
    } else if (!this.role.tutor && peer.tutor && this.own) {
      sendPadOps(link, peer.id, snapshotOps(this.own.state, (own) => own !== "T"));
      link.sendPad({ done: this.own.done, req: 1 }, peer.id);
    }
  }
  /** A student asked for its pad back (it refreshed): send the tutor's marks and the question. */
  onReq(link: BoardLink, peer: Peer) {
    if (!this.role.tutor || peer.tutor) return;
    const pad = this.pads.get(peer.cid ?? peer.id);
    if (pad) sendPadOps(link, peer.id, snapshotOps(pad.state, () => true));
  }

  // ── the tutor's actions ──
  /** Put a question (text and/or a picture) at the top of these students' pads, replacing the previous one. */
  setQuestion(link: BoardLink | null, cids: string[], q: { text: string; image?: { imageId: string; url?: string; w: number; h: number } }, names: Record<string, string> = {}) {
    if (!this.role.tutor) return;
    for (const cid of cids) {
      const pad = this.pad(cid, names[cid]);
      const old = [...pad.state.pages[0]!.els.values()].filter((e) => e.id.startsWith("q-")).map((e) => e.id);
      const ops: Op[] = [];
      if (old.length) ops.push({ op: "del", page: PAD_PAGE, ids: old, v: nextV() });
      ops.push(...questionOps(q));
      applyAll(pad.state, ops, TUTOR);
      pad.v++;
      const peer = link?.peerByCid(cid);
      if (link && peer) sendPadOps(link, peer.id, ops);
    }
    this.bump();
  }
  /** Remove a student's pad content the tutor no longer wants (e.g. a fresh start). */
  clearPad(link: BoardLink | null, cid: string) {
    const pad = this.pads.get(cid);
    if (!pad || !this.role.tutor) return;
    const op: Op = { op: "clear", page: PAD_PAGE, v: nextV() };
    applyAll(pad.state, [op], TUTOR); pad.v++; this.bump();
    const peer = link?.peerByCid(cid);
    if (link && peer) sendPadOps(link, peer.id, [op]);
  }
}

/** The elements of a pad as add-ops (no reset), filtered by owner. */
export function snapshotOps(state: BoardState, ownerFilter: (own: string) => boolean): Op[] {
  const ops: Op[] = [];
  for (const p of state.pages) for (const el of sorted(p)) if (ownerFilter(el.own)) ops.push(...elementOps(p.id, el));
  return ops;
}

/** Send ops to ONE session as pad messages, paced so a big pad doesn't flood the call. */
export function sendPadOps(link: BoardLink, to: string, ops: Op[]) {
  packBytes(sliceBig(compact(ops)), MSG_BYTES - 200).packs.forEach((pack, i) => setTimeout(() => link.sendPad({ ops: pack }, to), i * 14));
}

/** A question as tutor-owned elements ("q-…") at the top of a pad. */
export function questionOps(q: { text: string; image?: { imageId: string; url?: string; w: number; h: number } }): Op[] {
  const ops: Op[] = [];
  let y = -370;
  const v = nextV();
  if (q.image) {
    const s = Math.min(1, 460 / Math.max(q.image.w, q.image.h, 1));
    const w = Math.round(q.image.w * s), h = Math.round(q.image.h * s);
    ops.push({ op: "add", page: PAD_PAGE, el: { id: `q-${newId()}`, k: "image", own: "T", z: 1, v, imageId: q.image.imageId, url: q.image.url, x: -560, y, w, h } });
    y += h + 16;
  }
  const text = wrapPlain(q.text.trim(), 46);
  if (text) ops.push({ op: "add", page: PAD_PAGE, el: { id: `q-${newId()}`, k: "text", own: "T", z: 2, v: v + 1, x: -560, y, text, size: 30, bold: true, c: "#1b1f2a" } });
  return ops;
}
export function wrapPlain(text: string, width: number): string {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const w of para.split(/\s+/)) {
      if (line && (line + " " + w).length > width) { out.push(line); line = w; } else line = line ? `${line} ${w}` : w;
    }
    out.push(line);
  }
  return out.join("\n");
}

/** "Show to class": a pad as a read-only page on the main board (tutor-owned copies, a title on top). */
export function showToClassOps(pageId: string, pad: PadInfo, title: string): Op[] {
  const v = nextV();
  const ops: Op[] = [{ op: "padd", id: pageId, bg: "blank" }];
  const els = sorted(pad.state.pages[0]!);
  const copies: El[] = els.map((e, i) => ({ ...e, id: `${e.id}~${pageId}`, own: "T", v: v + i + 1, z: e.z, pts: e.pts?.slice() }));
  ops.push({ op: "add", page: pageId, el: { id: `t~${pageId}`, k: "text", own: "T", z: 0, v, x: -560, y: -430, text: title, size: 26, bold: true, c: "#2f6bd8" } });
  for (const el of copies) ops.push(...elementOps(pageId, el));
  return ops;
}

/** An Outbox that sends a pad's local ops to one session (never '*'). */
export class PadOutbox implements Outbox {
  private buf: Op[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(private link: () => BoardLink | null, private target: () => string | undefined, private onSent?: () => void) {}
  queue(...ops: Op[]) { this.buf.push(...ops); if (!this.timer) this.timer = setTimeout(() => this.flush(), 40); }
  flush() {
    this.timer = null;
    const ops = sliceBig(compact(this.buf)); this.buf = [];
    const link = this.link(), to = this.target();
    if (!ops.length) return;
    if (link && to) for (const pack of packBytes(ops, MSG_BYTES - 200).packs) link.sendPad({ ops: pack }, to);
    this.onSent?.();
  }
  setPtr() { /* no cursors on a pad */ }
  go() { /* single page */ }
  present() { /* n/a */ }
}
