"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { linkAccount, HMRC_CONNECTED, TFC_FAILURE_COPY, type TfcFailure } from "./tfc";

// ─────────────────────────────────────────────────────────────────────────
// The GOV.UK hand-off, as designed: our "connect" screen → HMRC's consent
// screen ("Allow your software to connect with HMRC") → sign in at GOV.UK →
// back here, linked.
//
// ONE DELIBERATE DIFFERENCE FROM THE DESIGN. The video walks through HMRC's
// own Government Gateway sign-in (user ID, password, National Insurance
// number). Those are HMRC's pages and they must stay HMRC's: a form inside our
// app asking for Government Gateway credentials is phishing-shaped, and it
// teaches families that typing their government login into a non-GOV.UK screen
// is normal. So this shows the consent step in full and then hands off — real
// OAuth redirects to GOV.UK, and the family signs in there.
//
// Amir: replace `linkAccount()` in ./tfc with the redirect + callback and this
// screen becomes the real thing with no change here.
// ─────────────────────────────────────────────────────────────────────────

type Stage = "consent" | "handoff" | "done" | "failed";

// GOV.UK's own palette, hardcoded on purpose. This dialog stands in for HMRC's
// screen, so it must look the same wherever it opens — and taking text colours
// from the host checkout theme (which is light in the parent portal, dark on
// the public booking page) made it dark-on-dark and unreadable.
const GOV = {
  bg: "#ffffff",
  ink: "#0b0c0c",
  muted: "#505a5f",
  line: "#b1b4b6",
  green: "#00703c",
  black: "#0b0c0c",
};

export function TfcConnect({ childName, providerName, reference, onLinked, onClose }: {
  childName: string;
  providerName: string;
  /** The reference this parent has typed in the row, if any. HMRC needs it
   *  (with the child's date of birth) to link — the row is the only place it
   *  exists before the child record is saved. Ignored by the simulated link. */
  reference?: string;
  onLinked: (reference: string) => void;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>("consent");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<TfcFailure>("connection-failed");
  // Rendered into <body>, not where it sits in the tree. The checkout panel is
  // nested inside the booking flow, and any ancestor with overflow, a transform
  // or its own stacking context traps a position:fixed child — the dialog then
  // opens somewhere you can't see it, which reads as the button doing nothing.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  async function handOff() {
    setStage("handoff");
    setBusy(true);
    // Real flow: linkAccount opens GOV.UK in its own window and waits for the
    // callback. Simulated (no HMRC credentials): it comes straight back linked.
    const r = await linkAccount(childName, reference);
    setBusy(false);
    if (r.linked && r.reference) { setStage("done"); onLinked(r.reference); return; }
    // A link that didn't complete has its own designed screen, and every one
    // of them ends at the same place: pay inside HMRC and give us the
    // reference. Without this the dialog sat on "Signing you in…" forever.
    setFailure(r.failure ?? "connection-failed");
    setStage("failed");
  }

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-auto bg-black/55 px-3.5 py-8" onClick={onClose}>
      <div className="w-full max-w-[520px] rounded-lg p-4" onClick={(e) => e.stopPropagation()}
        style={{ background: GOV.bg, border: `1px solid ${GOV.line}`, color: GOV.ink }}>

        {/* GOV.UK's own chrome, so it's obvious whose screen this is */}
        <div className="flex items-center justify-between gap-2 border-b pb-2.5" style={{ borderColor: GOV.line }}>
          <span className="text-[13px] font-extrabold tracking-tight" style={{ color: GOV.black }}>GOV.UK — HMRC</span>
          <button type="button" onClick={onClose} className="text-[18px] leading-none" style={{ color: GOV.muted }}>×</button>
        </div>

        {stage === "consent" && (
          <>
            <div className="mt-3 text-[16px] font-extrabold leading-tight" style={{ color: GOV.ink }}>
              Allow your software to connect with HMRC
            </div>
            <div className="mt-2 text-[12.5px] leading-[1.55]" style={{ color: GOV.muted }}>
              Use this service to give <b style={{ color: GOV.ink }}>{providerName}</b> permission to:
            </div>
            <ul className="mt-2 flex flex-col gap-1.5">
              {[
                "Access your Tax-Free Childcare account details",
                "Process requests for payments to childcare providers",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2 text-[12.5px]" style={{ color: GOV.ink }}>
                  <span style={{ color: GOV.green }}>✓</span><span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2.5 text-[11.5px] leading-[1.5]" style={{ color: GOV.muted }}>
              You&rsquo;ll sign in with your Government Gateway details on GOV.UK. This is for <b style={{ color: GOV.ink }}>{childName}</b>&rsquo;s
              Tax-Free Childcare account. You can remove this permission from your HMRC account at any time.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={handOff}
                className="rounded px-4 py-2 text-[13px] font-extrabold"
                style={{ background: GOV.green, color: "#fff" }}>
                Continue to sign in
              </button>
              <button type="button" onClick={onClose}
                className="rounded border px-3 py-2 text-[12.5px] font-bold"
                style={{ borderColor: GOV.line, color: GOV.ink }}>
                Cancel
              </button>
            </div>
          </>
        )}

        {stage === "handoff" && (
          <div className="py-6 text-center">
            <div className="text-[13.5px] font-extrabold" style={{ color: GOV.ink }}>
              {busy ? "Taking you to GOV.UK to sign in…" : "Signing you in…"}
            </div>
            <div className="mx-auto mt-2 max-w-[380px] text-[11.5px] leading-[1.5]" style={{ color: GOV.muted }}>
              You&rsquo;ll enter your Government Gateway user ID and password on GOV.UK — never here.
              {!HMRC_CONNECTED && " (The live connection to HMRC isn’t switched on yet, so we’re completing this step for you.)"}
            </div>
          </div>
        )}

        {stage === "failed" && (
          <div className="py-5 text-center">
            <div className="text-[15px] font-extrabold" style={{ color: "#d4351c" }}>
              {TFC_FAILURE_COPY[failure].title}
            </div>
            <div className="mx-auto mt-1.5 max-w-[380px] text-[12px] leading-[1.5]" style={{ color: GOV.muted }}>
              {TFC_FAILURE_COPY[failure].detail}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => setStage("consent")}
                className="rounded px-4 py-2 text-[13px] font-extrabold"
                style={{ background: GOV.green, color: "#fff" }}>
                Try again
              </button>
              <button type="button" onClick={onClose}
                className="rounded border px-3 py-2 text-[12.5px] font-bold"
                style={{ borderColor: GOV.line, color: GOV.ink }}>
                Pay from HMRC instead
              </button>
            </div>
          </div>
        )}

        {stage === "done" && (
          <div className="py-6 text-center">
            <div className="text-[15px] font-extrabold" style={{ color: GOV.green }}>✓ Account linked</div>
            <div className="mx-auto mt-1.5 max-w-[380px] text-[12px]" style={{ color: GOV.muted }}>
              {childName}&rsquo;s Tax-Free Childcare account is connected. You can close this and choose how much to pay from it.
            </div>
            <button type="button" onClick={onClose}
              className="mt-3 rounded px-4 py-2 text-[13px] font-extrabold"
              style={{ background: GOV.green, color: "#fff" }}>
              Back to your booking
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
