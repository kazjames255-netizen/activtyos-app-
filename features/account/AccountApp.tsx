"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { clearMeCache } from "@/components/auth/PortalGuard";
import { TerritoryMapClient, type TerritoryArea } from "@/features/franchise/TerritoryMapClient";
import { get as apiGet, api } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { Button, Card, FieldLabel, Input } from "@/components/ui";

// Wire/storage shape — points are {lat,lng} OBJECTS (Firestore forbids nested arrays).
interface WireArea { id: string; name: string; color: string; rings: { lat: number; lng: number }[] }
interface WireTerritory { areas: WireArea[]; status?: "draft" | "agreed" }
const toMapAreas = (t?: WireTerritory | null): TerritoryArea[] => (t?.areas ?? []).map((a) => ({ ...a, rings: a.rings.map((p) => [p.lat, p.lng] as [number, number]) }));
const toWireAreas = (areas: TerritoryArea[]): WireArea[] => areas.map((a) => ({ ...a, rings: a.rings.map(([lat, lng]) => ({ lat, lng })) }));
interface Profile { email: string | null; name: string; phone: string; address: string; postcode: string; marketingConsent: boolean; role: string; emergencyName?: string; emergencyPhone?: string; franchiseName?: string; franchiseArea?: string; franchiseTerritory?: WireTerritory | null }
const roleLabel: Record<string, string> = { parent: "Parent", staff: "Staff", company: "Company / head office", franchise: "Franchise", freelancer: "Freelancer", platform: "Platform" };
const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;
const looksEmail = (s: string) => /@/.test(s);
// Turn an API error (which may be a raw zod-issues JSON array) into one plain line.
function niceError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  try {
    const arr = JSON.parse(raw) as { message?: string; path?: (string | number)[] }[];
    if (Array.isArray(arr) && arr[0]?.message) {
      const i = arr[0];
      const field = Array.isArray(i.path) && i.path.length ? String(i.path[i.path.length - 1]) : "";
      const label = field ? field.charAt(0).toUpperCase() + field.slice(1) : "";
      return label ? `${label}: ${i.message!.charAt(0).toLowerCase()}${i.message!.slice(1)}` : i.message!;
    }
  } catch { /* not JSON — use as-is */ }
  return raw;
}

