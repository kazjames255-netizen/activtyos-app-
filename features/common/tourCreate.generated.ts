import type { LiveTourSteps } from "./LiveTour";
import type { SettingsLink } from "./tourNarrator";

// AUTO-GENERATED create-demos (open the real form + walk it). Merged in tourSteps.ts.

export const CREATE_STEPS: Record<string, LiveTourSteps> = {
  "marketing": {
    "title": "Discount codes",
    "introLine": "This is where all your promo codes live — the little codes families type at checkout for money off, whether that's a public sale, a private thank-you, or an offer for a whole group. Let me show you round, then we'll build one together.",
    "doneLine": "And that's it — you've seen how to spin up a code, choose exactly who gets it, and send it straight to their inbox and Coupons area.",
    "steps": [
      {
        "find": "Discount codes",
        "line": "Right at the top you get a quick pulse on your codes — how many are live, how often they've been redeemed, and how many you've made in total."
      },
      {
        "find": "👥 Parent groups",
        "line": "Build named sets of families here — like your NHS parents or your term-time regulars — and later you can send a whole group a code in one go."
      },
      {
        "find": "＋ New code",
        "line": "To make one, you press the New code button up here, and this form opens.",
        "click": true
      },
      {
        "find": "Code",
        "line": "First, name the code — type your own like SUMMER25, or tap Generate to mint a fresh one nobody's used before."
      },
      {
        "find": "Discount type",
        "line": "Then pick how the money comes off — a percentage, a fixed amount off the booking, or an amount off for each child."
      },
      {
        "find": "Applies to",
        "line": "You can point it at one camp, club or class, or leave it on all listings, and add an optional min spend, expiry and usage cap alongside."
      },
      {
        "find": "Reserve for one family",
        "line": "Here's the clever bit — keep it public for anyone, or reserve it for one family or a saved group, and saving will message and email them the code and drop it into their Coupons area."
      },
      {
        "find": "Create code",
        "line": "Finally, press Create code — that saves it and, if you've reserved it, sends it straight out to those families."
      }
    ]
  },
  "medication": {
    "title": "Medication",
    "introLine": "This is where you keep children's medicine safe and above board — a card for each child's medicine, the parent's written consent, and every dose given, all in one place.",
    "doneLine": "That's the full loop — consent captured, the medicine on file, and every dose logged with who gave it, all kept safe for safeguarding.",
    "steps": [
      {
        "find": "Medication",
        "line": "Welcome to Medication. Whether you run camps, clubs or classes, this is where every authorised medicine and every dose given is kept together — and nothing is administered without a parent's consent."
      },
      {
        "find": "On file",
        "line": "These four tiles give you the day's safety picture at a glance — how many medicines are on file, how many have consent, how many still need it, and the doses given today."
      },
      {
        "find": "Active",
        "line": "Below that you switch between Active and Archived medicines, filter by listing, and search by child or medicine to find any card fast."
      },
      {
        "find": "＋ Administer a medication",
        "line": "To set up a new medicine, you press '＋ Administer a medication', and this three-step form opens.",
        "click": true
      },
      {
        "find": "Child (booked)",
        "line": "First, pick the child from their bookings. They must already have a booking so the medicine links to their account and reaches the parent."
      },
      {
        "find": "For (condition)",
        "line": "Then name the medicine, the dose, and what it's for — like Ventolin, one puff, for asthma.",
        "advance": "Next →"
      },
      {
        "find": "When should staff give it?",
        "line": "Next you choose when staff should give it — on every booked day, only on days you pick, or only when needed — and you can add set times so a bell reminds staff. Storage and expiry live here too.",
        "advance": "Next →"
      },
      {
        "find": "The parent / carer has given written consent to administer this",
        "line": "The final step is consent. You tick that the parent has given written consent — without it, no dose can ever be recorded against this medicine."
      },
      {
        "find": "Save medication",
        "line": "Press 'Save medication' and the medicine is on file — ready for staff to record each dose, with the parent kept in the picture."
      }
    ]
  },
  "incidents": {
    "title": "Log concern",
    "introLine": "This is your one place for recording concerns about a child — everyday behaviour notes you can share with the parent, and confidential safeguarding matters that go straight to your DSL.",
    "doneLine": "Behaviour on one side, safeguarding on the other, and every concern kept safely on the child's record.",
    "steps": [
      {
        "find": "Log a concern",
        "line": "Your first choice is simply which kind of concern this is — a routine behaviour note the parent can see, or a confidential safeguarding matter that's routed to your DSL."
      },
      {
        "find": "This month",
        "line": "These tiles give you an at-a-glance feel for how many concerns are on the go this month, how many were serious, and whether the parents have been told."
      },
      {
        "find": "Safeguarding",
        "line": "Flip to the Safeguarding tab for confidential, facts-only concerns — pick a KCSIE category and the risk level and next steps fill in for you, with a body map to pin any injury."
      },
      {
        "find": "Log a behaviour concern",
        "line": "To record one, you press Log a behaviour concern, and this three-step form opens.",
        "click": true
      },
      {
        "find": "Child (booked)",
        "line": "Start with who and when — you can only log against a child who's booked, so the record links straight to their account.",
        "advance": "Next →"
      },
      {
        "find": "What happened?",
        "line": "Next, set out the facts — search fifty common behaviour concerns or type your own, and tick the action you took.",
        "advance": "Next →"
      },
      {
        "find": "How serious?",
        "line": "Then mark how serious it was, and choose whether to share it with the parent or keep it internal to your team."
      },
      {
        "find": "Save record",
        "line": "Press Save record and it's kept on the child's record — and if you chose to share, the parent is emailed and notified with a timestamp."
      }
    ]
  },
  "accidents": {
    "title": "First aid",
    "introLine": "This is your first aid log — record every bump and graze on the day, note the first aid you gave, and the parent is told automatically with a timestamp.",
    "doneLine": "And that's the whole loop — logged on the day, the parent told and able to acknowledge, with a tidy record kept behind every one.",
    "steps": [
      {
        "find": "Parent informed",
        "line": "Start with your safety pulse — first aid records this month, how many were serious, how many parents you've told, and the running total."
      },
      {
        "find": "✓ Acknowledged",
        "line": "This filter bar sits above the list, so you can jump to just the serious ones, search by child, or show only the records a parent hasn't acknowledged yet."
      },
      {
        "find": "Log first aid",
        "line": "Now let's log one. You press Log first aid, and this quick three-step form opens.",
        "click": true
      },
      {
        "find": "Child (booked)",
        "line": "First, pick the child. You can only log against a child who's booked in — that's how the record reaches the parent's own area."
      },
      {
        "find": "Where did it happen?",
        "line": "Set the date and time, then note where it happened, like the main hall or the field.",
        "advance": "Next →"
      },
      {
        "find": "What happened?",
        "line": "Step two — describe what happened, clearly and factually, and add the injury or body part."
      },
      {
        "find": "First aid / treatment given — tick all that apply",
        "line": "Then tick the first aid you gave. Suggestions follow NHS and St John Ambulance guidance, and you can add your own detail too.",
        "advance": "Next →"
      },
      {
        "find": "How serious?",
        "line": "Last step — mark how serious it was, and tick whether you've also told the parent in person or by phone."
      },
      {
        "find": "Save record",
        "line": "Press Save record and it's stored, and the parent is emailed and notified with a timestamp so they can acknowledge it."
      }
    ]
  },
  "newsfeed": {
    "title": "Newsfeed",
    "introLine": "This is your announcement board — post updates, events, reminders and urgent closures, and every family with a booking sees them pop up in their own app.",
    "doneLine": "And that's the Newsfeed — pick a type, write it, choose who and when, then watch the seen counts and RSVPs roll in.",
    "steps": [
      {
        "find": "Newsfeed",
        "line": "Everything you post lands here, and the tiles across the top keep a running tally of what's published, pinned and scheduled."
      },
      {
        "find": "New post — pick a type",
        "line": "Every announcement starts here — the type you choose sets the card's colour, its fields and its defaults, so Urgent auto-pins and asks for an acknowledgement while a Booking nudge adds a Book now button."
      },
      {
        "find": "✨ Design a newsletter",
        "line": "For a richer, branded update you can design a full newsletter instead, with your provider name, logo and contact details filling the banner and footer for you."
      },
      {
        "find": "Announcement",
        "line": "Let's create a quick announcement. You press Announcement, and this composer opens.",
        "click": true
      },
      {
        "find": "✨ Help me write",
        "line": "Drop a rough note in here and the AI drafts your title and message for you — handy whether it's a camp, a club or a class."
      },
      {
        "find": "Title",
        "line": "Give it a clear title — this is the bold headline families see first."
      },
      {
        "find": "Message",
        "line": "Then write the message underneath, and the live preview lower down shows it exactly as a parent will."
      },
      {
        "find": "Who sees it",
        "line": "Choose who's actually notified — all families, or just the parents booked onto chosen listings."
      },
      {
        "find": "Post to Newsfeed",
        "line": "When you're happy, press Post to Newsfeed — you get a five-second cancellable countdown, then it goes live to every family you picked."
      }
    ]
  },
  "documents": {
    "title": "Documents",
    "introLine": "This is your document store — one tidy place for the policies, risk assessments, insurance and certificates your setting needs, so the right paperwork is always a click away.",
    "doneLine": "And that's Documents — give a file a title, tag it with a category, upload it or paste a link, and press Save to add it to the shared list for your whole team to open any time.",
    "steps": [
      {
        "find": "Documents",
        "line": "Welcome to Documents — your store for policies, risk assessments, insurance and certificates, all kept in one shared place."
      },
      {
        "find": "Policies, risk assessments and certificates — the paperwork in one place.",
        "line": "Everything lives on one simple page — a running list of your paperwork, each item tagged with a category and opening in a click for your team."
      },
      {
        "find": "＋ Add a document",
        "line": "To add one, you press Add a document, and this short form opens.",
        "click": true
      },
      {
        "find": "Title",
        "line": "First, give it a clear title — say, your autumn camp risk assessment or your public liability certificate."
      },
      {
        "find": "Category",
        "line": "Then pick a category — policies, risk assessments, insurance, certificates, procedures or other — so it's easy to find later."
      },
      {
        "find": "File or link",
        "line": "Now add the document itself — press Choose file to upload a PDF from your device, or paste a link if it lives online."
      },
      {
        "find": "Notes",
        "line": "Add an optional note if it helps — for instance, the dates it covers or when it's next due for review."
      },
      {
        "find": "Save",
        "line": "Finally, press Save, and the document is added to the shared list for your team to open any time."
      }
    ]
  },
  "moments": {
    "title": "Moments",
    "introLine": "Moments is where you share each child's day with their parents — the activities, little milestones and photos that land live in the family's own app.",
    "doneLine": "And that's Moments — a lovely, safe way to keep parents right in the heart of their child's day. Give it a go and share your first one.",
    "steps": [
      {
        "find": "Moments",
        "line": "Welcome to Moments — this is where you share each child's day with their parents, with activities, highlights and photos that land straight in the family's own app."
      },
      {
        "find": "Children featured",
        "line": "Up here you get a quick pulse of the day — how many moments you've shared today and this week, the photos taken, and how many children have featured."
      },
      {
        "find": "Photo gallery",
        "line": "Every photo and piece of work files itself in the gallery automatically, ready to browse by child, by listing or by date whenever you need it."
      },
      {
        "find": "Share a moment",
        "line": "Now let's share one. You press Share a moment up here, and this little composer opens for you.",
        "click": true
      },
      {
        "find": "Which camp / club?",
        "line": "First pick the camp, club or class — the children booked onto it come through automatically, the same list as your register."
      },
      {
        "find": "Choose a photo",
        "line": "Choose whether it's a photo of a child or of their work, then add your photo and crop it to a neat square — a photo of their work needs no consent, so anyone can be tagged."
      },
      {
        "find": "Which children?",
        "line": "Search and tap to tag the children in it. Only those whose family gave photo consent can be in a child photo — the rest are greyed out, so nobody's ever caught out."
      },
      {
        "find": "Write for me",
        "line": "Jot down what happened for the parents — or tap Write for me and it'll draft a warm little caption for you."
      },
      {
        "find": "Post moment",
        "line": "Finally, press Post moment and it's done — the tagged children's parents are notified and emailed a direct link, and the photo files itself in your gallery."
      }
    ]
  },
  "meals": {
    "title": "Meals",
    "introLine": "This is where you build reusable menus, plan their dishes onto each listing's run-days, and choose who sees what — families then add and pay for meals right in the booking basket.",
    "doneLine": "And that's Meals — build a menu once, drop it onto the days, and every order and swap lands right back here for you.",
    "steps": [
      {
        "find": "1 · Season & listing",
        "line": "Start here on the first tab: pick your season, then choose the listing that slides out beside it. The planner runs left to right across these three tabs."
      },
      {
        "find": "3 · Days",
        "line": "On the Days tab you paint your chosen menu onto the run-days — every Monday, every Tuesday — and it saves as you go."
      },
      {
        "find": "Sharing",
        "line": "The Sharing tab sets the rules: who sees each menu, how late families can order, and whether meal swaps need your say-so."
      },
      {
        "find": "Saved menus",
        "line": "Menus have their own tab and get reused across every listing. Let's build one — open Saved menus here.",
        "click": true
      },
      {
        "find": "＋ New menu",
        "line": "To build a menu, you press New menu, and this form opens.",
        "click": true
      },
      {
        "find": "Menu name",
        "line": "Give it a name — say, Summer hot lunches."
      },
      {
        "find": "Meal",
        "line": "Name your first meal, like a hot chicken lunch."
      },
      {
        "find": "Price (£)",
        "line": "Set its price, and flag any of the fourteen UK allergens it contains just below."
      },
      {
        "find": "Save menu",
        "line": "Press Save menu and it's saved, ready to drop onto any listing's days."
      }
    ]
  },
  "timetable": {
    "title": "Building your activity timetable",
    "introLine": "Let me show you how to build a full day-by-day timetable and share it with your team and families.",
    "doneLine": "That's the whole flow — set up each stage, press Automatic or Manual to build every day, then publish to staff and parents.",
    "steps": [
      {
        "find": "Activity timetable builder",
        "line": "This is where you build a full day-by-day timetable for your camp, club or class, then share it with staff and parents."
      },
      {
        "find": "The day",
        "line": "You move through seven quick stages here, from your dates and the shape of the day through to your activities."
      },
      {
        "find": "Listing",
        "line": "To build one, you start on stage one. Pick the listing this timetable is for, then set the From and To dates it covers.",
        "advance": "Next →"
      },
      {
        "find": "Day start",
        "line": "Next, shape the day itself, when it starts and ends, your breaks, lunch and how many activities you want each day.",
        "advance": "Next →"
      },
      {
        "find": "Sign-in times",
        "line": "Add your sign-in and sign-out times so arrivals and collection are built into every day automatically.",
        "advance": "Next →"
      },
      {
        "find": "4 · Facilities available",
        "line": "Tick the spaces you can use, like halls, courts and fields, so each activity gets placed where it actually fits.",
        "advance": "Next →"
      },
      {
        "find": "Groups (add each group — age band optional)",
        "line": "List your groups, with age bands if you like, and choose which activity categories to rotate through the week.",
        "advance": "Next →"
      },
      {
        "find": "6 · Activity bank",
        "line": "This is your activity bank. Switch activities on or off and set where each one runs, ready to slot into the plan.",
        "advance": "Next →"
      },
      {
        "find": "Automatic →",
        "line": "Finally, press Automatic and we build every day for you across the week, or choose Manual for a blank template you fill in yourself. That creates your day-by-day timetable, ready to publish to staff and parents."
      }
    ]
  },
  "registers": {
    "title": "Registers",
    "introLine": "This is your daily register — where you sign the children in and out, keep an eye on every allergy and medical flag, count heads for safety, and reach any parent in a tap, all for one camp, club or class on one day.",
    "doneLine": "And that's the register sorted — everyone signed in, counted, safeguarded, and their parents just a tap away.",
    "steps": [
      {
        "find": "Register",
        "line": "Start up here — choose the season, the camp, club or class, and the day, so the whole register is pointed at the right group, and the tiles show at a glance how many are expected, in, still awaited or off ill."
      },
      {
        "find": "Filter",
        "line": "Every child's allergy, medical and SEND flags sit right on their row, and you can tap a flag to show only those children, sort by age or start time, or search for anyone in a second."
      },
      {
        "find": "Head count",
        "line": "On trips and free-play you'll physically count heads on top of the register — pop the number in and the running tally flags if you're short, and one tap opens Roll call for a fire drill."
      },
      {
        "find": "In",
        "line": "Now to take the register itself. To sign a child in, you press In on their row — they're marked present straight away and the arrival time is stamped for you.",
        "click": true
      },
      {
        "find": "Collect",
        "line": "At pick-up, press Collect to sign that child back out — again with the time noted, so you've a clean record of who left and when."
      },
      {
        "find": "Absent",
        "line": "And if a child's off poorly, press Absent to record it — with an Undo if you tap it by mistake. You can also tick several rows and mark them together, or sign the whole group in at once."
      },
      {
        "find": "Log",
        "line": "Once everyone's marked, pop your head-count number in here and press Log — the register's taken, showing who counted and at what time."
      }
    ]
  },
  "staff": {
    "title": "Staff",
    "introLine": "This is where you bring people onto your team — coaches, assistants, whoever you need — all by invite.",
    "doneLine": "And that's the whole page — invite someone, share the link, and they're on the team.",
    "steps": [
      {
        "find": "Team & invites",
        "line": "Welcome to your Staff page. This is where you build your team for your camps, clubs and classes — everyone joins through an invite from right here."
      },
      {
        "find": "Invite links",
        "line": "Every invite you've made is listed here with its role, a short reference code and the date it went out, so you can see who's still to join at a glance."
      },
      {
        "find": "Copy link",
        "line": "A pending invite keeps a Copy link button so you can share it by hand; the moment someone signs up with it, it flips to Used."
      },
      {
        "find": "their@email.com (optional)",
        "line": "Now let's add someone. You start by typing their email here, and ActivityOS sends them the invite straight away. Leave it blank and it simply makes a link for you to copy and share yourself."
      },
      {
        "find": "+ Invite a franchise",
        "line": "Company accounts also get this button to invite a whole franchise onto the platform; it stays neatly hidden for everyone else."
      },
      {
        "find": "+ Invite staff",
        "line": "And you press Invite staff to send it. If you added an email it lands in their inbox; if you left it blank, a fresh invite link appears in the list below, ready to share."
      }
    ]
  },
  "trips": {
    "title": "Trips &amp; visits",
    "introLine": "This is where you plan an off-site visit from start to finish — details, risk assessment, ratios, parent consent, sign-off and live head counts — all scored in one readiness-tracked planner. Let me show you round, then we'll plan one together.",
    "doneLine": "And that's the full loop — from first idea to everyone safely back at base, all in one place.",
    "steps": [
      {
        "find": "Trips & visits",
        "line": "Welcome to Trips and visits — your home base for planning any off-site outing, whether it's a camp day out, a club visit or a class field trip."
      },
      {
        "find": "Upcoming",
        "line": "These tiles keep score at a glance — what's upcoming, what's on this month, and which trips still need action before they're safe to run."
      },
      {
        "find": "Open planner",
        "line": "Each trip is a readiness card showing children, staff, ratio, risk assessment and consent — press Open planner to work through any one of them."
      },
      {
        "find": "Plan a trip",
        "line": "To create a new one, you press Plan a trip, and this seven-step planner opens with a readiness ring that fills in as you go.",
        "click": true
      },
      {
        "find": "Where are you going?",
        "line": "Start here with where you're headed — search your saved venues or just type a place, and the address fills in for you."
      },
      {
        "find": "Date",
        "line": "Set the date, the cost per child, and your depart and return times."
      },
      {
        "find": "Transport",
        "line": "Pick how you're getting there — a coach, minibus, walking, or type your own."
      },
      {
        "find": "Trip lead",
        "line": "Name the trip lead and their phone number, so there's always a clear point of contact on the day.",
        "advance": "Next →"
      },
      {
        "find": "Save & close",
        "line": "From here you carry on through risk assessment, staffing, consent and sign-off — and whenever you're ready, pressing Save and close creates the trip and keeps it on record."
      }
    ]
  },
  "expenses": {
    "title": "Money out — logging an expense",
    "introLine": "This is your spending hub — pop in everything the business pays out, mark each one as owed or gone, and watch it roll up into tidy monthly and yearly totals.",
    "doneLine": "Keep your spending logged and your receipts attached, and come tax time everything's sitting neat and ready for the accountant.",
    "steps": [
      {
        "find": "Money out",
        "line": "Everything your business spends rolls up into these three big numbers up top — out this month, out this year, and what's still pending to pay."
      },
      {
        "find": "Cash",
        "line": "The Cash-or-Accrual toggle quietly decides the maths — on Cash, money you still owe isn't counted until you mark it paid; on Accrual it counts the moment it's logged."
      },
      {
        "find": "Receipts",
        "line": "The tabs sort your spending by status, and the Receipts tab shows your coverage at a glance so every expense has a receipt behind it for the taxman."
      },
      {
        "find": "＋ Log expense",
        "line": "To add money out, you press Log expense, and this form opens.",
        "click": true
      },
      {
        "find": "Amount (£)",
        "line": "Pop in the amount you paid — venue hire, equipment, insurance, whatever the business spent."
      },
      {
        "find": "Category",
        "line": "Pick a category to keep the ledger tidy, or press New to add a fresh one right here in the form."
      },
      {
        "find": "Status",
        "line": "Mark it Paid if the money's already gone, or Pending if it's a bill you still owe — and set a Repeat for regular costs to spin up the whole run."
      },
      {
        "find": "Log expense",
        "line": "Press Log expense and it lands in your ledger, folded straight into the totals up top."
      }
    ]
  },
  "purchasing": {
    "title": "Money in",
    "introLine": "This is your one takings hub, love — every paid booking, paid invoice and bit of cash you log all roll up into a single money-in figure, then split neatly into an Income side and an Invoices side. Let me show you round, then log a bit of income together.",
    "doneLine": "And that's it — bookings and invoices land on their own, you pop the rest in by hand, and it all tallies up at the top so you always know exactly what's come in.",
    "steps": [
      {
        "find": "Money in",
        "line": "Right at the top you get your whole takings at a glance — this month, this year, and what's still awaiting payment."
      },
      {
        "find": "📄 Invoices",
        "line": "This little pill flips you between the Income workspace and the Invoices workspace, both feeding the same headline."
      },
      {
        "find": "Where it comes from",
        "line": "The Overview breaks your income down by programme and payment type, and you can scope it to any season or date range you fancy."
      },
      {
        "find": "＋ Log income",
        "line": "Cash on the door, grants and fundraising don't arrive on their own — so to add one, you press Log income, and this form opens.",
        "click": true
      },
      {
        "find": "Category",
        "line": "Pick a category — camps, sessions, a grant, memberships — or make a fresh one with the New button."
      },
      {
        "find": "Amount (£)",
        "line": "Pop in the amount that came in, right here."
      },
      {
        "find": "Source",
        "line": "Jot down who it came from, and add a quick note underneath if you like."
      },
      {
        "find": "Repeat",
        "line": "If it comes round regularly, set a repeat and an until-date, and it'll log itself each time."
      },
      {
        "find": "Log income",
        "line": "Then press Log income and it lands straight in your ledger, folded into your money-in totals up top."
      }
    ]
  },
  "email": {
    "title": "Email: your whole comms hub",
    "introLine": "This is your whole comms hub — a Gmail-style inbox and composer for writing to parents one-to-one, a marketing pipeline for branded campaigns to your live audiences, and the automatic emails ActivityOS sends for you.",
    "doneLine": "Write to parents from the Inbox, fire branded campaigns at your live audiences, let ActivityOS send the routine emails for you, and read the numbers to see what's landing.",
    "steps": [
      {
        "find": "Inbox",
        "line": "Everything here lives under one row of tabs — your inbox and writing desk on the left, your marketing pipeline in the middle, and the emails ActivityOS sends for you on the right."
      },
      {
        "find": "Campaigns",
        "line": "Campaigns is where branded marketing happens — pick a live audience, choose a design, then send now or schedule, and each one reports how many opened."
      },
      {
        "find": "Automatic emails",
        "line": "Automatic emails are the ones ActivityOS quietly sends for you — booking confirmations, receipts, session reminders and review requests — and here you switch any off or change the timing."
      },
      {
        "find": "Compose",
        "line": "Now let's write one. You press Compose, and your writing desk opens right here.",
        "click": true
      },
      {
        "find": "👥 Send to",
        "line": "First choose who gets it — all your families, everyone booked on one listing, or a single address."
      },
      {
        "find": "Subject",
        "line": "Give it a subject — this is the line families see in their inbox, so make it count."
      },
      {
        "find": "Message",
        "line": "Write your message in the editor, with photos, attachments and a saved signature — or tap Help me write to draft it for you."
      },
      {
        "find": "Send to",
        "line": "When it's ready, you press Send and every family gets their own copy — there's a short undo window too, in case you have second thoughts."
      }
    ]
  },
  "customers": {
    "title": "Families",
    "introLine": "This is your self-filling little black book (the page calls it Leads and customers) — every booking quietly pops the family in here, so you only ever type when someone rings up or you spot a correction, and you can see exactly where each family sits from first enquiry to happy regular.",
    "doneLine": "And that's Families — a CRM that mostly fills itself in. When someone enquires, you add them and send a sign-up link in one go, and the rest lands on its own as they book.",
    "steps": [
      {
        "find": "Leads & customers",
        "line": "Welcome to Leads and customers — everyone who's enquired or booked onto your camps, clubs and classes, all in one tidy list."
      },
      {
        "find": "All families",
        "line": "The tiles across the top are your funnel and your filter in one. Each count shows where families have got to, and tapping a tile narrows the list to just that stage."
      },
      {
        "find": "Repeat",
        "line": "Families move from Lead to Invited to Customer, and Repeat is the one worth growing — the ones who came back and booked again."
      },
      {
        "find": "Add family",
        "line": "For the manual cases, like a phone enquiry, you press Add family, and this form opens.",
        "click": true
      },
      {
        "find": "First name",
        "line": "Pop in the parent's first name and surname — that's who the record belongs to."
      },
      {
        "find": "Email",
        "line": "Add their email address. This is where their sign-up link will go, so it's worth getting right."
      },
      {
        "find": "Location",
        "line": "Pick which of your own sites they asked about, so you can pull everyone interested in one venue later."
      },
      {
        "find": "They said yes to hearing about upcoming activities",
        "line": "Only tick this if they actually agreed on the call — it's your lawful record of marketing consent."
      },
      {
        "find": "Save & send sign-up link",
        "line": "Then press Save and send sign-up link — it saves the family and emails them a link to set a password and land in their own area. Job done."
      }
    ]
  },
  "ratios": {
    "title": "Ratios & groups",
    "introLine": "This is your live cover board — it sorts the day's booked children into age groups and checks each one against your own ratio targets, so you can see at a glance whether every group is properly staffed.",
    "doneLine": "Scope the board, follow your policy and work the cards, and you'll spot a short group long before the session ever runs.",
    "steps": [
      {
        "find": "Children on site",
        "line": "Start by picking the season, listing and day up top — then these three tiles give you the headline: how many children are in, whether they're covered, and how many groups are running."
      },
      {
        "find": "Your ratio policy",
        "line": "These colours, age bands and target ratios are your own policy, shown here just for reference — you can only change them over in Setup, where every board reads from the one master record."
      },
      {
        "find": "Cover by age group",
        "line": "This is the daily workspace: the day's children drop into coloured cards by age, and each card tells you whether that group is in ratio or short. Flip to By time to re-check cover for each arrival and pickup window instead."
      },
      {
        "find": "Your team",
        "line": "Before you can staff a group you need a team, so build it here — this list is shared with your listings' Staff step, so a coach you add once shows up everywhere."
      },
      {
        "find": "Name — e.g. Alex Rivera",
        "line": "Pop in each person's name, and their role like Coach or Assistant, right here."
      },
      {
        "find": "＋ Add",
        "line": "Press Add and they join your roster down the side of the board, ready to place."
      },
      {
        "find": "＋ Assign to group…",
        "line": "Now the key move — open this dropdown beside a coach and pick the group that's short, and they're placed straight onto it.",
        "click": true
      },
      {
        "find": "Staff on duty",
        "line": "As you assign, on-duty rises and that group flips to In ratio — and it all saves as you go, shared live with the rest of your team."
      }
    ]
  }
};

