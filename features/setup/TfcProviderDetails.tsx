"use client";

import { useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { Button, Card, FieldLabel, Input, Select } from "@/components/ui";
import { REGULATORS, looksLikeRegistration, looksLikeUkPostcode, tfcReady, type TfcDetails, type TfcMissing } from "@/lib/tfcReady";

/** Setup > Tax-Free Childcare: the details HMRC needs to PAY this provider (registered name, regulator + registration number, registered postcode).
 *  Saved to settings.childcare (the same block Reconciliation reads). A plain status chip says "Ready" or what is missing. */
export function TfcProviderDetails({ value, providerName, onSave }: { value: TfcDetails | undefined; providerName?: string; onSave: (v: TfcDetails) => void }) {
  const t = useT();
  const [draft, setDraft] = useState<TfcDetails>({ settingName: "", regulator: "Ofsted", registrationNumber: "", postcode: "", ...(value ?? {}) });
  const [saved, setSaved] = useState(false);
  const [pc, setPc] = useState<"idle" | "checking" | { ok: boolean; place: string }>("idle");
  const status = tfcReady(value, providerName); // what is SAVED decides the chip
  const set = (patch: Partial<TfcDetails>) => { setDraft((d) => ({ ...d, ...patch })); setSaved(false); };

  // Recognise the postcode as it is typed (the same lookup the home-visit area form uses).
  useEffect(() => {
    const q = (draft.postcode ?? "").trim();
    if (!looksLikeUkPostcode(q)) { setPc("idle"); return; }
    setPc("checking");
    let alive = true;
    const id = setTimeout(() => {
      apiGet<{ ok: boolean; postcode: string; place?: string }>(`/api/geo/recognise?q=${encodeURIComponent(q)}`)
        .then((r) => alive && setPc({ ok: r.ok, place: [r.postcode, r.place].filter(Boolean).join(" · ") }))
        .catch(() => alive && setPc("idle"));
    }, 500);
    return () => { alive = false; clearTimeout(id); };
  }, [draft.postcode]);

  const regBad = !!(draft.registrationNumber ?? "").trim() && !looksLikeRegistration(draft.registrationNumber);
  const pcBad = !!(draft.postcode ?? "").trim() && !looksLikeUkPostcode(draft.postcode);
  const canSave = !regBad && !pcBad;
  const label = (m: TfcMissing) => t(m === "name" ? "p8lst.tfcDetMName" : m === "registration" ? "p8lst.tfcDetMReg" : "p8lst.tfcDetMPostcode");

  return (
    <Card className="mb-3.5 p-4" data-testid="tfc-provider-details">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[15px] font-extrabold">{t("p8lst.tfcDetTitle")}</div>
        <span className="rounded-full px-2.5 py-[2px] text-[11.5px] font-extrabold" data-testid="tfc-status"
          style={status.ready ? { background: "#e7f8ee", color: "#0f7a43" } : { background: "#fff3e0", color: "#8a5300" }}>
          {status.ready ? t("p8lst.tfcDetReady") : t("p8lst.tfcDetMissing", { what: status.missing.map(label).join(", ") })}
        </span>
      </div>
      <p className="mb-3 mt-1 text-[12px] leading-[1.5] text-[var(--ink-3)]">{t("p8lst.tfcDetLede")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>{t("p8lst.tfcDetName")}</FieldLabel>
          <Input value={draft.settingName ?? ""} placeholder={providerName || ""} onChange={(e) => set({ settingName: e.target.value })} />
        </div>
        <div>
          <FieldLabel>{t("p8lst.tfcDetRegulator")}</FieldLabel>
          <Select value={draft.regulator ?? "Ofsted"} onChange={(e) => set({ regulator: e.target.value })}>
            {REGULATORS.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel>{t("p8lst.tfcDetReg")}</FieldLabel>
          <Input value={draft.registrationNumber ?? ""} placeholder={t("p8lst.tfcDetRegPh")} onChange={(e) => set({ registrationNumber: e.target.value })} />
          {regBad && <div className="mt-1 text-[11.5px] font-bold text-[#c02636]">{t("p8lst.tfcDetBadReg")}</div>}
        </div>
        <div>
          <FieldLabel>{t("p8lst.tfcDetPostcode")}</FieldLabel>
          <Input value={draft.postcode ?? ""} placeholder="MK1 1AA" onChange={(e) => set({ postcode: e.target.value })} />
          {pcBad && <div className="mt-1 text-[11.5px] font-bold text-[#c02636]">{t("p8lst.tfcDetBadPc")}</div>}
          {pc === "checking" && <div className="mt-1 text-[11.5px] text-[var(--ink-3)]">{t("p8lst.pcChecking")}</div>}
          {typeof pc === "object" && <div className="mt-1 text-[11.5px] font-bold" style={{ color: pc.ok ? "#0f7a43" : "#c02636" }}>{pc.ok ? t("p8lst.pcRecognised", { place: pc.place }) : t("p8lst.pcNotFound")}</div>}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button variant="primary" disabled={!canSave} onClick={() => { onSave({ ...draft, registrationNumber: (draft.registrationNumber ?? "").replace(/\s+/g, ""), postcode: (draft.postcode ?? "").trim().toUpperCase() }); setSaved(true); }}>{t("p8lst.tfcDetSave")}</Button>
        {saved && <span className="text-[12px] font-bold text-[#0f7a43]">{t("p8lst.tfcDetSaved")}</span>}
      </div>
    </Card>
  );
}
