// Course content model + seed library for the Learning Centre.
// Blocks are the reusable "templates" a course is built from — the player renders
// them richly (with read-aloud voice) and the editor edits them. Content is
// grounded in KCSIE 2025, NSPCC / county-lines and safer-recruitment guidance.

export type Block =
  | { k: "text"; t: string }
  | { k: "points"; title?: string; items: string[] }
  | { k: "callout"; tone: "info" | "warn" | "tip" | "law"; title: string; t: string }
  | { k: "steps"; title?: string; items: { h: string; t: string }[] }
  | { k: "scenario"; t: string; choices: { label: string; ok: boolean; fb: string }[] }
  | { k: "check"; q: string; opts: string[]; a: number; fb?: string }
  | { k: "stat"; value: string; label: string }
  | { k: "art"; art: string; caption?: string }
  | { k: "quote"; t: string; by?: string }
  | { k: "table"; head: string[]; rows: string[][] };

export interface Lesson { id: string; title: string; mins: number; blocks: Block[] }
export interface CourseDoc { id: string; title: string; cat: "Mandatory" | "Recommended" | "Optional"; blurb: string; cover: string; lessons: Lesson[] }

// ————————————————————————————————————————————————————————————————
// SEED COURSES
// ————————————————————————————————————————————————————————————————

