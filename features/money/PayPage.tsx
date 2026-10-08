"use client";

import { dateLocale as dl } from "@/lib/i18n/format";
import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { money } from "@/features/bookings/helpers";
import { tNow, useT } from "@/lib/i18n/provider";

interface PayOptions { methods: string[]; bank: { reference: string } | null; cash: boolean; vouchers: boolean; contact: { email?: string; phone?: string } | null }
interface PublicInvoice { provider: string; amount: number; description: string | null; reference: string | null; status: string; dueDate: string | null; customerName: string | null; payMethods: string[]; payOptions?: PayOptions; cardEnabled: boolean; closed?: boolean; paidAt?: string | null }
interface CheckoutInfo { paymentId: string; clientSecret: string; stripeAccount: string | null; amount: number }

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const fmtDay = (iso?: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(dl(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

// The page is public — no signed-in account — so it talks to the API with
// plain fetch; the unguessable link token is the authorisation throughout.
async function publicPost<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { method: "POST", headers: { "content-type": "application/json" } });
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error((body as { error?: string })?.error ?? tNow("p8fin.payReqFailed"));
  return body as T;
}

/** Stripe's Payment Element + the confirm round-trip, inside <Elements>. */
function CardForm({ token, base, info, onPaid, onError }: { token: string; base: string; info: CheckoutInfo; onPaid: () => void; onError: (m: string) => void }) {
  const t = useT();
  const stripeJs = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (!stripeJs || !elements) return;
    setBusy(true);
    const { error } = await stripeJs.confirmPayment({ elements, redirect: "if_required" });
    if (error) {
      onError(`${error.message ?? t("p7pub.payFailed")}${error.type === "card_error" ? ` ${t("p7ck.declineRetry")}` : ""}`);
      setBusy(false);
      return;
    }
    try {
      const res = await publicPost<{ paid: boolean; refunded?: boolean; refunding?: boolean; status: string }>(
        `/api/public/${base}/${encodeURIComponent(token)}/confirm/${encodeURIComponent(info.paymentId)}`,
      );
      if (res.paid) onPaid();
      else if (res.refunded) onError(t("p8lst.pmRefunded"));
      else if (res.refunding) onError(t("p8lst.pmRefunding"));
      else onError(t("p7pub.payStatus", { status: res.status }));
    } catch (e) {
      onError(e instanceof Error ? e.message : t("p7pub.errVerify"));
    }
    setBusy(false);
  }

  return (
    <>
      <PaymentElement />
      <button type="button" disabled={busy || !stripeJs} onClick={pay} className="mt-3 w-full rounded-full bg-[#1d3a8f] px-4 py-3 text-[14px] font-extrabold text-white disabled:opacity-60">
        {busy ? t("p7pub.paying") : t("p7pub.payAmt", { amt: money(info.amount) })}
      </button>
    </>
  );
}


