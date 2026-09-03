"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { get as apiGet, post as apiPost, put as apiPut } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import type { Me } from "@/lib/roles";

interface GeoHit { label: string; lat: number; lng: number }
const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

interface AccountProfile { name: string; phone: string; address: string; postcode: string; emergencyName: string; emergencyPhone: string }

// First-login welcome for a parent. Shows exactly once — the moment a
// freshly-registered family first lands in the portal. Two phases:
//   1. "Your details" — capture the parent's own name / phone / address, which
//      they were never asked for (an invite only gives us their email).
//   2. "Get going"    — add your children (full profile form), then browse.
// `welcomedAt` on their user record is stamped on finish/dismiss (via POST
// /api/me/welcome), so it never shows again.
export function ParentWelcome() {
  const t = useT();
  const router = useRouter();
  // ?welcome=1 forces the popup open regardless of the seen-flag — handy for
  // re-viewing it during testing without clearing the flag each time.
  const forced = useSearchParams().get("welcome") === "1";
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"details" | "go">("details");
  const [provider, setProvider] = useState<string>("");

  const [form, setForm] = useState<AccountProfile>({ name: "", phone: "", address: "", postcode: "", emergencyName: "", emergencyPhone: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Address finder — suggests as you type, and fills address + postcode on pick.
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeoHit[]>([]);
  const [showHits, setShowHits] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onQuery(v: string) {
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 3) { setHits([]); setShowHits(false); return; }
    timer.current = setTimeout(() => {
      apiGet<GeoHit[]>(`/api/geo/search?q=${encodeURIComponent(v.trim())}`)
        .then((r) => { setHits(r ?? []); setShowHits(true); })
        .catch(() => { setHits([]); setShowHits(false); });
    }, 300);
  }
  function pickAddress(label: string) {
    const pc = (label.match(UK_POSTCODE)?.[1] ?? "").toUpperCase().replace(/\s+/g, " ").trim();
    const addr = label
      .replace(/,?\s*United Kingdom$/i, "")
      .replace(UK_POSTCODE, "")
      .replace(/,\s*,/g, ",")
      .replace(/[\s,]+$/, "")
      .trim();
    setForm((f) => ({ ...f, address: addr, postcode: pc }));
    setQuery(""); // clear the finder so the address isn't repeated below
    setHits([]);
    setShowHits(false);
  }

  useEffect(() => {
    if (forced) setOpen(true);
    // Show only to a parent who hasn't seen it AND hasn't onboarded yet (no
    // children on record). Anyone who already added a child has clearly been
    // through it, so never nag them again — even if the seen-flag got cleared.
    Promise.all([
      apiGet<Me>("/api/me").catch(() => null),
      apiGet<unknown[]>("/api/my/children").catch(() => [] as unknown[]),
    ]).then(([m, kids]) => {
      if (forced) return;
      if (m?.role === "parent" && !m.welcomed && (kids?.length ?? 0) === 0) setOpen(true);
    });
    // Prefill anything we already hold (usually just a name from their invite).
    apiGet<AccountProfile>("/api/account")
      .then((p) => setForm({
        name: p.name ?? "", phone: /@/.test(p.phone) ? "" : (p.phone ?? ""),
        address: p.address ?? "", postcode: p.postcode ?? "",
        emergencyName: p.emergencyName ?? "", emergencyPhone: p.emergencyPhone ?? "",
      }))
      .catch(() => {});
    // The provider they belong to, so the welcome reads in their brand.
    apiGet<{ name: string }[]>("/api/my/providers")
      .then((ps) => ps?.[0]?.name && setProvider(ps[0].name))
      .catch(() => {});
  }, []);

  // Stamp "seen" (fire-and-forget) and close.
  function markSeen() {
    void apiPost("/api/me/welcome", {});
    setOpen(false);
  }
  function go(href: string) {
    markSeen();
    router.push(href);
  }

  const set = (k: keyof AccountProfile) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const firstName = form.name.trim().split(/\s+/)[0] || "";
  const detailsOk = !!form.name.trim() && !!form.phone.trim() && !!form.address.trim() && !!form.postcode.trim()
    && !!form.emergencyName.trim() && !!form.emergencyPhone.trim();

  async function saveDetails() {
    if (!detailsOk) { setErr(t("parent.errFillDetails")); return; }
    setSaving(true); setErr(null);
    try {
      await apiPut("/api/account", {
        name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), postcode: form.postcode.trim(),
        emergencyName: form.emergencyName.trim(), emergencyPhone: form.emergencyPhone.trim(),
      });
      setPhase("go");
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("parent.errCouldntSave"));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const inp = "w-full rounded-lg border px-3 py-2 text-[13.5px]";
  const inpStyle = { borderColor: "var(--line,#ece6f1)", background: "#fff", color: "var(--ink,#171534)" } as React.CSSProperties;
  const label = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3,#8a86a3)]";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(12,18,40,.55)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div className="max-h-[94vh] w-full max-w-[680px] overflow-y-auto rounded-2xl bg-white shadow-[0_24px_60px_-12px_rgba(20,30,60,.55)]">
        {/* Branded header band */}
        <div className="relative px-6 py-5 text-white" style={{ background: "linear-gradient(120deg,var(--brand-strong) 0%,var(--brand-2) 70%,#5a93f0 100%)" }}>
          <button
            type="button"
            onClick={markSeen}
            aria-label={t("parent.close")}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[15px] font-bold leading-none hover:bg-white/30"
          >
            ×
          </button>
          <h2 id="welcome-title" className="text-[21px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>
            👋 {firstName ? t("parent.welcomeName", { name: firstName }) : t("parent.welcomeNoName")}
          </h2>
          <p className="mt-1 text-[12.5px] leading-[1.45] text-white/90">
            {provider ? t("parent.welcomeBlurbProvider", { provider }) : t("parent.welcomeBlurbNoProvider")}
          </p>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-white/70">
            {t("parent.stepXof2", { n: phase === "details" ? "1" : "2", label: phase === "details" ? t("parent.yourDetailsStep") : t("parent.getGoingStep") })}
          </p>
        </div>

        {phase === "details" ? (
          /* ── Phase 1: the parent's own details ─────────────────────────── */
          <div className="px-6 py-4">
            <div className="text-[14.5px] font-extrabold text-[var(--ink,#171534)]">{t("parent.detailsHeading")}</div>
            <p className="mt-0.5 text-[12px] leading-[1.4] text-[var(--ink-3,#8a86a3)]">
              {t("parent.detailsSub", { provider: provider || t("parent.yourProvider") })}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <span className={label}>{t("parent.yourName")} <span className="text-[#e21d27]">*</span></span>
                <input className={inp} style={inpStyle} value={form.name} onChange={set("name")} placeholder={t("parent.firstLastName")} />
              </div>
              <div>
                <span className={label}>{t("parent.contactNumber")} <span className="text-[#e21d27]">*</span></span>
                <input className={inp} style={inpStyle} value={form.phone} onChange={set("phone")} placeholder={t("parent.mobilePlaceholder")} inputMode="tel" />
              </div>
              <div className="relative sm:col-span-2">
                <span className={label}>{t("parent.findYourAddress")} <span className="font-normal normal-case text-[var(--ink-3,#8a86a3)]">{t("parent.startTypingSuffix")}</span></span>
                <input
                  className={inp}
                  style={inpStyle}
                  value={query}
                  onChange={(e) => onQuery(e.target.value)}
                  onFocus={() => hits.length && setShowHits(true)}
                  placeholder={t("parent.addressSearchPlaceholder")}
                  autoComplete="off"
                />
                {showHits && hits.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[190px] overflow-y-auto rounded-lg border bg-white shadow-lg" style={{ borderColor: "var(--line,#ece6f1)" }}>
                    {hits.map((h, i) => (
                      <button
                        key={`${h.label}-${i}`}
                        type="button"
                        onClick={() => pickAddress(h.label)}
                        className="block w-full truncate px-3 py-2 text-left text-[12.5px] hover:bg-[#f2f6ff]"
                        style={{ color: "var(--ink-2,#4a4763)" }}
                        title={h.label}
                      >
                        📍 {h.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                <span className={label}>{t("parent.homeAddress")} <span className="text-[#e21d27]">*</span></span>
                <input className={inp} style={inpStyle} value={form.address} onChange={set("address")} placeholder={t("parent.homeAddressPlaceholder")} />
              </div>
              <div>
                <span className={label}>{t("parent.postcode")} <span className="text-[#e21d27]">*</span></span>
                <input className={inp} style={inpStyle} value={form.postcode} onChange={set("postcode")} placeholder={t("parent.postcodePlaceholder")} />
              </div>

              {/* Family-level emergency contact — the same for every child, so
                  it's asked once here rather than on each child profile. */}
              <div className="mt-1 sm:col-span-2">
                <div className="text-[12.5px] font-extrabold text-[var(--ink,#171534)]">{t("parent.emergencyContact")}</div>
                <div className="text-[11px] leading-[1.4] text-[var(--ink-3,#8a86a3)]">{t("parent.emergencyContactSub")}</div>
              </div>
              <div>
                <span className={label}>{t("parent.contactName")} <span className="text-[#e21d27]">*</span></span>
                <input className={inp} style={inpStyle} value={form.emergencyName} onChange={set("emergencyName")} placeholder={t("parent.emergencyNamePlaceholder")} />
              </div>
              <div>
                <span className={label}>{t("parent.contactNumber")} <span className="text-[#e21d27]">*</span></span>
                <input className={inp} style={inpStyle} value={form.emergencyPhone} onChange={set("emergencyPhone")} placeholder={t("parent.emergencyPhonePlaceholder")} inputMode="tel" />
              </div>
            </div>
            <p className="mt-1.5 text-[11px] leading-[1.4] text-[var(--ink-3,#8a86a3)]">
              {t("parent.childrenNextNote")}
            </p>
            {err && <div className="mt-2 text-[12px] font-bold text-[#e21d27]">{err}</div>}
            <button
              type="button"
              onClick={saveDetails}
              disabled={saving}
              className="mt-3 w-full rounded-full py-2.5 text-[14px] font-extrabold text-white transition-transform hover:-translate-y-px disabled:opacity-60"
              style={{ background: "linear-gradient(180deg,#4f8bf5,var(--brand-2))", boxShadow: "0 4px 14px -3px rgba(47,107,216,.6)" }}
            >
              {saving ? t("parent.saving") : t("parent.continueArrow")}
            </button>
          </div>
        ) : (
          /* ── Phase 2: add children, then browse ────────────────────────── */
          <>
            <div className="px-6 pt-5">
              <div className="rounded-xl border border-[var(--line,#ece6f1)] bg-[#f7faff] p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--brand-2)] text-[15px] font-extrabold text-white">1</span>
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-extrabold text-[var(--ink,#171534)]">{t("parent.addYourChildren")}</div>
                    <div className="mt-0.5 text-[12.5px] leading-[1.5] text-[var(--ink-3,#8a86a3)]">
                      {t("parent.addChildrenSub", { provider: provider || t("parent.yourProvider") })}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => go("/custdash/children?add=1")}
                  className="mt-3 w-full rounded-full py-2.5 text-[14px] font-extrabold text-white transition-transform hover:-translate-y-px"
                  style={{ background: "linear-gradient(180deg,#4f8bf5,var(--brand-2))", boxShadow: "0 4px 14px -3px rgba(47,107,216,.6)" }}
                >
                  {t("parent.addMyChildren")}
                </button>
              </div>

              <div className="mt-3 flex items-start gap-3 px-1">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#eaf0fc] text-[15px] font-extrabold text-[var(--brand-2)]">2</span>
                <div className="min-w-0">
                  <div className="text-[14.5px] font-extrabold text-[var(--ink,#171534)]">{t("parent.thenFindWhatsOn")}</div>
                  <div className="mt-0.5 text-[12.5px] leading-[1.5] text-[var(--ink-3,#8a86a3)]">
                    {t("parent.browseSub", { provider: provider || t("parent.yourProvider") })}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line,#ece6f1)] bg-[var(--panel,#fbf8fc)] px-6 py-3">
              <button type="button" onClick={markSeen} className="text-[12.5px] font-bold text-[var(--ink-3,#8a86a3)] hover:text-[var(--ink-2,#4a4763)]">
                {t("parent.illDoItLater")}
              </button>
              <button
                type="button"
                onClick={() => go("/custdash/browse")}
                className="rounded-full border border-[var(--line,#ece6f1)] bg-white px-4 py-2 text-[13px] font-bold text-[var(--brand)] hover:border-[var(--brand-2)]"
              >
                {t("parent.browseActivities")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