const safeguarding: CourseDoc = {
  id: "c1", title: "Safeguarding Children (Level 2)", cat: "Mandatory", cover: "shield",
  blurb: "Everyone's responsibility. Spot the signs, respond well, and report the same day — grounded in Keeping Children Safe in Education 2025.",
  lessons: [
    {
      id: "l1", title: "Why safeguarding is everyone's job", mins: 6, blocks: [
        { k: "art", art: "shield", caption: "Safeguarding is a shared duty — not just the DSL's." },
        { k: "text", t: "Safeguarding means protecting children from abuse, harm and exploitation, keeping them safe, and stepping in early when something isn't right. On camp or at club you are often the adult a child sees most — which makes you one of the most important people in their safety net." },
        { k: "callout", tone: "law", title: "The golden rule", t: "“It could happen here.” Assume abuse can occur in your setting and stay alert — never think “not our children.” Every member of staff has a responsibility to act." },
        { k: "points", title: "Four things this course will make second nature", items: [
          "Recognise the signs of the four types of abuse.",
          "Respond calmly and correctly if a child tells you something.",
          "Record the facts and report to your Designated Safeguarding Lead the same day.",
          "Know the specific risks — county lines, exploitation, online harm and radicalisation.",
        ] },
        { k: "check", q: "Whose responsibility is safeguarding?", opts: ["Only the Designated Safeguarding Lead", "Only senior managers", "Every single member of staff", "The child's parents"], a: 2, fb: "Correct — safeguarding is everyone's responsibility. You act; the DSL coordinates." },
      ],
    },
    {
      id: "l2", title: "The four types of abuse & their signs", mins: 9, blocks: [
        { k: "text", t: "Abuse is rarely obvious and often several types overlap. You are not there to diagnose — you are there to notice and pass it on. Learn the signs so nothing gets dismissed." },
        { k: "table", head: ["Type", "What it is", "Signs you might notice"], rows: [
          ["Physical", "Deliberately causing harm — hitting, shaking, burning.", "Unexplained or patterned bruising, burns, flinching from touch, inconsistent stories."],
          ["Emotional", "Persistent harm to a child's emotional development.", "Withdrawn or over-anxious, low self-worth, extremes of compliance or defiance."],
          ["Sexual", "Forcing/enticing a child into sexual activity (incl. online).", "Sexualised language or play beyond their age, fear of a person/place, regression, sleep problems."],
          ["Neglect", "Failing to meet basic physical or emotional needs.", "Poor hygiene, always hungry, unsuitable clothing, untreated health needs, poor supervision."],
        ] },
        { k: "callout", tone: "warn", title: "Trust your instinct", t: "You don't need proof. A change in a normally happy child, or a small comment that sits wrong with you, is enough to record and raise. A pattern of “little” things is often the picture." },
        { k: "scenario", t: "A usually bubbly 8-year-old has been quiet all week and today flinched when you patted their shoulder to say well done. What do you do?", choices: [
          { label: "Decide it's probably nothing and carry on", ok: false, fb: "A clear change plus flinching is exactly the kind of thing to note. Don't explain it away." },
          { label: "Ask them repeatedly what's wrong until they tell you", ok: false, fb: "Never interrogate. Stay warm and available, but don't press or lead." },
          { label: "Note what you saw factually and tell your DSL today", ok: true, fb: "Exactly right — observe, record the facts, and pass to the DSL the same day." },
        ] },
      ],
    },
    {
      id: "l3", title: "If a child discloses: Respond · Record · Report", mins: 8, blocks: [
        { k: "art", art: "listen", caption: "Listen, reassure, and take it seriously — then pass it on." },
        { k: "steps", title: "The moment a child tells you something", items: [
          { h: "Respond", t: "Stay calm and listen. Reassure them they've done the right thing and are not in trouble. Use their own words, don't ask leading questions, and NEVER promise to keep it secret." },
          { h: "Record", t: "As soon as you can, write down the facts — date, time, what was said in their words, what you saw, and what you did. Sign and date it. Opinions go in a separate line marked as opinion." },
          { h: "Report", t: "Tell your Designated Safeguarding Lead the same day — sooner if a child is in immediate danger. Then it's the DSL's job to decide next steps and contact agencies." },
        ] },
        { k: "callout", tone: "warn", title: "Never say “I promise I won't tell anyone”", t: "You cannot keep a safeguarding disclosure secret. Instead say: “Thank you for telling me. To keep you safe I need to share this with one person whose job is to help.”" },
        { k: "check", q: "A child starts to tell you something serious and asks you to keep it a secret. You should:", opts: ["Promise to keep the secret so they keep talking", "Explain you can't keep it secret but will only tell the person who can help", "Stop them talking immediately", "Tell them to speak to their parents"], a: 1, fb: "Correct — be honest that you must share it, with the one person whose job is to help. Never promise secrecy." },
      ],
    },
    {
      id: "l4", title: "The DSL and escalation", mins: 4, blocks: [
        { k: "text", t: "Every provider has a Designated Safeguarding Lead (DSL) with lead responsibility for safeguarding. They coordinate concerns, keep records, and liaise with children's services and the police. Know who your DSL is before your first session — and their deputy for when they're away." },
        { k: "points", title: "The DSL's job (not yours)", items: [
          "Decide whether to refer to children's social care or the police.",
          "Hold and manage safeguarding records securely.",
          "Support you after you raise a concern.",
          "Handle low-level concerns and allegations about staff.",
        ] },
        { k: "callout", tone: "tip", title: "If you can't reach the DSL and a child is in danger", t: "Don't wait. Call the police (999) or children's social care directly. Safeguarding never waits for a manager to be free." },
      ],
    },
    {
      id: "l5", title: "Specific risks to know", mins: 7, blocks: [
        { k: "points", title: "Named safeguarding issues", items: [
          "Child-on-child abuse — bullying, sexual harassment or violence between children; treated with the same seriousness, never “banter” or “kids being kids”.",
          "Child sexual & criminal exploitation — a child manipulated into sexual activity or crime (see the County Lines course).",
          "Online safety — grooming, bullying and harmful content; the risk follows the child home.",
          "Radicalisation (Prevent) — being drawn towards extremist views (see the Prevent course).",
          "FGM — female genital mutilation is illegal and carries a mandatory reporting duty for known cases.",
          "Mental health — distress and self-harm can be both a sign of, and a response to, abuse.",
        ] },
        { k: "callout", tone: "law", title: "Safer working practice — protect children and yourself", t: "Keep professional boundaries: stay visible, avoid being alone 1:1 out of sight, no personal social-media contact with children, follow the photo-consent rules on the child's record, and share anything that could be misread with your manager." },
        { k: "scenario", t: "A 14-year-old on your holiday scheme adds you on Instagram and messages you late at night. You:", choices: [
          { label: "Reply — it's friendly and builds trust", ok: false, fb: "Personal contact crosses a professional boundary and puts you both at risk." },
          { label: "Don't respond, don't accept, and tell your manager/DSL", ok: true, fb: "Correct — keep the boundary and be transparent so nothing can be misread." },
          { label: "Block them and say nothing", ok: false, fb: "Blocking is fine, but you must still tell your manager so it's on record." },
        ] },
        { k: "check", q: "Child-on-child abuse should be treated as:", opts: ["Banter to be ignored", "A safeguarding concern, taken as seriously as any other", "Something only the children should sort out", "A discipline issue only"], a: 1, fb: "Correct — never dismissed as “just kids”; it's a safeguarding concern." },
      ],
    },
  ],
};

