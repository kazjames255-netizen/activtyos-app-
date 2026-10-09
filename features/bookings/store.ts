import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Booking, BookingFilter } from "./types";
import type { BulkAction, CreateBookingInput, RefundType, ReleaseOpts, RowAction } from "./mutations";

/** A money action waiting for the provider's explicit confirmation (inline panel in the booking detail) —
 *  none of these ever fires on a single click. */
export type ConfirmIntent =
  | { kind: "paid" }
  | { kind: "refund-approve" }
  | { kind: "refund-sent" }
  | { kind: "cancel-child"; ki: number }
  | { kind: "cancel-day"; ki: number; dt: string };

// Take-a-booking payload: a real block (capacity/waitlist apply) or a
// free-text dates label for unscheduled phone bookings.
export type TakeBookingInput = Omit<CreateBookingInput, "dates"> &
  ({ blockId: string; dates?: undefined } | { dates: string; blockId?: undefined });
import { get as apiGet, post as apiPost, ApiError } from "@/lib/api";
import { csvFilename } from "./helpers";
import { downloadCsv, localizedCsv } from "./exportFile";
import { tNow } from "@/lib/i18n/provider";

// The store no longer owns booking mutations — every change is a call to the
// Express API (which runs the shared logic from ./mutations inside a
// Firestore transaction) followed by applying the server's returned record.
// The API derives the tenant scope from the signed-in account, so there is
// no portal/tenant parameter anywhere here. Only transient view state
// (_cancelling, _refundType, _chgKi, _chgDt) is mutated locally.

type UiRowAction = RowAction | "resend";
type UiBulkAction = BulkAction | "email" | "export";

interface BookingsState {
  bookings: Booking[];
  loading: boolean;
  error: string | null;

  filter: BookingFilter;
  query: string;
  // The list's secondary narrowing controls (listing / day / date-range /
  // season). Lifted out of BookingsList's local state so BookingsApp can
  // mirror them into the URL alongside filter/query/ref — a Back press
  // used to leave the route untouched entirely (see openRef push below),
  // and even once that was fixed, these four stayed local-only so a
  // refresh or Back still silently reset them.
  listingFilter: string;
  dayFilter: string;
  rangeFilter: "" | "today" | "yesterday" | "week";
  seasonFilter: string;
  selected: Record<string, boolean>;
  openRef: string | null;
  showCreate: boolean;
  /** When "Take a booking" is opened from a specific listing's card, the
   *  listing to preselect in the modal's dropdown. */
  createListingId: string | null;
  /** Bulk-email compose: the selected bookers (deduped, valid emails only). */
  emailCompose: { emails: string[]; names: string[] } | null;
  emailSending: boolean;

  refresh: () => Promise<void>;

  setFilter: (f: BookingFilter) => void;
  setQuery: (q: string) => void;
  setListingFilter: (v: string) => void;
  setDayFilter: (v: string) => void;
  setRangeFilter: (v: "" | "today" | "yesterday" | "week") => void;
  setSeasonFilter: (v: string) => void;
  toggleSel: (ref: string) => void;
  clearSel: () => void;
  selectMany: (refs: string[]) => void;
  resolveMove: (ref: string, approve: boolean, reason?: string, approveIndexes?: number[]) => void;
  /** Answer a family's request to change / cancel one extra: approve (with what to do about the money) or decline. */
  resolveAddon: (ref: string, requestId: string, decision: { approve: true; resolution?: string; amount?: number } | { approve: false; reason?: string }) => void;
  bulk: (action: UiBulkAction) => void;
  emailClose: () => void;
  sendBulkEmail: (subject: string, body: string) => Promise<boolean>;
  open: (ref: string) => void;
  close: () => void;
  act: (ref: string, action: UiRowAction, reason?: string, extra?: { alreadySent?: boolean; confirmAlreadyRefunded?: boolean }) => void;
  /** Set when the server refused Approve (409 already_refunded_in_stripe): the money was also refunded in Stripe. The panel asks before retrying. */
  stripeWarn: { ref: string; stripeRefunded: number; pending: number; alreadySent: boolean } | null;
  clearStripeWarn: () => void;

  cancelOpen: (ref: string) => void;
  cancelAbort: (ref: string) => void;
  setRefund: (ref: string, type: RefundType) => void;
  doCancel: (ref: string, partialAmount?: number) => void;

  saveNote: (ref: string, text: string) => void;

