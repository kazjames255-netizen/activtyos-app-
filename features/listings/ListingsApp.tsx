"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Button, Card, FieldLabel, Input, SectionHead } from "@/components/ui";

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
  const [d, setD] = useState(draft);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    const passes = d.passes
      .filter((p) => p.name.trim())
      .map((p) => ({ name: p.name.trim(), price: parseFloat(p.price) || 0 }));
    if (!d.name.trim() || !passes.length) {
      setError("A listing needs a name and at least one pass.");
      return;
    }
    setBusy(true);
    try {
      const body = { name: d.name.trim(), passes };
      if (d.id) await api(`/api/listings/${encodeURIComponent(d.id)}`, { method: "PUT", body: JSON.stringify(body) });
      else await apiPost("/api/listings", body);
      onDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setBusy(false);
    }
  }

  const upd = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));

  return (
    <Card className="p-4">
      <div className="mb-3 text-[15px] font-extrabold">
        {d.id ? "Edit listing" : "New listing"}
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <FieldLabel>Listing name</FieldLabel>
          <Input
            value={d.name}
            onChange={(e) => upd({ name: e.target.value })}
            placeholder="e.g. Summer Holiday Camp 2027"
            className="w-full"
          />
        </div>

        <div>
          <FieldLabel>Passes &amp; prices</FieldLabel>
          {d.passes.map((p, i) => (
            <div key={i} className="mb-1.5 flex gap-1.5">
              <Input
                value={p.name}
                onChange={(e) =>
                  upd({ passes: d.passes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })
                }
                placeholder="Pass name (e.g. 5-day week pass)"
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
            + Add pass
          </Button>
        </div>

        <div className="text-[11.5px] text-[var(--ink-3)]">
          Blocks (dates, capacity &amp; sessions) are managed in{" "}
          <b>Sessions &amp; blocks</b> — via the Blocks API until that page ships.
        </div>

        {error && <div className="text-[12.5px] text-[var(--red)]">{error}</div>}
        <div className="flex gap-2">
          <Button variant="primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : d.id ? "Save changes" : "Create listing"}
          </Button>
          <Button type="button" onClick={() => onDone(false)}>
            Cancel
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
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const refresh = useCallback(() => {
    apiGet<Listing[]>("/api/listings?mine=1")
      .then(setListings)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load listings"));
  }, []);

  useEffect(refresh, [refresh]);
  useRealtime(["listings", "blocks"], refresh);

  async function remove(l: Listing) {
    if (!confirm(`Delete "${l.name}"? Parents will no longer be able to book it.`)) return;
    try {
      await api(`/api/listings/${encodeURIComponent(l.id)}`, { method: "DELETE" });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  if (error && !listings) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!listings)
    return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading listings…</div>;

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            Listings
          </h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">
            Your bookable activities — what parents see in Browse &amp; book.
          </p>
        </div>
        {!draft && (
          <Button variant="primary" onClick={() => setDraft(EMPTY_DRAFT)}>
            + New listing
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
          No listings yet — create your first one and it appears instantly in
          the parents&apos; Browse page.
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
                    Edit
                  </Button>
                  <Button sm variant="danger" onClick={() => remove(l)}>
                    Delete
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
              <SectionHead>Blocks</SectionHead>
              {l.blocks.length === 0 ? (
                <div className="py-[3px] text-[12px] text-[var(--ink-3)]">
                  No blocks yet — parents can’t book until one exists (Blocks API).
                </div>
              ) : (
                l.blocks.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between border-b border-dashed border-[var(--line)] py-[3px] text-[12.5px]"
                  >
                    <span>{b.name}</span>
                    <span className="text-[11px] font-bold text-[var(--ink-3)]">
                      {!b.open ? "closed" : `${b.spotsLeft}/${b.capacity} free`}
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
