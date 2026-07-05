import { createRoot, type Root } from "react-dom/client";
import { TimetableApp } from "@/features/timetable/TimetableApp";

/**
 * Strangler carve-out for the Activity Timetable builder.
 *
 * Unlike bookings (three independent `.pbApp` nodes), the legacy timetable is a
 * single `#ttbBody` element that `ttbMount()` physically relocates between the
 * per-portal hosts (#ttbHost_admin / _fr / _fl). We replace each host that
 * exists with its own React root (all sharing one Zustand store, so they show
 * the same timetable — matching the legacy single-body behaviour) and neutralise
 * `ttbMount` so the legacy code can never move a stale body back in.
 */

let mounted = false;
const roots: Root[] = [];

export function mountTimetable(): boolean {
  if (mounted) return true;

  const view = document.querySelector('.portal[data-portal="admin"] [data-view="timetable"]');
  if (!view) return false;

  const hostIds = ["ttbHost_admin", "ttbHost_fr", "ttbHost_fl"];
  const hosts = hostIds
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => !!el);
  if (!hosts.length) return false;

  // Stop the legacy relocation logic before we detach its body.
  const w = window as unknown as { ttbMount?: () => void; ttbField?: () => void };
  w.ttbMount = () => {};

  for (const host of hosts) {
    host.innerHTML = "";
    const root = createRoot(host);
    root.render(<TimetableApp />);
    roots.push(root);
  }

  mounted = true;
  return true;
}
