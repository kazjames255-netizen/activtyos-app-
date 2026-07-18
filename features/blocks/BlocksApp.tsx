"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { Button, Card, FieldLabel, Input, Select } from "@/components/ui";
import * as blocksApi from "./blocksApi";
import type { ApiBundle, BundleInput } from "./blocksApi";

// ─────────────────────────────────────────────────────────────────────────
// Blocks — the build-manual's "Reusable scheduling patterns" builder.
//
// Server-backed: periods, passes and block bundles live in the API
// (server/src/routes/blockBundles.ts), which is also the source of truth for
// pricing — every bundle comes back with a `resolved` block computed by
// server/src/lib/bundlePricing.ts. The local calculator mirrors that formula
// purely as a live preview while you type; what's saved is what the server
// resolves. The draft block being assembled in step 3 is local until saved.
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
}
interface LibraryBlock {
  id: string;
  name: string;
  periodIds: string[];
  passIds: string[];
  listingIds: string[]; // may be sent to several listings
  archived?: boolean;
  priced: boolean;
  // Pricing (mirrors the manual): masterPrice = full price of the LONGEST pass.
  masterPrice?: number;
  calcOn?: boolean; // auto-calculate (default true)
  passFlat?: Record<string, number>; // per-pass overrides
  passMode?: Record<string, "flat">; // which passes are overridden
  periodPrice?: Record<string, number>; // key `${passId}_${periodId}` overrides
}
interface Draft {
  id: string | null;
  name: string;
  periodIds: string[];
  passIds: string[];
}
interface BuilderState {
  periods: Period[];
  passes: Pass[];
  library: LibraryBlock[];
  draft: Draft;
}

interface Listing {
  id: string;
  name: string;
}

/** Server-backed writes. Each re-reads the library so pricing stays authoritative. */
interface Actions {
  savePeriod: (id: string | null, fields: Omit<Period, "id">) => Promise<void>;
  deletePeriod: (id: string) => Promise<void>;
  savePass: (id: string | null, fields: Omit<Pass, "id">) => Promise<void>;
  deletePass: (id: string) => Promise<void>;
  createBundle: (b: LibraryBlock) => Promise<void>;
  saveBundle: (b: LibraryBlock) => Promise<void>;
  deleteBundle: (id: string) => Promise<void>;
  duplicateBundle: (id: string) => Promise<void>;
  archiveBundle: (id: string, archived: boolean) => Promise<void>;
  reorderBundles: (orderedIds: string[]) => Promise<void>;
  sendToListings: (id: string, listingIds: string[]) => Promise<void>;
  queueBundleSave: (b: LibraryBlock) => void;
}

const EMPTY_DRAFT: Draft = { id: null, name: "", periodIds: [], passIds: [] };

// ── API ⇄ UI mapping ────────────────────────────────────────────────────────
// The server's bundle shape is the UI's LibraryBlock plus `order`/`resolved`;
// the only real differences are nullable masterPrice and a required `archived`.
function toLibraryBlock(b: ApiBundle): LibraryBlock {
  return {
    id: b.id,
    name: b.name,
    periodIds: b.periodIds,
    passIds: b.passIds,
    listingIds: b.listingIds,
    archived: b.archived,
    priced: b.priced,
    masterPrice: b.masterPrice ?? undefined,
    calcOn: b.calcOn,
    passFlat: b.passFlat,
    passMode: b.passMode,
    periodPrice: b.periodPrice,
  };
}
function toBundleInput(b: LibraryBlock): BundleInput {
  return {
    name: b.name.trim() || "Untitled block",
    periodIds: b.periodIds,
    passIds: b.passIds,
    archived: !!b.archived,
    priced: b.priced,
    masterPrice: b.masterPrice ?? null,
    calcOn: b.calcOn !== false,
    passFlat: b.passFlat ?? {},
    passMode: (b.passMode ?? {}) as Record<string, "flat">,
    periodPrice: b.periodPrice ?? {},
  };
}

