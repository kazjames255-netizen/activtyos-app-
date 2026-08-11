import type { LiveTourSteps } from "./LiveTour";
import { GENERATED_STEPS } from "./tourSteps.generated";

// Narration + spotlight anchors for the live walkthroughs. Each step's `find`
// is a snippet of text the REAL page renders; the tour highlights the card that
// contains it. Lines are concise and TTS-clean for the British voice. A view
// only gets a live tour when it has BOTH steps here and fixtures in
// tourFixtures.ts — otherwise PageTour falls back to the mock GuidedTour.

// Shared closing segment: every live tour ends on the REAL Settings page and
// briefly explains what the tabs there control. LiveTour navigates the iframe
// to /tour/<portal>/setup for these steps.
export const SETTINGS_OUTRO: { find: string; line: string }[] = [
  { find: "Features", line: "One last thing — almost everything you've just seen is switched on and fine-tuned here in Settings, under Setup and features." },
  { find: "Company setup", line: "The tabs run one part of ActivityOS each: Company setup and Branding for your details and logo, Staff and workforce for your team, and Child questions for what you ask families at sign-up." },
  { find: "Cancellations", line: "Further along you'll find Meals, Medication and Safeguarding, plus Cancellations and refunds, Seasons, Vouchers and Memberships. Open any tab to change what you've just seen." },
];

export const TOUR_STEPS: Record<string, LiveTourSteps> = {
  // Agent-authored steps for the other pages; the hand-tuned dashboard wins.
  ...GENERATED_STEPS,
  dash: {
    title: "Dashboard",
    introLine: "This is your dashboard — the first thing you see each morning. Let me walk you through it.",
    doneLine: "That's your dashboard — who's in today, what's filling, what's owed, and what needs doing, all in one place.",
    steps: [
      { find: "On site today", line: "Right at the top, you can see how many children are on site today and how many sessions are running — your day at a glance." },
      { find: "New bookings", line: "These four tiles are your pulse. New bookings shows how many came in over the last five weeks, with a little bar for each week." },
      { find: "Spaces left", line: "Spaces left tells you how full your open runs are. The ring shows the percentage filled, so you can see what still needs places selling." },
      { find: "Taken this week", line: "Taken this week is the money collected, after refunds, with the trend across recent weeks underneath." },
      { find: "Outstanding", line: "Outstanding is what's still owed — unpaid balances and any vouchers you're waiting on. It turns green when everyone has settled." },
      { find: "Today ·", line: "Below, Today lists every session running now, each with its time, how full it is, and anyone waiting on the list." },
      { find: "Live listings · places left", line: "Live listings shows your open runs and exactly how many places are left, with a green, amber or red tag you can read at a glance." },
      { find: "Tasks today", line: "And Tasks today pulls in anything due today from your task manager, so nothing slips through." },
    ],
  },
};
