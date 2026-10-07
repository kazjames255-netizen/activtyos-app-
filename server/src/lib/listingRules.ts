// Pure listing rules (zod schemas + publish requirements), moved verbatim out of routes/listings.ts so they can be unit-tested.
import { addDaysIso } from "./listingChecks";
import { z } from "zod";
import { desiredRuns } from "./listingRunsPure";

/** Booking-page colour themes a listing may be saved with. Keep in step with features/listings/pageThemes.ts + THEMES in ListingWizard.tsx (a regression test asserts they match). "navy" is the legacy name for "royal". */
export const PAGE_STYLES = [
  "playful", "sport", "emerald", "teal", "royal", "aubergine", "burgundy", "terracotta", "slate", "crimson", "navy",
  "lagoon", "arcade", "aurora", "sherbet", "varsity", "plum", "halftone", "wildwood", "pirouette", "riso", "brite", "pitch", "frost", "mint", "poster",
] as const;


/** Setup → Branding checks (pure). The three brand colours must be #rrggbb hex (empty clears one) and the default listing theme one of PAGE_STYLES; returns an error message or null. */
export function brandSettingsError(s: Record<string, unknown>): string | null {
  for (const k of ["brandColor", "brandColor2", "brandColor3"]) {
    const v = s[k];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v !== "string" || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) return `${k} must be a hex colour like #2f6bd8`;
  }
  const t = s.defaultListingTheme;
  if (t !== undefined && t !== null && t !== "" && !(typeof t === "string" && (PAGE_STYLES as readonly string[]).includes(t))) return "defaultListingTheme is not a known page theme";
  return null;
}