export const CREATE_SETTINGS: Record<string, SettingsLink[]> = {
  "marketing": [
    {
      "icon": "🏷️",
      "label": "Vouchers",
      "tab": "vouchers",
      "note": "Sets your voucher and gift-card options that sit alongside discount codes."
    },
    {
      "icon": "⭐",
      "label": "Memberships",
      "tab": "memberships",
      "note": "Membership tiers can carry their own member-only discounts that stack with codes."
    },
    {
      "icon": "🤝",
      "label": "Refer a friend",
      "tab": "refer",
      "note": "Configures referral rewards, another way credit and codes reach families."
    }
  ],
  "medication": [
    {
      "icon": "💊",
      "label": "Medication settings",
      "tab": "medication",
      "note": "Consent rules, whether a witness is needed for each dose, leads-only recording, and which parent alerts are sent."
    },
    {
      "icon": "🛟",
      "label": "Safeguarding",
      "tab": "safeguarding",
      "note": "Medication records stay visible for safeguarding even when notifications are off."
    },
    {
      "icon": "📋",
      "label": "Registers",
      "tab": "registers",
      "note": "Medical flags show on the register, with a one-tap link to log a medication for that child."
    }
  ],
  "incidents": [
    {
      "icon": "🛡️",
      "label": "Safeguarding",
      "tab": "safeguarding",
      "note": "Set your DSL, LADO and social-care contacts, the KCSIE categories, and whether parents are told about behaviour notes."
    },
    {
      "icon": "🔔",
      "label": "Notifications",
      "tab": "notifications",
      "note": "Control the alerts parents and staff receive when a concern is logged, shared or updated."
    },
    {
      "icon": "📋",
      "label": "Registers",
      "tab": "registers",
      "note": "Log a concern straight from a child's row on the register — it opens this form pre-filled."
    }
  ],
  "accidents": [
    {
      "icon": "🛡️",
      "label": "Safeguarding",
      "tab": "safeguarding",
      "note": "who's alerted for first aid and the acknowledgement rules"
    },
    {
      "icon": "🔔",
      "label": "Notifications",
      "tab": "notifications",
      "note": "how and when parents and staff are told about a new record"
    }
  ],
  "newsfeed": [
    {
      "icon": "🔔",
      "label": "Notifications",
      "tab": "notifications",
      "note": "Controls how families are alerted when a new post goes out."
    },
    {
      "icon": "🎨",
      "label": "Branding",
      "tab": "branding",
      "note": "Your provider name and logo auto-fill the newsletter banner and footer."
    },
    {
      "icon": "🎟️",
      "label": "Bookings",
      "tab": "bookings",
      "note": "Posts reach the families with bookings, so who's booked decides who sees them."
    }
  ],
  "documents": [
    {
      "icon": "👥",
      "label": "Staff",
      "tab": "staff",
      "note": "Controls who can manage documents — only company, freelancer and franchise roles can add or delete."
    },
    {
      "icon": "🛡️",
      "label": "Safeguarding",
      "tab": "safeguarding",
      "note": "Where your safeguarding policies and procedures are set — the paperwork you'll store here."
    },
    {
      "icon": "🏢",
      "label": "Company",
      "tab": "company",
      "note": "Your organisation details, which underpin the official documents you keep on file."
    }
  ],
  "moments": [
    {
      "icon": "🛡️",
      "label": "Safeguarding",
      "tab": "safeguarding",
      "note": "Records each child's photo consent — this is what decides who can appear in a child photo here."
    },
    {
      "icon": "📋",
      "label": "Registers",
      "tab": "registers",
      "note": "The booked-children register feeds the taggable list, so pick a listing and its children come through."
    },
    {
      "icon": "🔔",
      "label": "Notifications",
      "tab": "notifications",
      "note": "Controls the alert and email a parent gets when their child features in a new moment."
    },
    {
      "icon": "🎨",
      "label": "Branding",
      "tab": "branding",
      "note": "Sets the look carried onto photos you download or save into the Email marketing area."
    }
  ],
  "meals": [
    {
      "icon": "🍽️",
      "label": "Meal settings",
      "tab": "meals",
      "note": "Caterer email digest, order cut-offs and menu sharing defaults."
    },
    {
      "icon": "📅",
      "label": "Seasons",
      "tab": "seasons",
      "note": "Set up the seasons you pick from when planning a listing's meals."
    }
  ],
  "timetable": [
    {
      "icon": "📋",
      "label": "Listings & bookings",
      "tab": "bookings",
      "note": "Your listings and booked families come from here, setting the dates the builder pulls in and who sees it as parents."
    },
    {
      "icon": "👥",
      "label": "Groups",
      "tab": "groups",
      "note": "The age groups and bands you set up here feed straight into the Groups stage of the builder."
    },
    {
      "icon": "🧑‍🏫",
      "label": "Staff",
      "tab": "staff",
      "note": "Staff you invite here are who receive the published timetable in their own Staff portal."
    },
    {
      "icon": "📅",
      "label": "Seasons",
      "tab": "seasons",
      "note": "Your term and holiday date ranges scope which dates a timetable can cover."
    }
  ],
  "registers": [
    {
      "icon": "📋",
      "label": "Register settings",
      "tab": "registers",
      "note": "sign-in timestamps, the collection-PIN rule, and which quick-action links and card fields appear on each row"
    },
    {
      "icon": "🛡️",
      "label": "Safeguarding",
      "tab": "safeguarding",
      "note": "the allergy, medical and SEND flags plus collection passwords pulled onto each child's row"
    },
    {
      "icon": "💊",
      "label": "Medication",
      "tab": "medication",
      "note": "where the Medication quick-link lands when you log a dose straight from a row"
    },
    {
      "icon": "📅",
      "label": "Seasons",
      "tab": "seasons",
      "note": "the holiday and term date ranges behind the season filter on the register"
    }
  ],
  "staff": [
    {
      "icon": "👷",
      "label": "Staff and workforce",
      "tab": "staff",
      "note": "roles, invite email note, and whether a valid DBS and in-date certificates are required"
    },
    {
      "icon": "🏢",
      "label": "Company and franchises",
      "tab": "company",
      "note": "your account type — this is what unlocks the invite-a-franchise button"
    },
    {
      "icon": "🔔",
      "label": "Notifications",
      "tab": "notifications",
      "note": "get a nudge when an invite is accepted and someone joins the team"
    }
  ],
  "trips": [
    {
      "icon": "🚌",
      "label": "Trips and visits",
      "tab": "trips",
      "note": "parent notify, consent asks and your off-site ratio target"
    },
    {
      "icon": "👥",
      "label": "Staff",
      "tab": "staff",
      "note": "your team list that feeds trip leads and the staffing roster"
    },
    {
      "icon": "🎟️",
      "label": "Bookings",
      "tab": "bookings",
      "note": "the passes and booked children that flow into consent and payment"
    }
  ],
  "expenses": [
    {
      "icon": "💷",
      "label": "Money settings",
      "tab": "money",
      "note": "Cash vs accrual basis, expense categories, and the purchase-orders tab"
    },
    {
      "icon": "🗓️",
      "label": "Seasons",
      "tab": "seasons",
      "note": "Holiday and term date ranges that scope which spending you're viewing"
    }
  ],
  "purchasing": [
    {
      "icon": "💷",
      "label": "Money settings",
      "tab": "money",
      "note": "Income categories, invoice numbering, due-date presets and VAT/PO fields"
    },
    {
      "icon": "🗓️",
      "label": "Seasons",
      "tab": "seasons",
      "note": "Define your terms and holidays so income can be scoped by season"
    }
  ],
  "email": [
    {
      "icon": "🏢",
      "label": "Company",
      "tab": "company",
      "note": "Your business name and the reply-to address, so families can write back."
    },
    {
      "icon": "🎨",
      "label": "Branding",
      "tab": "branding",
      "note": "Your logo and colours, used in campaign designs and signatures."
    },
    {
      "icon": "📣",
      "label": "Marketing",
      "tab": "marketing",
      "note": "Re-marketing and opt-in settings that shape who your campaigns can reach."
    },
    {
      "icon": "🗓️",
      "label": "Seasons",
      "tab": "seasons",
      "note": "Term and holiday date ranges your live audiences recount from each send."
    }
  ],
  "customers": [
    {
      "icon": "❓",
      "label": "Child questions",
      "tab": "people",
      "note": "the details parents fill in about each child"
    },
    {
      "icon": "🛡️",
      "label": "Safeguarding",
      "tab": "safeguarding",
      "note": "photo consent and whether you collect SEND plans"
    },
    {
      "icon": "⚙️",
      "label": "Defaults",
      "tab": "defaults",
      "note": "whether a date of birth is required on each child"
    },
    {
      "icon": "✉️",
      "label": "Marketing",
      "tab": "marketing",
      "note": "how consented families feed your email audiences"
    }
  ],
  "ratios": [
    {
      "icon": "🎨",
      "label": "Age groups & rooms",
      "tab": "groups",
      "note": "Your one master record of group colours, age bands, target ratios and room sizes — every board here reads from it."
    },
    {
      "icon": "🧑‍🏫",
      "label": "Staff & team",
      "tab": "staff",
      "note": "The team library shared with each listing's Staff step — add coaches once and assign them to groups here."
    },
    {
      "icon": "📅",
      "label": "Seasons",
      "tab": "seasons",
      "note": "Holiday and term date ranges that scope the season and listing pickers at the top of the board."
    },
    {
      "icon": "📋",
      "label": "Registers",
      "tab": "registers",
      "note": "Where the day's booked children are taken, feeding the counts and groups on this board."
    }
  ]
};
