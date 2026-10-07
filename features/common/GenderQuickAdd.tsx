"use client";

import { useState } from "react";
import { put as apiPut } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { GenderChoice, type Sex } from "./GenderChoice";

// "Add gender for sally (optional)": a one-tap way to record a child's gender when the saved child has none. Saves straight to the child's own
// record (PUT /api/my/children/:id with just the name and the choice: the server keeps every other field). The family can skip it.
export function GenderQuickAdd({ kid, variant = "inline", onSaved, onSkip }: {
  kid: { id: string; name: string };
  variant?: "banner" | "inline";
  onSaved?: (sex: Sex) => void;
  onSkip?: () => void;
}) {
  const t = useT();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function choose(v: Sex) {
    if (!v) return;
    setBusy(true); setErr(null);
    try {
      await apiPut(`/api/my/children/${encodeURIComponent(kid.id)}`, { name: kid.name, sex: v });
      setDone(true);
      onSaved?.(v);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    }
    setBusy(false);
  }

  if (done) return <div className="text-[12.5px] font-bold text-[#0f7a43]" role="status">{t("p8lst.genSaved")}</div>;
  const row = (
    <div className={busy ? "pointer-events-none opacity-60" : ""}>
      <GenderChoice value="" onChange={(v) => void choose(v)} compact />
      {err && <div role="alert" className="mt-1 text-[12px] font-semibold text-[#c0392b]">{err}</div>}
    </div>
  );
  if (variant === "inline") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="font-bold">{t("p8lst.genPromptTitle", { name: kid.name })}</span>
        {row}
      </div>
    );
  }
  return (
    <div className="mb-4 rounded-2xl border px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <div className="text-[14px] font-extrabold text-[var(--ink)]">{t("p8lst.genPromptTitle", { name: kid.name })}</div>
      <div className="mb-2 text-[12.5px] font-semibold text-[var(--ink-3)]">{t("p8lst.genPromptSub")}</div>
      {row}
      {onSkip && <button type="button" onClick={onSkip} className="mt-2 text-[12.5px] font-bold underline">{t("p8lst.genNotNow")}</button>}
    </div>
  );
}