const countyLines: CourseDoc = {
  id: "c4", title: "County Lines & Child Criminal Exploitation", cat: "Mandatory", cover: "county",
  blurb: "How children get pulled into drug running and crime, the warning signs at camp and club, and exactly what to do.",
  lessons: [
    {
      id: "l1", title: "What county lines really is", mins: 6, blocks: [
        { k: "art", art: "county", caption: "A “line” is a phone number used to sell drugs — and children are used to run them." },
        { k: "text", t: "County lines is a form of child criminal exploitation (CCE). Organised groups use a dedicated mobile phone — the “line” — to sell drugs, and they recruit children to move and store the drugs and money, often into towns away from the city. The child is the one taking the risk while the adults stay hidden." },
        { k: "callout", tone: "law", title: "Exploitation, not choice", t: "A child involved in county lines is a victim of abuse, even if they don't see it that way and even if they appear willing. Grooming, fear and debt make it feel like a choice when it isn't." },
        { k: "stat", value: "9–17", label: "typical age children are targeted, some younger" },
      ],
    },
    {
      id: "l2", title: "How grooming works — the debt bond", mins: 5, blocks: [
        { k: "steps", title: "The trap, step by step", items: [
          { h: "Attention & gifts", t: "New trainers, food, a phone, a sense of belonging or status — the child feels chosen and cared for." },
          { h: "The favour", t: "“Just hold this for me.” Small tasks build normality and obligation." },
          { h: "The debt bond", t: "Drugs or money “go missing” (often engineered) and the child is told they owe a debt they must work off — trapping them." },
          { h: "Fear & control", t: "Threats to them or their family keep them running the line, sometimes far from home." },
        ] },
        { k: "quote", t: "“They were the only people who seemed to want me around. By the time I owed them, it was too late to say no.”", by: "Survivor account, NSPCC" },
      ],
    },
    {
      id: "l3", title: "Warning signs to watch for", mins: 6, blocks: [
        { k: "points", title: "Signs a child may be exploited", items: [
          "Going missing from school, home or your sessions — especially found out-of-area.",
          "Unexplained money, new expensive clothes, trainers or more than one phone.",
          "A phone that rings constantly or that they're secretive and anxious about.",
          "Carrying travel tickets, hotel key cards or unfamiliar keys.",
          "Sudden change in friends, or an older “friend” or partner.",
          "Signs of assault, self-harm, or carrying a weapon such as a knife.",
          "Withdrawal, aggression, or being under the influence of drugs or alcohol.",
        ] },
        { k: "callout", tone: "warn", title: "One sign isn't proof — a cluster is a picture", t: "Any of these alone can be innocent. Several together, or a sharp change from how a child usually is, is exactly what you record and raise." },
        { k: "scenario", t: "A 13-year-old you know well turns up in brand-new trainers with a second phone that keeps buzzing, and is cagey about a weekend “trip” to another town. You:", choices: [
          { label: "Congratulate them on the trainers and leave it", ok: false, fb: "This cluster — cash, second phone, out-of-area trip, secrecy — is textbook. Don't let it pass." },
          { label: "Search their bag to find evidence", ok: false, fb: "Never investigate yourself. That's not your role and could put you both at risk." },
          { label: "Record what you noticed and tell your DSL today", ok: true, fb: "Correct — note the facts and pass straight to your DSL, who can involve the right agencies." },
        ] },
      ],
    },
    {
      id: "l4", title: "What to do", mins: 4, blocks: [
        { k: "steps", title: "Your response", items: [
          { h: "Stay calm & don't confront", t: "Don't accuse the child or any adult, and don't investigate — you could increase the danger." },
          { h: "Record the facts", t: "What you saw and heard, in their words, dated and signed." },
          { h: "Report to the DSL today", t: "They refer to children's social care and, where a child is at immediate risk, the police (999)." },
          { h: "Keep the relationship", t: "Stay a safe, consistent adult. Exploited children often trust no-one — your steadiness matters." },
        ] },
        { k: "check", q: "A child on your scheme is being exploited through county lines. They are primarily:", opts: ["A criminal to be reported to police for arrest", "A victim of child abuse who needs safeguarding", "A troublemaker to be excluded", "Someone else's problem"], a: 1, fb: "Correct — they are a victim of exploitation and a safeguarding concern first and foremost." },
      ],
    },
  ],
};

