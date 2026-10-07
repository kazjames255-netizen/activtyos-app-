"use client";

import { useEffect, useState } from "react";
import { Input, FieldLabel } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { isUkPostcodeShape, type AddressParts } from "@/lib/addressComplete";

// The parent's full home address as four required boxes (house number or name, street, town, postcode). The postcode is recognised as they
// type ("✓ Recognised: MK10 9NR · Milton Keynes") using the public /api/postcode-recognise (it works before the account exists, at sign-up).
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function AddressFields({ value, onChange, idPrefix = "adr", showWhy = true }: { value: AddressParts; onChange: (v: AddressParts) => void; idPrefix?: string; showWhy?: boolean }) {
  const t = useT();
  const set = (k: keyof AddressParts) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: k === "postcode" ? e.target.value.toUpperCase() : e.target.value });
  const [pc, setPc] = useState<{ state: "idle" | "checking" | "ok" | "bad" | "format"; place?: string }>({ state: "idle" });
  useEffect(() => {
    const raw = value.postcode.trim();
    if (!raw) { setPc({ state: "idle" }); return; }
    if (!isUkPostcodeShape(raw)) { setPc(raw.replace(/\s/g, "").length >= 6 ? { state: "format" } : { state: "idle" }); return; }
    setPc({ state: "checking" });
    const ctl = new AbortController();
    const id = setTimeout(() => {
      fetch(`${API_BASE}/api/postcode-recognise?q=${encodeURIComponent(raw)}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((j: { ok: boolean; postcode?: string; place?: string }) => setPc(j.ok ? { state: "ok", place: [j.postcode, j.place].filter(Boolean).join(" · ") } : { state: "bad" }))
        .catch(() => { /* the check failed (network): do not block, the format is already valid */ setPc({ state: "idle" }); });
    }, 450);
    return () => { clearTimeout(id); ctl.abort(); };
  }, [value.postcode]);
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[13px] font-extrabold">{t("p7ck.adrTitle")}</div>
      {showWhy && <p className="-mt-2 text-[11.5px] text-[var(--ink-3)]">{t("p7ck.adrWhy")}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><FieldLabel htmlFor={`${idPrefix}-house`}>{t("p7ck.adrHouse")}</FieldLabel><Input id={`${idPrefix}-house`} required autoComplete="address-line1" value={value.house} onChange={set("house")} className="w-full" /></div>
        <div><FieldLabel htmlFor={`${idPrefix}-street`}>{t("p7ck.adrStreet")}</FieldLabel><Input id={`${idPrefix}-street`} required autoComplete="address-line2" value={value.street} onChange={set("street")} className="w-full" /></div>
        <div><FieldLabel htmlFor={`${idPrefix}-town`}>{t("p7ck.adrTown")}</FieldLabel><Input id={`${idPrefix}-town`} required autoComplete="address-level2" value={value.town} onChange={set("town")} className="w-full" /></div>
        <div>
          <FieldLabel htmlFor={`${idPrefix}-pc`}>{t("p7ck.adrPostcode")}</FieldLabel>
          <Input id={`${idPrefix}-pc`} required autoComplete="postal-code" value={value.postcode} onChange={set("postcode")} placeholder="NN5 7EA" className="w-full" />
          <div className="mt-1 min-h-[16px] text-[11.5px] font-bold" aria-live="polite">
            {pc.state === "checking" && <span className="text-[var(--ink-3)]">{t("p8lst.pcChecking")}</span>}
            {pc.state === "ok" && <span style={{ color: "#0f7a43" }}>{t("p8lst.pcRecognised", { place: pc.place ?? "" })}</span>}
            {pc.state === "bad" && <span style={{ color: "#c02636" }}>{t("p8lst.pcNotFound")}</span>}
            {pc.state === "format" && <span style={{ color: "#c02636" }}>{t("p7ck.pcFormat")}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
