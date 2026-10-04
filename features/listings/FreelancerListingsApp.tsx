"use client";

import { dateLocale as dl } from "@/lib/i18n/format";
import { useT, useI18n, tNow } from "@/lib/i18n/provider";
import { Rich } from "@/components/i18n/Rich";
import { pickPlural } from "@/lib/i18n/plural";
import { isRTL } from "@/lib/i18n/config";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { firebaseAuth } from "@/lib/firebase/client";
import { money } from "@/features/bookings/helpers";
import { Button, Card, FieldLabel, Input } from "@/components/ui";
import { PageHero } from "@/components/OperatorPage";
import { TourLauncher } from "@/features/common/TourLauncher";
import { useTenantSettings } from "@/lib/settings";
import { useFranchises } from "@/components/franchise/HoScope";
import { VenueMap } from "./VenueMap";
import { BlocksApp } from "@/features/blocks/BlocksApp";
import { DEMO_STAFF } from "@/features/learning/credentials";
import { optionLabel, whereHeading, WHERE_HEAD_DEFAULT, ListingWizard, CroppedImage, listingRowInfo, listingRunsOn, emptyDraft, loadDrafts, deleteDraft, getDraftVisibility, getDraftArchived, copyDraft, draftFromListing, type ServerListing, type WizardDraft } from "./ListingWizard";

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
  toBring: string[];
  safety: string[];
  send: string[];
  outcomes: string[];
  addons: AddonTemplate[];
  staff: StaffMember[];
  emojis: Record<string, string>;
}

