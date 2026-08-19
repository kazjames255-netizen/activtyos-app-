// AUTO-GENERATED new CPD courses (camp/club H&S + operations) authored + grounded in
// HSE / gov.uk / NHS / NCSC. Each has lessons, a quiz, and two videos. Merged into
// SEED_LIBRARY (courseContent) and COURSE_VIDEOS (courseVideos).
import type { CourseDoc, MotionScene } from "./courseContent";
export type NVBlock = { k: "motion"; title?: string; scenes: MotionScene[] };
export const NEW_COURSES: CourseDoc[] = [
 {
  "id": "c41",
  "title": "COSHH — Hazardous Substances",
  "cat": "Recommended",
  "cover": "shield",
  "category": "health",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "COSHH — Hazardous Substances is a CPD course for holiday-camp and activity-club staff who store, use or clean up chemicals, from sanitiser and bleach to glue, paint, cleaning sprays and even sun cream. It is built on the Control of Substances Hazardous to Health Regulations 2002, GHS/CLP hazard labelling and the HSE hierarchy of control. You will learn to read a hazard label, use a safety data sheet, and keep children and colleagues safe.",
  "lessons": [
   {
    "id": "l1",
    "title": "What COSHH is and why it matters",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "COSHH stands for the Control of Substances Hazardous to Health Regulations 2002. It covers the everyday chemicals a camp or club actually uses — cleaning products, sanitiser and hand gel, bleach, paints and glues, aerosols, art and craft materials, and even dust or fumes created by a task. As an activity provider we are not a school and are not obliged by education rules, but we adopt the COSHH standard as good practice because it keeps children and staff safe."
     },
     {
      "k": "points",
      "title": "Things at camp that COSHH covers",
      "items": [
       "Cleaning sprays, disinfectants, bleach and toilet products",
       "Hand sanitiser, sun cream and first-aid antiseptics",
       "Glue, paint, marker pens and craft chemicals",
       "Aerosols, weed killer and pool or water-play chemicals",
       "Dust and fumes made by an activity, such as sanding or a smoke machine"
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "The legal duty",
      "t": "The COSHH Regulations 2002 require the employer to prevent or, where that is not reasonably practicable, adequately control exposure to substances hazardous to health. Everyone who uses a product shares the duty to follow the safe method — that includes you."
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "What COSHH does not cover",
      "t": "Some hazards have their own separate rules and sit outside COSHH: asbestos, lead, and radioactive substances. Fire and explosion risks from flammable products are handled under fire safety law, though COSHH still covers their effect on health."
     },
     {
      "k": "check",
      "q": "Which standard do we follow for hazardous substances at camp?",
      "opts": [
       "The COSHH Regulations 2002",
       "The Highway Code",
       "The Data Protection Act 2018"
      ],
      "a": 0,
      "fb": "COSHH 2002 is the standard we adopt as good practice for storing, using and cleaning up hazardous substances."
     }
    ]
   },
   {
    "id": "l2",
    "title": "Routes of exposure and who is at risk",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "A substance can only harm you if it gets into or onto the body. Knowing the routes helps you spot where the risk really is — a bleach splash to the eye, breathing in aerosol mist in a poorly ventilated store cupboard, or gel left on hands before lunch."
     },
     {
      "k": "points",
      "title": "The main routes of exposure",
      "items": [
       "Breathing in — vapours, mist, gases, dust or fumes",
       "Skin or eye contact — splashes, spills or handling",
       "Swallowing (ingestion) — hand-to-mouth, or decanted into a cup or bottle",
       "Injection — rare, but broken skin or a sharp can let substances in"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Children raise the stakes",
      "t": "Children breathe faster for their size, put hands to mouths, and are naturally curious. A product that is low-risk for an adult in a workshop can be a real hazard around a group of eight-year-olds. Store everything locked away and out of reach."
     },
     {
      "k": "check",
      "q": "What does a route of exposure mean?",
      "opts": [
       "The path a substance takes into the body — breathing, skin or swallowing",
       "The route the minibus takes to the venue",
       "The weekly cleaning schedule"
      ],
      "a": 0,
      "fb": "Routes of exposure are how a substance enters the body: inhalation, skin or eye contact, swallowing, or injection."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Reading the label — CLP pictograms",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Under the GHS/CLP labelling system, hazards are shown as pictograms: a red diamond with a white background and a black symbol. The label also carries a signal word — Danger for the more serious hazards and Warning for the less serious — plus short hazard and precaution statements. Read the label before you open or use anything."
     },
     {
      "k": "points",
      "title": "Common red-diamond pictograms",
      "items": [
       "Corrosion symbol — corrosive; burns skin, eyes or metal (e.g. strong descaler)",
       "Flame — flammable (e.g. aerosols, some cleaners, alcohol gel)",
       "Exclamation mark — irritant or harmful; can sting skin, eyes or airways",
       "Skull and crossbones — acutely toxic; a little can seriously harm",
       "Health-hazard symbol — a longer-term serious health hazard"
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Signal word first",
      "t": "A quick way to judge severity: find the signal word. 'Danger' means the more serious hazard; 'Warning' means less serious. Either way, follow the precaution statements printed underneath."
     },
     {
      "k": "check",
      "q": "A flame pictogram on a red diamond warns that the product is...",
      "opts": [
       "Flammable",
       "Edible",
       "Waterproof"
      ],
      "a": 0,
      "fb": "The flame symbol means flammable — keep it away from heat, sparks and naked flames, and store it correctly."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Safety data sheets and assessment",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Every hazardous product should come with a safety data sheet (SDS) — a standard 16-section document from the supplier. It is the go-to source for the hazards, safe handling and storage, what PPE to wear, first aid, and what to do about spills. Our COSHH assessment is built from it and turned into a simple safe method for the task."
     },
     {
      "k": "steps",
      "title": "Using an SDS in practice",
      "items": [
       {
        "h": "Find it",
        "t": "Keep supplier SDSs together in the COSHH folder or on file, one per product."
       },
       {
        "h": "Check the hazards",
        "t": "Read the hazards and the handling, storage and PPE sections before first use."
       },
       {
        "h": "Know the first aid",
        "t": "Note the first-aid and spill advice so you can act fast if something goes wrong."
       },
       {
        "h": "Follow the assessment",
        "t": "Work to the COSHH assessment method our named person has written for that product."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Assess before you use",
      "t": "Regulation 6 of COSHH requires a suitable and sufficient assessment of the risk before a hazardous substance is used. In practice our named person completes a COSHH assessment for each product, and you follow the safe method it sets out."
     },
     {
      "k": "check",
      "q": "What is the best single source for a product's hazards and first aid?",
      "opts": [
       "Its safety data sheet (SDS)",
       "A colleague's memory",
       "The product's TV advert"
      ],
      "a": 0,
      "fb": "The supplier's safety data sheet is the definitive source, and our COSHH assessment is built from it."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Controlling exposure and handling spills",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "COSHH puts prevention first: the safest control is not to use a hazardous substance at all, or to swap it for a safer one. Where you must use it, controls follow a hierarchy, with personal protective equipment as the last line — never the first."
     },
     {
      "k": "steps",
      "title": "The hierarchy of control",
      "items": [
       {
        "h": "Eliminate or substitute",
        "t": "Do without the substance, or choose a safer alternative — for example a milder cleaner."
       },
       {
        "h": "Control at source",
        "t": "Use ventilation, enclosed methods, smaller quantities and safe work systems."
       },
       {
        "h": "Organisational measures",
        "t": "Limit who is exposed and for how long; keep children well away."
       },
       {
        "h": "PPE as a last resort",
        "t": "Add gloves, goggles or an apron only where risk remains after the steps above."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Prevent first, control second",
      "t": "Regulation 7 of COSHH places prevention above all: exposure must be prevented where reasonably practicable, and only where it cannot be must it be adequately controlled. PPE is the final layer, not the plan."
     },
     {
      "k": "points",
      "title": "Everyday good practice",
      "items": [
       "Keep products in their original, labelled containers — never a cup or drinks bottle",
       "Store hazardous items locked, upright and away from food and children",
       "Ventilate when cleaning; never mix bleach with other products",
       "Know where the spill kit is and clean small spills promptly",
       "Report a spill, splash or reaction and record it"
      ]
     },
     {
      "k": "check",
      "q": "Under the hierarchy of control, PPE such as gloves should be...",
      "opts": [
       "A last resort, after other controls",
       "The first and only control",
       "Never used at all"
      ],
      "a": 0,
      "fb": "PPE is the final layer. COSHH wants exposure prevented or controlled at source first; gloves and goggles back that up."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "Which regulations set the UK standard we follow for hazardous substances at work?",
    "opts": [
     "The COSHH Regulations 2002",
     "The Highway Code",
     "The Data Protection Act 2018"
    ],
    "a": 0,
    "fb": "The Control of Substances Hazardous to Health Regulations 2002 is the standard we adopt as good practice."
   },
   {
    "q": "Which of these is a common route of exposure to a hazardous substance?",
    "opts": [
     "Breathing in vapours, mist or dust",
     "Reading the label out loud",
     "Storing a bottle upright"
    ],
    "a": 0,
    "fb": "The main routes are inhalation, skin or eye contact, swallowing, and rarely injection."
   },
   {
    "q": "A red diamond showing a corrosion symbol means the product is...",
    "opts": [
     "Corrosive — it can burn skin and eyes",
     "Safe to taste",
     "Only ever a mild irritant"
    ],
    "a": 0,
    "fb": "The corrosion pictogram means corrosive; handle with the PPE and method on the safety data sheet."
   },
   {
    "q": "What is the first thing COSHH asks you to try when controlling a hazardous substance?",
    "opts": [
     "Eliminate it, or swap it for a safer alternative",
     "Hand out gloves straight away",
     "Open a window and hope"
    ],
    "a": 0,
    "fb": "Prevention is first: do without it or substitute a safer product before relying on controls or PPE."
   },
   {
    "q": "Where would you find handling, storage and first-aid advice for a product?",
    "opts": [
     "Its safety data sheet",
     "The staff rota",
     "The fire log"
    ],
    "a": 0,
    "fb": "The supplier's 16-section safety data sheet covers hazards, handling, storage, PPE and first aid."
   },
   {
    "q": "A colleague pours bleach into an unlabelled drinks bottle. You should...",
    "opts": [
     "Stop it — chemicals must stay in labelled containers",
     "Ignore it, it's only bleach",
     "Top it up with more bleach"
    ],
    "a": 0,
    "fb": "Decanting into unlabelled cups or bottles risks a child or adult swallowing it. Keep products in labelled containers."
   }
  ]
 },
 {
  "id": "c42",
  "title": "Display Screen Equipment (DSE)",
  "cat": "Recommended",
  "cover": "shield",
  "category": "health",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "A practical Display Screen Equipment (DSE) course for holiday-camp and activity-club staff who use laptops, tablets and phones for registers, bookings, rotas and admin. You'll learn to assess your workstation, sit comfortably, take the right breaks and claim an eye test. It is built on the Health and Safety (Display Screen Equipment) Regulations 1992, which we follow as good practice.",
  "lessons": [
   {
    "id": "l1",
    "title": "Screens, DSE and the law",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Display Screen Equipment (DSE) means any device with a screen you work at — a desktop monitor, laptop, tablet or smartphone. At a holiday camp or activity club that covers the tablet you take the register on, the laptop for bookings and rotas, and the phone you use to message parents and log incidents. The Health and Safety (Display Screen Equipment) Regulations 1992 set out how to use screens safely, and we follow them as good practice."
     },
     {
      "k": "points",
      "title": "What counts as DSE at your club",
      "items": [
       "The reception laptop for bookings, invoicing and emails",
       "Tablets used for registers, headcounts and activity photos",
       "Smartphones for parent messages and incident logs",
       "Any monitor at a shared office or hot-desk"
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "The legal standard",
      "t": "The Health and Safety (Display Screen Equipment) Regulations 1992 require the employer to protect staff who use screens regularly — by assessing workstations, reducing the risks found, planning breaks, arranging eye tests on request, and providing training."
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Are you a 'DSE user'?",
      "t": "HSE treats you as a DSE 'user' if you use screens daily for continuous periods of an hour or more. A quick glance at a tablet during a game doesn't count; an hour on the booking system does."
     },
     {
      "k": "check",
      "q": "Which of these makes someone a DSE 'user' under the 1992 Regulations?",
      "opts": [
       "Checking a phone message once during the day",
       "Using a screen daily for an hour or more at a time",
       "Only staff with a fixed office desk"
      ],
      "a": 1,
      "fb": "Correct — daily use for continuous periods of an hour or more makes you a user, wherever you happen to sit."
     }
    ]
   },
   {
    "id": "l2",
    "title": "Assessing your workstation",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Before long stretches of screen work we assess the workstation to spot and reduce risks. This isn't just for a fixed desk — it applies to home working, hot-desking in the church hall, and the reception counter too. The aim is to prevent aches, fatigue and eye strain before they start."
     },
     {
      "k": "steps",
      "title": "Running a workstation assessment",
      "items": [
       {
        "h": "Check the screen",
        "t": "Is it clean, glare-free, about an arm's length away and roughly at eye level?"
       },
       {
        "h": "Check the chair and desk",
        "t": "Can you adjust the seat so forearms are level and feet are supported?"
       },
       {
        "h": "Check the input devices",
        "t": "Are the keyboard and mouse close, with room to rest your wrists?"
       },
       {
        "h": "Check the space",
        "t": "Enough legroom, decent lighting and no trailing cables at the desk?"
       },
       {
        "h": "Log and fix",
        "t": "Note any problems and sort them, or tell your manager if you need better kit."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Use the HSE checklist",
      "t": "HSE publishes a free DSE workstation checklist. Work through it once when you start, and again whenever your setup changes — like moving to a new venue for the summer holiday club."
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "The employer's duty to assess",
      "t": "Under the 1992 Regulations the employer must analyse each user's workstation and reduce the risks found. Flagging a wobbly chair or a screen you keep squinting at helps us meet that duty."
     },
     {
      "k": "check",
      "q": "Where do workstation assessments apply?",
      "opts": [
       "Only at a permanent office desk",
       "Fixed desks, home working, hot-desks and reception counters",
       "Only after someone reports pain"
      ],
      "a": 1,
      "fb": "Right — the duty follows the user, including home working, hot-desking and temporary holiday-club venues."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Posture and setting up",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Most screen aches come from posture, not the screen itself. A few quick adjustments to your chair, screen and keyboard keep your neck, back and wrists relaxed through a long shift."
     },
     {
      "k": "points",
      "title": "A comfortable posture",
      "items": [
       "Top of the screen roughly at eye level, about an arm's length away",
       "Forearms roughly horizontal with shoulders relaxed",
       "Wrists straight, not bent up or down while typing",
       "Feet flat on the floor or on a footrest",
       "Lower back supported by the chair"
      ]
     },
     {
      "k": "steps",
      "title": "Setting up in a minute",
      "items": [
       {
        "h": "Adjust the chair first",
        "t": "Raise or lower it so your forearms are level with the desk."
       },
       {
        "h": "Sort your feet",
        "t": "Feet flat on the floor; use a footrest or a sturdy box if they dangle."
       },
       {
        "h": "Position the screen",
        "t": "Top of the screen at eye level, tilted to cut glare."
       },
       {
        "h": "Bring devices close",
        "t": "Keyboard and mouse within easy reach so you're not stretching."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Listen to early warning signs",
      "t": "Tingling wrists, a stiff neck or aching shoulders mean your setup needs tweaking. Don't work through them — adjust your chair and screen, and tell your manager if they continue."
     },
     {
      "k": "check",
      "q": "Where should the top of your screen sit?",
      "opts": [
       "Well below eye level so you look down",
       "Roughly at eye level, about an arm's length away",
       "As close to your face as possible"
      ],
      "a": 1,
      "fb": "Correct — the top of the screen roughly at eye level and about an arm's length away keeps your neck neutral."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Breaks, eyes and eye tests",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Screens don't damage your eyesight, but long unbroken stints cause tired eyes, headaches and stiff muscles. Regular breaks and a few simple eye habits keep you fresh for the children."
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Short breaks, often",
      "t": "HSE advises short frequent breaks over long rare ones — around 5 to 10 minutes every hour is better than 20 minutes every 2 hours. Stand, stretch, or switch to a non-screen task like setting up an activity."
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Your right to an eye test",
      "t": "Under the 1992 Regulations, if a DSE user asks for an eye test the employer must arrange one and pay for it. We only have to fund glasses if the test shows you need special ones prescribed just for the screen distance."
     },
     {
      "k": "points",
      "title": "Looking after your eyes",
      "items": [
       "Glance at something distant now and then to relax your focus",
       "Blink often and keep the screen clean",
       "Angle the screen to avoid reflections from windows and lights",
       "Report persistent headaches or blurred vision to your manager"
      ]
     },
     {
      "k": "check",
      "q": "What does HSE suggest for breaks from screen work?",
      "opts": [
       "One 20-minute break every two hours",
       "Short frequent breaks, like 5 to 10 minutes every hour",
       "No breaks are needed on short shifts"
      ],
      "a": 1,
      "fb": "Correct — short frequent breaks beat long infrequent ones for preventing fatigue and eye strain."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Laptops, tablets and phones on the move",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Portable devices are DSE too, and they're the trickiest — small screens and flat keyboards pull you into a hunch. At camp you might take the register on a tablet or answer parents on a phone all day, so these need the same care as a desk."
     },
     {
      "k": "points",
      "title": "Using portable kit safely",
      "items": [
       "For long laptop sessions, raise it on a stand and add a separate keyboard and mouse",
       "Rest tablets on a stand or table rather than holding them for ages",
       "Take extra breaks — small screens tire eyes and thumbs faster",
       "Carry devices in a bag that spreads the weight, not dangling from one hand"
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Dock it when you can",
      "t": "Whenever you're doing a long stretch of admin, dock the laptop or plug into a monitor with a proper keyboard and mouse. Save the bare laptop for quick jobs on the move."
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Watch the poolside hunch",
      "t": "Logging incidents or registers hunched over a phone for long periods strains your neck and thumbs. Bring the device up towards eye level and keep those sessions short."
     },
     {
      "k": "check",
      "q": "You'll do an hour of bookings on a laptop. What's best?",
      "opts": [
       "Balance it on your lap on a low sofa",
       "Raise it on a stand with a separate keyboard and mouse",
       "Hold it up in front of your face the whole time"
      ],
      "a": 1,
      "fb": "Correct — raising the laptop and adding a separate keyboard and mouse protects your neck and wrists."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "Which regulations set the standard for screen work that we follow?",
    "opts": [
     "The Health and Safety (Display Screen Equipment) Regulations 1992",
     "The Working Time Regulations 1998",
     "The COSHH Regulations 2002"
    ],
    "a": 0,
    "fb": "The Health and Safety (Display Screen Equipment) Regulations 1992 are the standard we adopt as good practice."
   },
   {
    "q": "Who counts as a DSE 'user'?",
    "opts": [
     "Anyone who ever touches a screen",
     "Someone using screens daily for an hour or more at a time",
     "Only office-based managers"
    ],
    "a": 1,
    "fb": "A user works at a screen daily for continuous periods of an hour or more."
   },
   {
    "q": "If a user asks for an eye test, the employer must:",
    "opts": [
     "Refuse unless there is an injury",
     "Arrange it and pay for the test",
     "Only pay half the cost"
    ],
    "a": 1,
    "fb": "On request the employer must arrange and pay for the eye test."
   },
   {
    "q": "When must the employer pay for glasses?",
    "opts": [
     "For any glasses the user already owns",
     "Only if special glasses are needed just for the screen distance",
     "Never, in any circumstances"
    ],
    "a": 1,
    "fb": "Glasses are funded only if the test shows special ones are needed specifically for DSE work."
   },
   {
    "q": "What break pattern does HSE recommend for screen work?",
    "opts": [
     "5 to 10 minutes every hour",
     "One long break at lunch only",
     "No breaks on a busy day"
    ],
    "a": 0,
    "fb": "Short frequent breaks are better than long infrequent ones."
   },
   {
    "q": "Where should the top of your screen sit?",
    "opts": [
     "Roughly at eye level, about an arm's length away",
     "As low as possible so you look down",
     "Pressed close to your face"
    ],
    "a": 0,
    "fb": "Top of screen at eye level, about an arm's length away, keeps your neck neutral."
   }
  ]
 },
 {
  "id": "c43",
  "title": "Slips, Trips & Falls",
  "cat": "Recommended",
  "cover": "shield",
  "category": "health",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "A practical CPD course on preventing slips, trips and falls for holiday-camp and activity-club staff. It follows the HSE approach — slips and trips are the single most common cause of injury at work — covering the STF risk factors, spillages, cleaning and housekeeping, and is built on the Health and Safety at Work etc. Act 1974 and the Workplace (Health, Safety and Welfare) Regulations 1992. You will learn to spot everyday hazards on your site, deal with them safely, and report what you cannot fix yourself.",
  "lessons": [
   {
    "id": "l1",
    "title": "Why slips, trips and falls matter",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Slips, trips and falls on the same level are the single most common cause of injury at work in Great Britain — more common than manual handling, being struck by objects, or falls from height. On a busy holiday camp, with children running, wet changing areas, sports kit everywhere and food being carried about, the risk is very real. The HSE (Health and Safety Executive) is the national regulator whose guidance we follow as good practice."
     },
     {
      "k": "points",
      "title": "What the HSE data tells us",
      "items": [
       "Slips and trips account for around 30% of all non-fatal injuries reported by employers",
       "Around 130,000 workers a year suffer a slip, trip or fall on the same level",
       "Many cause more than seven days off work — enough to leave a session short-staffed",
       "Hospitality and catering-style settings record some of the highest injury rates"
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "The legal duty",
      "t": "Under the Health and Safety at Work etc. Act 1974 your employer must protect the health and safety of staff and anyone affected by the activity, so far as is reasonably practicable. The Workplace (Health, Safety and Welfare) Regulations 1992 (Regulation 12) require floors to be suitable, in good condition and free from obstructions. Everyone on site shares the job of keeping it that way."
     },
     {
      "k": "check",
      "q": "Roughly what share of reported workplace injuries are caused by slips and trips on the same level?",
      "opts": [
       "About 5%",
       "About 30%",
       "About 70%"
      ],
      "a": 1,
      "fb": "Around 30% — the largest single cause, which is why even a small spilled squash cup deserves attention."
     }
    ]
   },
   {
    "id": "l2",
    "title": "Spot the hazard: the STF factors",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "The HSE describes slips, trips and falls (STF) as the result of several factors coming together. If you learn to scan for them, you can stop most incidents before they happen. Do a quick mental sweep whenever you enter a space — the sports hall, the dining room, a muddy field entrance."
     },
     {
      "k": "points",
      "title": "The factors to scan for",
      "items": [
       "Contamination — water, mud, food, paint, sand or leaves on the floor",
       "Obstacles — bags, cables, cones, toys and trailing equipment",
       "Flooring — worn, uneven, loose mats or a sudden change of surface",
       "Footwear — children in socks, staff in worn-soled trainers",
       "Environment — poor lighting, glare, or a dark corridor",
       "People and behaviour — running, rushing, carrying tall loads"
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "The rainy-day switch",
      "t": "Weather changes the picture fast. When it rains, entrances, the walk from the field and the changing-room floor become the highest-risk spots. Put mats down, mop up tracked-in water and add a sign before the first child slips, not after."
     },
     {
      "k": "check",
      "q": "A child has walked in from a wet field and left muddy prints across the hall floor. Which STF factor is this?",
      "opts": [
       "Footwear only",
       "Contamination",
       "Poor lighting"
      ],
      "a": 1,
      "fb": "Contamination — mud and water on the floor. Clean it promptly and flag the wet area while it dries."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Spillages and cleaning done right",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Most slips happen on floors that are wet or contaminated, so dealing with spills quickly is the biggest single thing you can do. A dropped juice carton at snack time, a leaking water bottle or a spilt paint pot all need the same fast, calm response."
     },
     {
      "k": "steps",
      "title": "The spill routine",
      "items": [
       {
        "h": "Guard it",
        "t": "Stay by the spill or block it off so no child or colleague walks through while you sort it."
       },
       {
        "h": "Sign it",
        "t": "Put out a wet-floor sign, or send someone to fetch one and the cleaning kit."
       },
       {
        "h": "Clean it",
        "t": "Use the right method for what has spilled — absorb, mop or sweep, following the product guidance."
       },
       {
        "h": "Dry it",
        "t": "Dry the floor fully. A damp floor can be as slippery as a wet one. Remove the sign only once it is genuinely dry."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Cleaning can create the hazard",
      "t": "Mopping leaves a wet floor that people cannot always see. Never mop a busy through-route mid-session without signs and a plan to keep people off it until dry. Where you can, clean high-traffic areas when children are not moving through."
     },
     {
      "k": "check",
      "q": "You have just mopped the dining-room floor and it is still damp. What should you do?",
      "opts": [
       "Leave it — it will dry on its own and no sign is needed",
       "Keep the wet-floor sign out and keep people off until it is fully dry",
       "Tell the children to walk carefully and carry on"
      ],
      "a": 1,
      "fb": "Keep the area signed and closed off until fully dry. A damp floor is still a slip risk, especially for running children."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Housekeeping and keeping walkways clear",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Good housekeeping is simply keeping the site tidy as you go, rather than at the end of the day. On a camp, kit and clutter build up fast — bags by the door, cones left out after a game, craft boxes in the corridor. Every one of those is a trip waiting to happen, and a blocked route is also a problem in a fire."
     },
     {
      "k": "points",
      "title": "Keep routes clear",
      "items": [
       "Store bags, coats and kit in the right place, not across walkways",
       "Tape down or route cables from speakers and laptops away from feet",
       "Put equipment away straight after each activity, not later",
       "Keep fire exits and corridors completely clear at all times",
       "Close drawers and cupboard doors, and pick things up as you spot them"
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "A camp example",
      "t": "After a parachute game the team leaves cones, a rolled mat and two kit bags at the hall entrance while they set up the next session. The next group arrives early, and a child trips on the mat in the doorway. Two minutes of tidying up would have prevented it — clear as you go."
     },
     {
      "k": "check",
      "q": "When is the best time to tidy away equipment after an activity?",
      "opts": [
       "At the very end of the day",
       "Straight after the activity, before the next group arrives",
       "Only if a manager asks you to"
      ],
      "a": 1,
      "fb": "Clear up straight away. Tidying as you go keeps walkways and exits clear and stops clutter building into a hazard."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Report, record and act",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Some hazards you can fix in seconds — a spill, a bag in a doorway. Others need someone else: a loose floor tile, a broken light, a worn mat, a puddle from a leaking roof. Your job is to make it safe as best you can and make sure the right person knows, so it gets fixed properly."
     },
     {
      "k": "steps",
      "title": "What to do with a hazard you cannot fix",
      "items": [
       {
        "h": "Make it safe now",
        "t": "Guard, sign or cordon off the area so no one is hurt in the meantime."
       },
       {
        "h": "Report it",
        "t": "Tell your supervisor or use the hazard-reporting route your site uses — don't assume someone else already has."
       },
       {
        "h": "Log it",
        "t": "Record it so there is a written trail, including near misses where someone nearly slipped."
       },
       {
        "h": "Follow up",
        "t": "Check it has actually been dealt with, especially if children are still using the area."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Near misses count",
      "t": "If someone nearly slips but isn't hurt, still report it. A near miss is a free warning — reporting it lets the hazard be fixed before the next person is not so lucky."
     },
     {
      "k": "check",
      "q": "You spot a loose, curling edge on a corridor mat that you cannot fix yourself. What is the right response?",
      "opts": [
       "Ignore it — no one has tripped yet",
       "Make the area safe, report it to your supervisor and log it",
       "Wait until the end of the season and mention it then"
      ],
      "a": 1,
      "fb": "Make it safe, report it and log it. Acting on hazards early — including near misses — is how falls are prevented."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "Slips, trips and falls on the same level are best described as:",
    "opts": [
     "A rare cause of workplace injury",
     "The single most common cause of workplace injury",
     "Only a risk in factories"
    ],
    "a": 1,
    "fb": "They are the most common cause of injury at work, which is why they matter on every camp and club site."
   },
   {
    "q": "Which regulation requires floors to be suitable, in good condition and free from obstructions?",
    "opts": [
     "The Workplace (Health, Safety and Welfare) Regulations 1992",
     "The Data Protection Act 2018",
     "The Highway Code"
    ],
    "a": 0,
    "fb": "Regulation 12 of the Workplace (Health, Safety and Welfare) Regulations 1992 covers the condition of floors and traffic routes."
   },
   {
    "q": "What is the most common surface condition behind slips at work?",
    "opts": [
     "Perfectly dry, level floors",
     "Wet or contaminated floors",
     "Carpeted floors only"
    ],
    "a": 1,
    "fb": "Most slips happen on wet or contaminated floors, so fast spill clean-up is the biggest win."
   },
   {
    "q": "You finish mopping a corridor and it is still damp. The safest action is to:",
    "opts": [
     "Remove the sign because you have finished",
     "Keep it signed and keep people off until fully dry",
     "Ask children to hop across"
    ],
    "a": 1,
    "fb": "A damp floor is still slippery. Keep it signed and closed off until it is genuinely dry."
   },
   {
    "q": "After a game you have cones, a mat and kit bags by the hall doorway. Best practice is to:",
    "opts": [
     "Leave them until the end of the day",
     "Clear them away before the next group arrives",
     "Push them slightly to one side"
    ],
    "a": 1,
    "fb": "Clear as you go. Keeping walkways and exits clear stops trips and keeps escape routes open."
   },
   {
    "q": "Someone nearly slips on a leak you cannot fix yourself. You should:",
    "opts": [
     "Do nothing, as no one was hurt",
     "Make the area safe, report it and log the near miss",
     "Only tell a colleague informally"
    ],
    "a": 1,
    "fb": "Make it safe, report it and log it. Near misses are early warnings that let a hazard be fixed before someone is injured."
   }
  ]
 },
 {
  "id": "c44",
  "title": "Personal Protective Equipment (PPE)",
  "cat": "Recommended",
  "cover": "shield",
  "category": "health",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "A CPD-style introduction to personal protective equipment (PPE) for holiday-camp and activity-club staff, built on the PPE at Work Regulations 1992 (as amended in 2022). It explains why PPE is the last line of defence in the hierarchy of control, and how to choose, wear, remove, store and care for it correctly. Every lesson uses real club examples — first aid, messy play, outings, cooking and cleaning — so the rules make sense on a busy site.",
  "lessons": [
   {
    "id": "l1",
    "title": "What PPE is — and why it's a last resort",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Personal protective equipment (PPE) is anything you wear to protect yourself from a health or safety risk at work — disposable gloves, aprons, eye protection, high-visibility vests, sturdy footwear and, in some settings, a face covering. On an activity camp you'll reach for it during first aid, messy play, cleaning up spills, cooking and outings."
     },
     {
      "k": "points",
      "title": "The hierarchy of control (PPE sits at the bottom)",
      "items": [
       "Remove the hazard entirely where you can",
       "Swap it for something safer",
       "Use physical controls — guards, barriers, ventilation",
       "Change how people work — rules, rotas, training",
       "PPE last: it only protects the person wearing it, if worn correctly"
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "The standard we work to",
      "t": "Good practice across the sector follows the PPE at Work Regulations 1992, updated by the PPE at Work (Amendment) Regulations 2022. PPE must be treated as the last line of defence — used to control the risk that's left over once other, more reliable controls are in place."
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Why 'last resort' matters",
      "t": "PPE can fail: gloves tear, vests get left in the minibus, goggles fog up. That's why we don't rely on it alone — we remove or reduce the hazard first, then use PPE for what remains."
     },
     {
      "k": "check",
      "q": "Where does PPE sit in the hierarchy of control?",
      "opts": [
       "The first thing to reach for",
       "A last resort, after other controls",
       "Optional if you're careful"
      ],
      "a": 1,
      "fb": "Right. PPE is the last line of defence, used once the hazard can't be fully removed or reduced by more reliable controls."
     }
    ]
   },
   {
    "id": "l2",
    "title": "PPE around the club: what you'll actually use",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "You won't need hard hats or ear defenders like a building site, but the right PPE still matters day to day. Match it to the task and the hazard in front of you."
     },
     {
      "k": "points",
      "title": "Common club PPE and when to use it",
      "items": [
       "Disposable gloves & aprons — first aid, nappy/toilet changes, cleaning up blood, sick or other bodily fluids",
       "Eye protection & aprons — messy science, painting or craft with splashes",
       "High-visibility vests — road crossings, car parks, off-site trips and swimming outings",
       "Oven gloves & aprons — snack prep and hot food in the kitchen",
       "Sturdy, closed-toe footwear — outdoor and adventure activities"
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Sun and skin",
      "t": "Sunscreen and sun hats aren't classed as PPE, but they protect skin on hot days and follow the same logic — shade first (a control), then cover up. Keep spare hats and cream on outdoor days."
     },
     {
      "k": "check",
      "q": "A child has a nosebleed during a craft session. Which PPE fits best?",
      "opts": [
       "Disposable gloves and an apron",
       "Safety goggles and ear defenders",
       "A high-visibility vest"
      ],
      "a": 0,
      "fb": "Correct. Gloves and an apron protect you from contact with blood; goggles or a vest wouldn't address that risk."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Who provides it: your employer's duties and yours",
    "mins": 5,
    "blocks": [
     {
      "k": "callout",
      "tone": "law",
      "title": "Free of charge, and suitable",
      "t": "Under the PPE at Work Regulations 1992 (as amended in 2022), where a risk assessment shows PPE is needed the employer must provide it free of charge, make sure it's suitable and fits, and give you the information, instruction and training to use it. The 2022 amendment extended these duties to casual 'limb (b)' workers — so seasonal and agency camp staff are covered too."
     },
     {
      "k": "points",
      "title": "What your employer must do",
      "items": [
       "Assess the risks and decide what PPE is genuinely needed",
       "Provide it free, in the right size and fit",
       "Keep it maintained, clean, stored and replaced",
       "Train you on how and when to use it"
      ]
     },
     {
      "k": "points",
      "title": "What you must do",
      "items": [
       "Wear the PPE provided for the task",
       "Use it the way you were trained to",
       "Look after it and store it properly",
       "Report any loss, damage or shortage straight away"
      ]
     },
     {
      "k": "check",
      "q": "Who pays for the PPE your role needs?",
      "opts": [
       "You buy your own",
       "Your employer, free of charge",
       "It's split 50/50"
      ],
      "a": 1,
      "fb": "Correct. Where a risk assessment identifies the need, the employer must supply suitable PPE free of charge — including for seasonal and casual staff since the 2022 amendment."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Using PPE correctly: fit, wear, remove",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "PPE only protects you if it's the right item, the right size, and used the right way. A torn glove or a vest worn undone gives a false sense of safety."
     },
     {
      "k": "steps",
      "title": "Gloves, the safe way",
      "items": [
       {
        "h": "Check first",
        "t": "Right size, no tears or holes, in date if disposable."
       },
       {
        "h": "Clean hands, then glove up",
        "t": "Wash or sanitise before putting gloves on."
       },
       {
        "h": "Do the task",
        "t": "Avoid touching your face, phone or clean surfaces while gloved."
       },
       {
        "h": "Peel off inside-out",
        "t": "Remove without touching the dirty outside, then wash your hands again."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Gloves don't replace hand-washing",
      "t": "Always wash your hands before and after wearing gloves. Gloves reduce contact, but hands still need cleaning — especially before helping with food or after first aid."
     },
     {
      "k": "check",
      "q": "The safest way to remove disposable gloves is to...",
      "opts": [
       "Peel them off inside-out without touching the outside",
       "Pull from the fingertips and drop them anywhere",
       "Leave them on for the next task"
      ],
      "a": 0,
      "fb": "Correct. Peeling inside-out keeps whatever's on the outside away from your skin — then wash your hands."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Care, storage and reporting",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "PPE lasts and works when it's looked after. A few seconds at the end of the day keeps the kit ready and safe for the next session."
     },
     {
      "k": "points",
      "title": "Store it well",
      "items": [
       "Clean, dry and away from direct sunlight",
       "In a known, stocked spot — first-aid bag, kitchen, minibus",
       "Single-use items binned after use, never washed and reused",
       "Reusable items checked and cleaned before they go back"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Damaged or missing? Don't improvise",
      "t": "A torn apron, a cracked visor or an empty glove box means the control has failed. Take it out of use, tell your manager, and get it replaced before the activity goes ahead — don't 'make do'."
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Build it into your routine",
      "t": "Add a quick PPE check to your session setup, just like a headcount or a first-aid kit check. Restock at the end of the day so the morning team isn't caught short."
     },
     {
      "k": "check",
      "q": "You notice a torn apron in the first-aid store. You should...",
      "opts": [
       "Use it anyway, it's mostly fine",
       "Bin it and tell your manager so it's replaced",
       "Put it back for someone else"
      ],
      "a": 1,
      "fb": "Correct. Damaged PPE offers no reliable protection — remove it from use, report it, and replace it."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "Which regulations underpin PPE duties in Great Britain?",
    "opts": [
     "The PPE at Work Regulations 1992, as amended in 2022",
     "The Data Protection Act 2018",
     "The Equality Act 2010"
    ],
    "a": 0,
    "fb": "The PPE at Work Regulations 1992, amended in 2022, set out PPE duties for employers and workers."
   },
   {
    "q": "What did the 2022 amendment change?",
    "opts": [
     "It banned the use of PPE at work",
     "It extended PPE duties to casual 'limb (b)' workers",
     "It made PPE entirely optional"
    ],
    "a": 1,
    "fb": "The 2022 amendment extended employers' and workers' PPE duties to casual 'limb (b)' workers, such as seasonal and agency staff."
   },
   {
    "q": "Where does PPE belong in the hierarchy of control?",
    "opts": [
     "Used instead of removing hazards",
     "As the last resort, once other controls are in place",
     "Only on off-site trips"
    ],
    "a": 1,
    "fb": "PPE is the last line of defence — used for the risk that remains after more reliable controls."
   },
   {
    "q": "Before using disposable gloves you should...",
    "opts": [
     "Check they're intact and the right size, with clean hands",
     "Reuse yesterday's pair to save waste",
     "Share one pair between two staff"
    ],
    "a": 0,
    "fb": "Check gloves are undamaged and the right size, and clean your hands first — single-use gloves are never reused."
   },
   {
    "q": "How should PPE be stored between uses?",
    "opts": [
     "Damp and in direct sunlight",
     "Clean, dry and away from sunlight, in a known spot",
     "Anywhere it happens to land"
    ],
    "a": 1,
    "fb": "Store PPE clean, dry and out of sunlight so it's in good condition and ready for the next session."
   },
   {
    "q": "You find a cracked visor in the kit. What should you do?",
    "opts": [
     "Carry on and use it carefully",
     "Take it out of use, report it and get it replaced",
     "Buy your own replacement"
    ],
    "a": 1,
    "fb": "Damaged PPE gives no reliable protection — remove it, report it to your manager, and replace it before the activity."
   }
  ]
 },
 {
  "id": "c45",
  "title": "Electrical Safety & PAT",
  "cat": "Recommended",
  "cover": "shield",
  "category": "health",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "A practical CPD course on electrical safety and portable appliance testing (PAT) for holiday-camp and activity-club staff. You'll learn to spot damaged leads, plugs and appliances, carry out simple user checks, and understand when a formal visual inspection or a PAT test is needed. It's built on the Electricity at Work Regulations 1989 and current HSE guidance (INDG236 and HSG107), which we adopt here as good practice.",
  "lessons": [
   {
    "id": "l1",
    "title": "Why electrical safety matters at your club",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Holiday camps and activity clubs are full of plug-in kit: kettles and urns in the kitchen, laptops and speakers for activities, phone chargers, printers, projectors, extension leads and inflatable pumps. Any of it can develop a fault, and a damaged lead or plug can give a child or colleague an electric shock, a burn, or start a fire."
     },
     {
      "k": "points",
      "title": "What can go wrong",
      "items": [
       "Frayed or cut cables exposing the wires inside",
       "Cracked plugs or bent pins",
       "Overheating, scorch marks or a hot, plasticky smell",
       "Equipment used in the wet, outdoors or near water",
       "Overloaded extension leads and daisy-chained blocks"
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "'Portable' just means it plugs in",
      "t": "A portable appliance is anything that connects to the mains by a plug and lead and can be moved, or is likely to be moved. At camp that covers almost everything except the building's fixed wiring and sockets."
     },
     {
      "k": "check",
      "q": "Which of these is a portable appliance you're responsible for keeping maintained?",
      "opts": [
       "The building's fixed wall sockets",
       "A plug-in kettle in the staff room",
       "The outdoor weather"
      ],
      "a": 1,
      "fb": "Correct — a plug-in kettle is a portable appliance. Fixed wiring is a separate duty handled by a qualified electrician."
     }
    ]
   },
   {
    "id": "l2",
    "title": "The law: Electricity at Work Regulations 1989",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Electrical safety at work is governed by the Electricity at Work Regulations 1989, sitting under the Health and Safety at Work etc. Act 1974. As an activity provider we're not a school, but we adopt these duties as good practice because they keep children and staff safe."
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "The core legal duty",
      "t": "The Electricity at Work Regulations 1989 require that electrical equipment which may cause danger is maintained, so far as is reasonably practicable, to prevent that danger. The law does not say how, by whom, or how often — that's for you to judge on risk."
     },
     {
      "k": "points",
      "title": "What the law does and doesn't say",
      "items": [
       "It does NOT require a PAT test on every appliance every year",
       "It DOES require equipment to be maintained so it stays safe",
       "HSE guidance (INDG236) calls annual testing of all low-risk kit a myth",
       "Frequency should reflect how the equipment is used and moved"
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Risk-based, not calendar-based",
      "t": "A kettle or vacuum that's carried around and knocked about needs checking far more often (roughly every 6–12 months) than a monitor that never moves (every 2–4 years). Match the effort to the real risk."
     },
     {
      "k": "check",
      "q": "What does the Electricity at Work Regulations 1989 actually require?",
      "opts": [
       "A PAT test on everything every single year",
       "Equipment maintained, so far as is reasonably practicable, to prevent danger",
       "Nothing at all for low-risk settings"
      ],
      "a": 1,
      "fb": "Correct. The duty is to maintain equipment to prevent danger — the method and frequency are for you to decide on a risk basis."
     }
    ]
   },
   {
    "id": "l3",
    "title": "User checks: your daily front line",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "User checks are quick look-and-feel checks done by the person about to use the appliance — no tools, no records, no training beyond this course. They're your first and most valuable defence, and everyone at camp should do them as a habit."
     },
     {
      "k": "steps",
      "title": "How to do a ten-second user check",
      "items": [
       {
        "h": "Switch off and unplug",
        "t": "Where you safely can, turn it off and pull the plug before handling it."
       },
       {
        "h": "Run your eye along the cable",
        "t": "Look for cuts, fraying, kinks, or the coloured inner wires showing."
       },
       {
        "h": "Inspect the plug",
        "t": "Check for cracks, bent or loose pins, and scorch marks around it."
       },
       {
        "h": "Check the body and surroundings",
        "t": "Look for a cracked casing, loose parts, burn marks or a hot smell, and make sure it isn't wet or trapped under furniture."
       }
      ]
     },
     {
      "k": "points",
      "title": "Warning signs to look for",
      "items": [
       "Cuts, abrasion or fraying on the cable (beyond normal light wear)",
       "Damage to the plug — cracks, bent pins or scorching",
       "Taped-up joints in the cable or non-standard repairs",
       "Burn marks, staining or a smell of hot plastic",
       "Loose cable grip so the coloured wires could be pulled out",
       "Signs it's been used in the wet or outdoors when it shouldn't be"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Never carry on regardless",
      "t": "If a user check throws up any of these signs, do not use the appliance and do not try a bodge repair with tape. Take it out of use and pass it on. A frayed lead by a splash pool or wet field is a serious hazard around children."
     },
     {
      "k": "check",
      "q": "Before you check an appliance over, what should you do first?",
      "opts": [
       "Leave it switched on so you can test it live",
       "Switch it off and unplug it wherever you safely can",
       "Only glance at the screen or display"
      ],
      "a": 1,
      "fb": "Correct — switch off and unplug first so you can handle and inspect it safely."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Visual inspection and PAT testing explained",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "HSE guidance (HSG107) describes a sensible three-tier approach: user checks, formal visual inspection, and — where needed — combined inspection and testing, commonly called PAT. Most problems never need a tester at all."
     },
     {
      "k": "points",
      "title": "The three tiers of maintenance",
      "items": [
       "User checks — quick looks by users before use, no records",
       "Formal visual inspection — a closer, recorded check by a trained, competent person; this alone finds around 90% of faults",
       "Combined inspection and testing (PAT) — using a portable appliance tester to find hidden faults like poor earth continuity or failing insulation"
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Why the tester still matters sometimes",
      "t": "A PAT machine checks things the eye can't see — for example whether a Class I appliance is still properly earthed, or whether the insulation has broken down inside. It complements looking; it doesn't replace it."
     },
     {
      "k": "points",
      "title": "Class I and Class II",
      "items": [
       "Class I relies on an earth connection for safety (e.g. many kettles, toasters, urns)",
       "Class II is double-insulated and marked with a double-square symbol — no earth needed (e.g. many chargers and hair dryers)",
       "Knowing the class helps whoever tests decide what checks apply"
      ]
     },
     {
      "k": "check",
      "q": "Roughly how many faults are found by a formal visual inspection alone, before any testing?",
      "opts": [
       "About 10%",
       "About half",
       "About 90%"
      ],
      "a": 2,
      "fb": "Correct — HSE guidance indicates a formal visual inspection finds around 90% of faults, which is why looking is so important."
     }
    ]
   },
   {
    "id": "l5",
    "title": "When something's wrong: act, label, record",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Spotting a fault is only useful if you act on it. A clear, consistent routine stops a dangerous appliance being quietly plugged back in by the next member of staff who doesn't know."
     },
     {
      "k": "steps",
      "title": "If you find a fault",
      "items": [
       {
        "h": "Take it out of use",
        "t": "Unplug it and move it away from where children or staff might use it."
       },
       {
        "h": "Label it clearly",
        "t": "Attach a 'Do not use' tag so nobody plugs it back in."
       },
       {
        "h": "Report it",
        "t": "Tell your manager or site lead so it's logged and dealt with."
       },
       {
        "h": "Repair or replace",
        "t": "Only a competent person repairs it; otherwise it's replaced. Then it's re-inspected before returning to use."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Keeping equipment safe is the duty",
      "t": "Under the Electricity at Work Regulations 1989 the goal is to prevent danger. Removing and tagging a faulty appliance, rather than nursing it through the session, is exactly how we meet that duty in practice."
     },
     {
      "k": "points",
      "title": "Good records make life easier",
      "items": [
       "Keep a simple register of appliances and inspection dates",
       "Note faults found and what was done about them",
       "Set review frequencies by risk — moved-around kit checked more often",
       "Records show inspectors and insurers you take safety seriously"
      ]
     },
     {
      "k": "check",
      "q": "You find an extension lead with exposed inner wires mid-session. What do you do first?",
      "opts": [
       "Keep using it until the activity finishes",
       "Take it out of use and label it 'Do not use'",
       "Wrap it in electrical tape and carry on"
      ],
      "a": 1,
      "fb": "Correct — remove it from use and tag it straight away, then report it. Never tape over damage and keep going."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "The main duty under the Electricity at Work Regulations 1989 is to…",
    "opts": [
     "Test every appliance weekly",
     "Maintain equipment, so far as is reasonably practicable, to prevent danger",
     "Only ever buy brand-new equipment"
    ],
    "a": 1,
    "fb": "Correct — the law's core requirement is to maintain equipment to prevent danger, on a risk basis."
   },
   {
    "q": "True or false: the law says every appliance must be PAT tested every year.",
    "opts": [
     "True — always, no exceptions",
     "False — testing frequency should be risk-based, and HSE calls annual testing of all low-risk kit a myth",
     "True, but only kettles need it"
    ],
    "a": 1,
    "fb": "Correct — there's no legal annual-test rule; frequency should match how the equipment is used and moved."
   },
   {
    "q": "During a user check you notice scorch marks around the plug. You should…",
    "opts": [
     "Ignore it as long as it still switches on",
     "Take it out of use, label it and report it",
     "Just change the fuse and carry on"
    ],
    "a": 1,
    "fb": "Correct — scorching is a clear warning sign; remove it from use and report it."
   },
   {
    "q": "A Class II (double-insulated) appliance is identified by…",
    "opts": [
     "A double-square symbol",
     "A red warning triangle",
     "No marking at all"
    ],
    "a": 0,
    "fb": "Correct — the double-square symbol marks a Class II, double-insulated appliance that doesn't rely on an earth."
   },
   {
    "q": "A formal visual inspection is best carried out by…",
    "opts": [
     "Anyone, with no training needed",
     "A competent person who has had suitable training",
     "Only an external electrician, never staff"
    ],
    "a": 1,
    "fb": "Correct — a trained, competent member of staff can do formal visual inspections, which catch around 90% of faults."
   },
   {
    "q": "Which appliance is likely to need checking most often at camp?",
    "opts": [
     "A monitor that never moves",
     "A kettle carried between rooms every day",
     "They both need it at exactly the same interval"
    ],
    "a": 1,
    "fb": "Correct — kit that's moved and knocked about, like a kettle, needs checking far more often than a fixed monitor."
   }
  ]
 },
 {
  "id": "c46",
  "title": "Legionella & Water Hygiene",
  "cat": "Recommended",
  "cover": "shield",
  "category": "health",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "Legionella and Water Hygiene is a CPD course for holiday-camp and activity-club staff who use, clean or oversee water systems such as showers, taps and spray equipment. It explains how legionella bacteria grow, how Legionnaires' disease is caught, and the everyday controls that keep water safe. It is built on the standard set by the HSE Approved Code of Practice L8 and its technical guidance HSG274, which we adopt as good practice.",
  "lessons": [
   {
    "id": "l1",
    "title": "What legionella is and why it matters",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Legionella is a group of bacteria found naturally in water — rivers, lakes and, importantly, in the man-made water systems inside our buildings. On its own it is usually harmless, but when it multiplies and is breathed in, it can cause a serious lung infection called Legionnaires' disease."
     },
     {
      "k": "points",
      "title": "The essentials",
      "items": [
       "Legionnaires' disease is a form of pneumonia (a lung infection).",
       "It is caught by breathing in tiny water droplets (aerosols) that contain the bacteria.",
       "You cannot catch it from drinking water, and it does not pass from person to person.",
       "Symptoms include a high temperature, cough, breathlessness and muscle aches."
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Who is most at risk",
      "t": "Anyone can be affected, but the over-45s, smokers, and people with weakened immune systems or chest conditions are more vulnerable. At a busy summer camp that includes visiting grandparents, colleagues and some children — so control benefits everyone."
     },
     {
      "k": "check",
      "q": "How is Legionnaires' disease usually caught?",
      "opts": [
       "By drinking contaminated water",
       "By breathing in contaminated water droplets",
       "From another person who is infected"
      ],
      "a": 1,
      "fb": "It is caught by inhaling tiny aerosol droplets — for example from a shower or spray hose — not by drinking water, and it is not contagious."
     }
    ]
   },
   {
    "id": "l2",
    "title": "Where legionella hides in your water system",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Legionella needs the right conditions to multiply: water that sits still, is at a warm-ish temperature, and where nutrients like scale, rust, sludge or biofilm can build up. That is why the risk lives in specific parts of a plumbing system rather than everywhere at once."
     },
     {
      "k": "figure",
      "fig": "danger-zone"
     },
     {
      "k": "points",
      "title": "High-risk spots to know",
      "items": [
       "Showers and spray taps — they create the breathable droplets that carry the bacteria.",
       "Water storage tanks and hot-water cylinders (calorifiers).",
       "'Dead legs' — sections of pipe leading to outlets that are rarely or never used.",
       "Spray hoses, water play features, hose reels and any little-used outlet."
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "The danger zone",
      "t": "Legionella multiplies fastest in stagnant water between 20°C and 45°C. It does not really grow below 20°C and does not survive above 60°C. Anywhere water sits warm and still — like a rarely-used shower in an off-season changing block — is exactly where it thrives."
     },
     {
      "k": "check",
      "q": "Why is a 'dead leg' of pipework a legionella risk?",
      "opts": [
       "It carries too much water too quickly",
       "Water sits still there and can warm up, letting bacteria grow",
       "It only ever affects cold taps"
      ],
      "a": 1,
      "fb": "Dead legs hold stagnant water that can sit in the danger-zone temperature range, giving legionella the still, warm conditions it needs to multiply."
     }
    ]
   },
   {
    "id": "l3",
    "title": "The legal duty: ACOP L8 and your responsibilities",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Controlling legionella is not just good sense — it is a legal expectation for anyone in control of premises. The HSE sets out how to do it in the Approved Code of Practice L8, 'Legionnaires' disease: The control of legionella bacteria in water systems', supported by the technical guidance HSG274."
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "The legal duty",
      "t": "Under the Health and Safety at Work etc. Act 1974 and the Control of Substances Hazardous to Health Regulations 2002 (COSHH), duty holders must identify and assess the risk from legionella, and put in place a written scheme to prevent or control it. HSE ACOP L8 is the recognised standard for meeting that duty."
     },
     {
      "k": "steps",
      "title": "What a compliant site puts in place",
      "items": [
       {
        "h": "Assess the risk",
        "t": "A competent person carries out a legionella risk assessment of the water systems and reviews it regularly."
       },
       {
        "h": "Appoint a responsible person",
        "t": "A named 'responsible person' takes charge of managing the controls day to day."
       },
       {
        "h": "Write a control scheme",
        "t": "A written scheme sets out the checks, temperatures and flushing routines, and who does them."
       },
       {
        "h": "Keep records",
        "t": "Monitoring, temperatures and actions are recorded so the site can show the scheme is working."
       }
      ]
     },
     {
      "k": "check",
      "q": "Which standard sets out how to control legionella in water systems?",
      "opts": [
       "HSE Approved Code of Practice L8",
       "The Highway Code",
       "The Food Standards Act"
      ],
      "a": 0,
      "fb": "HSE ACOP L8, backed by the technical guidance HSG274, is the recognised code for controlling legionella in water systems."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Temperature control: keep it hot, keep it cold",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Temperature is the single most important control. Keep hot water genuinely hot and cold water genuinely cold, and you keep it out of the 20–45°C danger zone where legionella multiplies."
     },
     {
      "k": "points",
      "title": "The target temperatures (from HSG274)",
      "items": [
       "Hot water should be stored at 60°C or above.",
       "Hot water should reach at least 50°C at the tap within about a minute of running it.",
       "Cold water should be stored and distributed below 20°C.",
       "Lukewarm water is the warning sign — never ignore a tap or shower that runs tepid."
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "On the ground at camp",
      "t": "When a seasonal building reopens, don't assume the water is safe. Have the responsible person check that hot outlets run properly hot and cold outlets run properly cold before children and staff start using the showers and washrooms."
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Mind the scald risk too",
      "t": "Water hot enough to control legionella (60°C) can scald, especially young children. Sites manage this with mixing at the tap (thermostatic mixing valves) rather than by lowering storage temperatures."
     },
     {
      "k": "check",
      "q": "Hot water should be stored at what minimum temperature?",
      "opts": [
       "Around 30°C",
       "At least 60°C",
       "Below 20°C"
      ],
      "a": 1,
      "fb": "Storing hot water at 60°C or above keeps it too hot for legionella to survive; it should still reach around 50°C at the outlet."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Flushing, cleaning and everyday good practice",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Stagnation is the enemy. Water that sits unused gives legionella time to grow, so the everyday job is simple: keep water moving and keep spray-producing parts clean."
     },
     {
      "k": "steps",
      "title": "Flushing a little-used outlet",
      "items": [
       {
        "h": "Spot the unused outlets",
        "t": "Any tap or shower not used for seven days or more needs attention — think spare washrooms, seldom-used sinks and off-season blocks."
       },
       {
        "h": "Open it gently",
        "t": "Turn the outlet on slowly to avoid creating a spray, and run both hot and cold."
       },
       {
        "h": "Let it run",
        "t": "Run it long enough to draw fresh water through and clear the standing water in the pipe."
       },
       {
        "h": "Record it",
        "t": "Note the flush on the log so there's a clear record the routine is happening."
       }
      ]
     },
     {
      "k": "points",
      "title": "Keeping spray parts clean",
      "items": [
       "Clean and de-scale showerheads and spray taps regularly (at least quarterly is common practice).",
       "Keep water tank lids closed and covers in good condition.",
       "Don't leave hoses full of warm, standing water in the sun.",
       "Flush little-used outlets weekly to stop water going stagnant."
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Avoid making aerosols while you work",
      "t": "When flushing or cleaning, open outlets slowly and stand back from the spray. The aim is to move the water, not to breathe in a fine mist of it."
     },
     {
      "k": "check",
      "q": "An outlet that has not been used for a week or more should be…",
      "opts": [
       "Left alone until someone needs it",
       "Flushed by running the water through it",
       "Sealed off permanently"
      ],
      "a": 1,
      "fb": "Little-used outlets should be flushed — running the water clears the stagnant water where legionella can grow. Outlets no longer needed should be removed, not just left capped as a dead leg."
     }
    ]
   },
   {
    "id": "l6",
    "title": "Spotting problems and reporting",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "You don't need to be a plumber to help keep water safe. Frontline staff are the eyes and ears of the control scheme — noticing and reporting the small warning signs is one of the most valuable things you can do."
     },
     {
      "k": "points",
      "title": "Warning signs to report",
      "items": [
       "Hot taps or showers that only run lukewarm.",
       "Cold water that comes out warm.",
       "Discoloured or smelly water, or debris and scale in tanks.",
       "Dirty or furred-up showerheads and spray taps.",
       "Outlets that clearly haven't been used or flushed for a while."
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "How to report",
      "t": "Tell the site's named responsible person straight away, and log it however your site records issues. Never try to fix water systems or adjust boiler temperatures yourself — that's a job for a competent person."
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Make it a habit",
      "t": "Fold a quick water check into your daily routine — flush the outlets in your area, note anything odd, and pass it on. Small daily habits are what keep the whole scheme working."
     },
     {
      "k": "check",
      "q": "You notice a shower is only running lukewarm. What should you do?",
      "opts": [
       "Ignore it — it will heat up eventually",
       "Report it to the responsible person and log it",
       "Turn the boiler up yourself"
      ],
      "a": 1,
      "fb": "Lukewarm water sits in the danger zone, so report it to the responsible person and record it. Don't adjust the system yourself — leave that to a competent person."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "Legionella bacteria multiply fastest in water at which temperature range?",
    "opts": [
     "Below 20°C",
     "Between 20°C and 45°C",
     "Above 60°C"
    ],
    "a": 1,
    "fb": "The 20–45°C range is the danger zone. Below 20°C legionella is dormant; above 60°C it does not survive."
   },
   {
    "q": "Legionnaires' disease is a type of…",
    "opts": [
     "Skin rash",
     "Pneumonia (a lung infection)",
     "Stomach bug"
    ],
    "a": 1,
    "fb": "It is a serious form of pneumonia, caught by breathing in contaminated water droplets."
   },
   {
    "q": "Which standard sets out how to control legionella in water systems?",
    "opts": [
     "HSE Approved Code of Practice L8",
     "The Highway Code",
     "The Food Standards Act"
    ],
    "a": 0,
    "fb": "HSE ACOP L8, with the technical guidance HSG274, is the recognised code we adopt."
   },
   {
    "q": "How often should little-used taps and showers be flushed?",
    "opts": [
     "Once a year",
     "At least weekly, and after seven or more days unused",
     "Only when they smell"
    ],
    "a": 1,
    "fb": "Flush little-used outlets at least weekly; any outlet unused for seven days or more should be flushed before use."
   },
   {
    "q": "Cold water should be stored and kept below what temperature?",
    "opts": [
     "20°C",
     "45°C",
     "60°C"
    ],
    "a": 0,
    "fb": "Keeping cold water below 20°C stops it warming into the range where legionella multiplies."
   },
   {
    "q": "You spot a water-safety problem, such as lukewarm hot water. What should you do?",
    "opts": [
     "Nothing — it isn't your job",
     "Tell the appointed responsible person and log it",
     "Adjust the boiler yourself"
    ],
    "a": 1,
    "fb": "Report it to the named responsible person and record it. Leave any repairs or temperature changes to a competent person."
   }
  ]
 },
 {
  "id": "c47",
  "title": "Fire Warden / Marshal",
  "cat": "Recommended",
  "cover": "shield",
  "category": "health",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "Fire Warden / Marshal is a CPD e-learning course for holiday-camp and activity-club staff who are nominated to help everyone evacuate safely if there is a fire. It covers how fire starts and spreads, sweeping and roll-call, running realistic drills, and the safe use of extinguishers — all built around the Regulatory Reform (Fire Safety) Order 2005. Complete it to act quickly and calmly as a competent fire warden on any site your club uses.",
  "lessons": [
   {
    "id": "l1",
    "title": "Why fire safety matters — and the law",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "As a fire warden (also called a fire marshal), you are one of the named people who help everyone leave your holiday camp or activity club safely if there is a fire. It is a practical role, not a fire-fighting one: your job is calm, organised evacuation and making sure no child is left behind."
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "The Regulatory Reform (Fire Safety) Order 2005",
      "t": "This Order is the main fire safety law for workplaces and premises in England and Wales. It requires a 'responsible person' to assess the fire risk, put safety measures in place, and appoint enough competent people — that's your fire wardens — to help everyone evacuate."
     },
     {
      "k": "points",
      "title": "What the responsible person must do",
      "items": [
       "Carry out and keep up to date a fire risk assessment for every venue you use",
       "Provide clear evacuation procedures, signage and escape routes",
       "Appoint and train enough fire wardens for the number of children and staff",
       "Run regular fire drills and keep records in a fire safety logbook",
       "Maintain alarms, emergency lighting and extinguishers"
      ]
     },
     {
      "k": "text",
      "t": "Warden or marshal? The titles are often used interchangeably. In practice one role sweeps the building and is last out, while another manages the assembly point outside and takes the roll-call. At a small club the same person may do both — so learn every part of the job."
     },
     {
      "k": "check",
      "q": "Under the Fire Safety Order 2005, who must make sure enough fire wardens are appointed and trained?",
      "opts": [
       "Each individual child's parent",
       "The 'responsible person' for the premises",
       "The local fire and rescue service"
      ],
      "a": 1,
      "fb": "The responsible person — usually the operator or manager — holds the legal duty to assess risk and appoint competent people to help everyone evacuate."
     }
    ]
   },
   {
    "id": "l2",
    "title": "How fire starts and spreads",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Fire needs three things at once: heat (a source of ignition), fuel (something to burn) and oxygen. Remove any one and the fire cannot start or continue — this is the 'fire triangle'. Most prevention is simply keeping these three apart."
     },
     {
      "k": "points",
      "title": "Common fire risks at camps and clubs",
      "items": [
       "Kitchens and snack areas — hobs, toasters, cooking oils and fats",
       "Electrical kit — phone chargers, laptops, PA systems and trailing leads",
       "Craft and science activities using candles, glue guns or other heat sources",
       "Stored clutter — cardboard, paper, decorations and packaging",
       "Blocked or propped-open fire doors and cluttered corridors"
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Good housekeeping prevents most fires",
      "t": "Keep escape routes clear, don't overload sockets, switch off and unplug equipment at the end of the day, store flammable materials safely, and never wedge fire doors open — they hold back smoke and buy children time to get out."
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Smoke is the real danger",
      "t": "Most people harmed in fires are affected by smoke and toxic fumes, not flames. Smoke spreads fast and makes it hard to see and breathe, which is why quick evacuation and closing doors behind you matter so much."
     },
     {
      "k": "check",
      "q": "What three things does a fire need to burn?",
      "opts": [
       "Heat, fuel and oxygen",
       "Wood, paper and plastic",
       "Smoke, heat and water"
      ],
      "a": 0,
      "fb": "Heat, fuel and oxygen make up the fire triangle. Remove any one and the fire goes out — the basis of most fire prevention."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Your role: sweep, roll-call, assembly point",
    "mins": 6,
    "blocks": [
     {
      "k": "callout",
      "tone": "law",
      "title": "Your duty comes from the Order",
      "t": "The Fire Safety Order 2005 requires competent people to help carry out the evacuation. As a warden that means acting quickly and calmly the moment the alarm sounds — you don't wait to confirm there's a real fire first."
     },
     {
      "k": "steps",
      "title": "When the alarm sounds",
      "items": [
       {
        "h": "Raise and confirm",
        "t": "Make sure the alarm has been raised, and call 999 if that hasn't already been done."
       },
       {
        "h": "Move the children",
        "t": "Lead your group calmly to the nearest safe exit, leaving belongings behind."
       },
       {
        "h": "Sweep your area",
        "t": "Check rooms, toilets and cupboards, closing doors behind you as you go."
       },
       {
        "h": "Report and account",
        "t": "Get to the assembly point and confirm your area is clear."
       }
      ]
     },
     {
      "k": "points",
      "title": "At the assembly point (marshal role)",
      "items": [
       "Take the day's register or headcount for every group",
       "Keep children together, away from the building and traffic",
       "Report anyone unaccounted for to the senior person and fire service",
       "Never let anyone drift back toward the building"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Two rules that save lives",
      "t": "Never use lifts during an evacuation, and never go back inside for a bag, a phone or even a person — tell the fire service instead. Trained firefighters can search safely; you cannot."
     },
     {
      "k": "check",
      "q": "You've swept your rooms and reached the assembly point. A child from your group is missing. What do you do?",
      "opts": [
       "Run back inside to search for them",
       "Report it immediately to the fire service and senior person",
       "Wait quietly in case they turn up"
      ],
      "a": 1,
      "fb": "Report a missing child straight away — never re-enter the building. Firefighters have the training and equipment to search safely."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Fire drills and evacuating children safely",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Fire drills turn a plan on paper into something children and staff can do without thinking. The responsible person must run them regularly, and every drill should be timed, reviewed and recorded in the fire logbook so any problems get fixed."
     },
     {
      "k": "points",
      "title": "Running a drill at your club",
      "items": [
       "Choose realistic times — mid-activity, snack time, outdoors — not just an easy moment",
       "Occasionally block one exit so staff practise using an alternative route",
       "Time how long it takes everyone to reach the assembly point",
       "Check registers are grabbed and the roll-call actually works",
       "Debrief afterwards and note anything to improve"
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Plan for children who need extra help",
      "t": "Some children may need support to evacuate — younger ages, additional needs, or reduced mobility. Agree in advance who assists whom (a personal evacuation plan) so no one is overlooked when the alarm sounds. We adopt this good practice from wider HSE and education guidance."
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Keep children calm",
      "t": "Children take their cue from you. A steady voice, clear instructions and a familiar routine keep panic down. Practising drills as a normal part of camp life means the real thing feels manageable."
     },
     {
      "k": "check",
      "q": "Why should you sometimes block an exit during a practice drill?",
      "opts": [
       "To make the drill take longer",
       "To practise using an alternative escape route",
       "To test the fire alarm battery"
      ],
      "a": 1,
      "fb": "A real fire may block your usual way out. Practising alternative routes means children and staff won't freeze if the nearest exit is unavailable."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Fire extinguishers — know before you go",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Tackling a fire is never your first job — getting children out is. Only ever consider using an extinguisher if the fire is small, you have a clear escape route behind you, and you have been trained. If in any doubt, leave it and get out."
     },
     {
      "k": "points",
      "title": "UK extinguisher types (BS EN 3)",
      "items": [
       "Water (red label) — wood, paper and fabric (Class A) only",
       "Foam (cream) — Class A plus flammable liquids (Class B)",
       "CO2 (black) — electrical equipment and flammable liquids",
       "Dry powder (blue) — A, B and flammable gases, but not in small enclosed rooms",
       "Wet chemical (yellow) — cooking oils and fats (Class F)"
      ]
     },
     {
      "k": "steps",
      "title": "Using an extinguisher: PASS",
      "items": [
       {
        "h": "Pull",
        "t": "Pull the safety pin to break the tamper seal."
       },
       {
        "h": "Aim",
        "t": "Aim the nozzle at the base of the flames, not the top."
       },
       {
        "h": "Squeeze",
        "t": "Squeeze the handle to release the agent."
       },
       {
        "h": "Sweep",
        "t": "Sweep side to side across the base until it is out."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Never fight a fire if...",
      "t": "...it is spreading, taller than you, blocking your exit, or you are unsure of the extinguisher type. Never use water on cooking oil or electrical fires. When in doubt, get out, close the door, and call 999."
     },
     {
      "k": "check",
      "q": "Which extinguisher must you never use on an electrical fire?",
      "opts": [
       "CO2 (black)",
       "Water (red)",
       "Dry powder (blue)"
      ],
      "a": 1,
      "fb": "Water conducts electricity and is dangerous on electrical fires. CO2 (black) is the type designed for electrical risks."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "What is the main fire safety law that underpins this course?",
    "opts": [
     "The Health and Safety at Work Act 1974",
     "The Regulatory Reform (Fire Safety) Order 2005",
     "The Children Act 2004"
    ],
    "a": 1,
    "fb": "The Regulatory Reform (Fire Safety) Order 2005 is the main fire safety legislation for premises in England and Wales, and it places duties on the 'responsible person'."
   },
   {
    "q": "What are the three parts of the fire triangle?",
    "opts": [
     "Heat, fuel and oxygen",
     "Alarm, exit and assembly",
     "Water, foam and powder"
    ],
    "a": 0,
    "fb": "Heat, fuel and oxygen. Remove any one and the fire cannot continue — the basis of most prevention."
   },
   {
    "q": "As a warden sweeping the building, what should you do with doors as you leave rooms?",
    "opts": [
     "Prop them open for airflow",
     "Close them behind you",
     "Lock them"
    ],
    "a": 1,
    "fb": "Closing doors slows the spread of smoke and flames, buying children more time to escape."
   },
   {
    "q": "At the assembly point, how do you confirm everyone is safe?",
    "opts": [
     "Ask if anyone saw the fire",
     "Take the register and do a roll-call / headcount",
     "Wait for the alarm to stop"
    ],
    "a": 1,
    "fb": "A roll-call against the day's register is the only reliable way to confirm every child and staff member is out."
   },
   {
    "q": "The PASS technique for using an extinguisher stands for...",
    "opts": [
     "Pull, Aim, Squeeze, Sweep",
     "Point, Alert, Signal, Stop",
     "Pause, Assess, Spray, Silence"
    ],
    "a": 0,
    "fb": "Pull the pin, Aim at the base, Squeeze the handle, Sweep side to side — but only if it is safe to do so."
   },
   {
    "q": "A child is missing at roll-call. What is the correct action?",
    "opts": [
     "Go back inside to find them",
     "Tell the fire service and senior person immediately",
     "Send another child to look"
    ],
    "a": 1,
    "fb": "Never re-enter the building. Report a missing person to the fire service, who are trained and equipped to search safely."
   }
  ]
 },
 {
  "id": "c48",
  "title": "Emergency First Aid at Work",
  "cat": "Recommended",
  "cover": "heart",
  "category": "medical",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "Emergency First Aid at Work is a practical, camp-ready course that teaches your holiday-club and activity staff to recognise a life-threatening emergency and act with confidence in the first vital minutes. It covers the primary survey (DR ABC), CPR and defibrillators, choking, and serious bleeding and shock. It is built on the Health and Safety (First-Aid) Regulations 1981 and the current Resuscitation Council UK 2025 guidelines, adapted as good practice for settings that work with children.",
  "lessons": [
   {
    "id": "l1",
    "title": "First aid at work: the law and your role",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "A holiday camp or activity club is a busy place: sprained ankles, bumped heads, asthma flare-ups and the occasional serious emergency. Emergency First Aid at Work is about being ready for that rare but life-threatening moment, and knowing exactly what to do in the first few minutes before an ambulance arrives."
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Your legal duty",
      "t": "The Health and Safety (First-Aid) Regulations 1981 require every employer to provide adequate and appropriate first-aid equipment, facilities and trained people, so that anyone injured or taken ill at work receives immediate help. This applies to all workplaces, however small, and to the self-employed."
     },
     {
      "k": "points",
      "title": "What 'adequate and appropriate' means for a camp",
      "items": [
       "A first-aid needs assessment that considers your activities, site layout and the number of children and staff on-site.",
       "A suitably stocked first-aid kit, checked and restocked regularly.",
       "Enough trained first aiders or, at minimum, an appointed person to take charge in an emergency and call 999.",
       "Working with children usually raises the level of provision, including paediatric first aid where required by your regulator."
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Know your kit before you need it",
      "t": "On day one of a new season, find your nearest first-aid kit, your accident book and your defibrillator, if you have one. In a real emergency you won't have time to go looking."
     },
     {
      "k": "check",
      "q": "Under the Health and Safety (First-Aid) Regulations 1981, who must have first-aid provision?",
      "opts": [
       "Only workplaces with 50 or more staff",
       "Every workplace, however small",
       "Only venues that work with children"
      ],
      "a": 1,
      "fb": "The Regulations apply to all workplaces, including very small ones and the self-employed. Working with children simply tends to raise the level of provision needed."
     }
    ]
   },
   {
    "id": "l2",
    "title": "The primary survey: DR ABC",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "When you reach someone who has collapsed, a simple, ordered check keeps you calm and stops you missing anything. The primary survey uses the letters DR ABC: Danger, Response, Airway, Breathing and Circulation. You work through them in order every single time."
     },
     {
      "k": "steps",
      "title": "Working through DR ABC",
      "items": [
       {
        "h": "Danger",
        "t": "Make the scene safe first. On a climbing wall or by the pool, remove the hazard or move to safety before you touch the casualty."
       },
       {
        "h": "Response",
        "t": "Gently tap their shoulders and ask loudly, 'Can you hear me? Open your eyes.' No response means it is serious."
       },
       {
        "h": "Airway",
        "t": "Tilt the head back gently and lift the chin to open the airway."
       },
       {
        "h": "Breathing",
        "t": "Look, listen and feel for normal breathing for up to 10 seconds."
       },
       {
        "h": "Circulation",
        "t": "Check for and control any serious bleeding, and note skin that is pale, cold or clammy."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Occasional gasps are not normal breathing",
      "t": "In the first minutes of cardiac arrest a person may take slow, noisy or gasping breaths. This is not normal breathing. Treat them as not breathing: call 999 and start CPR."
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Breathing but unresponsive",
      "t": "If they are breathing normally but do not respond, and there is no serious bleeding, place them in the recovery position on their side to protect the airway, then call 999."
     },
     {
      "k": "check",
      "q": "What does the 'R' in DR ABC stand for?",
      "opts": [
       "Rescue",
       "Response",
       "Recovery"
      ],
      "a": 1,
      "fb": "The 'R' is Response: check whether the person reacts to you before moving on to Airway and Breathing."
     }
    ]
   },
   {
    "id": "l3",
    "title": "CPR and defibrillators",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "If someone is unresponsive and not breathing normally, their heart may have stopped. CPR keeps blood and oxygen moving to the brain until an ambulance arrives. This course follows the Resuscitation Council UK 2025 guidelines, now used in accredited training from January 2026."
     },
     {
      "k": "steps",
      "title": "Adult CPR",
      "items": [
       {
        "h": "Call for help",
        "t": "Shout for a colleague, call 999 and put it on speaker, and send someone for the nearest defibrillator."
       },
       {
        "h": "Start compressions",
        "t": "Place the heel of your hand in the centre of the chest, interlock your other hand, and push hard and fast."
       },
       {
        "h": "Rate and depth",
        "t": "Aim for 100 to 120 compressions a minute, pressing 5 to 6 centimetres deep, then let the chest come fully back up."
       },
       {
        "h": "Add breaths",
        "t": "After 30 compressions give 2 rescue breaths if you are trained and willing, then keep the 30:2 cycle going."
       }
      ]
     },
     {
      "k": "points",
      "title": "Children are different",
      "items": [
       "Because children usually collapse from a breathing problem, start with 5 rescue breaths before compressions.",
       "Those trained in paediatric first aid then use a 15:2 ratio; if you are only trained in adult CPR, use 30:2.",
       "For a small child or baby, compress about a third of the depth of the chest.",
       "Doing something is far better than doing nothing: continuous compressions still save lives."
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "The defibrillator does the thinking",
      "t": "A public access defibrillator (AED) is safe and speaks you through every step. Switch it on, attach the pads as shown, and follow its spoken instructions. It will only shock if a shock is needed."
     },
     {
      "k": "check",
      "q": "For an adult in cardiac arrest, what is the compression-to-breath ratio?",
      "opts": [
       "15 compressions to 2 breaths",
       "30 compressions to 2 breaths",
       "5 compressions to 1 breath"
      ],
      "a": 1,
      "fb": "Adults follow 30:2. The 15:2 ratio is used by those trained in paediatric first aid for children, after the first 5 rescue breaths."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Choking",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Choking is common where children eat quickly, from a grape at snack time to a bit of packed lunch during a busy session. Act fast, but first work out whether the blockage is mild or severe."
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Mild or severe?",
      "t": "If they can still cough, cry or speak, the blockage is mild: encourage them to keep coughing and stay with them. If they cannot cough, breathe or make a sound, it is severe and you must act now."
     },
     {
      "k": "steps",
      "title": "Severe choking in an adult or child",
      "items": [
       {
        "h": "Five back blows",
        "t": "Lean them forwards and give up to 5 sharp blows between the shoulder blades with the heel of your hand."
       },
       {
        "h": "Five abdominal thrusts",
        "t": "If that fails, stand behind them and give up to 5 inward-and-upward thrusts just above the navel."
       },
       {
        "h": "Repeat and call 999",
        "t": "Keep alternating 5 back blows and 5 thrusts. If it doesn't clear, call 999 and continue until help arrives."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Babies and after-care",
      "t": "Do not use abdominal thrusts on a baby under one; use back blows and chest thrusts instead. Anyone who has had abdominal thrusts should always be checked by a medical professional afterwards."
     },
     {
      "k": "check",
      "q": "A child is coughing forcefully after swallowing a crisp the wrong way. What should you do first?",
      "opts": [
       "Start abdominal thrusts immediately",
       "Encourage them to keep coughing",
       "Lay them down and start CPR"
      ],
      "a": 1,
      "fb": "A strong cough means the blockage is mild and the child is still moving air. Encourage coughing and watch closely; only step in with back blows if it becomes severe."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Serious bleeding and shock",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "A deep cut from a craft knife or a fall on broken ground can bleed heavily. Serious blood loss can lead to shock, a life-threatening drop in circulation, so controlling the bleeding quickly matters."
     },
     {
      "k": "steps",
      "title": "Controlling serious bleeding",
      "items": [
       {
        "h": "Pressure",
        "t": "Press firmly and directly on the wound with a clean pad or dressing, using your gloved hand."
       },
       {
        "h": "Cover and keep pressing",
        "t": "Apply a dressing over the top and keep firm pressure. Add more on top rather than removing a soaked one."
       },
       {
        "h": "Around an object",
        "t": "If something is embedded, do not pull it out; press firmly either side of it instead."
       },
       {
        "h": "Call 999",
        "t": "For heavy or non-stopping bleeding, call 999 and keep the casualty still and reassured."
       }
      ]
     },
     {
      "k": "points",
      "title": "Signs of shock",
      "items": [
       "Pale, cold, clammy or grey skin",
       "A fast, weak pulse and rapid, shallow breathing",
       "Feeling faint, dizzy, sick or unusually thirsty",
       "Becoming restless, confused or drowsy"
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "While you wait for the ambulance",
      "t": "Help them lie down, raise their legs if you can, keep them warm with a coat or blanket, and keep talking to reassure them. Do not give food or drink."
     },
     {
      "k": "check",
      "q": "Which of these is a key sign of shock?",
      "opts": [
       "Warm, flushed, dry skin",
       "Pale, cold, clammy skin with a fast pulse",
       "Slow, steady breathing and pink skin"
      ],
      "a": 1,
      "fb": "Shock shows as pale, cold, clammy skin with a fast, weak pulse and rapid breathing. Keep the person lying down, warm and reassured, and call 999."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "Which current guidelines does this course follow for CPR and resuscitation?",
    "opts": [
     "St John Ambulance 1998",
     "Resuscitation Council UK 2025",
     "The Highway Code"
    ],
    "a": 1,
    "fb": "It follows the Resuscitation Council UK 2025 guidelines, used in accredited training from January 2026, alongside HSE first-aid guidance."
   },
   {
    "q": "How deep should you press for adult chest compressions?",
    "opts": [
     "1 to 2 cm",
     "5 to 6 cm",
     "10 to 12 cm"
    ],
    "a": 1,
    "fb": "Press 5 to 6 centimetres deep at a rate of 100 to 120 a minute, letting the chest recoil fully each time."
   },
   {
    "q": "When back blows fail to clear severe choking, what comes next?",
    "opts": [
     "Up to 5 abdominal thrusts",
     "Ten more back blows",
     "Start CPR straight away"
    ],
    "a": 0,
    "fb": "Alternate up to 5 back blows with up to 5 abdominal thrusts, repeating until it clears or help arrives. Only start CPR if they become unresponsive."
   },
   {
    "q": "A camper is unresponsive but breathing normally with no bleeding. What should you do?",
    "opts": [
     "Lay them flat on their back",
     "Place them in the recovery position on their side",
     "Sit them upright against a wall"
    ],
    "a": 1,
    "fb": "The recovery position on their side keeps the airway open and lets fluids drain. Place them there and call 999."
   },
   {
    "q": "What is the very first step of the primary survey when you find a collapsed person?",
    "opts": [
     "Check for danger before you approach",
     "Begin chest compressions immediately",
     "Give them a drink of water"
    ],
    "a": 0,
    "fb": "Danger comes first in DR ABC: make the scene safe so you don't become a second casualty before you check response."
   },
   {
    "q": "How should you treat severe, heavy bleeding from a wound?",
    "opts": [
     "Apply firm, direct pressure with a clean pad",
     "Leave it uncovered to clot on its own",
     "Always remove any embedded object first"
    ],
    "a": 0,
    "fb": "Firm, direct pressure with a clean dressing is the priority. Never pull out an embedded object; press either side of it and call 999."
   }
  ]
 },
 {
  "id": "c49",
  "title": "First Aid Appointed Person",
  "cat": "Recommended",
  "cover": "heart",
  "category": "medical",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "First Aid Appointed Person is a short CPD course for holiday-camp and activity-club staff who look after first aid arrangements without being a trained first aider. It explains the appointed person role, the first aid kit, incident response and record-keeping, built on the Health and Safety (First-Aid) Regulations 1981 and HSE guidance L74. You will finish ready to keep provision organised and know when injuries must be reported under RIDDOR.",
  "lessons": [
   {
    "id": "l1",
    "title": "The role and the law",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "An appointed person is someone put in charge of first aid arrangements when a fully trained first aider is not required. They are the organiser and the steady head in an emergency — not the person expected to treat the casualty."
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "The legal duty",
      "t": "Under the Health and Safety (First-Aid) Regulations 1981, every employer must provide adequate and appropriate first aid equipment, facilities and people. Deciding what is 'adequate' starts with a first aid needs assessment, following HSE guidance L74."
     },
     {
      "k": "points",
      "title": "What the appointed person does",
      "items": [
       "Takes charge if someone is injured or falls ill",
       "Looks after the first aid kit and facilities",
       "Calls the emergency services when needed",
       "Makes sure the club knows who they are and where the kit is"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "An important limit",
      "t": "An appointed person is not trained to give first aid and should not attempt treatment beyond simple, common-sense help. Their job is to manage the situation and get the right help fast."
     },
     {
      "k": "check",
      "q": "Can an appointed person be required to give first aid treatment as their main duty?",
      "opts": [
       "Yes, treating casualties is their main job",
       "No — they manage arrangements and call for help",
       "Only when treating children"
      ],
      "a": 1,
      "fb": "Correct. The appointed person manages first aid arrangements and summons help; hands-on treatment is a trained first aider's role."
     }
    ]
   },
   {
    "id": "l2",
    "title": "Your first aid kit",
    "mins": 7,
    "blocks": [
     {
      "k": "text",
      "t": "There is no legal list of exact contents for a first aid kit — what you stock should reflect your first aid needs assessment. For a busy activity club with children, that usually means more than the bare minimum."
     },
     {
      "k": "figure",
      "fig": "allergens"
     },
     {
      "k": "points",
      "title": "Typical contents for a camp or club",
      "items": [
       "A general first aid guidance leaflet",
       "Individually wrapped sterile plasters, assorted sizes (hypoallergenic if needed)",
       "Sterile eye pads",
       "Triangular and sterile wound dressings",
       "Disposable gloves, ideally nitrile"
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Look for BS 8599-1",
      "t": "When buying a kit, look for the British Standard BS 8599-1:2019+A1:2026. It is not legally required, but it is a well-recognised benchmark for workplace kits and AED provision that we adopt as good practice."
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "No medicines in the kit",
      "t": "A first aid kit must not contain tablets or medicines such as painkillers. Administering medication is separate from first aid and needs its own policy, especially where children are involved."
     },
     {
      "k": "steps",
      "title": "Keeping the kit ready",
      "items": [
       {
        "h": "Check monthly",
        "t": "Look through the kit at least once a month, and after any busy session."
       },
       {
        "h": "Restock",
        "t": "Replace anything used straight away so it is never half empty."
       },
       {
        "h": "Watch expiry dates",
        "t": "Sterile items have use-by dates — swap out anything expired."
       }
      ]
     },
     {
      "k": "check",
      "q": "Which of these should NOT be in a workplace first aid kit?",
      "opts": [
       "Sterile plasters",
       "Disposable gloves",
       "Painkiller tablets"
      ],
      "a": 2,
      "fb": "Correct. Kits must not contain tablets or medicines. Handing out painkillers is not first aid and needs a separate, agreed policy."
     }
    ]
   },
   {
    "id": "l3",
    "title": "When an incident happens",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Most club incidents are minor — grazes, bumps and nosebleeds. Your job is to stay calm, make the area safe, and decide quickly whether this needs a first aider, NHS 111, or a 999 call."
     },
     {
      "k": "steps",
      "title": "A simple response order",
      "items": [
       {
        "h": "Make it safe",
        "t": "Remove or manage the danger so no one else is hurt."
       },
       {
        "h": "Get the right help",
        "t": "Fetch a trained first aider if you have one; you organise and support."
       },
       {
        "h": "Call for help if needed",
        "t": "Serious or life-threatening — dial 999. Unsure and non-urgent — call NHS 111 for advice."
       },
       {
        "h": "Reassure and supervise",
        "t": "Keep the casualty and any watching children calm until help arrives."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Know your numbers",
      "t": "999 is for emergencies — breathing difficulty, serious bleeding, a suspected fracture or a child who is very unwell. NHS 111 is for urgent but non-life-threatening advice, day or night."
     },
     {
      "k": "text",
      "t": "Example: a child on a bouncy session lands awkwardly and can't move their arm, which looks misshapen. That points to a possible fracture — call 999, keep them still, and do not try to straighten anything."
     },
     {
      "k": "check",
      "q": "A child at camp has a suspected broken arm and is in pain. What is the right call?",
      "opts": [
       "Ring NHS 111 for advice",
       "Ring 999 for emergency help",
       "Wait to see if it improves"
      ],
      "a": 1,
      "fb": "Correct. A suspected fracture with obvious deformity is an emergency — call 999 and keep the child still."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Records and reporting",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Every injury, however small, should be written up. Good records protect the child, the staff member and the club, and they are the raw material for spotting patterns and preventing repeats."
     },
     {
      "k": "points",
      "title": "The accident book",
      "items": [
       "Record what happened, when, where, and who was involved",
       "Use an accident book such as the BI 510 or an equivalent secure form",
       "Keep each entry confidential — others should not be able to read personal details",
       "Store records safely in line with data protection"
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "RIDDOR reporting",
      "t": "Under RIDDOR 2013, certain work-related injuries must be reported to the HSE. A specified injury or death must be reported without delay. An injury that stops a worker doing their normal duties for more than seven days must be reported within 15 days of the accident."
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Who actually reports",
      "t": "RIDDOR is the employer's legal duty. As appointed person you may not send the report yourself, but you must recognise a reportable event and flag it to management straight away so the deadline is met."
     },
     {
      "k": "check",
      "q": "A staff member's injury keeps them off their normal duties for more than seven days. Under RIDDOR it must be reported within…",
      "opts": [
       "24 hours",
       "15 days of the accident",
       "30 days"
      ],
      "a": 1,
      "fb": "Correct. Over-seven-day injuries must be reported to the HSE within 15 days of the accident date."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Being ready at your club",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Being appointed only works if you are actually available and everyone knows it. Provision has to hold up on trips, in the holidays, and when the club is at its busiest."
     },
     {
      "k": "points",
      "title": "Make provision visible",
      "items": [
       "Tell staff who the appointed person is and where the kit lives",
       "Signpost the nearest phone and how to give the club's address to 999",
       "Take a stocked kit on every off-site trip",
       "Know where the accident book is kept"
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Plan for absence",
      "t": "There should be someone appointed whenever staff and children are present. If your only appointed person is off sick or on leave, arrange cover in advance so the role is never left empty."
     },
     {
      "k": "text",
      "t": "Example: a summer holiday club runs five days a week. Before the season starts, the manager names a second appointed person so a sick day never leaves the club without one."
     },
     {
      "k": "check",
      "q": "Your only appointed person is off sick for the week. What should happen?",
      "opts": [
       "Close the club until they return",
       "Arrange cover so someone is always appointed",
       "Carry on — cover isn't needed"
      ],
      "a": 1,
      "fb": "Correct. Someone must be appointed whenever people are on site, so cover should be arranged in advance."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "Which law sets the duty to provide adequate and appropriate first aid at work?",
    "opts": [
     "The Health and Safety (First-Aid) Regulations 1981",
     "The Fire Safety Order 2005",
     "The Childcare Act 2006"
    ],
    "a": 0,
    "fb": "The Health and Safety (First-Aid) Regulations 1981, supported by HSE guidance L74, set this duty."
   },
   {
    "q": "What decides how much first aid provision a club needs?",
    "opts": [
     "The number of rooms",
     "A first aid needs assessment",
     "The manager's preference"
    ],
    "a": 1,
    "fb": "A first aid needs assessment weighs the risks and activities to decide what is adequate."
   },
   {
    "q": "Which is a core duty of an appointed person?",
    "opts": [
     "Giving full first aid treatment",
     "Looking after the kit and calling emergency services",
     "Writing the club's marketing"
    ],
    "a": 1,
    "fb": "Appointed persons manage arrangements, look after the kit, and call for help — they don't provide treatment."
   },
   {
    "q": "Which British Standard is the recognised benchmark for workplace first aid kits?",
    "opts": [
     "BS 8599-1",
     "ISO 9001",
     "BS 5839"
    ],
    "a": 0,
    "fb": "BS 8599-1 (2019+A1:2026) is the workplace first aid kit and AED standard we adopt as good practice."
   },
   {
    "q": "How should accident book entries be kept?",
    "opts": [
     "On open display for all staff",
     "Confidential and stored securely",
     "Only in someone's memory"
    ],
    "a": 1,
    "fb": "Each entry must be kept confidential and stored securely in line with data protection."
   },
   {
    "q": "Under RIDDOR, an over-seven-day injury must be reported to the HSE within how long?",
    "opts": [
     "15 days of the accident",
     "3 months",
     "There is no deadline"
    ],
    "a": 0,
    "fb": "Over-seven-day injuries must be reported within 15 days of the date of the accident."
   }
  ]
 },
 {
  "id": "c50",
  "title": "Accident Reporting & RIDDOR",
  "cat": "Recommended",
  "cover": "shield",
  "category": "health",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "A practical CPD course on accident reporting and RIDDOR for holiday-camp and activity-club teams. It explains what to record, what must be reported to the Health and Safety Executive, and the deadlines that apply, all built on the Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013. We treat HSE guidance as the good-practice standard we adopt.",
  "lessons": [
   {
    "id": "l1",
    "title": "What RIDDOR is and why it matters",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "RIDDOR stands for the Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013 — the UK law that requires certain workplace incidents to be reported to the Health and Safety Executive (HSE). Holiday camps and activity clubs are workplaces, so these rules apply to us just as they do to any employer. We are not a school, but we adopt HSE guidance as our good-practice standard."
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "The legal duty",
      "t": "Under RIDDOR 2013 the 'responsible person' — normally the employer, the self-employed person, or whoever is in control of the premises — must report and keep records of specified work-related incidents. At a camp that duty sits with the operator, not with the parent or the injured child."
     },
     {
      "k": "points",
      "title": "Why good reporting matters",
      "items": [
       "It is a legal requirement, and failing to report is an offence",
       "It helps HSE spot serious risks and prevent future harm",
       "It creates an honest record if a claim or complaint follows",
       "It protects children, staff and the reputation of your setting"
      ]
     },
     {
      "k": "check",
      "q": "RIDDOR is short for the Reporting of Injuries, Diseases and Dangerous Occurrences Regulations. Which year is the current version?",
      "opts": [
       "1995",
       "2013",
       "2020"
      ],
      "a": 1,
      "fb": "Correct — the current regulations came into force in 2013, replacing the earlier 1995 version."
     }
    ]
   },
   {
    "id": "l2",
    "title": "What must be reported",
    "mins": 5,
    "blocks": [
     {
      "k": "points",
      "title": "Reportable under RIDDOR 2013",
      "items": [
       "Deaths arising from a work-related accident",
       "Specified injuries to workers (Schedule 1)",
       "Over-seven-day injuries that keep a worker off normal duties",
       "Certain occupational diseases",
       "Dangerous occurrences — listed near-misses, even with no injury",
       "Injuries to members of the public taken straight to hospital for treatment"
      ]
     },
     {
      "k": "text",
      "t": "Specified injuries include: any bone fracture other than to fingers, thumbs or toes; amputations; permanent or significant loss of sight; a crush injury to the head or torso causing brain or internal-organ damage; serious burns covering more than 10% of the body or damaging the eyes or airways; scalping needing hospital treatment; loss of consciousness from a head injury or asphyxia; and injuries from working in an enclosed space that lead to hypothermia, heat illness, resuscitation or a hospital stay of over 24 hours."
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Children count as 'members of the public'",
      "t": "At a camp, the children are non-workers. If a child is injured in connection with the activity and is taken directly from your site to hospital for treatment, that is reportable — even though they are not an employee. A grazed knee treated with a plaster is not; a suspected broken arm sent to A&E for treatment is."
     },
     {
      "k": "check",
      "q": "A child on the climbing wall falls and is taken by ambulance to hospital for treatment. Is this a RIDDOR report?",
      "opts": [
       "No — only staff injuries are ever reportable",
       "Yes — a non-worker taken to hospital for treatment is reportable",
       "Only if the child stays overnight"
      ],
      "a": 1,
      "fb": "Right. Injuries to members of the public, including children, are reportable when they are taken from the scene to hospital for treatment."
     }
    ]
   },
   {
    "id": "l3",
    "title": "The accident book and your records",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Not every accident is a RIDDOR report, but every accident should still be written down. Record all injuries in your accident book or digital log while the details are fresh. This includes 'over-three-day' injuries, which must be recorded even though they are not reportable to HSE."
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Keep your records",
      "t": "RIDDOR 2013 requires the responsible person to keep a record of every reportable injury, disease and dangerous occurrence for at least three years. Many settings keep records for longer to cover personal-injury claim time limits, and for anyone injured under 18 until their 21st birthday."
     },
     {
      "k": "points",
      "title": "A good accident record includes",
      "items": [
       "Who was hurt, and whether they are a worker or a child/visitor",
       "Date, time and exact location on site",
       "What happened and what activity was taking place",
       "The injury and any first aid or treatment given",
       "Who reported it, and the RIDDOR reference if one was raised"
      ]
     },
     {
      "k": "check",
      "q": "How long must RIDDOR records be kept, as a legal minimum?",
      "opts": [
       "At least 3 years",
       "30 days",
       "There is no requirement"
      ],
      "a": 0,
      "fb": "Correct — records must be kept for at least three years, though longer retention is common good practice."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Reporting to HSE — how and when",
    "mins": 5,
    "blocks": [
     {
      "k": "steps",
      "title": "Making a report",
      "items": [
       {
        "h": "Make people safe first",
        "t": "Care for the injured person and secure the area before you do any paperwork."
       },
       {
        "h": "Decide if it is reportable",
        "t": "Check it against the RIDDOR categories — specified injury, over-seven-day, hospital treatment of a non-worker, or dangerous occurrence."
       },
       {
        "h": "Report online",
        "t": "Most reports are submitted through the HSE online form at hse.gov.uk/riddor, which routes to the right regulator."
       },
       {
        "h": "Phone for the worst cases",
        "t": "Fatal and major incidents can be reported by phone to HSE during working hours; keep the reference number."
       },
       {
        "h": "Record the reference",
        "t": "Save the RIDDOR reference into your accident book and investigation file."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Know the two clocks",
      "t": "Deaths, specified injuries, dangerous occurrences and reportable diseases must be reported online within 10 days. An over-seven-day injury has 15 days, counted from the date of the accident — not from the day the seven-day threshold is passed."
     },
     {
      "k": "text",
      "t": "For the over-seven-day count, exclude the day of the accident but include weekends and rest days. If a staff member is hurt and cannot do their normal work for more than seven consecutive days, the duty to report is triggered."
     },
     {
      "k": "check",
      "q": "An over-seven-day injury must reach the HSE within how long?",
      "opts": [
       "24 hours",
       "15 days from the date of the accident",
       "3 months"
      ],
      "a": 1,
      "fb": "Correct — over-seven-day injuries are reported within 15 days, timed from the accident date."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Investigating and learning from accidents",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Reporting is not the end of the job. RIDDOR data exists so risks can be understood and reduced. A short, fair investigation after any significant incident helps you fix the cause rather than repeat it."
     },
     {
      "k": "steps",
      "title": "A simple investigation",
      "items": [
       {
        "h": "Gather the facts",
        "t": "Talk to witnesses and staff, and look at the scene while it is fresh."
       },
       {
        "h": "Find the real causes",
        "t": "Look past 'they were careless' to the conditions — supervision ratios, equipment, surfaces, weather."
       },
       {
        "h": "Agree actions",
        "t": "Decide what will change, who owns it, and by when."
       },
       {
        "h": "Share the lesson",
        "t": "Brief the team and update your risk assessment so the whole camp benefits."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Treat near-misses as free lessons",
      "t": "A dangerous occurrence — such as play equipment collapsing with nobody underneath — is a warning, not luck. Log it, report it if it meets the RIDDOR list, and act before it becomes a real injury."
     },
     {
      "k": "check",
      "q": "What is the main purpose of investigating an accident?",
      "opts": [
       "To find someone to blame",
       "To understand the causes and stop it happening again",
       "To satisfy insurers and nothing more"
      ],
      "a": 1,
      "fb": "Correct — investigation is about learning and prevention, not blame."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "Which of these is a 'specified injury' reportable under RIDDOR 2013?",
    "opts": [
     "A fractured finger",
     "A fractured arm",
     "A minor graze"
    ],
    "a": 1,
    "fb": "All fractures are specified injuries except those to fingers, thumbs and toes — so a fractured arm qualifies."
   },
   {
    "q": "When counting the days for an over-seven-day injury, you...",
    "opts": [
     "exclude the day of the accident but include weekends and rest days",
     "count only the days the person was rostered to work",
     "start counting from the day they return"
    ],
    "a": 0,
    "fb": "Correct — the accident day itself is not counted, but weekends and rest days are."
   },
   {
    "q": "A specified injury or dangerous occurrence must be reported online within how long?",
    "opts": [
     "10 days",
     "15 days",
     "6 months"
    ],
    "a": 0,
    "fb": "Correct — these are reported within 10 days; the 15-day window applies only to over-seven-day injuries."
   },
   {
    "q": "Who is the 'responsible person' with the duty to report at your camp?",
    "opts": [
     "Any parent on site",
     "The employer or person in control of the premises",
     "The injured child"
    ],
    "a": 1,
    "fb": "Right — RIDDOR places the duty on the employer, self-employed person or whoever controls the premises."
   },
   {
    "q": "Some near-misses with no injury must still be reported. These are called:",
    "opts": [
     "Dangerous occurrences",
     "Minor incidents",
     "Non-events"
    ],
    "a": 0,
    "fb": "Correct — dangerous occurrences are listed high-risk near-misses that are reportable even when nobody is hurt."
   },
   {
    "q": "How do the accident book and RIDDOR reporting relate?",
    "opts": [
     "Writing it in the accident book replaces reporting to HSE",
     "They are separate duties — record it AND report it",
     "You only ever need to do one of them"
    ],
    "a": 1,
    "fb": "Correct — recording in your accident book and reporting to HSE are two separate obligations."
   }
  ]
 },
 {
  "id": "c51",
  "title": "Working at Height & Ladder Safety",
  "cat": "Recommended",
  "cover": "shield",
  "category": "health",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "A practical CPD course on working safely off the ground at holiday camps and activity clubs — from hanging banners and reaching store shelves to changing bulbs and clearing gutters. It is built on the Work at Height Regulations 2005 and current HSE good practice (LA455), covering the avoid/prevent/minimise hierarchy, pre-use ladder checks, the 1-in-4 angle and three points of contact. Designed for camp and club staff who aren't full-time tradespeople but still work at height.",
  "lessons": [
   {
    "id": "l1",
    "title": "Why Working at Height Matters at Camp",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Putting up a banner, hanging bunting, reaching a high shelf in the store cupboard, changing a smoke-alarm battery, clearing a blocked gutter — activity camps work at height more often than they realise. This course is built on the Work at Height Regulations 2005 and current HSE good practice, adapted for holiday-camp and activity-club teams who are not full-time tradespeople."
     },
     {
      "k": "points",
      "title": "Everyday 'height' at a camp",
      "items": [
       "Hanging banners, signage or decorations",
       "Reaching top shelves in stores or kitchens",
       "Changing a bulb or smoke-alarm battery",
       "Clearing a blocked gutter or high window"
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Height is the biggest killer at work",
      "t": "Falls from height have been the leading cause of workplace deaths in Great Britain for the last three years, with 35 workers killed in 2024/25 (HSE). Most were not dramatic drops — many were short falls from ladders and low platforms."
     },
     {
      "k": "check",
      "q": "Working 'at height' only counts when you're several metres up.",
      "opts": [
       "True",
       "False — any height where a fall could injure you counts",
       "Only when you're on scaffolding"
      ],
      "a": 1,
      "fb": "There is no minimum height. If someone could fall a distance liable to cause injury, it is work at height — a stepladder in the store cupboard counts."
     }
    ]
   },
   {
    "id": "l2",
    "title": "The Law: Avoid, Prevent, Minimise",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "The Work at Height Regulations 2005 don't ban ladders or working up high. They ask you to think through a simple order of priorities before anyone leaves the ground."
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Your legal duty (Work at Height Regulations 2005)",
      "t": "You must avoid work at height where it is reasonably practicable; where it can't be avoided, prevent falls using suitable equipment; and where a risk remains, minimise the distance and consequences of a fall. Work must be properly planned, supervised and carried out by competent people."
     },
     {
      "k": "steps",
      "title": "The avoid / prevent / minimise hierarchy",
      "items": [
       {
        "h": "Avoid",
        "t": "Can the job be done from the ground? Use a long-reach pole, lower the noticeboard, or store heavy items down low."
       },
       {
        "h": "Prevent",
        "t": "If you must go up, use safe equipment — a suitable stepladder, tower or platform — kept in good condition."
       },
       {
        "h": "Minimise",
        "t": "Reduce how far someone could fall and how badly it could hurt: lower the working height and keep a clear, tidy landing area below."
       }
      ]
     },
     {
      "k": "check",
      "q": "Under the 2005 Regulations, what should you consider first?",
      "opts": [
       "Which ladder is nearest",
       "Whether the job can be avoided or done from the ground",
       "How quickly you can get it finished"
      ],
      "a": 1,
      "fb": "Avoidance comes first. Only when you genuinely can't do the task from the ground do you move on to choosing fall-prevention equipment."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Is a Ladder the Right Choice?",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Ladders and stepladders are not banned and are perfectly sensible for the right job. HSE guidance (LA455) says a ladder can be used where a risk assessment shows the work is low-risk and short-duration."
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "The 30-minute rule of thumb",
      "t": "As a guide, if a task means staying up a leaning ladder or stepladder for more than 30 minutes at a time, choose something more stable such as a tower or mobile platform. A quick banner fix is fine; repainting the hall ceiling is not."
     },
     {
      "k": "points",
      "title": "Reconsider the ladder if...",
      "items": [
       "The job will take longer than about 30 minutes up top",
       "You'd have to carry heavy or awkward loads while climbing",
       "You can't stand the ladder on firm, level ground",
       "You'd need to over-reach or work sideways off it"
      ]
     },
     {
      "k": "check",
      "q": "A leaning ladder is best suited to which task?",
      "opts": [
       "Two hours clearing leaves along a long gutter",
       "A five-minute job hanging a welcome banner",
       "Carrying stacked boxes up to a mezzanine"
      ],
      "a": 1,
      "fb": "Ladders suit short, light, low-risk jobs. Long or load-heavy tasks need a tower, platform or other equipment."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Pre-Use Checks & Setting Up",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Every ladder gets a pre-use check by the person about to use it — every time, not just once a season. It takes under a minute and catches the faults that cause most falls."
     },
     {
      "k": "steps",
      "title": "Pre-use check (before every climb)",
      "items": [
       {
        "h": "Feet",
        "t": "Present, not worn, split or missing — the feet are what stop the ladder slipping."
       },
       {
        "h": "Stiles",
        "t": "The side rails aren't bent, cracked or dented."
       },
       {
        "h": "Rungs or steps",
        "t": "None bent, worn, missing or loose; wipe off any mud, oil or grease."
       },
       {
        "h": "Locks and platform",
        "t": "Stepladder locking bars engage fully and the platform is solid, not damaged."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Damaged? Take it out of use",
      "t": "If a ladder fails any part of the check, label it clearly and remove it so no one grabs it in a hurry. A cracked stile or missing foot can fail the moment weight goes on it. Never attempt a makeshift repair."
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Set it up right",
      "t": "Firm, level ground only. Never rest a ladder on loose bricks, wet grass or a wheelie bin. Fully open a stepladder and engage the locks, and keep the area around the base clear."
     },
     {
      "k": "check",
      "q": "You notice a ladder's rubber foot is missing. You should:",
      "opts": [
       "Use it carefully just this once",
       "Label it and take it out of use",
       "Wedge a bit of wood under that side"
      ],
      "a": 1,
      "fb": "A missing foot lets the ladder slip. Take it out of use and report it — never bodge a repair and carry on."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Climbing Safely & Keeping Children Clear",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Setting a leaning ladder at the right angle and keeping a firm hold does most of the work of staying safe. Two simple habits — the 1-in-4 rule and three points of contact — prevent the majority of avoidable ladder falls."
     },
     {
      "k": "points",
      "title": "Climb safely",
      "items": [
       "Set a leaning ladder at 1 in 4 — one unit out for every four up, roughly a 75° angle",
       "Keep three points of contact: two feet and a hand, or two hands and a foot",
       "Keep your belt buckle (your body) between the stiles — don't lean or reach out sideways",
       "Face the ladder to climb up and down, gripping the rungs",
       "Wear sensible footwear and keep hands free — carry tools in a belt or bag"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Keep children well clear",
      "t": "At a camp the extra hazard is people below. Cordon off the area, position a colleague to keep children back, and never work at height over a busy walkway or during pick-up and drop-off."
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Competence and planning",
      "t": "The Work at Height Regulations 2005 require work at height to be planned, supervised and done by someone competent. For camps that means trained staff, a quick risk assessment for anything beyond a routine stepladder task, and never sending a lone junior up an unfamiliar ladder."
     },
     {
      "k": "check",
      "q": "What is the correct angle for a leaning ladder?",
      "opts": [
       "1 in 2 (about 60°)",
       "1 in 4 (about 75°)",
       "Straight up, flat against the wall"
      ],
      "a": 1,
      "fb": "The 1-in-4 rule — one unit out at the base for every four up — gives roughly a 75° angle, the safest lean."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "Which standard is this course built on?",
    "opts": [
     "The Work at Height Regulations 2005",
     "The Highway Code",
     "GDPR"
    ],
    "a": 0,
    "fb": "The Work at Height Regulations 2005 set the duties for any work where a fall could cause injury."
   },
   {
    "q": "The correct order of priorities is:",
    "opts": [
     "Minimise, prevent, avoid",
     "Avoid, prevent, minimise",
     "Prevent, avoid, minimise"
    ],
    "a": 1,
    "fb": "Avoid the work at height first; if you can't, prevent falls with the right equipment; then minimise the distance and consequences."
   },
   {
    "q": "As a rough guide, a leaning ladder or stepladder is unsuitable for a single task lasting longer than:",
    "opts": [
     "5 minutes",
     "30 minutes",
     "2 hours"
    ],
    "a": 1,
    "fb": "Beyond about 30 minutes up top, HSE guidance (LA455) says choose a tower or platform instead."
   },
   {
    "q": "'Three points of contact' means:",
    "opts": [
     "Three people holding the ladder steady",
     "Two feet and a hand, or two hands and a foot, on the ladder",
     "Three checks before you climb"
    ],
    "a": 1,
    "fb": "Keep three limbs on the ladder at all times so a slip doesn't turn into a fall."
   },
   {
    "q": "You find a stepladder with a cracked side rail. You should:",
    "opts": [
     "Use it for light jobs only",
     "Label it, take it out of use and report it",
     "Tape over the crack"
    ],
    "a": 1,
    "fb": "A cracked stile can fail under load. Remove it from use — never patch it and carry on."
   },
   {
    "q": "At a busy camp, the extra ladder hazard to control is:",
    "opts": [
     "Children and passers-by below",
     "The colour of the ladder",
     "The brand of ladder"
    ],
    "a": 0,
    "fb": "Cordon off the base, keep children back, and avoid working over walkways at drop-off and pick-up."
   }
  ]
 },
 {
  "id": "c52",
  "title": "Asbestos Awareness",
  "cat": "Recommended",
  "cover": "shield",
  "category": "health",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "Asbestos Awareness is a short CPD course for holiday-camp and activity-club staff who work in or move around older halls, pavilions and centres. It explains where asbestos-containing materials hide, why they must never be disturbed, and exactly what to do if you find them. It is built on the Control of Asbestos Regulations 2012 and current HSE guidance, which we are not a school but adopt as good practice.",
  "lessons": [
   {
    "id": "l1",
    "title": "Asbestos: what it is and why it still matters",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Asbestos is a natural mineral fibre that was mixed into thousands of building products for its strength and fire resistance. It is only a danger when it is damaged or disturbed and its tiny fibres are breathed in. As an activity provider we are not a school, but we follow the same Control of Asbestos Regulations 2012 that protect any workplace."
     },
     {
      "k": "points",
      "title": "The quick facts",
      "items": [
       "Blue and brown asbestos were banned in 1985; white asbestos in 1999",
       "Any building constructed or refurbished before 2000 may still contain it",
       "You cannot see, smell or taste asbestos fibres in the air",
       "Around 5,000 people a year in Great Britain still die from past exposure"
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Banned, but not gone",
      "t": "The 1999 ban stopped new asbestos being sold, but it was never removed from millions of existing buildings. A church hall or leisure centre your club hires could easily pre-date the ban."
     },
     {
      "k": "check",
      "q": "Your club runs in a sports hall built in 1996. Should you assume it might contain asbestos?",
      "opts": [
       "No — it is too modern to worry about",
       "Yes — anything worked on before 2000 may contain it",
       "Only if you can already see damage"
      ],
      "a": 1,
      "fb": "Correct. Treat any pre-2000 building as potentially containing asbestos until records prove otherwise."
     }
    ]
   },
   {
    "id": "l2",
    "title": "Where asbestos hides in your venue",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Asbestos was used almost everywhere, so it helps to know the usual suspects. In the halls, pavilions and community centres activity clubs often hire, it tends to turn up in a handful of familiar materials."
     },
     {
      "k": "points",
      "title": "Common asbestos-containing materials (ACMs)",
      "items": [
       "Textured coatings such as Artex on ceilings and walls",
       "Asbestos insulating board in ceiling tiles, panels and behind heaters",
       "Lagging around old pipes and boilers",
       "Floor tiles and the bitumen glue beneath them",
       "Cement roofing, guttering, downpipes and old sheds",
       "Gaskets, rope seals and old fuse boxes"
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "When in doubt, assume",
      "t": "You are not expected to identify asbestos by eye — even experts confirm it with a lab test. If a material could be old enough and you are unsure, treat it as if it contains asbestos."
     },
     {
      "k": "check",
      "q": "You spot a cracked ceiling tile in a 1970s community hall. What is the safest assumption?",
      "opts": [
       "It is just an ordinary tile",
       "It could be asbestos insulating board — leave it and report it",
       "Bag it up and bin it before anyone sees"
      ],
      "a": 1,
      "fb": "Right. Old ceiling tiles are a classic ACM; do not touch it, and report the damage."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Why disturbing it is dangerous",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Asbestos in good condition, left undisturbed, is generally not a risk. The danger comes when it is drilled, sanded, broken or knocked, releasing microscopic fibres that hang in the air and are breathed deep into the lungs."
     },
     {
      "k": "points",
      "title": "What breathing in fibres can cause",
      "items": [
       "Mesothelioma, a cancer of the lung lining",
       "Asbestos-related lung cancer",
       "Asbestosis, a scarring of the lung tissue",
       "Diseases that can take 20 to 40 years to appear"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "There is no safe level",
      "t": "Illness can follow even short exposures, and symptoms may not show for decades. That long delay is exactly why prevention — simply never disturbing it — matters so much."
     },
     {
      "k": "check",
      "q": "When is an asbestos ceiling tile most likely to release harmful fibres?",
      "opts": [
       "When it is sealed and in good condition",
       "When someone drills, breaks or sands it",
       "Only when it gets wet"
      ],
      "a": 1,
      "fb": "Correct. Fibres are released when ACMs are disturbed — which is why 'do not disturb' is the golden rule."
     }
    ]
   },
   {
    "id": "l4",
    "title": "The law: the duty to manage",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "The Control of Asbestos Regulations 2012 place a legal 'duty to manage' asbestos in non-domestic premises. Whoever is responsible for a building's maintenance must find out whether asbestos is present, record its location and condition, assess the risk and make a plan to manage it."
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Regulation 4 — the duty to manage",
      "t": "Under Regulation 4 of the Control of Asbestos Regulations 2012, the person responsible for the premises must keep an up-to-date asbestos register and share it with anyone likely to disturb the material. As a hirer, ask to see it."
     },
     {
      "k": "points",
      "title": "What good practice looks like for us",
      "items": [
       "Ask the venue for its asbestos register or management plan before booking",
       "Remember anyone likely to disturb asbestos must be given awareness information",
       "Never start drilling, fixing or DIY jobs in a hired building without checking first"
      ]
     },
     {
      "k": "check",
      "q": "Which regulation sets out the duty to manage asbestos in a workplace?",
      "opts": [
       "The Control of Asbestos Regulations 2012",
       "The Regulatory Reform (Fire Safety) Order 2005",
       "There is no such legal duty"
      ],
      "a": 0,
      "fb": "Correct. The duty to manage sits in Regulation 4 of the Control of Asbestos Regulations 2012."
     }
    ]
   },
   {
    "id": "l5",
    "title": "If you find or suspect asbestos",
    "mins": 5,
    "blocks": [
     {
      "k": "steps",
      "title": "The four steps if you find or suspect an ACM",
      "items": [
       {
        "h": "Stop",
        "t": "Stop what you are doing straight away and do not touch the material."
       },
       {
        "h": "Protect",
        "t": "Keep children and colleagues well away from the area."
       },
       {
        "h": "Report",
        "t": "Tell your manager or the venue and check the asbestos register."
       },
       {
        "h": "Wait",
        "t": "Leave any repair or removal to a competent, often licensed, contractor."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Awareness is not a licence",
      "t": "This course helps you recognise and avoid asbestos. It does not qualify you to work on it, sample it or remove it — only trained, competent and (for higher-risk work) licensed contractors may do that."
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "A real camp example",
      "t": "A holiday-club leader is hanging decorations and starts to drill into an old plasterboard-looking wall. The correct response: stop, don't drill, and check whether the board could be asbestos insulating board first."
     },
     {
      "k": "check",
      "q": "You knock a hole in an old boiler-room panel and it crumbles into dust. What should you do first?",
      "opts": [
       "Sweep it up quickly before anyone notices",
       "Stop, keep everyone out of the area and report it",
       "Carry on — a small amount is fine"
      ],
      "a": 1,
      "fb": "Correct. Stop immediately, keep people away, and report it so it can be assessed properly."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "When was all use of asbestos finally banned in the UK?",
    "opts": [
     "1985",
     "1999",
     "2012"
    ],
    "a": 1,
    "fb": "White asbestos was banned in 1999; blue and brown had already gone in 1985."
   },
   {
    "q": "Which of these is a common asbestos-containing material?",
    "opts": [
     "A modern uPVC window",
     "A textured Artex ceiling coating",
     "A plastic storage box"
    ],
    "a": 1,
    "fb": "Textured coatings like Artex are a classic ACM in pre-2000 buildings."
   },
   {
    "q": "Asbestos is most dangerous when…",
    "opts": [
     "It is left sealed and undisturbed",
     "It is drilled, broken or sanded",
     "It was painted over years ago"
    ],
    "a": 1,
    "fb": "Disturbing ACMs releases the fibres that cause disease — so never disturb them."
   },
   {
    "q": "The legal duty to manage asbestos comes from…",
    "opts": [
     "The Control of Asbestos Regulations 2012",
     "The Highway Code",
     "No law covers it"
    ],
    "a": 0,
    "fb": "Regulation 4 of the Control of Asbestos Regulations 2012 sets out the duty to manage."
   },
   {
    "q": "You suspect a broken panel contains asbestos. The right first step is to…",
    "opts": [
     "Remove it yourself, carefully",
     "Stop, keep people away and report it",
     "Ignore it if it looks old"
    ],
    "a": 1,
    "fb": "Stop, protect the area and report — never disturb or remove it yourself."
   },
   {
    "q": "Does completing this awareness course qualify you to remove asbestos?",
    "opts": [
     "Yes, fully",
     "No — removal needs competent, often licensed, contractors",
     "Yes, small amounts only"
    ],
    "a": 1,
    "fb": "Awareness training helps you avoid asbestos; it does not authorise you to work on it."
   }
  ]
 },
 {
  "id": "c53",
  "title": "Duty of Care",
  "cat": "Recommended",
  "cover": "people",
  "category": "together",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "Duty of Care is a CPD-certified course for holiday-camp and activity-club staff. It turns the common-law duty — to take reasonable care of the children in your charge — into everyday practice: foreseeing risk, supervising well, and acting in each child's best interests. It is built on the common-law standard of the careful, sensible parent and the NSPCC's recommended supervision ratios (September 2025).",
  "lessons": [
   {
    "id": "l1",
    "title": "What duty of care actually means",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Duty of care is the legal and moral responsibility you take on the moment a child is left in your charge. From drop-off to collection, their safety and wellbeing are, in part, your job."
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "The common-law duty of care",
      "t": "Under common law you must take reasonable care to avoid acts or omissions you can reasonably foresee would harm a child in your charge. Because they are children, the standard applied is that of a careful, sensible parent — higher than the standard owed to adults."
     },
     {
      "k": "points",
      "title": "What it looks like across a camp day",
      "items": [
       "Knowing which children are yours and where they are",
       "Spotting hazards before children reach them",
       "Following medical, allergy and collection instructions to the letter",
       "Speaking up when something is not safe, even if it is not 'your' group"
      ]
     },
     {
      "k": "check",
      "q": "A child in another leader's group is climbing on a stacked table right next to you. What does your duty of care require?",
      "opts": [
       "Nothing — they are not in your group",
       "Step in, make it safe, then tell their leader",
       "Wait until their leader notices"
      ],
      "a": 1,
      "fb": "Duty of care follows the child in front of you, not the rota. Foreseeable harm means you act now and hand back after."
     }
    ]
   },
   {
    "id": "l2",
    "title": "Reasonable care and foreseeability",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "You are not expected to prevent every accident — the law asks for reasonable care, not a guarantee. But 'reasonable' means thinking ahead about what could realistically go wrong and taking sensible steps first."
     },
     {
      "k": "steps",
      "title": "Foreseeing and reducing risk",
      "items": [
       {
        "h": "Look ahead",
        "t": "Before an activity, picture what could realistically go wrong for this age and this group."
       },
       {
        "h": "Assess",
        "t": "Weigh how likely harm is and how serious it could be — a risk assessment, written down or in your head."
       },
       {
        "h": "Control",
        "t": "Remove or reduce the hazard: move it, brief the children, add supervision, or change the plan."
       },
       {
        "h": "Review",
        "t": "Watch how it actually goes and adjust — weather, tiredness and mood all change the risk."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Higher risk, higher care",
      "t": "The law expects more care as risk rises. Water, heights, tools, heat, cooking and off-site trips all need tighter planning and closer supervision than a quiet craft session."
     },
     {
      "k": "check",
      "q": "'Reasonable care' means you must guarantee that no child is ever hurt.",
      "opts": [
       "True",
       "False",
       "Only on off-site trips"
      ],
      "a": 1,
      "fb": "False. The duty is to take reasonable, foreseeable precautions — not to prevent every possible accident."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Supervision and the right ratios",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Supervision is how duty of care is delivered minute to minute. Ratios set a floor for how many adults you need, but good supervision is about attention and head-counting, not just numbers on a rota."
     },
     {
      "k": "points",
      "title": "NSPCC recommended minimum ratios (Sept 2025)",
      "items": [
       "Ages 2–3: one adult to four children",
       "Ages 4–8: one adult to six children",
       "Ages 9–12: one adult to eight children",
       "Ages 13–18: one adult to ten children"
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Ratios are a floor, not a target",
      "t": "These are minimums. Add adults for swimming, trips, additional needs or challenging behaviour, and keep at least two adults present even with small groups. Ofsted-registered clubs also cap group size and carry their own requirements."
     },
     {
      "k": "check",
      "q": "Twelve 7-year-olds are heading to a splash pool with two staff. That meets the 1:6 minimum, so you go as-is.",
      "opts": [
       "Correct — two adults covers twelve",
       "Wrong — a water activity needs more supervision than the bare minimum",
       "Wrong — 7-year-olds can never go near water"
      ],
      "a": 1,
      "fb": "The minimum is only a starting point. Water raises the risk, so reasonable care means staffing above the ratio."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Acting in the child's best interests",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Duty of care is not only about avoiding harm — it is about actively doing what is best for the child. When you make a judgement call, the child's welfare comes first, ahead of routine or convenience."
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "The best-interests principle",
      "t": "As good practice we follow the Children Act 1989 principle that a child's welfare is the paramount consideration. That means putting each child's safety, health and wellbeing ahead of convenience, timetable or an adult's preference."
     },
     {
      "k": "points",
      "title": "Best interests in real moments",
      "items": [
       "A tired, upset child gets a break, not just 'join in and get on with it'",
       "You never release a child to an adult who is not on the approved collection list",
       "You raise a welfare or safeguarding worry rather than hoping it passes",
       "You adapt activities so a child with additional needs can take part safely"
      ]
     },
     {
      "k": "check",
      "q": "An adult arrives to collect a child but is not on the authorised list, and the child seems happy to go with them. What do you do?",
      "opts": [
       "Let them go — the child clearly knows them",
       "Do not release the child; check with the parent and your manager first",
       "Ask the adult for ID, then release the child"
      ],
      "a": 1,
      "fb": "Best interests and duty of care mean you never release a child outside the agreed arrangements, however awkward that feels in the moment."
     }
    ]
   },
   {
    "id": "l5",
    "title": "When your duty is tested",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Most of the time duty of care is quiet and routine. It shows most clearly in the moments that go wrong — an injury, a missing child, a disclosure. What you do in those moments matters most."
     },
     {
      "k": "steps",
      "title": "If something happens",
      "items": [
       {
        "h": "Make it safe",
        "t": "Deal with immediate danger first — the injured or at-risk child comes before paperwork."
       },
       {
        "h": "Get help",
        "t": "Call the first-aider, your lead or the emergency services early rather than late."
       },
       {
        "h": "Record",
        "t": "Write down what happened, when, and what you did, as soon as you reasonably can."
       },
       {
        "h": "Report",
        "t": "Tell parents and your safeguarding lead, and escalate anything beyond your role."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Don't carry it alone",
      "t": "You are not expected to handle everything yourself. Failing to pass on a concern can be a breach of your duty in itself — escalating it is part of the job, not a sign you have failed."
     },
     {
      "k": "check",
      "q": "You see a minor injury on the trampoline. What best meets your duty of care?",
      "opts": [
       "Patch the child up quietly and say nothing, to avoid worrying the parents",
       "Give first aid, record the incident, and inform parents and your lead",
       "Wait and see if it bruises before telling anyone"
      ],
      "a": 1,
      "fb": "Care, an accurate record and honest reporting protect the child and you. Hiding incidents breaches your duty of care."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "The common-law duty of care requires you to:",
    "opts": [
     "Prevent every possible accident",
     "Take reasonable care against foreseeable harm to children in your charge",
     "Only act within your own assigned group"
    ],
    "a": 1,
    "fb": "The duty is reasonable care against reasonably foreseeable harm — not a guarantee, and it follows any child in your charge."
   },
   {
    "q": "Because you are caring for children, the standard of care expected of you is:",
    "opts": [
     "Lower than the standard owed to adults",
     "Exactly the same as for adults",
     "Higher — that of a careful, sensible parent"
    ],
    "a": 2,
    "fb": "The law applies a heightened standard for children, judged against a careful, sensible parent."
   },
   {
    "q": "Under the NSPCC's recommended minimums (Sept 2025), the ratio for 9–12 year-olds is at least:",
    "opts": [
     "One adult to six children",
     "One adult to eight children",
     "One adult to twelve children"
    ],
    "a": 1,
    "fb": "For 9–12s the recommended minimum is one adult to eight — and more for higher-risk activities."
   },
   {
    "q": "'Foreseeability' in duty of care means:",
    "opts": [
     "Predicting exactly what the future holds",
     "Anticipating harms a reasonable person could expect, and guarding against them",
     "Only reacting after an incident has happened"
    ],
    "a": 1,
    "fb": "Foreseeability is about the risks a reasonable person would anticipate for that age, group and activity."
   },
   {
    "q": "An unauthorised adult wants to collect a child who is happy to go. You should:",
    "opts": [
     "Release the child, since they are willing",
     "Refuse, and check with the parent and your manager",
     "Release the child after seeing some ID"
    ],
    "a": 1,
    "fb": "Acting in the child's best interests means never releasing them outside the agreed collection arrangements."
   },
   {
    "q": "You have a welfare concern that sits above your role. The right action is to:",
    "opts": [
     "Keep watching and hope it resolves itself",
     "Escalate it to your safeguarding lead",
     "Only mention it to other staff on shift"
    ],
    "a": 1,
    "fb": "Escalating to your safeguarding lead is part of your duty — failing to pass it on can be a breach in itself."
   }
  ]
 },
 {
  "id": "c54",
  "title": "Conflict Resolution & De-escalation",
  "cat": "Recommended",
  "cover": "people",
  "category": "together",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "Conflict Resolution & De-escalation is a CPD-style course for holiday-camp and activity-club staff who deal with the public every day — from a frustrated parent at pick-up to a child in meltdown. It teaches practical verbal de-escalation, dynamic risk assessment, calming techniques, and knowing exactly when to disengage and call for help. It is built on HSE work-related violence guidance and the good-practice duties of the Health and Safety at Work etc. Act 1974.",
  "lessons": [
   {
    "id": "l1",
    "title": "What conflict really is",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Conflict is any clash of needs, expectations or emotions. At a holiday camp it rarely starts as violence — it usually begins as frustration: a late pick-up, a lost lunchbox, a child who won't share. Handled early, most of it never escalates."
     },
     {
      "k": "points",
      "title": "Where conflict shows up at camp",
      "items": [
       "Drop-off and pick-up, when parents are rushed or worried",
       "Disputes between children over games, equipment or friendship groups",
       "A parent unhappy about an incident, a bill, or a decision",
       "A child who is overwhelmed, tired or dysregulated and lashes out"
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Your legal footing",
      "t": "The Health and Safety at Work etc. Act 1974 and the Management of Health and Safety at Work Regulations 1999 require your employer to assess the risk of work-related violence and put controls in place — including training and safe systems of work. The HSE defines work-related violence as any incident in which a person is abused, threatened or assaulted in connection with their work; this includes verbal abuse and threats, not only physical assault."
     },
     {
      "k": "text",
      "t": "That matters because you are never expected to simply 'put up with' abuse. Recognising conflict early, and knowing you have both the skills and the backing to manage it, is the foundation of everything that follows."
     },
     {
      "k": "check",
      "q": "Under HSE guidance, which of these counts as work-related violence?",
      "opts": [
       "Only a physical assault that leaves an injury",
       "Being sworn at and threatened by an angry parent",
       "Only incidents reported to the police"
      ],
      "a": 1,
      "fb": "Correct — the HSE definition includes verbal abuse and threats, not just physical assault."
     }
    ]
   },
   {
    "id": "l2",
    "title": "Reading the warning signs",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Conflict almost always gives warning. If you learn to read the signs, you can step in while things are still calm enough to talk. This is why staff are trained to keep 'reading the room' rather than assuming a situation is safe."
     },
     {
      "k": "figure",
      "fig": "step"
     },
     {
      "k": "points",
      "title": "Early warning signs to watch for",
      "items": [
       "Raised or faster speech, swearing, or a sarcastic, clipped tone",
       "Tense posture, clenched fists, pacing, or invading your space",
       "Fixed staring — or the opposite, going cold and quiet",
       "A child escalating: shouting, throwing, refusing all instructions"
      ]
     },
     {
      "k": "steps",
      "title": "Dynamic risk assessment — keep reassessing",
      "items": [
       {
        "h": "Scan",
        "t": "Notice the person, the exits, other children nearby, and anything that could be thrown or used to hurt someone."
       },
       {
        "h": "Assess",
        "t": "How angry are they, and is it rising or easing? Are you alone, or is help close by?"
       },
       {
        "h": "Reassess",
        "t": "Nothing is fixed. Check again every few moments — anger, distance and your options all change quickly."
       },
       {
        "h": "Decide",
        "t": "Choose to keep talking, get support, or step back — and stay ready to change that decision."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Position yourself well",
      "t": "Keep a relaxed, non-threatening stance slightly to the side rather than square-on. Stay outside arm's reach, keep a clear route to the door, and never let yourself be cornered. Where you can, move a heated conversation away from an audience of other children or parents."
     },
     {
      "k": "check",
      "q": "What does 'dynamic' risk assessment mean?",
      "opts": [
       "You assess the risk once when the day begins",
       "You keep re-checking the danger as the situation changes",
       "Only a manager is allowed to assess the risk"
      ],
      "a": 1,
      "fb": "Correct — dynamic risk assessment is continuous: you keep reassessing the person, your distance and your options moment by moment."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Verbal de-escalation",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "De-escalation is mostly about how you make the other person feel. If they feel heard and treated with respect, their need to fight usually drops. Your tone, face and body do more of the work than the actual words."
     },
     {
      "k": "steps",
      "title": "A simple de-escalation approach",
      "items": [
       {
        "h": "Stay calm",
        "t": "Slow your own breathing and speech. A calm adult is contagious; a flustered one adds fuel."
       },
       {
        "h": "Listen and acknowledge",
        "t": "Let them talk without interrupting. Show you've understood: 'I can see this has really upset you.'"
       },
       {
        "h": "Lower the temperature",
        "t": "Speak slowly and quietly, use their name, and keep an open, neutral expression."
       },
       {
        "h": "Move to solutions",
        "t": "Once they're calmer, focus on what you can do next — and be honest about what you can't."
       }
      ]
     },
     {
      "k": "points",
      "title": "What makes it worse — avoid these",
      "items": [
       "Arguing, correcting facts, or saying 'calm down'",
       "Sarcasm, mocking, blaming, or laughing",
       "Crossing your arms, pointing, or squaring up",
       "Making promises you can't keep just to shut them up"
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Good practice we follow",
      "t": "Health and NHS settings use NICE guideline NG10 on de-escalation. Its principles travel well to a camp: give the person space, keep one member of staff leading the conversation, use a calm and respectful tone, and treat any physical intervention as an absolute last resort. We adopt these as good practice — not because we are a clinical setting."
     },
     {
      "k": "check",
      "q": "A parent is shouting that their child was 'ignored all day'. Your best first move is to:",
      "opts": [
       "Interrupt and explain why they're wrong",
       "Listen fully, then acknowledge how upset they are",
       "Tell them to calm down or leave"
      ],
      "a": 1,
      "fb": "Correct — listening and acknowledging lowers the temperature; defending yourself or ordering them to calm down usually escalates it."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Calming a parent or a child",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "The same principles play out differently with an angry adult and an overwhelmed child. Knowing the difference helps you respond in the right register."
     },
     {
      "k": "steps",
      "title": "An aggressive parent at pick-up",
      "items": [
       {
        "h": "Take it aside",
        "t": "Invite them to a quieter spot, away from other families and children, so no one is performing to an audience."
       },
       {
        "h": "Acknowledge first",
        "t": "Lead with empathy: 'I'm really sorry this has happened — tell me what's gone on.'"
       },
       {
        "h": "Own what's yours",
        "t": "If we've got something wrong, say so plainly. Don't be defensive or hide behind policy."
       },
       {
        "h": "Agree a next step",
        "t": "Offer a concrete action and a timescale, or bring in a manager if it's beyond you."
       }
      ]
     },
     {
      "k": "points",
      "title": "A child in crisis is not 'being difficult'",
      "items": [
       "Get down to their level, soften your voice, and reduce demands",
       "Give them space and time — silence is fine; don't crowd or grab",
       "Remove the audience and any obvious triggers where you safely can",
       "Keep other children safe and call for a second staff member early"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Hands off unless it's genuinely necessary",
      "t": "Physical intervention with a child is only ever a last resort to prevent immediate harm, must be reasonable and proportionate, and should follow your setting's positive-handling policy and training. Any incident involving aggression, injury or restraint must be logged, reported to your safeguarding lead, and shared with parents in line with policy."
     },
     {
      "k": "check",
      "q": "A seven-year-old is throwing chairs and screaming. What's the priority?",
      "opts": [
       "Physically hold them still straight away",
       "Keep others safe, give space, lower demands, and get a second adult",
       "Send them home immediately as a punishment"
      ],
      "a": 1,
      "fb": "Correct — protect others, de-escalate with space and calm, and get support. Physical intervention is a last resort only to prevent immediate harm."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Disengage, get help and recover",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "No de-escalation skill obliges you to stay in a situation that has become unsafe. Knowing when to stop trying to talk someone down — and to protect yourself — is a skill in itself, not a failure."
     },
     {
      "k": "steps",
      "title": "Disengage and get help",
      "items": [
       {
        "h": "Read the red flags",
        "t": "Rising aggression despite your efforts, threats, a weapon, or being backed into a corner all mean stop."
       },
       {
        "h": "Create distance",
        "t": "Put furniture or space between you, keep facing them, and move towards your exit — don't turn your back."
       },
       {
        "h": "Summon help",
        "t": "Use your agreed signal or call word, radio or phone. Every venue should have a fast way to raise the alarm."
       },
       {
        "h": "Protect others",
        "t": "Move children away, and call 999 if there's an immediate threat to anyone's safety."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Reporting duty",
      "t": "Serious incidents may be reportable under RIDDOR 2013 (the Reporting of Injuries, Diseases and Dangerous Occurrences Regulations) — for example, an act of physical violence that leaves a worker unable to do their normal duties for more than seven days, or that causes a specified injury. Your employer decides and makes the report, but only if you record what happened."
     },
     {
      "k": "points",
      "title": "After the incident",
      "items": [
       "Write a factual record while it's fresh: what happened, who, when, and what was said and done",
       "Report to your manager and safeguarding lead; inform parents where required",
       "Debrief as a team — what worked, what to change, and any risk-assessment update",
       "Accept support: a difficult incident can shake you, and confidential help should be available"
      ]
     },
     {
      "k": "check",
      "q": "You've had to disengage from a violent parent and a colleague was hurt. What next?",
      "opts": [
       "Say nothing to avoid a fuss",
       "Record it factually and report it so your employer can assess RIDDOR and support you",
       "Only tell the parents, not managers"
      ],
      "a": 1,
      "fb": "Correct — an accurate record lets your employer meet any RIDDOR duty, review the risk assessment, and give you proper support."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "Which best matches the HSE definition of work-related violence?",
    "opts": [
     "Physical attacks only",
     "Any incident where someone is abused, threatened or assaulted in relation to their work",
     "Disagreements between staff members"
    ],
    "a": 1,
    "fb": "The HSE definition covers abuse, threats and assault — including verbal abuse — connected to work."
   },
   {
    "q": "Dynamic risk assessment is best described as:",
    "opts": [
     "A one-off form filled in each morning",
     "Continuously reassessing the danger as the situation unfolds",
     "A manager's job only"
    ],
    "a": 1,
    "fb": "It's ongoing — you keep re-checking the person, your distance and your options moment by moment."
   },
   {
    "q": "Which response is most likely to de-escalate an angry parent?",
    "opts": [
     "Telling them firmly to calm down",
     "Listening, using a calm quiet tone, and acknowledging their feelings",
     "Explaining all the ways they're mistaken"
    ],
    "a": 1,
    "fb": "Feeling heard and respected lowers the temperature; 'calm down' and defensiveness usually raise it."
   },
   {
    "q": "Physical intervention with a child should be:",
    "opts": [
     "Used quickly to end any tantrum",
     "A last resort only to prevent immediate harm, reasonable and proportionate",
     "Avoided even if a child is about to be seriously hurt"
    ],
    "a": 1,
    "fb": "It's a last resort to prevent immediate harm, must be reasonable and proportionate, and follow your positive-handling policy."
   },
   {
    "q": "When a situation turns unsafe, you should:",
    "opts": [
     "Keep talking no matter what",
     "Disengage, create distance, call for help, and protect others",
     "Chase the person to resolve it"
    ],
    "a": 1,
    "fb": "Disengaging safely and summoning help is the right call — staying in danger is never required."
   },
   {
    "q": "After a violent incident, why does an accurate written record matter?",
    "opts": [
     "It's just optional paperwork",
     "It lets your employer assess RIDDOR duties, review the risk assessment, and support staff",
     "It's only for blaming someone"
    ],
    "a": 1,
    "fb": "Records underpin any RIDDOR report, risk-assessment updates and staff wellbeing support."
   }
  ]
 },
 {
  "id": "c55",
  "title": "Cyber Security Awareness",
  "cat": "Recommended",
  "cover": "shield",
  "category": "digital",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "Cyber Security Awareness is a CPD-style e-learning course for holiday-camp and activity-club staff, built on the National Cyber Security Centre (NCSC) guidance and the government-backed Cyber Essentials controls. It shows you how to spot phishing, use strong passwords and a password manager, switch on multi-factor authentication, keep devices secure and report anything suspicious. It also reflects our legal duty to protect children's and families' personal data under UK GDPR and the Data Protection Act 2018.",
  "lessons": [
   {
    "id": "l1",
    "title": "Why cyber security matters at our club",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "We are not a bank or a big company, so it is tempting to think criminals will not bother with us. In fact, small organisations are targeted precisely because they hold valuable information and often have weaker defences. A holiday camp or activity club holds exactly the kind of data attackers want: children's names and ages, medical and allergy notes, parents' contact details and payment information. Good cyber security is simply another part of keeping the children and families in our care safe."
     },
     {
      "k": "points",
      "title": "The information we are protecting",
      "items": [
       "Children's names, dates of birth and photos",
       "Medical, allergy and SEND information",
       "Parents' phone numbers, emails and addresses",
       "Booking, payment and emergency-contact records",
       "Staff records, including DBS and safeguarding details"
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Our legal duty: UK GDPR and the Data Protection Act 2018",
      "t": "Under UK GDPR and the Data Protection Act 2018 we are legally required to keep personal data secure using appropriate technical and organisational measures. Because we handle children's data, the standard expected of us is higher. A serious breach must be reported to the Information Commissioner's Office (ICO), usually within 72 hours. Poor password habits or a clicked phishing link are not just IT mistakes; they can become data-protection breaches."
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "The standard we work to: Cyber Essentials",
      "t": "We follow the NCSC's advice and the government-backed Cyber Essentials framework as good practice. Its five basic controls, firewalls, secure settings, access control, malware protection and keeping software up to date, stop the large majority of common online attacks. You do not need to be technical; most of it comes down to everyday habits this course will cover."
     },
     {
      "k": "check",
      "q": "Why might criminals target a small activity club?",
      "opts": [
       "Small clubs never hold anything worth stealing",
       "We hold valuable data on children and families, often with weaker defences",
       "Only large companies are ever attacked"
      ],
      "a": 1,
      "fb": "Correct. Attackers go for the data they can use, and children's and families' records are valuable. Being small does not make us a smaller target."
     }
    ]
   },
   {
    "id": "l2",
    "title": "Spotting phishing and scams",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Phishing is when a criminal sends a fake message, by email, text or even a phone call, pretending to be someone you trust so that you click a link, open an attachment, hand over a password or make a payment. It is the most common way attackers get into an organisation. The messages are designed to make you act quickly, before you have time to think."
     },
     {
      "k": "points",
      "title": "Warning signs of a phishing message",
      "items": [
       "Pressure and urgency: act now, your account will be closed, pay today",
       "An unexpected attachment or a link you were not expecting",
       "A web address that looks almost right but is subtly wrong",
       "Requests for a password, payment or bank details",
       "Poor spelling, an odd greeting, or a tone that feels off"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "A realistic example",
      "t": "During a busy first day of camp, a manager receives an email that appears to be from head office: 'Payroll update, confirm your login within 30 minutes or you will not be paid this week.' The link goes to a page that looks like the staff portal. It is fake. The urgency and the request to confirm your login are the giveaways, no genuine service asks you to do this."
     },
     {
      "k": "steps",
      "title": "What to do with a suspicious message",
      "items": [
       {
        "h": "Stop and slow down",
        "t": "Urgency is the trap. Give yourself a moment before doing anything."
       },
       {
        "h": "Check the real sender",
        "t": "Look at the full email address, not just the display name. When unsure, contact the person or organisation using details you already trust, not the ones in the message."
       },
       {
        "h": "Do not click or open",
        "t": "Never click links or open attachments you were not expecting."
       },
       {
        "h": "Report it",
        "t": "Tell your manager and forward the email to the NCSC's Suspicious Email Reporting Service at report@phishing.gov.uk. Suspicious texts can be forwarded to 7726."
       }
      ]
     },
     {
      "k": "check",
      "q": "An email demands you 'confirm your login in the next 30 minutes or lose access'. What is the first thing to do?",
      "opts": [
       "Click the link quickly before you are locked out",
       "Stop, and check whether the sender and request are genuine",
       "Reply with your password so they can verify your account"
      ],
      "a": 1,
      "fb": "Correct. Urgency is a classic phishing tactic. Stop, verify the sender independently, and never send your password by email."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Strong passwords and password managers",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "A strong password keeps criminals out even if they know your email address. The NCSC's advice is to build passwords from three random words, for example 'coffeeTrainStapler'. This creates something long and hard to guess but easy to remember. Length beats complexity: a long passphrase is far stronger than a short word with a couple of symbols swapped in."
     },
     {
      "k": "points",
      "title": "Password do's and don'ts",
      "items": [
       "Use three random words for your important accounts",
       "Use a different password for every account, never reuse one",
       "Never share passwords or write them on a sticky note by the laptop",
       "Avoid obvious choices: the club name, a child's name, 'Password1'",
       "Change a password straight away if you think it has been exposed"
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Let a password manager do the hard work",
      "t": "The NCSC recommends using a password manager. It creates long, unique, random passwords for every account and remembers them for you, so you only have to recall one strong master password. This is far safer than reusing the same password everywhere, which is what lets one leak unlock all your accounts."
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Why reuse is so dangerous",
      "t": "If you use the same password for your club email as for an online shop, and that shop suffers a data breach, criminals will try the same email-and-password combination on other services. This is called credential stuffing. One reused password can quietly open the door to the booking system and every family's records."
     },
     {
      "k": "check",
      "q": "What does the NCSC recommend for creating a strong, memorable password?",
      "opts": [
       "A short word with a number on the end, like Camp1",
       "Three random words, such as coffeeTrainStapler",
       "Your child's name and birth year"
      ],
      "a": 1,
      "fb": "Correct. Three random words are long enough to resist guessing yet easy to remember. Better still, let a password manager generate and store them."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Multi-factor authentication",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Multi-factor authentication, also called two-step verification (2SV) or two-factor authentication (2FA), adds a second check on top of your password. Even if a criminal steals your password, they still cannot get in without that second factor. The NCSC recommends turning it on for all your important accounts, especially email, because your email can be used to reset the passwords on everything else."
     },
     {
      "k": "points",
      "title": "Common second factors",
      "items": [
       "A code from an authenticator app on your phone (the NCSC's preferred option)",
       "A prompt or notification you approve on a trusted device",
       "A code sent by text message",
       "A fingerprint or face scan",
       "A physical security key"
      ]
     },
     {
      "k": "steps",
      "title": "Switching on 2SV",
      "items": [
       {
        "h": "Open your account's security settings",
        "t": "Look for 'two-step verification', '2FA' or 'multi-factor authentication'."
       },
       {
        "h": "Start with your most important accounts",
        "t": "Do your work email, the booking or payment system, and any admin logins first."
       },
       {
        "h": "Choose an app-based method where you can",
        "t": "An authenticator app is stronger than a text message, which can be intercepted."
       },
       {
        "h": "Save your backup codes safely",
        "t": "Store the recovery codes in your password manager so you are not locked out if you change phone."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "The single highest-value habit",
      "t": "If you only do one thing after this course, turn on multi-factor authentication for your work email. It is quick, free and blocks the vast majority of account-takeover attempts even when a password has been stolen."
     },
     {
      "k": "check",
      "q": "How does multi-factor authentication protect an account?",
      "opts": [
       "It makes your password longer automatically",
       "It requires a second proof of identity as well as your password",
       "It hides your account from search engines"
      ],
      "a": 1,
      "fb": "Correct. A second factor means a stolen password alone is not enough to get in, which stops most account takeovers."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Device security and reporting",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "The laptops, tablets and phones we use around camp are another way in for attackers, especially as they travel between venues and get left in busy staff rooms. Keeping them updated, locked and free of dodgy software is a simple, powerful defence, and knowing how to report a problem quickly can turn a near-miss into a non-event."
     },
     {
      "k": "points",
      "title": "Keeping devices secure",
      "items": [
       "Turn on automatic updates so software and apps patch themselves promptly",
       "Lock the screen whenever you step away, and set a short auto-lock time",
       "Use a PIN, password, fingerprint or face unlock on every device",
       "Only install apps and software from official, trusted sources",
       "Keep anti-virus or built-in protection switched on",
       "Never plug in an unknown USB stick you have found"
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "How to report in the UK",
      "t": "Forward suspicious emails to the NCSC's Suspicious Email Reporting Service at report@phishing.gov.uk, and suspicious texts to 7726. The public has already reported over 32 million scam emails this way, leading to hundreds of thousands of malicious websites being taken down. If money has been lost or a fraud has taken place, report it to Action Fraud."
     },
     {
      "k": "steps",
      "title": "If something goes wrong",
      "items": [
       {
        "h": "Do not hide it",
        "t": "Reporting quickly limits the damage. No one will be in trouble for an honest mistake reported straight away."
       },
       {
        "h": "Tell your manager or DPO immediately",
        "t": "If a device is lost or stolen, or you clicked a bad link, say so at once."
       },
       {
        "h": "Change affected passwords",
        "t": "From a device you trust, change the password on any account that may be exposed."
       },
       {
        "h": "Support the breach response",
        "t": "If children's or families' personal data may be affected, we may need to notify the ICO within 72 hours, so speed matters."
       }
      ]
     },
     {
      "k": "check",
      "q": "You realise you clicked a link in a phishing email an hour ago. What should you do?",
      "opts": [
       "Say nothing and hope nothing happens",
       "Tell your manager straight away and change any affected passwords",
       "Wait until the end of the week in case it resolves itself"
      ],
      "a": 1,
      "fb": "Correct. Fast, honest reporting limits the damage. Hiding it only gives an attacker more time and can turn a small slip into a data breach."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "What does the NCSC recommend for creating a strong, memorable password?",
    "opts": [
     "A short word with a number, like Camp1",
     "Three random words, such as coffeeTrainStapler",
     "Your child's name and birth year"
    ],
    "a": 1,
    "fb": "Three random words make a password long enough to resist guessing but easy to remember. A password manager can generate and store them for you."
   },
   {
    "q": "An email claiming to be from head office urgently asks you to confirm your login. What should you do first?",
    "opts": [
     "Click the link quickly before the account locks",
     "Stop, and check whether the sender and request are genuine",
     "Reply with your password so they can verify it"
    ],
    "a": 1,
    "fb": "Urgency is a classic phishing tactic. Stop, verify the sender using details you already trust, and never send a password by email."
   },
   {
    "q": "In the UK, where should you forward a suspicious email?",
    "opts": [
     "report@phishing.gov.uk",
     "999",
     "Back to the sender, asking if it is real"
    ],
    "a": 0,
    "fb": "The NCSC's Suspicious Email Reporting Service is report@phishing.gov.uk. Suspicious texts can be forwarded to 7726."
   },
   {
    "q": "How does multi-factor authentication (2SV) protect an account?",
    "opts": [
     "It makes your password longer automatically",
     "It requires a second proof of identity as well as your password",
     "It hides your account from search engines"
    ],
    "a": 1,
    "fb": "A second factor means a stolen password on its own is not enough to log in, which blocks most account takeovers. Turn it on for your email first."
   },
   {
    "q": "Which legal framework requires us to keep families' personal data secure?",
    "opts": [
     "The Highway Code",
     "UK GDPR and the Data Protection Act 2018",
     "A Cyber Essentials certificate alone"
    ],
    "a": 1,
    "fb": "UK GDPR and the Data Protection Act 2018 require appropriate security for personal data. Serious breaches may need reporting to the ICO within 72 hours."
   },
   {
    "q": "You clicked a suspicious link an hour ago. What is the best response?",
    "opts": [
     "Say nothing in case you get into trouble",
     "Tell your manager straight away and change any affected passwords",
     "Wait a week to see if anything happens"
    ],
    "a": 1,
    "fb": "Fast, honest reporting limits the damage. No one is in trouble for an honest mistake reported promptly; hiding it only helps the attacker."
   }
  ]
 },
 {
  "id": "c56",
  "title": "Environmental & Sustainability Awareness",
  "cat": "Recommended",
  "cover": "shield",
  "category": "health",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "Environmental and Sustainability Awareness is a CPD course for holiday-camp and activity-club staff, from playworkers to site managers. It is built on the waste hierarchy set out in the Waste (England and Wales) Regulations 2011, England's Simpler Recycling rules and the duty of care under the Environmental Protection Act 1990. You will learn how to cut waste, recycle right, save energy and water, and help children grow up as environmental change-makers.",
  "lessons": [
   {
    "id": "l1",
    "title": "Why sustainability matters at our club",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Everything we run at a holiday camp or activity club has an environmental footprint: the food we serve, the crafts we buy, the lights we leave on and the waste we throw away. Being a sustainable setting means making everyday choices that cut waste, save energy and protect the world our children will grow up in."
     },
     {
      "k": "points",
      "title": "Where our impact shows up",
      "items": [
       "Waste: packaging, food scraps, broken toys and craft offcuts",
       "Energy: lighting, heating, kitchens and screens left running",
       "Water: taps, cleaning and messy-play clean-ups",
       "Travel: staff and family journeys to and from the site"
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Your legal duty of care for waste",
      "t": "Under the Environmental Protection Act 1990 (the duty of care in section 34), our setting must store waste safely, only pass it to a licensed waste carrier, and keep the transfer paperwork. Getting this wrong can lead to Environment Agency enforcement and fines."
     },
     {
      "k": "check",
      "q": "A parent asks what 'being a sustainable setting' means for our club. The best answer is:",
      "opts": [
       "It only matters to the manager, not to session staff",
       "Making everyday choices that cut waste, save energy and protect the environment",
       "Simply recycling the office paper"
      ],
      "a": 1,
      "fb": "Sustainability is everyone's job and covers waste, energy, water and travel, not just paper recycling."
     }
    ]
   },
   {
    "id": "l2",
    "title": "The waste hierarchy: reduce, reuse, recycle",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "The waste hierarchy is the order the law asks us to follow when dealing with waste. It comes from the Waste (England and Wales) Regulations 2011 and puts preventing waste first and throwing it away last."
     },
     {
      "k": "steps",
      "title": "The five tiers, top to bottom",
      "items": [
       {
        "h": "Prevention (reduce)",
        "t": "Don't create the waste at all, for example buying refillable paints instead of single-use pots."
       },
       {
        "h": "Preparing for reuse",
        "t": "Repair, refill or repurpose, such as turning scrap paper and boxes into craft materials."
       },
       {
        "h": "Recycling",
        "t": "Sort paper, card, plastics, glass and metal so they can be made into something new."
       },
       {
        "h": "Other recovery",
        "t": "Recover value from what's left, for example food waste sent for composting or energy."
       },
       {
        "h": "Disposal",
        "t": "Landfill is the last resort, only for what genuinely can't be reused or recycled."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Reduce beats recycle",
      "t": "Recycling is good, but preventing waste is better. Before ordering craft or party supplies, ask whether we can use what we already have, borrow it, or choose a reusable option."
     },
     {
      "k": "check",
      "q": "Under the waste hierarchy, which option should we try first?",
      "opts": [
       "Recycling",
       "Preventing (reducing) the waste in the first place",
       "Sending it to landfill"
      ],
      "a": 1,
      "fb": "Prevention sits at the top of the hierarchy; disposal to landfill is always the last resort."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Recycling right at the club",
    "mins": 6,
    "blocks": [
     {
      "k": "callout",
      "tone": "law",
      "title": "Simpler Recycling is now the law",
      "t": "Under England's Simpler Recycling rules, since 31 March 2025 workplaces with 10 or more employees must separate dry recyclables (paper and card, plastic, glass and metal) and food waste from general waste. Smaller settings must comply by 31 March 2027."
     },
     {
      "k": "points",
      "title": "Sort it right",
      "items": [
       "Paper and card: flatten boxes, keep them clean and dry",
       "Plastics, glass and metal: rinse containers, empty with lids off",
       "Food waste: scraps and leftovers into the caddy, no packaging",
       "General waste: only what genuinely can't be recycled"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Watch for contamination",
      "t": "One greasy pizza box or half-full drink can turn a whole bin of recycling into general waste. When in doubt, rinse it out, and never bag your recycling in black sacks."
     },
     {
      "k": "text",
      "t": "We also avoid banned single-use plastics. Since 1 October 2023 England bans supplying single-use plastic plates, bowls, trays, cutlery, balloon sticks and polystyrene food and drink containers, so we choose reusables or compostable alternatives for snacks and parties."
     },
     {
      "k": "check",
      "q": "You're clearing lunch tables. Where does a child's greasy, food-smeared cardboard tray belong?",
      "opts": [
       "In the card recycling",
       "In general waste, because grease contaminates recycling",
       "In the food caddy with the packaging"
      ],
      "a": 1,
      "fb": "Grease contaminates card recycling, so food-soiled card goes in general waste, and packaging never goes in the food caddy."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Saving energy and water",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Energy is one of our biggest costs and biggest impacts. Small habits repeated across a busy day add up fast, and they cost nothing to adopt."
     },
     {
      "k": "points",
      "title": "Easy energy wins",
      "items": [
       "Switch off lights in empty halls, stores and toilets",
       "Turn off laptops, projectors and speakers at the end of a session, not standby",
       "Close external doors and windows when the heating is on",
       "Only boil the water you need and keep fridge doors shut"
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "One degree makes a difference",
      "t": "The Carbon Trust notes that turning the heating down by just one degree can cut heating bills by around 8%. Layer up rather than reaching for the thermostat."
     },
     {
      "k": "points",
      "title": "Save water too",
      "items": [
       "Report dripping taps and running toilets straight away",
       "Use bowls, not running taps, for messy-play clean-ups",
       "Collect rainwater in butts for the garden and outdoor play"
      ]
     },
     {
      "k": "check",
      "q": "The sports hall is empty for two hours over lunch. What's the best action?",
      "opts": [
       "Leave the lights and heating on so it's ready later",
       "Switch off the lights and turn the heating down while it's empty",
       "Open the windows with the heating still on"
      ],
      "a": 1,
      "fb": "Switch off and turn down when spaces are empty; never heat a room while venting it through open windows."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Everyday habits and inspiring children",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Sustainability sticks when it's part of the routine and when children join in. As a setting we can lead by example and make the green choice the easy, normal choice."
     },
     {
      "k": "points",
      "title": "Build it into the day",
      "items": [
       "Label bins clearly with pictures so everyone sorts correctly",
       "Plan low-waste snacks and crafts using reused and natural materials",
       "Choose local, seasonal and reusable over single-use where you can",
       "Celebrate 'green' wins on the parent noticeboard"
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Children are powerful change-makers",
      "t": "Nature play, litter-picks, growing vegetables and 'switch-off monitor' roles turn sustainability into fun learning. Children often take these habits home to their families."
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "If you spot a problem",
      "t": "Overflowing bins, a leak, or the wrong waste in the wrong bin? Tell your manager or site lead so it can be fixed and reported through the proper channels."
     },
     {
      "k": "check",
      "q": "What's a simple way to help children build lasting green habits?",
      "opts": [
       "Tell them off for using the wrong bin",
       "Give them real roles like switch-off monitors and picture-labelled bins",
       "Keep sustainability a staff-only topic"
      ],
      "a": 1,
      "fb": "Positive, hands-on roles and clear picture labels help children learn and carry the habits home."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "Which sits at the top of the waste hierarchy?",
    "opts": [
     "Recycling",
     "Preventing waste (reduce)",
     "Disposal to landfill"
    ],
    "a": 1,
    "fb": "Prevention comes first; disposal is the last resort under the Waste (England and Wales) Regulations 2011."
   },
   {
    "q": "Since 31 March 2025, workplaces in England with 10 or more staff must:",
    "opts": [
     "Send everything to general waste",
     "Separate dry recyclables and food waste from general waste",
     "Only recycle office paper"
    ],
    "a": 1,
    "fb": "That's the Simpler Recycling requirement; smaller settings must follow by 31 March 2027."
   },
   {
    "q": "Which has been banned as a single-use plastic in England since October 2023?",
    "opts": [
     "Reusable metal cutlery",
     "Single-use plastic cutlery and polystyrene food containers",
     "Paper straws"
    ],
    "a": 1,
    "fb": "Single-use plastic plates, bowls, trays, cutlery, balloon sticks and polystyrene food and drink containers are banned."
   },
   {
    "q": "A food-smeared cardboard tray should go in:",
    "opts": [
     "Card recycling",
     "General waste",
     "The food caddy"
    ],
    "a": 1,
    "fb": "Grease contaminates recycling, so food-soiled card goes in general waste."
   },
   {
    "q": "Turning the heating down by one degree can cut heating bills by roughly:",
    "opts": [
     "8%",
     "50%",
     "No saving at all"
    ],
    "a": 0,
    "fb": "The Carbon Trust cites around 8% per degree; switching equipment off out of hours saves more still."
   },
   {
    "q": "Our legal duty of care for waste comes from:",
    "opts": [
     "The Highway Code",
     "The Environmental Protection Act 1990",
     "No law at all"
    ],
    "a": 1,
    "fb": "Section 34 of the Environmental Protection Act 1990 requires safe storage and licensed disposal of waste."
   }
  ]
 },
 {
  "id": "c57",
  "title": "Safe Use of Play & Sports Equipment",
  "cat": "Recommended",
  "cover": "shield",
  "category": "health",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "Safe Use of Play & Sports Equipment is a CPD course for holiday-camp and activity-club staff who set up, supervise and check the equipment children use every day. It is built on the BS EN 1176 playground equipment standard and the BS EN 1177 impact-absorbing surfacing standard, turning official good practice into simple, repeatable routines. You will learn the three-tier inspection regime, how surfacing protects against falls, and how to take faulty kit out of use before anyone is hurt.",
  "lessons": [
   {
    "id": "l1",
    "title": "Why equipment safety matters and the standards behind it",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Play and sports equipment is one of the most valuable parts of a holiday camp or activity club, but it is also where many injuries happen. Climbing frames, swings, goalposts and gym kit all put children at height, in motion or under load, so they must be well chosen, well maintained and well supervised. We are not a school or a local authority, but we adopt the same recognised standards because they are the clearest measure of good practice in the UK."
     },
     {
      "k": "points",
      "title": "The two standards we build on",
      "items": [
       "BS EN 1176 covers playground equipment: how it is designed, installed, inspected and maintained, including guidance on inspection in Part 7",
       "BS EN 1177 covers impact-absorbing surfacing and how the Critical Fall Height of a surface is determined",
       "Together they set the benchmark we follow for fixed play equipment on our sites",
       "For sports and portable kit we also follow product standards such as BS EN 748 for football goals"
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "The key legal duty",
      "t": "Under the Health and Safety at Work etc. Act 1974 and the Management of Health and Safety at Work Regulations 1999, we must assess the risks from our equipment and take reasonable steps to keep children and staff safe. Following BS EN 1176 and BS EN 1177 is how we show we have taken those reasonable steps."
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Good practice, not red tape",
      "t": "These standards were written for playgrounds and schools, but the thinking transfers directly to camps and clubs. Treat them as a proven checklist rather than paperwork: they tell you what a safe piece of equipment looks like and how often to check it."
     },
     {
      "k": "check",
      "q": "Which British/European standard covers impact-absorbing playground surfacing?",
      "opts": [
       "BS EN 1176",
       "BS EN 1177",
       "BS EN 748"
      ],
      "a": 1,
      "fb": "BS EN 1177 covers surfacing and the Critical Fall Height. BS EN 1176 covers the equipment itself, and BS EN 748 covers football goals."
     }
    ]
   },
   {
    "id": "l2",
    "title": "The three-tier inspection regime",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "BS EN 1176 recommends a structured inspection programme with three levels. Each level has a different depth and a different person doing it. On a camp site, staff carry out the frequent checks and a qualified external inspector does the annual one. Knowing which check is which stops important faults slipping through the gaps."
     },
     {
      "k": "steps",
      "title": "The three inspection levels",
      "items": [
       {
        "h": "Routine visual inspection",
        "t": "A quick daily look for obvious hazards such as broken glass, vandalism, worn ropes, missing parts or standing water. Any member of trained staff can do this before children arrive."
       },
       {
        "h": "Operational inspection",
        "t": "A more detailed check of wear, stability and moving parts, typically every one to three months depending on how heavily the equipment is used. It usually needs a competent staff member with a checklist."
       },
       {
        "h": "Annual main inspection",
        "t": "A thorough yearly inspection of overall condition, standards compliance and long-term wear, carried out by an independent inspector qualified with the Register of Play Inspectors International (RPII), such as a RoSPA inspector."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Match frequency to use",
      "t": "A swing hammered by 200 children every day of the summer wears far faster than one used at a quiet weekend club. Increase the frequency of operational checks for your busiest, most popular equipment."
     },
     {
      "k": "check",
      "q": "Who should carry out the annual main inspection?",
      "opts": [
       "Any staff member on shift that day",
       "An independent RPII-qualified inspector",
       "The children, as part of an activity"
      ],
      "a": 1,
      "fb": "The annual main inspection should be done by an independent, suitably qualified inspector registered with the RPII, such as a RoSPA Play Safety inspector."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Surfacing and fall height (BS EN 1177)",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Most serious playground injuries come from falls onto a hard surface, especially head injuries. BS EN 1177 exists to reduce that risk by setting how impact-absorbing surfacing is tested and rated. The idea is simple: the higher a child can fall, the more cushioning the surface below must provide."
     },
     {
      "k": "points",
      "title": "What the numbers mean",
      "items": [
       "Free height of fall is the highest point a child can realistically fall from; on play equipment it should never exceed 3 metres",
       "Where the fall height is above 0.6 metres, impact-absorbing surfacing is needed beneath and around the equipment",
       "Critical Fall Height is the maximum height a surface is tested and rated to protect against",
       "Surfaces are tested with a dropped headform and must keep the Head Injury Criterion below 1000 and peak deceleration below 200g"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Surfacing can fail silently",
      "t": "Loose-fill surfaces such as bark or rubber chips scatter, compact and thin out over a busy season, especially under swings and slide exits. If the depth drops, the Critical Fall Height drops with it, even though the equipment looks fine. Rake, top up and check depth as part of your routine."
     },
     {
      "k": "check",
      "q": "A slide platform lets a child fall from about 1.8 metres. What must be true of the surface below?",
      "opts": [
       "Nothing, grass is always fine",
       "It must be impact-absorbing and rated to at least that fall height",
       "Only a warning sign is required"
      ],
      "a": 1,
      "fb": "Above 0.6 metres you need impact-absorbing surfacing, and its Critical Fall Height must meet or exceed the equipment's free height of fall, so it must be rated to at least 1.8 metres here."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Pre-use checks and spotting hazards",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "The routine visual check is your first line of defence and it only takes a few minutes. Done properly before the first child arrives, it catches overnight vandalism, weather damage and the everyday wear that builds up during a busy holiday programme."
     },
     {
      "k": "steps",
      "title": "Your daily pre-use walk-round",
      "items": [
       {
        "h": "Clear the area",
        "t": "Look for litter, broken glass, dog fouling, needles or standing water, and remove hazards before anyone plays."
       },
       {
        "h": "Check the structure",
        "t": "Look for loose or missing bolts, cracked timber or plastic, rust, wobble and sharp or protruding edges."
       },
       {
        "h": "Check moving and flexible parts",
        "t": "Inspect swing chains, ropes, nets and hinges for fraying, stretching or excessive wear, and confirm nothing traps fingers or clothing."
       },
       {
        "h": "Check the surface",
        "t": "Confirm loose-fill surfacing is at the right depth and evenly spread, and that mats or tiles are flat and secure."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Record it, even when all is well",
      "t": "A quick dated log of your daily check, ticking that everything passed, is powerful evidence that you inspect responsibly. If an incident ever happens, that simple record shows the equipment was being looked after."
     },
     {
      "k": "check",
      "q": "During your morning walk-round you notice a swing chain is badly frayed. What is the right action?",
      "opts": [
       "Leave it, it will probably last the day",
       "Take the swing out of use and report it before children arrive",
       "Tell the children to swing gently"
      ],
      "a": 1,
      "fb": "A frayed chain can fail without warning. Take it out of use, make it clearly unusable, and report it so it can be repaired or replaced."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Sports and portable equipment, and taking faults out of use",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Not all our equipment is fixed. Goalposts, gymnastics and PE kit, agility equipment and trampolines are moved, set up and put away by staff, which introduces its own risks, from tipping to trapping. The same principle applies: choose kit that meets a recognised standard, set it up correctly and check it before use."
     },
     {
      "k": "points",
      "title": "Portable equipment essentials",
      "items": [
       "Football goals should meet a recognised standard such as BS EN 748, and portable or freestanding goals must be anchored or weighted so they cannot tip",
       "Gym and agility equipment should be assembled to the manufacturer's instructions, on suitable matting, and checked for stability before use",
       "Trampolines and inflatables need competent supervision, safe surrounds and correct anchoring, following the manufacturer's guidance",
       "Every portable item should be checked before each use and stored securely so children cannot access it unsupervised"
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Goalposts must never be left free-standing",
      "t": "Movable goalposts have caused deaths when they tipped onto children. Our duty under the Health and Safety at Work etc. Act 1974 means we must secure or weight every goal, never leave one unsecured, and remove or immobilise any goal that cannot be made stable."
     },
     {
      "k": "steps",
      "title": "When you find a fault",
      "items": [
       {
        "h": "Stop use immediately",
        "t": "Prevent children from using the equipment and, if possible, move them to a safe activity."
       },
       {
        "h": "Make it safe",
        "t": "Cordon off, cover or dismantle the item, or make it clearly unusable, so no one uses it by mistake."
       },
       {
        "h": "Report and log it",
        "t": "Tell your manager and record the fault, the date and the action taken in your defect or maintenance log."
       },
       {
        "h": "Do not return it until fixed",
        "t": "Only put the equipment back into use once it has been properly repaired, replaced or signed off."
       }
      ]
     },
     {
      "k": "check",
      "q": "You are setting up a portable goal for a lunchtime kickabout. What must you do?",
      "opts": [
       "Stand it up quickly, kickabouts are low risk",
       "Anchor or weight it securely so it cannot tip over",
       "Ask an older child to hold it in place"
      ],
      "a": 1,
      "fb": "Portable goals must always be anchored or weighted before use. An unsecured goal can tip and cause fatal injuries, so it must never be left free-standing."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "Which pair of standards underpins this course?",
    "opts": [
     "BS EN 1176 for equipment and BS EN 1177 for surfacing",
     "BS EN 60601 and BS EN 12345",
     "The Highway Code and the Fire Safety Order"
    ],
    "a": 0,
    "fb": "BS EN 1176 covers playground equipment and BS EN 1177 covers impact-absorbing surfacing and Critical Fall Height."
   },
   {
    "q": "How often is a routine visual inspection normally carried out?",
    "opts": [
     "Once a year",
     "Daily, before use",
     "Only after an accident"
    ],
    "a": 1,
    "fb": "The routine visual inspection is a quick daily check for obvious hazards, done before children use the equipment."
   },
   {
    "q": "What is the maximum free height of fall allowed from play equipment under BS EN 1176?",
    "opts": [
     "1 metre",
     "3 metres",
     "10 metres"
    ],
    "a": 1,
    "fb": "The free height of fall should never exceed 3 metres, and impact-absorbing surfacing is required where it is above 0.6 metres."
   },
   {
    "q": "Why does loose-fill surfacing such as bark need regular attention?",
    "opts": [
     "It looks untidy",
     "As it thins and compacts, the Critical Fall Height it provides drops",
     "It attracts insects"
    ],
    "a": 1,
    "fb": "Loose-fill scatters and compacts under busy use, especially under swings and slides, reducing the protection it offers even when the equipment looks fine."
   },
   {
    "q": "You find a cracked climbing frame upright during your morning check. What is the correct first action?",
    "opts": [
     "Note it for the annual inspection",
     "Take it out of use and make it clearly unusable, then report it",
     "Tell children to avoid that one part"
    ],
    "a": 1,
    "fb": "Stop use, make it safe so no one uses it by mistake, then report and log it. It should not return to use until properly repaired."
   },
   {
    "q": "What must always be done with a portable or free-standing goalpost?",
    "opts": [
     "Anchor or weight it so it cannot tip",
     "Leave it free-standing for easy moving",
     "Paint it a bright colour"
    ],
    "a": 0,
    "fb": "Movable goals must be securely anchored or weighted every time. Unsecured goals have tipped and caused fatal injuries."
   }
  ]
 },
 {
  "id": "c58",
  "title": "Transporting Children Safely",
  "cat": "Recommended",
  "cover": "shield",
  "category": "health",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "Transporting Children Safely is a CPD-style course for holiday-camp and activity-club staff who drive or supervise children on minibuses, coaches and day trips. It covers driving entitlement and Section 19 permits, seat belts and correct child restraints, head-counts and supervision ratios. It is built on current GOV.UK and DVSA rules plus MiDAS good practice, adapted for out-of-school activity settings rather than schools.",
  "lessons": [
   {
    "id": "l1",
    "title": "Who is allowed to drive the minibus?",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Before anyone turns a key, be certain they are legally entitled to drive that vehicle with children on board. Driving entitlement in the UK depends on when the driver passed their car test, the size of the minibus, and whether the trip counts as 'hire or reward'. Getting this wrong can invalidate insurance and leave your club uninsured after a crash."
     },
     {
      "k": "points",
      "title": "The core licence rules (GOV.UK / DVLA)",
      "items": [
       "Drivers who passed a car test on or after 1 January 1997 hold category B. They may drive a minibus of up to 16 passenger seats, not for hire or reward, if they are aged 21 or over, have held their full car licence for at least two years, and drive on a voluntary basis.",
       "The vehicle's maximum authorised mass must not exceed 3.5 tonnes (4.25 tonnes with specialist equipment for disabled passengers).",
       "Drivers who passed before 1 January 1997 usually have category D1 (101) 'not for hire or reward' and can drive a 16-seat minibus without the weight limit.",
       "To be paid to drive, or to drive commercially, the driver needs full category D1 gained by a separate test."
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Charging passengers: the Section 19 permit",
      "t": "If your not-for-profit club recovers running costs from passengers (so the trip is 'for hire or reward'), you normally need a Section 19 permit under the Transport Act 1985 rather than a full PSV operator's licence. Permits are issued by the Traffic Commissioner or a designated body such as the Community Transport Association, cost a small fee, and cannot be used to carry the general public. Never charge fares without checking this."
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Adopt MiDAS as good practice",
      "t": "We are an activity provider, not a school, but we adopt the Minibus Driver Awareness Scheme (MiDAS), run by the Community Transport Association, as our benchmark. Every camp driver should hold a current MiDAS assessment and a clean licence check before they carry children."
     },
     {
      "k": "check",
      "q": "A play-scheme volunteer passed their car test in 2015 and wants to drive the club's 15-seat, 3-tonne minibus on an unpaid trip. What makes this lawful?",
      "opts": [
       "Any full car licence is enough on its own",
       "They are 21+, have held the licence two years, and drive voluntarily within the weight limit",
       "They must first pass a full category D bus test"
      ],
      "a": 1,
      "fb": "On a category B licence they can drive it 'not for hire or reward' only if aged 21+, licence held two years, driving voluntarily, and the minibus stays within the 3.5-tonne limit."
     }
    ]
   },
   {
    "id": "l2",
    "title": "Seat belts and the right child restraint",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "A restraint only protects a child if it is the right one, fitted correctly, and actually worn. The rules for cars are stricter than for minibuses and coaches, so know which vehicle you are in before you set off."
     },
     {
      "k": "points",
      "title": "Child car seats: the law (GOV.UK)",
      "items": [
       "In cars and goods vehicles, children must use a correct child car seat until they are 12 years old or 135cm tall, whichever comes first — after that they use an adult seat belt.",
       "Only use EU-approved seats: height-based 'R129' (i-Size) or weight-based 'ECE R44' seats, shown by an 'E' in a circle on the label.",
       "A backless booster is only approved for children over 125cm or 22kg.",
       "Never fit a rear-facing seat in a front seat protected by an active airbag."
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "On minibuses and coaches",
      "t": "On a minibus, if seat belts or child restraints are fitted they must be worn. Children aged 3 and over must use an adult belt where an appropriate child restraint is not available. On coaches, passengers over 14 must wear the belts provided and be told to do so. Crucially, the driver is responsible in law for making sure passengers under 14 are properly restrained — this duty sits with your staff, not the children."
     },
     {
      "k": "steps",
      "title": "The fit-and-check routine",
      "items": [
       {
        "h": "Match the child",
        "t": "Check each child's height and weight against the restraint before they board."
       },
       {
        "h": "Fit firm",
        "t": "Route the belt correctly and pull it tight — no slack, no twists, buckle clicked."
       },
       {
        "h": "Belt low and flat",
        "t": "Lap belt across the hips, not the tummy; diagonal across the shoulder, never under the arm."
       },
       {
        "h": "Recheck after stops",
        "t": "Re-verify belts after every stop, as children loosen them on long journeys."
       }
      ]
     },
     {
      "k": "check",
      "q": "On your minibus a fitted child restraint is available for a 5-year-old. What must happen?",
      "opts": [
       "It is optional, an adult belt is always fine",
       "The child must use the appropriate restraint that is fitted",
       "Children under 6 need no restraint on a minibus"
      ],
      "a": 1,
      "fb": "If restraints are fitted and appropriate, they must be used, and the driver is legally responsible for ensuring under-14s are restrained."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Head-counts: on, off, and in between",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Most 'left behind' incidents happen at transitions — boarding, alighting, and busy stops. A disciplined counting system, not a rough glance, is what keeps every child accounted for. OEAP National Guidance recommends regular head-counts throughout any off-site visit, with the frequency increased at higher-risk moments."
     },
     {
      "k": "steps",
      "title": "The count routine",
      "items": [
       {
        "h": "Count against a named list",
        "t": "Hold a register of exactly who should be on this vehicle — count to the list, not just to a number."
       },
       {
        "h": "Count on",
        "t": "One named adult counts each child on and confirms the total before the doors close."
       },
       {
        "h": "Two-person confirm",
        "t": "A second adult independently recounts and walks the aisle to check seats and belts."
       },
       {
        "h": "Count off",
        "t": "Repeat the same on/off routine at every destination and every return, in the same order."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Watch the pinch points",
      "t": "Increase counts when getting on and off transport, in car parks, at crowded venues, and in poor visibility or bad weather. Never let a child return to the vehicle unaccompanied to fetch a bag — that is exactly when a count silently goes wrong."
     },
     {
      "k": "points",
      "title": "Make it fail-safe",
      "items": [
       "Use the same two adults for on and off counts so a mismatch is spotted instantly.",
       "Reconcile any discrepancy before the vehicle moves — stop, don't 'assume they're here'.",
       "Sweep the whole vehicle, including the back row and floor, before locking up.",
       "Log the final head-count and the time on your trip record."
      ]
     },
     {
      "k": "check",
      "q": "You count 14 children on board but the named list says 15. What do you do?",
      "opts": [
       "Set off and count again at the next stop",
       "Stop everything and reconcile the list before the vehicle moves",
       "Assume one is in the toilet and drive on"
      ],
      "a": 1,
      "fb": "A mismatch must be resolved before moving. Recount against the named list and locate the missing child immediately — never drive on an unresolved count."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Supervision, ratios and safe boarding",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "The driver drives — they cannot also supervise. Every trip needs enough additional adults so that children are properly supervised on board and at the roadside. There is no single legal ratio for transport, so you must risk-assess each journey."
     },
     {
      "k": "points",
      "title": "Judging the ratio (OEAP National Guidance)",
      "items": [
       "Use the STAGER framework — Staff experience, Task, Age of children, Group make-up, Environment and Requirements — to decide how many adults you need.",
       "Younger children, additional needs, motorway journeys and unfamiliar venues all push the ratio up.",
       "The driver is over and above the supervising ratio, not part of it.",
       "Plan a seating arrangement so staff sit near exits and any children needing close support."
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Seat plan and buddy up",
      "t": "Fix a seating plan before boarding and keep it consistent. Pair children into buddies and seat the calmest, most experienced adult by the rear door. A known seat makes both head-counts and any evacuation far faster."
     },
     {
      "k": "steps",
      "title": "Board and reverse safely",
      "items": [
       {
        "h": "Board on the safe side",
        "t": "Load and unload only onto a pavement or safe verge, never into the road or traffic side."
       },
       {
        "h": "Doors and belts",
        "t": "Confirm all doors are secure and all belts fastened before releasing the handbrake."
       },
       {
        "h": "Use a banksman",
        "t": "Never reverse blind. A trained adult guides you from a safe position while children are kept well clear."
       },
       {
        "h": "Walk before you drive",
        "t": "Do a quick walk-round for children, bags and obstacles near the wheels before moving off."
       }
      ]
     },
     {
      "k": "check",
      "q": "For an unfamiliar motorway trip with a group of 8-year-olds, how does the driver fit the supervision plan?",
      "opts": [
       "The driver counts as one of the supervising adults",
       "The driver is extra; you still need enough separate adults to supervise",
       "No extra adults are needed if belts are worn"
      ],
      "a": 1,
      "fb": "The driver cannot supervise while driving. Using STAGER, plan enough additional adults on top of the driver, raised for young children and motorway conditions."
     }
    ]
   },
   {
    "id": "l5",
    "title": "When things go wrong: breakdowns and emergencies",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "A breakdown with a minibus full of children is a fast-moving safety situation. Your priority is getting children away from live traffic, not fixing the vehicle. Brief every adult on the plan before you ever set off."
     },
     {
      "k": "steps",
      "title": "Breakdown on a fast road",
      "items": [
       {
        "h": "Get off the carriageway",
        "t": "If you can, pull well onto the hard shoulder or a safe verge, wheels turned away from traffic, hazards on."
       },
       {
        "h": "Everyone out, offside stays shut",
        "t": "Lead children out of the nearside (kerb) doors and up the embankment behind the safety barrier."
       },
       {
        "h": "Count and hold",
        "t": "Do a full head-count away from the road and keep the group together, well back from traffic."
       },
       {
        "h": "Call for help",
        "t": "Phone breakdown assistance and your base; on a motorway ring 999 if you are in a live-lane danger."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "The Highway Code on breakdowns",
      "t": "The Highway Code is clear: on a motorway, get all passengers out and keep them behind the barrier, away from the carriageway and hard shoulder. Do not attempt repairs near moving traffic. Treat it as non-negotiable with a group of children."
     },
     {
      "k": "points",
      "title": "Carry it, know it, use it",
      "items": [
       "A stocked first-aid kit, high-visibility vests for adults, a charged phone and a warning triangle (for ordinary roads, not motorways).",
       "An emergency contact list and the named register for the exact children on board.",
       "A charged phone with base and breakdown numbers saved and reachable.",
       "Clear roles agreed in advance: who leads the children, who calls, who counts."
      ]
     },
     {
      "k": "check",
      "q": "Your minibus breaks down on a motorway with children aboard. What comes first?",
      "opts": [
       "Keep the children seated inside while you check the engine",
       "Get everyone out via the kerb side and behind the safety barrier, then call for help",
       "Wave down another driver to help push"
      ],
      "a": 1,
      "fb": "Follow the Highway Code: evacuate to behind the barrier, away from traffic, head-count, then call for help. Never attempt repairs beside live motorway traffic."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "Until what point must a child normally use a child car seat in a car?",
    "opts": [
     "Until age 10 or 120cm",
     "Until age 12 or 135cm, whichever comes first",
     "Until age 14 or 150cm"
    ],
    "a": 1,
    "fb": "GOV.UK: a child must use a correct car seat until 12 years old or 135cm tall, whichever comes first, then may use an adult belt."
   },
   {
    "q": "On a minibus, who is responsible in law for ensuring passengers under 14 are properly restrained?",
    "opts": [
     "Each child's parent",
     "The driver",
     "The activity leader only"
    ],
    "a": 1,
    "fb": "The driver is legally responsible for making sure passengers under 14 use the seat belts or child restraints that are fitted."
   },
   {
    "q": "What does a Section 19 permit let a not-for-profit club do?",
    "opts": [
     "Run a commercial bus service open to the public",
     "Recover running costs from passengers without a full PSV operator's licence",
     "Skip fitting seat belts on short trips"
    ],
    "a": 1,
    "fb": "A Section 19 permit under the Transport Act 1985 lets non-profit bodies charge to cover costs without a PSV operator's licence, but not carry the general public."
   },
   {
    "q": "When should head-counts be done most frequently?",
    "opts": [
     "Only at the start and end of the day",
     "When getting on and off transport and in crowded or low-visibility conditions",
     "Once every hour on a fixed timer"
    ],
    "a": 1,
    "fb": "OEAP National Guidance: increase head-counts at transitions such as boarding and alighting, crowded venues and poor visibility."
   },
   {
    "q": "Before reversing the minibus you should:",
    "opts": [
     "Sound the horn and reverse quickly",
     "Use a banksman to guide you while children are kept well clear",
     "Ask a child to watch out of the back window"
    ],
    "a": 1,
    "fb": "Never reverse blind: use a trained banksman standing safely, and keep all children clear of the reversing area."
   },
   {
    "q": "A category B driver (test passed after 1997) may drive a 16-seat minibus not for hire or reward only if:",
    "opts": [
     "They hold any full car licence, with no other conditions",
     "They are 21+, have held the licence two years, drive voluntarily and stay within the weight limit",
     "They also hold a full category D bus licence"
    ],
    "a": 1,
    "fb": "On a category B licence you can drive it not for hire or reward only when aged 21+, licence held two years, driving voluntarily, within the 3.5-tonne limit."
   }
  ]
 },
 {
  "id": "c59",
  "title": "Whistleblowing",
  "cat": "Recommended",
  "cover": "people",
  "category": "together",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "Whistleblowing is CPD training for holiday-camp and activity-club staff on how to raise a concern when something puts children or safety at risk. It is built on the Public Interest Disclosure Act 1998 and signposts the NSPCC Whistleblowing Advice Line (0800 028 0285) as good-practice support we adopt. You will learn what a protected disclosure is, how the law shields workers who speak up in the public interest, and exactly how to report a concern at your setting.",
  "lessons": [
   {
    "id": "l1",
    "title": "What whistleblowing really means",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Whistleblowing is raising a concern about wrongdoing, danger or malpractice at work — usually something that affects other people, not just you. In a holiday club that might be a colleague ignoring safeguarding rules, an unsafe pick-up routine, or ratios being fudged to save money. It is not the same as a personal grievance about your own pay, rota or a manager you dislike."
     },
     {
      "k": "points",
      "title": "Concerns worth raising at a camp or club",
      "items": [
       "A colleague behaving inappropriately with a child",
       "Staff:child ratios being ignored or falsified",
       "First-aid, allergy or medication rules not being followed",
       "A near-miss or accident being hidden rather than logged",
       "Pressure to cover up a mistake or complaint"
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "The legal foundation: Public Interest Disclosure Act 1998",
      "t": "The Public Interest Disclosure Act 1998 (which added Part IVA to the Employment Rights Act 1996) gives legal protection to workers who make a 'protected disclosure' about certain wrongdoing. It is the standard our whistleblowing approach is built on."
     },
     {
      "k": "check",
      "q": "Which of these is whistleblowing rather than a personal grievance?",
      "opts": [
       "You think your hourly rate is too low",
       "A colleague is skipping the head-count on trips, risking a child being left behind",
       "You disagree with next week's rota"
      ],
      "a": 1,
      "fb": "Correct — a skipped head-count endangers children and affects others, so it is a whistleblowing concern. Pay and rota disputes are personal grievances handled separately."
     }
    ]
   },
   {
    "id": "l2",
    "title": "The law and how it protects you",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "A concern is legally protected only if it is a 'qualifying disclosure' — you reasonably believe it shows a specific type of wrongdoing. You do not need proof, and you can be wrong, as long as your belief is reasonable and you speak up in the public interest."
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Your protection under the Act",
      "t": "Under the Public Interest Disclosure Act 1998, a worker who makes a protected disclosure is protected from being dismissed or treated unfairly for speaking up. Since the Enterprise and Regulatory Reform Act 2013 the key test is that you reasonably believe the disclosure is in the public interest; acting in good faith still matters and a tribunal can reduce an award if a disclosure was not made in good faith."
     },
     {
      "k": "points",
      "title": "What a qualifying disclosure can be about",
      "items": [
       "A criminal offence",
       "Failure to meet a legal obligation",
       "A miscarriage of justice",
       "Danger to someone's health or safety",
       "Damage to the environment",
       "Deliberately hiding any of the above"
      ]
     },
     {
      "k": "check",
      "q": "Do you need firm proof before your concern can be protected?",
      "opts": [
       "Yes — without evidence you get no protection",
       "No — a reasonable belief made in the public interest is enough",
       "Only if a manager agrees with you first"
      ],
      "a": 1,
      "fb": "Correct. The law protects a disclosure based on your reasonable belief in the public interest — investigating and proving it is not your job."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Spotting concerns and overcoming the barriers",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Most harm continues because people notice something, feel uneasy, but talk themselves out of it. Loyalty to a colleague, fear of being wrong, or worry about being seen as a troublemaker all keep staff silent — and that is exactly what allows poor practice to carry on."
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Silence has a cost",
      "t": "If you say nothing, unsafe practice becomes the new normal and a child can be harmed. You do not have to be certain — 'I'm not sure, but something isn't right' is a perfectly good reason to raise a concern."
     },
     {
      "k": "points",
      "title": "Common reasons staff stay quiet — and the reality",
      "items": [
       "'I might be wrong' — you only need a reasonable belief, not proof",
       "'They're my friend' — protecting children comes before loyalty",
       "'It's not my job' — safeguarding is everyone's responsibility",
       "'Nothing will change' — the law and the NSPCC line exist for exactly this"
      ]
     },
     {
      "k": "check",
      "q": "You feel uneasy about how a senior coach speaks to one child, but you're not certain it's wrong. What should you do?",
      "opts": [
       "Wait until you have solid proof before saying anything",
       "Raise your concern now — uncertainty is not a reason to stay silent",
       "Only mention it if another colleague noticed it too"
      ],
      "a": 1,
      "fb": "Correct. You do not need certainty. Raising a reasonable, honest concern early is exactly what whistleblowing is for."
     }
    ]
   },
   {
    "id": "l4",
    "title": "How to raise a concern the right way",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Raising a concern well protects the child, protects you, and helps your manager act quickly. Stick to facts, keep it confidential, and put it in writing where you can."
     },
     {
      "k": "steps",
      "title": "Step by step",
      "items": [
       {
        "h": "Record the facts",
        "t": "Note what you saw or heard, when it happened, and who was involved. Stick to observations, not opinions."
       },
       {
        "h": "Report internally first",
        "t": "Tell your Designated Safeguarding Lead, or a manager you trust, as soon as possible — ideally in writing."
       },
       {
        "h": "Escalate if needed",
        "t": "If it concerns your manager, or nothing is done, go higher or to an outside body such as the Local Authority Designated Officer (LADO) or a prescribed person like Ofsted or the HSE."
       },
       {
        "h": "Act at once in an emergency",
        "t": "If a child is in immediate danger, call 999 straight away — do not wait to follow the internal steps."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "The NSPCC Whistleblowing Advice Line",
      "t": "If you are unsure, or you feel no one is listening, the NSPCC Whistleblowing Advice Line offers free, confidential advice on 0800 028 0285 (8am–8pm weekdays, 9am–6pm weekends) or help@nspcc.org.uk. You can call anonymously."
     },
     {
      "k": "check",
      "q": "You see a child left alone near the car park and in immediate danger. What comes first?",
      "opts": [
       "Write up the facts before doing anything else",
       "Make the child safe and call 999 if needed, then report internally",
       "Email the NSPCC advice line and wait for a reply"
      ],
      "a": 1,
      "fb": "Correct. In an emergency, safety comes first — act and call 999 if needed. Recording and reporting follow once the child is safe."
     }
    ]
   },
   {
    "id": "l5",
    "title": "After you speak up",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Once you have raised a concern, the organisation should take it seriously, keep your identity confidential where possible, and let you know it is being looked into. It is not your role to investigate — hand it over and let the process work."
     },
     {
      "k": "points",
      "title": "What you can expect",
      "items": [
       "Your concern taken seriously and looked into promptly",
       "Your identity kept confidential where possible",
       "No bullying, sacking or being pushed out for speaking up",
       "A route to escalate externally if the response is inadequate"
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Do not tackle it alone",
      "t": "Never confront the person, warn them, or try to gather evidence yourself — that can put a child at greater risk and damage any investigation. Report it and step back."
     },
     {
      "k": "check",
      "q": "After reporting a concern about a colleague, what should you NOT do?",
      "opts": [
       "Keep a note of what you reported and when",
       "Warn the colleague so they can explain themselves",
       "Escalate if you feel it wasn't handled properly"
      ],
      "a": 1,
      "fb": "Correct. Warning the person can put a child at risk and wreck any investigation. Keep your own note and escalate if needed instead."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "Which law is our whistleblowing approach built on?",
    "opts": [
     "The Public Interest Disclosure Act 1998",
     "The Data Protection Act 2018",
     "The Equality Act 2010"
    ],
    "a": 0,
    "fb": "The Public Interest Disclosure Act 1998 protects workers who make a protected disclosure about wrongdoing."
   },
   {
    "q": "For a disclosure to be protected, you must show a reasonable belief that it is made in the...",
    "opts": [
     "Interest of your employer",
     "Public interest",
     "Interest of your team"
    ],
    "a": 1,
    "fb": "Since the Enterprise and Regulatory Reform Act 2013, the key test is a reasonable belief that the disclosure is in the public interest."
   },
   {
    "q": "Do you need firm proof before raising a whistleblowing concern?",
    "opts": [
     "Yes, always",
     "No — a reasonable belief is enough",
     "Only for concerns about a manager"
    ],
    "a": 1,
    "fb": "You only need a reasonable belief. Investigating and proving the concern is not your responsibility."
   },
   {
    "q": "What is the NSPCC Whistleblowing Advice Line number?",
    "opts": [
     "0800 028 0285",
     "0800 1111",
     "999"
    ],
    "a": 0,
    "fb": "0800 028 0285 gives free, confidential advice to staff worried about how child protection is being handled."
   },
   {
    "q": "A child is in immediate danger. What should you do first?",
    "opts": [
     "Write up the facts",
     "Make the child safe and call 999 if needed",
     "Warn the colleague involved"
    ],
    "a": 1,
    "fb": "In an emergency, safety comes first — act and call 999. Recording and internal reporting follow once the child is safe."
   },
   {
    "q": "After reporting a concern about a colleague, you should NOT...",
    "opts": [
     "Keep a personal note of what you reported",
     "Warn or confront the person yourself",
     "Escalate if it isn't handled properly"
    ],
    "a": 1,
    "fb": "Confronting or warning the person can put a child at risk and damage any investigation. Report and step back."
   }
  ]
 },
 {
  "id": "c60",
  "title": "Emergency Evacuation, Lockdown & Critical Incidents",
  "cat": "Recommended",
  "cover": "shield",
  "category": "health",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "A practical CPD course that teaches holiday-camp and activity-club teams to tell apart evacuation, invacuation and lockdown, run assembly points and registers, and lead a critical incident calmly. Built for playworkers, activity leaders and duty managers who are the first responders when something goes wrong. It adopts the good practice set by the Regulatory Reform (Fire Safety) Order 2005 and the new Terrorism (Protection of Premises) Act 2025 (Martyn's Law), plus gov.uk emergency-planning guidance.",
  "lessons": [
   {
    "id": "l1",
    "title": "Knowing the three responses",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "When an emergency hits your camp, the single most important decision is which way to move people. Get that wrong and you can walk children straight towards the danger. There are three core responses — evacuation, invacuation and lockdown — and confident staff know how to tell them apart in seconds."
     },
     {
      "k": "points",
      "title": "The three responses in plain English",
      "items": [
       "Evacuation: get everyone OUT of the building to a safe assembly point — the right call for fire, gas leak or a hazard inside.",
       "Invacuation: bring everyone IN from outside to a safe indoor space — used for an external hazard such as a chemical spill, severe weather or an aggressive dog loose in the grounds.",
       "Lockdown: secure everyone INSIDE, lock and barricade, stay out of sight and quiet — used when a threat could enter, such as an intruder or a nearby weapons attack."
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "The legal duty behind your procedures",
      "t": "The Terrorism (Protection of Premises) Act 2025 (Martyn's Law) requires premises that host 200 or more people at once to have public protection procedures covering evacuation, invacuation, lockdown and communication. Even smaller clubs are expected to follow this as good practice. We adopt these standards regardless of our headcount."
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Read the hazard first",
      "t": "Ask one question: is the danger inside or outside? Inside and immediate means evacuate. Outside and passing means invacuate. Outside and coming for us means lock down."
     },
     {
      "k": "check",
      "q": "A neighbouring unit reports a chemical tanker has overturned on the road outside your holiday club. What is the correct response?",
      "opts": [
       "Evacuate everyone outside to the car park assembly point",
       "Invacuate — bring the children indoors, close windows and doors",
       "Carry on as normal until told otherwise"
      ],
      "a": 1,
      "fb": "Correct. An external airborne hazard calls for invacuation: bring everyone inside, shut windows and doors, and shelter until the all-clear. Evacuating outdoors would move children towards the danger."
     }
    ]
   },
   {
    "id": "l2",
    "title": "Evacuation and assembly points",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Evacuation is the response staff practise most, usually for fire. The aim is simple: move every child and adult calmly out by the nearest safe route and account for them at a pre-agreed assembly point. Speed matters, but a controlled walk beats a chaotic run."
     },
     {
      "k": "steps",
      "title": "Running a clean evacuation",
      "items": [
       {
        "h": "Raise the alarm",
        "t": "Sound the alarm or shout the agreed word, and call 999 if needed. Do not stop to collect belongings."
       },
       {
        "h": "Lead the route",
        "t": "Take the nearest safe exit, staff at front and back of the group, guiding children away from the hazard."
       },
       {
        "h": "Sweep as you go",
        "t": "A named person checks toilets, quiet corners and outdoor areas so no one is left behind."
       },
       {
        "h": "Reach the assembly point",
        "t": "Gather at the agreed spot, well clear of the building and away from vehicle access."
       },
       {
        "h": "Take the register",
        "t": "Roll-call from the day's attendance register and report anyone missing to the emergency services."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Who is legally responsible",
      "t": "Under the Regulatory Reform (Fire Safety) Order 2005, a named 'Responsible Person' (usually the operator or site manager) must carry out a fire risk assessment and put in place emergency procedures, escape routes, assembly points and regular drills. Practical tasks can be delegated to staff, but the legal responsibility cannot."
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Grab the register and the grab-bag",
      "t": "The day's signing-in sheet is your source of truth for who is on site — take it with you, or keep it on a phone you can access outdoors. A grab-bag with a first-aid kit, emergency contacts, medications and a hi-vis vest turns a scramble into a routine."
     },
     {
      "k": "check",
      "q": "You reach the assembly point and one child from your group is not answering the roll-call. What do you do?",
      "opts": [
       "Send a staff member back inside to look for them",
       "Report the named child as missing to the fire service and let trained crews search",
       "Wait quietly and hope they turn up"
      ],
      "a": 1,
      "fb": "Correct. Once you have evacuated, no one goes back in. Report exactly who is missing and where they were last seen so the fire service — with the right equipment — can search safely."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Invacuation and lockdown",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Sometimes the safest place is inside. Invacuation and lockdown both keep people indoors, but they answer different threats. Invacuation shelters children from an outside hazard that will pass; lockdown hides and protects them from a threat that could reach them."
     },
     {
      "k": "points",
      "title": "Telling them apart",
      "items": [
       "Invacuation: bring everyone in, close windows and doors, turn off ventilation for a chemical or smoke plume, and carry on calmly until the all-clear.",
       "Lockdown: lock or barricade doors, move away from windows, switch off lights, keep silent, and stay hidden until police give the all-clear.",
       "Both need a clear signal everyone recognises — a spoken code phrase often works better than an alarm children associate with fire and 'go outside'."
      ]
     },
     {
      "k": "steps",
      "title": "If you must lock down",
      "items": [
       {
        "h": "Signal and move",
        "t": "Give the agreed lockdown phrase and get children into the nearest securable room, fast and quietly."
       },
       {
        "h": "Secure the space",
        "t": "Lock or barricade the door, cover glass panels, and move everyone out of sight below window level."
       },
       {
        "h": "Silence and count",
        "t": "Silence phones, keep children calm, and quietly account for who is with you."
       },
       {
        "h": "Call and wait",
        "t": "Call 999 when it is safe to do so, then stay put until the police, not a message, confirm the all-clear."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Weapons attack: Run, Hide, Tell",
      "t": "If there is a direct weapons attack, national counter-terrorism advice (NaCTSO / NCSC 'Run Hide Tell') is to escape if you safely can, hide if you cannot, and only call 999 when it is safe. With young children, leading them to hide and stay silent is usually the realistic option — practise it gently, never frighteningly."
     },
     {
      "k": "check",
      "q": "During a summer club a member of the public forces entry into reception, shouting and behaving aggressively. Windows and doors are your only barrier. What is the priority?",
      "opts": [
       "Evacuate all the children outside past reception",
       "Lock down — secure a room, keep children quiet and out of sight, and call 999",
       "Send a leader to reason with the person"
      ],
      "a": 1,
      "fb": "Correct. The threat is inside the perimeter, so evacuating past it is dangerous. Lock down: secure a room, keep children silent and hidden, and call police when it is safe."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Critical incident plans",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "A critical incident is any event that overwhelms your normal running of the day — a serious injury, a missing child, a fire, a death, or a threat to the site. A written, rehearsed critical incident plan stops you inventing a response under pressure and makes sure nothing is forgotten."
     },
     {
      "k": "points",
      "title": "What a good plan contains",
      "items": [
       "Named roles: who leads, who calls emergency services, who manages parents, who logs events.",
       "Contact trees for staff, emergency services, the operator's senior lead and the local authority.",
       "A grab-bag: registers, emergency contacts, medications, first-aid kit, torch and a charged phone.",
       "Business continuity: how the club keeps children safe and cared for while the incident is dealt with."
      ]
     },
     {
      "k": "steps",
      "title": "The first ten minutes",
      "items": [
       {
        "h": "Make it safe",
        "t": "Deal with immediate danger and give first aid; call 999 without delay for anything serious."
       },
       {
        "h": "Account for everyone",
        "t": "Take registers and confirm every child and staff member is accounted for."
       },
       {
        "h": "Take command",
        "t": "The incident lead delegates roles clearly so no critical task is left to chance."
       },
       {
        "h": "Start a log",
        "t": "Record times, decisions and who was told what — memory fades fast and this record matters later."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Rehearse before you need it",
      "t": "gov.uk emergency-planning guidance for childcare and education settings recommends practising evacuation, invacuation and lockdown so responses become second nature. Run each drill at least once a season and review what went wrong, not just what went right."
     },
     {
      "k": "check",
      "q": "Halfway through a critical incident, a leader realises no one has written anything down. Why does that matter?",
      "opts": [
       "It doesn't — dealing with children comes first and paperwork can wait indefinitely",
       "An accurate, timed log protects the children, staff and the club, and is vital for the later review and any investigation",
       "Only the emergency services need to keep records"
      ],
      "a": 1,
      "fb": "Correct. Caring for children always comes first, but a timed log of decisions and communications is essential — it supports the debrief, any investigation and honest communication with families."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Communicating with parents and recovery",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Parents will hear something is wrong within minutes, often from a child's phone or social media. How you communicate shapes whether they trust you or panic. The goal is calm, accurate, consistent information through one channel — and care for everyone once the emergency is over."
     },
     {
      "k": "points",
      "title": "Communication that builds trust",
      "items": [
       "Confirm the facts before you say anything — never speculate or share unconfirmed details.",
       "Use one agreed spokesperson and one channel so parents hear a single, consistent message.",
       "Prepare a short holding statement to buy time: acknowledge the incident, confirm children are safe or being cared for, and say when you will update again.",
       "Never name an injured or affected child publicly, and keep it off social media."
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Social media moves faster than you",
      "t": "A well-meaning parent post or a staff member 'reassuring' online can spread wrong information and breach a child's privacy. Agree in advance that no one comments publicly except the named spokesperson, and remind staff on the day."
     },
     {
      "k": "steps",
      "title": "Reunification and recovery",
      "items": [
       {
        "h": "Plan the reunion",
        "t": "Decide a safe collection point and a way to verify each adult before releasing a child to them."
       },
       {
        "h": "Send the update",
        "t": "Once facts are confirmed, send the agreed message and tell parents exactly where and how to collect."
       },
       {
        "h": "Support your people",
        "t": "Check on staff and children afterwards — an emergency can shake everyone, and quiet reassurance goes a long way."
       },
       {
        "h": "Debrief and learn",
        "t": "Hold a review, capture what to improve, and update the plan so next time is calmer still."
       }
      ]
     },
     {
      "k": "check",
      "q": "Twenty minutes into an incident you have confirmed all children are safe but the cause is still unclear. What should you send parents?",
      "opts": [
       "Nothing until you know absolutely everything",
       "A short holding statement confirming children are safe and saying when you'll update again",
       "A detailed guess about what probably happened"
      ],
      "a": 1,
      "fb": "Correct. A brief holding statement — children are safe, we're managing it, next update at a stated time — reassures parents and stops rumours, without speculating about causes you can't yet confirm."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "What is the key difference between invacuation and lockdown?",
    "opts": [
     "They are two words for the same thing",
     "Invacuation shelters from an external hazard that will pass; lockdown hides and secures against a threat that could reach you",
     "Invacuation is only for fires and lockdown only for floods"
    ],
    "a": 1,
    "fb": "Invacuation brings people indoors to shelter from an outside hazard such as a chemical plume or storm; lockdown secures, hides and protects people from a threat that could enter, such as an intruder."
   },
   {
    "q": "Under which law must a named 'Responsible Person' provide emergency routes, assembly points and fire drills?",
    "opts": [
     "The Regulatory Reform (Fire Safety) Order 2005",
     "The Data Protection Act 2018",
     "The Working Time Regulations 1998"
    ],
    "a": 0,
    "fb": "The Regulatory Reform (Fire Safety) Order 2005 places the duty on the Responsible Person to assess fire risk and provide escape routes, assembly points and regular drills."
   },
   {
    "q": "At what headcount do Martyn's Law (Terrorism (Protection of Premises) Act 2025) standard-tier duties begin to apply?",
    "opts": [
     "50 people",
     "200 people",
     "1,000 people"
    ],
    "a": 1,
    "fb": "Standard-tier duties apply to premises that may host 200 or more people at once; the enhanced tier begins at 800. We follow the public protection procedures as good practice whatever our numbers."
   },
   {
    "q": "You have evacuated and one child is missing from the roll-call. What is correct?",
    "opts": [
     "Send staff back inside to search",
     "Report exactly who is missing to the fire service and let them search",
     "Assume they left with a parent"
    ],
    "a": 1,
    "fb": "Once evacuated, no one re-enters. Report precisely who is missing and where they were last seen so trained crews can search safely."
   },
   {
    "q": "During a weapons attack nearby, what does national 'Run, Hide, Tell' advice mean for staff with young children?",
    "opts": [
     "Always confront the attacker",
     "Escape if you safely can, otherwise hide and keep quiet, and call 999 only when safe",
     "Gather everyone outside immediately to be counted"
    ],
    "a": 1,
    "fb": "Run, Hide, Tell (NaCTSO / NCSC) means escape if it is safe, hide if it is not, and tell police when safe. With young children, leading them to hide silently is usually the realistic option."
   },
   {
    "q": "Twenty minutes into an incident, all children are safe but the cause is unclear. What should parents receive?",
    "opts": [
     "A detailed guess about the cause",
     "A short holding statement confirming children are safe and stating when the next update will come",
     "No message at all until everything is resolved"
    ],
    "a": 1,
    "fb": "A brief holding statement reassures parents and stops rumours without speculating. Confirm safety, say you are managing it, and give a time for the next update."
   }
  ]
 },
 {
  "id": "c61",
  "title": "ADHD — Delivering Inclusive Sessions (Level 2)",
  "cat": "Recommended",
  "cover": "shield",
  "category": "send",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "A practical Level 2 course for holiday-camp and activity-club staff who already know the basics of ADHD. You'll learn to plan, structure and lead both sport and art sessions using the Inclusion Spectrum and the STEP tool, with worked \"make it easier / make it harder\" examples, calm routines and confident, positive behaviour support. It stays strengths-first throughout and is grounded in the Equality Act 2010 duty to make reasonable adjustments.",
  "lessons": [
   {
    "id": "l1",
    "title": "ADHD, Strengths First",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "You already know what ADHD is. This course is about what to DO with that knowledge on the floor of a busy camp or club, so children with ADHD have a great session and come back next week. We start where the ADHD Foundation starts: on a neurodiversity umbrella, ADHD is a different way of thinking, not a broken version of a 'normal' brain. Leading strengths-first changes how a child experiences your session, and it changes how you experience them."
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "The line worth remembering",
      "t": "An ADHD brain is often described as 'a Ferrari brain with bicycle brakes' — huge power and speed, but the braking and steering (stopping, waiting, switching task) need support. Your job isn't to slow the engine; it's to help with the brakes."
     },
     {
      "k": "points",
      "title": "Strengths to actively look for and use",
      "items": [
       "Energy and enthusiasm that can lift a whole group",
       "Humour, warmth and loyalty to people they trust",
       "Ingenuity and divergent thinking — unusual, creative solutions",
       "A strong sense of fairness and justice",
       "The ability to motivate and rally others",
       "Resilience — they take a lot of knocks in a day",
       "Hyperfocus — long, deep concentration on things that genuinely interest them"
      ]
     },
     {
      "k": "text",
      "t": "Physical activity is not just something children with ADHD find hard — it is part of the support. Exercise raises dopamine and norepinephrine (the same chemistry many ADHD medications target), burns off excess energy, and improves concentration, sleep and social skills. A well-run active session is a therapeutic environment, not just a fun one. That is a reason to include, not to sideline."
     },
     {
      "k": "check",
      "q": "A ten-year-old at your multi-sports camp keeps inventing wild new rules for the warm-up game. What is the strengths-first read?",
      "opts": [
       "He is being disruptive and needs removing from the game",
       "This is divergent thinking — channel it by giving him a 'rule designer' job for one round",
       "Ignore it so the others don't copy him"
      ],
      "a": 1,
      "fb": "Ingenuity and divergent thinking are ADHD strengths. Giving him a real, time-limited role uses the energy and builds self-esteem instead of triggering a telling-off."
     }
    ]
   },
   {
    "id": "l2",
    "title": "How ADHD Shows Up in a Busy Club",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "ADHD shows up differently from a quiet classroom when a hall is loud, kit is everywhere and everyone is excited. Recognising the pattern stops you reading behaviour as 'naughtiness'. The Scottish ADHD Coalition groups the traits into three domains, plus a sensory layer that is very common where ADHD and autism (ASC) co-occur."
     },
     {
      "k": "points",
      "title": "The three domains",
      "items": [
       "INATTENTION — short attention span, easily distracted, forgets multi-part instructions, loses kit, disorganised",
       "IMPULSIVENESS — blurts out, can't wait a turn, interrupts, fearless and takes risks without weighing them",
       "HYPERACTIVITY — restless, fidgety, boisterous, over-competitive; noticeably worse when tired"
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "The sensory layer",
      "t": "Many children with ADHD — especially those who are also autistic — are hyper- or hypo-sensitive to noise, light and touch. A sports hall echo, a whistle, a bright strip light or being bumped in a queue can tip a child over before the activity even starts. Sensory load is often the hidden trigger behind a meltdown."
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Two things staff get wrong",
      "t": "First: a child who is not standing still is very often STILL LISTENING — many need to move to process what you're saying, so don't demand stillness to prove attention. Second: children with ADHD get told off far more than their peers all day long, creating a negative cycle. They may also be emotionally and socially younger than their age, and take losing very hard."
     },
     {
      "k": "check",
      "q": "During your instructions, one child is jogging on the spot and fiddling with a cone, but answers your question correctly. What should you do?",
      "opts": [
       "Stop and tell him to stand still and listen properly",
       "Carry on — movement is how he is processing, and he clearly heard you",
       "Send him for a break for not concentrating"
      ],
      "a": 1,
      "fb": "Movement often supports attention rather than blocking it. He proved he was listening. Demanding stillness would add to the negative cycle for no benefit."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Framework 1 — The Inclusion Spectrum",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "The Inclusion Spectrum (Stevenson & Black, 2007; originated by Ken Black at the Youth Sport Trust in 1996) is an activity-centred model. It focuses on what participants CAN do, and gives you five delivery approaches you can flex between within a single session. No approach is 'better' — a skilled leader moves between them as the group and the child need."
     },
     {
      "k": "figure",
      "fig": "inclusion"
     },
     {
      "k": "steps",
      "title": "The five approaches",
      "items": [
       {
        "h": "1. Open",
        "t": "Everyone does the same activity, with little or no modification. Good for a simple, inclusive warm-up."
       },
       {
        "h": "2. Modified",
        "t": "Same activity for all, but you adapt the rules, space, equipment or interaction to challenge and support everyone — e.g. an extra bounce allowed in tennis."
       },
       {
        "h": "3. Parallel",
        "t": "Grouped by ability, doing the same theme at appropriate levels — three throwing stations at easy, medium and hard distances."
       },
       {
        "h": "4. Separate",
        "t": "An individual or group does a purposefully DIFFERENT planned activity for a while — a child who is overloaded works on a calm skill task with a helper."
       },
       {
        "h": "5. Disability sport",
        "t": "Everyone tries a disability-sport activity such as boccia or goalball (reverse integration) — it levels the field and builds empathy."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Flex, don't file",
      "t": "Don't slot a child permanently into one approach. You might run 'Open' for the warm-up, 'Modified' for the main game, drop to 'Separate' for five minutes when one child overloads, then bring them back. The spectrum is a dial you turn, minute to minute."
     },
     {
      "k": "check",
      "q": "In a rounders session a child is overwhelmed by the noise and can't cope with fielding. Using the spectrum, a good short-term move is:",
      "opts": [
       "Parallel — put her with the least skilled group",
       "Separate — she does a planned calm batting-practice task with a helper for a few minutes, then rejoins",
       "Open — make her keep fielding like everyone else"
      ],
      "a": 1,
      "fb": "'Separate' is a deliberate, planned different activity used briefly to regulate, not a punishment. The aim is always to bring her back in as soon as she's ready."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Framework 2 — STEP in Action",
    "mins": 7,
    "blocks": [
     {
      "k": "text",
      "t": "STEP is the practical differentiation tool from the Scottish Disability Sport / sports coach UK 'Inclusive Coaching Quick Guide'. You adjust four things — SPACE, TASK, EQUIPMENT, PEOPLE — to make any activity easier or harder without stopping the session. Many coaches add a fifth, SPEED, giving STEPS. Crucially, most STEP changes ARE the reasonable adjustments the Equality Act asks for."
     },
     {
      "k": "figure",
      "fig": "step"
     },
     {
      "k": "steps",
      "title": "STEP, tuned for ADHD and ASC",
      "items": [
       {
        "h": "Space",
        "t": "Mark boundaries clearly, protect personal space, and set the room out the SAME way each session to aid orientation and reduce anxiety. Use zones to group by ability or manage energy."
       },
       {
        "h": "Task",
        "t": "Give small amounts of information at a time, repeat demonstrations, use concrete concise language with minimal words, chunk drills, add visual signs, and increase scoring options so more children succeed."
       },
       {
        "h": "Equipment",
        "t": "Give a child something to HOLD while waiting to ease anxiety and impulsivity; let the whole group explore new equipment together to demystify it; use tactile floor markers."
       },
       {
        "h": "People",
        "t": "Use small-sided games; give time to watch peers first; be alert to physical contact, 'hustle bustle' and frequent partner changes upsetting ASC children; use random-winner games so success isn't only skill-based."
       },
       {
        "h": "Speed",
        "t": "Slow down or repeat when needed, and keep the surrounding pace comfortable rather than frantic."
       }
      ]
     },
     {
      "k": "points",
      "title": "Worked SPORT example — a passing drill",
      "items": [
       "Make it EASIER: bigger, lighter ball; slow it down; 'must pass within 3 seconds' becomes 'pass when ready'; a visual flag instead of a whistle",
       "Make it HARDER: add the 3-second rule; smaller ball; add a defender; more scoring zones to aim for",
       "SPACE tweak: smaller marked grid so play doesn't drift; EQUIPMENT tweak: give the waiting child a spare ball to hold"
      ]
     },
     {
      "k": "points",
      "title": "Worked ART example — a painting station",
      "items": [
       "SPACE: a defined mat or tray per child and a quiet corner option, laid out the same each time",
       "TASK: one step at a time — sketch first, THEN colour — with a visual example of the finished piece on the table",
       "EQUIPMENT: chunky grips, pre-portioned paint, and a fidget/anchor object for the waiting phase",
       "PEOPLE / SPEED: a solo station or a pair rather than a big shared table, and no rushed 'everyone finish now!'"
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "This is the duty in disguise",
      "t": "Under the Equality Act 2010, ADHD can be a disability, and activity, out-of-school and holiday clubs have an ANTICIPATORY duty to make reasonable adjustments so a disabled child isn't put at a substantial disadvantage. Most STEP and environment tweaks above ARE those adjustments — plan them in, don't wait for a problem."
     },
     {
      "k": "check",
      "q": "Two children are struggling to wait their turn in a relay and keep pushing forward. The quickest STEP fix is:",
      "opts": [
       "TASK — give a long verbal lecture about fair queuing",
       "EQUIPMENT / PEOPLE — give each waiting child a baton or ball to hold and shrink the teams so waits are shorter",
       "SPACE — make the running track much longer so they burn energy"
      ],
      "a": 1,
      "fb": "Something to hold eases the impulsivity of waiting, and smaller teams cut waiting time. A longer wait or a lecture would make the pushing worse."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Environment and Routine",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "You can prevent most difficult moments before the session starts, through the room and the routine. The goal is predictability: a child who knows what the space looks like and what happens next spends far less energy on anxiety and far more on taking part."
     },
     {
      "k": "figure",
      "fig": "session"
     },
     {
      "k": "points",
      "title": "Set the environment up to win",
      "items": [
       "Reduce noise and visual clutter — echoey halls and busy walls add sensory load",
       "Keep a predictable layout, set out the same way each session",
       "Use a VISUAL TIMETABLE of the session — picture and word cards, or a 'first–then' board — to make the sequence concrete (Autism Education Trust practice)",
       "Provide a CALM / REGULATION ZONE the child can choose to use to self-regulate"
      ]
     },
     {
      "k": "steps",
      "title": "A session shape children can rely on",
      "items": [
       {
        "h": "Same calm start",
        "t": "Open every session with the same familiar, calm routine so arrival feels safe and known."
       },
       {
        "h": "Signal transitions",
        "t": "Never switch activity cold — use countdowns and time warnings ('two minutes, then we tidy the mats')."
       },
       {
        "h": "Short drills, quick turnover",
        "t": "Keep drills short and 'mix it up' to prevent boredom; keep waiting children busy with helper jobs or scorekeeping."
       },
       {
        "h": "Movement breaks",
        "t": "Build in regular movement breaks rather than expecting sustained stillness."
       },
       {
        "h": "Predictable finish",
        "t": "End the same way each time — a known wind-down beats a chaotic 'right, parents are here, go!'"
       }
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "The calm zone is NOT the naughty step",
      "t": "A regulation zone only works if it's never used as time-out or punishment. The moment a child learns 'I get sent there when I'm bad', they'll refuse it exactly when they most need it. It's a tool the child can choose, like a water break."
     },
     {
      "k": "check",
      "q": "You're moving from a loud tag game straight into a focused craft table. What's the single most important thing to do?",
      "opts": [
       "Announce the change with a countdown and time warning before it happens",
       "Say nothing and just start handing out scissors",
       "Speed everyone up so there's no gap"
      ],
      "a": 0,
      "fb": "Unsignalled transitions are a classic trigger. A countdown and warning let children shift gear; cold switches and rushed pace cause exactly the meltdowns you're trying to avoid."
     }
    ]
   },
   {
    "id": "l6",
    "title": "Instructions, Praise and De-escalation",
    "mins": 6,
    "blocks": [
     {
      "k": "points",
      "title": "How to give an instruction that lands",
      "items": [
       "Calm, clear voice and eye contact",
       "Short, bite-sized instructions — one or two steps, not a paragraph",
       "Demonstrate and use visual cues; involve the child in the demo",
       "Ask the child to repeat it back to check it landed",
       "Offer a quiet word rather than showing them up; one-to-one attention works well"
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Praise is the engine",
      "t": "Praise heavily and specifically ('great, you passed and got straight back onside'), keep it fun, and never humiliate or intimidate. Have a SMALL number of clear, fair rules, each with a reason and an example. Ignore small incidents and reinforce the peers who are on task — attention is a reward, so spend it on what you want to see."
     },
     {
      "k": "steps",
      "title": "If you do need to de-escalate",
      "items": [
       {
        "h": "Warn clearly",
        "t": "Give one clear, consistent warning: 'I'm giving you a warning now for…', and use amber/red cues you've taught in advance."
       },
       {
        "h": "Keep sanctions active",
        "t": "If a sanction is needed, make it small, immediate and ACTIVE — a lap or star jumps — never 'stand still', which is unrealistic for this child."
       },
       {
        "h": "Don't do standoffs",
        "t": "Never get drawn into a public battle of wills. Stay calm, give take-up time, and let them save face."
       },
       {
        "h": "Use the red-flag signal",
        "t": "Agree a private signal so the child can flag rising upset; bring them off for a drink and a reset, then return them as soon as possible."
       },
       {
        "h": "Frame it as a team",
        "t": "Watch for triggers, and treat winning and losing as a team matter so no one child carries the blame."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Common mistakes to avoid",
      "t": "Long multi-step instructions; assuming a moving child isn't listening; punishing with enforced stillness; over-focusing on the negative; unpredictable layouts; skipping transition warnings; making a disabled child's task 'easier' rather than appropriately challenging; ignoring sensory load; and treating the calm zone as time-out."
     },
     {
      "k": "check",
      "q": "A child is getting wound up and heading for a meltdown during a competitive game. The best sanction/response is:",
      "opts": [
       "Make him stand on the sideline and stay completely still until he calms down",
       "Use the agreed red-flag reset — a quick drink and a job — or an active reset like a lap, then bring him back in",
       "Tell him in front of everyone that he's spoiling it for the team"
      ],
      "a": 1,
      "fb": "Enforced stillness is unrealistic and humiliation escalates. An active reset or the pre-agreed signal lets him regulate and return with dignity."
     }
    ]
   },
   {
    "id": "l7",
    "title": "Parents, Duties and Getting Support",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Parents are your 'number one experts' on their child. Meet them up front, before problems arise, and agree what helps and what triggers difficulty. Keep an open line, and review regularly — a simple 'Me and my ADHD' one-pager the child helps create is a brilliant, low-effort tool that travels with them between staff and seasons."
     },
     {
      "k": "points",
      "title": "Working around the child",
      "items": [
       "Respect confidentiality — share only what staff need, and only with agreement",
       "Check MEDICATION TIMING — it may wear off mid-session, changing behaviour predictably",
       "Educate your co-staff so everyone responds consistently; consider a supportive buddy for the child",
       "Signpost and seek more support when a child's needs exceed what your setting can safely meet"
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Your legal footing",
      "t": "Under the Equality Act 2010, ADHD can amount to a disability. As a provider of activities, out-of-school and holiday clubs you owe an anticipatory duty of reasonable adjustments, so a disabled child isn't put at a substantial disadvantage. Planning inclusive sessions isn't goodwill — it's compliance done well."
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Medication is a timing clue, not a fix",
      "t": "If a child is calm and focused at 10am but unravels by 1pm, the honest first question is often 'has the medication worn off?' Ask parents about timing at sign-up so you can plan the harder parts of the day accordingly — and never comment on medication in front of the child or other families."
     },
     {
      "k": "check",
      "q": "A parent tells you at drop-off that their child's medication 'usually fades around lunchtime'. The professional response is to:",
      "opts": [
       "Note it privately and plan calmer, shorter-turnover activities for the early afternoon",
       "Tell the other staff loudly so they keep an extra eye on him",
       "Ignore it — medication is a medical matter, nothing to do with the club"
      ],
      "a": 0,
      "fb": "Timing is planning information you can act on discreetly. Use it to shape the afternoon; keep it confidential and never broadcast a child's medical details."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "Which phrase best captures the strengths-first view of ADHD used in this course?",
    "opts": [
     "A brain that simply can't concentrate",
     "A Ferrari brain with bicycle brakes — huge power, brakes that need support",
     "A child who chooses not to behave"
    ],
    "a": 1,
    "fb": "The 'Ferrari brain with bicycle brakes' image keeps you strengths-first: the power is real, the stopping and steering need help."
   },
   {
    "q": "A child at your session isn't standing still while you talk but answers your questions correctly. This most likely means:",
    "opts": [
     "He isn't really listening and is being defiant",
     "Many children with ADHD move in order to process — he is listening",
     "He needs to be sent to the calm zone"
    ],
    "a": 1,
    "fb": "A moving child is very often still listening. Demanding stillness adds to the negative cycle without helping attention."
   },
   {
    "q": "In the Inclusion Spectrum, which approach means everyone tries a disability-sport activity such as boccia?",
    "opts": [
     "Modified",
     "Parallel",
     "Disability sport (reverse integration)"
    ],
    "a": 2,
    "fb": "'Disability sport' / reverse integration has the whole group try a disability sport — it levels the field and builds empathy."
   },
   {
    "q": "What do the letters in STEP stand for?",
    "opts": [
     "Space, Task, Equipment, People",
     "Speed, Timing, Effort, Practice",
     "Structure, Teaching, Encouragement, Praise"
    ],
    "a": 0,
    "fb": "STEP = Space, Task, Equipment, People (many add Speed for STEPS). It's your everyday tool for making any activity easier or harder."
   },
   {
    "q": "To make a passing drill EASIER using STEP, a good move is:",
    "opts": [
     "Add a 'must pass within 3 seconds' rule and use a smaller ball",
     "Use a bigger, lighter ball, slow it down and add more scoring zones",
     "Add a defender and shrink the target"
    ],
    "a": 1,
    "fb": "Bigger/lighter, slower and more ways to score all reduce difficulty. The 3-second rule, smaller ball and a defender make it HARDER."
   },
   {
    "q": "A child is close to a meltdown. Which sanction fits the guidance?",
    "opts": [
     "Make them stand completely still on the sideline",
     "An active reset such as a lap or star jumps, or the agreed red-flag break",
     "A public telling-off so others learn"
    ],
    "a": 1,
    "fb": "Sanctions should be small, immediate and active. Enforced stillness is unrealistic and humiliation escalates the situation."
   },
   {
    "q": "Why must the calm / regulation zone never be used as time-out?",
    "opts": [
     "Because it takes up too much space",
     "Because the child will refuse it when they most need it if it feels like punishment",
     "Because parents don't allow it"
    ],
    "a": 1,
    "fb": "If the zone becomes 'the naughty step', children won't choose it when regulating. It only works as a tool the child can freely use."
   },
   {
    "q": "Under the Equality Act 2010, an activity or holiday club's duty to make reasonable adjustments is best described as:",
    "opts": [
     "Optional goodwill offered only if a parent complains",
     "An anticipatory duty — plan adjustments in advance so a disabled child isn't at a substantial disadvantage",
     "Only relevant to schools, not clubs"
    ],
    "a": 1,
    "fb": "The duty is anticipatory: you plan reasonable adjustments ahead of time. Most STEP and environment tweaks are exactly those adjustments."
   }
  ]
 },
 {
  "id": "c62",
  "title": "Effective Sports Coaching (Level 1) — Foundations",
  "cat": "Recommended",
  "cover": "people",
  "category": "together",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "A practical Level 1 foundation for anyone coaching children in UK holiday camps and activity clubs — whether that's football or arts and crafts. You'll learn the child-first, fun-first approach championed by UK Coaching's Play Their Way movement: how to set up safely, shape a session, keep every child active, adapt for all abilities with STEP and the Inclusion Spectrum, and meet your duty of care and safeguarding awareness responsibilities.",
  "lessons": [
   {
    "id": "l1",
    "title": "The Child-First Coach: Why Fun Comes First",
    "mins": 7,
    "blocks": [
     {
      "k": "text",
      "t": "Ask a room of children why they play sport or join a camp and the same answer comes back again and again: because it's fun. Enjoyment isn't a 'nice to have' bolted onto real coaching — it is the real coaching. Children who enjoy a session, feel included and feel like they're getting good at something come back next week. Children who feel bored, benched or embarrassed quietly drop out, often for life. As a Level 1 coach your first job is to design for participation and enjoyment; technical excellence comes second and grows out of it."
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "The movement behind this",
      "t": "'Child-first coaching' is the evidence-informed, rights-based approach promoted by UK Coaching's Play Their Way campaign, delivered with the Children's Coaching Collaborative and funded by Sport England. It puts children's fundamental rights, voice and choice at the centre of every session."
     },
     {
      "k": "points",
      "title": "What actually keeps children in sport",
      "items": [
       "Fun and enjoyment — the number one reason they take part",
       "Feeling included — belonging to the group, never left on the sideline",
       "Feeling competent — a genuine sense of 'I can do this and I'm improving'",
       "Being with friends and having a voice in what happens"
      ]
     },
     {
      "k": "points",
      "title": "What a child-first session looks and sounds like",
      "items": [
       "High activity — lots of movement, very little standing and listening",
       "Smiles and noise — children look like they're enjoying it",
       "Everyone touching the ball, kit or materials, not just the best few",
       "Small-sided games and small groups instead of big queues",
       "Children making decisions and having choices",
       "Praise for effort and improvement, not only for winning"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "The sessions that push kids out",
      "t": "Adult-led, drill-heavy sessions with long lines, lots of talking, elimination games and coaches focused only on the talented few are a major reason children leave sport. If children spend more time watching or waiting than doing, the design has failed — not the children."
     },
     {
      "k": "check",
      "q": "A parent asks why your football session has no league table or 'man of the match' award for the six-year-olds. What's the best child-first answer?",
      "opts": [
       "Trophies are the main reason children keep playing, so we'll add them",
       "At this age fun, inclusion and feeling competent keep children in sport, so we focus there first",
       "Competition is banned in all youth sport by law"
      ],
      "a": 1,
      "fb": "Fun, feeling included and feeling competent are what keep young children in sport. Heavy competition too early pushes many out — technical and competitive edge can come later."
     }
    ]
   },
   {
    "id": "l2",
    "title": "Your Role, Responsibilities & Duty to Care",
    "mins": 7,
    "blocks": [
     {
      "k": "text",
      "t": "Coaching children is a position of trust. Whether you're a freelance sports coach, a holiday-camp activity leader or an arts practitioner, the moment children are in your care you carry a legal and moral duty to look after them. UK Coaching's Code of Practice for Sports Coaches and its 'Duty to Care / Safe to Practice' framework set out what's expected of you."
     },
     {
      "k": "points",
      "title": "The core responsibilities of a coach",
      "items": [
       "Promote participation for fun, enjoyment and achievement",
       "Maintain a reasonable standard of care — a safe, risk-assessed environment",
       "Give appropriate instruction and provide proper supervision",
       "Ensure suitable first-aid provision is in place and known",
       "Work within safe recruitment (references, DBS, safeguarding training)",
       "Be a positive role model and keep clear professional boundaries"
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Reasonable standard of care",
      "t": "The law expects you to take reasonable steps to keep children safe: assess the risks, supervise appropriately, instruct suitably for their age and ability, and have first aid available. You won't be judged against perfection — you'll be judged against what a reasonable, competent coach would have done."
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Welfare before winning — and before ego",
      "t": "The child's welfare always comes before the result and before how the coach looks. Never play an injured child to win, never single a child out to make yourself look good, and never let 'my team must win' override a child's safety, dignity or enjoyment."
     },
     {
      "k": "points",
      "title": "Professional boundaries and being a role model",
      "items": [
       "Children copy how you behave — model respect, calm and good sportsmanship",
       "Avoid being alone and unobserved with a child where you can",
       "No favouritism, no humiliation, no rough or intimidating language",
       "Keep communication appropriate and, with under-18s, go through parents/the club, not private social media"
      ]
     },
     {
      "k": "check",
      "q": "Your camp team could win the final if you keep a child playing who's just twisted their ankle and is limping. What do you do?",
      "opts": [
       "Keep them on — it's only a few minutes and the team needs them",
       "Take them off, check the injury and follow first-aid procedures; welfare comes before winning",
       "Ask the child to decide alone whether to carry on"
      ],
      "a": 1,
      "fb": "A child's welfare always comes before the result. Remove them, assess the injury, involve the first-aider and record it. Winning never justifies risking a child's safety."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Safe Set-Up: What to Do Before Children Arrive",
    "mins": 7,
    "blocks": [
     {
      "k": "text",
      "t": "Most safety problems are prevented before a single child walks in. Build a quick, repeatable pre-session check so it becomes automatic. A simple way to remember it is SPACE, EQUIPMENT, PEOPLE, HAZARDS."
     },
     {
      "k": "steps",
      "title": "The pre-session safety check",
      "items": [
       {
        "h": "SPACE",
        "t": "Is the area flat and clear of obstacles? Safe run-off around the edges? Check the surface and weather — wet, icy, too hot? Move goalposts, tables and trip lines out of the play zone."
       },
       {
        "h": "EQUIPMENT",
        "t": "Is kit checked, the right size and in good condition? Balls inflated, cones not cracked, scissors and art tools safe and age-appropriate? Store spare kit tidily so it's not a trip hazard."
       },
       {
        "h": "PEOPLE",
        "t": "Who is here? Do your ratios work? Who is the first-aider? Take the register / headcount, and confirm collection arrangements — who is allowed to take each child home."
       },
       {
        "h": "HAZARDS",
        "t": "Do a dynamic risk assessment: scan the environment, spot hazards, then keep re-scanning as the session runs and conditions change."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Ratios — a good-practice guide",
      "t": "For camps and clubs a common good-practice guide is roughly 1:8 for under-8s and 1:10 for children aged 8 and over. Always check your organisation's own policy and the activity's specific guidance — higher-risk activities (water, height, off-site) need tighter ratios."
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Exempt from Ofsted is not exempt from duty of care",
      "t": "Pure activity or coaching provision may be exempt from Ofsted registration, but your duty of care and safeguarding responsibilities still fully apply. 'We don't have to register' never means 'we don't have to keep children safe.'"
     },
     {
      "k": "points",
      "title": "Know these before you start every session",
      "items": [
       "Where the first-aid kit is and who the qualified first-aider is",
       "The venue's emergency procedures and evacuation route",
       "The accident/incident reporting process and where the forms are",
       "Who your Designated Safeguarding / Welfare Officer is and how to reach them"
      ]
     },
     {
      "k": "check",
      "q": "You arrive to run an outdoor session and light rain has made the grass slippery near a low wall. What does a dynamic risk assessment lead you to do?",
      "opts": [
       "Carry on exactly as planned — you risk assessed the space yesterday",
       "Re-scan the conditions now, move play away from the wall and slippery patch, and adjust activities",
       "Cancel — any rain makes outdoor sport unsafe"
      ],
      "a": 1,
      "fb": "A dynamic risk assessment is done in the moment and repeated as conditions change. You adapt the space and activity to the new hazard rather than ignoring it or over-reacting."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Session Shape & Clear Instructions",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "A simple, repeatable session shape gives children security and gives you control. You don't need a different structure every day — you need the same reliable flow, filled with fresh, fun content."
     },
     {
      "k": "figure",
      "fig": "session"
     },
     {
      "k": "steps",
      "title": "The four-part session shape",
      "items": [
       {
        "h": "1. Warm-up",
        "t": "Active, fun pulse-raiser plus movement prep — ideally themed to today's session (e.g. dribbling tag before a dribbling session). Bodies warm, brains switched on, everyone moving."
       },
       {
        "h": "2. Main activity / skill",
        "t": "Introduce one skill and practise it in small groups with lots of repetitions. More stations, fewer children per station, minimal waiting."
       },
       {
        "h": "3. Game / application",
        "t": "Apply the skill in a small-sided game or challenge so it means something. This is where it clicks and where the fun peaks."
       },
       {
        "h": "4. Cool-down / close",
        "t": "Calm the body, gather a little feedback ('what did you enjoy?'), praise the group, and preview next time so they want to come back."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Whistle to stop, action to start",
      "t": "Over-explaining kills momentum. Agree a stop/attention signal at the very start — a whistle, 'freeze', hand up, or a call-and-response like 'Camp coaches!' / 'Yes coach!'. Whistle to stop them; a clear action to start them."
     },
     {
      "k": "steps",
      "title": "Giving instructions that actually land",
      "items": [
       {
        "h": "Get attention first",
        "t": "Use your signal and wait for stillness and eyes on you before you say anything. Never talk over the group."
       },
       {
        "h": "Keep it short",
        "t": "One or two key points, no more. 'Small touches, head up' beats a two-minute lecture."
       },
       {
        "h": "Show, don't just tell",
        "t": "Give a clear demonstration — you or a capable child. Children copy what they see far faster than what they hear."
       },
       {
        "h": "Let them DO it quickly",
        "t": "Get them active within seconds. Check understanding by asking a real question ('where are your eyes looking?'), not a lazy 'OK?'."
       }
      ]
     },
     {
      "k": "check",
      "q": "You're about to explain a new passing drill to twenty excited nine-year-olds. What's the strongest approach?",
      "opts": [
       "Talk them through every rule in detail so nobody is confused, then start",
       "Use your stop signal, give one or two key points, demonstrate, then get them active fast and check by asking",
       "Just let them start and correct everyone individually as you go"
      ],
      "a": 1,
      "fb": "Get attention, keep it to one or two points, show a demo, then get them doing it quickly. Long explanations lose children's attention and their body heat."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Maximising Participation: The Technical Heart",
    "mins": 7,
    "blocks": [
     {
      "k": "text",
      "t": "This is the difference between a good coach and a great one. The goal is simple: keep every child active for as much of the session as possible. Every second a child spends queuing, watching or sitting out is a second they're not learning, not enjoying, and edging towards dropping out."
     },
     {
      "k": "points",
      "title": "Rules of thumb for maximum participation",
      "items": [
       "No long queues — break one big line into several tiny ones or none at all",
       "No children standing waiting for a turn",
       "More balls, more stations, smaller groups, shorter waits",
       "Every child owns a piece of equipment wherever possible",
       "Design so the child who needs the most practice gets the most, not the least"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Rethink elimination games",
      "t": "In classic elimination games (like dodgeball 'you're out') the child who most needs practice is knocked out first and then stands watching the confident children improve. Reframe them: 'get back in' versions, do-a-challenge-to-return, points scoring, or personal-best targets so everyone keeps moving the whole time."
     },
     {
      "k": "steps",
      "title": "Turn a queue into constant activity",
      "items": [
       {
        "h": "Spot the queue",
        "t": "One ball, twenty children lined up to shoot: nineteen watching, one working."
       },
       {
        "h": "Multiply the kit",
        "t": "Get out five balls and five mini-goals — now five children work at once, four are waiting instead of nineteen."
       },
       {
        "h": "Shrink the group",
        "t": "Split into small groups of three or four, each with their own space and ball."
       },
       {
        "h": "Add a personal target",
        "t": "'How many can you score in a minute?' — everyone is busy and measuring their own progress, no elimination."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Arts works exactly the same way",
      "t": "No queue for the one pair of scissors and no waiting for the teacher to hand out glue. Everyone has their own materials and is creating at once. Participation rules aren't just for sport — they're for any children's session."
     },
     {
      "k": "check",
      "q": "Your relay has one team of twelve, so most children stand in a line waiting their turn. What's the best fix?",
      "opts": [
       "Keep the single line but tell the waiting children to cheer",
       "Split into three teams of four with three separate relay lanes, so far more children are active at once",
       "Speed up the relay so the line moves quicker"
      ],
      "a": 1,
      "fb": "Splitting into smaller groups with more lanes and more equipment gets far more children active at once. Cheering is nice, but active children learn and enjoy more than waiting ones."
     }
    ]
   },
   {
    "id": "l6",
    "title": "STEP & the Inclusion Spectrum: Coaching Every Child",
    "mins": 10,
    "blocks": [
     {
      "k": "text",
      "t": "No group of children is the same. STEP is your everyday tool for adapting any activity to make it easier, harder or more inclusive. Developed in Youth Sport Trust resources, it gives you four dials to turn: Space, Task, Equipment, People. (Some sports teach the equivalent 'TREE'.)"
     },
     {
      "k": "figure",
      "fig": "step"
     },
     {
      "k": "steps",
      "title": "STEP — the four dials, with worked examples",
      "items": [
       {
        "h": "S — Space",
        "t": "Size and shape of the area, zones and distances. EASIER: make the target area bigger or the throwing distance shorter. HARDER: shrink the pitch or lengthen the distance."
       },
       {
        "h": "T — Task",
        "t": "The rules, conditions, number of touches or time. EASIER: allow two bounces before a catch, or unlimited touches. HARDER: one-touch only, or a shorter time limit."
       },
       {
        "h": "E — Equipment",
        "t": "Size, weight and colour of kit. EASIER: a bigger, softer, slower ball or a larger target; bells inside a ball for a visually impaired child. HARDER: a smaller ball or smaller goal."
       },
       {
        "h": "P — People",
        "t": "Group sizes, roles, pairings and how people interact. EASIER: pair a hesitant child with a confident one, or add a helper. HARDER: fewer players so each does more, or add a defender."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "STEP for the art table too",
      "t": "SPACE: give bigger paper or more table room. TASK: offer a simpler brief or an extension challenge. EQUIPMENT: chunky brushes, pencil grips, templates and stencils. PEOPLE: pair a confident child with a hesitant one. Same tool, different activity."
     },
     {
      "k": "text",
      "t": "The Inclusion Spectrum, created by Ken Black (Youth Sport Trust, 1996) and developed with Pam Stevenson, is an activity-centred model offering five complementary approaches. None is 'better' than another — a skilled coach moves fluidly between them within a single session."
     },
     {
      "k": "points",
      "title": "The five approaches of the Inclusion Spectrum",
      "items": [
       "OPEN — everyone does the same activity, no or minimal adaptation",
       "MODIFIED — same activity, but space, rules, equipment or interaction adapted using STEP",
       "PARALLEL — same theme, but children grouped by ability so each works at the right level",
       "SEPARATE — an individual or small group does a specific activity when that's the right call",
       "DISABILITY SPORT / reverse-integration — everyone plays a disability-sport format, e.g. sitting volleyball or boccia"
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Inclusion is a legal duty",
      "t": "Under the Equality Act 2010, providers must make anticipatory 'reasonable adjustments' for disabled children — you plan for inclusion in advance, not only when a disabled child turns up. STEP and the Inclusion Spectrum are your practical toolkit. Activity Alliance offers further inclusive-practice guidance."
     },
     {
      "k": "points",
      "title": "Simple neuro-inclusive tips",
      "items": [
       "Clear, consistent routines so children know what happens next",
       "Visual cues and demonstrations alongside spoken instructions",
       "Warn children before transitions ('two minutes until we swap')",
       "Offer a calm, low-stimulation space a child can use if overwhelmed (drawing on Autism Education Trust and ADHD Foundation thinking)"
      ]
     },
     {
      "k": "check",
      "q": "In one dodgeball-style game you have confident throwers and a wheelchair user. Which use of the Inclusion Spectrum fits best?",
      "opts": [
       "SEPARATE — send the wheelchair user off to do a solo activity every time",
       "PARALLEL or MODIFIED — adapt with STEP (softer balls, zones, roles) or group by ability so everyone plays meaningfully together",
       "OPEN — run it identically for everyone and hope it works out"
      ],
      "a": 1,
      "fb": "Modifying with STEP and/or grouping in parallel lets everyone take part meaningfully in the same game. Separate has its place, but defaulting to it excludes rather than includes."
     }
    ]
   },
   {
    "id": "l7",
    "title": "Behaviour, Feedback & Safeguarding Awareness",
    "mins": 10,
    "blocks": [
     {
      "k": "text",
      "t": "Good behaviour management is mostly good session design — busy, well-paced sessions leave little room for misbehaviour, because boredom is the biggest driver of it. On top of that, agree clear expectations early and stay fair, calm and consistent."
     },
     {
      "k": "points",
      "title": "Managing the group",
      "items": [
       "Set just 2–3 simple rules with the group, so they own them",
       "Agree your signals at the start (stop signal, gather-in call)",
       "Use positives: 'I'm looking for children who are ready and listening'",
       "Keep children busy — minimal waiting means minimal misbehaviour",
       "Be fair, calm and consistent; never humiliate or shout a child down"
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Feedback that builds children up",
      "t": "Give SPECIFIC, positive feedback — name the behaviour: 'great low body position on that catch', not a vague 'well done'. Aim for a high praise-to-correction ratio (roughly 5:1). Praise effort, courage, teamwork and improvement, and give just one clear correction at a time."
     },
     {
      "k": "text",
      "t": "Safeguarding is everyone's responsibility, and at Level 1 your role is awareness and knowing your route — recognising a concern and passing it on, not investigating it yourself. Ground your practice in CPSU/NSPCC and UK Coaching safeguarding guidance."
     },
     {
      "k": "points",
      "title": "Every coach must be able to",
      "items": [
       "Name the club/camp's safeguarding policy and who the Designated Safeguarding / Welfare Officer is",
       "Hold current, recognised safeguarding training and (for unsupervised roles) an enhanced DBS check",
       "Recognise, respond, record and refer any concern",
       "Maintain professional boundaries at all times",
       "Know the first-aid arrangements and how to report an accident"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Recognise, respond, record, refer",
      "t": "If a child discloses something or you have a concern: listen and stay calm, don't promise to keep secrets, don't interrogate or investigate, write down what was said/seen as soon as you can in the child's own words, and refer it to your Designated Safeguarding Officer straight away. Level 1 = knowing your route, not being the investigator."
     },
     {
      "k": "points",
      "title": "Common mistakes to avoid",
      "items": [
       "Talking too long and killing momentum",
       "Big single-file queues and children left standing",
       "Elimination games that sideline those who need most practice",
       "Coaching only the most talented children",
       "Vague praise like 'well done' with no detail",
       "Skipping the safety scan or not knowing the first-aider",
       "Not knowing who the safeguarding lead is",
       "One-size-fits-all with no STEP adaptation, and too much competition too early"
      ]
     },
     {
      "k": "check",
      "q": "A child quietly tells you something at pick-up that worries you about their safety at home. What's the right Level 1 response?",
      "opts": [
       "Question the child in detail to find out exactly what happened before telling anyone",
       "Reassure them you'll keep it a secret between the two of you",
       "Listen calmly without promising secrecy, record what was said as soon as you can, and refer to your Designated Safeguarding Officer"
      ],
      "a": 2,
      "fb": "At Level 1 you recognise, respond, record and refer. Don't investigate and never promise secrecy — pass it to your Designated Safeguarding / Welfare Officer straight away."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "What is the number one reason children take part in sport and activity camps?",
    "opts": [
     "To win trophies and competitions",
     "Because it's fun and enjoyable",
     "To please their parents"
    ],
    "a": 1,
    "fb": "Fun is the number one reason children take part. Enjoyment, feeling included and feeling competent are what keep them coming back — the foundation of child-first coaching."
   },
   {
    "q": "Under UK Coaching's 'reasonable standard of care', a coach must provide all of the following EXCEPT:",
    "opts": [
     "A safe, risk-assessed environment with appropriate supervision",
     "Suitable first-aid provision and safe recruitment",
     "A guaranteed win for every child's team"
    ],
    "a": 2,
    "fb": "The duty to care covers a safe environment, suitable instruction and supervision, first aid and safe recruitment. Results are never guaranteed — and welfare always comes before winning."
   },
   {
    "q": "In the STEP framework, what do the four letters stand for?",
    "opts": [
     "Speed, Time, Energy, Power",
     "Space, Task, Equipment, People",
     "Skill, Teamwork, Effort, Play"
    ],
    "a": 1,
    "fb": "STEP = Space, Task, Equipment, People — four dials you turn to make any activity easier, harder or more inclusive."
   },
   {
    "q": "Why should you reframe or avoid elimination games?",
    "opts": [
     "They take too long to set up",
     "The child who most needs practice is often out first and left watching",
     "They are banned under the Equality Act 2010"
    ],
    "a": 1,
    "fb": "In elimination games the least confident children tend to go out first, so they get the least practice. Use 'get back in' versions or personal-best scoring to keep everyone active."
   },
   {
    "q": "Roughly what praise-to-correction ratio should a coach aim for?",
    "opts": [
     "1:1",
     "5:1 (five praises to one correction)",
     "1:5 (five corrections to one praise)"
    ],
    "a": 1,
    "fb": "Aim for about five specific, positive praises to every one correction, and give just one clear correction at a time. Name the behaviour rather than saying a vague 'well done'."
   },
   {
    "q": "On the Inclusion Spectrum, what does the PARALLEL approach mean?",
    "opts": [
     "Everyone does exactly the same activity with no changes",
     "Children work on the same theme but are grouped by ability so each works at the right level",
     "One child is sent off to do a completely separate activity"
    ],
    "a": 1,
    "fb": "PARALLEL keeps the same theme but groups children by ability so each works at their own level. OPEN is 'same for everyone'; SEPARATE is an individual/small group doing something specific."
   },
   {
    "q": "A child discloses a safeguarding concern to you. As a Level 1 coach, you should:",
    "opts": [
     "Investigate thoroughly and decide if it's true before acting",
     "Recognise, respond, record and refer it to your Designated Safeguarding Officer",
     "Promise to keep it a secret so the child trusts you"
    ],
    "a": 1,
    "fb": "Level 1 is awareness and knowing your route: recognise, respond, record and refer. You never investigate and never promise secrecy."
   },
   {
    "q": "For a holiday camp, which is a common good-practice staffing ratio guide?",
    "opts": [
     "Roughly 1:8 for under-8s and 1:10 for children aged 8 and over",
     "1:20 for all ages regardless of activity",
     "No ratios are needed if the provision is exempt from Ofsted registration"
    ],
    "a": 0,
    "fb": "A common guide is around 1:8 for under-8s and 1:10 for 8+, adjusted for higher-risk activities. Even Ofsted-exempt provision still carries full duty of care and safeguarding responsibilities."
   }
  ]
 },
 {
  "id": "c63",
  "title": "Effective Sports Coaching (Level 2) — Planning & Differentiation",
  "cat": "Recommended",
  "cover": "people",
  "category": "together",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "Plan sessions with clear, observable outcomes, then adapt them live so every ability is stretched and included. This course teaches the STEP model, the Inclusion Spectrum and a games-based approach, with worked \"make it easier / make it harder\" examples for both sport and art. You'll leave able to write a plan, differentiate on the fly, question well and evidence progress.",
  "lessons": [
   {
    "id": "l1",
    "title": "Planning a Session with Clear Learning Outcomes",
    "mins": 7,
    "blocks": [
     {
      "k": "text",
      "t": "A session plan is not paperwork for its own sake — it is the difference between a busy hour and an hour where children actually improve. A usable plan answers three questions before you set foot on the pitch: who is in front of you, what they will be able to do by the end, and how you will get them there. If you can't say what success looks like, you can't tell whether the session worked."
     },
     {
      "k": "figure",
      "fig": "session"
     },
     {
      "k": "points",
      "title": "What every usable plan states",
      "items": [
       "WHO: numbers, ages and the spread of abilities in the group",
       "WHAT: 2–3 learning outcomes the children should reach by the end",
       "HOW: activities, rough timings, coaching points, equipment and safety/risk",
       "A differentiation column: an easier and a harder version of each task, ready in advance"
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Write outcomes as observable behaviours",
      "t": "Use the stem 'By the end, learners will be able to…' followed by a doing verb — send, receive, control, decide, support a teammate. If you can watch it happen, you can assess it. 'Understand passing' is invisible; 'receive a pass and make a forward decision under light pressure' is something you can see and coach."
     },
     {
      "k": "points",
      "title": "Split outcomes across four domains",
      "items": [
       "Technical — a skill (e.g. receive with the inside of the foot)",
       "Tactical / decision-making — choosing the right option (e.g. pass into space)",
       "Social — cooperation (e.g. encourage and support a partner)",
       "Personal — confidence and effort (e.g. keep trying after a mistake)"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Differentiation is planned, not improvised",
      "t": "The single biggest lift in session quality is planning a differentiation column in advance — an easier and a harder version of every task. If you only adapt when a child is visibly struggling, you're already too late and other children have switched off. Have both versions written before you arrive."
     },
     {
      "k": "check",
      "q": "Which of these is a usable learning outcome?",
      "opts": [
       "Get better at football",
       "Receive a pass and make a forward decision under light pressure",
       "Have a fun morning playing games"
      ],
      "a": 1,
      "fb": "'Get better at football' and 'have fun' can't be observed or assessed. The middle option names a behaviour you can watch, coach and judge — technical plus a decision."
     }
    ]
   },
   {
    "id": "l2",
    "title": "Session Structure & Skill Progressions",
    "mins": 6,
    "blocks": [
     {
      "k": "steps",
      "title": "A reliable session shape",
      "items": [
       {
        "h": "Welcome & register",
        "t": "Greet children, take the register, check a safe arrival and settle the group."
       },
       {
        "h": "Pulse-raiser",
        "t": "A game-like warm-up that already rehearses the theme — not laps. If it's a passing session, warm up with a passing tag game."
       },
       {
        "h": "Skill introduction",
        "t": "Small numbers, high repetition, one clear demo. 'Watch me, then show me' beats a long explanation."
       },
       {
        "h": "Development",
        "t": "Progress toward realism — add movement, a passive defender, more decisions."
       },
       {
        "h": "Application / game",
        "t": "The skill under game conditions in a small-sided game."
       },
       {
        "h": "Cool-down & review",
        "t": "Lower the intensity and ask two quick questions about what they practised."
       }
      ]
     },
     {
      "k": "points",
      "title": "Progress skills along logical continua",
      "items": [
       "Static → moving",
       "Unopposed → passive defender → live opponent",
       "More space and time → less space and time",
       "Simple skill → combined skills",
       "Cooperative → competitive"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Kill queues and elimination games",
      "t": "Every child in a queue is a child not practising. Elimination games (dodgeball, knockout) are worst of all: the child who most needs practice is 'out' first and gets the least. Re-design so 'out' means a five-second task then straight back in — keep everyone active."
     },
     {
      "k": "text",
      "t": "Worked example — a 60-minute passing session for 8–10s. Warm-up: 'traffic lights' dribbling with a ball each (5 min). Skill intro: pass and receive in pairs over 4 metres, inside of the foot, 'watch me' demo (10 min). Development: pass through cones/gates then rotate, then add a passive defender to jog around (15 min). Application: 3v3 to end zones where a goal counts after three passes (20 min). Cool-down: slow dribbles and two questions — 'Where was the space? What made a pass easy to receive?' (10 min)."
     },
     {
      "k": "check",
      "q": "Your knockout game leaves the least-confident child sitting out after two minutes. Best fix?",
      "opts": [
       "Leave it — they can learn by watching the others",
       "Re-design so 'out' means a quick task, then straight back in",
       "Tell them to concentrate harder next round"
      ],
      "a": 1,
      "fb": "Watching isn't practising, and 'try harder' doesn't add reps. Redesigning so elimination becomes a quick re-entry keeps the child who needs the most practice active."
     }
    ]
   },
   {
    "id": "l3",
    "title": "STEP in Depth — Space, Task, Equipment, People",
    "mins": 8,
    "blocks": [
     {
      "k": "text",
      "t": "STEP (UK Coaching) stands for Space, Task, Equipment and People. It is a structured way to adapt ANY activity: for each element you can make a task easier or harder. It's your live dial for differentiation — set an easier and a harder version of each element in your plan, then turn just one dial as you watch the group. The extended version, STTEP, adds a second T for Teaching/Time — how you instruct and how much time you allow."
     },
     {
      "k": "figure",
      "fig": "step"
     },
     {
      "k": "points",
      "title": "SPACE — size, shape, surface and distance",
      "items": [
       "Easier: bigger target, more room and time, shorter distances, wider goals",
       "Harder: smaller pitch, closer defenders, longer passes, reduce time and space",
       "Art parallel: a bigger canvas or more spread-out materials (easier) vs a small, crowded page (harder)"
      ]
     },
     {
      "k": "points",
      "title": "TASK — the rules, challenge and how it's done",
      "items": [
       "Easier: allow a bounce or two touches, break the skill into chunks, remove a defender, more attempts, catch instead of strike",
       "Harder: one-touch, add a rule (must pass before shooting), a time limit, condition the scoring, combine skills",
       "Art parallel: 'draw the outline first' (easier) vs 'add shading and perspective' (harder)"
      ]
     },
     {
      "k": "points",
      "title": "EQUIPMENT — what's used",
      "items": [
       "Easier: larger, softer, slower balls; lighter, shorter bats; lower nets; bigger targets; bright or bell balls and tactile markers",
       "Harder: smaller, faster ball; heavier implement; higher net; smaller target",
       "Art parallel: chunky brushes, pre-cut shapes and grips (easier) vs fine brushes and detail (harder)"
      ]
     },
     {
      "k": "points",
      "title": "PEOPLE — grouping and roles",
      "items": [
       "Easier: overload the attack (3v1), pair with a supportive partner, smaller sides for more touches",
       "Harder: even or defender-overloaded sides, rotate roles, mixed-ability so stronger players support",
       "Art parallel: pair a confident child with a hesitant one, or let a child work solo"
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "The golden rule: one dial at a time",
      "t": "Change ONE STEP element, observe, then adjust. If you shrink the pitch AND swap the ball AND add a rule all at once, you'll never know what helped or hurt. Turn a single dial, read the room, and turn again."
     },
     {
      "k": "check",
      "q": "A tennis rally keeps breaking down because the ball moves too fast for beginners. Changing ONE element, what helps most?",
      "opts": [
       "Use a slower foam ball (Equipment)",
       "Add a scoring rule (Task)",
       "Shrink the court (Space)"
      ],
      "a": 0,
      "fb": "The problem is ball speed, so the Equipment dial — a slower foam ball — targets it directly. A rule or a smaller court wouldn't fix the pace and could make it harder."
     }
    ]
   },
   {
    "id": "l4",
    "title": "The Inclusion Spectrum — Choosing How to Include",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "The Inclusion Spectrum, developed by Ken Black and Pam Stevenson, is an activity-centred model with five complementary approaches. You don't pick one forever — you flex between them within a session. Pair it with the 'Change to Include' idea: choose the least-restrictive approach that still lets everyone succeed. (The Australian TREE model — Teaching, Rules, Equipment, Environment — is the same idea under a different name.)"
     },
     {
      "k": "figure",
      "fig": "inclusion"
     },
     {
      "k": "points",
      "title": "The five approaches",
      "items": [
       "Open — everyone does the same, little or no change",
       "Modified — same activity, but space, rules, equipment or interaction adapted (STEP applied)",
       "Parallel — same theme, grouped by ability so each works at their level",
       "Separate — occasional individual or similar-ability practice",
       "Disability sport / reverse integration — everyone plays a disability sport, e.g. boccia, goalball, sitting volleyball"
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Ask, don't assume — 'nothing about us without us'",
      "t": "The best adaptation is often the one a child or parent suggests. Ask what works for them rather than deciding for them. Disability-sport sessions like boccia or goalball are brilliant for the whole group, not just disabled children — they level the field and build empathy."
     },
     {
      "k": "check",
      "q": "You have very mixed abilities. You keep the same theme but group children by level so each works at the right challenge. Which approach is this?",
      "opts": [
       "Open",
       "Parallel",
       "Separate"
      ],
      "a": 1,
      "fb": "Same theme, grouped by ability, everyone working at their own level — that's the Parallel approach. Open would be no change; Separate is occasional individual practice."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Constraints-Led & Games-Based Coaching",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Instead of drilling a technique in isolation, design the environment so the skill you want naturally emerges. In a constraints-led / games-based approach you set up small-sided games and problems, then let learners find their own solutions. STEP is the practical dial for setting those constraints — manipulate the rules, area and numbers, guide attention to the outcome ('find the space') rather than body parts, and welcome variability rather than chasing one 'perfect' technique."
     },
     {
      "k": "points",
      "title": "Why it works",
      "items": [
       "Better decision-making — children practise reading the game, not just repeating a movement",
       "Transfer — skills learned in game-like conditions show up in the real game",
       "Motivation and ownership — solving a problem is more engaging than following an instruction",
       "Everyone active — small-sided games mean more touches and fewer queues"
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Design the game to demand the skill",
      "t": "Want players to look up and pass early? Make a goal count only after three passes. Want first touch out of the feet? Condition a 'no dribbling in your own third'. The rule does the coaching — you set the constraint and let the behaviour emerge."
     },
     {
      "k": "check",
      "q": "You want players to look up and pass rather than dribble into trouble. Best method?",
      "opts": [
       "Line them up and lecture on head position",
       "A small-sided game where a point only counts after three passes",
       "Ten minutes of static passing in pairs"
      ],
      "a": 1,
      "fb": "A conditioned small-sided game makes the desired behaviour necessary to score, so it emerges under realistic pressure. A lecture or static drill rarely transfers to the game."
     }
    ]
   },
   {
    "id": "l6",
    "title": "Questioning & Feedback That Sticks",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "Coaching is not commentating. The most powerful tool you have is a good question. Use open questions — 'What could you try? How did that feel? Where was the space?' — which invite thinking. Avoid 'why', which can feel like an accusation to a young person and shuts them down. Keep instruction short: demo, don't lecture, and get them back to doing quickly."
     },
     {
      "k": "figure",
      "fig": "feedback"
     },
     {
      "k": "steps",
      "title": "The praise → question → prompt loop",
      "items": [
       {
        "h": "Praise",
        "t": "Name something specific they did well — 'great first touch there'."
       },
       {
        "h": "Question",
        "t": "Ask something that makes them think — 'what could you do before the ball arrives?'"
       },
       {
        "h": "Prompt",
        "t": "Give one small cue to try next — 'try a quick look over your shoulder'."
       }
      ]
     },
     {
      "k": "points",
      "title": "Good feedback is…",
      "items": [
       "Specific — 'point your toe' beats 'do it better'",
       "Timely — close to the moment it matters",
       "Mostly action-focused — what to try next, not just what went wrong",
       "Balanced with fun — challenge and enjoyment together, and 'show me…' to check by doing"
      ]
     },
     {
      "k": "check",
      "q": "A child mistimes a catch and looks deflated. Best coaching response?",
      "opts": [
       "Ask 'Why did you drop that one?'",
       "Praise the effort, then ask 'What could you try with your hands next time?'",
       "Just repeat the instruction louder and move on"
      ],
      "a": 1,
      "fb": "'Why' feels threatening and invites excuses. Praise plus an open, forward-looking question keeps confidence up and gives the child something to try — the praise-question-prompt loop."
     }
    ]
   },
   {
    "id": "l7",
    "title": "Big Groups, Stations & Assessing on the Fly",
    "mins": 5,
    "blocks": [
     {
      "k": "text",
      "t": "With a large group, stations and carousels are your best friend: small groups rotate through short tasks, which maximises activity, lets you differentiate per station, and frees you to coach individuals rather than manage a crowd. Use squads or colour teams, clear signals for rotation, simple station cards, and a 'challenge zone' so early finishers can extend themselves. Stand where you can see every group and keep transitions fast."
     },
     {
      "k": "points",
      "title": "Assessing against your outcomes — without a formal test",
      "items": [
       "Watch technique — is the skill happening under the conditions you set?",
       "Watch decisions — are they choosing the right option, not just executing?",
       "Watch engagement — bored faces and drop-outs are data too",
       "Quick-question — 'show me…' and 'where was the space?' check understanding by doing"
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Read the room and turn one dial",
      "t": "Bored or breezing it = make it harder. Failing or frustrated = make it easier. Use STEP to change one variable, then re-observe. Jot a quick note on who to stretch or support next session — that's your evidence of progress and your plan for next time."
     },
     {
      "k": "check",
      "q": "Early finishers at a throwing-and-catching station are getting bored. Good station design includes…?",
      "opts": [
       "A 'challenge zone' so they can extend themselves",
       "A longer queue to slow them down",
       "Sending them to sit out until the rotation"
      ],
      "a": 0,
      "fb": "A challenge zone keeps able children stretched and active while you coach others. Queues and sitting out waste the very time those children could be improving."
     }
    ]
   },
   {
    "id": "l8",
    "title": "Duties, Terminology & Inclusive Practice",
    "mins": 5,
    "blocks": [
     {
      "k": "callout",
      "tone": "law",
      "title": "Equality Act 2010 — the anticipatory duty",
      "t": "Under the Equality Act 2010 (ss.20–21), providers owe an anticipatory duty to make reasonable adjustments so disabled participants aren't at a substantial disadvantage. 'Anticipatory' means you plan inclusively in advance — you don't wait to be asked or wait for a problem. Your differentiation column and STEP options are how you meet this duty in practice."
     },
     {
      "k": "points",
      "title": "Supporting sensory and neurodivergent children",
      "items": [
       "Predictable routines and visual schedules — show the shape of the session (Autism Education Trust)",
       "Clear, short instructions — one thing at a time, demo over talk",
       "Movement breaks and a quiet option for when things get too much",
       "Reduce sensory overload — noise, bright bibs, whistle blasts (ADHD Foundation)",
       "Ask the child or parent what works — 'nothing about us without us'"
      ]
     },
     {
      "k": "points",
      "title": "Common mistakes to avoid",
      "items": [
       "Vague or no outcomes you can't assess",
       "Queues and elimination games",
       "Over-talking instead of demonstrating",
       "One-size activity for a mixed-ability group",
       "Changing several STEP variables at once",
       "Only praising and never questioning",
       "Treating differentiation as an afterthought, not a planned easier/harder pair"
      ]
     },
     {
      "k": "check",
      "q": "Under the Equality Act 2010, the duty to make reasonable adjustments is…?",
      "opts": [
       "Only triggered once a parent complains",
       "Anticipatory — you plan inclusively in advance",
       "Optional for holiday clubs and camps"
      ],
      "a": 1,
      "fb": "The duty is anticipatory: providers must plan inclusively ahead of time so disabled participants aren't at a substantial disadvantage, not wait to be asked."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "What does STEP stand for in the UK Coaching adaptation model?",
    "opts": [
     "Space, Task, Equipment, People",
     "Speed, Timing, Effort, Power",
     "Start, Try, Evaluate, Progress"
    ],
    "a": 0,
    "fb": "STEP = Space, Task, Equipment, People — four dials for making any activity easier or harder."
   },
   {
    "q": "Which is an 'easier' Space adaptation?",
    "opts": [
     "A smaller pitch with closer defenders",
     "Wider goals and more time on the ball",
     "A one-touch rule"
    ],
    "a": 1,
    "fb": "More space and time — like wider goals — makes a task easier. Smaller pitches and one-touch rules make it harder (and one-touch is a Task change, not Space)."
   },
   {
    "q": "Everyone in the group plays boccia or goalball together. On the Inclusion Spectrum this is…?",
    "opts": [
     "Modified",
     "Disability sport / reverse integration",
     "Open"
    ],
    "a": 1,
    "fb": "When the whole group plays a disability sport, that's the disability-sport / reverse-integration approach — great for everyone, not only disabled children."
   },
   {
    "q": "What is the golden rule when adapting with STEP?",
    "opts": [
     "Change several variables at once to save time",
     "Change one element, observe, then adjust",
     "Never touch the equipment mid-session"
    ],
    "a": 1,
    "fb": "Change one dial at a time and re-observe — otherwise you can't tell what actually helped or hindered."
   },
   {
    "q": "Which question word is best avoided with young people because it can feel threatening?",
    "opts": [
     "What",
     "Where",
     "Why"
    ],
    "a": 2,
    "fb": "'Why' can feel like an accusation. Prefer open 'what', 'where' and 'how' questions that invite thinking."
   },
   {
    "q": "Best-practice differentiation means…?",
    "opts": [
     "Adapting only if a child struggles on the day",
     "Planning an easier and a harder version of each task in advance",
     "Giving everyone the identical task every time"
    ],
    "a": 1,
    "fb": "Plan the easier/harder pair in advance — it's the single biggest lift in session quality and it's how you meet the anticipatory duty."
   },
   {
    "q": "Which pair are both learning-outcome domains you should plan for?",
    "opts": [
     "Technical and social",
     "Loud and quiet",
     "Fast and slow"
    ],
    "a": 0,
    "fb": "Outcomes span technical, tactical, social and personal domains — technical and social are two of them."
   }
  ]
 },
 {
  "id": "c64",
  "title": "Effective Sports Coaching (Level 3) — Advanced & Inclusive",
  "cat": "Recommended",
  "cover": "people",
  "category": "together",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "A Level 3 course for holiday-camp and activity-club coaches who want to move beyond drills and whistles. You'll build a child-first coaching philosophy, learn to slide across the spectrum of teaching styles, and master two inclusion frameworks — STEP and the Inclusion Spectrum — with live \"make it easier / make it harder\" adjustments for sport and craft. Grounded in Mosston & Ashworth, LTAD, ecological dynamics and the Equality Act 2010.",
  "lessons": [
   {
    "id": "l1",
    "title": "Your Coaching Philosophy & the Spectrum of Styles",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Every advanced coach needs a stated philosophy — a clear 'why' that guides the choices you make when a session isn't going to plan. At Level 3 that 'why' is built on one principle: coach the child or young person first, the sport second. Winning the under-9s tournament matters far less than whether those children still want to be here next holiday. Your philosophy is the sentence you'd want a parent to overhear: something like 'I make sport fun, safe and inclusive so every child leaves more confident than they arrived.'"
     },
     {
      "k": "figure",
      "fig": "coaching-styles"
     },
     {
      "k": "text",
      "t": "Once you know your 'why', the question becomes 'how' — and that's where teaching style comes in. Mosston & Ashworth's Spectrum of Teaching Styles describes a continuum of eleven styles running from teacher-centred 'reproductive' styles (the coach makes the decisions) to learner-centred 'productive' styles (the learner solves problems). The Level 3 message is that a style is a tool chosen for the objective and the learner in front of you — not a personality. A skilled coach slides along the spectrum within a single session."
     },
     {
      "k": "points",
      "title": "The practical five to move between",
      "items": [
       "Command — the coach makes all the decisions. Great for safety, large groups and brand-new skills (e.g. teaching a safe stopping position in hockey).",
       "Practice — learners rehearse a task while the coach circulates and feeds back individually.",
       "Reciprocal — learners work in pairs, one performing while the other observes and coaches using a simple criteria card.",
       "Guided Discovery — the coach poses questions and offers choices so players discover the answer themselves ('How could you get more space before you receive?').",
       "Self-Directed / Divergent Discovery — learners design their own solutions, games or practices."
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Slide, don't stick",
      "t": "A single 45-minute session might open in Command (safety brief, one clear skill), move to Practice (rehearse it with feedback), shift to Reciprocal (pairs coach each other), then finish with Guided Discovery in a small-sided game. Plan which style each phase needs before you arrive."
     },
     {
      "k": "check",
      "q": "You're introducing a brand-new javelin-style throwing action to 20 excitable eight-year-olds on a shared field. Which style should you START with, and why?",
      "opts": [
       "Guided Discovery, so they explore throwing freely",
       "Command, to control safety and teach the core action before opening it up",
       "Self-Directed, so they design their own throwing games first"
      ],
      "a": 1,
      "fb": "Start in Command: with 20 children, a new action and shared space, safety and a clear model come first. Once the action is understood, slide towards Practice and Guided Discovery to deepen it. Command isn't 'bad' — using only Command all day is."
     }
    ]
   },
   {
    "id": "l2",
    "title": "Long-Term Development, Physical Literacy & Retention",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Level 3 coaches think in years, not sessions. Balyi's Long-Term Athletic Development (LTAD) model reminds us that children develop through stages, and that the job in the primary and early-adolescent years is to build physical literacy — movement competency, plus the confidence, motivation and understanding to stay active for life. A child who can run, jump, land, throw, catch, balance and change direction with confidence has the 'ABCs' (agility, balance, coordination, speed) that transfer to every sport."
     },
     {
      "k": "points",
      "title": "The FUNdamentals principle",
      "items": [
       "Develop fundamental movement skills in a fun, varied, largely non-competitive environment.",
       "Offer a broad menu of movements and sports rather than early specialisation in one.",
       "Prioritise enjoyment and mastery — a child who feels competent keeps turning up.",
       "Match challenge to developmental stage, not birth year."
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "The relative age effect",
      "t": "In any group born in the same year, a child born in September can be nearly a year more physically mature than one born the following August. Judging or selecting on current size and speed quietly pushes younger-in-year and later-developing children out. Match challenge to the individual, and avoid fixed 'top group' labels."
     },
     {
      "k": "text",
      "t": "Retention is the real scoreboard. Research consistently shows that enjoyment, a sense of mastery, autonomy (some choice and voice) and belonging are what keep children in sport — while boredom, constant de-selection and over-competition too early are the biggest drivers of drop-out, especially around adolescence. Your holiday camp is a retention engine: the child who has a brilliant, inclusive week in August is the one who joins the term-time club in September."
     },
     {
      "k": "check",
      "q": "A parent proudly tells you their 9-year-old 'only plays football now, four times a week, to go pro'. From an LTAD view, what's the risk you'd gently raise?",
      "opts": [
       "None — early specialisation is the fastest route to elite sport",
       "Early single-sport specialisation risks burnout, narrow movement skills and drop-out; a broad base is better at this age",
       "They should add competitive tournaments every weekend to speed it up"
      ],
      "a": 1,
      "fb": "At this stage a broad diet of movement (FUNdamentals) builds physical literacy and reduces burnout and overuse. Early specialisation and over-competition are classic drop-out drivers. Encourage variety, fun and mastery over premature 'going pro' pressure."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Advanced Differentiation & the Constraints-Led Approach",
    "mins": 7,
    "blocks": [
     {
      "k": "text",
      "t": "Differentiation at Level 3 is not a worksheet for the 'weaker' children — it's designing one activity that stretches everyone at their own level, at the same time. The mantra is 'same activity, different challenge'. You can differentiate by task (what they're asked to do), outcome (what success looks like), support (a buddy or coach prompt), pace (time and rest), grouping (who works with whom) and resource (the equipment they use)."
     },
     {
      "k": "text",
      "t": "The Constraints-Led Approach (Newell, 1986; ecological dynamics) gives this a powerful engine. Instead of drilling one 'correct' technique, you design the environment so that functional movement solutions emerge as the learner self-organises. Skills appear from the interaction of three constraints — and you, the coach, are the designer of the practice, not the puppet-master of the player."
     },
     {
      "k": "points",
      "title": "The three constraints you manipulate",
      "items": [
       "Individual — the learner themselves: height, strength, confidence, fatigue, prior experience.",
       "Task — the rules, equipment, area size, scoring system, number of touches or passes allowed.",
       "Environmental — the surface, weather, noise, light, and the social expectations around them."
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Constraints meet guided discovery",
      "t": "Constraints design dovetails with guided discovery: shrink the pitch and players discover they must pass quicker; add a 'no tackling in the middle third' rule and dribbling into space emerges. You change the environment; the child finds the solution — and owns it because they found it."
     },
     {
      "k": "steps",
      "title": "Design a constraints-led practice in four moves",
      "items": [
       {
        "h": "Name the target behaviour",
        "t": "e.g. 'players scan and pass into space' rather than 'do a good pass'."
       },
       {
        "h": "Pick a constraint to nudge it",
        "t": "Fewer touches, a wider pitch, or a 'point for a pass that beats a line' rule."
       },
       {
        "h": "Let solutions emerge",
        "t": "Resist over-coaching — observe what the constraint produces before you speak."
       },
       {
        "h": "Tune the dial",
        "t": "If it's chaos, ease the constraint; if it's too easy, tighten it. Differentiate per group."
       }
      ]
     },
     {
      "k": "check",
      "q": "You want a mixed-ability rounders group to 'look up and communicate' more when fielding. Which is a constraints-led tweak (not just an instruction)?",
      "opts": [
       "Shout 'communicate more!' repeatedly",
       "Award a bonus point only when two fielders call and combine before the out",
       "Bench the quietest children until they speak up"
      ],
      "a": 1,
      "fb": "Adding a rule that rewards two fielders calling and combining is a task constraint — it makes communication the way to win, so the behaviour emerges. Nagging is an instruction; benching removes the very children who most need chances to grow."
     }
    ]
   },
   {
    "id": "l4",
    "title": "STEP — Making Reasonable Adjustments Live",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "STEP (from UK Coaching) is your on-the-spot inclusion tool: four dials you can turn in seconds to make any activity easier, harder or simply accessible — Space, Task, Equipment, People. The Level 3 skill is treating STEP as live and continuous, adjusting mid-game for different children, rather than as a one-off plan you wrote the night before. It is also your practical means of making the 'reasonable adjustments' the Equality Act requires (Lesson 6)."
     },
     {
      "k": "figure",
      "fig": "step"
     },
     {
      "k": "points",
      "title": "What each letter lets you change",
      "items": [
       "Space — the size, shape or surface of the area, and the distance between players (bigger area for reaction time, smaller to increase intensity).",
       "Task — the rules, how the skill is performed, or breaking a skill into chunks (fewer touches, allow a bounce, no tackling zone).",
       "Equipment — offer a choice of, or adapted, kit: larger/softer/brighter/lighter balls, lower nets, bigger targets, shorter racquets.",
       "People — team sizes, roles, a rotating 'buddy' or peer mentor, or short 1:1 support."
      ]
     },
     {
      "k": "steps",
      "title": "Worked example — mixed-ability defending in football",
      "items": [
       {
        "h": "Baseline",
        "t": "3-v-3 to small goals; some defenders are lost, some are dominating."
       },
       {
        "h": "Make it EASIER (S,E,P)",
        "t": "Give a struggling defender a bigger area to recover in (Space), a softer, brighter ball that's easier to track (Equipment), and a buddy who calls out who to mark (People)."
       },
       {
        "h": "Make it HARDER (S,T)",
        "t": "For a confident defender, shrink their zone (Space) and set a 'win the ball within eight seconds' rule (Task)."
       },
       {
        "h": "Run both at once",
        "t": "Same game, different STEP settings per child — that's live differentiation, not sink-or-swim."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "STEP transfers to arts & crafts too",
      "t": "In a lanyard-weaving or model-building session: Space — a clear, uncluttered table with a calm corner; Task — chunk it into 'thread, then loop, then pull', with a photo step-card; Equipment — chunky threaders, pre-cut pieces, easy-grip scissors; People — a peer partner or adult for the fiddly steps. Inclusion is a mindset, not a sport."
     },
     {
      "k": "check",
      "q": "A child with limited grip strength can't hold the standard tennis racquet in your camp session. Fastest STEP adjustment?",
      "opts": [
       "Task — remove them from the game and give a worksheet",
       "Equipment — offer a shorter, lighter racquet or a foam bat and a slower foam ball",
       "Space — make the whole court much bigger for everyone"
      ],
      "a": 1,
      "fb": "Equipment: a shorter, lighter bat and a slow foam ball let them play the same game now. STEP is meant to be pulled live and specifically — you don't need to change the activity for everyone, just turn the right dial for this child."
     }
    ]
   },
   {
    "id": "l5",
    "title": "The Inclusion Spectrum — Five Approaches",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Where STEP adjusts a single activity, the Inclusion Spectrum (Black & Stevenson; used by Activity Alliance and Scottish Disability Sport) helps you choose HOW to structure the whole activity for a mixed group. It is activity-centred, offering five approaches you flex between. Crucially, it is not a hierarchy or a ladder — good coaches move fluidly and often use several approaches within one afternoon."
     },
     {
      "k": "figure",
      "fig": "inclusion"
     },
     {
      "k": "points",
      "title": "The five approaches",
      "items": [
       "Open — everyone does the same activity based on what everyone can do, with no modification (e.g. a simple tag warm-up).",
       "Modified — everyone plays the same game, but rules, equipment or space are adapted for all (this is STEP applied).",
       "Parallel — participants are grouped by ability doing the same activity, but with different challenge or outcomes.",
       "Separate — an individual or small group practises separately, by choice or need, then often rejoins.",
       "Disability Sport activities — activities drawn from disability sport (boccia, goalball, sitting volleyball), including 'reverse integration' where non-disabled peers join in."
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Worked example — a holiday multi-sports afternoon",
      "t": "Warm-up as OPEN (everyone plays 'stuck in the mud'). Move to a MODIFIED handball game (softer ball, no-contact rule). Split into PARALLEL shooting stations by challenge level. Offer a SEPARATE quiet-corner station for a child who needs a reset. Finish with a whole-camp DISABILITY SPORT game of boccia — where everyone, disabled or not, competes on equal terms."
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Don't camp out in 'Separate'",
      "t": "Separate has a proper place — genuine choice, focused skill work, a sensory reset. But a classic mistake is adapting for disabled children by permanently sidelining them into a separate activity. That can breach the spirit and letter of the Equality Act. Use Separate briefly and by choice, and always plan the route back in."
     },
     {
      "k": "check",
      "q": "Your camp has a wheelchair user and 14 running children. You want ONE game everyone competes in on genuinely equal terms. Best Inclusion Spectrum choice?",
      "opts": [
       "Separate — give the wheelchair user their own drill in the corner",
       "Disability Sport activity — run boccia or seated volleyball as reverse integration for the whole group",
       "Open — a fast running-tag game with no changes"
      ],
      "a": 1,
      "fb": "A disability sport activity like boccia levels the field and lets everyone compete together (reverse integration). Open running-tag disadvantages the wheelchair user; parking them in a Separate corner risks exclusion. Remember these are choices to flex between, not a ranking."
     }
    ]
   },
   {
    "id": "l6",
    "title": "SEND, ADHD, Autism & the Equality Act 2010",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "The single most important idea here: the strategies that help neurodivergent children help everyone. Good SEND practice isn't a separate specialism bolted on — it's your ordinary good coaching, amplified and made deliberate. Autistic children, children with ADHD, and children with other additional needs thrive in the same predictable, positive, low-clutter environments that in fact suit the whole group."
     },
     {
      "k": "points",
      "title": "Evidence-based strategies (that help all)",
      "items": [
       "Predictable structure and a visual schedule or rotation board so children know what's coming next.",
       "Simple language — one instruction at a time, short, concrete, and demonstrated as well as said.",
       "Immediate, specific, positive feedback ('great low, wide base then' beats a vague 'well done').",
       "Sensory awareness — dampened/quieter balls, reduced noise and glare, and planned sensory or quiet breaks BEFORE a child reaches overload.",
       "Clear, signalled transitions (a countdown or a whistle pattern) and strengths-based grouping."
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Ask, don't assume",
      "t": "The child and their parent or carer are the experts. A two-minute 'what helps you have a great session, and what should I look out for?' at drop-off is worth more than any generic checklist. Note it, act on it, and check back."
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Equality Act 2010 — the legal duty",
      "t": "You and your club cannot exclude a child because of a protected characteristic (including disability), and you must make reasonable adjustments so a disabled child is not put at a substantial disadvantage. 'Reasonable' means proportionate changes to your practices, formats or communication, with the child's needs at the centre. STEP and the Inclusion Spectrum are exactly how you deliver those adjustments in practice."
     },
     {
      "k": "check",
      "q": "An autistic child in your camp becomes visibly overwhelmed during a loud, fast dodgeball game. Best-practice response?",
      "opts": [
       "Insist they keep playing to 'build resilience'",
       "Use a pre-planned calm-corner reset (a Separate choice) and a dampened ball / quieter version they can rejoin",
       "Send them to sit out alone with no plan to return"
      ],
      "a": 1,
      "fb": "Offer the pre-planned quiet reset and a calmer version to rejoin — that's a reasonable adjustment (Equality Act) delivered via STEP and the Inclusion Spectrum. Forcing them on risks harm; excluding them with no route back risks unlawful exclusion. Plan sensory breaks BEFORE overload wherever you can."
     }
    ]
   },
   {
    "id": "l7",
    "title": "Planning a Season, Reflecting & Developing Others",
    "mins": 7,
    "blocks": [
     {
      "k": "text",
      "t": "A great multi-week programme is planned backwards. Start from the end goals (what will children be able to DO and FEEL by the last session?), then map the progression of skills week to week, and give each session a simple recap–teach–apply–review rhythm so learning sticks. Think in a season arc rather than a series of disconnected days."
     },
     {
      "k": "steps",
      "title": "A four-phase season arc",
      "items": [
       {
        "h": "Introduce (FUNdamentals)",
        "t": "Fun, varied movement and the core skills, low pressure, lots of touches and success."
       },
       {
        "h": "Develop (combine)",
        "t": "Link skills together and add light decision-making — guided discovery starts to feature."
       },
       {
        "h": "Apply (modified games)",
        "t": "Put skills to work in STEP-modified small-sided games where challenge is differentiated."
       },
       {
        "h": "Showcase (celebrate)",
        "t": "A festival, display or friendly where every child shines and effort is celebrated over winning."
       }
      ]
     },
     {
      "k": "text",
      "t": "Reflective practice is the spine that makes you better each week. Use Plan–Do–Review: plan the session with a clear objective, deliver it, then honestly review both your own delivery AND how the participants responded — what would you keep, tweak or drop? Small, specific adjustments compound fast over a season."
     },
     {
      "k": "points",
      "title": "Mentoring other coaches (reciprocal style, for adults)",
      "items": [
       "Observe with a simple focus rather than watching everything at once.",
       "Question, don't tell — 'what were you hoping that constraint would produce?' develops thinking coaches.",
       "Co-coach a session together, then swap the lead role and debrief.",
       "Model the reciprocal teaching style with your team: paired observation and feedback for adults, just as you'd use it with children."
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Measuring impact — beyond the scoreboard",
      "t": "Track what actually matters: participant voice and feedback, retention and attendance data across the weeks, simple skill and confidence tracking (a quick self-rating or coach note), and light wellbeing check-ins. Rising attendance and children asking to come back are your clearest signs of a job well done."
     },
     {
      "k": "check",
      "q": "You're planning a 6-week holiday-club block. Applying backward planning, what should you decide FIRST?",
      "opts": [
       "Which drills you personally enjoy running",
       "The end goals — what children will be able to do and feel by week six — then work back",
       "The exact warm-up for week one"
      ],
      "a": 1,
      "fb": "Backward planning starts from the end goals, then maps the week-to-week progression back from there, with a recap–teach–apply–review rhythm each session. Warm-ups and favourite drills come after you know where the whole block is heading."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "A coach only ever lines children up and dictates every move with a whistle. What's the main weakness?",
    "opts": [
     "It is always unsafe",
     "They default to command style and never flex along the spectrum",
     "Command style is banned in the UK"
    ],
    "a": 1,
    "fb": "Command style is genuinely useful for safety, new skills and big groups — the fault is using it as the only tool rather than sliding towards practice, reciprocal and guided discovery."
   },
   {
    "q": "In the STEP model, giving a struggling player a larger, softer, brighter ball is a change to which letter?",
    "opts": [
     "Space",
     "Task",
     "Equipment"
    ],
    "a": 2,
    "fb": "Equipment — offering adapted or a choice of kit (larger, softer, brighter balls, lower nets). STEP stands for Space, Task, Equipment, People."
   },
   {
    "q": "On the Inclusion Spectrum (Black & Stevenson), what does the 'Parallel' approach mean?",
    "opts": [
     "Everyone does the identical activity with no changes",
     "Groups do the same activity but at different challenge levels/outcomes",
     "Disabled children always practise away from the group"
    ],
    "a": 1,
    "fb": "Parallel groups participants by ability doing the same activity with different challenge or outcomes. It is not a hierarchy — good coaches flex between Open, Modified, Parallel, Separate and Disability Sport approaches within one session."
   },
   {
    "q": "Under the Equality Act 2010, a coach's duty towards a disabled child is to…",
    "opts": [
     "Make reasonable adjustments so they aren't at a substantial disadvantage",
     "Provide a one-to-one helper in every case",
     "Move them to a separate group for safety"
    ],
    "a": 0,
    "fb": "The Act requires reasonable, proportionate adjustments so a disabled person isn't put at a substantial disadvantage — and you cannot exclude someone for a protected characteristic. Over-using Separate can itself be exclusionary."
   },
   {
    "q": "The Constraints-Led Approach (Newell) says skills emerge from the interaction of which three constraints?",
    "opts": [
     "Individual, Task and Environmental",
     "Physical, Mental and Social",
     "Space, Task and Equipment"
    ],
    "a": 0,
    "fb": "Individual (height, strength, confidence, fatigue), Task (rules, area, equipment, scoring) and Environmental (surface, noise, light, social). Coaches design the environment so functional solutions self-organise — which dovetails with guided discovery."
   },
   {
    "q": "Which practices best support an autistic or ADHD child in a multi-sports session?",
    "opts": [
     "Long verbal instructions and frequent surprise changes",
     "Predictable structure, one instruction at a time, visual rotations and planned sensory breaks",
     "Removing them from group games to avoid overload"
    ],
    "a": 1,
    "fb": "Predictable structure, simple one-step language, immediate specific praise, sensory awareness and clear transitions help neurodivergent children — and help everyone. Always ask the child and parent what works."
   },
   {
    "q": "A coach wants to make a small-sided game HARDER for their most confident players. Which is a valid STEP adjustment?",
    "opts": [
     "Give them a bigger, softer ball",
     "Limit them to two touches and shrink their target",
     "Add a buddy to help them"
    ],
    "a": 1,
    "fb": "Reducing touches and shrinking the target raises task and space demands. Softer balls and buddies make it easier — STEP turns both ways, and you can differentiate different children at once."
   },
   {
    "q": "What is the 'reflective spine' recommended for reviewing and improving your coaching?",
    "opts": [
     "Plan–Do–Review",
     "Command–Practice–Reciprocal",
     "Space–Task–People"
    ],
    "a": 0,
    "fb": "Plan–Do–Review: plan the session, deliver it, then review your delivery and the participants' response, and adjust next time. Add participant voice, retention data and simple wellbeing check-ins to measure impact."
   }
  ]
 },
 {
  "id": "c65",
  "title": "Food Safety & Hygiene (Level 1)",
  "cat": "Recommended",
  "cover": "shield",
  "category": "health",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "A practical Level 1 Food Safety & Hygiene course for holiday-camp and activity-club staff who run tuck shops, hand out snacks and cut fruit, store packed lunches, pour squash and sometimes heat food. It turns the FSA standard into simple, repeatable habits built around the 4 Cs, personal hygiene, allergens and reporting. By the end you'll handle food with confidence and keep vulnerable children safe.",
  "lessons": [
   {
    "id": "l1",
    "title": "Why food safety matters and the law",
    "mins": 7,
    "blocks": [
     {
      "k": "text",
      "t": "At a holiday camp or activity club you might only pour squash, hand out biscuits, cut up fruit or store packed lunches in a fridge. It still counts. In law, anywhere that supplies food to others is a 'food business', and you have a duty to make sure that food is safe. This matters most because you serve children: their immune systems are still developing, so a dose of bacteria that would give an adult a mild upset can make a child seriously ill."
     },
     {
      "k": "figure",
      "fig": "4cs"
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "The legal duty",
      "t": "Under Regulation (EC) 852/2004 and the Food Safety Act 1990, food must be safe and 'what the customer expects'. Anyone handling open food must be supervised, instructed and/or trained in food hygiene appropriate to their role. Completing Level 1 satisfies this for low-risk food handlers."
     },
     {
      "k": "points",
      "title": "Why our setting is higher-stakes",
      "items": [
       "Children are a vulnerable group with less-developed immune systems",
       "Snacks, cut fruit, squash and packed lunches are all covered",
       "Tuck shops and cooked meals bring extra handling and heat",
       "Getting it right protects children and protects the club's reputation"
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Safer Food, Better Business (SFBB)",
      "t": "The FSA's free management system for small caterers is built around the 4 Cs plus 'safe methods' and a diary of daily opening and closing checks. Completed diary pages prove 'due diligence' to an Environmental Health Officer, so keep them until the next EHO visit."
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Confidence, not red tape",
      "t": "Good food safety is a handful of simple habits repeated every day, not a mountain of paperwork. Once they're routine you'll barely think about them."
     },
     {
      "k": "check",
      "q": "You only serve squash and pre-packed snacks at the tuck shop. Do the food hygiene rules apply to you?",
      "opts": [
       "No, only kitchens with cookers count",
       "Yes, you're a food business in law",
       "Only if a parent complains"
      ],
      "a": 1,
      "fb": "Correct. Supplying any food to others makes you a food business, so the training and hygiene duties apply even for snacks and drinks."
     }
    ]
   },
   {
    "id": "l2",
    "title": "The 4 Cs: the spine of food safety",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Nearly everything you need to know sits under four headings, all starting with C: Cross-contamination, Cleaning, Chilling and Cooking. Master these and you control the vast majority of food safety risks in a camp setting."
     },
     {
      "k": "figure",
      "fig": "danger-zone"
     },
     {
      "k": "steps",
      "title": "The four Cs at a glance",
      "items": [
       {
        "h": "Cross-contamination",
        "t": "The biggest cause of food poisoning: bacteria or allergens spreading from raw food, hands, cloths or utensils to ready-to-eat food. Keep raw and ready-to-eat apart, use separate colour-coded boards, wash hands between tasks and store raw meat below ready-to-eat food."
       },
       {
        "h": "Cleaning",
        "t": "Clean as you go. Cleaning removes dirt and food; disinfecting reduces bacteria to a safe level. Use a two-stage clean on food surfaces and let sanitiser sit for the contact time on the label."
       },
       {
        "h": "Chilling",
        "t": "Keep cold food cold to slow bacteria. Aim for a fridge at 5°C or below. Cool any leftovers quickly, ideally within 90 minutes, then refrigerate; never leave perishable food sitting out."
       },
       {
        "h": "Cooking",
        "t": "If you heat anything, get it properly hot in the centre. Reheat only once, and reheat to at least 70°C (75°C is best practice)."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "info",
      "title": "Safe cooking and reheating temperatures",
      "t": "A safe core is 70°C for 2 minutes, or an equivalent: 75°C for 30 seconds, 80°C for 6 seconds (also 65°C for 10 minutes, or 60°C for 45 minutes). At Level 1 most food is cold or pre-packed, so treat this as 'if you heat anything'."
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Sanitiser that actually works",
      "t": "Use a sanitiser that meets BS EN 1276 or BS EN 13697, and always leave it on the surface for the contact time stated on the label before wiping."
     },
     {
      "k": "check",
      "q": "You're reheating a batch of pasta for lunch. What core temperature should it reach?",
      "opts": [
       "37°C for a moment",
       "50°C for 5 minutes",
       "75°C for 30 seconds (or 70°C for 2 minutes)"
      ],
      "a": 2,
      "fb": "Correct. 70°C for 2 minutes, or 75°C for 30 seconds, kills harmful bacteria. And remember: reheat only once."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Food hazards and the danger zone",
    "mins": 7,
    "blocks": [
     {
      "k": "text",
      "t": "A hazard is anything that could make food unsafe. There are four types, and it helps to spot each one on sight so you can control it before it reaches a child."
     },
     {
      "k": "figure",
      "fig": "allergens"
     },
     {
      "k": "points",
      "title": "The four types of hazard",
      "items": [
       "Biological: bacteria (Salmonella, E. coli O157, Campylobacter, Listeria), viruses (norovirus) and moulds",
       "Chemical: cleaning products, sanitiser or pest bait near food",
       "Physical: hair, plasters, glass, packaging, jewellery, nails",
       "Allergenic: any of the 14 allergens, treated as a hazard in its own right"
      ]
     },
     {
      "k": "text",
      "t": "Bacteria are the main risk. They need four things to multiply: warmth, food, moisture and time. Crucially, they don't change how food looks, smells or tastes, so you can't rely on your senses to judge whether food is safe."
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "The temperature danger zone",
      "t": "Bacteria multiply fastest between 8°C and 63°C, with body temperature (37°C) being ideal for them. Keep chilled food at 8°C or below and any hot food held at 63°C or above, and keep time spent in the zone to a minimum."
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Physical hazards in a camp",
      "t": "Tie hair back, remove jewellery, keep nails short and clean, and cover cuts with blue detectable plasters so any that fall off can be spotted in food."
     },
     {
      "k": "check",
      "q": "What is the temperature danger zone, where bacteria multiply fastest?",
      "opts": [
       "8°C to 63°C",
       "0°C to 100°C",
       "20°C to 40°C"
      ],
      "a": 0,
      "fb": "Correct. 8°C to 63°C is the danger zone. Keep cold food at or below 8°C and hot food at or above 63°C."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Personal hygiene, handwashing and fitness to work",
    "mins": 7,
    "blocks": [
     {
      "k": "text",
      "t": "Handwashing is the single most important habit in food safety. Your hands touch everything, so keeping them clean breaks the chain that spreads bacteria to food and to children."
     },
     {
      "k": "figure",
      "fig": "handwash"
     },
     {
      "k": "steps",
      "title": "How to wash your hands properly",
      "items": [
       {
        "h": "Wet and soap",
        "t": "Use warm running water and soap."
       },
       {
        "h": "Scrub for ~20 seconds",
        "t": "Work into the backs of hands, between fingers, thumbs and under the nails."
       },
       {
        "h": "Rinse",
        "t": "Rinse thoroughly under clean running water."
       },
       {
        "h": "Dry",
        "t": "Dry with a clean or paper towel; damp hands spread bacteria more easily."
       }
      ]
     },
     {
      "k": "points",
      "title": "Always wash your hands...",
      "items": [
       "Before handling any food",
       "After using the toilet",
       "After touching raw food, bins, or blowing your nose",
       "After touching your face or hair",
       "After handling money or children's belongings"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "The 48-hour rule",
      "t": "Anyone with diarrhoea and/or vomiting must NOT handle open food and must stay away until 48 hours symptom-free after the last episode. Handwashing does not make it safe to work while ill. Certain infections (E. coli O157, dysentery, typhoid/paratyphoid) need medical clearance first. Always report illness to your supervisor."
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Dress for the job",
      "t": "Wear a clean apron, tie hair back, cover cuts with blue detectable plasters, remove jewellery, and never cough, sneeze or taste food with your fingers over the serving area."
     },
     {
      "k": "check",
      "q": "You were sick once yesterday evening but feel fine now. When can you handle open food again?",
      "opts": [
       "As soon as you feel better",
       "After 48 hours symptom-free",
       "After washing your hands really well"
      ],
      "a": 1,
      "fb": "Correct. You must wait 48 hours from your last symptom. Washing hands does not make it safe to handle food while you may still be infectious."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Storage, date labels and chilling",
    "mins": 7,
    "blocks": [
     {
      "k": "text",
      "t": "How you store food is just as important as how you serve it. Good storage keeps bacteria slow, keeps allergens apart and stops food being used past its safe date."
     },
     {
      "k": "points",
      "title": "Date labels: know the difference",
      "items": [
       "Use-by = SAFETY. Never use or serve food after its use-by date, even if it looks and smells fine",
       "Best-before = QUALITY. Safe after the date if stored correctly, just past its best",
       "Use-by applies to high-risk foods: dairy, cooked meats, prepared salads, sandwiches"
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Use-by dates are non-negotiable",
      "t": "It is against the law to sell or serve food past its use-by date. A sandwich or yoghurt one day over must be thrown away, however normal it seems, because the risk is invisible."
     },
     {
      "k": "steps",
      "title": "Store food the safe way",
      "items": [
       {
        "h": "Rotate stock (FIFO)",
        "t": "First In, First Out: put newer stock behind older stock so nothing gets forgotten and expires."
       },
       {
        "h": "Raw below ready-to-eat",
        "t": "Store raw meat below ready-to-eat food so nothing can drip onto it."
       },
       {
        "h": "Cover and lift",
        "t": "Keep food covered and off the floor."
       },
       {
        "h": "Keep it cold",
        "t": "Run the fridge at 5°C or below (legal maximum for high-risk chilled food is 8°C)."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Cooling leftovers",
      "t": "Cool any cooked leftovers quickly, ideally within 90 minutes, then refrigerate. Don't leave perishable food sitting out on the side between sittings."
     },
     {
      "k": "check",
      "q": "A packed-lunch yoghurt is one day past its use-by date but smells perfectly fine. Do you give it to a child?",
      "opts": [
       "Yes, it smells fine",
       "No, use-by is about safety",
       "Only if the child is older"
      ],
      "a": 1,
      "fb": "Correct. Use-by is a safety date. Bacteria don't change how food smells, so it must be thrown away once past use-by."
     }
    ]
   },
   {
    "id": "l6",
    "title": "Allergens, cleaning as you go and reporting",
    "mins": 8,
    "blocks": [
     {
      "k": "text",
      "t": "Allergies are common among children at camps, and a reaction can be life-threatening (anaphylaxis, which may need an EpiPen). Allergens are treated as a hazard in their own right, and getting them right can be the difference between a normal day and an emergency."
     },
     {
      "k": "points",
      "title": "The 14 legally declarable allergens",
      "items": [
       "Celery",
       "Cereals containing gluten",
       "Crustaceans",
       "Eggs",
       "Fish",
       "Lupin",
       "Milk",
       "Molluscs",
       "Mustard",
       "Peanuts",
       "Sesame",
       "Soya",
       "Sulphur dioxide/sulphites",
       "Tree nuts"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Never guess an allergen",
      "t": "Staff must never answer an allergen question from memory. Always check a written source or allergen matrix. Avoid cross-contact by using separate utensils and washing hands and surfaces between foods. Remember Natasha's Law: anything pre-packed for direct sale needs full ingredient and allergen labelling."
     },
     {
      "k": "text",
      "t": "Keeping the area clean underpins everything: clean as you go, keep bins covered and emptied, and watch for pests. Signs of pests include droppings and gnaw marks, and they must be reported the moment you spot them."
     },
     {
      "k": "steps",
      "title": "Report early, prevent harm",
      "items": [
       {
        "h": "Illness",
        "t": "Tell your supervisor about any sickness or diarrhoea straight away."
       },
       {
        "h": "Allergic reactions",
        "t": "Report any reaction immediately and follow the child's care plan."
       },
       {
        "h": "Pests and breakages",
        "t": "Report droppings, gnaw marks or broken equipment at once."
       },
       {
        "h": "Food and contamination",
        "t": "Report any food past its use-by date, or any accident or contamination."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "You've got this",
      "t": "Good food safety is a set of simple, repeatable habits: wash hands, keep raw and ready-to-eat apart, keep cold food cold, check dates and allergens, and speak up early. Do these every day and you keep every child safe."
     },
     {
      "k": "check",
      "q": "A parent asks whether the flapjacks in the tuck shop contain nuts. What should you do?",
      "opts": [
       "Answer from memory to be quick",
       "Check the written allergen information before answering",
       "Guess based on the packaging colour"
      ],
      "a": 1,
      "fb": "Correct. Never rely on memory. Always check the written allergen information or matrix, because a wrong answer could trigger a life-threatening reaction."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "What temperature should a fridge be kept at as best practice?",
    "opts": [
     "5°C or below",
     "15°C",
     "Room temperature"
    ],
    "a": 0,
    "fb": "5°C or below is best practice. The legal maximum for high-risk chilled food is 8°C."
   },
   {
    "q": "Hot food being held for service should be kept at or above which temperature?",
    "opts": [
     "37°C",
     "63°C",
     "20°C"
    ],
    "a": 1,
    "fb": "Hot-hold at 63°C or above. Below that, and above 8°C, food sits in the danger zone where bacteria multiply fastest."
   },
   {
    "q": "Which is the single most important food hygiene habit?",
    "opts": [
     "Wearing gloves",
     "Handwashing",
     "Using air freshener"
    ],
    "a": 1,
    "fb": "Handwashing. Your hands touch everything, so washing them properly breaks the chain that spreads bacteria to food."
   },
   {
    "q": "Which plaster should a food handler use to cover a cut?",
    "opts": [
     "Any plaster will do",
     "A blue detectable plaster",
     "No plaster is needed"
    ],
    "a": 1,
    "fb": "Blue detectable plasters are used so that if one falls off it can be seen in food and blue rarely occurs naturally in food."
   },
   {
    "q": "How many allergens must legally be declared in the UK?",
    "opts": [
     "7",
     "14",
     "20"
    ],
    "a": 1,
    "fb": "There are 14 legally declarable allergens, including milk, eggs, peanuts, tree nuts, gluten and sesame."
   },
   {
    "q": "Where should raw meat be stored in a fridge?",
    "opts": [
     "Above ready-to-eat food",
     "Below ready-to-eat food",
     "Next to salads"
    ],
    "a": 1,
    "fb": "Store raw meat below ready-to-eat food so nothing can drip down and cause cross-contamination."
   }
  ]
 },
 {
  "id": "c66",
  "title": "Food Safety & Hygiene (Level 2)",
  "cat": "Recommended",
  "cover": "shield",
  "category": "health",
  "pass": 80,
  "renewMonths": 12,
  "blurb": "The essential Level 2 Food Safety & Hygiene course built for UK holiday-camp and activity-club staff who run tuck shops, prepare snacks and packed lunches, or cook meals. Learn the law, the microbiology and the practical 4 Cs that keep children safe, using real camp-kitchen examples and the exact temperatures and timings inspectors expect. Complete it to understand your personal legal duty and how a simple daily diary proves you got it right.",
  "lessons": [
   {
    "id": "l1",
    "title": "Food Safety Law & Your Legal Duty",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "If you prepare, cook, handle or serve open food at a camp or club — the tuck shop, the snack table, packed lunches or a cooked lunch — the law treats you as a food handler. Your core duty is to produce food that is safe to eat and 'of the nature, substance and quality demanded' by the customer. That means it is what it claims to be, contains what it should, and won't make anyone ill."
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Your key legal duty",
      "t": "Under the Food Safety Act 1990 it is a criminal offence to sell or serve food that is injurious to health, unfit to eat, or not of the nature, substance and quality demanded — or to describe or label it falsely. Serving food you know could harm a child breaches this duty personally, not just for the business."
     },
     {
      "k": "points",
      "title": "The three legal pillars",
      "items": [
       "Food Safety Act 1990 — the umbrella offence framework (unsafe, unfit or wrongly described food).",
       "Regulation (EC) 852/2004 — the operational core: put in place, implement and maintain a permanent HACCP-based procedure; register 28 days before opening; train and supervise handlers 'commensurate with their work'.",
       "Food Safety and Hygiene (England) Regulations 2013 — enforces the EU rules here, sets penalties, enables improvement and hygiene emergency prohibition notices, and underpins the Food Hygiene Rating Scheme."
      ]
     },
     {
      "k": "text",
      "t": "Enforcement is by local-authority Environmental Health Officers (EHOs), who have powers of entry, inspection, sampling and closure. Handlers can be individually liable. The business's defence is 'due diligence' — proving it took all reasonable precautions — and that defence lives or dies on documented systems, temperature records and training logs. Good records protect you as well as the children."
     },
     {
      "k": "check",
      "q": "An EHO visits your camp kitchen unannounced. What underpins the business's 'due diligence' defence?",
      "opts": [
       "A verbal assurance from the manager that everything is fine",
       "Documented systems, temperature checks and staff training records",
       "The fact that no child has complained yet"
      ],
      "a": 1,
      "fb": "Due diligence must be evidenced. Written records — fridge and cooking temperatures, cleaning, deliveries and training — are what prove reasonable precautions were taken."
     }
    ]
   },
   {
    "id": "l2",
    "title": "Bacteria, Pathogens & Food Poisoning",
    "mins": 7,
    "blocks": [
     {
      "k": "text",
      "t": "Bacteria are the main cause of food poisoning. Most are harmless, but pathogens (the harmful ones) can make children seriously ill, sometimes from a tiny dose. You usually can't see, smell or taste them, so food that looks perfectly fine can still be dangerous."
     },
     {
      "k": "figure",
      "fig": "danger-zone"
     },
     {
      "k": "points",
      "title": "The pathogens to know — and where they hide",
      "items": [
       "Salmonella — poultry, eggs, raw meat.",
       "Campylobacter — the UK's most common cause; raw and undercooked chicken.",
       "E. coli O157 — undercooked mince/burgers, raw vegetables, cross-contamination; a very low infective dose and especially serious for children.",
       "Listeria — chilled ready-to-eat foods, pâté, soft cheese; grows even in the fridge.",
       "Clostridium perfringens — bulk-cooked and reheated meats, stews and gravies (very camp-relevant).",
       "Bacillus cereus — reheated or kept-warm rice.",
       "Staphylococcus aureus — from hands, skin and nose; produces a heat-stable toxin."
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Spores and toxins",
      "t": "Some bacteria form spores — a heat-resistant survival state that ordinary cooking does not always kill, which is why fast cooling and correct hot-holding matter. Some also produce toxins that are heat-stable: once a toxin has formed, you cannot 'cook safety back in'. Prevention, not reheating, is the answer."
     },
     {
      "k": "text",
      "t": "Bacteria multiply by binary fission — one cell splits into two — roughly doubling every 20 minutes in ideal conditions. Leave them a few hours in the warm and a handful becomes millions. They need the conditions summed up as FAT TOM: Food, Acidity (they like neutral, not acidic), Time, Temperature, Oxygen and Moisture. The simple version to remember at camp is warmth, moisture, food and time — remove any one and growth slows dramatically."
     },
     {
      "k": "points",
      "title": "High-risk foods (ready-to-eat, protein/moisture-rich, need refrigeration)",
      "items": [
       "Cooked meat and poultry",
       "Cooked rice and pasta",
       "Dairy and egg products",
       "Shellfish",
       "Gravies, stocks and sauces",
       "Prepared salads and sandwiches — squarely the camp lunch line"
      ]
     },
     {
      "k": "check",
      "q": "In ideal conditions, roughly how often can food-poisoning bacteria double in number?",
      "opts": [
       "Every 20 minutes",
       "Every 3 hours",
       "Once a day"
      ],
      "a": 0,
      "fb": "About every 20 minutes by binary fission. That's why leaving high-risk food in the danger zone for even a couple of hours is so risky."
     }
    ]
   },
   {
    "id": "l3",
    "title": "Cross-Contamination (The First C)",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Cross-contamination is the transfer of bacteria — or allergens — from a source onto ready-to-eat food. It's the single biggest cause of food-poisoning outbreaks and it's completely preventable. In a camp kitchen the classic slip is prepping raw chicken then buttering bread on the same board."
     },
     {
      "k": "figure",
      "fig": "allergens"
     },
     {
      "k": "points",
      "title": "Three ways it happens",
      "items": [
       "Direct — raw food touching cooked or ready-to-eat food (raw meat resting on a sandwich platter).",
       "Indirect — via hands, cloths, knives, boards, aprons or work surfaces.",
       "Drip — raw meat juices dripping down onto food stored below."
      ]
     },
     {
      "k": "steps",
      "title": "Keep raw and ready-to-eat apart",
      "items": [
       {
        "h": "Separate everywhere",
        "t": "Use different areas, boards and utensils for raw and for ready-to-eat prep and storage — or separate them clearly by time and thorough cleaning in between."
       },
       {
        "h": "Raw meat at the bottom",
        "t": "Always store raw meat and poultry in sealed containers at the bottom of the fridge so nothing can drip onto ready-to-eat food below."
       },
       {
        "h": "Wash hands between tasks",
        "t": "Wash and dry hands after touching raw food, before handling anything ready-to-eat."
       },
       {
        "h": "Use colour-coded boards and knives",
        "t": "Red = raw meat, blue = raw fish, yellow = cooked meat, green = salad and fruit, brown = vegetables, white = bakery and dairy."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Camp shortcut",
      "t": "Short on space or boards? Do all your ready-to-eat prep (sandwiches, salad, fruit) first on a clean surface, then move on to raw items — never the other way round — and clean and disinfect thoroughly before switching back."
     },
     {
      "k": "check",
      "q": "Which colour chopping board is for raw meat?",
      "opts": [
       "Green",
       "Red",
       "White"
      ],
      "a": 1,
      "fb": "Red is for raw meat. Blue = raw fish, yellow = cooked meat, green = salad/fruit, brown = vegetables, white = bakery/dairy."
     }
    ]
   },
   {
    "id": "l4",
    "title": "Cleaning & Disinfection (The Second C)",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Cleaning removes dirt, grease and food debris; disinfection destroys the bacteria left behind. You need both. The golden habit is 'clean as you go' — don't let dirty equipment and surfaces pile up during a busy snack service, because bacteria multiply on them and cross-contamination follows."
     },
     {
      "k": "steps",
      "title": "The six stages of cleaning",
      "items": [
       {
        "h": "1. Pre-clean",
        "t": "Remove loose food and debris; scrape and wipe."
       },
       {
        "h": "2. Main clean",
        "t": "Use hot water and detergent to loosen and lift grease and dirt."
       },
       {
        "h": "3. Rinse",
        "t": "Rinse off the loosened dirt and detergent."
       },
       {
        "h": "4. Disinfection",
        "t": "Apply heat or a suitable chemical disinfectant to destroy remaining bacteria."
       },
       {
        "h": "5. Final rinse",
        "t": "Rinse away chemical residues where the product requires it."
       },
       {
        "h": "6. Drying",
        "t": "Air-dry wherever possible — cloths can re-contaminate a clean surface."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Watch the contact time",
      "t": "Disinfectant does not work instantly. Follow the label's contact or 'dwell' time (look for a product meeting BS EN 1276). Wiping it straight off leaves live bacteria behind."
     },
     {
      "k": "points",
      "title": "Two-stage cleaning for food-contact surfaces",
      "items": [
       "Stage one: clean with detergent to remove visible dirt and grease.",
       "Stage two: apply disinfectant (or a sanitiser) and leave for the stated contact time.",
       "Use clean cloths or disposable paper; keep separate cloths for raw and ready-to-eat areas.",
       "Store cleaning chemicals away from food and clearly labelled."
      ]
     },
     {
      "k": "check",
      "q": "You've sprayed sanitiser on the sandwich-prep table. What should you do next?",
      "opts": [
       "Wipe it straight off so it's dry for the next batch",
       "Leave it for the contact time stated on the label, then dry",
       "Rinse it immediately with cold water"
      ],
      "a": 1,
      "fb": "Disinfectants need their stated contact (dwell) time to kill bacteria. Wiping it off too soon means the surface isn't actually disinfected."
     }
    ]
   },
   {
    "id": "l5",
    "title": "Chilling & Cold Storage (The Third C)",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Keeping high-risk food cold slows bacteria to a crawl. Your fridge should run at 5°C or below. The legal maximum is 8°C, but aiming for 5°C gives you a safety margin for door openings on a hot day at camp."
     },
     {
      "k": "points",
      "title": "The chilling rules",
      "items": [
       "Fridge at 5°C or below (legal maximum 8°C).",
       "The danger zone is 8°C to 63°C — where bacteria multiply fastest.",
       "Cool hot food quickly: aim to get it below 8°C within 90 minutes.",
       "Defrost thoroughly in the fridge, not at room temperature (unless the pack says cook from frozen).",
       "Chilled food out of the fridge for service should be used within 4 hours, then discarded."
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Use-by is the law",
      "t": "'Use-by' is about safety: never use or serve food after its use-by date, and it is illegal to sell it. 'Best-before' is only about quality — food may be legal and safe after it, though not at its best. On packed lunches, always check use-by dates first."
     },
     {
      "k": "steps",
      "title": "Cooling leftover hot food safely",
      "items": [
       {
        "h": "Divide it up",
        "t": "Split large batches (stews, bulk pasta, rice) into smaller, shallower portions so they cool faster."
       },
       {
        "h": "Speed it along",
        "t": "Stand containers in cold or iced water, or use a blast chiller if you have one."
       },
       {
        "h": "Beat the 90 minutes",
        "t": "Get the food below 8°C within 90 minutes of cooking."
       },
       {
        "h": "Cover and store",
        "t": "Cover, label with the date and put it in the fridge — never leave it cooling in the danger zone overnight."
       }
      ]
     },
     {
      "k": "check",
      "q": "Cooked pasta from lunch needs saving. Within how long should it be cooled to below 8°C?",
      "opts": [
       "Within 90 minutes",
       "Any time before the end of the day",
       "Within 6 hours"
      ],
      "a": 0,
      "fb": "Aim to cool hot food to below 8°C within 90 minutes, dividing it into smaller portions to speed cooling out of the danger zone."
     }
    ]
   },
   {
    "id": "l6",
    "title": "Cooking, Reheating & Hot-Holding (The Fourth C)",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "Thorough cooking destroys most food-poisoning bacteria. The standard safe target is a core temperature of 75°C for 30 seconds — measured in the thickest part or centre, where heat arrives last. Always use a clean, disinfected probe thermometer; you cannot judge core temperature by colour alone."
     },
     {
      "k": "points",
      "title": "Equivalent time–temperature combinations",
      "items": [
       "80°C for 6 seconds",
       "75°C for 30 seconds",
       "70°C for 2 minutes",
       "65°C for 10 minutes",
       "60°C for 45 minutes"
      ]
     },
     {
      "k": "callout",
      "tone": "warn",
      "title": "Reheating and hot-holding",
      "t": "Reheat food only once, and to 75°C throughout (82°C in Scotland). Hot-hold food above 63°C. Cook higher-risk items — mince, burgers, sausages, poultry, rolled joints and liver — right the way through, as harmful bacteria can be spread throughout the meat, not just on the surface."
     },
     {
      "k": "steps",
      "title": "Using a probe correctly",
      "items": [
       {
        "h": "Clean and disinfect",
        "t": "Wipe the probe with a disinfectant wipe before and after each use to avoid cross-contamination."
       },
       {
        "h": "Aim for the centre",
        "t": "Insert into the thickest part or centre of the food, not touching bone or the tray."
       },
       {
        "h": "Read and record",
        "t": "Wait for a stable reading of 75°C (or an equivalent), then log it in your diary."
       },
       {
        "h": "Take corrective action",
        "t": "If it's under temperature, keep cooking and check again before serving."
       }
      ]
     },
     {
      "k": "check",
      "q": "What is the standard safe core temperature and time for cooked food?",
      "opts": [
       "63°C for 30 seconds",
       "75°C for 30 seconds",
       "50°C for 2 minutes"
      ],
      "a": 1,
      "fb": "75°C for 30 seconds at the core is the standard. Equivalents include 70°C for 2 minutes or 80°C for 6 seconds. Hot-hold above 63°C."
     }
    ]
   },
   {
    "id": "l7",
    "title": "Personal Hygiene & Fitness to Work",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "You are the biggest potential source of contamination in the kitchen. Good personal hygiene — clean hands, clean clothing and staying home when ill — protects every child you serve. This matters even more at camp, where staff move between messy activities and the food table."
     },
     {
      "k": "figure",
      "fig": "handwash"
     },
     {
      "k": "steps",
      "title": "Wash hands thoroughly — when?",
      "items": [
       {
        "h": "Before handling food",
        "t": "And before starting any food task after doing something else."
       },
       {
        "h": "After the toilet",
        "t": "Always, without exception."
       },
       {
        "h": "After raw food or waste",
        "t": "After touching raw meat, poultry, eggs or handling bins and rubbish."
       },
       {
        "h": "After breaks",
        "t": "After eating, drinking, smoking or vaping, and after touching your face, hair or a phone."
       }
      ]
     },
     {
      "k": "points",
      "title": "Personal hygiene dos and don'ts",
      "items": [
       "Wear clean protective overclothing and tie back or cover hair.",
       "Cover any cut or graze with a blue detectable plaster.",
       "No jewellery, no nail varnish or false nails.",
       "No eating, smoking or vaping in food areas.",
       "Never cough or sneeze over food; turn away and wash your hands."
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Fitness to work: the 48-hour rule",
      "t": "Anyone with diarrhoea and/or vomiting must report it and stay away from food handling. They must be excluded until 48 hours symptom-free. Infected skin lesions (like weeping cuts or boils) and certain illnesses must also be reported to management — this is a legal expectation, not a discretion."
     },
     {
      "k": "check",
      "q": "A kitchen helper was sick this morning but feels 'a bit better' now. When can they return to handling food?",
      "opts": [
       "As soon as they feel able to work",
       "Once they have been free of symptoms for 48 hours",
       "After they've washed their hands well"
      ],
      "a": 1,
      "fb": "They must stay off food handling until 48 hours completely symptom-free. Feeling better isn't enough — they can still be carrying and spreading the bug."
     }
    ]
   },
   {
    "id": "l8",
    "title": "Allergens & Natasha's Law",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "For some children an allergen isn't discomfort — it's life-threatening. Take every allergy request seriously, give accurate information, and prevent allergen cross-contact just as carefully as you prevent bacteria. If you're unsure what's in a dish, say so and check; never guess."
     },
     {
      "k": "points",
      "title": "The 14 named allergens",
      "items": [
       "Celery, cereals containing gluten, crustaceans, eggs, fish, lupin, milk.",
       "Molluscs, mustard, peanuts, sesame, soya, sulphur dioxide/sulphites, tree nuts."
      ]
     },
     {
      "k": "callout",
      "tone": "law",
      "title": "Natasha's Law (October 2021)",
      "t": "Food that is prepacked for direct sale (PPDS) — made and packed on the same site before a customer orders it — must carry a full ingredients list with the allergens emphasised. This directly covers camp packed lunches and snacks that you box up on site in advance."
     },
     {
      "k": "steps",
      "title": "Handling an allergy request",
      "items": [
       {
        "h": "Listen and take it seriously",
        "t": "Ask exactly what the child must avoid; treat it as potentially life-threatening."
       },
       {
        "h": "Check the facts",
        "t": "Read ingredient lists and labels; check recipe notes — don't rely on memory or appearance."
       },
       {
        "h": "Prevent cross-contact",
        "t": "Use clean equipment, boards and surfaces; wash hands; keep the allergen-free portion separate."
       },
       {
        "h": "Communicate clearly",
        "t": "Tell colleagues, label the meal, and confirm with the parent or child before serving."
       }
      ]
     },
     {
      "k": "check",
      "q": "You box up sandwiches on site in the morning for the afternoon trip. Under Natasha's Law these must show what?",
      "opts": [
       "Only a 'may contain nuts' sticker",
       "A full ingredients list with allergens emphasised",
       "Nothing, as they're not being sold in a shop"
      ],
      "a": 1,
      "fb": "Prepacked-for-direct-sale (PPDS) food needs a full ingredients list with the 14 allergens emphasised — exactly the case for lunches boxed on site in advance."
     }
    ]
   },
   {
    "id": "l9",
    "title": "Pests, Premises, Waste & Your Safety System",
    "mins": 6,
    "blocks": [
     {
      "k": "text",
      "t": "A safe kitchen also means a well-run, well-maintained space with no pests, controlled waste, and a written system that proves you do the right things every day. At camp this includes marquees, outdoor prep areas and temporary kitchens — all need the same standards."
     },
     {
      "k": "figure",
      "fig": "4cs"
     },
     {
      "k": "points",
      "title": "Pests, waste and premises",
      "items": [
       "Signs of pests: droppings, gnaw marks, nests, greasy smears; report to management immediately.",
       "Proof the building and remove harbourage — no gaps, no clutter, no food left out.",
       "Keep waste covered, removed regularly, and bins clean with lids closed.",
       "Premises need cleanable surfaces, hot water and handwash basins, good lighting and ventilation.",
       "No pets in food areas; keep equipment maintained and in good working order."
      ]
     },
     {
      "k": "steps",
      "title": "HACCP — the 7 principles behind your system",
      "items": [
       {
        "h": "1. Identify hazards",
        "t": "Work out what could go wrong (bacteria, allergens, foreign objects)."
       },
       {
        "h": "2. Critical control points",
        "t": "Find the steps where control is essential — cooking, chilling."
       },
       {
        "h": "3. Set critical limits",
        "t": "Define the target, e.g. 75°C core or a fridge at 5°C."
       },
       {
        "h": "4. Monitor",
        "t": "Check the control points — probe temperatures, fridge readings."
       },
       {
        "h": "5. Corrective action",
        "t": "Fix it when a limit is missed (cook longer, discard unsafe food)."
       },
       {
        "h": "6. Verify",
        "t": "Check the system is working — calibrate probes, review records."
       },
       {
        "h": "7. Document",
        "t": "Keep records as proof and for due diligence."
       }
      ]
     },
     {
      "k": "callout",
      "tone": "tip",
      "title": "Safer Food, Better Business (SFBB)",
      "t": "For small caterers the FSA's SFBB pack turns HACCP into practical 'Safe Methods' pages for the 4 Cs plus management, and a daily diary to record opening and closing checks, fridge and cooking temperatures, deliveries, cleaning and any problems. That diary is your evidence trail — it supports due diligence and a good hygiene rating."
     },
     {
      "k": "check",
      "q": "What is the main purpose of completing the SFBB daily diary?",
      "opts": [
       "It's optional paperwork with no real value",
       "It records checks and problems as proof, supporting due diligence and your hygiene rating",
       "It replaces the need to actually cook food properly"
      ],
      "a": 1,
      "fb": "The diary records opening/closing checks, temperatures, deliveries and problems. It's your documented evidence trail — key to due diligence and a good Food Hygiene Rating."
     }
    ]
   }
  ],
  "quiz": [
   {
    "q": "Which law makes it an offence to serve food that is unsafe or not of the nature, substance and quality demanded?",
    "opts": [
     "Food Safety Act 1990",
     "Health and Safety at Work Act 1974",
     "Data Protection Act 2018"
    ],
    "a": 0,
    "fb": "The Food Safety Act 1990 is the umbrella offence framework covering unsafe, unfit or wrongly described food."
   },
   {
    "q": "What is the UK's most common cause of bacterial food poisoning, linked to raw and undercooked chicken?",
    "opts": [
     "Listeria",
     "Campylobacter",
     "Bacillus cereus"
    ],
    "a": 1,
    "fb": "Campylobacter is the most common cause in the UK, associated with raw and undercooked poultry."
   },
   {
    "q": "At what temperature should a fridge holding high-risk food be kept?",
    "opts": [
     "5°C or below",
     "12°C or below",
     "Room temperature"
    ],
    "a": 0,
    "fb": "Aim for 5°C or below. The legal maximum is 8°C, but 5°C gives a safety margin."
   },
   {
    "q": "The temperature 'danger zone' — where bacteria multiply fastest — is:",
    "opts": [
     "0°C to 5°C",
     "8°C to 63°C",
     "75°C to 100°C"
    ],
    "a": 1,
    "fb": "8°C to 63°C is the danger zone. Keep food below or above it, not sitting within it."
   },
   {
    "q": "What core temperature and time is the standard for safely cooked food?",
    "opts": [
     "75°C for 30 seconds",
     "63°C for 30 seconds",
     "70°C for 30 seconds"
    ],
    "a": 0,
    "fb": "75°C for 30 seconds at the core, or an equivalent such as 70°C for 2 minutes."
   },
   {
    "q": "Reheated food should be reheated how many times, and to what temperature (in England)?",
    "opts": [
     "Twice, to 63°C",
     "Only once, to 75°C throughout",
     "As many times as needed, to 60°C"
    ],
    "a": 1,
    "fb": "Reheat only once and to 75°C throughout (82°C in Scotland). Hot-hold above 63°C."
   },
   {
    "q": "A staff member had diarrhoea last night. When can they safely return to handling food?",
    "opts": [
     "Immediately, if they feel okay",
     "After 48 hours completely symptom-free",
     "After a good handwash"
    ],
    "a": 1,
    "fb": "They must be excluded from food handling until 48 hours symptom-free."
   },
   {
    "q": "How many named food allergens must be declared under UK law?",
    "opts": [
     "10",
     "14",
     "20"
    ],
    "a": 1,
    "fb": "There are 14 named allergens, including peanuts, tree nuts, milk, eggs, fish, sesame and cereals containing gluten."
   },
   {
    "q": "Sandwiches boxed on site in the morning for an afternoon trip must, under Natasha's Law, carry:",
    "opts": [
     "Nothing extra",
     "A full ingredients list with allergens emphasised",
     "Just the date"
    ],
    "a": 1,
    "fb": "Prepacked-for-direct-sale (PPDS) food needs a full ingredients list with allergens emphasised."
   },
   {
    "q": "What is the purpose of the FSA's Safer Food, Better Business diary?",
    "opts": [
     "To record daily checks and problems as documented evidence",
     "To advertise the menu to parents",
     "To replace staff training"
    ],
    "a": 0,
    "fb": "The SFBB diary records checks, temperatures, deliveries and problems — the evidence trail supporting due diligence and your hygiene rating."
   }
  ]
 }
];
export const NEW_COURSE_VIDEOS: Record<string, { intro?: NVBlock; mid?: NVBlock }> = {
 "c41": {
  "intro": {
   "k": "motion",
   "title": "What COSHH means for our camp",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 4.8,
     "narration": "COSHH — keeping hazardous substances from harming our camp team.",
     "keys": [
      "COSHH",
      "hazardous substances"
     ],
     "props": {
      "icon": "shield"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Every cleaning spray, sanitiser and glue tin can be hazardous to health.",
     "keys": [
      "cleaning spray",
      "hazardous to health"
     ],
     "props": {
      "icon": "droplet"
     }
    },
    {
     "id": "v2",
     "visual": "gcards",
     "seconds": 5.2,
     "narration": "Substances reach us by breathing in, skin contact or swallowing.",
     "keys": [
      "breathing in",
      "skin contact",
      "swallowing"
     ],
     "props": {
      "icons": [
       "lungs",
       "hand",
       "food"
      ],
      "items": [
       "Breathing in",
       "Skin contact",
       "Swallowing"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "galert",
     "seconds": 5.6,
     "narration": "Children's smaller lungs and busy hands make control even more important.",
     "keys": [
      "smaller lungs",
      "control"
     ],
     "props": {
      "icon": "child"
     }
    },
    {
     "id": "v4",
     "visual": "gstat",
     "seconds": 4.8,
     "narration": "The 2002 COSHH Regulations set the standard we follow.",
     "keys": [
      "2002",
      "COSHH Regulations"
     ],
     "props": {
      "value": "2002",
      "sub": "COSHH Regulations"
     }
    },
    {
     "id": "v5",
     "visual": "gspot",
     "seconds": 5.6,
     "narration": "Read the label, read the safety data sheet, then work safely.",
     "keys": [
      "label",
      "safety data sheet",
      "work safely"
     ],
     "props": {
      "icon": "document"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 4.3,
     "narration": "Small habits keep every child and colleague safe.",
     "keys": [
      "Small habits",
      "safe"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "Reading labels and staying in control",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 4.3,
     "narration": "Labels, data sheets and controls — your COSHH toolkit.",
     "keys": [
      "Labels",
      "controls",
      "COSHH toolkit"
     ],
     "props": {
      "icon": "clipboard"
     }
    },
    {
     "id": "v1",
     "visual": "gcards",
     "seconds": 5.2,
     "narration": "Red diamond pictograms warn: corrosive, flammable, toxic and health hazards.",
     "keys": [
      "corrosive",
      "flammable",
      "toxic",
      "health hazards"
     ],
     "props": {
      "icons": [
       "droplet",
       "flame",
       "alert",
       "lungs"
      ],
      "items": [
       "Corrosive",
       "Flammable",
       "Toxic",
       "Health hazard"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gspot",
     "seconds": 4.8,
     "narration": "The red diamond means read before you use it.",
     "keys": [
      "red diamond",
      "read before you use"
     ],
     "props": {
      "icon": "eye"
     }
    },
    {
     "id": "v3",
     "visual": "gsteps",
     "seconds": 5.6,
     "narration": "Safety data sheets tell you hazards, handling, storage and first aid.",
     "keys": [
      "hazards",
      "handling",
      "storage",
      "first aid"
     ],
     "props": {
      "items": [
       "Hazards",
       "Handling & storage",
       "First aid"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gsteps",
     "seconds": 5.2,
     "narration": "Control exposure: eliminate first, then controls at source, PPE last.",
     "keys": [
      "eliminate first",
      "source",
      "PPE last"
     ],
     "props": {
      "items": [
       "Eliminate or swap",
       "Controls at source",
       "PPE last"
      ]
     }
    },
    {
     "id": "v5",
     "visual": "galert",
     "seconds": 4.8,
     "narration": "Never decant chemicals into unlabelled cups or drinks bottles.",
     "keys": [
      "Never decant",
      "unlabelled"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 4.8,
     "narration": "Label it, control it, and everyone goes home well.",
     "keys": [
      "Label it",
      "control it",
      "home well"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  }
 },
 "c42": {
  "intro": {
   "k": "motion",
   "title": "Display Screen Equipment: comfort, safety and the law",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Display Screen Equipment: staying comfortable, safe and legal at your club.",
     "keys": [
      "Display Screen Equipment",
      "comfortable",
      "safe",
      "legal"
     ],
     "props": {
      "icon": "eye"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 6,
     "narration": "DSE means any screen you work at: monitors, laptops, tablets and phones.",
     "keys": [
      "DSE",
      "screen",
      "monitors, laptops, tablets and phones"
     ],
     "props": {
      "icon": "phone"
     }
    },
    {
     "id": "v2",
     "visual": "gcards",
     "seconds": 5,
     "narration": "You use it for registers, bookings, rotas and safeguarding logs.",
     "keys": [
      "registers",
      "bookings",
      "rotas",
      "safeguarding logs"
     ],
     "props": {
      "icons": [
       "clipboard",
       "document",
       "clock",
       "lock"
      ],
      "items": [
       "Registers",
       "Bookings",
       "Rotas",
       "Safeguarding logs"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "galert",
     "seconds": 6,
     "narration": "Hours at a badly set-up screen strain necks, backs, wrists and eyes.",
     "keys": [
      "badly set-up",
      "strain",
      "necks, backs, wrists and eyes"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v4",
     "visual": "gstat",
     "seconds": 6,
     "narration": "You become a DSE user after an hour or more of daily screen work.",
     "keys": [
      "DSE user",
      "an hour or more",
      "daily"
     ],
     "props": {
      "value": "1 hour+",
      "sub": "makes you a DSE 'user'"
     }
    },
    {
     "id": "v5",
     "visual": "gquote",
     "seconds": 6,
     "narration": "The Display Screen Equipment Regulations 1992 set the standard we follow.",
     "keys": [
      "Display Screen Equipment Regulations 1992",
      "standard",
      "we follow"
     ],
     "props": {
      "icon": "book"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5,
     "narration": "Small, simple adjustments keep you working comfortably all season.",
     "keys": [
      "Small, simple adjustments",
      "comfortably",
      "all season"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "Set up right, take breaks, protect your eyes",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Set up your workstation, take breaks and look after your eyes.",
     "keys": [
      "Set up",
      "workstation",
      "take breaks",
      "look after your eyes"
     ],
     "props": {
      "icon": "clipboard"
     }
    },
    {
     "id": "v1",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "Screen at eye level, arms flat, feet supported, back against the chair.",
     "keys": [
      "eye level",
      "arms flat",
      "feet supported",
      "back"
     ],
     "props": {
      "items": [
       "Screen at eye level",
       "Forearms flat",
       "Feet flat or on a footrest",
       "Lower back supported"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gcompare",
     "seconds": 6,
     "narration": "Good setup: relaxed shoulders. Bad setup: hunching over a low laptop.",
     "keys": [
      "relaxed shoulders",
      "hunching",
      "low laptop"
     ],
     "props": {
      "good": [
       "Relaxed shoulders",
       "Screen at arm's length",
       "Wrists straight"
      ],
      "bad": [
       "Hunched shoulders",
       "Screen too low",
       "Bent wrists"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gcheck",
     "seconds": 6,
     "narration": "Take short breaks often: five to ten minutes every hour beats marathons.",
     "keys": [
      "short breaks",
      "five to ten minutes",
      "every hour"
     ],
     "props": {
      "items": [
       "Stand and stretch",
       "Look away from the screen",
       "Change task for a few minutes"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gstat",
     "seconds": 5,
     "narration": "Ask for an eye test and we pay for it.",
     "keys": [
      "eye test",
      "we pay"
     ],
     "props": {
      "value": "Eye test",
      "sub": "paid by us on request"
     }
    },
    {
     "id": "v5",
     "visual": "galert",
     "seconds": 6,
     "narration": "Aches, sore eyes or headaches? Tell your manager and adjust your setup.",
     "keys": [
      "Aches, sore eyes or headaches",
      "Tell your manager",
      "adjust your setup"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5,
     "narration": "Comfortable staff run better sessions. Set up, break, and thrive.",
     "keys": [
      "Comfortable staff",
      "better sessions",
      "thrive"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  }
 },
 "c43": {
  "intro": {
   "k": "motion",
   "title": "Why slips, trips and falls matter",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Slips, trips and falls: the most common cause of injury at work.",
     "keys": [
      "Slips, trips and falls",
      "most common cause"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v1",
     "visual": "gstat",
     "seconds": 6,
     "narration": "Slips and trips cause about thirty percent of all workplace injuries reported to the HSE.",
     "keys": [
      "thirty percent",
      "workplace injuries",
      "HSE"
     ],
     "props": {
      "value": "30%",
      "sub": "of injuries at work"
     }
    },
    {
     "id": "v2",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Most happen on wet or contaminated floors — a spilled drink, a freshly mopped hall.",
     "keys": [
      "wet or contaminated floors",
      "spilled drink",
      "freshly mopped hall"
     ],
     "props": {
      "icon": "droplet"
     }
    },
    {
     "id": "v3",
     "visual": "gcards",
     "seconds": 6,
     "narration": "The big causes: spillages, trailing cables, and cluttered walkways around the camp.",
     "keys": [
      "spillages",
      "trailing cables",
      "cluttered walkways"
     ],
     "props": {
      "icons": [
       "droplet",
       "alert",
       "box"
      ],
      "items": [
       "Spillages",
       "Trailing cables",
       "Cluttered walkways"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "galert",
     "seconds": 6,
     "narration": "One fall can mean broken bones, weeks off work, and a session shut down.",
     "keys": [
      "broken bones",
      "weeks off work",
      "shut down"
     ],
     "props": {
      "icon": "cross"
     }
    },
    {
     "id": "v5",
     "visual": "gcheck",
     "seconds": 5,
     "narration": "Good news: nearly every slip or trip is predictable and preventable.",
     "keys": [
      "predictable and preventable"
     ],
     "props": {
      "items": [
       "Spot the hazard early",
       "Deal with it fast",
       "Keep walkways clear"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Learn to spot and stop hazards before anyone hits the floor.",
     "keys": [
      "spot and stop hazards"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "Clean up and clear the way",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Housekeeping and spillages: your two best defences against slips and trips.",
     "keys": [
      "Housekeeping and spillages",
      "slips and trips"
     ],
     "props": {
      "icon": "droplet"
     }
    },
    {
     "id": "v1",
     "visual": "gsteps",
     "seconds": 7,
     "narration": "See a spill? Guard it, sign it, clean it, and dry it fully.",
     "keys": [
      "Guard it",
      "sign it",
      "clean it",
      "dry it"
     ],
     "props": {
      "items": [
       "Guard the spill so no one walks through",
       "Put out a wet-floor sign",
       "Clean and dry the area",
       "Take the sign away only when dry"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gcompare",
     "seconds": 6,
     "narration": "Good: cables taped down, bags stowed. Bad: kit dumped across the corridor.",
     "keys": [
      "cables taped down",
      "kit dumped across the corridor"
     ],
     "props": {
      "good": [
       "Cables taped down",
       "Bags stowed away"
      ],
      "bad": [
       "Kit dumped in walkways",
       "Boxes blocking exits"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Wet shoes and rainy days turn a smooth hall into a skating rink.",
     "keys": [
      "Wet shoes",
      "rainy days",
      "skating rink"
     ],
     "props": {
      "icon": "droplet"
     }
    },
    {
     "id": "v4",
     "visual": "gcards",
     "seconds": 6,
     "narration": "Check three things: the floor, the footwear, and the lighting on every route.",
     "keys": [
      "the floor",
      "the footwear",
      "the lighting"
     ],
     "props": {
      "icons": [
       "tick",
       "shield",
       "sun"
      ],
      "items": [
       "Floor",
       "Footwear",
       "Lighting"
      ]
     }
    },
    {
     "id": "v5",
     "visual": "gcheck",
     "seconds": 6,
     "narration": "Report anything you cannot fix yourself, and log it straight away.",
     "keys": [
      "Report anything",
      "log it"
     ],
     "props": {
      "items": [
       "Fix small hazards yourself",
       "Report the bigger ones",
       "Log every spill and near miss"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "A tidy site is a safe site — everyone owns the floor.",
     "keys": [
      "tidy site",
      "safe site"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  }
 },
 "c44": {
  "intro": {
   "k": "motion",
   "title": "PPE: Your Last Line of Defence",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5,
     "narration": "Personal protective equipment: your last line of defence at camp.",
     "keys": [
      "Personal protective equipment",
      "last line of defence"
     ],
     "props": {
      "icon": "shield"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 6,
     "narration": "PPE comes last, only after we've removed or reduced the hazard.",
     "keys": [
      "PPE comes last",
      "removed or reduced the hazard"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v2",
     "visual": "gcards",
     "seconds": 6,
     "narration": "Gloves, aprons, eye protection and high-vis keep staff and children safe.",
     "keys": [
      "Gloves, aprons",
      "eye protection",
      "high-vis"
     ],
     "props": {
      "icons": [
       "hand",
       "eye",
       "people"
      ],
      "items": [
       "Gloves & aprons",
       "Eye protection",
       "High-vis vests"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gstat",
     "seconds": 6,
     "narration": "The law changed in 2022, extending PPE rights to casual workers too.",
     "keys": [
      "law changed in 2022",
      "casual workers"
     ],
     "props": {
      "value": "2022",
      "sub": "PPE duties extended to all workers"
     }
    },
    {
     "id": "v4",
     "visual": "galert",
     "seconds": 6,
     "narration": "Skip PPE and a splash or spill can cause real, avoidable harm.",
     "keys": [
      "Skip PPE",
      "real, avoidable harm"
     ],
     "props": {
      "icon": "droplet"
     }
    },
    {
     "id": "v5",
     "visual": "gcheck",
     "seconds": 6,
     "narration": "Your employer provides PPE free, in your size, and keeps it stocked.",
     "keys": [
      "provides PPE free",
      "your size",
      "stocked"
     ],
     "props": {
      "items": [
       "Provided free of charge",
       "Fitted to you",
       "Kept clean and stocked"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Wear it, check it, report faults — protection only works when used.",
     "keys": [
      "Wear it, check it",
      "protection only works when used"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "Using PPE Well, Every Time",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Using PPE well takes seconds and protects everyone at your club.",
     "keys": [
      "Using PPE well",
      "protects everyone"
     ],
     "props": {
      "icon": "hand"
     }
    },
    {
     "id": "v1",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "Clean hands, glove up, do the task, then peel gloves off safely.",
     "keys": [
      "Clean hands",
      "glove up",
      "peel gloves off safely"
     ],
     "props": {
      "items": [
       "Wash your hands",
       "Put gloves on",
       "Peel off inside-out"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "galert",
     "seconds": 6,
     "narration": "Disposable gloves and aprons are single-use — never wash and reuse them.",
     "keys": [
      "Disposable gloves",
      "single-use",
      "never wash and reuse"
     ],
     "props": {
      "icon": "cross"
     }
    },
    {
     "id": "v3",
     "visual": "gcompare",
     "seconds": 5,
     "narration": "Right glove, right size, right job beats grabbing whatever's nearest.",
     "keys": [
      "Right glove",
      "beats grabbing whatever's nearest"
     ],
     "props": {
      "good": [
       "Right size for the task",
       "Checked before use"
      ],
      "bad": [
       "Torn or damaged",
       "Grabbing any spare"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gcheck",
     "seconds": 6,
     "narration": "Store PPE clean and dry, away from sunlight, ready for next time.",
     "keys": [
      "Store PPE",
      "clean and dry",
      "away from sunlight"
     ],
     "props": {
      "items": [
       "Clean and dry",
       "Out of sunlight",
       "Ready to grab"
      ]
     }
    },
    {
     "id": "v5",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Spot a split glove or missing kit? Tell your manager straight away.",
     "keys": [
      "split glove",
      "Tell your manager straight away"
     ],
     "props": {
      "icon": "bell"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Good PPE habits keep you, your colleagues and every child protected.",
     "keys": [
      "Good PPE habits",
      "every child protected"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  }
 },
 "c45": {
  "intro": {
   "k": "motion",
   "title": "Electrical Safety at Camp",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Welcome to Electrical Safety and PAT for holiday camps and activity clubs.",
     "keys": [
      "Electrical Safety and PAT",
      "holiday camps"
     ],
     "props": {
      "icon": "shield-tick"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Faulty leads and plugs can cause shocks, burns and fires at your club.",
     "keys": [
      "Faulty leads and plugs",
      "shocks, burns and fires"
     ],
     "props": {
      "icon": "flame"
     }
    },
    {
     "id": "v2",
     "visual": "gstat",
     "seconds": 6,
     "narration": "Around ninety percent of faults are found simply by looking, before any tester.",
     "keys": [
      "ninety percent",
      "by looking"
     ],
     "props": {
      "value": "90%",
      "sub": "of faults found by looking"
     }
    },
    {
     "id": "v3",
     "visual": "gcards",
     "seconds": 6,
     "narration": "Kettles, laptops, speakers and extension leads are all portable appliances we must maintain.",
     "keys": [
      "Kettles, laptops",
      "portable appliances"
     ],
     "props": {
      "icons": [
       "food",
       "box",
       "wave",
       "lift"
      ],
      "items": [
       "Kettles",
       "Laptops",
       "Speakers",
       "Extension leads"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "galert",
     "seconds": 7,
     "narration": "One frayed cable near a paddling pool or wet field is a real danger.",
     "keys": [
      "frayed cable",
      "wet field",
      "real danger"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v5",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "We protect children with three simple layers: user checks, visual inspection and testing.",
     "keys": [
      "three simple layers",
      "user checks",
      "testing"
     ],
     "props": {
      "items": [
       "User checks",
       "Visual inspection",
       "PAT testing"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Let's learn to keep every child, coach and appliance safe this season.",
     "keys": [
      "every child",
      "appliance safe"
     ],
     "props": {
      "icon": "shield"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "Spot It Before You Plug It In",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5,
     "narration": "Spotting a dangerous appliance before you plug it in.",
     "keys": [
      "dangerous appliance",
      "plug it in"
     ],
     "props": {
      "icon": "eye"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Always switch off and unplug an appliance before you check it over.",
     "keys": [
      "switch off and unplug",
      "before you check"
     ],
     "props": {
      "icon": "hand"
     }
    },
    {
     "id": "v2",
     "visual": "gcheck",
     "seconds": 6,
     "narration": "Look for cuts on the cable, a cracked plug, and burn marks.",
     "keys": [
      "cuts on the cable",
      "cracked plug",
      "burn marks"
     ],
     "props": {
      "items": [
       "Cuts or fraying on the cable",
       "Cracked or scorched plug",
       "Burn marks or a hot smell"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "galert",
     "seconds": 6,
     "narration": "Bent pins, taped-up joints and a melted casing all mean stop now.",
     "keys": [
      "Bent pins",
      "taped-up joints",
      "stop now"
     ],
     "props": {
      "icon": "flame"
     }
    },
    {
     "id": "v4",
     "visual": "gcompare",
     "seconds": 6,
     "narration": "Compare a safe set-up with an overloaded block and a trailing lead.",
     "keys": [
      "safe set-up",
      "overloaded block",
      "trailing lead"
     ],
     "props": {
      "good": [
       "Cable clipped safely away",
       "Undamaged moulded plug",
       "Correct fuse fitted"
      ],
      "bad": [
       "Lead trailing across a doorway",
       "Cracked, taped-up casing",
       "Overloaded extension block"
      ]
     }
    },
    {
     "id": "v5",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "Found a fault? Remove it, label it, and tell your manager straight away.",
     "keys": [
      "Remove it, label it",
      "tell your manager"
     ],
     "props": {
      "items": [
       "Remove from use",
       "Label 'Do not use'",
       "Report to your manager"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "A ten-second check keeps your camp safe and your inspection clean.",
     "keys": [
      "ten-second check",
      "camp safe"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  }
 },
 "c46": {
  "intro": {
   "k": "motion",
   "title": "Legionella and water hygiene: the basics",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Welcome to Legionella and Water Hygiene, built on HSE guidance L8.",
     "keys": [
      "Legionella and Water Hygiene",
      "HSE guidance",
      "L8"
     ],
     "props": {
      "icon": "droplet"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Legionella bacteria live naturally in water and can make people seriously ill.",
     "keys": [
      "Legionella bacteria",
      "seriously ill"
     ],
     "props": {
      "icon": "germ"
     }
    },
    {
     "id": "v2",
     "visual": "gstat",
     "seconds": 5,
     "narration": "Legionella thrives in stagnant water between twenty and forty-five degrees.",
     "keys": [
      "stagnant water",
      "twenty and forty-five"
     ],
     "props": {
      "value": "20–45°C",
      "sub": "the danger zone where legionella multiplies"
     }
    },
    {
     "id": "v3",
     "visual": "galert",
     "seconds": 6,
     "narration": "Breathing in tiny contaminated water droplets can cause Legionnaires' disease, a lung infection.",
     "keys": [
      "contaminated water droplets",
      "Legionnaires' disease",
      "lung infection"
     ],
     "props": {
      "icon": "lungs"
     }
    },
    {
     "id": "v4",
     "visual": "gcards",
     "seconds": 6,
     "narration": "Risk hides in showers, taps, spray hoses and stored water tanks.",
     "keys": [
      "showers",
      "spray hoses",
      "water tanks"
     ],
     "props": {
      "icons": [
       "droplet",
       "droplet",
       "wave",
       "box"
      ],
      "items": [
       "Showers",
       "Taps",
       "Spray hoses",
       "Water tanks"
      ]
     }
    },
    {
     "id": "v5",
     "visual": "gcheck",
     "seconds": 6,
     "narration": "The rule is simple: keep water hot, cold, or always moving.",
     "keys": [
      "keep water hot",
      "cold",
      "always moving"
     ],
     "props": {
      "items": [
       "Keep it hot",
       "Keep it cold",
       "Keep it moving"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Everyone plays a part in keeping our water safe and clean.",
     "keys": [
      "keeping our water safe",
      "clean"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "Your daily water-safety habits",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5,
     "narration": "Water safety in your camp: the daily habits that matter.",
     "keys": [
      "Water safety",
      "daily habits"
     ],
     "props": {
      "icon": "droplet"
     }
    },
    {
     "id": "v1",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "Three habits protect everyone: flush, check temperatures, and report any problems.",
     "keys": [
      "flush",
      "check temperatures",
      "report any problems"
     ],
     "props": {
      "items": [
       "Flush unused outlets",
       "Check temperatures",
       "Report problems"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gstat",
     "seconds": 6,
     "narration": "Flush taps and showers not used for seven days or more.",
     "keys": [
      "Flush taps and showers",
      "seven days"
     ],
     "props": {
      "value": "7 days",
      "sub": "flush any tap or shower unused this long"
     }
    },
    {
     "id": "v3",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "Open the outlet gently, let water run, and avoid breathing the spray.",
     "keys": [
      "Open the outlet gently",
      "let water run",
      "avoid breathing the spray"
     ],
     "props": {
      "items": [
       "Open the outlet gently",
       "Let the water run",
       "Avoid the spray"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gcompare",
     "seconds": 6,
     "narration": "Good habits keep water safe; neglect lets stagnant, lukewarm water become dangerous.",
     "keys": [
      "keep water safe",
      "stagnant",
      "lukewarm water"
     ],
     "props": {
      "good": [
       "Hot water kept hot",
       "Cold water kept cold",
       "Outlets flushed"
      ],
      "bad": [
       "Lukewarm water",
       "Stagnant pipes",
       "Dead legs ignored"
      ]
     }
    },
    {
     "id": "v5",
     "visual": "galert",
     "seconds": 6,
     "narration": "Spotted lukewarm hot water or a dirty showerhead? Tell your responsible person.",
     "keys": [
      "lukewarm hot water",
      "dirty showerhead",
      "responsible person"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5,
     "narration": "Small daily checks keep your campers and colleagues safe.",
     "keys": [
      "Small daily checks",
      "safe"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  }
 },
 "c47": {
  "intro": {
   "k": "motion",
   "title": "Fire Warden: your role in plain English",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5,
     "narration": "Fire Warden training, built for holiday camps and activity clubs.",
     "keys": [
      "Fire Warden training",
      "holiday camps",
      "activity clubs"
     ],
     "props": {
      "icon": "flame"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 6,
     "narration": "The law behind it all is the Fire Safety Order 2005.",
     "keys": [
      "law",
      "Fire Safety Order 2005"
     ],
     "props": {
      "icon": "shield"
     }
    },
    {
     "id": "v2",
     "visual": "gstat",
     "seconds": 6,
     "narration": "It names a responsible person who must keep everyone safe from fire.",
     "keys": [
      "responsible person",
      "safe from fire"
     ],
     "props": {
      "value": "2005",
      "sub": "Fire Safety Order"
     }
    },
    {
     "id": "v3",
     "visual": "gcards",
     "seconds": 6,
     "narration": "Wardens sweep the rooms; marshals count heads at the assembly point.",
     "keys": [
      "sweep",
      "count heads",
      "assembly point"
     ],
     "props": {
      "icons": [
       "eye",
       "people",
       "exit"
      ],
      "items": [
       "Sweep rooms",
       "Count heads",
       "Assembly point"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gcheck",
     "seconds": 6,
     "narration": "Know your alarm, your exits, your route, and your assembly point.",
     "keys": [
      "alarm",
      "exits",
      "route",
      "assembly point"
     ],
     "props": {
      "items": [
       "Alarm sound",
       "Nearest exits",
       "Escape route",
       "Assembly point"
      ]
     }
    },
    {
     "id": "v5",
     "visual": "galert",
     "seconds": 5,
     "narration": "Never go back inside for anything once you are out.",
     "keys": [
      "Never go back inside",
      "once you are out"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Learn the drill now, so children stay calm on the day.",
     "keys": [
      "Learn the drill",
      "children stay calm"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "When the alarm sounds",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5,
     "narration": "When the alarm sounds, every second counts at your club.",
     "keys": [
      "alarm sounds",
      "every second counts"
     ],
     "props": {
      "icon": "bell"
     }
    },
    {
     "id": "v1",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "Raise the alarm, then move children calmly toward the nearest exit.",
     "keys": [
      "Raise the alarm",
      "children calmly",
      "nearest exit"
     ],
     "props": {
      "items": [
       "Raise the alarm",
       "Guide children out",
       "Use nearest exit"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Sweep every room, toilet and cupboard, then close doors behind you.",
     "keys": [
      "Sweep every room",
      "close doors"
     ],
     "props": {
      "icon": "eye"
     }
    },
    {
     "id": "v3",
     "visual": "gcompare",
     "seconds": 6,
     "narration": "Walk quickly and calmly; do not run, push, or collect belongings.",
     "keys": [
      "Walk quickly",
      "do not run",
      "collect belongings"
     ],
     "props": {
      "good": [
       "Walk calmly",
       "Follow the route",
       "Leave bags behind"
      ],
      "bad": [
       "Running",
       "Pushing",
       "Going back"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gspot",
     "seconds": 6,
     "narration": "At the assembly point, take the register and count every child.",
     "keys": [
      "assembly point",
      "register",
      "count every child"
     ],
     "props": {
      "icon": "people"
     }
    },
    {
     "id": "v5",
     "visual": "galert",
     "seconds": 5,
     "narration": "Report anyone missing to the fire service; never search yourself.",
     "keys": [
      "anyone missing",
      "fire service",
      "never search yourself"
     ],
     "props": {
      "icon": "phone"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5,
     "narration": "Stay put until a fire officer says it is safe.",
     "keys": [
      "Stay put",
      "safe"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  }
 },
 "c48": {
  "intro": {
   "k": "motion",
   "title": "Emergency First Aid at Work",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 7,
     "narration": "Emergency First Aid at Work: the calm, confident skills that keep campers and staff safe.",
     "keys": [
      "Emergency First Aid at Work",
      "campers and staff safe"
     ],
     "props": {
      "icon": "heart"
     }
    },
    {
     "id": "v1",
     "visual": "gstat",
     "seconds": 7,
     "narration": "The Health and Safety First-Aid Regulations, from 1981, put a legal duty on every workplace.",
     "keys": [
      "Health and Safety First-Aid Regulations",
      "legal duty",
      "every workplace"
     ],
     "props": {
      "value": "1981",
      "sub": "First-Aid Regulations"
     }
    },
    {
     "id": "v2",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "The primary survey follows five letters: Danger, Response, Airway, Breathing and Circulation.",
     "keys": [
      "primary survey",
      "Danger",
      "Response",
      "Airway"
     ],
     "props": {
      "items": [
       "Danger, Response",
       "Airway, Breathing",
       "Circulation"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gcards",
     "seconds": 6,
     "narration": "You'll meet the big emergencies: cardiac arrest, choking, serious bleeding and shock.",
     "keys": [
      "cardiac arrest",
      "choking",
      "serious bleeding",
      "shock"
     ],
     "props": {
      "icons": [
       "heart",
       "lungs",
       "droplet",
       "alert"
      ],
      "items": [
       "Cardiac arrest",
       "Choking",
       "Serious bleeding",
       "Shock"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "galert",
     "seconds": 7,
     "narration": "When someone is seriously unwell, call 999 early and start first aid straight away.",
     "keys": [
      "call 999 early",
      "start first aid"
     ],
     "props": {
      "icon": "phone"
     }
    },
    {
     "id": "v5",
     "visual": "gcheck",
     "seconds": 6,
     "narration": "This course follows current HSE and Resuscitation Council UK 2025 good practice.",
     "keys": [
      "current HSE",
      "Resuscitation Council UK 2025",
      "good practice"
     ],
     "props": {
      "items": [
       "HSE first aid guidance",
       "Resuscitation Council UK 2025",
       "Real camp scenarios"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5,
     "narration": "Learn it once, and you could save a child's life.",
     "keys": [
      "save a child's life"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "CPR and the recovery position",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5,
     "narration": "Hands-on skills: CPR, the recovery position and using a defibrillator.",
     "keys": [
      "CPR",
      "the recovery position",
      "defibrillator"
     ],
     "props": {
      "icon": "heart"
     }
    },
    {
     "id": "v1",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "If they're unresponsive and not breathing normally, call 999 and start CPR.",
     "keys": [
      "unresponsive",
      "not breathing normally",
      "call 999",
      "start CPR"
     ],
     "props": {
      "items": [
       "Check response",
       "Not breathing normally",
       "Call 999, start CPR"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gstat",
     "seconds": 6,
     "narration": "Push hard and fast, about two per second: thirty compressions then two breaths.",
     "keys": [
      "Push hard and fast",
      "thirty compressions",
      "two breaths"
     ],
     "props": {
      "value": "30:2",
      "sub": "compressions to breaths"
     }
    },
    {
     "id": "v3",
     "visual": "gcards",
     "seconds": 7,
     "narration": "For a child, give five rescue breaths first; for an adult, start with compressions.",
     "keys": [
      "child",
      "five rescue breaths",
      "adult",
      "compressions"
     ],
     "props": {
      "icons": [
       "child",
       "people"
      ],
      "items": [
       "Child: breaths first",
       "Adult: compressions first"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gspot",
     "seconds": 7,
     "narration": "If they're breathing but unresponsive, roll them into the recovery position on their side.",
     "keys": [
      "breathing but unresponsive",
      "recovery position",
      "on their side"
     ],
     "props": {
      "icon": "people"
     }
    },
    {
     "id": "v5",
     "visual": "galert",
     "seconds": 7,
     "narration": "Send someone for the nearest defibrillator; switch it on and follow its spoken instructions.",
     "keys": [
      "nearest defibrillator",
      "follow its spoken instructions"
     ],
     "props": {
      "icon": "heart"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Stay calm, keep going, and don't stop until help takes over.",
     "keys": [
      "Stay calm",
      "don't stop until help takes over"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  }
 },
 "c49": {
  "intro": {
   "k": "motion",
   "title": "The appointed person",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 7,
     "narration": "Welcome to First Aid Appointed Person, the steady head when something happens at your club.",
     "keys": [
      "First Aid Appointed Person",
      "steady head",
      "club"
     ],
     "props": {
      "icon": "shield"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 7,
     "narration": "Every workplace must plan its first aid, and this starts with a first aid needs assessment.",
     "keys": [
      "Every workplace",
      "first aid needs assessment"
     ],
     "props": {
      "icon": "clipboard"
     }
    },
    {
     "id": "v2",
     "visual": "gstat",
     "seconds": 7,
     "narration": "The law is the Health and Safety First-Aid Regulations 1981, and it covers every employer.",
     "keys": [
      "Health and Safety First-Aid Regulations 1981",
      "every employer"
     ],
     "props": {
      "value": "1981",
      "sub": "First-Aid Regulations"
     }
    },
    {
     "id": "v3",
     "visual": "gcards",
     "seconds": 7,
     "narration": "Provision has three parts: appointed persons, trained first aiders, and a stocked first aid kit.",
     "keys": [
      "appointed persons",
      "trained first aiders",
      "first aid kit"
     ],
     "props": {
      "icons": [
       "people",
       "heart",
       "cross"
      ],
      "items": [
       "Appointed persons",
       "Trained first aiders",
       "First aid kit"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gspot",
     "seconds": 7,
     "narration": "An appointed person takes charge, looks after the kit, and calls the emergency services.",
     "keys": [
      "takes charge",
      "looks after the kit",
      "emergency services"
     ],
     "props": {
      "icon": "phone"
     }
    },
    {
     "id": "v5",
     "visual": "galert",
     "seconds": 8,
     "narration": "They are not expected to give first aid themselves — that is a first aider's job.",
     "keys": [
      "not expected to give first aid",
      "first aider's job"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Get this right, and every child and colleague is in safe, prepared hands.",
     "keys": [
      "every child and colleague",
      "safe, prepared hands"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "When something happens",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "When something happens, your job is to respond calmly and record it properly.",
     "keys": [
      "something happens",
      "respond calmly",
      "record it properly"
     ],
     "props": {
      "icon": "clipboard"
     }
    },
    {
     "id": "v1",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "First, make the area safe. Then get help. Then write up what happened.",
     "keys": [
      "make the area safe",
      "get help",
      "write up what happened"
     ],
     "props": {
      "items": [
       "Make the area safe",
       "Get help",
       "Write it up"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gspot",
     "seconds": 6,
     "narration": "For anything serious, call 999. For advice on non-urgent injuries, call NHS 111.",
     "keys": [
      "call 999",
      "NHS 111"
     ],
     "props": {
      "icon": "phone"
     }
    },
    {
     "id": "v3",
     "visual": "gcards",
     "seconds": 7,
     "narration": "Keep your kit stocked with plasters, sterile dressings, and gloves, but no tablets or medicines.",
     "keys": [
      "Keep your kit stocked",
      "gloves",
      "no tablets or medicines"
     ],
     "props": {
      "icons": [
       "cross",
       "shield",
       "hand"
      ],
      "items": [
       "Plasters",
       "Sterile dressings",
       "Gloves"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gcompare",
     "seconds": 6,
     "narration": "Log every injury in the accident book, and keep each person's entry private.",
     "keys": [
      "accident book",
      "private"
     ],
     "props": {
      "good": [
       "Log it in the accident book",
       "Store entries securely"
      ],
      "bad": [
       "Rely on memory",
       "Leave the book on show"
      ]
     }
    },
    {
     "id": "v5",
     "visual": "galert",
     "seconds": 7,
     "narration": "Serious injuries can be reportable to the HSE under RIDDOR, so learn the deadlines.",
     "keys": [
      "reportable to the HSE",
      "RIDDOR",
      "deadlines"
     ],
     "props": {
      "icon": "bell"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Calm response, tidy records, and timely reports — the appointed person at their best.",
     "keys": [
      "Calm response",
      "timely reports",
      "appointed person at their best"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  }
 },
 "c50": {
  "intro": {
   "k": "motion",
   "title": "What RIDDOR is and why it matters",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Accident reporting and RIDDOR — knowing what to record and what the law requires.",
     "keys": [
      "Accident reporting",
      "record",
      "the law requires"
     ],
     "props": {
      "icon": "clipboard"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 6,
     "narration": "At a busy holiday camp, accidents happen — a trip, a bump, a sprain.",
     "keys": [
      "holiday camp",
      "a trip",
      "a sprain"
     ],
     "props": {
      "icon": "child"
     }
    },
    {
     "id": "v2",
     "visual": "gstat",
     "seconds": 6,
     "narration": "RIDDOR became law in twenty thirteen and still governs reporting today.",
     "keys": [
      "RIDDOR",
      "twenty thirteen",
      "reporting today"
     ],
     "props": {
      "value": "2013",
      "sub": "the year RIDDOR came into force"
     }
    },
    {
     "id": "v3",
     "visual": "gcards",
     "seconds": 5,
     "narration": "It covers reportable injuries, occupational diseases and dangerous near-miss occurrences.",
     "keys": [
      "reportable injuries",
      "diseases",
      "dangerous"
     ],
     "props": {
      "icons": [
       "heart",
       "germ",
       "alert"
      ],
      "items": [
       "Injuries",
       "Diseases",
       "Dangerous occurrences"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "galert",
     "seconds": 7,
     "narration": "Not every bump is reportable — but missing a real one breaks the law.",
     "keys": [
      "Not every bump",
      "missing a real one",
      "breaks the law"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v5",
     "visual": "gspot",
     "seconds": 5,
     "narration": "Good reporting protects children, staff and your camp's reputation.",
     "keys": [
      "Good reporting",
      "children",
      "reputation"
     ],
     "props": {
      "icon": "shield-tick"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5,
     "narration": "Learn what to report, when, and how — then let's begin.",
     "keys": [
      "what to report",
      "when",
      "how"
     ],
     "props": {
      "icon": "clipboard"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "What to report and when",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "What must be reported — and how fast the clock is ticking.",
     "keys": [
      "What must be reported",
      "the clock",
      "ticking"
     ],
     "props": {
      "icon": "clock"
     }
    },
    {
     "id": "v1",
     "visual": "gcards",
     "seconds": 5,
     "narration": "Report deaths, specified injuries, over-seven-day injuries, diseases and dangerous occurrences.",
     "keys": [
      "deaths",
      "specified injuries",
      "dangerous occurrences"
     ],
     "props": {
      "icons": [
       "cross",
       "clock",
       "alert"
      ],
      "items": [
       "Specified injuries",
       "Over-7-day",
       "Dangerous occurrences"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gspot",
     "seconds": 6,
     "narration": "A child taken from camp to hospital for treatment is reportable too.",
     "keys": [
      "A child",
      "hospital for treatment",
      "reportable"
     ],
     "props": {
      "icon": "child"
     }
    },
    {
     "id": "v3",
     "visual": "gstat",
     "seconds": 5,
     "narration": "Over-seven-day injuries must reach the HSE within fifteen days.",
     "keys": [
      "Over-seven-day",
      "HSE",
      "fifteen days"
     ],
     "props": {
      "value": "15 days",
      "sub": "deadline for over-seven-day injuries"
     }
    },
    {
     "id": "v4",
     "visual": "gstat",
     "seconds": 5,
     "narration": "Deaths, specified injuries and occurrences: report online within ten days.",
     "keys": [
      "specified injuries",
      "report online",
      "ten days"
     ],
     "props": {
      "value": "10 days",
      "sub": "deaths, specified injuries, occurrences"
     }
    },
    {
     "id": "v5",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "Record it, report it to HSE, then investigate and prevent it.",
     "keys": [
      "Record it",
      "report it",
      "investigate"
     ],
     "props": {
      "items": [
       "Record",
       "Report to HSE",
       "Investigate"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5,
     "narration": "Report accurately, keep your records, and keep everyone safer.",
     "keys": [
      "Report accurately",
      "keep your records",
      "safer"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  }
 },
 "c51": {
  "intro": {
   "k": "motion",
   "title": "Working at Height & Ladder Safety",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Working at height and ladder safety — the everyday risks at your camp.",
     "keys": [
      "Working at height",
      "ladder safety",
      "everyday risks"
     ],
     "props": {
      "icon": "shield"
     }
    },
    {
     "id": "v1",
     "visual": "gstat",
     "seconds": 5,
     "narration": "Falls from height are Britain's biggest cause of workplace deaths.",
     "keys": [
      "Falls from height",
      "biggest cause",
      "workplace deaths"
     ],
     "props": {
      "value": "35",
      "sub": "workers killed in falls, 2024/25 (HSE)"
     }
    },
    {
     "id": "v2",
     "visual": "gspot",
     "seconds": 6,
     "narration": "At camp, height means putting up banners, bunting and store shelves.",
     "keys": [
      "At camp",
      "putting up banners",
      "store shelves"
     ],
     "props": {
      "icon": "box"
     }
    },
    {
     "id": "v3",
     "visual": "gcards",
     "seconds": 5,
     "narration": "A short fall can still break wrists, ankles or backs.",
     "keys": [
      "short fall",
      "break wrists",
      "backs"
     ],
     "props": {
      "icons": [
       "cross",
       "heart",
       "alert"
      ],
      "items": [
       "Broken wrist",
       "Sprained ankle",
       "Back injury"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gcompare",
     "seconds": 6,
     "narration": "A steady, checked ladder beats a wobbly stool and a rushed reach.",
     "keys": [
      "steady, checked ladder",
      "wobbly stool",
      "rushed reach"
     ],
     "props": {
      "good": [
       "Checked ladder",
       "Firm footing",
       "Steady pace"
      ],
      "bad": [
       "Wobbly stool",
       "Standing on chairs",
       "Rushing the job"
      ]
     }
    },
    {
     "id": "v5",
     "visual": "gcheck",
     "seconds": 6,
     "narration": "This course shows how to plan, choose and use ladders safely.",
     "keys": [
      "plan",
      "choose",
      "use ladders safely"
     ],
     "props": {
      "items": [
       "Plan the job",
       "Choose the right kit",
       "Use it safely"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Small habits keep everyone at your club firmly on the ground.",
     "keys": [
      "Small habits",
      "firmly on the ground"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "The Ladder Rules That Save Backs",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5,
     "narration": "Ladders done right — checks, angle and three points of contact.",
     "keys": [
      "Ladders done right",
      "angle",
      "three points of contact"
     ],
     "props": {
      "icon": "lift"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 6,
     "narration": "The law says avoid height, prevent falls, then minimise the distance.",
     "keys": [
      "avoid height",
      "prevent falls",
      "minimise the distance"
     ],
     "props": {
      "icon": "document"
     }
    },
    {
     "id": "v2",
     "visual": "gsteps",
     "seconds": 5,
     "narration": "Before every climb, check the feet, stiles, rungs and locks.",
     "keys": [
      "Before every climb",
      "feet",
      "stiles, rungs and locks"
     ],
     "props": {
      "items": [
       "Check the feet",
       "Inspect stiles and rungs",
       "Test the locks"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gstat",
     "seconds": 6,
     "narration": "Set a leaning ladder at one out for every four up.",
     "keys": [
      "leaning ladder",
      "one out",
      "every four up"
     ],
     "props": {
      "value": "1 in 4",
      "sub": "a 75° leaning angle"
     }
    },
    {
     "id": "v4",
     "visual": "gcheck",
     "seconds": 5,
     "narration": "Keep three points of contact — two feet and a hand.",
     "keys": [
      "three points of contact",
      "two feet",
      "a hand"
     ],
     "props": {
      "items": [
       "Two feet, one hand",
       "Or two hands, one foot",
       "Belt buckle stays central"
      ]
     }
    },
    {
     "id": "v5",
     "visual": "galert",
     "seconds": 6,
     "narration": "Off in thirty minutes — long jobs need a tower or platform.",
     "keys": [
      "thirty minutes",
      "long jobs",
      "tower or platform"
     ],
     "props": {
      "icon": "clock"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Check it, angle it, hold on — and keep children well clear.",
     "keys": [
      "Check it, angle it, hold on",
      "keep children well clear"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  }
 },
 "c52": {
  "intro": {
   "k": "motion",
   "title": "Asbestos Awareness: the hidden risk",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5.2,
     "narration": "Asbestos Awareness — spotting the hidden risk before anyone disturbs it.",
     "keys": [
      "Asbestos Awareness",
      "hidden risk"
     ],
     "props": {
      "icon": "lungs"
     }
    },
    {
     "id": "v1",
     "visual": "gstat",
     "seconds": 6,
     "narration": "Around five thousand people still die each year from past asbestos exposure.",
     "keys": [
      "five thousand",
      "past asbestos exposure"
     ],
     "props": {
      "value": "5,000",
      "sub": "deaths a year in Great Britain"
     }
    },
    {
     "id": "v2",
     "visual": "gspot",
     "seconds": 6.4,
     "narration": "Asbestos filled British buildings for decades, until it was finally banned in 1999.",
     "keys": [
      "British buildings",
      "banned in 1999"
     ],
     "props": {
      "icon": "box"
     }
    },
    {
     "id": "v3",
     "visual": "gcards",
     "seconds": 6,
     "narration": "It hides in old ceiling tiles, Artex, floor tiles and pipe lagging.",
     "keys": [
      "ceiling tiles",
      "Artex",
      "pipe lagging"
     ],
     "props": {
      "icons": [
       "box",
       "wave",
       "box",
       "flame"
      ],
      "items": [
       "Ceiling tiles",
       "Artex",
       "Floor tiles",
       "Pipe lagging"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "galert",
     "seconds": 6.4,
     "narration": "Left alone it is safe; disturb it and tiny fibres fill the air.",
     "keys": [
      "Left alone",
      "disturb it",
      "tiny fibres"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v5",
     "visual": "gcompare",
     "seconds": 6,
     "narration": "So if you are unsure: stop, leave it alone and report it.",
     "keys": [
      "unsure",
      "leave it alone",
      "report it"
     ],
     "props": {
      "good": [
       "Stop work",
       "Leave it alone",
       "Report it"
      ],
      "bad": [
       "Drill it",
       "Sand it",
       "Break it"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6.4,
     "narration": "Asbestos awareness keeps you and every child safe — never disturb what you suspect.",
     "keys": [
      "Asbestos awareness",
      "never disturb what you suspect"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "If you find or suspect asbestos",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 4.8,
     "narration": "If You Suspect Asbestos — four steps that protect everyone.",
     "keys": [
      "Suspect Asbestos",
      "four steps"
     ],
     "props": {
      "icon": "clipboard"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 6.8,
     "narration": "The Control of Asbestos Regulations 2012 says someone must manage every known asbestos material.",
     "keys": [
      "Control of Asbestos Regulations 2012",
      "manage every known asbestos"
     ],
     "props": {
      "icon": "document"
     }
    },
    {
     "id": "v2",
     "visual": "gsteps",
     "seconds": 6.8,
     "narration": "Stop what you are doing, keep everyone well back, and do not touch it.",
     "keys": [
      "Stop",
      "keep everyone well back",
      "do not touch"
     ],
     "props": {
      "items": [
       "Stop work",
       "Keep everyone back",
       "Do not touch"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "Then report it to your manager and check the site's asbestos register.",
     "keys": [
      "report it",
      "asbestos register"
     ],
     "props": {
      "items": [
       "Tell your manager",
       "Check the register"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "galert",
     "seconds": 6,
     "narration": "Awareness training does not allow you to work on or remove asbestos.",
     "keys": [
      "Awareness training does not allow",
      "remove asbestos"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v5",
     "visual": "gquote",
     "seconds": 5.6,
     "narration": "Only a competent, licensed contractor should ever disturb or remove asbestos.",
     "keys": [
      "licensed contractor",
      "disturb or remove"
     ],
     "props": {
      "icon": "shield"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Spot it, stop, report — and the hidden risk never reaches a child.",
     "keys": [
      "Spot it, stop, report",
      "never reaches a child"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  }
 },
 "c53": {
  "intro": {
   "k": "motion",
   "title": "Duty of care: the basics",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5.2,
     "narration": "Duty of care — what every activity-club leader owes the children.",
     "keys": [
      "Duty of care",
      "owes the children"
     ],
     "props": {
      "icon": "shield"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 6,
     "narration": "From drop-off to collection, each child's safety is partly in your hands.",
     "keys": [
      "drop-off to collection",
      "in your hands"
     ],
     "props": {
      "icon": "child"
     }
    },
    {
     "id": "v2",
     "visual": "galert",
     "seconds": 5.6,
     "narration": "You must take reasonable care against harm you could reasonably foresee.",
     "keys": [
      "reasonable care",
      "foresee"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v3",
     "visual": "gcards",
     "seconds": 6,
     "narration": "In practice: know your children, spot hazards early, and follow every instruction.",
     "keys": [
      "know your children",
      "spot hazards",
      "every instruction"
     ],
     "props": {
      "icons": [
       "people",
       "eye",
       "clipboard"
      ],
      "items": [
       "Know your children",
       "Spot hazards early",
       "Follow instructions"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gstat",
     "seconds": 6.4,
     "narration": "For four to eight-year-olds, aim for at least one adult to six children.",
     "keys": [
      "four to eight",
      "one adult to six children"
     ],
     "props": {
      "value": "1:6",
      "sub": "Ages 4–8 — NSPCC minimum"
     }
    },
    {
     "id": "v5",
     "visual": "gcheck",
     "seconds": 5.2,
     "narration": "Remember: ratios are a floor, and children come before paperwork.",
     "keys": [
      "ratios are a floor",
      "children come before paperwork"
     ],
     "props": {
      "items": [
       "Ratios are a floor",
       "Children before paperwork"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Care, foresight and best interests — that is duty of care in action.",
     "keys": [
      "Care, foresight",
      "duty of care in action"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "Duty of care under pressure",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5.6,
     "narration": "Duty of care under pressure — when the ordinary day goes wrong.",
     "keys": [
      "Duty of care under pressure",
      "goes wrong"
     ],
     "props": {
      "icon": "shield"
     }
    },
    {
     "id": "v1",
     "visual": "galert",
     "seconds": 6,
     "narration": "Higher risk means higher care — water, heights and heat need more staff.",
     "keys": [
      "Higher risk means higher care",
      "more staff"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v2",
     "visual": "gcompare",
     "seconds": 6,
     "narration": "Good supervision watches and counts; poor supervision assumes someone else is looking.",
     "keys": [
      "watches and counts",
      "assumes someone else"
     ],
     "props": {
      "good": [
       "Watch and count heads",
       "Stay attentive"
      ],
      "bad": [
       "Assume others are looking",
       "Drift off task"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "If something happens: make it safe, get help, record it, then report.",
     "keys": [
      "make it safe",
      "get help",
      "record it",
      "report"
     ],
     "props": {
      "items": [
       "Make it safe",
       "Get help",
       "Record it",
       "Report"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gspot",
     "seconds": 5.6,
     "narration": "Never release a child to anyone outside the agreed collection arrangements.",
     "keys": [
      "Never release a child",
      "agreed collection arrangements"
     ],
     "props": {
      "icon": "lock"
     }
    },
    {
     "id": "v5",
     "visual": "gcheck",
     "seconds": 7.3,
     "narration": "A worry above your role? Pass it to your safeguarding lead — don't sit on it.",
     "keys": [
      "above your role",
      "safeguarding lead",
      "don't sit on it"
     ],
     "props": {
      "items": [
       "Escalate concerns",
       "Tell your safeguarding lead",
       "Don't sit on it"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 4.8,
     "narration": "Reasonable care, honest records, best interests first — every time.",
     "keys": [
      "Reasonable care",
      "best interests first"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  }
 },
 "c54": {
  "intro": {
   "k": "motion",
   "title": "Why conflict resolution matters at camp",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5,
     "narration": "Conflict resolution and de-escalation, for holiday camp and club staff.",
     "keys": [
      "Conflict resolution",
      "de-escalation",
      "holiday camp and club"
     ],
     "props": {
      "icon": "handshake"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Most days run smoothly, but tempers can flare at drop-off and pick-up.",
     "keys": [
      "tempers can flare",
      "drop-off and pick-up"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v2",
     "visual": "gstat",
     "seconds": 6,
     "narration": "Under the Health and Safety at Work Act, your safety is protected.",
     "keys": [
      "Health and Safety at Work Act",
      "your safety",
      "protected"
     ],
     "props": {
      "value": "1974",
      "sub": "Health & Safety at Work Act"
     }
    },
    {
     "id": "v3",
     "visual": "gcards",
     "seconds": 5,
     "narration": "Conflict can be frustration, raised voices, or rarely physical aggression.",
     "keys": [
      "frustration",
      "raised voices",
      "physical aggression"
     ],
     "props": {
      "icons": [
       "heart",
       "chat",
       "hand"
      ],
      "items": [
       "Frustration",
       "Raised voices",
       "Physical"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gcheck",
     "seconds": 6,
     "narration": "Stay calm, listen, and give people space and time to settle.",
     "keys": [
      "Stay calm",
      "listen",
      "space and time"
     ],
     "props": {
      "items": [
       "Stay calm",
       "Listen",
       "Give space and time"
      ]
     }
    },
    {
     "id": "v5",
     "visual": "galert",
     "seconds": 6,
     "narration": "Never accept being hurt or abused; know when to walk away.",
     "keys": [
      "Never accept being hurt",
      "walk away"
     ],
     "props": {
      "icon": "exit"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5,
     "narration": "Learn to spot, calm, and safely step back from conflict.",
     "keys": [
      "spot",
      "calm",
      "safely step back"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "De-escalation, step by step",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5,
     "narration": "De-escalation in action: calming things down at your club.",
     "keys": [
      "De-escalation in action",
      "calming things down"
     ],
     "props": {
      "icon": "wave"
     }
    },
    {
     "id": "v1",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "Read the situation, keep your distance, and check your own body language.",
     "keys": [
      "Read the situation",
      "keep your distance",
      "body language"
     ],
     "props": {
      "items": [
       "Read the situation",
       "Keep distance",
       "Check body language"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Dynamic risk assessment means you keep reassessing the danger, moment by moment.",
     "keys": [
      "Dynamic risk assessment",
      "reassessing the danger",
      "moment by moment"
     ],
     "props": {
      "icon": "eye"
     }
    },
    {
     "id": "v3",
     "visual": "gcompare",
     "seconds": 6,
     "narration": "Speak slowly and softly; never argue, mock, or crowd an angry person.",
     "keys": [
      "Speak slowly and softly",
      "never argue",
      "crowd"
     ],
     "props": {
      "good": [
       "Speak slowly",
       "Give space",
       "Listen"
      ],
      "bad": [
       "Argue back",
       "Mock or blame",
       "Crowd them"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gcards",
     "seconds": 6,
     "narration": "For an upset parent: listen, acknowledge, move somewhere quiet, and find answers.",
     "keys": [
      "upset parent",
      "acknowledge",
      "somewhere quiet",
      "find answers"
     ],
     "props": {
      "icons": [
       "chat",
       "heart",
       "exit",
       "tick"
      ],
      "items": [
       "Listen",
       "Acknowledge",
       "Move somewhere quiet",
       "Find answers"
      ]
     }
    },
    {
     "id": "v5",
     "visual": "galert",
     "seconds": 6,
     "narration": "If aggression rises or a weapon appears, disengage and call for help.",
     "keys": [
      "aggression rises",
      "disengage",
      "call for help"
     ],
     "props": {
      "icon": "phone"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5,
     "narration": "Calm words, safe distance, and knowing when to get support.",
     "keys": [
      "Calm words",
      "safe distance",
      "get support"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  }
 },
 "c55": {
  "intro": {
   "k": "motion",
   "title": "Why cyber security matters at our club",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Cyber security awareness, protecting the families and staff who trust our club.",
     "keys": [
      "Cyber security awareness",
      "families and staff",
      "trust our club"
     ],
     "props": {
      "icon": "shield"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 6.5,
     "narration": "Criminals target small clubs too. One stolen password can expose every family's records.",
     "keys": [
      "Criminals target small clubs",
      "every family's records"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v2",
     "visual": "gstat",
     "seconds": 6.5,
     "narration": "The public has reported over thirty-two million scam emails to the national service.",
     "keys": [
      "thirty-two million",
      "scam emails",
      "national service"
     ],
     "props": {
      "value": "32 million",
      "sub": "scam emails reported to the NCSC"
     }
    },
    {
     "id": "v3",
     "visual": "gcards",
     "seconds": 6,
     "narration": "The main risks: phishing emails, weak passwords, unlocked devices and out-of-date software.",
     "keys": [
      "phishing emails",
      "weak passwords",
      "unlocked devices",
      "out-of-date software"
     ],
     "props": {
      "icons": [
       "chat",
       "lock",
       "phone",
       "box"
      ],
      "items": [
       "Phishing emails",
       "Weak passwords",
       "Unlocked devices",
       "Out-of-date software"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gcheck",
     "seconds": 6,
     "narration": "Simple habits protect us: strong passwords, two-step verification, and reporting anything suspicious.",
     "keys": [
      "strong passwords",
      "two-step verification",
      "reporting anything suspicious"
     ],
     "props": {
      "items": [
       "Strong, unique passwords",
       "Two-step verification",
       "Report anything suspicious"
      ]
     }
    },
    {
     "id": "v5",
     "visual": "gclose",
     "seconds": 5.5,
     "narration": "Everyone plays a part. Let's build our club's cyber confidence together.",
     "keys": [
      "Everyone plays a part",
      "cyber confidence together"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "Spot the scam, lock the account",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5.5,
     "narration": "Spotting phishing, the number one way criminals get into our systems.",
     "keys": [
      "Spotting phishing",
      "number one way",
      "into our systems"
     ],
     "props": {
      "icon": "chat"
     }
    },
    {
     "id": "v1",
     "visual": "galert",
     "seconds": 6.8,
     "narration": "A fake email urges you to click fast, pay now, or confirm your login.",
     "keys": [
      "fake email",
      "click fast",
      "confirm your login"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v2",
     "visual": "gcompare",
     "seconds": 6.5,
     "narration": "Learn the warning signs, and compare them against what a safe message looks like.",
     "keys": [
      "warning signs",
      "safe message"
     ],
     "props": {
      "good": [
       "Sender you expected",
       "No pressure or threats",
       "You can verify it"
      ],
      "bad": [
       "Urgent threats",
       "Odd web address",
       "Unexpected attachment"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gsteps",
     "seconds": 6.8,
     "narration": "If a message feels wrong: stop, check the real sender, and never click the link.",
     "keys": [
      "stop",
      "check the real sender",
      "never click"
     ],
     "props": {
      "items": [
       "Stop and slow down",
       "Check the real sender",
       "Do not click links"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gstat",
     "seconds": 6.5,
     "narration": "Three random words make a strong password. Length beats complexity every single time.",
     "keys": [
      "Three random words",
      "strong password",
      "Length beats complexity"
     ],
     "props": {
      "value": "3 words",
      "sub": "the NCSC's password advice"
     }
    },
    {
     "id": "v5",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Report it. Forward suspect emails to report@phishing.gov.uk, and we all stay safer.",
     "keys": [
      "Report it",
      "report@phishing.gov.uk",
      "stay safer"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  }
 },
 "c56": {
  "intro": {
   "k": "motion",
   "title": "Caring for our planet at camp",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 7,
     "narration": "Welcome to Environmental and Sustainability Awareness, good practice for every holiday camp and activity club.",
     "keys": [
      "Environmental and Sustainability",
      "holiday camp",
      "activity club"
     ],
     "props": {
      "icon": "globe"
     }
    },
    {
     "id": "v1",
     "visual": "gstat",
     "seconds": 7,
     "narration": "Turning the heating down by one degree can cut heating bills by around eight percent.",
     "keys": [
      "one degree",
      "cut heating bills",
      "eight percent"
     ],
     "props": {
      "value": "8%",
      "sub": "saved per 1C lower"
     }
    },
    {
     "id": "v2",
     "visual": "gcards",
     "seconds": 7,
     "narration": "Every day we handle waste, energy and water, and small choices soon add up.",
     "keys": [
      "waste",
      "energy",
      "water"
     ],
     "props": {
      "icons": [
       "box",
       "flame",
       "droplet"
      ],
      "items": [
       "Waste",
       "Energy",
       "Water"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "galert",
     "seconds": 8,
     "narration": "Get waste wrong and the Environment Agency can fine a setting for breaching its duty of care.",
     "keys": [
      "Environment Agency",
      "duty of care"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v4",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Children copy what they see, so our habits teach the next generation.",
     "keys": [
      "Children copy",
      "habits",
      "next generation"
     ],
     "props": {
      "icon": "child"
     }
    },
    {
     "id": "v5",
     "visual": "gcheck",
     "seconds": 6,
     "narration": "This course covers the waste hierarchy, recycling right, and saving energy.",
     "keys": [
      "waste hierarchy",
      "recycling right",
      "saving energy"
     ],
     "props": {
      "items": [
       "Waste hierarchy",
       "Recycling right",
       "Saving energy"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5,
     "narration": "Let's protect our planet, one small habit at a time.",
     "keys": [
      "protect our planet",
      "one small habit"
     ],
     "props": {
      "icon": "globe"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "The waste hierarchy in action",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5,
     "narration": "Let's put the waste hierarchy into action at our club.",
     "keys": [
      "waste hierarchy",
      "action"
     ],
     "props": {
      "icon": "box"
     }
    },
    {
     "id": "v1",
     "visual": "gsteps",
     "seconds": 5,
     "narration": "Reduce first, then reuse, then recycle, and only then dispose.",
     "keys": [
      "Reduce",
      "reuse",
      "recycle",
      "dispose"
     ],
     "props": {
      "items": [
       "Reduce",
       "Reuse",
       "Recycle",
       "Dispose"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gcompare",
     "seconds": 7,
     "narration": "A clean recycling bin helps, but one greasy box can spoil the whole batch.",
     "keys": [
      "clean recycling bin",
      "greasy box",
      "spoil the whole batch"
     ],
     "props": {
      "good": [
       "Clean card",
       "Rinsed cans"
      ],
      "bad": [
       "Greasy boxes",
       "Bagged recycling"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gstat",
     "seconds": 6,
     "narration": "Since March 2025, workplaces with ten or more staff must separate their recycling.",
     "keys": [
      "March 2025",
      "ten or more staff",
      "separate their recycling"
     ],
     "props": {
      "value": "31 Mar 2025",
      "sub": "Simpler Recycling began"
     }
    },
    {
     "id": "v4",
     "visual": "gcards",
     "seconds": 6,
     "narration": "Keep paper, glass, metal and food waste out of the general bin.",
     "keys": [
      "paper",
      "glass",
      "metal",
      "food waste"
     ],
     "props": {
      "icons": [
       "document",
       "box",
       "food"
      ],
      "items": [
       "Paper & card",
       "Glass & metal",
       "Food waste"
      ]
     }
    },
    {
     "id": "v5",
     "visual": "galert",
     "seconds": 6,
     "narration": "Switch off lights and equipment at the end of every session.",
     "keys": [
      "Switch off",
      "end of every session"
     ],
     "props": {
      "icon": "flame"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5,
     "narration": "Every small action protects our planet and saves money too.",
     "keys": [
      "small action",
      "protects our planet"
     ],
     "props": {
      "icon": "globe"
     }
    }
   ]
  }
 },
 "c57": {
  "intro": {
   "k": "motion",
   "title": "Play Safe: The Standards Behind the Kit",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5,
     "narration": "Welcome to Safe Use of Play and Sports Equipment.",
     "keys": [
      "Safe Use",
      "Play and Sports Equipment"
     ],
     "props": {
      "icon": "shield"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 8,
     "narration": "Every session, hundreds of children climb, swing and play on our equipment. Keeping it safe is our job.",
     "keys": [
      "hundreds of children",
      "Keeping it safe"
     ],
     "props": {
      "icon": "child"
     }
    },
    {
     "id": "v2",
     "visual": "gcards",
     "seconds": 7,
     "narration": "Two standards shape good practice: BS EN 1176 for equipment, and BS EN 1177 for surfacing.",
     "keys": [
      "BS EN 1176",
      "BS EN 1177"
     ],
     "props": {
      "icons": [
       "puzzle",
       "shield-tick"
      ],
      "items": [
       "BS EN 1176 equipment",
       "BS EN 1177 surfacing"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gstat",
     "seconds": 6,
     "narration": "A fall should never exceed three metres, and the surface below must soften every landing.",
     "keys": [
      "three metres",
      "soften every landing"
     ],
     "props": {
      "value": "3m",
      "sub": "maximum fall height"
     }
    },
    {
     "id": "v4",
     "visual": "galert",
     "seconds": 7,
     "narration": "Faulty kit is our responsibility. Good practice, and the law, expect us to check and act.",
     "keys": [
      "our responsibility",
      "check and act"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v5",
     "visual": "gcompare",
     "seconds": 6,
     "narration": "Good practice means routine checks, not crossing fingers and hoping nothing breaks.",
     "keys": [
      "routine checks",
      "hoping nothing breaks"
     ],
     "props": {
      "good": [
       "Routine checks",
       "Log and fix faults"
      ],
      "bad": [
       "Hope nothing breaks",
       "Ignore worn kit"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5,
     "narration": "Let us learn to keep every child safe at play.",
     "keys": [
      "keep every child safe"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "The Three-Tier Inspection Routine",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5,
     "narration": "Three inspections keep your equipment safe all season.",
     "keys": [
      "Three inspections",
      "all season"
     ],
     "props": {
      "icon": "clipboard"
     }
    },
    {
     "id": "v1",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "Three tiers: routine visual, then operational, then the annual main inspection.",
     "keys": [
      "routine visual",
      "operational",
      "annual main"
     ],
     "props": {
      "items": [
       "Routine visual",
       "Operational",
       "Annual main"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gspot",
     "seconds": 7,
     "narration": "Routine visual checks happen daily, spotting broken glass, worn ropes and sharp edges.",
     "keys": [
      "daily",
      "broken glass",
      "worn ropes"
     ],
     "props": {
      "icon": "eye"
     }
    },
    {
     "id": "v3",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Operational checks, every one to three months, test for wear and stability.",
     "keys": [
      "Operational checks",
      "wear and stability"
     ],
     "props": {
      "icon": "clipboard"
     }
    },
    {
     "id": "v4",
     "visual": "gstat",
     "seconds": 6,
     "narration": "Once a year an RPII-qualified inspector completes the annual main inspection.",
     "keys": [
      "Once a year",
      "annual main inspection"
     ],
     "props": {
      "value": "1 / year",
      "sub": "RPII inspector"
     }
    },
    {
     "id": "v5",
     "visual": "galert",
     "seconds": 6,
     "narration": "Found a fault? Take the equipment out of use and log it.",
     "keys": [
      "out of use",
      "log it"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5,
     "narration": "Inspect, record, repair. That is how we protect play.",
     "keys": [
      "Inspect, record, repair",
      "protect play"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  }
 },
 "c58": {
  "intro": {
   "k": "motion",
   "title": "Transporting Children Safely",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5,
     "narration": "Transporting children safely, from the first head-count to the last.",
     "keys": [
      "Transporting children safely",
      "head-count"
     ],
     "props": {
      "icon": "people"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Every trip carries a duty of care that never takes a day off.",
     "keys": [
      "duty of care",
      "never takes a day off"
     ],
     "props": {
      "icon": "shield"
     }
    },
    {
     "id": "v2",
     "visual": "gstat",
     "seconds": 6,
     "narration": "Children must use a child seat until twelve years or 135 centimetres.",
     "keys": [
      "twelve years",
      "135 centimetres"
     ],
     "props": {
      "value": "135cm",
      "sub": "or age 12 — whichever first"
     }
    },
    {
     "id": "v3",
     "visual": "gcards",
     "seconds": 6,
     "narration": "Four pillars: the right driver, the right restraints, head-counts, and constant supervision.",
     "keys": [
      "right driver",
      "right restraints",
      "head-counts",
      "supervision"
     ],
     "props": {
      "icons": [
       "people",
       "lock",
       "tick",
       "eye"
      ],
      "items": [
       "Right driver",
       "Right restraints",
       "Head-counts",
       "Supervision"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "galert",
     "seconds": 6,
     "narration": "Get one link wrong and a child can be left behind or unrestrained.",
     "keys": [
      "left behind",
      "unrestrained"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v5",
     "visual": "gspot",
     "seconds": 5,
     "narration": "This course builds on gov.uk rules and MiDAS good practice.",
     "keys": [
      "gov.uk rules",
      "MiDAS good practice"
     ],
     "props": {
      "icon": "book"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5,
     "narration": "Buckle up — let's make every journey a safe one.",
     "keys": [
      "Buckle up",
      "safe one"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "On the Road: Restraints, Counts and Ratios",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 4,
     "narration": "On the road: restraints, counts and calm control.",
     "keys": [
      "restraints",
      "counts",
      "calm control"
     ],
     "props": {
      "icon": "people"
     }
    },
    {
     "id": "v1",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "Before you move: fit restraints, brief the group, then count everyone on board.",
     "keys": [
      "fit restraints",
      "brief the group",
      "count everyone"
     ],
     "props": {
      "items": [
       "Fit the restraints",
       "Brief the group",
       "Count everyone on"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gcompare",
     "seconds": 7,
     "narration": "Good drivers count on and count off; rushed drivers assume and lose a child.",
     "keys": [
      "count on and count off",
      "assume"
     ],
     "props": {
      "good": [
       "Count on, count off",
       "Two-person check",
       "Walk the aisle"
      ],
      "bad": [
       "Assume all aboard",
       "Rush the stop",
       "A quick glance"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gstat",
     "seconds": 6,
     "narration": "The driver is responsible in law for every passenger under fourteen.",
     "keys": [
      "responsible in law",
      "under fourteen"
     ],
     "props": {
      "value": "Under 14",
      "sub": "the driver is responsible in law"
     }
    },
    {
     "id": "v4",
     "visual": "galert",
     "seconds": 6,
     "narration": "Never reverse without a banksman guiding you and children kept well clear.",
     "keys": [
      "banksman",
      "well clear"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v5",
     "visual": "gcheck",
     "seconds": 5,
     "narration": "Doors, belts, headcount, roll-call: your four checks before wheels turn.",
     "keys": [
      "Doors",
      "belts",
      "headcount",
      "roll-call"
     ],
     "props": {
      "items": [
       "Doors secure",
       "Belts fastened",
       "Headcount matches list",
       "Roll-call done"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5,
     "narration": "Count them on, count them off, every single time.",
     "keys": [
      "Count them on",
      "count them off"
     ],
     "props": {
      "icon": "tick"
     }
    }
   ]
  }
 },
 "c59": {
  "intro": {
   "k": "motion",
   "title": "Whistleblowing: Speaking Up for Children",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Whistleblowing means speaking up when something at your club puts children at risk.",
     "keys": [
      "Whistleblowing",
      "speaking up",
      "children at risk"
     ],
     "props": {
      "icon": "shield"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 6,
     "narration": "It is noticing a wrong practice and choosing not to stay silent.",
     "keys": [
      "noticing",
      "wrong practice",
      "not to stay silent"
     ],
     "props": {
      "icon": "eye"
     }
    },
    {
     "id": "v2",
     "visual": "gcards",
     "seconds": 6,
     "narration": "Concerns might involve a colleague, a manager, or an unsafe routine.",
     "keys": [
      "colleague",
      "manager",
      "unsafe routine"
     ],
     "props": {
      "icons": [
       "people",
       "shield",
       "alert"
      ],
      "items": [
       "A colleague",
       "A manager",
       "An unsafe routine"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gstat",
     "seconds": 6,
     "narration": "The NSPCC whistleblowing advice line gives free, confidential support to worried staff.",
     "keys": [
      "NSPCC",
      "free, confidential support",
      "worried staff"
     ],
     "props": {
      "value": "0800 028 0285",
      "sub": "NSPCC advice line"
     }
    },
    {
     "id": "v4",
     "visual": "galert",
     "seconds": 6,
     "narration": "Staying silent lets harm continue; your voice can protect a child today.",
     "keys": [
      "Staying silent",
      "harm continue",
      "protect a child"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v5",
     "visual": "gspot",
     "seconds": 6,
     "narration": "The law protects workers who raise genuine concerns in the public interest.",
     "keys": [
      "law protects workers",
      "genuine concerns",
      "public interest"
     ],
     "props": {
      "icon": "shield-tick"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "If something feels wrong, speak up — safeguarding children is everyone's responsibility.",
     "keys": [
      "feels wrong",
      "speak up",
      "everyone's responsibility"
     ],
     "props": {
      "icon": "shield"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "How to Raise a Concern",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Raising a concern the right way keeps children safe and protects you too.",
     "keys": [
      "Raising a concern",
      "keeps children safe",
      "protects you"
     ],
     "props": {
      "icon": "clipboard"
     }
    },
    {
     "id": "v1",
     "visual": "gsteps",
     "seconds": 5,
     "narration": "First, note what you saw, when, and who was involved.",
     "keys": [
      "note what you saw",
      "when",
      "who was involved"
     ],
     "props": {
      "items": [
       "Note what you saw",
       "When it happened",
       "Who was involved"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "Report to your designated safeguarding lead, or a manager you trust.",
     "keys": [
      "Report",
      "designated safeguarding lead",
      "manager you trust"
     ],
     "props": {
      "items": [
       "Designated safeguarding lead",
       "A manager you trust",
       "In writing where possible"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "galert",
     "seconds": 6,
     "narration": "If a child is in immediate danger, call 999 without delay.",
     "keys": [
      "immediate danger",
      "call 999",
      "without delay"
     ],
     "props": {
      "icon": "phone"
     }
    },
    {
     "id": "v4",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Unsure, or worried nobody is listening? Ring the NSPCC advice line.",
     "keys": [
      "Unsure",
      "nobody is listening",
      "NSPCC advice line"
     ],
     "props": {
      "icon": "phone"
     }
    },
    {
     "id": "v5",
     "visual": "gcompare",
     "seconds": 6,
     "narration": "Raise it early and honestly; never ignore it or warn the person.",
     "keys": [
      "early and honestly",
      "never ignore",
      "warn the person"
     ],
     "props": {
      "good": [
       "Raise it early",
       "Be honest",
       "Keep records"
      ],
      "bad": [
       "Ignore it",
       "Warn the person",
       "Investigate alone"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Speak up in good faith — you could be the difference for a child.",
     "keys": [
      "Speak up",
      "good faith",
      "difference for a child"
     ],
     "props": {
      "icon": "heart"
     }
    }
   ]
  }
 },
 "c60": {
  "intro": {
   "k": "motion",
   "title": "Three responses, one goal: everyone safe",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5,
     "narration": "Emergency evacuation, lockdown and critical incidents — keeping every child safe.",
     "keys": [
      "evacuation",
      "lockdown",
      "critical incidents"
     ],
     "props": {
      "icon": "shield"
     }
    },
    {
     "id": "v1",
     "visual": "gcards",
     "seconds": 7,
     "narration": "Three responses protect a camp: evacuate outside, invacuate indoors, or lock down and stay hidden.",
     "keys": [
      "evacuate",
      "invacuate",
      "lock down"
     ],
     "props": {
      "icons": [
       "exit",
       "people",
       "lock"
      ],
      "items": [
       "Evacuate",
       "Invacuate",
       "Lockdown"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gstat",
     "seconds": 7,
     "narration": "From two hundred people at once, Martyn's Law duties begin, so many clubs must prepare.",
     "keys": [
      "two hundred",
      "Martyn's Law",
      "prepare"
     ],
     "props": {
      "value": "200",
      "sub": "triggers Martyn's Law duties"
     }
    },
    {
     "id": "v3",
     "visual": "galert",
     "seconds": 6,
     "narration": "Panic costs seconds; a rehearsed plan turns fear into calm, confident action.",
     "keys": [
      "rehearsed plan",
      "calm",
      "action"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v4",
     "visual": "gspot",
     "seconds": 6,
     "narration": "At every assembly point, a register proves who is safe and who is missing.",
     "keys": [
      "assembly point",
      "register",
      "missing"
     ],
     "props": {
      "icon": "clipboard"
     }
    },
    {
     "id": "v5",
     "visual": "gcheck",
     "seconds": 7,
     "narration": "You'll learn which response fits, how to account for everyone, and what to tell parents.",
     "keys": [
      "which response fits",
      "account for everyone",
      "tell parents"
     ],
     "props": {
      "items": [
       "Evacuate, invacuate or lock down",
       "Take registers, account for all",
       "Tell parents calmly and clearly"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Get the basics right, and every child goes home safe. Let's begin.",
     "keys": [
      "basics right",
      "every child",
      "home safe"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "Lead the incident, then aid recovery",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Leading a critical incident: clear roles, steady communication, no child unaccounted for.",
     "keys": [
      "critical incident",
      "clear roles",
      "communication"
     ],
     "props": {
      "icon": "shield"
     }
    },
    {
     "id": "v1",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "First raise the alarm, then delegate roles, then log decisions and update families.",
     "keys": [
      "raise the alarm",
      "delegate roles",
      "log decisions",
      "update families"
     ],
     "props": {
      "items": [
       "Alert and account",
       "Delegate clear roles",
       "Log and communicate"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "galert",
     "seconds": 7,
     "narration": "Never let rumours lead; send parents one calm, agreed message through a single channel.",
     "keys": [
      "rumours",
      "one calm",
      "single channel"
     ],
     "props": {
      "icon": "phone"
     }
    },
    {
     "id": "v3",
     "visual": "gcompare",
     "seconds": 7,
     "narration": "Confirm facts and use a holding statement; never guess or name a child online.",
     "keys": [
      "Confirm facts",
      "holding statement",
      "name a child"
     ],
     "props": {
      "good": [
       "Agreed holding statement",
       "Facts confirmed first",
       "One spokesperson"
      ],
      "bad": [
       "Guessing on social media",
       "Naming a child publicly",
       "Hours of silence"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gstat",
     "seconds": 7,
     "narration": "Practise evacuation, invacuation and lockdown every term, so muscle memory takes over under stress.",
     "keys": [
      "Practise",
      "every term",
      "muscle memory"
     ],
     "props": {
      "value": "Every term",
      "sub": "rehearse all three drills"
     }
    },
    {
     "id": "v5",
     "visual": "gspot",
     "seconds": 7,
     "narration": "After any incident, check on staff and children — recovery matters as much as response.",
     "keys": [
      "check on staff",
      "recovery",
      "response"
     ],
     "props": {
      "icon": "heart"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Plan it, practise it, lead it calmly — and bring everyone home safe.",
     "keys": [
      "Plan it",
      "practise it",
      "home safe"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  }
 },
 "c61": {
  "intro": {
   "k": "motion",
   "title": "The Ferrari Brain",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "ADHD: Delivering Inclusive Sessions. Small changes let every child thrive at your club.",
     "keys": [
      "Inclusive Sessions",
      "every child",
      "thrive"
     ],
     "props": {
      "icon": "brain"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 7,
     "narration": "Picture a Ferrari brain with bicycle brakes: huge power, but steering and stopping need support.",
     "keys": [
      "Ferrari brain",
      "bicycle brakes",
      "support"
     ],
     "props": {
      "icon": "brain"
     }
    },
    {
     "id": "v2",
     "visual": "gcards",
     "seconds": 5,
     "narration": "Lead with strengths: energy, humour, loyalty and brilliant divergent thinking.",
     "keys": [
      "energy",
      "humour",
      "loyalty",
      "divergent thinking"
     ],
     "props": {
      "icons": [
       "flame",
       "heart",
       "handshake",
       "brain"
      ],
      "items": [
       "Energy",
       "Humour",
       "Loyalty",
       "Ideas"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gstat",
     "seconds": 6,
     "narration": "Exercise itself helps: raising dopamine, burning energy and sharpening focus, sleep and mood.",
     "keys": [
      "dopamine",
      "energy",
      "focus"
     ],
     "props": {
      "value": "Exercise",
      "sub": "raises dopamine & focus"
     }
    },
    {
     "id": "v4",
     "visual": "galert",
     "seconds": 7,
     "narration": "A child who won't stand still is often still listening: many move to think.",
     "keys": [
      "stand still",
      "still listening",
      "move to think"
     ],
     "props": {
      "icon": "brain"
     }
    },
    {
     "id": "v5",
     "visual": "gcompare",
     "seconds": 7,
     "narration": "Swap constant telling-off for specific praise, and break the negative cycle these children face.",
     "keys": [
      "telling-off",
      "specific praise",
      "negative cycle"
     ],
     "props": {
      "good": [
       "Specific praise",
       "Fair rules"
      ],
      "bad": [
       "Telling-off",
       "Humiliation"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 7,
     "narration": "Two frameworks ahead: the Inclusion Spectrum and STEP. Let's make sessions work for everyone.",
     "keys": [
      "Inclusion Spectrum",
      "STEP",
      "everyone"
     ],
     "props": {
      "icon": "heart"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "STEP: Your Everyday Toolkit",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 7,
     "narration": "STEP: adapt Space, Task, Equipment and People to include every child in every activity.",
     "keys": [
      "Space",
      "Task",
      "Equipment",
      "People"
     ],
     "props": {
      "icon": "clipboard"
     }
    },
    {
     "id": "v1",
     "visual": "gsteps",
     "seconds": 7,
     "narration": "Space: mark clear boundaries and set the room out the same way every session.",
     "keys": [
      "boundaries",
      "same way",
      "session"
     ],
     "props": {
      "items": [
       "Clear lines",
       "Same layout"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "Task: small chunks, concrete words, a clear demo, and more ways to score.",
     "keys": [
      "small chunks",
      "concrete words",
      "score"
     ],
     "props": {
      "items": [
       "Chunk it",
       "More points"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "Equipment: give something to hold while waiting; explore new kit together first.",
     "keys": [
      "something to hold",
      "waiting",
      "explore"
     ],
     "props": {
      "items": [
       "Hold it",
       "Explore kit"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "People: small-sided games, time to watch first, and random-winner games so everyone succeeds.",
     "keys": [
      "small-sided",
      "watch first",
      "random-winner"
     ],
     "props": {
      "items": [
       "Small groups",
       "Watch first"
      ]
     }
    },
    {
     "id": "v5",
     "visual": "galert",
     "seconds": 7,
     "narration": "Under the Equality Act 2010, these adjustments are your anticipatory duty, not a favour.",
     "keys": [
      "Equality Act 2010",
      "anticipatory duty",
      "favour"
     ],
     "props": {
      "icon": "document"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 7,
     "narration": "Plan it, signal transitions, praise hard, partner with parents, and every child can flourish.",
     "keys": [
      "signal transitions",
      "praise hard",
      "parents",
      "flourish"
     ],
     "props": {
      "icon": "tick"
     }
    }
   ]
  }
 },
 "c62": {
  "intro": {
   "k": "motion",
   "title": "Child-First Coaching",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6.4,
     "narration": "Welcome to child-first coaching, where fun comes first and children stay in sport.",
     "keys": [
      "child-first coaching",
      "fun comes first"
     ],
     "props": {
      "icon": "heart"
     }
    },
    {
     "id": "v1",
     "visual": "gstat",
     "seconds": 6,
     "narration": "The number one reason children play sport is simple: it is fun.",
     "keys": [
      "number one reason",
      "fun"
     ],
     "props": {
      "value": "#1",
      "sub": "reason kids play"
     }
    },
    {
     "id": "v2",
     "visual": "gcards",
     "seconds": 6,
     "narration": "Children keep playing when they enjoy it, feel included, and feel competent.",
     "keys": [
      "enjoy it",
      "feel included",
      "feel competent"
     ],
     "props": {
      "icons": [
       "heart",
       "people",
       "tick"
      ],
      "items": [
       "Enjoy",
       "Include",
       "Feel able"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gcompare",
     "seconds": 6,
     "narration": "Child-first sessions buzz with smiles; adult-led drills leave children queuing and bored.",
     "keys": [
      "buzz with smiles",
      "queuing and bored"
     ],
     "props": {
      "good": [
       "Smiles",
       "Active",
       "Choice"
      ],
      "bad": [
       "Queues",
       "Sidelines",
       "Bored"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Read the session from the child's point of view, not your own.",
     "keys": [
      "child's point of view"
     ],
     "props": {
      "icon": "eye"
     }
    },
    {
     "id": "v5",
     "visual": "galert",
     "seconds": 5.6,
     "narration": "The child's welfare always comes before winning or the coach's ego.",
     "keys": [
      "welfare always comes before winning"
     ],
     "props": {
      "icon": "shield"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5.6,
     "narration": "Coach for participation first, technical excellence second. Every child, every session.",
     "keys": [
      "participation first",
      "technical excellence second"
     ],
     "props": {
      "icon": "tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "STEP & Participation",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 5.6,
     "narration": "Now for the coach's toolkit: STEP and keeping every child active.",
     "keys": [
      "STEP",
      "every child active"
     ],
     "props": {
      "icon": "puzzle"
     }
    },
    {
     "id": "v1",
     "visual": "gcards",
     "seconds": 6.8,
     "narration": "STEP means Space, Task, Equipment and People — four dials to adapt any activity.",
     "keys": [
      "Space",
      "Task",
      "Equipment",
      "People"
     ],
     "props": {
      "icons": [
       "globe",
       "clipboard",
       "box",
       "people"
      ],
      "items": [
       "Space",
       "Task",
       "Equip",
       "People"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gsteps",
     "seconds": 8,
     "narration": "Make it easier or harder: shrink the space, add a rule, swap the ball, change groups.",
     "keys": [
      "shrink the space",
      "add a rule",
      "swap the ball",
      "change groups"
     ],
     "props": {
      "items": [
       "Space",
       "Task",
       "Equip",
       "People"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gstat",
     "seconds": 6.8,
     "narration": "Aim for five praises to every one correction — catch children doing it right.",
     "keys": [
      "five praises",
      "one correction"
     ],
     "props": {
      "value": "5:1",
      "sub": "praise to correction"
     }
    },
    {
     "id": "v4",
     "visual": "galert",
     "seconds": 6.4,
     "narration": "Ban elimination games — the child who most needs practice is out first.",
     "keys": [
      "Ban elimination games",
      "out first"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v5",
     "visual": "gcompare",
     "seconds": 5.6,
     "narration": "Swap long queues for more balls, smaller groups and shorter waits.",
     "keys": [
      "long queues",
      "smaller groups"
     ],
     "props": {
      "good": [
       "More balls",
       "Small groups",
       "Short waits"
      ],
      "bad": [
       "Long queues",
       "Standing",
       "Waiting"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5.6,
     "narration": "Adapt with STEP, keep everyone moving, and coach every child in.",
     "keys": [
      "Adapt with STEP",
      "every child in"
     ],
     "props": {
      "icon": "tick"
     }
    }
   ]
  }
 },
 "c63": {
  "intro": {
   "k": "motion",
   "title": "Planning Sessions Where Everyone Succeeds",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Effective sports coaching starts with a plan that includes every single child.",
     "keys": [
      "a plan",
      "every single child"
     ],
     "props": {
      "icon": "clipboard"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 7,
     "narration": "A good plan names who, what learners will achieve, and how you'll get there.",
     "keys": [
      "who",
      "what learners will achieve",
      "how"
     ],
     "props": {
      "icon": "document"
     }
    },
    {
     "id": "v2",
     "visual": "gcards",
     "seconds": 6,
     "narration": "Great outcomes span four domains: technical, tactical, social, and personal.",
     "keys": [
      "technical",
      "tactical",
      "social",
      "personal"
     ],
     "props": {
      "icons": [
       "hand",
       "brain",
       "people",
       "heart"
      ],
      "items": [
       "Technical",
       "Tactical",
       "Social",
       "Personal"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gcompare",
     "seconds": 7,
     "narration": "Swap vague aims for clear ones: not 'get better', but 'receive and decide'.",
     "keys": [
      "vague aims",
      "clear ones",
      "receive and decide"
     ],
     "props": {
      "good": [
       "Receive",
       "Decide"
      ],
      "bad": [
       "Get better",
       "No verb"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gsteps",
     "seconds": 7,
     "narration": "Plan an easier and a harder version of every task, ready in advance.",
     "keys": [
      "easier",
      "harder",
      "in advance"
     ],
     "props": {
      "items": [
       "Easier",
       "Harder",
       "Ready"
      ]
     }
    },
    {
     "id": "v5",
     "visual": "galert",
     "seconds": 6,
     "narration": "Avoid queues and elimination — the child who needs practice gets the least.",
     "keys": [
      "queues",
      "elimination",
      "the least"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Plan inclusively, and every child leaves having learned something today.",
     "keys": [
      "Plan inclusively",
      "every child"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "STEP: Your Dial for Every Ability",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Meet STEP: Space, Task, Equipment, People — your tool to adapt any activity.",
     "keys": [
      "STEP",
      "Space, Task, Equipment, People",
      "adapt any activity"
     ],
     "props": {
      "icon": "puzzle"
     }
    },
    {
     "id": "v1",
     "visual": "gcards",
     "seconds": 5,
     "narration": "Four dials to turn: Space, Task, Equipment, and People.",
     "keys": [
      "Space",
      "Task",
      "Equipment",
      "People"
     ],
     "props": {
      "icons": [
       "globe",
       "clipboard",
       "box",
       "people"
      ],
      "items": [
       "Space",
       "Task",
       "Equipment",
       "People"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gcompare",
     "seconds": 7,
     "narration": "Space easier means more room and time; harder means closer defenders, less time.",
     "keys": [
      "more room and time",
      "closer defenders",
      "less time"
     ],
     "props": {
      "good": [
       "More room",
       "More time"
      ],
      "bad": [
       "Closer",
       "Less time"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gcompare",
     "seconds": 6,
     "narration": "Equipment easier: bigger, softer, slower balls; harder: smaller, faster, higher nets.",
     "keys": [
      "bigger, softer, slower",
      "smaller, faster",
      "higher nets"
     ],
     "props": {
      "good": [
       "Bigger",
       "Softer",
       "Slower"
      ],
      "bad": [
       "Smaller",
       "Faster",
       "Higher"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gsteps",
     "seconds": 5,
     "narration": "The golden rule: change one element, observe, then adjust again.",
     "keys": [
      "one element",
      "observe",
      "adjust"
     ],
     "props": {
      "items": [
       "Change one",
       "Observe",
       "Adjust"
      ]
     }
    },
    {
     "id": "v5",
     "visual": "gstat",
     "seconds": 6,
     "narration": "Changing one dial at a time keeps sessions fair for all abilities.",
     "keys": [
      "one dial at a time",
      "all abilities"
     ],
     "props": {
      "value": "1",
      "sub": "dial at a time"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Master STEP and you can include everyone, in sport or art.",
     "keys": [
      "Master STEP",
      "include everyone"
     ],
     "props": {
      "icon": "handshake"
     }
    }
   ]
  }
 },
 "c64": {
  "intro": {
   "k": "motion",
   "title": "Coach the Child First",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Welcome to advanced, inclusive coaching, where we always coach the child first.",
     "keys": [
      "advanced, inclusive",
      "coach the child first"
     ],
     "props": {
      "icon": "people"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Every great coach has a philosophy: a clear why behind everything they do.",
     "keys": [
      "philosophy",
      "why"
     ],
     "props": {
      "icon": "heart"
     }
    },
    {
     "id": "v2",
     "visual": "gcards",
     "seconds": 6,
     "narration": "Slide along five styles, from command to guided discovery, choosing each on purpose.",
     "keys": [
      "five styles",
      "command",
      "guided discovery"
     ],
     "props": {
      "icons": [
       "hand",
       "clipboard",
       "brain"
      ],
      "items": [
       "Command",
       "Practice",
       "Discovery"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Guided discovery means posing questions so players find the answer themselves.",
     "keys": [
      "Guided discovery",
      "questions",
      "find the answer"
     ],
     "props": {
      "icon": "brain"
     }
    },
    {
     "id": "v4",
     "visual": "gstat",
     "seconds": 6,
     "narration": "Most children quit sport by their teens when it stops being fun.",
     "keys": [
      "quit sport",
      "teens",
      "fun"
     ],
     "props": {
      "value": "By teens",
      "sub": "peak drop-out"
     }
    },
    {
     "id": "v5",
     "visual": "galert",
     "seconds": 6,
     "narration": "The classic mistake: defaulting to command style and barking every single instruction.",
     "keys": [
      "classic mistake",
      "command style"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Coach the child first, flex your style, and keep them in sport.",
     "keys": [
      "Coach the child first",
      "keep them in sport"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "Adapt with STEP and the Inclusion Spectrum",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Now let's make every session inclusive using STEP and the inclusion spectrum.",
     "keys": [
      "inclusive",
      "STEP",
      "inclusion spectrum"
     ],
     "props": {
      "icon": "puzzle"
     }
    },
    {
     "id": "v1",
     "visual": "gcards",
     "seconds": 6,
     "narration": "STEP means space, task, equipment and people — four dials you can adjust.",
     "keys": [
      "space, task, equipment",
      "people",
      "four dials"
     ],
     "props": {
      "icons": [
       "globe",
       "clipboard",
       "box",
       "people"
      ],
      "items": [
       "Space",
       "Task",
       "Equipment",
       "People"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "Watch each child, spot the barrier, then turn one dial to fit.",
     "keys": [
      "Watch each child",
      "barrier",
      "one dial"
     ],
     "props": {
      "items": [
       "Watch",
       "Spot barrier",
       "Adjust"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gcompare",
     "seconds": 6,
     "narration": "Aim for same activity, different challenge — never sink-or-swim with no help.",
     "keys": [
      "same activity",
      "different challenge",
      "sink-or-swim"
     ],
     "props": {
      "good": [
       "Same activity",
       "Different challenge"
      ],
      "bad": [
       "Sink or swim",
       "No support"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gcards",
     "seconds": 6,
     "narration": "The inclusion spectrum: open, modified, parallel, separate, and disability sport activities.",
     "keys": [
      "inclusion spectrum",
      "open",
      "parallel"
     ],
     "props": {
      "icons": [
       "globe",
       "hand",
       "people",
       "puzzle"
      ],
      "items": [
       "Open",
       "Modified",
       "Parallel",
       "Separate"
      ]
     }
    },
    {
     "id": "v5",
     "visual": "galert",
     "seconds": 6,
     "narration": "The Equality Act twenty-ten requires reasonable adjustments so no child is disadvantaged.",
     "keys": [
      "Equality Act",
      "reasonable adjustments",
      "disadvantaged"
     ],
     "props": {
      "icon": "document"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Adapt live, include everyone, and every child leaves wanting to return.",
     "keys": [
      "Adapt live",
      "include everyone",
      "wanting to return"
     ],
     "props": {
      "icon": "heart"
     }
    }
   ]
  }
 },
 "c65": {
  "intro": {
   "k": "motion",
   "title": "Why food safety matters",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Food Safety and Hygiene, Level One, for holiday camp and activity club staff.",
     "keys": [
      "Food Safety and Hygiene",
      "Level One",
      "activity club"
     ],
     "props": {
      "icon": "shield-tick"
     }
    },
    {
     "id": "v1",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Children are vulnerable, so a small dose of bacteria can seriously harm them.",
     "keys": [
      "Children are vulnerable",
      "bacteria",
      "seriously harm"
     ],
     "props": {
      "icon": "child"
     }
    },
    {
     "id": "v2",
     "visual": "galert",
     "seconds": 6,
     "narration": "Even snacks, squash and packed lunches make you a food business in law.",
     "keys": [
      "snacks",
      "packed lunches",
      "food business"
     ],
     "props": {
      "icon": "document"
     }
    },
    {
     "id": "v3",
     "visual": "gcards",
     "seconds": 5,
     "narration": "Four simple habits keep children safe: the four Cs.",
     "keys": [
      "Four simple habits",
      "four Cs"
     ],
     "props": {
      "icons": [
       "germ",
       "droplet",
       "box",
       "flame"
      ],
      "items": [
       "Contamination",
       "Cleaning",
       "Chilling",
       "Cooking"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Bacteria need warmth, food, moisture and time, and never change how food looks.",
     "keys": [
      "Bacteria need warmth",
      "never change",
      "food looks"
     ],
     "props": {
      "icon": "germ"
     }
    },
    {
     "id": "v5",
     "visual": "gstat",
     "seconds": 6,
     "narration": "Bacteria multiply fastest in the danger zone, eight to sixty-three degrees.",
     "keys": [
      "multiply fastest",
      "danger zone",
      "sixty-three degrees"
     ],
     "props": {
      "icon": "alert",
      "value": "8–63°C"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5,
     "narration": "Master the four Cs and you keep every child safe.",
     "keys": [
      "four Cs",
      "keep every child safe"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "Your everyday food-safety habits",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 4,
     "narration": "Your daily habits: handwashing, health, allergens and reporting.",
     "keys": [
      "daily habits",
      "handwashing",
      "allergens"
     ],
     "props": {
      "icon": "hand"
     }
    },
    {
     "id": "v1",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "Wash hands with soap for twenty seconds, then dry on a clean towel.",
     "keys": [
      "Wash hands",
      "twenty seconds",
      "clean towel"
     ],
     "props": {
      "items": [
       "Soap",
       "Scrub",
       "Rinse",
       "Dry"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gstat",
     "seconds": 6,
     "narration": "After sickness or diarrhoea, stay away from food for forty-eight hours symptom-free.",
     "keys": [
      "sickness or diarrhoea",
      "forty-eight hours",
      "symptom-free"
     ],
     "props": {
      "icon": "clock",
      "value": "48 hrs"
     }
    },
    {
     "id": "v3",
     "visual": "galert",
     "seconds": 6,
     "narration": "Fourteen allergens can be life-threatening; never guess, always check a written list.",
     "keys": [
      "Fourteen allergens",
      "never guess",
      "written list"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v4",
     "visual": "gspot",
     "seconds": 6,
     "narration": "Cover cuts with blue detectable plasters and tie your hair back.",
     "keys": [
      "blue detectable plasters",
      "tie your hair back"
     ],
     "props": {
      "icon": "shield-tick"
     }
    },
    {
     "id": "v5",
     "visual": "gcards",
     "seconds": 6,
     "narration": "Report illness, allergic reactions, pests or breakages to your supervisor straight away.",
     "keys": [
      "Report illness",
      "pests",
      "supervisor"
     ],
     "props": {
      "icons": [
       "heart",
       "germ",
       "bell"
      ],
      "items": [
       "Illness",
       "Pests",
       "Breakages"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5,
     "narration": "Simple, repeatable habits keep every child safe. You've got this.",
     "keys": [
      "Simple, repeatable habits",
      "every child safe"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  }
 },
 "c66": {
  "intro": {
   "k": "motion",
   "title": "Food Safety at Camp: Why It Matters",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "Welcome to Level 2 Food Safety for holiday camps and activity clubs.",
     "keys": [
      "Level 2 Food Safety",
      "holiday camps",
      "activity clubs"
     ],
     "props": {
      "icon": "shield"
     }
    },
    {
     "id": "v1",
     "visual": "gstat",
     "seconds": 5.6,
     "narration": "Cook food right through to seventy-five degrees to destroy harmful bacteria.",
     "keys": [
      "seventy-five degrees",
      "harmful bacteria"
     ],
     "props": {
      "icon": "flame",
      "value": "75°C"
     }
    },
    {
     "id": "v2",
     "visual": "gspot",
     "seconds": 6.4,
     "narration": "Children are especially vulnerable, so even small mistakes can make them very ill.",
     "keys": [
      "Children",
      "especially vulnerable",
      "very ill"
     ],
     "props": {
      "icon": "child"
     }
    },
    {
     "id": "v3",
     "visual": "gcards",
     "seconds": 5.6,
     "narration": "Four simple habits protect every meal: cleaning, cooking, chilling and cross-contamination.",
     "keys": [
      "Four simple habits",
      "cleaning",
      "cooking",
      "chilling"
     ],
     "props": {
      "icons": [
       "droplet",
       "flame",
       "box",
       "food"
      ],
      "items": [
       "Clean",
       "Cook",
       "Chill",
       "Separate"
      ]
     }
    },
    {
     "id": "v4",
     "visual": "galert",
     "seconds": 6,
     "narration": "By law, the food you serve must be safe and honestly described.",
     "keys": [
      "By law",
      "safe",
      "honestly described"
     ],
     "props": {
      "icon": "alert"
     }
    },
    {
     "id": "v5",
     "visual": "gstat",
     "seconds": 6,
     "narration": "Feeling sick or with an upset stomach? Stay away for forty-eight hours.",
     "keys": [
      "upset stomach",
      "forty-eight hours"
     ],
     "props": {
      "icon": "clock",
      "value": "48h"
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 5.6,
     "narration": "Master these basics and keep every camper safe, well and happy.",
     "keys": [
      "these basics",
      "every camper safe"
     ],
     "props": {
      "icon": "shield-tick"
     }
    }
   ]
  },
  "mid": {
   "k": "motion",
   "title": "The 4 Cs: Your Daily Routine",
   "scenes": [
    {
     "id": "v0",
     "visual": "gtitle",
     "seconds": 6,
     "narration": "The four Cs turn a busy camp kitchen into a safe one.",
     "keys": [
      "four Cs",
      "camp kitchen",
      "safe one"
     ],
     "props": {
      "icon": "food"
     }
    },
    {
     "id": "v1",
     "visual": "gsteps",
     "seconds": 6,
     "narration": "Clean as you go, then disinfect food surfaces and let them air-dry.",
     "keys": [
      "Clean as you go",
      "disinfect",
      "air-dry"
     ],
     "props": {
      "icon": "droplet",
      "items": [
       "Clean",
       "Disinfect",
       "Dry"
      ]
     }
    },
    {
     "id": "v2",
     "visual": "gcompare",
     "seconds": 5.2,
     "narration": "Never let raw meat touch ready-to-eat food; keep boards colour-coded.",
     "keys": [
      "raw meat",
      "ready-to-eat food",
      "colour-coded"
     ],
     "props": {
      "icon": "food",
      "good": [
       "Separate"
      ],
      "bad": [
       "Raw on cooked"
      ]
     }
    },
    {
     "id": "v3",
     "visual": "gstat",
     "seconds": 6.4,
     "narration": "Keep chilled food at five degrees; the danger zone is eight to sixty-three.",
     "keys": [
      "five degrees",
      "danger zone",
      "eight to sixty-three"
     ],
     "props": {
      "icon": "box",
      "value": "5°C"
     }
    },
    {
     "id": "v4",
     "visual": "gstat",
     "seconds": 6,
     "narration": "Cook right through to seventy-five degrees for thirty seconds at the centre.",
     "keys": [
      "seventy-five degrees",
      "thirty seconds",
      "centre"
     ],
     "props": {
      "icon": "flame",
      "value": "75°C"
     }
    },
    {
     "id": "v5",
     "visual": "gsteps",
     "seconds": 5.2,
     "narration": "Hot-hold above sixty-three degrees and reheat only once, right through.",
     "keys": [
      "sixty-three degrees",
      "reheat only once"
     ],
     "props": {
      "icon": "flame",
      "items": [
       "Hot-hold",
       "Reheat once"
      ]
     }
    },
    {
     "id": "v6",
     "visual": "gclose",
     "seconds": 6,
     "narration": "Do the four Cs every shift and record it in your diary.",
     "keys": [
      "four Cs",
      "every shift",
      "your diary"
     ],
     "props": {
      "icon": "clipboard"
     }
    }
   ]
  }
 }
};
