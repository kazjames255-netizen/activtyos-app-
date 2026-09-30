"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { fetchRoleHome } from "@/lib/roles";
import { ApiError, get as apiGet, isTwoFaRequired, post as apiPost, rawErrorMessage, withTimeout } from "@/lib/api";
import { FieldLabel, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { AUTH_LIGHT, AosMark, AosWordmark } from "@/components/auth/AuthBrand";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useAuth();
  const { t, locale } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set when the account signing in is one the parent CLOSED themselves: the
  // date it was closed ("" if unknown). They choose — reopen, or stay closed.
  const [closedAt, setClosedAt] = useState<string | null>(null);

  // Mandatory email 2FA for platform (HQ) accounts only — everyone else never
  // sees this. `stage: "2fa"` shows the code-entry step in place of the
  // sign-in form; `false` while it hasn't sent yet (see submit()/goHome()).
  const [stage, setStage] = useState<"form" | "2fa">("form");
  const [code, setCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resendCooldownMs, setResendCooldownMs] = useState(0);

  // A previous session's platform 2FA (12h TTL server-side) lapsed while a
  // page was open — PortalGuard bounced here rather than trying to
  // re-verify in place. Say why, plainly.
  useEffect(() => {
    if (params.get("notice") === "2fa") setNotice(t("p7login.reverify"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Counts down a resend cooldown the server itself enforced (429 +
  // retryAfterMs), so "Resend code" disables itself instead of just failing
  // again a moment later.
  useEffect(() => {
    if (resendCooldownMs <= 0) return;
    const iv = setInterval(() => setResendCooldownMs((ms) => Math.max(0, ms - 1000)), 1000);
    return () => clearInterval(iv);
  }, [resendCooldownMs]);

  async function sendTwoFaCode(): Promise<boolean> {
    setCodeError(null);
    try {
      const r = await apiPost<{ sent: boolean; expiresInMs: number }>("/api/auth/2fa/send", {});
      void r;
      setResendCooldownMs(30_000);
      return true;
    } catch (e) {
      if (isTwoFaRequired(e)) {
        // Shouldn't happen (we're already past the login gate that triggers
        // this), but if the session somehow lapsed mid-flow, send them back
        // to sign in fresh rather than looping on a send that will never work.
        setCodeError(t("p7login.sessionExpired"));
        setStage("form");
        return false;
      }
      if (e instanceof ApiError && e.status === 429) {
        const retryAfterMs = (e.body as { retryAfterMs?: number } | undefined)?.retryAfterMs ?? 30_000;
        setResendCooldownMs(retryAfterMs);
        // A code is already outstanding from the last send — that's fine,
        // the person can still enter it.
        return true;
      }
      setCodeError(e instanceof Error ? e.message : t("p7login.sendFail"));
      return false;
    }
  }

  async function verifyTwoFaCode(e: React.FormEvent) {
    e.preventDefault();
    setCodeError(null);
    setCodeBusy(true);
    try {
      await apiPost("/api/auth/2fa/verify", { code: code.trim() });
      await goHome();
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : t("p7login.codeWrong"));
      setCodeBusy(false);
    }
  }

  async function resetPassword() {
    setError(null);
    setNotice(null);
    if (!email) {
      setError(t("p7login.enterEmailFirst"));
      return;
    }
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim());
      setNotice(t("p7login.resetSent", { email }));
    } catch {
      setError(t("p7login.resetFail"));
    }
  }

  // Route to the account's home portal: an explicit ?next= wins, otherwise
  // ask the API who this account is (platform → Providers, company → its
  // Bookings, parent → Browse, …).
  //
  // First, always ask /api/me — even with a ?next= — because a platform
  // account that hasn't completed email 2FA gets a 403 `2fa_required` from
  // EVERY /api/* call (server: middleware/role.ts's attachRole), and honouring
  // `next` straight away would just land them on a page full of 403s before
  // bouncing them right back here.
  async function goHome() {
    try {
      await apiGet("/api/me");
    } catch (e) {
      if (isTwoFaRequired(e)) {
        setStage("2fa");
        setBusy(false);
        await sendTwoFaCode();
        return;
      }
      setError(t("p7login.noServer"));
      setBusy(false);
      return;
    }
    const next = params.get("next");
    if (next) { router.replace(next); return; }
    const home = await fetchRoleHome();
    // No home = we couldn't ask the API who this is. Stay put and say so, rather
    // than guessing a portal and landing an operator in the parent app.
    if (!home) { setError(t("p7login.noServer")); setBusy(false); return; }
    router.replace(home);
  }

  // A closed account refuses every request, so before loading anything ask
  // whether this is one — and if so, ask the parent rather than reopening it
  // just because they signed in. True = stop here (asking, or switched off).
  async function stopForClosedAccount(): Promise<boolean> {
    const st: { closed?: boolean; closedAt?: string | null } | Error = await apiGet<{ closed: boolean; closedAt: string | null }>("/api/account/reactivate").catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))));
    // Switched off by the provider — that's theirs to undo; say so.
    if (st instanceof Error && /switched off/i.test(rawErrorMessage(st))) { setError(st.message); setBusy(false); return true; }
    if (!(st instanceof Error) && st.closed) { setClosedAt(st.closedAt ?? ""); setBusy(false); return true; }
    return false;
  }

  async function reopenAccount() {
    setError(null);
    setBusy(true);
    try {
      await apiPost("/api/account/reactivate", { confirm: true });
      setClosedAt(null);
      setNotice(t("p7login.welcomeBack"));
      await goHome();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("p7login.reopenFail"));
      setBusy(false);
    }
  }

  async function keepClosed() {
    setError(null);
    await signOut(firebaseAuth).catch(() => {});
    setClosedAt(null);
    setPassword("");
    setNotice(t("p7login.keptClosed"));
  }

  // Already signed in (e.g. revisiting /login)? Skip the form. Not while the
  // 2FA step is showing — that's mid-flow, not "already signed in".
  useEffect(() => {
    if (!loading && user && !busy && closedAt === null && stage === "form") void (async () => { if (!(await stopForClosedAccount())) await goHome(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      // Firebase's own sign-in call talks straight to Google's servers, not ours, and has
      // no timeout of its own — a slow/blocked DNS lookup (identitytoolkit.googleapis.com)
      // used to leave the button stuck on "Signing in…" forever with no error at all.
      await withTimeout(signInWithEmailAndPassword(firebaseAuth, email.trim(), password), "Signing in");
      if (await stopForClosedAccount()) return;
      await goHome();
    } catch (err) {
      const errCode = (err as { code?: string })?.code ?? "";
      // A blocked/failed network request is NOT a wrong password — it's usually
      // an ad blocker / privacy extension / VPN in this browser profile stopping
      // the call to Google's sign-in service. Say so, rather than blaming the
      // credentials.
      if (err instanceof ApiError && err.status === 408) {
        setError(t("p7login.timeout"));
      } else if (errCode === "auth/network-request-failed" || /network|fetch|failed to fetch/i.test((err as Error)?.message ?? "")) {
        setError(t("p7login.network"));
      } else if (errCode === "auth/too-many-requests") {
        setError(t("p7login.tooMany"));
      } else {
        setError(t("p7login.signinFailed"));
      }
      setBusy(false);
    }
  }

  return (
    <div
      className="relative w-full max-w-[520px] overflow-hidden rounded-[22px] bg-[var(--surface)] p-9 shadow-[0_24px_70px_-24px_rgba(20,30,90,.28)]"
      style={{ borderInlineStart: "4px solid #1d3a8f" }}
    >
      <div className="mb-5 flex items-center gap-2.5">
        <AosMark />
        <AosWordmark className="text-[19px] font-extrabold" />
      </div>
      <h1 className="text-[25px] font-extrabold tracking-[-0.01em]" style={{ fontFamily: "var(--ff-display)", color: "var(--ink)" }}>
        {t("p7login.signIn")}
      </h1>
      <p className="mb-5 mt-1 text-[13.5px] text-[var(--ink-3)]">{t("p7login.welcome")}</p>
      {closedAt !== null ? (
        <div className="rounded-xl border border-[#cfe0f7] bg-[#f5f9ff] p-4">
          <div className="text-[15px] font-extrabold text-[var(--ink)]">
            {closedAt ? t("p7login.closedOnQ", { date: new Date(closedAt).toLocaleDateString(locale === "en" ? "en-GB" : locale, { day: "numeric", month: "long", year: "numeric" }) }) : t("p7login.closedQ")}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[var(--ink-3)]">{t("p7login.closedBody")}</p>
          {error && <div className="mt-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
          <div className="mt-3.5 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void reopenAccount()}
              className="rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(120deg,#16306e 0%,#274ba3 60%,#3f78d8 100%)" }}>
              {busy ? t("p7login.reopening") : t("p7login.yesReopen")}
            </button>
            <button type="button" disabled={busy} onClick={() => void keepClosed()}
              className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-[13.5px] font-bold text-[var(--ink-2)] disabled:opacity-60">
              {t("p7login.noKeep")}
            </button>
          </div>
        </div>
      ) : stage === "2fa" ? (
        <form onSubmit={verifyTwoFaCode} className="flex flex-col gap-3.5">
          <div className="rounded-xl border border-[#cfe0f7] bg-[#f5f9ff] p-4">
            <div className="text-[15px] font-extrabold text-[var(--ink)]">{t("p7login.checkEmail")}</div>
            <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[var(--ink-3)]">
              {t("p7login.twoFaBody")}
            </p>
          </div>
          <div>
            <FieldLabel htmlFor="login-2fa-code">{t("p7login.code6")}</FieldLabel>
            <Input id="login-2fa-code" type="text" inputMode="numeric" autoComplete="one-time-code" required
              maxLength={6} placeholder="123456" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="w-full tracking-[0.3em]" />
          </div>
          {codeError && <div className="text-[12.5px] text-[var(--red,#e21d27)]">{codeError}</div>}
          <button type="submit" disabled={codeBusy || code.trim().length < 4}
            className="mt-1 w-full rounded-xl py-3 text-[14.5px] font-extrabold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
            style={{ background: "linear-gradient(120deg,#16306e 0%,#274ba3 60%,#3f78d8 100%)" }}>
            {codeBusy ? t("p7login.verifying") : t("p7login.verify")}
          </button>
          <button type="button" disabled={resendCooldownMs > 0} onClick={() => void sendTwoFaCode()}
            className="text-[12px] font-bold text-[var(--brand-2,#2f6bd8)] disabled:cursor-default disabled:text-[var(--ink-3)]">
            {resendCooldownMs > 0 ? t("p7login.resendIn", { s: Math.ceil(resendCooldownMs / 1000) }) : t("p7login.resend")}
          </button>
          <button type="button"
            onClick={() => { setStage("form"); setCode(""); setCodeError(null); void signOut(firebaseAuth).catch(() => {}); }}
            className="text-[12px] font-bold text-[var(--ink-3)]">
            {t("p7login.otherAccount")}
          </button>
        </form>
      ) : (<>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <div>
          <FieldLabel htmlFor="login-email">{t("p7login.email")}</FieldLabel>
          <Input id="login-email" type="email" required autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
        </div>
        <div>
          <FieldLabel htmlFor="login-password">{t("p7login.password")}</FieldLabel>
          <div className="relative">
            <Input id="login-password" type={showPw ? "text" : "password"} required autoComplete="current-password"
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pe-14" />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[var(--ink-3)] hover:text-[var(--ink-2)]">
              {showPw ? t("p7login.hide") : t("p7login.show")}
            </button>
          </div>
          <div className="mt-1.5 text-end">
            <button type="button" onClick={resetPassword} className="text-[12px] font-bold text-[var(--brand-2,#2f6bd8)]">
              {t("p7login.forgot")}
            </button>
          </div>
        </div>
        {error && <div className="text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
        {notice && <div className="text-[12.5px] font-semibold text-[#1d3a8f]">{notice}</div>}
        <button type="submit" disabled={busy}
          className="mt-1 w-full rounded-xl py-3 text-[14.5px] font-extrabold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
          style={{ background: "linear-gradient(120deg,#16306e 0%,#274ba3 60%,#3f78d8 100%)" }}>
          {busy ? t("p7login.signingIn") : t("p7login.signIn")}
        </button>
      </form>
      <p className="mt-4 text-center text-[12.5px] text-[var(--ink-3)]">
        {t("p7login.newHere")}{" "}
        <Link href="/signup" className="font-bold text-[var(--brand-2,#2f6bd8)]">
          {t("p7login.create")}
        </Link>
      </p>
      </>)}
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
