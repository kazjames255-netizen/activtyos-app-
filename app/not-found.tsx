"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/provider";

// A proper 404 — a mistyped or stale URL used to be a white screen or Next's
// bare default, which reads as the product being broken.
export default function NotFound() {
  const t = useT();
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg,#f4f7fc)] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--line,#e6ebf2)] bg-[var(--surface,#fff)] p-7 text-center shadow-sm">
        <div className="text-[38px]">🧭</div>
        <h1 className="mt-2 text-[20px] font-extrabold text-[var(--ink,#171534)]" style={{ fontFamily: "var(--ff-display)" }}>
          {t("p8pub.nfTitle")}
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--ink-3,#5b6472)]">
          {t("p8pub.nfBody")}
        </p>
        <Link href="/" className="mt-5 inline-block rounded-full bg-[#1d3a8f] px-5 py-2.5 text-[13px] font-bold text-white">
          {t("p8pub.nfHome")}
        </Link>
      </div>
    </main>
  );
}
