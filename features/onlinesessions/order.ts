// Pure ordering for the parent's "Your online sessions" carousel: nearest first, joinable-now first, finished ones out.

export interface OrderableSession {
  listingId: string;
  date: string;
  listingName?: string;
  startsAt: string;
  opensAt: string;
  closesAt: string;
  /** The server's verdict (lib/onlineRules joinState). */
  joinState?: string;
}

export const sessionKey = (s: Pick<OrderableSession, "listingId" | "date">) => `${s.listingId}_${s.date}`;

/** Is this session joinable right now (window open, host live or about to be)? Those sit at the front. */
export function isLiveNow(s: OrderableSession, now: number): boolean {
  if (s.joinState === "open" || s.joinState === "waiting_host") return true;
  if (s.joinState) return false; // unpaid / early / no link: not something to join this minute
  return now >= new Date(s.opensAt).getTime() && now <= new Date(s.closesAt).getTime();
}

/** Upcoming first: joinable now, then by start time (soonest first); a finished session is dropped. Never mutates the input. */
export function orderSessions<T extends OrderableSession>(list: readonly T[], now: number = Date.now()): T[] {
  return list
    .filter((s) => s.joinState !== "finished" && new Date(s.closesAt).getTime() >= now)
    .sort((a, b) => {
      const la = isLiveNow(a, now) ? 0 : 1;
      const lb = isLiveNow(b, now) ? 0 : 1;
      if (la !== lb) return la - lb;
      const d = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      if (d) return d;
      return (a.listingName ?? "").localeCompare(b.listingName ?? "") || sessionKey(a).localeCompare(sessionKey(b));
    });
}

/** Where the carousel should sit after the list reloads: stay on the same session when it is still there, else the first. */
export function indexAfterReload(ordered: readonly OrderableSession[], currentKey: string | null): number {
  if (!currentKey) return 0;
  const i = ordered.findIndex((s) => sessionKey(s) === currentKey);
  return i < 0 ? 0 : i;
}
