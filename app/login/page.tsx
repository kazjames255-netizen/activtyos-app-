"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { fetchRoleHome } from "@/lib/roles";
import { Button, Card, FieldLabel, Input } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    } catch {
      setError("Sign-in failed — check your email and password.");
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-[380px] p-6">
      <h1 className="mb-1 text-[20px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
        ActivityOS
      </h1>
      <p className="mb-5 text-[13px] text-[var(--ink-3)]">Sign in to your workspace</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <FieldLabel>Email</FieldLabel>
          <Input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <FieldLabel>Password</FieldLabel>
            <button
              type="button"
              onClick={resetPassword}
              className="text-[11.5px] font-bold text-[var(--brand-2)]"
            >
              Forgot password?
            </button>
          </div>
          <Input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full"
          />
        </div>
        {error && <div className="text-[12.5px] text-[var(--red)]">{error}</div>}
        {notice && <div className="text-[12.5px] text-[var(--green,#15b364)]">{notice}</div>}
        <Button variant="solid" type="submit" disabled={busy} className="mt-1">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-4 text-[12.5px] text-[var(--ink-3)]">
        New here?{" "}
        <Link href="/signup" className="font-bold text-[var(--brand-2)]">
          Create an account
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
      {/* useSearchParams requires a Suspense boundary during prerender */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
