import Link from "next/link";
import type { ReactNode } from "react";
import { requestLocale, serverT } from "@/lib/i18n/server";

// A public, plain guide to getting paid by parents: what Stripe is, what to have ready, the steps, and the snags
// providers actually hit. Linked from Billing & payouts and the first-run checklist. Text comes from the p9tx catalogue (gp* keys)
// so it follows the visitor's language.
export async function generateMetadata() {
  return { title: serverT(await requestLocale(), "p9tx.gpMetaTitle") };
}

const bold = (text: string): ReactNode[] => text.split(/(<b>[\s\S]*?<\/b>)/g).map((p, i) => (p.startsWith("<b>") ? <b key={i}>{p.slice(3, -4)}</b> : p));

export default async function GetPaidGuide() {
  const loc = await requestLocale();
  const t = (k: string) => serverT(loc, "p9tx." + k);
  const STEPS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ title: t(`gpS${n}t`), body: t(`gpS${n}b`) }));
  const SNAGS: [string, string][] = [1, 2, 3, 4, 5].map((n) => [t(`gpN${n}q`), t(`gpN${n}a`)]);
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 16px 80px", color: "var(--ink)" }}>
      <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--brand-2, #2f6bd8)" }}>{t("gpKicker")}</p>
      <h1 style={{ fontSize: 32, lineHeight: 1.15, margin: "4px 0 10px" }}>{t("gpTitle")}</h1>
      <p style={{ fontSize: 16, color: "var(--ink-2)" }}>{bold(t("gpIntro"))}</p>
      <div style={{ margin: "18px 0", padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)", fontSize: 14 }}>{bold(t("gpTwo"))}</div>

      <h2 style={{ fontSize: 22, margin: "24px 0 10px" }}>{t("gpStepsH")}</h2>
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {STEPS.map((s, i) => (
          <li key={i} style={{ display: "flex", gap: 12, padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)" }}>
            <span style={{ flex: "none", width: 28, height: 28, borderRadius: 14, background: "var(--brand-soft, #e6ecff)", color: "var(--brand-ink, #1d3a8f)", fontWeight: 800, display: "grid", placeItems: "center", fontSize: 13 }}>{i + 1}</span>
            <div><div style={{ fontWeight: 800 }}>{s.title}</div><div style={{ fontSize: 14, color: "var(--ink-2)" }}>{s.body}</div></div>
          </li>
        ))}
      </ol>

      <h2 style={{ fontSize: 22, margin: "28px 0 10px" }}>{t("gpBankH")}</h2>
      <p style={{ fontSize: 15, color: "var(--ink-2)" }}>{t("gpBankP")}</p>

      <h2 style={{ fontSize: 22, margin: "28px 0 10px" }}>{t("gpWrongH")}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {SNAGS.map(([q, a], i) => (
          <details key={i} style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)", padding: "10px 14px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>{q}</summary>
            <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "8px 0 2px" }}>{a}</p>
          </details>
        ))}
      </div>

      <p style={{ marginTop: 28, fontSize: 14 }}>
        {t("gpStuck")} <Link href="/login" style={{ fontWeight: 700 }}>{t("gpSignIn")}</Link>
      </p>
    </main>
  );
}
