"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiPublic } from "@/lib/api";

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
const ROLES: { v: Role; label: string; hint: string }[] = [
  { v: "freelancer", label: "Freelancer", hint: "Solo or a couple of coaches" },
  { v: "company", label: "Company / Head office", hint: "Runs its own team & sites" },
  { v: "franchise", label: "Franchise", hint: "A site under a franchisor" },
  { v: "school", label: "School or MAT", hint: "Wraparound, holiday club or lettings" },
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
const COVERS_BY_ROLE: Record<Role, { icon: string; label: string }[]> = {
  freelancer: [
    { icon: "🎟️", label: "Create listings & take bookings" },
    { icon: "🧑‍🏫", label: "Registers, ratios & safeguarding" },
    { icon: "💬", label: "Messages, email & parent updates" },
    { icon: "📣", label: "Marketing & filling empty seats" },
    { icon: "💷", label: "Money in/out, invoicing & finance" },
  ],
  company: [
    { icon: "🎟️", label: "Create listings & take bookings" },
    { icon: "🧑‍🏫", label: "Registers, ratios & safeguarding" },
    { icon: "👥", label: "Staff rotas, payroll & training" },
    { icon: "🏬", label: "Managing multiple sites or franchises" },
    { icon: "💬", label: "Messages, email & parent updates" },
    { icon: "📣", label: "Marketing, finance & invoicing" },
  ],
  franchise: [
    { icon: "🎟️", label: "Create listings & take bookings" },
    { icon: "🧑‍🏫", label: "Registers, ratios & safeguarding" },
    { icon: "👥", label: "Your team's rota, payroll & training" },
    { icon: "💬", label: "Messages, email & parent updates" },
    { icon: "💷", label: "Royalties, invoicing & reconciliation" },
    { icon: "📣", label: "Marketing & filling empty seats" },
  ],
  school: [
    { icon: "🎟️", label: "Create listings & take bookings" },
    { icon: "🧑‍🏫", label: "Registers, ratios & safeguarding" },
    { icon: "🎓", label: "DBS, safer recruitment & staff training" },
    { icon: "💬", label: "Messages, email & parent updates" },
    { icon: "🏫", label: "Running it across more than one school (MAT)" },
    { icon: "💷", label: "Invoicing & reconciliation" },
  ],
};

const TESTIMONIALS: { quote: string; initials: string; name: string; role: string }[] = [
  { quote: "We run the whole summer from one screen now — bookings, registers, payroll and parent updates. It paid for itself in the first week.", initials: "AP", name: "APF Activity Camps", role: "Holiday camps · Milton Keynes" },
  { quote: "A flat fee means growth never costs us more. Every extra place we fill stays with us, so we can reach more young people.", initials: "KK", name: "Keeping Kids Off The Street", role: "Youth programmes" },
  { quote: "Parents book and pay in seconds on our own branded page, and the AI Front Desk answers the calls we used to miss.", initials: "CZ", name: "Combat Zone MK", role: "Martial arts & fitness" },
  { quote: "Registers, ratios and safeguarding are all on my phone on the day. It's the first system that actually feels built for coaches.", initials: "KO", name: "Kick-Off Sports", role: "Grassroots football" },
];

interface Slot { iso: string; durationMins: number }

const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const ukDateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });

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
              <span className="logo" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M3 11.5L21 3l-8.5 18-2.2-7.3L3 11.5z" fill="#fff" /></svg>
              </span>
              <span>Activ<span className="os">ly</span></span>
            </Link>
            <nav className="nav-links">
              <Link className="navtab" href="/v2/activly.html">Home</Link>
              <Link className="navtab" href="/v2/pricing.html">Pricing</Link>
              <Link className="navtab" href="/v2/security.html">Security</Link>
            </nav>
            <div className="nav-cta">
              <Link className="signin" href="/login">Sign in</Link>
              <Link className="btn btn-primary btn-sm" href="/signup">Get started</Link>
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
                🎉 Free · 1-on-1 · Not a sales call
              </span>
              <h1 style={{ fontSize: 34, fontWeight: 800, margin: "16px 0 8px", lineHeight: 1.12, color: "#fff" }}>
                See Activly running on your own activities.
              </h1>
              <p style={{ color: "rgba(255,255,255,.78)", fontSize: 15.5, margin: "0 0 22px", lineHeight: 1.55, maxWidth: "48ch" }}>
                30 live minutes, your own sessions on screen — we&rsquo;ll show you exactly what changes for your day, not a slide deck.
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 26 }}>
                <span style={{ width: 48, height: 48, borderRadius: "50%", background: "#fff", color: BRAND, fontWeight: 800, fontSize: 17, display: "grid", placeItems: "center", flex: "none" }}>A</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>with one of our experts</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,.7)", fontWeight: 600 }}>from the Activly team</div>
                </div>
              </div>

              <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 18, padding: "20px 22px", boxShadow: "0 8px 26px rgba(16,35,86,.08), 0 2px 6px rgba(16,35,86,.05)" }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: INK2, marginBottom: 14 }}>Here&rsquo;s what we&rsquo;ll dig into for you →</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 18px" }} className="demo-covers">
                  {COVERS_BY_ROLE[role].map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{c.icon}</span>
                      <span style={{ fontSize: 13.5, color: INK2, lineHeight: 1.45, fontWeight: 600 }}>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 14 }}>
                {TESTIMONIALS.map((t, i) => (
                  <div key={i} style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: "16px 18px", boxShadow: "0 8px 26px rgba(16,35,86,.08), 0 2px 6px rgba(16,35,86,.05)" }}>
                    <div style={{ color: "#f5b81f", fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>★★★★★</div>
                    <p style={{ margin: "0 0 12px", fontSize: 13.5, color: INK2, lineHeight: 1.55 }}>&ldquo;{t.quote}&rdquo;</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 30, height: 30, borderRadius: 9, background: PANEL, color: INK2, fontSize: 11, fontWeight: 800, display: "grid", placeItems: "center", flex: "none" }}>{t.initials}</span>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: INK }}>{t.name}</div>
                        <div style={{ fontSize: 11.5, color: INK3, fontWeight: 600 }}>{t.role}</div>
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
                  <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px", color: INK }}>Thanks, {f.name.split(" ")[0] || "there"}!</h2>
                  <p style={{ color: INK2, fontSize: 15, lineHeight: 1.55, margin: "0 auto", maxWidth: "38ch" }}>
                    {chosenSlot
                      ? <>You&rsquo;re booked for <b>{dayFmt.format(new Date(chosenSlot.iso))} at {timeFmt.format(new Date(chosenSlot.iso))}</b> — we&rsquo;ll email a confirmation shortly.</>
                      : <>Your request has landed with us — we&rsquo;ll be in touch shortly to arrange your call.</>} In the meantime you can start free any time.
                  </p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22, flexWrap: "wrap" }}>
                    <Link href="/signup" style={{ background: BRAND, color: "#fff", fontWeight: 800, fontSize: 15, padding: "12px 22px", borderRadius: 999, textDecoration: "none" }}>Start free →</Link>
                    <Link href="/v2/activly.html" style={{ background: "transparent", color: INK2, fontWeight: 800, fontSize: 15, padding: "12px 22px", borderRadius: 999, textDecoration: "none", border: `1px solid ${LINE}` }}>Back to site</Link>
                  </div>
                </div>
              ) : (
                <>
                  <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: BRAND }}>Apply for your call</span>
                  <h2 style={{ fontSize: 23, fontWeight: 800, margin: "10px 0 6px", lineHeight: 1.15, color: INK }}>Limited to a few per week.</h2>
                  <p style={{ color: INK3, fontSize: 13.5, margin: "0 0 20px", lineHeight: 1.5 }}>Leave your details and pick a time — no obligation. Prefer to dive in? <Link href="/signup" style={{ color: BRAND, fontWeight: 700 }}>Start free instead</Link>.</p>

                  <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                    <div>
                      <label style={label}>You&rsquo;re a…</label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {ROLES.map((r) => (
                          <button key={r.v} type="button" onClick={() => setRoleAndPrune(r.v)} title={r.hint}
                            style={{ padding: "9px 6px", borderRadius: 10, border: `1px solid ${role === r.v ? BRAND : LINE}`, background: role === r.v ? "#eaf0fc" : PANEL, color: role === r.v ? BRAND : INK2, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={label}>Pick a time (next 7 days, UK time)</label>
                      {slots === null ? (
                        <div style={{ fontSize: 12.5, color: INK3, padding: "8px 0" }}>Loading available times…</div>
                      ) : Object.keys(slotsByDay).length === 0 ? (
                        <div style={{ fontSize: 12.5, color: INK3, padding: "8px 0" }}>No open times right now — leave your details below and we&rsquo;ll reach out to find one.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 220, overflowY: "auto", paddingRight: 2 }}>
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

                    <div><label style={label}>Your name *</label><input style={field} value={f.name} onChange={set("name")} required placeholder="Jane Smith" /></div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
                      <div><label style={label}>Email *</label><input style={field} type="email" value={f.email} onChange={set("email")} required placeholder="jane@club.co.uk" /></div>
                      <div><label style={label}>Phone</label><input style={field} value={f.phone} onChange={set("phone")} placeholder="07…" /></div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
                      <div><label style={label}>Business name</label><input style={field} value={f.business} onChange={set("business")} placeholder="Sunrise Camps" /></div>
                      <div><label style={label}>Team size</label>
                        <select style={{ ...field, appearance: "none" }} value={f.size} onChange={set("size")}>
                          <option value="">Select…</option><option>Just me</option><option>2–10</option><option>11–30</option><option>31–75</option><option>76+ / franchise</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={label}>What would you like us to cover? (optional)</label>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {COVERS_BY_ROLE[role].map((c) => {
                          const on = features.includes(c.label);
                          return (
                            <button key={c.label} type="button" onClick={() => toggleFeature(c.label)}
                              style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: on ? "#eaf0fc" : PANEL, border: `1px solid ${on ? BRAND : LINE}`, borderRadius: 10, padding: "9px 12px", cursor: "pointer" }}>
                              <span aria-hidden style={{ width: 17, height: 17, borderRadius: 5, border: `1.5px solid ${on ? BRAND : INK3}`, background: on ? BRAND : "transparent", flex: "none", display: "grid", placeItems: "center", fontSize: 11, color: "#fff", fontWeight: 800 }}>{on ? "✓" : ""}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: on ? INK : INK2 }}>{c.icon} {c.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div><label style={label}>Anything else? (optional)</label><textarea style={{ ...field, minHeight: 70, resize: "vertical" }} value={f.message} onChange={set("message")} placeholder="What you run, what you use now…" /></div>
                    {state === "error" && <div style={{ color: "#c0392b", fontSize: 13, fontWeight: 700 }}>Something went wrong — please try again, or email us.</div>}
                    <button type="submit" disabled={state === "sending"} style={{ background: BRAND, color: "#fff", fontWeight: 800, fontSize: 16, padding: "14px", borderRadius: 12, border: 0, cursor: "pointer", opacity: state === "sending" ? 0.7 : 1, marginTop: 4 }}>
                      {state === "sending" ? "Sending…" : slotAt ? "Book my call →" : "Request my call →"}
                    </button>
                    <p style={{ color: INK3, fontSize: 11.5, textAlign: "center", margin: 0 }}>We&rsquo;ll only use your details to contact you about a demo.</p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
        </div>

        <style>{`
          @media (max-width: 860px) {
            .demo-grid { grid-template-columns: 1fr !important; }
            .demo-covers { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </>
  );
}
