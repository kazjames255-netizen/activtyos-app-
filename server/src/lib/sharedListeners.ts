// Shared Firestore listeners for the SSE stream (routes/events.ts).
//
// Before: every SSE connection attached its own onSnapshot per collection, so each connect re-read the whole result
// set and every document change was billed once PER CONNECTION. Now identical listeners (same key = same query) are
// shared by every connection in this process: one Firestore listener, fanned out in memory. The event only carries
// the collection name (never data), so sharing cannot widen who sees what, as long as the key fully identifies the
// query — callers key by tenant (+ franchise) / "global".
//
// A listener lingers briefly after its last subscriber leaves, so a reconnect or a page change (which re-opens the
// stream) reuses it instead of re-reading the whole result set.

type Unsub = () => void;
export type Attach = (onChange: () => void, onError: (e: Error) => void) => Unsub;

interface Entry {
  subs: Set<() => void>;
  unsub: Unsub;
  linger: ReturnType<typeof setTimeout> | null;
}

export function createSharedListeners(lingerMs = 60_000) {
  const entries = new Map<string, Entry>();
  return {
    /** Subscribe to `key`; `attach` is only called when no live listener exists. Returns an unsubscribe. */
    subscribe(key: string, attach: Attach, onChange: () => void, onError: (e: Error) => void = () => {}): Unsub {
      let e = entries.get(key);
      if (e?.linger) { clearTimeout(e.linger); e.linger = null; }
      if (!e) {
        const subs = new Set<() => void>();
        let first = true; // the attach-time snapshot is the current state, not a change
        const entry: Entry = {
          subs,
          linger: null,
          unsub: attach(() => {
            if (first) { first = false; return; }
            for (const s of [...subs]) s();
          }, (err) => { if (entries.get(key) === entry) entries.delete(key); onError(err); }), // a dead listener must not be reused
        };
        entries.set(key, entry);
        e = entry;
      }
      const entry = e;
      entry.subs.add(onChange);
      let gone = false;
      return () => {
        if (gone) return;
        gone = true;
        entry.subs.delete(onChange);
        if (entry.subs.size === 0 && !entry.linger) {
          entry.linger = setTimeout(() => {
            if (entry.subs.size === 0 && entries.get(key) === entry) { entries.delete(key); entry.unsub(); }
          }, lingerMs);
          entry.linger.unref?.();
        }
      };
    },
    /** Test/diagnostic: number of live Firestore listeners. */
    liveCount: () => entries.size,
  };
}
