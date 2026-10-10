// The English words of the offline-refund sentences (features/bookings/refundMethod.ts) for the SERVER: emails, bells and the provider's reminder.
// They come from the same `rfm` catalogue the screens use, so the two can never drift. Pure: no database.
import { CATALOGS } from "../../../lib/i18n/messages/index";
import { joinList } from "../../../lib/i18n/listFormat";
import type { Tr } from "../../../features/bookings/refundMethod";

const get = (key: string): string => {
  const [area, k] = key.split(".");
  return ((CATALOGS as unknown as Record<string, Record<string, Record<string, string>>>).en[area]?.[k]) ?? key;
};
export const enTr: Tr = (key, vars = {}) => Object.entries(vars).reduce((t, [k, x]) => t.split(`{${k}}`).join(x), get(key));
export const enJoin = (items: string[]): string => joinList(items, "en-GB");
