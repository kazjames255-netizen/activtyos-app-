"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ApiError, get as apiGet } from "@/lib/api";
import { PORTAL_ACCESS, ROLE_HOME, type Me } from "@/lib/roles";

/**
 * Keeps each account inside its own portal ("the right person sees the right
 * portal" — product spec item 5): a parent deep-linking into
 * /freelancer/listings is bounced to their own home instead of seeing an
 * operator shell full of 403s. Platform accounts may open any portal
 * (cross-portal preview). UX only — the API enforces data access regardless.
 */
export function PortalGuard({ portal, children }: { portal: string; children: ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<Me>("/api/me")
      .then((me) => {
        const access = PORTAL_ACCESS[me.role] ?? [];
        const ok = access === "all" || access.includes(portal);
        if (cancelled) return;
        if (ok) { setAllowed(true); return; }
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
