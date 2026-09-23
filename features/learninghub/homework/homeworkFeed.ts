import { get } from "@/lib/api";

// One shared fetch for "what homework does this child have?". Home and the Homework tab both read the same
// list; without this they made separate calls, and a failure in one was shown as "none" (data-truth #1).
// A successful response is reused for a few seconds; a failure is never cached; realtime-triggered loads
// pass `force` so a change is always re-read.
const TTL = 8_000;
const cache = new Map<string, { t: number; p: Promise<unknown> }>();

export function getShared<T>(path: string, force = false): Promise<T> {
  const c = cache.get(path);
  if (!force && c && Date.now() - c.t < TTL) return c.p as Promise<T>;
  const p = get<T>(path);
  cache.set(path, { t: Date.now(), p });
  p.catch(() => { if (cache.get(path)?.p === p) cache.delete(path); });
  return p;
}
