"use client";

import { useEffect, useState } from "react";
import { money } from "@/features/bookings/helpers";

interface PublicInvoice { provider: string; amount: number; description: string | null; reference: string | null; status: string; dueDate: string | null; customerName: string | null; payMethods: string[]; cardEnabled: boolean }

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const fmtDay = (iso?: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

export function PayPage({ token }: { token: string }) {
  const [inv, setInv] = useState<PublicInvoice | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "notfound">("loading");

  useEffect(() => {
    fetch(`${API}/api/public/invoice/${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not found"))))
      .then((d: PublicInvoice) => { setInv(d); setState("ok"); })
      .catch(() => setState("notfound"));
  }, [token]);

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
              {inv.status === "paid" ? (
                <div className="rounded-xl bg-[#e7f8ee] p-4 text-center"><div className="text-[22px]">✓</div><div className="text-[15px] font-extrabold text-[#0f7a44]">Paid — thank you!</div></div>
              ) : (
                <>
                  <div className="text-[12px] text-[#8a86a3]">Amount due</div>
                  <div className="text-[34px] font-extrabold leading-none" style={{ fontFamily: "var(--ff-display)" }}>{money(inv.amount)}</div>
                  {inv.description && <div className="mt-2 text-[13px] text-[#4a4763]">{inv.description}</div>}
                  <div className="mt-1 text-[12px] text-[#8a86a3]">{inv.reference ? `Booking ${inv.reference}` : ""}{inv.dueDate ? `${inv.reference ? " · " : ""}Due ${fmtDay(inv.dueDate)}` : ""}</div>

                  <button type="button" disabled className="mt-4 w-full cursor-not-allowed rounded-full bg-[#1d3a8f] px-4 py-3 text-[14px] font-extrabold text-white opacity-60">Pay by card</button>
                  <div className="mt-1.5 text-center text-[11px] text-[#8a86a3]">💳 Online card payment is being set up — coming soon.</div>

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
