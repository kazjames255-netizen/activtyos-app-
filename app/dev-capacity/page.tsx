"use client";

// SCRATCH PAGE — not part of the product, not committed.
// Renders the real CustomerPage against fabricated server data so the capacity
// states can be seen without signing in. Safe to delete at any time.

import { useState } from "react";
import { CustomerPage, type ServerListing } from "@/features/listings/ListingWizard";

// Two weeks of weekday runs, matching how the server generates blocks.
const WEEK1 = ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"];
const WEEK2 = ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21"];

function make(scope: "day" | "listing", max: string, w1Left: number, w2Left: number, show = true, cap = 20): ServerListing {
  return {
    id: "demo",
    name: "Summer Multi-Activity Camp",
    tenantName: "Kaz Activities",
    title: "Summer Multi-Activity Camp",
    passes: [{ name: "5 day pass", price: 150 }, { name: "1 day pass", price: 30 }],
    runFrom: "2026-08-10",
    runTo: "2026-08-21",
    days: [1, 2, 3, 4, 5],
    datesOff: [],
    blockMode: "weekly",
    maxAttendees: max,
    capacityScope: scope,
    showSpaces: show,
    ageFrom: "4",
    ageTo: "15",
    description: "Games, sport, art and adventure — a different theme every day.",
    sections: [],
    outcomes: [],
    provided: [],
    safety: [],
    send: [],
    addonIds: [],
    staffIds: ["s1", "s2"],
    images: [],
    gallery: [],
    categoryIds: [],
    bookRules: {},
    ticketOverrides: {},
    visibility: "public",
    bookingType: "auto",
    waitlist: true,
    waitlistSize: "20",
    cancellation: "Free cancellation up to 7 days before.",
    pageStyle: scope === "day" ? "playful" : "navy",
    status: "live",
    blocks: [
      { id: "b1", name: "Week 1", startDate: WEEK1[0], endDate: WEEK1[4], capacity: cap, spotsLeft: w1Left, open: true },
      { id: "b2", name: "Week 2", startDate: WEEK2[0], endDate: WEEK2[4], capacity: cap, spotsLeft: w2Left, open: true },
    ],
    bundle: {
      id: "bundle",
      name: "Summer bundle",
      passes: [
        { id: "p5", name: "5 day pass", days: 5, price: 150 },
        { id: "p1", name: "1 day pass", days: 1, price: 30 },
      ],
      timings: {},
      periods: [{ id: "t1", title: "9am – 3pm", start: "09:00", finish: "15:00" }],
    },
    library: {
      categories: [{ id: "c1", name: "Holiday Camps" }],
      venue: {
        id: "v1", name: "Stantonbury Leisure Centre", address: "Purbeck, Milton Keynes, MK14 6BN",
        lat: 52.0610647, lng: -0.7725124, zoom: 15,
        facilities: ["Free car park", "Indoor sports hall", "Café on site"],
        what3words: "filled.count.soap",
        transport: "Purbeck Rd bus stop, 3 min",
        directions: "Park at the front of the school and walk round to the side gate.",
      },
      addons: [],
      staff: [
        { id: "s1", first: "Amir", last: "M", bio: "Lead coach, 8 years with primary-age groups." },
        { id: "s2", first: "Kaz", last: "James", bio: "Camp manager and safeguarding lead." },
      ],
    },
  } as unknown as ServerListing;
}

const CASES = [
  { key: "plenty", label: "Per-day 20 · plenty left", listing: make("day", "20", 18, 20) },
  { key: "low", label: "Per-day 20 · week 1 down to 2", listing: make("day", "20", 2, 20) },
  { key: "full", label: "Per-day 20 · week 1 FULL", listing: make("day", "20", 0, 14) },
  { key: "whole", label: "Whole listing 60 · plenty", listing: make("listing", "60", 47, 47) },
  { key: "wholelow", label: "Whole listing 60 · 9 left", listing: make("listing", "60", 9, 9) },
  { key: "wholelowdates", label: "Whole listing 60 · week 1 nearly full", listing: make("listing", "60", 3, 12) },
  { key: "hidden", label: "Numbers OFF (show spaces unticked)", listing: make("listing", "60", 3, 12, false) },
  { key: "tiny", label: "Small group of 4 · 2 left", listing: make("day", "4", 2, 4, true, 4) },
  { key: "soldout", label: "Sold out everywhere", listing: make("day", "20", 0, 0) },
];

export default function DevCapacity() {
  const [i, setI] = useState(0);
  return (
    <div style={{ background: "#f4f6fb", minHeight: "100vh", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", borderRadius: 10, padding: "9px 12px", fontSize: 13, marginBottom: 12 }}>
        <b>Test page — not part of ActivityOS.</b> Fake data, so the capacity states can be seen without a real booking. Nothing here touches your listings.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {CASES.map((c, n) => (
          <button key={c.key} onClick={() => setI(n)}
            style={{
              padding: "8px 13px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 700,
              border: "1px solid " + (i === n ? "#1d3a8f" : "#e4e9f4"),
              background: i === n ? "#1d3a8f" : "#fff", color: i === n ? "#fff" : "#4b5570",
            }}>{c.label}</button>
        ))}
      </div>
      <CustomerPage listing={CASES[i].listing} />
    </div>
  );
}
