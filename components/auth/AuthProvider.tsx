"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
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

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center text-[13px] text-[var(--ink-3)]">
        Checking session…
      </div>
    );
  }
  return <>{children}</>;
}
