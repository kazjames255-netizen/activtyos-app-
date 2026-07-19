"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Button, Card, FieldLabel, Input } from "@/components/ui";
import { Pill, PillSelect } from "@/features/listings/FreelancerListingsApp";
import { sessionIsoDates } from "@/features/bookings/helpers";
import { FamiliesExport, type FamilyRow } from "./FamiliesExport";
import type { Booking } from "@/features/bookings/types";

// ─────────────────────────────────────────────────────────────────────────
// Leads & customers — the tenant's parent records. SELF-FILLING: every
// booking (taken or self-served) upserts the family server-side, so this
// page grows on its own; the form below covers the manual cases (a family
// phoning before their first booking, fixing a record). Staff see it
// read-only. Deliberately simple — a richer version is a UI milestone.
// ─────────────────────────────────────────────────────────────────────────

interface Child {
  name: string;
  age?: number;
  dob?: string;
  /** The parent's own photo of them. Not on these thin records yet — it
   *  arrives with the account link (§K) — but the circle is built to show it
   *  the day it does, because a face is the point of a register. */
  photo?: string;
}
interface Customer {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  locationId?: string;
  locationName?: string;
  marketingOptIn?: boolean;
  children?: Child[];
  /** Set once they've been invited to set a password. */
  invitedAt?: string;
}
interface Draft {
  id: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  locationId: string;
  marketingOptIn: boolean;
}

const emptyDraft = (): Draft => ({
  id: null, firstName: "", lastName: "", email: "", phone: "",
  locationId: "", marketingOptIn: false,
});

/**
 * Where a family has got to with you. The language a provider uses on the
 * phone — a lead is someone who rang, a customer is someone who booked — so
 * the page says that rather than "customer record".
 *
 * Honest limit: we can see that a sign-up link was *sent*, not that they set
 * a password, so there is no "registered" stage yet. That needs the account
 * link in §K of the backend handoff.
 */
type Stage = "lead" | "invited" | "customer" | "repeat";

/**
 * A funnel, so the four are mutually exclusive and add up to everyone. Repeat
 * sits at the end because it's the one worth growing: a family who books
 * twice is worth several who book once, and it's the only number here that
 * says whether they liked it.
 */
const STAGES: { key: Stage; label: string; hint: string; colour: string }[] = [
  { key: "lead", label: "Lead", hint: "Enquired, never booked, not invited yet", colour: "#e22295" },
  { key: "invited", label: "Invited", hint: "Sent a sign-up link, hasn't booked yet", colour: "#2f6bd8" },
  { key: "customer", label: "Customer", hint: "Booked with you once", colour: "#15b364" },
  { key: "repeat", label: "Repeat", hint: "Booked more than once — they came back", colour: "#6a4fd0" },
];

/**
 * Every way to reach a family, behind one button.
 *
 * The row of Email / WhatsApp buttons grew every time another channel was
 * wanted, and each one was a link the provider might never use. A menu holds
 * as many as we like without the card getting louder — and it can say which
 * ones aren't possible for this family rather than silently hiding them.
 */
