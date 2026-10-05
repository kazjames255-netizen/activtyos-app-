// The product name, in ONE place for everything the server says to people (emails, notifications, payment descriptions).
// Rename the product by setting BRAND_NAME on the API host (or changing the default here); see the rename checklist in memory.
export const BRAND = (process.env.BRAND_NAME ?? "").trim() || "Name TBC";
