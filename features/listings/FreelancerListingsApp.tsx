"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { firebaseAuth } from "@/lib/firebase/client";
import { money } from "@/features/bookings/helpers";
import { Button, Card, FieldLabel, Input } from "@/components/ui";
import { HowItWorks as HowItWorksPanel } from "@/components/HowItWorks";
import { useTenantSettings } from "@/lib/settings";
import { VenueMap } from "./VenueMap";
import { whereHeading, WHERE_HEAD_DEFAULT, ListingWizard, ListingPreview, CroppedImage, listingRowInfo, listingRunsOn, emptyDraft, loadDrafts, deleteDraft, getDraftVisibility, getDraftArchived, copyDraft, draftFromListing, type ServerListing, type WizardDraft } from "./ListingWizard";

// ─────────────────────────────────────────────────────────────────────────
// Freelancer Listings — the build-manual's "Listings, services & tickets"
// screen. PHASE A: the 3-tab shell (Listings / Categories / Locations), the
// services & tickets table, and the Categories + Locations managers.
//
// Fully wired: listings + tickets via /api/listings, and the library
// (categories/venues/staff/add-ons) via /api/library — localStorage is only
// an offline fallback cache; the server copy always wins on load.
// ─────────────────────────────────────────────────────────────────────────

// A listing from the API now carries the whole wizard draft (the server
// persists it verbatim) plus the joined blocks. Older docs may predate that —
// `serverDraft` returns null for those and localStorage remains the fallback.
type Listing = ServerListing;
const serverDraft = (l: Listing): WizardDraft | null => (l.title != null ? draftFromListing(l) : null);
interface Category {
  id: string;
  name: string;
}
export interface Venue {
  id: string;
  name: string;
  address: string;
  /** Town / city — a clean, structured place name for the customer browse
   *  Location filter (the free-text address is too varied to group by). */
  city?: string;
  /** "online" venues run remotely — no address, map or travel details. */
  kind?: "place" | "online";
  /** What's there — shown to parents on the listing page. */
  facilities?: string[];
  /** Getting there, parking, where to drop off. */
  directions?: string;
  /** what3words square for the exact entrance — stops the "which door?" phone calls. */
  what3words?: string;
  /** Nearest bus stop / station. */
  transport?: string;
  /** Saved map position. Set by the address lookup, adjusted by the zoom buttons. */
  lat?: number;
  lng?: number;
  zoom?: number;
}
export interface AddonQuestion {
  id: string;
  /** What the parent is asked — "T-shirt size", "Meal choice". */
  label: string;
  /** "choice" gives them the options and nothing else; "text" is free typing. */
  type: "text" | "choice";
  options?: string[];
  required?: boolean;
}

