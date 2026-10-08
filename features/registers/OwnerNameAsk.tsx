"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { isPlaceholderName } from "@/lib/placeholderName";

/** A provider working alone (freelancer / company owner) whose account name is a mailbox word ("support"): asked ONCE, on the register, for the real
 *  name their register entries, incident and medicine records will carry. Saved to the account profile; the banner disappears for good. */
export function OwnerNameAsk({ emailLocal, onSaved }: { emailLocal: string; onSaved: (name: string) => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [bad, setBad] = useState(false);
  async function save() {
    const nm = name.trim();
    if (nm.length < 2 || isPlaceholderName(nm, emailLocal)) { setBad(true); return; }
    setBusy(true); setBad(false);
    try {
      await api("/api/account", { method: "PUT", body: JSON.stringify({ name: nm }) });
      onSaved(nm);
    } catch { setBad(true); }
    setBusy(false);
  }
  return (
    <div className="mb-3 rounded-xl border border-[#f0c96b] bg-[#fff7e0] px-3.5 py-3 text-[#7a4b00]" data-testid="owner-name-ask">
      <div className="text-[13px] font-extrabold">{t("p8lst.regNameAsk")}</div>
      <p className="mt-0.5 text-[12px] leading-snug">{t("p8lst.regNameWhy")}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setBad(false); }}
          placeholder={t("p8lst.regNamePh")}
          aria-label={t("p8lst.regNameAsk")}
          className="min-w-[200px] flex-1 rounded-lg border border-[#e6c46a] bg-white px-2.5 py-1.5 text-[13px] text-[#171534] outline-none"
        />
        <button type="button" disabled={busy} onClick={() => void save()} className="rounded-full bg-[#7a4b00] px-4 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-60">{t("p8lst.regNameSave")}</button>
      </div>
      {bad && <div className="mt-1 text-[11.5px] font-bold text-[#c02636]">{t("p8lst.regNameBad")}</div>}
    </div>
  );
}
