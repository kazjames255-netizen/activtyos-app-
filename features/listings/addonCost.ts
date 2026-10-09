// PURE: what an extra on the checkout screen costs for the days a child has PICKED. Display only (the server re-prices from the library).
// A one-off extra the child has NOT been given costs nothing: it used to read its full price in the breakdown ("T-shirt £8.00") while the
// running total correctly left it out, so the lines did not add up to "So far".
export const addonCost = (a: { type: string; price: number }, pickedDays: string[]): number =>
  pickedDays.length === 0 ? 0 : a.type === "perday" ? a.price * pickedDays.length : a.price;
