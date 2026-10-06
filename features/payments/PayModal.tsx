"use client";

import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { post as apiPost } from "@/lib/api";
import { money } from "@/features/bookings/helpers";
import { Button } from "@/components/ui";
import { useT, useWord, tNow, useI18n } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";

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
  const t = useT();
  const w = useWord();
  const stripeJs = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (!stripeJs || !elements) return;
    setBusy(true);
    const { error } = await stripeJs.confirmPayment({ elements, redirect: "if_required" });
    if (error) {
      onError(`${error.message ?? t("p8lst.pmPayFailed")}${error.type === "card_error" ? ` ${t("p7ck.declineRetry")}` : ""}`);
      setBusy(false);
      return;
    }
    try {
      const res = await apiPost<{ paid: boolean; status: string }>(
        `/api/payments/checkout/${info.paymentId}/confirm`,
        {},
      );
      if (res.paid) onPaid();
      else onError(t("p8lst.pmNotCompleted", { status: res.status === "succeeded" ? t("p8lst.pmSucceeded") : res.status === "failed" ? t("p8lst.pmFailed") : w(res.status) }));
    } catch (e) {
      onError(e instanceof Error ? e.message : t("p8lst.pmVerifyFail"));
    }
    setBusy(false);
  }

  return (
    <>
      <PaymentElement />
      <Button variant="primary" disabled={busy || !stripeJs} onClick={pay} className="mt-3 w-full">
        {busy ? t("p8lst.pmPaying") : t("p8lst.pmPay", { amount: money(info.amount) })}
      </Button>
    </>
  );
}

export function PayModal({ refs = [], tenantId, mealOrderIds, onClose, onPaid }: { refs?: string[]; tenantId?: string; mealOrderIds?: string[]; onClose: () => void; onPaid: () => void }) {
  const t = useT();
  const { locale } = useI18n();
  const [info, setInfo] = useState<CheckoutInfo | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const meals = !!mealOrderIds?.length;
  // A parent who has just paid goes back to their home page (after a moment to read "payment complete").
  const toHome = typeof window !== "undefined" && window.location.pathname.startsWith("/custdash");
  useEffect(() => {
    if (!paid || !toHome) return;
    const id = setTimeout(() => window.location.assign("/custdash/home"), 3500);
    return () => clearTimeout(id);
  }, [paid, toHome]);
  const nCount = meals ? (mealOrderIds?.length ?? 0) : refs.length;

  useEffect(() => {
    let alive = true;
    apiPost<CheckoutInfo>("/api/payments/checkout", meals ? { mealOrderIds } : { refs, ...(tenantId ? { tenantId } : {}) })
      .then((i) => {
        if (!alive) return;
        setInfo(i);
        // Direct charges: Stripe.js must be initialised ON the provider's
        // connected account or the client secret won't match.
        setStripePromise(loadStripe(PK, i.stripeAccount ? { stripeAccount: i.stripeAccount } : undefined));
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : tNow("p8lst.pmStartFail")));
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
            {paid ? t("p8lst.pmCompleteTitle") : meals ? pickPlural(t, locale, "p8lst.pmPayMeal", nCount) : pickPlural(t, locale, "p8lst.pmPayBooking", nCount, { refs: refs.join(", ") })}
          </div>
          <button type="button" onClick={onClose} aria-label={t("p8lst.pmClose")} className="text-[20px] leading-none text-[#8a86a3]">
            ×
          </button>
        </div>
        {paid ? (
          <div className="py-4 text-center">
            <div className="text-[22px]">✅</div>
            <p className="mt-1 text-[13.5px]">{pickPlural(t, locale, meals ? "p8lst.pmThanksMeal" : "p8lst.pmThanksBooking", nCount)}</p>
            {toHome && <p className="mt-2 text-[12.5px] text-[#8a86a3]">{t("p8lst.pmGoingHome")}</p>}
            <Button variant="primary" onClick={() => { if (toHome) window.location.assign("/custdash/home"); else onClose(); }} className="mt-3">
              {toHome ? t("p8lst.pmBackHome") : t("p8lst.pmDone")}
            </Button>
          </div>
        ) : !PK ? (
          <div className="text-[13px] text-[#e21d27]">{t("p8lst.pmNoKey")}</div>
        ) : error ? (
          <div className="text-[13px] font-bold text-[#e21d27]">{error}</div>
        ) : !info || !stripePromise ? (
          <div className="py-6 text-center text-[13px] text-[#8a86a3]">{t("p8lst.pmPreparing")}</div>
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