const saferRecruitment: CourseDoc = {
  id: "c5", title: "Safer Recruitment", cat: "Recommended", cover: "recruit",
  blurb: "Keep unsuitable people out and children safe — from the advert to the DBS check to a proper induction.",
  lessons: [
    {
      id: "l1", title: "Why safer recruitment matters", mins: 4, blocks: [
        { k: "art", art: "recruit", caption: "Deter, select, verify — every step is a safeguard." },
        { k: "text", t: "People who want to harm children look for organisations with weak checks. Safer recruitment is a set of steps that deter unsuitable applicants and make it far harder for them to get near children — it's part of safeguarding, not just HR." },
        { k: "callout", tone: "law", title: "Put safeguarding first, out loud", t: "Say in the advert and job description that the role works with children and carries safeguarding responsibilities, and that you follow safer-recruitment and DBS checks. This alone deters unsuitable applicants." },
      ],
    },
    {
      id: "l2", title: "The steps that matter", mins: 8, blocks: [
        { k: "steps", title: "From advert to first shift", items: [
          { h: "Clear role & advert", t: "State it involves working with children and the safeguarding duties that come with it." },
          { h: "Application, not just a CV", t: "Use a form that asks for a full history and an explanation of any gaps in employment — gaps are explored, not ignored." },
          { h: "Values-based interview", t: "Explore attitudes to children, boundaries and safeguarding — not just skills. Ask how they'd handle real situations." },
          { h: "Two references", t: "Always at least two written references, including from the most recent employer and someone who has seen them work with children. Verify them — don't just file them." },
          { h: "DBS & barred-list check", t: "An enhanced DBS check with a check of the children's barred list for regulated activity. Staff shouldn't start unsupervised work with children until it's back." },
          { h: "Identity & right to work", t: "Verify ID, qualifications and the right to work — confirm they are who they say they are." },
        ] },
        { k: "callout", tone: "warn", title: "Gaps and “won't-give-a-reference” are red flags", t: "Unexplained employment gaps, reluctance to name a recent manager, or references that avoid the question of working with children all deserve a closer look." },
      ],
    },
    {
      id: "l3", title: "After they're hired", mins: 4, blocks: [
        { k: "points", title: "Keep it safe past day one", items: [
          "A proper induction covering your safeguarding policy, code of conduct and who the DSL is.",
          "A probation period with supervision and a review.",
          "Keep a single central record of the checks done for every member of staff.",
          "Ongoing vigilance — safer recruitment doesn't end at the offer letter.",
        ] },
        { k: "check", q: "How many references should you take as a minimum for a role working with children?", opts: ["None if the interview went well", "One", "At least two, including the most recent employer", "Only a character reference from a friend"], a: 2, fb: "Correct — at least two written references, including the most recent employer and someone who's seen them work with children." },
      ],
    },
  ],
};

