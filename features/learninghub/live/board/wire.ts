import type { BoardState, Op, Sender } from "./model";
import type { PadHub } from "./pads";
import type { BoardLink, LinkHandlers, Peer } from "./sync";
import type { WbMessage } from "./callObject";

// The glue between the call link, the board and the pad layer — kept apart from
// React so the exact same routing runs in the app and in the network self-test.

export interface BoardSink {
  state: BoardState;
  onRemoteOps(ops: Op[], who: Sender): { gaps: { id: string; have: number }[] };
  onRemotePtr(peer: Peer, p: NonNullable<WbMessage["ptr"]>): void;
  onRemoteGo(page: string): void;
  peersChanged(count: number): void;
  /** The page the tutor is on (for a late joiner). */
  page?: string;
  onConn?(ok: boolean): void;
  onOversize?(clipped: number, dropped: number): void;
}

export function makeHandlers(sink: BoardSink, hub: PadHub, getLink: () => BoardLink | null): LinkHandlers {
  return {
    onOps: (ops, who) => sink.onRemoteOps(ops, who),
    onPtr: (peer, ptr) => sink.onRemotePtr(peer, ptr),
    onGo: (page) => sink.onRemoteGo(page),
    onPeers: () => sink.peersChanged(getLink()?.peers.size ?? 0),
    getPage: () => sink.page,
    onConn: (ok) => sink.onConn?.(ok),
    onOversize: (clipped, dropped) => sink.onOversize?.(clipped, dropped),
    find: (page, id) => sink.state.pages.find((pg) => pg.id === page)?.els.get(id),
    onPad: (msg, peer, fromId) => {
      hub.receive({ tutor: peer.tutor, id: fromId, cid: peer.cid, name: peer.name }, msg);
      const link = getLink();
      if (link && msg.req) hub.onReq(link, peer);
    },
    onPeerSeen: (peer) => { const link = getLink(); if (link) hub.onPeerSeen(link, peer); },
  };
}