function ContactMenu({ email, phone, name }: { email?: string; phone?: string; name: string }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [box, setBox] = useState<DOMRect | null>(null);
  const digits = (phone ?? "").replace(/\D/g, "");
  // A UK mobile typed as 07… won't work on wa.me, which wants the country code.
  const intl = digits.startsWith("0") ? `44${digits.slice(1)}` : digits;
  const usable = digits.length >= 10;

  // Rendered into <body>, not into the card: inside it, the card clipped it
  // with overflow-hidden and the next card down painted over it.
  //
  // Which brings its own catch — a portal escapes the page's palette too. The
  // light theme is set on a wrapper div in this view, so out here --surface
  // falls back to the portal's dark value and the panel came out black. Hence
  // the palette repeated on the panel itself.
  const LIGHT = {
    "--surface": "#ffffff",
    "--panel": "#f5f8fd",
    "--ink": "#171534",
    "--ink-2": "#4a4763",
    "--ink-3": "#8a86a3",
    "--line": "#ece6f1",
  } as React.CSSProperties;

  useEffect(() => {
    if (!box) return;
    const shut = () => setBox(null);
    window.addEventListener("resize", shut);
    // Capture phase: the list scrolls inside <main>, not the window.
    window.addEventListener("scroll", shut, true);
    return () => {
      window.removeEventListener("resize", shut);
      window.removeEventListener("scroll", shut, true);
    };
  }, [box]);

  /** Cover the whole card, not just hang off the button. */
  const open = () => {
    const card = btn.current?.closest("[data-family-card]");
    const r = (card ?? btn.current)?.getBoundingClientRect();
    if (r) setBox(r);
  };

  const item =
    "flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] font-bold text-[var(--ink)] transition-colors hover:border-[var(--ink-3)]";
  const dead =
    "flex items-center gap-2.5 rounded-xl border border-dashed border-[var(--line)] px-3 py-2 text-[12.5px] text-[var(--ink-3)]";

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => (box ? setBox(null) : open())}
        className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-[3px] text-[11.5px] font-bold text-[var(--ink-2)] hover:border-[var(--ink-3)]"
      >
        Contact ▾
      </button>

      {box &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[9998] bg-black/20" onClick={() => setBox(null)} />
            <div
              className="fixed z-[9999] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3.5 shadow-[0_20px_44px_-18px_rgba(9,20,44,.55)]"
              style={{ ...LIGHT, top: box.top, left: box.left, width: box.width, minHeight: box.height, maxHeight: "80vh" }}
            >
              <div className="mb-2.5 flex items-center gap-2">
                <b className="min-w-0 flex-1 truncate text-[13.5px] text-[var(--ink)]">
                  Contact {name}
                </b>
                <button
                  type="button"
                  onClick={() => setBox(null)}
                  aria-label="Close"
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[15px] leading-none text-[var(--ink-3)] hover:text-[var(--ink)]"
                >
                  ×
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                {email ? (
                  <a href={`mailto:${email}`} className={item} onClick={() => setBox(null)}>
                    ✉ <span className="min-w-0 flex-1 truncate">Email <span className="font-normal text-[var(--ink-3)]">{email}</span></span>
                  </a>
                ) : (
                  <span className={dead}>✉ No email address on file</span>
                )}
                {usable ? (
                  <>
                    <a href={`https://wa.me/${intl}`} target="_blank" rel="noreferrer" className={item} onClick={() => setBox(null)}>
                      💬 WhatsApp
                    </a>
                    <a href={`sms:${phone}`} className={item} onClick={() => setBox(null)}>
                      📱 Text message
                    </a>
                    <a href={`tel:${phone}`} className={item} onClick={() => setBox(null)}>
                      📞 Call <span className="font-normal text-[var(--ink-3)]">{phone}</span>
                    </a>
                  </>
                ) : (
                  <span className={dead}>📱 No phone number on file</span>
                )}
                <a
                  href={`/freelancer/messages?to=${encodeURIComponent(email ?? name)}`}
                  className={item}
                  onClick={() => setBox(null)}
                >
                  💌 Message in ActivityOS
                </a>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

/** One line of a child's detail. Declared out here, not inside render. */
function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-[120px] flex-none text-[var(--ink-3)]">{label}</span>
      <span className="min-w-0 flex-1 font-semibold">{value?.trim() ? value : "—"}</span>
    </div>
  );
}

/** Existing records hold one `name`; split it so they can still be edited. */
const splitName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
};

