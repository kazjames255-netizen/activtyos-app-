"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Button, Card, FieldLabel, Input, SectionHead } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { Rich } from "@/components/i18n/Rich";

interface Listing {
  id: string;
  name: string;
  passes: { name: string; price: number }[];
  blocks: { id: string; name: string; spotsLeft: number; capacity: number; open: boolean }[];
}

interface Draft {
  id: string | null; // null = creating
  name: string;
  passes: { name: string; price: string }[];
}

const EMPTY_DRAFT: Draft = {
  id: null,
  name: "",
  passes: [{ name: "Day pass", price: "" }],
};

function ListingForm({ draft, onDone }: { draft: Draft; onDone: (changed: boolean) => void }) {
  const t = useT();
  const [d, setD] = useState(draft);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    const passes = d.passes
      .filter((p) => p.name.trim())
      .map((p) => ({ name: p.name.trim(), price: parseFloat(p.price) || 0 }));
    if (!d.name.trim() || !passes.length) {
      setError(t("p8lst.laNeedNamePass"));
      return;
    }
    setBusy(true);
    try {
      const body = { name: d.name.trim(), passes };
      if (d.id) await api(`/api/listings/${encodeURIComponent(d.id)}`, { method: "PUT", body: JSON.stringify(body) });
      else await apiPost("/api/listings", body);
      onDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("p8lst.laSaveFailed"));
      setBusy(false);
    }
  }

  const upd = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));

  return (
    <Card className="p-4">
      <div className="mb-3 text-[15px] font-extrabold">
        {d.id ? t("p8lst.laEditListing") : t("p8lst.laNewListing")}
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <FieldLabel>{t("p8lst.laListingName")}</FieldLabel>
          <Input
            value={d.name}
            onChange={(e) => upd({ name: e.target.value })}
            placeholder={t("p8lst.laNamePh")}
            className="w-full"
          />
        </div>

        <div>
          <FieldLabel>{t("p8lst.laPassesPrices")}</FieldLabel>
          {d.passes.map((p, i) => (
            <div key={i} className="mb-1.5 flex gap-1.5">
              <Input
                value={p.name}
                onChange={(e) =>
                  upd({ passes: d.passes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })
                }
                placeholder={t("p8lst.laPassNamePh")}
                className="flex-1"
              />
              <Input
                type="number"
                min={0}
                value={p.price}
                onChange={(e) =>
                  upd({ passes: d.passes.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })
                }
                placeholder="£"
                className="w-[90px]"
              />
              {d.passes.length > 1 && (
                <Button sm type="button" onClick={() => upd({ passes: d.passes.filter((_, j) => j !== i) })}>
                  ✕
                </Button>
              )}
            </div>
          ))}
          <Button sm type="button" onClick={() => upd({ passes: [...d.passes, { name: "", price: "" }] })}>
            {t("p8lst.laAddPass")}
          </Button>
        </div>

        <div className="text-[11.5px] text-[var(--ink-3)]">
          <Rich text={t("p8lst.laBlocksNote")} />
        </div>

        {error && <div className="text-[12.5px] text-[var(--red)]">{error}</div>}
        <div className="flex gap-2">
          <Button variant="primary" disabled={busy} onClick={save}>
            {busy ? t("p8lst.laSaving") : d.id ? t("p8lst.laSaveChanges") : t("p8lst.laCreateListing")}
          </Button>
          <Button type="button" onClick={() => onDone(false)}>
            {t("p8lst.laCancel")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * Operator Listings management (company/franchise/freelancer portals) —
 * the tenant's own catalog. What you publish here is what parents see in
 * Browse activities.
 */
export function ListingsApp() {
  const t = useT();
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const refresh = useCallback(() => {
    apiGet<Listing[]>("/api/listings?mine=1")
      .then(setListings)
      .catch((e) => setError(e instanceof Error ? e.message : t("p8lst.laLoadFailed")));
  }, []);

  useEffect(refresh, [refresh]);
  useRealtime(["listings", "blocks"], refresh);

  async function remove(l: Listing) {
    if (!confirm(t("p8lst.laDeleteConfirm", { name: l.name }))) return;
    try {
      await api(`/api/listings/${encodeURIComponent(l.id)}`, { method: "DELETE" });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("p8lst.laDeleteFailed"));
    }
  }

  if (error && !listings) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!listings)
    return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8lst.laLoading")}</div>;

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            {t("p8lst.laListings")}
          </h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">
            {t("p8lst.laSub")}
          </p>
        </div>
        {!draft && (
          <Button variant="primary" onClick={() => setDraft(EMPTY_DRAFT)}>
            + {t("p8lst.laNewListing")}
          </Button>
        )}
      </div>

      {error && <div className="mb-3 text-[12.5px] text-[var(--red)]">{error}</div>}

      {draft && (
        <div className="mb-4">
          <ListingForm
            draft={draft}
            onDone={(changed) => {
              setDraft(null);
              if (changed) refresh();
            }}
          />
        </div>
      )}

      {listings.length === 0 && !draft ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          {t("p8lst.laEmpty")}
        </Card>
      ) : (
        <div className="grid gap-3.5 lg:grid-cols-2">
          {listings.map((l) => (
            <Card key={l.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[15px] font-extrabold">{l.name}</div>
                <div className="flex gap-1.5">
                  <Button
                    sm
                    onClick={() =>
                      setDraft({
                        id: l.id,
                        name: l.name,
                        passes: l.passes.map((p) => ({ name: p.name, price: String(p.price) })),
                      })
                    }
                  >
                    {t("p8lst.laEdit")}
                  </Button>
                  <Button sm variant="danger" onClick={() => remove(l)}>
                    {t("p8lst.laDelete")}
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {l.passes.map((p) => (
                  <span
                    key={p.name}
                    className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-[3px] text-[11px] font-bold text-[var(--ink-2)]"
                  >
                    {p.name} · {money(p.price)}
                  </span>
                ))}
              </div>
              <SectionHead>{t("p8lst.laBlocks")}</SectionHead>
              {l.blocks.length === 0 ? (
                <div className="py-[3px] text-[12px] text-[var(--ink-3)]">
                  {t("p8lst.laNoBlocks")}
                </div>
              ) : (
                l.blocks.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between border-b border-dashed border-[var(--line)] py-[3px] text-[12.5px]"
                  >
                    <span>{b.name}</span>
                    <span className="text-[11px] font-bold text-[var(--ink-3)]">
                      {!b.open ? t("p8lst.laClosed") : t("p8lst.laFree", { left: b.spotsLeft, cap: b.capacity })}
                    </span>
                  </div>
                ))
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
