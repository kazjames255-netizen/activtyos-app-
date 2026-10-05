"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { post as apiPost, get as apiGet, api, rawErrorMessage } from "@/lib/api";
import { Button, Card, FieldLabel, Input } from "@/components/ui";
import { AUTH_LIGHT, AosMark } from "@/components/auth/AuthBrand";
import { useI18n, tNow } from "@/lib/i18n/provider";
import { safeNext } from "@/lib/safe-next";
import { isRTL } from "@/lib/i18n/config";

type AccountType = "parent" | "freelancer" | "company" | "franchise";

// Parents don't self-sign-up — a provider sends them a booking link — so only
// the operator tiers are offered here, matching the pricing page.
// A "Franchise Head Office" (franchisor) is its own tier — a company-role tenant
// on the FRANCHISE plan (different fees) with the franchisor tools (oversee &
// bill franchisees). It is NOT the same as a plain Company. Individual
// FRANCHISEES never self-sign-up: their Head Office sends them an invite link.
// label/desc are catalogue keys (p8pub.*), resolved at render time.
const ACCOUNT_TYPES: { value: AccountType; label: string; desc: string; icon: string; home: string }[] = [
  { value: "freelancer", label: "p8pub.suFreelancer", desc: "p8pub.suFreelancerD", icon: "⭐", home: "/freelancer/bookings" },
  { value: "company", label: "p8pub.suCompany", desc: "p8pub.suCompanyD", icon: "🏛️", home: "/company/bookings" },
  { value: "franchise", label: "p8pub.suFranchise", desc: "p8pub.suFranchiseD", icon: "🌐", home: "/company/bookings" },
];

const INVITE_HOME: Record<string, string> = { franchise: "/franchise/bookings", staff: "/staff/dash" };

// What a new provider runs — informational, seeded into settings and used to
// tailor copy later. Multi-select; "Other" is fine on its own.
// `v` is the English value stored on the tenant (never translated); `k` is the display key.
const ACTIVITY_KINDS: { v: string; k: string }[] = [
  { v: "Holiday camps", k: "p8pub.suKHoliday" }, { v: "After-school clubs", k: "p8pub.suKAfter" },
  { v: "Weekend classes", k: "p8pub.suKWeekend" }, { v: "Sports coaching", k: "p8pub.suKSports" },
  { v: "Nursery / early years", k: "p8pub.suKNursery" }, { v: "Tuition", k: "p8pub.suKTuition" },
  { v: "Music & arts", k: "p8pub.suKMusic" }, { v: "Other", k: "p8pub.suKOther" },
];

// Marketing attribution — single-select, big tappable cards.
// `label` is the English value sent as heardAbout (never translated); `k` is the display key.
const HEARD_OPTIONS: { label: string; k: string; icon: string }[] = [
  { label: "Google / search", k: "p8pub.suHGoogle", icon: "🔍" },
  { label: "Word of mouth", k: "p8pub.suHWord", icon: "💬" },
  { label: "Referred by a friend", k: "p8pub.suHFriend", icon: "🤝" },
  { label: "Facebook group", k: "p8pub.suHFb", icon: "👥" },
  { label: "Event or conference", k: "p8pub.suHEvent", icon: "🎟️" },
  { label: "Press or article", k: "p8pub.suHPress", icon: "📰" },
  { label: "Contacted by our team — email", k: "p8pub.suHEmail", icon: "✉️" },
  { label: "Contacted by our team — phone", k: "p8pub.suHPhone", icon: "📞" },
  { label: "Somewhere else", k: "p8pub.suHElse", icon: "✨" },
];

// Render "**bold**" segments of a catalogue string as <b>.
function rich(str: string): React.ReactNode {
  return str.split("**").map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>));
}

interface InvitePreview { role: "franchise" | "staff"; tenantName: string; franchiseName?: string | null; franchiseArea?: string | null; territoryByHo?: boolean }

// Per-step copy shown in the gradient hero.
type StepId = "type" | "you" | "business" | "identity" | "hear" | "login" | "payments";

// Legal versions a provider agrees to at sign-up (bump when the docs change so
// re-acceptance can be prompted). Stored on the tenant as evidence of consent.
const TERMS_VERSION = "2026-09-05";
const DPA_VERSION = "2026-09-05";
const STEP_META: Record<StepId, { emoji: string; title: string; lede: string }> = {
  type: { emoji: "", title: "p8pub.suTypeT", lede: "p8pub.suTypeL" },
  you: { emoji: "🙋", title: "p8pub.suYouT", lede: "p8pub.suYouL" },
  business: { emoji: "🏢", title: "p8pub.suBizT", lede: "p8pub.suBizL" },
  identity: { emoji: "🌟", title: "p8pub.suIdT", lede: "p8pub.suIdL" },
  hear: { emoji: "📣", title: "p8pub.suHearT", lede: "p8pub.suHearL" },
  login: { emoji: "🔑", title: "p8pub.suLoginT", lede: "p8pub.suLoginL" },
  payments: { emoji: "💳", title: "p8pub.suPayT", lede: "p8pub.suPayL" },
};

