"use client";

import { uiDate, uiTime } from "@/lib/i18n/format";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiPublic } from "@/lib/api";
import { useI18n } from "@/lib/i18n/provider";
import { isRTL } from "@/lib/i18n/config";
import { BRAND as BRAND_NAME } from "@/lib/i18n/config";

// Public "Book a demo" lead form — the marketing site's demo/talk-to-us buttons
// point here. Posts to the public POST /api/leads (no login); the lead lands in
// the HQ Leads list + fires the HQ bell. Loads the SITE's own stylesheet
// (public/v2/activly.css) and reuses its real header markup/classes, so this
// page is visually part of the site — not a standalone dark-themed detour.
//
// Two-column layout (host + what's covered + testimonials, then the form) —
// the testimonials are the same four real quotes already on the homepage
// (public/v2/activly.html), kept verbatim rather than inventing new ones.
//
// Two things this page does beyond a plain form:
//  - The call slots are real HQ-managed availability (server/src/routes/
//    demoSlots.ts, managed from Platform → Sales pipeline → Demo slots),
//    not decorative — picking one sends `slotAt` and the slot stops being
//    offered to anyone else.
//  - The "what to cover" checklist is role-specific: a freelancer has no
//    staff to roster, a franchise doesn't manage OTHER franchises, etc. —
//    see COVERS_BY_ROLE, built from the actual portal nav differences
//    (lib/nav/config.ts), not a generic list.

// Four options shown, but the backend's `plan` field only knows about the
// three real portal tiers (freelancer/company/franchise — see signup) — a
// school or MAT runs the same head-office-style feature set as a company, so
// it submits as plan "company" with businessType "school" kept alongside to
// stay visible to HQ (see normaliseLead in SalesApp.tsx).
type Role = "freelancer" | "company" | "franchise" | "school";
// label/hint are catalogue keys (p8pub.*), resolved at render time.
const ROLES: { v: Role; label: string; hint: string }[] = [
  { v: "freelancer", label: "p8pub.suFreelancer", hint: "p8pub.dmHFreelancer" },
  { v: "company", label: "p8pub.dmRCompany", hint: "p8pub.dmHCompany" },
  { v: "franchise", label: "p8pub.dmRFranchise", hint: "p8pub.dmHFranchise" },
  { v: "school", label: "p8pub.dmRSchool", hint: "p8pub.dmHSchool" },
];
const PLAN_BY_ROLE: Record<Role, "freelancer" | "company" | "franchise"> = {
  freelancer: "freelancer", company: "company", franchise: "franchise", school: "company",
};

// Every role creates listings and takes bookings, and every role has
// messaging/email/newsfeed to parents & families — those are constants.
// What genuinely differs: a freelancer has no staff to roster, payroll or
// train, and doesn't manage other franchises (and, correctly, has no
// leave/timesheets screens either — those were removed from the freelancer
// portal, not just left off this list, since there's no one for a solo
// operator to approve them for); a franchise runs its OWN team but doesn't
// manage other franchises, and owes royalties rather than collecting them;
// only head office sees the franchise-network tools; a school/MAT cares most
// about safeguarding/DBS and, for a MAT, running it across more than one
// school.
// `label` is the English value sent as interestedFeatures (never translated); `k` is the display key.
const COVERS_BY_ROLE: Record<Role, { icon: string; label: string; k: string }[]> = {
  freelancer: [
    { icon: "🎟️", label: "Create listings & take bookings", k: "p8pub.dmC1" },
    { icon: "🧑‍🏫", label: "Registers, ratios & safeguarding", k: "p8pub.dmC2" },
    { icon: "💬", label: "Messages, email & parent updates", k: "p8pub.dmC3" },
    { icon: "📣", label: "Marketing & filling empty seats", k: "p8pub.dmC4" },
    { icon: "💷", label: "Money in/out, invoicing & finance", k: "p8pub.dmC5" },
  ],
  company: [
    { icon: "🎟️", label: "Create listings & take bookings", k: "p8pub.dmC1" },
    { icon: "🧑‍🏫", label: "Registers, ratios & safeguarding", k: "p8pub.dmC2" },
    { icon: "👥", label: "Staff rotas, payroll & training", k: "p8pub.dmC6" },
    { icon: "🏬", label: "Managing multiple sites or franchises", k: "p8pub.dmC7" },
    { icon: "💬", label: "Messages, email & parent updates", k: "p8pub.dmC3" },
    { icon: "📣", label: "Marketing, finance & invoicing", k: "p8pub.dmC8" },
  ],
  franchise: [
    { icon: "🎟️", label: "Create listings & take bookings", k: "p8pub.dmC1" },
    { icon: "🧑‍🏫", label: "Registers, ratios & safeguarding", k: "p8pub.dmC2" },
    { icon: "👥", label: "Your team's rota, payroll & training", k: "p8pub.dmC9" },
    { icon: "💬", label: "Messages, email & parent updates", k: "p8pub.dmC3" },
    { icon: "💷", label: "Royalties, invoicing & reconciliation", k: "p8pub.dmC10" },
    { icon: "📣", label: "Marketing & filling empty seats", k: "p8pub.dmC4" },
  ],
  school: [
    { icon: "🎟️", label: "Create listings & take bookings", k: "p8pub.dmC1" },
    { icon: "🧑‍🏫", label: "Registers, ratios & safeguarding", k: "p8pub.dmC2" },
    { icon: "🎓", label: "DBS, safer recruitment & staff training", k: "p8pub.dmC11" },
    { icon: "💬", label: "Messages, email & parent updates", k: "p8pub.dmC3" },
    { icon: "🏫", label: "Running it across more than one school (MAT)", k: "p8pub.dmC12" },
    { icon: "💷", label: "Invoicing & reconciliation", k: "p8pub.dmC13" },
  ],
};

