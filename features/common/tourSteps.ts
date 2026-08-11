import type { LiveTourSteps } from "./LiveTour";
import type { SettingsLink } from "./tourNarrator";
import { GENERATED_STEPS } from "./tourSteps.generated";

// Narration + spotlight anchors for the live walkthroughs. Each step's `find`
// is a snippet of text the REAL page renders; the tour highlights the card that
// contains it. Lines are concise and TTS-clean for the British voice. A view
// only gets a live tour when it has BOTH steps here and fixtures in
// tourFixtures.ts — otherwise PageTour falls back to the mock GuidedTour.

// Page-specific "one last thing" — the robot beams down deep-links to just the
// Settings tabs that control THIS page, each with a note on what it does. Shown
// (via the robot control-panel scene) at the end of that page's live tour.
export const SETTINGS_LINKS: Record<string, SettingsLink[]> = {
  dash: [
    { icon: "⚙️", label: "Features", tab: "features", note: "Switch major areas of ActivityOS on or off" },
    { icon: "🗓", label: "Seasons", tab: "seasons", note: "Date ranges every figure here can filter by" },
  ],
  meals: [{ icon: "🍽", label: "Meals", tab: "meals", note: "Cut-off times, who sees each menu, and whether swaps need approval" }],
  customers: [
    { icon: "❓", label: "Child questions", tab: "people", note: "What you ask families about each child at sign-up" },
    { icon: "🏢", label: "Company setup", tab: "company", note: "Your business name and contact details" },
  ],
  email: [{ icon: "🎨", label: "Branding", tab: "branding", note: "Your logo and colours on branded emails" }],
  calendar: [{ icon: "📅", label: "Calendar", tab: "calendar", note: "Which event types and closures show here" }],
  timetable: [{ icon: "⚖", label: "Age groups & rooms", tab: "groups", note: "The groups and rooms the timetable builds around" }],
  registers: [{ icon: "☰", label: "Register", tab: "registers", note: "Sign-in and sign-out rules and what the register captures" }],
  ratios: [{ icon: "⚖", label: "Age groups & rooms", tab: "groups", note: "Your groups, target ratios and room sizes — the master record this board reads" }],
  incidents: [{ icon: "🛡", label: "Safeguarding", tab: "safeguarding", note: "Your DSL, categories and whether acknowledgement is required" }],
  accidents: [{ icon: "🛡", label: "Safeguarding", tab: "safeguarding", note: "Who's notified and how first-aid records are handled" }],
  medication: [{ icon: "💊", label: "Medication", tab: "medication", note: "Consent rules and how doses are recorded" }],
  moments: [{ icon: "⚙️", label: "Features", tab: "features", note: "Turn Moments and photo sharing on or off" }],
  documents: [{ icon: "⚙️", label: "Features", tab: "features", note: "Turn document sharing on or off" }],
  finance: [
    { icon: "💷", label: "Money", tab: "money", note: "Payment methods, fees and how payouts are handled" },
    { icon: "↩️", label: "Cancellations & refunds", tab: "cancel", note: "Your refund rules" },
  ],
  expenses: [{ icon: "💷", label: "Money", tab: "money", note: "Payment methods and expense categories" }],
  purchasing: [
    { icon: "💷", label: "Money", tab: "money", note: "Payment methods and invoicing" },
    { icon: "🎟", label: "Vouchers", tab: "vouchers", note: "Childcare voucher and funding setup" },
  ],
  newsfeed: [{ icon: "🔔", label: "Notifications", tab: "notifications", note: "How families are alerted to new posts" }],
  staff: [{ icon: "👥", label: "Staff & workforce", tab: "staff", note: "Roles, invites and what staff can access" }],
  tasks: [{ icon: "🔔", label: "Notifications", tab: "notifications", note: "Reminders and how tasks are surfaced" }],
  trips: [{ icon: "🚌", label: "Trips & visits", tab: "trips", note: "Default consent and risk-assessment settings for trips" }],
  referrals: [{ icon: "🎁", label: "Refer a friend", tab: "refer", note: "The referral reward and how it's paid" }],
  marketing: [{ icon: "🎫", label: "Bookings", tab: "bookings", note: "Booking and pricing defaults your codes apply to" }],
};

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