const prevent: CourseDoc = {
  id: "c6", title: "The Prevent Duty — Radicalisation Awareness", cat: "Mandatory", cover: "prevent",
  blurb: "Recognise when a child may be drawn towards extremism, and how to raise it early through Channel.",
  lessons: [
    {
      id: "l1", title: "What radicalisation is", mins: 5, blocks: [
        { k: "art", art: "prevent", caption: "Prevent is safeguarding — early, supportive, before harm is done." },
        { k: "text", t: "Radicalisation is the process by which someone comes to support terrorism or extremist ideologies. Prevent is the part of counter-terrorism that stops people being drawn in — and it works exactly like safeguarding: notice, support, refer early." },
        { k: "callout", tone: "info", title: "It's about vulnerability, not any one group", t: "Any child can be vulnerable to grooming into extremism — online or in person. It's not about a religion or community; it's about who is being targeted and why." },
      ],
    },
    {
      id: "l2", title: "Push, pull and warning signs", mins: 6, blocks: [
        { k: "points", title: "What makes a child vulnerable (push/pull)", items: [
          "A need to belong, for identity, status or adventure.",
          "Grievance, isolation, or feeling rejected or unheard.",
          "Online echo chambers and persuasive “recruiters”.",
        ] },
        { k: "points", title: "Signs to notice", items: [
          "Sudden intolerance, us-vs-them language, or scripted views they can't explain.",
          "Withdrawing from friends and family; secrecy about online activity.",
          "Fixation on a cause, or new symbols/language.",
          "A new, controlling older “friend” or group.",
        ] },
        { k: "callout", tone: "warn", title: "Curiosity isn't a crime", t: "Children explore ideas. It's a change in behaviour, secrecy, and hostility — not a single opinion — that you record and raise." },
      ],
    },
    {
      id: "l3", title: "Channel and what to do", mins: 4, blocks: [
        { k: "text", t: "Channel is a voluntary, supportive programme that helps people vulnerable to radicalisation — the goal is help, not punishment. As with any concern: respond calmly, record the facts, and report to your DSL the same day." },
        { k: "check", q: "The Prevent duty and Channel are best understood as:", opts: ["Spying on communities", "A form of early safeguarding and support", "Only the police's job", "About one particular religion"], a: 1, fb: "Correct — Prevent is safeguarding: early, supportive intervention before harm is done." },
      ],
    },
  ],
};

const allergy: CourseDoc = {
  id: "c7", title: "Allergy & Anaphylaxis Awareness", cat: "Mandatory", cover: "epipen",
  blurb: "Prevent reactions at camp, spot anaphylaxis fast, and use an adrenaline auto-injector with confidence.",
  lessons: [
    {
      id: "l1", title: "Allergens and prevention", mins: 5, blocks: [
        { k: "art", art: "epipen", caption: "Prevent first — know who, know the food, avoid cross-contact." },
        { k: "text", t: "An allergic reaction happens when the body treats a harmless food as a threat. For some children the reaction is mild; for others it's anaphylaxis — a life-threatening emergency. Prevention at camp is mostly about knowing your children and controlling food." },
        { k: "points", title: "The 14 major allergens (UK law)", items: [
          "Celery, cereals containing gluten, crustaceans, eggs, fish, lupin, milk, molluscs, mustard, tree nuts, peanuts, sesame, soya, sulphites.",
        ] },
        { k: "points", title: "Prevent it", items: [
          "Check each child's record for allergies before food or activities.",
          "Never share or swap food; watch for cross-contact on surfaces and hands.",
          "Read labels every time — recipes change.",
          "Know where each child's medication and care plan is kept.",
        ] },
      ],
    },
    {
      id: "l2", title: "Spotting anaphylaxis", mins: 5, blocks: [
        { k: "table", head: ["Mild–moderate", "Anaphylaxis — act now"], rows: [
          ["Itchy mouth, hives, swelling of lips/face", "Swollen tongue/throat, hoarse voice"],
          ["Tummy pain, being sick", "Difficulty breathing, wheeze, persistent cough"],
          ["A few hives", "Dizziness, collapse, pale/floppy, sense of “something wrong”"],
        ] },
        { k: "callout", tone: "warn", title: "ABC — Airway, Breathing, Consciousness", t: "Any one of these means anaphylaxis: trouble breathing, swelling of the throat/tongue, or feeling faint/collapsing. Don't wait to “see if it settles.”" },
      ],
    },
    {
      id: "l3", title: "If it's anaphylaxis", mins: 5, blocks: [
        { k: "steps", title: "Adrenaline first, every time", items: [
          { h: "Use the auto-injector now", t: "Give the child's adrenaline auto-injector (e.g. EpiPen) into the outer thigh — through clothing is fine. Adrenaline is the treatment; give it early." },
          { h: "Call 999", t: "Say “anaphylaxis.” Lie the child down, legs raised (sit up if breathing is hard). Keep them still." },
          { h: "Second dose", t: "If no improvement after 5 minutes and a second injector is available, give it." },
          { h: "Stay with them", t: "Note the time of each dose for the paramedics. Never let them stand or walk, even if they seem better." },
        ] },
        { k: "scenario", t: "A child eats a biscuit, then develops a hoarse voice and starts wheezing. Their care plan and auto-injector are in the bag. You:", choices: [
          { label: "Give antihistamine and watch for 10 minutes", ok: false, fb: "Throat symptoms + wheeze = anaphylaxis. Antihistamine is not enough — adrenaline first." },
          { label: "Use the adrenaline auto-injector and call 999", ok: true, fb: "Correct — adrenaline into the outer thigh immediately, then 999, then stay with them." },
          { label: "Call the parents first for permission", ok: false, fb: "Don't delay for permission — the care plan authorises you. Adrenaline and 999 come first." },
        ] },
      ],
    },
  ],
};