  /** A short confirmation shown in the page (replaces window.alert), e.g. 'Reminder sent to … · reminder 2'. Cleared after a few seconds. */
  notice: { ref: string; text: string } | null;
  /** The money action the provider is being asked to confirm, and on which booking. */
  confirm: { ref: string; intent: ConfirmIntent } | null;
  /** Opens the booking and its confirm panel — the action itself runs only from the panel. */
  askConfirm: (ref: string, intent: ConfirmIntent) => void;
  clearConfirm: () => void;
  cancelChild: (ref: string, ki: number, opts?: ReleaseOpts) => void;
  cancelDay: (ref: string, ki: number, dt: string, opts?: ReleaseOpts) => void;
  changeDay: (ref: string, ki: number, dt: string) => void;
  cancelChange: (ref: string) => void;
  applyChangeDay: (ref: string, ki: number, oldDt: string, newDt: string) => void;

  openCreate: (listingId?: string) => void;
  createBooking: (input: TakeBookingInput) => void;
}

const selectedRefs = (sel: Record<string, boolean>) =>
  Object.keys(sel).filter((k) => sel[k]);

// Where the list was scrolled to right before a booking was opened — not
// store STATE (it shouldn't trigger a re-render or ride in the URL), just
// enough memory to put the list back where it was on close/Back.
let scrollMemory: number | null = null;

// The portal shell scrolls its own <main> (app/[portal]/layout.tsx), not
// window/body — window.scrollY is always 0 here, so that's what needs
// capturing and restoring, not the window.
function scrollContainer(): (Element & { scrollTop: number }) | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(".aos-shell-main");
}

const TRANSIENT_KEYS = ["_cancelling", "_refundType", "_chgKi", "_chgDt"] as const;

