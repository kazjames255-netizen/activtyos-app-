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
}

export interface CreateMyBookingInput {
  listingId: string;
  blockId: string;
  pass: string;
  child: string;
  age: number;
  method: string;
}
