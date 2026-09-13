"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail, verifyBeforeUpdateEmail } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { clearMeCache } from "@/components/auth/PortalGuard";
import { TerritoryMapClient, type TerritoryArea } from "@/features/franchise/TerritoryMapClient";
import { get as apiGet, api } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { useI18n } from "@/lib/i18n/provider";
import { Button, Card, FieldLabel, Input } from "@/components/ui";

// Wire/storage shape — points are {lat,lng} OBJECTS (Firestore forbids nested arrays).
interface WireArea { id: string; name: string; color: string; rings: { lat: number; lng: number }[] }
interface WireTerritory { areas: WireArea[]; status?: "draft" | "agreed" }
const toMapAreas = (t?: WireTerritory | null): TerritoryArea[] => (t?.areas ?? []).map((a) => ({ ...a, rings: a.rings.map((p) => [p.lat, p.lng] as [number, number]) }));
const toWireAreas = (areas: TerritoryArea[]): WireArea[] => areas.map((a) => ({ ...a, rings: a.rings.map(([lat, lng]) => ({ lat, lng })) }));
interface Profile { email: string | null; pendingEmail?: string | null; name: string; phone: string; address: string; postcode: string; marketingConsent: boolean; role: string; emergencyName?: string; emergencyPhone?: string; franchiseName?: string; franchiseArea?: string; franchiseTerritory?: WireTerritory | null }
// The load callback keeps its [] deps (the i18n `t` changes every render), so a
// non-Error rejection stores this marker and the render swaps in the translation.
const LOAD_FAILED = "Failed to load";

/** A translated sentence with {placeholders} swapped for rich parts (bold text,
 *  links) — word order differs by language. */
