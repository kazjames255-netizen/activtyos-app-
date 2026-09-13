"use client";

// Deployment — who works at which location (venue) and, optionally, which of
// its listings. On the server since 13 Sept (/api/location-staff): it lived in
// the operator's browser only (localStorage "aos.locstaff.v2") and nothing
// read it. Team → Deployment edits it; the Schedule uses it to offer only the
// people deployed at a shift's location (acceptance d23s1).
import { get as apiGet, put as apiPut } from "@/lib/api";

/** `unset` = on the team but never placed (no choice on their invite, not yet
 *  touched here) — no rule applies to them until someone deploys them. */
export interface LocStaff { id: string; name: string; role?: string; uid?: string; sites: string[]; listings: string[]; unset?: boolean }
interface TeamRow { uid: string; name: string; role: string; assignment: { mode: string; ids: string[] } | null }
export interface DeploymentRaw { staff: LocStaff[] | null; team: TeamRow[] }

const lc = (s: string) => s.trim().toLowerCase();

/** Managers only — a member of staff is refused (403), and the Schedule then
 *  simply doesn't filter. */
export const fetchDeployment = () => apiGet<DeploymentRaw>("/api/location-staff");
/** Save the whole list — a moment after the last change, so a run of chip
 *  taps is one save. */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function saveDeployment(staff: LocStaff[], done: (err: string | null) => void) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { apiPut("/api/location-staff", { staff }).then(() => done(null)).catch((e) => done(e instanceof Error ? e.message : "try again")); }, 400);
}

/** The saved deployment, plus anyone on the team who isn't in it yet — placed
 *  where their invite said (a location, listings, everywhere, or "not rostered"). */
export function resolveDeployment(raw: DeploymentRaw, venueIds: string[], listings: { id: string; venueId?: string | null }[]): LocStaff[] {
  const saved = (raw.staff ?? []).map((x) => ({ ...x, sites: x.sites ?? [], listings: x.listings ?? [] }));
  const known = new Set(saved.flatMap((s) => [s.uid ?? "", lc(s.name)]).filter(Boolean));
  const fresh = (raw.team ?? []).filter((p) => !known.has(p.uid) && !known.has(lc(p.name))).map((p): LocStaff => {
    const a = p.assignment;
    const ids = a?.ids ?? [];
    const sites = a?.mode === "all" ? venueIds
      : a?.mode === "locations" ? ids
      : a?.mode === "listings" ? [...new Set(ids.map((id) => listings.find((l) => l.id === id)?.venueId).filter((v): v is string => !!v))]
      : [];
    return { id: p.uid, uid: p.uid, name: p.name, role: p.role || undefined, sites, listings: a?.mode === "listings" ? ids : [], ...(a ? {} : { unset: true }) };
  });
  return [...saved, ...fresh];
}

/** Is this person deployed at this venue (and listing)? null = no rule to
 *  apply: no venue on the shift, or they aren't placed in Deployment. A person
 *  is at a venue if it's one of their sites or one of their listings runs
 *  there; picking listings at a venue limits them to those. */
export function deployedAt(deploy: LocStaff[] | null, name: string, venueId: string | null | undefined, listingId: string | null | undefined, venueOfListing: (id: string) => string | null | undefined): boolean | null {
  if (!deploy || !venueId) return null;
  const p = deploy.find((d) => lc(d.name) === lc(name));
  if (!p || p.unset) return null;
  const here = p.listings.filter((id) => venueOfListing(id) === venueId);
  if (!p.sites.includes(venueId) && !here.length) return false;
  if (listingId && here.length && !here.includes(listingId)) return false;
  return true;
}
