import { createRoot, type Root } from "react-dom/client";
import { BookingsApp } from "@/features/bookings/BookingsApp";

/**
 * Strangler carve-out for the admin Bookings view.
 *
 * The legacy `pbRender()` fills every `.pbApp` node it can find. We take over
 * ONLY the admin portal's instance by renaming its class (so the legacy
 * selector no longer matches it) and mounting a React root in its place. The
 * franchise / freelancer bookings views keep running on the legacy code.
 */

let mounted: Root | null = null;

export function mountBookings(): boolean {
  if (mounted) return true;

  // Note: many elements carry data-portal="admin" (portal-switcher buttons,
  // nav links…). The actual portal container is the `.portal` one.
  const adminPortal = document.querySelector('.portal[data-portal="admin"]');
  if (!adminPortal) return false;

  const view = adminPortal.querySelector<HTMLElement>('[data-view="bookings"].view');
  const host = view?.querySelector<HTMLElement>(".pbApp");
  if (!host) return false;

  // Remove the class the legacy render loop targets, so pbRender/pbRenderTableOnly
  // can never overwrite our React island. Tag it for debuggability.
  host.classList.remove("pbApp");
  host.classList.add("pbApp-react");
  host.innerHTML = "";

  mounted = createRoot(host);
  mounted.render(<BookingsApp />);
  return true;
}
