"use client";

import { useEffect, useState, type ReactNode } from "react";
import { syncRotaCacheOnce } from "@/lib/rotaCache";
import { startClockSync } from "@/features/timeclock/data";
import { fetchOnboarding } from "@/features/team/onboardStore";
import { syncLearning } from "@/features/learning/courseCompletions";
import { useRouter } from "next/navigation";
import { ApiError, get as apiGet, getActAs } from "@/lib/api";
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
// The cached identity gives an instant first render, but it's re-checked with
// the server once per page load: a switched-off account used to keep the whole
// portal on refresh, because the cache was served without asking again.
let revalidated = false;
export const ME_INVALID_EVENT = "aos:me-invalid";
export function getMe(): Promise<Me> {
  if (meCache) {
    if (!revalidated && typeof window !== "undefined") {
      revalidated = true;
      void apiGet<Me>("/api/me")
        .then((m) => { meCache = m; try { window.sessionStorage.setItem(ME_SS_KEY, JSON.stringify(m)); } catch { /* ignore */ } })
        .catch((e) => {
          if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
            clearMeCache();
            window.dispatchEvent(new CustomEvent(ME_INVALID_EVENT, { detail: { status: e.status, message: e.message } }));
          }
        });
    }
    return Promise.resolve(meCache);
  }
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

// Viewing as another account (HQ) swaps who the API serves; the cached /api/me
// must go with it, or screens keep the HQ identity while the data is the other
// account's — and Exit can strand you outside HQ. setActAs() dispatches this.
if (typeof window !== "undefined") window.addEventListener("aos:actas", () => clearMeCache());

/** Drop the cached /api/me — call when the signed-in account changes. */
export function clearMeCache() {
  meCache = null;
  mePromise = null;
  try { window.sessionStorage.removeItem(ME_SS_KEY); } catch { /* ignore */ }
}

// Portals that are scoped to ONE tenant. A platform account has no tenant, so
// every data call from inside one of these fails — "No tenant in scope",
// "Platform accounts must pass ?tenantId=" — on a page that otherwise looks
// completely normal.
const TENANT_PORTALS = new Set(["company", "franchise", "freelancer", "staff"]);

function accessOk(me: Me, portal: string): boolean {
  const access = PORTAL_ACCESS[me.role] ?? [];
  // Platform's cross-portal preview only means anything while it is acting AS
  // somebody — that's what supplies the tenant. Without it the operator portals
  // render a full shell over a stream of API errors, which reads as "the app is
  // broken" rather than "you aren't viewing as anyone". Bounce to HQ instead.
  if (me.role === "platform" && TENANT_PORTALS.has(portal) && !getActAs()) return false;
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
  const [switchedOff, setSwitchedOff] = useState<string | null>(null);
  // The server has stopped recognising this session (switched off, closed, or
  // signed out elsewhere) — act on it now rather than on the next full sign-in.
  useEffect(() => {
    const h = (ev: Event) => {
      const d = (ev as CustomEvent<{ status: number; message: string }>).detail;
      if (d.status === 401) router.replace("/login");
      else if (/switched off|closed this account/i.test(d.message)) setSwitchedOff(d.message);
    };
    window.addEventListener(ME_INVALID_EVENT, h);
    return () => window.removeEventListener(ME_INVALID_EVENT, h);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((me) => {
        if (cancelled) return;
        if (accessOk(me, portal)) {
          setAllowed(true);
          // Operator/staff portals: bring this device's rota copy up to date
          // from the server (lib/rotaCache.ts).
          if (["company", "franchise", "freelancer", "staff"].includes(me.role)) { syncRotaCacheOnce(); startClockSync(); void syncLearning(); if (me.role === "staff") void fetchOnboarding().catch(() => {}); }
          return;
        }
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
        // The account was switched off (Team → Deactivate) — say so plainly
        // instead of opening a shell where every screen fails.
        else if (e instanceof ApiError && e.status === 403 && /switched off|closed this account/i.test(e.message)) setSwitchedOff(e.message);
        // API unreachable — don't lock the user out of the UI shell.
        else setAllowed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [portal, router]);

  if (switchedOff) {
    return (
      <div className="flex h-screen items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <div className="text-[16px] font-extrabold text-[var(--ink)]">Your access has been switched off</div>
          <p className="mt-2 text-[13px] text-[var(--ink-3)]">{switchedOff}</p>
        </div>
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="flex h-screen items-center justify-center text-[13px] text-[var(--ink-3)]">
        Checking access…
      </div>
    );
  }
  return <>{children}</>;
}
