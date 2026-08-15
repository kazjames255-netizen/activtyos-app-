import type { TourConfig } from "./GuidedTour";

// Provider-page walkthroughs. Drafted by a planner+builder agent pass that read
// each real page component, then QA'd by a review+amend pass against a 20-point
// rubric (functional truth vs the code, populated mock frames, TTS-clean
// narration). Keyed by route view-id (see lib/view-registry.tsx). Surfaced on
// provider portals via PageTour (and in-panel on the four self-hosting pages).
export const TOUR_CONFIGS: Record<string, TourConfig> = {
  "dash": {
    "title": "Your Dashboard",
    "introLine": "This is your morning command-centre — one glance tells you how the whole business is doing today: who's on site, which sessions are filling, what money's in, and how bookings are trending. Your tasks-due list links straight into the Task manager.",
    "doneLine": "Check in here each morning and, at a glance, you'll see who's on site, what's filling up, what's owed, and how the business is trending.",
    "steps": [
      {
        "label": "Your business at a glance",
        "stage": "Overview",
        "line": "The hero banner shows how many children are on site today and how many sessions are running. Below it, four live cards: new bookings over the last five weeks, spaces left on your open runs, money taken this week, and anything still outstanding.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">ON SITE TODAY</div><div class=\"field\">24 children · 3 sessions running</div><div class=\"row2\"><div class=\"tkt\"><div class=\"tkhd\"><b>New bookings</b> <span class=\"g\">last 5 weeks</span><span class=\"tkp\">31</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Spaces left</b> <span class=\"g\">68% filled</span><span class=\"tkp\">46</span></div></div></div><div class=\"row2\"><div class=\"tkt\"><div class=\"tkhd\"><b>Taken this week</b> <span class=\"g\">9 new bookings</span><span class=\"tkp\">£1,240</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Outstanding</b> <span class=\"g\">2 awaiting voucher</span><span class=\"tkp\">£320</span></div></div></div></div>"
      },
      {
        "label": "Today, live listings and tasks",
        "stage": "Today",
        "line": "The Today panel lists every club and camp running now with its start-to-finish time and a fill bar for places booked against capacity. Beside it, open listings show places left with a green, amber or red pill as they fill, and the Tasks today card lists anything due today and links into your Task manager.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">TODAY</div><div class=\"tkt\"><div class=\"tkhd\"><b>After-school Football Club</b> <span class=\"g\">15:30 to 16:30 · 75% full</span><span class=\"tkp\">12/16</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Holiday Camp · morning</b> <span class=\"g\">09:00 to 12:00 · 38% full</span><span class=\"tkp\">9/24</span></div></div><div class=\"fl\">LIVE LISTINGS · PLACES LEFT</div><div class=\"tkt\"><div class=\"tkhd\"><b>Saturday Multi-Sports</b> <span class=\"g\">from Sat 14 Jun</span><span class=\"chip2\">2 left</span><span class=\"tkp\">18/20</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Easter Holiday Camp</b> <span class=\"g\">from Tue 7 Apr</span><span class=\"chip2\">full</span><span class=\"tkp\">24/24</span></div></div><div class=\"fl\">TASKS TODAY</div><div class=\"tkt\"><div class=\"tkhd\"><b>Chase unpaid invoice — Obi family</b> <span class=\"g\">Today 14:00</span></div></div></div>"
      },
      {
        "label": "Business analytics — pick your window",
        "stage": "Analytics",
        "line": "Scroll on and the Business analytics section recalculates from your own bookings. The three-month, six-month and twelve-month toggle re-scopes everything below it — income collected net of refunds, total bookings, unique families, and your average booking value.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">BUSINESS ANALYTICS</div><div class=\"chips\"><span class=\"ochip\">3m</span><span class=\"ochip\">6m</span><span class=\"ochip\">12m</span></div><div class=\"row2\"><div class=\"tkt\"><div class=\"tkhd\"><b>Income collected</b> <span class=\"g\">net of refunds</span><span class=\"tkp\">£8,450</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Bookings</b> <span class=\"g\">excl. cancelled</span><span class=\"tkp\">132</span></div></div></div><div class=\"row2\"><div class=\"tkt\"><div class=\"tkhd\"><b>Families</b> <span class=\"g\">unique</span><span class=\"tkp\">74</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Avg booking</b> <span class=\"g\">per paid</span><span class=\"tkp\">£64</span></div></div></div></div>"
      },
      {
        "label": "Revenue splits, funnel and repeat customers",
        "stage": "Trends",
        "line": "The charts show income month by month and booked against collected, plus where your revenue comes from — by season and by activity, ranked in pounds. The booking funnel tracks bookings through to confirmed and paid, and the repeat-customers ring shows how many families come back.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">REVENUE BY ACTIVITY</div><div class=\"tkt\"><div class=\"tkhd\"><b>Multi-Sports Camp</b> <span class=\"g\">top earner</span><span class=\"tkp\">£3,200</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>After-school Football</b> <span class=\"g\">2nd</span><span class=\"tkp\">£2,150</span></div></div><div class=\"fl\">BOOKING FUNNEL</div><div class=\"chips\"><span class=\"ochip\">Bookings 132</span><span class=\"ochip\">Confirmed 118</span><span class=\"ochip\">Paid 96</span></div><div class=\"hint\">72% of bookings are paid · 89% confirmed · 41% of families are repeat.</div></div>"
      },
      {
        "label": "Bookings, payments and newest arrivals",
        "stage": "Detail",
        "line": "Finally, two doughnuts break your bookings down by status and by payment mix, a newest-bookings list shows who just signed up and for how much, and the footer line sums your listings, active runs and live bookings.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">BY STATUS</div><div class=\"chips\"><span class=\"ochip\">Confirmed 118</span><span class=\"ochip\">Approval needed 6</span><span class=\"ochip\">Waitlisted 4</span><span class=\"ochip\">Cancelled 4</span></div><div class=\"fl\">PAYMENT MIX</div><div class=\"chips\"><span class=\"ochip\">Paid 96</span><span class=\"ochip\">Unpaid 22</span><span class=\"ochip\">Invoice sent 10</span></div><div class=\"fl\">NEWEST BOOKINGS</div><div class=\"tkt\"><div class=\"tkhd\"><b>Sophie Khan</b> <span class=\"g\">Multi-Sports Camp</span><span class=\"tkp\">£96</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Aarav Patel</b> <span class=\"g\">After-school Football</span><span class=\"tkp\">£48</span></div></div><div class=\"hint\">12 listings · 5 active runs · 47 live bookings</div></div>"
      }
    ]
  },
  "meals": {
    "title": "Meals",
    "introLine": "This is where you build reusable menus, plan their dishes onto each listing's run-days, and set who sees what — families then add and pay for meals right in the booking basket, and every order and change lands back here.",
    "doneLine": "And that's Meals — build a menu once, drop it onto the days, and every order, swap and 'not yet chosen' nudge lands right back here for you.",
    "steps": [
      {
        "label": "Season & listing",
        "stage": "Start",
        "line": "Start on the first tab: choose a season, then the listing that slides out beside it. The planner runs left to right across three tabs, and every listing that already has a meal plan is listed below to jump back into.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">1 · Season &amp; listing</span><span class=\"ochip\">2 · Menu</span><span class=\"ochip\">3 · Days</span><span class=\"ochip\">Saved menus</span><span class=\"ochip\">Sharing</span></div><div class=\"row2\"><div><div class=\"fl\">SEASON</div><div class=\"field\">Summer 2026</div></div><div><div class=\"fl\">LISTING</div><div class=\"field\">Summer Multi-Activity Camp — Milton Keynes</div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Summer Multi-Activity Camp</b> <span class=\"g\">10 days planned · Summer 2026</span><span class=\"tkp\">Edit plan →</span></div></div><div class=\"hint\">Every listing with a saved meal plan is listed here to jump back into.</div></div>"
      },
      {
        "label": "Saved menus",
        "stage": "Build",
        "line": "Menus have their own tab and get reused across listings. Build one once — name it, then add each meal with a price, a diet type, and any of the fourteen UK allergens — and duplicate or edit it whenever you like.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">MENU NAME</div><div class=\"field\">Summer hot lunches</div><div class=\"tkt\"><div class=\"tkhd\"><b>Chicken and sweetcorn pasta</b> <span class=\"g\">🍖 Meat · Limit 20/day</span><span class=\"tkp\">£4.50</span></div><span class=\"chip2\">Gluten</span> <span class=\"chip2\">Milk</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Tomato and basil pasta</b> <span class=\"g\">🥕 Vegetarian</span><span class=\"tkp\">£4.50</span></div><span class=\"chip2\">Gluten</span></div><div class=\"chips\"><span class=\"btn amber\">Save menu</span><span class=\"btn\">Duplicate</span></div></div>"
      },
      {
        "label": "Menu onto the days",
        "stage": "Plan",
        "line": "The Menu and Days tabs are where you plan. Tap a menu, choose which dish or two each weekday serves — offer both a meat and a veg and families pick at checkout — then paint it onto the run-days. It saves as you go.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>🍽️ Summer hot lunches</b> <span class=\"g\">2 dishes</span><span class=\"tkp\">✓ picked</span></div><span class=\"chip2\">✓ Chicken pasta · £4.50</span> <span class=\"chip2\">✓ Tomato pasta · £4.50</span></div><div class=\"fl\">WEEK 1 · DROP IT ONTO THE DAYS</div><div class=\"chips\"><span class=\"ochip\">Mon · 2</span><span class=\"ochip\">Tue · 2</span><span class=\"ochip\">Wed · 2</span><span class=\"ochip\">Thu ＋ tap</span><span class=\"ochip\">Fri ＋ tap</span></div><div class=\"hint\">Changes save automatically. Any day with no veg option is flagged.</div></div>"
      },
      {
        "label": "Sharing & ordering rules",
        "stage": "Rules",
        "line": "The Sharing tab sets the rules: who sees each day's menu, how late families can order, a standard allergen note, and whether meal swaps need your say-so. Each saved plan can also email its caterer the orders on a schedule.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">WHO SEES THE MENU</div><div class=\"field\">✓ All booked families</div><div class=\"row2\"><div><div class=\"fl\">ORDERING CLOSES</div><div class=\"field\">The day before · 08:00</div></div><div><div class=\"fl\">MEAL CHANGES</div><div class=\"field\">Need my approval</div></div></div><div class=\"fl\">EMAIL THE CATERER THE ORDERS</div><div class=\"field\">orders@freshstartcatering.co.uk · every day at 07:00</div><div class=\"hint\">The cut-off pre-fills from your default — each listing can override it.</div></div>"
      },
      {
        "label": "Meal orders",
        "stage": "Track",
        "line": "Back on the first tab, the Meal orders panel totals who chose what — by day, by week or across the whole run — flags any booked child who hasn't chosen yet, and drops meal-change requests here for you to approve or decline.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">Daily</span><span class=\"ochip\">Weekly</span><span class=\"ochip\">Total</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Mon 3 Aug</b> <span class=\"g\">Chicken pasta ×5 · Tomato pasta ×2</span><span class=\"tkp\">7 meals</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>🔔 Meal change request</b> <span class=\"g\">Amara Singh · swap to Tomato pasta</span></div><div class=\"chips\"><span class=\"btn amber\">Approve</span><span class=\"btn\">Decline</span></div></div><div class=\"hint\">🕐 Not yet chosen: 2 booked children have no meal on Tue.</div></div>"
      }
    ]
  },
  "customers": {
    "title": "Families",
    "introLine": "This is your self-filling little black book (the page calls it Leads and customers) — every booking quietly pops the family in here, so you only ever type when someone rings up or you spot a correction, and you can see exactly where each family sits from first enquiry to happy regular.",
    "doneLine": "And that's Families — a CRM that mostly fills itself in, so you can spend your time chasing bookings rather than typing them up.",
    "steps": [
      {
        "label": "The pipeline tiles",
        "stage": "Pipeline",
        "line": "The tiles across the top are your funnel and your filter in one — each count tells you where families have got to, and a tap on any tile filters the list down to just that stage.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>All families</b> <span class=\"g\">Everyone on your list</span><span class=\"tkp\">48</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Lead</b> <span class=\"g\">Enquired, never booked, not invited yet</span><span class=\"tkp\">12</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Invited</b> <span class=\"g\">Sent a sign-up link, not signed in yet</span><span class=\"tkp\">7</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Customer</b> <span class=\"g\">Signed up or booked with you</span><span class=\"tkp\">21</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Repeat</b> <span class=\"g\">Booked more than once — they came back</span><span class=\"tkp\">8</span></div></div></div>"
      },
      {
        "label": "Import & export",
        "stage": "Bringing people in",
        "line": "Two shortcuts sit up top: Import bulk-adds families from a spreadsheet and can invite them in one go, and Export pulls any slice of your list — pick the families, columns and format you want.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">⬇ Export</span><span class=\"ochip\">📥 Import</span><span class=\"ochip\">＋ Add family</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Import families</b> <span class=\"g\">from a spreadsheet · optional invite</span></div></div><div class=\"hint\">Export lets you choose families, columns and a format (CSV or print).</div><div class=\"hint\">Import, Export and Add family show only for company, freelancer or franchise roles — staff see the page read-only.</div></div>"
      },
      {
        "label": "Toggle, filters & search",
        "stage": "Finding people",
        "line": "Flip between Families and Children depending on whether you're chasing money or running a day, then narrow by venue, booking date or a quick search — handy for pulling everyone interested in Bedford for a campaign.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">Families (48)</span><span class=\"ochip\">Children (73)</span></div><div class=\"field ph\">🔍 Search by name, child, email, phone or location…</div><div class=\"chips\"><span class=\"ochip\">📍 Bedford Sports Hall</span><span class=\"ochip\">📅 Booked on 04/08/2026</span><span class=\"ochip\">Show everyone</span></div><div class=\"hint\">Showing 3 of 48 · filter active</div></div>"
      },
      {
        "label": "Family card",
        "stage": "Finding people",
        "line": "Each family gets a card headed with its stage and booking count, so a long list stays scannable — see where they've got to, tap Contact to reach them any way you like, or re-send their sign-up link in one go.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Sarah Whitfield</b> <span class=\"g\">REPEAT · 3 bookings</span></div></div><div class=\"hint\">sarah.whitfield@gmail.com · 07700 900412</div><div class=\"chips\"><span class=\"chip2\">📍 Bedford Sports Hall</span><span class=\"chip2\">✉ Marketing</span><span class=\"chip2\">✓ Signed up</span><span class=\"chip2\">Freya · 8</span><span class=\"chip2\">Oliver · 6</span></div><div class=\"chips\"><span class=\"btn amber\">Contact →</span><span class=\"btn\">Re-send sign-up link</span><span class=\"btn\">View / edit</span><span class=\"btn ghost\">Has bookings</span></div><div class=\"hint\">Tap a child chip to jump straight to their profile.</div></div>"
      },
      {
        "label": "Add / edit a family",
        "stage": "Manual entry",
        "line": "For the manual cases — a phone enquiry, or a tweak to someone already on the list — pop the parent's details in here. Open a family to add each child: their age works itself out from the date of birth, and care notes save once to the family's shared record, so there's never a thin duplicate.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">FIRST NAME</div><div class=\"field\">Sarah</div></div><div><div class=\"fl\">SURNAME</div><div class=\"field\">Whitfield</div></div></div><div class=\"row2\"><div><div class=\"fl\">EMAIL</div><div class=\"field\">sarah.whitfield@gmail.com</div></div><div><div class=\"fl\">PHONE (OPTIONAL)</div><div class=\"field\">07700 900412</div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>👪 The family&rsquo;s own record — Freya</b></div><div class=\"row2\"><div><div class=\"fl\">DATE OF BIRTH</div><div class=\"field\">2018-03-14</div></div><div><div class=\"fl\">AGE (FROM DOB)</div><div class=\"field ph\">8</div></div></div><div class=\"row2\"><div><div class=\"fl\">ALLERGIES</div><div class=\"field\">Peanuts, kiwi</div></div><div><div class=\"fl\">COLLECTION PASSWORD</div><div class=\"field\">Bluebell</div></div></div></div><div class=\"chk\"><span class=\"chkbx\">✓</span>They said yes to hearing about upcoming activities</div><div class=\"chips\"><span class=\"btn\">Save</span><span class=\"btn amber\">✉ Save &amp; send sign-up link</span></div></div>"
      },
      {
        "label": "Children view",
        "stage": "On the day",
        "line": "This is what your team reads while running a session — allergies, SEND and the collection password at a glance — and a blank child clearly says 'Not filled in yet' so nobody ever mistakes an empty line for 'no needs'.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>👪 Whitfield</b> <span class=\"g\">2 children · Bedford Sports Hall</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Freya</b> <span class=\"g\">age 8</span><span class=\"tkp\">Open</span></div></div><div class=\"chips\"><span class=\"chip2\">Allergies · Peanuts, kiwi</span><span class=\"chip2\">Collection · Bluebell</span><span class=\"chip2\">SEND · plan on file</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Oliver</b> <span class=\"g\">age 6</span><span class=\"tkp\">Open</span></div></div><div class=\"hint\">Not filled in yet — a blank line does NOT mean a child has none.</div></div>"
      }
    ]
  },
  "email": {
    "title": "Email",
    "introLine": "This is your whole comms hub — a Gmail-style inbox and composer for writing to parents one-to-one, a marketing pipeline for branded campaigns to your live audiences, and the automatic emails ActivityOS sends for you.",
    "doneLine": "Write to parents from the Inbox, fire branded campaigns at your live audiences, let ActivityOS send the routine emails for you, and read the numbers to see what's landing.",
    "steps": [
      {
        "label": "Sub-tabs",
        "stage": "Getting around",
        "line": "Everything on this page lives under a row of eight tabs — the first two are your one-to-one mailbox and writing desk, the middle three run your bulk marketing, and the last three are the emails ActivityOS sends automatically plus your settings.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">EMAIL SECTIONS</div><div class=\"chips\"><span class=\"ochip\">Inbox</span><span class=\"ochip\">Compose</span><span class=\"ochip\">Campaigns</span><span class=\"ochip\">Audiences</span><span class=\"ochip\">Templates</span><span class=\"ochip\">Automatic emails</span><span class=\"ochip\">Analytics</span><span class=\"ochip\">Settings</span></div><div class=\"hint\">Inbox opens by default — the active tab sits highlighted so you always know where you are.</div></div>"
      },
      {
        "label": "Inbox",
        "stage": "One-to-one mail",
        "line": "Your everyday mailbox — folders, stars, snooze and a powerful search all work like Gmail, and one click on any parent's email marks it as an enquiry, dropping them straight onto your Audiences boards for follow-up.",
        "bodyHtml": "<div class=\"frm\"><div class=\"field ph\">🔍 Search mail · try from: subject: label: is:unread has:attachment</div><div class=\"tkt\"><div class=\"tkhd\"><b>Sarah Thompson · Summer camp availability?</b> <span class=\"g\">09:18</span></div><div class=\"g\">\"…any spaces left on your August multi-activity camp? My daughter is 8…\"</div></div><div class=\"chips\"><span class=\"ochip\">↩ Reply</span><span class=\"ochip\">↪ Forward</span><span class=\"ochip\">➕ Mark as enquiry</span></div><div class=\"hint\">Star, snooze, archive and folders all save to your account.</div></div>"
      },
      {
        "label": "Compose",
        "stage": "Writing to parents",
        "line": "The Compose tab is your writing desk — choose who gets it, all families, everyone on one listing, or a single address, draft it in the formatting editor with photos, attachments and a saved signature, then send or schedule; there's even a Help-me-write button and an undo-send window if you have second thoughts.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">WHO GETS IT</div><div class=\"chips\"><span class=\"ochip\">👨‍👩‍👧 All families · 312</span><span class=\"ochip\">🎟 A listing</span><span class=\"ochip\">✉️ Specific people</span></div><div><div class=\"fl\">SUBJECT</div><div class=\"field\">Only a few places left for October half-term</div></div><div><div class=\"fl\">MESSAGE</div><div class=\"field ph\">Hi {ChildName}'s family — we've just opened…</div></div><div class=\"chips\"><span class=\"ochip\">✨ Help me write</span><span class=\"ochip\">🖼 Photo</span><span class=\"ochip\">📎 Attach</span><span class=\"ochip\">✒ Signature</span></div><span class=\"btn amber\">Send to 312 recipients ▲</span></div>"
      },
      {
        "label": "Campaigns",
        "stage": "Marketing",
        "line": "This is where the real marketing happens — pick a live audience and a template or design, name it, then send now or schedule; each campaign reports back how many opened, tracked by a pixel, and click tracking is still to come.",
        "bodyHtml": "<div class=\"frm\"><span class=\"btn amber\">＋ New campaign</span><div class=\"tkt\"><div class=\"tkhd\"><b>Summer early-bird</b> <span class=\"g\">All active families · 312</span><span class=\"tkp\">65% open</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Win-back — spring lapsed</b> <span class=\"g\">Lapsed families · 88</span><span class=\"tkp\">Sending…</span></div></div><div class=\"hint\">Send now or schedule; opens tracked via a pixel. Click tracking is still to come.</div></div>"
      },
      {
        "label": "Audiences",
        "stage": "Marketing",
        "line": "These aren't fixed lists — each is a live rule that recounts from your bookings every send, opt-outs always left out. They split into booked-parent groups and enquiries — interested people who haven't booked, who by law you can only market to once they've opted in.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">📩 Enquiries</span><span class=\"ochip\">👪 Booked parents</span></div><div class=\"hint\">Recomputed from booking and enrolment data each send — opt-outs always excluded.</div><div class=\"tkt\"><div class=\"tkhd\"><b>All active families</b> <span class=\"g\">Has an active or upcoming booking</span><span class=\"tkp\">312</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Repeat families</b> <span class=\"g\">Booked with you 2+ times</span><span class=\"tkp\">88</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Lapsed families</b> <span class=\"g\">Not attended in 6+ months</span><span class=\"tkp\">54</span></div></div><span class=\"btn\">Use in campaign</span></div>"
      },
      {
        "label": "Templates",
        "stage": "Marketing",
        "line": "One library in two flavours — plain worded templates, shared with your Messages and the composer, with merge fields like ChildName and VenueName that fill themselves in, plus fully designed branded emails you build in the visual editor and send from Campaigns.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">✍️ Worded templates</span><span class=\"ochip\">🎨 Builder templates</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Early-bird launch</b></div><div class=\"g\">Subject: Early-bird places now open — save 15%</div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Last-chance places</b></div><div class=\"g\">Subject: Almost full — last places for {ListingName}</div></div><div class=\"hint\">Shared with Messages and the composer. Merge fields fill in each child, booking and venue.</div><span class=\"btn amber\">＋ New template</span></div>"
      },
      {
        "label": "Automatic emails",
        "stage": "Set and forget",
        "line": "Beyond what you write, ActivityOS quietly sends a batch on your behalf — booking confirmations, receipts, session reminders, late-collection alerts and review requests — and this tab is where you switch any of them off or change when the reminders go out.",
        "bodyHtml": "<div class=\"frm\"><div class=\"hint\">The emails ActivityOS sends for you automatically — flip any off, or change when reminders go out.</div><div class=\"chk\"><span class=\"chkbx\">✓</span>Bookings and approvals <span class=\"chip2\">Core</span></div><div class=\"chk\"><span class=\"chkbx\">✓</span>Payments and receipts</div><div class=\"chk\"><span class=\"chkbx\">✓</span>Session reminders <span class=\"g\">· 48 hours before</span></div><div class=\"chk\"><span class=\"chkbx\">✓</span>Late-collection alerts</div><div class=\"chk\"><span class=\"chkbx\">✓</span>Review requests</div></div>"
      },
      {
        "label": "Analytics",
        "stage": "Results",
        "line": "The payoff — for a single send or across the lot, see how many were delivered and your open rate, with bounces flagged as not delivered; click tracking and unsubscribe counts are still on the way.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">DELIVERED</div><div class=\"field\">624 · 58% open</div></div><div><div class=\"fl\">CLICK RATE</div><div class=\"field ph\">— link tracking to come</div></div></div><div class=\"chips\"><span class=\"ochip\">Sent 640</span><span class=\"ochip\">Not delivered 16</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>August football camp</b> <span class=\"g\">▇▇▇▇▇▇▇▁▁</span><span class=\"tkp\">72%</span></div></div></div>"
      }
    ]
  },
  "calendar": {
    "title": "Events calendar",
    "introLine": "This is your one big calendar — every booked session across all your listings, laid over the meetings, INSET days and closures you add yourself.",
    "doneLine": "One tidy calendar for every session and every event you run, however busy your week gets.",
    "steps": [
      {
        "label": "Month, Week or Day",
        "stage": "Getting around",
        "line": "Flip between the three views up top — Month for the overview, Week to see booked numbers per day, and Day for the full hour-by-hour run-sheet — and step through dates with the arrows, Today, or the date picker.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">Month</span> <span class=\"ochip\">Week</span> <span class=\"ochip\">Day</span></div><div class=\"row2\"><div><div class=\"fl\">PERIOD</div><div class=\"field\">August 2026</div></div><div><div class=\"fl\">JUMP TO</div><div class=\"field\">‹  Today  ›</div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Mon 3 Aug</b> <span class=\"g\">Summer Multi-Sports Camp · 18/24</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Wed 5 Aug</b> <span class=\"g\">📌 Staff INSET day</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Fri 7 Aug</b> <span class=\"g\">Little Kickers Football Club · 12/16</span></div></div></div>"
      },
      {
        "label": "Sessions vs your events",
        "stage": "Reading it",
        "line": "Solid colour-filled chips are bookable sessions pulled from your listings, while your own dashed pinned events sit right alongside them — tap a day number to drop into its run-sheet.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Summer Multi-Sports Camp</b> <span class=\"g\">18 / 24 booked · 75%</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>📌 Staff INSET day</b> <span class=\"g\">your event</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>📌 August Bank Holiday</b> <span class=\"g\">Closure</span></div></div><div class=\"hint\">Solid = session (edit in Listings). Dashed 📌 = event you added here.</div></div>"
      },
      {
        "label": "Add or edit an event",
        "stage": "Adding events",
        "line": "The only thing you write on this page — pop in a title, date and time, pick a colour-coded category and set a reminder if you'd like a nudge; the same box edits or deletes it later.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">TITLE</div><div class=\"field\">Parent info evening</div><div class=\"row2\"><div><div class=\"fl\">DATE</div><div class=\"field\">Thu 10 Sep 2026</div></div><div><div class=\"fl\">TIME</div><div class=\"field\">18:30 – 19:30</div></div></div><div class=\"chips\"><span class=\"ochip\">🟣 Open day</span> <span class=\"chip2\">＋ New category</span></div><div class=\"chk\"><span class=\"chkbx\">✓</span>Reminder on · 60 min before</div><div class=\"hint\">Tick All-day, or add an optional End date for a multi-day event · Delete removes it.</div></div>"
      },
      {
        "label": "Legend & filters",
        "stage": "Tidying the view",
        "line": "When several clubs are running at once, tap the toggles or dim a listing in the legend to isolate one club or hide the booking counts — and Full month opens every day cell right out on a busy Month grid.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">Booking info</span> <span class=\"ochip\">My events</span> <span class=\"ochip\">Full month</span> <span class=\"chip2\">All listings</span></div><div class=\"hint\">Legend — tap a listing to hide its sessions</div><div class=\"chips\"><span class=\"ochip\">Summer Multi-Sports Camp</span> <span class=\"ochip\">Little Kickers Football Club</span> <span class=\"chip2\">Holiday Art &amp; Craft Camp (hidden)</span></div></div>"
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
    "doneLine": "And that's your camp sorted — a full timetable built, refined, shared and saved, all from the one page.",
    "steps": [
      {
        "label": "Dates",
        "stage": "Setup",
        "line": "Kick things off by pulling in your listing and ticking which dates the camp actually runs — everything downstream is built from what you choose here.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">LISTING</div><div class=\"field\">Loughton Multi-Activity Camp</div><div class=\"row2\"><div><div class=\"fl\">FROM</div><div class=\"field\">28 Jul</div></div><div><div class=\"fl\">TO</div><div class=\"field\">22 Aug</div></div></div><div class=\"hint\">28 Jul – 22 Aug · 09:00–15:30 · Loughton Manor First School · 20 days</div><div class=\"chips\"><span class=\"ochip\">✕ Fri 21 Aug excluded</span><span class=\"chip2\">19 of 20 days included</span></div></div>"
      },
      {
        "label": "The day & arrivals",
        "stage": "Setup",
        "line": "Set the shape of the day just once — start and end times, breaks, lunch and your sign-in slots — and they become the fixed banner rows on every grid.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">DAY START</div><div class=\"field\">09:00</div></div><div><div class=\"fl\">DAY END</div><div class=\"field\">15:30</div></div></div><div class=\"row2\"><div><div class=\"fl\">LUNCH</div><div class=\"field\">12:00</div></div><div><div class=\"fl\">BREAKS / DAY</div><div class=\"field\">2</div></div></div><div class=\"fl\">WHOLE-CAMP · SIGN-IN · SIGN-OUT</div><div class=\"chips\"><span class=\"ochip\">🎪 14:30</span><span class=\"ochip\">➡️ 08:00</span><span class=\"ochip\">➡️ 09:00</span><span class=\"ochip\">⬅️ 15:30</span><span class=\"ochip\">⬅️ 17:30</span></div></div>"
      },
      {
        "label": "Groups & spaces",
        "stage": "Setup",
        "line": "Add your groups, switch on the spaces you've actually got this week and pick which activity categories go into the rotation.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">FACILITIES</div><div class=\"chips\"><span class=\"ochip\">🏟️ Sports Hall</span><span class=\"ochip\">🌳 Field</span><span class=\"ochip\">🛝 Playground</span><span class=\"ochip\">📚 Classroom</span><span class=\"ochip\">🎭 Studio</span><span class=\"ochip\">🏊 Pool</span></div><div class=\"fl\">GROUPS</div><div class=\"chips\"><span class=\"ochip\">🔴 Reds (5–7)</span><span class=\"ochip\">🔵 Blues (8–10)</span><span class=\"ochip\">🟢 Greens (11–13)</span></div><div class=\"chips\"><span class=\"ochip\">⚽ Sports</span><span class=\"ochip\">🎨 Arts</span><span class=\"ochip\">🧗 Extreme</span><span class=\"ochip\">🧩 Others</span></div></div>"
      },
      {
        "label": "Activity bank",
        "stage": "Activities",
        "line": "Toggle activities on or off, say where each one runs and hide any that aren't right for a group — only the 'On' ones get rotated into the grid.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">SPORTS · 13/13 ON</div><div class=\"tkt\"><div class=\"tkhd\"><b>Football</b> <span class=\"g\">@ Field · all groups</span><span class=\"tkp\">On</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Multi-Sports</b> <span class=\"g\">@ Sports Hall · all groups</span><span class=\"tkp\">On</span></div></div><div class=\"fl\">EXTREME · 11/11 ON</div><div class=\"tkt\"><div class=\"tkhd\"><b>Archery</b> <span class=\"g\">@ Field · excl. Reds</span><span class=\"tkp\">On</span></div></div><div class=\"chips\"><span class=\"ochip\">＋ Bubble Football</span></div></div>"
      },
      {
        "label": "Build the grid",
        "stage": "Build",
        "line": "Let it auto-fill for variety or start from a blank template, then just drag blocks to swap them and click any cell to tweak it.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">⚙️ Automatic</span><span class=\"ochip\">✏️ Manual</span></div><div class=\"fl\">MON 28 JUL · DAY VIEW</div><div class=\"tkt\"><div class=\"tkhd\"><b>09:00</b> <span class=\"g\">Sign-in banner</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>10:00</b> <span class=\"g\">Reds Football · Blues Basketball · Greens Archery</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>14:30</b> <span class=\"g\">Water Day · all groups</span></div></div></div>"
      },
      {
        "label": "Publish",
        "stage": "Publish",
        "line": "Nothing goes live until you publish — flick it out to staff and parents, choose whether everyone or just booked families gets to see it, and tick whether to email them or ping their in-app bell that the week's ready.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chk\"><span class=\"chkbx\">✓</span>Publish to the Staff portal</div><div class=\"chk\"><span class=\"chkbx\">✓</span>Share with Parents</div><div class=\"fl\">PARENT AUDIENCE</div><div class=\"chips\"><span class=\"ochip\">✓ Booked families only</span><span class=\"ochip\">Everyone viewing the listing</span></div><div class=\"fl\">NOTIFY FAMILIES</div><div class=\"chips\"><span class=\"ochip\">✉️ Email</span><span class=\"ochip\">🔔 In-app notification</span></div><span class=\"btn amber\">Publish timetable</span><div class=\"hint\">Published to staff + parents · 19 days</div></div>"
      },
      {
        "label": "My timetables",
        "stage": "Saved",
        "line": "Every week you build auto-saves under My timetables at the top, tagged draft or published — reopen a past week to duplicate and re-publish it, download it, or clear it out, so next season you're never starting from a blank page.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">MY TIMETABLES</div><div class=\"tkt\"><div class=\"tkhd\"><b>Loughton Multi-Activity Camp</b> <span class=\"g\">28 Jul to 22 Aug · 19 days</span><span class=\"tkp\">Shared with parents</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>February Half-Term Camp</b> <span class=\"g\">16 to 20 Feb · 5 days</span><span class=\"tkp\">Draft</span></div></div><div class=\"chips\"><span class=\"ochip\">Open</span><span class=\"ochip\">↓ Download</span><span class=\"ochip\">Delete</span></div></div>"
      }
    ]
  },
  "registers": {
    "title": "Registers",
    "introLine": "This is your daily register — where you sign the children in and out, keep an eye on every allergy and medical flag, count heads for safety, and reach any parent in a tap, all for one camp on one day.",
    "doneLine": "And that's the register sorted — everyone signed in, counted, safeguarded, and their parents just a tap away.",
    "steps": [
      {
        "label": "Pick listing & day",
        "stage": "Get set up",
        "line": "Start by choosing the season, the camp and the day, so the whole register is pointed at the right group before you mark a soul present — and if a collection PIN is switched on, you'll see the reminder to check it at pick-up.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">📅 Summer Holidays 2026</span><span class=\"ochip\">🎟 Multi-Activity Camp</span><span class=\"ochip\">‹ Today · Tue 9 Jun ›</span></div><div class=\"hint\">📍 Loughton Manor</div><div class=\"chips\"><span class=\"chip2\">EXPECTED 10</span><span class=\"chip2\">PRESENT 70% signed in</span><span class=\"chip2\">NOT ARRIVED 1</span><span class=\"chip2\">ABSENT / ILL 1</span></div><div class=\"hint\">🔒 Collection PIN required — check the family's 4-digit PIN before releasing a child.</div></div>"
      },
      {
        "label": "Take the register",
        "stage": "Attendance",
        "line": "This is the heart of it — three toggles on every row for In, Collect or Absent, with allergy and medical flags right there so nothing gets missed. Tick several at once to mark them together or Sign all in with one tap, and every row has one-tap links to log first aid, an incident, medication or a moment for that child, or contact their parent.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">Sort · youngest first</span><span class=\"ochip\">Earliest start</span><span class=\"ochip\">🔎 Search</span></div><div class=\"chips\"><span class=\"chip2\">Allergy 2</span><span class=\"chip2\">Medical 3</span><span class=\"chip2\">Dietary 1</span><span class=\"chip2\">SEND 1</span></div><div class=\"chips\"><span class=\"ochip\">☑ Select all</span><span class=\"btn amber\">✓ Sign all in (3)</span><span class=\"ochip\">Mark: In · Collect · Absent</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Jack Jones · view ›</b> <span class=\"g\">Age 8 · 8am–5pm · 🔑 Bluebird</span></div><span class=\"chip2\">ALLERGY · Peanuts</span> <span class=\"chip2\">MEDICAL · Asthma</span> <span class=\"btn amber\">In</span> <span class=\"btn\">Collect</span> <span class=\"btn\">Absent</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Sofia Reyes · view ›</b> <span class=\"g\">Age 7 · 9am–3pm · 🔑 Sparrow</span></div><span class=\"chip2\">MEDICAL · Diabetes</span> <span class=\"btn\">✓ In · 08:47</span> <span class=\"btn\">Collect</span></div><div class=\"chips\"><span class=\"ochip\">First aid</span><span class=\"ochip\">Incident</span><span class=\"ochip\">Medication</span><span class=\"ochip\">Add moment</span><span class=\"ochip\">Email parent</span></div></div>"
      },
      {
        "label": "Head count",
        "stage": "Safety check",
        "line": "On trips and free-play you'll physically count heads on top of the register — pop the number in and the running tally flags if you're short, with a note of who counted and when. And one tap opens Roll call: everyone signed in right now, to count heads against in a fire drill.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">HEADS COUNTED</div><div class=\"field\">7</div><div class=\"hint\">expected 10 · 2 head counts logged today · Register taken by Priya Shah</div><div class=\"tkt\"><div class=\"tkhd\"><b>7/10 ⚠ 3 short</b> <span class=\"g\">by Priya Shah at 10:30</span></div></div><span class=\"btn amber\">Log head count</span><div class=\"tkt\"><div class=\"tkhd\"><b>🚨 Roll call</b> <span class=\"g\">7 on site now — count heads against this list</span></div></div></div>"
      },
      {
        "label": "Child profile",
        "stage": "Attendance",
        "line": "Tap any child to open their full profile — medical and learning needs, collection password and emergency contact all in one place, without ever leaving the register.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">NOAH SMITH · AGE 10 (03/07/2015)</div><div class=\"hint\">8am–5pm</div><div class=\"fl\">SEND / NEEDS</div><div class=\"field\">ADHD — benefits from structure</div><div class=\"row2\"><div><div class=\"fl\">EMERGENCY CONTACT</div><div class=\"field\">Beth Smith · +44 7700 900633</div></div><div><div class=\"fl\">PASSWORD</div><div class=\"field\">🔑 Falcon</div></div></div></div>"
      },
      {
        "label": "Download register",
        "stage": "Records",
        "line": "Need a printed sheet for a trip or a spreadsheet for your records? Tick exactly which columns to include — grouped so you can leave out the sensitive bits — and grab it as a PDF or CSV.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">DOWNLOAD REGISTER — TODAY</div><div class=\"hint\">The child's name is always included.</div><div class=\"chips\"><span class=\"ochip\">Age</span><span class=\"ochip\">Timing</span><span class=\"ochip\">Allergies</span><span class=\"ochip\">Medical</span><span class=\"ochip\">Emergency contact</span><span class=\"ochip\">Collection password ⚠</span></div><span class=\"btn amber\">🖨 PDF (printable)</span> <span class=\"btn\">⭳ CSV (spreadsheet)</span></div>"
      },
      {
        "label": "Message parents",
        "stage": "Communicate",
        "line": "Message the whole day's group or a single parent — it opens the Messages composer with everyone already filled in, a parent's messaged just once even with two children, and each row can email or WhatsApp that family too.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">TO</div><div class=\"field\">All attending Today · Multi-Activity Camp — 12 children (10 families)</div><span class=\"btn amber\">✉️ Message all attending (12)</span> <span class=\"btn\">Email parent</span> <span class=\"btn\">WhatsApp</span><div class=\"hint\">Opens the Messages composer with parents already filled in — a parent's messaged once even with two children.</div></div>"
      }
    ]
  },
  "ratios": {
    "title": "Ratios & groups",
    "introLine": "This is your live cover board — it sorts the day's booked children into age groups from your registers and checks each one against your own ratio targets, so you can tell at a glance whether every group's properly staffed.",
    "doneLine": "Scope the board, follow your policy and work the cards, and you'll spot a short group long before the session ever runs.",
    "steps": [
      {
        "label": "Day, listing & the three hero tiles",
        "stage": "Scope & read",
        "line": "Start by picking the season, the camp and the day with the arrows or date picker — then the three hero tiles give you the headline: how many children are in, whether they're covered, and how many groups are running.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">SEASON</div><div class=\"field\">📅 Summer Holidays 2026</div></div><div><div class=\"fl\">LISTING</div><div class=\"field\">🎟 Summer Multi-Sports Camp · 34 kids</div></div></div><div><div class=\"fl\">DAY</div><div class=\"field\">‹ 📅 Today · Wed 5 Aug ›</div></div><div class=\"chips\"><span class=\"ochip\">Whole day 34</span><span class=\"ochip\">9am–3pm 26</span><span class=\"ochip\">8am–5:30pm 8</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Children on site</b> <span class=\"g\">across 2 groups · 3 SEND</span><span class=\"tkp\">34</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Staff on duty</b> <span class=\"g\">5 needed · 1 short</span><span class=\"tkp\">4</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Groups today</b> <span class=\"g\">every child placed by age</span><span class=\"tkp\">2</span></div></div></div>"
      },
      {
        "label": "Your ratio policy",
        "stage": "Policy",
        "line": "Here for reference only — these colours, age bands and targets are your own policy (activity camps aren't bound by statutory ratios), and they can only be edited over in Setup, where every board reads from the one master record.",
        "bodyHtml": "<div class=\"frm\"><div class=\"hint\">Your ratio policy — set in Setup → Age groups & rooms; shown here for reference.</div><div class=\"tkt\"><div class=\"tkhd\"><b>🔴 Cubs</b> <span class=\"g\">5–7 yrs · room size 24</span><span class=\"tkp\">1:8</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>🔵 Explorers</b> <span class=\"g\">8–11 yrs · no cap</span><span class=\"tkp\">1:12</span></div></div><div class=\"hint\">Change them in Setup and every board and listing updates at once.</div></div>"
      },
      {
        "label": "Your team & the Cover board",
        "stage": "Live board",
        "line": "This is the daily workspace — build your team up top, then assign each person to a group from the Assign to group dropdown in the roster down the side. Drag a child between the coloured cards to regroup them for the day, and each card shows whether that age band is in ratio, with a red banner flagging any group that's short — and flip to By time to re-check cover for each arrival and pickup window instead of by age.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">By age group</span><span class=\"ochip\">By time</span></div><div class=\"chips\"><span class=\"ochip\">Ellie Hartman · Camp Lead · you</span><span class=\"ochip\">Marcus Bright · Coach</span><span class=\"ochip\">Priya Shah · Coach</span><span class=\"ochip\">Tom Reyes · Assistant</span></div><div><div class=\"fl\">MARCUS BRIGHT · COACH</div><div class=\"field ph\">＋ Assign to group…</div></div><div class=\"tkt\"><div class=\"tkhd\"><b>🔴 Cubs · Target 1:8</b> <span class=\"g\">12 children · 2 of 2 needed</span><span class=\"tkp\">🙂 In ratio</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>🔵 Explorers · Target 1:12</b> <span class=\"g\">22 children · 2 of 3 needed</span><span class=\"tkp\">😟 1 staff short</span></div></div><div class=\"hint\">NEEDS 1 MORE STAFF ON THIS DAY — drag a child between cards to regroup.</div></div>"
      },
      {
        "label": "Staffing ratio calculator",
        "stage": "Planning",
        "line": "A handy planning aid off to one side — drop in today's numbers (or a hypothetical mix) and it totals the staff you'd need, blending statutory EYFS bands for the little ones with your own school-age targets.",
        "bodyHtml": "<div class=\"frm\"><span class=\"btn\">🧮 Drop in today (34)</span><div class=\"fl\">EARLY YEARS — STATUTORY EYFS</div><div class=\"row2\"><div><div class=\"fl\">UNDER 2s · 1:3</div><div class=\"field\">0</div></div><div><div class=\"fl\">3 TO 5 YRS · 1:8</div><div class=\"field\">0</div></div></div><div class=\"fl\">SCHOOL AGE — YOUR TARGETS</div><div class=\"row2\"><div><div class=\"fl\">CUBS (5–7 YRS)</div><div class=\"field\">12</div></div><div><div class=\"fl\">EXPLORERS (8–11 YRS)</div><div class=\"field\">22</div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Total children</b> <span class=\"g\">Cubs 12÷8=2 · Explorers 22÷12=2</span><span class=\"tkp\">34</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Total staff needed</b> <span class=\"g\">EYFS statutory · school-age your policy</span><span class=\"tkp\">4</span></div></div></div>"
      }
    ]
  },
  "incidents": {
    "title": "Log concern",
    "introLine": "This is your one place for recording concerns about a child — everyday behaviour notes you can share with the parent, and confidential safeguarding matters that go straight to your DSL.",
    "doneLine": "Behaviour on one side, safeguarding on the other, and every concern kept safely on the child's record.",
    "steps": [
      {
        "label": "Two tabs, one title bar",
        "stage": "Overview",
        "line": "Your first choice is simply which kind of concern this is — a routine behaviour note the parent can see, or a confidential safeguarding matter that's routed to your DSL.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">⚑ LOG A CONCERN</div><div class=\"chips\"><span class=\"ochip\">🧩 Behaviour</span><span class=\"ochip\">🛡️ Safeguarding</span></div><div class=\"hint\">Behaviour &amp; near-misses — share with the parent when you choose. Accidents and first aid live in the separate First aid area.</div></div>"
      },
      {
        "label": "Behaviour tiles & Log button",
        "stage": "Behaviour",
        "line": "The stat tiles give you an at-a-glance feel for how many concerns are on the go and whether parents have been told, before you open a fresh record.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">THIS MONTH</div><div class=\"field\">3</div></div><div><div class=\"fl\">SERIOUS</div><div class=\"field\">1</div></div></div><div class=\"row2\"><div><div class=\"fl\">PARENT INFORMED</div><div class=\"field\">4</div></div><div><div class=\"fl\">TOTAL</div><div class=\"field\">9</div></div></div><span class=\"btn amber\">＋ Log a behaviour concern</span></div>"
      },
      {
        "label": "Log a behaviour concern",
        "stage": "Behaviour",
        "line": "This is the heart of the page — a three-step wizard: who and when, what happened, then how serious it is and who gets to see it. You can only log against a child who has a booking, so the record links to their account.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">CHILD (BOOKED)</div><div class=\"field\">Freya Whitmore</div></div><div><div class=\"fl\">WHEN</div><div class=\"field\">Tue 5 Aug · 14:20</div></div></div><div class=\"fl\">WHAT HAPPENED</div><div class=\"field\">Pushed another child off the bench during free play; calmed down after a chat.</div><div class=\"hint\">⚠️ You can only log against a child who has a booking — that's how it links to their account.</div><div class=\"chips\"><span class=\"ochip\">Minor</span><span class=\"ochip\">Moderate</span><span class=\"ochip\">Serious</span></div><div class=\"chips\"><span class=\"ochip\">📤 Share with parent</span><span class=\"ochip\">🔒 Keep internal</span></div></div>"
      },
      {
        "label": "Per-child records & messages",
        "stage": "Behaviour",
        "line": "Records gather under each child, with filters and search up top and colour-coded badges at a glance. Open the two-way thread to read the parent's reply — and when you edit, you choose whether to alert the parent or just update their profile quietly, always leaving an Updated stamp.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">All</span><span class=\"ochip\">Minor</span><span class=\"ochip\">Moderate</span><span class=\"ochip\">Serious</span><span class=\"ochip\">✓ Acknowledged</span></div><div class=\"fl\">👤 FREYA WHITMORE · 2 RECORDS</div><div class=\"tkt\"><div class=\"tkhd\"><b>Pushed another child off the bench</b> <span class=\"g\">5 Aug</span></div></div><div class=\"chips\"><span class=\"chip2\">Moderate</span><span class=\"chip2\">📤 Shared</span><span class=\"chip2\">💬 Parent replied</span><span class=\"chip2\">✏️ Updated</span></div><div class=\"hint\">Parent: \"Thanks for letting me know — we've talked to her at home.\"</div><div class=\"chips\"><span class=\"ochip\">🔔 Alert the parent</span><span class=\"ochip\">🙈 Just update their profile</span></div><span class=\"btn\">💬 Details &amp; messages (1)</span></div>"
      },
      {
        "label": "Safeguarding concern form",
        "stage": "Safeguarding",
        "line": "Safeguarding is a different, facts-only shape — pick a category and both the risk level and a what-to-do-now protocol fill in for you, and you can even pin an injury on the body map.",
        "bodyHtml": "<div class=\"frm\"><div class=\"hint\">🛡️ You are the safeguarding lead — confidential, facts only. Set your LADO, social-care contacts and categories in Setup → Safeguarding.</div><div class=\"chips\"><span class=\"ochip\">🧒 A child</span><span class=\"ochip\">🧑‍🏫 A member of staff</span></div><div class=\"fl\">CATEGORY (KCSIE)</div><div class=\"field\">Child-on-child abuse (bullying, harassment)</div><div class=\"tkt\"><div class=\"tkhd\"><b>What to do now</b> <span class=\"g\">Same day · tell your DSL · KCSIE</span></div><div class=\"g\">Log the facts, inform your DSL, and consider a referral to children's social care.</div></div><div class=\"chips\"><span class=\"chip2\">Risk: Medium</span><span class=\"chip2\">Oliver Branson</span><span class=\"chip2\">📍 Body map: 1 pin</span></div></div>"
      },
      {
        "label": "DSL action log & PDF",
        "stage": "Safeguarding",
        "line": "For safeguarding the record is only half the job — behind Review and action the DSL logs what they did with timestamps and review dates, with your LADO and referral contacts to hand, then exports the full child dossier as a confidential PDF.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"chip2\">Medium risk</span><span class=\"chip2\">⏳ Awaiting DSL</span><span class=\"chip2\">🗓 2 actions by 8 Aug</span></div><div class=\"chk\"><span class=\"chkbx\">✓</span>Spoke to the child — 5 Aug 15:10</div><div class=\"chk\"><span class=\"chkbx\">✓</span>Referred to children's social care — review by 8 Aug</div><div class=\"hint\">📞 LADO, children's social care and MASH contacts sit here with the KCSIE 2026 link.</div><span class=\"btn amber\">🛡️ Review &amp; action (DSL)</span><span class=\"btn\">⬇ Download PDF…</span></div>"
      }
    ]
  },
  "accidents": {
    "title": "First aid",
    "introLine": "This is your first aid log — record every bump and graze on the day, note the first aid you gave, and the parent is told automatically with a timestamp.",
    "doneLine": "And that's the whole loop — logged on the day, the parent told and able to acknowledge, with a tidy record kept behind every one.",
    "steps": [
      {
        "label": "KPI stat row",
        "stage": "Overview",
        "line": "Your safety pulse at a glance — how many first aid records this month, how many were serious, how many parents you've told, and the running total.",
        "bodyHtml": "<div class=\"frm\"><div class=\"field\"><b>⛑️ First aid</b> — every bump and graze, logged on the day and sent to the parent</div><div class=\"row2\"><div><div class=\"fl\">THIS MONTH</div><div class=\"field\">3</div></div><div><div class=\"fl\">SERIOUS</div><div class=\"field\">1</div></div></div><div class=\"row2\"><div><div class=\"fl\">PARENT INFORMED</div><div class=\"field\">3</div></div><div><div class=\"fl\">TOTAL</div><div class=\"field\">12</div></div></div></div>"
      },
      {
        "label": "Log a first aid record",
        "stage": "Log",
        "line": "The heart of the page — a quick three-step form: who and when, what happened plus the first aid you gave, then how serious it was and whether you've told the parent. You can only log against a child who's booked.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">CHILD (BOOKED)</div><div class=\"field\">Freya Middleton</div></div><div><div class=\"fl\">WHERE DID IT HAPPEN?</div><div class=\"field\">The main hall</div></div></div><div class=\"hint\">You can only log against a child who's booked — that's how it reaches the parent.</div><div class=\"fl\">INJURY / BODY PART</div><div class=\"field\">Grazed knee</div><div class=\"fl\">FIRST AID GIVEN — TICK ALL THAT APPLY</div><div class=\"chips\"><span class=\"ochip\">Cleaned with water</span><span class=\"ochip\">Plaster applied</span><span class=\"ochip\">Cold compress</span></div><div class=\"fl\">HOW SERIOUS?</div><div class=\"chips\"><span class=\"ochip\">Minor</span><span class=\"ochip\">Moderate</span><span class=\"ochip\">Serious</span></div><div class=\"chk\"><span class=\"chkbx\">✓</span>I've also told the parent in person / by phone</div><span class=\"btn amber\">Save record</span></div>"
      },
      {
        "label": "Find a record",
        "stage": "Filter",
        "line": "Above the list sits a filter bar — jump to just the serious ones, search by child or detail, narrow by injury or date, or show only the ones a parent hasn't acknowledged yet.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">All</span><span class=\"ochip\">Minor</span><span class=\"ochip\">Moderate</span><span class=\"ochip\">Serious</span></div><div class=\"field ph\">Search child or details…</div><div class=\"row2\"><div><div class=\"fl\">INJURY</div><div class=\"field\">Grazed knee</div></div><div><div class=\"fl\">DATE</div><div class=\"field\">9 Aug 2026</div></div></div><div class=\"chips\"><span class=\"ochip\">Any</span><span class=\"ochip\">✓ Acknowledged</span><span class=\"ochip\">Awaiting</span></div></div>"
      },
      {
        "label": "First aid records",
        "stage": "The list",
        "line": "Every record sits under the child it's about, newest first, with a colour for how serious it was and badges telling you at a glance who's been told, who's acknowledged and what's been edited.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">👤 FREYA MIDDLETON · 2 RECORDS</div><div class=\"tkt\"><div class=\"tkhd\"><b>Grazed knee</b> <span class=\"g\">9 Aug · 14:35 · told ✓</span><span class=\"tkp\"><span class=\"chip2\">Minor</span></span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Bump to the head</b> <span class=\"g\">2 Aug · 11:05 · Acknowledged ✓</span><span class=\"tkp\"><span class=\"chip2\">Moderate</span></span></div></div></div>"
      },
      {
        "label": "Expanded record",
        "stage": "Details",
        "line": "Tap any record to open it out — the full details, whether the parent's seen and acknowledged it, and a two-way message thread so you and the parent can talk it through right there. When you edit a record you choose whether to alert the parent again or just quietly update their profile — either way it's stamped Updated.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">WHERE</div><div class=\"field\">The main hall</div></div><div><div class=\"fl\">FIRST AID BY</div><div class=\"field\">Liberty Young</div></div></div><div class=\"fl\">FIRST AID GIVEN</div><div class=\"field\">Cleaned with water and covered with a plaster</div><div class=\"chk\"><span class=\"chkbx\">✓</span>Parent acknowledged · 9 Aug 6:40pm</div><div class=\"tkt\"><div class=\"tkhd\"><b>💬 Messages</b> <span class=\"g\">You: 'All fine by home time' → Parent: 'Thank you!'</span></div></div><div class=\"row2\"><div><span class=\"btn\">💬 Details &amp; messages</span></div><div><span class=\"btn amber\">Edit</span></div></div></div>"
      }
    ]
  },
  "medication": {
    "title": "Medication",
    "introLine": "This is where you keep children's medicine safe and above board — a card for each child's medicine, the parent's written consent, and every dose given, all in one place.",
    "doneLine": "That's the full loop — consent captured, every dose logged with who gave it, and the parent kept in the picture, all kept safe for safeguarding.",
    "steps": [
      {
        "label": "Overview",
        "stage": "Orientation",
        "line": "Four tiles give the day's safety picture — how many medicines are on file, how many have consent, how many still need it, and doses given today. Below that you filter Active or Archived and search by child or medicine.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div class=\"tkt\"><div class=\"tkhd\"><b>On file</b><span class=\"tkp\">6</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>With consent</b><span class=\"tkp\">5</span></div></div></div><div class=\"row2\"><div class=\"tkt\"><div class=\"tkhd\"><b>Needs consent</b><span class=\"tkp\">1</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Doses today</b><span class=\"tkp\">3</span></div></div></div><div class=\"chips\"><span class=\"ochip\">Active 6</span><span class=\"ochip\">Archived 2</span><span class=\"field ph\">Search child or medicine…</span></div><div class=\"hint\">One card per child's medicine. Records stay visible for safeguarding even when notifications are off.</div></div>"
      },
      {
        "label": "Give a dose",
        "stage": "Point of care",
        "line": "On any medicine with consent, tap Yes or No to log a dose against today and now — the parent is told automatically. Need to back-date or add a note? Open 'with time and notes' for the full form.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Ava Okafor</b> <span class=\"g\">Ventolin · one puff</span><span class=\"chip2\">consent on file</span></div><div class=\"g\">🔁 On every booked day · at 12:30</div><div class=\"g\">📋 How to give: shake well; one puff, use spacer if needed</div></div><div class=\"chips\"><span class=\"g\">Given?</span><span class=\"ochip\">✓ Yes</span><span class=\"ochip\">✕ No</span><span class=\"btn ghost\">＋ with time / notes</span></div><div class=\"row2\"><div><div class=\"fl\">DOSE</div><div class=\"field\">one puff</div></div><div><div class=\"fl\">WITNESSED BY</div><div class=\"field ph\">optional</div></div></div><div class=\"hint\">Tapping Yes logs it against today and now, and informs the parent. No consent means no dose can be recorded.</div></div>"
      },
      {
        "label": "Add a medication",
        "stage": "New record",
        "line": "New medicine? The '＋ Administer a medication' button opens a three-step form — the medicine and dose, when staff should give it, then ticking that the parent has given written consent. The child must already have a booking so it links to their account.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">1 Medicine</span><span class=\"ochip\">2 When &amp; how</span><span class=\"ochip\">3 Consent</span></div><div class=\"row2\"><div><div class=\"fl\">CHILD (BOOKED)</div><div class=\"field\">Ava Okafor</div></div><div><div class=\"fl\">MEDICINE</div><div class=\"field\">Ventolin</div></div></div><div class=\"row2\"><div><div class=\"fl\">DOSE</div><div class=\"field\">one puff</div></div><div><div class=\"fl\">FOR (CONDITION)</div><div class=\"field\">asthma</div></div></div><div class=\"chips\"><span class=\"ochip\">📋 On every booked day</span><span class=\"ochip\">📅 Only on the days I pick</span><span class=\"ochip\">🩹 Only when needed</span></div><div class=\"chk\"><span class=\"chkbx\">✓</span>The parent / carer has given written consent to administer this</div></div>"
      },
      {
        "label": "Dose history",
        "stage": "Records",
        "line": "Every card keeps its own dose history — tap 'History' to see each dose with who gave it, when, any witness and notes, plus who gave consent and where the medicine is stored.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">HISTORY (2)</div><div class=\"tkt\"><div class=\"tkhd\"><span class=\"chip2\">✓ Given</span><b>15 Aug 2026 · 12:32</b> <span class=\"g\">one puff</span></div><div class=\"g\">by Liberty Young · witnessed Tom Reade · no reaction</div></div><div class=\"tkt\"><div class=\"tkhd\"><span class=\"chip2\">✕ Not given</span><b>14 Aug 2026 · 12:30</b> <span class=\"g\">Not given</span></div><div class=\"g\">by Liberty Young</div></div><div class=\"hint\">Consent by Sarah Okafor. Stored: locked office cabinet. Expires 03/2027.</div></div>"
      },
      {
        "label": "Safety & archive",
        "stage": "Guardrails",
        "line": "A few guardrails keep it safe — no consent, or a parent who has withdrawn it, blocks dosing; expired medicines are flagged; and in Setup you can require a witness on every dose or limit recording to leads. Managers can archive a finished medicine — the record is kept, never deleted.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Noah Bennett</b> <span class=\"g\">Piriton · 5ml</span><span class=\"chip2\">no consent</span></div><div class=\"g\">Consent needed before a dose can be recorded</div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Mia Patel</b> <span class=\"g\">Calpol · 5ml</span><span class=\"chip2\">⚠️ Expired</span></div><div class=\"g\">📝 Parent note: only if temperature is over 38</div></div><div class=\"chips\"><span class=\"ochip\">History (4)</span><span class=\"btn\">Archive</span></div><div class=\"hint\">Turn on 'require a witness' or 'leads only' in Setup. Archived medicines can be restored — nothing is ever erased.</div></div>"
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
        "line": "Pick a listing and its children come through automatically, choose whether it's a child photo or their work, tag an activity and jot down what happened — or tap Write for me to draft the caption for you.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">LISTING (TODAY)</div><div class=\"field\">Multi-Activity Camp — Mon 9 Aug</div><div class=\"hint\">Children are pulled from the bookings on this listing — same register as the Registers area.</div><div class=\"fl\">WHICH CHILDREN?</div><div class=\"chips\"><span class=\"ochip\">Ava · consent ✓</span><span class=\"ochip\">Noah · no photos</span><span class=\"ochip\">Mia · consent ✓</span></div><div class=\"fl\">PHOTO</div><div class=\"chips\"><span class=\"ochip\">📷 Child photo</span><span class=\"ochip\">🎨 Their work</span></div><div class=\"fl\">ACTIVITY</div><div class=\"chips\"><span class=\"ochip\">🎨 Arts &amp; crafts</span><span class=\"ochip\">⚽ Sports</span><span class=\"ochip\">🍎 Lunch &amp; snack</span></div><div class=\"field\">Ava and Mia built a junk-model rocket and counted down the launch together.</div><div class=\"chips\"><span class=\"ochip\">✨ Write for me</span></div><span class=\"btn amber\">Post moment 🚀</span></div>"
      },
      {
        "label": "Photo consent gate",
        "stage": "Safeguarding",
        "line": "If a selected child hasn't got photo consent the app blocks the photo for you — so nobody's caught out — while a text-only update still posts fine.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">PHOTO</div><div class=\"tkt\"><div class=\"tkhd\"><b>⚠ Noah doesn't have photo consent</b> <span class=\"g\">remove Noah or post without a photo</span></div></div><div class=\"hint\">Text-only updates for Noah still post fine.</div><div class=\"fl\">WITH AVA &amp; MIA SELECTED</div><div class=\"tkt\"><div class=\"tkhd\"><b>🌈 Painted rainbow</b> <span class=\"g\">tagged</span><span class=\"tkp\">Child's work</span></div></div></div>"
      },
      {
        "label": "Share & download",
        "stage": "Share the photo",
        "line": "Every photo has a download button — pick a shape, drop the caption or a starred parent quote into a neat banner underneath, then download it or save it into your Email marketing area for a campaign.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">FORMAT</div><div class=\"chips\"><span class=\"ochip\">Square 1:1</span><span class=\"ochip\">Portrait 4:5</span><span class=\"ochip\">Story 9:16</span></div><div class=\"fl\">ADD A BANNER WITH…</div><div class=\"chips\"><span class=\"ochip\">✓ Caption</span><span class=\"ochip\">★ Starred quote</span><span class=\"ochip\">All comments</span></div><div class=\"chips\"><span class=\"btn\">Photo only</span><span class=\"btn amber\">⬇ Download with banner</span></div><div class=\"hint\">Or save it straight into the Email marketing area to reuse in a campaign.</div></div>"
      },
      {
        "label": "Photo gallery",
        "stage": "Media library",
        "line": "Every photo and piece of work files itself in here automatically, ready to filter by child, by listing or by date whenever you need it — and from here managers can push photos into the Email marketing area, automatically if they like.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">🖼️ PHOTO GALLERY</div><div class=\"hint\">Every photo &amp; piece of work lands here automatically.</div><div class=\"chips\"><span class=\"ochip\">All</span><span class=\"ochip\">By child</span><span class=\"ochip\">By listing</span></div><div class=\"chips\"><span class=\"ochip\">All dates</span><span class=\"ochip\">Today</span><span class=\"ochip\">This week</span></div><div class=\"fl\">EMAIL MARKETING AREA</div><div class=\"chips\"><span class=\"btn amber\">✉ Move all photos (3)</span><span class=\"ochip\">✓ Auto-add new photos</span></div></div>"
      },
      {
        "label": "The live feed",
        "stage": "The record",
        "line": "This is the running story of the day, mirrored to the parents whose child is in each moment — the children, activity, time, and any comments a parent leaves back.",
        "bodyHtml": "<div class=\"frm\"><div class=\"prevcard\"><div class=\"ph\">🎨</div><div class=\"pb\"><div class=\"pt\">Ava &amp; Mia · Arts &amp; crafts · Their work</div><div class=\"pm\">Made superhero masks and wore them all afternoon!</div><div class=\"pp\">1:24pm · Liberty Young</div></div></div><div class=\"prevcard\"><div class=\"ph\">🏊</div><div class=\"pb\"><div class=\"pt\">Noah · Swimming</div><div class=\"pm\">Swam a whole width on his own for the first time!</div><div class=\"pp\">11:50am · Tom Reade</div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Priya (parent):</b> <span class=\"g\">He came home so proud — thank you!</span></div></div><span class=\"btn\">☆ Use as a marketing quote</span></div>"
      }
    ]
  },
  "documents": {
    "title": "Documents",
    "introLine": "This is your document store — one tidy place for the policies, risk assessments, insurance and certificates your setting needs, so the right paperwork is always a click away.",
    "doneLine": "And that's Documents — add a file or a link, tag it with a category, and it's saved to the shared list for your team to open any time.",
    "steps": [
      {
        "label": "The page",
        "stage": "Overview",
        "line": "Everything lives on one simple page — a running list of your paperwork, with an Add a document button top-right for anyone who can manage the setting.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div class=\"fl\">DOCUMENTS</div><span class=\"btn amber\">＋ Add a document</span></div><div class=\"hint\">Policies, risk assessments and certificates — the paperwork in one place.</div><div class=\"tkt\"><div class=\"tkhd\"><b>📄 Safeguarding Policy</b> <span class=\"g\">Policies · 2 Jun 2026</span><span class=\"tkp\">Open</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>📄 Public Liability Insurance</b> <span class=\"g\">Insurance · 14 Jan 2026</span><span class=\"tkp\">Open</span></div></div></div>"
      },
      {
        "label": "Add a document",
        "stage": "Add files",
        "line": "Managers add a document by filling four quick fields — give it a title, pick a category, then either choose a file to upload or just paste a link, with an optional note. Only company, freelancer or franchise accounts can add or delete; everyone else just reads and opens.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">TITLE</div><div class=\"field\">Autumn Half-Term Camp - Risk Assessment</div></div><div><div class=\"fl\">CATEGORY</div><div class=\"field\">Risk assessments</div></div></div><div><div class=\"fl\">FILE OR LINK</div><div class=\"chips\"><span class=\"btn\">Choose file</span><span class=\"g\">or paste a link:</span></div><div class=\"field ph\">https://…</div></div><div><div class=\"fl\">NOTES</div><div class=\"field\">Reviewed for the Oct half-term dates.</div></div><div class=\"chips\"><span class=\"btn amber\">Save</span><span class=\"btn ghost\">Cancel</span></div></div>"
      },
      {
        "label": "Categories",
        "stage": "Organise",
        "line": "When you add a file you tag it with one category, and that category shows as a badge on its row — so an inspector's request for your insurance is easy to spot at a glance.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">CATEGORY</div><div class=\"field\">Policies</div><div class=\"chips\"><span class=\"ochip\">Policies</span><span class=\"ochip\">Risk assessments</span><span class=\"ochip\">Insurance</span><span class=\"ochip\">Certificates</span><span class=\"ochip\">Procedures</span><span class=\"ochip\">Other</span></div><div class=\"hint\">These six are the only categories — pick one per document.</div></div>"
      },
      {
        "label": "The document list",
        "stage": "The library",
        "line": "The list itself — each row shows the file's category, its title as a link, the date it was added, an Open link, and a delete cross for managers.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><span class=\"chip2\">Policies</span><b>Safeguarding Policy</b> <span class=\"g\">2 Jun 2026</span><span class=\"tkp\">Open ✕</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><span class=\"chip2\">Insurance</span><b>Public Liability Certificate</b> <span class=\"g\">14 Jan 2026</span><span class=\"tkp\">Open ✕</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><span class=\"chip2\">Risk assessments</span><b>Summer Camp Risk Assessment</b> <span class=\"g\">28 May 2026</span><span class=\"tkp\">Open ✕</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><span class=\"chip2\">Certificates</span><b>Paediatric First Aid Certificate</b> <span class=\"g\">3 Mar 2026</span><span class=\"tkp\">Open ✕</span></div></div></div>"
      },
      {
        "label": "Open & manage",
        "stage": "Everyday use",
        "line": "Click a title or its Open link and the file opens in a new tab. Managers also get a delete cross, which asks you to confirm before the document is removed.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><span class=\"chip2\">Procedures</span><b>Fire Evacuation Procedure</b> <span class=\"g\">Opens in a new tab ↗</span><span class=\"tkp\">Open</span></div></div><div class=\"chk\"><span class=\"chkbx\">✓</span>Only company, freelancer and franchise roles see Add a document and the delete cross.</div><div class=\"hint\">Deleting asks 'Delete this document?' before it's removed.</div></div>"
      }
    ]
  },
  "finance": {
    "title": "Finance &amp; analytics",
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
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">💰 REVENUE COLLECTED</div><div class=\"field\">£18,420 <span class=\"g\">88% of £21,050 booked</span></div></div><div><div class=\"fl\">⏳ OWED TO YOU</div><div class=\"field\">£2,630 <span class=\"g\">unpaid / invoiced</span></div></div></div><div class=\"row2\"><div><div class=\"fl\">↩️ REFUNDS</div><div class=\"field\">£310 <span class=\"g\">last 6 months</span></div></div><div><div class=\"fl\">🏦 EST. NET TO BANK</div><div class=\"field\">£18,155 <span class=\"g\">after ~£265 fees</span></div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Summer Multi-Sports Camp</b> <span class=\"g\">top listing</span><span class=\"tkp\">£6,240</span></div></div><div class=\"hint\">Below: a booked-vs-collected trend line and a donut of where the money comes from.</div></div>"
      },
      {
        "label": "Revenue",
        "stage": "The takings",
        "line": "Revenue breaks your takings down by where the money actually comes from — card payments versus funded and voucher places — and by which programmes earn the most.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"chip2\">Overview</span><span class=\"chip2\">Revenue</span><span class=\"chip2\">Payouts</span></div><div class=\"row2\"><div><div class=\"fl\">TOTAL BOOKED</div><div class=\"field\">£21,050 <span class=\"g\">6-month value</span></div></div><div><div class=\"fl\">COLLECTED</div><div class=\"field\">£18,420 <span class=\"g\">paid & funded</span></div></div></div><div class=\"fl\">WHERE MONEY COMES FROM</div><div class=\"tkt\"><div class=\"tkhd\"><b>Card</b> <span class=\"g\">63%</span><span class=\"tkp\">£11,600</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Childcare / voucher</b> <span class=\"g\">funded places · 37%</span><span class=\"tkp\">£6,820</span></div></div><div class=\"hint\">Also broken down by listing — Summer Multi-Sports Camp leads at £6,240.</div></div>"
      },
      {
        "label": "Payouts",
        "stage": "Getting paid",
        "line": "This is where you connect or manage your Stripe payout account, with your on-the-way versus in-the-bank split — just remember the amounts are ActivityOS estimates until Stripe is fully connected.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chk\"><span class=\"chkbx\">✓</span>Payout account connected &nbsp;<span class=\"btn\">Manage payouts →</span></div><div class=\"row2\"><div><div class=\"fl\">🚚 ON THE WAY (EST.)</div><div class=\"field\">£1,240</div></div><div><div class=\"fl\">🏦 IN YOUR BANK (EST.)</div><div class=\"field\">£16,915</div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>5 Aug 2026</b> <span class=\"g\">BK-10432, BK-10433 · succeeded</span><span class=\"tkp\">£96.00</span></div></div><div class=\"hint\">Est. fees £265 · Est. net (period) £18,155 — estimates only.</div></div>"
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
    "title": "Money out — corrected guided tour (expenses)",
    "introLine": "This is your spending hub — pop in everything the business pays out, mark each one as owed or gone, and watch it all roll up into tidy monthly and yearly totals.",
    "doneLine": "Keep your spending logged and your receipts attached, and come tax time everything is sitting neat and ready for the accountant.",
    "steps": [
      {
        "label": "The headline + Cash/Accrual toggle",
        "stage": "Overview",
        "line": "Everything you spend rolls up into three big numbers up top, and the Cash-or-Accrual toggle quietly decides whether money you still owe is counted yet. Switch on Purchase Orders in Setup and a Purchase orders tab joins the page too.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>💸 Money out</b> <span class=\"g\">This month: £1,247.50 paid + £222.00 pending</span></div></div><div class=\"row2\"><div><div class=\"fl\">OUT THIS MONTH</div><div class=\"field\">£1,247.50</div></div><div><div class=\"fl\">OUT IN 2026</div><div class=\"field\">£8,930.00</div></div></div><div class=\"fl\">PENDING TO PAY</div><div class=\"field\">£222.00</div><div class=\"chips\"><span class=\"ochip\">✓ Cash · counts when paid</span><span class=\"ochip\">Accrual · counts when logged</span></div><div class=\"hint\">On Cash basis, pending spends aren't counted in the totals above until they're marked paid.</div></div>"
      },
      {
        "label": "Log an expense",
        "stage": "Logging",
        "line": "This is the heart of the page — pop in a spend, pick a category or add a fresh one with the New button right in the form, then mark it Paid or Pending. Set a regular bill to repeat and the button flips to Create series, spinning up the whole run of entries for you.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">DATE</div><div class=\"field\">5 Aug 2026</div></div><div><div class=\"fl\">CATEGORY</div><div class=\"field\">Venue hire</div></div></div><div class=\"chips\"><span class=\"g\">Not listed?</span><span class=\"ochip\">＋ New</span></div><div class=\"row2\"><div><div class=\"fl\">AMOUNT (£)</div><div class=\"field\">180.00</div></div><div><div class=\"fl\">SUPPLIER</div><div class=\"field\">Riverside Sports Hall</div></div></div><div class=\"fl\">NOTES</div><div class=\"field\">Summer Multi-Sports Camp — week 3 hire</div><div class=\"row2\"><div><div class=\"fl\">REPEAT</div><div class=\"field\">Every month</div></div><div><div class=\"fl\">REPEAT UNTIL</div><div class=\"field\">31 Dec 2026</div></div></div><div class=\"chips\"><span class=\"ochip\">✓ Paid</span><span class=\"ochip\">Pending</span><span class=\"ochip\">⬆ Upload photo</span><span class=\"ochip\">or paste a link</span></div><span class=\"btn amber\">Create series</span></div>"
      },
      {
        "label": "All expenses ledger",
        "stage": "Ledger",
        "line": "Where you'll actually graft day-to-day — this is the All tab, your full expenses ledger. Search a spend, chase what's owed, tap Mark paid to flip a bill Paid on the spot, and pull a CSV for your accountant.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">Overview</span><span class=\"ochip\">✓ All</span><span class=\"ochip\">Pending</span><span class=\"ochip\">Paid</span></div><div class=\"field ph\">🔍 Search supplier or note…</div><div class=\"chips\"><span class=\"ochip\">All categories</span><span class=\"ochip\">This month</span><span class=\"ochip\">Newest</span><span class=\"ochip\">⬇ Export CSV</span></div><div class=\"hint\">12 of 34 expenses · showing £1,247.50</div><div class=\"tkt\"><div class=\"tkhd\"><b>RS · Riverside Sports Hall</b> <span class=\"g\">Venue hire · 5 Aug 2026 · Paid</span><span class=\"tkp\">£180.00</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>MM · Morton Michel</b> <span class=\"g\">Insurance · Repeats · Pending · due 20 Aug</span><span class=\"tkp\">£42.00</span></div></div><span class=\"btn\">Mark paid</span></div>"
      },
      {
        "label": "Overview dashboard",
        "stage": "Overview",
        "line": "A quick health-check of the business — the last six months at a glance, where the money's leaking, which suppliers cost you most, and whether this month's up or down on the last, all without wading through the ledger.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">THIS MONTH</div><div class=\"field\">£1,247.50</div></div><div><div class=\"fl\">BIGGEST</div><div class=\"field\">£245.50 · Equipment</div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Last 6 months</b> <span class=\"g\">Mar £980 · Apr £1,120 · May £890 · Jun £1,310 · Jul £1,180 · Aug £1,247</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Where it goes</b></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Venue hire</b> <span class=\"g\">43%</span><span class=\"tkp\">£540</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Equipment</b> <span class=\"g\">20%</span><span class=\"tkp\">£245.50</span></div></div><div class=\"hint\">Top suppliers: 1. Riverside Sports Hall £540 (3×) · 2. Sports Direct £245.50 (1×)</div></div>"
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
        "line": "Keep the ledger tidy with reusable categories and a saved supplier address book — and, from the card above the tabs, flip the toggle so your own ActivityOS plan fee gets counted as a monthly cost too.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Venue hire</b> <span class=\"g\">43% · 3 expenses · avg £180</span><span class=\"tkp\">£540</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Riverside Sports Hall</b> <span class=\"g\">bookings@riversidesports.co.uk · 07700 900123</span></div></div><span class=\"btn\">＋ Add supplier</span><div class=\"chk\"><span class=\"chkbx\">✓</span>Include my ActivityOS subscription in expenses</div><div class=\"hint\">ActivityOS Pro plan · £29/month since 12 Jan 2026 — counted as a monthly cost.</div></div>"
      }
    ]
  },
  "purchasing": {
    "title": "Money in",
    "introLine": "This is your one takings hub, love — every paid booking, paid invoice and bit of cash you log all roll up into a single \"money in\" figure, then split neatly into an Income side and an Invoices side.",
    "doneLine": "Bookings and invoices land on their own, you pop the rest in by hand, and it all tallies up at the top so you always know exactly what's come in.",
    "steps": [
      {
        "label": "The hub & switch",
        "stage": "Money in",
        "line": "Up top you get your whole takings at a glance, with a little pill to flip between the Income workspace and the Invoices workspace.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkhd\"><b>💰 Money in</b> <span class=\"g\">this month</span><span class=\"tkp\">£4,820</span></div><div class=\"chips\"><span class=\"ochip\">💰 Income</span><span class=\"ochip\">📄 Invoices</span></div><div class=\"row2\"><div><div class=\"fl\">IN 2026</div><div class=\"field\">£38,450</div></div><div><div class=\"fl\">AWAITING PAYMENT</div><div class=\"field\">£1,290</div></div></div><div class=\"hint\">This month: £3,150 bookings + £980 invoices + £690 other income · awaiting payment isn't counted until it's paid.</div></div>"
      },
      {
        "label": "Income · Overview",
        "stage": "Income",
        "line": "The Overview shows not just your total but the shape of it — a trend chart you can swing from seven days right out to a full year, then which programmes and payment types bring the money in, scoped to any season or date range you fancy. The Categories tab then totals each stream by share, count and average.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">Overview</span><span class=\"ochip\">All income</span><span class=\"ochip\">Categories</span></div><div class=\"tkhd\"><b>This month</b> <span class=\"g\">▲12% vs last month £4,300</span><span class=\"tkp\">£4,820</span></div><div class=\"chips\"><span class=\"ochip\">7 days</span><span class=\"ochip\">Month</span><span class=\"ochip\">6 months</span><span class=\"ochip\">9 months</span><span class=\"ochip\">Year</span></div><div class=\"fl\">WHERE IT COMES FROM</div><div class=\"tkt\"><div class=\"tkhd\"><b>Camps</b> <span class=\"g\">44%</span><span class=\"tkp\">£2,100</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Sessions</b> <span class=\"g\">28%</span><span class=\"tkp\">£1,340</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Grants</b> <span class=\"g\">15%</span><span class=\"tkp\">£700</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Memberships</b> <span class=\"g\">14%</span><span class=\"tkp\">£680</span></div></div><div class=\"hint\">Bookings by payment type: Card £1,980 (63%) · Tax-Free Childcare £620 · Childcare vouchers £340 · Cash £210.</div></div>"
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
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"field ph\">🔎 Search source or note…</div></div><div><div class=\"field\">This month</div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Bookings</b> <span class=\"g\">🎟️ Card · Locke family · Football Camp · BKG-2291 <span class=\"chip2\">auto</span></span><span class=\"tkp\">+£135</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Invoices</b> <span class=\"g\">📄 invoice · Priya Shah <span class=\"chip2\">auto</span></span><span class=\"tkp\">+£240</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Grants</b> <span class=\"g\">Awards for All · ✎ ×</span><span class=\"tkp\">+£700</span></div></div><div class=\"hint\">Sort Newest / Oldest / Largest / Smallest · ⬇ Export CSV.</div></div>"
      },
      {
        "label": "New invoice",
        "stage": "Invoices",
        "line": "On this side you raise a proper invoice for a deposit or balance and out pops a shareable pay-link. The number auto-increments, the due-date presets save you the sums, and extra fields like a PO number, account reference or VAT rate only show when your billing settings switch them on — and you can look the parent up straight from your existing customer records with Find a parent.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">CUSTOMER</div><div class=\"field\">Priya Shah</div></div><div><div class=\"fl\">INVOICE NO.</div><div class=\"field\">INV-1042</div></div></div><div class=\"row2\"><div><div class=\"fl\">INVOICE DATE</div><div class=\"field\">9 Aug 2026</div></div><div><div class=\"fl\">DUE DATE</div><div class=\"field\">16 Aug 2026</div></div></div><div class=\"chips\"><span class=\"ochip\">+3d</span><span class=\"ochip\">+5d</span><span class=\"ochip\">+7d ⭐</span><span class=\"ochip\">+10d</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Summer camp balance</b> <span class=\"g\">🔎 Find a parent · child Aanya</span><span class=\"tkp\">£240</span></div></div><div class=\"hint\">PO number, Account ref and VAT % appear only when your billing settings switch them on.</div></div>"
      },
      {
        "label": "Track & chase",
        "stage": "Invoices",
        "line": "And here you close the loop — see who still owes, chase them by email, WhatsApp or pay-link, then mark it paid so that amount folds straight back into your takings up top.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">Overview</span><span class=\"ochip\">All invoices</span><span class=\"ochip\">Sent · 27</span><span class=\"ochip\">Customers</span></div><div class=\"chips\"><span class=\"ochip\">Draft £0</span><span class=\"ochip\">Sent £1,290 (5)</span><span class=\"ochip\">Paid £12,640 (19)</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Priya Shah</b> <span class=\"g\">Summer camp balance · due 16 Aug</span><span class=\"tkp\">£240</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Tom Beckett</b> <span class=\"g\">🚩 overdue · due 2 Aug</span><span class=\"tkp\">£310</span></div></div><div class=\"chips\"><span class=\"ochip\">✉️ Email + pay-link</span><span class=\"ochip\">💬 WhatsApp</span><span class=\"ochip\">🔗 Copy pay-link</span></div><span class=\"btn amber\">Mark paid</span><div class=\"hint\">Card payments are still being connected, so mark paid by hand when the money lands — and the Sent tab logs every email while Customers totals up each payer.</div></div>"
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
        "line": "Everything starts by tapping a template — the type you choose sets the card's colour, its fields and its defaults, so Urgent auto-pins and asks for an acknowledgement while a Booking nudge adds a Book now button.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Newsfeed</b> <span class=\"g\">Published 24 · Pinned 3 · Scheduled 2</span></div></div><div class=\"fl\">NEW POST — PICK A TYPE</div><div class=\"chips\"><span class=\"ochip\">Announcement</span><span class=\"ochip\">Event</span><span class=\"ochip\">Reminder</span><span class=\"ochip\">Urgent / closure</span><span class=\"ochip\">Celebration</span><span class=\"ochip\">Booking nudge</span></div><div class=\"hint\">Each type carries its own hint — Announcement is general news, Event adds a date and RSVP, Booking nudge promotes a listing.</div></div>"
      },
      {
        "label": "Write the post",
        "stage": "Compose",
        "line": "The composer builds the message. Drop a rough note into Help me write and the AI drafts your title and message; then pick a colour, add a photo and choose its shape, tune the event details, and watch the live family preview update as you go.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>New · Event</b> <span class=\"g\">Composer</span></div></div><div class=\"fl\">✨ HELP ME WRITE</div><div class=\"field ph\">Races, medals and a picnic on the meadow — all welcome…</div><div class=\"row2\"><div><div class=\"fl\">COST (FEEDS THE AI)</div><div class=\"field\">£4</div></div><div><div class=\"fl\">LENGTH</div><div class=\"chips\"><span class=\"ochip\">Short</span><span class=\"ochip\">Medium ✓</span><span class=\"ochip\">Long</span></div></div></div><div class=\"fl\">COLOUR</div><div class=\"chips\"><span class=\"ochip\">Auto ✓</span><span class=\"ochip\">🟣</span><span class=\"ochip\">🟢</span><span class=\"ochip\">🩷</span></div><div class=\"fl\">TITLE</div><div class=\"field\">Summer Sports Day 🏅</div><div class=\"fl\">MESSAGE</div><div class=\"field\">Join us on the meadow for races, medals and a picnic — all welcome!</div><div class=\"row2\"><div><div class=\"fl\">DATE / TIME</div><div class=\"field\">18 Jul 2026 · 09:30</div></div><div><div class=\"fl\">IMAGE SHAPE</div><div class=\"chips\"><span class=\"ochip\">Full ✓</span><span class=\"ochip\">Wide</span><span class=\"ochip\">Portrait</span><span class=\"ochip\">Square</span></div></div></div><div class=\"fl\">PREVIEW — WHAT FAMILIES SEE</div><div class=\"prevcard\"><div class=\"ph\">🏅</div><div class=\"pb\"><div class=\"pt\">Summer Sports Day 🏅</div><div class=\"pm\">Join us on the meadow for races, medals and a picnic — all welcome!</div></div></div></div>"
      },
      {
        "label": "Design a newsletter",
        "stage": "Newsletter",
        "line": "For a richer, branded update, tap Design a newsletter — drag in sections like a welcome, dates for the diary or a booking offer, pick a colour theme, and your provider name, logo and contact details fill the banner and footer for you.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>✨ Newsletter builder</b> <span class=\"g\">Autumn Term Update</span></div></div><div class=\"fl\">SECTIONS</div><div class=\"chips\"><span class=\"ochip\">👋 Welcome</span><span class=\"ochip\">📅 Dates for the diary</span><span class=\"ochip\">🎟️ Booking offer</span><span class=\"ochip\">📸 Photo gallery</span></div><div class=\"fl\">THEME</div><div class=\"chips\"><span class=\"ochip\">Navy</span><span class=\"ochip\">Teal ✓</span><span class=\"ochip\">Berry</span></div><div class=\"hint\">Your provider name, logo and contact details auto-fill the banner and footer — every field stays editable, then save to the page, email, or both.</div></div>"
      },
      {
        "label": "Who sees it",
        "stage": "Audience",
        "line": "Next you decide who's actually notified — all families or just chosen listings' parents — then name it for your own search, pop it in a folder and flip the toggles that control how prominent it is.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">WHO SEES IT — CHOSEN LISTINGS' FAMILIES</div><div class=\"chk\"><span class=\"chkbx\">✓</span>Woodpeckers Holiday Camp</div><div class=\"chk\"><span class=\"chkbx\">✓</span>After-School Football Club</div><div class=\"row2\"><div><div class=\"fl\">SAVE AS</div><div class=\"field\">Sports Day 2026</div></div><div><div class=\"fl\">FOLDER</div><div class=\"field\">Summer 2026</div></div></div><div class=\"chips\"><span class=\"ochip\">Pin to top ✓</span><span class=\"ochip\">Allow reactions ✓</span></div></div>"
      },
      {
        "label": "When & where to send",
        "stage": "Publish",
        "line": "Finally, choose the timing — publish now, schedule, or save a draft. Publishing now to the page gives you a five-second cancellable countdown before it reaches families. The same post can also go out as an image, a printable PDF, or an email, and Email files a draft then hands it to the Email composer ready to send.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">WHEN (FOR THE NEWSFEED)</div><div class=\"chips\"><span class=\"ochip\">Publish now ✓</span><span class=\"ochip\">Schedule</span><span class=\"ochip\">Save as draft</span></div><div class=\"fl\">OR SEND IT ANOTHER WAY</div><div class=\"chips\"><span class=\"ochip\">⬇ Image</span><span class=\"ochip\">⬇ PDF</span><span class=\"ochip\">✉ Email</span></div><div class=\"hint\">✉ Email files a draft and opens the Email composer with the subject and the designed message ready to send.</div><div class=\"row2\"><div></div><div><span class=\"btn amber\">Post to Newsfeed → 5s ✋ Cancel</span></div></div></div>"
      },
      {
        "label": "Read the feed",
        "stage": "Track",
        "line": "Every post lands in the feed as a card showing where it went and when, plus the engagement that tells you it landed — seen counts, reactions and, for events, the Going, Maybe, No RSVP tally.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Summer Sports Day 🏅</b> <span class=\"chip2\">Event</span><span class=\"chip2\">Pinned</span></div></div><div class=\"hint\">✅ Shared to Woodpeckers Holiday Camp · 14 Jul, 08:12 · posted by Priya Sharma</div><div class=\"chips\"><span class=\"ochip\">📅 18 Jul · 09:30 · Meadow Park</span></div><div class=\"tkt\"><div class=\"tkhd\"><span class=\"g\">Seen 42 · ♥ 11</span> <span class=\"tkp\">Going 18 · Maybe 5 · No 2</span></div></div></div>"
      },
      {
        "label": "Find, file & manage",
        "stage": "Organise",
        "line": "As the board fills up over the seasons, the filter pills, search, folders and each card's pin, edit, duplicate and archive controls keep it tidy — and Duplicate lets you reuse last year's post rather than rewriting it.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">All</span><span class=\"ochip\">Newsletter</span><span class=\"ochip\">Drafts</span><span class=\"ochip\">Scheduled ✓</span><span class=\"ochip\">Archived</span><span class=\"ochip\">🔍 Search</span></div><div class=\"fl\">FOLDER — SUMMER 2026</div><div class=\"chips\"><span class=\"ochip\">Posts</span><span class=\"ochip\">Newsletters ✓</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Sports Day (last year)</b> <span class=\"g\">📁 · Pin · Edit</span><span class=\"tkp\">Duplicate</span></div></div><div class=\"hint\">Duplicate makes a fresh draft copy; deleting a folder just moves its posts to Unfiled.</div></div>"
      }
    ]
  },
  "staff": {
    "title": "Team & invites — hire to deploy",
    "introLine": "This is your whole people hub, laid out across four tabs that follow one person's journey — Team members, Applications, Onboarding and Deployment. Let's walk a single hire all the way through: they apply, you review, they onboard, they're cleared, and you deploy them.",
    "doneLine": "That's the full loop — recruit in Applications, run the safer-recruitment record in Onboarding, then place them in Deployment. Everything they give you flows forward, so nobody ever types the same thing twice.",
    "steps": [
      {
        "label": "Four tabs, one journey",
        "stage": "Overview",
        "line": "Everything about your people lives here across four tabs. Team members is your roster and invites. Applications is where you recruit. Onboarding is the safer-recruitment record they complete. Deployment places them on your locations and listings. The tiles up top count your team, your pending invites and how many staff seats your plan allows.",
        "bodyHtml": "<div class=\"chips\"><span class=\"ochip\">Team members</span><span class=\"chip2\">Applications</span><span class=\"chip2\">Onboarding</span><span class=\"chip2\">Deployment</span></div><div class=\"chips\"><span class=\"ochip\">👥 Team · 6</span><span class=\"ochip\">⏳ Pending · 2</span><span class=\"ochip\">🎫 Seats · 6 / 10</span></div><div class=\"hint\">The four tabs follow one person: recruit → onboard → deploy.</div>"
      },
      {
        "label": "Build & send an application",
        "stage": "Applications",
        "line": "Recruitment starts in Applications. Build one or more editable application forms — add your own fields and, crucially, mark which ones carry into onboarding later. Duplicate a form to spin up a variant in a click. Then hit Send application: copy a public link to post on a job board or socials, or email a candidate directly. Whatever they submit lands back in this tab.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">📝 APPLICATION FORM</div><div class=\"tkt\"><div class=\"tkhd\"><b>Standard application</b> <span class=\"g\">17 fields · 12 carry into onboarding</span></div></div><div class=\"chips\"><span class=\"ochip\">Edit</span><span class=\"ochip\">Duplicate</span><span class=\"ochip\">📨 Send</span></div><div class=\"fl\">SEND</div><div class=\"chips\"><span class=\"ochip\">🔗 Copy public link</span><span class=\"chip2\">✉️ Email a candidate</span></div></div>"
      },
      {
        "label": "Review, reject or accept",
        "stage": "Applications",
        "line": "Each application opens in full. Not right for you? Reject with a reason that's kept on file. A good fit? Accept, then Send onboarding link — the very same secure sign-up link. And here's the clever bit: anything they already gave you, like their references, address and qualifications, carries straight into their onboarding, so they never fill it in twice.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkhd\"><b>Chloe Adams</b> <span class=\"g\">Coach · applied 13 Aug</span><span class=\"tkp\">NEW</span></div><div class=\"row2\"><div><div class=\"fl\">REFERENCES ↳</div><div class=\"field\">Sam Okafor · Dana Patel</div></div><div><div class=\"fl\">RIGHT TO WORK</div><div class=\"field\">Yes</div></div></div><div class=\"chips\"><span class=\"btn amber\">✓ Accept</span><span class=\"chip2\">Reject with reason</span></div><div class=\"hint\">Accept → 📨 Send onboarding link. Fields marked ↳ carry into onboarding automatically — no re-typing.</div></div>"
      },
      {
        "label": "The onboarding record",
        "stage": "Onboarding",
        "line": "Onboarding is a colour-coded slideshow they work through — personal details, right to work, identity and DBS, references, qualifications, payroll, availability, and the policies they sign. Each section shows what's done. Right-to-work, DBS and references are gated: until all three are verified the person reads Start on hold and cannot work in regulated activity — then it flips to Cleared to start.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">👤 Personal</span><span class=\"ochip\">🛂 Right to work</span><span class=\"ochip\">🪪 DBS</span><span class=\"ochip\">📋 References</span><span class=\"chip2\">💷 Payroll</span><span class=\"chip2\">📅 Availability</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Step 3 of 9 · Identity &amp; DBS</b> <span class=\"g\">6 / 8 complete</span><span class=\"tkp\">⏳ On hold</span></div></div><div class=\"hint\">On hold until Right to work, DBS &amp; References are all Verified — then ✓ Cleared to start.</div></div>"
      },
      {
        "label": "You decide what's required",
        "stage": "Onboarding",
        "line": "Nothing is fixed. In Requirements you toggle each item on or off and set who it applies to — all staff, certain roles, or named people. So an office admin can skip the DBS entirely and it simply won't show for them. And if one person needs a one-off extra, you can add any item just to them.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">⚙ REQUIREMENTS</div><div class=\"tkt\"><div class=\"tkhd\"><b>DBS cleared</b> <span class=\"g\">Required · Applies to: Certain roles</span></div></div><div class=\"chips\"><span class=\"chip2\">🔑 Owner / Admin</span><span class=\"ochip\">Manager</span><span class=\"ochip\">Coach / Staff</span></div><div class=\"hint\">Untick a role and DBS hides for them — but you can still add any item to one individual.</div></div>"
      },
      {
        "label": "Availability & certificates flow on",
        "stage": "Onboarding",
        "line": "Two things onboarding feeds forward. Their weekly availability grid carries over to the Schedule, so the rota knows when they can work. And their DBS and First Aid live alongside the Staff certificates area — you track each qualification once, with expiry reminders and a Single Central Record for inspections.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">📅 WEEKLY AVAILABILITY → SCHEDULE</div><div class=\"chips\"><span class=\"ochip\">Mon AM</span><span class=\"ochip\">Mon PM</span><span class=\"chip2\">Tue</span><span class=\"ochip\">Wed PM</span><span class=\"ochip\">Sat AM</span></div><div class=\"fl\">🎖 CERTIFICATES</div><div class=\"tkt\"><div class=\"tkhd\"><b>DBS · Paediatric First Aid</b> <span class=\"g\">also in Team → Staff certificates</span><span class=\"tkp\">Valid</span></div></div></div>"
      },
      {
        "label": "Policies & documents",
        "stage": "Documents",
        "line": "Policies and risk assessments live in Documents. Assign each to all staff, to permission roles, to job titles, or to a specific listing. Role and title documents are read during onboarding, the moment they first log in — but a listing's risk assessment only appears once the person is deployed there. The Read receipts view shows exactly who's read what, so you can chase anyone outstanding.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">📁 DOCUMENT · ASSIGN TO</div><div class=\"chips\"><span class=\"ochip\">All staff</span><span class=\"chip2\">🔑 Roles</span><span class=\"chip2\">🧑‍🏫 Job titles</span><span class=\"chip2\">📋 A listing</span></div><div class=\"hint\">Role/title docs read at onboarding on first login; a listing's risk assessment appears once they're deployed there.</div><div class=\"tkt\"><div class=\"tkhd\"><b>Read receipts</b> <span class=\"g\">who's read what</span><span class=\"tkp\">Chase unread</span></div></div></div>"
      },
      {
        "label": "Track your invites",
        "stage": "Team members",
        "line": "Back on Team members, everyone you've invited is listed with a live status — Pending until they sign up, then Account activated. Filter by All, Pending or Activated, search by name, and use Copy link to hand an invite over yourself if the email didn't reach them.",
        "bodyHtml": "<div class=\"chips\"><span class=\"ochip\">All</span><span class=\"chip2\">Pending</span><span class=\"chip2\">Activated</span></div><div class=\"frm\"><div class=\"field ph\">🔍 Search by name</div><div class=\"tkt\"><div class=\"tkhd\"><b>Priya Shah</b> <span class=\"g\">First Aider · Staff</span><span class=\"tkp\">Pending</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Alex Rivera</b> <span class=\"g\">Site Manager · Management</span><span class=\"tkp\">✓ Activated</span></div></div><div class=\"chips\"><span class=\"btn\">Copy link</span></div></div>"
      },
      {
        "label": "Deploy them to work",
        "stage": "Deployment",
        "line": "Finally, Deployment. Once someone's activated, place them on your locations and the listings inside them — flip between By location, By staff and By listing. This is what decides whose registers, ratios and schedule each person sees, and it's the moment any listing-specific risk assessment reaches them. Apply, accept, onboard, clear, deploy — that's the whole journey.",
        "bodyHtml": "<div class=\"chips\"><span class=\"ochip\">By location</span><span class=\"chip2\">By staff</span><span class=\"chip2\">By listing</span></div><div class=\"frm\"><div class=\"fl\">📍 MILTON KEYNES</div><div class=\"tkt\"><div class=\"tkhd\"><b>Alex Rivera</b> <span class=\"g\">Summer camp · 📅 Summer 1</span></div></div><div class=\"field ph\">＋ Add staff (A–Z)…</div><div class=\"hint\">Deployment decides whose registers, ratios &amp; schedule they see — and delivers listing-specific risk assessments.</div></div>"
      }
    ]
  },
  "staff-applications": {
    "title": "Applications — recruit",
    "introLine": "This tab is recruitment — build application forms, advertise the role and pay, send them out, and review who applies before anyone reaches onboarding.",
    "doneLine": "That's Applications — build a form, send it far and wide, and accept the right people straight into onboarding with their details carried over.",
    "steps": [
      {
        "label": "Build & send an application",
        "stage": "Forms",
        "line": "Build one or more editable application forms — add your own fields and mark which ones carry into onboarding later. Duplicate a form to spin up a variant in a click. Then Send: copy a public link to post on a job board or socials, or email a candidate directly.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">📝 APPLICATION FORM</div><div class=\"tkt\"><div class=\"tkhd\"><b>Standard application</b> <span class=\"g\">17 fields · 12 carry into onboarding</span></div></div><div class=\"chips\"><span class=\"ochip\">Edit</span><span class=\"ochip\">Duplicate</span><span class=\"ochip\">📨 Send</span></div><div class=\"fl\">SEND</div><div class=\"chips\"><span class=\"ochip\">🔗 Copy public link</span><span class=\"chip2\">✉️ Email a candidate</span></div></div>"
      },
      {
        "label": "Advertise the role & pay",
        "stage": "Forms",
        "line": "Each form can carry an optional job summary and the pay — per hour, per day, an annual salary or a range. Candidates see it when they open the link, so your advert and your application form are one and the same.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">JOB SUMMARY (OPTIONAL)</div><div class=\"field\">Multi-sports coach for our holiday camps — deliver fun, safe sessions for 5–11s.</div><div class=\"row2\"><div><div class=\"fl\">PAY</div><div class=\"field\">Per hour</div></div><div><div class=\"fl\">RATE</div><div class=\"field\">£12–14</div></div></div><div class=\"hint\">Shown to candidates on the application — advert and form in one.</div></div>"
      },
      {
        "label": "Review, reject or accept",
        "stage": "Review",
        "line": "Each application opens in full. Reject with a reason that's kept on file, or Accept and Send onboarding link — the same secure sign-up link. Anything they already gave you, like references, address and qualifications, carries straight into onboarding, so they never fill it in twice.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkhd\"><b>Chloe Adams</b> <span class=\"g\">Coach · applied 13 Aug</span><span class=\"tkp\">NEW</span></div><div class=\"row2\"><div><div class=\"fl\">REFERENCES ↳</div><div class=\"field\">Sam Okafor · Dana Patel</div></div><div><div class=\"fl\">RIGHT TO WORK</div><div class=\"field\">Yes</div></div></div><div class=\"chips\"><span class=\"btn amber\">✓ Accept</span><span class=\"chip2\">Reject with reason</span></div><div class=\"hint\">Accept → 📨 Send onboarding link. Fields marked ↳ carry over automatically.</div></div>"
      }
    ]
  },
  "staff-onboarding": {
    "title": "Onboarding — safer recruitment",
    "introLine": "This tab is the safer-recruitment record each new starter completes — a colour-coded slideshow, gated so nobody starts until the essential checks are verified.",
    "doneLine": "That's Onboarding — a complete safer-recruitment record, configurable per role, that clears someone to start and feeds their availability and certificates onward.",
    "steps": [
      {
        "label": "The onboarding record",
        "stage": "Record",
        "line": "Onboarding is a colour-coded slideshow — personal details, right to work, identity and DBS, references, qualifications, payroll, availability and the policies they sign. Right-to-work, DBS and references are gated: until all three are verified the person is On hold and cannot work in regulated activity, then it flips to Cleared to start.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">👤 Personal</span><span class=\"ochip\">🛂 Right to work</span><span class=\"ochip\">🪪 DBS</span><span class=\"ochip\">📋 References</span><span class=\"chip2\">💷 Payroll</span><span class=\"chip2\">📅 Availability</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Step 3 of 9 · Identity &amp; DBS</b> <span class=\"g\">6 / 8 complete</span><span class=\"tkp\">⏳ On hold</span></div></div><div class=\"hint\">On hold until Right to work, DBS &amp; References are Verified — then ✓ Cleared to start.</div></div>"
      },
      {
        "label": "You decide what's required",
        "stage": "Requirements",
        "line": "Nothing is fixed. In Requirements you toggle each item and set who it applies to — all staff, certain roles, or named people. So an office admin can skip the DBS and it won't show for them; and you can still add any one item to a single person.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">⚙ REQUIREMENTS</div><div class=\"tkt\"><div class=\"tkhd\"><b>DBS cleared</b> <span class=\"g\">Required · Applies to: Certain roles</span></div></div><div class=\"chips\"><span class=\"chip2\">🔑 Owner / Admin</span><span class=\"ochip\">Manager</span><span class=\"ochip\">Coach / Staff</span></div><div class=\"hint\">Untick a role and DBS hides for them.</div></div>"
      },
      {
        "label": "Availability & certificates flow on",
        "stage": "Onward",
        "line": "Their weekly availability grid carries over to the Schedule, so the rota knows when they can work. Their DBS and First Aid live alongside the Staff certificates area — tracked once, with expiry reminders and a Single Central Record for inspections.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">📅 WEEKLY AVAILABILITY → SCHEDULE</div><div class=\"chips\"><span class=\"ochip\">Mon AM</span><span class=\"ochip\">Mon PM</span><span class=\"chip2\">Tue</span><span class=\"ochip\">Wed PM</span><span class=\"ochip\">Sat AM</span></div><div class=\"fl\">🎖 CERTIFICATES</div><div class=\"tkt\"><div class=\"tkhd\"><b>DBS · Paediatric First Aid</b> <span class=\"g\">also in Staff certificates</span><span class=\"tkp\">Valid</span></div></div></div>"
      },
      {
        "label": "Export & Single Central Record",
        "stage": "Records",
        "line": "When you need to prove it, export a per-person onboarding pack with their documents attached, or the whole-team Single Central Record for Ofsted — with the option to show when each check was verified and the ID method used.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">🖨️ Export pack</span><span class=\"ochip\">📑 Single Central Record</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Marcus Bell</b> <span class=\"g\">DBS Verified · 14 Aug · Passport</span><span class=\"tkp\">Cleared</span></div></div><div class=\"hint\">Toggle Dates &amp; methods to include when each check was verified.</div></div>"
      }
    ]
  },
  "staff-deployment": {
    "title": "Deployment — place your team",
    "introLine": "This tab places activated staff onto your locations and listings — which is what decides what each person actually sees and does day to day.",
    "doneLine": "That's Deployment — put people where they work, and everything from registers to listing-specific risk assessments follows automatically.",
    "steps": [
      {
        "label": "Place people on work",
        "stage": "Deploy",
        "line": "Once someone's activated, place them on your locations and the listings inside them — flip between By location, By staff and By listing, and add someone from the dropdown. Each listing shows the season it belongs to.",
        "bodyHtml": "<div class=\"chips\"><span class=\"ochip\">By location</span><span class=\"chip2\">By staff</span><span class=\"chip2\">By listing</span></div><div class=\"frm\"><div class=\"fl\">📍 MILTON KEYNES</div><div class=\"tkt\"><div class=\"tkhd\"><b>Alex Rivera</b> <span class=\"g\">Summer camp · 📅 Summer 1</span></div></div><div class=\"field ph\">＋ Add staff (A–Z)…</div></div>"
      },
      {
        "label": "What deployment controls",
        "stage": "Impact",
        "line": "Deployment is what decides whose registers, ratios and schedule each person sees — and it's the moment a listing-specific risk assessment reaches them in their Documents. Access still comes from their role; deployment decides where that access is pointed.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Registers · Ratios · Schedule</b> <span class=\"g\">scoped to their listings</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>📋 Trampoline Trip — Risk Assessment</b> <span class=\"g\">delivered once deployed</span><span class=\"tkp\">To read</span></div></div><div class=\"hint\">Role = what they can do. Deployment = where.</div></div>"
      }
    ]
  },
  "tasks": {
    "title": "Task manager",
    "introLine": "This is your operational to-do list — proper tasks tied to real camps, bookings and compliance, all pulled into one tidy inbox no matter how many companies you coach for.",
    "doneLine": "Capture it, tick it off, and never lose track of what's due across all your gigs.",
    "steps": [
      {
        "label": "Workload cards",
        "stage": "Overview",
        "line": "A quick row of cards up top so you can see your whole workload — and anything that's slipped — at a single glance, and tap any card to filter the list down to just those tasks.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">YOUR WORKLOAD</div><div class=\"chips\"><span class=\"ochip\">Open · 4</span><span class=\"ochip\">Overdue · 1</span><span class=\"ochip\">Due this week · 3</span></div><div class=\"hint\">The 'Unassigned' card is manager-only — as a freelancer you get just these three.</div></div>"
      },
      {
        "label": "One inbox",
        "stage": "One inbox",
        "line": "The clever bit for solo coaches — tasks from every company you coach for land in one inbox, each row badged with the provider it belongs to, so nothing gets lost between gigs.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">ONE INBOX</div><div class=\"field\">One inbox across every company you work for</div><div class=\"tkt\"><div class=\"tkhd\"><b>Chase parent consent form</b> <span class=\"tkp\">APF Camps</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Set up Week 3 registers</b> <span class=\"tkp\">Riverside Sports</span></div></div></div>"
      },
      {
        "label": "Quick-add bar",
        "stage": "Capture",
        "line": "Just type it in plain English — an exclamation mark sets priority, a hash links a camp or booking, and words like tomorrow set the due date automatically.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">ADD A TASK</div><div class=\"field ph\">Add a task…  try: Chase consent form tomorrow !high #Easter</div><div class=\"field\">Chase parent consent form tomorrow !high #Easter</div><div class=\"chips\"><span class=\"chip2\">!High</span><span class=\"chip2\">#Easter</span><span class=\"chip2\">Tomorrow</span><span class=\"btn\">+ New task</span></div><div class=\"hint\">! priority · # link a camp/booking · today / tomorrow / Mon set the due date. '+ New task' opens the full form.</div></div>"
      },
      {
        "label": "My Tasks list",
        "stage": "My tasks",
        "line": "The heart of the page — your tasks grouped into Overdue, Today and Upcoming, each row showing its priority, linked camp or booking, and when it's due.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">OVERDUE · 1</div><div class=\"tkt\"><div class=\"tkhd\"><b>Upload renewed DBS certificate</b> <span class=\"g\">🛡️ Compliance · auto · Riverside Sports</span><span class=\"tkp\">2d ago</span></div></div><div class=\"fl\">TODAY · 1</div><div class=\"tkt\"><div class=\"tkhd\"><b>Confirm session plan — football week</b> <span class=\"g\">⛺ Easter · Wk1 · APF Camps</span><span class=\"tkp\">Today</span></div></div><div class=\"fl\">UPCOMING · 2</div><div class=\"tkt\"><div class=\"tkhd\"><b>Send invoice for last week</b> <span class=\"g\">🎫 Booking · Wk ending 7 Jun · Bright Stars</span><span class=\"tkp\">Tomorrow</span></div></div></div>"
      },
      {
        "label": "Board & detail drawer",
        "stage": "Board",
        "line": "Flip to the Board to drag tasks between columns, or click any row to open the drawer and tweak the detail — due date, priority, status and the linked record, plus checkable subtasks and comments.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">BOARD</div><div class=\"chips\"><span class=\"ochip\">Backlog · 1</span><span class=\"ochip\">To do · 2</span><span class=\"ochip\">In progress · 0</span><span class=\"ochip\">Done · 0</span></div><div class=\"fl\">SEND INVOICE FOR LAST WEEK</div><div class=\"row2\"><div><div class=\"fl\">DUE</div><div class=\"field\">Tomorrow</div></div><div><div class=\"fl\">PRIORITY</div><div class=\"field\">Medium</div></div></div><div class=\"row2\"><div><div class=\"fl\">STATUS</div><div class=\"field\">To do</div></div><div><div class=\"fl\">LINKED TO</div><div class=\"field\">🎫 Booking · Wk ending 7 Jun</div></div></div><div class=\"chk\"><span class=\"chkbx\">✓</span>Pull hours from the register</div><div class=\"chips\"><span class=\"chip2\">Finance</span><span class=\"chip2\">2 comments</span></div></div>"
      },
      {
        "label": "Calendar & mirror",
        "stage": "Calendar",
        "line": "See everything by date in the Calendar tab, and optionally mirror any task onto your Events calendar — its labels, subtasks and comments travel across so the whole team sees it there too.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">CALENDAR · AUGUST</div><div class=\"chips\"><span class=\"ochip\">Day</span><span class=\"ochip\">Week</span><span class=\"ochip\">Month</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Confirm session plan</b> <span class=\"g\">Wed 12 · football week</span><span class=\"tkp\">🎫</span></div></div><div class=\"chk\"><span class=\"chkbx\">✓</span>On the Events calendar — labels, subtasks and comments carried across</div></div>"
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
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"chip2\">Upcoming 3</span><span class=\"chip2\">This month 2</span><span class=\"chip2\">Need action 1</span><span class=\"chip2\">Total 7</span></div><div class=\"chips\"><span class=\"ochip\">All</span><span class=\"ochip\">Planned</span><span class=\"ochip\">Completed</span><span class=\"ochip\">Cancelled</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Woodland Wonders, Epping Forest</b> <span class=\"g\">Approved — ready to go</span><span class=\"tkp\">86%</span></div></div><div class=\"chips\"><span class=\"chip2\">18 children</span><span class=\"chip2\">3 staff · 1:6</span><span class=\"chip2\">✓ RA signed</span><span class=\"chip2\">✍️ Consent 18/18</span><span class=\"chip2\">💳 Paid 16/18</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Sea Life Centre, Brighton</b> <span class=\"g\">In planning</span><span class=\"tkp\">57%</span></div></div><div class=\"chips\"><span class=\"chip2\">12 children</span><span class=\"chip2\">2 staff · 1:8</span><span class=\"chip2\">RA draft</span><span class=\"chip2\">✍️ Consent 7/12</span><span class=\"chip2\">sign-off pending</span></div></div>"
      },
      {
        "label": "The 7-step planner",
        "stage": "Planner",
        "line": "Opening a trip swaps in the planner — a big readiness ring, six live chips and a rail of seven numbered steps that turn green as you complete them.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">SEA LIFE CENTRE, BRIGHTON · READINESS 57%</div><div class=\"chips\"><span class=\"chip2\">Children 12</span><span class=\"chip2\">Staff 2</span><span class=\"chip2\">Ratio 1:8</span><span class=\"chip2\">Consents 7/12</span><span class=\"chip2\">RA Draft</span><span class=\"chip2\">Sign-off Pending</span></div><div class=\"chips\"><span class=\"ochip\">1 ✓ Trip details</span><span class=\"ochip\">2 Risk assessment</span><span class=\"ochip\">3 Staffing & ratio</span><span class=\"ochip\">4 Children, consent & payment</span><span class=\"ochip\">5 Sign-off</span><span class=\"ochip\">6 Head counts</span><span class=\"ochip\">7 Debrief</span></div><div class=\"hint\">In planning · Track changes ON · one step shows at a time with a Previous / Next pager.</div></div>"
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
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"chip2\">18 children</span><span class=\"chip2\">3 staff</span><span class=\"chip2\">actual 1:6</span><span class=\"chip2\">policy 1:6 · need 3</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Priya Sharma</b> <span class=\"g\">Lead · First aider</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Grace Bennett</b> <span class=\"g\">Activity leader · First aider</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Daniel Reid</b> <span class=\"g\">Activity leader</span></div></div><div class=\"chips\"><span class=\"ochip\">＋ Chloe Turner</span></div><div class=\"hint\">✓ Off-site ratio met (1:6), with a named lead and a first aider.</div></div>"
      },
      {
        "label": "Children, consent & payment",
        "stage": "Parents",
        "line": "Booked children flow straight in, so you can see who's consented, who still owes and who's not coming — then fire off a parent letter with a tap-to-pay button.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">FROM WHICH CAMP</div><div class=\"field\">Summer Multi-Sports Camp</div></div><div><div class=\"fl\">WHICH PASS</div><div class=\"field\">Full week + trips</div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Olivia Hughes</b> <span class=\"g\">age 8 · Consented</span><span class=\"tkp\">Paid £14</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Jacob Ali</b> <span class=\"g\">age 7 · ⚠ EpiPen · Pending</span><span class=\"tkp\">Unpaid</span></div></div><div class=\"hint\">7 consented · 5 pending · 6/12 paid · letter 7/12 sent.</div><span class=\"btn amber\">💳 Pay £14.00 · by 20 Aug 2026</span></div>"
      },
      {
        "label": "Sign-off & head counts",
        "stage": "On the day",
        "line": "The manager's approval is your go/no-go gate — and once it's green, the live head-count checkpoints let you confirm everyone's present at every stage.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"chip2\">Prepared by Priya Sharma</span><span class=\"chip2\">Checks: All clear</span></div><div class=\"hint\">Approved by Priya Sharma (Manager) · 09 Aug 2026, 14:32.</div><div class=\"tkt\"><div class=\"tkhd\"><b>Depart base</b> <span class=\"g\">✓ all 18 · 08:55</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Arrive venue</b> <span class=\"g\">✓ all 18 · 10:10</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Lunch / midpoint</b> <span class=\"g\">18 on trip</span></div></div><span class=\"btn amber\">Confirm count</span></div>"
      },
      {
        "label": "Return & debrief",
        "stage": "Wrap up",
        "line": "Back at base you log a debrief and close the trip — once every head count is done, one tap marks it returned and complete.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">DEBRIEF NOTES</div><div class=\"field\">Great day — all children engaged. One grazed knee, first aid given, parent told at pickup. Book the earlier coach next time.</div><span class=\"btn amber\">Mark trip returned & complete</span><div class=\"hint\">✓ Trip returned and closed — all children accounted for and handed back.</div></div>"
      }
    ]
  },
  "referrals": {
    "title": "Referrals",
    "introLine": "This is your referrals scoreboard — a running read-out of the families bringing you new bookings, what those bookings are worth, and what the rewards are costing you. It is a report, not a settings page.",
    "doneLine": "And that is Referrals — see who is bringing you new families, what it is earning, and what the rewards cost. Change the offer itself over in Setup.",
    "steps": [
      {
        "label": "Hero and headline stats",
        "stage": "Overview",
        "line": "Right at the top a banner sums up your live offer — how much the friend saves and how much the referrer earns back — with three headline figures: friends booked, the revenue those bookings brought in, and how many families are referring. The reward amounts themselves are set over in Setup — tap Change settings to adjust them.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>🏆 Referrals</b> <span class=\"g\">£5 off for the friend, £5 back for the referrer</span><span class=\"btn\">⚙️ Change settings</span></div></div><div class=\"chips\"><span class=\"ochip\">Friends booked · 8</span><span class=\"ochip\">Brought in · £1,240</span><span class=\"ochip\">Referrers · 5</span></div></div>"
      },
      {
        "label": "Top 5 referrers",
        "stage": "Who is referring",
        "line": "This leaderboard ranks your five busiest referrers by the number of friends they have brought in, with the reward each has earned alongside. If your offer is a percentage, this shows the count of codes used instead of a pound figure.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">🏆 TOP 5 REFERRERS</div><div class=\"tkt\"><div class=\"tkhd\"><b>1 · Priya Sharma</b><span class=\"tkp\">3 · £15</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>2 · Amara Okafor</b><span class=\"tkp\">2 · £10</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>3 · Leah Bennett</b><span class=\"tkp\">1 · £5</span></div></div></div>"
      },
      {
        "label": "Impact and cost",
        "stage": "The payoff",
        "line": "This strip weighs the win against the cost: the revenue from referred bookings, the discounts you handed out shown as a share of that revenue, and how many rewards have been redeemed versus how many are still owed. Here that is three of five rewards redeemed, with two still out and ten pounds owed.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">IMPACT</div><div class=\"row2\"><div class=\"tkt\"><b>£1,240</b><div class=\"hint\">bookings from referrals</div></div><div class=\"tkt\"><b>−£120</b><div class=\"hint\">discounts given · 10% of revenue</div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Rewards redeemed</b><span class=\"tkp\">3 / 5</span></div><div class=\"hint\">2 still out · £10 owed</div></div></div>"
      },
      {
        "label": "Recent referrals",
        "stage": "The detail",
        "line": "Every referral is listed here — who referred whom, the date, what the friend spent and saved, a link through to their booking, and whether the referrer reward has been used yet. Search by name or booking, and sort by newest, top reward or top spend.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkhd\"><b>Recent referrals</b><span class=\"btn ghost\">🔍 Search name or booking…</span></div><div class=\"chips\"><span class=\"ochip\">Newest</span><span class=\"ochip\">Top reward</span><span class=\"ochip\">Top spend</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Priya Sharma</b> <span class=\"g\">referred</span> <b>Aisha Khan</b><span class=\"tkp\">£5</span></div><div class=\"hint\">12 Jul 2026 · friend spent £95 (saved £5)</div><span class=\"chip2\">View booking BK-1043 ›</span><span class=\"chip2\">✓ Reward redeemed</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Amara Okafor</b> <span class=\"g\">referred</span> <b>Tom Reilly</b><span class=\"tkp\">£5</span></div><div class=\"hint\">8 Jul 2026 · friend spent £60</div><span class=\"chip2\">no booking linked</span><span class=\"chip2\">Reward not yet used</span></div></div>"
      },
      {
        "label": "Last 3 months",
        "stage": "The trend",
        "line": "A quick three-month bar chart shows friends booked each month with the revenue beneath, so you can see whether referrals are picking up.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">LAST 3 MONTHS · friends booked</div><div class=\"chips\"><span class=\"ochip\">May · 1 · £60</span><span class=\"ochip\">Jun · 3 · £320</span><span class=\"ochip\">Jul · 4 · £860</span></div></div>"
      }
    ]
  },
  "marketing": {
    "title": "Discount codes",
    "introLine": "This is where all your promo codes live — the little codes families type at checkout for money off, whether that's a public sale, a private thank-you, or an offer for a whole group.",
    "doneLine": "You've now got everything you need to spin up a code, target who sees it, and keep an eye on how it's doing.",
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
        "line": "This is the heart of it — name the code or tap Generate to mint a fresh one, then pick how the money comes off: a percentage, a fixed amount off the booking, or an amount off for each child. Then optionally add a minimum spend, an expiry, a usage cap and which listings it applies to.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">CODE</div><div class=\"field\">SUMMER25</div></div><div><div class=\"fl\">DISCOUNT TYPE</div><div class=\"field\">By a percentage</div></div></div><div class=\"row2\"><div><div class=\"fl\">PERCENT OFF</div><div class=\"field\">15%</div></div><div><div class=\"fl\">MIN SPEND (£)</div><div class=\"field\">60</div></div></div><div class=\"row2\"><div><div class=\"fl\">EXPIRY</div><div class=\"field\">31 Aug 2026</div></div><div><div class=\"fl\">USAGE LIMIT</div><div class=\"field\">100</div></div></div><div class=\"fl\">APPLIES TO</div><div class=\"field\">Summer Multi-Sports Camp — Guildford</div></div>"
      },
      {
        "label": "Rule toggles",
        "stage": "Create",
        "line": "Two handy switches: cap a code to one use per family so a welcome offer stays a one-off, and stop a code stacking with any other at checkout.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>WELCOME10</b> <span class=\"g\">£10 off per booking</span></div></div><div class=\"chk\"><span class=\"chkbx\">✓</span>Limit to one use per customer</div><div class=\"chk\"><span class=\"chkbx\">✓</span>Can't be used with any other code</div><div class=\"hint\">Ticking these keeps a code single-use per family and stops it combining with sibling discounts.</div></div>"
      },
      {
        "label": "Reserve for a family or group",
        "stage": "Targeting",
        "line": "Keep a code public for anyone, or reserve it for one family or a saved group — reserving it messages and emails them and drops it straight into their Coupons area.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">RESERVE FOR ONE FAMILY</div><div class=\"field\">Amara Okafor</div><div class=\"fl\">…OR A GROUP</div><div class=\"field ph\">No group</div><div class=\"hint\">Reserving auto-suggests OKAFOR2026, saves it, and emails them; left public it isn't emailed but shows in every family's Coupons banner.</div></div>"
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
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>SUMMER25</b> <span class=\"chip2\">15% off</span> <span class=\"g\">active · min £60 · 42/100 used · expires 31 Aug 2026</span><span class=\"btn\">Pause</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>OKAFOR2026</b> <span class=\"chip2\">£10 off</span> <span class=\"g\">🔒 Amara Okafor only · 1 per customer · 0/1 used</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>EASTER20</b> <span class=\"chip2\">20% off</span> <span class=\"g\">expired · 18/50 used</span></div></div></div>"
      }
    ]
  },
  "bookings": {
    "title": "Bookings",
    "introLine": "Bookings is the one place to handle every request that comes in, from approvals and the waitlist through to payments, refunds and bookings you take yourself over the phone.",
    "doneLine": "That is your whole booking pipeline in a single view, so nothing slips between a request arriving and the money landing.",
    "steps": [
      {
        "label": "Find any booking",
        "stage": "List",
        "line": "Seven tabs sort your bookings by state: All, Approval needed, Confirmed, Waitlisted, Unpaid or invoiced, Cancelled and Refunds, each with a live count. The search box beneath finds a booking by parent, child, reference, booking ID, email or listing.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">FILTER</div><div class=\"chips\"><span class=\"ochip\">All 42</span><span class=\"ochip\">Approval needed 3</span><span class=\"ochip\">Confirmed 28</span><span class=\"ochip\">Waitlisted 4</span><span class=\"ochip\">Unpaid / invoiced 5</span><span class=\"ochip\">Refunds 2</span></div><div class=\"fl\">SEARCH</div><div class=\"field ph\">Search booker, child, ref, email, listing…</div><div class=\"tkt\"><div class=\"tkhd\"><b>Priya Sharma</b> <span class=\"g\">Summer Holiday Camp · Confirmed</span><span class=\"tkp\">£240</span></div></div></div>"
      },
      {
        "label": "Act on many at once",
        "stage": "Bulk",
        "line": "Tick the box on any rows and a bulk bar appears. From there you can approve, email, waitlist, cancel or export the whole selection in a single action, then clear it.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">3 SELECTED</div><div class=\"chk\"><span class=\"chkbx\">✓</span> Priya Sharma · Ref BK-1042</div><div class=\"chk\"><span class=\"chkbx\">✓</span> Tom Ellis · Ref BK-1043</div><div class=\"chk\"><span class=\"chkbx\">✓</span> Aisha Khan · Ref BK-1044</div><div class=\"row2\"><div class=\"btn amber\">Approve</div><div class=\"btn ghost\">Email</div></div><div class=\"chips\"><span class=\"chip2\">Waitlist</span><span class=\"chip2\">Cancel</span><span class=\"chip2\">Export</span></div></div>"
      },
      {
        "label": "Take a booking yourself",
        "stage": "Manual",
        "line": "Take a booking lets you book on a customer's behalf, for example a phone booking. It emails the parent a secure payment link and sits as Invoice sent until they pay, and your capacity and double-booking guards still apply.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">BOOKER NAME</div><div class=\"field\">James Whitfield</div></div><div><div class=\"fl\">BOOKER EMAIL</div><div class=\"field\">james.w@gmail.com</div></div></div><div class=\"row2\"><div><div class=\"fl\">CHILD</div><div class=\"field\">Olivia Whitfield</div></div><div><div class=\"fl\">AGE</div><div class=\"field\">7</div></div></div><div class=\"fl\">LISTING</div><div class=\"field\">Summer Holiday Camp 2027</div><div class=\"row2\"><div><div class=\"fl\">PASS</div><div class=\"field\">5-day week pass</div></div><div><div class=\"fl\">AMOUNT</div><div class=\"field\">£120</div></div></div><div class=\"fl\">BLOCK / DATES</div><div class=\"field\">Week 2 · 4 – 8 Aug 2027</div><div class=\"hint\">We email the parent a secure payment link — it stays Invoice sent until paid.</div><div class=\"btn amber\">Send payment link &amp; create</div></div>"
      },
      {
        "label": "Open the full record",
        "stage": "Detail",
        "line": "Opening a booking gives you three headline tiles for attendees, sessions and total. Below them each child is listed, and you can change or cancel individual days for any child without touching the rest of the booking.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div class=\"tkt\"><div class=\"tkhd\"><b>Attendees</b> <span class=\"g\">on booking</span><span class=\"tkp\">2</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Sessions</b> <span class=\"g\">booked</span><span class=\"tkp\">10</span></div></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Total</b> <span class=\"g\">paid</span><span class=\"tkp\">£240</span></div></div><div class=\"fl\">ATTENDEES</div><div class=\"field\">Olivia Whitfield · 7 yrs · 5 of 5 days</div><div class=\"chips\"><span class=\"chip2\">Change day</span><span class=\"chip2\">Cancel day</span></div><div class=\"field\">Max Whitfield · 9 yrs · 4 of 5 days</div></div>"
      },
      {
        "label": "Payments and funding",
        "stage": "Payment",
        "line": "The payment section shows the method and total. For a Tax-Free Childcare booking you can toggle whether it has been reconciled, and for a funded HAF place you can track whether the evidence has been received.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">METHOD</div><div class=\"field\">Tax-Free Childcare</div><div class=\"fl\">TOTAL</div><div class=\"field\">£240.00</div><div class=\"fl\">TFC RECONCILED</div><div class=\"field\">Yes <span class=\"chip2\">toggle</span></div><div class=\"fl\">HAF EVIDENCE</div><div class=\"field\">Received</div></div>"
      },
      {
        "label": "Cancel and refund",
        "stage": "Refunds",
        "line": "When you cancel or refund, you choose full, partial or no refund. ActivityOS never moves money, so you action the refund in your own payment provider, and the same panel is where you approve, decline, promote from the waitlist or mark a booking paid.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">REFUND THE PARENT?</div><div class=\"chips\"><span class=\"ochip\">Yes — full (£240.00)</span><span class=\"ochip\">Partial</span><span class=\"ochip\">No refund</span></div><div class=\"fl\">REFUND AMOUNT (£)</div><div class=\"field ph\">120.00</div><div class=\"hint\">ActivityOS never moves money — action any refund in your own payment provider.</div><div class=\"row2\"><div class=\"btn amber\">Confirm cancellation</div><div class=\"btn ghost\">Keep booking</div></div></div>"
      }
    ]
  },
  "messages": {
    "title": "Messages",
    "introLine": "This is your Messages inbox. From here you can message one family or a whole listing at once, keep every reply as a normal one to one conversation, and use templates and merge fields to write faster.",
    "doneLine": "That is Messages end to end, from a single family right through to a whole listing broadcast with templates and merge fields.",
    "steps": [
      {
        "label": "The hero and your actions",
        "stage": "Overview",
        "line": "The banner at the top explains the idea: message one family or a whole listing at once, and any replies come back as normal one to one conversations. On the right sit your actions. Message customers starts a new send, Templates manages your saved messages, and Message ActivityOS is there for support.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">MESSAGES</div><div class=\"field\">Message one family or a whole listing — replies come back as 1:1 chats</div><div class=\"chips\"><span class=\"ochip\">＋ Message customers</span><span class=\"ochip\">📝 Templates</span><span class=\"ochip\">✦ Message ActivityOS</span></div></div>"
      },
      {
        "label": "Your conversation list",
        "stage": "Inbox",
        "line": "Down the left is every conversation. Search families or the message text at the top, then narrow the list with the tabs: All, Needs reply, and New, each carrying a live count. You can also file conversations into your own folders such as Resolved to keep the inbox tidy.",
        "bodyHtml": "<div class=\"frm\"><div class=\"field ph\">Search families or messages…</div><div class=\"chips\"><span class=\"ochip\">All 42</span><span class=\"ochip\">Needs reply 6</span><span class=\"ochip\">New 3</span></div><div class=\"chips\"><span class=\"ochip\">📁 Resolved 18</span><span class=\"ochip\">＋ Folder</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Sarah Whitmore</b> <span class=\"g\">parent of Ava</span><span class=\"tkp\">7 Aug</span></div></div></div>"
      },
      {
        "label": "Message families or a listing",
        "stage": "Compose",
        "line": "Hit Message customers and the composer opens. Choose Families to tick one or many families from a searchable list, or Listings to reach a whole run. Pick a single family and it opens as a normal conversation, while picking several sends the same message to each of them.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"chip2\">👤 Families</span><span class=\"ochip\">📋 Listings</span></div><div class=\"field ph\">Search families by name, place or email…</div><div class=\"chk\"><span class=\"chkbx\">✓</span> Sarah Whitmore · parent of Ava · Leeds</div><div class=\"chk\"><span class=\"chkbx\">✓</span> James Okafor · parent of Leo · Leeds</div><div class=\"hint\">2 selected</div></div>"
      },
      {
        "label": "Whole listing, reviewed",
        "stage": "Broadcast",
        "line": "In Listings mode you pick one or more listings and ActivityOS pulls in everyone booked onto them. Before you send, a review panel lists every family so you can un-tick anyone you want to leave out. The whole send then shows in your inbox as a single Sent to families row.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">GOING TO 23 OF 25 FAMILIES</div><div class=\"chk\"><span class=\"chkbx\">✓</span> Sarah Whitmore · Ava · sarah.w@gmail.com</div><div class=\"chk\"><span class=\"chkbx\">✓</span> Priya Sharma · Dev · priya.s@gmail.com</div><div class=\"hint\">Click any family to un-tick and leave them out of this send.</div></div>"
      },
      {
        "label": "Simple or Pro composer",
        "stage": "Templates",
        "line": "Above the message box you can switch from Simple to Pro. Pro lets you drop in saved templates and merge fields like Parent name and Child name, which fill in for each recipient automatically. A live preview shows exactly how the message will read, and you can save any message as a new template.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"ochip\">Simple</span><span class=\"chip2\">Pro ✦</span></div><div class=\"field ph\">Insert template…</div><div class=\"chips\"><span class=\"ochip\">{ParentName}</span><span class=\"ochip\">{ChildName}</span><span class=\"ochip\">{ProviderName}</span><span class=\"ochip\">＋ Save as template</span></div><div class=\"fl\">👀 PREVIEW — HOW SARAH WILL SEE IT</div><div class=\"field\">Hi Sarah, just a reminder that Ava's session runs Saturday. See you there!</div></div>"
      },
      {
        "label": "Read and reply",
        "stage": "Reply",
        "line": "Open any conversation to read the whole thread. Your messages show in blue and the family's in pink. When you reply, merge fields fill from that family, and once you are finished you can move the conversation into a folder to clear it from your inbox.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>Sarah Whitmore</b> <span class=\"g\">parent of Ava</span><span class=\"tkp\">Move to 📁</span></div></div><div class=\"chips\"><span class=\"ochip\">🔵 You</span><span class=\"ochip\">🔴 Customer</span></div><div class=\"field ph\">Write a message…  (Enter to send · Shift+Enter for a new line)</div><div class=\"btn amber\">Send</div></div>"
      }
    ]
  },
  "schedule": {
    "title": "Schedule and rota",
    "introLine": "This is your rota — build the week's shifts, ask staff for their availability, and see at a glance who's covered and who still needs staff.",
    "doneLine": "That's the rota — filter by season, build and assign shifts, chase availability and check-ins, then publish. Fine-tune it all on the Settings tab.",
    "steps": [
      {
        "label": "Season first, then narrow",
        "stage": "Filter",
        "line": "Start by choosing a season — you can pick more than one. The 📅 button opens a pop-up, and whatever you tick then scopes the whole rota so only the locations and listings in those seasons show. From there narrow by 📍 location and 🎟 listing, step weeks with the arrows, and switch the view between By area or By staff and Day / Week / Month.",
        "bodyHtml": "<div class=\"chips\"><span class=\"ochip\">📅 Summer 1</span><span class=\"chip2\">📍 milton KEYNES</span><span class=\"chip2\">🎟 All listings</span></div><div class=\"chips\"><span class=\"btn ghost\">‹</span><span class=\"btn\">9 – 15 Aug</span><span class=\"btn ghost\">›</span><span class=\"chip2\">Week by area</span></div><div class=\"hint\">The season pop-up is multi-select — it filters the locations and listings you see.</div>"
      },
      {
        "label": "What the week costs",
        "stage": "Wages",
        "line": "A wages banner sits up top — the week's total at the plain hourly rate, and again including your predicted on-cost (employer NI, pension). It's recorded only; ActivityOS never moves money. The on-cost percentage comes from the Settings tab.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">AT HOURLY RATE</div><div class=\"field\">£486.00</div></div><div><div class=\"fl\">INCL. 12.07% ON-COST</div><div class=\"field\">£544.67</div></div></div><div class=\"hint\">Predicted labour cost for the shifts in view — display only.</div></div>"
      },
      {
        "label": "The rota, by listing",
        "stage": "Grid",
        "line": "Each block is one of your listings, with its location and season shown small underneath, and a row for every job role. Shifts are colour-coded by state: navy means assigned to someone, soft red means it still needs staff, and grey means no shift yet. The key up top spells it out, and the hours total sits above each day.",
        "bodyHtml": "<div class=\"tkt\"><div class=\"tkhd\"><b>🎟 Summer camp Loughton Manor</b> <span class=\"g\">📍 milton KEYNES · 📅 Summer 1</span></div></div><div class=\"chips\"><span class=\"ochip\">🟦 Assigned</span><span class=\"ochip\">🟥 Not assigned</span><span class=\"chip2\">◻︎ No shift</span></div><div class=\"row2\"><div class=\"tkt\"><div class=\"tkhd\"><b>9–3 · Alex Rivera</b></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>9–3 · Unfilled</b></div></div></div>"
      },
      {
        "label": "Add & assign a shift",
        "stage": "Build",
        "line": "If you manage the team, tap the ＋ in any day cell to add a shift, set its time, role, listing and season, then Assign staff. Assigned people show as chips — click the × on a chip to unassign and free the slot back to open. Auto-fill offers available, non-double-booked staff, and you can add a break or a note.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">START</div><div class=\"field\">09:00</div></div><div><div class=\"fl\">END</div><div class=\"field\">15:00</div></div></div><div class=\"fl\">ASSIGNED</div><div class=\"chips\"><span class=\"ochip\">Alex Rivera ×</span></div><div class=\"chips\"><span class=\"btn amber\">⚡ Auto-fill available staff</span></div></div>"
      },
      {
        "label": "Ask staff for availability",
        "stage": "Availability",
        "line": "Step 1 in the side panel is Request staff to confirm availability — click it and pick This week or All weeks, or open one person's editor to ask just them. A red bell with a count shows how many times you've asked; it turns green once they confirm. Sort the panel by who has the most spare availability, or by cost per hour, to fill open shifts smartly.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"btn amber\">Request staff to confirm availability · 2</span></div><div class=\"chips\"><span class=\"chip2\">This week</span><span class=\"chip2\">All weeks</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Jordan Lee</b> <span class=\"g\">Requested</span><span class=\"tkp\">🔔 2</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Alex Rivera</b> <span class=\"g\">Confirmed</span><span class=\"tkp\">🔔 ✓</span></div></div></div>"
      },
      {
        "label": "Who's not checked in",
        "stage": "Check-in",
        "line": "Once a shift starts, anyone assigned who hasn't checked in past the grace period shows in Check-in alerts — with how late they are and how many times you've nudged them. Search by name and hit Remind. The grace period, and whether to flag late staff at all, are on the Settings tab.",
        "bodyHtml": "<div class=\"frm\"><div class=\"field ph\">🔍 Search staff name</div><div class=\"tkt\"><div class=\"tkhd\"><b>Priya Shah</b> <span class=\"g\">Not in · 9–3 · milton KEYNES</span><span class=\"tkp\">⏰ 20 min late</span></div></div><div class=\"chips\"><span class=\"g\">🔔 Reminded 1×</span><span class=\"btn amber\">Remind again</span></div></div>"
      },
      {
        "label": "Publish to staff",
        "stage": "Publish",
        "line": "When the week's ready, Publish to staff locks the shifts and tells everyone assigned. How they're told — email, push, both or not at all — is your choice on the Settings tab.",
        "bodyHtml": "<div class=\"frm\"><div class=\"chips\"><span class=\"btn amber\">Publish to staff · 4</span></div><div class=\"hint\">Locks the shifts and notifies assigned staff per your publish setting.</div></div>"
      },
      {
        "label": "Rota vs Settings",
        "stage": "Settings",
        "line": "Two tabs sit at the top: Rota is everything we've walked through; Settings is where you tune it. Under Notifications & automation you choose how staff are told when you publish, a shift reminder before a start, the check-in grace period and whether to auto-flag late staff, plus auto-chasing unconfirmed availability. Basics there set your week start, default shift and break, and the on-cost percentage the wages banner uses.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">SETTINGS · NOTIFICATIONS &amp; AUTOMATION</div><div class=\"tkt\"><div class=\"tkhd\"><b>Notify staff on publish</b> <span class=\"g\">Email + push</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Shift reminder</b> <span class=\"g\">2 hours before</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Check-in grace</b> <span class=\"g\">15 minutes</span></div></div><div class=\"hint\">Basics, swaps &amp; offers and the on-cost % live here too.</div></div>"
      }
    ]
  },
  "reconciliation": {
    "title": "Reconciliation",
    "introLine": "This is where you match money that lands off the platform — childcare vouchers, cash, bank transfers and funded places. Card payments already settle online, so they arrive here done.",
    "doneLine": "That is reconciliation — match each payment, chase what is still owed, and every family gets told the moment their booking is settled.",
    "steps": [
      {
        "label": "Money at a glance",
        "stage": "Overview",
        "line": "The four tiles across the top give you the shape of what is outstanding. You can see how many payments are still awaiting a match, the total money still to come in, how many are fully reconciled, and how many vouchers are now past their due date.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">AWAITING</div><div class=\"field\">12 payments to match</div></div><div><div class=\"fl\">OUTSTANDING</div><div class=\"field\">£1,840 still to come in</div></div></div><div class=\"row2\"><div><div class=\"fl\">RECONCILED</div><div class=\"field\">47 fully matched</div></div><div><div class=\"fl\">OVERDUE</div><div class=\"field\">3 vouchers past due</div></div></div></div>"
      },
      {
        "label": "Payment method tabs",
        "stage": "Tabs",
        "line": "Each tab is a payment route. Switch between childcare vouchers, cash, bank transfer and funded places to work one method at a time. The number on each tab tells you how many bookings sit behind it.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">METHOD</div><div class=\"chips\"><span class=\"ochip\">All</span><span class=\"ochip\">Childcare vouchers 8</span><span class=\"ochip\">Cash 3</span><span class=\"ochip\">Bank transfer 5</span><span class=\"ochip\">HAF / funded 2</span></div></div>"
      },
      {
        "label": "Voucher provider filter",
        "stage": "Vouchers",
        "line": "Open the childcare vouchers tab and a second row of chips appears for the provider. Narrow down to just Edenred or just Computershare so you can reconcile one scheme's batch in one go.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">PROVIDER</div><div class=\"chips\"><span class=\"ochip\">All providers</span><span class=\"ochip\">Edenred 4</span><span class=\"ochip\">Computershare 3</span><span class=\"ochip\">Care-4 1</span></div></div>"
      },
      {
        "label": "Status and filters",
        "stage": "Filters",
        "line": "Below the tabs you can filter by status — awaiting, reconciled, or all — and narrow further by listing, season and date range. The line on the right shows how many bookings are shown and how much of that is still outstanding.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">STATUS</div><div class=\"chips\"><span class=\"ochip\">All</span><span class=\"chip2\">Awaiting</span><span class=\"ochip\">Reconciled</span></div><div class=\"row2\"><div><div class=\"fl\">LISTING</div><div class=\"field\">Summer Holiday Club</div></div><div><div class=\"fl\">SEASON</div><div class=\"field\">Summer 2026</div></div></div><div class=\"hint\">9 shown · £1,340 outstanding</div></div>"
      },
      {
        "label": "Reconcile or nudge a booking",
        "stage": "Match",
        "line": "Each row is one booking, colour-tagged by its payment route and showing what is still due. Hit reconcile to settle it in one click, or ring the bell to nudge the family for the balance. You can also log a partial amount when only some of the money has landed.",
        "bodyHtml": "<div class=\"tkt\"><div class=\"tkhd\"><b>#BK-4021 · Sarah Whitfield · Amelia</b> <span class=\"g\">Voucher · Edenred · overdue since 24 Jul</span><span class=\"tkp\">£90 due</span></div></div><div class=\"chips\"><span class=\"btn ghost\">🔔 Nudge</span><span class=\"btn ghost\">Log amount received</span><span class=\"btn amber\">✓ Reconcile</span></div>"
      },
      {
        "label": "Reference and notes",
        "stage": "Detail",
        "line": "Open a row for the full picture — the payment breakdown, the parent's reference which you can edit if the bank shows it differently, and internal notes only you ever see. A booking for two children may pay as two references, and each can land separately.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">PAYMENT REFERENCE</div><div class=\"field\"><b>Amelia</b> · Edenred — EDN-88214 · £50</div><div class=\"field\">Jacob · Edenred — EDN-88215 · £40</div><div class=\"fl\">INTERNAL NOTES</div><div class=\"field ph\">Chased Edenred; parent says sent, waiting on the bank</div><div class=\"hint\">Only you see these, never the parent</div></div>"
      }
    ]
  },
  "inventory": {
    "title": "Inventory",
    "introLine": "This is Inventory, your kit and stock check in one place. It shows what you hold, where it is stored, how many you have, and when each item was last counted.",
    "doneLine": "That is Inventory end to end, from adding your kit and counting stock to reordering and carrying a season over to the next.",
    "steps": [
      {
        "label": "Your stock at a glance",
        "stage": "Overview",
        "line": "The banner tallies your whole season. You can see how many items you hold, how many categories they fall into, how many are running low, and how many are due a count.",
        "bodyHtml": "<div class=\"row2\"><div><div class=\"fl\">ITEMS</div><div class=\"field\">86</div></div><div><div class=\"fl\">CATEGORIES</div><div class=\"field\">7</div></div></div><div class=\"row2\"><div><div class=\"fl\">LOW STOCK</div><div class=\"field\">4</div></div><div><div class=\"fl\">TO CHECK</div><div class=\"field\">11</div></div></div>"
      },
      {
        "label": "Kit grouped by category",
        "stage": "Items",
        "line": "Every item is grouped under its category, each one colour coded. A card shows the name, where it is stored, the current count, and when it was last counted. Add an item with a category, a location, a quantity, an optional reorder level and a season.",
        "bodyHtml": "<div class=\"tkt\"><div class=\"tkhd\"><b>Footballs (size 4)</b> <span class=\"g\">Sports Hall · ✓ 4 Aug · min 10</span><span class=\"tkp\">24</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>First-aid kits</b> <span class=\"g\">Store Cupboard · ⚠ Low</span><span class=\"tkp\">3</span></div></div>"
      },
      {
        "label": "Run a stock check",
        "stage": "Check",
        "line": "Start stock check turns every count into an input. Type the real figure you have on the shelf and press Count. It saves the new number and auto stamps the time and who did it. Tap any count to see the last five.",
        "bodyHtml": "<div class=\"tkt\"><div class=\"tkhd\"><b>Bibs (bundles)</b> <span class=\"g\">Kit Bag</span><span class=\"tkp\">12</span></div></div><div class=\"frm\"><div class=\"fl\">NEW COUNT</div><div class=\"field\">9</div></div><div class=\"btn amber\">✓ Count</div><div class=\"hint\">Last 5: 9 · 10 Aug · Sam · latest, then 12, 12, 14</div>"
      },
      {
        "label": "Running low and due a check",
        "stage": "Filters",
        "line": "Set a reorder level and an item flags as low when it drops to it. Anything not counted within your window is flagged due a check. Filter by category, location, low stock or needs a check, or just search.",
        "bodyHtml": "<div class=\"chips\"><span class=\"chip2\">All categories</span><span class=\"chip2\">All locations</span><span class=\"ochip\">Low stock</span><span class=\"ochip\">Needs a check</span></div><div class=\"frm\"><div class=\"fl\">SEARCH</div><div class=\"field ph\">Search items…</div></div>"
      },
      {
        "label": "Order more into Expenses",
        "stage": "Ordering",
        "line": "Order records how many you want, the total cost and the supplier, then logs a matching expense under the category you pick, as paid or owed. The item shows on order until you press Received, which adds them into stock.",
        "bodyHtml": "<div class=\"tkhd\"><b>Order more — Footballs</b> <span class=\"g\">→ Expenses</span></div><div class=\"row2\"><div><div class=\"fl\">HOW MANY</div><div class=\"field\">16</div></div><div><div class=\"fl\">TOTAL COST</div><div class=\"field\">£120.00</div></div></div><div class=\"frm\"><div class=\"fl\">SUPPLIER</div><div class=\"field\">Decathlon</div></div><div class=\"chips\"><span class=\"ochip\">Owed (unpaid)</span><span class=\"chip2\">Already paid</span></div><div class=\"btn amber\">Place order → Expenses</div>"
      },
      {
        "label": "Carry a season over",
        "stage": "Seasons",
        "line": "Pick a season up top to view just its stock. Carry over to next season copies every item, kit and current counts, into a brand new season, so you do not have to re enter everything. The new season starts unchecked.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">SEASON</div><div class=\"field\">Summer 2026</div></div><div class=\"row2\"><div><div class=\"fl\">COPY FROM</div><div class=\"field\">Summer 2026</div></div><div><div class=\"fl\">INTO SEASON</div><div class=\"field ph\">e.g. Autumn 2026</div></div></div><div class=\"btn ghost\">↪ Carry over</div><div class=\"hint\">✓ Carried over 86 items into Autumn 2026</div>"
      }
    ]
  },
  "locations": {
    "title": "Locations",
    "introLine": "This is your Locations page. It gives you every venue you run at a glance, with the address, how to get there and a map, all in one place so you can run the day without opening a listing.",
    "doneLine": "That is Locations. It is a read only view, so to add a venue or change its details you edit it under Listings and then Locations.",
    "steps": [
      {
        "label": "Every venue at a glance",
        "stage": "Overview",
        "line": "This page pulls in all of your saved venues from the listing library. It updates on its own as venues change, and each one shows as a card so you can scan your whole estate quickly.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">YOUR VENUES</div><div class=\"tkt\"><div class=\"tkhd\"><b>St Mary's Primary Hall</b> <span class=\"g\">Bristol</span><span class=\"tkp\">Cap 60</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Redland Community Centre</b> <span class=\"g\">Bristol</span><span class=\"tkp\">Cap 40</span></div></div></div>"
      },
      {
        "label": "Map for each venue",
        "stage": "Map",
        "line": "For any physical venue that has a pinned location, a small map sits at the top of its card. That gives you and your team a quick sense of exactly where you are heading before the session.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">LOCATION MAP</div><div class=\"tkt\"><div class=\"tkhd\"><b>St Mary's Primary Hall</b> <span class=\"g\">51.4621, -2.6031</span></div></div><div class=\"hint\">Pinned map shown for physical venues</div></div>"
      },
      {
        "label": "Name and address",
        "stage": "Details",
        "line": "Each card leads with the venue name and its full address. Venues that run online instead of in person are flagged with an online tag rather than a map, so you can tell the two apart at a glance.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">VENUE</div><div class=\"field\">St Mary's Primary Hall</div><div class=\"fl\">ADDRESS</div><div class=\"field\">Elm Grove, Redland, Bristol, BS6 6TR</div><div class=\"chips\"><span class=\"ochip\">online</span></div></div>"
      },
      {
        "label": "How to get there",
        "stage": "Directions",
        "line": "Under the address you get the practical arrival notes. There is a transport line for parking and public transport, a free text directions note, and a what3words reference for pinpointing the exact entrance.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">TRANSPORT</div><div class=\"field\">Car park on Elm Grove, 5 min from Redland station</div><div class=\"fl\">DIRECTIONS</div><div class=\"field\">Side gate on Cranbrook Road, hall is at the rear</div><div class=\"fl\">WHAT3WORDS</div><div class=\"field\">///spoon.local.chair</div></div>"
      },
      {
        "label": "Facilities",
        "stage": "Facilities",
        "line": "Finally each venue lists its facilities as tags, so you know what is on site before you arrive. Things like accessible access, a kitchen or an outdoor space show here at a glance.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">FACILITIES</div><div class=\"chips\"><span class=\"ochip\">Wheelchair access</span><span class=\"ochip\">Kitchen</span><span class=\"ochip\">Outdoor space</span><span class=\"ochip\">Parking</span></div></div>"
      }
    ]
  },
  "templates": {
    "title": "Message templates",
    "introLine": "This is the Message templates page. It holds reusable messages, the preset ones from head office plus your own, so you never rewrite the same email twice.",
    "doneLine": "Build a library that sounds like you, and every send starts from a ready draft.",
    "steps": [
      {
        "label": "What this page is",
        "stage": "Overview",
        "line": "Every template you and head office have saved lives here in one list. The presets come ready made, and you can add as many of your own as you like using the New template button.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">YOUR TEMPLATES</div><div class=\"field\">3 presets and 4 of your own</div><div class=\"hint\">Merge fields fill per recipient on send. Edit these to match your voice.</div><div class=\"btn amber\">＋ New template</div></div>"
      },
      {
        "label": "A saved template",
        "stage": "Cards",
        "line": "Each template shows its name, an optional subject line, and the message body. Any merge field is picked out as a highlighted chip so you can see at a glance what will fill in per recipient.",
        "bodyHtml": "<div class=\"tkt\"><div class=\"tkhd\"><b>Booking confirmation</b> <span class=\"g\">Subject: You're booked in for {ListingName}</span></div><div>Hi {ParentName}, {ChildName} is all booked for {ListingName} on {SessionDate} at {VenueName}. Your reference is {BookingRef}. See you there.</div></div>"
      },
      {
        "label": "Presets versus your own",
        "stage": "Presets",
        "line": "Templates from head office carry a Preset tag and are read only, so you cannot edit or delete them. Your own templates can be edited or removed at any time, and every card can be duplicated as a starting point.",
        "bodyHtml": "<div class=\"tkt\"><div class=\"tkhd\"><b>Welcome</b> <span class=\"g\">Preset</span><span class=\"tkp\">head office</span></div></div><div class=\"chips\"><span class=\"ochip\">Duplicate</span></div><div class=\"tkt\"><div class=\"tkhd\"><b>Payment reminder</b> <span class=\"g\">yours</span></div></div><div class=\"chips\"><span class=\"ochip\">Edit</span><span class=\"ochip\">Duplicate</span><span class=\"chip2\">Delete</span></div>"
      },
      {
        "label": "Writing a template",
        "stage": "Editor",
        "line": "New template opens a simple editor. Give it a name, an optional subject, and the message itself. A name and a message are the only things required before you can save.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">TEMPLATE NAME</div><div class=\"field\">Payment reminder</div></div><div><div class=\"fl\">SUBJECT</div><div class=\"field ph\">Subject line (optional)</div></div></div><div class=\"fl\">MESSAGE</div><div class=\"field\">Hi {ParentName}, a quick reminder that payment for {ListingName} is now due. Thank you.</div></div>"
      },
      {
        "label": "Adding merge fields",
        "stage": "Merge fields",
        "line": "Below the message is the list of merge fields. Click one to drop it into whichever box you last touched, the subject or the body. Each fills in per recipient when the message goes out, and the booking ones need a booking to resolve.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">INSERT A MERGE FIELD</div><div class=\"chips\"><span class=\"ochip\">{ParentName}</span><span class=\"ochip\">{ChildName}</span><span class=\"ochip\">{ProviderName}</span><span class=\"chip2\">{ListingName} · needs a booking</span><span class=\"chip2\">{SessionDate} · needs a booking</span><span class=\"chip2\">{BookingRef} · needs a booking</span></div><div class=\"hint\">Click to add; each fills per recipient on send.</div></div>"
      }
    ]
  },
  "compliance": {
    "title": "Compliance",
    "introLine": "This page keeps track of your staff certifications and when each one runs out, things like DBS checks, first aid, safeguarding and insurance.",
    "doneLine": "That is compliance covered, so you can see at a glance who is up to date and who needs renewing.",
    "steps": [
      {
        "label": "What this tracks",
        "stage": "Overview",
        "line": "At the top you get a plain summary of what this page is for. It holds every staff certification alongside its expiry date, so nothing quietly lapses without you noticing.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">TRACKING</div><div class=\"field\">Staff certifications and when they expire</div><div class=\"hint\">DBS, first aid, safeguarding and insurance</div></div>"
      },
      {
        "label": "Add a certificate",
        "stage": "Add",
        "line": "Managers can add a new certificate from here. You pick the staff member and the type, add an optional reference and issued date, then set the expiry, which is required along with the name.",
        "bodyHtml": "<div class=\"frm\"><div class=\"row2\"><div><div class=\"fl\">STAFF MEMBER</div><div class=\"field\">Sarah Whitfield</div></div><div><div class=\"fl\">TYPE</div><div class=\"field\">DBS check</div></div></div><div class=\"row2\"><div><div class=\"fl\">REFERENCE</div><div class=\"field\">001234567890</div></div><div><div class=\"fl\">ISSUED</div><div class=\"field\">14 Feb 2024</div></div></div><div class=\"fl\">EXPIRES</div><div class=\"field\">14 Feb 2027</div><div class=\"btn amber\">Save</div></div>"
      },
      {
        "label": "Status at a glance",
        "stage": "Summary",
        "line": "Three counters break your certificates down by state. You can see how many have expired, how many are expiring soon and how many are still valid, so you know where to focus first.",
        "bodyHtml": "<div class=\"chips\"><span class=\"ochip\">Expired 1</span><span class=\"ochip\">Expiring soon 2</span><span class=\"ochip\">Valid 9</span></div>"
      },
      {
        "label": "The certificate list",
        "stage": "Records",
        "line": "Below the counters every certificate is listed as its own row. Each one shows a status badge, the staff member, the type and reference, and the date it expires.",
        "bodyHtml": "<div class=\"tkt\"><div class=\"tkhd\"><b>Sarah Whitfield</b> <span class=\"g\">DBS check · 001234567890</span><span class=\"tkp\">valid</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>James Okafor</b> <span class=\"g\">Paediatric first aid</span><span class=\"tkp\">expiring soon</span></div></div><div class=\"tkt\"><div class=\"tkhd\"><b>Priya Sharma</b> <span class=\"g\">Safeguarding</span><span class=\"tkp\">expired</span></div></div>"
      },
      {
        "label": "Keeping records current",
        "stage": "Manage",
        "line": "Each row carries its expiry date and, for managers, a delete control to remove a record. Use these to keep the list matching what you actually hold on file.",
        "bodyHtml": "<div class=\"tkt\"><div class=\"tkhd\"><b>Priya Sharma</b> <span class=\"g\">Safeguarding · expires 3 Aug 2026</span><span class=\"tkp\">expired</span></div></div><div class=\"chk\"><span class=\"chkbx\">✓</span> Renewed record replaces the old one</div><div class=\"hint\">Delete removes a certificate you no longer need to track</div></div>"
      }
    ]
  },
  "ai": {
    "title": "AI assistant",
    "introLine": "This is your AI assistant. It reads the same live data as your screens and answers questions about your day in plain English. It is read only, so it can look things up but it cannot book, cancel or refund anything.",
    "doneLine": "Ask the assistant anything about your bookings, spaces, who is in or what is owed, and it will point you to the right screen when you need to take action.",
    "steps": [
      {
        "label": "What it does",
        "stage": "Overview",
        "line": "The assistant answers from your live data, scoped only to your own account. It is read only by design, so it will tell you what is happening but it cannot make changes for you.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">AI ASSISTANT</div><div class=\"field\">Answers from your live data</div><div class=\"chk\"><span class=\"chkbx\">✓</span> Reads only your account's data</div><div class=\"chk\"><span class=\"chkbx\">✓</span> Cannot book, cancel or refund</div></div>"
      },
      {
        "label": "Ask in plain English",
        "stage": "Intro",
        "line": "When you open it fresh, the assistant invites you to ask about your day in plain English. It reads the same live figures as your screens and never sees anyone else's.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>✦ Ask about your day</b> <span class=\"g\">live data</span></div></div><div class=\"hint\">The assistant reads the same live data as your screens — it never sees anyone else's, and it can't book, cancel or refund anything.</div></div>"
      },
      {
        "label": "Suggested questions",
        "stage": "Starters",
        "line": "To get you going there are a few tap to ask starters. For an operator these cover who is booked in today, how full your upcoming sessions are, which families still owe money, and how bookings went this week.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">TRY ONE OF THESE</div><div class=\"chips\"><span class=\"ochip\">Who's booked in today?</span><span class=\"ochip\">How full are my upcoming sessions?</span><span class=\"ochip\">Which families still owe money?</span><span class=\"ochip\">How were bookings this week?</span></div></div>"
      },
      {
        "label": "The answer",
        "stage": "Reply",
        "line": "You ask a question and the assistant reads your live data and replies in the chat. While it is working it shows a reading your live data message, then comes back with the figures.",
        "bodyHtml": "<div class=\"frm\"><div class=\"tkt\"><div class=\"tkhd\"><b>You</b> <span class=\"g\">question</span></div>Who's booked in today?</div><div class=\"tkt\"><div class=\"tkhd\"><b>Assistant</b> <span class=\"g\">from live data</span><span class=\"tkp\">24 in</span></div>24 children are booked across 3 sessions today. Forest School is full at 12, Football has 8 of 16, and Art Club has 4 of 10.</div></div>"
      },
      {
        "label": "Ask your own",
        "stage": "Ask box",
        "line": "At the bottom is a box where you can type any question of your own about bookings, spaces, who is in or what is owed. Press send and it answers from your live data.",
        "bodyHtml": "<div class=\"frm\"><div class=\"fl\">ASK ANYTHING</div><div class=\"field ph\">Ask anything — bookings, spaces, who's in, what's owed…</div><div class=\"row2\"><div><span class=\"btn ghost\">Clear</span></div><div><span class=\"btn amber\">Send</span></div></div></div>"
      }
    ]
  }

};
TOUR_CONFIGS.invoices = TOUR_CONFIGS.purchasing;

