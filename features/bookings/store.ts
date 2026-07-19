import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Booking, BookingFilter } from "./types";
import type { BulkAction, CreateBookingInput, RefundType, RowAction } from "./mutations";

// Take-a-booking payload: a real block (capacity/waitlist apply) or a
// free-text dates label for unscheduled phone bookings.
export type TakeBookingInput = Omit<CreateBookingInput, "dates"> &
  ({ blockId: string; dates?: undefined } | { dates: string; blockId?: undefined });
import { get as apiGet, post as apiPost } from "@/lib/api";
import { bookingsToCsv, csvFilename } from "./helpers";
import { downloadCsv } from "./exportFile";

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
  selected: Record<string, boolean>;
  openRef: string | null;
  showCreate: boolean;

  refresh: () => Promise<void>;

  setFilter: (f: BookingFilter) => void;
  setQuery: (q: string) => void;
  toggleSel: (ref: string) => void;
  clearSel: () => void;
  bulk: (action: UiBulkAction) => void;
  open: (ref: string) => void;
  close: () => void;
  act: (ref: string, action: UiRowAction) => void;

  cancelOpen: (ref: string) => void;
  cancelAbort: (ref: string) => void;
  setRefund: (ref: string, type: RefundType) => void;
  doCancel: (ref: string, partialAmount?: number) => void;

  saveNote: (ref: string, text: string) => void;

  cancelChild: (ref: string, ki: number) => void;
  cancelDay: (ref: string, ki: number, dt: string) => void;
  changeDay: (ref: string, ki: number, dt: string) => void;
  cancelChange: (ref: string) => void;
  applyChangeDay: (ref: string, ki: number, oldDt: string, newDt: string) => void;

  openCreate: () => void;
  createBooking: (input: TakeBookingInput) => void;
}

const selectedRefs = (sel: Record<string, boolean>) =>
  Object.keys(sel).filter((k) => sel[k]);

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
        set((s) => void (s.error = e instanceof Error ? e.message : "Request failed"));
      }
    };

    const actionsUrl = (ref: string) => `/api/bookings/${encodeURIComponent(ref)}/actions`;

    return {
      bookings: [],
      loading: false,
      error: null,

      filter: "all",
      query: "",
      selected: {},
      openRef: null,
      showCreate: false,

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
            s.error = e instanceof Error ? e.message : "Failed to load bookings";
          });
        }
      },

      setFilter: (f) => set((s) => void (s.filter = f)),
      setQuery: (q) => set((s) => void (s.query = q)),
      toggleSel: (ref) => set((s) => void (s.selected[ref] = !s.selected[ref])),
      clearSel: () => set((s) => void (s.selected = {})),

      bulk: (action) => {
        const refs = selectedRefs(get().selected);
        const n = refs.length;
        if (!n) return;
        if (action === "email") {
          setTimeout(() => alert(`Opened a message to ${n} booker(s).`), 40);
          return;
        }
        if (action === "export") {
          // The selected ones, in the order they appear on screen.
          const picked = get().bookings.filter((b) => refs.includes(b.ref));
          downloadCsv(csvFilename("bookings-selected"), bookingsToCsv(picked));
          set((s) => void (s.selected = {}));
          return;
        }
        void run(async () => {
          const updated = await apiPost<Booking[]>(`/api/bookings/bulk`, { refs, action });
          updated.forEach(applyServer);
          set((s) => void (s.selected = {}));
        });
      },

      open: (ref) => {
        set((s) => void (s.openRef = ref));
        try {
          window.scrollTo(0, 0);
        } catch {
          /* noop */
        }
      },
      close: () => set((s) => void (s.openRef = null)),

      act: (ref, action) => {
        void run(async () => {
          applyServer(await apiPost<Booking>(actionsUrl(ref), { type: action }));
          if (action === "resend") {
            const b = get().bookings.find((x) => x.ref === ref);
            if (b) setTimeout(() => alert(`Payment link / invoice re-sent to ${b.email}.`), 20);
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

      cancelChild: (ref, ki) =>
        void run(async () => {
          applyServer(await apiPost<Booking>(actionsUrl(ref), { type: "cancel-child", ki }));
        }),

      cancelDay: (ref, ki, dt) =>
        void run(async () => {
          applyServer(await apiPost<Booking>(actionsUrl(ref), { type: "cancel-day", ki, date: dt }));
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

      openCreate: () => set((s) => void (s.showCreate = true)),
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
