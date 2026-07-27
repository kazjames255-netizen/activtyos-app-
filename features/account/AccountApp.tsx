"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { get as apiGet, api } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { Button, Card, FieldLabel, Input } from "@/components/ui";

interface Profile { email: string | null; name: string; phone: string; marketingConsent: boolean; role: string }
const roleLabel: Record<string, string> = { parent: "Parent", staff: "Staff", company: "Company / head office", franchise: "Franchise", freelancer: "Freelancer", platform: "Platform" };
const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;
const looksEmail = (s: string) => /@/.test(s);

export function AccountApp() {
  const { signOutUser } = useAuth();
  const { settings } = useSettings();
  const [p, setP] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState<{ err?: string; ok?: string }>({});

  const load = useCallback(() => {
    apiGet<Profile>("/api/account").then((prof) => {
      setP(prof); setName(prof.name);
      // A registration bug seeded some accounts' phone with the login email —
      // don't show an email in the phone box (fall back to the onboarding phone).
      setPhone(looksEmail(prof.phone) ? "" : prof.phone);
      setMarketing(prof.marketingConsent);
    }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saveProfile() {
    setError(null); setOk(null);
    try { await api("/api/account", { method: "PUT", body: JSON.stringify({ name, phone, marketingConsent: marketing }) }); setOk("Saved."); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); }
  }

  async function changePassword() {
    setPwMsg({});
    if (pw.next.length < 6) { setPwMsg({ err: "New password must be at least 6 characters." }); return; }
    if (pw.next !== pw.confirm) { setPwMsg({ err: "The new passwords don’t match." }); return; }
    const user = firebaseAuth.currentUser;
    if (!user || !user.email) { setPwMsg({ err: "Not signed in." }); return; }
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pw.current));
      await updatePassword(user, pw.next);
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg({ ok: "Password changed." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn’t change password";
      setPwMsg({ err: /auth\/(wrong-password|invalid-credential)/.test(msg) ? "Current password is incorrect." : msg });
    }
  }

  if (error && !p) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!p) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>;

  const isOperator = p.role === "freelancer" || p.role === "company" || p.role === "franchise";
  const b = settings.billing ?? {};
  const reg: [string, string][] = [
    ["Business name", b.businessName || "—"],
    ["Shown to parents as", settings.providerName ? `${settings.providerName} (${settings.providerNameMode === "person" ? "your own name" : "business name"})` : "—"],
    ["What you run", settings.activityKinds?.length ? settings.activityKinds.join(", ") : "—"],
    ["Based", [b.address, settings.postcode].filter(Boolean).join(", ") || "—"],
    ["Contact email", b.email || p.email || "—"],
    ["Contact phone", b.phone || "—"],
    ["VAT number", b.vatNumber || "—"],
  ];

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <div className="mx-auto max-w-[720px]">
        {/* Hero — matches the other portal pages (blue → white). */}
        <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
          <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">👤</span>
            My account
          </div>
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-white/85">{p.email} · {roleLabel[p.role] ?? p.role}{isOperator ? " — your details and everything from your sign-up." : ""}</p>
        </div>

        {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
        {ok && <div className="mb-3 rounded-lg border border-[var(--line)] bg-[#eaf0fc] px-3 py-2 text-[12.5px] text-[#1d3a8f]">{ok}</div>}

        {isOperator && (
          <Card className="mb-3 p-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="text-[13.5px] font-extrabold">From your registration</div>
              <a href={`/${p.role}/setup`} className="text-[11.5px] font-bold text-[#1d3a8f] hover:underline">Edit in Setup →</a>
            </div>
            <p className="mb-2.5 text-[11.5px] text-[var(--ink-3)]">The details you gave when you signed up. Manage them in Setup.</p>
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
              {reg.map(([k, v]) => (
                <div key={k} className="flex flex-col">
                  <dt className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{k}</dt>
                  <dd className="text-[13px] font-semibold text-[var(--ink)] break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        <Card className="mb-3 p-4">
          <div className="mb-2 text-[13.5px] font-extrabold">Profile</div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div><FieldLabel>Name</FieldLabel><Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" /></div>
            <div><FieldLabel>Phone</FieldLabel><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full" placeholder="Your contact number" /></div>
          </div>
          <label className="mt-2.5 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />Email me occasional news and offers</label>
          <div className="mt-3"><Button variant="primary" onClick={saveProfile}>Save profile</Button></div>
        </Card>

        <Card className="mb-3 p-4">
          <div className="mb-2 text-[13.5px] font-extrabold">Change password</div>
          {pwMsg.err && <div className="mb-2 text-[12px] text-[var(--red)]">{pwMsg.err}</div>}
          {pwMsg.ok && <div className="mb-2 text-[12px] text-[#1d3a8f]">{pwMsg.ok}</div>}
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div><FieldLabel>Current</FieldLabel><Input type="password" value={pw.current} onChange={(e) => setPw((s) => ({ ...s, current: e.target.value }))} className="w-full" /></div>
            <div><FieldLabel>New</FieldLabel><Input type="password" value={pw.next} onChange={(e) => setPw((s) => ({ ...s, next: e.target.value }))} className="w-full" /></div>
            <div><FieldLabel>Confirm</FieldLabel><Input type="password" value={pw.confirm} onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))} className="w-full" /></div>
          </div>
          <div className="mt-3"><Button onClick={changePassword} disabled={!pw.current || !pw.next}>Update password</Button></div>
        </Card>

        <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div className="text-[12.5px] text-[var(--ink-3)]">Signed in as {p.email}</div>
          <Button variant="danger" onClick={() => signOutUser()}>Sign out</Button>
        </Card>
      </div>
    </div>
  );
}
