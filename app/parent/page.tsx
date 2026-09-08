"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { FieldLabel, Input } from "@/components/ui";
import { AUTH_LIGHT, AosMark, AosWordmark } from "@/components/auth/AuthBrand";

/**
 * Parent entry point.
 *
 * Two paths on one card, because a parent arriving from the marketing site does
 * not know which they need:
 *   Sign in  — email + password, exactly the operator flow.
 *   Sign up  — find the provider first. A parent account only means anything in
 *              the context of the club their child attends, so the provider is
 *              asked for before the credentials.
 */
type Provider = { id: string; name: string; town?: string; postcode?: string };

// The directory is public (the parent has no account yet), so this bypasses the
// lib/api token wrapper — but it still has to reach the Express API, not Next.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const labelFor = (p: Provider) =>
  [p.name, [p.town, p.postcode].filter(Boolean).join(" ")].filter(Boolean).join(" — ");

function ParentAuth() {
  const router = useRouter();
  // The marketing "For parents" page links straight at the sign-up half
  // (/parent?tab=up), so honour that rather than always opening on sign in.
  const params = useSearchParams();
  const [tab, setTab] = useState<"in" | "up">(params.get("tab") === "up" ? "up" : "in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [provider, setProvider] = useState("");
  const [picked, setPicked] = useState<Provider | null>(null);
  const [results, setResults] = useState<Provider[] | null>(null);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [lookupDown, setLookupDown] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced provider search against the public directory
  // (server/src/routes/providers.ts). A failure is reported as "directory
  // unavailable" rather than silently showing an empty list — an empty list
  // would read as "your club isn't on Wigglekit", which is a different claim.
  useEffect(() => {
    if (tab !== "up") return;
    const q = provider.trim();
    if (picked && q === labelFor(picked)) return;
    if (q.length < 2) { setResults(null); setOpen(false); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/providers?q=${encodeURIComponent(q)}`, { signal: ctl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Provider[];
        setResults(data); setLookupDown(false); setOpen(true); setHi(0);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setResults([]); setLookupDown(true); setOpen(true);
      }
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [provider, tab, picked]);

  useEffect(() => {
    function away(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  function choose(p: Provider) {
    setPicked(p); setProvider(labelFor(p)); setOpen(false);
  }
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (tab === "up") {
      // The provider lookup and parent-account creation are not wired yet —
      // say so rather than failing silently or pretending it worked.
      setError(
        "Creating a parent account isn't connected yet. Ask your provider for their booking link, or sign in above if you already have an account.",
      );
      return;
    }

    setBusy(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      router.replace("/");
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/network-request-failed") {
        setError("Couldn't reach the sign-in service — an ad blocker or VPN may be blocking it.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts — please wait a minute and try again.");
      } else {
        setError("Sign-in failed — check your email and password.");
      }
      setBusy(false);
    }
  }

  const tabBtn = (id: "in" | "up", label: string) => (
    <button
      type="button"
      onClick={() => { setTab(id); setError(null); }}
      className="flex-1 rounded-[10px] px-4 py-2 text-[13.5px] font-extrabold transition"
      style={
        tab === id
          ? { background: "#fff", color: "var(--brand)", boxShadow: "0 1px 3px rgba(16,24,64,.10)" }
          : { background: "transparent", color: "var(--ink-2)" }
      }
    >
      {label}
    </button>
  );

  return (
    <div
      className="relative w-full max-w-[520px] rounded-[22px] bg-[var(--surface)] p-9 shadow-[0_24px_70px_-24px_rgba(20,30,90,.28)]"
      style={{ borderLeft: "4px solid #1d3a8f" }}
    >
      <div className="mb-5 flex items-center gap-2.5">
        <AosMark />
        <AosWordmark className="text-[19px] font-extrabold" />
      </div>

      <h1 className="text-[25px] font-extrabold tracking-[-0.01em]" style={{ fontFamily: "var(--ff-display)", color: "var(--ink)" }}>
        Parents
      </h1>
      <p className="mb-5 mt-1 text-[13.5px] text-[var(--ink-2)]">
        Book sessions, message the team and see your child&rsquo;s day.
      </p>

      <div className="mb-5 flex gap-1 rounded-[12px] p-1" style={{ background: "var(--panel)" }}>
        {tabBtn("in", "Sign in")}
        {tabBtn("up", "Create an account")}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3.5">
        {tab === "up" && (
          <div ref={boxRef} className="relative">
            <FieldLabel htmlFor="parent-provider">Your provider</FieldLabel>
            <Input
              id="parent-provider"
              role="combobox"
              aria-expanded={open}
              aria-autocomplete="list"
              aria-controls="provider-list"
              autoComplete="off"
              placeholder="Search clubs, camps or your child&rsquo;s school"
              value={provider}
              onChange={(e) => { setProvider(e.target.value); setPicked(null); }}
              onFocus={() => results && setOpen(true)}
              onKeyDown={(e) => {
                if (!open || !results?.length) return;
                if (e.key === "ArrowDown") { e.preventDefault(); setHi((i) => (i + 1) % results.length); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setHi((i) => (i - 1 + results.length) % results.length); }
                else if (e.key === "Enter") { e.preventDefault(); choose(results[hi]); }
                else if (e.key === "Escape") setOpen(false);
              }}
              className="w-full"
            />

            {open && (
              <ul
                id="provider-list"
                role="listbox"
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[240px] overflow-auto rounded-[12px] bg-white py-1 shadow-[0_18px_40px_-16px_rgba(16,35,86,.4)]"
                style={{ border: "1px solid var(--line)" }}
              >
                {lookupDown ? (
                  <li className="px-3 py-2.5 text-[12.5px] text-[var(--ink-2)]">
                    The provider directory isn&rsquo;t available right now. Ask your provider for their
                    booking link, or sign in if you already have an account.
                  </li>
                ) : results && results.length ? (
                  results.map((p, i) => (
                    <li key={p.id} role="option" aria-selected={i === hi}>
                      <button
                        type="button"
                        onMouseEnter={() => setHi(i)}
                        onClick={() => choose(p)}
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left"
                        style={{ background: i === hi ? "var(--brand-soft)" : "transparent" }}
                      >
                        <span className="text-[13.5px] font-extrabold" style={{ color: "var(--ink)" }}>{p.name}</span>
                        {(p.town || p.postcode) && (
                          <span className="text-[11.5px]" style={{ color: "var(--ink-2)" }}>
                            &#128205; {[p.town, p.postcode].filter(Boolean).join(" \u00b7 ")}
                          </span>
                        )}
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="px-3 py-2.5 text-[12.5px] text-[var(--ink-2)]">
                    No providers match &ldquo;{provider.trim()}&rdquo;.
                  </li>
                )}
              </ul>
            )}

            <p className="mt-1.5 text-[12px] text-[var(--ink-2)]">
              Your account sits with the provider your child attends.
            </p>
          </div>
        )}

        <div>
          <FieldLabel htmlFor="parent-email">Email</FieldLabel>
          <Input id="parent-email" type="email" required autoComplete="email" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
        </div>

        <div>
          <FieldLabel htmlFor="parent-password">Password</FieldLabel>
          <div className="relative">
            <Input id="parent-password" type={showPw ? "text" : "password"} required
              autoComplete={tab === "in" ? "current-password" : "new-password"}
              value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pr-14" />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] font-bold text-[var(--ink-2)]">
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {error && <div className="text-[12.5px]" style={{ color: "var(--red,#e21d27)" }}>{error}</div>}

        <button type="submit" disabled={busy}
          className="mt-1 rounded-[12px] px-4 py-3 text-[14px] font-extrabold text-white disabled:opacity-60"
          style={{ background: "linear-gradient(120deg,#16306e,#2f6bd8)" }}>
          {busy ? "Signing in…" : tab === "in" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-[12.5px] text-[var(--ink-2)]">
        Run a club or camp?{" "}
        <Link href="/login" className="font-extrabold" style={{ color: "var(--brand)" }}>
          Provider sign in
        </Link>
      </p>
    </div>
  );
}

export default function ParentPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ ...AUTH_LIGHT, background: "var(--bg)" }}>
      <Suspense fallback={null}>
        <ParentAuth />
      </Suspense>
    </div>
  );
}
