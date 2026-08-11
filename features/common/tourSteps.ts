import type { LiveTourSteps } from "./LiveTour";
import type { SettingsLink } from "./tourNarrator";
import { GENERATED_STEPS } from "./tourSteps.generated";
import { LB_STEPS, LB_SETTINGS } from "./tourExtra.generated";

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
  ...LB_STEPS,
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
      { find: "Title", line: "Give it a title, pick the date, and set a start and end time, or tick All day." },
      { find: "Training / INSET", line: "Choose a category and colour so it's easy to spot at a glance — a staff meeting, INSET day, open day or closure." },
      { find: "Save event", line: "Turn on a reminder if you'd like one, then press Save, and it drops straight onto the calendar." },
    ],
  },
  // Listings: drive the REAL create-a-listing wizard (open it, then advance
  // through each real step with "Next ›").
  listings: {
    title: "Listings, services & tickets",
    introLine: "Every camp, club and class you offer is a listing — its own page parents can find and book. Let me build one with you.",
    doneLine: "That's a listing built — a polished page parents can find and book in minutes.",
    steps: [
      { find: "New listing", line: "To create one, you press New listing, and a step-by-step builder opens.", click: true },
      { find: "Make a great first impression", line: "First, the photos and the title — a big image and a clear name make a great first impression.", advance: "Next" },
      { find: "Where, who & how many", line: "Next, where it runs and who it's for — your venue, and the age range from and to.", advance: "Next" },
      { find: "How many can come", line: "Set how many can come — an overall capacity, or leave it blank and cap each age band instead.", advance: "Next" },
      { find: "Describe your activity", line: "Describe the activity so parents know exactly what their child will be doing.", advance: "Next" },
      { find: "Safety & inclusion", line: "Safety and inclusion — tick the chips for your ratios, first aid, and the needs you can support.", advance: "Next" },
      { find: "When it runs", line: "Choose the dates and days it runs, and the calendar builds each session for you.", advance: "Next" },
      { find: "Tickets & pricing", line: "Add your tickets and prices — a full block, single days, or whatever pass you offer.", advance: "Next" },
      { find: "Automatic discounts", line: "Set automatic discounts if you like — sibling, early-bird or bulk — then preview and publish, and it's live for parents." },
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
      { find: "Quick add", line: "The fastest way to add one — type it in plain English. An at-sign assigns it, an exclamation mark sets the priority, and a hash links a booking or family." },
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
    ],
  },
};