const TESTIMONIALS: { quote: string; initials: string; name: string; role: string }[] = [ // quote/role are catalogue keys
  { quote: "p8pub.dmQ1", initials: "AP", name: "APF Activity Camps", role: "p8pub.dmQR1" },
  { quote: "p8pub.dmQ2", initials: "KK", name: "Keeping Kids Off The Street", role: "p8pub.dmQR2" },
  { quote: "p8pub.dmQ3", initials: "CZ", name: "Combat Zone MK", role: "p8pub.dmQR3" },
  { quote: "p8pub.dmQ4", initials: "KO", name: "Kick-Off Sports", role: "p8pub.dmQR4" },
];

interface Slot { iso: string; durationMins: number }

const ukDateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }); // raw-locale-ok: machine date key, not shown to anyone

// Site tokens (public/v2/activly.css :root) — kept as JS constants only
// where inline styles need a plain colour (borders, box-shadow); everything
// else uses the site's own classes so it stays in sync with the CSS file.
const BRAND = "#1d3a8f";
const INK = "#171534";
const INK2 = "#4a4763";
const INK3 = "#8a86a3";
const LINE = "#ece6f1";
const SURFACE = "#ffffff";
const PANEL = "#fbf8fc";

const field: React.CSSProperties = {
  width: "100%", background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 11,
  padding: "11px 13px", color: INK, fontSize: 15, fontWeight: 500, outline: "none",
};
const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 800, color: INK2, marginBottom: 6, display: "block" };