export const useBookingsStore = create<BookingsState>()(
  immer((set, get) => {
    // Replace a booking with the server's copy, preserving local transient
    // view state so open panels don't snap shut mid-interaction.
    const applyServer = (updated: Booking) =>
      set((s) => {
        const ix = s.bookings.findIndex((x) => x.ref === updated.ref);
        if (ix < 0) return;
        const prev = s.bookings[ix];
        for (const k of TRANSIENT_KEYS) {
          (updated as unknown as Record<string, unknown>)[k] = prev[k];
        }
        s.bookings[ix] = updated;
      });

    // Run an API mutation with unified error handling.
    const run = async (fn: () => Promise<void>) => {
      set((s) => void (s.error = null));
      try {
        await fn();
      } catch (e) {
        set((s) => void (s.error = e instanceof Error ? e.message : tNow("p8lst.bsReqFailed")));
      }
    };

    const actionsUrl = (ref: string) => `/api/bookings/${encodeURIComponent(ref)}/actions`;

    return {
      bookings: [],
      loading: false,
      error: null,

      filter: "all",
      query: "",
      listingFilter: "",
      dayFilter: "",
      rangeFilter: "",
      seasonFilter: "",
      selected: {},
      openRef: null,
      confirm: null,
      stripeWarn: null,
      clearStripeWarn: () => set((s) => void (s.stripeWarn = null)),
      notice: null,
      showCreate: false,
      createListingId: null,
      emailCompose: null,
      emailSending: false,

      refresh: async () => {
        set((s) => void (s.loading = true));
        try {
          const list = await apiGet<Booking[]>(`/api/bookings`);
          set((s) => {
            s.bookings = list;
            s.loading = false;
            s.error = null;
          });
        } catch (e) {
          set((s) => {
            s.loading = false;
            s.error = e instanceof Error ? e.message : tNow("p8lst.bsLoadFailed");
          });
        }
      },

      setFilter: (f) => set((s) => void (s.filter = f)),
      setQuery: (q) => set((s) => void (s.query = q)),
      setListingFilter: (v) => set((s) => void (s.listingFilter = v)),
      setDayFilter: (v) => set((s) => void (s.dayFilter = v)),
      setRangeFilter: (v) => set((s) => void (s.rangeFilter = v)),
      setSeasonFilter: (v) => set((s) => void (s.seasonFilter = v)),
      toggleSel: (ref) => set((s) => void (s.selected[ref] = !s.selected[ref])),
      clearSel: () => set((s) => void (s.selected = {})),
      // Tick every ref passed (the currently-visible/filtered rows) so a whole
      // list can be bulk-actioned in one go.
      selectMany: (refs) => set((s) => { for (const r of refs) s.selected[r] = true; }),

      bulk: (action) => {
        const refs = selectedRefs(get().selected);
        const n = refs.length;
        if (!n) return;
        if (action === "email") {
          // Compose to the selected bookings' families — sent through the
          // same broadcast endpoint Messages uses, so replies land in
          // each family's thread.
          const picked = get().bookings.filter((b) => refs.includes(b.ref));
          const byEmail = new Map<string, string>();
          for (const b of picked) if (b.email?.includes("@")) byEmail.set(b.email.toLowerCase(), b.booker || b.email);
          if (!byEmail.size) {
            set((s) => void (s.error = tNow("p8lst.bsNoEmail")));
            return;
          }
          set((s) => void (s.emailCompose = { emails: [...byEmail.keys()], names: [...byEmail.values()] }));
          return;
        }
        if (action === "export") {
          // The selected ones, in the order they appear on screen.
          const picked = get().bookings.filter((b) => refs.includes(b.ref));
          downloadCsv(csvFilename("bookings-selected"), localizedCsv(picked));
          set((s) => void (s.selected = {}));
          return;
        }
        void run(async () => {
          const updated = await apiPost<Booking[]>(`/api/bookings/bulk`, { refs, action });
          updated.forEach(applyServer);
          set((s) => void (s.selected = {}));
        });
      },

      emailClose: () => set((s) => void (s.emailCompose = null)),
      sendBulkEmail: async (subject, body) => {
        const compose = get().emailCompose;
        if (!compose || !body.trim()) return false;
        set((s) => {
          s.emailSending = true;
          s.error = null;
        });
        try {
          await apiPost<{ sent: number }>("/api/messages/broadcast", {
            emails: compose.emails,
            body: body.trim(),
            ...(subject.trim() ? { subject: subject.trim() } : {}),
          });
          set((s) => {
            s.emailSending = false;
            s.emailCompose = null;
            s.selected = {};
          });
          return true;
        } catch (e) {
          set((s) => {
            s.emailSending = false;
            s.error = e instanceof Error ? e.message : tNow("p8lst.bsSendFailed");
          });
          return false;
        }
      },

      open: (ref) => {
        set((s) => {
          // Only remember the list's scroll position on the transition INTO
          // the split view (not switching between two already-open
          // bookings) — that's the position Back/close should hand back.
          if (!s.openRef) scrollMemory = scrollContainer()?.scrollTop ?? null;
          s.openRef = ref;
        });
        try {
          const el = scrollContainer();
          if (el) el.scrollTop = 0; else window.scrollTo(0, 0);
        } catch {
          /* noop */
        }
      },
      close: () => {
        set((s) => { s.openRef = null; s.confirm = null; });
        const y = scrollMemory;
        scrollMemory = null;
        if (y === null) return;
        // The list going from compact back to full width doesn't remount it
        // (same rows, just re-styled), but it DOES still need a reflow before
        // its scrollHeight is tall enough to take `y` — setting it in the
        // same tick can get silently clamped to whatever the (still-compact)
        // height allows. requestAnimationFrame is the natural "after the
        // repaint" hook, but a backgrounded tab defers it indefinitely,
        // which would leave the list stuck at the top — setTimeout keeps
        // (throttled, not suspended) firing even then.
        const restore = () => {
          try {
            const el = scrollContainer();
            if (el) el.scrollTop = y; else window.scrollTo(0, y);
          } catch {
            /* noop */
          }
        };
        try {
          requestAnimationFrame(restore);
        } catch {
          /* noop */
        }
        setTimeout(restore, 0);
      },

      resolveMove: (ref, approve, reason, approveIndexes) => {
        void run(async () => {
          applyServer(await apiPost<Booking>(actionsUrl(ref), approve
            ? { type: "move-approve", ...(approveIndexes ? { approveIndexes } : {}), reason: reason?.trim() || undefined }
            : { type: "move-deny", reason: reason?.trim() || undefined }));
        });
      },

      resolveAddon: (ref, requestId, decision) => {
        void run(async () => {
          applyServer(await apiPost<Booking>(actionsUrl(ref), decision.approve
            ? { type: "addon-approve", requestId, ...(decision.resolution ? { resolution: decision.resolution } : {}), ...(decision.amount != null ? { amount: decision.amount } : {}) }
            : { type: "addon-decline", requestId, reason: decision.reason?.trim() || undefined }));
        });
      },

      act: (ref, action, reason, extra) => {
        void run(async () => {
          try {
            applyServer(await apiPost<Booking>(actionsUrl(ref), { type: action, ...(reason?.trim() ? { reason: reason.trim() } : {}), ...(extra?.alreadySent ? { alreadySent: true } : {}), ...(extra?.confirmAlreadyRefunded ? { confirmAlreadyRefunded: true } : {}) }));
          } catch (e) {
            // Nothing was changed: ask the provider whether to refund more on top of what Stripe already returned.
            const body = e instanceof ApiError ? (e.body as { code?: string; stripeRefunded?: number; pending?: number } | undefined) : undefined;
            if (action === "refund-approve" && body?.code === "already_refunded_in_stripe") {
              set((s) => void (s.stripeWarn = { ref, stripeRefunded: Number(body.stripeRefunded) || 0, pending: Number(body.pending) || 0, alreadySent: !!extra?.alreadySent }));
              return;
            }
            throw e;
          }
          set((s) => { s.confirm = null; s.stripeWarn = null; });
          if (action === "resend") {
            const b = get().bookings.find((x) => x.ref === ref);
            if (b) {
              set((s) => void (s.notice = { ref, text: tNow("p7bd.invResentToast", { email: b.email, n: String(b.invoiceResends?.count ?? 1) }) }));
              setTimeout(() => set((s) => void (s.notice?.ref === ref && (s.notice = null))), 7000);
            }
          }
        });
      },

      cancelOpen: (ref) =>
        set((s) => {
          const b = s.bookings.find((x) => x.ref === ref);
          if (!b) return;
          b._cancelling = true;
          b._refundType = b._refundType || "full";
        }),
      cancelAbort: (ref) =>
        set((s) => {
          const b = s.bookings.find((x) => x.ref === ref);
          if (b) b._cancelling = false;
        }),
      setRefund: (ref, type) =>
        set((s) => {
          const b = s.bookings.find((x) => x.ref === ref);
          if (b) b._refundType = type;
        }),
      doCancel: (ref, partialAmount) => {
        const b = get().bookings.find((x) => x.ref === ref);
        if (!b) return;
        const refund = b._refundType || "full";
        void run(async () => {
          const updated = await apiPost<Booking>(actionsUrl(ref), {
            type: "cancel",
            refund,
            amount: refund === "partial" ? partialAmount || 0 : undefined,
          });
          updated._cancelling = false;
          set((s) => {
            const ix = s.bookings.findIndex((x) => x.ref === updated.ref);
            if (ix > -1) s.bookings[ix] = updated;
          });
        });
      },

      saveNote: (ref, text) =>
        void run(async () => {
          applyServer(await apiPost<Booking>(actionsUrl(ref), { type: "note", text }));
        }),

      askConfirm: (ref, intent) => {
        get().open(ref);
        set((s) => void (s.confirm = { ref, intent }));
      },
      clearConfirm: () => set((s) => { s.confirm = null; s.stripeWarn = null; }),

      cancelChild: (ref, ki, opts) =>
        void run(async () => {
          applyServer(await apiPost<Booking>(actionsUrl(ref), { type: "cancel-child", ki, ...(opts ?? {}) }));
          set((s) => void (s.confirm = null));
        }),

      cancelDay: (ref, ki, dt, opts) =>
        void run(async () => {
          applyServer(await apiPost<Booking>(actionsUrl(ref), { type: "cancel-day", ki, date: dt, ...(opts ?? {}) }));
          set((s) => void (s.confirm = null));
        }),

      changeDay: (ref, ki, dt) =>
        set((s) => {
          const b = s.bookings.find((x) => x.ref === ref);
          if (!b) return;
          b._chgKi = ki;
          b._chgDt = dt;
        }),
      cancelChange: (ref) =>
        set((s) => {
          const b = s.bookings.find((x) => x.ref === ref);
          if (b) {
            b._chgKi = null;
            b._chgDt = null;
          }
        }),
      applyChangeDay: (ref, ki, oldDt, newDt) =>
        void run(async () => {
          const updated = await apiPost<Booking>(actionsUrl(ref), {
            type: "change-day",
            ki,
            oldDate: oldDt,
            newDate: newDt,
          });
          updated._chgKi = null;
          updated._chgDt = null;
          set((s) => {
            const ix = s.bookings.findIndex((x) => x.ref === updated.ref);
            if (ix > -1) s.bookings[ix] = updated;
          });
        }),

      openCreate: (listingId?: string) => set((s) => { s.showCreate = true; s.createListingId = listingId ?? null; }),
      createBooking: (input) =>
        void run(async () => {
          const created = await apiPost<Booking>(`/api/bookings`, input);
          set((s) => {
            s.bookings.unshift(created);
            s.filter = "all";
            s.showCreate = false;
          });
          setTimeout(
            () => alert("✓ Booking created — a secure payment link has been emailed to the parent."),
            40,
          );
        }),
    };
  }),
);
