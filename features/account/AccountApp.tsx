"use client";

import { useCallback, useEffect, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { get as apiGet, api } from "@/lib/api";
import { Button, Card, FieldLabel, Input } from "@/components/ui";

interface Profile { email: string | null; name: string; phone: string; marketingConsent: boolean; role: string }
const roleLabel: Record<string, string> = { parent: "Parent", staff: "Staff", company: "Company / head office", franchise: "Franchise", freelancer: "Freelancer", platform: "Platform" };

export function AccountApp() {
  const { signOutUser } = useAuth();
  const [p, setP] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState<{ err?: string; ok?: string }>({});

  const load = useCallback(() => {
    apiGet<Profile>("/api/account").then((prof) => { setP(prof); setName(prof.name); setPhone(prof.phone); setMarketing(prof.marketingConsent); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
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

  return (
    <div className="max-w-[640px] text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>My account</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">{p.email} · {roleLabel[p.role] ?? p.role}</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {ok && <div className="mb-3 rounded-lg border border-[var(--line)] bg-[var(--green-soft,#e7f8ee)] px-3 py-2 text-[12.5px] text-[#0f7a44]">{ok}</div>}

      <Card className="mb-3 p-4">
        <div className="mb-2 text-[13.5px] font-extrabold">Profile</div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div><FieldLabel>Name</FieldLabel><Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" /></div>
          <div><FieldLabel>Phone</FieldLabel><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full" /></div>
        </div>
        <label className="mt-2.5 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />Email me occasional news and offers</label>
        <div className="mt-3"><Button variant="primary" onClick={saveProfile}>Save profile</Button></div>
      </Card>

      <Card className="mb-3 p-4">
        <div className="mb-2 text-[13.5px] font-extrabold">Change password</div>
        {pwMsg.err && <div className="mb-2 text-[12px] text-[var(--red)]">{pwMsg.err}</div>}
        {pwMsg.ok && <div className="mb-2 text-[12px] text-[#0f7a44]">{pwMsg.ok}</div>}
        <div className="grid gap-2.5 sm:grid-cols-3">
          <div><FieldLabel>Current</FieldLabel><Input type="password" value={pw.current} onChange={(e) => setPw((s) => ({ ...s, current: e.target.value }))} className="w-full" /></div>
          <div><FieldLabel>New</FieldLabel><Input type="password" value={pw.next} onChange={(e) => setPw((s) => ({ ...s, next: e.target.value }))} className="w-full" /></div>
          <div><FieldLabel>Confirm</FieldLabel><Input type="password" value={pw.confirm} onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))} className="w-full" /></div>
        </div>
        <div className="mt-3"><Button onClick={changePassword} disabled={!pw.current || !pw.next}>Update password</Button></div>
      </Card>

      <Card className="flex items-center justify-between p-4">
        <div className="text-[12.5px] text-[var(--ink-3)]">Signed in as {p.email}</div>
        <Button variant="danger" onClick={() => signOutUser()}>Sign out</Button>
      </Card>
    </div>
  );
}