/** Every non-card way to pay, with the details the payer needs (bank account + reference, cash, vouchers), or how to reach the provider. */
function OtherWays({ o, provider }: { o: PayOptions; provider: string }) {
  const t = useT();
  const none = !o.bank && !o.cash && !o.vouchers;
  return (
    <div className="mt-4 space-y-2.5">
      {o.bank && (
        <div className="rounded-xl border-2 border-[#1d3a8f] bg-[#eef3ff] p-3 text-[12.5px]">
          <div className="font-extrabold uppercase tracking-wide text-[#1d3a8f]">{t("p7pub.bankTitle")}</div>
          <div className="mt-1.5 text-[#171534]">{t("p7pub.bankInEmail")}</div>
          {o.bank.reference && <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 text-[#171534]"><span className="text-[#6a6785]">{t("p7pub.quoteRef")}</span><b>{o.bank.reference}</b></div>}
        </div>
      )}
      {o.cash && <div className="rounded-xl border border-[#ece6f1] bg-[#fbf8fc] p-3 text-[12.5px] text-[#4a4763]"><b>{t("p7pub.cashTitle")}</b> {t("p7pub.cashBody")}</div>}
      {o.vouchers && <div className="rounded-xl border border-[#ece6f1] bg-[#fbf8fc] p-3 text-[12.5px] text-[#4a4763]"><b>{t("p7pub.voucherTitle")}</b> {t("p7pub.voucherBody", { provider })}</div>}
      {none && (
        <div className="rounded-xl border border-[#ece6f1] bg-[#fbf8fc] p-3 text-[12.5px] text-[#4a4763]">
          {t("p7pub.contactToPay", { provider })}
          {o.contact?.email && <div className="mt-1 font-bold">{o.contact.email}</div>}
          {o.contact?.phone && <div className="font-bold">{o.contact.phone}</div>}
        </div>
      )}
      {!none && <div className="text-[11px] text-[#8a86a3]">{t("p7pub.providerConfirms")}</div>}
    </div>
  );
}

/** `base` picks which public API serves the link: an invoice (/pay/{token}) or a single booking (/pay/b/{token}). */
export function PayPage({ token, base = "invoice" }: { token: string; base?: "invoice" | "booking-pay" }) {
  const t = useT();
  const [inv, setInv] = useState<PublicInvoice | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "notfound" | "expired">("loading");
  // An expired link still says whose it was (and whether it had been paid).
  const [expired, setExpired] = useState<{ provider?: string; status?: string } | null>(null);
  const [info, setInfo] = useState<CheckoutInfo | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [starting, setStarting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/public/${base}/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (r.status === 410) { setExpired(await r.json().catch(() => ({}))); setState("expired"); return; }
        if (!r.ok) throw new Error("not found");
        setInv(await r.json() as PublicInvoice);
        setState("ok");
      })
      .catch(() => setState("notfound"));
  }, [token]);

  async function startCard() {
    setStarting(true);
    setPayError(null);
    try {
      const i = await publicPost<CheckoutInfo>(`/api/public/${base}/${encodeURIComponent(token)}/checkout`);
      setInfo(i);
      // Direct charges: Stripe.js must be initialised ON the provider's
      // connected account or the client secret won't match.
      setStripePromise(loadStripe(PK, i.stripeAccount ? { stripeAccount: i.stripeAccount } : undefined));
    } catch (e) {
      setPayError(e instanceof Error ? e.message : t("p7pub.errStartPay"));
    }
    setStarting(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f8fd] p-4 text-[#171534]">
      <div className="w-full max-w-[440px]">
        {state === "loading" && <div className="py-20 text-center text-[13px] text-[#8a86a3]">{t("p7pub.loadingWord")}</div>}
        {state === "notfound" && (
          <div className="rounded-2xl border border-[#ece6f1] bg-white p-8 text-center shadow-[0_10px_30px_-12px_rgba(29,58,143,.35)]">
            <div className="text-[28px]">🔗</div>
            <div className="mt-1 text-[16px] font-extrabold">{t("p7pub.linkInvalid")}</div>
            <p className="mt-1 text-[13px] leading-[1.6] text-[#8a86a3]">{t("p7pub.linkInvalidBody")}</p>
          </div>
        )}
        {state === "expired" && (
          <div className="rounded-2xl border border-[#ece6f1] bg-white p-8 text-center shadow-[0_10px_30px_-12px_rgba(29,58,143,.35)]">
            <div className="text-[28px]">{expired?.status === "paid" ? "✓" : "⌛"}</div>
            <div className="mt-1 text-[16px] font-extrabold">{expired?.status === "paid" ? t("p7pub.invPaid") : t("p7pub.linkExpired")}</div>
            <p className="mt-1 text-[13px] leading-[1.6] text-[#8a86a3]">
              {expired?.status === "paid" ? t("p7pub.linkClosed") + " " : expired?.status === "cancelled" ? t("p7pub.invCancelledClosed") + " " : ""}
              {expired?.status === "paid" || expired?.status === "cancelled"
                ? t("p7pub.askCopy", { provider: expired?.provider || t("p7pub.yourProvider") })
                : t("p7pub.askNewLink", { provider: expired?.provider || t("p7pub.yourProvider") })}
            </p>
          </div>
        )}
        {state === "ok" && inv && (
          <div className="overflow-hidden rounded-2xl border border-[#ece6f1] bg-white shadow-[0_16px_40px_-16px_rgba(29,58,143,.45)]">
            <div className="p-5 text-white" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)" }}>
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/75">{t("p7pub.payRequestFrom")}</div>
              <div className="text-[19px] font-extrabold">{inv.provider}</div>
            </div>
            <div className="p-5">
              {inv.status === "paid" || justPaid ? (
                <div className="rounded-xl bg-[#eaf0fc] p-4 text-center">
                  <div className="text-[22px]">✓</div>
                  <div className="text-[15px] font-extrabold text-[#1d3a8f]">{justPaid ? t("p7pub.paidThanks") : t("p7pub.invPaid")}</div>
                  <div className="mt-1 text-[12.5px] text-[#4a4763]">{money(inv.amount)}{inv.description ? ` · ${inv.description}` : ""}{inv.paidAt ? ` · ${t("p7pub.paidOn", { date: fmtDay(inv.paidAt.slice(0, 10)) })}` : ""}</div>
                  <div className="mt-1 text-[11.5px] text-[#8a86a3]">{t("p7pub.nothingMore")}</div>
                </div>
              ) : inv.status === "cancelled" ? (
                <div className="rounded-xl bg-[#fbf8fc] p-4 text-center">
                  <div className="text-[15px] font-extrabold">{t("p7pub.invClosed")}</div>
                  <div className="mt-1 text-[12.5px] text-[#8a86a3]">{t("p7pub.invCancelledBody", { provider: inv.provider })}</div>
                </div>
              ) : (
                <>
                  <div className="text-[12px] text-[#8a86a3]">{t("p7pub.amountDue")}</div>
                  <div className="text-[34px] font-extrabold leading-none" style={{ fontFamily: "var(--ff-display)" }}>{money(inv.amount)}</div>
                  {inv.description && <div className="mt-2 text-[13px] text-[#4a4763]">{inv.description}</div>}
                  <div className="mt-1 text-[12px] text-[#8a86a3]">{inv.reference ? t("p7pub.bookingRefLine", { ref: inv.reference }) : ""}{inv.dueDate ? `${inv.reference ? " · " : ""}${t("p7pub.dueLine", { date: fmtDay(inv.dueDate) })}` : ""}</div>

                  {inv.cardEnabled && PK ? (
                    info && stripePromise ? (
                      <div className="mt-4">
                        <Elements stripe={stripePromise} options={{ clientSecret: info.clientSecret }}>
                          <CardForm token={token} base={base} info={info} onPaid={() => setJustPaid(true)} onError={setPayError} />
                        </Elements>
                      </div>
                    ) : (
                      <button type="button" disabled={starting} onClick={() => void startCard()} className="mt-4 w-full rounded-full bg-[#1d3a8f] px-4 py-3 text-[14px] font-extrabold text-white disabled:opacity-60">
                        {starting ? t("p7pub.preparing") : t("p7pub.payByCard")}
                      </button>
                    )
                  ) : (
                    <div className="mt-4 rounded-xl border border-[#ece6f1] bg-[#fbf8fc] p-3 text-center text-[12px] text-[#8a86a3]">
                      {t("p7pub.noCardOnline", { provider: inv.provider })}
                    </div>
                  )}
                  {payError && <div className="mt-2 text-center text-[12px] font-bold text-[#e21d27]">{payError}</div>}

                  {inv.payOptions && <OtherWays o={inv.payOptions} provider={inv.provider} />}
                  {!inv.payOptions && inv.payMethods.length > 0 && (
                    <div className="mt-4 rounded-xl border border-[#ece6f1] bg-[#fbf8fc] p-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#8a86a3]">{t("p7pub.orPayBy", { provider: inv.provider })}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {inv.payMethods.filter((m) => m !== "Card").map((m) => <span key={m} className="rounded-full border border-[#ece6f1] bg-white px-2.5 py-1 text-[11.5px] font-bold text-[#4a4763]">{m}</span>)}
                      </div>
                      <div className="mt-2 text-[11px] text-[#8a86a3]">{t("p7pub.providerConfirms")}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        <div className="mt-3 text-center text-[10.5px] text-[#b7b3c9]">{t("p7pub.securedBy")}</div>
      </div>
    </div>
  );
}
