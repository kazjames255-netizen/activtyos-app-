"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { fetchRoleHome } from "@/lib/roles";
import { FieldLabel, Input } from "@/components/ui";
import { AUTH_LIGHT, AosMark, AosWordmark } from "@/components/auth/AuthBrand";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function resetPassword() {
    setError(null);
    setNotice(null);
    if (!email) {
      setError("Enter your email first, then click “Forgot password?”.");
      return;
    }
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      setNotice(`Password-reset email sent to ${email} — check your inbox.`);
    } catch {
      setError("Couldn't send the reset email — check the address.");
    }
  }

  // Route to the account's home portal: an explicit ?next= wins, otherwise
  // ask the API who this account is (platform → Providers, company → its
  // Bookings, parent → Browse, …).
  async function goHome() {
    const next = params.get("next");
    router.replace(next || (await fetchRoleHome()));
  }

  // Already signed in (e.g. revisiting /login)? Skip the form.
  useEffect(() => {
    if (!loading && user && !busy) void goHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      await goHome();
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      // A blocked/failed network request is NOT a wrong password — it's usually
      // an ad blocker / privacy extension / VPN in this browser profile stopping
      // the call to Google's sign-in service. Say so, rather than blaming the
      // credentials.
      if (code === "auth/network-request-failed" || /network|fetch|failed to fetch/i.test((err as Error)?.message ?? "")) {
        setError("Couldn't reach the sign-in service. An ad blocker, privacy extension or VPN in this browser may be blocking it — try an incognito window, or disable extensions for this site.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts — please wait a minute and try again.");
      } else {
        setError("Sign-in failed — check your email and password.");
      }
      setBusy(false);
    }
  }

  return (
    <div
      className="relative w-full max-w-[400px] overflow-hidden rounded-[20px] bg-[var(--surface)] p-7 shadow-[0_24px_70px_-24px_rgba(20,30,90,.28)]"
      style={{ borderLeft: "4px solid #1d3a8f" }}
    >
      <div className="mb-5 flex items-center gap-2.5">
        <AosMark />
        <AosWordmark className="text-[19px] font-extrabold" />
      </div>
      <h1 className="text-[25px] font-extrabold tracking-[-0.01em]" style={{ fontFamily: "var(--ff-display)", color: "var(--ink)" }}>
        Sign in
      </h1>
      <p className="mb-5 mt-1 text-[13.5px] text-[var(--ink-3)]">Welcome back. Sign in to your workspace.</p>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <div>
          <FieldLabel htmlFor="login-email">Email</FieldLabel>
          <Input id="login-email" type="email" required autoComplete="email" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
        </div>
        <div>
          <FieldLabel htmlFor="login-password">Password</FieldLabel>
          <div className="relative">
            <Input id="login-password" type={showPw ? "text" : "password"} required autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pr-14" />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[var(--ink-3)] hover:text-[var(--ink-2)]">
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
          <div className="mt-1.5 text-right">
            <button type="button" onClick={resetPassword} className="text-[12px] font-bold text-[var(--brand-2,#2f6bd8)]">
              Forgot password?
            </button>
          </div>
        </div>
        {error && <div className="text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
        {notice && <div className="text-[12.5px] font-semibold text-[#1d3a8f]">{notice}</div>}
        <button type="submit" disabled={busy}
          className="mt-1 w-full rounded-xl py-3 text-[14.5px] font-extrabold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
          style={{ background: "linear-gradient(120deg,#16306e 0%,#274ba3 60%,#3f78d8 100%)" }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-[12.5px] text-[var(--ink-3)]">
        New here?{" "}
        <Link href="/signup" className="font-bold text-[var(--brand-2,#2f6bd8)]">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ ...AUTH_LIGHT, background: "var(--bg)" }}>
      {/* useSearchParams requires a Suspense boundary during prerender */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