// Direct Settings deep-links surfaced by the walkthrough's robot before it
// signs off — the tabs in Setup that control features on each page.
TOUR_CONFIGS.dash.settings = [{"icon":"🗓️","label":"Seasons","tab":"seasons","note":"the term and holiday windows your figures use"}];
TOUR_CONFIGS.meals.settings = [{"icon":"🍽️","label":"Meal settings","tab":"meals","note":"caterer email, order cut-offs and sharing"}];
TOUR_CONFIGS.customers.settings = [{"icon":"❓","label":"Child questions","tab":"people","note":"what parents fill in about each child"}];
TOUR_CONFIGS.ratios.settings = [{"icon":"👥","label":"Age groups and rooms","tab":"groups","note":"the groups and rooms children are placed in"},{"icon":"🛡️","label":"Safeguarding","tab":"safeguarding","note":"when EYFS ratios apply"}];
TOUR_CONFIGS.registers.settings = [{"icon":"📋","label":"Register settings","tab":"registers","note":"sign-in rules and the late-collection threshold"}];
TOUR_CONFIGS.incidents.settings = [{"icon":"🛡️","label":"Safeguarding","tab":"safeguarding","note":"who is alerted and acknowledgement rules"}];
TOUR_CONFIGS.accidents.settings = [{"icon":"🛡️","label":"Safeguarding","tab":"safeguarding","note":"who is alerted and acknowledgement rules"}];
TOUR_CONFIGS.medication.settings = [{"icon":"💊","label":"Medication settings","tab":"medication","note":"consent and administration options"}];
TOUR_CONFIGS.trips.settings = [{"icon":"🚌","label":"Trips and visits","tab":"trips","note":"parent notify, consent and your ratio target"}];
TOUR_CONFIGS.calendar.settings = [{"icon":"🗓️","label":"Calendar settings","tab":"calendar","note":"event categories and reminder timing"}];
TOUR_CONFIGS.inventory.settings = [{"icon":"📦","label":"Inventory settings","tab":"inventory","note":"categories, locations and low-stock alerts"}];
TOUR_CONFIGS.staff.settings = [{"icon":"🔑","label":"Roles & permissions","tab":"roles","note":"access roles and what each can view or edit"},{"icon":"👷","label":"Staff roles","tab":"staff","note":"job titles like Lifeguard, and DBS/cert checks"},{"icon":"🎓","label":"Learning","tab":"learning","note":"credential types & who each applies to"}];
TOUR_CONFIGS.schedule.settings = [{"icon":"👷","label":"Staff and workforce","tab":"staff","note":"your team and their roles"}];
TOUR_CONFIGS.finance.settings = [{"icon":"💷","label":"Money settings","tab":"money","note":"how income and payouts are figured"}];
TOUR_CONFIGS.expenses.settings = [{"icon":"💷","label":"Money settings","tab":"money","note":"expense categories and defaults"}];
TOUR_CONFIGS.purchasing.settings = [{"icon":"💷","label":"Money settings","tab":"money","note":"income and invoice settings"}];
TOUR_CONFIGS.reconciliation.settings = [{"icon":"🎟️","label":"Childcare vouchers","tab":"vouchers","note":"your voucher providers and references"}];
TOUR_CONFIGS.bookings.settings = [{"icon":"💳","label":"Payments","tab":"bookings","note":"how you take payment"},{"icon":"↩️","label":"Cancellations and refunds","tab":"cancel","note":"your cancellation policy"}];
TOUR_CONFIGS.email.settings = [{"icon":"🔔","label":"Notifications","tab":"notifications","note":"the automatic emails ActivityOS sends"},{"icon":"🎨","label":"Branding","tab":"branding","note":"your logo and colours"}];
TOUR_CONFIGS.referrals.settings = [{"icon":"🎁","label":"Refer a friend","tab":"refer","note":"the referral reward and terms"}];
