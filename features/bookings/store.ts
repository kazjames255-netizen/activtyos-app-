import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Booking, BookingFilter } from "./types";
import { seedBookings } from "./data";
import { bookingKids, kidActiveDays, nowStr, refundedTotal } from "./helpers";

type RefundType = "full" | "partial" | "none";
type BulkAction = "approve" | "decline" | "waitlist" | "cancel" | "email" | "export";
type RowAction =
  | "approve"
  | "decline"
  | "paid"
  | "resend"
  | "recon"
  | "promote"
  | "refund-approve"
  | "refund-decline";

export interface CreateBookingInput {
  booker: string;
  email: string;
  child: string;
  age: number;
  listing: string;
  pass: string;
  dates: string;
  amount: number;
  method: string;
}

interface BookingsState {
  bookings: Booking[];
  filter: BookingFilter;
  query: string;
  selected: Record<string, boolean>;
  openRef: string | null;
  showCreate: boolean;
  nextBid: number;

  setFilter: (f: BookingFilter) => void;
  setQuery: (q: string) => void;
  toggleSel: (ref: string) => void;
  clearSel: () => void;
  bulk: (action: BulkAction) => void;
  open: (ref: string) => void;
  close: () => void;
  act: (ref: string, action: RowAction) => void;

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
  createBooking: (input: CreateBookingInput) => void;
}

// Recompute a booking's derived status/pay after per-child/per-day refunds.
function applyCancelState(b: Booking) {
  const kids = bookingKids(b);
  const allCancelled = kids.length > 0 && kids.every((k) => k.cancelled);
  if (allCancelled) b.status = "Cancelled";
  const r = refundedTotal(b);
  if (r >= b.amount - 0.001) b.pay = "Refunded";
  else if (r > 0) b.pay = "Partially refunded";
}

const selectedRefs = (sel: Record<string, boolean>) =>
  Object.keys(sel).filter((k) => sel[k]);

