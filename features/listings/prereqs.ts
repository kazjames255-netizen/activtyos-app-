// Pure helpers for the listing wizard's "what you need before you publish" panel and its draft hygiene.

export interface PrereqInput {
  /** Saved venues in the library. */
  venueCount: number;
  /** "venue" | "home-visit" | "both" - a home-visit-only listing needs no venue. */
  deliveryMode?: string;
  /** Blocks in the library: how many passes each has and whether prices were set. */
  blocks: { passCount: number; priced: boolean }[];
}
export interface Prereq { key: "venue" | "block"; ok: boolean }

export function listingPrereqs(i: PrereqInput): Prereq[] {
  const venueOk = i.deliveryMode === "home-visit" || i.venueCount > 0;
  const blockOk = i.blocks.some((b) => b.passCount > 0 && b.priced);
  return [{ key: "venue", ok: venueOk }, { key: "block", ok: blockOk }];
}
export const allPrereqsMet = (p: Prereq[]) => p.every((x) => x.ok);

/** Step 1 cannot be left without a listing name. */
export const titleMissing = (title: string) => !title.trim();

/** A draft only reaches the server once it has a name (or already exists there) - no more empty "New listing" clutter. */
export const mayCreateOnServer = (d: { id?: string | null; title: string }) => !!d.id || !!d.title.trim();

/** On close: an unpublished server draft with no name is abandoned clutter and gets deleted. */
export const isAbandonedDraft = (d: { id?: string | null; title: string; status?: string }) => !!d.id && d.status !== "live" && !d.title.trim();

/** The id of a block that appeared since `before` (so the wizard can auto-select what was just created). */
export function newBlockId(before: string[], after: string[]): string | null {
  const seen = new Set(before);
  const fresh = after.filter((id) => !seen.has(id));
  return fresh.length ? fresh[fresh.length - 1] : null;
}

/** The public booking link for a published listing. */
export const bookingLink = (origin: string, id: string) => `${origin}/book/${id}`;