export const imageSchema = z.object({
  src: z
    .string()
    .min(1)
    .max(500)
    .refine((s) => !s.startsWith("data:"), {
      message: "Upload images via POST /api/uploads and store the returned URL",
    }),
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

export const passSchema = z.object({
  name: z.string().min(1),
  price: z.number().nonnegative().max(1_000_000),
  days: z.number().positive().optional(), // session count, for discount thresholds
});

export const discountRuleSchema = z.object({
  id: z.string().max(60),
  kind: z.enum(["person", "session", "early"]),
  name: z.string().max(120),
  passNames: z.array(z.string().max(120)).max(30),
  enabled: z.boolean(),
  moreThan: z.number().int().nonnegative(),
  appliesTo: z.enum(["all", "after1", "second"]),
  method: z.enum(["price", "subtract", "percent"]),
  value: z.number().nonnegative().max(1_000_000),
  beforeDate: z.string().max(10),
}).refine((r) => r.method !== "percent" || r.value <= 100, { message: "A percentage discount can't exceed 100", path: ["value"] });

const strArr = z.array(z.string().max(400)).max(100);

export const baseListingSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    title: z.string().trim().min(1).max(120).optional(),
    passes: z.array(passSchema).max(30).optional(),
    // media
    images: z.array(imageSchema).max(12).optional(),
    gallery: z.array(imageSchema).max(24).optional(),
    layout: z.string().max(40).optional(),
    // who it's for
    ageFrom: z.string().max(10).optional(),
    ageTo: z.string().max(10).optional(),
    categoryIds: z.array(z.string().max(60)).max(50).optional(),
    heroCategoryId: z.string().max(60).nullable().optional(),
    venueId: z.string().max(60).nullable().optional(),
    // Where sessions happen: a fixed venue (default), a home-visit provider who
    // travels to the family, or both. Absent = "venue" (unchanged behaviour).
    deliveryMode: z.enum(["venue", "home-visit", "both"]).optional(),
    // Online listings (the venue is the account's "Online" place): how families get into the session.
    // "platform" (default) = our own video room; "own" = the provider's own link (Zoom etc.), shown from 10 minutes before the start
    // (or straight away when showLinkNow). maxJoiners: optional cap on children in the room. No recording exists or is planned.
    videoMode: z.enum(["platform", "own"]).optional(),
    ownLink: z.string().trim().max(500).optional(),
    showLinkNow: z.boolean().optional(),
    maxJoiners: z.string().max(6).optional(),
    // Coverage area for a home-visit ("home-visit" or "both") listing — either a
    // flat list of postcode prefixes, or a radius in miles from a base postcode.
    // Checkout validates the family's service address against this.
    coverageArea: z
      .object({
        mode: z.enum(["postcodePrefixes", "radius"]),
        postcodePrefixes: z.array(z.string().trim().max(12)).max(200).optional(),
        basePostcode: z.string().trim().max(16).optional(),
        radiusMiles: z.number().positive().max(200).optional(),
      })
      .nullable()
      .optional(),
    // Freelancer manual scheduling control (product decision: no algorithmic
    // travel-time buffers for freelancers — see server/src/lib/schedulingGap.ts).
    // Minutes required between the end of one session and the start of the
    // next; freelancer-editable, default 30. Ignored for company/franchise.
    minGapMinutes: z.number().int().min(0).max(480).optional(),
    // Which season this listing runs in (Setup → Seasons). Groups it in
    // bookings/audiences/money and scopes it in the staff schedule.
    seasonId: z.string().max(60).nullable().optional(),
    // On-the-day contact number, shown to parents only while the camp runs.
    sitePhone: z.string().max(40).optional(),
    // Off-platform payment methods this listing accepts (subset of the tenant's
    // Setup payMethods). Card is always accepted and isn't stored here.
    payMethods: z.array(z.string().max(60)).max(20).optional(),
    allowOutOfRange: z.boolean().optional(),
    // capacity
    maxAttendees: z.string().max(10).optional(),
    capacityScope: z.enum(["day", "listing"]).optional(),
    showSpaces: z.boolean().optional(),
    // Per-age-group daily caps on top of maxAttendees (Setup → Age groups id →
    // places; 0 = closed to that age). They were stripped here, so the wizard's
    // caps vanished on save (acceptance d2s8). Stored + shown; NOT yet enforced
    // at booking (§S).
    ageCaps: z.record(z.string().max(60), z.number().int().min(0).max(10_000))
      .refine((r) => Object.keys(r).length <= 50, "Too many age caps").optional(),
    ageCapsOn: z.boolean().optional(),
    // content
    headings: z.record(z.string().max(60), z.string().max(200)).optional(),
    descriptionSection: z.string().max(200).optional(),
    description: z.string().max(10_000).optional(),
    sections: z
      .array(z.object({ id: z.string().max(60), type: z.string().max(40), text: z.string().max(5_000) }))
      .max(30)
      .optional(),
    outcomes: strArr.optional(),
    provided: strArr.optional(),
    toBring: strArr.optional(), // "what to bring" — sun cream, water bottle, etc.
    safety: strArr.optional(),
    send: strArr.optional(),
    // when it runs (the recipe the server turns into dated blocks)
    runFrom: z.string().max(10).optional(),
    runTo: z.string().max(10).optional(),
    blockMode: z.enum(["weekly", "custom"]).optional(),
    days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    datesOff: z.array(z.string().max(10)).max(400).optional(),
    // meals — whether this listing offers meals, and what runs each run-day
    // (ISO date → the menu + which of its dishes are served that day). A legacy
    // plain menu-id string still parses (= the whole menu). Parents pick from
    // the day's dishes at checkout. Not a RUN_FIELD: it never re-syncs blocks.
    mealsEnabled: z.boolean().optional(),
    mealPlan: z
      .record(
        z.string().max(10),
        z.union([
          z.string().max(60),
          z.object({ menuId: z.string().max(60), itemIds: z.array(z.string().max(60)).max(40).default([]) }),
        ]),
      )
      .optional(),
    // Per-listing meal admin: a caterer email digest schedule, and the parent
    // order cut-off for each day. Caterer emailing is a backend cron (Amir);
    // cut-off enforcement rides the meal-order checkout.
    mealConfig: z
      .object({
        catererEmail: z.string().trim().max(160).optional(),
        catererEvery: z.enum(["off", "day", "week"]).optional(),
        catererAt: z.string().max(5).optional(),
        cutoffWhen: z.enum(["off", "same", "prev", "2days"]).optional(),
        cutoffTime: z.string().max(5).optional(),
      })
      .optional(),
    // tickets
    blockId: z.string().max(60).nullable().optional(), // block bundle
    ticketOverrides: z
      .record(
        z.string().max(60),
        z.object({
          ageFrom: z.string().max(10).optional(),
          ageTo: z.string().max(10).optional(),
          capacity: z.string().max(10).optional(),
          // Per-listing "don't offer this pass here" flag. The storefront filters
          // hidden passes out; booking-time refusal is still Amir's (handoff §T).
          hidden: z.boolean().optional(),
        }),
      )
      .optional(),
    bookRules: z.record(z.string().max(60), z.string().max(20)).optional(),
    // extras & team
    addonIds: z.array(z.string().max(60)).max(50).optional(),
    staffIds: z.array(z.string().max(60)).max(50).optional(),
    // policy
    visibility: z.enum(["public", "hidden"]).optional(),
    opensAt: z.string().max(25).optional(), // local datetime; blank = open now
    // Stop taking family bookings N hours before each session starts (blank =
    // up to the day itself). Enforced in POST /api/my/bookings; an operator
    // taking a booking by hand may still add a late place.
    bookingCutoffHours: z.string().trim().regex(/^\d{0,4}$/, "Cut-off must be a whole number of hours").optional(),
    bookingType: z.enum(["auto", "manual"]).optional(),
    waitlist: z.boolean().optional(),
    // "manual": the operator offers places. "auto": a freed seat is offered
    // to the front of that date's queue automatically (2h hold each).
    waitlistMode: z.enum(["manual", "auto"]).optional(),
    waitlistSize: z.string().max(10).optional(),
    cancellation: z.string().max(2_000).optional(),
    discounts: z.array(discountRuleSchema).max(30).optional(),
    // Which Setup cancellation policy this listing uses — shown to parents and
    // applied on cancel. It was stripped here, so every cancel fell back to the
    // first policy whatever the parent had been shown (acceptance d4s6).
    cancellationPolicyId: z.string().trim().max(60).optional(),
    // presentation & lifecycle
    pageStyle: z.enum(PAGE_STYLES).optional(),
    // Draw the theme artwork when the listing has no photo (undefined / true = yes, the default; false = a plain themed strip).
    themeArt: z.boolean().optional(),
    status: z.enum(["draft", "live"]).optional(),
    archived: z.boolean().optional(),
  });

