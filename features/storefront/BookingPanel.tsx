"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, get as apiGet } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase/client";
import { money } from "@/features/bookings/helpers";
import { applyDiscounts, type DiscountRule } from "@/features/listings/discounts";
import type { ServerListing } from "@/features/listings/ListingWizard";
import { PayModal } from "@/features/payments/PayModal";

// ─────────────────────────────────────────────────────────────────────────
// The parent checkout on /book/{id}: block → pass → timing → days →
// children → add-ons → book. One pass/timing/days selection applied to all
// children in the basket (uniform baskets are what the discount engine
// prices exactly); a family wanting different passes checks out twice.
// The total shown here is a PREVIEW with the same shared engine — the
// server independently re-prices everything on POST.
// ─────────────────────────────────────────────────────────────────────────

interface Session {
  date: string;
  start: string;
  end: string;
}
type Block = NonNullable<ServerListing["blocks"]>[number] & { sessions?: Session[] };
interface Kid {
  name: string;
  age: string;
}

const METHODS = ["Card", "Tax-Free Childcare"];

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function BookingPanel({ listing, signedIn }: { listing: ServerListing; signedIn: boolean }) {
  const blocks = ((listing.blocks ?? []) as Block[]).filter((b) => b.open && (b.sessions?.length ?? 0) > 0);
  const bundle = listing.bundle;
  const passes = bundle?.passes?.length
    ? bundle.passes.map((p) => ({ id: p.id, name: p.name, days: p.days as number | undefined, price: p.price }))
    : (listing.passes ?? []).map((p, i) => ({ id: `p${i}`, name: p.name, days: p.days, price: p.price }));
  const addons = listing.library?.addons ?? [];
  const discounts = (listing.discounts ?? []) as DiscountRule[];
  const [now] = useState(() => Date.now()); // captured once; the server re-checks opensAt anyway
  const opensLater = !!listing.opensAt && new Date(listing.opensAt).getTime() > now;

  const [blockId, setBlockId] = useState(blocks[0]?.id ?? "");
  const [passId, setPassId] = useState(passes[0]?.id ?? "");
  const [periodId, setPeriodId] = useState<string>("");
  // Chosen days, keyed by block+pass so switching either resets to the
  // default (whole-block passes take every session; day passes start empty).
  const [picked, setPicked] = useState<{ key: string; dates: string[] } | null>(null);
  const [kids, setKids] = useState<Kid[]>([{ name: "", age: "" }]);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [method, setMethod] = useState(METHODS[0]);
  const [saved, setSaved] = useState<{ id: string; name: string; age?: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ refs: string[]; status: string; total: number } | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  // Discount code the parent enters — validated against the live subtotal, then
  // redeemed server-side at booking (preview == charge).
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<{ code: string; off: number } | null>(null);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [codeChecking, setCodeChecking] = useState(false);

  const block = blocks.find((b) => b.id === blockId) ?? null;
  const pass = passes.find((p) => p.id === passId) ?? null;
  const sessionDates = (block?.sessions ?? []).map((s) => s.date);
  // How many days this pass covers within the chosen block.
  const need = pass?.days ? Math.min(pass.days, sessionDates.length) : sessionDates.length;
  const pickable = pass?.days !== undefined && need < sessionDates.length;
  const pickKey = `${blockId}|${passId}`;
  const dates = picked?.key === pickKey ? picked.dates : pickable ? [] : sessionDates;
  useEffect(() => {
    if (!signedIn) return;
    apiGet<{ id: string; name: string; age?: number }[]>("/api/my/children")
      .then(setSaved)
      .catch(() => {});
  }, [signedIn]);

  const unitPrice = (() => {
    if (!pass) return 0;
    if (periodId && bundle) return bundle.timings[`${pass.id}_${periodId}`] ?? pass.price;
    return pass.price;
  })();
  const validKids = kids.filter((k) => k.name.trim());
  const addonsPerChild = addonIds.reduce((s, id) => {
    const a = addons.find((x) => x.id === id);
    if (!a) return s;
    return s + (a.type === "perday" ? a.price * dates.length : a.price);
  }, 0);
  const preview = (() => {
    if (!pass || !validKids.length || !dates.length) return null;
    const { lines, total } = applyDiscounts(
      discounts,
      [{ name: pass.name, price: unitPrice, days: dates.length }],
      validKids.length,
    );
    return { lines, total: Math.round((total + addonsPerChild * validKids.length) * 100) / 100 };
  })();

  const finalTotal = preview ? Math.max(0, Math.round((preview.total - (appliedCode?.off ?? 0)) * 100) / 100) : 0;
  // Changing the basket invalidates a previously-applied code (its value was
  // worked out against the old subtotal).
  useEffect(() => { setAppliedCode(null); setCodeErr(null); }, [preview?.total, validKids.length]);

  async function applyCode() {
    const code = codeInput.trim();
    if (!code || !preview || !listing.tenantId) return;
    setCodeChecking(true); setCodeErr(null);
    try {
      const r = await api<{ valid: boolean; reason?: string; code?: string; off?: number }>("/api/discounts/validate", {
        method: "POST",
        body: JSON.stringify({ tenantId: listing.tenantId, code, subtotal: preview.total }),
      });
      if (r.valid && r.off != null) { setAppliedCode({ code: r.code ?? code.toUpperCase(), off: r.off }); setCodeInput(""); }
      else { setAppliedCode(null); setCodeErr(r.reason ?? "That code can’t be used"); }
    } catch (e) { setCodeErr(e instanceof Error ? e.message : "Couldn’t check that code"); }
    setCodeChecking(false);
  }

  const toggleDate = (d: string) =>
    setPicked({
      key: pickKey,
      dates: dates.includes(d) ? dates.filter((x) => x !== d) : dates.length < need ? [...dates, d].sort() : dates,
    });

  async function submit() {
    if (!block || !pass) return;
    setBusy(true);
    setError(null);
    try {
      const items = validKids.map((k) => ({
        pass: pass.name,
        ...(periodId ? { periodId } : {}),
        dates,
        child: k.name.trim(),
        age: parseInt(k.age, 10) || 0,
        ...(addonIds.length ? { addons: addonIds.map((id) => ({ id })) } : {}),
      }));
      const res = await api<{ bookings: { ref: string; status: string }[]; total: number }>("/api/my/bookings", {
        method: "POST",
        body: JSON.stringify({ listingId: listing.id, blockId: block.id, method, items, ...(appliedCode ? { discountCode: appliedCode.code } : {}) }),
      });
      setDone({ refs: res.bookings.map((b) => b.ref), status: res.bookings[0]?.status ?? "", total: res.total });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    }
    setBusy(false);
  }

  const S = {
    card: "rounded-2xl border border-[#e8edf7] bg-white p-5",
    label: "mb-1 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#8a86a3]",
    input: "w-full rounded-lg border border-[#e0e5f2] bg-white px-2.5 py-2 text-[13px] text-[#171534]",
    chip: (on: boolean) =>
      `rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${on ? "border-transparent bg-[#2f6bd8] text-white" : "border-[#e0e5f2] bg-white text-[#4a4763]"}`,
    cta: "rounded-xl bg-[#15b364] px-5 py-2.5 text-[14px] font-extrabold text-white disabled:opacity-50",
  };

  if (done)
    return (
      <div className={S.card + " text-center"}>
        <div className="text-[20px]">🎉</div>
        <div className="mt-1 text-[16px] font-extrabold text-[#171534]">
          {done.status === "Confirmed"
            ? "You're booked!"
            : done.status === "Waitlisted"
              ? "You're on the waiting list"
              : "Booking request sent"}
        </div>
        <p className="mt-1 text-[13px] text-[#4a4763]">
          {done.refs.length === 1 ? `Booking ${done.refs[0]}` : `Bookings ${done.refs.join(", ")}`} · total{" "}
          <b>{money(done.total)}</b>
          {done.status === "Approval needed" && " — the provider will confirm your place."}
          {done.status === "Waitlisted" && " — you'll be offered a place if one frees up."}
        </p>
        {paid ? (
          <p className="mt-1 text-[13px] font-bold text-[#0f7a44]">✅ Paid — see you there!</p>
        ) : done.status === "Confirmed" && done.total > 0 ? (
          <button
            type="button"
            className={S.cta + " mt-3"}
            onClick={() => setPaying(true)}
          >
            Pay {money(done.total)} now
          </button>
        ) : (
          <p className="mt-1 text-[12px] text-[#8a86a3]">Payment is collected after confirmation.</p>
        )}
        <div>
          <Link href="/custdash/bookings" className="mt-3 inline-block rounded-xl bg-[#2f6bd8] px-4 py-2 text-[13px] font-bold text-white">
            View my bookings
          </Link>
        </div>
        {paying && (
          <PayModal refs={done.refs} onClose={() => setPaying(false)} onPaid={() => setPaid(true)} />
        )}
      </div>
    );

  if (!blocks.length || !passes.length)
    return (
      <div className={S.card + " text-center text-[13px] text-[#8a86a3]"}>
        {opensLater ? "Booking hasn’t opened yet." : "No dates are open for booking right now."}
      </div>
    );

  return (
    <div className={S.card}>
      <div className="mb-3 text-[16px] font-extrabold text-[#171534]">Book your place</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {blocks.length > 1 && (
          <div className="sm:col-span-2">
            <label className={S.label}>Dates</label>
            <select className={S.input} value={blockId} onChange={(e) => setBlockId(e.target.value)}>
              {blocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.spotsLeft > 0 ? `${b.spotsLeft} place${b.spotsLeft === 1 ? "" : "s"} left` : "Full · waitlist"}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className={S.label}>Pass</label>
          <select className={S.input} value={passId} onChange={(e) => setPassId(e.target.value)}>
            {passes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {money(periodId && bundle ? bundle.timings[`${p.id}_${periodId}`] ?? p.price : p.price)}
              </option>
            ))}
          </select>
        </div>
        {!!bundle?.periods?.length && (
          <div>
            <label className={S.label}>Timing</label>
            <select className={S.input} value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
              <option value="">Standard</option>
              {bundle.periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.start}–{p.finish})
                </option>
              ))}
            </select>
          </div>
        )}
        {pickable && (
          <div className="sm:col-span-2">
            <label className={S.label}>
              Pick {need} day{need === 1 ? "" : "s"} ({dates.length}/{need})
            </label>
            <div className="flex flex-wrap gap-1.5">
              {sessionDates.map((d) => (
                <button key={d} type="button" className={S.chip(dates.includes(d))} onClick={() => toggleDate(d)}>
                  {fmtDay(d)}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className={S.label}>Who’s coming?</label>
          {kids.map((k, i) => (
            <div key={i} className="mb-1.5 flex gap-1.5">
              <input
                className={S.input}
                placeholder="Child's name"
                list={saved.length ? "saved-children" : undefined}
                value={k.name}
                onChange={(e) => {
                  const name = e.target.value;
                  const match = saved.find((s) => s.name === name);
                  setKids((p) => p.map((x, j) => (j === i ? { name, age: match?.age !== undefined ? String(match.age) : x.age } : x)));
                }}
              />
              <input
                className={S.input + " max-w-[90px]"}
                placeholder="Age"
                type="number"
                min={0}
                value={k.age}
                onChange={(e) => setKids((p) => p.map((x, j) => (j === i ? { ...x, age: e.target.value } : x)))}
              />
              {kids.length > 1 && (
                <button type="button" className="px-1 text-[#8a86a3]" onClick={() => setKids((p) => p.filter((_, j) => j !== i))} aria-label="Remove child">
                  ×
                </button>
              )}
            </div>
          ))}
          {saved.length > 0 && (
            <datalist id="saved-children">
              {saved.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          )}
          <button type="button" className="text-[12px] font-bold text-[#2f6bd8] underline" onClick={() => setKids((p) => [...p, { name: "", age: "" }])}>
            + Add another child
          </button>
        </div>
        {addons.length > 0 && (
          <div className="sm:col-span-2">
            <label className={S.label}>Add-ons (per child)</label>
            <div className="flex flex-wrap gap-1.5">
              {addons.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={S.chip(addonIds.includes(a.id))}
                  onClick={() => setAddonIds((p) => (p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id]))}
                >
                  {a.image ? "" : (a.emoji ?? "")} {a.name} · {a.type === "perday" ? `${money(a.price)}/day` : money(a.price)}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className={S.label}>How you’ll pay</label>
          <select className={S.input} value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {signedIn && preview && (
        <div className="mt-3 border-t border-[#eef1f8] pt-3">
          {appliedCode ? (
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="font-bold text-[#0f7a44]">✓ Code {appliedCode.code} applied — you save {money(appliedCode.off)}</span>
              <button type="button" onClick={() => { setAppliedCode(null); setCodeErr(null); }} className="font-bold text-[#2f6bd8]">Remove</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCode(); } }} placeholder="Discount code" className={S.input + " flex-1 uppercase"} />
              <button type="button" onClick={applyCode} disabled={codeChecking || !codeInput.trim()} className="rounded-lg border border-[#e0e5f2] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#4a4763] disabled:opacity-50">{codeChecking ? "Checking…" : "Apply"}</button>
            </div>
          )}
          {codeErr && <div className="mt-1 text-[11.5px] font-bold text-[#e21d27]">{codeErr}</div>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#eef1f8] pt-3">
        <div className="text-[13px] text-[#4a4763]">
          {preview ? (
            <>
              {preview.lines.map((l) => (
                <div key={l.name} className="text-[12px] text-[#0f7a44]">
                  −{money(l.amount)} {l.name}
                </div>
              ))}
              {appliedCode && (
                <div className="text-[12px] text-[#0f7a44]">−{money(appliedCode.off)} code {appliedCode.code}</div>
              )}
              <span>
                Total <b className="text-[16px] text-[#171534]">{money(finalTotal)}</b>
                {validKids.length > 1 && ` for ${validKids.length} children`}
              </span>
            </>
          ) : (
            <span className="text-[#8a86a3]">
              {pickable && dates.length < need ? `Pick ${need - dates.length} more day${need - dates.length === 1 ? "" : "s"}` : "Add a child to see the total"}
            </span>
          )}
        </div>
        {opensLater ? (
          <span className="rounded-full bg-[#fff7ed] px-3 py-1.5 text-[12px] font-bold text-[#9a3412]">
            ⏰ Booking opens {new Date(listing.opensAt!).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          </span>
        ) : !signedIn ? (
          <Link href={`/login?next=/book/${encodeURIComponent(listing.id)}`} className={S.cta + " inline-block"}>
            Sign in to book
          </Link>
        ) : (
          <button type="button" className={S.cta} disabled={busy || !preview} onClick={submit}>
            {busy ? "Booking…" : "Confirm booking"}
          </button>
        )}
      </div>
      {error && <div className="mt-2 text-[12.5px] font-bold text-[#e21d27]">{error}</div>}
      <div className="mt-2 text-[11.5px] text-[#8a86a3]">
        {firebaseAuth.currentUser?.email ? `Booking as ${firebaseAuth.currentUser.email} · ` : ""}
        Payment is collected after the provider confirms your booking.
      </div>
    </div>
  );
}
