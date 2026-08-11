import type { LiveTourSteps } from "./LiveTour";
import type { SettingsLink } from "./tourNarrator";

// AUTO-GENERATED create-demos (open the real form + type/pick to fill it). Merged in tourSteps.ts.

export const CREATE_STEPS: Record<string, LiveTourSteps> = {
  "marketing": {
    "title": "Discount codes",
    "introLine": "This is where all your promo codes live — the little codes families type at checkout for money off, whether that is a public sale, a private thank-you, or an offer for a whole group. Let me build one with you so you can see the form fill itself in.",
    "doneLine": "And that is a real code built end to end — named, priced, capped and ready to save. You now know how to spin one up, target who sees it, and keep an eye on how it is doing.",
    "steps": [
      {
        "find": "Discount codes",
        "line": "Right at the top you get a quick pulse on your codes — how many are live, how often they have been redeemed, and how many you have made in total."
      },
      {
        "find": "Parent groups",
        "line": "Build named sets of families once here — like your NHS parents or your term-time regulars — and the reserve-for-a-group picker will feed straight off them."
      },
      {
        "find": "New code",
        "line": "To add one, you press New code, and this form opens. Watch — I will fill in a real summer sale as we go.",
        "click": true
      },
      {
        "find": "New discount code",
        "line": "First, name the code — or tap Generate to mint a fresh one — then pick how the money comes off. We will give parents fifteen percent off with the code SUMMER25.",
        "fill": [
          [
            "Code",
            "SUMMER25"
          ],
          [
            "Discount type",
            "By a percentage"
          ],
          [
            "Percent off",
            "15"
          ]
        ]
      },
      {
        "find": "Min spend (£)",
        "line": "Now the guardrails — a sixty pound minimum spend, an expiry of the thirty-first of August, a cap of one hundred redemptions, and it applies right across all your listings.",
        "fill": [
          [
            "Min spend (£)",
            "60"
          ],
          [
            "Expiry",
            "2026-08-31"
          ],
          [
            "Usage limit",
            "100"
          ],
          [
            "Applies to",
            "All listings"
          ]
        ]
      },
      {
        "find": "Limit to one use per customer",
        "line": "Two handy switches — cap a code to one use per family, or stop it stacking with any other at checkout. For a headline sale we will tick the no-combining switch so it stays a tidy fifteen percent.",
        "pick": [
          "Can’t be used with any other code"
        ]
      },
      {
        "find": "Reserve for one family",
        "line": "You could reserve this for a single family or a saved group — that messages and emails them and drops it into their Coupons area. We will leave it public, so it shows in every family's Coupons banner instead."
      },
      {
        "find": "Create code",
        "line": "And that is the lot. Pressing Create code saves it and it goes live straight away — parents can type SUMMER25 at checkout and the fifteen percent comes off automatically."
      }
    ]
  },
  "medication": {
    "title": "Medication",
    "introLine": "This is where you keep every child's medicine safe and above board — a card for each child's medicine, the parent's written consent, and every single dose that's been given, all in one place.",
    "doneLine": "That's the full loop — consent captured, every dose logged with who gave it, and the parent kept in the picture, all held safely for safeguarding.",
    "steps": [
      {
        "find": "On file",
        "line": "Four tiles give you the day's safety picture at a glance — how many medicines are on file, how many have the parent's consent, how many still need it, and how many doses have gone in today. Below them you can filter Active or Archived and search by child or medicine."
      },
      {
        "find": "Given?",
        "line": "On any medicine that already has consent, you just tap Yes or No to log a dose against today and the current time, and the parent is told automatically. If you need to back-date it or add a note, open 'with time and notes' for the full form."
      },
      {
        "find": "＋ Administer a medication",
        "line": "Let's add a new one. You press the '＋ Administer a medication' button, and this three-step form opens up.",
        "click": true
      },
      {
        "find": "Child (booked)",
        "line": "First you pick the booked child. We'll type Ava Okafor and choose her from the list — she has to have a booking so the medicine links to her account and reaches her parent.",
        "fill": [
          [
            "Search a booked child",
            "Ava Okafor"
          ]
        ],
        "pick": [
          "Ava Okafor"
        ]
      },
      {
        "find": "Medicine",
        "line": "Now the medicine itself — Ventolin, a dose of one puff, and what it's for, asthma. Then we press Next to move on to when staff should give it.",
        "advance": "Next",
        "fill": [
          [
            "Medicine",
            "Ventolin"
          ],
          [
            "Dose",
            "one puff"
          ],
          [
            "For (condition)",
            "asthma"
          ]
        ]
      },
      {
        "find": "When should staff give it?",
        "line": "Step two is when and how. We'll choose 'On every booked day' so it's only offered on the days Ava is booked into the summer holiday camp, note where it's stored, and add the instructions for staff. Then Next.",
        "advance": "Next",
        "fill": [
          [
            "Storage",
            "Locked office cabinet, room temperature"
          ],
          [
            "Instructions",
            "Shake well, one puff through the spacer, wait if she is wheezy"
          ]
        ],
        "pick": [
          "📋 On every booked day"
        ]
      },
      {
        "find": "The parent / carer has given written consent to administer this",
        "line": "The last step is consent. We tick that the parent has given written consent — without it, no dose can ever be recorded — and that the medicine is held on site.",
        "pick": [
          "The parent / carer has given written consent to administer this",
          "The medicine is held on site"
        ]
      },
      {
        "find": "Save medication",
        "line": "Finally, pressing 'Save medication' creates the record — Ava's Ventolin now appears on the list with consent on file, ready for staff to log each dose safely."
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
        "line": "Your first choice is simply which kind of concern this is — a routine behaviour note the parent can see, or a confidential safeguarding matter that's routed straight to your DSL."
      },
      {
        "find": "This month",
        "line": "The stat tiles give you an at-a-glance feel for how many concerns are on the go and whether parents have been told, before you open a fresh record."
      },
      {
        "find": "Log a behaviour concern",
        "line": "To add one, you press Log a behaviour concern, and this three-step form opens — who and when, what happened, then how serious it was.",
        "click": true
      },
      {
        "find": "Child (booked)",
        "line": "First, who and when. You search for the booked child so the record links to their account, then note where it happened — here, the main sports hall this afternoon at holiday camp.",
        "advance": "Next",
        "fill": [
          [
            "Where did it happen",
            "the main sports hall"
          ],
          [
            "Search a booked child",
            "Amelia Hughes"
          ]
        ],
        "pick": [
          "Use “Amelia Hughes” — not a booked child"
        ]
      },
      {
        "find": "What happened?",
        "line": "Next, what happened, in plain factual words. Add the type and any witnesses, then tick the actions you took — a verbal reminder, a restorative chat, and a word with the parent at collection.",
        "advance": "Next",
        "fill": [
          [
            "What happened",
            "During the afternoon dodgeball session Amelia pushed another child off the bench and refused to line up. She calmed down after a quiet chat."
          ],
          [
            "e.g. Physical",
            "Physical"
          ],
          [
            "Witnesses",
            "Coach Daniel and Assistant Priya"
          ]
        ],
        "pick": [
          "Verbal reminder",
          "Restorative chat",
          "Parent informed at collection"
        ]
      },
      {
        "find": "How serious?",
        "line": "Now how serious it was and who sees it. This one is Moderate, and you choose to share it with the parent so it lands in their area, with a quick follow-up note to keep everyone on the same page.",
        "fill": [
          [
            "Follow-up",
            "Coach to check in with Amelia at tomorrow's session, and parent to reinforce sharing at home."
          ]
        ],
        "pick": [
          "Moderate",
          "📤 Share with parent"
        ]
      },
      {
        "find": "Save record",
        "line": "Pressing Save record files it under the child. For a booked child the parent is emailed and notified automatically, with a timestamp, so nothing slips through."
      }
    ]
  },
  "accidents": {
    "title": "First aid",
    "introLine": "This is your first aid log — record every bump and graze on the day, note the first aid you gave, and the parent is told automatically with a timestamp.",
    "doneLine": "And that's the whole loop — logged on the day, the parent told and able to acknowledge, with a tidy record kept behind every one.",
    "steps": [
      {
        "find": "This month",
        "line": "Your safety pulse at a glance — how many first aid records this month, how many were serious, how many parents you've told, and the running total."
      },
      {
        "find": "First aid",
        "line": "This is the whole first aid loop on one page — every bump and graze logged on the day, kept for your records, and sent straight to the parent."
      },
      {
        "find": "Log first aid",
        "line": "To add one, you press Log first aid, and this quick three-step form opens. Let me fill one in so you can watch it come together.",
        "click": true
      },
      {
        "find": "Child (booked)",
        "line": "First, who and when. We pick Freya from the holiday camp register — you can only log against a booked child, as that's how it reaches the parent — then note it was the main hall, just after half two.",
        "advance": "Next",
        "fill": [
          [
            "Child (booked)",
            "Freya Middleton"
          ],
          [
            "Where did it happen?",
            "The main hall"
          ],
          [
            "Date",
            "2026-08-10"
          ],
          [
            "Time",
            "14:35"
          ]
        ]
      },
      {
        "find": "What happened?",
        "line": "Next, what happened, in plain and factual words. We write up the sports-day tumble, tag the injury as a grazed knee, and note Liberty as the first aider on shift.",
        "fill": [
          [
            "What happened?",
            "Freya tripped during the sports-day relay and grazed her knee on the playground tarmac."
          ],
          [
            "Injury / body part",
            "Grazed knee"
          ],
          [
            "First aider",
            "Liberty Young"
          ]
        ]
      },
      {
        "find": "First aid / treatment given — tick all that apply",
        "line": "Because we've said grazed knee, it offers the right first aid to tick — we choose cleaned with water and covered with a plaster, and it's added to the record.",
        "advance": "Next",
        "pick": [
          "Cleaned with water and covered with a plaster"
        ]
      },
      {
        "find": "How serious?",
        "line": "Last, how serious — this one's minor. We tick that we've had a quick word with the parent at pickup too, and jot a follow-up so nothing's forgotten.",
        "fill": [
          [
            "Follow-up (optional)",
            "Keep an eye on it and re-dress if needed; grandad collecting at four."
          ]
        ],
        "pick": [
          "Minor",
          "I've also told the parent in person / by phone"
        ]
      },
      {
        "find": "Save record",
        "line": "And that's it — press Save record and it's logged for good, with the parent emailed and notified in their own area, timestamped, ready to acknowledge."
      }
    ]
  },
  "newsfeed": {
    "title": "Newsfeed",
    "introLine": "This is your announcement board — post updates, events, reminders and urgent closures, and every family with a booking sees them pop up in their own app.",
    "doneLine": "And that's the Newsfeed — pick a template, write it, choose who and when, then watch the seen counts and RSVPs roll in.",
    "steps": [
      {
        "find": "Newsfeed",
        "line": "This is your Newsfeed — post an update and every family with a booking sees it in their own app, from a quick reminder to an event with RSVPs or an urgent closure."
      },
      {
        "find": "New post — pick a type",
        "line": "Everything starts with a template. The type you pick sets the card's colour, its fields and its defaults — so Urgent auto-pins and asks for an acknowledgement, while a Booking nudge adds a Book now button."
      },
      {
        "find": "Event",
        "line": "To add one, you press Event, and this form opens.",
        "click": true
      },
      {
        "find": "Title",
        "line": "Give it a title and a message — here, a Summer Sports Day for the families. Or drop a rough note into Help me write and the AI drafts it for you.",
        "fill": [
          [
            "Title",
            "Summer Sports Day"
          ],
          [
            "Message",
            "Join us on the meadow for races, medals and a family picnic — all welcome."
          ]
        ]
      },
      {
        "find": "Location",
        "line": "Because it's an event, you add the details — the 28th of August at ten o'clock on Meadow Park — and they show right on the card families see.",
        "fill": [
          [
            "Date",
            "2026-08-28"
          ],
          [
            "Time",
            "10:00"
          ],
          [
            "Location",
            "Meadow Park"
          ]
        ]
      },
      {
        "find": "Who sees it",
        "line": "Then you choose who's notified — all families or just chosen listings' parents — and flip the toggles that pin it to the top and let families react.",
        "pick": [
          "All families",
          "Pin to top",
          "Allow reactions"
        ]
      },
      {
        "find": "Save as (a name to find it later)",
        "line": "Name it for your own search and file it in a folder, so you can find it again next year. Families never see this bit.",
        "fill": [
          [
            "Save as",
            "Sports Day 2026"
          ],
          [
            "Folder",
            "Summer 2026"
          ]
        ]
      },
      {
        "find": "Post to Newsfeed",
        "line": "And when you press Post to Newsfeed you get a five-second countdown, then it goes live to every family — you can also send the same post as an image, a printable PDF, or an email instead."
      }
    ]
  },
  "documents": {
    "title": "Documents",
    "introLine": "This is your document store — one tidy place for the policies, risk assessments, insurance and certificates your setting needs, so the right paperwork is always a click away.",
    "doneLine": "And that's Documents — add a file or a link, tag it with a category, and it's saved to the shared list for your whole team to open any time.",
    "steps": [
      {
        "find": "Documents",
        "line": "This is your Documents page — one simple, shared place for all your setting's paperwork, with every file just a click from open."
      },
      {
        "find": "Policies, risk assessments and certificates — the paperwork in one place.",
        "line": "Whether it's your after-school football club, a summer holiday camp or a weekly gymnastics class, the policies, risk assessments, insurance and certificates all live here in one running list."
      },
      {
        "find": "＋ Add a document",
        "line": "Only company, freelancer or franchise accounts see this Add a document button and the delete cross. Everyone else on your team just reads and opens."
      },
      {
        "find": "＋ Add a document",
        "line": "To add one, you press Add a document, and this form opens.",
        "click": true
      },
      {
        "find": "Title",
        "line": "Give it a clear title. Here we'll type Autumn Half-Term Camp Risk Assessment, then pick its category from the dropdown, tagging this one as a risk assessment.",
        "fill": [
          [
            "Title",
            "Autumn Half-Term Camp - Risk Assessment"
          ]
        ],
        "pick": [
          "Risk assessments"
        ]
      },
      {
        "find": "File or link",
        "line": "Now either choose a file to upload from your device, or simply paste a link. We'll paste the web address of the saved PDF.",
        "fill": [
          [
            "https://…",
            "https://apf.co.uk/docs/autumn-half-term-risk-assessment.pdf"
          ]
        ]
      },
      {
        "find": "Notes",
        "line": "An optional note adds context. We'll say it's been reviewed for the October half-term dates, for ages four to twelve.",
        "fill": [
          [
            "Notes",
            "Reviewed for the October half-term dates, ages 4 to 12."
          ]
        ]
      },
      {
        "find": "Save",
        "line": "And that's it. Press Save, and the document lands in your shared list, tagged and ready for the whole team to open any time."
      }
    ]
  },
  "moments": {
    "title": "Moments",
    "introLine": "Moments is where you share each child's day with their parents — the activities, little milestones and photos that land live in the family's own app.",
    "doneLine": "And that's Moments — a lovely, safe way to keep parents right in the heart of their child's day.",
    "steps": [
      {
        "find": "Moments",
        "line": "This is Moments — where you share each child's day with their parents. The activities, the little milestones and the photos all land live in the family's own app."
      },
      {
        "find": "Children featured",
        "line": "Parents only ever see the moments their own child is in, and every photo files itself into the gallery automatically, ready to filter by child, by listing or by date."
      },
      {
        "find": "＋ Share a moment",
        "line": "To add one, you press Share a moment, and this form opens.",
        "click": true
      },
      {
        "find": "Which camp / club?",
        "line": "First you pick the camp or club, and its booked children come through automatically. Then set the date — I'll pop it to the tenth of August.",
        "fill": [
          [
            "Date",
            "2026-08-10"
          ]
        ]
      },
      {
        "find": "Photo (cropped to a square)",
        "line": "Next, choose whether it's a child photo or a photo of their work. A photo of their work has no faces, so it needs no consent — I'll pick that one.",
        "pick": [
          "🎨 Their work"
        ]
      },
      {
        "find": "Activity",
        "line": "Tag the activity so parents know what they got up to — let's say arts and crafts.",
        "pick": [
          "🎨 Arts and crafts"
        ]
      },
      {
        "find": "What happened?",
        "line": "Now jot down a quick highlight, or tap Write for me to draft it for you. I'll add a little note about their rocket.",
        "fill": [
          [
            "A quick highlight for the parents",
            "Ava and Mia built a junk-model rocket and counted down the launch together."
          ]
        ]
      },
      {
        "find": "Post moment 🚀",
        "line": "And that's it. Pressing Post moment shares it, notifies the tagged children's parents with a direct link, and files the photo in your gallery."
      }
    ]
  },
  "meals": {
    "title": "Meals",
    "introLine": "This is where you build reusable menus, plan their dishes onto each listing's run-days, and set who sees what — families then add and pay for meals right in the booking basket, and every order and change lands back here.",
    "doneLine": "And that's Meals — build a menu once, drop it onto the days, and every order, swap and 'not yet chosen' nudge lands right back here for you.",
    "steps": [
      {
        "find": "1 · Season & listing",
        "line": "Everything starts on this first tab. You choose a season, then the listing that slides out beside it, and the planner runs left to right across three tabs. Any listing that already has a meal plan is listed below to jump straight back into."
      },
      {
        "find": "2 · Menu",
        "line": "The Menu and Days tabs are where you plan. You tap a menu, pick which dish or two each weekday serves — offer both a meat and a veg and families choose at checkout — then paint it onto the run-days. It all saves as you go."
      },
      {
        "find": "Sharing",
        "line": "The Sharing tab sets the rules: who sees each day's menu, how late families can order, a standard allergen note, and whether meal swaps need your say-so. Each saved plan can also email its caterer the orders on a schedule."
      },
      {
        "find": "Saved menus",
        "line": "Menus have their own tab and get reused across all your listings. Let's build one together now.",
        "click": true
      },
      {
        "find": "New menu",
        "line": "To add one, you press New menu, and this form opens.",
        "click": true
      },
      {
        "find": "Menu name",
        "line": "First give the menu a name you'll recognise — something like Summer camp hot lunches.",
        "fill": [
          [
            "Menu name",
            "Summer camp hot lunches"
          ]
        ]
      },
      {
        "find": "Meal",
        "line": "Now add a meal: its name, the price in pounds, a daily limit if the kitchen caps it, and a quick description. Tag it Meat, Vegetarian or Vegan so families can filter at a glance.",
        "fill": [
          [
            "Meal",
            "Chicken and sweetcorn pasta"
          ],
          [
            "Price",
            "4.50"
          ],
          [
            "Limit",
            "20"
          ],
          [
            "Description",
            "Served with garlic bread and a side salad"
          ]
        ],
        "pick": [
          "Meat"
        ]
      },
      {
        "find": "Contains",
        "line": "Then tick any of the fourteen UK allergens it contains — here gluten and milk — so every family sees them spelled out clearly.",
        "pick": [
          "gluten",
          "milk"
        ]
      },
      {
        "find": "Save menu",
        "line": "You can press Add another meal to pop in the veg choice too — then press Save menu. That stores it in your library, ready to drop onto any listing's days."
      }
    ]
  },
  "timetable": {
    "title": "Building an activity timetable",
    "introLine": "The timetable builder plans the day itself — every session, break and sign-in — from your own activity bank, then publishes it to staff and parents. Let me build one with you.",
    "doneLine": "That's a full day mapped out. Auto-fill does the heavy lifting, then Publish timetable shares it — staff see their sessions and parents see the plan for their booked days.",
    "steps": [
      {
        "find": "Activity timetable builder",
        "line": "This is where you plan the day itself — every session, break and sign-in, built from your own activity bank. Works for a holiday camp, an after-school club or a weekly class."
      },
      {
        "find": "The day",
        "line": "Seven quick steps run across the top — from the dates, through the shape of the day, to arrivals, spaces and groups."
      },
      {
        "find": "Build",
        "line": "The last step builds it: auto-fill the whole week in one go, or lay it out by hand — then publish to staff and parents."
      },
      {
        "find": "1 · Listing & dates",
        "line": "The builder opens on step one. Pick the listing — say the Newport Pagnell football camp — and set the dates, the eleventh to the fourteenth of August.",
        "advance": "The day",
        "fill": [
          [
            "Newport",
            "Newport Pagnell Football Camp"
          ],
          [
            "From",
            "2026-08-11"
          ],
          [
            "To",
            "2026-08-14"
          ]
        ]
      },
      {
        "find": "2 · The day",
        "line": "Next, shape the day. Doors open at nine, home time at three, with lunch at half past twelve.",
        "advance": "Spaces",
        "fill": [
          [
            "Day start",
            "09:00"
          ],
          [
            "Day end",
            "15:00"
          ],
          [
            "Lunch start",
            "12:30"
          ]
        ]
      },
      {
        "find": "4 · Facilities available",
        "line": "Now tick the spaces you've got. There's no pool at this venue, so tap it off — the plan simply won't schedule swimming.",
        "advance": "Groups",
        "pick": [
          "Pool"
        ]
      },
      {
        "find": "5 · Groups & categories",
        "line": "Set your groups and age bands. Add a new one — Tigers, ages four to six — and choose which activity types join the rotation.",
        "advance": "Build",
        "fill": [
          [
            "Group name",
            "Tigers"
          ],
          [
            "Age band",
            "4-6"
          ]
        ]
      },
      {
        "find": "Automatic →",
        "line": "Finally, press Automatic and the week fills itself, balancing variety, spaces and age groups. From there, Publish timetable shares it with your staff and parents. That's your timetable built."
      }
    ]
  },
  "registers": {
    "title": "Registers",
    "introLine": "This is your daily register — where you sign the children in and out, keep an eye on every allergy and medical flag, count heads for safety, and reach any parent in a tap, all for one camp on one day.",
    "doneLine": "And that's the register sorted — everyone signed in, counted, safeguarded, and their parents just a tap away.",
    "steps": [
      {
        "find": "Register",
        "line": "Start by choosing the season, the camp and the day up in the blue banner, so the whole register is pointed at the right group before you mark a single child — and if a collection PIN is switched on, you'll see the reminder to check it at pick-up."
      },
      {
        "find": "Sort",
        "line": "Sort the list youngest-first or by earliest start, search for any child by name, and tap a flag like Allergy or Medical to show only those children with the note typed right there — and Roll call gives you everyone on site now, to count heads against in a fire drill."
      },
      {
        "find": "First aid",
        "line": "Every row has one-tap links to log first aid, an incident or medication for that child, or to message their parent, all without ever leaving the register."
      },
      {
        "find": "Sign all in",
        "line": "To take the register, you press Sign all in, and every booked child is marked present in a single tap — or you work down the rows with In, Collect and Absent one by one.",
        "click": true
      },
      {
        "find": "Earliest start",
        "line": "You can reorder the list to suit the moment — tap Earliest start to line everyone up by drop-off time, or youngest-first to keep the little ones together.",
        "pick": [
          "Earliest start"
        ]
      },
      {
        "find": "Head count",
        "line": "On trips and free-play you'll physically count heads on top of the register — pop the number in here, and the tally flags the moment you're short.",
        "fill": [
          [
            "Head count",
            "8"
          ]
        ]
      },
      {
        "find": "Log",
        "line": "Then you press Log to record that count, stamped with your name and the time — and that's your register taken: everyone signed in, counted and safeguarded."
      }
    ]
  },
  "staff": {
    "title": "Staff",
    "introLine": "This is where you bring people onto your team — every coach and helper joins through an invite.",
    "doneLine": "That's the whole page — pop in an email, press invite, and they're on their way.",
    "steps": [
      {
        "find": "Team & invites",
        "line": "Welcome to your Staff page. This is where you bring people onto your team, and it all happens through invites — no messy sign-up forms to fill in for them."
      },
      {
        "find": "their@email.com (optional)",
        "line": "There are two ways to invite. Pop in an email and ActivityOS sends the invite straight to them; leave it blank and it just makes a link you can copy and share by hand. Company accounts also get a button to invite a whole franchise, and that one stays hidden for everyone else."
      },
      {
        "find": "Invite links",
        "line": "Every invite you've made lists here with its role, a short reference code and the date. A pending one keeps a Copy link button so you can share it yourself; the moment someone signs up with it, it flips to Used."
      },
      {
        "find": "their@email.com (optional)",
        "line": "Let's invite someone for real — a new coach joining for the August camps. This is where their email goes."
      },
      {
        "find": "their@email.com (optional)",
        "line": "We'll pop in Jordan's email here. That's all ActivityOS needs to send her a personal invite link.",
        "fill": [
          [
            "their@email.com",
            "jordan@apfcamps.co.uk"
          ]
        ]
      },
      {
        "find": "+ Invite staff",
        "line": "And that's it — press Invite staff, and ActivityOS emails Jordan her invite link right away. Had we left the email blank, this would simply create a link for us to copy and share ourselves."
      }
    ]
  },
  "trips": {
    "title": "Trips and visits",
    "introLine": "This is where you plan an off-site visit from start to finish — details, risk assessment, ratios, parent consent, sign-off and live head counts, all scored in one readiness-tracked planner.",
    "doneLine": "And that is the full loop — from first idea to everyone safely back at base, all in one place.",
    "steps": [
      {
        "find": "Trips & visits",
        "line": "This is your home base for every off-site visit — plan each one end to end, from the first details right through to everyone safely back at base."
      },
      {
        "find": "Upcoming",
        "line": "Up top, four tiles keep score — trips coming up, how many this month, which ones still need action, and your running total."
      },
      {
        "find": "Plan an off-site visit end to end",
        "line": "Open any trip, or start a fresh one, and it becomes a seven-step planner with a readiness ring that fills up as you complete the details, risk assessment, staffing, consent, sign-off and head counts."
      },
      {
        "find": "Plan a trip",
        "line": "To start one, you press Plan a trip, and the planner opens on the details.",
        "click": true
      },
      {
        "find": "Where are you going?",
        "line": "First the basics — where you are going: Woodland Wonders in Epping Forest, the address, and the date, the twenty-fifth of August.",
        "fill": [
          [
            "Search your saved venues",
            "Woodland Wonders, Epping Forest"
          ],
          [
            "Address",
            "Epping, Essex CM16 5HW"
          ],
          [
            "Date",
            "2026-08-25"
          ]
        ]
      },
      {
        "find": "Cost per child (£)",
        "line": "Then the cost per child, eighteen pounds, your depart and return times, and one tap picks the transport — Coach.",
        "fill": [
          [
            "Cost per child",
            "18"
          ],
          [
            "Depart",
            "09:00"
          ],
          [
            "Return",
            "15:30"
          ]
        ],
        "pick": [
          "Coach"
        ]
      },
      {
        "find": "Main trip lead & contact",
        "line": "Name your trip lead, Priya Sharma, with a mobile number, so everyone knows who is in charge on the day.",
        "fill": [
          [
            "Trip lead",
            "Priya Sharma"
          ],
          [
            "Lead phone",
            "07700 900123"
          ]
        ]
      },
      {
        "find": "Save & close",
        "line": "And that is the details done. Pressing Save and close creates the trip, then you work through the risk assessment, staffing, consent and manager sign-off."
      }
    ]
  },
  "expenses": {
    "title": "Money out — expenses guided tour",
    "introLine": "This is your spending hub — pop in everything the business pays out, mark each one as owed or gone, and watch it all roll up into tidy monthly and yearly totals.",
    "doneLine": "Keep your spending logged and your receipts attached, and come tax time it is all sitting neat and ready for the accountant.",
    "steps": [
      {
        "find": "Money out",
        "line": "Everything you spend rolls up into three big numbers up top, and the Cash-or-Accrual toggle quietly decides whether money you still owe is counted yet. Flip on Purchase Orders in Setup and a Purchase orders tab joins the page too."
      },
      {
        "find": "Overview",
        "line": "The Overview tab is your quick health-check — the last six months at a glance, where the money is going, and which suppliers cost you most, whether it is holiday camps, weekly clubs or after-school classes."
      },
      {
        "find": "Receipts",
        "line": "Come tax time every spend wants a receipt behind it. The Receipts tab shows your coverage at a glance and lets you fill the gaps with a single tap."
      },
      {
        "find": "＋ Log expense",
        "line": "To add one, you press Log expense, and this form opens.",
        "click": true
      },
      {
        "find": "Category",
        "line": "Start with the date and a category — here it is the fifth of August, and venue hire for a holiday camp. Not listed? The New button adds a fresh category without leaving the form.",
        "fill": [
          [
            "Date",
            "2026-08-05"
          ],
          [
            "Venue hire",
            "Venue hire"
          ]
        ]
      },
      {
        "find": "Amount (£)",
        "line": "Then the amount, who you paid, and a quick note — a hundred and eighty pounds to Riverside Sports Hall for week three of the summer multi-sports camp.",
        "fill": [
          [
            "Amount",
            "180"
          ],
          [
            "Supplier",
            "Riverside Sports Hall"
          ],
          [
            "Notes",
            "Summer multi-sports camp, week 3 hall hire"
          ]
        ]
      },
      {
        "find": "Status",
        "line": "Mark it Paid if the money has gone, or Pending if you still owe it — and for a regular cost like your weekly club hall or monthly insurance, set a repeat so the whole run is logged for you.",
        "pick": [
          "Paid"
        ]
      },
      {
        "find": "Log expense",
        "line": "Press Log expense at the bottom and it lands in your ledger, totalled and categorised. Pick a repeat first and this button flips to Create series, spinning up every entry in one go."
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
        "line": "Right at the top, your whole takings at a glance — what's come in this month, what's in for the year, and what's still awaiting payment."
      },
      {
        "find": "📄 Invoices",
        "line": "This little pill flips you between the Income side and the Invoices side, and both feed the same headline figure up top."
      },
      {
        "find": "Where it comes from",
        "line": "The Overview breaks your income down by programme and payment type, and you can scope it to any season or date range you fancy."
      },
      {
        "find": "＋ Log income",
        "line": "Your camps, clubs and classes fold in on their own, but cash on the door, grants and fundraising don't — so to add one, you press Log income, and this form opens.",
        "click": true
      },
      {
        "find": "Category",
        "line": "First pick a category — I'll choose Grants — then pop in the amount that came in, seven hundred pounds here.",
        "fill": [
          [
            "Category",
            "Grants"
          ],
          [
            "Amount",
            "700"
          ]
        ]
      },
      {
        "find": "Source",
        "line": "Jot down who it came from — a lottery grant here — and add a quick note underneath so you'll remember what it was for.",
        "fill": [
          [
            "Source",
            "Awards for All — holiday club funding"
          ],
          [
            "Notes",
            "Free places for our summer camp"
          ]
        ]
      },
      {
        "find": "Repeat",
        "line": "If it comes round regularly, set a repeat and an until-date — I'll make this one monthly to the end of December — and it'll log itself each time.",
        "fill": [
          [
            "Repeat",
            "Every month"
          ],
          [
            "Repeat until",
            "2026-12-31"
          ]
        ]
      },
      {
        "find": "Create series",
        "line": "Then you press Create series, and each month's entry drops straight into your ledger, folded into your money-in totals up top."
      }
    ]
  },
  "email": {
    "title": "Email",
    "introLine": "This is your whole comms hub — a Gmail-style inbox and composer for writing to parents one-to-one, a marketing pipeline for branded campaigns to your live audiences, and the automatic emails ActivityOS sends for you.",
    "doneLine": "Write to parents from the Inbox, fire branded campaigns at your live audiences, let ActivityOS send the routine emails for you, and read the numbers to see what's landing.",
    "steps": [
      {
        "find": "Inbox",
        "line": "Everything on this page lives under a row of eight tabs — the first two are your one-to-one mailbox and writing desk, the middle three run your bulk marketing, and the last three are the emails ActivityOS sends automatically plus your settings."
      },
      {
        "find": "Audiences",
        "line": "These aren't fixed lists — each is a live rule that recounts from your bookings every send, with opt-outs always left out; they split into your booked parents and your enquiries, interested folk who've yet to book."
      },
      {
        "find": "Automatic emails",
        "line": "Beyond what you write, ActivityOS quietly sends a batch on your behalf — booking confirmations, receipts, session reminders, late-collection alerts and review requests — and this tab is where you switch any off or change when the reminders go out."
      },
      {
        "find": "Compose",
        "line": "To write one yourself, you press Compose, and this composer opens.",
        "click": true
      },
      {
        "find": "Who gets it",
        "line": "First, choose who it's going to — all your families, everyone booked on one listing, or, as here, a single address; we'll pop in Sarah's email, since she asked about the August camp.",
        "fill": [
          [
            "Recipient",
            "sarah.thompson@gmail.com"
          ]
        ],
        "pick": [
          "Specific people"
        ]
      },
      {
        "find": "Subject",
        "line": "Next the subject line — the first thing families read in their inbox, so we'll make it count.",
        "fill": [
          [
            "Subject",
            "Places on our August multi-sports camp and autumn clubs"
          ]
        ]
      },
      {
        "find": "Message",
        "line": "Then the message itself — you write it right here, with photos, attachments, a saved signature and a Help-me-write button all to hand.",
        "fill": [
          [
            "Message",
            "Hi Sarah, thanks for your enquiry. We've a few places left on our August Multi-Sports Camp for ages 5 to 11, running 9am to 3.30pm at £45 a day. Our after-school Football Club and Saturday Gymnastics Class both restart in September from £6 a session. Shall I hold a spot for your daughter?"
          ]
        ]
      },
      {
        "find": "Send to 1 recipient",
        "line": "And that's it — press Send to 1 recipient and it's on its way, with a short undo-send window in case you have second thoughts."
      }
    ]
  },
  "customers": {
    "title": "Families",
    "introLine": "This is your self-filling little black book (the page calls it Leads and customers) — every booking quietly pops the family in here, so you only ever type when someone rings up or you spot a correction, and you can see exactly where each family sits from first enquiry to happy regular.",
    "doneLine": "And that's Families — a CRM that mostly fills itself in, so you can spend your time chasing bookings rather than typing them up.",
    "steps": [
      {
        "find": "Leads & customers",
        "line": "This page is your self-filling little black book. Every booking quietly drops the family in here, so you only ever type when someone rings up or you spot a correction."
      },
      {
        "find": "All families",
        "line": "The tiles across the top are your funnel and your filter in one. Each count shows where families have got to, and tapping a tile narrows the list to just that stage — leads, invited, customers and repeats."
      },
      {
        "find": "⬇ Export",
        "line": "Two shortcuts sit up here. Import bulk-adds families from a spreadsheet and can invite them in one go, and Export pulls any slice of your list — your pick of families, columns and format. These show only for you, never for staff, who see the page read-only."
      },
      {
        "find": "＋ Add family",
        "line": "For the manual cases — say a parent rings up — you press Add family, and this form opens.",
        "click": true
      },
      {
        "find": "First name",
        "line": "Pop the parent's details straight in — first name, surname, email, and a phone number if they gave one.",
        "fill": [
          [
            "First name",
            "Priya"
          ],
          [
            "Surname",
            "Sharma"
          ],
          [
            "Email",
            "priya.sharma@gmail.com"
          ],
          [
            "Phone",
            "07700 900318"
          ]
        ]
      },
      {
        "find": "Notes",
        "line": "Jot down what they told you in the notes. Only your team ever sees this, never the family — so the camp and club they asked about, the children's ages, and the site they want all live here for when you follow up.",
        "fill": [
          [
            "Notes",
            "Rang about the 3–7 August multi-sports camp (£120) for Maya, 8, and a Saturday football club for Arjun, 5 — also keen on a term-time gymnastics class. Prefers the Bedford site."
          ]
        ]
      },
      {
        "find": "They said yes to hearing about upcoming activities",
        "line": "Only tick this if they actually agreed on the call. Marketing email without consent is unlawful, and this box is your record that they said yes.",
        "pick": [
          "They said yes to hearing about upcoming activities"
        ]
      },
      {
        "find": "✉ Save & send sign-up link",
        "line": "Press Save and send sign-up link and it does both at once — files the family and emails them a link to set a password and land in their own area, where they add their own children. Plain Save just files them without the email."
      }
    ]
  },
  "ratios": {
    "title": "Ratios and groups",
    "introLine": "This is your live cover board — it sorts the day's booked children into age groups from your registers and checks each one against your own ratio targets, so you can tell at a glance whether every group's properly staffed.",
    "doneLine": "Scope the board, follow your policy and work the cards, and you'll spot a short group long before the session ever runs.",
    "steps": [
      {
        "find": "Children on site",
        "line": "Start by picking the season, the camp and the day with the arrows or the date picker. The three tiles then give you the headline — how many children are in, whether they're covered, and how many groups are running."
      },
      {
        "find": "Your ratio policy",
        "line": "This table is here for reference only. The colours, age bands and targets are your own policy — activity camps aren't bound by statutory ratios — and they're edited over in Setup, where every board reads from the one master record."
      },
      {
        "find": "Cover by age group",
        "line": "This is the daily workspace. Every booked child drops into a coloured card by age, and each card tells you whether that group's in ratio. You can drag a child between cards to regroup them, and flip to By time to re-check cover for each arrival and pickup window."
      },
      {
        "find": "＋ Add",
        "line": "Now let's staff it. Down in Your team you build your roster — pop in a name and their role. We'll add Jamie Okafor as a Sports Coach on the Summer Multi-Sports Camp.",
        "fill": [
          [
            "Name",
            "Jamie Okafor"
          ],
          [
            "Role",
            "Sports Coach"
          ]
        ]
      },
      {
        "find": "＋ Add",
        "line": "Press Add, and Jamie joins the team, ready to place on the board.",
        "click": true
      },
      {
        "find": "＋ Assign to group…",
        "line": "Now assign a coach to a group. Open a dropdown in the team roster and pick where they go — we'll drop them in with the Explorers, the eight to ten year olds.",
        "fill": [
          [
            "Assign to group",
            "Explorers"
          ]
        ]
      },
      {
        "find": "Staff on duty",
        "line": "And that's it — the Explorers card shows them in ratio and the Staff on duty tile ticks up straightaway. There's no Save button to hunt for; every change here saves on its own and is shared with the rest of your team."
      }
    ]
  }
};

