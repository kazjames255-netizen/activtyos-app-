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
export function notificationHref(href: string, portal: PortalKey | string): string {
  if (!href.startsWith("/")) return href;
  if (portal === "custdash") return href;
  const KNOWN = /^\/(company|franchise|freelancer|staff|custdash)(\/|$)/;
  if (KNOWN.test(href)) return href.replace(/^\/(company|franchise|freelancer|staff|custdash)/, `/${portal}`);
  return `/${portal}${href}`;
}
