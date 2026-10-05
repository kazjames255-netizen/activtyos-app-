import Link from "next/link";

// A public, plain guide to getting paid by parents: what Stripe is, what to have ready, the steps, and the snags
// providers actually hit. Linked from Billing & payouts and the first-run checklist.
export const metadata = { title: "Get paid by parents - Activly guide" };

const STEPS: { title: string; body: string }[] = [
  { title: "Open Billing & payouts", body: "In your portal, open Billing & payouts and choose the Get paid by parents tab." },
  { title: "Press Connect Stripe", body: "Stripe is the company that safely takes card payments and sends the money to your bank. Activly never sees your card or bank details." },
  { title: "Say what kind of business you are", body: "Choose Individual or sole trader if you run this in your own name. Choose Company only if you have a registered limited company, and you will be asked for its company number and directors." },
  { title: "Verify your identity", body: "Enter your name, date of birth and home address exactly as they appear on your ID, and upload a photo of your passport or driving licence. You may be asked for a selfie." },
  { title: "Add the bank account you want to be paid into", body: "A UK bank account in your own name (or your company's name). You need the sort code and account number." },
  { title: "Verify your phone", body: "Stripe texts a code to your mobile. Enter it to confirm the number." },
  { title: "Wait for the green tick", body: "Most accounts are approved within minutes. Stripe can take a day or two if it needs to check a document. Until then you can still take bookings by bank transfer, cash and vouchers." },
];

const SNAGS: [string, string][] = [
  ["It says my identity could not be verified", "Check the name and date of birth match your ID exactly, and that the photo is sharp, uncropped and in good light. Then try again."],
  ["I am not a director of the company", "Do not tick that you are a director. You can be the account representative, but the real directors and owners must be listed. If the company is not yours, ask the director to complete this."],
  ["I do not have a company", "Choose Individual or sole trader. You can open a company later, but that needs its own Stripe account."],
  ["The text message code never arrives", "Check the number includes the country code, wait a minute before asking again, and check your phone can receive texts from abroad."],
  ["Money has not reached my bank", "Payouts follow Stripe's schedule, usually a few working days after the first payment. You can see them in the Stripe dashboard link on the Get paid tab."],
];

export default function GetPaidGuide() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 16px 80px", color: "var(--ink)" }}>
      <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--brand-2, #2f6bd8)" }}>Activly guide</p>
      <h1 style={{ fontSize: 32, lineHeight: 1.15, margin: "4px 0 10px" }}>Get paid by parents</h1>
      <p style={{ fontSize: 16, color: "var(--ink-2)" }}>
        This takes about 10 minutes. Have your <b>photo ID</b>, your <b>home address</b> and your <b>bank details</b> to hand. You can stop and come back at any time, and you do not need
        to finish it before you build your first listing.
      </p>
      <div style={{ margin: "18px 0", padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)", fontSize: 14 }}>
        <b>Two different things:</b> you pay Activly for your plan with a card. Parents pay you for their bookings. They use separate accounts, so you can use a different card for your plan from the bank
        you get paid into.
      </div>

      <h2 style={{ fontSize: 22, margin: "24px 0 10px" }}>The steps</h2>
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {STEPS.map((s, i) => (
          <li key={s.title} style={{ display: "flex", gap: 12, padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)" }}>
            <span style={{ flex: "none", width: 28, height: 28, borderRadius: 14, background: "var(--brand-soft, #e6ecff)", color: "var(--brand-ink, #1d3a8f)", fontWeight: 800, display: "grid", placeItems: "center", fontSize: 13 }}>{i + 1}</span>
            <div><div style={{ fontWeight: 800 }}>{s.title}</div><div style={{ fontSize: 14, color: "var(--ink-2)" }}>{s.body}</div></div>
          </li>
        ))}
      </ol>

      <h2 style={{ fontSize: 22, margin: "28px 0 10px" }}>Bank transfer instead of cards</h2>
      <p style={{ fontSize: 15, color: "var(--ink-2)" }}>
        Parents can also pay by bank transfer, Tax-Free Childcare or childcare vouchers. For those, add your bank details on the same page. They appear on your invoices and on the page parents see
        when they pay. These are separate from Stripe, and card payments always go to the account you give Stripe.
      </p>

      <h2 style={{ fontSize: 22, margin: "28px 0 10px" }}>If something goes wrong</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {SNAGS.map(([q, a]) => (
          <details key={q} style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)", padding: "10px 14px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>{q}</summary>
            <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "8px 0 2px" }}>{a}</p>
          </details>
        ))}
      </div>

      <p style={{ marginTop: 28, fontSize: 14 }}>
        Still stuck? Message us from the Support page in your portal. <Link href="/login" style={{ fontWeight: 700 }}>Sign in</Link>
      </p>
    </main>
  );
}