export interface AddonTemplate {
  id: string;
  name: string;
  /**
   * "bundle" is retired — it priced identically to "once" and only differed in
   * name, which meant picking the wrong one had no effect but looked like it
   * should. Existing add-ons keep parsing and behave as "once".
   */
  type: "perday" | "bundle" | "once";
  price: number;
  /** A line of explanation for parents — what it is, when it's needed. */
  description?: string;
  /** Shown beside the add-on on the customer page. An image wins over an emoji. */
  emoji?: string;
  image?: string;
  /** Anything the provider needs to know per child before they can supply it —
   *  a t-shirt size, a meal choice, a name to print. Asked at checkout, once
   *  per child who takes the add-on. */
  questions?: AddonQuestion[];
}
export interface StaffMember {
  id: string;
  first: string;
  last: string;
  bio: string;
}
export interface LocalState {
  /** Heading for the venue section on every customer page — set once, not per listing. */
  whereHeading?: { eyebrow: string; title: string };
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
// Scheduled-open badge. Compared as local strings, matching the datetime-local
// input the operator typed — no timezone shifting.
const nowLocal = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(t.getHours())}:${p(t.getMinutes())}`; };
const openLabel = (v: string) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const time = d.getMinutes() ? d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" }) : d.toLocaleTimeString("en-GB", { hour: "numeric" });
  return `${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "short" })}, ${time.replace(/\s/g, "").toLowerCase()}`;
};
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
      whereHeading: p.whereHeading,
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

type Tab = "listings" | "categories" | "locations";

// The library lives server-side now (PUT /api/library — shared across the
// tenant's machines and embedded into the parent's customer page). Add-on
// images upload first so the library stores URLs, not data URLs.
async function putLibrary(s: LocalState): Promise<void> {
  const addons = await Promise.all(
    s.addons.map(async (a) =>
      a.image?.startsWith("data:")
        ? { ...a, image: (await apiPost<{ url: string }>("/api/uploads", { dataUrl: a.image })).url }
        : a,
    ),
  );
  await api("/api/library", { method: "PUT", body: JSON.stringify({ ...s, addons }) });
}

function HowItWorks({ onTab }: { onTab: (t: Tab) => void }) {
  const jump = "font-bold text-[var(--brand-ink,#1d3a8f)] underline underline-offset-2";
  return (
    <HowItWorksPanel
      video="Building a listing end to end: categories and locations first, then the ten steps, preview, publish."
      minutes="3 min"
    >
      <p className="mb-2">
        A listing is one thing you sell — a holiday camp, a weekly club, a one-off session. The
        builder walks you through it and saves as you go; nothing is live until you publish.
      </p>
      <p className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2 text-[var(--ink-2)]">
        <b>Set up your </b>
        <button type="button" onClick={() => onTab("categories")} className={jump}>categories</button>
        <b> and </b>
        <button type="button" onClick={() => onTab("locations")} className={jump}>locations</button>
        <b> first</b> — you pick from those lists inside the builder.
      </p>
    </HowItWorksPanel>
  );
}

/** Freelancer Listings — manual layout, Phase A. */
export function FreelancerListingsApp() {
  const [tab, setTab] = useState<Tab>("listings");
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<LocalState | null>(null);
  const [wizard, setWizard] = useState<{ draft: WizardDraft; key: string } | null>(null);
  const [viewing, setViewing] = useState<{ draft: WizardDraft; runs?: Listing["blocks"] } | null>(null);
  const [tick, setTick] = useState(0);
  // In-progress drafts (never published) — resumable from the Listings tab.
  // How many listings sit behind each category / venue. Both library tabs show
  // it, and it's what makes an unused entry obvious.
  const usage = useMemo(() => {
    const cats: Record<string, number> = {};
    const venues: Record<string, number> = {};
    // Only count drafts that still have a listing behind them. Deleting a
    // listing leaves its draft in localStorage, and counting those inflated
    // every category (a deleted camp kept voting for its categories forever).
    const live = new Set((listings ?? []).map((l) => l.id));
    for (const dr of Object.values(loadDrafts())) {
      if (dr.id === null || dr.archived || !live.has(dr.id)) continue;
      for (const c of dr.categoryIds ?? []) cats[c] = (cats[c] ?? 0) + 1;
      if (dr.venueId) venues[dr.venueId] = (venues[dr.venueId] ?? 0) + 1;
    }
    return { cats, venues };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, wizard, listings]);

  const { settings: fsSettings } = useTenantSettings();
  // A new listing starts from the provider's own defaults (Setup & features)
  // rather than the compiled-in ones — a tutoring provider whose classes hold
  // eight shouldn't retype "60" on every listing.
  const startNew = useCallback(
    (venueId?: string) => setWizard({ draft: { ...emptyDraft(fsSettings), venueId: venueId ?? null }, key: uid() }),
    [fsSettings],
  );

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
  // Library: server first (shared across machines), localStorage as the
  // offline cache. A tenant with no server library yet gets this browser's
  // local one (or the seed) migrated up automatically.
  const libDirty = useRef(false);
  const libTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let alive = true;
    apiGet<Partial<LocalState> | null>("/api/library")
      .then((lib) => {
        if (!alive) return;
        if (lib) {
          // The server wins — except where it has nothing and this browser
          // does. Add-ons built before the library could save (the 100kb body
          // limit, silently) live only here, and spreading an empty server
          // list over them erased them from view. Recover those and push
          // them up rather than leaving the operator to rebuild.
          const merged = { ...seedLocal(), ...lib } as LocalState;
          const cached = loadLocal();
          const listKeys = ["addons", "staff", "categories", "venues", "provided", "safety", "send", "outcomes"] as const;
          let recovered = false;
          for (const k of listKeys) {
            if ((merged[k]?.length ?? 0) === 0 && (cached[k]?.length ?? 0) > 0) {
              (merged as unknown as Record<string, unknown>)[k] = cached[k];
              recovered = true;
            }
          }
          setLocal(merged);
          if (recovered) void putLibrary(merged).catch((e) => setError(e instanceof Error ? e.message : "Couldn't save your library"));
        }
        else {
          const start = loadLocal();
          setLocal(start);
          void putLibrary(start).catch((e) => setError(e instanceof Error ? e.message : "Couldn't save your library"));
        }
      })
      .catch(() => {
        if (alive) setLocal(loadLocal());
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!local) return;
    saveLocal(local);
    if (!libDirty.current) return;
    libDirty.current = false;
    // Debounced — typing in the categories/venues managers shouldn't PUT
    // per keystroke.
    if (libTimer.current) clearTimeout(libTimer.current);
    // A swallowed failure here is why an add-on could look saved while the
    // customer page never saw it — the library lived only in this browser.
    libTimer.current = setTimeout(
      () => void putLibrary(local).catch((e) => setError(e instanceof Error ? e.message : "Couldn't save your categories, venues and add-ons")),
      800,
    );
  }, [local]);
  useEffect(() => () => { if (libTimer.current) clearTimeout(libTimer.current); }, []);

  const patchLocal = (fn: (s: LocalState) => LocalState) => {
    libDirty.current = true;
    setLocal((prev) => (prev ? fn(prev) : prev));
  };

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
            <>
              <Button
                onClick={() => {
                  // The whole-storefront widget for the operator's own website.
                  const tid = (listings?.[0] as { tenantId?: string } | undefined)?.tenantId;
                  if (!tid) {
                    alert("Create a listing first — the storefront embed shows your live listings.");
                    return;
                  }
                  const snippet = `<script src="${window.location.origin}/embed.js" data-store="${tid}" async></script>`;
                  navigator.clipboard?.writeText(snippet).then(() =>
                    alert(`Copied! Paste this into your website's HTML for a button that opens your WHOLE storefront (every live listing):\n\n${snippet}\n\nTips:\n· data-mode="inline" embeds the storefront directly in the page\n· on React/Next sites, put <div data-activityos-store="${tid}"></div> where it should go and load the script anywhere`),
                  ).catch(() => {});
                }}
              >
                {"</>"} Embed
              </Button>
              <Button variant="primary" onClick={() => startNew()}>
                ＋ New listing
              </Button>
            </>
          )}
        </div>
      </div>

      <HowItWorks onTab={setTab} />

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
            const saved = serverDraft(l) ?? loadDrafts()[l.id];
            setWizard({ draft: saved ?? { ...emptyDraft(), id: l.id, title: l.name }, key: l.id });
          }}
          onResume={(key, dr) => setWizard({ draft: dr, key })}
          onDeleteDraft={(key) => { if (confirm("Delete this draft?")) { deleteDraft(key); setTick((t) => t + 1); } }}
          onView={(l) => setViewing({ draft: serverDraft(l) ?? loadDrafts()[l.id] ?? { ...emptyDraft(), id: l.id, title: l.name }, runs: l.blocks })}
          onSetVisibility={(l, vis) => {
            api(`/api/listings/${encodeURIComponent(l.id)}`, { method: "PUT", body: JSON.stringify({ visibility: vis }) })
              .then(() => refresh())
              .catch((e) => setError(e instanceof Error ? e.message : "Couldn’t change visibility"));
            setTick((t) => t + 1);
          }}
          visTick={tick}
          onError={setError}
          refresh={refresh}
        />
      )}
      {tab === "categories" && <CategoriesTab local={local} patch={patchLocal} usage={usage} />}
      {tab === "locations" && <LocationsTab local={local} patch={patchLocal} usage={usage} onNewListing={startNew} />}

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
              <span className="text-[13px] font-bold">Customer view — {viewing.draft.title || "listing"}</span>
              <button type="button" onClick={() => setViewing(null)} className="text-[22px] leading-none">×</button>
            </div>
            <ListingPreview draft={viewing.draft} local={local} runs={viewing.runs} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Listings tab: compact, searchable cards ────────────────────────────────
