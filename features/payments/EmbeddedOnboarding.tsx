"use client";

import { useEffect, useRef, useState } from "react";
import { post as apiPost } from "@/lib/api";

// Stripe's embedded onboarding: the set-up form shown inside the app (card payments + payouts), so the
// provider never leaves. Connect.js is loaded from Stripe's own host (the only supported way). If anything
// about the embedded route is unavailable, we fall back to Stripe's hosted page so nobody is stuck.

const PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const CONNECT_JS = "https://connect-js.stripe.com/v1.0/connect.js";

interface ConnectInstance { create(name: string): HTMLElement & { setOnExit?: (cb: () => void) => void } }
interface StripeConnectGlobal { init(o: { publishableKey: string; fetchClientSecret: () => Promise<string>; appearance?: unknown }): ConnectInstance }
declare global { interface Window { StripeConnect?: StripeConnectGlobal } }

let loading: Promise<StripeConnectGlobal> | null = null;
function loadConnect(): Promise<StripeConnectGlobal> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.StripeConnect) return Promise.resolve(window.StripeConnect);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = CONNECT_JS;
    el.async = true;
    el.onload = () => (window.StripeConnect ? resolve(window.StripeConnect) : reject(new Error("Stripe did not load")));
    el.onerror = () => { loading = null; reject(new Error("Could not reach Stripe")); };
    document.head.appendChild(el);
  });
  return loading;
}

export function EmbeddedOnboarding({ onClose, onExit }: { onClose: () => void; onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        if (!PK) throw new Error("Payments aren’t configured (no publishable key).");
        // First call asks the server for a session; if Stripe will not issue one it returns the hosted link instead.
        const first = await apiPost<{ clientSecret?: string; url?: string }>("/api/payments/connect/session", {});
        if (first.url) { window.location.href = first.url; return; }
        const sc = await loadConnect();
        let used = false;
        const inst = sc.init({
          publishableKey: PK,
          fetchClientSecret: async () => {
            if (!used && first.clientSecret) { used = true; return first.clientSecret; }
            const again = await apiPost<{ clientSecret?: string }>("/api/payments/connect/session", {});
            if (!again.clientSecret) throw new Error("Could not refresh the Stripe session");
            return again.clientSecret;
          },
          appearance: { variables: { colorPrimary: "#2f4fa8", borderRadius: "10px" } },
        });
        const el = inst.create("account-onboarding");
        el.setOnExit?.(() => onExit());
        if (dead || !host.current) return;
        host.current.innerHTML = "";
        host.current.appendChild(el);
        setState("ready");
      } catch (e) {
        if (dead) return;
        setMsg(e instanceof Error ? e.message : "Could not open the set-up form");
        setState("error");
      }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function useHosted() {
    try { const { url } = await apiPost<{ url: string }>("/api/payments/connect", {}); window.location.href = url; }
    catch (e) { setMsg(e instanceof Error ? e.message : "Could not open Stripe"); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Set up card payments" className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6">
      <div className="mt-[6vh] w-full max-w-[720px] rounded-2xl bg-[var(--surface,#fff)] p-4 text-[var(--ink)] shadow-2xl sm:p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[18px] font-extrabold">Set up card payments</div>
            <div className="text-[12.5px] text-[var(--ink-3)]">Stripe collects your details securely. Your progress is saved, so you can stop and come back.</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full px-2 text-[22px] leading-none text-[var(--ink-3)]">×</button>
        </div>
        {state === "loading" && <div className="py-10 text-center text-[13px] text-[var(--ink-3)]">Opening Stripe…</div>}
        {state === "error" && (
          <div className="rounded-lg bg-[#fdebec] px-3 py-3 text-[13px] text-[#bb1620]">
            {msg}
            <div className="mt-2"><button type="button" onClick={useHosted} className="rounded-full bg-[var(--brand,#2f4fa8)] px-4 py-2 text-[13px] font-bold text-white">Continue on Stripe’s page instead</button></div>
          </div>
        )}
        <div ref={host} />
      </div>
    </div>
  );
}