// ── Formatting + pricing helpers (mirror the manual) ───────────────────────
function to12h(t: string): string {
  const [hStr, m] = t.split(":");
  let h = parseInt(hStr, 10);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}
const periodRange = (p: Period) => `${to12h(p.start)}–${to12h(p.finish)}`;
const money = (n: number) => `£${(Math.round(n * 100) / 100).toFixed(2)}`;
const blkMins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const blkHours = (p: Period) => {
  const d = (blkMins(p.finish) - blkMins(p.start)) / 60;
  return d > 0 ? d : 1;
};
const blkBaseHours = (periods: Period[]) =>
  periods.length ? Math.max(...periods.map(blkHours)) : 1;

// ── Manual chrome ──────────────────────────────────────────────────────────
function PhaseBadge() {
  return (
    <span
      className="inline-flex items-center rounded-md border px-[7px] py-[2px] text-[10px] font-extrabold uppercase leading-[1.5] tracking-[0.3px]"
      style={{ background: "#fbe9cf", borderColor: "#f3d4a3", color: "#9a5a00" }}
    >
      Phase 1
    </span>
  );
}

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
  const [state, setState] = useState<BuilderState | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(0);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const patch = useCallback((fn: (s: BuilderState) => BuilderState) => {
    setState((prev) => (prev ? fn(prev) : prev));
  }, []);

  // Pull the whole library from the server; keeps the in-progress draft.
  const refresh = useCallback(async () => {
    const [periods, passes, bundles] = await Promise.all([
      blocksApi.listPeriods(),
      blocksApi.listPasses(),
      blocksApi.listBundles(),
    ]);
    setState((prev) => ({
      periods,
      passes,
      library: bundles.map(toLibraryBlock),
      draft: prev?.draft ?? EMPTY_DRAFT,
    }));
  }, []);

  // Run a server write, then re-read so `resolved` pricing stays authoritative.
  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setSaving((n) => n + 1);
      try {
        await fn();
        await refresh();
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong saving that.");
        await refresh().catch(() => {});
      } finally {
        setSaving((n) => n - 1);
      }
    },
    [refresh],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await refresh();
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Couldn't load your blocks.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);
  useEffect(() => {
    apiGet<Listing[]>("/api/listings?mine=1")
      .then((ls) => {
        setListings(ls.map((l) => ({ id: l.id, name: l.name })));
        setListingsError(null);
      })
      // Don't fail silently — without listings the "Send to a listing" control
      // can't render, and the operator needs to know why.
      .catch((e) => {
        setListings([]);
        setListingsError(e instanceof Error ? e.message : "Couldn't load your listings.");
      });
  }, []);
  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  const actions: Actions = useMemo(
    () => ({
      savePeriod: (id, f) => run(() => (id ? blocksApi.updatePeriod(id, f) : blocksApi.createPeriod(f))),
      deletePeriod: (id) => run(() => blocksApi.deletePeriod(id)),
      savePass: (id, f) => run(() => (id ? blocksApi.updatePass(id, f) : blocksApi.createPass(f))),
      deletePass: (id) => run(() => blocksApi.deletePass(id)),
      createBundle: (b) => run(() => blocksApi.createBundle(toBundleInput(b))),
      saveBundle: (b) => run(() => blocksApi.updateBundle(b.id, toBundleInput(b))),
      deleteBundle: (id) => run(() => blocksApi.deleteBundle(id)),
      duplicateBundle: (id) => run(() => blocksApi.duplicateBundle(id)),
      archiveBundle: (id, archived) => run(() => blocksApi.archiveBundle(id, archived)),
      reorderBundles: (ids) => run(() => blocksApi.reorderBundles(ids)),
      sendToListings: (id, listingIds) => run(() => blocksApi.sendBundleToListings(id, listingIds)),
      // Typing in the pricing calculator updates locally on every keystroke;
      // the write is debounced so we don't PUT per character.
      queueBundleSave: (b) => {
        clearTimeout(timers.current[b.id]);
        timers.current[b.id] = setTimeout(() => {
          void run(() => blocksApi.updateBundle(b.id, toBundleInput(b)));
        }, 600);
      },
    }),
    [run],
  );

  if (!state)
    return (
      <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">
        {error ? <span style={{ color: "#b91c1c" }}>{error}</span> : "Loading…"}
      </div>
    );

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
      {/* .phead */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[20px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            Blocks
          </h2>
          <p className="text-[13px] text-[var(--ink-3)]">Reusable scheduling patterns</p>
        </div>
        <PhaseBadge />
      </div>

      {/* How it works (the single explanation) */}
      <Card className="mb-3.5 p-4" style={{ borderLeftWidth: "4px", borderLeftColor: "var(--brand)" }}>
        <h3 className="text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          How it works
        </h3>
        <p className="mt-1 text-[13px] text-[var(--ink-3)]">
          Build your reusable scheduling patterns once, then reuse them across every listing:
        </p>
        <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-[12.5px] text-[var(--ink-2)]">
          <li>
            <b className="text-[var(--ink)]">Make your periods</b> — the session time windows
            (Early drop-off, Standard day, Late pick-up…).
          </li>
          <li>
            <b className="text-[var(--ink)]">Make your passes</b> — how long a parent books (a
            single day, a full 5-day week).
          </li>
          <li>
            <b className="text-[var(--ink)]">Build a block</b> — click{" "}
            <b className="text-[var(--ink)]">+ Add to block</b> on the periods &amp; passes you
            want, name it, and move it to your Block Library.
          </li>
          <li>
            <b className="text-[var(--ink)]">Sort pricing</b> — set the full price for the longest
            pass; the shorter passes and each timing are calculated for you (edit any to override).
          </li>
          <li>
            <b className="text-[var(--ink)]">Send to a listing</b> — reuse or duplicate the same
            block across every listing.
          </li>
        </ol>
      </Card>

      {/* Sync status — everything here saves to your account, not this browser. */}
      {(error || saving > 0) && (
        <div
          className="mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px]"
          style={
            error
              ? { borderColor: "#f4c7c7", background: "#fdf2f2", color: "#b91c1c" }
              : { borderColor: "var(--line)", background: "var(--panel)", color: "var(--ink-3)" }
          }
        >
          {error ? (
            <>
              <span>⚠</span>
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => setError(null)} className="font-bold">
                Dismiss
              </button>
            </>
          ) : (
            <>
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--brand)]" />
              <span>Saving…</span>
            </>
          )}
        </div>
      )}

      {/* .blkFlow — 3 columns */}
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <PeriodsColumn state={state} patch={patch} actions={actions} />
        {ARROW}
        <PassesColumn state={state} patch={patch} actions={actions} />
        {ARROW}
        <BuildColumn state={state} patch={patch} actions={actions} />
      </div>

      <BlockLibrary state={state} patch={patch} actions={actions} listings={listings} listingsError={listingsError} />
    </div>
  );
}