// Downscale any uploaded image to a PNG/JPG under the upload cap, so a big logo
// still fits (mirrors the Setup logo upload; handles SVGs that report 0×0).
async function compressLogo(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const iw = img.naturalWidth || img.width || 480, ih = img.naturalHeight || img.height || 480;
      const s = Math.min(1, 480 / Math.max(iw, ih));
      const w = Math.round(iw * s), h = Math.round(ih * s);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d"); if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      let out = c.toDataURL("image/png");
      if (out.length > 820_000) { let q = 0.85; out = c.toDataURL("image/jpeg", q); while (out.length > 820_000 && q > 0.4) { q -= 0.12; out = c.toDataURL("image/jpeg", q); } }
      resolve(out);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function AccountApp() {
  const { signOutUser } = useAuth();
  const { settings, save } = useSettings();
  const [p, setP] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [marketing, setMarketing] = useState(false);
  // Family-level emergency contact (parents) — the same one used to pre-fill each child.
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState<{ err?: string; ok?: string }>({});
  const [showPw, setShowPw] = useState(false);
  // Franchise identity (business name + territory) — editable by the franchise here.
  const [frName, setFrName] = useState("");
  const [frArea, setFrArea] = useState("");
  const [frOk, setFrOk] = useState<string | null>(null);
  const [territory, setTerritory] = useState<TerritoryArea[]>([]);
  // Agreement is head-office-controlled — the franchise can only propose, never self-agree.
  const [terrStatus, setTerrStatus] = useState<"draft" | "proposed" | "agreed">("draft");
  // The registration card is editable right here (not only in Setup).
  const [editReg, setEditReg] = useState(false);
  const [rf, setRf] = useState({ businessName: "", providerName: "", activityKinds: "", address: "", postcode: "", email: "", phone: "", vatNumber: "" });

  const load = useCallback(() => {
    apiGet<Profile>("/api/account").then((prof) => {
      setP(prof); setName(prof.name);
      // A registration bug seeded some accounts' phone/address/postcode with the
      // login email — never show an email in those boxes (it also fails the
      // 16-char postcode limit on save). Clearing + saving fixes the stored value.
      setPhone(looksEmail(prof.phone) ? "" : prof.phone);
      setAddress(looksEmail(prof.address) ? "" : (prof.address ?? ""));
      setPostcode(looksEmail(prof.postcode) ? "" : (prof.postcode ?? ""));
      setMarketing(prof.marketingConsent);
      setEmergencyName(prof.emergencyName ?? "");
      setEmergencyPhone(prof.emergencyPhone ?? "");
      setFrName(prof.franchiseName ?? "");
      setFrArea(prof.franchiseArea ?? "");
      setTerritory(toMapAreas(prof.franchiseTerritory));
      setTerrStatus(prof.franchiseTerritory?.status ?? "draft");
    }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setError(null); setOk(null);
    try {
      const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("Couldn’t read that file")); r.readAsDataURL(f); });
      const payload = dataUrl.startsWith("data:image/") ? await compressLogo(dataUrl) : dataUrl;
      const { url } = await api<{ url: string }>("/api/uploads", { method: "POST", body: JSON.stringify({ dataUrl: payload }) });
      await save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), logoUrl: url } } });
      setOk("Logo saved — it'll show on your customer emails and pages.");
    } catch (err) {
      setError(err instanceof Error ? `Logo upload failed: ${err.message}` : "Couldn’t upload that logo — most image files work (PNG, JPG, SVG, WebP, GIF…).");
    }
    e.target.value = "";
  }
  async function removeLogo() {
    setError(null); setOk(null);
    try { await save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), logoUrl: "" } } }); setOk("Logo removed."); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t remove the logo"); }
  }

  function startEditReg() {
    const bb = settings.billing ?? {};
    setRf({
      businessName: bb.businessName ?? "",
      providerName: settings.providerName ?? "",
      activityKinds: (settings.activityKinds ?? []).join(", "),
      address: bb.address ?? "",
      postcode: settings.postcode ?? "",
      email: bb.email ?? "",
      phone: bb.phone ?? "",
      vatNumber: bb.vatNumber ?? "",
    });
    setEditReg(true);
  }
  async function saveReg() {
    setError(null); setOk(null);
    try {
      await save({ settings: { ...settings,
        providerName: rf.providerName.trim() || rf.businessName.trim(),
        postcode: rf.postcode.trim(),
        activityKinds: rf.activityKinds.split(",").map((s) => s.trim()).filter(Boolean),
        billing: { ...(settings.billing ?? {}), businessName: rf.businessName.trim(), address: rf.address.trim(), email: rf.email.trim(), phone: rf.phone.trim(), vatNumber: rf.vatNumber.trim() },
      } });
      setEditReg(false); setOk("Registration details saved.");
    } catch (e) { setError(niceError(e)); }
  }

  async function saveFranchise() {
    setError(null); setFrOk(null);
    try {
      await api("/api/account", { method: "PUT", body: JSON.stringify({
        franchiseName: frName.trim(), franchiseArea: frArea.trim(),
        // Status is head-office-controlled; the server coerces a franchise's value anyway.
        franchiseTerritory: { areas: toWireAreas(territory), status: territory.length ? "proposed" : "draft" },
      }) });
      setFrOk(territory.length ? "Saved — sent to your head office to agree." : "Saved.");
      setTerrStatus(territory.length ? "proposed" : "draft");
      clearMeCache(); // so the sidebar banner picks up the new name/area on next navigation
    } catch (e) { setError(niceError(e)); }
  }

  async function saveProfile() {
    setError(null); setOk(null);
    try {
      await api("/api/account", { method: "PUT", body: JSON.stringify({ name, phone, address, postcode, marketingConsent: marketing, ...(p?.role === "parent" ? { emergencyName: emergencyName.trim(), emergencyPhone: emergencyPhone.trim() } : {}) }) });
      setOk("Saved.");
      // Let the header (and anything else showing my name) update without a reload.
      window.dispatchEvent(new CustomEvent("aos:me-updated", { detail: { name: name.trim() } }));
      load();
    }
    catch (e) { setError(niceError(e)); }
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
      setPwMsg({ err: /auth\/(wrong-password|invalid-credential)/.test(msg) ? "Current password is incorrect — if you’ve forgotten it, use “Forgot your current password?” below." : msg });
    }
  }

  // Forgot the current password → email a reset link (Firebase-hosted reset page,
  // no current password needed).
  async function resetPassword() {
    setPwMsg({});
    const em = firebaseAuth.currentUser?.email || p?.email;
    if (!em) { setPwMsg({ err: "No email on this account to send a reset to." }); return; }
    try {
      await sendPasswordResetEmail(firebaseAuth, em);
      setPwMsg({ ok: `We’ve emailed a password-reset link to ${em}. Open it to set a new password — no need for your old one.` });
    } catch (e) {
      setPwMsg({ err: e instanceof Error ? e.message : "Couldn’t send the reset email" });
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
        <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "var(--hero-grad)" }}>
          <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">👤</span>
            My account
          </div>
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-white/85">{p.email} · {roleLabel[p.role] ?? p.role}{isOperator ? " — your details and everything from your sign-up." : ""}</p>
        </div>

        {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
        {ok && <div className="mb-3 rounded-lg border border-[var(--line)] bg-[#eaf0fc] px-3 py-2 text-[12.5px] text-[#1d3a8f]">{ok}</div>}

        {p.role === "franchise" && (
          <Card className="mb-3 border-2 border-[#e6d8f6] p-4" style={{ background: "#faf6ff" }}>
            <div className="flex items-center gap-2 text-[13.5px] font-extrabold text-[#7a3aa8]">🌐 Your franchise</div>
            <p className="mb-3 mt-0.5 text-[11.5px] leading-snug text-[var(--ink-3)]">Your franchise business name and the area/territory you cover — shown across your portal as “{(frName.trim() || "Your brand")} · {(frArea.trim() || "Area")} franchise”.</p>
            <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
              <div><FieldLabel>Franchise business name</FieldLabel><Input value={frName} onChange={(e) => setFrName(e.target.value)} className="w-full" placeholder="e.g. APF Activity Camps" /></div>
              <div><FieldLabel>Area / territory</FieldLabel><Input value={frArea} onChange={(e) => setFrArea(e.target.value)} className="w-full" placeholder="e.g. London" /></div>
            </div>

            {/* Territory map — the franchise PROPOSES a border; the head office agrees it (HO-only). Optional. */}
            <div className="mt-4 border-t border-[#e6d8f6] pt-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[12.5px] font-extrabold text-[#7a3aa8]">🗺 Your territory on the map <span className="font-bold text-[var(--ink-3)]">— optional</span></div>
                {territory.length === 0
                  ? <span className="rounded-full bg-[var(--panel)] px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Not set</span>
                  : terrStatus === "agreed"
                    ? <span className="rounded-full bg-[#e2f4ea] px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[#0f7a43]">✓ Agreed by head office</span>
                    : <span className="rounded-full bg-[#fdf0e3] px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[#b45309]">Awaiting head office agreement</span>}
              </div>
              <p className="mb-2.5 mt-0.5 text-[11.5px] leading-snug text-[var(--ink-3)]">Optional, but your head office encourages it: draw the border(s) where you run your services so the patch is clear. Add more than one area if you cover several. <b>Your head office reviews and agrees it</b> — you can propose and adjust, they sign it off. Leave it blank and you can still create listings anywhere.</p>
              <TerritoryMapClient value={territory} onChange={setTerritory} editable focus={frArea || "London"} height={360} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={saveFranchise}>Save franchise</Button>
              {frOk && <span className="text-[12.5px] font-bold text-[#1d7a43]">✓ {frOk}</span>}
            </div>
          </Card>
        )}

        {isOperator && (
          <Card className="mb-3 p-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="text-[13.5px] font-extrabold">From your registration</div>
              {editReg
                ? <div className="flex items-center gap-3"><button type="button" onClick={() => setEditReg(false)} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:underline">Cancel</button><button type="button" onClick={saveReg} className="text-[11.5px] font-bold text-[#1d3a8f] hover:underline">Save</button></div>
                : <button type="button" onClick={startEditReg} className="text-[11.5px] font-bold text-[#1d3a8f] hover:underline">Edit details →</button>}
            </div>
            <p className="mb-2.5 text-[11.5px] text-[var(--ink-3)]">The details you gave when you signed up. Edit them here, or set them up in full in <a href={`/${p.role}/setup`} className="font-bold text-[#1d3a8f] hover:underline">Setup</a>.</p>

            {/* Logo — editable right here (not only in Setup), since it's the one
                thing every customer email + page shows. */}
            <div className="mb-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Logo</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                {b.logoUrl
                  ? <img src={b.logoUrl} alt="Your logo" className="h-10 max-w-[140px] rounded border border-[var(--line)] bg-white object-contain" />
                  : <span className="text-[12px] text-[var(--ink-3)]">No logo yet — parents just see your name.</span>}
                <label className="cursor-pointer rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f]">
                  {b.logoUrl ? "⬆ Change logo" : "⬆ Upload logo"}
                  <input type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/gif,image/bmp,image/avif,image/*" className="hidden" onChange={uploadLogo} />
                </label>
                {b.logoUrl && <button type="button" onClick={removeLogo} className="text-[11.5px] font-bold text-[var(--ink-3)]">Remove</button>}
              </div>
              <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">Shown on your customer emails, booking pages and PDFs. PNG, JPG, SVG, WebP, GIF — up to 1MB, resized automatically.</div>
            </div>

            {editReg ? (
              <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
                <div><FieldLabel>Business name</FieldLabel><Input value={rf.businessName} onChange={(e) => setRf((s) => ({ ...s, businessName: e.target.value }))} className="w-full" /></div>
                <div><FieldLabel>Shown to parents as</FieldLabel><Input value={rf.providerName} onChange={(e) => setRf((s) => ({ ...s, providerName: e.target.value }))} className="w-full" placeholder="Defaults to your business name" /></div>
                <div><FieldLabel>What you run</FieldLabel><Input value={rf.activityKinds} onChange={(e) => setRf((s) => ({ ...s, activityKinds: e.target.value }))} className="w-full" placeholder="e.g. Holiday camps, After-school clubs" /></div>
                <div><FieldLabel>Postcode</FieldLabel><Input value={rf.postcode} onChange={(e) => setRf((s) => ({ ...s, postcode: e.target.value }))} className="w-full" placeholder="e.g. MK1 1AA" /></div>
                <div className="sm:col-span-2"><FieldLabel>Based (address)</FieldLabel><Input value={rf.address} onChange={(e) => setRf((s) => ({ ...s, address: e.target.value }))} className="w-full" placeholder="Street, town" /></div>
                <div><FieldLabel>Contact email</FieldLabel><Input value={rf.email} onChange={(e) => setRf((s) => ({ ...s, email: e.target.value }))} className="w-full" /></div>
                <div><FieldLabel>Contact phone</FieldLabel><Input value={rf.phone} onChange={(e) => setRf((s) => ({ ...s, phone: e.target.value }))} className="w-full" /></div>
                <div><FieldLabel>VAT number</FieldLabel><Input value={rf.vatNumber} onChange={(e) => setRf((s) => ({ ...s, vatNumber: e.target.value }))} className="w-full" placeholder="If registered" /></div>
              </div>
            ) : (
              <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {reg.map(([k, v]) => (
                  <div key={k} className="flex flex-col">
                    <dt className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{k}</dt>
                    <dd className="text-[13px] font-semibold text-[var(--ink)] break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        )}

        <Card className="mb-3 p-4">
          <div className="mb-2 text-[13.5px] font-extrabold">Profile</div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div><FieldLabel>Name</FieldLabel><Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" /></div>
            <div><FieldLabel>Phone</FieldLabel><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full" placeholder="Your contact number" /></div>
            <div className="sm:col-span-2"><FieldLabel>Home address</FieldLabel><Input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full" placeholder="House, street, town" /></div>
            <div><FieldLabel>Postcode</FieldLabel><Input value={postcode} onChange={(e) => setPostcode(e.target.value)} className="w-full" placeholder="e.g. MK1 1AA" /></div>
          </div>
          {p?.role === "parent" && <p className="mt-1.5 text-[11px] text-[var(--ink-3)]">Your address helps your provider keep accurate records for registers and safeguarding.</p>}
          {p?.role === "parent" && (
            <div className="mt-3 border-t border-[var(--line)] pt-3">
              <FieldLabel>Emergency contact</FieldLabel>
              <div className="mt-1 grid gap-2.5 sm:grid-cols-2">
                <Input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className="w-full" placeholder="Name — e.g. Aunt Priya" />
                <Input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className="w-full" inputMode="tel" placeholder="Phone" />
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--ink-3)]">Who staff ring if they can’t reach you. This pre-fills each child’s emergency contact — you can still set a different one per child.</p>
            </div>
          )}
          <label className="mt-2.5 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />Email me occasional news and offers</label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={saveProfile}>Save profile</Button>
            {ok && <span className="text-[12.5px] font-bold text-[#1d7a43]">✓ {ok}</span>}
            {error && <span className="text-[12.5px] font-bold text-[var(--red)]">{error}</span>}
          </div>
        </Card>

        <Card className="mb-3 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[13.5px] font-extrabold">Change password</div>
            <button type="button" onClick={() => setShowPw((s) => !s)} className="text-[11.5px] font-bold text-[#1d3a8f] hover:underline">{showPw ? "🙈 Hide" : "👁 Show"} passwords</button>
          </div>
          {pwMsg.err && <div className="mb-2 text-[12px] text-[var(--red)]">{pwMsg.err}</div>}
          {pwMsg.ok && <div className="mb-2 text-[12px] text-[#1d3a8f]">{pwMsg.ok}</div>}
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div><FieldLabel>Current</FieldLabel><Input type={showPw ? "text" : "password"} value={pw.current} onChange={(e) => setPw((s) => ({ ...s, current: e.target.value }))} className="w-full" /></div>
            <div><FieldLabel>New</FieldLabel><Input type={showPw ? "text" : "password"} value={pw.next} onChange={(e) => setPw((s) => ({ ...s, next: e.target.value }))} className="w-full" /></div>
            <div><FieldLabel>Confirm</FieldLabel><Input type={showPw ? "text" : "password"} value={pw.confirm} onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))} className="w-full" /></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button onClick={changePassword} disabled={!pw.current || !pw.next}>Update password</Button>
            <button type="button" onClick={resetPassword} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">Forgot your current password?</button>
          </div>
        </Card>

        <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div className="text-[12.5px] text-[var(--ink-3)]">Signed in as {p.email}</div>
          <Button variant="danger" onClick={() => signOutUser()}>Sign out</Button>
        </Card>

        {p.role === "parent" && <CloseAccount />}
      </div>
    </div>
  );
}

// Parent self-service soft close. Gated on outstanding payments (server re-checks
// too), cancels active memberships, warns about wallet credit, and explains the
// 30-day reactivation window. Enforcement (login disable + reactivation) is Amir's.
function CloseAccount() {
  const { signOutUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<null | { outstanding: number; toPayCount: number; wallet: number; memberships: { tenantId: string; name: string; tierName: string }[] }>(null);
  const [ack, setAck] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function loadChecks() {
    setOpen(true); setErr(null);
    try {
      const [bookings, providers, walletRes] = await Promise.all([
        apiGet<{ status?: string; pay?: string; amount?: number }[]>("/api/my/bookings").catch(() => []),
        apiGet<{ tenantId: string; name: string }[]>("/api/my/providers").catch(() => []),
        apiGet<{ balances?: { balance: number }[] }>("/api/my/wallet").catch(() => ({ balances: [] as { balance: number }[] })),
      ]);
      const live = (bookings ?? []).filter((b) => b.status !== "Cancelled" && b.status !== "Declined");
      const unpaid = live.filter((b) => b.pay !== "Paid" && (b.amount ?? 0) > 0);
      const outstanding = unpaid.reduce((n, b) => n + (b.amount ?? 0), 0);
      const wallet = (walletRes?.balances ?? []).reduce((n, w) => n + (w.balance || 0), 0);
      const memberships: { tenantId: string; name: string; tierName: string }[] = [];
      for (const pr of providers ?? []) {
        try {
          const m = await apiGet<{ mine?: { status?: string; tierName?: string } }>(`/api/my/memberships?tenantId=${encodeURIComponent(pr.tenantId)}`);
          if (m?.mine?.status === "active") memberships.push({ tenantId: pr.tenantId, name: pr.name, tierName: m.mine.tierName ?? "Member" });
        } catch { /* ignore a provider that has no membership programme */ }
      }
      setChecks({ outstanding: Math.round(outstanding * 100) / 100, toPayCount: unpaid.length, wallet: Math.round(wallet * 100) / 100, memberships });
    } catch { setErr("Couldn’t load your account details — try again."); }
  }

  async function confirmClose() {
    if (!checks || checks.outstanding > 0 || !ack || busy) return;
    setBusy(true); setErr(null);
    try {
      for (const m of checks.memberships) {
        try { await api("/api/my/memberships/cancel", { method: "POST", body: JSON.stringify({ tenantId: m.tenantId }) }); } catch { /* keep going */ }
      }
      await api("/api/account/deactivate", { method: "POST", body: JSON.stringify({ reason: reason.trim() || undefined }) });
      setDone(true);
      setTimeout(async () => { await signOutUser(); window.location.href = "/login"; }, 2600);
    } catch (e) {
      setErr(niceError(e));
      setBusy(false);
    }
  }

  return (
    <Card className="mb-3 border border-[#f0cfc9] p-4">
      <div className="text-[13.5px] font-extrabold text-[#b3261e]">Close my account</div>
      <p className="mt-1 text-[12px] leading-[1.5] text-[var(--ink-3)]">Closing disables your login and stops all emails. Your provider keeps the records they’re legally required to (safeguarding &amp; payment history). You can reopen it by signing back in within <b>30 days</b>.</p>

      {!open ? (
        <button type="button" onClick={loadChecks} className="mt-3 rounded-full border border-[#e2b6ae] px-4 py-2 text-[12.5px] font-bold text-[#b3261e] transition hover:bg-[#fdf3f1]">Close my account…</button>
      ) : done ? (
        <div className="mt-3 rounded-lg border border-[#f0cfc9] bg-[#fdf3f1] p-3 text-[13px] font-bold text-[#b3261e]">Your account is closed. Signing you out… sign back in within 30 days to reopen it.</div>
      ) : !checks ? (
        <div className="mt-3 text-[12px] text-[var(--ink-3)]">Checking your account…</div>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {checks.outstanding > 0 ? (
            <div className="rounded-lg border border-[#f0cfc9] bg-[#fdf3f1] p-3 text-[12px] leading-[1.5] text-[#7a2a22]"><b>You have £{checks.outstanding.toFixed(2)} still to pay</b> across {checks.toPayCount} booking{checks.toPayCount === 1 ? "" : "s"}. Please settle up first. <a href="/custdash/bookings" className="font-bold underline">Go to My bookings →</a></div>
          ) : (
            <div className="rounded-lg border border-[#cfe9df] bg-[#e9f9f2] p-2.5 text-[12px] font-semibold text-[#0b5a3f]">✓ No outstanding payments.</div>
          )}
          {checks.memberships.length > 0 && (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5 text-[12px] leading-[1.5] text-[var(--ink-2)]">These membership{checks.memberships.length > 1 ? "s" : ""} will be <b>cancelled</b> when you close: {checks.memberships.map((m) => `${m.tierName} (${m.name})`).join(", ")}.</div>
          )}
          {checks.wallet > 0 && (
            <div className="rounded-lg border border-[#f6d78a] bg-[#fff8e6] p-2.5 text-[12px] leading-[1.5] text-[#7a5a00]">⚠ You have <b>£{checks.wallet.toFixed(2)}</b> of wallet credit. It can’t be refunded once you close — spend it first, or ask your provider.</div>
          )}
          <div>
            <FieldLabel>Why are you leaving? <span className="font-normal normal-case text-[var(--ink-3)]">— optional</span></FieldLabel>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full" placeholder="Helps your provider improve" />
          </div>
          <label className="flex items-start gap-2 text-[12px] leading-[1.5] text-[var(--ink-2)]">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 flex-none" disabled={checks.outstanding > 0} />
            I understand my login will be disabled and any memberships cancelled — and that I can reopen my account by signing in within 30 days.
          </label>
          {err && <div className="text-[12px] font-bold text-[var(--red)]">{err}</div>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setOpen(false); setChecks(null); setAck(false); setReason(""); }} className="rounded-full border border-[var(--line)] px-4 py-2 text-[12.5px] font-bold text-[var(--ink-2)] transition hover:bg-[var(--panel)]">Keep my account</button>
            <button type="button" onClick={confirmClose} disabled={checks.outstanding > 0 || !ack || busy} className="rounded-full bg-[#b3261e] px-4 py-2 text-[12.5px] font-extrabold text-white transition enabled:hover:brightness-110 disabled:opacity-40">{busy ? "Closing…" : "Close my account"}</button>
          </div>
        </div>
      )}
    </Card>
  );
}