// Date-rail formatting for the listing card.
const monthOf = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(dl(), { month: "short", timeZone: "UTC" });
const dayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDate();
// Scheduled-open badge. Compared as local strings, matching the datetime-local
// input the operator typed — no timezone shifting.
const nowLocal = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(t.getHours())}:${p(t.getMinutes())}`; };
const openLabel = (v: string) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const time = d.getMinutes() ? d.toLocaleTimeString(dl(), { hour: "numeric", minute: "2-digit" }) : d.toLocaleTimeString(dl(), { hour: "numeric" });
  return `${d.getDate()} ${d.toLocaleDateString(dl(), { month: "short" })}, ${time.replace(/\s/g, "").toLowerCase()}`;
};
const shortDate = (iso: string) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(dl(), { day: "numeric", month: "short", timeZone: "UTC" }) : tNow("p8lst.flTbc");

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
    // No seeded venues — a real provider adds their own. (Pre-filling demo
    // venues showed brand-new operators addresses that weren't theirs.)
    venues: [],
    provided: ["Lunch", "Snacks", "All equipment", "Materials", "Water", "Certificate"],
    toBring: ["Sun cream", "Water bottle", "Packed lunch", "Change of clothes"],
    safety: ["DBS-checked staff", "First aid on site", "Safeguarding lead", "Low ratios", "Secure venue"],
    send: ["Wheelchair accessible", "1:1 support available", "Quiet space", "Visual timetables", "SEND-trained staff"],
    outcomes: ["Teamwork", "Confidence", "New skills", "Physical activity", "Creativity", "Making friends"],
    addons: [],
    // Just you. It used to be topped up with six fabricated demo staff (Marcus
    // Bell, Jess Patel…), and emptying the list re-uploaded them to the tenant,
    // where they could be picked onto a listing and shown to parents as the
    // people looking after their children.
    staff: [
      { id: uid(), first: myName().split(" ")[0] || "Me", last: myName().split(" ").slice(1).join(" "), bio: "" },
    ],
    emojis: {},
  };
}
/** A fabricated demo team member (name AND role both match) — never real staff. */
const DEMO_STAFF_KEYS = new Set(DEMO_STAFF.map((d) => `${d.name}|${d.role}`.toLowerCase()));
const isDemoStaff = (s: StaffMember) => DEMO_STAFF_KEYS.has(`${`${s.first ?? ""} ${s.last ?? ""}`.trim()}|${s.bio ?? ""}`.toLowerCase());
// The old manual/demo venues, stripped from any saved state on load (see below).
const DEMO_VENUES = new Set([
  "Stantonbury Leisure Centre|Purbeck, Milton Keynes MK14 6BN",
  "Northampton Sports Hub|Gladstone Rd, Northampton NN5 7EA",
  "Bedford Woodland Centre|Mowsbury Park, Bedford MK41 8DH",
]);
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
    const mappedStaff = rawStaff.length
      ? rawStaff.map((s) => (typeof s === "string" ? { id: uid(), first: s.split(" ")[0], last: s.split(" ").slice(1).join(" "), bio: "" } : s))
      : seed.staff;
    const staff = mappedStaff.filter((m) => !isDemoStaff(m));
    return {
      categories: p.categories ?? seed.categories,
      // Strip the old demo venues from any state that saved them before the
      // seed was emptied — a real provider should never see them.
      venues: (p.venues ?? seed.venues).filter((v) => !DEMO_VENUES.has(`${v.name}|${v.address ?? ""}`)),
      provided: p.provided ?? seed.provided,
      toBring: p.toBring ?? seed.toBring,
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

type Tab = "locations" | "blocks" | "listings";

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


/** Freelancer Listings — manual layout, Phase A. */
export function FreelancerListingsApp() {
  const t9 = useT();
  // Allow a deep-link to a tab (e.g. the walkthrough's "set up your locations"
  // link → ?tab=locations) while defaulting to the Listings tab.
  const initialTab = (): Tab => {
    if (typeof window === "undefined") return "listings";
    const t = new URLSearchParams(window.location.search).get("tab");
    return t === "blocks" || t === "locations" ? t : "listings";
  };
  const [tab, setTab] = useState<Tab>(initialTab);
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<LocalState | null>(null);
  const [wizard, setWizard] = useState<{ draft: WizardDraft; key: string } | null>(null);
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
          setError(e instanceof Error ? e.message : t9("p8lst.laLoadFailed"));
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
          // Demo staff already uploaded to the tenant are dropped from view (and
          // from the next save).
          if (merged.staff?.length) merged.staff = merged.staff.filter((m) => !isDemoStaff(m));
          const cached = loadLocal();
          // Not "staff": an empty team is a real answer, and this browser's copy
          // is exactly where the demo team used to come back from.
          const listKeys = ["addons", "categories", "venues", "provided", "toBring", "safety", "send", "outcomes"] as const;
          let recovered = false;
          for (const k of listKeys) {
            if ((merged[k]?.length ?? 0) === 0 && (cached[k]?.length ?? 0) > 0) {
              (merged as unknown as Record<string, unknown>)[k] = cached[k];
              recovered = true;
            }
          }
          setLocal(merged);
          if (recovered) void putLibrary(merged).catch((e) => setError(e instanceof Error ? e.message : t9("p8lst.flLibFail")));
        }
        else {
          const start = loadLocal();
          setLocal(start);
          void putLibrary(start).catch((e) => setError(e instanceof Error ? e.message : t9("p8lst.flLibFail")));
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
      () => void putLibrary(local).catch((e) => setError(e instanceof Error ? e.message : t9("p8lst.flLibFail2"))),
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
            <div className="font-bold">{t9("p8lst.flCantLoad")}</div>
            <div className="mt-1">{error}</div>
            <button type="button" onClick={refresh} className="mt-2 font-bold underline">
              {t9("p8lst.flTryAgain")}
            </button>
          </div>
        ) : (
          <span className="text-[var(--ink-3)]">{t9("p8lst.flLoading")}</span>
        )}
      </div>
    );

  // Left→right as the natural build order: where → when/pricing → the listing.
  const TABS: [Tab, string][] = [
    ["locations", t9("p8lst.flTabLocations")],
    ["blocks", t9("p8lst.flTabBlocks")],
    ["listings", t9("p8lst.flTabListings")],
  ];

  return (
    <div
      className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5"
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
      <PageHero
        title={t9("p8lst.flHeroTitle")}
        lede={t9("p8lst.flHeroLede")}
        icon="🎫"
        actions={<>
          <TourLauncher view={tab === "blocks" ? "blocks" : "listings"} compact />
          {tab === "listings" && (
          <>
            <button
              type="button"
              onClick={() => {
                // The whole-storefront widget for the operator's own website.
                const tid = (listings?.[0] as { tenantId?: string } | undefined)?.tenantId;
                if (!tid) {
                  alert(t9("p8lst.flEmbedNeed"));
                  return;
                }
                const snippet = `<script src="${window.location.origin}/embed.js" data-store="${tid}" async></script>`;
                navigator.clipboard?.writeText(snippet).then(() =>
                  alert(t9("p8lst.flEmbedStoreAlert", { snippet, tid })),
                ).catch(() => {});
              }}
              className="rounded-full bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] font-extrabold text-[#2f5fd0] shadow-sm transition hover:bg-white/10"
            >
              {t9("p8lst.flEmbedBtn")}
            </button>
            <button
              type="button"
              onClick={() => startNew()}
              className="rounded-full bg-[#EE1F63] px-3.5 py-1.5 text-[12.5px] font-extrabold text-white shadow-sm transition hover:brightness-110"
            >
              {t9("p8lst.flNewBtn")}
            </button>
          </>
          )}
        </>}
      />

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
            {t9("p8lst.flDismiss")}
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
          onDeleteDraft={(key) => { if (confirm(t9("p8lst.flDraftDelConfirm"))) { deleteDraft(key); setTick((t) => t + 1); } }}
          onSetVisibility={(l, vis) => {
            api(`/api/listings/${encodeURIComponent(l.id)}`, { method: "PUT", body: JSON.stringify({ visibility: vis }) })
              .then(() => refresh())
              .catch((e) => setError(e instanceof Error ? e.message : t9("p8lst.flVisFail")));
            setTick((t) => t + 1);
          }}
          visTick={tick}
          onError={setError}
          refresh={refresh}
        />
      )}
      {tab === "blocks" && <BlocksApp embedded />}
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

    </div>
  );
}

// ── Listings tab: compact, searchable cards ────────────────────────────────
// Filter pills. A pill fills brand-blue while it's doing something, so the row
// shows the current state at a glance instead of a wall of empty controls. The
// native select chevron is replaced — it can't be recoloured for the filled state.
export function Pill({ active, onClear, children }: { active: boolean; onClear?: () => void; children: React.ReactNode }) {
  const t = useT();
  return (
    <span className="flex h-8 items-center gap-1.5 rounded-full border ps-3 pe-1 transition-colors"
      style={active ? { background: "var(--brand)", borderColor: "var(--brand)" } : { background: "var(--panel)", borderColor: "var(--line)" }}>
      {children}
      <button type="button" onClick={onClear} title={active ? t("p8lst.flClear") : undefined} aria-hidden={!active}
        className="me-1 text-[13px] leading-none transition-opacity"
        style={active ? { color: "rgba(255,255,255,.75)" } : { opacity: 0, pointerEvents: "none", width: 0, marginInlineEnd: 0 }}>×</button>
    </span>
  );
}

export function PillSelect({ active, value, onChange, options, title }: { active: boolean; value: string; onChange: (v: string) => void; options: [string, string][]; title: string }) {
  return (
    <span className="relative flex items-center">
      <select value={value} onChange={(e) => onChange(e.target.value)} title={title}
        className="h-8 max-w-[165px] cursor-pointer appearance-none border-0 bg-transparent pe-4 text-[12.5px] font-semibold outline-none"
        style={{ color: active ? "#fff" : "var(--ink)" }}>
        {options.map(([v, label]) => (
          <option key={v} value={v} style={{ color: "var(--ink)" }}>
            {label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute end-0 text-[9px]" style={{ color: active ? "rgba(255,255,255,.8)" : "var(--ink-2)" }}>▼</span>
    </span>
  );
}

type SortKey = "soonest" | "latest" | "ending" | "capacity" | "booked" | "full" | "left" | "price" | "name";
const SORT_KEYS: [SortKey, string][] = [
  ["soonest", "flSortSoonest"],
  ["latest", "flSortLatest"],
  ["ending", "flSortEnding"],
  ["capacity", "flSortCapacity"],
  ["booked", "flSortBooked"],
  ["full", "flSortFull"],
  ["left", "flSortLeft"],
  ["price", "flSortPrice"],
  ["name", "flSortName"],
];

function ListingsTab({
  listings,
  drafts,
  local,
  onEdit,
  onResume,
  onDeleteDraft,
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
  onSetVisibility: (l: Listing, vis: "public" | "hidden") => void;
  visTick: number;
  onError: (m: string) => void;
  refresh: () => Promise<Listing[] | null>;
}) {
  const t = useT();
  const { locale } = useI18n();
  const rtl = isRTL(locale);
  // Head office only (the API sends franchiseId only to it, and only an HO has franchises): who owns each listing.
  const hoFranchises = useFranchises();
  const ownerOf = hoFranchises && hoFranchises.length > 0
    ? (l: Listing) => (l.franchiseId ? hoFranchises.find((x) => x.franchiseId === l.franchiseId)?.name ?? l.franchiseId : t("p8lst.ownerHq"))
    : null;
  const [q, setQ] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "ended" | "draft">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [linkWarnId, setLinkWarnId] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<Listing | null>(null);
  const [archiveTick, setArchiveTick] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  // Confirmation + undo so archiving doesn't feel like the listing vanished.
  const [justArchived, setJustArchived] = useState<{ id: string; name: string } | null>(null);
  const archTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [menuId, setMenuId] = useState<string | null>(null);
  const [venueFilter, setVenueFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("");
  const { settings: tSettings } = useTenantSettings();
  const seasons = tSettings.seasons ?? [];
  const seasonName = (id?: string | null) => seasons.find((s) => s.id === id)?.name;
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
  useEffect(() => () => { if (visNoteTimer.current) clearTimeout(visNoteTimer.current); if (archTimer.current) clearTimeout(archTimer.current); }, []);

  // "Book for a customer" — jump to the Bookings page's Take-a-booking flow
  // (the real booking widget in operator mode) with this listing preselected.
  // Portal is the first path segment, so this works for freelancer/company/etc.
  const router = useRouter();
  const pathname = usePathname();
  const takeBooking = (l: Listing) => {
    const portal = (pathname || "/freelancer").split("/").filter(Boolean)[0] || "freelancer";
    router.push(`/${portal}/bookings?take=${encodeURIComponent(l.id)}`);
  };
  const [sortBy, setSortBy] = useState<SortKey>("soonest");

  const bookedCount = (l: Listing) => (l.blocks ?? []).reduce((s, b) => s + Math.max(0, b.capacity - b.spotsLeft), 0);
  async function duplicate(l: Listing) {
    try {
      // Copy the full server draft when there is one (the server strips
      // read-only fields like tenantId/blocks); legacy docs copy name+passes.
      const dr = serverDraft(l);
      const copyName = t("p8lst.flCopyName", { name: l.name });
      const body = dr
        ? { ...dr, id: undefined, title: copyName, name: copyName, status: "draft", archived: false, passes: l.passes }
        : { name: copyName, passes: l.passes };
      const created = await apiPost<{ id: string }>("/api/listings", body);
      copyDraft(l.id, created.id, { title: copyName, archived: false });
      refresh();
      setArchiveTick((t) => t + 1);
    } catch (e) {
      onError(e instanceof Error ? e.message : t("p8lst.flDupFail"));
    }
  }
  async function remove(l: Listing) {
    const booked = bookedCount(l);
    if (booked > 0) { alert(t("p8lst.flHasBookings", { name: l.name, n: booked })); return; }
    if (!confirm(t("p8lst.flDelConfirm", { name: l.name }))) return;
    try {
      await api(`/api/listings/${encodeURIComponent(l.id)}`, { method: "DELETE" });
      // Confirm it actually went — a "successful" delete that leaves the row
      // in place otherwise just looks like the button did nothing.
      const after = await refresh();
      if (after?.some((x) => x.id === l.id)) {
        onError(t("p8lst.flDelStuck", { name: l.name }));
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : t("p8lst.flDelFail"));
    }
  }
  const archive = (l: Listing, v: boolean) => {
    api(`/api/listings/${encodeURIComponent(l.id)}`, { method: "PUT", body: JSON.stringify({ archived: v }) })
      .then(() => refresh())
      .catch((e) => onError(e instanceof Error ? e.message : t("p8lst.flArchFail")));
    setArchiveTick((t) => t + 1);
    if (v) {
      // Show where it went: open the Archived section + a dismissible undo note.
      setShowArchived(true);
      setJustArchived({ id: l.id, name: l.name });
      if (archTimer.current) clearTimeout(archTimer.current);
      archTimer.current = setTimeout(() => setJustArchived(null), 9000);
    } else {
      setJustArchived(null);
    }
  };
  const copyLink = (l: Listing, isDraft?: boolean) => {
    const link = `${typeof window !== "undefined" ? window.location.origin : ""}/book/${l.id}`;
    navigator.clipboard?.writeText(link).then(() => {
      setCopiedId(l.id);
      setTimeout(() => setCopiedId(null), 1500);
      // The /book link only opens for the public once the listing is Live.
      // While it's a draft it 404s for everyone but the signed-in owner, so
      // warn rather than let the operator send a link that silently fails.
      if (isDraft) { setLinkWarnId(l.id); setTimeout(() => setLinkWarnId((v) => (v === l.id ? null : v)), 8000); }
    }).catch(() => {});
  };
  // The one-line "Book now" widget for the operator's OWN website — pastes
  // anywhere HTML goes (Wix/WordPress/Squarespace embed blocks included).
  const copyEmbed = (l: Listing) => {
    const snippet = `<script src="${typeof window !== "undefined" ? window.location.origin : ""}/embed.js" data-listing="${l.id}" async></script>`;
    navigator.clipboard?.writeText(snippet)
      .then(() => alert(t("p8lst.flEmbedOneAlert", { snippet, id: l.id })))
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
    // Per-day capacity is a daily limit, not a total: three weekly blocks of
    // 10 a day is still 10 a day, so show the tightest block, never the sum.
    const perDayScope = info?.capacityScope === "day";
    const cap = apiBlocks.length
      ? perDayScope ? Math.max(...apiBlocks.map((b) => b.capacity)) : apiBlocks.reduce((s2, b) => s2 + b.capacity, 0)
      : info?.capacity ?? null;
    const spaces = apiBlocks.length
      ? perDayScope ? Math.min(...apiBlocks.map((b) => b.spotsLeft)) : apiBlocks.reduce((s2, b) => s2 + b.spotsLeft, 0)
      : cap;
    const left = Math.max(0, spaces ?? cap ?? 0);
    const booked = Math.max(0, (cap ?? 0) - left);
    return {
      l, dr, info,
      vn: dr ? local.venues.find((v) => v.id === dr.venueId)?.name ?? "" : "",
      venueId: dr?.venueId ?? null,
      seasonId: dr?.seasonId ?? null,
      categoryIds: dr?.categoryIds ?? [],
      cap, spaces, left, booked,
      pct: cap && cap > 0 ? booked / cap : 0,
      from: l.passes?.length ? Math.min(...l.passes.map((p) => p.price)) : Infinity,
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
    if (seasonFilter && r.seasonId !== seasonFilter) return false;
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
      <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("p8lst.flDraftsHead", { n: drafts.length })}</div>
      <div className="flex flex-col gap-1.5">
        {drafts.map(([key, dr]) => (
          <div key={key} className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)] px-3 py-2">
            <span className="rounded-full bg-[#fdf3d8] px-2 py-[2px] text-[10px] font-bold text-[#9a5a00]">{t("p8lst.flDraft")}</span>
            <span className="flex-1 truncate text-[13px] font-bold">{dr.title.trim() || t("p8lst.flUntitled")}</span>
            <Button sm variant="primary" onClick={() => onResume(key, dr)}>{t("p8lst.flResume")}</Button>
            <Button sm variant="danger" onClick={() => onDeleteDraft(key)}>{t("p8lst.flDelete")}</Button>
          </div>
        ))}
      </div>
    </div>
  );

  if (listings.length === 0)
    return (
      <div>
        {draftsBlock}
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]"><Rich text={t("p8lst.flNoListings")} /></Card>
      </div>
    );

  return (
    <div className="flex flex-col gap-3" data-archive-tick={archiveTick}>
      {draftsBlock}
      {/* Filter pills — each control is a pill that fills brand-blue once it's
          actually narrowing the list, so the row reads as state, not chrome. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 sm:max-w-[260px]">
          <svg viewBox="0 0 16 16" fill="none" className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-3)] opacity-60">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.7" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("p8lst.flSearchPh")}
            className="h-8 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] ps-[32px] pe-3 text-[12.5px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-2)] focus:border-[var(--brand-2)]" />
        </div>

        {venueOpts.length > 0 && (
          <Pill active={!!venueFilter} onClear={() => setVenueFilter("")}>
            <PillSelect active={!!venueFilter} value={venueFilter} onChange={setVenueFilter} title={t("p8lst.flFilterLoc")}
              options={[["", t("p8lst.flAllLoc")], ...venueOpts.map((v) => [v.id, `${v.name} (${v.n})`] as [string, string])]} />
          </Pill>
        )}

        {catOpts.length > 0 && (
          <Pill active={!!catFilter} onClear={() => setCatFilter("")}>
            <PillSelect active={!!catFilter} value={catFilter} onChange={setCatFilter} title={t("p8lst.flFilterCat")}
              options={[["", t("p8lst.flAllCats")], ...catOpts.map((c) => [c.id, `${optionLabel(c.name)} (${c.n})`] as [string, string])]} />
          </Pill>
        )}

        {seasons.length > 0 && (() => {
          const seasonOpts = seasons.map((s) => ({ ...s, n: rows.filter((r) => !r.archived && r.seasonId === s.id).length })).filter((s) => s.n > 0);
          return seasonOpts.length > 0 ? (
            <Pill active={!!seasonFilter} onClear={() => setSeasonFilter("")}>
              <PillSelect active={!!seasonFilter} value={seasonFilter} onChange={setSeasonFilter} title={t("p8lst.flFilterSeason")}
                options={[["", t("p8lst.flAllSeasons")], ...seasonOpts.map((s) => [s.id, `${s.name} (${s.n})`] as [string, string])]} />
            </Pill>
          ) : null;
        })()}

        <Pill active={sortBy !== "soonest"} onClear={() => setSortBy("soonest")}>
          <PillSelect active={sortBy !== "soonest"} value={sortBy} onChange={(v) => setSortBy(v as SortKey)} title={t("p8lst.flSortTitle")}
            options={SORT_KEYS.map(([k, label]) => [k, t("p8lst." + label)] as [string, string])} />
        </Pill>

        <Pill active={!!dateFilter} onClear={() => setDateFilter("")}>
          <span className="whitespace-nowrap text-[12.5px] font-semibold" style={{ color: dateFilter ? "#fff" : "var(--ink)" }}>{t("p8lst.flRunsOn")}</span>
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
            className="h-full w-[112px] border-0 bg-transparent text-[12.5px] font-semibold outline-none"
            style={{ color: dateFilter ? "#fff" : "var(--ink)", colorScheme: dateFilter ? "dark" : "light" }} />
        </Pill>

        {(q || dateFilter || venueFilter || catFilter || seasonFilter || sortBy !== "soonest") && (
          <button type="button" title={t("p8lst.flClearAll")}
            onClick={() => { setQ(""); setDateFilter(""); setVenueFilter(""); setCatFilter(""); setSeasonFilter(""); setSortBy("soonest"); }}
            className="h-8 px-1 text-[11.5px] font-semibold text-[var(--ink-3)] hover:text-[var(--ink)] hover:underline">{t("p8lst.flReset")}</button>
        )}

        <span className="ms-auto flex h-8 items-center gap-0.5 rounded-full border border-[var(--line)] bg-[var(--panel)] p-0.5 text-[11.5px] font-semibold">
          {([["all", t("p8lst.flStAll")], ["live", t("p8lst.flStPub")], ["draft", t("p8lst.flStUnpub")], ["ended", t("p8lst.flStEnded")]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setStatusFilter(k)} className="h-full rounded-full px-3 transition-colors"
              style={statusFilter === k ? { background: "var(--brand)", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
          ))}
        </span>
      </div>
      {activeShown.length === 0 ? (
        <Card className="p-5 text-center text-[12.5px] text-[var(--ink-3)]">{q || dateFilter || venueFilter || catFilter ? (dateFilter ? t("p8lst.flNoMatchDate") : t("p8lst.flNoMatch")) : t("p8lst.flNoActive")}</Card>
      ) : (
        activeShown.map(({ l, info, vn, cap, spaces, isLive, isDraft, seasonId }) => {
          const season = seasonName(seasonId);
          return (
            <Card key={l.id} className="overflow-visible p-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-20px_rgba(20,35,90,.35)]">
              <div className="flex flex-col sm:flex-row">
                {/* date rail — when it runs, read first */}
                <div className="flex flex-none flex-row items-center justify-center gap-3 px-4 py-3 text-white sm:w-[92px] sm:flex-col sm:gap-0 sm:rounded-s-xl sm:py-4" style={{ background: "var(--side-bg)" }}>
                  {info?.from ? (
                    <>
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-75">{monthOf(info.from)}</div>
                      <div className="text-[26px] font-extrabold leading-none sm:mt-0.5" style={{ fontVariantNumeric: "tabular-nums" }}>{dayOf(info.from)}</div>
                      <div className="mx-auto my-2 hidden h-px w-6 bg-white/30 sm:block" />
                      <div className="text-[11px] leading-[1.35] opacity-90 sm:text-center">
                        <span className="sm:hidden">{rtl ? "← " : "→ "}</span><Rich text={t("p8lst.flToDate", { date: shortDate(info.to) })} />
                        {info.totalDays > 0 && <><br className="hidden sm:block" /><span className="sm:hidden"> · </span>{pickPlural(t, locale, "p7pol.dy", info.totalDays)}</>}
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-90">{t("p8lst.flDatesTbc")}</div>
                  )}
                </div>

                <div className="min-w-0 flex-1 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[17px] font-bold leading-tight tracking-[-0.02em] text-[var(--ink)]">{l.name}</h3>
                    {isDraft ? (
                      <span title={t("p8lst.flUnpubTip")} className="rounded-full px-2 py-[2px] text-[10px] font-semibold" style={{ background: "#fff7ed", color: "#9a3412" }}>{t("p8lst.flStUnpub")}</span>
                    ) : isLive ? (
                      <span title={t("p8lst.flPubTip")} className="inline-flex items-center gap-1 rounded-full bg-[#eaf0fc] px-2 py-[2px] text-[10px] font-semibold text-[#1d3a8f]"><span className="inline-block h-1.5 w-1.5 rounded-full bg-[#3f78d8]" />{t("p8lst.flStPub")}</span>
                    ) : (
                      <span title={t("p8lst.flEndedTip")} className="rounded-full bg-[var(--surface)] px-2 py-[2px] text-[10px] font-semibold text-[var(--ink-3)]">{t("p8lst.flStEnded")}</span>
                    )}
                    {info?.opensAt && info.opensAt > nowLocal() && (
                      <span title={t("p8lst.flOpensTip")} className="rounded-full bg-[#fff7ed] px-2 py-[2px] text-[10px] font-semibold text-[#9a3412]">{t("p8lst.flOpens", { when: openLabel(info.opensAt) })}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-[var(--ink-3)]">
                    <span>{vn || t("p8lst.flNoVenue")}</span>
                    {ownerOf && <span data-testid="listing-owner" title={t("p8lst.ownerLabel")} className="rounded-full bg-[var(--panel)] px-1.5 py-[1px] text-[10.5px] font-semibold text-[var(--ink-2)] ring-1 ring-[var(--line)]">{t("p8lst.ownerLabel")}: {ownerOf(l)}</span>}
                    {season && <span title={t("p8lst.flSeason")} className="rounded-full bg-[var(--panel)] px-1.5 py-[1px] text-[10.5px] font-semibold text-[var(--ink-2)] ring-1 ring-[var(--line)]">🗓 {season}</span>}
                  </div>

                  {/* passes */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {l.passes?.length ? (
                      <>
                        {l.passes.slice(0, 3).map((t, i) => (
                          <span key={i} className="inline-flex items-baseline gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1">
                            <span className="text-[11.5px] text-[var(--ink-3)]">{t.name}</span>
                            <span className="text-[12px] font-bold text-[var(--ink)]" style={{ fontVariantNumeric: "tabular-nums" }}>{money(t.price)}</span>
                          </span>
                        ))}
                        {l.passes.length > 3 && <span className="text-[11.5px] font-medium text-[var(--ink-3)]">{t("p8lst.flMore", { n: l.passes.length - 3 })}</span>}
                      </>
                    ) : <span className="text-[12px] text-[var(--ink-3)]">{t("p8lst.flNoTickets")}</span>}
                  </div>

                  {/* how full it is */}
                  {cap != null && (() => {
                    const left = Math.max(0, spaces ?? cap);
                    const booked = Math.max(0, cap - left);
                    const pct = cap > 0 ? Math.round((booked / cap) * 100) : 0;
                    // Filling up and full are both "act now", so both take the
                    // brand pink and the bar's own length says which. The old
                    // amber middle step drew a wide orange slab across the card.
                    const tone = left <= 0 ? "#B3124F" : left <= cap * 0.15 ? "#C81E5E" : "#2f5fd0";
                    return (
                      <div className="mt-3">
                        <div className="h-[7px] overflow-hidden rounded-full bg-[var(--line)]">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: tone }} />
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-[11.5px] text-[var(--ink-3)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                          <span><Rich text={t("p8lst.flBookedOf", { booked, cap })} bClass="text-[var(--ink)]" /></span>
                          <span className="text-[var(--line)]">·</span>
                          <span style={{ color: tone }}><Rich text={t(info?.capacityScope === "day" ? "p8lst.flLeftDay" : "p8lst.flLeft", { left })} /></span>
                          {booked > 0 && <><span className="text-[var(--line)]">·</span><span>{t("p8lst.flPctFull", { pct })}</span></>}
                        </div>
                      </div>
                    );
                  })()}

                  {/* actions */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
                    <span key={visTick} className="inline-flex overflow-hidden rounded-lg border border-[var(--line)] text-[11px] font-semibold">
                      {(["public", "hidden"] as const).map((v) => {
                        const on = visibilityOf(l) === v;
                        return <button key={v} type="button" onClick={() => setVisibility(l, v)} title={v === "public" ? t("p8lst.flPublicTip") : t("p8lst.flHiddenTip")} className="px-2.5 py-1 transition-colors" style={on ? { background: "var(--brand-soft)", color: "var(--brand-ink)" } : { color: "var(--ink-3)" }}>{v === "public" ? t("p8lst.flPublic") : t("p8lst.flHidden")}</button>;
                      })}
                    </span>
                    {linkWarnId === l.id && (
                      <div className="order-last w-full rounded-lg border px-3 py-2 text-[11.5px] leading-[1.5]"
                        style={{ background: "#fff7ed", borderColor: "#fed7aa", color: "#9a3412" }}>
                        <Rich text={t("p8lst.flLinkWarn")} />
                      </div>
                    )}
                    {visNote === l.id && (
                      <div className="order-last w-full rounded-lg border px-3 py-2 text-[11.5px] leading-[1.5]"
                        style={visibilityOf(l) === "public"
                          ? { background: "var(--brand-soft)", borderColor: "transparent", color: "var(--brand-ink)" }
                          : { background: "#fff7ed", borderColor: "#fed7aa", color: "#9a3412" }}>
                        {visibilityOf(l) === "public" ? (
                          <Rich text={t("p8lst.flPublicNote")} />
                        ) : (
                          <Rich text={t("p8lst.flHiddenNote")} />
                        )}
                      </div>
                    )}
                    <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
                      {/* Take a phone/walk-in booking for a family, on the real
                          booking widget in operator mode. Only for listings that
                          can actually be booked (a draft has no dates/prices). */}
                      {!isDraft && isLive && (
                        <Button sm className="!border-[#bbe7cb] !bg-[#eaf7ef] !text-[#0f7a43] hover:!bg-[#dcf0e4]" onClick={() => takeBooking(l)}>{t("p8lst.flBookForCustomer")}</Button>
                      )}
                      <Button sm className="!border-[#c3d6f7] !bg-[#eef4ff] !text-[#1d3a8f] hover:!bg-[#e2ecfd]" onClick={() => copyLink(l, isDraft)}>{copiedId === l.id ? t("p8lst.flCopied") : t("p8lst.flLink")}</Button>
                      {/* QR to the /book page — parents scan it (flyer, door, table). */}
                      <Button sm className="!border-[#ddd0f7] !bg-[#f3effe] !text-[#6d28d9] hover:!bg-[#ece2fc]" onClick={() => setQrFor(l)}>{t("p8lst.flQr")}</Button>
                      {/* Opens the real parent page (/book/{id}) in a new tab —
                          the exact storefront a parent sees. ?preview=1 tells the
                          page to show a "Preview" bar instead of the parent-portal
                          nav, so the provider isn't dropped into the parent app. */}
                      <Button sm className="!border-[#bfe6e2] !bg-[#e6f6f4] !text-[#0e7d74] hover:!bg-[#d7f0ec]" onClick={() => window.open(`/book/${l.id}?preview=1`, "_blank", "noopener")}>{t("p8lst.flViewAsParent")}</Button>
                      <Button sm variant="primary" onClick={() => onEdit(l)}>{t("p8lst.flEdit")}</Button>
                      <div className="relative">
                        <Button sm onClick={() => setMenuId((m) => (m === l.id ? null : l.id))}>⋯</Button>
                        {menuId === l.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                            <div className="absolute end-0 z-20 mt-1 w-[168px] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] py-1 shadow-lg">
                              {[
                                { label: t("p8lst.flMenuEmbed"), fn: () => copyEmbed(l) },
                                { label: t("p8lst.flMenuDup"), fn: () => duplicate(l) },
                                { label: t("p8lst.flMenuArchive"), fn: () => archive(l, true) },
                              ].map((a) => (
                                <button key={a.label} type="button" onClick={() => { a.fn(); setMenuId(null); }} className="block w-full px-3.5 py-2 text-start text-[12.5px] font-medium text-[var(--ink-2)] hover:bg-[var(--surface)]">{a.label}</button>
                              ))}
                              <div className="my-1 h-px bg-[var(--line)]" />
                              <button type="button" onClick={() => { remove(l); setMenuId(null); }} className="block w-full px-3.5 py-2 text-start text-[12.5px] font-medium text-[#dc2626] hover:bg-[#fef2f2]">{t("p8lst.flDelete")}</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* cover, on the right — honour the operator's own focal point
                    (x/y/zoom). CroppedImage measures this slot's aspect and
                    focal-crops to it, so the subject the operator framed in the
                    hero stays framed here too, whatever layout/size they chose.
                    (It used to force dead-centre, which clipped off-centre
                    subjects like a child's face.) */}
                <div className="order-first h-[150px] w-full flex-none overflow-hidden sm:order-last sm:h-auto sm:w-[230px] sm:self-stretch sm:rounded-e-xl">
                  {info?.cover ? (
                    <CroppedImage im={info.cover} className="h-full w-full" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--surface)] text-[26px]">🏕️</div>
                  )}
                </div>
              </div>
            </Card>
          );
        })
      )}

      {/* QR to the booking page — parents scan it from a flyer, door or table. */}
      {qrFor && (() => {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const url = `${origin}/book/${qrFor.id}`;
        const qr = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(url)}`;
        const draft = (serverDraft(qrFor)?.status ?? allDrafts[qrFor.id]?.status ?? "live") === "draft";
        const printPoster = () => {
          const w = window.open("", "_blank"); if (!w) return;
          w.document.write(`<!doctype html><meta charset="utf-8"><title>${qrFor.name}</title><body style="font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;text-align:center;padding:48px;color:#171534"><h1 style="font-size:30px;margin:0 0 6px">${qrFor.name.replace(/</g, "&lt;")}</h1><p style="font-size:17px;color:#5b6478;margin:0 0 24px">${t("p8lst.flPosterScan").replace(/</g, "&lt;")}</p><img src="${qr}" style="width:340px;height:340px" alt="QR"/><p style="font-size:13px;color:#8a86a3;margin-top:20px">${url}</p><script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body>`);
          w.document.close();
        };
        return (
          <div onClick={(e) => e.target === e.currentTarget && setQrFor(null)} className="fixed inset-0 z-[10000] grid place-items-center overflow-auto bg-black/55 p-4">
            <div className="w-full max-w-[360px] rounded-2xl bg-[var(--surface)] p-5 shadow-2xl">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[14px] font-extrabold text-[var(--ink)]">{t("p8lst.flQrHead")}</span>
                <button type="button" onClick={() => setQrFor(null)} className="ms-auto text-[20px] leading-none text-[var(--ink-3)]">×</button>
              </div>
              <div className="truncate text-[12.5px] font-bold text-[var(--ink-2)]">{qrFor.name}</div>
              <img src={qr} alt={t("p8lst.flQrAlt", { name: qrFor.name })} className="mx-auto mt-3 h-[240px] w-[240px] rounded-xl border border-[var(--line)]" />
              <p className="mt-2.5 text-center text-[11.5px] text-[var(--ink-3)]">{t("p8lst.flQrHelp")}</p>
              {draft && <div className="mt-2 rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-[11.5px] text-[#9a3412]"><Rich text={t("p8lst.flQrDraft")} /></div>}
              <div className="mt-2 truncate rounded-lg bg-[var(--panel)] px-3 py-2 text-center text-[11px] text-[var(--ink-3)]">{url}</div>
              <div className="mt-3 flex gap-2">
                <Button sm className="flex-1" onClick={() => { navigator.clipboard?.writeText(url).then(() => { setCopiedId(qrFor.id); setTimeout(() => setCopiedId(null), 1500); }).catch(() => {}); }}>{copiedId === qrFor.id ? t("p8lst.flCopied") : t("p8lst.flCopyLink")}</Button>
                <Button sm className="flex-1" onClick={() => window.open(qr, "_blank", "noopener")}>{t("p8lst.flImage")}</Button>
                <Button sm variant="primary" className="flex-1" onClick={printPoster}>{t("p8lst.flPoster")}</Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Undo toast — makes clear where an archived listing went. */}
      {justArchived && (
        <div className="fixed bottom-5 left-1/2 z-[150] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#111634] px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-xl">
          <span><Rich text={t("p8lst.flArchivedToast", { name: justArchived.name })} /></span>
          <button type="button" onClick={() => { const l = archivedList.find((x) => x.id === justArchived.id) ?? { id: justArchived.id, name: justArchived.name } as Listing; archive(l, false); }} className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-extrabold hover:bg-white/25">{t("p8lst.flUndo")}</button>
          <button type="button" onClick={() => setJustArchived(null)} className="text-[16px] leading-none text-white/60 hover:text-white">×</button>
        </div>
      )}

      {archivedList.length > 0 && (
        <div className="mt-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2.5">
          <button type="button" onClick={() => setShowArchived((v) => !v)} className="flex w-full items-center gap-2 text-[12px] font-extrabold text-[var(--ink-2)]">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-[var(--surface)] text-[13px] ring-1 ring-[var(--line)]">📦</span>
            <span>{t("p8lst.flArchivedHead")}</span>
            <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#5b6478] px-1.5 text-[10.5px] font-extrabold text-white">{archivedList.length}</span>
            <span className="ms-auto text-[11px] font-semibold text-[var(--ink-3)]">{showArchived ? t("p8lst.flHide") : t("p8lst.flShow")}</span>
          </button>
          {showArchived && (
            <div className="mt-2 flex flex-col gap-1.5">
              {archivedList.map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
                  <span className="rounded-full bg-[#eef0f6] px-2 py-[2px] text-[10px] font-bold text-[#5b6478]">{t("p8lst.flArchivedHead")}</span>
                  <span className="flex-1 truncate text-[13px] font-bold">{l.name}</span>
                  <Button sm variant="primary" onClick={() => archive(l, false)}>{t("p8lst.flUnarchive")}</Button>
                  <Button sm variant="danger" onClick={() => remove(l)}>{t("p8lst.flDelete")}</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
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
  const t = useT();
  const facLabel = (f: string) => (FAC_KEYS[f] ? t("p8lst." + FAC_KEYS[f]) : f);
  const [selId, setSelId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [nm, setNm] = useState("");
  const [addr, setAddr] = useState("");
  const [pin, setPin2] = useState<{ lat: number; lng: number } | null>(null); // pending map pin from the finder

  const sel = local.venues.find((v) => v.id === selId) ?? local.venues[0] ?? null;
  const wh = whereHeading(local);

  const addVenue = () => {
    if (nm.trim().length < 2) return;
    const id = uid();
    patch((s) => ({ ...s, venues: [...s.venues, { id, name: nm.trim(), address: addr.trim(), ...(pin ? { lat: pin.lat, lng: pin.lng, zoom: 16 } : {}) }] }));
    setNm("");
    setAddr("");
    setPin2(null);
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
    const warn = n > 0 ? `\n\n${t("p8lst.flUsedWarn", { n })}` : "";
    if (!confirm(t("p8lst.flDelVenue", { name, warn }))) return;
    patch((s) => ({ ...s, venues: s.venues.filter((v) => v.id !== id) }));
    if (selId === id) setSelId(null);
  };

  return (
    <Card className="p-4">
      <div className="text-[15px] font-extrabold">{t("p8lst.flLocHead")}</div>
      <p className="mb-3 text-[12px] text-[var(--ink-3)]">
        {t("p8lst.flLocSub")}
      </p>

      {/* Set once here rather than per listing — the venue section reads the
          same on every customer page. */}
      <details className="mb-3 max-w-[900px] rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <summary className="cursor-pointer list-none px-3 py-2 text-[11.5px] font-bold text-[var(--brand-ink)] [&::-webkit-details-marker]:hidden">
          {t("p8lst.flSectionHeading")} — <span className="font-semibold text-[var(--ink-3)]">{wh.eyebrow} · {wh.title}</span>
        </summary>
        <div className="flex flex-wrap gap-2 px-3 pb-3">
          <div>
            <FieldLabel>{t("p8lst.flSmallLabel")}</FieldLabel>
            <Input value={local.whereHeading?.eyebrow ?? ""} placeholder={WHERE_HEAD_DEFAULT.eyebrow} className="w-[180px]"
              onChange={(e) => patch((s) => ({ ...s, whereHeading: { eyebrow: e.target.value, title: s.whereHeading?.title ?? "" } }))} />
          </div>
          <div>
            <FieldLabel>{t("p8lst.flHeading")}</FieldLabel>
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
                <button type="button" onClick={() => setSelId(v.id)} className="min-w-0 flex-1 text-start">
                  <div className="truncate text-[13px] font-bold">{v.name}</div>
                  <div className="truncate text-[11.5px] text-[var(--ink-3)]">
                    {v.kind === "online" ? t("p8lst.flRunsOnline") : v.address || t("p8lst.flNoAddr")} · {n ? t("p8lst.flListingsCount", { n }) : t("p8lst.flNotUsed")}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => removeVenue(v.id, v.name)}
                  aria-label={t("p8lst.flAriaDelete", { name: v.name })}
                  className="px-1 text-[13px] text-[var(--ink-3)] hover:text-[var(--red)]"
                >
                  ✕
                </button>
              </div>
            );
          })}

          {local.venues.length === 0 && !adding && (
            <div className="rounded-xl border border-dashed border-[var(--line)] p-4 text-center text-[12px] text-[var(--ink-3)]">
              {t("p8lst.flNoVenues")}
            </div>
          )}

          {adding ? (
            <div className="mt-1 flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5">
              <AddressFinder onPick={(h) => { setAddr(tidyAddress(h.label)); setPin2({ lat: h.lat, lng: h.lng }); }} />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <FieldLabel>{t("p8lst.flVenueName")}</FieldLabel>
                  <Input value={nm} onChange={(e) => setNm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addVenue()} placeholder={t("p8lst.flVenueNamePh")} className="w-full" />
                </div>
                <div className="flex-1">
                  <FieldLabel>{t("p8lst.flAddress")} <span className="font-normal text-[var(--ink-3)]">{t("p8lst.flFoundOrTyped")}</span></FieldLabel>
                  <Input value={addr} onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addVenue()} placeholder={t("p8lst.flAddrPh")} className="w-full" />
                </div>
                <div className="flex gap-1.5">
                  <Button variant="primary" onClick={addVenue}>{t("p8lst.flAdd")}</Button>
                  <Button onClick={() => { setAdding(false); setPin2(null); }}>{t("p8lst.flCancel")}</Button>
                </div>
              </div>
              {pin && <div className="text-[11px] font-semibold text-[#127a3e]">{t("p8lst.flPinFound")}</div>}
            </div>
          ) : (
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Button variant="primary" onClick={() => setAdding(true)}>{t("p8lst.flAddLoc")}</Button>
              {/* Not every listing has an address — online clubs and tutoring
                  still need something to point a listing at. */}
              <Button onClick={() => {
                const id = uid();
                patch((st) => ({ ...st, venues: [...st.venues, { id, name: "Online", address: "", kind: "online" }] }));
                setSelId(id);
              }}>{t("p8lst.flAddOnline")}</Button>
            </div>
          )}
        </div>

        {/* Map + details for whichever venue is selected. */}
        <div className="flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          {sel ? (
            <>
              {sel.kind === "online" ? (
                <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[11.5px] leading-[1.5] text-[var(--ink-2)]">
                  <Rich text={t("p8lst.flOnlineNote")} />
                </div>
              ) : sel.lat !== undefined ? (
                <VenueMap lat={sel.lat} lng={sel.lng} zoom={sel.zoom} onZoom={(z) => setPin(sel.id, { zoom: z })} />
              ) : (
                <div className="flex h-[160px] items-center justify-center rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 text-center text-[11.5px] leading-[1.5] text-[var(--ink-3)]">
                  <Rich text={t("p8lst.flUseFind")} bClass="mx-1" />
                </div>
              )}
              {sel.kind !== "online" && <AddressFinder onPick={(h) => setPin(sel.id, { lat: h.lat, lng: h.lng, address: tidyAddress(h.label), zoom: sel.zoom ?? 16 })} />}
              <div>
                <FieldLabel>{t("p8lst.flVenueName")}</FieldLabel>
                <Input value={sel.name} onChange={(e) => updateVenue(sel.id, "name", e.target.value)} className="w-full" />
              </div>
              {sel.kind !== "online" && (
                <div>
                  <FieldLabel>{t("p8lst.flAddress")} <span className="font-normal text-[var(--ink-3)]">{t("p8lst.flAddrEdit")}</span></FieldLabel>
                  <Input value={sel.address} onChange={(e) => updateVenue(sel.id, "address", e.target.value)} placeholder={t("p8lst.flAddrPh")} className="w-full" />
                </div>
              )}
              {sel.kind !== "online" && (
                <div>
                  <FieldLabel>{t("p8lst.flTown")} <span className="font-normal text-[var(--ink-3)]">{t("p8lst.flTownNote")}</span></FieldLabel>
                  <Input value={sel.city ?? ""} onChange={(e) => updateVenue(sel.id, "city", e.target.value)} placeholder={t("p8lst.flTownPh")} className="w-full max-w-[280px]" />
                </div>
              )}
              {sel.lat !== undefined && (
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--ink-3)]">
                  <span>{t("p8lst.flPinSaved")}</span>
                  <button type="button" onClick={() => setPin(sel.id, { lat: undefined, lng: undefined })} className="underline hover:text-[var(--ink)]">{t("p8lst.flRemove")}</button>
                </div>
              )}

              {/* Both of these show on the customer page — the questions parents
                  ask before they book, answered once per venue. */}
              {sel.kind !== "online" && (
              <div className="border-t border-[var(--line)] pt-2">
                <FieldLabel>{t("p8lst.flWhatsThere")}</FieldLabel>
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {(sel.facilities ?? []).map((f) => (
                    <span key={f} className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-line)] bg-[var(--brand-soft)] py-1 ps-2.5 pe-1 text-[11.5px] font-semibold text-[var(--brand-ink)]">
                      {facLabel(f)}
                      <button type="button" onClick={() => setPin(sel.id, { facilities: (sel.facilities ?? []).filter((x) => x !== f) })}
                        aria-label={t("p8lst.flRemoveAria", { name: facLabel(f) })} className="px-1 text-[var(--ink-3)] hover:text-[var(--red)]">✕</button>
                    </span>
                  ))}
                  {!(sel.facilities ?? []).length && <span className="text-[11.5px] text-[var(--ink-3)]">{t("p8lst.flNothingAdded")}</span>}
                </div>
                <div className="mb-1.5 text-[10.5px] leading-[1.4] text-[var(--ink-3)]">
                  {t("p8lst.flFacNote")}
                </div>
                <div className="flex flex-wrap gap-1">
                  {FACILITIES.filter((f) => !(sel.facilities ?? []).includes(f)).map((f) => (
                    <button key={f} type="button" onClick={() => setPin(sel.id, { facilities: [...(sel.facilities ?? []), f] })}
                      className="rounded-full border border-dashed border-[var(--line)] px-2 py-[3px] text-[11px] font-semibold text-[var(--ink-3)] hover:border-[var(--brand-2)] hover:text-[var(--brand)]">+ {facLabel(f)}</button>
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
                  <FieldLabel>{t("p8lst.flNearest")}</FieldLabel>
                  <Input value={sel.transport ?? ""} onChange={(e) => setPin(sel.id, { transport: e.target.value })}
                    placeholder={t("p8lst.flNearestPh")} className="w-full" />
                </div>
              </div>
              )}

              <div>
                <FieldLabel>{sel.kind === "online" ? t("p8lst.flHowJoin") : t("p8lst.flGettingThere")}</FieldLabel>
                <textarea
                  value={sel.directions ?? ""}
                  onChange={(e) => setPin(sel.id, { directions: e.target.value })}
                  rows={3}
                  placeholder={sel.kind === "online"
                    ? t("p8lst.flJoinPh")
                    : t("p8lst.flDirPh")}
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2 text-[12.5px] leading-[1.5] text-[var(--ink)] outline-none placeholder:text-[var(--ink-2)] focus:border-[var(--brand-2)]"
                />
              </div>
              <div className="mt-0.5 border-t border-[var(--line)] pt-2 text-[11.5px] text-[var(--ink-3)]">
                {usage.venues[sel.id] ? (
                  <Rich text={t("p8lst.flUsedBy", { n: usage.venues[sel.id] })} bClass="text-[var(--ink)]" />
                ) : (
                  <>{t("p8lst.flNothingRuns")}{" "}
                    <button type="button" onClick={() => onNewListing(sel.id)} className="font-bold text-[var(--brand)] underline">{t("p8lst.flCreateHere")}</button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[180px] items-center justify-center text-center text-[12px] text-[var(--ink-3)]">
              {t("p8lst.flAddVenueMap")}
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
const FAC_KEYS: Record<string, string> = {
  "Free car park": "flFacCarPark", "On-street parking only": "flFacStreet", "Drop-off zone": "flFacDrop", "Bike racks": "flFacBike",
  "Indoor sports hall": "flFacHall", "Astro pitch": "flFacAstro", "Floodlit": "flFacFlood", "Changing rooms": "flFacChange",
  "Café on site": "flFacCafe", "Covered area if wet": "flFacCovered",
};
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
  const t = useT();
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
      <FieldLabel>{t("p8lst.flFindAddr")}</FieldLabel>
      <div className="flex gap-1.5">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }}
          placeholder={t("p8lst.flPostcodePh")}
          className="w-full"
        />
        <Button onClick={() => void search()} disabled={state === "busy"}>{state === "busy" ? "…" : t("p8lst.flFind")}</Button>
      </div>

      {state === "error" && (
        <div className="mt-1.5 text-[11.5px] text-[var(--red)]">{t("p8lst.flAddrErr")}</div>
      )}
      {hits?.length === 0 && (
        <div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">{t("p8lst.flNoMatchAddr")}</div>
      )}
      {!!hits?.length && (
        <div className="mt-1.5 max-h-[132px] overflow-y-auto rounded-lg border border-[var(--line)]">
          {hits.map((h, i) => (
            <button key={i} type="button" onClick={() => { onPick(h); setHits(null); setQ(""); }}
              className="block w-full border-b border-[var(--line)] px-2.5 py-1.5 text-start text-[11.5px] leading-[1.4] last:border-b-0 hover:bg-[var(--surface)]">
              {h.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
