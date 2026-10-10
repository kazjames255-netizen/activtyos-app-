"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { safeNext } from "@/lib/safe-next";
import { post as apiPost } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase/client";
import { FieldLabel, Input } from "@/components/ui";
import { AddressFields, type PostcodeState } from "@/features/common/AddressFields";
import { composeAddress, isFullAddress, type AddressParts } from "@/lib/addressComplete";
import { AUTH_LIGHT, AuthLogo } from "@/components/auth/AuthBrand";
import { useT } from "@/lib/i18n/provider";

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
type Provider = { id: string; name: string; town?: string; postcode?: string; emailHint?: string; fullAddress?: string };

// The directory is public (the parent has no account yet), so this bypasses the
// lib/api token wrapper — but it still has to reach the Express API, not Next.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const labelFor = (p: Provider) =>
  [p.name, [p.town, p.postcode].filter(Boolean).join(" ")].filter(Boolean).join(" — ");

function ParentAuth() {
  const t = useT();
  const router = useRouter();
  // The marketing "For parents" page links straight at the sign-up half
  // (/parent?tab=up), so honour that rather than always opening on sign in.
  const params = useSearchParams();
  // Where to go after sign-up / sign-in (e.g. back to the booking page).
  const next = safeNext(params.get("next"));
  const [tab, setTab] = useState<"in" | "up">(params.get("tab") === "up" ? "up" : "in");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  // The parent's FULL home address is compulsory (a home-visit provider has to find the door): house number/name, street, town, postcode.
  const [home, setHome] = useState<AddressParts>({ house: "", street: "", town: "", postcode: "" });
  const [homePc, setHomePc] = useState<PostcodeState>("idle");
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
  // would read as "your club isn't on ActivityLane", which is a different claim.
  useEffect(() => {
    if (tab !== "up") return;
    const q = provider.trim();
    if (picked && q === labelFor(picked)) return;
    if (q.length < 2) { setResults(null); setOpen(false); return; }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
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
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [provider, tab, picked]);

  // Arriving from a provider's booking page (?provider=<id>): the club is already known, so pre-pick it instead of making them search again.
  const presetId = params.get("provider");
  useEffect(() => {
    if (!presetId) return;
    const ctl = new AbortController();
    fetch(`${API_BASE}/api/providers?id=${encodeURIComponent(presetId)}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Provider[]) => { if (rows[0]) { setPicked(rows[0]); setProvider(labelFor(rows[0])); } })
      .catch(() => {});
    return () => ctl.abort();
  }, [presetId]);

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
      // A parent account only means something next to the club their child attends, so the provider must be picked from the directory first.
      if (!picked) { setError(t("p8par.lgPickProvider")); return; }
      const fn = firstName.trim(), ln = lastName.trim();
      if (!fn || !ln) { setError(t("p9jr.parentNameRequired")); return; }
      if (!isFullAddress(composeAddress(home), home.postcode)) { setError(home.house.trim() && home.street.trim() && home.town.trim() && home.postcode.trim() ? t("p7ck.pcFormat") : t("p7ck.adrIncomplete")); return; }
      if (homePc === "bad") { setError(t("p7ck.pcNotFoundMsg")); return; }
      if (password.length < 6) { setError(t("p8par.lgPwShort")); return; }
      setBusy(true);
      try {
        const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        try {
          // The name goes on the sign-in profile first, so the token the API sees (and every booking, message and Families row after it) carries "First Last", not an email handle.
          await updateProfile(cred.user, { displayName: `${fn} ${ln}` });
          await cred.user.getIdToken(true);
          await apiPost("/api/register-role", { role: "parent", providerId: picked.id, firstName: fn, lastName: ln, address: composeAddress(home), postcode: home.postcode.trim().toUpperCase() });
        } catch {
          setError(t("p8par.lgCreateFailed"));
          setBusy(false);
          return;
        }
        // into the parent portal (home = the Home dashboard); the account already remembers the chosen provider
        router.replace(next ?? "/custdash/home");
      } catch (err) {
        const code = (err as { code?: string })?.code ?? "";
        if (code === "auth/email-already-in-use") setError(t("p8par.lgEmailTaken"));
        else if (code === "auth/weak-password") setError(t("p8par.lgPwShort"));
        else if (code === "auth/network-request-failed") setError(t("p8par.lgNetwork"));
        else setError(t("p8par.lgCreateFailed"));
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      router.replace(next ?? "/");
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/network-request-failed") {
        setError(t("p8par.lgNetwork"));
      } else if (code === "auth/too-many-requests") {
        setError(t("p7login.tooMany"));
      } else {
        setError(t("p7login.signinFailed"));
      }
      setBusy(false);
    }
  }

  const tabBtn = (id: "in" | "up", label: string) => (
    <button
      type="button"
      onClick={() => { setTab(id); setError(null); }}
      className="flex-1 rounded-[10px] px-4 py-3 text-[15.5px] font-extrabold transition"
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
      className="relative w-full max-w-[720px] rounded-[22px] bg-[var(--surface)] p-12 shadow-[0_24px_70px_-24px_rgba(20,30,90,.28)]"
      style={{ borderInlineStart: "4px solid #1d3a8f" }}
    >
      <div className="mb-5">
        <AuthLogo />
      </div>

      <h1 className="text-[34px] font-extrabold tracking-[-0.01em]" style={{ fontFamily: "var(--ff-display)", color: "var(--ink)" }}>
        {t("p8par.lgTitle")}
      </h1>
      <p className="mb-5 mt-1 text-[16px] text-[var(--ink-2)]">
        {t("p8par.lgSub")}
      </p>

      <div className="mb-5 flex gap-1 rounded-[12px] p-1" style={{ background: "var(--panel)" }}>
        {tabBtn("in", t("p7login.signIn"))}
        {tabBtn("up", t("p7login.create"))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3.5">
        {tab === "up" && (
          <div ref={boxRef} className="relative">
            <FieldLabel htmlFor="parent-provider">{t("p8par.lgProvider")}</FieldLabel>
            <Input
              id="parent-provider"
              role="combobox"
              aria-expanded={open}
              aria-autocomplete="list"
              aria-controls="provider-list"
              autoComplete="off"
              placeholder={t("p8par.lgSearch")}
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
                className="absolute start-0 end-0 top-full z-20 mt-1 max-h-[240px] overflow-auto rounded-[12px] bg-white py-1 shadow-[0_18px_40px_-16px_rgba(16,35,86,.4)]"
                style={{ border: "1px solid var(--line)" }}
              >
                {lookupDown ? (
                  <li className="px-3 py-2.5 text-[12.5px] text-[var(--ink-2)]">
                    {t("p8par.lgDirDown")}
                  </li>
                ) : results && results.length ? (
                  results.map((p, i) => (
                    <li key={p.id} role="option" aria-selected={i === hi}>
                      <button
                        type="button"
                        onMouseEnter={() => setHi(i)}
                        onClick={() => choose(p)}
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-start"
                        style={{ background: i === hi ? "var(--brand-soft)" : "transparent" }}
                      >
                        <span className="text-[13.5px] font-extrabold" style={{ color: "var(--ink)" }}>{p.name}</span>
                        {(p.fullAddress || p.town || p.postcode) && (
                          <span className="text-[11.5px]" style={{ color: "var(--ink-2)" }}>
                            &#128205; {p.fullAddress ? p.fullAddress : [p.town, p.postcode].filter(Boolean).join(" \u00b7 ")}
                          </span>
                        )}
                        {p.emailHint && (
                          <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                            &#9993; {p.emailHint}
                          </span>
                        )}
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="px-3 py-2.5 text-[12.5px] text-[var(--ink-2)]">
                    {t("p8par.lgNoMatch", { q: provider.trim() })}
                  </li>
                )}
              </ul>
            )}

            <p className="mt-1.5 text-[12px] text-[var(--ink-2)]">
              {t("p8par.lgAcctSits")}
            </p>
          </div>
        )}

        {tab === "up" && (
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="parent-first">{t("p9jr.firstName")}</FieldLabel>
              <Input id="parent-first" required autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full" />
            </div>
            <div>
              <FieldLabel htmlFor="parent-last">{t("p9jr.lastName")}</FieldLabel>
              <Input id="parent-last" required autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full" />
            </div>
          </div>
        )}

        {tab === "up" && (
          <AddressFields value={home} onChange={setHome} idPrefix="parent" onPostcodeState={setHomePc} />
        )}

        <div>
          <FieldLabel htmlFor="parent-email">{t("p7login.email")}</FieldLabel>
          <Input id="parent-email" type="email" required autoComplete="email" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
        </div>

        <div>
          <FieldLabel htmlFor="parent-password">{t("p7login.password")}</FieldLabel>
          <div className="relative">
            <Input id="parent-password" type={showPw ? "text" : "password"} required
              autoComplete={tab === "in" ? "current-password" : "new-password"}
              value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pe-14" />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-[12.5px] font-bold text-[var(--ink-2)]">
              {showPw ? t("p7login.hide") : t("p7login.show")}
            </button>
          </div>
        </div>

        {error && <div className="text-[12.5px]" style={{ color: "var(--red,#e21d27)" }}>{error}</div>}

        <button type="submit" disabled={busy}
          className="mt-1 rounded-[12px] px-4 py-3 text-[14px] font-extrabold text-white disabled:opacity-60"
          style={{ background: "linear-gradient(120deg,#16306e,#2f6bd8)" }}>
          {busy ? t("p7login.signingIn") : tab === "in" ? t("p7login.signIn") : t("p8par.lgCreateBtn")}
        </button>
      </form>

      <p className="mt-5 text-center text-[12.5px] text-[var(--ink-2)]">
        {t("p8par.lgRunClub")}{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-extrabold" style={{ color: "var(--brand)" }}>
          {t("p8par.lgProviderSignIn")}
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
