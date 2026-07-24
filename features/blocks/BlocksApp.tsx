"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api as apiCall, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Button, Card, FieldLabel, Input, Select } from "@/components/ui";
import { HowItWorks } from "@/components/HowItWorks";
import { PageHero } from "@/components/OperatorPage";
import * as blocksApi from "./blocksApi";
import type { ApiBundle, BundleInput } from "./blocksApi";

// ─────────────────────────────────────────────────────────────────────────
// Blocks — the build-manual's "Reusable scheduling patterns" builder.
//
// Periods (session time windows) → Passes (booking lengths) → Block Bundles
// (period+pass sets, kept in a searchable Block Library), each with a pricing
// calculator and "sent" to one or more listings. Fully backed by the API:
//   GET/POST/PUT/DELETE /api/periods
//   GET/POST/PUT/DELETE /api/passes
//   GET/POST/PUT/DELETE /api/block-bundles (+ /duplicate /archive /reorder /:id/listings)
// The pricing model lives server-side (spec §4): each bundle response carries a
// computed `resolved` (per-pass prices, per-timing prices, perDay) that this
// screen renders — the browser never re-derives prices. "Send to a listing"
// associates the bundle and snapshots the resolved pass prices onto the
// listing server-side; it does NOT materialise dated runs (that's POST
// /api/blocks). Deleting a period/pass cascades it out of every bundle.
// ─────────────────────────────────────────────────────────────────────────

interface Period {
  id: string;
  title: string;
  start: string; // "HH:MM" (24h)
  finish: string;
}
interface Pass {
  id: string;
  name: string;
  days: number;
  details?: string;
}
interface ResolvedPricing {
  passes: { id: string; name: string; days: number; price: number; details?: string }[];
  timings: Record<string, number>; // "{passId}_{periodId}" → price
  perDay: number;
}
interface Bundle {
  id: string;
  name: string;
  periodIds: string[];
  passIds: string[];
  listingIds: string[];
  order: number;
  archived: boolean;
  priced: boolean;
  masterPrice: number | null;
  calcOn: boolean;
  passFlat: Record<string, number>;
  passMode: Record<string, "flat">;
  periodPrice: Record<string, number>;
  resolved: ResolvedPricing;
}
interface Listing {
  id: string;
  name: string;
}
interface Draft {
  name: string;
  periodIds: string[];
  passIds: string[];
}

const EMPTY_DRAFT: Draft = { name: "", periodIds: [], passIds: [] };

// The writable half of a bundle (POST/PUT body — the server manages listingIds
// and order separately). Pricing edits merge over the current values.
interface BundleBody {
  name: string;
  periodIds: string[];
  passIds: string[];
  archived: boolean;
  priced: boolean;
  masterPrice: number | null;
  calcOn: boolean;
  passFlat: Record<string, number>;
  passMode: Record<string, "flat">;
  periodPrice: Record<string, number>;
}
function bundleBody(b: Bundle, over: Partial<BundleBody> = {}): BundleBody {
  return {
    name: b.name,
    periodIds: b.periodIds,
    passIds: b.passIds,
    archived: b.archived,
    priced: b.priced,
    masterPrice: b.masterPrice,
    calcOn: b.calcOn,
    passFlat: b.passFlat,
    passMode: b.passMode,
    periodPrice: b.periodPrice,
    ...over,
  };
}

// ── Formatting helpers (presentation only — pricing is server-side) ─────────
function to12h(t: string): string {
  const [hStr, m] = t.split(":");
  let h = parseInt(hStr, 10);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}
const periodRange = (p: Period) => `${to12h(p.start)}–${to12h(p.finish)}`;
const money = (n: number) => `£${(Math.round(n * 100) / 100).toFixed(2)}`;
const num = (v: string): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

// ── Manual chrome ──────────────────────────────────────────────────────────
function PaletteCard({
  title,
  meta,
  onAdd,
  onEdit,
  onRemove,
  onDragStart,
}: {
  title: string;
  meta: string;
  onAdd: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2"
    >
      <div className="min-w-0">
        <div className="truncate text-[12.5px] font-bold text-[var(--ink)]">{title}</div>
        <div className="truncate text-[11px] text-[var(--ink-3)]">{meta}</div>
      </div>
      <div className="flex flex-none items-center gap-1">
        <button
          type="button"
          onClick={onAdd}
          className="rounded-full border border-[var(--line)] px-2 py-[2px] text-[10.5px] font-bold text-[var(--brand-ink,#1d3a8f)] hover:border-[var(--brand)]"
        >
          + Add to block
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit"
          className="px-1 text-[12px] leading-none text-[var(--ink-3)] hover:text-[var(--brand)]"
        >
          ✎
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Delete"
          className="px-1 text-[13px] leading-none text-[var(--ink-3)] hover:text-[var(--red)]"
        >
          ×
        </button>
      </div>
    </div>
  );
}

const ARROW = (
  <div className="hidden select-none items-center justify-center px-1 text-[20px] text-[var(--ink-3)] lg:flex">
    →
  </div>
);

