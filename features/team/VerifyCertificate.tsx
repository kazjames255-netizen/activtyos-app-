"use client";

// Public certificate verification page (/v/{ref}) — what a "Scan to verify"
// QR on a printed staff certificate points to. No sign-in, no chrome: anyone
// with the ref (an inspector, a parent, the staff member themself) can check
// it. Same shape as the reference/pay public pages: a thin unauthenticated
// fetch against /api/public/*, single fixed light layout regardless of the
// viewer's own theme (they may have no account at all).
import { dateLocale as dl } from "@/lib/i18n/format";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Result {
  found: boolean;
  status?: "valid" | "expired";
  ref?: string;
  name?: string;
  type?: string;
  verifiedOn?: string | null;
  expiry?: string | null;
}

const fmt = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(dl(), { day: "numeric", month: "long", year: "numeric" });
};

// `certRef` (never `ref`) — React 19 treats a prop literally named `ref` as
// the special ref prop, which a Server Component may not pass to a Client
// Component at all ("Refs cannot be used in Server Components...").
export function VerifyCertificate({ certRef }: { certRef: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`${API}/api/public/credentials/${encodeURIComponent(certRef)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((body: Result) => { if (live) setResult(body); })
      .catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, [certRef]);

  const ok = result?.found && result.status === "valid";
  const expired = result?.found && result.status === "expired";

  return (
    <div style={{ minHeight: "100vh", background: "#f4f5f9", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420, borderRadius: 18, background: "#fff", boxShadow: "0 10px 40px rgba(20,20,40,.08)", padding: "32px 28px", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "#8b93ad", marginBottom: 18 }}>Certificate verification</div>

        {!result && !err && <div style={{ color: "#8b93ad", fontSize: 14, padding: "24px 0" }}>Checking…</div>}
        {err && <Status icon="⚠" tone="#b45309" bg="#fff7ed" title="Couldn't check this right now" body="Please try again in a moment." />}

        {result && !result.found && (
          <Status icon="✕" tone="#c0392b" bg="#fdecec" title="Not a verified certificate" body="This reference doesn't match a currently verified certificate. It may be unrecognised, still pending review, or no longer valid." />
        )}

        {ok && (
          <Status icon="✓" tone="#0f7a43" bg="#e2f4ea" title="Verified" body={null}>
            <Details result={result!} />
          </Status>
        )}

        {expired && (
          <Status icon="!" tone="#b45309" bg="#fcefd2" title="Certificate expired" body={null}>
            <Details result={result!} />
          </Status>
        )}

        <div style={{ marginTop: 22, fontSize: 11, color: "#b3b8c9" }}>ActivityOS certificate check{result?.ref ? ` · Ref ${result.ref}` : ""}</div>
      </div>
    </div>
  );
}

function Status({ icon, tone, bg, title, body, children }: { icon: string; tone: string; bg: string; title: string; body: string | null; children?: React.ReactNode }) {
  return (
    <div>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: bg, color: tone, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, margin: "0 auto 14px" }}>{icon}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: "#171534", marginBottom: body || children ? 6 : 0 }}>{title}</div>
      {body && <div style={{ fontSize: 13.5, color: "#5b6478", lineHeight: 1.5 }}>{body}</div>}
      {children}
    </div>
  );
}

function Details({ result }: { result: Result }) {
  const rows: [string, string | null][] = [
    ["Holder", result.name ?? null],
    ["Certificate", result.type ?? null],
    ["On record as of", fmt(result.verifiedOn)],
    ["Expiry", result.expiry ? fmt(result.expiry) : "No expiry on record"],
  ];
  return (
    <div style={{ marginTop: 14, borderTop: "1px solid #eef1f7", paddingTop: 14, display: "grid", gap: 8, textAlign: "start" }}>
      {rows.map(([label, val]) => val && (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
          <span style={{ color: "#8b93ad", fontWeight: 700 }}>{label}</span>
          <span style={{ color: "#171534", fontWeight: 700, textAlign: "end" }}>{val}</span>
        </div>
      ))}
    </div>
  );
}