export default function DemoPage() {
  const { t, locale } = useI18n();
  const arrow = isRTL(locale) ? "←" : "→";
  // Built per language (module-level formatters would freeze the first language seen).
  const { dayFmt, timeFmt } = useMemo(() => ({
    dayFmt: { format: (d: Date) => uiDate(d, { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" }) },
    timeFmt: { format: (d: Date) => uiTime(d, { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [locale]);
  const [f, setF] = useState({ name: "", email: "", phone: "", business: "", size: "", interest: "", message: "" });
  const [role, setRole] = useState<Role>("company");
  const [features, setFeatures] = useState<string[]>([]);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotAt, setSlotAt] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });
  const toggleFeature = (l: string) => setFeatures((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));

  // Switching role resets ticks that don't apply to the new one (e.g. "Staff
  // rotas" isn't offered to a freelancer) rather than silently carrying a
  // ticked box the visitor can no longer see.
  const setRoleAndPrune = (r: Role) => {
    setRole(r);
    const valid = new Set(COVERS_BY_ROLE[r].map((c) => c.label));
    setFeatures((prev) => prev.filter((x) => valid.has(x)));
  };

  useEffect(() => {
    apiPublic<Slot[]>("/api/demo-slots").then(setSlots).catch(() => setSlots([]));
  }, []);

  const slotsByDay = (slots ?? []).reduce<Record<string, Slot[]>>((acc, s) => {
    const key = ukDateKey.format(new Date(s.iso));
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  const chosenSlot = slots?.find((s) => s.iso === slotAt);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || !f.email.trim()) return;
    setState("sending");
    try {
      await apiPublic("/api/leads", {
        method: "POST",
        body: JSON.stringify({
          ...f, plan: PLAN_BY_ROLE[role], businessType: role === "school" ? "school" : undefined,
          interestedFeatures: features, slotAt: slotAt ?? undefined, source: "demo",
        }),
      });
      setState("done");
    } catch {
      setState("error");
    }
  };

  return (
    <>
      <link rel="stylesheet" href="/v2/activly.css" />
      <div style={{ minHeight: "100vh", background: "var(--bg, #f5f8fd)", color: INK, fontFamily: "var(--ff, system-ui)" }}>
        <header className="nav">
          <div className="shell nav-in">
            <Link className="brand" href="/v2/activly.html">
              <span className="logo" aria-hidden="true" style={{ background: "none", boxShadow: "none" }}>
                <img src="/brand/mark.svg" alt="" width={36} height={36} style={{ display: "block" }} />
              </span>
              <span>{BRAND_NAME}</span>
            </Link>
            <nav className="nav-links">
              <Link className="navtab" href="/v2/activly.html">{t("p8pub.dmNavHome")}</Link>
              <Link className="navtab" href="/v2/pricing.html">{t("p8pub.dmNavPricing")}</Link>
              <Link className="navtab" href="/v2/security.html">{t("p8pub.dmNavSecurity")}</Link>
            </nav>
            <div className="nav-cta">
              <Link className="signin" href="/login">{t("p7login.signIn")}</Link>
              <Link className="btn btn-primary btn-sm" href="/signup">{t("p8pub.dmGetStarted")}</Link>
            </div>
          </div>
        </header>

        <div style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), linear-gradient(120deg,#16306e 0%,#274ba3 58%,#3f78d8 100%)",
          backgroundSize: "18px 18px, cover",
          backgroundRepeat: "repeat, no-repeat",
        }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 20px 60px" }}>
          <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 34, alignItems: "start" }} className="demo-grid">
            {/* Left: who, what, proof */}
            <div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#fff", border: "1px solid rgba(255,255,255,.35)", background: "rgba(255,255,255,.12)", borderRadius: 999, padding: "6px 12px" }}>
                🎉 {t("p8pub.dmBadge")}
              </span>
              <h1 style={{ fontSize: 34, fontWeight: 800, margin: "16px 0 8px", lineHeight: 1.12, color: "#fff" }}>
                {t("p8pub.dmH1")}
              </h1>
              <p style={{ color: "rgba(255,255,255,.78)", fontSize: 15.5, margin: "0 0 22px", lineHeight: 1.55, maxWidth: "48ch" }}>
                {t("p8pub.dmSub")}
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 26 }}>
                <span style={{ width: 48, height: 48, borderRadius: "50%", background: "#fff", color: BRAND, fontWeight: 800, fontSize: 17, display: "grid", placeItems: "center", flex: "none" }}>A</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{t("p8pub.dmExpert")}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,.7)", fontWeight: 600 }}>{t("p8pub.dmTeam")}</div>
                </div>
              </div>

              <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 18, padding: "20px 22px", boxShadow: "0 8px 26px rgba(16,35,86,.08), 0 2px 6px rgba(16,35,86,.05)" }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: INK2, marginBottom: 14 }}>{t("p8pub.dmDig")} {arrow}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 18px" }} className="demo-covers">
                  {COVERS_BY_ROLE[role].map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{c.icon}</span>
                      <span style={{ fontSize: 13.5, color: INK2, lineHeight: 1.45, fontWeight: 600 }}>{t(c.k)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 14 }}>
                {TESTIMONIALS.map((q, i) => (
                  <div key={i} style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: "16px 18px", boxShadow: "0 8px 26px rgba(16,35,86,.08), 0 2px 6px rgba(16,35,86,.05)" }}>
                    <div style={{ color: "#f5b81f", fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>★★★★★</div>
                    <p style={{ margin: "0 0 12px", fontSize: 13.5, color: INK2, lineHeight: 1.55 }}>&ldquo;{t(q.quote)}&rdquo;</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 30, height: 30, borderRadius: 9, background: PANEL, color: INK2, fontSize: 11, fontWeight: 800, display: "grid", placeItems: "center", flex: "none" }}>{q.initials}</span>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: INK }}>{q.name}</div>
                        <div style={{ fontSize: 11.5, color: INK3, fontWeight: 600 }}>{t(q.role)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: the form */}
            <div style={{ position: "sticky", top: 24, width: "100%", background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 22, padding: "30px 30px 34px", boxShadow: "0 20px 46px -24px rgba(18,12,44,.25)" }}>
              {state === "done" ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: 44, marginBottom: 10 }}>✅</div>
                  <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px", color: INK }}>{f.name.split(" ")[0] ? t("p8pub.dmThanks", { name: f.name.split(" ")[0] }) : t("p8pub.dmThanksThere")}</h2>
                  <p style={{ color: INK2, fontSize: 15, lineHeight: 1.55, margin: "0 auto", maxWidth: "38ch" }}>
                    {chosenSlot
                      ? t("p8pub.dmBooked", { when: t("p8pub.dmAt", { day: dayFmt.format(new Date(chosenSlot.iso)), time: timeFmt.format(new Date(chosenSlot.iso)) }) }).split("**").map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>))
                      : t("p8pub.dmLanded")} {t("p8pub.dmMeantime")}
                  </p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22, flexWrap: "wrap" }}>
                    <Link href="/signup" style={{ background: BRAND, color: "#fff", fontWeight: 800, fontSize: 15, padding: "12px 22px", borderRadius: 999, textDecoration: "none" }}>{t("p8pub.dmStartFree")} {arrow}</Link>
                    <Link href="/v2/activly.html" style={{ background: "transparent", color: INK2, fontWeight: 800, fontSize: 15, padding: "12px 22px", borderRadius: 999, textDecoration: "none", border: `1px solid ${LINE}` }}>{t("p8pub.dmBackSite")}</Link>
                  </div>
                </div>
              ) : (
                <>
                  <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: BRAND }}>{t("p8pub.dmApply")}</span>
                  <h2 style={{ fontSize: 23, fontWeight: 800, margin: "10px 0 6px", lineHeight: 1.15, color: INK }}>{t("p8pub.dmLimited")}</h2>
                  <p style={{ color: INK3, fontSize: 13.5, margin: "0 0 20px", lineHeight: 1.5 }}>{t("p8pub.dmLeave").split("{link}").flatMap((part, i, arr) => i < arr.length - 1 ? [part, <Link key={i} href="/signup" style={{ color: BRAND, fontWeight: 700 }}>{t("p8pub.dmStartFreeInstead")}</Link>] : [part])}</p>

                  <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                    <div>
                      <label style={label}>{t("p8pub.dmYoureA")}</label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {ROLES.map((r) => (
                          <button key={r.v} type="button" onClick={() => setRoleAndPrune(r.v)} title={t(r.hint)}
                            style={{ padding: "9px 6px", borderRadius: 10, border: `1px solid ${role === r.v ? BRAND : LINE}`, background: role === r.v ? "#eaf0fc" : PANEL, color: role === r.v ? BRAND : INK2, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                            {t(r.label)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={label}>{t("p8pub.dmPickTime")}</label>
                      {slots === null ? (
                        <div style={{ fontSize: 12.5, color: INK3, padding: "8px 0" }}>{t("p8pub.dmLoadingTimes")}</div>
                      ) : Object.keys(slotsByDay).length === 0 ? (
                        <div style={{ fontSize: 12.5, color: INK3, padding: "8px 0" }}>{t("p8pub.dmNoTimes")}</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 220, overflowY: "auto", paddingInlineEnd: 2 }}>
                          {Object.entries(slotsByDay).map(([day, daySlots]) => (
                            <div key={day}>
                              <div style={{ fontSize: 11, fontWeight: 800, color: INK3, marginBottom: 5 }}>{dayFmt.format(new Date(daySlots[0].iso))}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {daySlots.map((s) => {
                                  const on = slotAt === s.iso;
                                  return (
                                    <button key={s.iso} type="button" onClick={() => setSlotAt(on ? null : s.iso)}
                                      style={{ padding: "7px 12px", borderRadius: 999, border: `1px solid ${on ? BRAND : LINE}`, background: on ? BRAND : PANEL, color: on ? "#fff" : INK2, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                                      {timeFmt.format(new Date(s.iso))}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div><label style={label}>{t("p8pub.dmNameStar")}</label><input style={field} value={f.name} onChange={set("name")} required placeholder="Jane Smith" /></div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
                      <div><label style={label}>{t("p8pub.dmEmailStar")}</label><input style={field} type="email" value={f.email} onChange={set("email")} required placeholder="jane@club.co.uk" /></div>
                      <div><label style={label}>{t("p8pub.suPhone")}</label><input style={field} value={f.phone} onChange={set("phone")} placeholder="07…" /></div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
                      <div><label style={label}>{t("p8pub.suBizName")}</label><input style={field} value={f.business} onChange={set("business")} placeholder="Sunrise Camps" /></div>
                      <div><label style={label}>{t("p8pub.dmTeamSize")}</label>
                        <select style={{ ...field, appearance: "none" }} value={f.size} onChange={set("size")}>
                          <option value="">{t("p8pub.dmSelect")}</option><option value="Just me">{t("p8pub.dmJustMe")}</option><option>2–10</option><option>11–30</option><option>31–75</option><option value="76+ / franchise">{t("p8pub.dmFranchisePlus")}</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={label}>{t("p8pub.dmCoverQ")}</label>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {COVERS_BY_ROLE[role].map((c) => {
                          const on = features.includes(c.label);
                          return (
                            <button key={c.label} type="button" onClick={() => toggleFeature(c.label)}
                              style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "start", background: on ? "#eaf0fc" : PANEL, border: `1px solid ${on ? BRAND : LINE}`, borderRadius: 10, padding: "9px 12px", cursor: "pointer" }}>
                              <span aria-hidden style={{ width: 17, height: 17, borderRadius: 5, border: `1.5px solid ${on ? BRAND : INK3}`, background: on ? BRAND : "transparent", flex: "none", display: "grid", placeItems: "center", fontSize: 11, color: "#fff", fontWeight: 800 }}>{on ? "✓" : ""}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: on ? INK : INK2 }}>{c.icon} {t(c.k)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div><label style={label}>{t("p8pub.dmElse")}</label><textarea style={{ ...field, minHeight: 70, resize: "vertical" }} value={f.message} onChange={set("message")} placeholder={t("p8pub.dmMsgPh")} /></div>
                    {state === "error" && <div style={{ color: "#c0392b", fontSize: 13, fontWeight: 700 }}>{t("p8pub.dmError")}</div>}
                    <button type="submit" disabled={state === "sending"} style={{ background: BRAND, color: "#fff", fontWeight: 800, fontSize: 16, padding: "14px", borderRadius: 12, border: 0, cursor: "pointer", opacity: state === "sending" ? 0.7 : 1, marginTop: 4 }}>
                      {state === "sending" ? t("p8pub.dmSending") : `${slotAt ? t("p8pub.dmBookBtn") : t("p8pub.dmRequestBtn")} ${arrow}`}
                    </button>
                    <p style={{ color: INK3, fontSize: 11.5, textAlign: "center", margin: 0 }}>{t("p8pub.dmPrivacyNote")}</p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
        </div>

        <style>{`
          /* keep the fixed language picker (top inline-end corner) clear of the site header's buttons */
          header.nav .nav-cta { margin-left: 0; margin-inline-start: auto; margin-inline-end: 60px; }
          @media (min-width: 640px) { header.nav .nav-cta { margin-inline-end: 100px; } }
          @media (min-width: 1460px) { header.nav .nav-cta { margin-inline-end: 0; } }
          @media (max-width: 860px) {
            .demo-grid { grid-template-columns: 1fr !important; }
            .demo-covers { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </>
  );
}
