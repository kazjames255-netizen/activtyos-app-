"use client"; // Error boundaries must be Client Components

import { useEffect, useState } from "react";
import { reloadOnceForChunkError } from "@/lib/chunkError";
import { reportClientError } from "@/lib/reportClientError";
import { useT } from "@/lib/i18n/provider";

// Any page that throws while rendering lands here instead of a white screen.
// Next 16 hands the boundary `unstable_retry` (re-fetch + re-render the segment).
export default function ErrorPage({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  const t = useT();
  const [sent, setSent] = useState<"idle" | "busy" | "done">("idle");
  useEffect(() => {
    console.error("[page error]", error);
    try { reloadOnceForChunkError(error, window.sessionStorage, () => window.location.reload()); } catch { /* storage blocked: show the screen */ }
  }, [error]);
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--line,#e6ebf2)] bg-[var(--surface,#fff)] p-7 text-center shadow-sm">
        <div className="text-[38px]">⚠️</div>
        <h1 className="mt-2 text-[20px] font-extrabold text-[var(--ink,#171534)]" style={{ fontFamily: "var(--ff-display)" }}>
          {t("p8pub.errTitle")}
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--ink-3,#5b6472)]">
          {error.digest
            ? t("p8pub.errBodyDigest", { digest: error.digest }).split("**").map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>))
            : t("p8pub.errBody")}
        </p>
        <p className="mt-2 break-words text-[11.5px] text-[var(--ink-3,#8a86a3)]">{error.message.slice(0, 200)}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => unstable_retry()} className="rounded-full bg-[#1d3a8f] px-5 py-2.5 text-[13px] font-bold text-white">
            {t("p8pub.tryAgain")}
          </button>
          <button type="button" disabled={sent === "busy" || sent === "done"} onClick={() => { setSent("busy"); reportClientError("Page", error).then(() => setSent("done")).catch(() => setSent("idle")); }}
            className="rounded-full border border-[#dbe0ec] bg-white px-5 py-2.5 text-[13px] font-bold text-[#4a4763] disabled:opacity-60">
            {sent === "done" ? t("p7shell.bugThanks") : t("p7shell.bugSend")}
          </button>
        </div>
      </div>
    </main>
  );
}
