// Pure add-on pricing + answer validation for a basket item. Extracted
// unchanged from routes/my.ts (checkout) so it can be unit-tested without
// Firestore. Behaviour-preserving: `fail` is the route's HttpError(400, msg).
import { cutoffValue } from "../../../features/bookings/addonRequests";
const round2 = (n: number) => Math.round(n * 100) / 100;

export type LibAddonDef = {
  id: string; name: string; type: string; price: number;
  /** Optional per-add-on "allow changes until N days before" (0-60). Absent = follow the provider's Setup default. */
  requestCutoffDays?: number;
  questions?: { id: string; label: string; type: "text" | "choice"; options?: string[]; required?: boolean }[];
};

export function priceAddon(
  def: LibAddonDef,
  sel: { days?: string[]; answers?: Record<string, string> },
  days: string[],
  child: string,
  fail: (msg: string) => never,
) {
  const onDays = sel.days ? [...new Set(sel.days)] : days;
  if (onDays.some((d) => !days.includes(d)))
    fail(`Add-on "${def.name}" is on a day the pass isn't`);
  // A price that isn't a sane non-negative number (typed as -5, or left blank) is treated as free rather than taking money OFF the booking.
  const unitPrice = Number.isFinite(def.price) && def.price > 0 ? def.price : 0;
  const price = def.type === "perday" ? round2(unitPrice * onDays.length) : round2(unitPrice);
  // Judge the answers against the library, not the client: a required
  // question left blank, or a size that isn't one of the offered ones,
  // is an order the provider can't fill.
  const answers: { label: string; value: string }[] = [];
  for (const q of def.questions ?? []) {
    const value = (sel.answers ?? {})[q.id]?.trim() ?? "";
    if (!value) {
      if (q.required) fail(`"${def.name}" needs an answer for ${q.label} (${child})`);
      continue;
    }
    if (q.type === "choice" && (q.options ?? []).length && !(q.options ?? []).includes(value))
      fail(`"${value}" isn't one of the options for ${q.label}`);
    answers.push({ label: q.label, value });
  }
  const suffix = answers.length ? ` (${answers.map((x) => `${x.label}: ${x.value}`).join(", ")})` : "";
  return {
    addonId: def.id,
    name: def.name,
    price,
    label: (def.type === "perday" ? `${def.name} × ${onDays.length}` : def.name) + suffix,
    // Kept for the per-block split — a line spanning blocks
    // becomes one booking per block, and its add-ons ride along.
    perDay: def.type === "perday",
    unit: unitPrice,
    onDays,
    suffix,
    meal: false,
    // Snapshot of the per-add-on cut-off at booking time (editing the add-on later never moves it for an existing booking).
    ...(cutoffValue(def.requestCutoffDays) !== null ? { requestCutoffDays: cutoffValue(def.requestCutoffDays) as number } : {}),
    ...(answers.length ? { answers } : {}),
  };
}