const online: CourseDoc = {
  id: "c8", title: "Online Safety for Children", cat: "Recommended", cover: "online",
  blurb: "The risks that follow children home — grooming, bullying and harmful content — and your part in keeping them safe.",
  lessons: [
    {
      id: "l1", title: "The risks in one place", mins: 5, blocks: [
        { k: "art", art: "online", caption: "Content, contact, conduct — the three online risks." },
        { k: "points", title: "The 3 Cs of online risk", items: [
          "Content — seeing harmful, violent or age-inappropriate material.",
          "Contact — being targeted by adults or groups (grooming, exploitation, radicalisation).",
          "Conduct — their own or others' behaviour, e.g. bullying or sharing images.",
        ] },
        { k: "callout", tone: "tip", title: "Your part", t: "You may not run their devices, but children disclose online worries to trusted adults. Keep the same rule: respond, record, report to the DSL." },
        { k: "check", q: "A child tells you an adult they met in a game keeps asking to meet in person. You:", opts: ["Tell them to just block the person", "Reassure them, record it, and report to the DSL today", "Ask them to get screenshots first", "Tell them not to play that game"], a: 1, fb: "Correct — online grooming is a safeguarding concern; respond warmly and report the same day." },
      ],
    },
  ],
};

const behaviour: CourseDoc = {
  id: "c3", title: "Positive Behaviour Management", cat: "Recommended", cover: "behaviour",
  blurb: "Calm, consistent, connection-first ways to manage behaviour and de-escalate without conflict.",
  lessons: [
    {
      id: "l1", title: "Behaviour is communication", mins: 5, blocks: [
        { k: "art", art: "behaviour", caption: "Connect before you correct." },
        { k: "text", t: "Challenging behaviour is almost always telling you something — a need not met, a feeling too big to manage, or a skill not yet learned. Your calm is the child's calm; escalating with them makes it worse." },
        { k: "points", title: "The foundations", items: [
          "Clear, simple, consistent expectations everyone knows.",
          "Notice and name the behaviour you want more of.",
          "Connect before you correct — the relationship does the heavy lifting.",
          "Consequences that are fair, expected and follow through.",
        ] },
      ],
    },
    {
      id: "l2", title: "De-escalation in the moment", mins: 5, blocks: [
        { k: "steps", title: "When it's heating up", items: [
          { h: "Lower everything", t: "Quiet voice, open body, more space, less audience. Drop your own arousal first." },
          { h: "Name the feeling", t: "“You look really frustrated.” Feeling understood takes the heat out." },
          { h: "Offer a way out", t: "A limited choice or a calm-down spot lets them save face." },
          { h: "Repair after", t: "When calm, reconnect and problem-solve together — not in the heat of it." },
        ] },
        { k: "scenario", t: "A child throws equipment after losing a game and is shouting. The best first move is to:", choices: [
          { label: "Raise your voice to take control", ok: false, fb: "Matching their volume escalates it. Lower yours instead." },
          { label: "Give a big consequence immediately in front of everyone", ok: false, fb: "Public consequences in the heat of it fuel shame and escalation. Deal with it once calm." },
          { label: "Lower your voice, give space, and name the feeling", ok: true, fb: "Correct — de-escalate first: calm, space, and “you're really frustrated.”" },
        ] },
      ],
    },
  ],
};

