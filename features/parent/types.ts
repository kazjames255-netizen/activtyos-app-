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
  passes: { name: string; price: number }[];
  blocks: BlockSummary[];
}

export interface CreateMyBookingInput {
  listingId: string;
  blockId: string;
  pass: string;
  child: string;
  age: number;
  method: string;
}
