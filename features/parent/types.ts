export interface BlockSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  capacity: number;
  bookedCount: number;
  spotsLeft: number;
  open: boolean;
  sessions: { date: string; start: string; end: string }[];
}

export interface ListingSummary {
  id: string;
  name: string;
  tenantId: string;
  tenantName: string;
  passes: { name: string; price: number; days?: number }[];
  blocks: BlockSummary[];
  // Customer-page content (present on listings built with the wizard —
  // the server persists the whole draft; see ServerListing in
  // features/listings/ListingWizard.tsx for the full shape).
  title?: string;
  description?: string;
  images?: { src: string; x: number; y: number; zoom: number }[];
  pageStyle?: "playful" | "sport" | "navy";
  opensAt?: string;
  /** The category names this listing is tagged with (resolved server-side from
   *  the tenant's library) — drives the browse header's live category list. */
  categories?: string[];
  /** The listing's venue name (resolved server-side) — the browse Location
   *  filter groups by it. Null when the listing has no venue set. */
  location?: string | null;
  /** The venue's address (resolved server-side), shown on the browse card. */
  address?: string | null;
  /** The venue's town/city (resolved server-side) — the browse Location filter
   *  groups by this. */
  city?: string | null;
  /** Age band the listing accepts, shown on the browse card. */
  ageFrom?: number;
  ageTo?: number;
  /** Venue coordinates when the operator geocoded it — lets the browse compute
   *  distance without a lookup. Absent venues are geocoded from their postcode
   *  on the client instead. */
  lat?: number | null;
  lng?: number | null;
}

export interface CreateMyBookingInput {
  listingId: string;
  blockId: string;
  pass: string;
  child: string;
  age: number;
  method: string;
}