export function CustomersApp() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<Stage | "">("");
  const [exporting, setExporting] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"families" | "children">("families");
  const [loc, setLoc] = useState("");
  const [day, setDay] = useState("");
  const [openKid, setOpenKid] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  // Bookings and spend per family. Aggregated here from the tenant's own
  // bookings rather than stored on the customer, so it can never go stale or
  // disagree with the Bookings page.
  const [stats, setStats] = useState<Record<string, { n: number; days: string[] }>>({});

  const refresh = useCallback(() => {
    apiGet<Customer[]>("/api/customers")
      .then((c) => {
        setCustomers(c);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load customers"));
  }, []);
  useEffect(() => {
    refresh();
    apiGet<{ role: string }>("/api/me")
      .then((me) => setCanWrite(["company", "freelancer", "franchise"].includes(me.role)))
      .catch(() => {});
    // The provider's own sites, from the library they already maintain.
    apiGet<{ venues?: { id: string; name: string }[] }>("/api/library")
      .then((lib) => setVenues(lib.venues ?? []))
      .catch(() => {});
    apiGet<Booking[]>("/api/bookings")
      .then((bs) => {
        const by: Record<string, { n: number; days: string[] }> = {};
        for (const b of bs) {
          const key = (b.email ?? "").trim().toLowerCase();
          // A cancelled booking isn't a booking they made — counting it would
          // put someone who booked once and cancelled into "Repeat".
          if (!key || b.status === "Cancelled") continue;
          const row = (by[key] ??= { n: 0, days: [] });
          row.n += 1;
          row.days.push(...sessionIsoDates(b));
        }
        setStats(by);
      })
      .catch(() => {});
  }, [refresh]);
  useRealtime(["customers"], refresh);

  async function save(sendInvite: boolean) {
    if (!draft || !draft.firstName.trim()) return;
    setBusy(true);
    setError(null);
    // `name` stays the composite because every other screen reads it — the
    // parts are stored alongside so "Dear Sarah" is possible in an email.
    const first = draft.firstName.trim();
    const last = draft.lastName.trim();
    const body = {
      name: [first, last].filter(Boolean).join(" "),
      firstName: first,
      lastName: last,
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      locationId: draft.locationId,
      // The name too, so a record still reads properly if a venue is renamed
      // or removed from the library later.
      locationName: venues.find((v) => v.id === draft.locationId)?.name ?? "",
      marketingOptIn: draft.marketingOptIn,
    };
    try {
      const saved = draft.id
        ? await api<Customer>(`/api/customers/${encodeURIComponent(draft.id)}`, {
            method: "PUT",
            body: JSON.stringify(body),
          })
        : await apiPost<Customer>("/api/customers", body);
      // Saving must not fail because the invite did — the family record is the
      // thing that had to happen; an invite can be re-sent from the row.
      if (sendInvite && body.email) {
        try {
          await apiPost(`/api/customers/${encodeURIComponent(saved.id)}/invite`, {});
        } catch (e) {
          setError(
            `Saved ${body.name}, but the sign-up link didn't send — ${
              e instanceof Error ? e.message : "unknown error"
            }`,
          );
        }
      }
      setDraft(null);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
    setBusy(false);
  }

  /** Invite a family already on the books — the edit form no longer offers it. */
  async function sendInvite(c: Customer) {
    setError(null);
    try {
      await apiPost(`/api/customers/${encodeURIComponent(c.id)}/invite`, {});
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the sign-up link");
    }
  }

  async function remove(c: Customer) {
    if (!confirm(`Remove “${c.name}”? They've never booked, so nothing else goes with them.`)) return;
    try {
      await api(`/api/customers/${encodeURIComponent(c.id)}`, { method: "DELETE" });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const edit = (c: Customer) => {
    // The form opens at the top of a long list, so without this nothing
    // appears to happen — you're left looking at the card you just pressed.
    //
    // scrollIntoView, not window.scrollTo: the portal scrolls an inner <main>,
    // not the window, so scrolling the window moves nothing at all.
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setDraft({
      id: c.id,
      firstName: c.firstName ?? splitName(c.name).firstName,
      lastName: c.lastName ?? splitName(c.name).lastName,
      email: c.email ?? "",
      phone: c.phone ?? "",
      locationId: c.locationId ?? "",
      marketingOptIn: !!c.marketingOptIn,
    });
  };

  const stageOf = (c: Customer): Stage => {
    const st = stats[(c.email ?? "").trim().toLowerCase()];
    if (st && st.n > 1) return "repeat";
    if (st && st.n > 0) return "customer";
    return c.invitedAt ? "invited" : "lead";
  };

  const query = q.trim().toLowerCase();
  const shown = (customers ?? []).filter(
    (c) =>
      (!stage || stageOf(c) === stage) &&
      (!loc || c.locationId === loc) &&
      (!day || (stats[(c.email ?? "").trim().toLowerCase()]?.days ?? []).includes(day)) &&
      (!query ||
      // Location included: the point of holding it is being able to pull
      // "everyone interested in Bedford" out of the list.
      `${c.name} ${c.email ?? ""} ${c.phone ?? ""} ${c.locationName ?? ""} ${(c.children ?? [])
        .map((k) => k.name)
        .join(" ")}`
        .toLowerCase()
        .includes(query)),
  );

  // Every child, with the family they belong to. Built from the same records
  // rather than fetched — a child has no existence apart from their family.
  // Thin for now (name and age): the full profile — allergies, SEND, the
  // collection password — lives on the parent's own child record, which an
  // operator can't read yet. See §K of the backend handoff.
  const kids = shown.flatMap((c) =>
    (c.children ?? []).map((k) => ({ ...k, family: c })),
  );

  return (
    // The same light palette Listings, Sessions & blocks and Bookings each set
    // locally. Without it this page ran on the portal's near-black, where the
    // navy "How it works" heading was all but invisible — and it sits in the
    // same sidebar group as three screens that are light.
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
      <div ref={topRef} className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          Leads &amp; customers
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!customers || customers.length === 0}
            title={customers?.length ? "Choose families, columns and a format" : "Nobody to export yet"}
            onClick={() => setExporting(true)}
          >
            ⬇ Export
          </Button>
          {canWrite && !draft && (
            <Button variant="primary" onClick={() => { topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); setDraft(emptyDraft()); }}>
              ＋ Add family
            </Button>
          )}
        </div>
      </div>
      {/* Folded away by default, same as the Listings tab: useful the first
          time, in the way every time after. */}
      <details className="group mb-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[13px] font-bold text-[var(--brand-ink,#1d3a8f)] [&::-webkit-details-marker]:hidden">
          <span className="inline-block transition-transform group-open:rotate-90">▸</span>
          <span>ℹ️ How it works</span>
        </summary>
        <div className="max-w-[760px] px-3.5 pb-3.5 pl-8 text-[12.5px] leading-[1.6] text-[var(--ink-3)]">
          <p className="mb-2">
            Everyone who has enquired or booked, and where each of them has got to. Bookings
            add and update people on their own — you never type a family in after they&rsquo;ve
            booked.
          </p>
          <p className="mb-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2 text-[var(--ink-2)]">
            <b>Add a family when someone rings.</b>{" "}
            Someone rings asking what&rsquo;s on: take their name, email and where they are, and
            send them a sign-up link. They land in their own area with every live listing and its
            dates, already registered — so they can book themselves at midnight without ringing
            you back.
          </p>
          <p className="m-0">
            It&rsquo;s also your marketing list. Tag a family with the location they asked about
            and a campaign can go to everyone interested in that site; the consent tick records
            who agreed to hear from you.
          </p>
        </div>
      </details>

      {error && (
        <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">
          {error}
        </div>
      )}

      {draft && (
        <Card className="mb-3.5 p-4">
          <div className="mb-2 text-[13.5px] font-extrabold">{draft.id ? "View / edit" : "Add family"}</div>
          <div className="grid gap-2.5 sm:grid-cols-4">
            <div>
              <FieldLabel>First name</FieldLabel>
              <Input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} className="w-full" />
            </div>
            <div>
              <FieldLabel>Surname</FieldLabel>
              <Input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} className="w-full" />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="w-full" />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className="w-full" />
            </div>
          </div>

          {/* One of your own sites, not their home address. A campaign goes to
              "everyone interested in Bedford", and a session provider posts
              nothing — so a street address would be personal data held for no
              purpose. */}
          <div className="mt-2.5 max-w-[320px]">
            <FieldLabel>
              Location{" "}
              <span className="font-normal text-[var(--ink-3)]">— which site they asked about</span>
            </FieldLabel>
            {venues.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--line)] px-2.5 py-2 text-[11.5px] text-[var(--ink-3)]">
                No locations set up yet — add them under Listings → Locations.
              </div>
            ) : (
              <select
                value={draft.locationId}
                onChange={(e) => setDraft({ ...draft, locationId: e.target.value })}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[12.5px] text-[var(--ink)] outline-none"
              >
                <option value="">Not said</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Marketing email needs consent under PECR, and the answer has to
              come from the parent — so it's a question the provider ticks
              because the family said yes, not a default. */}
          <label className="mt-2.5 flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5">
            <input
              type="checkbox"
              checked={draft.marketingOptIn}
              onChange={(e) => setDraft({ ...draft, marketingOptIn: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              <span className="block text-[12.5px] font-bold">
                They said yes to hearing about upcoming activities
              </span>
              <span className="block text-[11px] leading-[1.45] text-[var(--ink-3)]">
                Only tick this if they actually agreed on the call. Marketing email without
                consent is unlawful, and this is the record of it. Booking confirmations and
                payment links are sent either way — those aren&rsquo;t marketing.
              </span>
            </span>
          </label>

          {/* Children aren't asked for here. The parent adds them once, with
              everything that actually matters — date of birth, allergies,
              SEND, collection password — and a thin name-and-age copy in a
              second place is how two versions of a child come to exist. */}
          {/* Two buttons on a new family, one on an edit. Sending an invite is
              a thing you decide by pressing it, not a checkbox to remember —
              and editing a family shouldn't offer to email them at all. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="primary" disabled={busy || !draft.firstName.trim()} onClick={() => save(false)}>
              {busy ? "Saving…" : "Save"}
            </Button>
            {/* On a new family this creates the account; on an existing one it
                saves the edits first, so a corrected email address is the one
                the link goes to. */}
            <Button
              disabled={busy || !draft.firstName.trim() || !draft.email.trim()}
              title={draft.email.trim() ? "Save, then email them a link to set a password" : "Needs an email address"}
              onClick={() => save(true)}
            >
              ✉ Save &amp; send sign-up link
            </Button>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
          </div>
          <div className="mt-1.5 text-[11px] leading-[1.45] text-[var(--ink-3)]">
            The link lets them set a password and land in their own area, where they can see
            every live listing and its dates. Their name and email carry over — it won&rsquo;t
            ask again.
          </div>
        </Card>
      )}

      {/* The pipeline, and the filter. Each tile is a stage and pressing one
          narrows the list to it — the count is the point, so it may as well
          be the control. */}
      {customers && customers.length > 0 && (
        <div className="mb-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((st) => {
            const n = customers.filter((c) => stageOf(c) === st.key).length;
            const on = stage === st.key;
            return (
              <button
                key={st.key}
                type="button"
                title={st.hint}
                onClick={() => setStage(on ? "" : st.key)}
                className={
                  "rounded-2xl px-4 py-3 text-left transition-all hover:-translate-y-px " +
                  (on ? "text-white shadow-[0_10px_24px_-16px_rgba(9,20,44,.8)]" : "bg-[var(--surface)]")
                }
                style={
                  on
                    ? { background: st.colour }
                    : { border: "1px solid var(--line)", borderLeft: `5px solid ${st.colour}` }
                }
              >
                <div
                  className="text-[10.5px] font-extrabold uppercase tracking-[0.07em]"
                  style={{ color: on ? "rgba(255,255,255,.9)" : "var(--ink-3)" }}
                >
                  {st.label}
                </div>
                <div className="text-[24px] font-extrabold leading-tight tabular-nums">{n}</div>
                <div
                  className="text-[10.5px] leading-[1.35]"
                  style={{ color: on ? "rgba(255,255,255,.85)" : "var(--ink-3)" }}
                >
                  {st.hint}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Location and a booking date, in the same components the Listings and
          Bookings tabs use, so the three screens filter the same way. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {venues.length > 0 && (
          <Pill active={!!loc} onClear={() => setLoc("")}>
            <PillSelect
              active={!!loc}
              value={loc}
              onChange={setLoc}
              title="Filter by location"
              options={[["", "Location"], ...venues.map((v) => [v.id, v.name] as [string, string])]}
            />
          </Pill>
        )}

        <Pill active={!!day} onClear={() => setDay("")}>
          <span
            className="whitespace-nowrap text-[12.5px] font-semibold"
            style={{ color: day ? "#fff" : "var(--ink)" }}
          >
            Booked on
          </span>
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="h-full w-[112px] border-0 bg-transparent text-[12.5px] font-semibold outline-none"
            style={{ color: day ? "#fff" : "var(--ink)", colorScheme: day ? "dark" : "light" }}
          />
        </Pill>

        {/* A button, not a line of underlined text — it's the way out of a
            filter you may not remember setting. */}
        {(stage || loc || day) && (
          <button
            type="button"
            onClick={() => {
              setStage("");
              setLoc("");
              setDay("");
            }}
            className="h-8 rounded-full border-2 border-[var(--brand)] px-3.5 text-[12px] font-extrabold text-[var(--brand)] transition-colors hover:bg-[var(--brand)] hover:text-white"
          >
            Show everyone
          </button>
        )}

        {(stage || loc || day) && (
          <span className="text-[11.5px] text-[var(--ink-3)]">
            {shown.length} of {customers?.length ?? 0}
          </span>
        )}
      </div>

      {/* One list or the other, same filters underneath — a provider thinks
          in families when chasing money and in children when running a day. */}
      <div className="mb-3 inline-flex rounded-full border border-[var(--line)] bg-[var(--surface)] p-0.5">
        {(
          [
            ["families", `Families${customers ? ` (${shown.length})` : ""}`],
            ["children", `Children${customers ? ` (${kids.length})` : ""}`],
          ] as ["families" | "children", string][]
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className="rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors"
            style={view === v ? { background: "var(--brand)", color: "#fff" } : { color: "var(--ink-3)" }}
          >
            {label}
          </button>
        ))}
      </div>

      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍  Search by name, child, email, phone or location…" className="mb-3 w-full max-w-[360px]" />

      {!customers ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : shown.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          {query ? "Nobody matches your search." : "Nobody here yet — people appear automatically with their first booking, or add one when someone enquires."}
        </Card>
      ) : view === "children" ? (
        kids.length === 0 ? (
          <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
            No children on record yet — they arrive with a booking, or when a parent adds them
            to their own account.
          </Card>
        ) : (
          <div className="grid gap-2.5 lg:grid-cols-2">
            {kids.map((k, i) => {
              const st = STAGES.find((x) => x.key === stageOf(k.family))!;
              const key = `${k.family.id}-${k.name}-${i}`;
              return (
                <div
                  key={key}
                  className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] transition-all hover:shadow-[0_14px_30px_-20px_rgba(9,20,44,.6)]"
                >
                <div className="flex items-center gap-3 px-4 py-3 pl-5">
                  <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: st.colour }} />
                  {k.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={k.photo}
                      alt=""
                      className="h-10 w-10 flex-none rounded-full object-cover"
                      style={{ boxShadow: `0 0 0 2.5px ${st.colour}` }}
                    />
                  ) : (
                    <span
                      className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[14px] font-extrabold text-white"
                      style={{ background: st.colour }}
                    >
                      {k.name.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <span className="truncate text-[14px] font-extrabold">{k.name}</span>
                      {k.age !== undefined && (
                        <span className="text-[11.5px] text-[var(--ink-3)]">age {k.age}</span>
                      )}
                    </div>
                    <div className="truncate text-[11.5px] text-[var(--ink-3)]">
                      {k.family.name}
                      {k.family.locationName ? ` · 📍 ${k.family.locationName}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenKid(key === openKid ? null : key)}
                    className="flex-none rounded-full border-2 px-3 py-[3px] text-[11.5px] font-extrabold transition-colors"
                    style={
                      key === openKid
                        ? { borderColor: st.colour, background: st.colour, color: "#fff" }
                        : { borderColor: st.colour, color: st.colour }
                    }
                  >
                    {key === openKid ? "Close" : "Open"}
                  </button>
                </div>

                {key === openKid && (
                  <div className="border-t border-[var(--line)] bg-[var(--panel)] px-4 py-3 pl-5">
                    <div className="grid gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-2">
                      <Row label="Date of birth" value={k.dob} />
                      <Row label="Age" value={k.age !== undefined ? String(k.age) : ""} />
                      <Row label="Family" value={k.family.name} />
                      <Row label="Contact" value={[k.family.email, k.family.phone].filter(Boolean).join(" · ")} />
                      <Row label="Location" value={k.family.locationName} />
                      <Row label="Stage" value={st.label} />
                    </div>

                    {/* Named rather than omitted. A blank allergies line reads
                        as "no allergies", which is the dangerous reading. */}
                    <div className="mt-2.5 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] px-3 py-2">
                      <div className="text-[11px] font-extrabold text-[var(--ink-2)]">
                        Not visible to you yet
                      </div>
                      <div className="mt-0.5 text-[11px] leading-[1.5] text-[var(--ink-3)]">
                        Allergies · Medical · SEND and their plan · Collection password · Photo ·
                        Emergency contact — the parent holds these on their own account. They
                        appear here once the accounts are linked, and a blank line here does{" "}
                        <b>not</b> mean a child has none.
                      </div>
                    </div>
                  </div>
                )}
              </div>
              );
            })}
            <div className="col-span-full mt-1 text-[11px] leading-[1.5] text-[var(--ink-3)]">
              Names and ages only for now. Allergies, medical, SEND and the collection password
              live on the parent&rsquo;s own record — they appear here once the accounts are
              linked.
            </div>
          </div>
        )
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((c) => {
            const st = stats[(c.email ?? "").trim().toLowerCase()] ?? { n: 0, spend: 0 };
            // The card wears its stage colour — the same four as the tiles
            // above — so the list is scannable by where people have got to.
            // A per-family colour looked pretty and told you nothing.
            const stageNow = stageOf(c);
            const stageDef = STAGES.find((x) => x.key === stageNow)!;
            const tint = stageDef.colour;
            return (
              // No overflow-hidden here: it clipped the Contact menu to the
              // card, which is why the menu opened invisibly. The spine rounds
              // its own left corners instead of relying on the clip.
              <div
                key={c.id}
                data-family-card
                className="group relative rounded-2xl border border-[var(--line)] bg-[var(--surface)] transition-all hover:-translate-y-px hover:shadow-[0_14px_30px_-20px_rgba(9,20,44,.6)]"
              >
                {/* The family's own colour down the edge — a wall of white
                    cards is the thing that made this page a wall. */}
                <span className="absolute inset-y-0 left-0 w-1.5 rounded-l-2xl" style={{ background: tint }} />

                {/* No avatar on a family. It's an adult we'll never have a
                    photo of, so the circle was two initials in a colour the
                    spine and the stage pill already carry. */}
                <div className="flex items-start gap-3 p-4 pl-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[15px] font-extrabold">{c.name}</span>
                      <span
                        className="rounded-full px-2 py-[2px] text-[10px] font-extrabold text-white"
                        style={{ background: tint }}
                        title={stageDef.hint}
                      >
                        {stageDef.label}
                      </span>
                      {c.locationName && (
                        <span className="rounded-full bg-[var(--brand-soft,#eaf0fc)] px-2 py-[2px] text-[10px] font-extrabold text-[var(--brand-ink,#1d3a8f)]">
                          📍 {c.locationName}
                        </span>
                      )}
                      {c.marketingOptIn && (
                        <span className="rounded-full bg-[#e7f8ee] px-2 py-[2px] text-[10px] font-extrabold text-[#0f7a44]">
                          ✉ Marketing
                        </span>
                      )}
                      {c.invitedAt && (
                        <span className="rounded-full bg-[#eef0f6] px-2 py-[2px] text-[10px] font-extrabold text-[#5b6478]">
                          Invited
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[11.5px] text-[var(--ink-3)]">
                      {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact details"}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(c.children ?? []).length === 0 ? (
                        <span className="text-[11px] text-[var(--ink-3)]">No children on record</span>
                      ) : (
                        (c.children ?? []).map((k) => (
                          <span
                            key={k.name}
                            className="rounded-full border px-2.5 py-[3px] text-[11px] font-bold"
                            style={{ borderColor: `${tint}44`, background: `${tint}12`, color: "var(--ink-2)" }}
                          >
                            {k.name}
                            {k.age !== undefined ? ` · ${k.age}` : ""}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* How much they've booked, not how much they've spent —
                      a customer list that leads with money reads like a
                      ranking of families. */}
                  <div className="flex-none text-right">
                    <div className="text-[19px] font-extrabold tabular-nums">{st.n}</div>
                    <div className="text-[10.5px] text-[var(--ink-3)]">
                      booking{st.n === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                {/* Actions sit on their own strip: reachable, but not shouting
                    over the family's name the way two buttons at the top did. */}
                <div className="flex flex-wrap items-center gap-1.5 rounded-b-2xl border-t border-[var(--line)] bg-[var(--panel)] px-4 py-2 pl-5">
                  <ContactMenu email={c.email} phone={c.phone} name={c.name} />
                  {canWrite && (c.email ?? "").includes("@") && (
                    <button
                      type="button"
                      onClick={() => sendInvite(c)}
                      title={c.invitedAt ? "Send the sign-up link again" : "Create their account and email a link to set a password"}
                      className="rounded-full border border-[var(--brand-2,#2f6bd8)] bg-[var(--brand-soft,#eaf0fc)] px-2.5 py-[3px] text-[11.5px] font-bold text-[var(--brand-ink,#1d3a8f)]"
                    >
                      {c.invitedAt ? "Re-send sign-up link" : "Send sign-up link"}
                    </button>
                  )}
                  {canWrite && (
                    <>
                      <button
                        type="button"
                        onClick={() => edit(c)}
                        className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-[3px] text-[11.5px] font-bold text-[var(--ink-2)] hover:border-[var(--ink-3)]"
                      >
                        View / edit
                      </button>
                      {/* Only ever deletable before they've booked. After
                          that the record is holding their bookings' history
                          and whatever they agreed to — the server refuses it
                          too, this just doesn't offer what won't work. */}
                      {st.n === 0 ? (
                        <button
                          type="button"
                          onClick={() => remove(c)}
                          className="ml-auto rounded-full px-2.5 py-[3px] text-[11.5px] font-bold text-[var(--ink-3)] transition-colors hover:text-[var(--red,#e21d27)]"
                        >
                          Remove
                        </button>
                      ) : (
                        <span
                          className="ml-auto text-[10.5px] text-[var(--ink-3)]"
                          title="Families with bookings can't be deleted — their bookings and consent record depend on it"
                        >
                          Has bookings
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {exporting && (
        <FamiliesExport
          rows={(customers ?? []).map<FamilyRow>((c) => ({
            ...c,
            stage: STAGES.find((x) => x.key === stageOf(c))?.label ?? "",
            bookings: stats[(c.email ?? "").trim().toLowerCase()]?.n ?? 0,
          }))}
          stages={STAGES.map((x) => ({ key: x.label, label: x.label }))}
          locations={venues}
          onClose={() => setExporting(false)}
        />
      )}
    </div>
  );
}