// Creating needs a name; updating may be a partial patch (e.g. just
// {visibility} or {archived} from the listings-tab quick actions).
export const createSchema = baseListingSchema.refine((d) => d.name || d.title, {
  message: "A listing needs a name or title",
});

export type ListingInput = z.infer<typeof baseListingSchema>;

/** Fields whose change means the dated blocks must be re-synced. */
export const RUN_FIELDS = ["runFrom", "runTo", "blockMode", "days", "datesOff", "maxAttendees", "capacityScope", "blockId"] as const;

export function runRecipeOf(doc: Record<string, unknown>) {
  return {
    runFrom: doc.runFrom as string | undefined,
    runTo: doc.runTo as string | undefined,
    blockMode: doc.blockMode as "weekly" | "custom" | undefined,
    days: doc.days as number[] | undefined,
    datesOff: doc.datesOff as string[] | undefined,
    maxAttendees: doc.maxAttendees as string | undefined,
    capacityScope: doc.capacityScope as "day" | "listing" | undefined,
    blockId: doc.blockId as string | null | undefined,
  };
}

// Publishing has requirements the builder already enforces client-side —
// mirrored here so `status: "live"` can't arrive by API with none of them
// (the client-side lock is a courtesy, this is the control). Only checked
// when the WRITE itself publishes; existing live docs aren't re-judged.
export function publishProblems(merged: Record<string, unknown>, opts?: { today?: string }): string[] {
  const problems: string[] = [];
  if (!((merged.title as string) ?? (merged.name as string))?.trim()) problems.push("a name");
  const deliveryMode = (merged.deliveryMode as string | undefined) ?? "venue";
  if (deliveryMode !== "home-visit" && !merged.venueId) problems.push("a venue");
  if (deliveryMode !== "venue") {
    const coverage = merged.coverageArea as { mode?: string; postcodePrefixes?: string[]; basePostcode?: string; radiusMiles?: number } | null | undefined;
    if (!coverage) problems.push("a home-visit coverage area");
    else if (coverage.mode === "radius" ? !coverage.basePostcode || !coverage.radiusMiles : !(coverage.postcodePrefixes ?? []).length)
      problems.push("a home-visit coverage area");
  }
  const recipe = runRecipeOf(merged);
  const runs = desiredRuns(recipe, { start: "09:00", end: "15:30" });
  if (!runs.length) problems.push("dates with at least one running day");
  // Every date already gone (a mistyped year such as 2006): nothing left to book. Only judged when the caller supplies today's date.
  else if (opts?.today) {
    const last = runs.flatMap((r) => r.sessions.map((s) => s.date)).sort().pop();
    if (last && last < addDaysIso(opts.today, -1)) problems.push("dates in the future (every date has already passed)");
  }
  // blockId too, not just snapshotted passes: without the bundle the customer
  // page has no timings and the booking widget is dead ("Pick a block in
  // Tickets & pricing…") — the wizard blocks this client-side, this is the
  // control for API writes.
  if (!merged.blockId || !((merged.passes as unknown[]) ?? []).length) problems.push("a block with passes");
  // Age range: judged at publish (not on every autosave, which would fail while someone is mid-typing "11").
  const lo = parseFloat(String(merged.ageFrom ?? "")), hi = parseFloat(String(merged.ageTo ?? ""));
  if (Number.isFinite(lo) && Number.isFinite(hi) && lo > hi) problems.push("a minimum age that is not higher than the maximum age");
  return problems;
}

