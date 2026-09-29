import type { PortalKey } from "@/lib/nav/config";

/**
 * Where a notification should actually take THIS recipient.
 *
 * Notifications are written server-side from whichever portal raised them, so
 * their hrefs come in two shapes — `/company/incidents` (a portal that may not
 * be the reader's) and `/tasks?task=123` (no portal at all, e.g. the overdue-task
 * sweep in server/src/lib/sweeps.ts). A bare path 404s, because every operator
 * page lives under `/<portal>/…`.
 *
 * So: rewrite a leading portal segment to the reader's own, and give a portal to
 * anything that has none. Parent links (`/custdash/…`) are left alone — a parent
 * is already in the right place, and their public pages aren't portal-scoped.
 */
/** Pages the server links to under the operator portals that a portal's navigation simply doesn't have
 *  (registered views are the only routable ones — anything else 404s). Staff have no events calendar
 *  (a calendar-reminder bell on a coach's account linked to /staff/calendar, a 404) and their concern
 *  form is `incident`, singular. Land them somewhere real instead. */
const PORTAL_SLUG_FALLBACK: Record<string, Record<string, string>> = {
  staff: { calendar: "dash", incidents: "incident" },
};

export function notificationHref(href: string, portal: PortalKey | string): string {
  if (!href.startsWith("/")) return href;
  if (portal === "custdash") return href;
  const KNOWN = /^\/(company|franchise|freelancer|staff|custdash)(\/|$)/;
  const out = KNOWN.test(href) ? href.replace(/^\/(company|franchise|freelancer|staff|custdash)/, `/${portal}`) : `/${portal}${href}`;
  const fallback = PORTAL_SLUG_FALLBACK[portal];
  if (!fallback) return out;
  return out.replace(/^(\/[a-z]+\/)([a-z-]+)(?=[/?#]|$)/, (m, pre: string, slug: string) => (fallback[slug] ? `${pre}${fallback[slug]}` : m));
}