export const CREATE_SETTINGS: Record<string, SettingsLink[]> = {
  "marketing": [
    {
      "icon": "🏷️",
      "label": "Vouchers and discounts",
      "tab": "vouchers",
      "note": "Set your defaults for codes and gift vouchers — how they behave at checkout and what parents can redeem."
    },
    {
      "icon": "🎁",
      "label": "Refer a friend",
      "tab": "refer",
      "note": "Turn on referral rewards so happy parents earn their own codes for bringing new families in."
    },
    {
      "icon": "⭐",
      "label": "Memberships",
      "tab": "memberships",
      "note": "Bundle standing perks and member-only discounts for your regulars, separate from one-off codes."
    }
  ],
  "medication": [
    {
      "icon": "💊",
      "label": "Medication settings",
      "tab": "medication",
      "note": "require a witness on each dose, limit recording to leads, and choose when parents are told"
    }
  ],
  "incidents": [
    {
      "icon": "🛡️",
      "label": "Safeguarding",
      "tab": "safeguarding",
      "note": "who is alerted and whether parents must acknowledge a record"
    }
  ],
  "accidents": [
    {
      "icon": "🛡️",
      "label": "Safeguarding",
      "tab": "safeguarding",
      "note": "who is alerted and acknowledgement rules"
    }
  ],
  "newsfeed": [
    {
      "icon": "🔔",
      "label": "Notifications",
      "tab": "notifications",
      "note": "Choose which newsfeed posts also ping families with a push notification."
    },
    {
      "icon": "🎨",
      "label": "Branding",
      "tab": "branding",
      "note": "Your provider name and logo auto-fill the newsletter banner and footer."
    },
    {
      "icon": "🏢",
      "label": "Company details",
      "tab": "company",
      "note": "Your phone, email and address seed the newsletter footer so families can reach you."
    }
  ],
  "documents": [
    {
      "icon": "🛡️",
      "label": "Safeguarding",
      "tab": "safeguarding",
      "note": "Set your safeguarding lead and policy details that the policies you upload here back up."
    },
    {
      "icon": "👥",
      "label": "Staff",
      "tab": "staff",
      "note": "Keep track of staff certificates like DBS and paediatric first aid alongside the files stored here."
    },
    {
      "icon": "🏢",
      "label": "Company",
      "tab": "company",
      "note": "Keep your company and insurance details current so the certificates in Documents always match."
    }
  ],
  "moments": [
    {
      "icon": "🛡️",
      "label": "Photo consent",
      "tab": "safeguarding",
      "note": "Only children whose family gave photo consent can appear in a child photo — the gate that keeps Moments safe."
    },
    {
      "icon": "🔔",
      "label": "Parent notifications",
      "tab": "notifications",
      "note": "Controls the alert and email a parent gets when their child is featured in a new moment."
    },
    {
      "icon": "🧩",
      "label": "Features",
      "tab": "features",
      "note": "Turn the Moments area on or off for your setting."
    }
  ],
  "meals": [
    {
      "icon": "🍽️",
      "label": "Meal settings",
      "tab": "meals",
      "note": "caterer email, order cut-offs and sharing"
    }
  ],
  "timetable": [
    {
      "icon": "🧒",
      "label": "Age groups",
      "tab": "groups",
      "note": "The bands you set here pre-fill the builder's Groups step."
    },
    {
      "icon": "📅",
      "label": "Seasons",
      "tab": "seasons",
      "note": "Season date ranges make setting the camp dates a single tap."
    },
    {
      "icon": "👥",
      "label": "Staff",
      "tab": "staff",
      "note": "Staff accounts are who receives their sessions when you publish."
    }
  ],
  "registers": [
    {
      "icon": "📋",
      "label": "Register settings",
      "tab": "registers",
      "note": "sign-in and collection rules, sign-in timestamps, the collection PIN, and which quick-action links show on each row"
    },
    {
      "icon": "📅",
      "label": "Seasons",
      "tab": "seasons",
      "note": "the holiday and term date ranges that fill the register's season filter"
    }
  ],
  "staff": [
    {
      "icon": "👷",
      "label": "Staff and workforce",
      "tab": "staff",
      "note": "roles, invites and the note added to every invite email"
    },
    {
      "icon": "🛡️",
      "label": "Safeguarding",
      "tab": "safeguarding",
      "note": "require a valid DBS and in-date certificates before staff start"
    }
  ],
  "trips": [
    {
      "icon": "🚌",
      "label": "Trips and visits",
      "tab": "trips",
      "note": "parent notify, consent and your ratio target"
    }
  ],
  "expenses": [
    {
      "icon": "💸",
      "label": "Money settings",
      "tab": "money",
      "note": "Choose cash or accrual basis, switch on the Purchase orders tab, and fold your own ActivityOS plan fee in as a monthly cost."
    },
    {
      "icon": "🗓️",
      "label": "Seasons",
      "tab": "seasons",
      "note": "Set your term and holiday date ranges so you can filter spending by season across the money pages."
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
      "note": "Sets your business name and the reply-to address families see when you email them."
    },
    {
      "icon": "🎨",
      "label": "Branding",
      "tab": "branding",
      "note": "Your logo and colours, used across branded campaigns and email signatures."
    },
    {
      "icon": "🔔",
      "label": "Notifications",
      "tab": "notifications",
      "note": "Choose which of the automatic emails go out, and when the reminders fire."
    }
  ],
  "customers": [
    {
      "icon": "❓",
      "label": "Child questions",
      "tab": "people",
      "note": "what parents fill in about each child"
    },
    {
      "icon": "🛡️",
      "label": "Safeguarding and consent",
      "tab": "safeguarding",
      "note": "require a date of birth, ask photo consent and collect SEND details"
    }
  ],
  "ratios": [
    {
      "icon": "👥",
      "label": "Age groups and rooms",
      "tab": "groups",
      "note": "the groups and rooms children are placed in"
    },
    {
      "icon": "🛡️",
      "label": "Safeguarding",
      "tab": "safeguarding",
      "note": "when EYFS ratios apply"
    }
  ]
};
