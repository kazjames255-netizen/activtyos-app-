"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { post as apiPost, api } from "@/lib/api";
import { Button, Card, FieldLabel, Input } from "@/components/ui";
import { AUTH_LIGHT, AosMark } from "@/components/auth/AuthBrand";

type AccountType = "parent" | "freelancer" | "company" | "franchise";

// Parents don't self-sign-up — a provider sends them a booking link — so only
// the three operator tiers are offered here, matching the pricing page.
// Franchise is a Company-type tenant on the Franchise plan (backend role
// "company"; the chosen tier drives the subscription plan).
const ACCOUNT_TYPES: { value: AccountType; label: string; desc: string; icon: string; home: string }[] = [
  { value: "freelancer", label: "Freelancer", desc: "For solo coaches & instructors — your own branding.", icon: "⭐", home: "/freelancer/bookings" },
  { value: "company", label: "Company", desc: "For established companies — priced by your team size.", icon: "🏛️", home: "/company/bookings" },
  { value: "franchise", label: "Franchise", desc: "For franchises & multi-venue groups — branded per franchisee.", icon: "🌐", home: "/company/bookings" },
];

const INVITE_HOME: Record<string, string> = { franchise: "/franchise/bookings", staff: "/staff/dash" };

// What a new provider runs — informational, seeded into settings and used to
// tailor copy later. Multi-select; "Other" is fine on its own.
const ACTIVITY_KINDS = [
  "Holiday camps", "After-school clubs", "Weekend classes", "Sports coaching",
  "Nursery / early years", "Tuition", "Music & arts", "Other",
];

// Marketing attribution — single-select, big tappable cards.
const HEARD_OPTIONS: { label: string; icon: string }[] = [
  { label: "Google / search", icon: "🔍" },
  { label: "Word of mouth", icon: "💬" },
  { label: "Referred by a friend", icon: "🤝" },
  { label: "Facebook group", icon: "👥" },
  { label: "Event or conference", icon: "🎟️" },
  { label: "Press or article", icon: "📰" },
  { label: "Contacted by our team — email", icon: "✉️" },
  { label: "Contacted by our team — phone", icon: "📞" },
  { label: "Somewhere else", icon: "✨" },
];

interface InvitePreview { role: "franchise" | "staff"; tenantName: string }

// Per-step copy shown in the gradient hero.
type StepId = "type" | "you" | "business" | "identity" | "hear" | "login";
const STEP_META: Record<StepId, { emoji: string; title: string; lede: string }> = {
  type: { emoji: "", title: "Let's get you set up", lede: "Choose how you’ll use ActivityOS." },
  you: { emoji: "🙋", title: "About you", lede: "So we can set up your account." },
  business: { emoji: "🏢", title: "About your business", lede: "This seeds your storefront, invoices and Setup." },
  identity: { emoji: "🌟", title: "How parents see you", lede: "Your public name on booking pages, and your logo." },
  hear: { emoji: "📣", title: "How did you hear about us?", lede: "Helps us reach more providers like you." },
  login: { emoji: "🔑", title: "Your login", lede: "Last step — this is how you’ll sign in." },
};

