// Time-of-day greeting for the portal dashboards.
//
// Kept in one place so staff and operator dashboards can't drift apart on
// either the cutoffs or the wording. Uses the viewer's LOCAL clock — someone
// opening the register at 7am should be greeted for their morning, not the
// server's.
//
// First name only: "Good morning, Priya" reads like a person talking; the full
// legal name on the account usually doesn't.
export function greeting(name?: string | null): string {
  const h = new Date().getHours();
  const g = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? `${g}, ${first}` : g;
}
