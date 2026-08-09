import type { TourConfig } from "./GuidedTour";

// Provider-page walkthroughs. Drafted by a planner+builder agent pass that read
// each real page component, then reviewed. Keyed by route view-id (see
// lib/view-registry.tsx). Only surfaced on provider portals via PageTour.
export const TOUR_CONFIGS: Record<string, TourConfig> = {
  "dash": {
    "title": "Your Dashboard",
    "introLine": "This is your morning command-centre — one glance tells you how the whole business is doing today, and every number here jumps you straight to where the work is.",
    "doneLine": "And that's the lot — start here each morning and you'll never miss a booking, a full session, or a cert about to lapse.",
    "steps": [
      {
        "label": "Greeting, period toggle & KPI cards",
        "stage": "Overview",
        "line": "Up top you get a friendly good-morning and a Today / This week / This month toggle that re-scopes every number on the page, with five headline cards giving you the health of the business at a glance.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">GOOD MORNING</div><div class=\"field\">Good morning, Jordan — here's your sessions today</div><div class=\"chips\"><span class=\"ochip\">Today</span><span class=\"ochip\">This week</span><span class=\"ochip\">This month</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Bookings · today</b> <span class=\"g\">↑ +8% vs last wk</span><span class=\"tkp\">14</span></div></div><div class=\"row2\"><div class=\"tkt\"><div class=\"tkhd\"><b>Revenue</b> <span class=\"g\">↑ today</span><span class=\"tkp\">£610</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Attendance</b> <span class=\"g\">↑ present</span><span class=\"tkp\">95%</span></div></div></div><div class=\"hint\">Total children 42 · Staff 1 (just you) · Families 39 · 5 live listings</div></div>"
      },
      {
        "label": "Attendance donut & trend",
        "stage": "Attendance",
        "line": "Your attendance ring shows today's present-rate at a glance, and the twelve-month chart beside it reveals the seasonal pattern — those big summer-camp peaks you plan your staffing around.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">ATTENDANCE · THIS WEEK</div><div class=\"field\">95% present</div><div class=\"chips\"><span class=\"ochip\">🟢 Present 38</span><span class=\"ochip\">🟠 Late 3</span><span class=\"ochip\">🔴 Absent 1</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Attendance &amp; bookings</b> <span class=\"g\">Jan–Dec · 91–96% present</span></div></div><div class=\"hint\">Bookings peak Jul–Aug (~40) for summer camps, dipping to ~8 in winter.</div></div>"
      },
      {
        "label": "Today's sessions — capacity fill",
        "stage": "Sessions",
        "line": "Every one of today's clubs and camps, with a booked-out-of-capacity bar that turns amber as it fills and red when it's over — so you can see instantly what's full and what's got room to upsell.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">TODAY'S SESSIONS · CAPACITY FILL</div><div class=\"tkt\"><div class=\"tkhd\"><b>After-school Football Club</b> <span class=\"g\">space left</span><span class=\"tkp\">12/16</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Saturday Multi-Sports</b> <span class=\"g\">near full · Waitlist 2</span><span class=\"tkp\">18/20</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Holiday Camp · Tue AM</b> <span class=\"g\">space left</span><span class=\"tkp\">9/24</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Gymnastics Tots</b> <span class=\"g\">Starts 15:30</span><span class=\"tkp\">8/10</span></div></div></div>"
      },
      {
        "label": "Popular activities & events calendar",
        "stage": "Planning",
        "line": "Your best-selling activities ranked by places booked tell you what to schedule more of, while the events calendar keeps the fixed diary dates — camp openings, payout runs — right in front of you.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">POPULAR ACTIVITIES · PLACES BOOKED</div><div class=\"tkt\"><div class=\"tkhd\"><b>Multi-Sports</b> <span class=\"g\">Football 72 · Holiday Club 40</span><span class=\"tkp\">96</span></div></div><div class=\"fl\">UPCOMING</div><div class=\"chips\"><span class=\"ochip\">25 Jun · Summer Camp wk 1 opens</span><span class=\"ochip\">28 Jun · Staff briefing 9:00am</span><span class=\"ochip\">02 Jul · Payments run</span></div><div class=\"hint\">Tap Listings → to schedule more of what's selling.</div></div>"
      },
      {
        "label": "Upcoming bookings",
        "stage": "Arrivals",
        "line": "Your arrivals list for the sessions ahead — who's coming, whose booking still needs a confirm, and who's sitting on the waitlist — the queue you work through before each session.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">NEXT ARRIVALS</div><div class=\"tkt\"><div class=\"tkhd\"><b>Sophie Khan</b> <span class=\"g\">Sarah Khan · Football · Today 15:30</span><span class=\"chip2\">Confirmed</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Ella Obi</b> <span class=\"g\">Dani Obi · Multi-Sports · Today 16:00</span><span class=\"chip2\">Pending</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Aarav Patel</b> <span class=\"g\">M. Patel · Holiday Camp · Tomorrow</span><span class=\"chip2\">Confirmed</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Sofia Bianchi</b> <span class=\"g\">L. Bianchi · Gymnastics Tots · Sat</span><span class=\"chip2\">Waitlisted</span></div></div></div>"
      },
      {
        "label": "Camp updates & needs attention",
        "stage": "Action",
        "line": "A live feed of everything happening across your camps, and below it a needs-attention queue where each row is a button that jumps you straight to wherever you sort it out.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">CAMP UPDATES</div><div class=\"chk\"><span class=\"chkbx\">📖</span>New booking — Sophie Khan · Football <span class=\"g\">2m ago</span></div><div class=\"chk\"><span class=\"chkbx\">💷</span>Payment received — £48 from Dani Obi <span class=\"g\">18m ago</span></div><div class=\"fl\">NEEDS ATTENTION</div><div class=\"tkt\"><div class=\"tkhd\"><b>🟠 3 bookings awaiting approval</b> <span class=\"btn amber\">Review</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>🔴 1 refund request</b> <span class=\"btn\">Review</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>🔵 First-aid certificate expires soon</b> <span class=\"btn\">View</span></div></div></div>"
      }
    ]
  },
  "meals": {
    "title": "Meals",
    "introLine": "This is where you plan each camp's menus, keep every child's allergy and dietary need to hand, tally up exactly what to order the caterer, and keep an eye on whether the meals are actually paying their way.",
    "doneLine": "And that's Meals sorted — plan it once, and the allergies, caterer order and costs all look after themselves.",
    "steps": [
      {
        "label": "Menu planner",
        "stage": "Plan",
        "line": "Build a menu against a listing and give each day two options — a Hot/Meat and usually a Cold/Veg — tagging allergens as you go, and the dates and choices flow straight through to the child's chooser and the caterer.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">MENU NAME</div><div class=\"field\">Summer hot menu</div><div class=\"fl\">LISTING</div><div class=\"field\">Summer Multi-Activity · Milton Keynes · Wk1 (28 Jul–01 Aug)</div><div class=\"tkt\"><div class=\"tkhd\"><b>Mon · Chicken &amp; sweetcorn pasta</b> <span class=\"g\">Hot · Meat</span></div><span class=\"chip2\">Gluten</span> <span class=\"chip2\">Milk</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Mon · Tomato &amp; basil pasta</b> <span class=\"g\">Hot · Veg</span></div><span class=\"chip2\">Gluten</span></div><span class=\"btn amber\">Save menu</span></div>"
      },
      {
        "label": "Dietary & allergy register",
        "stage": "Safety",
        "line": "Every allergy and dietary need here is pulled automatically from your bookings and the register — you don't re-type a thing — giving the kitchen and your staff one exportable source of truth.",
        "bodyHtml": "<div class=\"frm\"><div class=\"field\">Summer Multi-Activity · Wk1 — 8 booked · 3 with needs</div><div class=\"hint\">Pulled from bookings &amp; the register — 3 have an allergy, 2 a dietary need.</div><div class=\"tkt\"><div class=\"tkhd\"><b>Oliver Reed</b> <span class=\"g\">Peanuts, Tree nuts</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Amara Singh</b> <span class=\"g\">Milk · Halal</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Sofia Costa</b> <span class=\"g\">Gluten · Coeliac</span></div></div><span class=\"btn\">↓ Export</span></div>"
      },
      {
        "label": "Catering counts & order",
        "stage": "Order",
        "line": "Flip between by day, week or listing and the choices roll up into exact numbers — the 'to order' figure quietly leaves out the bring-your-owns — then you fire it off to the venue's caterer with a cut-off.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">By day</span> <span class=\"ochip\">By week</span> <span class=\"ochip\">By listing</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Mon</b> <span class=\"g\">Hot 5 · Packed 2 · Own 1</span><span class=\"tkp\">7 to order</span></div></div><div class=\"fl\">ORDER TO CATERER</div><div class=\"field\">Fresh Start Catering · orders@freshstartcatering.co.uk · cut-off 48h before</div><span class=\"btn amber\">Send order</span></div>"
      },
      {
        "label": "Caterers",
        "stage": "Setup",
        "line": "Set each caterer up once — their order email, a cut-off, and the venues they cover — so when the counts come through they route to whoever's actually feeding that location.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">CATERER NAME</div><div class=\"field\">Fresh Start Catering</div><div class=\"fl\">ORDER EMAIL</div><div class=\"field\">orders@freshstartcatering.co.uk</div><div class=\"row2\"><div><div class=\"fl\">ORDERING CUT-OFF</div><div class=\"field\">48h before</div></div><div><div class=\"fl\">LOCATIONS</div><div class=\"field\">All venues</div></div></div><span class=\"btn amber\">Add caterer</span></div>"
      },
      {
        "label": "Costs",
        "stage": "Money",
        "line": "See meals as a proper margin line — revenue against catering cost — and rest easy that anything you enter here writes into Expenses under 'Catering' and feeds Finance, so you're never double-keying.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">MEAL REVENUE</div><div class=\"field\">£186.50</div></div><div><div class=\"fl\">CATERING COST</div><div class=\"field\">£120.00</div></div></div><div class=\"row2\"><div><div class=\"fl\">MARGIN</div><div class=\"field\">36%</div></div><div><div class=\"fl\">MEALS/WEEK</div><div class=\"field\">38</div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Summer Multi-Activity</b> <span class=\"g\">Milton Keynes · 22 meals/wk · Suggested £42.90</span><span class=\"tkp\">£75.00</span></div></div><div class=\"hint\">Catering costs sync straight into Expenses under \"Catering\" and feed Finance — both ways.</div></div>"
      }
    ]
  },
  "customers": {
    "title": "Families",
    "introLine": "This is your self-filling little black book — every booking quietly pops the family in here, so you only ever type when someone rings up or you spot a correction, and you can see exactly where each family sits from first enquiry to happy regular.",
    "doneLine": "And that's Families — a CRM that mostly fills itself in, so you can spend your time chasing bookings rather than typing them up.",
    "steps": [
      {
        "label": "The pipeline tiles",
        "stage": "Pipeline",
        "line": "The tiles across the top are your funnel and your filter in one — each count tells you where families have got to, and a tap on any tile filters the list down to just that stage.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>All families</b> <span class=\"g\">everyone in one place</span><span class=\"tkp\">48</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Lead</b> <span class=\"g\">Enquired, never booked, not invited yet</span><span class=\"tkp\">12</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Invited</b> <span class=\"g\">Sent a sign-up link, not signed in yet</span><span class=\"tkp\">7</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Customer</b> <span class=\"g\">Signed up or booked with you</span><span class=\"tkp\">21</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Repeat</b> <span class=\"g\">Booked more than once — they came back</span><span class=\"tkp\">8</span></div></div></div>"
      },
      {
        "label": "Toggle, filters & search",
        "stage": "Finding people",
        "line": "Flip between Families and Children depending on whether you're chasing money or running a day, then narrow by venue, booking date or a quick search — handy for pulling everyone interested in Bedford for a campaign.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">Families (48)</span><span class=\"ochip\">Children (73)</span></div><div class=\"chips\"><span class=\"ochip\">📍 Bedford Sports Hall</span><span class=\"ochip\">📅 Booked on 04/08/2026</span><span class=\"ochip\">Show everyone</span></div><div class=\"field\">🔍 Freya</div><div class=\"hint\">Showing 3 of 48 · ⬇ Export · 📥 Import · ＋ Add family</div></div>"
      },
      {
        "label": "Family card",
        "stage": "Finding people",
        "line": "Each family gets a card in its stage colour so a long list stays scannable — you can see where they sit, tap Contact to reach them any way you like, or re-send their sign-up link in one go.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Sarah Whitfield</b> <span class=\"g\">REPEAT · 3 bookings</span></div></div><div class=\"hint\">sarah.whitfield@gmail.com · 07700 900412</div><div class=\"chips\"><span class=\"chip2\">📍 Bedford Sports Hall</span><span class=\"chip2\">✉ Marketing</span><span class=\"chip2\">✓ Signed up</span><span class=\"chip2\">Freya · 8</span><span class=\"chip2\">Oliver · 6</span></div><div class=\"chips\"><span class=\"btn amber\">Contact →</span><span class=\"btn\">Re-send sign-up link</span><span class=\"btn\">View / edit</span></div></div>"
      },
      {
        "label": "Add / edit a family",
        "stage": "Manual entry",
        "line": "For the manual cases — a phone enquiry or a tweak — you pop the details in here; age works itself out from the date of birth, and care notes write once to the family's shared record so there's never a thin duplicate.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">FIRST NAME</div><div class=\"field\">Freya</div></div><div><div class=\"fl\">DATE OF BIRTH</div><div class=\"field\">2018-03-14</div></div></div><div class=\"row2\"><div><div class=\"fl\">AGE (FROM DOB)</div><div class=\"field ph\">8</div></div><div><div class=\"fl\">ALLERGIES</div><div class=\"field\">Peanuts, kiwi</div></div></div><div class=\"row2\"><div><div class=\"fl\">COLLECTION PASSWORD</div><div class=\"field\">Bluebell</div></div><div><div class=\"fl\">PHOTO CONSENT</div><div class=\"field\">Yes</div></div></div><div class=\"chk\"><span class=\"chkbx\">✓</span>Happy to receive marketing (PECR)</div><div class=\"chips\"><span class=\"btn amber\">✉ Save &amp; send sign-up link</span><span class=\"btn\">Save</span></div></div>"
      },
      {
        "label": "Children view",
        "stage": "On the day",
        "line": "This is what your team reads while running a session — allergies, SEND and the collection password at a glance — and a blank child clearly says 'Not filled in yet' so nobody ever mistakes an empty line for 'no needs'.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>👪 Whitfield</b> <span class=\"g\">2 children · Bedford Sports Hall</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Freya</b> <span class=\"g\">age 8</span><span class=\"tkp\">Open</span></div></div><div class=\"chips\"><span class=\"chip2\">Allergies · Peanuts, kiwi</span><span class=\"chip2\">Collection · Bluebell</span><span class=\"chip2\">Photo · Allowed</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Oliver</b> <span class=\"g\">age 6</span><span class=\"tkp\">Open</span></div></div><div class=\"hint\">Not filled in yet — a blank line does NOT mean a child has none.</div></div>"
      }
    ]
  },
  "email": {
    "title": "Email",
    "introLine": "This is your comms hub — a proper Gmail-style inbox for chatting one-to-one with parents, plus a full marketing pipeline for firing branded campaigns out to your live CRM audiences.",
    "doneLine": "That's the lot — reply to parents on the left, run your marketing on the right, and let the numbers tell you what's landing.",
    "steps": [
      {
        "label": "Sub-tabs",
        "stage": "Getting around",
        "line": "Everything on this page splits across five little pills up top — one side is your 1:1 mailbox, the other is bulk marketing, so it's worth a quick sweep across them.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">EMAIL SECTIONS</div><div class=\"chips\"><span class=\"ochip\">📥 Inbox</span><span class=\"ochip\">📣 Campaigns</span><span class=\"ochip\">👥 Audiences</span><span class=\"ochip\">📄 Templates</span><span class=\"ochip\">📊 Analytics</span></div><div class=\"hint\">Inbox opens by default — the active pill sits highlighted so you always know where you are.</div></div>"
      },
      {
        "label": "Inbox",
        "stage": "1:1 mail",
        "line": "Your everyday mailbox, but with a clever twist — open any message and one click reveals a Contact card showing that parent's child, booking and balance right beside the email.",
        "bodyHtml": "<div class=\"frm\"><div class=\"field ph\">🔍 Search mail · try from: subject: label: is:unread has:attachment</div><div class=\"tkt\"><div class=\"tkhd\"><b>Sarah Khan · Allergy update for Jack before Summer Camp</b> <span class=\"g\">09:18</span></div></div><div class=\"hint\">\"…confirming Jack's asthma inhaler will stay with the lead coach…\"</div><div class=\"chips\"><span class=\"ochip\">👤 Parent · Jack Khan (8)</span><span class=\"ochip\">🎟️ Summer Multi-Activity Camp · 28 Jul</span><span class=\"ochip\">💷 Paid · £225</span></div></div>"
      },
      {
        "label": "Campaigns",
        "stage": "Marketing",
        "line": "This is where the real marketing happens — pick an audience and a template, name it, then send or schedule and watch the opens and clicks roll in against each one.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">CAMPAIGNS SENT</div><div class=\"field\">2 · 65% avg open</div></div><div><div class=\"fl\">PEOPLE REACHED</div><div class=\"field\">474 · 25% avg click</div></div></div><span class=\"btn amber\">＋ New campaign</span><div class=\"tkt\"><div class=\"tkhd\"><b>Summer early-bird</b> <span class=\"g\">Sent 2 Jun · 65% open</span><span class=\"tkp\">Sent</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Win-back — spring lapsed</b> <span class=\"g\">Sending…</span><span class=\"tkp\">⏳</span></div></div></div>"
      },
      {
        "label": "Audiences",
        "stage": "Marketing",
        "line": "These aren't fixed mailing lists — each audience is a live rule that recounts itself from your booking data every send, with opt-outs always quietly left out.",
        "bodyHtml": "<div class=\"frm\"><div class=\"hint\">Recomputed from booking & enrolment data each send — opt-outs always excluded.</div><div class=\"tkt\"><div class=\"tkhd\"><b>All active families</b> <span class=\"g\">Has an active or upcoming booking</span><span class=\"tkp\">312</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Summer Camp 2026</b> <span class=\"g\">Booked any Summer Multi-Activity week</span><span class=\"tkp\">168</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>HAF / funded</b> <span class=\"g\">Eligible for or using HAF funding</span><span class=\"tkp\">96</span></div></div><span class=\"btn\">Use in campaign</span></div>"
      },
      {
        "label": "Templates",
        "stage": "Marketing",
        "line": "One shared library of ready-made emails feeding both your campaigns and the inbox composer, with {Merge fields} that auto-fill each child, booking and venue for you.",
        "bodyHtml": "<div class=\"frm\"><div class=\"hint\">One canonical library — shared across campaigns, the inbox composer & Workflows.</div><div class=\"tkt\"><div class=\"tkhd\"><b>Early-bird launch</b> <span class=\"chip2\">Promotion</span></div><div class=\"g\">Subject: Early-bird places now open — save 15%</div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Last-chance places</b> <span class=\"chip2\">Promotion</span></div><div class=\"g\">Subject: Almost full — last places for {ListingName}</div></div><span class=\"btn amber\">＋ New template</span></div>"
      },
      {
        "label": "Analytics",
        "stage": "Results",
        "line": "The payoff for all that marketing — see what's delivered, opened and clicked at a glance, with bounces and unsubscribes flagged so you know if anything's going astray.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">DELIVERED</div><div class=\"field\">624 · ~58% open</div></div><div><div class=\"fl\">CLICK RATE</div><div class=\"field\">~27%</div></div></div><div class=\"chips\"><span class=\"ochip\">⚠️ Bounces 9</span><span class=\"ochip\">⚠️ Unsubscribes 6</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>August football camp</b> <span class=\"g\">▇▇▇▇▇▇▇▁▁</span><span class=\"tkp\">72%</span></div></div></div>"
      }
    ]
  },
  "calendar": {
    "title": "Events calendar",
    "introLine": "This is your one big calendar — every booked session across all your listings, laid over the meetings, INSET days and closures you add yourself.",
    "doneLine": "That's the lot — one tidy calendar for every session and every event you run, however busy your week gets.",
    "steps": [
      {
        "label": "Month, Week or Day",
        "stage": "Getting around",
        "line": "Flip between the three views up top — Month for the overview, Week to see booked numbers per day, and Day for the full hour-by-hour run-sheet.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">Month</span> <span class=\"ochip\">Week</span> <span class=\"ochip\">Day</span></div><div class=\"row2\"><div><div class=\"fl\">PERIOD</div><div class=\"field\">August 2026</div></div><div><div class=\"fl\">JUMP TO</div><div class=\"field\">‹  Today  ›</div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Mon 3 Aug</b> <span class=\"g\">Summer Multi-Sports Camp</span></div></div></div>"
      },
      {
        "label": "Sessions vs your events",
        "stage": "Reading it",
        "line": "Solid colour-filled chips are bookable sessions pulled from your listings, while your own dashed 📌 events sit right alongside them.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Summer Multi-Sports Camp</b> <span class=\"g\">18 / 24 booked · 75%</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>📌 Staff INSET day</b> <span class=\"g\">your event</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>📌 August Bank Holiday</b> <span class=\"g\">closed</span></div></div><div class=\"hint\">Solid = session (edit in Listings). Dashed 📌 = event you added here.</div></div>"
      },
      {
        "label": "Add or edit an event",
        "stage": "Adding events",
        "line": "The only thing you write on this page — pop in a title, date and time, pick a colour-coded category, and set a reminder if you'd like a nudge beforehand.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">TITLE</div><div class=\"field\">Parent info evening</div><div class=\"row2\"><div><div class=\"fl\">DATE</div><div class=\"field\">2026-09-10</div></div><div><div class=\"fl\">TIME</div><div class=\"field\">18:30 – 19:30</div></div></div><div class=\"chips\"><span class=\"ochip\">Open day</span> <span class=\"chip2\">＋ New category</span></div><div class=\"chk\"><span class=\"chkbx\">✓</span>Reminder on · 60 min before</div></div>"
      },
      {
        "label": "Legend & filters",
        "stage": "Tidying the view",
        "line": "When several clubs are running at once, tap the toggles or dim a listing in the legend to isolate one club or hide the booking counts.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">Booking info</span> <span class=\"ochip\">My events</span> <span class=\"chip2\">All listings</span></div><div class=\"hint\">Legend — tap a listing to hide its sessions</div><div class=\"chips\"><span class=\"ochip\">Summer Multi-Sports Camp</span> <span class=\"ochip\">Little Kickers Football Club</span> <span class=\"chip2\">Holiday Art &amp; Craft Camp (hidden)</span></div></div>"
      },
      {
        "label": "Reminders & empty periods",
        "stage": "Good to know",
        "line": "If a period's empty we'll say so and offer a jump to the next thing on — and reminders send by your Settings default, which any event can override.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Nothing on this week</b> <span class=\"g\">next is Mon 1 Sep 2026</span></div></div><span class=\"btn amber\">Jump to it →</span><div class=\"hint\">Default reminder: on, 30 min before (Settings → Calendar). Each event can set its own.</div></div>"
      }
    ]
  },
  "timetable": {
    "title": "Activity timetable",
    "introLine": "This is where you turn your activity bank into a proper day-by-day camp timetable — set the days up, let it auto-fill or build it by hand, then share the finished thing with staff and parents.",
    "doneLine": "And that's your camp sorted — a full timetable built, refined and shared, all from the one page.",
    "steps": [
      {
        "label": "Dates",
        "stage": "Setup",
        "line": "Kick things off by pulling in your listing and ticking which dates the camp actually runs — everything downstream is built from what you choose here.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">LISTING</div><div class=\"field\">Loughton Multi-Activity Camp</div><div class=\"row2\"><div><div class=\"fl\">FROM</div><div class=\"field\">28 Jul</div></div><div><div class=\"fl\">TO</div><div class=\"field\">22 Aug</div></div></div><div class=\"hint\">28 Jul – 22 Aug · 09:00–15:30 · Loughton Manor First School · 20 days</div><div class=\"chips\"><span class=\"ochip\">✕ Mon 25 Aug excluded</span><span class=\"chip2\">19 of 20 days included</span></div></div>"
      },
      {
        "label": "The day & arrivals",
        "stage": "Setup",
        "line": "Set the shape of the day just once — start and end times, breaks, lunch and your sign-in slots — and they become the fixed banner rows on every grid.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">DAY START</div><div class=\"field\">09:00</div></div><div><div class=\"fl\">DAY END</div><div class=\"field\">15:30</div></div></div><div class=\"row2\"><div><div class=\"fl\">LUNCH</div><div class=\"field\">12:00</div></div><div><div class=\"fl\">ACTIVITIES / DAY</div><div class=\"field\">6</div></div></div><div class=\"fl\">WHOLE-CAMP · SIGN-IN · SIGN-OUT</div><div class=\"chips\"><span class=\"ochip\">🎪 14:30</span><span class=\"ochip\">➡️ 08:00</span><span class=\"ochip\">➡️ 09:00</span><span class=\"ochip\">⬅️ 15:30</span><span class=\"ochip\">⬅️ 17:30</span></div></div>"
      },
      {
        "label": "Groups & spaces",
        "stage": "Setup",
        "line": "Add your groups, switch on the spaces you've actually got this week and pick which activity categories go into the rotation.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">FACILITIES</div><div class=\"chips\"><span class=\"ochip\">🏟️ Sports Hall</span><span class=\"ochip\">🌳 Field</span><span class=\"ochip\">🛝 Playground</span><span class=\"ochip\">📚 Classroom</span><span class=\"ochip\">🎾 Tennis court</span></div><div class=\"fl\">GROUPS</div><div class=\"chips\"><span class=\"ochip\">🔴 Reds (5–7)</span><span class=\"ochip\">🔵 Blues (8–10)</span><span class=\"ochip\">🟢 Greens (11–13)</span></div><div class=\"chips\"><span class=\"ochip\">⚽ Sports</span><span class=\"ochip\">🎨 Arts</span><span class=\"ochip\">🧗 Extreme</span></div></div>"
      },
      {
        "label": "Activity bank",
        "stage": "Activities",
        "line": "Toggle activities on or off, say where each one runs and hide any that aren't right for a group — only the 'On' ones get rotated into the grid.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">SPORTS · 2/2 ON</div><div class=\"tkt\"><div class=\"tkhd\"><b>Football</b> <span class=\"g\">@ Field · all groups</span><span class=\"tkp\">On</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Multi-Sports</b> <span class=\"g\">@ Sports Hall · all groups</span><span class=\"tkp\">On</span></div></div><div class=\"fl\">EXTREME</div><div class=\"tkt\"><div class=\"tkhd\"><b>Archery</b> <span class=\"g\">@ Field · excl. Reds</span><span class=\"tkp\">On</span></div></div><div class=\"chips\"><span class=\"ochip\">＋ Bubble Football</span></div></div>"
      },
      {
        "label": "Build the grid",
        "stage": "Build",
        "line": "Let it auto-fill for variety or start from a blank template, then just drag blocks to swap them and click any cell to tweak it.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">⚙️ Automatic</span><span class=\"ochip\">✏️ Manual</span></div><div class=\"fl\">MON 28 JUL · DAY VIEW</div><div class=\"tkt\"><div class=\"tkhd\"><b>09:00</b> <span class=\"g\">Sign-in · whole-camp banner</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>10:00</b> <span class=\"g\">Reds Football · Blues Basketball · Greens Archery</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>14:30</b> <span class=\"g\">Water Day · all groups</span></div></div></div>"
      },
      {
        "label": "Publish",
        "stage": "Publish",
        "line": "Nothing goes live until you publish — flick it out to staff and parents, and choose whether everyone or just booked families gets to see it.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chk\"><span class=\"chkbx\">✓</span>Publish to the Staff portal</div><div class=\"chk\"><span class=\"chkbx\">✓</span>Share with Parents</div><div class=\"fl\">PARENT AUDIENCE</div><div class=\"chips\"><span class=\"ochip\">✓ Booked families only</span><span class=\"ochip\">Everyone viewing the listing</span></div><span class=\"btn amber\">Publish timetable</span><div class=\"hint\">Published to staff + parents · 19 days</div></div>"
      }
    ]
  },
  "registers": {
    "title": "Registers",
    "introLine": "This is your daily register — where you sign the children in and out, keep an eye on every allergy and medical flag, and take a quick head count, all for one camp on one day.",
    "doneLine": "And that's the register sorted — everyone signed in, counted, and their parents just a tap away.",
    "steps": [
      {
        "label": "Pick listing & day",
        "stage": "Get set up",
        "line": "Start by choosing which camp you're running and which day, so the whole register is pointed at the right group before you mark a soul present.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">LISTING</div><div class=\"field\">MULTI-ACTIVITY CAMP</div><div class=\"hint\">📍 Loughton Manor · Today · Tue 9 Jun</div><div class=\"tkt\"><div class=\"tkhd\"><b>Today · Tue 9 Jun</b> <span class=\"tkp\">10 booked · 7 in</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Tomorrow · Wed 10 Jun</b> <span class=\"g\">10 booked</span></div></div><span class=\"btn\">⚑ Log incident</span></div>"
      },
      {
        "label": "Take the register",
        "stage": "Attendance",
        "line": "This is the heart of it — one tap to sign a child in, one to log them collected, with allergy and medical flags right there on every row so nothing gets missed at drop-off or pick-up.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">Expected 10</span><span class=\"ochip\">Present 7</span><span class=\"ochip\">Not arrived 1</span><span class=\"ochip\">Absent/ill 1</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Jack Jones</b> <span class=\"g\">Age 8 · 8am–5pm · PIN 4821</span></div><span class=\"chip2\">🥜 Peanuts</span> <span class=\"chip2\">💊 Asthma</span> <span class=\"btn amber\">Sign in</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Sofia Reyes</b> <span class=\"g\">Age 7 · 9am–3pm · PIN 8812</span></div><span class=\"chip2\">💊 Diabetes</span> <span class=\"btn\">✓ In · 08:47</span></div></div>"
      },
      {
        "label": "Head count",
        "stage": "Safety check",
        "line": "On trips and free-play you'll physically count heads on top of the register — pop the number in and the running tally flags if you're short, with a note of who counted and when.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">HEADS COUNTED</div><div class=\"field\">7</div><div class=\"hint\">expected 10 · 2 head counts logged today</div><div class=\"tkt\"><div class=\"tkhd\"><b>7/10 ⚠ 3 short</b> <span class=\"g\">by Priya Shah at 10:30</span></div></div><span class=\"btn amber\">Log head count</span></div>"
      },
      {
        "label": "Child profile",
        "stage": "Attendance",
        "line": "Tap any child to open their full profile — medical and learning needs, collection password and emergency contact all in one place, without ever leaving the register.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">NOAH SMITH · AGE 10 (03/07/2015)</div><div class=\"hint\">8am–5pm · PIN 6093</div><div class=\"fl\">LEARNING NEEDS</div><div class=\"field\">ADHD — benefits from structure</div><div class=\"row2\"><div><div class=\"fl\">EMERGENCY CONTACT</div><div class=\"field\">Beth Smith · +44 7700 900633</div></div><div><div class=\"fl\">PASSWORD</div><div class=\"field\">Falcon</div></div></div></div>"
      },
      {
        "label": "Download register",
        "stage": "Records",
        "line": "Need a printed sheet for a trip or a spreadsheet for your records? Tick exactly which columns to include — handy for leaving out the sensitive bits — and grab it as a PDF or CSV.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">DOWNLOAD REGISTER — TODAY</div><div class=\"hint\">The child's name is always included.</div><div class=\"chips\"><span class=\"ochip\">Age</span><span class=\"ochip\">Timing</span><span class=\"ochip\">Allergies</span><span class=\"ochip\">Medical</span><span class=\"ochip\">Emergency contact</span></div><span class=\"btn amber\">PDF (printable)</span> <span class=\"btn\">CSV (spreadsheet)</span></div>"
      },
      {
        "label": "Message parents",
        "stage": "Communicate",
        "line": "Spotted something day-of — late pick-up or a change of plan? Message one parent or the whole day's group in a flash, in-app or by email, without switching areas.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">TO</div><div class=\"field\">All parents attending Today — Multi-Activity Camp (10 families)</div><div class=\"fl\">SUBJECT</div><div class=\"field\">Pick-up moved to 5:15 today</div><span class=\"btn amber\">Send in-app</span> <span class=\"btn\">Send as email</span></div>"
      }
    ]
  },
  "ratios": {
    "title": "Ratios & groups",
    "introLine": "This is your live cover board — it sorts the day's booked children into age groups from your registers and checks each one against your own ratio targets, so you can tell at a glance whether every group's properly staffed.",
    "doneLine": "And that's the lot — scope the board, obey your policy, work the cards, and you'll spot a short group long before the session ever runs.",
    "steps": [
      {
        "label": "Day, listing & the three hero tiles",
        "stage": "Scope & read",
        "line": "Start by picking the season, the camp and the day — then the three hero tiles give you the headline: how many children are in, whether they're covered, and how many groups are running.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">SEASON</div><div class=\"field\">📅 Summer Holidays 2026</div></div><div><div class=\"fl\">LISTING</div><div class=\"field\">🎟 Summer Multi-Sports Camp · 34 kids</div></div></div><div class=\"chips\"><span class=\"ochip\">Whole day 34</span><span class=\"ochip\">9am–3pm 26</span><span class=\"ochip\">8am–5:30pm 8</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Children on site</b> <span class=\"g\">across 2 groups · 3 SEND</span><span class=\"tkp\">34</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Staff on duty</b> <span class=\"g\">5 needed · 1 short</span><span class=\"tkp\">4</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Groups today</b> <span class=\"g\">every child placed by age</span><span class=\"tkp\">2</span></div></div></div>"
      },
      {
        "label": "Your ratio policy",
        "stage": "Policy",
        "line": "Here for reference only — these colours, age bands and targets are your own policy (activity camps aren't bound by statutory ratios), and they can only be edited over in Setup, where every board reads from the one master record.",
        "bodyHtml": "<div class=\"frm\"><div class=\"hint\">Your ratio policy — set in Setup → Age groups & rooms; shown here for reference.</div><div class=\"tkt\"><div class=\"tkhd\"><b>🔵 Cubs</b> <span class=\"g\">5–7 yrs · room size 24</span><span class=\"tkp\">1:8</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>🟢 Explorers</b> <span class=\"g\">8–11 yrs · no cap</span><span class=\"tkp\">1:12</span></div></div><div class=\"hint\">Change them in Setup and every board and listing updates at once.</div></div>"
      },
      {
        "label": "Your team & the Cover board",
        "stage": "Live board",
        "line": "This is the daily workspace — build your team, then drag real staff onto the coloured group cards and watch, card by card, whether each age band is in ratio, with red banners flagging any group that's short.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">Ellie Hartman · Camp Lead · you</span><span class=\"ochip\">Marcus Bright · Coach</span><span class=\"ochip\">Priya Shah · Coach</span><span class=\"ochip\">Tom Reyes · Assistant</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>🔵 Cubs · Target 1:8</b> <span class=\"g\">12 children · 2 of 2 needed</span><span class=\"tkp\">🙂 In ratio</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>🟢 Explorers · Target 1:12</b> <span class=\"g\">22 children · 2 of 3 needed</span><span class=\"tkp\">😟 1 short</span></div></div><div class=\"hint\">NEEDS 1 MORE STAFF ON THIS DAY — drag a child between cards to regroup.</div></div>"
      },
      {
        "label": "Staffing ratio calculator",
        "stage": "Planning",
        "line": "A handy planning aid off to one side — drop in today's numbers (or a hypothetical mix) and it totals the staff you'd need, blending statutory EYFS bands for the little ones with your own school-age targets.",
        "bodyHtml": "<div class=\"frm\"><span class=\"btn amber\">🧮 Drop in today (34)</span><div class=\"row2\"><div><div class=\"fl\">CUBS (5–7 YRS)</div><div class=\"field\">12</div></div><div><div class=\"fl\">EXPLORERS (8–11 YRS)</div><div class=\"field\">22</div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Total children</b> <span class=\"g\">Cubs 12÷8=2 · Explorers 22÷12=2</span><span class=\"tkp\">34</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Total staff needed</b> <span class=\"g\">EYFS statutory · school-age your policy</span><span class=\"tkp\">4</span></div></div></div>"
      }
    ]
  },
  "incidents": {
    "title": "Log concern",
    "introLine": "This is your one place for recording concerns about a child — everyday behaviour notes you can share with the parent, and confidential safeguarding matters that go straight to your DSL.",
    "doneLine": "And that's the lot — behaviour on one side, safeguarding on the other, every concern kept safely on the child's record.",
    "steps": [
      {
        "label": "Two tabs, one title bar",
        "stage": "Overview",
        "line": "Your first choice is simply which kind of concern this is — a routine behaviour note the parent can see, or a confidential safeguarding matter that's routed to your DSL.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">⚑ LOG A CONCERN</div><div class=\"chips\"><span class=\"ochip\">🧩 Behaviour</span><span class=\"ochip\">🛡️ Safeguarding</span></div><div class=\"hint\">Behaviour &amp; near-misses — share with the parent when you choose. Accidents &amp; first aid live in Health &amp; safety.</div></div>"
      },
      {
        "label": "Behaviour tiles & Log button",
        "stage": "Behaviour",
        "line": "The stat tiles give you an at-a-glance feel for how many concerns are on the go and whether parents have been told, before you open a fresh record.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"chip2\">This month 3</span><span class=\"chip2\">Serious 1</span><span class=\"chip2\">Parent informed 4</span><span class=\"chip2\">Total 9</span></div><span class=\"btn amber\">＋ Log a behaviour concern</span></div>"
      },
      {
        "label": "Log a behaviour concern",
        "stage": "Behaviour",
        "line": "This is the heart of the page — a three-step wizard that walks you through who and when, what actually happened, then how serious it is and who gets to see it.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">CHILD</div><div class=\"field\">Freya Whitmore</div></div><div><div class=\"fl\">WHEN</div><div class=\"field\">Tue 5 Aug · 14:20</div></div></div><div class=\"fl\">WHAT HAPPENED (FACTS)</div><div class=\"field\">Pushed another child off the bench during free play; calmed down after a chat.</div><div class=\"chips\"><span class=\"ochip\">Minor</span><span class=\"ochip\">Moderate</span><span class=\"ochip\">Serious</span></div><div class=\"chips\"><span class=\"ochip\">📤 Share with parent</span><span class=\"ochip\">🔒 Keep internal</span></div></div>"
      },
      {
        "label": "Per-child records & messages",
        "stage": "Behaviour",
        "line": "Records gather neatly under each child, with colour-coded badges at a glance and a two-way thread so you can read the parent's reply and pick up the conversation.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">👤 FREYA WHITMORE · 2 RECORDS</div><div class=\"tkt\"><div class=\"tkhd\"><b>Pushed another child off the bench</b> <span class=\"g\">5 Aug</span></div></div><div class=\"chips\"><span class=\"chip2\">Moderate</span><span class=\"chip2\">📤 Shared</span><span class=\"chip2\">💬 Parent replied</span></div><div class=\"hint\">Parent: “Thanks for letting me know — we've talked to her at home.”</div><span class=\"btn\">💬 Details &amp; messages (1)</span></div>"
      },
      {
        "label": "Safeguarding concern form",
        "stage": "Safeguarding",
        "line": "Safeguarding is a different, facts-only shape — you pick the category and the risk level and 'what to do now' protocol set themselves, and you can even pin an injury on the body map.",
        "bodyHtml": "<div class=\"frm\"><div class=\"hint\">🛡️ You are the safeguarding lead — confidential, facts only.</div><div class=\"chips\"><span class=\"ochip\">🧒 A child</span><span class=\"ochip\">🧑‍🏫 A member of staff</span></div><div class=\"fl\">CATEGORY (KCSIE)</div><div class=\"field\">Child-on-child abuse (bullying, harassment)</div><div class=\"chips\"><span class=\"chip2\">Risk: Medium</span><span class=\"chip2\">Oliver Branson</span><span class=\"chip2\">📍 Body map: 1 pin</span></div></div>"
      },
      {
        "label": "DSL action log & PDF",
        "stage": "Safeguarding",
        "line": "For safeguarding the record is only half the job — behind 'Review &amp; action' the DSL logs what they did with timestamps and review dates, then exports the full child dossier as a confidential PDF.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"chip2\">Medium risk</span><span class=\"chip2\">⏳ Awaiting DSL</span><span class=\"chip2\">🗓 2 actions by 8 Aug</span></div><div class=\"chk\"><span class=\"chkbx\">✓</span>Spoke to the child — 5 Aug 15:10</div><div class=\"chk\"><span class=\"chkbx\">✓</span>Referred to children's social care — review by 8 Aug</div><span class=\"btn amber\">🛡️ Review &amp; action (DSL)</span><span class=\"btn\">⬇ Download PDF…</span></div>"
      }
    ]
  },
  "medication": {
    "title": "Medication",
    "introLine": "This is where you keep children's medicine safe and above board — consent, stock, every dose given, and the return home, all joined up around the child.",
    "doneLine": "And that's the full chain — from a parent's signature right through to the medicine going safely back home.",
    "steps": [
      {
        "label": "Overview & tabs",
        "stage": "Orientation",
        "line": "Four little tiles give you the day's safety picture at a glance, and five tabs walk you through the four linked records.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Doses today</b> <span class=\"g\">given so far</span><span class=\"tkp\">1</span></div></div><div class=\"row2\"><div class=\"tkt\"><div class=\"tkhd\"><b>Active auths</b><span class=\"tkp\">2</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Meds in stock</b><span class=\"tkp\">2</span></div></div></div><div class=\"chips\"><span class=\"ochip\">💊 Give a dose</span><span class=\"ochip\">✍️ Authorisations</span><span class=\"ochip\">📦 Stock</span><span class=\"ochip\">📋 MAR log</span><span class=\"ochip\">🏠 Returns</span></div><div class=\"hint\">Children covered: 2 · records stay visible for safeguarding even when logging is off.</div></div>"
      },
      {
        "label": "Give a dose",
        "stage": "Point of care",
        "line": "Pick a child with consent, the blue summary tells you exactly what's allowed, then you record the dose with a second staff signature right there.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">Ava (7)</span><span class=\"ochip\">Mia (9)</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Salbutamol inhaler (Ventolin)</b> <span class=\"g\">Inhaler 100mcg/puff · 2 puffs Inhaled</span></div><div class=\"g\">PRN: Wheeze, or before sport · Max/24h 8 · Min interval 240 min</div></div><div class=\"chips\"><span class=\"ochip\">given</span><span class=\"ochip\">refused</span><span class=\"ochip\">missed</span></div><div class=\"row2\"><div><div class=\"fl\">DOSE</div><div class=\"field\">2 puffs</div></div><div><div class=\"fl\">WITNESSED BY</div><div class=\"field\">Tom Reade ✍️</div></div></div><div class=\"chk\"><span class=\"chkbx\">✓</span>Parent informed today · In stock: 1</div><span class=\"btn amber\">Record &amp; sign</span></div>"
      },
      {
        "label": "Authorisations",
        "stage": "Consent",
        "line": "This is the parent's signed permission that unlocks dose-giving — you mostly read it and add operational notes rather than changing the medical instruction.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Ava — Salbutamol (Ventolin)</b> <span class=\"chip2\">Prescribed</span></div><div class=\"g\">Consent: Sarah Okafor, signed 12 Jun 2026 · valid 12 Jun → 12 Dec 2026</div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Mia — Cetirizine antihistamine</b> <span class=\"chip2\">Over-the-counter</span></div><div class=\"g\">Liquid 5mg/5ml · 5ml Oral · fixed 09:00 · “Give with breakfast”</div><div class=\"g\">Consent: James Patel · valid 1 Jun → 31 Aug 2026</div></div><div class=\"fl\">STAFF NOTES (OPERATIONAL — DOES NOT CHANGE PARENT CONSENT)</div><div class=\"field ph\">Add an operational note…</div></div>"
      },
      {
        "label": "Stock & MAR log",
        "stage": "Records",
        "line": "Stock proves what medicine you physically hold and what's expiring, and the MAR is the tamper-evident audit trail inspectors love — corrections are struck through, never erased.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">STOCK HELD</div><div class=\"tkt\"><div class=\"tkhd\"><b>Ava — Salbutamol</b> <span class=\"g\">in stock 1 · exp 03/2027</span><span class=\"chip2\">active</span></div><div class=\"g\">Received 12 Jun 2026 by Liberty Young · Locked cabinet · Room temp</div></div><div class=\"fl\">ADMINISTRATION RECORD (APPEND-ONLY)</div><div class=\"tkt\"><div class=\"tkhd\"><b>09:05am — Mia — Cetirizine</b> <span class=\"g\">5ml · Oral</span><span class=\"chip2\">given</span></div><div class=\"g\">By Liberty Young · witness Tom Reade · qty after 1 · parent told ✓ · “No issues”</div></div><div class=\"hint\">Made a mistake? “Correct” strikes the row through rather than deleting it.</div></div>"
      },
      {
        "label": "Returns",
        "stage": "Hand-back",
        "line": "Medicine that came in must be signed back out to the parent, closing the loop with a clean chain of custody from consent to hand-back.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">RETURNS TO PARENT</div><div class=\"tkt\"><div class=\"tkhd\"><b>Ava — Salbutamol inhaler</b> <span class=\"g\">qty 1 · 15 Aug 2026</span></div><div class=\"g\">Returned to Sarah Okafor · handled by Liberty Young</div><div class=\"g\">⏳ Awaiting parent signature</div></div><div class=\"row2\"><div><div class=\"fl\">MEDICATION</div><div class=\"field\">Ava — Salbutamol</div></div><div><div class=\"fl\">QTY RETURNED</div><div class=\"field\">1</div></div></div><div class=\"hint\">The parent signs to confirm receipt in their own app — record 4 of the four linked records.</div></div>"
      }
    ]
  },
  "accidents": {
    "title": "First aid",
    "introLine": "This is your digital accident book — log a bump, record the first aid you gave, auto-flag anything RIDDOR-reportable, and share it with the parent, all in one place.",
    "doneLine": "And that's the whole loop — logged, flagged, shared and signed off, with a tidy audit trail behind every record.",
    "steps": [
      {
        "label": "KPI stat row",
        "stage": "Overview",
        "line": "Your safety pulse at a glance — the counts up top, plus a nudge whenever an accident needs a RIDDOR review with its legal filing clock ticking.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>🔔 Accident logged — knock to head (Freya M.)</b> <span class=\"g\">needs RIDDOR review · 9:12am</span></div></div><div class=\"row2\"><div><div class=\"fl\">TODAY</div><div class=\"field\">1</div></div><div><div class=\"fl\">THIS WEEK</div><div class=\"field\">4</div></div></div><div class=\"row2\"><div><div class=\"fl\">RIDDOR OPEN</div><div class=\"field\">1</div></div><div><div class=\"fl\">MOST COMMON</div><div class=\"field\">Cut / graze</div></div></div></div>"
      },
      {
        "label": "Log an accident",
        "stage": "Log",
        "line": "The heart of the page — jot down who, what and the first aid you gave; the severity chip is the clever bit, as it's what quietly decides whether this gets escalated to RIDDOR.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">CHILD</div><div class=\"field\">Freya Middleton</div></div><div><div class=\"fl\">ACTIVITY</div><div class=\"field\">Climbing wall</div></div></div><div class=\"fl\">INJURY TYPE</div><div class=\"chips\"><span class=\"ochip\">Bump/bruise</span><span class=\"ochip\">Knock to head</span><span class=\"ochip\">Cut/graze</span></div><div class=\"fl\">SEVERITY — DRIVES RIDDOR</div><div class=\"chips\"><span class=\"ochip\">Minor (first aid)</span><span class=\"ochip\">Over-7-day</span><span class=\"ochip\">Specified</span></div><div class=\"chk\"><span class=\"chkbx\">✓</span>Parent informed at collection</div><span class=\"btn amber\">Save accident</span></div>"
      },
      {
        "label": "Accident insights",
        "stage": "Insights",
        "line": "Turns the raw log into prevention smarts — the bars show you where accidents cluster, so if most grazes keep happening on the football pitch, you'll spot it and can act.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">BY INJURY TYPE</div><div class=\"tkt\"><div class=\"tkhd\"><b>Cut / graze</b> <span class=\"g\">▓▓▓▓▓</span><span class=\"tkp\">5</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Bump / bruise</b> <span class=\"g\">▓▓▓</span><span class=\"tkp\">3</span></div></div><div class=\"fl\">BY ACTIVITY / LOCATION</div><div class=\"tkt\"><div class=\"tkhd\"><b>Football pitch</b> <span class=\"g\">▓▓▓▓</span><span class=\"tkp\">4</span></div></div></div>"
      },
      {
        "label": "Accident book",
        "stage": "Register",
        "line": "Your legally-required register, newest first — scan the RIDDOR column for its file-by deadline and the parent-told/shared status to see what's still outstanding.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">ACCIDENT BOOK</div><div class=\"tkt\"><div class=\"tkhd\"><b>Freya Middleton · Knock to head</b> <span class=\"g\">9 Aug · 14:35 · Head · told ✓</span><span class=\"tkp\"><span class=\"chip2\">Minor</span></span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Oscar Bennett · Suspected fracture</b> <span class=\"g\">8 Aug · 11:05 · Arm · Acknowledged</span><span class=\"tkp\"><span class=\"chip2\">RIDDOR · by 15 Aug</span></span></div></div></div>"
      },
      {
        "label": "Expanded record",
        "stage": "Close-out",
        "line": "Tap any row to close it out end-to-end — share it for the parent to acknowledge, add an admin note, download the report for your insurer, and keep the immutable chronology that makes it all defensible.",
        "bodyHtml": "<div class=\"frm\"><div class=\"field\">Suspected fracture → Arm · specified · Football · Astro pitch · Sling applied, ambulance called · Liberty Young</div><div class=\"hint\">⚠️ The provider reports this to HSE — ActivityOS records it only · file by 15 Aug.</div><div class=\"chk\"><span class=\"chkbx\">✓</span>Parent acknowledged · 8 Aug 6:40pm</div><div class=\"row2\"><div><span class=\"btn amber\">📤 Share with parent</span></div><div><span class=\"btn\">⬇ Download report</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Chronology</b> <span class=\"g\">logged 11:05 → shared 11:20 → acknowledged 6:40pm</span></div></div></div>"
      }
    ]
  },
  "moments": {
    "title": "Moments",
    "introLine": "Moments is where you share each child's day with their parents — the activities, little milestones and photos that land live in the family's own app.",
    "doneLine": "And that's Moments — a lovely, safe way to keep parents right in the heart of their child's day.",
    "steps": [
      {
        "label": "Share a moment",
        "stage": "Composer",
        "line": "Pick a listing and the children come through automatically from its bookings, then tag an activity and jot down what happened — that's a post.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">LISTING (TODAY)</div><div class=\"field\">Multi-Activity Camp — Mon 9 Aug</div><div class=\"hint\">Children are pulled from the bookings on this listing — same register as the Registers area.</div><div class=\"fl\">WHICH CHILDREN?</div><div class=\"chips\"><span class=\"ochip\">🧒 Ava · Photos: Yes</span><span class=\"ochip\">🧒 Noah · Photos: No</span><span class=\"ochip\">🧒 Mia · Photos: Yes</span></div><div class=\"fl\">ACTIVITY</div><div class=\"chips\"><span class=\"ochip\">🎨 Arts & crafts</span><span class=\"ochip\">⚽ Sports</span><span class=\"ochip\">🍎 Lunch & snack</span></div><div class=\"field\">Ava and Mia built a junk-model rocket and counted down the launch together.</div><span class=\"btn amber\">Post update 🚀</span></div>"
      },
      {
        "label": "Photo consent gate",
        "stage": "Safeguarding",
        "line": "If a selected child hasn't got photo consent the app blocks the photo for you — so nobody's caught out — while a text-only update still posts fine.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">PHOTO</div><div class=\"tkt\"><div class=\"tkhd\"><b>⚠ Noah doesn't have photo consent</b> <span class=\"g\">remove Noah or post without a photo</span></div></div><div class=\"hint\">Text-only updates for Noah still post fine.</div><div class=\"fl\">WITH AVA &amp; MIA SELECTED</div><div class=\"tkt\"><div class=\"tkhd\"><b>🌈 Painted rainbow</b> <span class=\"g\">tagged</span><span class=\"tkp\">Child's work</span></div></div></div>"
      },
      {
        "label": "Photo approval",
        "stage": "Governance",
        "line": "If the owner's turned on approval, any moment with a photo waits amber-flagged until a manager approves it — text-only posts sail straight through to parents.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>🏊 Noah swam a whole width on his own!</b> <span class=\"g\">Tom Reade · Swimming</span></div></div><div class=\"hint\">⚠ Awaiting approval — not sent to parents yet.</div><span class=\"btn amber\">✔ Approve &amp; send</span><span class=\"btn\">Reject</span></div>"
      },
      {
        "label": "Photo gallery",
        "stage": "Media library",
        "line": "Every photo and piece of work you post files itself in here automatically, ready to filter by child or date whenever you need it.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">📷 PHOTO GALLERY — 2 OF 3 STORED</div><div class=\"hint\">Every photo &amp; piece of work lands here automatically.</div><div class=\"chips\"><span class=\"ochip\">All children</span><span class=\"ochip\">Mia</span></div><div class=\"chips\"><span class=\"ochip\">All dates</span><span class=\"ochip\">Today</span><span class=\"ochip\">This week</span></div></div>"
      },
      {
        "label": "The live feed",
        "stage": "The record",
        "line": "This is the running story of the day — exactly what parents see mirrored back — with the children, activity, time and a little heart for the likes.",
        "bodyHtml": "<div class=\"frm\"><div class=\"prevcard\"><div class=\"ph\">🎨</div><div class=\"pb\"><div class=\"pt\">Ava &amp; Mia · Arts &amp; crafts · Their work</div><div class=\"pm\">Made superhero masks and wore them all afternoon!</div><div class=\"pp\">1:24pm · ♥ 2 · Liberty Young</div></div></div><div class=\"prevcard\"><div class=\"ph\">🏊</div><div class=\"pb\"><div class=\"pt\">Noah · Swimming</div><div class=\"pm\">Swam a whole width on his own for the first time!</div><div class=\"pp\">11:50am · ♥ 1 · Tom Reade</div></div></div></div>"
      }
    ]
  },
  "documents": {
    "title": "Documents",
    "introLine": "This is your Head Office library — one tidy home for every policy, agreement, template and brand asset, with control over exactly who down the network can see each file.",
    "doneLine": "And that's the library — upload once, set the sharing scope, and the right files flow neatly down to your franchises and staff.",
    "steps": [
      {
        "label": "Library summary",
        "stage": "Overview",
        "line": "Four little tiles up top give you an instant read of the library size — and, crucially, how many files are overdue a review before you go digging.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div class=\"tkt\"><div class=\"tkhd\"><b>43</b> <span class=\"g\">Documents in library</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>31</b> <span class=\"g\">Shared with franchises</span></div></div></div><div class=\"row2\"><div class=\"tkt\"><div class=\"tkhd\"><b>3</b> <span class=\"g\">Need review / renewal</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>1.2 GB</b> <span class=\"g\">Storage used</span></div></div></div></div>"
      },
      {
        "label": "Search & upload",
        "stage": "Add files",
        "line": "This is how a document enters the library — Upload records the file and its sharing scope, while Search and folders are on the way but not live just yet.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">SEARCH DOCUMENTS</div><div class=\"field ph\">🔍 Search documents…</div><div class=\"chips\"><span class=\"btn\">+ New folder</span><span class=\"btn amber\">↓ Upload</span></div><div class=\"hint\">Uploading 'Autumn Half-Term Camp — Risk Assessment.docx'. Search and folders are coming in a later phase.</div></div>"
      },
      {
        "label": "Category filters",
        "stage": "Filter",
        "line": "Tap a category pill to jump straight to one class of document — say all your Compliance evidence for an inspection — instead of scanning the whole list.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">FILTER BY CATEGORY</div><div class=\"chips\"><span class=\"ochip\">All</span><span class=\"ochip\">Policies</span><span class=\"ochip\">Agreements</span><span class=\"ochip\">Brand & marketing</span><span class=\"ochip\">Compliance</span><span class=\"ochip\">HR</span><span class=\"ochip\">Templates</span></div><div class=\"hint\">'Compliance' selected — narrows to the Safeguarding Policy and Public Liability certificate.</div></div>"
      },
      {
        "label": "Documents & sharing scope",
        "stage": "The library",
        "line": "The heart of the page — every file with its category and, most importantly, its 'Shared with' scope that decides exactly who down the network can open it.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>📄 Safeguarding Policy 2026</b> <span class=\"g\">Compliance · Updated 02 Jun 2026</span><span class=\"tkp\">1.3 MB</span></div><div class=\"chips\"><span class=\"chip2\">Franchises + staff</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>📄 Public Liability Insurance</b> <span class=\"g\">Renews 31 Dec 2026</span><span class=\"tkp\">820 KB</span></div><div class=\"chips\"><span class=\"chip2\">All franchises</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>📝 Franchise Agreement — template</b> <span class=\"g\">Agreements · Legal</span><span class=\"tkp\">240 KB</span></div><div class=\"chips\"><span class=\"chip2\">Head Office only</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>🗜️ Marketing toolkit (summer)</b> <span class=\"g\">Brand & marketing</span><span class=\"tkp\">64 MB</span></div><div class=\"chips\"><span class=\"chip2\">All franchises</span></div></div></div>"
      },
      {
        "label": "In-app reader",
        "stage": "Read inline",
        "line": "A document isn't just a download — open the accordion and read a policy in full, right here, like this GDPR one that spells out the platform-wide safeguarding rule.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">GDPR & DATA PROTECTION POLICY 2026</div><div class=\"field\">Owner: Head Office (Data Protection Lead) · Applies to: every provider, site, franchise & staff · Review: at least annually</div><div class=\"chk\"><span class=\"chkbx\">✓</span>§4 Children's data — turning a field off stops NEW collection but never hides or deletes existing medical/SEND/allergy info.</div></div>"
      }
    ]
  },
  "finance": {
    "title": "Finances",
    "introLine": "This is your money-and-analytics hub — one place to see what you've earned, what's still owed, when it lands in the bank, and who's actually booking.",
    "doneLine": "That's the whole money picture in one page — revenue, payouts, debts and demand, all moving together with your chosen window.",
    "steps": [
      {
        "label": "Period toggle + five tabs",
        "stage": "The frame",
        "line": "Pick a window at the top — 3, 6 or 12 months — and every figure on the page recalculates, with the five tabs simply slicing that same data different ways.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">FINANCE & ANALYTICS &nbsp;£</div><div class=\"field\">10 Feb 2026 – 9 Aug 2026</div><div class=\"chips\"><span class=\"ochip\">3m</span><span class=\"ochip\">✓ 6m</span><span class=\"ochip\">12m</span></div><div class=\"chips\"><span class=\"chip2\">Overview</span><span class=\"chip2\">Revenue</span><span class=\"chip2\">Payouts</span><span class=\"chip2\">Debts</span><span class=\"chip2\">Customers & learners</span></div><div class=\"hint\">Opens on Payouts first if your payout account isn't set up yet.</div></div>"
      },
      {
        "label": "Overview",
        "stage": "At a glance",
        "line": "The headline tiles show collected versus booked, what's still owed and what actually reaches your bank after fees — the quick health-check most operators open this page for.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">REVENUE COLLECTED</div><div class=\"field\">£18,420 <span class=\"g\">88% of £21,050 booked</span></div></div><div><div class=\"fl\">OWED TO YOU</div><div class=\"field\">£2,630 <span class=\"g\">unpaid / invoiced</span></div></div></div><div class=\"row2\"><div><div class=\"fl\">REFUNDS</div><div class=\"field\">£310 <span class=\"g\">last 6 months</span></div></div><div><div class=\"fl\">EST. NET TO BANK</div><div class=\"field\">£18,155 <span class=\"g\">after ~£265 fees</span></div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Summer Multi-Sports Camp</b> <span class=\"g\">top listing</span><span class=\"tkp\">£6,240</span></div></div></div>"
      },
      {
        "label": "Payouts",
        "stage": "Getting paid",
        "line": "This is your Stripe on-ramp and your in-transit versus settled split — just remember the amounts are ActivityOS estimates until Stripe is fully connected.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chk\"><span class=\"chkbx\">✓</span>Payout account connected &nbsp;<span class=\"btn\">Manage payouts →</span></div><div class=\"row2\"><div><div class=\"fl\">ON THE WAY (EST.)</div><div class=\"field\">£1,240</div></div><div><div class=\"fl\">IN YOUR BANK (EST.)</div><div class=\"field\">£16,915</div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>5 Aug 2026</b> <span class=\"g\">BK-10432, BK-10433 · succeeded</span><span class=\"tkp\">£96.00</span></div></div><div class=\"hint\">Est. fees £265 · Est. net (period) £18,155 — estimates only.</div></div>"
      },
      {
        "label": "Debts",
        "stage": "Chasing money",
        "line": "Here's the money still owed — unpaid booking balances and open or overdue invoices — with names next to each amount so you know exactly who to chase.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">OWED BY FAMILIES</div><div class=\"field\">£2,630 <span class=\"g\">unpaid bookings</span></div></div><div><div class=\"fl\">UNPAID INVOICES</div><div class=\"field\">£1,180 <span class=\"g\">4 open</span></div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Priya Sharma</b> <span class=\"g\">Overdue · due 1 Aug</span><span class=\"tkp\">£180.00</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Daniel O'Brien</b> <span class=\"g\">due 12 Aug</span><span class=\"tkp\">£95.00</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>The Whitfield family</b> <span class=\"g\">Overdue · due 28 Jul</span><span class=\"tkp\">£250.00</span></div></div></div>"
      },
      {
        "label": "Customers & learners",
        "stage": "Who's booking",
        "line": "Beyond the cash, this tab shows loyalty, value per family and which age bands fill up — the demand signal sitting behind your revenue.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">TOTAL BOOKERS</div><div class=\"field\">74 <span class=\"g\">last 6 months</span></div></div><div><div class=\"fl\">TOTAL LEARNERS</div><div class=\"field\">96 <span class=\"g\">children booked in</span></div></div></div><div class=\"row2\"><div><div class=\"fl\">RETURNING BOOKERS</div><div class=\"field\">41 <span class=\"g\">55% · 33 new</span></div></div><div><div class=\"fl\">SPEND PER CUSTOMER</div><div class=\"field\">£249 <span class=\"g\">collected ÷ bookers</span></div></div></div><div class=\"chips\"><span class=\"ochip\">Under 5 · 8</span><span class=\"ochip\">5–7 · 34</span><span class=\"ochip\">8–10 · 29</span><span class=\"ochip\">11–13 · 19</span><span class=\"ochip\">14+ · 6</span></div><div class=\"hint\">Paid vs free sessions: 512 paid · 44 free.</div></div>"
      }
    ]
  },
  "expenses": {
    "title": "Money out",
    "introLine": "This is your spending hub — pop in everything the business pays out, mark each one as owed or gone, and watch it all roll up into tidy monthly and yearly totals.",
    "doneLine": "That's the lot — keep your spends logged and your receipts attached, and come tax time everything's sitting neat and ready for the accountant.",
    "steps": [
      {
        "label": "The headline + Cash/Accrual toggle",
        "stage": "Overview",
        "line": "Everything you spend rolls up into three big numbers up top, and the Cash-or-Accrual toggle quietly decides whether money you still owe is counted yet.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>💸 Money out</b> <span class=\"g\">This month: £1,247.50 paid + £222.00 pending</span></div></div><div class=\"row2\"><div><div class=\"fl\">OUT THIS MONTH</div><div class=\"field\">£1,247.50</div></div><div><div class=\"fl\">OUT IN 2026</div><div class=\"field\">£8,930.00</div></div></div><div class=\"fl\">PENDING TO PAY</div><div class=\"field\">£222.00</div><div class=\"chips\"><span class=\"ochip\">✓ Cash · counts when paid</span><span class=\"ochip\">Accrual · counts when logged</span></div><div class=\"hint\">Pending isn't counted in the totals above until it's marked paid.</div></div>"
      },
      {
        "label": "Log an expense",
        "stage": "Logging",
        "line": "This is the heart of the page — pop in a spend, mark it Paid or Pending, and if it's a regular bill set it to repeat so a whole run of entries appears for you.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">DATE</div><div class=\"field\">2026-08-05</div></div><div><div class=\"fl\">CATEGORY</div><div class=\"field\">Venue hire</div></div></div><div class=\"row2\"><div><div class=\"fl\">AMOUNT (£)</div><div class=\"field\">180.00</div></div><div><div class=\"fl\">SUPPLIER</div><div class=\"field\">Riverside Sports Hall</div></div></div><div class=\"fl\">NOTES</div><div class=\"field\">Summer Multi-Sports Camp — week 3 hire</div><div class=\"chips\"><span class=\"ochip\">✓ Paid</span><span class=\"ochip\">Pending</span><span class=\"ochip\">⬆ Upload receipt</span></div><span class=\"btn amber\">Log expense</span></div>"
      },
      {
        "label": "All expenses ledger",
        "stage": "Ledger",
        "line": "Where you'll actually graft day-to-day — search a spend, chase what's owed, tap Mark paid to flip a bill Paid on the spot, and pull a CSV for your accountant.",
        "bodyHtml": "<div class=\"frm\"><div class=\"field ph\">🔍 Search supplier or note…</div><div class=\"chips\"><span class=\"ochip\">All categories</span><span class=\"ochip\">This month</span><span class=\"ochip\">Newest</span><span class=\"ochip\">⬇ Export CSV</span></div><div class=\"hint\">12 of 34 expenses · showing £1,247.50</div><div class=\"tkt\"><div class=\"tkhd\"><b>RS · Riverside Sports Hall</b> <span class=\"g\">Venue hire · 5 Aug 2026 · Paid</span><span class=\"tkp\">£180.00</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>MM · Morton Michel</b> <span class=\"g\">Insurance · Repeats · Pending · due 20 Aug</span><span class=\"tkp\">£42.00</span></div></div><span class=\"btn\">Mark paid</span></div>"
      },
      {
        "label": "Overview dashboard",
        "stage": "Overview",
        "line": "A quick health-check of the business — where the money's leaking, which suppliers cost you most, and whether this month's up or down on the last, all without wading through the ledger.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">THIS MONTH</div><div class=\"field\">£1,247.50</div></div><div><div class=\"fl\">BIGGEST</div><div class=\"field\">£245.50 · Equipment</div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Where it goes</b></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Venue hire</b> <span class=\"g\">43%</span><span class=\"tkp\">£540</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Equipment</b> <span class=\"g\">20%</span><span class=\"tkp\">£245.50</span></div></div><div class=\"hint\">Top suppliers: 1. Riverside Sports Hall £540 (3×) · 2. Sports Direct £245.50 (1×)</div></div>"
      },
      {
        "label": "Receipts",
        "stage": "Receipts",
        "line": "Come tax time every spend wants a receipt behind it — this tab shows your coverage at a glance and lets you fill the gaps with a single tap.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>28 of 34 expenses have a receipt</b> <span class=\"g\">82%</span></div></div><div class=\"hint\">Missing a receipt · 2</div><div class=\"tkt\"><div class=\"tkhd\"><b>Minibus fuel</b> <span class=\"g\">Travel · 5 Aug</span><span class=\"tkp\">£48.00</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Face paints</b> <span class=\"g\">Supplies · 3 Aug</span><span class=\"tkp\">£22.00</span></div></div><span class=\"btn amber\">＋ Add receipt</span></div>"
      },
      {
        "label": "Categories & Suppliers",
        "stage": "Setup",
        "line": "Keep the ledger tidy with reusable categories and a saved supplier address book — and flip the toggle so your own ActivityOS plan fee gets counted as a monthly cost too.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Venue hire</b> <span class=\"g\">43% · 3 expenses · avg £180</span><span class=\"tkp\">£540</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Riverside Sports Hall</b> <span class=\"g\">bookings@riversidesports.co.uk · 07700 900123</span></div></div><span class=\"btn\">＋ Add supplier</span><div class=\"chk\"><span class=\"chkbx\">✓</span>Include my ActivityOS subscription in expenses</div><div class=\"hint\">ActivityOS Pro plan · £29/month since 12 Jan 2026 — counted below.</div></div>"
      }
    ]
  },
  "purchasing": {
    "title": "Money in",
    "introLine": "This is your one takings hub, love — every paid booking, paid invoice and bit of cash you log all roll up into a single \"money in\" figure, then split neatly into an Income side and an Invoices side.",
    "doneLine": "And that's the lot — bookings and invoices land on their own, you pop the rest in by hand, and it all tallies up at the top so you always know exactly what's come in.",
    "steps": [
      {
        "label": "The hub & switch",
        "stage": "Overview",
        "line": "Up top you get your whole takings at a glance, with a little pill to flip between the Income workspace and the Invoices workspace.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkhd\"><b>💰 Money in</b> <span class=\"g\">this month</span><span class=\"tkp\">£4,820</span></div><div class=\"chips\"><span class=\"ochip\">💰 Income</span><span class=\"ochip\">📄 Invoices</span></div><div class=\"row2\"><div><div class=\"fl\">IN 2026</div><div class=\"field\">£38,450</div></div><div><div class=\"fl\">AWAITING PAYMENT</div><div class=\"field\">£1,290</div></div></div><div class=\"hint\">This month: £3,150 bookings + £980 invoices + £690 other income · awaiting payment isn't counted until it's paid.</div></div>"
      },
      {
        "label": "Income · Overview",
        "stage": "Income",
        "line": "The Overview shows not just your total but the shape of it — which programmes and which payment types bring the money in, scoped to any season or date range you fancy.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">Overview</span><span class=\"ochip\">All income</span><span class=\"ochip\">Categories</span></div><div class=\"tkhd\"><b>This month</b> <span class=\"g\">▲12% vs last month £4,300</span><span class=\"tkp\">£4,820</span></div><div class=\"fl\">WHERE IT COMES FROM</div><div class=\"tkt\"><div class=\"tkhd\"><b>Camps</b> <span class=\"g\">44%</span><span class=\"tkp\">£2,100</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Sessions</b> <span class=\"g\">Memberships £680 · Grants £700</span><span class=\"tkp\">£1,340</span></div></div><div class=\"hint\">Bookings by payment type: Card £1,980 (63%) · Tax-Free Childcare £620 · Vouchers £340 · Cash £210.</div></div>"
      },
      {
        "label": "Log income",
        "stage": "Income",
        "line": "Cash on the door, grants and fundraising don't arrive on their own, so this little modal is where you key them in — with a repeat option for anything that comes round regularly.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">DATE</div><div class=\"field\">9 Aug 2026</div></div><div><div class=\"fl\">CATEGORY</div><div class=\"field\">Camps</div></div></div><div class=\"row2\"><div><div class=\"fl\">AMOUNT</div><div class=\"field\">£540</div></div><div><div class=\"fl\">REPEAT</div><div class=\"field\">One-off</div></div></div><div class=\"fl\">SOURCE</div><div class=\"field\">Holiday Club — Week 3</div><div class=\"fl\">NOTES</div><div class=\"field\">Tuck shop + late pickup</div><span class=\"btn amber\">＋ Log income</span></div>"
      },
      {
        "label": "All income",
        "stage": "Income",
        "line": "This is your single reconciled ledger — every pound in, with auto-folded bookings and invoices sat read-only next to the bits you've logged, all filterable and ready to export for the accountant.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"field ph\">🔎 Search income…</div></div><div><div class=\"field\">This month</div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Bookings</b> <span class=\"g\">🎟️ Card · Locke family · Football Camp · BKG-2291 <span class=\"chip2\">auto</span></span><span class=\"tkp\">+£135</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Invoices</b> <span class=\"g\">📄 invoice · Priya Shah <span class=\"chip2\">auto</span></span><span class=\"tkp\">+£240</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Grants</b> <span class=\"g\">Awards for All · ✎ ×</span><span class=\"tkp\">+£700</span></div></div><div class=\"hint\">Sort Newest / Oldest / Largest / Smallest · ⬇ Export CSV.</div></div>"
      },
      {
        "label": "New invoice",
        "stage": "Invoices",
        "line": "On the active side you raise a proper invoice for a deposit or balance and it spits out a shareable pay-link, tied straight back to a real parent record on the system.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">CUSTOMER</div><div class=\"field\">Priya Shah</div></div><div><div class=\"fl\">INVOICE NO.</div><div class=\"field\">INV-1042</div></div></div><div class=\"row2\"><div><div class=\"fl\">INVOICE DATE</div><div class=\"field\">9 Aug 2026</div></div><div><div class=\"fl\">DUE DATE</div><div class=\"field\">16 Aug 2026</div></div></div><div class=\"chips\"><span class=\"ochip\">+3d</span><span class=\"ochip\">+5d</span><span class=\"ochip\">+7d ⭐</span><span class=\"ochip\">+10d</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Summer camp balance</b> <span class=\"g\">🔎 Find a parent · child Aanya</span><span class=\"tkp\">£240</span></div></div></div>"
      },
      {
        "label": "Track & chase",
        "stage": "Invoices",
        "line": "And here you close the loop — see who still owes, chase them by email, WhatsApp or pay-link, then mark it paid so that amount folds straight back into your takings up top.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">Draft £0</span><span class=\"ochip\">Sent £1,290 (5)</span><span class=\"ochip\">Paid £12,640 (19)</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Priya Shah</b> <span class=\"g\">Summer camp balance · due 16 Aug</span><span class=\"tkp\">£240</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Tom Beckett</b> <span class=\"g\">🚩 overdue · due 2 Aug</span><span class=\"tkp\">£310</span></div></div><div class=\"chips\"><span class=\"ochip\">✉️ Email + pay-link</span><span class=\"ochip\">💬 WhatsApp</span><span class=\"ochip\">🔗 Copy link</span></div><span class=\"btn amber\">Mark paid</span><div class=\"hint\">Card payments are still being connected, so mark paid by hand when the money lands.</div></div>"
      }
    ]
  },
  "newsfeed": {
    "title": "Newsfeed",
    "introLine": "This is your announcement board — post updates, events, reminders and urgent closures, and every family with a booking sees them pop up in their own app.",
    "doneLine": "And that's the Newsfeed — pick a template, write it, choose who and when, then watch the seen counts and RSVPs roll in.",
    "steps": [
      {
        "label": "Pick a post type",
        "stage": "Start",
        "line": "Everything starts by tapping a template — the type you choose sets the card's colour, its fields and its defaults, so Urgent auto-pins and asks for an acknowledgement while a Booking nudge adds a 'Book now' button.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Newsfeed</b> <span class=\"g\">Published 24 · Pinned 3 · Scheduled 2</span></div></div><div class=\"fl\">NEW POST — PICK A TYPE</div><div class=\"chips\"><span class=\"ochip\">📣 Announcement</span><span class=\"ochip\">📅 Event</span><span class=\"ochip\">⏰ Reminder</span><span class=\"ochip\">🚨 Urgent / closure</span><span class=\"ochip\">🎉 Celebration</span><span class=\"ochip\">🎟️ Booking nudge</span></div><div class=\"hint\">Or hit ✨ Design a newsletter, top-right, for the richer multi-section builder.</div></div>"
      },
      {
        "label": "Write the post",
        "stage": "Compose",
        "line": "The composer is where the message is built — jot a rough note into '✨ Help me write' and let the AI draft it, then fine-tune the title, message, image and any event details, watching the live family preview update as you go.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>New · Event</b> <span class=\"g\">✨ Help me write · medium</span></div></div><div class=\"fl\">TITLE</div><div class=\"field\">Summer Sports Day 🏅</div><div class=\"fl\">MESSAGE</div><div class=\"field\">Join us on the meadow for races, medals and a picnic — all welcome!</div><div class=\"row2\"><div><div class=\"fl\">DATE / TIME</div><div class=\"field\">18 Jul 2026 · 09:30</div></div><div><div class=\"fl\">COST</div><div class=\"field\">£4</div></div></div></div>"
      },
      {
        "label": "Who sees it",
        "stage": "Audience",
        "line": "Next you decide who's actually notified — all families or just chosen listings' parents — then name it for your own search, pop it in a folder and flip the toggles that control how prominent it is.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">WHO SEES IT — CHOSEN LISTINGS' FAMILIES</div><div class=\"chk\"><span class=\"chkbx\">✓</span>Woodpeckers Holiday Camp</div><div class=\"chk\"><span class=\"chkbx\">✓</span>After-School Football Club</div><div class=\"row2\"><div><div class=\"fl\">SAVE AS</div><div class=\"field\">Sports Day 2026</div></div><div><div class=\"fl\">FOLDER</div><div class=\"field\">Summer 2026</div></div></div><div class=\"chips\"><span class=\"ochip\">📌 Pin to top ✓</span><span class=\"ochip\">♥ Allow reactions ✓</span></div></div>"
      },
      {
        "label": "When & where to send",
        "stage": "Publish",
        "line": "Finally, choose the timing — publish now, schedule, or save a draft — and the destination, since the same post can also leave as an image, a printable PDF or an email, with a five-second cancellable countdown before anything live reaches families.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">WHEN (FOR THE NEWSFEED)</div><div class=\"chips\"><span class=\"ochip\">Publish now</span><span class=\"ochip\">Schedule ✓</span><span class=\"ochip\">Save as draft</span></div><div class=\"field\">Fri 17 Jul 2026 · 08:00</div><div class=\"chips\"><span class=\"ochip\">⬇ Image</span><span class=\"ochip\">⬇ PDF</span><span class=\"ochip\">✉ Email</span></div><div class=\"row2\"><div><span class=\"btn amber\">Schedule</span></div><div><span class=\"btn\">Post now → 5s ✋ Cancel</span></div></div></div>"
      },
      {
        "label": "Read the feed",
        "stage": "Track",
        "line": "Every post lands in the feed as a card showing where it went and when, plus the engagement that tells you it landed — seen counts, reactions and, for events, the Going / Maybe / No RSVP tally.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Summer Sports Day 🏅</b> <span class=\"chip2\">📅 Event</span><span class=\"chip2\">📌 Pinned</span></div></div><div class=\"hint\">✅ Shared to Woodpeckers Holiday Camp · 14 Jul, 08:12 · posted by Priya Sharma</div><div class=\"chips\"><span class=\"ochip\">📅 18 Jul · 09:30 · Meadow Park</span><span class=\"ochip\">🎟️ Reserve a spot</span></div><div class=\"tkt\"><div class=\"tkhd\"><span class=\"g\">Seen 42 · ♥ 11</span> <span class=\"tkp\">Going 18 · Maybe 5 · No 2</span></div></div></div>"
      },
      {
        "label": "Find, file & manage",
        "stage": "Organise",
        "line": "As the board fills up over the seasons, the filter pills, search, folders and each card's pin / edit / duplicate / archive controls keep it tidy — and Duplicate lets you reuse last year's post rather than rewriting it.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">All</span><span class=\"ochip\">Drafts</span><span class=\"ochip\">Scheduled ✓</span><span class=\"ochip\">Archived</span><span class=\"ochip\">🔍 Search</span></div><div class=\"fl\">FOLDER — SUMMER 2026</div><div class=\"chips\"><span class=\"ochip\">Posts</span><span class=\"ochip\">Newsletters ✓</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Sports Day (last year)</b> <span class=\"g\">📁 · Pin · Edit</span><span class=\"tkp\">⧉ Duplicate</span></div></div><div class=\"hint\">Duplicate makes a fresh draft copy; deleting a folder just moves its posts to Unfiled.</div></div>"
      }
    ]
  },
  "staff": {
    "title": "Staff",
    "introLine": "This is your team HQ.",
    "doneLine": "All sorted.",
    "steps": [
      {
        "label": "Tabs & Invite staff",
        "stage": "Getting started",
        "line": "Everything lives under five tabs, and the big amber button pings a new coach an invite that quietly attaches all the certificates and onboarding their role needs.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">👥 Team</span><span class=\"ochip\">📣 Recruitment</span><span class=\"ochip\">✅ Compliance</span><span class=\"ochip\">🎓 Roles</span><span class=\"ochip\">⚙️ Settings</span></div><div class=\"row2\"><div><div class=\"fl\">FULL NAME</div><div class=\"field\">Jordan Lee</div></div><div><div class=\"fl\">ROLE</div><div class=\"field\">Activity Leader</div></div></div><div class=\"fl\">ATTACHED ON INVITE</div><div class=\"chips\"><span class=\"chip2\">DBS required</span><span class=\"chip2\">Safeguarding</span><span class=\"chip2\">Onboarding checklist</span></div><span class=\"btn amber\">+ Invite staff</span><div class=\"hint\">Invite sent to Jordan Lee — shows as Pending until they log in and self-complete onboarding.</div></div>"
      },
      {
        "label": "Team tab",
        "stage": "Your team",
        "line": "The default landing view answers who's on your team, what they cost and who needs a nudge — a KPI strip up top and a weekly rota that feeds straight into Timesheets & Payroll.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"chip2\">5 Team · 2 venues</span><span class=\"chip2\">4 Active</span><span class=\"chip2\">1 Onboarding</span><span class=\"chip2\">1 Compliance action</span><span class=\"chip2\">148 h Scheduled</span><span class=\"chip2\">£2,140 Est. wage</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Hiba Rahman</b> <span class=\"g\">Lead Coach · Mon–Fri 9–5 · 40h</span><span class=\"tkp\">£16/hr</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Lacie Bennett</b> <span class=\"g\">Activity Leader · Mon/Tue/Thu/Fri 9–3:30</span><span class=\"tkp\">£13/hr</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Tom Reeves</b> <span class=\"g\">Assistant · Invited</span><span class=\"tkp\">£11/hr</span></div></div><div class=\"hint\">The recurring roster feeds Timesheets & Payroll automatically.</div></div>"
      },
      {
        "label": "Compliance tab",
        "stage": "Compliance",
        "line": "The one surface where every certificate is read, chased and approved — a status badge per cert, an expiry date that warns you in good time, and a pending-approvals queue that gates whether staff can go Active.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">HIBA RAHMAN</div><div class=\"chips\"><span class=\"chip2\">DBS ✓ Approved</span><span class=\"chip2\">Safeguarding ✓ Valid</span><span class=\"chip2\">Paediatric First Aid ⚠ Exp 30d</span></div><div class=\"fl\">EXPIRY</div><div class=\"field\">02 Sep 2026</div><div class=\"tkt\"><div class=\"tkhd\"><b>Tom Reeves</b> <span class=\"g\">Assistant · DBS awaiting upload</span></div></div><div class=\"chips\"><span class=\"btn amber\">Approve certificates</span><span class=\"btn\">Send reminder</span></div></div>"
      },
      {
        "label": "Roles tab",
        "stage": "Rules",
        "line": "This is the rules engine behind the whole page — each role maps to the certificates and onboarding it demands, and nobody reaches Active until both are ticked off.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Manager / Lead Coach</b> <span class=\"g\">DBS + Safeguarding + Paediatric First Aid + full onboarding</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Coach / Activity Leader</b> <span class=\"g\">DBS + Safeguarding</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Assistant</b> <span class=\"g\">DBS</span></div></div><div class=\"fl\">ONBOARDING — 1 OUTSTANDING</div><div class=\"chk\"><span class=\"chkbx\">✓</span>Tom Reeves · Assistant · 1/3 approved</div><span class=\"btn amber\">Approve all</span></div>"
      },
      {
        "label": "Assignments",
        "stage": "Scheduling",
        "line": "This is how coaches actually land on specific camps and clubs — each assignment ties a listing, venue and dates together and drops you into a schedule to add or swap staff onto its days.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Summer Holiday Camp</b> <span class=\"g\">28 Jul–8 Aug · All venues</span></div></div><div class=\"chips\"><span class=\"chip2\">Hiba Rahman</span><span class=\"chip2\">Lacie Bennett</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Football Intensive</b> <span class=\"g\">11 Aug–15 Aug · Milton Keynes</span></div></div><div class=\"chips\"><span class=\"chip2\">Zaph Okafor</span></div><div class=\"chips\"><span class=\"btn amber\">+ New assignment</span><span class=\"btn\">Open schedule →</span></div></div>"
      },
      {
        "label": "Settings tab",
        "stage": "Configuration",
        "line": "The quiet config home you set once — how many days before expiry everyone gets alerted, and each certificate type's renewal cadence that drives all the chasing across the page.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">EXPIRY ALERT LEAD TIME</div><div class=\"field\">30 days</div><div class=\"fl\">CERTIFICATE TYPES</div><div class=\"chips\"><span class=\"chip2\">DBS · renew 36 mo</span><span class=\"chip2\">Safeguarding · renew 24 mo</span><span class=\"chip2\">Paediatric First Aid · renew 36 mo</span></div><div class=\"hint\">Role requirements shown read-only below, mirroring the Roles mapping.</div></div>"
      }
    ]
  },
  "tasks": {
    "title": "Task manager",
    "introLine": "This is your operational to-do list — proper tasks tied to real camps, bookings and compliance, all pulled into one tidy inbox no matter how many companies you coach for.",
    "doneLine": "And that's the lot — capture it, tick it off, and never lose track of what's due across all your gigs.",
    "steps": [
      {
        "label": "Workload cards",
        "stage": "Overview",
        "line": "A quick row of cards up top so you can see your whole workload — and anything that's slipped — at a single glance.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">YOUR WORKLOAD</div><div class=\"chips\"><span class=\"ochip\">🔵 Open · 4</span><span class=\"ochip\">🔴 Overdue · 1</span><span class=\"ochip\">🟠 Due this week · 3</span></div><div class=\"hint\">The 'Unassigned' card is manager-only — as a freelancer you get just these three.</div></div>"
      },
      {
        "label": "One inbox · Acting for",
        "stage": "One inbox",
        "line": "The clever bit for solo coaches — every company's tasks land together, each badged with its provider, and whatever you add gets filed to whoever you're currently acting for.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">ONE INBOX</div><div class=\"field\">One inbox across every company you work for</div><div class=\"fl\">ACTING FOR</div><div class=\"field\">APF Camps ▾</div><div class=\"chips\"><span class=\"chip2\">APF Camps</span><span class=\"chip2\">Riverside Sports</span><span class=\"chip2\">Bright Stars</span></div><div class=\"hint\">New tasks you add are filed to this company.</div></div>"
      },
      {
        "label": "Quick-add bar",
        "stage": "Capture",
        "line": "Just type it in plain English — @ picks the assignee, ! sets priority, # links a camp or booking, and words like 'tomorrow' set the due date automatically.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">ADD A TASK</div><div class=\"field ph\">Add a task…  try: Brief coaches tomorrow @Jess !high #Riverside</div><div class=\"field\">Chase parent consent form tomorrow @You !high #Easter</div><div class=\"chips\"><span class=\"chip2\">@You</span><span class=\"chip2\">!High</span><span class=\"chip2\">#Easter</span><span class=\"chip2\">Tomorrow</span></div><div class=\"hint\">@ assignee · ! priority · # link a camp/booking · today / tomorrow / Mon set the due date</div></div>"
      },
      {
        "label": "My Tasks list",
        "stage": "My tasks",
        "line": "The heart of the page — your tasks grouped into Overdue, Today and Upcoming, each row showing its priority, linked camp or booking, and when it's due.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">OVERDUE · 1</div><div class=\"tkt\"><div class=\"tkhd\"><b>Upload renewed DBS certificate</b> <span class=\"g\">🛡️ Compliance · ⚡auto · Riverside Sports</span><span class=\"tkp\">2d ago</span></div></div><div class=\"fl\">TODAY · 1</div><div class=\"tkt\"><div class=\"tkhd\"><b>Confirm session plan — football week</b> <span class=\"g\">🏕️ Easter · Wk1 · APF Camps</span><span class=\"tkp\">Today</span></div></div><div class=\"fl\">UPCOMING · 2</div><div class=\"tkt\"><div class=\"tkhd\"><b>Send invoice for last week</b> <span class=\"g\">🧾 Wk ending 7 Jun · Bright Stars</span><span class=\"tkp\">Tomorrow</span></div></div></div>"
      },
      {
        "label": "Board & detail drawer",
        "stage": "Board",
        "line": "Flip to the Board to drag tasks between columns, or click any row to open the drawer and tweak the detail — assignee, due date, priority, linked record and all.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">BOARD</div><div class=\"chips\"><span class=\"ochip\">Backlog · 1</span><span class=\"ochip\">To do · 2</span><span class=\"ochip\">In progress · 0</span><span class=\"ochip\">Done · 0</span></div><div class=\"fl\">SEND INVOICE FOR LAST WEEK</div><div class=\"row2\"><div><div class=\"fl\">ASSIGNEE</div><div class=\"field\">You</div></div><div><div class=\"fl\">DUE</div><div class=\"field\">Tomorrow</div></div></div><div class=\"row2\"><div><div class=\"fl\">PRIORITY</div><div class=\"field\">Medium</div></div><div><div class=\"fl\">LINKED TO</div><div class=\"field\">Booking · Wk ending 7 Jun</div></div></div></div>"
      }
    ]
  },
  "trips": {
    "title": "Trips & visits",
    "introLine": "This is where you plan an off-site visit from start to finish — details, risk assessment, ratios, parent consent, sign-off and live head counts — all scored in one readiness-tracked planner.",
    "doneLine": "And that's the full loop — from first idea to everyone safely back at base, all in one place.",
    "steps": [
      {
        "label": "Trips dashboard",
        "stage": "Overview",
        "line": "Your home base for every visit — each trip is a readiness card so you can see at a glance which ones are safe to run and which are still blocked.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"chip2\">Upcoming 3</span><span class=\"chip2\">This month 2</span><span class=\"chip2\">Need action 1</span><span class=\"chip2\">Total 7</span></div><div class=\"chips\"><span class=\"ochip\">All</span><span class=\"ochip\">Planned</span><span class=\"ochip\">Completed</span><span class=\"ochip\">Cancelled</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>🚌 Woodland Wonders, Epping Forest</b> <span class=\"g\">Approved — ready to go</span><span class=\"tkp\">86%</span></div></div><div class=\"chips\"><span class=\"chip2\">18 children</span><span class=\"chip2\">3 staff · 1:6</span><span class=\"chip2\">✓ RA signed</span><span class=\"chip2\">✍️ Consent 18/18</span><span class=\"chip2\">💳 Paid 16/18</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>🐠 Sea Life Centre, Brighton</b> <span class=\"g\">In planning</span><span class=\"tkp\">57%</span></div></div></div>"
      },
      {
        "label": "The 7-step planner",
        "stage": "Planner",
        "line": "Opening a trip swaps in the planner — a big readiness ring, six live chips and a rail of seven numbered steps that turn green as you complete them.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">SEA LIFE CENTRE, BRIGHTON · READINESS 57%</div><div class=\"chips\"><span class=\"chip2\">Children 12</span><span class=\"chip2\">Staff 2</span><span class=\"chip2\">Ratio 1:8</span><span class=\"chip2\">Consents 7/12</span><span class=\"chip2\">RA Draft</span><span class=\"chip2\">Sign-off Pending</span></div><div class=\"chips\"><span class=\"ochip\">1 ✓ Trip details</span><span class=\"ochip\">2 Risk assessment</span><span class=\"ochip\">3 Staffing & ratio</span><span class=\"ochip\">4 Consent & payment</span><span class=\"ochip\">5 Sign-off</span><span class=\"ochip\">6 Head counts</span><span class=\"ochip\">7 Debrief</span></div><div class=\"hint\">Ready to submit · Track changes ON · one step shows at a time with a Previous / Next pager.</div></div>"
      },
      {
        "label": "Risk assessment",
        "stage": "Compliance",
        "line": "The compliance heart of the trip — pull ready-made hazards from the bank, set an initial-to-residual rating, tick the controls, and only then can you sign it off.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">REFERENCE</div><div class=\"field\">RA-2026-041</div></div><div><div class=\"fl\">ASSESSOR</div><div class=\"field\">Priya Sharma</div></div></div><span class=\"btn\">📚 Add from hazard bank</span><div class=\"tkt\"><div class=\"tkhd\"><b>Aquarium walkways wet/slippery</b> <span class=\"g\">Initial M → Residual L</span></div></div><div class=\"chk\"><span class=\"chkbx\">✓</span>Controls in place — staff front & back; walk, don't run; hold handrails</div><div class=\"hint\">7/7 hazards have controls in place — Signed off by Priya Sharma (09 Aug 2026).</div></div>"
      },
      {
        "label": "Staffing & off-site ratio",
        "stage": "Safety",
        "line": "Set your off-site policy and we work out how many staff you need — the banner only turns green once the ratio's met with a named lead and a first aider.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"chip2\">18 children</span><span class=\"chip2\">3 staff</span><span class=\"chip2\">actual 1:6</span><span class=\"chip2\">policy 1:6 · need 3</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Priya Sharma</b> <span class=\"g\">Lead · First aider</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Grace Bennett</b> <span class=\"g\">Activity leader · First aider</span></div></div><div class=\"chips\"><span class=\"ochip\">＋ Daniel Reid</span><span class=\"ochip\">＋ Chloe Turner</span></div><div class=\"hint\">✓ Off-site ratio met (1:6), with a named lead and a first aider.</div></div>"
      },
      {
        "label": "Consent & payment",
        "stage": "Parents",
        "line": "Booked children flow straight in, so you can see who's consented, who still owes and who's not coming — then fire off a parent letter with a tap-to-pay button.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">FROM WHICH CAMP</div><div class=\"field\">Summer Multi-Sports Camp</div></div><div><div class=\"fl\">WHICH PASS</div><div class=\"field\">Full week + trips</div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Olivia Hughes</b> <span class=\"g\">age 8 · Consented</span><span class=\"tkp\">Paid £14</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Jacob Ali</b> <span class=\"g\">age 7 · ⚠ EpiPen · Pending</span><span class=\"tkp\">Unpaid</span></div></div><div class=\"hint\">7 consented · 5 pending · 6/12 paid · letter 7/12 sent.</div><span class=\"btn amber\">💳 Pay £14.00 · by 20 Aug 2026</span></div>"
      },
      {
        "label": "Sign-off & head counts",
        "stage": "On the day",
        "line": "The manager's approval is your go/no-go gate — and once it's green, the live head-count checkpoints let you confirm everyone's present at every stage.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"chip2\">Prepared by Priya Sharma</span><span class=\"chip2\">Checks: All clear</span></div><div class=\"hint\">Approved by Priya Sharma (Manager) · 09 Aug 2026, 14:32.</div><div class=\"tkt\"><div class=\"tkhd\"><b>Depart base</b> <span class=\"g\">✓ all 18 · 08:55</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Arrive venue</b> <span class=\"g\">✓ all 18 · 10:10</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Lunch / midpoint</b> <span class=\"g\">expecting 18</span></div></div><span class=\"btn amber\">Confirm count</span></div>"
      }
    ]
  },
  "referrals": {
    "title": "Refer a friend",
    "introLine": "This is the little \"give credit, get credit\" page where families share their own link and earn store credit whenever a friend books for the first time.",
    "doneLine": "And that's the lot — a friendly way for happy families to bring their friends along and pick up a bit of credit for the trouble.",
    "steps": [
      {
        "label": "Reward headline",
        "stage": "The hook",
        "line": "Right at the top we spell out the offer, and the reward amount is copy you've set per provider, so it isn't something families can change here.",
        "bodyHtml": "<div class=\"frm\"><span class=\"chip2\">Refer a friend</span><div class=\"fl\">HEADING</div><div class=\"field\">Share &amp; earn</div><div class=\"hint\">Earn £5 credit when a friend books their first Summer Holiday Camp.</div></div>"
      },
      {
        "label": "Referral link",
        "stage": "The link",
        "line": "Each family gets their own unique link, and a tap of Copy pops it on the clipboard with a cheery \"Referral link copied\" toast — this link is how a booking gets credited back to them.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">YOUR REFERRAL LINK</div><div class=\"field\">apf.camps/r/priya-9F3K</div><span class=\"btn amber\">Copy link</span><div class=\"hint\">Anyone who books through this link is matched to Priya's account.</div></div>"
      },
      {
        "label": "Share channels",
        "stage": "The link",
        "line": "Just under the link sit two quick share buttons — Email and WhatsApp — so families can fire it off in a tap (that's the lot for now, no Facebook yet).",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">SHARE VIA</div><div><span class=\"btn\">Email</span> <span class=\"btn\">WhatsApp</span></div><div class=\"hint\">Opening WhatsApp… drops the link straight into a message.</div></div>"
      },
      {
        "label": "Reward tracker",
        "stage": "The payoff",
        "line": "These three tiles let a family see how they're getting on — friends joined, credit banked, and anything still pending until that friend's first booking is actually paid.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Friends joined</b> <span class=\"g\">so far</span><span class=\"tkp\">2</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Credit earned</b> <span class=\"g\">in your wallet</span><span class=\"tkp\">£10</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Pending</b> <span class=\"g\">awaiting first booking</span><span class=\"tkp\">1</span></div></div></div>"
      }
    ]
  },
  "marketing": {
    "title": "Discount codes",
    "introLine": "This is where all your promo codes live — the little codes families type at checkout for money off, whether that's a public sale, a private thank-you, or an offer for a whole group.",
    "doneLine": "And that's the lot — you've now got everything you need to spin up a code, target it, and keep an eye on how it's doing.",
    "steps": [
      {
        "label": "Hero & live stats",
        "stage": "Overview",
        "line": "Right at the top you get a quick pulse on your codes — how many are live, how often they've been redeemed, and how many you've made in total.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>🏷️ Discount codes</b> <span class=\"g\">Codes families type at checkout…</span><span class=\"btn amber\">＋ New code</span></div></div><div class=\"chips\"><span class=\"ochip\">Active · 4</span><span class=\"ochip\">Redemptions · 137</span><span class=\"ochip\">Total codes · 9</span></div></div>"
      },
      {
        "label": "The code form",
        "stage": "Create",
        "line": "This is the heart of it — name the code, pick one of three discount types, then optionally add a minimum spend, an expiry, a usage cap and which listings it applies to.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">CODE</div><div class=\"field\">SUMMER25</div></div><div><div class=\"fl\">DISCOUNT TYPE</div><div class=\"field\">By a percentage</div></div></div><div class=\"row2\"><div><div class=\"fl\">PERCENT OFF</div><div class=\"field\">15%</div></div><div><div class=\"fl\">MIN SPEND (£)</div><div class=\"field\">60</div></div></div><div class=\"row2\"><div><div class=\"fl\">EXPIRY DATE</div><div class=\"field\">31 Aug 2026</div></div><div><div class=\"fl\">USAGE LIMIT</div><div class=\"field\">100</div></div></div><div class=\"fl\">APPLIES TO</div><div class=\"field\">Summer Multi-Sports Camp — Guildford</div></div>"
      },
      {
        "label": "Rule toggles",
        "stage": "Create",
        "line": "Two handy switches: cap a code to one use per family so a welcome offer stays a one-off, and stop a code stacking with any other at checkout.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>WELCOME10</b> <span class=\"g\">£10 off first booking</span></div></div><div class=\"chk\"><span class=\"chkbx\">✓</span>Limit to one use per customer</div><div class=\"chk\"><span class=\"chkbx\">✓</span>Can't be used with any other code</div><div class=\"hint\">Ticking these keeps a code single-use per family and stops it combining with sibling discounts.</div></div>"
      },
      {
        "label": "Reserve for a family or group",
        "stage": "Targeting",
        "line": "Keep a code public for anyone, or reserve it for one family or a saved group — reserving it messages and emails them and drops it straight into their Coupons area.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">RESERVE FOR ONE FAMILY</div><div class=\"field\">The Okafor family</div><div class=\"fl\">…OR A GROUP</div><div class=\"field ph\">No group</div><div class=\"hint\">Reserving auto-suggests OKAFOR2026, saves it, and emails them; left public it isn't emailed but shows in every family's Coupons banner.</div></div>"
      },
      {
        "label": "Parent groups",
        "stage": "Targeting",
        "line": "Build named sets of families once here — like your NHS parents or term-time regulars — and the reserve-for-a-group picker will feed straight off them.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>👥 Parent groups</b><span class=\"btn\">＋ New group</span></div></div><div class=\"chips\"><span class=\"chip2\">NHS parents · 12</span><span class=\"chip2\">Term-time regulars · 8</span><span class=\"chip2\">Holiday-club VIPs · 5</span></div><div class=\"chk\"><span class=\"chkbx\">✓</span>Amara Okafor</div><div class=\"chk\"><span class=\"chkbx\">✓</span>Priya Sharma</div></div>"
      },
      {
        "label": "The code list",
        "stage": "Manage",
        "line": "Every code sits here as a card showing its value, status and redemption progress, so you can read how it's doing and pause, edit or delete it on the spot.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>SUMMER25</b> <span class=\"chip2\">15% off</span> <span class=\"g\">active · min £60 · 42/100 used · expires 31 Aug 2026</span><span class=\"btn\">Pause</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>OKAFOR2026</b> <span class=\"chip2\">£10 off</span> <span class=\"g\">🔒 The Okafor family only · 1 per customer · 0/1 used</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>EASTER20</b> <span class=\"chip2\">20% off</span> <span class=\"g\">expired · 18/50 used</span></div></div></div>"
      }
    ]
  }
};
