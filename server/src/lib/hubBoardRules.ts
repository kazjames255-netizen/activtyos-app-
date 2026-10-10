// Learning Hub whiteboard — two access rules, pure (owner-accepted defaults, 10 Oct 2026).

interface ElementLike { own?: unknown; cid?: unknown; [k: string]: unknown }
interface PageLike { elements: ElementLike[]; [k: string]: unknown }

/** What a FAMILY may see of a lesson's board: the tutor's elements and their own children's. Another child's drawing (and the first
 *  name that rides on it) never leaves the server to a different family. Returns new objects; the stored pages are untouched. */
export function boardForViewer<P extends PageLike>(pages: P[], viewerChildIds: ReadonlySet<string>): P[] {
  const mine = (e: ElementLike) => {
    const own = typeof e.own === "string" ? e.own : "";
    const cid = typeof e.cid === "string" ? e.cid : "";
    if (cid && !viewerChildIds.has(cid)) return false;
    if (own.startsWith("c:")) return viewerChildIds.has(own.slice(2));
    return own === "T" || !!cid; // the tutor's, or one of this viewer's own children's (cid checked above)
  };
  return pages.map((p) => ({ ...p, elements: p.elements.filter(mine) }));
}

/** Is a save made from `baseUpdatedAt` older than what is stored? A board that exists can only be saved by someone who says which copy
 *  they started from; a first save (nothing stored) is always fine. Replaces silent "last write wins". */
export function boardIsStale(storedUpdatedAt: string | null | undefined, baseUpdatedAt: string | null | undefined): boolean {
  if (!storedUpdatedAt) return false;
  return !baseUpdatedAt || baseUpdatedAt !== storedUpdatedAt;
}