// Filter pills. A pill fills brand-blue while it's doing something, so the row
// shows the current state at a glance instead of a wall of empty controls. The
// native select chevron is replaced — it can't be recoloured for the filled state.
export function Pill({ active, onClear, children }: { active: boolean; onClear?: () => void; children: React.ReactNode }) {
  return (
    <span className="flex h-8 items-center gap-1.5 rounded-full border pl-3 pr-1 transition-colors"
      style={active ? { background: "var(--brand)", borderColor: "var(--brand)" } : { background: "var(--panel)", borderColor: "var(--line)" }}>
      {children}
      <button type="button" onClick={onClear} title={active ? "Clear" : undefined} aria-hidden={!active}
        className="mr-1 text-[13px] leading-none transition-opacity"
        style={active ? { color: "rgba(255,255,255,.75)" } : { opacity: 0, pointerEvents: "none", width: 0, marginRight: 0 }}>×</button>
    </span>
  );
}

export function PillSelect({ active, value, onChange, options, title }: { active: boolean; value: string; onChange: (v: string) => void; options: [string, string][]; title: string }) {
  return (
    <span className="relative flex items-center">
      <select value={value} onChange={(e) => onChange(e.target.value)} title={title}
        className="h-8 max-w-[165px] cursor-pointer appearance-none border-0 bg-transparent pr-4 text-[12.5px] font-semibold outline-none"
        style={{ color: active ? "#fff" : "var(--ink)" }}>
        {options.map(([v, label]) => (
          <option key={v} value={v} style={{ color: "var(--ink)" }}>
            {label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-0 text-[9px]" style={{ color: active ? "rgba(255,255,255,.8)" : "var(--ink-2)" }}>▼</span>
    </span>
  );
}

type SortKey = "soonest" | "latest" | "ending" | "capacity" | "booked" | "full" | "left" | "price" | "name";
const SORTS: [SortKey, string][] = [
  ["soonest", "Starting soonest"],
  ["latest", "Starting latest"],
  ["ending", "Ending soonest"],
  ["capacity", "Most places offered"],
  ["booked", "Most places booked"],
  ["full", "Highest % booked"],
  ["left", "Fewest places left"],
  ["price", "Price: low to high"],
  ["name", "Name A–Z"],
];

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
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "ended" | "draft">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [archiveTick, setArchiveTick] = useState(0);
  const [showArchived, setShowArchived] = useState(false);

  const [menuId, setMenuId] = useState<string | null>(null);
  const [venueFilter, setVenueFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  // Clicking Public/Hidden explains what it actually does — the words alone
  // don't tell an operator whether parents can still reach the listing.
  const [visNote, setVisNote] = useState<string | null>(null);
  const visNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setVisibility = (l: Listing, v: "public" | "hidden") => {
    onSetVisibility(l, v);
    setVisNote(l.id);
    if (visNoteTimer.current) clearTimeout(visNoteTimer.current);
    visNoteTimer.current = setTimeout(() => setVisNote(null), 8000);
  };
  useEffect(() => () => { if (visNoteTimer.current) clearTimeout(visNoteTimer.current); }, []);
  const [sortBy, setSortBy] = useState<SortKey>("soonest");

  const bookedCount = (l: Listing) => (l.blocks ?? []).reduce((s, b) => s + Math.max(0, b.capacity - b.spotsLeft), 0);
  async function duplicate(l: Listing) {
    try {
      // Copy the full server draft when there is one (the server strips
      // read-only fields like tenantId/blocks); legacy docs copy name+passes.
      const dr = serverDraft(l);
      const body = dr
        ? { ...dr, id: undefined, title: `${l.name} (copy)`, name: `${l.name} (copy)`, status: "draft", archived: false, passes: l.passes }
        : { name: `${l.name} (copy)`, passes: l.passes };
      const created = await apiPost<{ id: string }>("/api/listings", body);
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
  const archive = (l: Listing, v: boolean) => {
    api(`/api/listings/${encodeURIComponent(l.id)}`, { method: "PUT", body: JSON.stringify({ archived: v }) })
      .then(() => refresh())
      .catch((e) => onError(e instanceof Error ? e.message : "Archive failed"));
    setArchiveTick((t) => t + 1);
  };
  const copyLink = (l: Listing) => {
    const link = `${typeof window !== "undefined" ? window.location.origin : ""}/book/${l.id}`;
    navigator.clipboard?.writeText(link).then(() => { setCopiedId(l.id); setTimeout(() => setCopiedId(null), 1500); }).catch(() => {});
  };
  // The one-line "Book now" widget for the operator's OWN website — pastes
  // anywhere HTML goes (Wix/WordPress/Squarespace embed blocks included).
  const copyEmbed = (l: Listing) => {
    const snippet = `<script src="${typeof window !== "undefined" ? window.location.origin : ""}/embed.js" data-listing="${l.id}" async></script>`;
    navigator.clipboard?.writeText(snippet)
      .then(() => alert(`Copied! Paste this into your website's HTML for a "Book now" button:\n\n${snippet}\n\nTips:\n· add data-mode="inline" to embed the whole booking page instead of a button\n· on React/Next sites, put <div data-activityos-book="${l.id}"></div> where the button should go and load the script however you like`))
      .catch(() => {});
  };

  // Read localStorage once per render, then decorate each listing with the
  // numbers the filters, the sort and the card all need.
  const query = q.trim().toLowerCase();
  const allDrafts = loadDrafts();
  const rows = listings.map((l) => {
    const dr = serverDraft(l) ?? allDrafts[l.id];
    const info = dr ? listingRowInfo(dr) : null;
    const apiBlocks = l.blocks ?? [];
    const cap = apiBlocks.length ? apiBlocks.reduce((s2, b) => s2 + b.capacity, 0) : info?.capacity ?? null;
    const spaces = apiBlocks.length ? apiBlocks.reduce((s2, b) => s2 + b.spotsLeft, 0) : cap;
    const left = Math.max(0, spaces ?? cap ?? 0);
    const booked = Math.max(0, (cap ?? 0) - left);
    return {
      l, dr, info,
      vn: dr ? local.venues.find((v) => v.id === dr.venueId)?.name ?? "" : "",
      venueId: dr?.venueId ?? null,
      categoryIds: dr?.categoryIds ?? [],
      cap, spaces, left, booked,
      pct: cap && cap > 0 ? booked / cap : 0,
      from: l.passes.length ? Math.min(...l.passes.map((p) => p.price)) : Infinity,
      start: info?.from || "",
      end: info?.to || "",
      isLive: info ? info.live : true,
      isDraft: (dr?.status ?? "live") === "draft",
      archived: l.archived ?? getDraftArchived(l.id),
    };
  });

  const filtered = rows.filter((r) => {
    if (query && !`${r.l.name} ${r.vn} ${r.info?.dateLabel ?? ""}`.toLowerCase().includes(query)) return false;
    if (dateFilter && !(r.dr && listingRunsOn(r.dr, dateFilter))) return false;
    if (venueFilter && r.venueId !== venueFilter) return false;
    if (catFilter && !r.categoryIds.includes(catFilter)) return false;
    return true;
  });

  // Blank dates sort last whichever direction you pick — an undated listing
  // isn't "soonest".
  const byDate = (a: string, b: string, dir: 1 | -1) =>
    !a && !b ? 0 : !a ? 1 : !b ? -1 : a < b ? -dir : a > b ? dir : 0;
  const activeShown = filtered
    .filter((r) => !r.archived && (
      statusFilter === "all" ? true
      : statusFilter === "draft" ? r.isDraft
      : statusFilter === "live" ? (r.isLive && !r.isDraft)
      : (!r.isLive && !r.isDraft)))
    .sort((a, b) => {
      switch (sortBy) {
        case "latest": return byDate(a.start, b.start, -1);
        case "ending": return byDate(a.end, b.end, 1);
        case "capacity": return (b.cap ?? 0) - (a.cap ?? 0);
        case "booked": return b.booked - a.booked;
        case "full": return b.pct - a.pct;
        case "left": return a.left - b.left;
        case "price": return a.from - b.from;
        case "name": return a.l.name.localeCompare(b.l.name);
        default: return byDate(a.start, b.start, 1);
      }
    });
  const archivedList = listings.filter((l) => l.archived ?? getDraftArchived(l.id));
  const visibilityOf = (l: Listing) => l.visibility ?? getDraftVisibility(l.id);

  // Offer the whole library, not just what's already in use — an operator
  // looking for "Northampton" shouldn't have to know whether anything is
  // filed there yet. The counts show which are actually populated.
  const countBy = (pick: (r: (typeof rows)[number]) => boolean) => rows.filter((r) => !r.archived && pick(r)).length;
  const venueOpts = local.venues.map((v) => ({ id: v.id, name: v.name, n: countBy((r) => r.venueId === v.id) }));
  const catOpts = local.categories.map((c) => ({ id: c.id, name: c.name, n: countBy((r) => r.categoryIds.includes(c.id)) }));

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
      {/* Filter pills — each control is a pill that fills brand-blue once it's
          actually narrowing the list, so the row reads as state, not chrome. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 sm:max-w-[260px]">
          <svg viewBox="0 0 16 16" fill="none" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-3)] opacity-60">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.7" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search listings…"
            className="h-8 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] pl-[32px] pr-3 text-[12.5px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-2)] focus:border-[var(--brand-2)]" />
        </div>

        {venueOpts.length > 0 && (
          <Pill active={!!venueFilter} onClear={() => setVenueFilter("")}>
            <PillSelect active={!!venueFilter} value={venueFilter} onChange={setVenueFilter} title="Filter by location"
              options={[["", "All locations"], ...venueOpts.map((v) => [v.id, `${v.name} (${v.n})`] as [string, string])]} />
          </Pill>
        )}

        {catOpts.length > 0 && (
          <Pill active={!!catFilter} onClear={() => setCatFilter("")}>
            <PillSelect active={!!catFilter} value={catFilter} onChange={setCatFilter} title="Filter by category"
              options={[["", "All categories"], ...catOpts.map((c) => [c.id, `${c.name} (${c.n})`] as [string, string])]} />
          </Pill>
        )}

        <Pill active={sortBy !== "soonest"} onClear={() => setSortBy("soonest")}>
          <PillSelect active={sortBy !== "soonest"} value={sortBy} onChange={(v) => setSortBy(v as SortKey)} title="Sort the list"
            options={SORTS.map(([k, label]) => [k, label] as [string, string])} />
        </Pill>

        <Pill active={!!dateFilter} onClear={() => setDateFilter("")}>
          <span className="whitespace-nowrap text-[12.5px] font-semibold" style={{ color: dateFilter ? "#fff" : "var(--ink)" }}>Runs on</span>
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
            className="h-full w-[112px] border-0 bg-transparent text-[12.5px] font-semibold outline-none"
            style={{ color: dateFilter ? "#fff" : "var(--ink)", colorScheme: dateFilter ? "dark" : "light" }} />
        </Pill>

        {(q || dateFilter || venueFilter || catFilter || sortBy !== "soonest") && (
          <button type="button" title="Clear every filter"
            onClick={() => { setQ(""); setDateFilter(""); setVenueFilter(""); setCatFilter(""); setSortBy("soonest"); }}
            className="h-8 px-1 text-[11.5px] font-semibold text-[var(--ink-3)] hover:text-[var(--ink)] hover:underline">Reset</button>
        )}

        <span className="ml-auto flex h-8 items-center gap-0.5 rounded-full border border-[var(--line)] bg-[var(--panel)] p-0.5 text-[11.5px] font-semibold">
          {([["all", "All"], ["live", "Published"], ["draft", "Unpublished"], ["ended", "Ended"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setStatusFilter(k)} className="h-full rounded-full px-3 transition-colors"
              style={statusFilter === k ? { background: "var(--brand)", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
          ))}
        </span>
      </div>
      {activeShown.length === 0 ? (
        <Card className="p-5 text-center text-[12.5px] text-[var(--ink-3)]">{q || dateFilter || venueFilter || catFilter ? `No listings match your filters${dateFilter ? " on that date" : ""}.` : "No active listings — check Archived below."}</Card>
      ) : (
        activeShown.map(({ l, info, vn, cap, spaces, isLive, isDraft }) => {
          return (
            <Card key={l.id} className="overflow-visible p-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-20px_rgba(20,35,90,.35)]">
              <div className="flex flex-col sm:flex-row">
                {/* date rail — when it runs, read first */}
                <div className="flex flex-none flex-row items-center justify-center gap-3 px-4 py-3 text-white sm:w-[92px] sm:flex-col sm:gap-0 sm:rounded-l-xl sm:py-4" style={{ background: "var(--side-bg)" }}>
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
                    {isDraft ? (
                      <span title="Not published — parents can't see or book this" className="rounded-full px-2 py-[2px] text-[10px] font-semibold" style={{ background: "#fff7ed", color: "#9a3412" }}>Unpublished</span>
                    ) : isLive ? (
                      <span title="Published and still to run — parents can find and book it" className="inline-flex items-center gap-1 rounded-full bg-[var(--green-soft,#e7f8ee)] px-2 py-[2px] text-[10px] font-semibold text-[#0f7a44]"><span className="inline-block h-1.5 w-1.5 rounded-full bg-[#16a34a]" />Published</span>
                    ) : (
                      <span title="Published, but the last date has passed" className="rounded-full bg-[var(--surface)] px-2 py-[2px] text-[10px] font-semibold text-[var(--ink-3)]">Ended</span>
                    )}
                    {info?.opensAt && info.opensAt > nowLocal() && (
                      <span title="Parents can see this listing but can't book until then" className="rounded-full bg-[#fff7ed] px-2 py-[2px] text-[10px] font-semibold text-[#9a3412]">⏰ Opens {openLabel(info.opensAt)}</span>
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
                        const on = visibilityOf(l) === v;
                        return <button key={v} type="button" onClick={() => setVisibility(l, v)} title={v === "public" ? "Listed on your booking page — parents can find and book it" : "Unlisted — off your booking page, but the direct link still books"} className="px-2.5 py-1 transition-colors" style={on ? { background: "var(--brand-soft)", color: "var(--brand-ink)" } : { color: "var(--ink-3)" }}>{v === "public" ? "Public" : "Hidden"}</button>;
                      })}
                    </span>
                    {visNote === l.id && (
                      <div className="order-last w-full rounded-lg border px-3 py-2 text-[11.5px] leading-[1.5]"
                        style={visibilityOf(l) === "public"
                          ? { background: "var(--brand-soft)", borderColor: "transparent", color: "var(--brand-ink)" }
                          : { background: "#fff7ed", borderColor: "#fed7aa", color: "#9a3412" }}>
                        {visibilityOf(l) === "public" ? (
                          <><b>Public</b> — listed on your booking page. Any parent can find it, see the prices and book a place.</>
                        ) : (
                          <><b>Hidden</b> — not listed on your booking page, so parents can&rsquo;t find it by browsing. Anyone you send the <b>🔗 Link</b> to can still book as normal — handy for a private group, a school, or returning families.</>
                        )}
                      </div>
                    )}
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
                                { label: "</> Embed on my website", fn: () => copyEmbed(l) },
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

                {/* cover, on the right */}
                <div className="order-first h-[150px] w-full flex-none overflow-hidden sm:order-last sm:h-auto sm:w-[230px] sm:self-stretch sm:rounded-r-xl">
                  {info?.cover ? (
                    <CroppedImage im={{ ...info.cover, x: 50, y: 50 }} className="h-full w-full" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--surface)] text-[26px]">🏕️</div>
                  )}
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
  usage,
}: {
  local: LocalState;
  patch: (fn: (s: LocalState) => LocalState) => void;
  usage: { cats: Record<string, number>; venues: Record<string, number> };
}) {
  const [name, setName] = useState("");
  const add = () => {
    if (name.trim().length < 2) return;
    patch((s) => ({ ...s, categories: [...s.categories, { id: uid(), name: name.trim() }] }));
    setName("");
  };
  const remove = (id: string, nm: string) => {
    const n = usage.cats[id] ?? 0;
    const warn = n > 0 ? `\n\n${n} listing${n === 1 ? " uses" : "s use"} it — they'll lose this category.` : "";
    if (!confirm(`Delete category “${nm}”?${warn}`)) return;
    patch((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id) }));
  };

  return (
    <Card className="p-4">
      <div className="text-[15px] font-extrabold">Categories</div>
      <p className="mb-3 text-[12px] text-[var(--ink-3)]">
        Categories are how parents filter your storefront. These are the options offered when you
        build a listing.
      </p>

      {/* Add first — this page is mostly visited to put something new in it. */}
      <div className="mb-3.5 flex gap-1.5">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New category name"
          className="w-[240px]"
        />
        <Button variant="primary" onClick={add}>＋ Add category</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {local.categories.map((c) => {
          const n = usage.cats[c.id] ?? 0;
          return (
            <span
              key={c.id}
              title={n ? `Used by ${n} listing${n === 1 ? "" : "s"}` : "Not used by any listing yet"}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] py-1.5 pl-3.5 pr-1.5 text-[12.5px] font-bold"
            >
              {c.name}
              {/* The count is the whole point — it's how you spot a dead category. */}
              <span className="rounded-full px-1.5 py-[1px] text-[11px] font-bold"
                style={n ? { background: "var(--brand-soft)", color: "var(--brand-ink)" } : { background: "var(--surface)", color: "var(--ink-3)" }}>{n}</span>
              <button
                type="button"
                onClick={() => remove(c.id, c.name)}
                aria-label={`Delete ${c.name}`}
                className="px-1 text-[var(--ink-3)] hover:text-[var(--red)]"
              >
                ✕
              </button>
            </span>
          );
        })}
        {local.categories.length === 0 && (
          <span className="text-[12px] text-[var(--ink-3)]">No categories yet — add your first above.</span>
        )}
      </div>
    </Card>
  );
}

