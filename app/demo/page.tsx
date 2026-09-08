"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPublic } from "@/lib/api";

// Public "Book a demo" lead form — the marketing site's demo/talk-to-us buttons
// point here. Posts to the public POST /api/leads (no login); the lead lands in
// the HQ Leads list + fires the HQ bell. Styled to match the marketing site
// (dark navy + pink) so the hand-off from the site feels seamless.
const BG = "#1B2347";
const CARD = "#262D51";
const LINE = "#39426E";
const INK = "#EAF0FF";
const INK2 = "#c9d2ea";
const INK3 = "#9AA6C8";
const PINK = "#FF3D7F";

const field: React.CSSProperties = {
  width: "100%", background: "#111A3A", border: `1px solid ${LINE}`, borderRadius: 11,
  padding: "11px 13px", color: INK, fontSize: 15, fontWeight: 500, outline: "none",
};
const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 800, color: INK2, marginBottom: 6, display: "block" };

export default function DemoPage() {
  const [f, setF] = useState({ name: "", email: "", phone: "", business: "", size: "", interest: "", message: "" });
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || !f.email.trim()) return;
    setState("sending");
    try {
      await apiPublic("/api/leads", { method: "POST", body: JSON.stringify({ ...f, source: "demo" }) });
      setState("done");
    } catch {
      setState("error");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, color: INK, fontFamily: "var(--ff, system-ui)", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px" }}>
      <Link href="/nametbc.html" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", marginBottom: 30 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: PINK, display: "grid", placeItems: "center" }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M3 11.5L21 3l-8.5 18-2.2-7.3L3 11.5z" fill="#fff" /></svg>
        </span>
        <span style={{ fontWeight: 800, fontSize: 18, color: INK }}>Wiggle<span style={{ color: PINK }}>kit</span></span>
      </Link>

      <div style={{ width: "100%", maxWidth: 520, background: CARD, border: `1px solid ${LINE}`, borderRadius: 22, padding: "30px 30px 34px", boxShadow: "0 30px 70px -40px rgba(0,0,0,.7)" }}>
        {state === "done" ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>✅</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 8px" }}>Thanks, {f.name.split(" ")[0] || "there"}!</h1>
            <p style={{ color: INK2, fontSize: 15.5, lineHeight: 1.55, margin: "0 auto", maxWidth: "38ch" }}>
              Your request has landed with us — we&rsquo;ll be in touch shortly to arrange your demo. In the meantime you can start free any time.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22, flexWrap: "wrap" }}>
              <Link href="/signup" style={{ background: PINK, color: "#fff", fontWeight: 800, fontSize: 15, padding: "12px 22px", borderRadius: 999, textDecoration: "none" }}>Start free →</Link>
              <Link href="/nametbc.html" style={{ background: "transparent", color: INK2, fontWeight: 800, fontSize: 15, padding: "12px 22px", borderRadius: 999, textDecoration: "none", border: `1px solid ${LINE}` }}>Back to site</Link>
            </div>
          </div>
        ) : (
          <>
            <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: PINK }}>Book a demo</span>
            <h1 style={{ fontSize: 27, fontWeight: 800, margin: "10px 0 6px", lineHeight: 1.1 }}>See it on your own activities.</h1>
            <p style={{ color: INK3, fontSize: 14.5, margin: "0 0 22px", lineHeight: 1.5 }}>Leave your details and we&rsquo;ll set up a quick walkthrough — no obligation. Prefer to dive in? <Link href="/signup" style={{ color: PINK, fontWeight: 700 }}>Start free instead</Link>.</p>

            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
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
              <div><label style={label}>Anything you&rsquo;d like to cover?</label><textarea style={{ ...field, minHeight: 84, resize: "vertical" }} value={f.message} onChange={set("message")} placeholder="What you run, what you use now, what you'd like to see…" /></div>
              {state === "error" && <div style={{ color: "#ff6f91", fontSize: 13, fontWeight: 700 }}>Something went wrong — please try again, or email us.</div>}
              <button type="submit" disabled={state === "sending"} style={{ background: PINK, color: "#fff", fontWeight: 800, fontSize: 16, padding: "14px", borderRadius: 12, border: 0, cursor: "pointer", opacity: state === "sending" ? 0.7 : 1, marginTop: 4 }}>
                {state === "sending" ? "Sending…" : "Request my demo →"}
              </button>
              <p style={{ color: INK3, fontSize: 11.5, textAlign: "center", margin: 0 }}>We&rsquo;ll only use your details to contact you about a demo.</p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
