"use client";

import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { post as apiPost } from "@/lib/api";
import { money } from "@/features/bookings/helpers";
import { Button } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// Card payment for one or more bookings (a family's basket pays at once).
// The server creates the PaymentIntent — as a DIRECT CHARGE on the
// provider's connected account — and this modal only renders Stripe's
// Payment Element against its client secret; no amount ever comes from
// the browser. After Stripe confirms, /confirm flips the bookings to Paid.
// ─────────────────────────────────────────────────────────────────────────

const PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

interface CheckoutInfo {
  paymentId: string;
  clientSecret: string;
  stripeAccount: string | null;
  amount: number;
}

function PayForm({ info, onPaid, onError }: { info: CheckoutInfo; onPaid: () => void; onError: (m: string) => void }) {
  const stripeJs = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (!stripeJs || !elements) return;
    setBusy(true);
    const { error } = await stripeJs.confirmPayment({ elements, redirect: "if_required" });
    if (error) {
      onError(error.message ?? "Payment failed");
      setBusy(false);
      return;
    }
    try {
      const res = await apiPost<{ paid: boolean; status: string }>(
        `/api/payments/checkout/${info.paymentId}/confirm`,
        {},
      );
      if (res.paid) onPaid();
      else onError(`Payment is ${res.status} — it hasn't completed yet.`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't verify the payment");
    }
    setBusy(false);
  }

  return (
    <>
      <PaymentElement />
      <Button variant="primary" disabled={busy || !stripeJs} onClick={pay} className="mt-3 w-full">
        {busy ? "Paying…" : `Pay ${money(info.amount)}`}
      </Button>
    </>
  );
}

export function PayModal({ refs = [], mealOrderIds, onClose, onPaid }: { refs?: string[]; mealOrderIds?: string[]; onClose: () => void; onPaid: () => void }) {
  const [info, setInfo] = useState<CheckoutInfo | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const meals = !!mealOrderIds?.length;
  const noun = meals ? "meal" : "booking";

  useEffect(() => {
    let alive = true;
    apiPost<CheckoutInfo>("/api/payments/checkout", meals ? { mealOrderIds } : { refs })
      .then((i) => {
        if (!alive) return;
        setInfo(i);
        // Direct charges: Stripe.js must be initialised ON the provider's
        // connected account or the client secret won't match.
        setStripePromise(loadStripe(PK, i.stripeAccount ? { stripeAccount: i.stripeAccount } : undefined));
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Couldn't start the payment"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refs.join(","), (mealOrderIds ?? []).join(",")]);

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[10001] flex items-start justify-center overflow-auto bg-black/60 px-3.5 py-10"
    >
      <div className="w-full max-w-[440px] rounded-2xl bg-white p-5 text-[#171534] shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[16px] font-extrabold">
            {paid ? "Payment complete" : meals ? `Pay for your meal${(mealOrderIds?.length ?? 0) > 1 ? "s" : ""}` : `Pay for booking${refs.length > 1 ? "s" : ""} ${refs.join(", ")}`}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[20px] leading-none text-[#8a86a3]">
            ×
          </button>
        </div>
        {paid ? (
          <div className="py-4 text-center">
            <div className="text-[22px]">✅</div>
            <p className="mt-1 text-[13.5px]">Thanks — your {noun}{meals ? ((mealOrderIds?.length ?? 0) > 1 ? "s are" : " is") : (refs.length > 1 ? "s are" : " is")} paid.</p>
            <Button variant="primary" onClick={onClose} className="mt-3">
              Done
            </Button>
          </div>
        ) : !PK ? (
          <div className="text-[13px] text-[#e21d27]">Payments aren’t configured (no publishable key).</div>
        ) : error ? (
          <div className="text-[13px] font-bold text-[#e21d27]">{error}</div>
        ) : !info || !stripePromise ? (
          <div className="py-6 text-center text-[13px] text-[#8a86a3]">Preparing secure payment…</div>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret: info.clientSecret }}>
            <PayForm
              info={info}
              onError={setError}
              onPaid={() => {
                setPaid(true);
                onPaid();
              }}
            />
          </Elements>
        )}
      </div>
    </div>
  );
}
