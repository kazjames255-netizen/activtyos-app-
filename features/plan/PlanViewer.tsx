"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { firebaseAuth } from "@/lib/firebase/client";
import { BrandLogo } from "@/components/ui/Logo";
import { useT } from "@/lib/i18n/provider";

// Secure viewer for a child's EHCP / SEND plan, opened straight from the link
// in a new-booking email. The file lives behind an authenticated API route (no
// public URL — special-category data), so we fetch it here with the signed-in
// operator's token and render the returned bytes inline. Access is re-checked
// server-side on the fetch: a tenant only sees plans granted to it by a booking.
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type State = "loading" | "ready" | "anon" | "denied" | "error";

export function PlanViewer({ id }: { id: string }) {
  const t = useT();
  const [state, setState] = useState<State>("loading");
  const [url, setUrl] = useState<string | null>(null);
  const [name, setName] = useState(() => t("p8lst.pvDefaultName"));
  const [kind, setKind] = useState<"pdf" | "image" | "other">("pdf");

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
        const blob = await res.blob();
        // Only a PDF or a photo is rendered. A blob URL runs with THIS app's
        // origin, so anything else in an iframe could script the page.
        const kind = blob.type === "application/pdf" ? "pdf" : blob.type.startsWith("image/") && blob.type !== "image/svg+xml" ? "image" : "other";
        objUrl = URL.createObjectURL(blob);
        if (alive) { setKind(kind); setUrl(objUrl); setState("ready"); }
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => { alive = false; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [id]);

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#0f1e40" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", color: "#fff", background: "linear-gradient(120deg,#16306e 0%,#274ba3 60%,#3f78d8 100%)" }}>
        <BrandLogo size={30} variant="onDark" />
        <span style={{ marginInlineStart: 8, fontSize: 13, opacity: 0.9 }}>🧩 {name}</span>
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
        {kind === "pdf" ? (
          <iframe src={url} title={name} style={{ flex: 1, width: "100%", border: 0, background: "#fff" }} />
        ) : kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", padding: 16 }}><img src={url} alt={name} style={{ maxWidth: "100%", height: "auto", background: "#fff" }} /></div>
        ) : (
          <Msg emoji="📄" title={t("p8lst.pvNoShowTitle")} body={t("p8lst.pvNoShowBody")} />
        )}
      </Shell>
    );
  if (state === "loading")
    return <Shell><Msg emoji="⏳" title={t("p8lst.pvOpeningTitle")} body={t("p8lst.pvOpeningBody")} /></Shell>;
  if (state === "anon")
    return (
      <Shell>
        <Msg emoji="🔒" title={t("p8lst.pvSignInTitle")} body={t("p8lst.pvSignInBody")}
          action={<Link href={`/login?next=${encodeURIComponent(`/plan/${id}`)}`} style={{ display: "inline-block", marginTop: 14, background: "#1d3a8f", color: "#fff", padding: "10px 20px", borderRadius: 999, textDecoration: "none", fontWeight: 700, fontSize: 14 }}>{t("p8lst.pvSignInBtn")}</Link>} />
      </Shell>
    );
  if (state === "denied")
    return <Shell><Msg emoji="🚫" title={t("p8lst.pvDeniedTitle")} body={t("p8lst.pvDeniedBody")} /></Shell>;
  return <Shell><Msg emoji="⚠️" title={t("p8lst.pvErrorTitle")} body={t("p8lst.pvErrorBody")} /></Shell>;
}
