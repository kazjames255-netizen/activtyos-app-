import { effectiveSettings } from "../middleware/access";
import { CA_FEATURES, firstOff } from "../../../lib/accessMap";

// Setup → Customer area: what a provider's families get (wallet, memberships,
// refer-a-friend, trips, moments…). The sidebar hid a switched-off area, but
// the parent API still served it — typing the URL, or calling the API, got
// straight in (acceptance test d7s7). Routes ask here instead.
// Simple mode keeps only the booking essentials, so every optional area is off.
// A module the operator switched off in Setup → Features is off for their
// families too (lib/accessMap.ts CA_FEATURES — the family nav hides the same).
type Key = "wallet" | "memberships" | "refer" | "trips" | "moments" | "messaging" | "meals" | "coupons" | "newsfeed" | "timetable" | "accidents" | "medication" | "browse" | "codesBanner";

/** Settings come through the access gate's short cache, which Setup clears on
 *  save — a switch reaches families on the next request. Pass the franchise a
 *  record belongs to when it has one: a franchise keeps its own Setup. */
export async function customerAreaOn(tenantId: string, key: Key, franchiseId?: string | null): Promise<boolean> {
  const s = await effectiveSettings(tenantId, franchiseId);
  const ca = (s.customerArea ?? {}) as Record<string, unknown>;
  if (ca.simpleMode === true && key !== "browse") return false;
  if (firstOff(s.features as Record<string, unknown> | undefined, CA_FEATURES[key] ?? [])) return false;
  return ca[key] !== false;
}
