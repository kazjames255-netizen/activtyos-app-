export interface ListingSummary {
  id: string;
  name: string;
  tenantId: string;
  tenantName: string;
  passes: { name: string; price: number }[];
  blocks: string[];
}

export interface CreateMyBookingInput {
  listingId: string;
  pass: string;
  dates: string;
  child: string;
  age: number;
  method: string;
}
