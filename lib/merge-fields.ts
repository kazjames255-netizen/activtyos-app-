// The merge fields a template/message can use, with a plain-English description
// of what each fills and whether it needs a booking/listing to resolve.
//
//  - bookingScoped=false  → fills for any recipient (parent-level).
//  - bookingScoped=true   → needs a specific booking/listing (so it only shows
//    in booking-triggered sends, the Templates editor, and listing broadcasts).
export interface MergeField {
  token: string;
  desc: string;
  bookingScoped: boolean;
}

export const MERGE_FIELDS: MergeField[] = [
  { token: "{ParentName}", desc: "The parent / guardian's name", bookingScoped: false },
  { token: "{ChildName}", desc: "The child's name (or names, if more than one)", bookingScoped: false },
  { token: "{ProviderName}", desc: "Your business / display name", bookingScoped: false },
  { token: "{ListingName}", desc: "The activity they booked", bookingScoped: true },
  { token: "{SessionDate}", desc: "The booked date(s)", bookingScoped: true },
  { token: "{VenueName}", desc: "Where it takes place", bookingScoped: true },
  { token: "{BookingRef}", desc: "The booking reference", bookingScoped: true },
];

// For the general composer: parent-level always; a single-listing broadcast can
// also fill {ListingName}.
export function mergeFieldsFor(context: "family" | "listing" | "booking"): MergeField[] {
  if (context === "booking") return MERGE_FIELDS;
  if (context === "listing") return MERGE_FIELDS.filter((f) => !f.bookingScoped || f.token === "{ListingName}");
  return MERGE_FIELDS.filter((f) => !f.bookingScoped);
}
