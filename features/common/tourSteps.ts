import type { LiveTourSteps } from "./LiveTour";
import type { SettingsLink } from "./tourNarrator";
import { GENERATED_STEPS } from "./tourSteps.generated";
import { LB_STEPS, LB_SETTINGS } from "./tourExtra.generated";
import { CREATE_STEPS, CREATE_SETTINGS } from "./tourCreate.generated";

// Narration + spotlight anchors for the live walkthroughs. Each step's `find`
// is a snippet of text the REAL page renders; the tour highlights the card that
// contains it. Lines are concise and TTS-clean for the British voice. A view
// only gets a live tour when it has BOTH steps here and fixtures in
// tourFixtures.ts — otherwise PageTour falls back to the mock GuidedTour.

// Page-specific "one last thing" — the robot beams down deep-links to just the
// Settings tabs that control THIS page, each with a note on what it does. Shown
// (via the robot control-panel scene) at the end of that page's live tour.
export const SETTINGS_LINKS: Record<string, SettingsLink[]> = {
  ...LB_SETTINGS,
  ...CREATE_SETTINGS,
  dash: [
    { icon: "⚙️", label: "Features", tab: "features", note: "turn whole areas of ActivityOS on or off — Meals, Trips, Moments, the Task manager and more — so the dashboard only shows what you actually use" },
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
  ...LB_STEPS,
  ...CREATE_STEPS,
  // Building pages: the create-demo goes LAST (a `click` step opens the real
  // form, the next steps spotlight its fields) so the open form is covered by
  // the closing robot scene rather than hiding the earlier steps.
  calendar: {
    title: "Events calendar",
    introLine: "This is your one big calendar — every booked session across your listings, laid over the meetings, INSET days and closures you add yourself.",
    doneLine: "One tidy calendar for every session and every event you run, however busy your week gets.",
    steps: [
      { find: "Today", line: "Flip between Month for the overview, Week for booked numbers per day, and Day for the full run-sheet of a single date." },
      { find: "My events", line: "Toggle your own events or booking info on and off, and tap any listing in the legend to hide it." },
      { find: "Add event", line: "Every booked session lands here on its own. To add your own — a meeting, an INSET day or a closure — you press Add event.", click: true },
      { find: "Title", fill: [["Title", "INSET day — staff training"]], line: "Give it a title — I'll call this one an INSET day — then pick the date, and set a start and end time, or tick All day." },
      { find: "Training / INSET", pick: ["Training / INSET"], line: "Choose a category and colour so it's easy to spot at a glance — a staff meeting, INSET day, open day or closure." },
      { find: "Save event", line: "Turn on a reminder if you'd like one, then press Save, and it drops straight onto the calendar." },
    ],
  },
  // Listings: drive the REAL create-a-listing wizard (open it, then advance
  // through each real step with "Next ›").
  listings: {
    title: "Listings, services & tickets",
    // Cursor-only: no spotlight ring. We move the mouse and actually fill the
    // fields, pick the options and step through the tabs to build a real listing.
    noSpotlight: true,
    introLine: "Every camp, club and class you offer is a listing — its own page parents can find and book. Three things live in your setup first: your venues, their locations, and your seasons. With those ready, let me build a listing with you.",
    doneLine: "That's a listing built — a polished page parents can find and book in minutes.",
    steps: [
      { find: "New listing", line: "Press New listing, and the step-by-step builder opens.", click: true },
      { find: "Listing title", fill: [["Listing title", "Summer Holiday Multi-Sports Camp"]], line: "First, a clear name — Summer Holiday Multi-Sports Camp." },
      { find: "Crop & move", fill: [["Zoom", "155"], ["Left", "40"]], line: "Add your main photo, then crop and move it with these sliders — this preview is exactly what parents see. Smaller shots go in the gallery below, which parents swipe through on the booking page.", advance: "Next" },
      { find: "Where & when", fill: [["venue", "Riverside"], ["Age from", "5"], ["Age to", "12"]], link: { label: "Set up your venues, locations & seasons ↗", href: "/freelancer/listings?tab=locations" }, line: "Now where and who. Your venues, locations and seasons are set up beforehand — here you just pick them. If you haven't yet, use the link below. I'll choose Riverside, ages five to twelve." },
      { find: "Categories", pick: ["Holiday Multi-Activity Camps"], line: "Tick a category so parents can find it — a holiday multi-activity camp.", advance: "Next" },
      { find: "Places & spaces", fill: [["Maximum attendees", "60"]], line: "How many can come — I'll cap this at sixty for the whole listing." },
      { find: "Per-age caps", pick: ["Set age caps"], line: "And you can cap places per age group on top of that — so only so many of your sixty go to the youngest.", advance: "Next" },
      { find: "Describe your activity", fill: [["Type a few words", "dodgeball, arts, new friends, qualified coaches"]], pick: ["Write with AI"], line: "Describe it — type a few words, then Write with AI turns them into a polished paragraph for you.", advance: "Next" },
      { find: "What is provided", pick: ["Hot lunch", "All equipment", "Certificate"], line: "Tick everything that's included — a hot lunch, all equipment, a certificate — it all shows on the listing.", advance: "Next" },
      { find: "Safety & inclusion", pick: ["DBS-checked staff", "First aid on site", "Wheelchair accessible"], line: "Tick your safety features and SEND support, so families know everyone's looked after.", advance: "Next" },
      { find: "Dates & pattern", fill: [["Runs from", "2026-08-03"], ["Runs to", "2026-08-07"]], line: "Set the dates — the first week of August — and the calendar builds every session for you.", advance: "Next" },
      { find: "Choose a block", line: "Pick a block you built in Blocks — its passes and prices become this listing's tickets.", advance: "Next" },
      { find: "Discount rules", line: "Add automatic discounts if you like, then preview and publish — and it's live for parents to book." },
    ],
  },
  // Blocks: build a real block on the real page (click "Add to block").
  blocks: {
    title: "Sessions & blocks",
    introLine: "This is where you build the patterns parents book — sessions grouped into a block, priced once and reused on any listing. Let me build one.",
    doneLine: "Build a block once here, price it, and drop it onto any camp, club or class.",
    steps: [
      { find: "Make your periods", line: "First, your periods — the time windows in a day, like a full day, a morning, or an early drop-off. Title them anything." },
      { find: "Make your passes", line: "Then your passes — the lengths a parent can book, from a single day to a full week or a whole term." },
      { find: "+ Add to block", line: "To build a block, you click Add to block on the periods and passes you want — watch, I'll add one now.", click: true },
      { find: "Build your blocks", line: "It drops into your block here on the right, ready to combine with the passes you add." },
      { find: "Name your block", line: "Give the block a name, and the pricing calculator works out the price of every day-and-pass combination for you." },
      { find: "Move to Block Library", line: "Move it to your Block Library, and it's ready to reuse on any listing you like." },
    ],
  },
  tasks: {
    title: "Task manager",
    introLine: "Welcome to your Task manager — proper to-dos tied to real listings, bookings and compliance, all in one tidy inbox.",
    doneLine: "Capture it, tick it off, and never lose track of what's due across all your gigs.",
    steps: [
      { find: "Due this week", line: "A row of cards up top shows your whole workload at a glance — tap any one to filter the list below." },
      { find: "Upcoming", line: "The heart of the page — your tasks grouped into Overdue, Today and Upcoming, each row showing who it's for and when it's due." },
      { find: "Board", line: "Flip to the Board to drag tasks between columns, or click any row to open it and add subtasks and comments." },
      { find: "Quick add", fill: [["Quick add", "Brief coaches on Monday @Jess !high #Riverside"]], line: "The fastest way to add one — type it in plain English. An at-sign assigns it, an exclamation mark sets the priority, and a hash links a booking or family." },
      { find: "+ New task", line: "Or press New task for the full form.", click: true },
      { find: "Deadline", line: "Set who it's for, a priority and a deadline, link it to the real booking or child, then save — it lands in the list straight away." },
    ],
  },
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
      // Business analytics — the lower half of the page. Kept brief and swift:
      // each line sweeps a cluster of cards so we cover them all without dragging.
      { find: "Business analytics", line: "Scroll on and here's your Business analytics — the bigger picture, worked out from your bookings. Flip between three, six or twelve months up here." },
      { find: "Income collected", line: "These four tiles sum it up — income collected, total bookings, how many families, and your average booking value." },
      { find: "Income by month", line: "Income by month tracks what you've taken, and Booked versus collected sets what parents owe against what's actually landed." },
      { find: "Revenue by activity", line: "Revenue by activity shows which camps and clubs earn you the most." },
      { find: "Booking funnel", line: "The booking funnel shows how many bookings get confirmed and paid, and Repeat customers how many families come back for more." },
      { find: "Bookings & payments", line: "Bookings and payments breaks things down by status and how people pay, and Newest bookings lists the latest to land." },
    ],
  },
};
