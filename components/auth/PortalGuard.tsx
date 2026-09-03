"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ApiError, get as apiGet } from "@/lib/api";
import { PORTAL_ACCESS, ROLE_HOME, type Me } from "@/lib/roles";

// The signed-in account's /api/me, cached for the whole SPA session. Without
// this the guard re-fetched /api/me — and blanked the screen with
// "Checking access…" — on EVERY navigation, so a slow lookup showed a multi-
// second spinner on every page. Now it's one request per session; the cache is
// cleared by clearMeCache() when the Firebase user changes (see AuthProvider).
const ME_SS_KEY = "aos.me";
// Seed the cache from sessionStorage so a HARD reload knows the account (role,
// tenant, hasFranchises) on the FIRST render — no flash of the wrong chrome
// (e.g. a head office briefly rendering as a plain company before /api/me
// resolves). Cleared on sign-in/out via clearMeCache.
function readSessionMe(): Me | null {
  try { const s = typeof window !== "undefined" ? window.sessionStorage.getItem(ME_SS_KEY) : null; return s ? (JSON.parse(s) as Me) : null; } catch { return null; }
}
let meCache: Me | null = readSessionMe();
let mePromise: Promise<Me> | null = null;

/** The last-known account, synchronously (from cache/sessionStorage) — for a
 *  correct FIRST render. May be null until getMe() first resolves. */
export function peekMe(): Me | null { return meCache; }

/** The signed-in account, cached for the session. Any component that needs
 *  /api/me (role, tenant, plan) should call this instead of its own fetch, so
 *  the lookup happens once, not once per component per navigation. */
export function getMe(): Promise<Me> {
  if (meCache) return Promise.resolve(meCache);
  if (!mePromise) {
    mePromise = apiGet<Me>("/api/me")
      .then((m) => {
        meCache = m;
        try { window.sessionStorage.setItem(ME_SS_KEY, JSON.stringify(m)); } catch { /* ignore */ }
        return m;
      })
      // Never cache a REJECTED lookup — a one-off failure would otherwise stick
      // for the whole session (leaving a head office stuck as a plain company).
      // Reset so the next getMe() retries.
      .catch((e) => { mePromise = null; throw e; });
  }
  return mePromise;
}

/** Drop the cached /api/me — call when the signed-in account changes. */
export function clearMeCache() {
  meCache = null;
  mePromise = null;
  try { window.sessionStorage.removeItem(ME_SS_KEY); } catch { /* ignore */ }
}

function accessOk(me: Me, portal: string): boolean {
  const access = PORTAL_ACCESS[me.role] ?? [];
  return access === "all" || access.includes(portal);
}

/**
 * Keeps each account inside its own portal ("the right person sees the right
 * portal" — product spec item 5): a parent deep-linking into
 * /freelancer/listings is bounced to their own home instead of seeing an
 * operator shell full of 403s. Platform accounts may open any portal
 * (cross-portal preview). UX only — the API enforces data access regardless.
 */
export function PortalGuard({ portal, children }: { portal: string; children: ReactNode }) {
  const router = useRouter();
  // Cache hit → decide synchronously so a revisited page renders with no
  // "Checking access…" flash. Cold (no cache) → null, and we show it once.
  const [allowed, setAllowed] = useState<boolean | null>(() =>
    meCache ? accessOk(meCache, portal) : null,
  );

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((me) => {
        if (cancelled) return;
        if (accessOk(me, portal)) { setAllowed(true); return; }
        // Wrong portal for this account. Operator email deep-links are minted
        // as /company/… and only rewritten to the tenant's real portal when its
        // plan is known — so a freelancer/franchise can arrive on /company/…
        // holding a ?ref that must still open. When BOTH the arrived-at portal
        // and the account's own portal are operator portals, send them to the
        // SAME view in their own portal (keeping the query) rather than dumping
        // them on their home and losing the deep link.
        const home = ROLE_HOME[me.role] ?? "/login";
        const mine = home.split("/")[1] ?? "";
        const OPERATOR = new Set(["company", "franchise", "freelancer", "staff"]);
        if (OPERATOR.has(portal) && OPERATOR.has(mine)) {
          const parts = window.location.pathname.split("/");
          parts[1] = mine; // swap only the portal segment; keep the view + rest
          router.replace(parts.join("/") + window.location.search);
        } else {
          router.replace(home);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        clearMeCache(); // a failed lookup shouldn't stick — let the next try re-fetch
        // Signed out entirely → the login page, not a shell full of 403s.
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        // API unreachable — don't lock the user out of the UI shell.
        else setAllowed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [portal, router]);

  if (!allowed) {
    return (
      <div className="flex h-screen items-center justify-center text-[13px] text-[var(--ink-3)]">
        Checking access…
      </div>
    );
  }
  return <>{children}</>;
}
