"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { post as apiPost } from "@/lib/api";
import { Button, Card, FieldLabel, Input } from "@/components/ui";
import { AUTH_LIGHT, AosMark, AosWordmark } from "@/components/auth/AuthBrand";

type AccountType = "parent" | "freelancer" | "company";

const ACCOUNT_TYPES: { value: AccountType; label: string; desc: string; home: string }[] = [
  {
    value: "parent",
    label: "Parent",
    desc: "Browse activities and book places for your children.",
    home: "/custdash/browse",
  },
  {
    value: "freelancer",
    label: "Freelancer",
    desc: "Solo operator — your own camps and clubs.",
    home: "/freelancer/bookings",
  },
  {
    value: "company",
    label: "Company / Head Office",
    desc: "A company or franchise network HQ.",
    home: "/company/bookings",
  },
];

const INVITE_HOME: Record<string, string> = {
  franchise: "/franchise/bookings",
  staff: "/staff/dash",
};

interface InvitePreview {
  role: "franchise" | "staff";
  tenantName: string;
}

// Signup provisions the account server-side:
//   Parent                       → parent account
//   Freelancer / Company         → creates their TENANT (business name)
//   With ?invite=TOKEN           → joins an existing tenant as franchise/staff
// Franchise and staff cannot self-register without an invite (the product
// spec's invite flows, minus email delivery for now).
function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteToken = params.get("invite");

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<AccountType>("parent");
  const [businessName, setBusinessName] = useState("");
  const [name, setName] = useState("");
  // What parents see this provider called — their own name or the business name.
  const [providerNameMode, setProviderNameMode] = useState<"person" | "business">("business");
  // Parent's postcode — captured here so browse can sort by distance without asking.
  const [postcode, setPostcode] = useState("");
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

  const needsBusinessName = !inviteToken && accountType !== "parent";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (needsBusinessName && businessName.trim().length < 2) {
      setError("Enter your business name.");
      return;
    }
    if (needsBusinessName && providerNameMode === "person" && name.trim().length < 2) {
      setError("Enter your name, or choose to show your business name to parents.");
      return;
    }
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });

      if (inviteToken) {
        const joined = await apiPost<{ role: string }>(
          `/api/invites/${encodeURIComponent(inviteToken)}/accept`,
          {},
        );
        router.replace(INVITE_HOME[joined.role] ?? "/");
        return;
      }

      await apiPost("/api/register-role", {
        role: accountType,
        ...(accountType === "parent" && postcode.trim() ? { postcode: postcode.trim() } : {}),
        ...(needsBusinessName
          ? {
              businessName: businessName.trim(),
              providerNameMode,
              providerName:
                (providerNameMode === "person" ? name.trim() : businessName.trim()) || businessName.trim(),
            }
          : {}),
      });
      router.replace(ACCOUNT_TYPES.find((t) => t.value === accountType)!.home);
    } catch (err) {
      const code = (err as { code?: string }).code || "";
      setError(
        code === "auth/email-already-in-use"
          ? "That email already has an account — try signing in instead."
          : code === "auth/weak-password"
            ? "Password is too weak (minimum 6 characters)."
            : err instanceof Error
              ? err.message
              : "Sign-up failed — check the details and try again.",
      );
      setBusy(false);
    }
  }

  if (inviteToken && inviteError) {
    return (
      <Card className="w-full max-w-[440px] p-6">
        <h1 className="mb-2 text-[20px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          Invite problem
        </h1>
        <p className="text-[13px] text-[var(--red)]">{inviteError}</p>
        <p className="mt-3 text-[12.5px] text-[var(--ink-3)]">
          Ask the person who invited you for a fresh link, or{" "}
          <Link href="/signup" className="font-bold text-[var(--brand-2)]">
            create a regular account
          </Link>
          .
        </p>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-[440px] p-6" style={{ borderLeft: "4px solid #1d3a8f" }}>
      <div className="mb-4 flex items-center gap-2.5">
        <AosMark />
        <AosWordmark className="text-[19px] font-extrabold" />
      </div>
      <h1 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
        {invite ? `Join ${invite.tenantName}` : "Create your account"}
      </h1>
      <p className="mb-4 text-[13px] text-[var(--ink-3)]">
        {invite
          ? `You've been invited as ${invite.role === "franchise" ? "a franchise" : "staff"}.`
          : "Choose how you’ll use ActivityOS."}
      </p>

      {!invite && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          {ACCOUNT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setAccountType(t.value)}
              className="rounded-xl border p-3 text-left transition-colors"
              style={
                accountType === t.value
                  ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)" }
                  : { borderColor: "var(--line)", background: "var(--surface)" }
              }
            >
              <div
                className="text-[13px] font-extrabold"
                style={{ color: accountType === t.value ? "var(--brand-ink)" : "var(--ink)" }}
              >
                {t.label}
              </div>
              <div
                className="text-[11.5px]"
                style={{ color: accountType === t.value ? "var(--brand-strong)" : "var(--ink-3)" }}
              >
                {t.desc}
              </div>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3">
        {needsBusinessName && (
          <div>
            <FieldLabel>Business name</FieldLabel>
            <Input
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. APF Activity Camps"
              className="w-full"
            />
          </div>
        )}
        <div>
          <FieldLabel>Your name</FieldLabel>
          <Input
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full"
          />
        </div>
        {!inviteToken && accountType === "parent" && (
          <div>
            <FieldLabel>Postcode <span className="font-normal text-[var(--ink-3)]">— optional</span></FieldLabel>
            <Input
              autoComplete="postal-code"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              placeholder="e.g. NN5 7EA"
              className="w-full"
            />
            <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">Lets us show you activities nearest to you. You can change it later.</p>
          </div>
        )}
        {needsBusinessName && (
          <div>
            <FieldLabel>What should parents see you as?</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["business", "My business name", businessName.trim() || "Your business name"],
                  ["person", "My own name", name.trim() || "Your name"],
                ] as const
              ).map(([mode, heading, preview]) => {
                const on = providerNameMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setProviderNameMode(mode)}
                    className="rounded-xl border p-2.5 text-left transition-colors"
                    style={
                      on
                        ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)" }
                        : { borderColor: "var(--line)", background: "var(--surface)" }
                    }
                  >
                    <div className="text-[11px] font-bold" style={{ color: on ? "var(--brand-strong)" : "var(--ink-3)" }}>
                      {heading}
                    </div>
                    <div className="truncate text-[13.5px] font-extrabold" style={{ color: on ? "var(--brand-ink)" : "var(--ink)" }}>
                      {preview}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">
              This is your name on booking pages and to families, and the default on your ratios team. You can change it later in Setup.
            </p>
          </div>
        )}
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
          <FieldLabel>Password</FieldLabel>
          <Input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full"
          />
        </div>
        {error && <div className="text-[12.5px] text-[var(--red)]">{error}</div>}
        <Button variant="solid" type="submit" disabled={busy || (!!inviteToken && !invite)} className="mt-1">
          {busy ? "Creating account…" : invite ? `Join ${invite.tenantName}` : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-[12.5px] text-[var(--ink-3)]">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-[var(--brand-2)]">
          Sign in
        </Link>
      </p>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ ...AUTH_LIGHT, background: "var(--bg)" }}>
      {/* useSearchParams requires a Suspense boundary during prerender */}
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