// Downscale a logo to a small square-ish PNG/JPEG under the /api/uploads cap
// (~900KB) before sending. Same approach as Setup's template logo upload.
async function compressLogo(dataUrl: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Couldn’t read that image"));
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
  const router = useRouter();
  const params = useSearchParams();
  const inviteToken = params.get("invite");
  // A provider sign-up invite link (Platform → Providers) carries `?ref=`.
  // Unlike ?invite (staff/franchise joining a tenant), this just creates a
  // normal provider account — we only keep the code for attribution.
  const referredBy = params.get("ref");
  // A pricing-page button can preselect the account type, e.g. /signup?plan=company.
  const planParam = params.get("plan");

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [accountType, setAccountType] = useState<AccountType>(planParam === "company" ? "company" : planParam === "franchise" ? "franchise" : "freelancer");
  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [name, setName] = useState("");
  const [providerNameMode, setProviderNameMode] = useState<"person" | "business">("business");
  const [postcode, setPostcode] = useState("");
  const [address, setAddress] = useState("");
  const [kinds, setKinds] = useState<string[]>([]);
  const [logo, setLogo] = useState<string>("");
  const [heard, setHeard] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!inviteToken) return;
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    fetch(`${base}/api/invites/${encodeURIComponent(inviteToken)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || "Invalid invite");
        setInvite(await r.json());
      })
      .catch((e) => setInviteError(e instanceof Error ? e.message : "Invalid invite"));
  }, [inviteToken]);

  const isOperator = accountType !== "parent";
  const steps: StepId[] = useMemo(
    () => (isOperator ? ["type", "business", "identity", "hear", "login"] : ["type", "you", "login"]),
    [isOperator],
  );
  const current = steps[step];
  const toggleKind = (k: string) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  function stepProblem(id: StepId): string | null {
    if (id === "business") {
      if (businessName.trim().length < 2) return "Enter your business name.";
      if (address.trim().length < 2) return "Tell us where you’re based.";
      if (postcode.trim().length < 2) return "Add your postcode.";
    }
    if (id === "identity" && providerNameMode === "person" && name.trim().length < 2)
      return "Enter your name, or choose to show your business name to parents.";
    if (id === "hear" && !heard) return "Pick one — it really helps us.";
    if (id === "login") {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Enter a valid email address.";
      if (password.length < 6) return "Password must be at least 6 characters.";
    }
    return null;
  }

  async function onLogoFile(file: File) {
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(new Error("Couldn’t read that file"));
        r.readAsDataURL(file);
      });
      setLogo(dataUrl.startsWith("data:image/") ? await compressLogo(dataUrl) : dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t load that image.");
    }
  }

  function next() {
    const problem = stepProblem(current);
    if (problem) { setError(problem); return; }
    setError(null);
    if (step < steps.length - 1) setStep(step + 1);
    else void submit();
  }
  function back() { setError(null); setStep((s) => Math.max(0, s - 1)); }

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
              ...(logoUrl ? { logoUrl } : {}),
              ...(heard ? { heardAbout: heard } : {}),
              ...(referredBy ? { referredBy } : {}),
            }
          : {}),
      });
      router.replace(ACCOUNT_TYPES.find((t) => t.value === accountType)!.home);
    } catch (err) {
      const code = (err as { code?: string }).code || "";
      setError(
        code === "auth/email-already-in-use" ? "That email already has an account — try signing in instead."
          : code === "auth/weak-password" ? "Password is too weak (minimum 6 characters)."
          : code === "auth/invalid-email" ? "That email address doesn’t look right."
          : err instanceof Error ? err.message
          : "Sign-up failed — check the details and try again.",
      );
      setBusy(false);
      setStep(steps.length - 1);
    }
  }

  // ── Invite flow: a compact single form (franchise/staff join) ────────────
  if (inviteToken) {
    if (inviteError) {
      return (
        <Card className="w-full max-w-[460px] p-6" style={{ borderLeft: "4px solid #1d3a8f" }}>
          <h1 className="mb-2 text-[20px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Invite problem</h1>
          <p className="text-[13px] text-[var(--red)]">{inviteError}</p>
          <p className="mt-3 text-[12.5px] text-[var(--ink-3)]">
            Ask the person who invited you for a fresh link, or{" "}
            <Link href="/signup" className="font-bold text-[var(--brand-2)]">create a regular account</Link>.
          </p>
        </Card>
      );
    }
    return (
      <Card className="w-full max-w-[460px] overflow-hidden p-0">
        <Hero emoji="🎉" eyebrow="You're invited" title={invite ? `Join ${invite.tenantName}` : "Join your team"}
          lede={invite ? `You've been invited as ${invite.role === "franchise" ? "a franchise" : "staff"}.` : "Loading your invite…"} />
        <form
          onSubmit={async (e) => {
            e.preventDefault(); setError(null);
            if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError("Enter a valid email address."); return; }
            if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
            setBusy(true);
            try {
              const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
              if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
              const joined = await apiPost<{ role: string }>(`/api/invites/${encodeURIComponent(inviteToken)}/accept`, {});
              router.replace(INVITE_HOME[joined.role] ?? "/");
            } catch (err) {
              const code = (err as { code?: string }).code || "";
              setError(code === "auth/email-already-in-use" ? "That email already has an account — sign in instead." : err instanceof Error ? err.message : "Couldn’t join — try again.");
              setBusy(false);
            }
          }}
          className="flex flex-col gap-3.5 px-7 py-6"
        >
          <div><FieldLabel htmlFor="iv-name">Your name</FieldLabel><Input id="iv-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full" /></div>
          <div><FieldLabel htmlFor="iv-email">Email</FieldLabel><Input id="iv-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" /></div>
          <div><FieldLabel htmlFor="iv-pw">Password</FieldLabel><Input id="iv-pw" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full" /></div>
          {error && <ErrorBox>{error}</ErrorBox>}
          <Button variant="primary" type="submit" disabled={busy || !invite} className="mt-1 h-11 w-full text-[14px]">{busy ? "Joining…" : invite ? `Join ${invite.tenantName}` : "Join"}</Button>
          <SignInLink />
        </form>
      </Card>
    );
  }

  // ── Operator / parent wizard ─────────────────────────────────────────────
  const lastStep = step === steps.length - 1;
  const meta = STEP_META[current];
  const eyebrow = current === "type" && referredBy ? "🎉 You're invited to ActivityOS" : `Step ${step + 1} of ${steps.length}`;
  return (
    <Card className="w-full max-w-[640px] overflow-hidden p-0">
      <Hero emoji={meta.emoji} eyebrow={eyebrow} title={meta.title} lede={meta.lede} steps={steps} step={step} />

      <div className="px-7 pb-2 pt-6">
        {current === "type" && (
          <div className="grid gap-3 sm:grid-cols-3">
            {ACCOUNT_TYPES.map((t) => {
              const on = accountType === t.value;
              return (
                <button key={t.value} type="button" onClick={() => { setAccountType(t.value); setStep(0); }}
                  className="rounded-2xl border-2 p-4 text-left transition-all"
                  style={on ? { borderColor: "#1d3a8f", background: "var(--brand-soft)", boxShadow: "0 8px 22px -12px rgba(29,58,143,.5)" } : { borderColor: "var(--line)", background: "var(--surface)" }}>
                  <div className="text-[26px] leading-none">{t.icon}</div>
                  <div className="mt-2 text-[15px] font-extrabold" style={{ color: on ? "var(--brand-ink)" : "var(--ink)" }}>{t.label}</div>
                  <div className="mt-0.5 text-[12px] leading-snug" style={{ color: on ? "var(--brand-strong)" : "var(--ink-3)" }}>{t.desc}</div>
                </button>
              );
            })}
          </div>
        )}

        {current === "you" && (
          <div className="flex flex-col gap-4">
            <div><FieldLabel htmlFor="p-name">Your name</FieldLabel><Input id="p-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam Taylor" className="w-full" /></div>
            <div>
              <FieldLabel htmlFor="p-pc">Postcode <span className="font-normal text-[var(--ink-3)]">— optional</span></FieldLabel>
              <Input id="p-pc" autoComplete="postal-code" value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} placeholder="e.g. NN5 7EA" className="w-full" />
              <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">Lets us show you activities nearest to you. You can change it later.</p>
            </div>
          </div>
        )}

        {current === "business" && (
          <div className="flex flex-col gap-4">
            <div><FieldLabel htmlFor="b-name">Business name</FieldLabel><Input id="b-name" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. APF Activity Camps" className="w-full" /></div>
            <div>
              <FieldLabel>What do you run? <span className="font-normal text-[var(--ink-3)]">— pick any</span></FieldLabel>
              <div className="mt-1 flex flex-wrap gap-2">
                {ACTIVITY_KINDS.map((k) => {
                  const on = kinds.includes(k);
                  return (
                    <button key={k} type="button" onClick={() => toggleKind(k)}
                      className="rounded-full border px-3.5 py-2 text-[13px] font-bold transition-colors"
                      style={on ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
                      {on ? "✓ " : ""}{k}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <FieldLabel>Where are you based?</FieldLabel>
              <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                <Input id="b-addr" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, town" className="w-full" aria-label="Address" />
                <Input id="b-pc" required autoComplete="postal-code" value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} placeholder="Postcode" className="w-full" aria-label="Postcode" />
              </div>
              <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">Used on your invoices and to show families how near you are.</p>
            </div>
          </div>
        )}

        {current === "identity" && (
          <div className="flex flex-col gap-4">
            <div>
              <FieldLabel>What should parents see you as?</FieldLabel>
              <div className="grid grid-cols-2 gap-2.5">
                {([["business", "My business name", businessName.trim() || "Your business name"], ["person", "My own name", name.trim() || "Your name"]] as const).map(([mode, heading, preview]) => {
                  const on = providerNameMode === mode;
                  return (
                    <button key={mode} type="button" onClick={() => setProviderNameMode(mode)} className="rounded-xl border-2 p-3 text-left transition-colors"
                      style={on ? { borderColor: "#1d3a8f", background: "var(--brand-soft)" } : { borderColor: "var(--line)", background: "var(--surface)" }}>
                      <div className="text-[11px] font-bold" style={{ color: on ? "var(--brand-strong)" : "var(--ink-3)" }}>{heading}</div>
                      <div className="truncate text-[14.5px] font-extrabold" style={{ color: on ? "var(--brand-ink)" : "var(--ink)" }}>{preview}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            {providerNameMode === "person" && (
              <div><FieldLabel htmlFor="i-name">Your name</FieldLabel><Input id="i-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam Taylor" className="w-full" /></div>
            )}
            <div>
              <FieldLabel>Logo <span className="font-normal text-[var(--ink-3)]">— optional, shows on invoices & your page</span></FieldLabel>
              <div className="flex items-center gap-3">
                {logo
                  ? <img src={logo} alt="logo preview" className="h-12 max-w-[130px] rounded-lg border border-[var(--line)] object-contain" />
                  : <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-[var(--line)] text-[18px] text-[var(--ink-3)]">🖼️</div>}
                <label className="cursor-pointer rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[12.5px] font-bold text-[#1d3a8f]">
                  ⬆ Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onLogoFile(f); e.target.value = ""; }} />
                </label>
                {logo && <button type="button" onClick={() => setLogo("")} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[var(--red)]">Remove</button>}
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
                  <span className="text-[12px] font-bold leading-tight" style={{ color: on ? "var(--brand-ink)" : "var(--ink-2)" }}>{o.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {current === "login" && (
          <div className="flex flex-col gap-4">
            <div><FieldLabel htmlFor="l-email">Email</FieldLabel><Input id="l-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" /></div>
            <div><FieldLabel htmlFor="l-pw">Password</FieldLabel><Input id="l-pw" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="w-full" /></div>
          </div>
        )}

        {error && <ErrorBox className="mt-4">{error}</ErrorBox>}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--panel)] px-7 py-4">
        {step > 0
          ? <button type="button" onClick={back} disabled={busy} className="text-[13px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)] disabled:opacity-50">← Back</button>
          : <SignInLink inline />}
        <div className="flex items-center gap-3">
          <Button variant={lastStep ? "primary" : "solid"} type="button" onClick={next} disabled={busy} className="h-11 min-w-[150px] justify-center text-[14px]">
            {busy ? "Creating…" : lastStep ? "🎉 Create account" : "Continue →"}
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
          <span style={{ color: "#fff" }}>Activity</span><span style={{ color: "#EE1F63" }}>OS</span>
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
  return (
    <p className={inline ? "text-[13px] text-[var(--ink-3)]" : "text-center text-[12.5px] text-[var(--ink-3)]"}>
      Already have an account?{" "}
      <Link href="/login" className="font-bold text-[var(--brand-2)]">Sign in</Link>
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
