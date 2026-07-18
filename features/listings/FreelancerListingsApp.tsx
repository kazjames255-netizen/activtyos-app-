"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { firebaseAuth } from "@/lib/firebase/client";
import { money } from "@/features/bookings/helpers";
import { Button, Card, FieldLabel, Input } from "@/components/ui";
import { ListingWizard, ListingPreview, listingRowInfo, listingRunsOn, listingIsLive, emptyDraft, loadDrafts, deleteDraft, getDraftVisibility, setDraftVisibility, getDraftArchived, setDraftArchived, copyDraft, type WizardDraft } from "./ListingWizard";

// ─────────────────────────────────────────────────────────────────────────
// Freelancer Listings — the build-manual's "Listings, services & tickets"
// screen. PHASE A: the 3-tab shell (Listings / Categories / Locations), the
// services & tickets table, and the Categories + Locations managers.
//
// Wired to the real API where the backend supports it (listing name + tickets
// = listing.passes via /api/listings). Categories & venues have no backend yet,
// so they persist to localStorage per account (see the Listings backend spec
// for what the developer needs to build). The 10-step listing builder wizard +
// live parent preview is PHASE B.
// ─────────────────────────────────────────────────────────────────────────

interface Ticket {
  name: string;
  price: number;
}
interface Listing {
  id: string;
  name: string;
  passes: Ticket[];
  blocks?: { id: string; name: string; spotsLeft: number; capacity: number; open: boolean }[];
}
interface Category {
  id: string;
  name: string;
}
interface Venue {
  id: string;
  name: string;
  address: string;
}
export interface AddonTemplate {
  id: string;
  name: string;
  type: "perday" | "bundle" | "once";
  price: number;
  /** Shown beside the add-on on the customer page. An image wins over an emoji. */
  emoji?: string;
  image?: string;
}
export interface StaffMember {
  id: string;
  first: string;
  last: string;
  bio: string;
}
export interface LocalState {
  categories: Category[];
  venues: Venue[];
  provided: string[];
  safety: string[];
  send: string[];
  outcomes: string[];
  addons: AddonTemplate[];
  staff: StaffMember[];
  emojis: Record<string, string>;
}

// Date-rail formatting for the listing card.
const monthOf = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
const dayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDate();
const shortDate = (iso: string) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "TBC";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

function myName() {
  const u = firebaseAuth.currentUser;
  return u?.displayName || u?.email?.split("@")[0] || "Me";
}

// First-run seed mirrors the manual's example content.
function seedLocal(): LocalState {
  return {
    categories: [
      "Breakfast Clubs",
      "After-School Clubs",
      "Holiday Multi-Activity Camps",
      "School Enrichment Days",
      "Specialist Camps",
      "SEND & Inclusion",
    ].map((name) => ({ id: uid(), name })),
    venues: [
      { id: uid(), name: "Stantonbury Leisure Centre", address: "Purbeck, Milton Keynes MK14 6BN" },
      { id: uid(), name: "Northampton Sports Hub", address: "Gladstone Rd, Northampton NN5 7EA" },
      { id: uid(), name: "Bedford Woodland Centre", address: "Mowsbury Park, Bedford MK41 8DH" },
    ],
    provided: ["Lunch", "Snacks", "All equipment", "Materials", "Water", "Certificate"],
    safety: ["DBS-checked staff", "First aid on site", "Safeguarding lead", "Low ratios", "Secure venue"],
    send: ["Wheelchair accessible", "1:1 support available", "Quiet space", "Visual timetables", "SEND-trained staff"],
    outcomes: ["Teamwork", "Confidence", "New skills", "Physical activity", "Creativity", "Making friends"],
    addons: [],
    staff: [{ id: uid(), first: myName().split(" ")[0] || "Me", last: myName().split(" ").slice(1).join(" "), bio: "" }],
    emojis: {},
  };
}
function localKey() {
  const who = firebaseAuth.currentUser?.uid || firebaseAuth.currentUser?.email || "anon";
  return `activityos.listings-extra.${who}`;
}
function loadLocal(): LocalState {
  const seed = seedLocal();
  try {
    const raw = localStorage.getItem(localKey());
    if (!raw) return seed;
    const p = JSON.parse(raw) as Partial<LocalState> & { staff?: (string | StaffMember)[] };
    const rawStaff = (p.staff ?? []) as (string | StaffMember)[];
    const staff = rawStaff.length
      ? rawStaff.map((s) => (typeof s === "string" ? { id: uid(), first: s.split(" ")[0], last: s.split(" ").slice(1).join(" "), bio: "" } : s))
      : seed.staff;
    return {
      categories: p.categories ?? seed.categories,
      venues: p.venues ?? seed.venues,
      provided: p.provided ?? seed.provided,
      safety: p.safety ?? seed.safety,
      send: p.send ?? seed.send,
      outcomes: p.outcomes ?? seed.outcomes,
      addons: p.addons ?? seed.addons,
      staff,
      emojis: p.emojis ?? {},
    };
  } catch {
    return seed;
  }
}
function saveLocal(s: LocalState) {
  try {
    localStorage.setItem(localKey(), JSON.stringify(s));
  } catch {
    /* non-fatal */
  }
}