export const useBookingsStore = create<BookingsState>()(
  immer((set, get) => ({
    // Deep clone the seed so edits never mutate the imported module.
    bookings: JSON.parse(JSON.stringify(seedBookings)) as Booking[],
    filter: "all",
    query: "",
    selected: {},
    openRef: null,
    showCreate: false,
    nextBid: 10312,

    setFilter: (f) => set((s) => void (s.filter = f)),
    setQuery: (q) => set((s) => void (s.query = q)),
    toggleSel: (ref) => set((s) => void (s.selected[ref] = !s.selected[ref])),
    clearSel: () => set((s) => void (s.selected = {})),

    bulk: (action) => {
      const refs = selectedRefs(get().selected);
      const n = refs.length;
      if (!n) return;
      set((s) => {
        for (const ref of refs) {
          const b = s.bookings.find((x) => x.ref === ref);
          if (!b) continue;
          if (action === "approve") b.status = "Confirmed";
          else if (action === "decline") b.status = "Declined";
          else if (action === "waitlist") b.status = "Waitlisted";
          else if (action === "cancel") b.status = "Cancelled";
        }
        s.selected = {};
      });
      if (action === "email") setTimeout(() => alert(`Opened a message to ${n} booker(s).`), 40);
      else if (action === "export") setTimeout(() => alert(`Exported ${n} booking(s) to CSV.`), 40);
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

    act: (ref, action) =>
      set((s) => {
        const b = s.bookings.find((x) => x.ref === ref);
        if (!b) return;
        if (action === "approve") b.status = "Confirmed";
        else if (action === "decline") b.status = "Declined";
        else if (action === "paid") b.pay = "Paid";
        else if (action === "resend")
          setTimeout(() => alert(`Payment link / invoice re-sent to ${b.email}.`), 20);
        else if (action === "recon") b.recon = !b.recon;
        else if (action === "promote") {
          b.status = "Confirmed";
          b.note = "Promoted from waitlist.";
        } else if (action === "refund-approve") {
          if (b.cancel) b.cancel.refund = "approved";
          b.pay = "Refunded";
        } else if (action === "refund-decline") {
          if (b.cancel) b.cancel.refund = "declined";
        }
      }),

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
    doCancel: (ref, partialAmount) =>
      set((s) => {
        const b = s.bookings.find((x) => x.ref === ref);
        if (!b) return;
        const t = b._refundType || "full";
        let amt = t === "full" ? b.amount : 0;
        if (t === "partial") amt = partialAmount || 0;
        if (b.past !== true) b.status = "Cancelled";
        b.cancel = {
          on: nowStr(),
          by: "Provider",
          refund: t,
          amount: amt,
          refundOnly: b.past === true,
          msg: b.past === true ? "Refund issued by provider." : "Cancelled by provider.",
        };
        b.pay = t === "full" ? "Refunded" : t === "partial" ? "Partially refunded" : b.pay;
        b._cancelling = false;
      }),

    saveNote: (ref, text) =>
      set((s) => {
        const b = s.bookings.find((x) => x.ref === ref);
        if (b) b.note = text;
      }),

    cancelChild: (ref, ki) =>
      set((s) => {
        const b = s.bookings.find((x) => x.ref === ref);
        if (!b) return;
        const kids = bookingKids(b);
        const k = kids[ki];
        if (!k || k.cancelled) return;
        const share = b.amount / (kids.length || 1);
        const done = share * ((k.cancelledDays || []).length / ((k.dates || []).length || 1));
        const refund = Math.max(0, Math.round((share - done) * 100) / 100);
        k.cancelled = true;
        k.cancelledDays = (k.dates || []).slice();
        (b.refundLog = b.refundLog || []).push({
          label: `${k.name || "Child"} — whole place`,
          amount: refund,
          on: nowStr(),
          by: "Provider",
          source: "Provider",
        });
        // kids came from bookingKids which may be a synthesised single-child
        // array; persist it back onto the booking so state survives.
        if (!b.kids) b.kids = kids;
        applyCancelState(b);
      }),

    cancelDay: (ref, ki, dt) =>
      set((s) => {
        const b = s.bookings.find((x) => x.ref === ref);
        if (!b) return;
        const kids = bookingKids(b);
        const k = kids[ki];
        if (!k || k.cancelled) return;
        k.cancelledDays = k.cancelledDays || [];
        if (k.cancelledDays.indexOf(dt) > -1) return;
        k.cancelledDays.push(dt);
        const perday = Math.round((b.amount / (kids.length || 1) / ((k.dates || []).length || 1)) * 100) / 100;
        (b.refundLog = b.refundLog || []).push({
          label: `${k.name || "Child"} — ${dt}`,
          amount: perday,
          on: nowStr(),
          by: "Provider",
          source: "Provider",
        });
        if (kidActiveDays(k).length === 0) k.cancelled = true;
        if (!b.kids) b.kids = kids;
        applyCancelState(b);
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
      set((s) => {
        const b = s.bookings.find((x) => x.ref === ref);
        if (!b) return;
        const kids = bookingKids(b);
        const k = kids[ki];
        if (k && k.dates) {
          const ix = k.dates.indexOf(oldDt);
          if (ix > -1) k.dates[ix] = newDt;
          if (!b.kids) b.kids = kids;
        }
        b._chgKi = null;
        b._chgDt = null;
      }),

    openCreate: () => set((s) => void (s.showCreate = true)),
    createBooking: (input) => {
      const id = get().nextBid;
      const haf = input.method.indexOf("HAF") > -1;
      set((s) => {
        s.bookings.unshift({
          ref: "APF-" + id,
          bid: "03073" + id,
          booker: input.booker,
          email: input.email,
          phone: "—",
          child: input.child || "—",
          age: input.age || 0,
          dob: "—",
          listing: input.listing,
          pass: input.pass,
          ticket: `${input.pass} · ${input.dates}`,
          dates: input.dates,
          sessions: [input.dates],
          status: "Confirmed",
          pay: haf ? "Funded" : "Invoice sent",
          method: haf ? "HAF" : input.method,
          amount: haf ? 0 : input.amount || 0,
          addons: [],
          answers: [],
          note: "Payment link sent to the parent — awaiting payment.",
          recon: input.method === "Tax-Free Childcare" ? false : null,
          evid: haf ? "Awaiting" : null,
          cancel: null,
        });
        s.nextBid = id + 1;
        s.filter = "all";
        s.showCreate = false;
      });
      setTimeout(
        () => alert("✓ Booking created — a secure payment link has been emailed to the parent."),
        40,
      );
    },
  })),
);
