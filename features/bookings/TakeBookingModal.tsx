"use client";

import { useState } from "react";
import { useBookingsStore } from "./store";
import { Btn } from "./ui";

const LISTINGS = ["Summer Holiday Camp 2027", "Easter Football Camp", "After-School Dance Club"];
const PASSES = ["5-day week pass", "4-day pass", "1-day pass"];
const BLOCKS = [
  "Week 1 · 28 Jul – 1 Aug 2027",
  "Week 2 · 4 – 8 Aug 2027",
  "Week 3 · 11 – 15 Aug 2027",
  "Single day · Wed 30 Jul 2027",
  "Taster · Mon 28 Jul 2027",
];
const METHODS = ["Card", "Tax-Free Childcare", "HAF (funded £0)", "PayPal"];

const inputCls =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none";
const labelCls = "text-[11.5px] font-bold text-[var(--ink)]";

export function TakeBookingModal() {
  const show = useBookingsStore((s) => s.showCreate);
  const close = useBookingsStore((s) => s.close);
  const createBooking = useBookingsStore((s) => s.createBooking);
  const setShow = useBookingsStore.setState;

  const [f, setF] = useState({
    booker: "",
    email: "",
    child: "",
    age: "",
    listing: LISTINGS[0],
    pass: PASSES[0],
    dates: BLOCKS[0],
    amount: "",
    method: METHODS[0],
  });

  if (!show) return null;

  const dismiss = () => {
    setShow({ showCreate: false });
    close();
  };

  const submit = () => {
    if (!f.booker.trim()) {
      alert("Enter the booker name.");
      return;
    }
    createBooking({
      booker: f.booker,
      email: f.email,
      child: f.child,
      age: parseInt(f.age, 10) || 0,
      listing: f.listing,
      pass: f.pass,
      dates: f.dates,
      amount: parseFloat(f.amount) || 0,
      method: f.method,
    });
  };

  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && dismiss()}
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-auto bg-black/55 px-3.5 py-8"
    >
      <div className="w-full max-w-[560px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-[22px] py-5 text-[var(--ink)] shadow-[0_24px_60px_rgba(0,0,0,.5)]">
        <div className="mb-2 flex items-center gap-2.5">
          <h3 className="m-0 font-[var(--ff-display)] text-[18px] font-extrabold">Take a booking</h3>
          <span
            onClick={dismiss}
            className="ml-auto cursor-pointer text-[22px] text-[var(--ink-3)]"
          >
            ×
          </span>
        </div>
        <div className="mb-3 text-[11.5px] text-[var(--ink-3)]">
          Book on a customer’s behalf (e.g. a phone booking). We’ll <b>email the parent a secure
          payment link</b> — the booking sits as <b>Invoice sent</b> until they pay, then flips to{" "}
          <b>Paid</b>. Capacity &amp; double-booking guards still apply.
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <label className={labelCls}>
            Booker name
            <input className={inputCls} value={f.booker} onChange={upd("booker")} />
          </label>
          <label className={labelCls}>
            Booker email
            <input className={inputCls} value={f.email} onChange={upd("email")} />
          </label>
          <label className={labelCls}>
            Child name
            <input className={inputCls} value={f.child} onChange={upd("child")} />
          </label>
          <label className={labelCls}>
            Child age
            <input type="number" className={inputCls} value={f.age} onChange={upd("age")} />
          </label>
          <label className={labelCls}>
            Listing
            <select className={inputCls} value={f.listing} onChange={upd("listing")}>
              {LISTINGS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Pass
            <select className={inputCls} value={f.pass} onChange={upd("pass")}>
              {PASSES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className={`${labelCls} col-span-2`}>
            Block / dates
            <select className={inputCls} value={f.dates} onChange={upd("dates")}>
              {BLOCKS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Amount £ (from the pass)
            <input type="number" className={inputCls} value={f.amount} onChange={upd("amount")} />
          </label>
          <label className={labelCls}>
            How they’ll pay
            <select className={inputCls} value={f.method} onChange={upd("method")}>
              {METHODS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3.5 flex gap-2">
          <Btn variant="primary" onClick={submit}>
            Send payment link &amp; create
          </Btn>
          <Btn onClick={dismiss}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}