/** Blocks (freelancer) — the manual's reusable scheduling-pattern builder. */
export function BlocksApp() {
  const [periods, setPeriods] = useState<Period[] | null>(null);
  const [passes, setPasses] = useState<Pass[] | null>(null);
  const [bundles, setBundles] = useState<Bundle[] | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const refresh = useCallback(() => {
    Promise.all([
      apiGet<Period[]>("/api/periods"),
      apiGet<Pass[]>("/api/passes"),
      apiGet<Bundle[]>("/api/block-bundles"),
      apiGet<Listing[]>("/api/listings?mine=1"),
    ])
      .then(([p, q, b, l]) => {
        setPeriods(p);
        setPasses(q);
        setBundles(b);
        setListings(l.map((x) => ({ id: x.id, name: x.name })));
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load blocks"));
  }, []);

  useEffect(refresh, [refresh]);
  useRealtime(["periods", "passes", "blockBundles", "listings"], refresh);

  // Run a mutation, surface any error, then refetch. Returns whether it worked
  // so callers can clear local UI (e.g. the builder draft) only on success.
  const act = useCallback(
    async (fn: () => Promise<unknown>): Promise<boolean> => {
      try {
        await fn();
        refresh();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        return false;
      }
    },
    [refresh],
  );

  const loading = !periods || !passes || !bundles;

  return (
    // Light palette to match the build manual (mirrors the custdash light theme).
    // Full-bleed: cancel the wrapper's p-5, re-pad, fill viewport minus the header.
    <div
      className="-m-5 min-h-[calc(100vh-3.5rem)] p-5"
      style={
        {
          background: "var(--bg)",
          color: "var(--ink)",
          "--bg": "#f5f8fd",
          "--surface": "#ffffff",
          "--panel": "#fbf8fc",
          "--ink": "#171534",
          "--ink-2": "#4a4763",
          "--ink-3": "#8a86a3",
          "--line": "#ece6f1",
        } as React.CSSProperties
      }
    >
      <PageHero title="Sessions & blocks" lede="Reusable scheduling patterns" icon="🗓️" />

      {error && (
        <div className="mb-3 rounded-lg border border-[var(--red)] bg-[color-mix(in_srgb,var(--red)_8%,#ffffff)] px-3 py-2 text-[12.5px] text-[var(--red)]">
          {error}
        </div>
      )}

      <HowItWorks
        video="Periods, passes, building a block, and how the pricing calculator fills in the shorter passes."
        minutes="2 min"
      >
        <p className="mb-2">
          Build a scheduling pattern once and reuse it on every listing:{" "}
          <b className="text-[var(--ink-2)]">periods</b> are the time windows (early drop-off,
          standard day), <b className="text-[var(--ink-2)]">passes</b> are how long a parent books
          (one day, a full week).
        </p>
        <p>
          Add the ones you want to a block, name it, then set the price of the longest pass — every
          shorter pass and timing is worked out for you, and you can override any of them.
        </p>
      </HowItWorks>

      {loading ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : (
        <>
          {/* .blkFlow — 3 columns */}
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
            <PeriodsColumn periods={periods} draft={draft} setDraft={setDraft} act={act} />
            {ARROW}
            <PassesColumn passes={passes} draft={draft} setDraft={setDraft} act={act} />
            {ARROW}
            <BuildColumn
              periods={periods}
              passes={passes}
              draft={draft}
              setDraft={setDraft}
              act={act}
            />
          </div>

          <BlockLibrary
            bundles={bundles}
            periods={periods}
            passes={passes}
            listings={listings}
            act={act}
          />
        </>
      )}
    </div>
  );
}

type Act = (fn: () => Promise<unknown>) => Promise<boolean>;

// ── Column 1: Make your periods (add + edit) ───────────────────────────────
function PeriodsColumn({
  periods,
  draft,
  setDraft,
  act,
}: {
  periods: Period[];
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  act: Act;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("09:00");
  const [finish, setFinish] = useState("15:30");
  const [busy, setBusy] = useState(false);

  function reset() {
    setTitle("");
    setStart("09:00");
    setFinish("15:30");
    setEditingId(null);
  }
  function openEdit(p: Period) {
    setTitle(p.title);
    setStart(p.start);
    setFinish(p.finish);
    setEditingId(p.id);
    setOpen(true);
  }
  async function saveForm() {
    if (title.trim().length < 2 || start >= finish) return;
    const body = { title: title.trim(), start, finish };
    setBusy(true);
    const ok = await act(() =>
      editingId
        ? apiCall(`/api/periods/${encodeURIComponent(editingId)}`, {
            method: "PUT",
            body: JSON.stringify(body),
          })
        : apiPost("/api/periods", body),
    );
    setBusy(false);
    if (ok) {
      reset();
      setOpen(false);
    }
  }

  const addToDraft = (id: string) =>
    setDraft((d) =>
      d.periodIds.includes(id) ? d : { ...d, periodIds: [...d.periodIds, id] },
    );
  const removePeriod = (id: string) => {
    if (!confirm("Delete this period? It’s removed from any blocks using it. This can’t be undone."))
      return;
    setDraft((d) => ({ ...d, periodIds: d.periodIds.filter((x) => x !== id) }));
    void act(() => apiCall(`/api/periods/${encodeURIComponent(id)}`, { method: "DELETE" }));
  };

  return (
    <Card className="p-3.5" style={{ borderLeftWidth: "4px", borderLeftColor: "var(--brand)" }}>
      <StepHead n={1} title="Make your periods" />
      <p className="mb-2.5 text-[11.5px] text-[var(--ink-3)]">
        A period is a session time window. Title it anything — including extras like Early
        drop-off or Late pick-up. Timings drive the pricing calculator.
      </p>

      {open ? (
        <div className="mb-2.5 flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
            {editingId ? "Edit period" : "New period"}
          </div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Period title" className="w-full" />
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <FieldLabel>Start</FieldLabel>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-full" />
            </div>
            <div className="flex-1">
              <FieldLabel>Finish</FieldLabel>
              <Input type="time" value={finish} onChange={(e) => setFinish(e.target.value)} className="w-full" />
            </div>
          </div>
          {start >= finish && (
            <div className="text-[11px] text-[var(--red)]">Finish must be after start.</div>
          )}
          <div className="flex gap-2">
            <Button sm variant="primary" disabled={busy} onClick={saveForm}>
              {busy ? "Saving…" : editingId ? "Save period" : "Add period"}
            </Button>
            <Button
              sm
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          sm
          onClick={() => {
            reset();
            setOpen(true);
          }}
          className="mb-2.5"
        >
          + Add a period
        </Button>
      )}

      <div className="flex flex-col gap-1.5">
        {periods.map((p) => (
          <PaletteCard
            key={p.id}
            title={p.title}
            meta={periodRange(p)}
            onAdd={() => addToDraft(p.id)}
            onEdit={() => openEdit(p)}
            onRemove={() => removePeriod(p.id)}
            onDragStart={(e) => e.dataTransfer.setData("text/plain", `period:${p.id}`)}
          />
        ))}
      </div>
    </Card>
  );
}

// ── Column 2: Make your passes (add + edit) ────────────────────────────────
function PassesColumn({
  passes,
  draft,
  setDraft,
  act,
}: {
  passes: Pass[];
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  act: Act;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [days, setDays] = useState("1");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setName("");
    setDays("1");
    setDetails("");
    setEditingId(null);
  }
  function openEdit(p: Pass) {
    setName(p.name);
    setDays(String(p.days));
    setDetails(p.details ?? "");
    setEditingId(p.id);
    setOpen(true);
  }
  async function saveForm() {
    if (name.trim().length < 2) return;
    const body = { name: name.trim(), days: Math.max(1, parseInt(days, 10) || 1), details: details.trim() || undefined };
    setBusy(true);
    const ok = await act(() =>
      editingId
        ? apiCall(`/api/passes/${encodeURIComponent(editingId)}`, {
            method: "PUT",
            body: JSON.stringify(body),
          })
        : apiPost("/api/passes", body),
    );
    setBusy(false);
    if (ok) {
      reset();
      setOpen(false);
    }
  }

  const addToDraft = (id: string) =>
    setDraft((d) => (d.passIds.includes(id) ? d : { ...d, passIds: [...d.passIds, id] }));
  const removePass = (id: string) => {
    if (!confirm("Delete this pass? It’s removed from any blocks using it. This can’t be undone."))
      return;
    setDraft((d) => ({ ...d, passIds: d.passIds.filter((x) => x !== id) }));
    void act(() => apiCall(`/api/passes/${encodeURIComponent(id)}`, { method: "DELETE" }));
  };

  return (
    <Card className="p-3.5" style={{ borderLeftWidth: "4px", borderLeftColor: "var(--brand)" }}>
      <StepHead n={2} title="Make your passes" />
      <p className="mb-2.5 text-[11.5px] text-[var(--ink-3)]">
        A pass is simply the length of time a parent books — e.g. a single day or a full 5-day
        week. Pricing is worked out by the calculator.
      </p>

      {open ? (
        <div className="mb-2.5 flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
            {editingId ? "Edit pass" : "New pass"}
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pass name (e.g. 5-day week pass)"
            className="w-full"
          />
          <div>
            <FieldLabel>Details for customers <span className="font-normal text-[var(--ink-3)]">— optional, shown under the name</span></FieldLabel>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="What's included, who it suits, anything a parent should know before booking this pass…"
              rows={2}
              maxLength={500}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] outline-none"
            />
          </div>
          <div className="w-[120px]">
            <FieldLabel>Days</FieldLabel>
            <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} className="w-full" />
          </div>
          <div className="flex gap-2">
            <Button sm variant="primary" disabled={busy} onClick={saveForm}>
              {busy ? "Saving…" : editingId ? "Save pass" : "Add pass"}
            </Button>
            <Button
              sm
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          sm
          onClick={() => {
            reset();
            setOpen(true);
          }}
          className="mb-2.5"
        >
          + Add a pass
        </Button>
      )}

      <div className="flex flex-col gap-1.5">
        {passes.map((p) => (
          <PaletteCard
            key={p.id}
            title={p.name}
            meta={`${p.days} day${p.days === 1 ? "" : "s"}${p.details ? " · has details" : ""}`}
            onAdd={() => addToDraft(p.id)}
            onEdit={() => openEdit(p)}
            onRemove={() => removePass(p.id)}
            onDragStart={(e) => e.dataTransfer.setData("text/plain", `pass:${p.id}`)}
          />
        ))}
      </div>
    </Card>
  );
}

// ── Column 3: Build your blocks (drop zone + click-to-add) ─────────────────
function BuildColumn({
  periods,
  passes,
  draft,
  setDraft,
  act,
}: {
  periods: Period[];
  passes: Pass[];
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  act: Act;
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const draftPeriods = draft.periodIds
    .map((id) => periods.find((p) => p.id === id))
    .filter(Boolean) as Period[];
  const draftPasses = draft.passIds
    .map((id) => passes.find((p) => p.id === id))
    .filter(Boolean) as Pass[];
  const empty = draftPeriods.length === 0 && draftPasses.length === 0;

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    const [kind, id] = e.dataTransfer.getData("text/plain").split(":");
    if (!id) return;
    if (kind === "period")
      setDraft((d) =>
        d.periodIds.includes(id) ? d : { ...d, periodIds: [...d.periodIds, id] },
      );
    if (kind === "pass")
      setDraft((d) => (d.passIds.includes(id) ? d : { ...d, passIds: [...d.passIds, id] }));
  }

  const setName = (name: string) => setDraft((d) => ({ ...d, name }));
  const dropPeriod = (id: string) =>
    setDraft((d) => ({ ...d, periodIds: d.periodIds.filter((x) => x !== id) }));
  const dropPass = (id: string) =>
    setDraft((d) => ({ ...d, passIds: d.passIds.filter((x) => x !== id) }));

  async function moveToLibrary() {
    if (empty || busy) return;
    const body = {
      name: draft.name.trim() || "Untitled block",
      periodIds: draft.periodIds,
      passIds: draft.passIds,
    };
    setBusy(true);
    const ok = await act(() => apiPost<Bundle>("/api/block-bundles", body));
    setBusy(false);
    if (ok) setDraft(EMPTY_DRAFT);
  }

  return (
    <Card className="p-3.5" style={{ borderLeftWidth: "4px", borderLeftColor: "var(--brand)" }}>
      <StepHead n={3} title="Build your blocks" />
      <p className="mb-2.5 text-[11.5px] text-[var(--ink-3)]">
        Click “+ Add to block” on the periods &amp; passes you want, name it, then reuse or
        duplicate it across every listing.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className="mb-2.5 rounded-xl border-2 border-dashed p-3 transition-colors"
        style={{
          borderColor: over ? "var(--brand-2, #1d3a8f)" : "var(--line)",
          background: over ? "var(--brand-soft)" : "transparent",
        }}
      >
        {empty ? (
          <div className="py-4 text-center text-[12px] text-[var(--ink-3)]">
            Add periods &amp; passes here
            <div className="text-[11px]">tap “+ Add to block” on any card</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {draftPeriods.length > 0 && (
              <ChipRow label="Periods">
                {draftPeriods.map((p) => (
                  <Chip key={p.id} onRemove={() => dropPeriod(p.id)}>
                    {p.title} <span className="text-[var(--ink-3)]">{periodRange(p)}</span>
                  </Chip>
                ))}
              </ChipRow>
            )}
            {draftPasses.length > 0 && (
              <ChipRow label="Passes">
                {draftPasses.map((p) => (
                  <Chip key={p.id} onRemove={() => dropPass(p.id)}>
                    {p.name}
                  </Chip>
                ))}
              </ChipRow>
            )}
          </div>
        )}
      </div>

      <FieldLabel>Name your block</FieldLabel>
      <Input
        value={draft.name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Summer Multi Activity Camp — Loughton"
        className="mb-2.5 w-full"
      />

      <Button sm variant="primary" disabled={empty || busy} onClick={moveToLibrary}>
        {busy ? "Saving…" : "Move to Block Library →"}
      </Button>
    </Card>
  );
}

// ── Block Library ──────────────────────────────────────────────────────────
// Bright, distinct colour per block (cycled by position in the library).
const BLOCK_COLORS = [
  "#e22295", "#8b5cf6", "#6366f1", "#3b82f6", "#0ea5e9", "#14b8a6",
  "#22c55e", "#84cc16", "#f59e0b", "#f97316", "#ef4444", "#f43f5e",
];
// Stable colour per block (hash of id) so reordering never reshuffles colours.
function blockColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return BLOCK_COLORS[h % BLOCK_COLORS.length];
}

function BlockLibrary({
  bundles,
  periods,
  passes,
  listings,
  act,
}: {
  bundles: Bundle[];
  periods: Period[];
  passes: Pass[];
  listings: Listing[];
  act: Act;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  const q = query.trim().toLowerCase();
  const active = bundles.filter((b) => !b.archived);
  const archived = bundles.filter((b) => b.archived);
  const filtered = q ? active.filter((b) => b.name.toLowerCase().includes(q)) : active;

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(active.map((b) => b.id)));
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Drag-to-reorder within the library. Send the full ordered id list; the
  // server assigns `order` = position for each.
  const reorder = (draggedId: string, targetId: string) => {
    const ids = bundles.map((b) => b.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void act(() => apiPost("/api/block-bundles/reorder", { orderedIds: next }));
  };

  const unarchive = (id: string) =>
    void act(() => apiPost(`/api/block-bundles/${encodeURIComponent(id)}/archive`, { archived: false }));
  const deleteBlock = (id: string, name: string) => {
    if (!confirm(`Delete “${name}”? This can’t be undone.`)) return;
    void act(() => apiCall(`/api/block-bundles/${encodeURIComponent(id)}`, { method: "DELETE" }));
  };

  return (
    <div className="mt-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          Block Library
        </div>
        {active.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button sm onClick={expandAll}>
              ⊞ Expand all
            </Button>
            <Button sm onClick={collapseAll}>
              ⊟ Collapse all
            </Button>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="🔍  Search blocks…"
              className="w-[200px]"
            />
          </div>
        )}
      </div>
      <p className="mb-2.5 text-[12px] text-[var(--ink-3)]">
        Your finished blocks — drag the ⠿ handle to reorder. Sort out pricing with the calculator,
        then send a block to one or more of your listings.
      </p>

      {active.length === 0 ? (
        <Card className="p-5 text-center text-[12.5px] text-[var(--ink-3)]">
          {bundles.length === 0
            ? "No blocks yet — build one above and it lands here."
            : "No active blocks — they’re all archived (see below)."}
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-5 text-center text-[12.5px] text-[var(--ink-3)]">
          No blocks match “{query}”.
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((b) => (
            <LibraryCard
              key={b.id}
              block={b}
              periods={periods}
              passes={passes}
              listings={listings}
              act={act}
              color={blockColor(b.id)}
              expanded={!collapsed.has(b.id)}
              onToggle={() => toggle(b.id)}
              onDropBlock={(draggedId) => reorder(draggedId, b.id)}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]"
          >
            <span>{showArchived ? "▾" : "▸"}</span> Archived ({archived.length})
          </button>
          {showArchived && (
            <div className="mt-2 flex flex-col gap-1.5">
              {archived.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2"
                >
                  <span className="h-3 w-3 flex-none rounded-[4px]" style={{ background: blockColor(b.id) }} />
                  <span className="flex-1 truncate text-[13px] font-bold">{b.name}</span>
                  <Button sm onClick={() => unarchive(b.id)}>
                    Unarchive
                  </Button>
                  <Button sm variant="danger" onClick={() => deleteBlock(b.id, b.name)}>
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LibraryCard({
  block,
  periods,
  passes,
  listings,
  act,
  color,
  expanded,
  onToggle,
  onDropBlock,
}: {
  block: Bundle;
  periods: Period[];
  passes: Pass[];
  listings: Listing[];
  act: Act;
  color: string;
  expanded: boolean;
  onToggle: () => void;
  onDropBlock: (draggedId: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [tempName, setTempName] = useState(block.name);
  const [showCalc, setShowCalc] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [editing, setEditing] = useState(false);

  const blockPeriods = useMemo(
    () => block.periodIds.map((id) => periods.find((p) => p.id === id)).filter(Boolean) as Period[],
    [block.periodIds, periods],
  );
  const blockPasses = useMemo(
    () => block.passIds.map((id) => passes.find((p) => p.id === id)).filter(Boolean) as Pass[],
    [block.passIds, passes],
  );
  const inListings = block.listingIds
    .map((id) => listings.find((l) => l.id === id))
    .filter(Boolean) as Listing[];
  const available = listings.filter((l) => !block.listingIds.includes(l.id));

  // Every structural edit PUTs the whole bundle (server keeps listingIds/order).
  const putBundle = (over: Partial<BundleBody>) =>
    act(() =>
      apiCall(`/api/block-bundles/${encodeURIComponent(block.id)}`, {
        method: "PUT",
        body: JSON.stringify(bundleBody(block, over)),
      }),
    );

  const saveName = () => {
    const name = tempName.trim();
    if (name && name !== block.name) void putBundle({ name });
    setRenaming(false);
  };
  const setListingIds = (listingIds: string[]) =>
    act(() =>
      apiCall(`/api/block-bundles/${encodeURIComponent(block.id)}/listings`, {
        method: "PUT",
        body: JSON.stringify({ listingIds }),
      }),
    );
  const addListing = (id: string) =>
    block.listingIds.includes(id) ? undefined : void setListingIds([...block.listingIds, id]);
  const removeListing = (id: string) =>
    void setListingIds(block.listingIds.filter((x) => x !== id));
  const addPeriod = (pid: string) =>
    block.periodIds.includes(pid) ? undefined : void putBundle({ periodIds: [...block.periodIds, pid] });
  const removePeriodFromBlock = (pid: string) =>
    void putBundle({ periodIds: block.periodIds.filter((x) => x !== pid) });
  const addPass = (pid: string) =>
    block.passIds.includes(pid) ? undefined : void putBundle({ passIds: [...block.passIds, pid] });
  const removePassFromBlock = (pid: string) =>
    void putBundle({ passIds: block.passIds.filter((x) => x !== pid) });
  const availablePeriods = periods.filter((p) => !block.periodIds.includes(p.id));
  const availablePasses = passes.filter((p) => !block.passIds.includes(p.id));

  const duplicate = () =>
    void act(() => apiPost(`/api/block-bundles/${encodeURIComponent(block.id)}/duplicate`, {}));
  const archive = () =>
    void act(() => apiPost(`/api/block-bundles/${encodeURIComponent(block.id)}/archive`, { archived: true }));
  const remove = () => {
    if (!confirm(`Delete “${block.name}”? This can’t be undone.`)) return;
    void act(() => apiCall(`/api/block-bundles/${encodeURIComponent(block.id)}`, { method: "DELETE" }));
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false);
        const [kind, id] = e.dataTransfer.getData("text/plain").split(":");
        if (kind === "block" && id) onDropBlock(id);
      }}
      className="overflow-hidden rounded-xl border p-3.5"
      style={{
        borderColor: dragOver ? color : "var(--line)",
        background: "#ffffff",
        boxShadow: dragOver ? `0 0 0 2px ${color}` : undefined,
      }}
    >
      {/* Featured gradient header — matches the Money "at a glance" card. */}
      <div className="-mx-3.5 -mt-3.5 mb-3 px-3.5 py-2.5 text-white" style={{ background: "radial-gradient(120% 140% at 12% -20%, #4f8bf5 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#3f78d8 100%)" }}>
      <div className="flex items-start justify-between gap-2">
        {renaming ? (
          <div className="flex flex-1 items-center gap-1.5">
            <Input
              autoFocus
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              className="flex-1"
            />
            <Button sm variant="primary" onClick={saveName}>
              Save
            </Button>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", `block:${block.id}`)}
              title="Drag to reorder"
              className="flex-none cursor-grab text-[14px] leading-none text-white/60 active:cursor-grabbing"
            >
              ⠿
            </span>
            <span className="h-3.5 w-3.5 flex-none rounded-[5px]" style={{ background: color }} />
            <button
              type="button"
              onClick={onToggle}
              className="truncate text-left text-[14px] font-extrabold text-white"
            >
              {block.name}
            </button>
            <button
              type="button"
              onClick={() => {
                setTempName(block.name);
                setRenaming(true);
              }}
              aria-label="Rename block"
              className="flex-none text-[12px] text-white/70 hover:text-white"
            >
              ✎
            </button>
          </div>
        )}
        <div className="flex flex-none items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-[2px] text-[10px] font-bold ${
              block.priced
                ? "bg-white text-[#1d3a8f]"
                : "bg-white/20 text-white"
            }`}
          >
            {block.priced ? "Priced" : "Unpriced"}
          </span>
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? "Collapse" : "Expand"}
            className="text-[11px] text-white/70 hover:text-white"
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>
      <div className="mt-0.5 text-[11.5px] text-white/80">
        {blockPeriods.length} period{blockPeriods.length === 1 ? "" : "s"} · {blockPasses.length} pass
        {blockPasses.length === 1 ? "" : "es"}
      </div>
      </div>

      {expanded && (
        <>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
                Periods
              </div>
              {editing ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {blockPeriods.map((p) => (
                    <Chip key={p.id} onRemove={() => removePeriodFromBlock(p.id)}>
                      {p.title}
                    </Chip>
                  ))}
                  {availablePeriods.length > 0 && (
                    <Select
                      value=""
                      onChange={(e) => e.target.value && addPeriod(e.target.value)}
                      className="h-[26px] py-0 text-[11px]"
                    >
                      <option value="">+ Add period…</option>
                      {availablePeriods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              ) : (
                <div className="text-[12px] text-[var(--ink-2)]">
                  {blockPeriods.length ? (
                    blockPeriods.map((p) => (
                      <div key={p.id}>
                        {p.title} <span className="text-[var(--ink-3)]">{periodRange(p)}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-[var(--ink-3)]">—</span>
                  )}
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
                Passes
              </div>
              {editing ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {blockPasses.map((p) => (
                    <Chip key={p.id} onRemove={() => removePassFromBlock(p.id)}>
                      {p.name}
                    </Chip>
                  ))}
                  {availablePasses.length > 0 && (
                    <Select
                      value=""
                      onChange={(e) => e.target.value && addPass(e.target.value)}
                      className="h-[26px] py-0 text-[11px]"
                    >
                      <option value="">+ Add pass…</option>
                      {availablePasses.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              ) : (
                <div className="text-[12px] text-[var(--ink-2)]">
                  {blockPasses.length ? (
                    blockPasses.map((p) => p.name).join(" · ")
                  ) : (
                    <span className="text-[var(--ink-3)]">—</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {showCalc && (
            <PricingCalculator block={block} periods={blockPeriods} onSavePricing={putBundle} />
          )}

          {/* Send to listings */}
          <div className="mt-2.5">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
              Sent to listings
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {inListings.length ? (
                inListings.map((l) => (
                  <Chip key={l.id} onRemove={() => removeListing(l.id)}>
                    {l.name}
                  </Chip>
                ))
              ) : (
                <span className="text-[11.5px] text-[var(--ink-3)]">Not sent to any listing yet.</span>
              )}
              {available.length > 0 && (
                <Select
                  value=""
                  onChange={(e) => e.target.value && addListing(e.target.value)}
                  className="cursor-pointer py-0 text-[11.5px] font-bold"
                  style={{
                    height: 30,
                    borderRadius: 999,
                    borderColor: "var(--brand-line, #cdddf7)",
                    background: "var(--brand-soft)",
                    color: "var(--brand-ink)",
                    paddingLeft: 12,
                    paddingRight: 10,
                  }}
                >
                  <option value="">📩  Send to a listing…</option>
                  {available.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            {inListings.length > 0 && !block.priced && (
              <div className="mt-1 text-[11px] text-[var(--ink-3)]">
                Sort pricing to push pass prices to these listings.
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button sm variant={showCalc ? "primary" : "default"} onClick={() => setShowCalc((v) => !v)}>
              {showCalc ? "Close pricing" : "Sort pricing"}
            </Button>
            <Button sm variant={editing ? "primary" : "default"} onClick={() => setEditing((v) => !v)}>
              {editing ? "Done" : "Edit"}
            </Button>
            <Button sm onClick={duplicate}>
              Duplicate
            </Button>
            <Button sm onClick={archive}>
              Archive
            </Button>
            <Button sm variant="danger" onClick={remove}>
              Delete
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Pricing calculator ─────────────────────────────────────────────────────
// The operator sets the inputs (master price, per-pass/per-timing overrides,
// auto-calc on/off); the derived numbers come from the server's `resolved`
// pricing (spec §4). Editing is local; "Save pricing" PUTs the bundle and the
// server returns freshly-resolved prices.
function PricingCalculator({
  block,
  periods,
  onSavePricing,
}: {
  block: Bundle;
  periods: Period[];
  onSavePricing: (over: Partial<BundleBody>) => Promise<boolean>;
}) {
  const [openPass, setOpenPass] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [masterPrice, setMasterPrice] = useState(
    block.masterPrice != null ? String(block.masterPrice) : "",
  );
  const [calcOn, setCalcOn] = useState(block.calcOn !== false);
  const [passFlat, setPassFlat] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(block.passFlat).map(([k, v]) => [k, String(v)])),
  );
  const [passMode, setPassMode] = useState<Record<string, "flat">>(() => ({ ...block.passMode }));
  const [periodPrice, setPeriodPriceState] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(block.periodPrice).map(([k, v]) => [k, String(v)])),
  );

  // Ordered pass list with server-resolved prices (days DESC; first is master).
  const passes = block.resolved.passes;
  const resolvedTiming = (passId: string, periodId: string) =>
    block.resolved.timings[`${passId}_${periodId}`] ?? 0;
  // Timing rows: the block's periods, ordered by start (matches the palette).
  const timingRows = useMemo(
    () => [...periods].sort((a, b) => (a.start < b.start ? -1 : 1)),
    [periods],
  );

  const setFlat = (passId: string, v: string) => {
    setPassFlat((m) => ({ ...m, [passId]: v }));
    setPassMode((m) => ({ ...m, [passId]: "flat" }));
  };
  const resetPass = (passId: string) => {
    setPassFlat((m) => {
      const next = { ...m };
      delete next[passId];
      return next;
    });
    setPassMode((m) => {
      const next = { ...m };
      delete next[passId];
      return next;
    });
  };
  const setPeriodPrice = (key: string, v: string) =>
    setPeriodPriceState((m) => ({ ...m, [key]: v }));
  const resetPeriodPrice = (key: string) =>
    setPeriodPriceState((m) => {
      const next = { ...m };
      delete next[key];
      return next;
    });

  async function save() {
    const master = masterPrice.trim() === "" ? null : num(masterPrice);
    const flat = Object.fromEntries(Object.entries(passFlat).map(([k, v]) => [k, num(v)]));
    const timings = Object.fromEntries(Object.entries(periodPrice).map(([k, v]) => [k, num(v)]));
    const priced = (master ?? 0) > 0 || Object.values(flat).some((v) => v > 0);
    setBusy(true);
    await onSavePricing({
      masterPrice: master,
      calcOn,
      passFlat: flat,
      passMode,
      periodPrice: timings,
      priced,
    });
    setBusy(false);
  }

  // Display price for a pass row: master + flat overrides are what the operator
  // typed (local); auto rows show the server-resolved price.
  const passDisplayPrice = (passId: string, idx: number, resolvedPrice: number): number => {
    if (idx === 0) return num(masterPrice);
    if (passMode[passId] === "flat") return num(passFlat[passId] ?? "0");
    return resolvedPrice;
  };

  return (
    <div className="mt-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[13px] font-extrabold">💷 Pricing calculator</span>
        <button
          type="button"
          onClick={() => setCalcOn((v) => !v)}
          role="switch"
          aria-checked={calcOn}
          className="relative h-[18px] w-[32px] rounded-full transition-colors"
          style={{ background: calcOn ? "var(--brand)" : "var(--line)" }}
        >
          <span
            className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all"
            style={{ left: calcOn ? "16px" : "2px" }}
          />
        </button>
        <span className="text-[11px] text-[var(--ink-3)]">Auto-calculate {calcOn ? "on" : "off"}</span>
      </div>
      <p className="mb-2 text-[11px] text-[var(--ink-3)]">
        {calcOn
          ? "Set the full price for the longest pass — shorter passes and each timing are calculated. Edit any to override, then Save pricing."
          : "Auto-calc is off — set each price by hand, then Save pricing."}
      </p>

      {passes.length === 0 ? (
        <div className="text-[11.5px] text-[var(--ink-3)]">Add passes to price them.</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {passes.map((q, idx) => {
            const isM = idx === 0;
            const isFlat = passMode[q.id] === "flat";
            const price = passDisplayPrice(q.id, idx, q.price);
            const open = openPass === q.id;
            return (
              <div key={q.id} className="overflow-hidden rounded-lg border border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setOpenPass(open ? null : q.id)}
                  className="flex w-full items-center gap-2 bg-[var(--panel)] px-2.5 py-1.5 text-left"
                >
                  <span className="text-[13px] font-extrabold">{q.name}</span>
                  <span className="text-[11px] text-[var(--ink-3)]">
                    {q.days} {q.days > 1 ? "days" : "day"}
                    {isM ? " · longest" : ""}
                  </span>
                  <span className="ml-auto text-[13px] font-extrabold">{money(price || 0)}</span>
                  <span className="text-[var(--ink-3)]">{open ? "▲" : "▼"}</span>
                </button>

                {open && (
                  <div className="border-t border-[var(--line)] p-2.5">
                    <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
                      Timings &amp; prices
                    </div>
                    {timingRows.length === 0 ? (
                      <div className="text-[11px] text-[var(--ink-3)]">No timings on this block yet.</div>
                    ) : (
                      timingRows.map((p) => {
                        const key = `${q.id}_${p.id}`;
                        const ovStr = periodPrice[key];
                        const calc = resolvedTiming(q.id, p.id);
                        const inputVal =
                          ovStr !== undefined ? ovStr : calcOn && calc ? calc.toFixed(2) : "";
                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-2 border-t border-dashed border-[var(--line)] py-1.5 first:border-t-0"
                          >
                            <div className="flex-1">
                              <div className="text-[12px] font-bold">{p.title}</div>
                              <div className="text-[10.5px] text-[var(--ink-3)]">{periodRange(p)}</div>
                            </div>
                            <span className="font-extrabold">£</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={inputVal}
                              onChange={(e) => setPeriodPrice(key, e.target.value)}
                              className="w-[84px]"
                            />
                            {ovStr !== undefined && calcOn && (
                              <button
                                type="button"
                                title="Reset to calculated"
                                onClick={() => resetPeriodPrice(key)}
                                className="text-[14px] font-bold text-[var(--brand)]"
                              >
                                ↺
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}

                    <div className="mt-2 rounded-lg bg-[var(--panel)] p-2">
                      {isM ? (
                        <>
                          <label className="text-[11px] font-bold text-[var(--ink-3)]">
                            Price for this (longest) pass — the rest calculate from it
                          </label>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="font-extrabold">£</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={masterPrice}
                              onChange={(e) => setMasterPrice(e.target.value)}
                              placeholder="0.00"
                              className="w-[120px]"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <label className="text-[11px] font-bold text-[var(--ink-3)]">
                            Full price{isFlat ? " (edited)" : " (calculated — edit if you like)"}
                          </label>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="font-extrabold">£</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={isFlat ? passFlat[q.id] ?? "" : price.toFixed(2)}
                              onChange={(e) => setFlat(q.id, e.target.value)}
                              className="w-[110px]"
                            />
                            {isFlat && (
                              <button
                                type="button"
                                onClick={() => resetPass(q.id)}
                                className="text-[11px] font-bold text-[var(--brand)]"
                              >
                                ↺ reset to calculated
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        <Button sm variant="primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save pricing"}
        </Button>
        {calcOn && block.resolved.perDay > 0 && (
          <span className="text-[11px] text-[var(--ink-3)]">
            Per-day rate {money(block.resolved.perDay)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Small shared bits ──────────────────────────────────────────────────────
function StepHead({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <span
        className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[12px] font-extrabold text-white"
        style={{ background: "var(--brand)" }}
      >
        {n}
      </span>
      <span className="text-[14px] font-extrabold">{title}</span>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-[3px] text-[11.5px] font-semibold text-[var(--ink-2)]">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="text-[var(--ink-3)] hover:text-[var(--red)]"
      >
        ×
      </button>
    </span>
  );
}