// ── Locations tab ──────────────────────────────────────────────────────────
function LocationsTab({
  local,
  patch,
  usage,
  onNewListing,
}: {
  local: LocalState;
  patch: (fn: (s: LocalState) => LocalState) => void;
  usage: { cats: Record<string, number>; venues: Record<string, number> };
  onNewListing: (venueId?: string) => void;
}) {
  const [selId, setSelId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [nm, setNm] = useState("");
  const [addr, setAddr] = useState("");

  const sel = local.venues.find((v) => v.id === selId) ?? local.venues[0] ?? null;
  const wh = whereHeading(local);

  const addVenue = () => {
    if (nm.trim().length < 2) return;
    const id = uid();
    patch((s) => ({ ...s, venues: [...s.venues, { id, name: nm.trim(), address: addr.trim() }] }));
    setNm("");
    setAddr("");
    setAdding(false);
    setSelId(id);
  };
  // Everything here writes straight through to the saved venue — the panel has
  // no separate save button by design.
  const setPin = (id: string, patchV: Partial<Venue>) =>
    patch((s) => ({ ...s, venues: s.venues.map((v) => (v.id === id ? { ...v, ...patchV } : v)) }));
  const updateVenue = (id: string, field: "name" | "address" | "city", value: string) =>
    patch((s) => ({ ...s, venues: s.venues.map((v) => (v.id === id ? { ...v, [field]: value } : v)) }));
  const removeVenue = (id: string, name: string) => {
    const n = usage.venues[id] ?? 0;
    const warn = n > 0 ? `\n\n${n} listing${n === 1 ? " runs" : "s run"} there — they'll lose their venue.` : "";
    if (!confirm(`Delete venue “${name}”?${warn}`)) return;
    patch((s) => ({ ...s, venues: s.venues.filter((v) => v.id !== id) }));
    if (selId === id) setSelId(null);
  };

  return (
    <Card className="p-4">
      <div className="text-[15px] font-extrabold">Locations</div>
      <p className="mb-3 text-[12px] text-[var(--ink-3)]">
        Your venues. Pick one per listing — the address is set here once and reused everywhere.
      </p>

      {/* Set once here rather than per listing — the venue section reads the
          same on every customer page. */}
      <details className="mb-3 max-w-[900px] rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <summary className="cursor-pointer list-none px-3 py-2 text-[11.5px] font-bold text-[var(--brand-ink)] [&::-webkit-details-marker]:hidden">
          ✎ Section heading on customer pages — <span className="font-semibold text-[var(--ink-3)]">{wh.eyebrow} · {wh.title}</span>
        </summary>
        <div className="flex flex-wrap gap-2 px-3 pb-3">
          <div>
            <FieldLabel>Small label</FieldLabel>
            <Input value={local.whereHeading?.eyebrow ?? ""} placeholder={WHERE_HEAD_DEFAULT.eyebrow} className="w-[180px]"
              onChange={(e) => patch((s) => ({ ...s, whereHeading: { eyebrow: e.target.value, title: s.whereHeading?.title ?? "" } }))} />
          </div>
          <div>
            <FieldLabel>Heading</FieldLabel>
            <Input value={local.whereHeading?.title ?? ""} placeholder={WHERE_HEAD_DEFAULT.title} className="w-[200px]"
              onChange={(e) => patch((s) => ({ ...s, whereHeading: { eyebrow: s.whereHeading?.eyebrow ?? "", title: e.target.value } }))} />
          </div>
        </div>
      </details>

      {/* Capped so the rows don't stretch across a wide screen — long thin rows
          beside a small map read badly, and the map gets more of the width. */}
      <div className="grid max-w-[900px] gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-1.5">
          {local.venues.map((v, i) => {
            const on = sel?.id === v.id;
            const n = usage.venues[v.id] ?? 0;
            return (
              <div
                key={v.id}
                className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors"
                style={on ? { borderColor: "var(--brand-line)", background: "var(--brand-soft)" } : { borderColor: "var(--line)", background: "var(--panel)" }}
              >
                {/* Numbered so a row and its map pin are obviously the same thing. */}
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-[12px] font-extrabold"
                  style={on ? { background: "var(--side-bg)", color: "#fff" } : { background: "var(--surface)", color: "var(--ink-3)" }}>{v.kind === "online" ? "💻" : i + 1}</span>
                <button type="button" onClick={() => setSelId(v.id)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-[13px] font-bold">{v.name}</div>
                  <div className="truncate text-[11.5px] text-[var(--ink-3)]">
                    {v.kind === "online" ? "Runs online" : v.address || "No address yet"} · {n ? `${n} listing${n === 1 ? "" : "s"}` : "not used yet"}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => removeVenue(v.id, v.name)}
                  aria-label={`Delete ${v.name}`}
                  className="px-1 text-[13px] text-[var(--ink-3)] hover:text-[var(--red)]"
                >
                  ✕
                </button>
              </div>
            );
          })}

          {local.venues.length === 0 && !adding && (
            <div className="rounded-xl border border-dashed border-[var(--line)] p-4 text-center text-[12px] text-[var(--ink-3)]">
              No venues yet — add your first below.
            </div>
          )}

          {adding ? (
            <div className="mt-1 flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5 sm:flex-row sm:items-end">
              <div className="flex-1">
                <FieldLabel>Venue name</FieldLabel>
                <Input value={nm} onChange={(e) => setNm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addVenue()} placeholder="e.g. Riverside Sports Hall" className="w-full" />
              </div>
              <div className="flex-1">
                <FieldLabel>Address</FieldLabel>
                <Input value={addr} onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addVenue()} placeholder="Street, town, postcode" className="w-full" />
              </div>
              <div className="flex gap-1.5">
                <Button variant="primary" onClick={addVenue}>Add</Button>
                <Button onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Button variant="primary" onClick={() => setAdding(true)}>＋ Add location</Button>
              {/* Not every listing has an address — online clubs and tutoring
                  still need something to point a listing at. */}
              <Button onClick={() => {
                const id = uid();
                patch((st) => ({ ...st, venues: [...st.venues, { id, name: "Online", address: "", kind: "online" }] }));
                setSelId(id);
              }}>💻 Add online</Button>
            </div>
          )}
        </div>

        {/* Map + details for whichever venue is selected. */}
        <div className="flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          {sel ? (
            <>
              {sel.kind === "online" ? (
                <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[11.5px] leading-[1.5] text-[var(--ink-2)]">
                  💻 <b>Runs online.</b> No address, map or travel details — parents see the joining
                  instructions you write below.
                </div>
              ) : sel.lat !== undefined ? (
                <VenueMap lat={sel.lat} lng={sel.lng} zoom={sel.zoom} onZoom={(z) => setPin(sel.id, { zoom: z })} />
              ) : (
                <div className="flex h-[160px] items-center justify-center rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 text-center text-[11.5px] leading-[1.5] text-[var(--ink-3)]">
                  Use <b className="mx-1">Find</b> below to drop a pin, or type the address in by hand.
                </div>
              )}
              {sel.kind !== "online" && <AddressFinder onPick={(h) => setPin(sel.id, { lat: h.lat, lng: h.lng, address: tidyAddress(h.label), zoom: sel.zoom ?? 16 })} />}
              <div>
                <FieldLabel>Venue name</FieldLabel>
                <Input value={sel.name} onChange={(e) => updateVenue(sel.id, "name", e.target.value)} className="w-full" />
              </div>
              {sel.kind !== "online" && (
                <div>
                  <FieldLabel>Address <span className="font-normal text-[var(--ink-3)]">— edit freely</span></FieldLabel>
                  <Input value={sel.address} onChange={(e) => updateVenue(sel.id, "address", e.target.value)} placeholder="Street, town, postcode" className="w-full" />
                </div>
              )}
              {sel.kind !== "online" && (
                <div>
                  <FieldLabel>Town / city <span className="font-normal text-[var(--ink-3)]">— parents filter by this</span></FieldLabel>
                  <Input value={sel.city ?? ""} onChange={(e) => updateVenue(sel.id, "city", e.target.value)} placeholder="e.g. Northampton" className="w-full max-w-[280px]" />
                </div>
              )}
              {sel.lat !== undefined && (
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--ink-3)]">
                  <span>📍 Pin saved</span>
                  <button type="button" onClick={() => setPin(sel.id, { lat: undefined, lng: undefined })} className="underline hover:text-[var(--ink)]">Remove</button>
                </div>
              )}

              {/* Both of these show on the customer page — the questions parents
                  ask before they book, answered once per venue. */}
              {sel.kind !== "online" && (
              <div className="border-t border-[var(--line)] pt-2">
                <FieldLabel>What&rsquo;s there</FieldLabel>
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {(sel.facilities ?? []).map((f) => (
                    <span key={f} className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-line)] bg-[var(--brand-soft)] py-1 pl-2.5 pr-1 text-[11.5px] font-semibold text-[var(--brand-ink)]">
                      {f}
                      <button type="button" onClick={() => setPin(sel.id, { facilities: (sel.facilities ?? []).filter((x) => x !== f) })}
                        aria-label={`Remove ${f}`} className="px-1 text-[var(--ink-3)] hover:text-[var(--red)]">✕</button>
                    </span>
                  ))}
                  {!(sel.facilities ?? []).length && <span className="text-[11.5px] text-[var(--ink-3)]">Nothing added yet.</span>}
                </div>
                <div className="mb-1.5 text-[10.5px] leading-[1.4] text-[var(--ink-3)]">
                  Accessibility and what&rsquo;s provided are set per listing (steps 3 &amp; 4) — this is the venue itself.
                </div>
                <div className="flex flex-wrap gap-1">
                  {FACILITIES.filter((f) => !(sel.facilities ?? []).includes(f)).map((f) => (
                    <button key={f} type="button" onClick={() => setPin(sel.id, { facilities: [...(sel.facilities ?? []), f] })}
                      className="rounded-full border border-dashed border-[var(--line)] px-2 py-[3px] text-[11px] font-semibold text-[var(--ink-3)] hover:border-[var(--brand-2)] hover:text-[var(--brand)]">+ {f}</button>
                  ))}
                </div>
              </div>
              )}

              {sel.kind !== "online" && (
              <div className="flex flex-wrap gap-2">
                <div className="min-w-[135px] flex-1">
                  <FieldLabel>what3words</FieldLabel>
                  <Input value={sel.what3words ?? ""} onChange={(e) => setPin(sel.id, { what3words: e.target.value })}
                    placeholder="///filled.count.soap" className="w-full" />
                </div>
                <div className="min-w-[135px] flex-1">
                  <FieldLabel>Nearest stop / station</FieldLabel>
                  <Input value={sel.transport ?? ""} onChange={(e) => setPin(sel.id, { transport: e.target.value })}
                    placeholder="Purbeck Rd bus stop, 3 min" className="w-full" />
                </div>
              </div>
              )}

              <div>
                <FieldLabel>{sel.kind === "online" ? "How to join" : "Getting there & parking"}</FieldLabel>
                <textarea
                  value={sel.directions ?? ""}
                  onChange={(e) => setPin(sel.id, { directions: e.target.value })}
                  rows={3}
                  placeholder={sel.kind === "online"
                    ? "A Zoom link is emailed the day before. Sessions start on the hour — please join a few minutes early."
                    : "Free car park off Purbeck Road. Drop-off at the main entrance — please don't use the leisure centre bays."}
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2 text-[12.5px] leading-[1.5] text-[var(--ink)] outline-none placeholder:text-[var(--ink-2)] focus:border-[var(--brand-2)]"
                />
              </div>
              <div className="mt-0.5 border-t border-[var(--line)] pt-2 text-[11.5px] text-[var(--ink-3)]">
                {usage.venues[sel.id] ? (
                  <>Used by <b className="text-[var(--ink)]">{usage.venues[sel.id]}</b> listing{usage.venues[sel.id] === 1 ? "" : "s"}.</>
                ) : (
                  <>Nothing runs here yet.{" "}
                    <button type="button" onClick={() => onNewListing(sel.id)} className="font-bold text-[var(--brand)] underline">Create a listing here</button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[180px] items-center justify-center text-center text-[12px] text-[var(--ink-3)]">
              Add a venue to see it on the map.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Venue facts only — what the building has and how you reach it.
 * Deliberately excludes accessibility and what's provided (water, lunch,
 * equipment): those are set per listing in steps 3 and 4, and duplicating them
 * here would mean two places to keep in step.
 */
const FACILITIES = [
  "Free car park", "On-street parking only", "Drop-off zone", "Bike racks",
  "Indoor sports hall", "Astro pitch", "Floodlit", "Changing rooms",
  "Café on site", "Covered area if wet",
];

type Hit = { label: string; lat: number; lng: number };

/**
 * Nominatim returns the full chain — "Venue, Road, Ward, Suburb, Town, County,
 * England, Postcode, United Kingdom". Keep what an operator would actually
 * write: the first couple of parts, the town, and the postcode.
 */
function tidyAddress(label: string): string {
  const parts = label.split(",").map((p) => p.trim()).filter(Boolean);
  const isPostcode = (p: string) => /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(p);
  const postcode = parts.find(isPostcode);
  const body = parts.filter(
    (p) => !isPostcode(p) && !/^(United Kingdom|England|Scotland|Wales|Northern Ireland)$/i.test(p) && !/^(City|County|Borough) of /i.test(p),
  );
  const keep = body.length <= 3 ? body : [...body.slice(0, 2), body[body.length - 1]];
  return [...keep, ...(postcode ? [postcode] : [])].join(", ");
}

/**
 * Address lookup via OUR server (`/api/geo/search`) — the browser never calls
 * a geocoder directly, so no map key or third-party request leaks to the
 * client or to embeds on providers' own sites. Searches on demand (not per
 * keystroke) to keep the volume down.
 */
function AddressFinder({ onPick }: { onPick: (hit: Hit) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  const search = async () => {
    const term = q.trim();
    if (term.length < 3) return;
    setState("busy");
    setHits(null);
    try {
      const raw = await apiGet<{ label: string; lat: number; lng: number }[]>(
        `/api/geo/search?q=${encodeURIComponent(term)}`,
      );
      setHits(raw.map((h) => ({ label: h.label, lat: h.lat, lng: h.lng })));
      setState("idle");
    } catch {
      setState("error");
    }
  };

  return (
    <div>
      <FieldLabel>Find address</FieldLabel>
      <div className="flex gap-1.5">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }}
          placeholder="Postcode or address…"
          className="w-full"
        />
        <Button onClick={() => void search()} disabled={state === "busy"}>{state === "busy" ? "…" : "Find"}</Button>
      </div>

      {state === "error" && (
        <div className="mt-1.5 text-[11.5px] text-[var(--red)]">Couldn&rsquo;t reach the address service — type the address in by hand below.</div>
      )}
      {hits?.length === 0 && (
        <div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">No match. Try the postcode on its own, or type it in by hand below.</div>
      )}
      {!!hits?.length && (
        <div className="mt-1.5 max-h-[132px] overflow-y-auto rounded-lg border border-[var(--line)]">
          {hits.map((h, i) => (
            <button key={i} type="button" onClick={() => { onPick(h); setHits(null); setQ(""); }}
              className="block w-full border-b border-[var(--line)] px-2.5 py-1.5 text-left text-[11.5px] leading-[1.4] last:border-b-0 hover:bg-[var(--surface)]">
              {h.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
