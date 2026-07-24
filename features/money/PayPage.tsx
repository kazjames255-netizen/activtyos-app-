"use client";

import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { money } from "@/features/bookings/helpers";

interface PublicInvoice { provider: string; amount: number; description: string | null; reference: string | null; status: string; dueDate: string | null; customerName: string | null; payMethods: string[]; cardEnabled: boolean }
interface CheckoutInfo { paymentId: string; clientSecret: string; stripeAccount: string | null; amount: number }

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const fmtDay = (iso?: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

// The page is public — no signed-in account — so it talks to the API with
// plain fetch; the unguessable link token is the authorisation throughout.
async function publicPost<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { method: "POST", headers: { "content-type": "application/json" } });
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error((body as { error?: string })?.error ?? "Request failed");
  return body as T;
}

/** Stripe's Payment Element + the confirm round-trip, inside <Elements>. */
function CardForm({ token, info, onPaid, onError }: { token: string; info: CheckoutInfo; onPaid: () => void; onError: (m: string) => void }) {
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
      const res = await publicPost<{ paid: boolean; status: string }>(
        `/api/public/invoice/${encodeURIComponent(token)}/confirm/${encodeURIComponent(info.paymentId)}`,
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
      <button type="button" disabled={busy || !stripeJs} onClick={pay} className="mt-3 w-full rounded-full bg-[#1d3a8f] px-4 py-3 text-[14px] font-extrabold text-white disabled:opacity-60">
        {busy ? "Paying…" : `Pay ${money(info.amount)}`}
      </button>
    </>
  );
}

export function PayPage({ token }: { token: string }) {
  const [inv, setInv] = useState<PublicInvoice | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "notfound">("loading");
  const [info, setInfo] = useState<CheckoutInfo | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [starting, setStarting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/public/invoice/${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not found"))))
      .then((d: PublicInvoice) => { setInv(d); setState("ok"); })
      .catch(() => setState("notfound"));
  }, [token]);

  async function startCard() {
    setStarting(true);
    setPayError(null);
    try {
      const i = await publicPost<CheckoutInfo>(`/api/public/invoice/${encodeURIComponent(token)}/checkout`);
      setInfo(i);
      // Direct charges: Stripe.js must be initialised ON the provider's
      // connected account or the client secret won't match.
      setStripePromise(loadStripe(PK, i.stripeAccount ? { stripeAccount: i.stripeAccount } : undefined));
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Couldn't start the payment");
    }
    setStarting(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f8fd] p-4 text-[#171534]">
      <div className="w-full max-w-[440px]">
        {state === "loading" && <div className="py-20 text-center text-[13px] text-[#8a86a3]">Loading…</div>}
        {state === "notfound" && (
          <div className="rounded-2xl border border-[#ece6f1] bg-white p-8 text-center shadow-[0_10px_30px_-12px_rgba(29,58,143,.35)]">
            <div className="text-[28px]">🔗</div>
            <div className="mt-1 text-[16px] font-extrabold">This payment link isn’t valid</div>
            <p className="mt-1 text-[13px] leading-[1.6] text-[#8a86a3]">It may have expired or been mistyped. Ask your provider to resend it.</p>
          </div>
        )}
        {state === "ok" && inv && (
          <div className="overflow-hidden rounded-2xl border border-[#ece6f1] bg-white shadow-[0_16px_40px_-16px_rgba(29,58,143,.45)]">
            <div className="p-5 text-white" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)" }}>
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/75">Payment request from</div>
              <div className="text-[19px] font-extrabold">{inv.provider}</div>
            </div>
            <div className="p-5">
              {inv.status === "paid" || justPaid ? (
                <div className="rounded-xl bg-[#eaf0fc] p-4 text-center"><div className="text-[22px]">✓</div><div className="text-[15px] font-extrabold text-[#1d3a8f]">Paid — thank you!</div></div>
              ) : (
                <>
                  <div className="text-[12px] text-[#8a86a3]">Amount due</div>
                  <div className="text-[34px] font-extrabold leading-none" style={{ fontFamily: "var(--ff-display)" }}>{money(inv.amount)}</div>
                  {inv.description && <div className="mt-2 text-[13px] text-[#4a4763]">{inv.description}</div>}
                  <div className="mt-1 text-[12px] text-[#8a86a3]">{inv.reference ? `Booking ${inv.reference}` : ""}{inv.dueDate ? `${inv.reference ? " · " : ""}Due ${fmtDay(inv.dueDate)}` : ""}</div>

                  {inv.cardEnabled && PK ? (
                    info && stripePromise ? (
                      <div className="mt-4">
                        <Elements stripe={stripePromise} options={{ clientSecret: info.clientSecret }}>
                          <CardForm token={token} info={info} onPaid={() => setJustPaid(true)} onError={setPayError} />
                        </Elements>
                      </div>
                    ) : (
                      <button type="button" disabled={starting} onClick={() => void startCard()} className="mt-4 w-full rounded-full bg-[#1d3a8f] px-4 py-3 text-[14px] font-extrabold text-white disabled:opacity-60">
                        {starting ? "Preparing secure payment…" : "Pay by card"}
                      </button>
                    )
                  ) : (
                    <div className="mt-4 rounded-xl border border-[#ece6f1] bg-[#fbf8fc] p-3 text-center text-[12px] text-[#8a86a3]">
                      {inv.provider} doesn&rsquo;t take card payments online yet — use one of the methods below.
                    </div>
                  )}
                  {payError && <div className="mt-2 text-center text-[12px] font-bold text-[#e21d27]">{payError}</div>}

                  {inv.payMethods.length > 0 && (
                    <div className="mt-4 rounded-xl border border-[#ece6f1] bg-[#fbf8fc] p-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#8a86a3]">Or pay {inv.provider} by</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {inv.payMethods.filter((m) => m !== "Card").map((m) => <span key={m} className="rounded-full border border-[#ece6f1] bg-white px-2.5 py-1 text-[11.5px] font-bold text-[#4a4763]">{m}</span>)}
                      </div>
                      <div className="mt-2 text-[11px] text-[#8a86a3]">Your provider will confirm once your payment lands.</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        <div className="mt-3 text-center text-[10.5px] text-[#b7b3c9]">Secured by ActivityOS</div>
      </div>
    </div>
  );
}
