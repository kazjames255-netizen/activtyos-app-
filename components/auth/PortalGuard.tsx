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
        if (ok) setAllowed(true);
        else router.replace(ROLE_HOME[me.role] ?? "/login");
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
