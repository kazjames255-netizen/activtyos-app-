"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { firebaseAuth } from "@/lib/firebase/client";
import { AosMark } from "@/components/auth/AuthBrand";

// Secure viewer for a child's EHCP / SEND plan, opened straight from the link
// in a new-booking email. The file lives behind an authenticated API route (no
// public URL — special-category data), so we fetch it here with the signed-in
// operator's token and render the returned bytes inline. Access is re-checked
// server-side on the fetch: a tenant only sees plans granted to it by a booking.
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type State = "loading" | "ready" | "anon" | "denied" | "error";

export function PlanViewer({ id }: { id: string }) {
  const [state, setState] = useState<State>("loading");
  const [url, setUrl] = useState<string | null>(null);
  const [name, setName] = useState("EHCP / SEND plan");

  useEffect(() => {
    let objUrl: string | null = null;
    let alive = true;
    (async () => {
      await firebaseAuth.authStateReady();
      const user = firebaseAuth.currentUser;
      if (!user) { if (alive) setState("anon"); return; }
      try {
        const token = await user.getIdToken();
        const res = await fetch(`${BASE}/api/my/files/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) { if (alive) setState("anon"); return; }
        if (res.status === 403 || res.status === 404) { if (alive) setState("denied"); return; }
        if (!res.ok) { if (alive) setState("error"); return; }
        const cd = res.headers.get("content-disposition") || "";
        const m = /filename="?([^"]+)"?/.exec(cd);
        if (m && alive) setName(decodeURIComponent(m[1]));
        objUrl = URL.createObjectURL(await res.blob());
        if (alive) { setUrl(objUrl); setState("ready"); }
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => { alive = false; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [id]);

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#0f1e40" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", color: "#fff", background: "linear-gradient(120deg,#16306e 0%,#274ba3 60%,#3f78d8 100%)" }}>
        <AosMark size={26} />
        <span style={{ fontWeight: 800, fontSize: 16 }}>Activity<span style={{ color: "#EE1F63" }}>OS</span></span>
        <span style={{ marginLeft: 8, fontSize: 13, opacity: 0.9 }}>🧩 {name}</span>
      </div>
      {children}
    </div>
  );

  const Msg = ({ emoji, title, body, action }: { emoji: string; title: string; body: string; action?: React.ReactNode }) => (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 380, textAlign: "center", background: "#fff", borderRadius: 16, padding: "28px 26px" }}>
        <div style={{ fontSize: 34 }}>{emoji}</div>
        <div style={{ fontSize: 18, fontWeight: 800, margin: "8px 0 4px", color: "#171534" }}>{title}</div>
        <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "#4a4763" }}>{body}</p>
        {action}
      </div>
    </div>
  );

  if (state === "ready" && url)
    return (
      <Shell>
        <iframe src={url} title={name} style={{ flex: 1, width: "100%", border: 0, background: "#fff" }} />
      </Shell>
    );
  if (state === "loading")
    return <Shell><Msg emoji="⏳" title="Opening the plan…" body="Fetching it securely — one moment." /></Shell>;
  if (state === "anon")
    return (
      <Shell>
        <Msg emoji="🔒" title="Please sign in" body="This plan is only visible to your team. Sign in and you'll come straight back to it."
          action={<Link href={`/login?next=${encodeURIComponent(`/plan/${id}`)}`} style={{ display: "inline-block", marginTop: 14, background: "#1d3a8f", color: "#fff", padding: "10px 20px", borderRadius: 999, textDecoration: "none", fontWeight: 700, fontSize: 14 }}>Sign in</Link>} />
      </Shell>
    );
  if (state === "denied")
    return <Shell><Msg emoji="🚫" title="Not available" body="This plan isn't shared with your account, or it no longer exists. Only a provider a child has been booked with can view their plan." /></Shell>;
  return <Shell><Msg emoji="⚠️" title="Couldn't open the plan" body="Something went wrong loading the file. Try again, or open it from the booking in ActivityOS." /></Shell>;
}
