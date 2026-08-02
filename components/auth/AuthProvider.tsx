"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";

interface AuthState {
  user: User | null;
  /** true until Firebase has restored (or rejected) the persisted session */
  loading: boolean;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signOutUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(firebaseAuth, (u) => {
        setUser(u);
        setLoading(false);
      }),
    [],
  );

  return (
    <AuthContext.Provider
      value={{ user, loading, signOutUser: () => signOut(firebaseAuth) }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Client-side gate for portal pages: waits for the persisted session to
 * restore, then bounces unauthenticated visitors to /login. (The Express API
 * is what actually enforces access — this is UX, not security.)
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Tracks whether a user was signed in while this page was open. If so, a
  // user->null transition is an intentional sign-out — redirect WITHOUT a
  // ?next return-path, so the next (possibly different) account isn't sent
  // back to this account's page. `next` is only for cold unauthenticated
  // arrivals (deep links / expired sessions).
  const hadUser = useRef(false);
  useEffect(() => {
    if (user) hadUser.current = true;
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      // Keep the query string on the return path — a deep link like
      // /freelancer/bookings?ref=APF-123 must survive the login bounce, or the
      // operator lands on the list instead of the specific booking.
      const qs = searchParams.toString();
      const dest = qs ? `${pathname}?${qs}` : pathname;
      router.replace(hadUser.current ? "/login" : `/login?next=${encodeURIComponent(dest)}`);
    }
  }, [loading, user, router, pathname, searchParams]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center text-[13px] text-[var(--ink-3)]">
        Checking session…
      </div>
    );
  }
  return <>{children}</>;
}