function HowItWorks() {
  return (
    <details className="group mb-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[13px] font-bold text-[var(--brand-ink,#1d3a8f)] [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform group-open:rotate-90">▸</span>
        <span>ℹ️ How it works</span>
      </summary>
      <div className="px-3.5 pb-3.5 pl-8 text-[12.5px] text-[var(--ink-3)]">
        <p className="mb-2">Build the camps, clubs and sessions you sell.</p>
        <ol className="ml-4 flex list-decimal flex-col gap-1">
          <li>Set when it runs, the ages and the venue — once</li>
          <li>Add passes, prices, capacity and waitlists</li>
          <li>Add wraparound times and add-ons, then publish to your storefront</li>
        </ol>
      </div>
    </details>
  );
}

type Tab = "listings" | "categories" | "locations";

/** Freelancer Listings — manual layout, Phase A. */
export function FreelancerListingsApp() {
  const [tab, setTab] = useState<Tab>("listings");
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<LocalState | null>(null);
  const [wizard, setWizard] = useState<{ draft: WizardDraft; key: string } | null>(null);
  const [viewing, setViewing] = useState<WizardDraft | null>(null);
  const [tick, setTick] = useState(0);
  // In-progress drafts (never published) — resumable from the Listings tab.
  const drafts = useMemo(
    () => Object.entries(loadDrafts()).filter(([, dr]) => dr.id === null && (dr.title.trim() || dr.blockId || dr.description.trim())),
    // tick/wizard drive a re-read of localStorage (loadDrafts is not a tracked dep)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, wizard],
  );

  // Returns the fresh list so callers (e.g. delete) can confirm the change landed.
  const refresh = useCallback(
    () =>
      apiGet<Listing[]>("/api/listings?mine=1")
        .then((ls) => {
          setListings(ls);
          setError(null);
          return ls;
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : "Failed to load listings");
          // Never leave the page stuck on "Loading…" — show the error instead.
          setListings((prev) => prev ?? []);
          return null;
        }),
    [],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useRealtime(["listings", "blocks"], refresh);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocal(loadLocal());
  }, []);
  useEffect(() => {
    if (local) saveLocal(local);
  }, [local]);

  const patchLocal = (fn: (s: LocalState) => LocalState) =>
    setLocal((prev) => (prev ? fn(prev) : prev));

  if (!listings || !local)
    return (
      <div className="py-10 text-center text-[12.5px]">
        {error ? (
          <div className="mx-auto max-w-[420px] rounded-lg border px-3 py-2.5" style={{ borderColor: "#f4c7c7", background: "#fdf2f2", color: "#b91c1c" }}>
            <div className="font-bold">Couldn’t load your listings</div>
            <div className="mt-1">{error}</div>
            <button type="button" onClick={refresh} className="mt-2 font-bold underline">
              Try again
            </button>
          </div>
        ) : (
          <span className="text-[var(--ink-3)]">Loading…</span>
        )}
      </div>
    );

  const TABS: [Tab, string][] = [
    ["listings", "Listings"],
    ["categories", "Categories"],
    ["locations", "Locations"],
  ];

  return (
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
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[20px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            Listings, services &amp; tickets
          </h2>
          <p className="text-[13px] text-[var(--ink-3)]">Your own programmes</p>
        </div>
        <div className="flex items-center gap-2.5">
          {tab === "listings" && (
            <Button variant="primary" onClick={() => setWizard({ draft: emptyDraft(), key: uid() })}>
              ＋ New listing
            </Button>
          )}
        </div>
      </div>

      <HowItWorks />

      {/* Tabs */}
      <div className="mb-3 flex gap-1.5 border-b border-[var(--line)]">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="border-b-2 px-3 py-2 text-[13px] font-bold transition-colors"
            style={
              tab === key
                ? { borderColor: "var(--brand)", color: "var(--brand-ink)" }
                : { borderColor: "transparent", color: "var(--ink-3)" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sticky so a failed action is visible even when scrolled down a long list. */}
      {error && (
        <div
          className="sticky top-2 z-30 mb-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[12.5px] shadow-sm"
          style={{ borderColor: "#f4c7c7", background: "#fdf2f2", color: "#b91c1c" }}
          role="alert"
        >
          <span>⚠</span>
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {tab === "listings" && (
        <ListingsTab
          listings={listings}
          drafts={drafts}
          local={local}
          onEdit={(l) => {
            const saved = loadDrafts()[l.id];
            setWizard({ draft: saved ?? { ...emptyDraft(), id: l.id, title: l.name }, key: l.id });
          }}
          onResume={(key, dr) => setWizard({ draft: dr, key })}
          onDeleteDraft={(key) => { if (confirm("Delete this draft?")) { deleteDraft(key); setTick((t) => t + 1); } }}
          onView={(l) => setViewing(loadDrafts()[l.id] ?? { ...emptyDraft(), id: l.id, title: l.name })}
          onSetVisibility={(l, vis) => { setDraftVisibility(l.id, vis); setTick((t) => t + 1); }}
          visTick={tick}
          onError={setError}
          refresh={refresh}
        />
      )}
      {tab === "categories" && <CategoriesTab local={local} patch={patchLocal} />}
      {tab === "locations" && <LocationsTab local={local} patch={patchLocal} />}

      {wizard && (
        <ListingWizard
          initial={wizard.draft}
          wizardKey={wizard.key}
          local={local}
          patchLocal={patchLocal}
          onSaved={() => { refresh(); setTick((t) => t + 1); }}
          onClose={() => { setWizard(null); setTick((t) => t + 1); }}
        />
      )}

      {viewing && (
        <div onClick={(e) => e.target === e.currentTarget && setViewing(null)} className="fixed inset-0 z-[10000] flex items-start justify-center overflow-auto bg-black/60 p-4 sm:p-6">
          <div className="w-full max-w-[1040px]">
            <div className="mb-2 flex items-center justify-between text-white">
              <span className="text-[13px] font-bold">Customer view — {viewing.title || "listing"}</span>
              <button type="button" onClick={() => setViewing(null)} className="text-[22px] leading-none">×</button>
            </div>
            <ListingPreview draft={viewing} local={local} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Listings tab: compact, searchable cards ────────────────────────────────
function ListingsTab({
  listings,
  drafts,
  local,
  onEdit,
  onResume,
  onDeleteDraft,
  onView,
  onSetVisibility,
  visTick,
  onError,
  refresh,
}: {
  listings: Listing[];
  drafts: [string, WizardDraft][];
  local: LocalState;
  onEdit: (l: Listing) => void;
  onResume: (key: string, dr: WizardDraft) => void;
  onDeleteDraft: (key: string) => void;
  onView: (l: Listing) => void;
  onSetVisibility: (l: Listing, vis: "public" | "hidden") => void;
  visTick: number;
  onError: (m: string) => void;
  refresh: () => Promise<Listing[] | null>;
}) {
  const [q, setQ] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "ended">("all");
  const liveOf = (l: Listing) => { const dr = loadDrafts()[l.id]; return dr ? listingIsLive(dr) : true; };
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [archiveTick, setArchiveTick] = useState(0);
  const [showArchived, setShowArchived] = useState(false);

  // Subtle solid accent per venue — a quiet colour cue, not a whole-card fill.
  const ACCENTS = ["#2f6bd8", "#0e9f6e", "#7c3aed", "#e11d48", "#0891b2", "#d97706", "#4f46e5", "#0f766e"];
  const accentOf = (l: Listing) => {
    const vid = loadDrafts()[l.id]?.venueId;
    const idx = vid ? local.venues.findIndex((v) => v.id === vid) : -1;
    return idx < 0 ? "#64748b" : ACCENTS[idx % ACCENTS.length];
  };
  const [menuId, setMenuId] = useState<string | null>(null);

  const bookedCount = (l: Listing) => (l.blocks ?? []).reduce((s, b) => s + Math.max(0, b.capacity - b.spotsLeft), 0);
  async function duplicate(l: Listing) {
    try {
      const created = await apiPost<{ id: string }>("/api/listings", { name: `${l.name} (copy)`, passes: l.passes });
      copyDraft(l.id, created.id, { title: `${l.name} (copy)`, archived: false });
      refresh();
      setArchiveTick((t) => t + 1);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Duplicate failed");
    }
  }
  async function remove(l: Listing) {
    const booked = bookedCount(l);
    if (booked > 0) { alert(`“${l.name}” has ${booked} booking${booked === 1 ? "" : "s"} and can’t be deleted — archive it instead.`); return; }
    if (!confirm(`Delete “${l.name}”? This can’t be undone.`)) return;
    try {
      await api(`/api/listings/${encodeURIComponent(l.id)}`, { method: "DELETE" });
      // Confirm it actually went — a "successful" delete that leaves the row
      // in place otherwise just looks like the button did nothing.
      const after = await refresh();
      if (after?.some((x) => x.id === l.id)) {
        onError(`The server accepted deleting “${l.name}” but it's still in the list. Send this to your developer — the listing may belong to a different account.`);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Delete failed");
    }
  }
  const archive = (l: Listing, v: boolean) => { setDraftArchived(l.id, v); setArchiveTick((t) => t + 1); };
  const venueName = (l: Listing) => { const dr = loadDrafts()[l.id]; return dr ? local.venues.find((v) => v.id === dr.venueId)?.name ?? "" : ""; };
  const copyLink = (l: Listing) => {
    const link = `${typeof window !== "undefined" ? window.location.origin : ""}/book/${l.id}`;
    navigator.clipboard?.writeText(link).then(() => { setCopiedId(l.id); setTimeout(() => setCopiedId(null), 1500); }).catch(() => {});
  };

  const query = q.trim().toLowerCase();
  const shown = listings.filter((l) => {
    const dr = loadDrafts()[l.id];
    if (query) {
      const info = dr ? listingRowInfo(dr) : null;
      if (!`${l.name} ${venueName(l)} ${info?.dateLabel ?? ""}`.toLowerCase().includes(query)) return false;
    }
    if (dateFilter) return dr ? listingRunsOn(dr, dateFilter) : false;
    return true;
  });
  const activeShown = shown.filter((l) => !getDraftArchived(l.id) && (statusFilter === "all" || (statusFilter === "live" ? liveOf(l) : !liveOf(l))));
  const archivedList = listings.filter((l) => getDraftArchived(l.id));

  const draftsBlock = drafts.length > 0 && (
    <div className="mb-3">
      <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Drafts ({drafts.length}) — resume where you left off</div>
      <div className="flex flex-col gap-1.5">
        {drafts.map(([key, dr]) => (
          <div key={key} className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)] px-3 py-2">
            <span className="rounded-full bg-[#fdf3d8] px-2 py-[2px] text-[10px] font-bold text-[#9a5a00]">Draft</span>
            <span className="flex-1 truncate text-[13px] font-bold">{dr.title.trim() || "Untitled listing"}</span>
            <Button sm variant="primary" onClick={() => onResume(key, dr)}>Resume</Button>
            <Button sm variant="danger" onClick={() => onDeleteDraft(key)}>Delete</Button>
          </div>
        ))}
      </div>
    </div>
  );

  if (listings.length === 0)
    return (
      <div>
        {draftsBlock}
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No listings yet — create your first with <b>＋ New listing</b> and it appears in the parents’ Browse page.</Card>
      </div>
    );

  return (
    <div className="flex flex-col gap-3" data-archive-tick={archiveTick}>
      {draftsBlock}
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍  Search by name or location…" className="w-full max-w-[300px]" />
        <div className="flex items-center gap-1.5">
          <span className="text-[11.5px] font-bold text-[var(--ink-3)]">Runs on</span>
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-[150px]" />
          {dateFilter && <Button sm onClick={() => setDateFilter("")}>Clear</Button>}
        </div>
        <span className="flex overflow-hidden rounded-full border border-[var(--line)] text-[11px] font-bold">
          {([["all", "All"], ["live", "Live"], ["ended", "Ended"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setStatusFilter(k)} className="px-3 py-1.5"
              style={statusFilter === k ? { background: "var(--brand)", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
          ))}
        </span>
      </div>
      {activeShown.length === 0 ? (
        <Card className="p-5 text-center text-[12.5px] text-[var(--ink-3)]">{q || dateFilter ? `No listings match your search${dateFilter ? " on that date" : ""}.` : "No active listings — check Archived below."}</Card>
      ) : (
        activeShown.map((l) => {
          const info = (() => { const dr = loadDrafts()[l.id]; return dr ? listingRowInfo(dr) : null; })();
          const vn = venueName(l);
          // Prefer the real dated-run blocks (capacity + bookings) if the API has them; else the builder default.
          const apiBlocks = l.blocks ?? [];
          const cap = apiBlocks.length ? apiBlocks.reduce((s, b) => s + b.capacity, 0) : info?.capacity ?? null;
          const spaces = apiBlocks.length ? apiBlocks.reduce((s, b) => s + b.spotsLeft, 0) : cap;
          const accent = accentOf(l);
          const isLive = info ? info.live : true;
          return (
            <Card key={l.id} className="overflow-visible p-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-20px_rgba(20,35,90,.35)]">
              <div className="flex flex-col sm:flex-row">
                {/* date rail — when it runs, read first */}
                <div className="flex flex-none flex-row items-center justify-center gap-3 px-4 py-3 text-white sm:w-[92px] sm:flex-col sm:gap-0 sm:rounded-l-xl sm:py-4" style={{ background: accent }}>
                  {info?.from ? (
                    <>
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-75">{monthOf(info.from)}</div>
                      <div className="text-[26px] font-extrabold leading-none sm:mt-0.5" style={{ fontVariantNumeric: "tabular-nums" }}>{dayOf(info.from)}</div>
                      <div className="mx-auto my-2 hidden h-px w-6 bg-white/30 sm:block" />
                      <div className="text-[11px] leading-[1.35] opacity-90 sm:text-center">
                        <span className="sm:hidden">→ </span>to <b>{shortDate(info.to)}</b>
                        {info.totalDays > 0 && <><br className="hidden sm:block" /><span className="sm:hidden"> · </span>{info.totalDays} days</>}
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-90">Dates TBC</div>
                  )}
                </div>

                <div className="min-w-0 flex-1 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[17px] font-bold leading-tight tracking-[-0.02em] text-[var(--ink)]">{l.name}</h3>
                    {isLive ? (
                      <span title="The run hasn’t ended — last date is today or later" className="inline-flex items-center gap-1 rounded-full bg-[var(--green-soft,#e7f8ee)] px-2 py-[2px] text-[10px] font-semibold text-[#0f7a44]"><span className="inline-block h-1.5 w-1.5 rounded-full bg-[#16a34a]" />Live</span>
                    ) : (
                      <span title="The last date has passed — this run has ended" className="rounded-full bg-[var(--surface)] px-2 py-[2px] text-[10px] font-semibold text-[var(--ink-3)]">Ended</span>
                    )}
                  </div>
                  <div className="mt-1 text-[12.5px] text-[var(--ink-3)]">{vn || "No venue set"}</div>

                  {/* passes */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {l.passes.length ? (
                      <>
                        {l.passes.slice(0, 3).map((t, i) => (
                          <span key={i} className="inline-flex items-baseline gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1">
                            <span className="text-[11.5px] text-[var(--ink-3)]">{t.name}</span>
                            <span className="text-[12px] font-bold text-[var(--ink)]" style={{ fontVariantNumeric: "tabular-nums" }}>{money(t.price)}</span>
                          </span>
                        ))}
                        {l.passes.length > 3 && <span className="text-[11.5px] font-medium text-[var(--ink-3)]">+{l.passes.length - 3} more</span>}
                      </>
                    ) : <span className="text-[12px] text-[var(--ink-3)]">No tickets yet.</span>}
                  </div>

                  {/* how full it is */}
                  {cap != null && (() => {
                    const left = Math.max(0, spaces ?? cap);
                    const booked = Math.max(0, cap - left);
                    const pct = cap > 0 ? Math.round((booked / cap) * 100) : 0;
                    const tone = left <= 0 ? "#dc2626" : left <= cap * 0.15 ? "#d97706" : "#16a34a";
                    return (
                      <div className="mt-3">
                        <div className="h-[7px] overflow-hidden rounded-full bg-[var(--line)]">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: tone }} />
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-[11.5px] text-[var(--ink-3)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                          <span><b className="text-[var(--ink)]">{booked}</b> of {cap} booked</span>
                          <span className="text-[var(--line)]">·</span>
                          <span style={{ color: tone }}><b>{left}</b> left{info?.capacityScope === "day" ? " per day" : ""}</span>
                          {booked > 0 && <><span className="text-[var(--line)]">·</span><span>{pct}% full</span></>}
                        </div>
                      </div>
                    );
                  })()}

                  {/* actions */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
                    <span key={visTick} className="inline-flex overflow-hidden rounded-lg border border-[var(--line)] text-[11px] font-semibold">
                      {(["public", "hidden"] as const).map((v) => {
                        const on = getDraftVisibility(l.id) === v;
                        return <button key={v} type="button" onClick={() => onSetVisibility(l, v)} className="px-2.5 py-1 transition-colors" style={on ? { background: "var(--brand-soft)", color: "var(--brand-ink)" } : { color: "var(--ink-3)" }}>{v === "public" ? "Public" : "Hidden"}</button>;
                      })}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <Button sm onClick={() => copyLink(l)}>{copiedId === l.id ? "✓ Copied" : "🔗 Link"}</Button>
                      <Button sm onClick={() => onView(l)}>View</Button>
                      <Button sm variant="primary" onClick={() => onEdit(l)}>Edit</Button>
                      <div className="relative">
                        <Button sm onClick={() => setMenuId((m) => (m === l.id ? null : l.id))}>⋯</Button>
                        {menuId === l.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                            <div className="absolute right-0 z-20 mt-1 w-[168px] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] py-1 shadow-lg">
                              {[
                                { label: "Duplicate", fn: () => duplicate(l) },
                                { label: "Archive", fn: () => archive(l, true) },
                              ].map((a) => (
                                <button key={a.label} type="button" onClick={() => { a.fn(); setMenuId(null); }} className="block w-full px-3.5 py-2 text-left text-[12.5px] font-medium text-[var(--ink-2)] hover:bg-[var(--surface)]">{a.label}</button>
                              ))}
                              <div className="my-1 h-px bg-[var(--line)]" />
                              <button type="button" onClick={() => { remove(l); setMenuId(null); }} className="block w-full px-3.5 py-2 text-left text-[12.5px] font-medium text-[#dc2626] hover:bg-[#fef2f2]">Delete</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })
      )}

      {archivedList.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setShowArchived((v) => !v)} className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
            <span>{showArchived ? "▾" : "▸"}</span> Archived ({archivedList.length})
          </button>
          {showArchived && (
            <div className="mt-2 flex flex-col gap-1.5">
              {archivedList.map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
                  <span className="rounded-full bg-[#eef0f6] px-2 py-[2px] text-[10px] font-bold text-[#5b6478]">Archived</span>
                  <span className="flex-1 truncate text-[13px] font-bold">{l.name}</span>
                  <Button sm variant="primary" onClick={() => archive(l, false)}>Unarchive</Button>
                  <Button sm variant="danger" onClick={() => remove(l)}>Delete</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Categories tab ─────────────────────────────────────────────────────────
function CategoriesTab({
  local,
  patch,
}: {
  local: LocalState;
  patch: (fn: (s: LocalState) => LocalState) => void;
}) {
  const [name, setName] = useState("");
  const add = () => {
    if (name.trim().length < 2) return;
    patch((s) => ({ ...s, categories: [...s.categories, { id: uid(), name: name.trim() }] }));
    setName("");
  };
  const remove = (id: string, nm: string) => {
    if (!confirm(`Delete category “${nm}”?`)) return;
    patch((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id) }));
  };

  return (
    <Card className="p-4">
      <div className="text-[15px] font-extrabold">Categories</div>
      <p className="mb-3 text-[12px] text-[var(--ink-3)]">
        Categories are how parents filter your storefront. These are the options offered when you
        build a listing.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {local.categories.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12.5px] font-bold"
          >
            {c.name}
            <button
              type="button"
              onClick={() => remove(c.id, c.name)}
              aria-label="Delete category"
              className="text-[var(--ink-3)] hover:text-[var(--red)]"
            >
              ✕
            </button>
          </span>
        ))}
        {local.categories.length === 0 && (
          <span className="text-[12px] text-[var(--ink-3)]">No categories yet.</span>
        )}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New category name"
          className="w-[240px]"
        />
        <Button onClick={add}>＋ Add category</Button>
      </div>
    </Card>
  );
}

// ── Locations tab ──────────────────────────────────────────────────────────
function LocationsTab({
  local,
  patch,
}: {
  local: LocalState;
  patch: (fn: (s: LocalState) => LocalState) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [nm, setNm] = useState("");
  const [addr, setAddr] = useState("");

  const addVenue = () => {
    if (nm.trim().length < 2) return;
    patch((s) => ({ ...s, venues: [...s.venues, { id: uid(), name: nm.trim(), address: addr.trim() }] }));
    setNm("");
    setAddr("");
    setAdding(false);
  };
  const updateVenue = (id: string, field: "name" | "address", value: string) =>
    patch((s) => ({ ...s, venues: s.venues.map((v) => (v.id === id ? { ...v, [field]: value } : v)) }));
  const removeVenue = (id: string, name: string) => {
    if (!confirm(`Delete venue “${name}”?`)) return;
    patch((s) => ({ ...s, venues: s.venues.filter((v) => v.id !== id) }));
  };

  return (
    <Card className="p-4">
      <div className="text-[15px] font-extrabold">Locations</div>
      <p className="mb-3 text-[12px] text-[var(--ink-3)]">
        Your venues — a simple list of name + address. Pick one per listing; address &amp; map pin
        are set here once.
      </p>

      <div className="flex flex-col gap-1.5">
        {local.venues.map((v) => {
          const open = openId === v.id;
          return (
            <div key={v.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : v.id)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <span className="text-[var(--ink-3)]">{open ? "▾" : "▸"}</span>
                  <span>
                    <span className="text-[13px] font-bold">{v.name}</span>
                    <span className="ml-2 text-[11.5px] text-[var(--ink-3)]">{v.address}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => removeVenue(v.id, v.name)}
                  aria-label="Delete venue"
                  className="text-[13px] text-[var(--ink-3)] hover:text-[var(--red)]"
                >
                  ✕
                </button>
              </div>
              {open && (
                <div className="border-t border-[var(--line)] p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <FieldLabel>Venue name</FieldLabel>
                      <Input value={v.name} onChange={(e) => updateVenue(v.id, "name", e.target.value)} className="w-full" />
                    </div>
                    <div>
                      <FieldLabel>Address</FieldLabel>
                      <Input value={v.address} onChange={(e) => updateVenue(v.id, "address", e.target.value)} className="w-full" />
                    </div>
                  </div>
                  <div className="mt-2 flex h-[120px] items-center justify-center rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] text-[11.5px] text-[var(--ink-3)]">
                    📍 Map pin — search &amp; drop a pin (needs the maps key your developer provisions)
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="mt-2 flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5 sm:flex-row sm:items-end">
          <div className="flex-1">
            <FieldLabel>Venue name</FieldLabel>
            <Input value={nm} onChange={(e) => setNm(e.target.value)} placeholder="e.g. Riverside Sports Hall" className="w-full" />
          </div>
          <div className="flex-1">
            <FieldLabel>Address</FieldLabel>
            <Input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Street, town, postcode" className="w-full" />
          </div>
          <div className="flex gap-1.5">
            <Button variant="primary" onClick={addVenue}>
              Add
            </Button>
            <Button onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button className="mt-2" onClick={() => setAdding(true)}>
          ＋ Add venue
        </Button>
      )}
    </Card>
  );
}