// Downscale a logo to a small square-ish PNG/JPEG under the /api/uploads cap
// (~900KB) before sending. Same approach as Setup's template logo upload.
async function compressLogo(dataUrl: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error(tNow("p8pub.suEImg")));
    i.src = dataUrl;
  });
  const max = 480;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  const png = canvas.toDataURL("image/png");
  if (png.length < 820_000) return png;
  return canvas.toDataURL("image/jpeg", 0.85);
}

// ── The wizard ───────────────────────────────────────────────────────────
// Signup provisions the account server-side:
//   Freelancer / Company  → creates their TENANT and seeds settings from the
//                           onboarding answers (business, what they run, where
//                           they're based, public name, logo, bank details,
//                           and how they heard about us)
//   With ?invite=TOKEN    → joins an existing tenant as franchise/staff
//   Parent                → a short path (parents normally arrive via a
//                           provider's link — kept for now)
function SignupForm() {
  const { t, locale } = useI18n();
  const arrow = isRTL(locale) ? "←" : "→";
  const backArrow = isRTL(locale) ? "→" : "←";
  const router = useRouter();
  const params = useSearchParams();
  const inviteToken = params.get("invite");
  // A provider sign-up invite link (Platform → Providers) carries `?ref=`.
  // Unlike ?invite (staff/franchise joining a tenant), this just creates a
  // normal provider account — we only keep the code for attribution.
  const referredBy = params.get("ref");
  // Parents don't use this operator wizard: point them at the parent sign-up (keeping any ?next).
  const nextRaw = safeNext(params.get("next"));
  const parentSignupHref = `/parent?tab=up${nextRaw ? `&next=${encodeURIComponent(nextRaw)}` : ""}`;
  // A pricing-page button can preselect the account type, e.g. /signup?plan=company.
  const planParam = params.get("plan");

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  // Franchise invites: HO grants a business name + area; the joiner confirms them
  // here. The service territory (map) is drawn later, on their own onboarding page
  // once they're in — not at this sign-up step.
  const [frName, setFrName] = useState("");
  const [frArea, setFrArea] = useState("");

  const [accountType, setAccountType] = useState<AccountType>(planParam === "company" ? "company" : planParam === "franchise" ? "franchise" : "freelancer");
  // Provider must accept the Terms + DPA before the account is created.
  const [agreed, setAgreed] = useState(false);
  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [name, setName] = useState("");
  const [providerNameMode, setProviderNameMode] = useState<"person" | "business">("business");
  const [postcode, setPostcode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [kinds, setKinds] = useState<string[]>([]);
  const [logo, setLogo] = useState<string>("");
  const [heard, setHeard] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Post-signup "Get paid" step. Bank details ride along with register-role;
  // Stripe is connected after the account exists (needs a tenant).
  const [bankName, setBankName] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [stripeBusy, setStripeBusy] = useState(false);
  const [stripeMsg, setStripeMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteToken) return;
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    fetch(`${base}/api/invites/${encodeURIComponent(inviteToken)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || t("p8pub.suEInvite"));
        const data: InvitePreview = await r.json();
        setInvite(data);
        if (data.role === "franchise") { setFrName(data.franchiseName || ""); setFrArea(data.franchiseArea || ""); }
      })
      .catch((e) => setInviteError(e instanceof Error ? e.message : t("p8pub.suEInvite")));
  }, [inviteToken]);

  // Whether the head office pre-filled this franchise's name/area on the invite.
  const frFromHo = Boolean(invite?.role === "franchise" && (invite?.franchiseName || invite?.franchiseArea));
  const isOperator = accountType !== "parent";
  const steps: StepId[] = useMemo(
    () => (isOperator ? ["type", "business", "identity", "hear", "login", "payments"] : ["type", "you", "login"]),
    [isOperator],
  );
  const current = steps[step];
  const toggleKind = (k: string) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  // The login email defaults to the contact email they already typed earlier —
  // one less thing to re-enter. Only prefills when they land on the login step
  // AND the field is still empty, so it never clobbers something they've edited.
  useEffect(() => {
    if (current === "login" && contactEmail.trim() && !email.trim()) setEmail(contactEmail.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  function stepProblem(id: StepId): string | null {
    if (id === "business") {
      if (businessName.trim().length < 2) return t("p8pub.suVBiz");
      // The server caps it at 80 (register-role) — and the login account is
      // created before that call, so an over-long name must stop here.
      if (businessName.trim().length > 80) return t("p8pub.suVBizLong");
      if (address.trim().length < 2) return t("p8pub.suVWhere");
      if (postcode.trim().length < 2) return t("p8pub.suVPostcode");
    }
    if (id === "identity" && providerNameMode === "person" && name.trim().length < 2)
      return t("p8pub.suVPerson");
    if (id === "hear" && !heard) return t("p8pub.suVHear");
    if (id === "login") {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return t("p8pub.suVEmail");
      if (password.length < 6) return t("p8pub.suVPw");
    }
    return null;
  }

  async function onLogoFile(file: File) {
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(new Error(tNow("p8pub.suEFile")));
        r.readAsDataURL(file);
      });
      setLogo(dataUrl.startsWith("data:image/") ? await compressLogo(dataUrl) : dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("p8pub.suELoadImg"));
    }
  }

  const homeUrl = ACCOUNT_TYPES.find((a) => a.value === accountType)!.home;

  function next() {
    const problem = stepProblem(current);
    if (problem) { setError(problem); return; }
    setError(null);
    // "login" is where the account is created. Operators then get one more
    // (optional) "payments" step; parents finish here. "payments" is the finish.
    if (current === "login") {
      if (isOperator && !agreed) { setError(t("p8pub.suVAgree")); return; }
      void submit(); return;
    }
    if (current === "payments") { void finishPayments(); return; }
    if (step < steps.length - 1) setStep(step + 1);
    else router.replace(homeUrl);
  }
  function back() { setError(null); setStep((s) => Math.max(0, s - 1)); }

  // Persist bank details entered on the "Get paid" step, then head to the
  // dashboard. Read-modify-write so we don't clobber the settings just seeded
  // by register-role (the library PUT replaces `settings` wholesale).
  async function finishPayments() {
    const hasBank = bankName.trim() || sortCode.trim() || accountNumber.trim();
    if (hasBank) {
      setBusy(true);
      try {
        const lib = await apiGet<{ settings?: Record<string, unknown> } | null>("/api/library");
        const settings = { ...(lib?.settings ?? {}) };
        const billing = { ...((settings.billing as Record<string, unknown>) ?? {}) };
        if (bankName.trim()) billing.bankName = bankName.trim();
        billing.accountName = billing.accountName ?? ((providerNameMode === "person" ? name.trim() : businessName.trim()) || businessName.trim());
        if (sortCode.trim()) billing.sortCode = sortCode.trim();
        if (accountNumber.trim()) billing.accountNumber = accountNumber.trim();
        settings.billing = billing;
        await api("/api/library", { method: "PUT", body: JSON.stringify({ settings }) });
      } catch {
        // Non-fatal — they can add bank details in Setup → Money any time.
      }
    }
    router.replace(homeUrl);
  }

  // Kick off Stripe Express onboarding from the payments step. The account and
  // tenant already exist by now, so /connect can create the Express account and
  // hand back a hosted onboarding URL (which returns to Finance when done).
  async function connectStripe() {
    setStripeMsg(null);
    setStripeBusy(true);
    try {
      const { url } = await apiPost<{ url: string }>("/api/payments/connect", {});
      window.location.href = url;
    } catch (err) {
      setStripeMsg(
        err instanceof Error && /configured/i.test(rawErrorMessage(err))
          ? t("p8pub.suEStripeOff")
          : err instanceof Error ? err.message : t("p8pub.suEStripe"),
      );
      setStripeBusy(false);
    }
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });

      let logoUrl: string | undefined;
      if (isOperator && logo) {
        try {
          const up = await api<{ url: string }>("/api/uploads", { method: "POST", body: JSON.stringify({ dataUrl: logo }) });
          logoUrl = up.url;
        } catch { /* non-fatal — they can add it in Setup */ }
      }

      // Franchise is a Company-type tenant (role "company") on the Franchise
      // plan — the backend only creates freelancer/company tenants; the tier
      // rides along as `plan` to seed the subscription.
      const role = accountType === "freelancer" ? "freelancer" : accountType === "parent" ? "parent" : "company";
      await apiPost("/api/register-role", {
        role,
        ...(accountType === "parent" && postcode.trim() ? { postcode: postcode.trim() } : {}),
        ...(isOperator
          ? {
              plan: accountType,
              businessName: businessName.trim(),
              providerNameMode,
              providerName: (providerNameMode === "person" ? name.trim() : businessName.trim()) || businessName.trim(),
              ...(kinds.length ? { activityKinds: kinds } : {}),
              ...(address.trim() ? { address: address.trim() } : {}),
              ...(postcode.trim() ? { postcode: postcode.trim() } : {}),
              ...(contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {}),
              ...(phone.trim() ? { phone: phone.trim() } : {}),
              ...(logoUrl ? { logoUrl } : {}),
              ...(heard ? { heardAbout: heard } : {}),
              ...(referredBy ? { referredBy } : {}),
              agreedTermsAt: new Date().toISOString(),
              termsVersion: TERMS_VERSION,
              dpaVersion: DPA_VERSION,
            }
          : {}),
      });
      // Operators get an optional "Get paid" step (Stripe needs the tenant to
      // exist first); parents go straight home.
      if (isOperator) {
        setBusy(false);
        setStep(steps.indexOf("payments"));
        return;
      }
      router.replace(homeUrl);
    } catch (err) {
      const code = (err as { code?: string }).code || "";
      setError(
        code === "auth/email-already-in-use" ? t("p8pub.suEInUse")
          : code === "auth/weak-password" ? t("p8pub.suEWeak")
          : code === "auth/invalid-email" ? t("p8pub.suEBadEmail")
          : code === "auth/too-many-requests" ? t("p7login.tooMany")
          : code === "auth/network-request-failed" ? t("p7login.network")
          : err instanceof Error && !code ? err.message
          : t("p8pub.suEFail"),
      );
      setBusy(false);
      setStep(steps.indexOf("login"));
    }
  }

  // ── Invite flow: a compact single form (franchise/staff join) ────────────
  if (inviteToken) {
    if (inviteError) {
      return (
        <Card className="w-full max-w-[460px] p-6" style={{ borderInlineStart: "4px solid #1d3a8f" }}>
          <h1 className="mb-2 text-[20px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("p8pub.suIvProblem")}</h1>
          <p className="text-[13px] text-[var(--red)]">{inviteError}</p>
          <p className="mt-3 text-[12.5px] text-[var(--ink-3)]">
            {t("p8pub.suIvAsk").split("{link}").flatMap((part, i, arr) => i < arr.length - 1 ? [part, <Link key={i} href="/signup" className="font-bold text-[var(--brand-2)]">{t("p8pub.suIvRegular")}</Link>] : [part])}
          </p>
        </Card>
      );
    }
    return (
      <Card className={`w-full overflow-hidden p-0 ${invite?.role === "franchise" ? "max-w-[840px]" : "max-w-[460px]"}`}>
        <Hero emoji="🎉" eyebrow={t("p8pub.suIvEyebrow")} title={invite ? t("p8pub.suIvJoin", { name: invite.tenantName }) : t("p8pub.suIvJoinTeam")}
          lede={invite ? (invite.role === "franchise" ? t("p8pub.suIvRunLede", { what: [invite.franchiseName, invite.franchiseArea && t("p8pub.suIvAreaFr", { area: invite.franchiseArea })].filter(Boolean).join(" · ") || t("p8pub.suIvAFr") }) : t("p8pub.suIvStaff")) : t("p8pub.suIvLoading")} />
        <form
          onSubmit={async (e) => {
            e.preventDefault(); setError(null);
            if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError(t("p8pub.suVEmail")); return; }
            if (password.length < 6) { setError(t("p8pub.suVPw")); return; }
            setBusy(true);
            try {
              const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
              if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
              const joined = await apiPost<{ role: string }>(`/api/invites/${encodeURIComponent(inviteToken)}/accept`,
                invite?.role === "franchise" ? {
                  franchiseName: frName.trim() || undefined,
                  franchiseArea: frArea.trim() || undefined,
                } : {});
              router.replace(INVITE_HOME[joined.role] ?? "/");
            } catch (err) {
              const code = (err as { code?: string }).code || "";
              setError(code === "auth/email-already-in-use" ? t("p8pub.suEInUse2") : code === "auth/weak-password" ? t("p8pub.suEWeak") : code === "auth/invalid-email" ? t("p8pub.suEBadEmail") : code === "auth/too-many-requests" ? t("p7login.tooMany") : code === "auth/network-request-failed" ? t("p7login.network") : err instanceof Error && !code ? err.message : t("p8pub.suEJoin"));
              setBusy(false);
            }
          }}
          className={`px-7 py-6 ${invite?.role === "franchise" ? "grid gap-5 md:grid-cols-2 md:items-start" : "flex flex-col gap-3.5"}`}
        >
          {invite?.role === "franchise" && (
            <div className="rounded-xl border-2 border-[#39426E] bg-[#392B73] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[12px] font-extrabold text-[#2f5fd0]">🌐 {t("p8pub.suIvYourFr")}</div>
                {frFromHo && <span className="rounded-full bg-[var(--raised)] px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-[#2f5fd0] ring-1 ring-[#39426E]">{t("p8pub.suIvSetHo")}</span>}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--ink-3)]">{frFromHo ? t("p8pub.suIvLocked") : t("p8pub.suIvConfirm")}</p>
              {frFromHo ? (
                <div className="mt-2.5 flex flex-col gap-2.5">
                  <div>
                    <FieldLabel htmlFor="iv-frname">{t("p8pub.suIvFrName")}</FieldLabel>
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-[#39426E] bg-white/80 px-3 py-2.5 text-[14px] font-bold text-white"><span className="truncate">{frName}</span><span className="flex-none text-[12px] text-[var(--ink-3)]" title={t("p8pub.suIvSetHo")}>🔒</span></div>
                  </div>
                  <div>
                    <FieldLabel htmlFor="iv-frarea">{t("p8pub.suIvArea")}</FieldLabel>
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-[#39426E] bg-white/80 px-3 py-2.5 text-[14px] font-bold text-white"><span className="truncate">{frArea}</span><span className="flex-none text-[12px] text-[var(--ink-3)]" title={t("p8pub.suIvSetHo")}>🔒</span></div>
                  </div>
                </div>
              ) : (
                <div className="mt-2.5 flex flex-col gap-2.5">
                  <div><FieldLabel htmlFor="iv-frname">{t("p8pub.suIvFrName")}</FieldLabel><Input id="iv-frname" value={frName} onChange={(e) => setFrName(e.target.value)} placeholder={t("p8pub.suEg", { x: "APF Activity Camps" })} className="w-full" /></div>
                  <div><FieldLabel htmlFor="iv-frarea">{t("p8pub.suIvArea")}</FieldLabel><Input id="iv-frarea" value={frArea} onChange={(e) => setFrArea(e.target.value)} placeholder={t("p8pub.suEg", { x: "London" })} className="w-full" /></div>
                </div>
              )}
              {(frName.trim() || frArea.trim()) && <div className="mt-2.5 rounded-lg bg-[var(--raised)] px-3 py-2 text-center text-[12px] font-extrabold uppercase tracking-wide text-[#2f5fd0] ring-1 ring-[#39426E]">{t("p8pub.suIvPreview", { name: frName.trim() || t("p8pub.suIvYourBrand"), area: frArea.trim() || t("p8pub.suIvAreaWord") })}</div>}
              <div className="mt-3 flex items-start gap-2 border-t border-[#39426E] pt-3 text-[11px] leading-snug text-[var(--ink-3)]">
                <span className="text-[13px] leading-none">🗺</span>
                {invite?.territoryByHo
                  ? <span className="[&_b]:text-[#2f5fd0]">{rich(t("p8pub.suIvTerrHo"))}</span>
                  : <span className="[&_b]:text-[#2f5fd0]">{rich(t("p8pub.suIvTerrSelf"))}</span>}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3.5">
            <div><FieldLabel htmlFor="iv-name">{t("p8pub.suYourName")}</FieldLabel><Input id="iv-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full" /></div>
            <div><FieldLabel htmlFor="iv-email">{t("p7login.email")}</FieldLabel><Input id="iv-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" /></div>
            <div><FieldLabel htmlFor="iv-pw">{t("p7login.password")}</FieldLabel><div className="relative"><Input id="iv-pw" type={showPw ? "text" : "password"} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pe-14" /><button type="button" onClick={() => setShowPw((v) => !v)} className="absolute end-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[var(--ink-3)] hover:text-[var(--ink-2)]">{showPw ? t("p7login.hide") : t("p7login.show")}</button></div></div>
            {error && <ErrorBox>{error}</ErrorBox>}
            <Button variant="primary" type="submit" disabled={busy || !invite} className="mt-1 h-11 w-full text-[14px]">{busy ? t("p8pub.suIvJoining") : invite ? t("p8pub.suIvJoin", { name: invite.tenantName }) : t("p8pub.suIvJoinBare")}</Button>
            <SignInLink />
          </div>
        </form>
      </Card>
    );
  }

  // ── Operator / parent wizard ─────────────────────────────────────────────
  const meta = STEP_META[current];
  const eyebrow = current === "payments" ? `🎉 ${t("p8pub.suEyebrowCreated")}` : current === "type" && referredBy ? `🎉 ${t("p8pub.suEyebrowInvited")}` : t("p8pub.suStepOf", { n: step + 1, total: steps.length });
  return (
    <Card className="w-full max-w-[640px] overflow-hidden p-0">
      <Hero emoji={meta.emoji} eyebrow={eyebrow} title={t(meta.title)} lede={t(meta.lede)} steps={steps} step={step} />

      <div className="px-7 pb-2 pt-6">
        {current === "type" && (
          <>
          <div className="grid gap-3 sm:grid-cols-3">
            {ACCOUNT_TYPES.map((at) => {
              const on = accountType === at.value;
              return (
                <button key={at.value} type="button" onClick={() => { setAccountType(at.value); setStep(0); }}
                  className="rounded-2xl border-2 p-4 text-start transition-all"
                  style={on ? { borderColor: "#1d3a8f", background: "var(--brand-soft)", boxShadow: "0 8px 22px -12px rgba(29,58,143,.5)" } : { borderColor: "var(--line)", background: "var(--surface)" }}>
                  <div className="text-[26px] leading-none">{at.icon}</div>
                  <div className="mt-2 text-[15px] font-extrabold" style={{ color: on ? "var(--brand-strong)" : "var(--ink)" }}>{t(at.label)}</div>
                  <div className="mt-0.5 text-[12px] leading-snug" style={{ color: on ? "var(--brand-strong)" : "var(--ink-3)" }}>{t(at.desc)}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[12px] leading-snug text-[var(--ink-2)]">
            <span className="me-1">🏬</span>{rich(t("p8pub.suSingleBranch"))}
          </div>
          <p className="mt-3 text-center text-[13px] text-[var(--ink-2)]">
            <Link href={parentSignupHref} data-testid="signup-im-parent" className="font-extrabold text-[var(--brand-2)]">{t("p8par.imParent")}</Link>
          </p>
          </>
        )}

        {current === "you" && (
          <div className="flex flex-col gap-4">
            <div><FieldLabel htmlFor="p-name">{t("p8pub.suYourName")}</FieldLabel><Input id="p-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("p8pub.suEg", { x: "Sam Taylor" })} className="w-full" /></div>
            <div>
              <FieldLabel htmlFor="p-pc">{t("p8pub.suPostcode")} <span className="font-normal text-[var(--ink-3)]">{t("p8pub.suOptional")}</span></FieldLabel>
              <Input id="p-pc" autoComplete="postal-code" value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} placeholder={t("p8pub.suEg", { x: "NN5 7EA" })} className="w-full" />
              <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">{t("p8pub.suPcHelp")}</p>
            </div>
          </div>
        )}

        {current === "business" && (
          <div className="flex flex-col gap-4">
            <div><FieldLabel htmlFor="b-name">{t("p8pub.suBizName")}</FieldLabel><Input id="b-name" required maxLength={80} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder={t("p8pub.suEg", { x: "APF Activity Camps" })} className="w-full" /></div>
            <div>
              <FieldLabel>{t("p8pub.suWhatRun")} <span className="font-normal text-[var(--ink-3)]">{t("p8pub.suPickAny")}</span></FieldLabel>
              <div className="mt-1 flex flex-wrap gap-2">
                {ACTIVITY_KINDS.map((k) => {
                  const on = kinds.includes(k.v);
                  return (
                    <button key={k.v} type="button" onClick={() => toggleKind(k.v)}
                      className="rounded-full border px-3.5 py-2 text-[13px] font-bold transition-colors"
                      style={on ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
                      {on ? "✓ " : ""}{t(k.k)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <FieldLabel>{t("p8pub.suWhereBased")}</FieldLabel>
              <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                <Input id="b-addr" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("p8pub.suStreetTown")} className="w-full" aria-label={t("p8pub.suAddress")} />
                <Input id="b-pc" required autoComplete="postal-code" value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} placeholder={t("p8pub.suPostcode")} className="w-full" aria-label={t("p8pub.suPostcode")} />
              </div>
              <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">{t("p8pub.suAddrHelp")}</p>
            </div>
            <div>
              <FieldLabel>{t("p8pub.suContactDetails")} <span className="font-normal normal-case text-[var(--ink-3)]">{t("p8pub.suContactShown")}</span></FieldLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input id="b-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder={t("p8pub.suContactEmailPh")} className="w-full" aria-label={t("p8pub.suContactEmail")} />
                <Input id="b-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("p8pub.suPhonePh")} className="w-full" aria-label={t("p8pub.suPhone")} />
              </div>
              <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">{t("p8pub.suEmailBlank")}</p>
            </div>
          </div>
        )}

        {current === "identity" && (
          <div className="flex flex-col gap-4">
            <div>
              <FieldLabel>{t("p8pub.suSeeYouAs")}</FieldLabel>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {([["business", t("p8pub.suMyBiz"), businessName.trim() || t("p8pub.suYourBizName")], ["person", t("p8pub.suMyName"), name.trim() || t("p8pub.suYourName")]] as const).map(([mode, heading, preview]) => {
                  const on = providerNameMode === mode;
                  return (
                    <button key={mode} type="button" onClick={() => setProviderNameMode(mode)} className="rounded-xl border-2 p-3 text-start transition-colors"
                      style={on ? { borderColor: "#1d3a8f", background: "var(--brand-soft)" } : { borderColor: "var(--line)", background: "var(--surface)" }}>
                      <div className="text-[11px] font-bold" style={{ color: on ? "var(--brand-strong)" : "var(--ink-3)" }}>{heading}</div>
                      <div className="truncate text-[14.5px] font-extrabold" style={{ color: on ? "var(--brand-strong)" : "var(--ink)" }}>{preview}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            {providerNameMode === "person" && (
              <div><FieldLabel htmlFor="i-name">{t("p8pub.suYourName")}</FieldLabel><Input id="i-name" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("p8pub.suEg", { x: "Sam Taylor" })} className="w-full" /></div>
            )}
            <div>
              <FieldLabel>{t("p8pub.suLogo")} <span className="font-normal text-[var(--ink-3)]">{t("p8pub.suLogoHelp")}</span></FieldLabel>
              <div className="flex items-center gap-3">
                {logo
                  ? <img src={logo} alt={t("p8pub.suLogoAlt")} className="h-12 max-w-[130px] rounded-lg border border-[var(--line)] object-contain" />
                  : <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-[var(--line)] text-[18px] text-[var(--ink-3)]">🖼️</div>}
                <label className="cursor-pointer rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[12.5px] font-bold text-[#1d3a8f]">
                  ⬆ {t("p8pub.suUpload")}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onLogoFile(f); e.target.value = ""; }} />
                </label>
                {logo && <button type="button" onClick={() => setLogo("")} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[var(--red)]">{t("p8pub.suRemove")}</button>}
              </div>
            </div>
          </div>
        )}

        {current === "hear" && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {HEARD_OPTIONS.map((o) => {
              const on = heard === o.label;
              return (
                <button key={o.label} type="button" onClick={() => setHeard(o.label)}
                  className="flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3.5 text-center transition-all"
                  style={on ? { borderColor: "#1d3a8f", background: "var(--brand-soft)", boxShadow: "0 8px 22px -14px rgba(29,58,143,.55)" } : { borderColor: "var(--line)", background: "var(--surface)" }}>
                  <span className="text-[22px] leading-none">{o.icon}</span>
                  <span className="text-[12px] font-bold leading-tight" style={{ color: on ? "var(--brand-strong)" : "var(--ink-2)" }}>{t(o.k)}</span>
                </button>
              );
            })}
          </div>
        )}

        {current === "login" && (
          <div className="flex flex-col gap-4">
            <div><FieldLabel htmlFor="l-email">{t("p7login.email")}</FieldLabel><Input id="l-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" /></div>
            <div><FieldLabel htmlFor="l-pw">{t("p7login.password")}</FieldLabel><div className="relative"><Input id="l-pw" type={showPw ? "text" : "password"} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("p8pub.suPwPh")} className="w-full pe-14" /><button type="button" onClick={() => setShowPw((v) => !v)} className="absolute end-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[var(--ink-3)] hover:text-[var(--ink-2)]">{showPw ? t("p7login.hide") : t("p7login.show")}</button></div></div>
            {isOperator && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 text-[12.5px] leading-snug text-[var(--ink-2)]">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 flex-none accent-[#FF3D7F]" />
                <span>{t("p8pub.suAgree").split(/(\{terms\}|\{dpa\}|\{privacy\})/).map((part, i) =>
                  part === "{terms}" ? <a key={i} href="/terms.html" target="_blank" rel="noreferrer" className="font-bold text-[#FF3D7F]">{t("p8pub.suTerms")}</a>
                  : part === "{dpa}" ? <a key={i} href="/dpa.html" target="_blank" rel="noreferrer" className="font-bold text-[#FF3D7F]">{t("p8pub.suDpa")}</a>
                  : part === "{privacy}" ? <a key={i} href="/privacy.html" target="_blank" rel="noreferrer" className="font-bold text-[#FF3D7F]">{t("p8pub.suPrivacy")}</a>
                  : <span key={i}>{part}</span>)}</span>
              </label>
            )}
          </div>
        )}

        {current === "payments" && (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl bg-[var(--brand-soft,#eef3ff)] px-4 py-3 text-[12.5px] font-semibold text-[var(--brand-ink,#16306e)]">
              🎉 {t("p8pub.suPayReady")}
            </div>

            {/* Card payments via Stripe — needs the tenant, which now exists. */}
            <div className="rounded-2xl border-2 border-[var(--line)] p-4">
              <div className="flex items-start gap-3">
                <div className="text-[24px] leading-none">💳</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-extrabold text-[var(--ink)]">{t("p8pub.suPayCard")}</div>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--ink-3)]">
                    {t("p8pub.suPayCardD")}
                  </p>
                  <button type="button" onClick={() => void connectStripe()} disabled={stripeBusy}
                    className="mt-2.5 rounded-full bg-[#635bff] px-4 py-2 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60">
                    {stripeBusy ? t("p8pub.suStripeBusy") : `${t("p8pub.suStripeBtn")} ${arrow}`}
                  </button>
                  {stripeMsg && <p className="mt-2 text-[11.5px] font-semibold text-[var(--red)]">{stripeMsg}</p>}
                </div>
              </div>
            </div>

            {/* Bank details — for invoices, TFC/voucher payouts and manual transfers. */}
            <div className="rounded-2xl border-2 border-[var(--line)] p-4">
              <div className="flex items-start gap-3">
                <div className="text-[24px] leading-none">🏦</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-extrabold text-[var(--ink)]">{t("p8pub.suPayBank")} <span className="font-normal text-[var(--ink-3)]">{t("p8pub.suOptional")}</span></div>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--ink-3)]">
                    {t("p8pub.suPayBankD")}
                  </p>
                  <div className="mt-3 flex flex-col gap-3">
                    <div><FieldLabel htmlFor="pay-bank">{t("p8pub.suBankName")}</FieldLabel><Input id="pay-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder={t("p8pub.suEg", { x: "Barclays" })} className="w-full" /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><FieldLabel htmlFor="pay-sort">{t("p8pub.suSortCode")}</FieldLabel><Input id="pay-sort" inputMode="numeric" value={sortCode} onChange={(e) => setSortCode(e.target.value)} placeholder="00-00-00" className="w-full" /></div>
                      <div><FieldLabel htmlFor="pay-acc">{t("p8pub.suAccNo")}</FieldLabel><Input id="pay-acc" inputMode="numeric" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="12345678" className="w-full" /></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && <ErrorBox className="mt-4">{error}</ErrorBox>}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--panel)] px-7 py-4">
        {current === "payments"
          // Account already exists — no going back, just skip the optional setup.
          ? <button type="button" onClick={() => router.replace(homeUrl)} disabled={busy} className="text-[13px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)] disabled:opacity-50">{t("p8pub.suSkip")} {arrow}</button>
          : step > 0
          ? <button type="button" onClick={back} disabled={busy} className="text-[13px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)] disabled:opacity-50">{backArrow} {t("p8pub.suBack")}</button>
          : <SignInLink inline />}
        <div className="flex items-center gap-3">
          <Button variant={current === "login" || current === "payments" ? "primary" : "solid"} type="button" onClick={next} disabled={busy || (current === "login" && isOperator && !agreed)} className="h-11 min-w-[150px] justify-center text-[14px]">
            {current === "payments"
              ? (busy ? t("p8pub.suSaving") : `${t("p8pub.suGoDash")} ${arrow}`)
              : current === "login"
              ? (busy ? t("p8pub.suCreating") : `🎉 ${t("p8pub.suCreate")}`)
              : `${t("p8pub.suContinue")} ${arrow}`}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Presentational helpers ───────────────────────────────────────────────
// Big, exciting gradient hero heading each step — the house blue with a soft
// spotlight, white copy, a gold eyebrow, and the step progress bar.
function Hero({ emoji, eyebrow, title, lede, steps, step }: { emoji: string; eyebrow: string; title: string; lede: string; steps?: StepId[]; step?: number }) {
  return (
    <div
      className="px-7 pb-7 pt-6 text-white"
      style={{ background: "radial-gradient(120% 160% at 15% -30%, rgba(120,170,255,.5) 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#274ba3 58%,#3f78d8 100%)" }}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <AosMark />
        <span className="text-[19px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span style={{ color: "#fff" }}>Activ</span><span style={{ color: "var(--gold, #f5b81f)" }}>ly</span>
        </span>
      </div>
      {typeof step === "number" && steps && (
        <div className="mb-4 flex items-center gap-1.5" aria-label={eyebrow}>
          {steps.map((s, i) => (
            <div key={s} className="h-1.5 flex-1 rounded-full transition-colors"
              style={{ background: i < step ? "rgba(255,255,255,.95)" : i === step ? "#ffd23f" : "rgba(255,255,255,.28)" }} />
          ))}
        </div>
      )}
      <div className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#ffd23f" }}>{eyebrow}</div>
      <h1 className="mt-1 flex items-center gap-2.5 text-[27px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)", color: "#fff" }}>
        {emoji && <span className="text-[26px]">{emoji}</span>}{title}
      </h1>
      <p className="mt-1.5 max-w-[440px] text-[13px] leading-snug text-white/85">{lede}</p>
    </div>
  );
}

function ErrorBox({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] font-bold text-[var(--red)] ${className}`}>{children}</div>;
}

function SignInLink({ inline }: { inline?: boolean } = {}) {
  const { t } = useI18n();
  return (
    <p className={inline ? "text-[13px] text-[var(--ink-3)]" : "text-center text-[12.5px] text-[var(--ink-3)]"}>
      {t("p8pub.suHaveAcct")}{" "}
      <Link href="/login" className="font-bold text-[var(--brand-2)]">{t("p7login.signIn")}</Link>
    </p>
  );
}

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ ...AUTH_LIGHT, background: "var(--bg)" }}>
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