function Rich({ text, vars }: { text: string; vars: Record<string, ReactNode> }) {
  return <>{text.split(/(\{\w+\})/).map((part, i) => { const m = /^\{(\w+)\}$/.exec(part); return m && m[1] in vars ? <Fragment key={i}>{vars[m[1]]}</Fragment> : part; })}</>;
}
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
  const { t } = useI18n();
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
  // Change of sign-in email (Firebase verifyBeforeUpdateEmail — the switch only
  // happens once the link sent to the NEW address is opened).
  const [emOpen, setEmOpen] = useState(false);
  const [em, setEm] = useState({ next: "", password: "" });
  const [emNeedPw, setEmNeedPw] = useState(false);
  const [emBusy, setEmBusy] = useState(false);
  const [emMsg, setEmMsg] = useState<{ err?: string; ok?: string }>({});
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
    }).catch((e) => setError(e instanceof Error ? e.message : LOAD_FAILED));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setError(null); setOk(null);
    try {
      const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error(t("account.errReadFile"))); r.readAsDataURL(f); });
      const payload = dataUrl.startsWith("data:image/") ? await compressLogo(dataUrl) : dataUrl;
      const { url } = await api<{ url: string }>("/api/uploads", { method: "POST", body: JSON.stringify({ dataUrl: payload }) });
      await save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), logoUrl: url } } });
      setOk(t("account.logoSaved"));
    } catch (err) {
      setError(err instanceof Error ? t("account.logoUploadFailed", { msg: err.message }) : t("account.logoUploadErr"));
    }
    e.target.value = "";
  }
  async function removeLogo() {
    setError(null); setOk(null);
    try { await save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), logoUrl: "" } } }); setOk(t("account.logoRemoved")); }
    catch (e) { setError(e instanceof Error ? e.message : t("account.logoRemoveErr")); }
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
      setEditReg(false); setOk(t("account.regSaved"));
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
      setFrOk(territory.length ? t("account.frSavedProposed") : t("account.saved"));
      setTerrStatus(territory.length ? "proposed" : "draft");
      clearMeCache(); // so the sidebar banner picks up the new name/area on next navigation
    } catch (e) { setError(niceError(e)); }
  }

  async function saveProfile() {
    setError(null); setOk(null);
    try {
      await api("/api/account", { method: "PUT", body: JSON.stringify({ name, phone, address, postcode, marketingConsent: marketing, ...(p?.role === "parent" ? { emergencyName: emergencyName.trim(), emergencyPhone: emergencyPhone.trim() } : {}) }) });
      setOk(t("account.saved"));
      // Let the header (and anything else showing my name) update without a reload.
      window.dispatchEvent(new CustomEvent("aos:me-updated", { detail: { name: name.trim() } }));
      load();
    }
    catch (e) { setError(niceError(e)); }
  }

  async function changePassword() {
    setPwMsg({});
    if (pw.next.length < 6) { setPwMsg({ err: t("account.pwTooShort") }); return; }
    if (pw.next !== pw.confirm) { setPwMsg({ err: t("account.pwMismatch") }); return; }
    const user = firebaseAuth.currentUser;
    if (!user || !user.email) { setPwMsg({ err: t("account.notSignedIn") }); return; }
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pw.current));
      await updatePassword(user, pw.next);
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg({ ok: t("account.pwChanged") });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("account.pwChangeErr");
      setPwMsg({ err: /auth\/(wrong-password|invalid-credential)/.test(msg) ? t("account.pwWrong", { forgot: t("account.forgotPw") }) : msg });
    }
  }

  async function changeEmail() {
    setEmMsg({});
    const next = em.next.trim().toLowerCase();
    const user = firebaseAuth.currentUser;
    if (!user || !user.email) { setEmMsg({ err: t("account.notSignedIn") }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) { setEmMsg({ err: t("account.emInvalid") }); return; }
    if (next === user.email.toLowerCase()) { setEmMsg({ err: t("account.emSame") }); return; }
    setEmBusy(true);
    try {
      // Firebase refuses a sensitive change on an old sign-in — then we ask for
      // the password once and re-authenticate before trying again.
      if (emNeedPw) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, em.password));
      await verifyBeforeUpdateEmail(user, next);
      // Tell the server which address is on its way, so it can recognise the
      // switch and move the family's records across when it lands.
      await api("/api/account/email-change", { method: "POST", body: JSON.stringify({ newEmail: next }) }).catch(() => {});
      setEmMsg({ ok: t("account.emSent", { email: next, current: user.email }) });
      setEm({ next: "", password: "" }); setEmNeedPw(false); setEmOpen(false);
      load();
    } catch (e) {
      const code = `${(e as { code?: string })?.code ?? ""} ${e instanceof Error ? e.message : ""}`;
      if (/requires-recent-login/.test(code)) { setEmNeedPw(true); setEmMsg({ err: t("account.emNeedPw") }); }
      else if (/wrong-password|invalid-credential/.test(code)) setEmMsg({ err: t("account.emWrongPw") });
      else if (/email-already-in-use/.test(code)) setEmMsg({ err: t("account.emTaken") });
      else if (/invalid-email|invalid-new-email/.test(code)) setEmMsg({ err: t("account.emInvalid") });
      else if (/too-many-requests/.test(code)) setEmMsg({ err: t("account.emTooMany") });
      else setEmMsg({ err: t("account.emErr") });
    } finally { setEmBusy(false); }
  }

  // Forgot the current password → email a reset link (Firebase-hosted reset page,
  // no current password needed).
  async function resetPassword() {
    setPwMsg({});
    const em = firebaseAuth.currentUser?.email || p?.email;
    if (!em) { setPwMsg({ err: t("account.noResetEmail") }); return; }
    try {
      await sendPasswordResetEmail(firebaseAuth, em);
      setPwMsg({ ok: t("account.resetSent", { email: em }) });
    } catch (e) {
      setPwMsg({ err: e instanceof Error ? e.message : t("account.resetErr") });
    }
  }

  const errMsg = error === LOAD_FAILED ? t("account.failedLoad") : error;
  if (error && !p) return <div className="p-2 text-[12.5px] text-[var(--red)]">{errMsg}</div>;
  if (!p) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{t("account.loading")}</div>;

  const roleLabel: Record<string, string> = { parent: t("account.roleParent"), staff: t("account.roleStaff"), company: t("account.roleCompany"), franchise: t("account.roleFranchise"), freelancer: t("account.roleFreelancer"), platform: t("account.rolePlatform") };
  const isOperator = p.role === "freelancer" || p.role === "company" || p.role === "franchise";
  const b = settings.billing ?? {};
  const reg: [string, string][] = [
    [t("account.fBusinessName"), b.businessName || "—"],
    [t("account.fShownAs"), settings.providerName ? `${settings.providerName} (${settings.providerNameMode === "person" ? t("account.shownOwnName") : t("account.shownBusinessName")})` : "—"],
    [t("account.fWhatYouRun"), settings.activityKinds?.length ? settings.activityKinds.join(", ") : "—"],
    [t("account.fBased"), [b.address, settings.postcode].filter(Boolean).join(", ") || "—"],
    [t("account.fContactEmail"), b.email || p.email || "—"],
    [t("account.fContactPhone"), b.phone || "—"],
    [t("account.fVat"), b.vatNumber || "—"],
  ];

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <div className="mx-auto max-w-[720px]">
        {/* Hero — matches the other portal pages (blue → white). */}
        <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "var(--hero-grad)" }}>
          <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">👤</span>
            {t("account.title")}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-white/85">{p.email} · {roleLabel[p.role] ?? p.role}{isOperator ? ` — ${t("account.heroOperator")}` : ""}</p>
        </div>

        {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{errMsg}</div>}
        {ok && <div className="mb-3 rounded-lg border border-[var(--line)] bg-[#eaf0fc] px-3 py-2 text-[12.5px] text-[#1d3a8f]">{ok}</div>}

        {p.role === "franchise" && (
          <Card className="mb-3 border-2 border-[#e6d8f6] p-4" style={{ background: "#faf6ff" }}>
            <div className="flex items-center gap-2 text-[13.5px] font-extrabold text-[#7a3aa8]">{t("account.frTitle")}</div>
            <p className="mb-3 mt-0.5 text-[11.5px] leading-snug text-[var(--ink-3)]">{t("account.frLede", { brand: frName.trim() || t("account.frBrandFallback"), area: frArea.trim() || t("account.frAreaFallback") })}</p>
            <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
              <div><FieldLabel>{t("account.frNameLabel")}</FieldLabel><Input value={frName} onChange={(e) => setFrName(e.target.value)} className="w-full" placeholder={t("account.frNamePh")} /></div>
              <div><FieldLabel>{t("account.frAreaLabel")}</FieldLabel><Input value={frArea} onChange={(e) => setFrArea(e.target.value)} className="w-full" placeholder={t("account.frAreaPh")} /></div>
            </div>

            {/* Territory map — the franchise PROPOSES a border; the head office agrees it (HO-only). Optional. */}
            <div className="mt-4 border-t border-[#e6d8f6] pt-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[12.5px] font-extrabold text-[#7a3aa8]">{t("account.terrTitle")} <span className="font-bold text-[var(--ink-3)]">{t("account.optional")}</span></div>
                {territory.length === 0
                  ? <span className="rounded-full bg-[var(--panel)] px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("account.terrNotSet")}</span>
                  : terrStatus === "agreed"
                    ? <span className="rounded-full bg-[#e2f4ea] px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[#0f7a43]">{t("account.terrAgreed")}</span>
                    : <span className="rounded-full bg-[#fdf0e3] px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[#b45309]">{t("account.terrAwaiting")}</span>}
              </div>
              <p className="mb-2.5 mt-0.5 text-[11.5px] leading-snug text-[var(--ink-3)]"><Rich text={t("account.terrHelp")} vars={{ reviews: <b>{t("account.terrHelpBold")}</b> }} /></p>
              <TerritoryMapClient value={territory} onChange={setTerritory} editable focus={frArea || "London"} height={360} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={saveFranchise}>{t("account.saveFranchise")}</Button>
              {frOk && <span className="text-[12.5px] font-bold text-[#1d7a43]">✓ {frOk}</span>}
            </div>
          </Card>
        )}

        {isOperator && (
          <Card className="mb-3 p-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="text-[13.5px] font-extrabold">{t("account.regTitle")}</div>
              {editReg
                ? <div className="flex items-center gap-3"><button type="button" onClick={() => setEditReg(false)} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:underline">{t("account.cancel")}</button><button type="button" onClick={saveReg} className="text-[11.5px] font-bold text-[#1d3a8f] hover:underline">{t("account.save")}</button></div>
                : <button type="button" onClick={startEditReg} className="text-[11.5px] font-bold text-[#1d3a8f] hover:underline">{t("account.editDetails")}</button>}
            </div>
            <p className="mb-2.5 text-[11.5px] text-[var(--ink-3)]"><Rich text={t("account.regLede")} vars={{ setup: <a href={`/${p.role}/setup`} className="font-bold text-[#1d3a8f] hover:underline">{t("account.setupLink")}</a> }} /></p>

            {/* Logo — editable right here (not only in Setup), since it's the one
                thing every customer email + page shows. */}
            <div className="mb-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("account.logo")}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                {b.logoUrl
                  ? <img src={b.logoUrl} alt={t("account.logoAlt")} className="h-10 max-w-[140px] rounded border border-[var(--line)] bg-white object-contain" />
                  : <span className="text-[12px] text-[var(--ink-3)]">{t("account.noLogo")}</span>}
                <label className="cursor-pointer rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f]">
                  {b.logoUrl ? t("account.changeLogo") : t("account.uploadLogo")}
                  <input type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/gif,image/bmp,image/avif,image/*" className="hidden" onChange={uploadLogo} />
                </label>
                {b.logoUrl && <button type="button" onClick={removeLogo} className="text-[11.5px] font-bold text-[var(--ink-3)]">{t("account.remove")}</button>}
              </div>
              <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">{t("account.logoHint")}</div>
            </div>

            {editReg ? (
              <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
                <div><FieldLabel>{t("account.fBusinessName")}</FieldLabel><Input value={rf.businessName} onChange={(e) => setRf((s) => ({ ...s, businessName: e.target.value }))} className="w-full" /></div>
                <div><FieldLabel>{t("account.fShownAs")}</FieldLabel><Input value={rf.providerName} onChange={(e) => setRf((s) => ({ ...s, providerName: e.target.value }))} className="w-full" placeholder={t("account.shownAsPh")} /></div>
                <div><FieldLabel>{t("account.fWhatYouRun")}</FieldLabel><Input value={rf.activityKinds} onChange={(e) => setRf((s) => ({ ...s, activityKinds: e.target.value }))} className="w-full" placeholder={t("account.whatYouRunPh")} /></div>
                <div><FieldLabel>{t("account.postcode")}</FieldLabel><Input value={rf.postcode} onChange={(e) => setRf((s) => ({ ...s, postcode: e.target.value }))} className="w-full" placeholder={t("account.postcodePh")} /></div>
                <div className="sm:col-span-2"><FieldLabel>{t("account.fBasedAddress")}</FieldLabel><Input value={rf.address} onChange={(e) => setRf((s) => ({ ...s, address: e.target.value }))} className="w-full" placeholder={t("account.addressPh")} /></div>
                <div><FieldLabel>{t("account.fContactEmail")}</FieldLabel><Input value={rf.email} onChange={(e) => setRf((s) => ({ ...s, email: e.target.value }))} className="w-full" /></div>
                <div><FieldLabel>{t("account.fContactPhone")}</FieldLabel><Input value={rf.phone} onChange={(e) => setRf((s) => ({ ...s, phone: e.target.value }))} className="w-full" /></div>
                <div><FieldLabel>{t("account.fVat")}</FieldLabel><Input value={rf.vatNumber} onChange={(e) => setRf((s) => ({ ...s, vatNumber: e.target.value }))} className="w-full" placeholder={t("account.vatPh")} /></div>
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
          <div className="mb-2 text-[13.5px] font-extrabold">{t("account.profile")}</div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <FieldLabel>{t("account.name")}</FieldLabel>
              {/* Staff: the name links their shifts, certificates and training, so the manager sets it. */}
              <Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" readOnly={p.role === "staff" && !!p.name} />
              {p.role === "staff" && !!p.name && <p className="mt-1 text-[11px] leading-[1.45] text-[var(--ink-3)]">{t("account.nameSetByManager")}</p>}
            </div>
            <div><FieldLabel>{t("account.phone")}</FieldLabel><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full" placeholder={t("account.phonePh")} /></div>
            <div className="sm:col-span-2"><FieldLabel>{t("account.homeAddress")}</FieldLabel><Input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full" placeholder={t("account.homeAddressPh")} /></div>
            <div><FieldLabel>{t("account.postcode")}</FieldLabel><Input value={postcode} onChange={(e) => setPostcode(e.target.value)} className="w-full" placeholder={t("account.postcodePh")} /></div>
          </div>
          {p?.role === "parent" && <p className="mt-1.5 text-[11px] text-[var(--ink-3)]">{t("account.addressHelp")}</p>}
          {p?.role === "parent" && (
            <div className="mt-3 border-t border-[var(--line)] pt-3">
              <FieldLabel>{t("account.emergencyContact")}</FieldLabel>
              <div className="mt-1 grid gap-2.5 sm:grid-cols-2">
                <Input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className="w-full" placeholder={t("account.emergencyNamePh")} />
                <Input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className="w-full" inputMode="tel" placeholder={t("account.phone")} />
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--ink-3)]">{t("account.emergencyHelp")}</p>
            </div>
          )}
          <label className="mt-2.5 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />{t("account.marketingOptIn")}</label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={saveProfile}>{t("account.saveProfile")}</Button>
            {ok && <span className="text-[12.5px] font-bold text-[#1d7a43]">✓ {ok}</span>}
            {error && <span className="text-[12.5px] font-bold text-[var(--red)]">{errMsg}</span>}
          </div>
        </Card>

        <Card className="mb-3 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[13.5px] font-extrabold">{t("account.changePassword")}</div>
            <button type="button" onClick={() => setShowPw((s) => !s)} className="text-[11.5px] font-bold text-[#1d3a8f] hover:underline">{showPw ? t("account.hidePasswords") : t("account.showPasswords")}</button>
          </div>
          {pwMsg.err && <div className="mb-2 text-[12px] text-[var(--red)]">{pwMsg.err}</div>}
          {pwMsg.ok && <div className="mb-2 text-[12px] text-[#1d3a8f]">{pwMsg.ok}</div>}
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div><FieldLabel>{t("account.pwCurrent")}</FieldLabel><Input type={showPw ? "text" : "password"} value={pw.current} onChange={(e) => setPw((s) => ({ ...s, current: e.target.value }))} className="w-full" /></div>
            <div><FieldLabel>{t("account.pwNew")}</FieldLabel><Input type={showPw ? "text" : "password"} value={pw.next} onChange={(e) => setPw((s) => ({ ...s, next: e.target.value }))} className="w-full" /></div>
            <div><FieldLabel>{t("account.pwConfirm")}</FieldLabel><Input type={showPw ? "text" : "password"} value={pw.confirm} onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))} className="w-full" /></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button onClick={changePassword} disabled={!pw.current || !pw.next}>{t("account.updatePassword")}</Button>
            <button type="button" onClick={resetPassword} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">{t("account.forgotPw")}</button>
          </div>
        </Card>

        <Card className="mb-3 p-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="text-[13.5px] font-extrabold">{t("account.emTitle")}</div>
            {!emOpen && <button type="button" onClick={() => { setEmOpen(true); setEmMsg({}); }} className="text-[11.5px] font-bold text-[#1d3a8f] hover:underline">{t("account.emChange")}</button>}
          </div>
          <p className="text-[12px] text-[var(--ink-2)]">{t("account.emCurrent", { email: p.email ?? "" })}</p>
          {p.pendingEmail && !emMsg.ok && <div className="mt-2 rounded-lg border border-[#f6d78a] bg-[#fff8e6] px-3 py-2 text-[12px] text-[#7a5a00]">{t("account.emPending", { email: p.pendingEmail })}</div>}
          {emMsg.err && <div className="mt-2 text-[12px] text-[var(--red)]">{emMsg.err}</div>}
          {emMsg.ok && <div className="mt-2 rounded-lg border border-[var(--line)] bg-[#eaf0fc] px-3 py-2 text-[12px] text-[#1d3a8f]">{emMsg.ok}</div>}
          {emOpen && (
            <div className="mt-2.5">
              <p className="mb-2 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">{t("account.emHelp")}</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div><FieldLabel>{t("account.emNewLabel")}</FieldLabel><Input type="email" autoComplete="email" value={em.next} onChange={(e) => setEm((s) => ({ ...s, next: e.target.value }))} className="w-full" /></div>
                {emNeedPw && <div><FieldLabel>{t("account.emPwLabel")}</FieldLabel><Input type="password" autoComplete="current-password" value={em.password} onChange={(e) => setEm((s) => ({ ...s, password: e.target.value }))} className="w-full" /></div>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button variant="primary" onClick={changeEmail} disabled={emBusy || !em.next.trim() || (emNeedPw && !em.password)}>{emBusy ? t("account.sending") : t("account.emSend")}</Button>
                <button type="button" onClick={() => { setEmOpen(false); setEmNeedPw(false); setEm({ next: "", password: "" }); setEmMsg({}); }} className="text-[12px] font-bold text-[var(--ink-3)] hover:underline">{t("account.cancel")}</button>
              </div>
            </div>
          )}
        </Card>

        <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div className="text-[12.5px] text-[var(--ink-3)]">{t("account.signedInAs", { email: p.email ?? "" })}</div>
          <div className="flex flex-wrap gap-2">
            {/* Ends every session on every device (lost phone, shared computer) — then this one. */}
            <Button variant="ghost" onClick={async () => {
              if (!window.confirm(t("account.signOutEverywhereConfirm"))) return;
              await api("/api/account/signout-everywhere", { method: "POST" }).catch(() => {});
              await signOutUser();
            }}>{t("account.signOutEverywhere")}</Button>
            <Button variant="danger" onClick={() => signOutUser()}>{t("account.signOut")}</Button>
          </div>
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
  const { t } = useI18n();
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
          if (m?.mine?.status === "active") memberships.push({ tenantId: pr.tenantId, name: pr.name, tierName: m.mine.tierName ?? t("account.memberFallback") });
        } catch { /* ignore a provider that has no membership programme */ }
      }
      setChecks({ outstanding: Math.round(outstanding * 100) / 100, toPayCount: unpaid.length, wallet: Math.round(wallet * 100) / 100, memberships });
    } catch { setErr(t("account.closeLoadErr")); }
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
      <div className="text-[13.5px] font-extrabold text-[#b3261e]">{t("account.closeTitle")}</div>
      <p className="mt-1 text-[12px] leading-[1.5] text-[var(--ink-3)]"><Rich text={t("account.closeLede")} vars={{ days: <b>{t("account.thirtyDays")}</b> }} /></p>

      {!open ? (
        <button type="button" onClick={loadChecks} className="mt-3 rounded-full border border-[#e2b6ae] px-4 py-2 text-[12.5px] font-bold text-[#b3261e] transition hover:bg-[#fdf3f1]">{t("account.closeStart")}</button>
      ) : done ? (
        <div className="mt-3 rounded-lg border border-[#f0cfc9] bg-[#fdf3f1] p-3 text-[13px] font-bold text-[#b3261e]">{t("account.closeDone")}</div>
      ) : !checks ? (
        <div className="mt-3 text-[12px] text-[var(--ink-3)]">{t("account.closeChecking")}</div>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {checks.outstanding > 0 ? (
            <div className="rounded-lg border border-[#f0cfc9] bg-[#fdf3f1] p-3 text-[12px] leading-[1.5] text-[#7a2a22]"><Rich text={checks.toPayCount === 1 ? t("account.owedOne") : t("account.owedMany", { n: checks.toPayCount })} vars={{ owed: <b>{t("account.owedBold", { amount: checks.outstanding.toFixed(2) })}</b> }} /> <a href="/custdash/bookings" className="font-bold underline">{t("account.goMyBookings")}</a></div>
          ) : (
            <div className="rounded-lg border border-[#cfe9df] bg-[#e9f9f2] p-2.5 text-[12px] font-semibold text-[#0b5a3f]">{t("account.noOutstanding")}</div>
          )}
          {checks.memberships.length > 0 && (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5 text-[12px] leading-[1.5] text-[var(--ink-2)]"><Rich text={checks.memberships.length > 1 ? t("account.membershipsMany") : t("account.membershipsOne")} vars={{ cancelled: <b>{checks.memberships.length > 1 ? t("account.cancelledMany") : t("account.cancelledOne")}</b>, list: checks.memberships.map((m) => `${m.tierName} (${m.name})`).join(", ") }} /></div>
          )}
          {checks.wallet > 0 && (
            <div className="rounded-lg border border-[#f6d78a] bg-[#fff8e6] p-2.5 text-[12px] leading-[1.5] text-[#7a5a00]"><Rich text={t("account.walletWarn")} vars={{ amount: <b>£{checks.wallet.toFixed(2)}</b> }} /></div>
          )}
          <div>
            <FieldLabel>{t("account.whyLeaving")} <span className="font-normal normal-case text-[var(--ink-3)]">{t("account.optional")}</span></FieldLabel>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full" placeholder={t("account.whyLeavingPh")} />
          </div>
          <label className="flex items-start gap-2 text-[12px] leading-[1.5] text-[var(--ink-2)]">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 flex-none" disabled={checks.outstanding > 0} />
            {t("account.closeAck")}
          </label>
          {err && <div className="text-[12px] font-bold text-[var(--red)]">{err}</div>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setOpen(false); setChecks(null); setAck(false); setReason(""); }} className="rounded-full border border-[var(--line)] px-4 py-2 text-[12.5px] font-bold text-[var(--ink-2)] transition hover:bg-[var(--panel)]">{t("account.keepAccount")}</button>
            <button type="button" onClick={confirmClose} disabled={checks.outstanding > 0 || !ack || busy} className="rounded-full bg-[#b3261e] px-4 py-2 text-[12.5px] font-extrabold text-white transition enabled:hover:brightness-110 disabled:opacity-40">{busy ? t("account.closing") : t("account.closeTitle")}</button>
          </div>
        </div>
      )}
    </Card>
  );
}