// ── Column 1: Make your periods (add + edit) ───────────────────────────────
function PeriodsColumn({
  state,
  patch,
  actions,
}: {
  state: BuilderState;
  patch: (fn: (s: BuilderState) => BuilderState) => void;
  actions: Actions;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("09:00");
  const [finish, setFinish] = useState("15:30");

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
  function saveForm() {
    if (title.trim().length < 2) return;
    void actions.savePeriod(editingId, { title: title.trim(), start, finish });
    reset();
    setOpen(false);
  }

  const addToDraft = (id: string) =>
    patch((s) =>
      s.draft.periodIds.includes(id)
        ? s
        : { ...s, draft: { ...s.draft, periodIds: [...s.draft.periodIds, id] } },
    );
  const removePeriod = (id: string) => {
    if (!confirm("Delete this period? It’s removed from any blocks using it. This can’t be undone."))
      return;
    // Drop it from the local draft too; the server detaches it from bundles.
    patch((s) => ({ ...s, draft: { ...s.draft, periodIds: s.draft.periodIds.filter((x) => x !== id) } }));
    void actions.deletePeriod(id);
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
          <div className="flex gap-2">
            <Button sm variant="primary" onClick={saveForm}>
              {editingId ? "Save period" : "Add period"}
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
        {state.periods.map((p) => (
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
  state,
  patch,
  actions,
}: {
  state: BuilderState;
  patch: (fn: (s: BuilderState) => BuilderState) => void;
  actions: Actions;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [days, setDays] = useState("1");

  function reset() {
    setName("");
    setDays("1");
    setEditingId(null);
  }
  function openEdit(p: Pass) {
    setName(p.name);
    setDays(String(p.days));
    setEditingId(p.id);
    setOpen(true);
  }
  function saveForm() {
    if (name.trim().length < 2) return;
    void actions.savePass(editingId, { name: name.trim(), days: Math.max(1, parseInt(days, 10) || 1) });
    reset();
    setOpen(false);
  }

  const addToDraft = (id: string) =>
    patch((s) =>
      s.draft.passIds.includes(id)
        ? s
        : { ...s, draft: { ...s.draft, passIds: [...s.draft.passIds, id] } },
    );
  const removePass = (id: string) => {
    if (!confirm("Delete this pass? It’s removed from any blocks using it. This can’t be undone."))
      return;
    patch((s) => ({ ...s, draft: { ...s.draft, passIds: s.draft.passIds.filter((x) => x !== id) } }));
    void actions.deletePass(id);
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
          <div className="w-[120px]">
            <FieldLabel>Days</FieldLabel>
            <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} className="w-full" />
          </div>
          <div className="flex gap-2">
            <Button sm variant="primary" onClick={saveForm}>
              {editingId ? "Save pass" : "Add pass"}
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
        {state.passes.map((p) => (
          <PaletteCard
            key={p.id}
            title={p.name}
            meta={`${p.days} day${p.days === 1 ? "" : "s"}`}
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
  state,
  patch,
  actions,
}: {
  state: BuilderState;
  patch: (fn: (s: BuilderState) => BuilderState) => void;
  actions: Actions;
}) {
  const [over, setOver] = useState(false);
  const { draft } = state;
  const draftPeriods = draft.periodIds
    .map((id) => state.periods.find((p) => p.id === id))
    .filter(Boolean) as Period[];
  const draftPasses = draft.passIds
    .map((id) => state.passes.find((p) => p.id === id))
    .filter(Boolean) as Pass[];
  const empty = draftPeriods.length === 0 && draftPasses.length === 0;

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    const [kind, id] = e.dataTransfer.getData("text/plain").split(":");
    if (!id) return;
    patch((s) => {
      if (kind === "period")
        return s.draft.periodIds.includes(id)
          ? s
          : { ...s, draft: { ...s.draft, periodIds: [...s.draft.periodIds, id] } };
      if (kind === "pass")
        return s.draft.passIds.includes(id)
          ? s
          : { ...s, draft: { ...s.draft, passIds: [...s.draft.passIds, id] } };
      return s;
    });
  }

  const setName = (name: string) => patch((s) => ({ ...s, draft: { ...s.draft, name } }));
  const dropPeriod = (id: string) =>
    patch((s) => ({ ...s, draft: { ...s.draft, periodIds: s.draft.periodIds.filter((x) => x !== id) } }));
  const dropPass = (id: string) =>
    patch((s) => ({ ...s, draft: { ...s.draft, passIds: s.draft.passIds.filter((x) => x !== id) } }));

  function moveToLibrary() {
    if (empty) return;
    const name = draft.name.trim() || "Untitled block";
    const existing = state.library.find((b) => b.id === draft.id);
    const block: LibraryBlock = existing
      ? { ...existing, name, periodIds: draft.periodIds, passIds: draft.passIds }
      : {
          id: "",
          name,
          periodIds: draft.periodIds,
          passIds: draft.passIds,
          listingIds: [],
          priced: false,
          calcOn: true,
          passFlat: {},
          passMode: {},
          periodPrice: {},
        };
    void (existing ? actions.saveBundle(block) : actions.createBundle(block));
    patch((s) => ({ ...s, draft: EMPTY_DRAFT }));
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

      <Button sm variant="primary" disabled={empty} onClick={moveToLibrary}>
        {draft.id ? "Save to Block Library" : "Move to Block Library →"}
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
  state,
  patch,
  actions,
  listings,
  listingsError,
}: {
  state: BuilderState;
  patch: (fn: (s: BuilderState) => BuilderState) => void;
  actions: Actions;
  listings: Listing[];
  listingsError: string | null;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  const q = query.trim().toLowerCase();
  const active = state.library.filter((b) => !b.archived);
  const archived = state.library.filter((b) => b.archived);
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

  // Drag-to-reorder — reflect it locally, then persist the new order.
  const reorder = (draggedId: string, targetId: string) => {
    const arr = [...state.library];
    const from = arr.findIndex((b) => b.id === draggedId);
    const to = arr.findIndex((b) => b.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    patch((s) => ({ ...s, library: arr }));
    void actions.reorderBundles(arr.map((b) => b.id));
  };

  const unarchive = (id: string) => void actions.archiveBundle(id, false);
  const deleteBlock = (id: string, name: string) => {
    if (!confirm(`Delete “${name}”? This can’t be undone.`)) return;
    void actions.deleteBundle(id);
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
          {state.library.length === 0
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
              state={state}
              patch={patch}
              actions={actions}
              listings={listings}
              listingsError={listingsError}
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
  state,
  patch,
  actions,
  listings,
  listingsError,
  color,
  expanded,
  onToggle,
  onDropBlock,
}: {
  block: LibraryBlock;
  state: BuilderState;
  patch: (fn: (s: BuilderState) => BuilderState) => void;
  actions: Actions;
  listings: Listing[];
  listingsError: string | null;
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

  const periods = useMemo(
    () => block.periodIds.map((id) => state.periods.find((p) => p.id === id)).filter(Boolean) as Period[],
    [block.periodIds, state.periods],
  );
  const passes = useMemo(
    () => block.passIds.map((id) => state.passes.find((p) => p.id === id)).filter(Boolean) as Pass[],
    [block.passIds, state.passes],
  );
  const inListings = block.listingIds
    .map((id) => listings.find((l) => l.id === id))
    .filter(Boolean) as Listing[];
  const available = listings.filter((l) => !block.listingIds.includes(l.id));

  // Every bundle edit funnels through here: update locally so typing stays
  // instant, then persist (debounced — the calculator fires per keystroke).
  const mutate = (fn: (b: LibraryBlock) => LibraryBlock) => {
    const next = fn(block);
    patch((s) => ({ ...s, library: s.library.map((x) => (x.id === block.id ? next : x)) }));
    actions.queueBundleSave(next);
  };

  const saveName = () => {
    mutate((b) => ({ ...b, name: tempName.trim() || b.name }));
    setRenaming(false);
  };
  // Listing links are a separate endpoint — it also snapshots resolved prices
  // onto each listing, so the checkout prices from this bundle.
  const addListing = (id: string) => {
    if (block.listingIds.includes(id)) return;
    void actions.sendToListings(block.id, [...block.listingIds, id]);
  };
  const removeListing = (id: string) =>
    void actions.sendToListings(block.id, block.listingIds.filter((x) => x !== id));
  const addPeriod = (pid: string) =>
    mutate((b) => (b.periodIds.includes(pid) ? b : { ...b, periodIds: [...b.periodIds, pid] }));
  const removePeriodFromBlock = (pid: string) =>
    mutate((b) => ({ ...b, periodIds: b.periodIds.filter((x) => x !== pid) }));
  const addPass = (pid: string) =>
    mutate((b) => (b.passIds.includes(pid) ? b : { ...b, passIds: [...b.passIds, pid] }));
  const removePassFromBlock = (pid: string) =>
    mutate((b) => ({ ...b, passIds: b.passIds.filter((x) => x !== pid) }));
  const availablePeriods = state.periods.filter((p) => !block.periodIds.includes(p.id));
  const availablePasses = state.passes.filter((p) => !block.passIds.includes(p.id));
  const duplicate = () => void actions.duplicateBundle(block.id);
  const archive = () => void actions.archiveBundle(block.id, true);
  const remove = () => {
    if (!confirm(`Delete “${block.name}”? This can’t be undone.`)) return;
    void actions.deleteBundle(block.id);
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
      className="rounded-xl border p-3.5"
      style={{
        borderColor: dragOver ? color : "var(--line)",
        borderLeftWidth: "6px",
        borderLeftColor: color,
        background: `color-mix(in srgb, ${color} 7%, #ffffff)`,
        boxShadow: dragOver ? `0 0 0 2px ${color}` : undefined,
      }}
    >
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
              className="flex-none cursor-grab text-[14px] leading-none text-[var(--ink-3)] active:cursor-grabbing"
            >
              ⠿
            </span>
            <span className="h-3.5 w-3.5 flex-none rounded-[5px]" style={{ background: color }} />
            <button
              type="button"
              onClick={onToggle}
              className="truncate text-left text-[14px] font-extrabold"
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
              className="flex-none text-[12px] text-[var(--ink-3)] hover:text-[var(--brand)]"
            >
              ✎
            </button>
          </div>
        )}
        <div className="flex flex-none items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-[2px] text-[10px] font-bold ${
              block.priced
                ? "bg-[var(--green-soft,#e7f8ee)] text-[#0f7a44]"
                : "bg-[#eef0f6] text-[#5b6478]"
            }`}
          >
            {block.priced ? "Priced" : "Unpriced"}
          </span>
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? "Collapse" : "Expand"}
            className="text-[11px] text-[var(--ink-3)] hover:text-[var(--brand)]"
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>
      <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">
        {periods.length} period{periods.length === 1 ? "" : "s"} · {passes.length} pass
        {passes.length === 1 ? "" : "es"}
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
              {periods.map((p) => (
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
              {periods.length ? (
                periods.map((p) => (
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
              {passes.map((p) => (
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
              {passes.length ? passes.map((p) => p.name).join(" · ") : <span className="text-[var(--ink-3)]">—</span>}
            </div>
          )}
        </div>
      </div>

      {showCalc && (
        <PricingCalculator block={block} periods={periods} passes={passes} mutate={mutate} />
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
        {/* No dropdown means there's nothing to send to — say why, rather than
            silently hiding the control. */}
        {available.length === 0 && (
          <div className="mt-1 text-[11px]" style={{ color: listingsError ? "#b91c1c" : "var(--ink-3)" }}>
            {listingsError
              ? `Couldn’t load your listings — ${listingsError}`
              : listings.length === 0
                ? "You don’t have any listings yet — create one in Listings first, then send this block to it."
                : "Sent to all of your listings."}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button sm variant={showCalc ? "primary" : "default"} onClick={() => setShowCalc((v) => !v)}>
          {showCalc ? "Save pricing" : "Sort pricing"}
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

// ── Pricing calculator (mirrors the manual's buildPrice) ───────────────────
function PricingCalculator({
  block,
  periods,
  passes,
  mutate,
}: {
  block: LibraryBlock;
  periods: Period[];
  passes: Pass[];
  mutate: (fn: (b: LibraryBlock) => LibraryBlock) => void;
}) {
  const [openPass, setOpenPass] = useState<string | null>(null);

  const calcOn = block.calcOn !== false;
  const sorted = useMemo(() => [...passes].sort((a, b) => b.days - a.days), [passes]);
  const master = sorted[0];
  const mPrice = block.masterPrice ?? 0;
  const perDay = calcOn && master && master.days ? mPrice / master.days : 0;
  const baseH = blkBaseHours(periods);

  const num = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const toggleCalc = () => mutate((b) => ({ ...b, calcOn: !(b.calcOn !== false) }));
  const setMaster = (v: string) => {
    const n = num(v);
    mutate((b) => ({ ...b, masterPrice: n, priced: (n ?? 0) > 0 }));
  };
  const setFlat = (passId: string, v: string) =>
    mutate((b) => ({
      ...b,
      passFlat: { ...b.passFlat, [passId]: num(v) ?? 0 },
      passMode: { ...b.passMode, [passId]: "flat" },
    }));
  const resetPass = (passId: string) =>
    mutate((b) => {
      const passMode = { ...b.passMode };
      const passFlat = { ...b.passFlat };
      delete passMode[passId];
      delete passFlat[passId];
      return { ...b, passMode, passFlat };
    });
  const setPeriodPrice = (passId: string, periodId: string, v: string) =>
    mutate((b) => ({ ...b, periodPrice: { ...b.periodPrice, [`${passId}_${periodId}`]: num(v) ?? 0 } }));
  const resetPeriodPrice = (passId: string, periodId: string) =>
    mutate((b) => {
      const periodPrice = { ...b.periodPrice };
      delete periodPrice[`${passId}_${periodId}`];
      return { ...b, periodPrice };
    });

  const passPrice = (q: Pass, idx: number) => {
    const isM = idx === 0;
    const isFlat = block.passMode?.[q.id] === "flat";
    if (isM) return mPrice;
    if (!calcOn) return block.passFlat?.[q.id] ?? 0;
    return isFlat ? block.passFlat?.[q.id] ?? 0 : q.days * perDay;
  };

  return (
    <div className="mt-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[13px] font-extrabold">💷 Pricing calculator</span>
        <button
          type="button"
          onClick={toggleCalc}
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
        <span className="text-[11px] text-[var(--ink-3)]">
          Auto-calculate {calcOn ? "on" : "off"}
        </span>
      </div>
      <p className="mb-2 text-[11px] text-[var(--ink-3)]">
        {calcOn
          ? "Set the full price for the longest pass — shorter passes and each timing (e.g. the standard day) are calculated. Edit any to override."
          : "Auto-calc is off — set each price by hand."}
      </p>

      {sorted.length === 0 ? (
        <div className="text-[11.5px] text-[var(--ink-3)]">Add passes to price them.</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {sorted.map((q, idx) => {
            const isM = idx === 0;
            const isFlat = block.passMode?.[q.id] === "flat";
            const price = passPrice(q, idx);
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
                    {periods.length === 0 ? (
                      <div className="text-[11px] text-[var(--ink-3)]">No timings on this block yet.</div>
                    ) : (
                      [...periods]
                        .sort((a, b) => blkHours(b) - blkHours(a))
                        .map((p) => {
                          const key = `${q.id}_${p.id}`;
                          const ov = block.periodPrice?.[key];
                          const pred = calcOn && baseH ? (price * blkHours(p)) / baseH : 0;
                          const val = ov != null ? ov : calcOn ? pred : 0;
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
                                value={val ? val.toFixed(2) : ""}
                                onChange={(e) => setPeriodPrice(q.id, p.id, e.target.value)}
                                className="w-[84px]"
                              />
                              {ov != null && calcOn && (
                                <button
                                  type="button"
                                  title="Reset to calculated"
                                  onClick={() => resetPeriodPrice(q.id, p.id)}
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
                              value={block.masterPrice ?? ""}
                              onChange={(e) => setMaster(e.target.value)}
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
                              value={price.toFixed(2)}
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