const dataProtection: CourseDoc = {
  id: "c9", title: "Data Protection & Confidentiality (GDPR)", cat: "Recommended", cover: "data",
  blurb: "Handle children's and families' information the way the law — and trust — demand.",
  lessons: [
    {
      id: "l1", title: "The basics that keep you safe", mins: 5, blocks: [
        { k: "art", art: "data", caption: "Only what you need, kept safe, shared only when right." },
        { k: "points", title: "Golden rules", items: [
          "Only access information you need to do your job.",
          "Keep registers, medical info and photos secure — never left out or on personal phones.",
          "Don't discuss a child's details where you can be overheard or with people who don't need to know.",
          "Photos and names only with consent recorded on the child's file.",
        ] },
        { k: "callout", tone: "law", title: "Safeguarding overrides confidentiality", t: "Data-protection rules never stop you sharing a safeguarding concern with your DSL or the authorities. Protecting a child always comes first." },
        { k: "check", q: "You're worried about a child's safety but the info is “confidential.” You:", opts: ["Keep it to yourself to respect privacy", "Share it with the DSL — safeguarding comes first", "Post it in the staff group chat", "Wait until you have proof"], a: 1, fb: "Correct — confidentiality never blocks a safeguarding disclosure to the right person." },
      ],
    },
  ],
};

const firstAid: CourseDoc = {
  id: "c2", title: "Paediatric First Aid Refresher", cat: "Mandatory", cover: "firstaid",
  blurb: "The life-saving basics — a primary survey, CPR, choking and when to call 999 — refreshed.",
  lessons: [
    {
      id: "l1", title: "Primary survey — DR ABC", mins: 5, blocks: [
        { k: "art", art: "firstaid", caption: "Danger, Response, Airway, Breathing, Circulation." },
        { k: "steps", title: "Every emergency starts here", items: [
          { h: "Danger", t: "Make sure it's safe for you and the child before you approach." },
          { h: "Response", t: "Gently check for a response — talk to them, tap their shoulders." },
          { h: "Airway", t: "Open the airway — tilt the head, lift the chin." },
          { h: "Breathing", t: "Look, listen and feel for normal breathing for up to 10 seconds." },
          { h: "Circulation", t: "If not breathing normally, call 999 and start CPR." },
        ] },
      ],
    },
    {
      id: "l2", title: "CPR & choking", mins: 6, blocks: [
        { k: "callout", tone: "warn", title: "Child CPR (1 year–puberty)", t: "5 rescue breaths first, then 30 compressions to 2 breaths. Compress one-third the depth of the chest, ~100–120 a minute. Keep going until help arrives or they recover." },
        { k: "steps", title: "Choking — can't cough, cry or breathe", items: [
          { h: "5 back blows", t: "Between the shoulder blades, heel of your hand." },
          { h: "5 abdominal thrusts", t: "(Over 1 year) sharp inward-and-upward pulls above the navel." },
          { h: "Repeat & call 999", t: "Alternate 5 and 5; call 999 if it doesn't clear or they become unresponsive (then start CPR)." },
        ] },
        { k: "check", q: "For a choking child who cannot cough or breathe, you start with:", opts: ["Abdominal thrusts", "5 back blows between the shoulder blades", "A drink of water", "Lying them down"], a: 1, fb: "Correct — five back blows first, then five abdominal thrusts, alternating." },
      ],
    },
  ],
};

const fireSafety: CourseDoc = {
  id: "c10", title: "Fire Safety Awareness", cat: "Recommended", cover: "fire",
  blurb: "Prevent, detect, evacuate — your role in keeping a setting fire-safe.",
  lessons: [
    {
      id: "l1", title: "Prevent and evacuate", mins: 4, blocks: [
        { k: "art", art: "fire", caption: "Know your exits before you need them." },
        { k: "points", title: "Every session", items: [
          "Know your escape routes and assembly point before children arrive.",
          "Keep fire doors shut and exits and corridors clear.",
          "Know where the alarm call-points and extinguishers are (but people over property).",
          "Take the register to the assembly point — it's your headcount.",
        ] },
        { k: "steps", title: "On the alarm", items: [
          { h: "Get children out", t: "Calmly lead them out by the nearest safe route — leave belongings." },
          { h: "Assemble & count", t: "Go to the assembly point and take the register immediately." },
          { h: "Report", t: "Tell the person in charge if anyone is unaccounted for. Never go back in." },
        ] },
      ],
    },
  ],
};

export const SEED_LIBRARY: CourseDoc[] = [
  safeguarding, countyLines, saferRecruitment, prevent, allergy, firstAid, behaviour, online, dataProtection, fireSafety,
];

export const blankCourse = (id: string): CourseDoc => ({
  id, title: "Untitled course", cat: "Recommended", cover: "shield", blurb: "",
  lessons: [{ id: "l1", title: "Lesson 1", mins: 3, blocks: [{ k: "text", t: "Start writing your lesson…" }] }],
});
