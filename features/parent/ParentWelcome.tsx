"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { get as apiGet, post as apiPost } from "@/lib/api";
import type { Me } from "@/lib/roles";

// First-login welcome for a parent. Shows exactly once — the moment a
// freshly-registered family first lands in the portal — nudging them to add
// their children before they explore. `welcomedAt` on their user record is
// stamped on dismiss (via POST /api/me/welcome), so it never shows again.
export function ParentWelcome() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<string>("");

  useEffect(() => {
    apiGet<Me>("/api/me")
      .then((m) => {
        if (m.role === "parent" && !m.welcomed) setOpen(true);
      })
      .catch(() => {});
    // The provider they belong to, so the welcome reads in their brand.
    apiGet<{ name: string }[]>("/api/my/providers")
      .then((ps) => ps?.[0]?.name && setProvider(ps[0].name))
      .catch(() => {});
  }, []);

  // Mark seen (fire-and-forget — a failed stamp just means they see it once
  // more, never a blocked navigation) and close.
  function markSeen() {
    void apiPost("/api/me/welcome", {});
    setOpen(false);
  }
  function go(href: string) {
    markSeen();
    router.push(href);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(12,18,40,.55)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div className="w-full max-w-[460px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-12px_rgba(20,30,60,.55)]">
        {/* Branded header band */}
        <div className="relative px-6 py-6 text-white" style={{ background: "linear-gradient(120deg,#16306e 0%,#3f78d8 70%,#5a93f0 100%)" }}>
          <button
            type="button"
            onClick={markSeen}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[15px] font-bold leading-none hover:bg-white/30"
          >
            ×
          </button>
          <div className="text-[26px]">👋</div>
          <h2 id="welcome-title" className="mt-1 text-[21px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>
            Welcome{provider ? ` to ${provider}` : ""}!
          </h2>
          <p className="mt-1 text-[13px] leading-[1.5] text-white/90">
            This is your home for everything{provider ? ` with ${provider}` : ""} — <b>book activities, camps &amp; clubs</b>, manage your children&rsquo;s details, message the team, use vouchers &amp; wallet credit, and see what&rsquo;s coming up, all in one place.
          </p>
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-white/80">
            Let&rsquo;s get you ready to book — it takes one quick step.
          </p>
        </div>

        {/* Step 1 — add children (the important bit) */}
        <div className="px-6 pt-5">
          <div className="rounded-xl border border-[var(--line,#ece6f1)] bg-[#f7faff] p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#2f6bd8] text-[15px] font-extrabold text-white">1</span>
              <div className="min-w-0">
                <div className="text-[14.5px] font-extrabold text-[var(--ink,#171534)]">Add your children</div>
                <div className="mt-0.5 text-[12.5px] leading-[1.5] text-[var(--ink-3,#8a86a3)]">
                  Tell us who&rsquo;s coming along — names, ages and anything we should know. It makes booking quick and keeps them safe on the day.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => go("/custdash/children")}
              className="mt-3 w-full rounded-full py-2.5 text-[14px] font-extrabold text-white transition-transform hover:-translate-y-px"
              style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", boxShadow: "0 4px 14px -3px rgba(47,107,216,.6)" }}
            >
              Add my children →
            </button>
          </div>

          {/* Step 2 — then explore / browse */}
          <div className="mt-3 flex items-start gap-3 px-1">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#eaf0fc] text-[15px] font-extrabold text-[#2f6bd8]">2</span>
            <div className="min-w-0">
              <div className="text-[14.5px] font-extrabold text-[var(--ink,#171534)]">Then find what&rsquo;s on</div>
              <div className="mt-0.5 text-[12.5px] leading-[1.5] text-[var(--ink-3,#8a86a3)]">
                Have a look around your dashboard, then head to Browse activities to see everything you can book.
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line,#ece6f1)] bg-[var(--panel,#fbf8fc)] px-6 py-3">
          <button type="button" onClick={markSeen} className="text-[12.5px] font-bold text-[var(--ink-3,#8a86a3)] hover:text-[var(--ink-2,#4a4763)]">
            I&rsquo;ll do it later
          </button>
          <button
            type="button"
            onClick={() => go("/custdash/browse")}
            className="rounded-full border border-[var(--line,#ece6f1)] bg-white px-4 py-2 text-[13px] font-bold text-[#1d3a8f] hover:border-[#2f6bd8]"
          >
            Browse activities
          </button>
        </div>
      </div>
    </div>
  );
}
