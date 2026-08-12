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
  | { k: "table"; head: string[]; rows: string[][] }
  // ——— interactive activities ———
  | { k: "sort"; prompt: string; buckets: string[]; items: { text: string; bucket: number }[] }   // drag each item into the right bucket
  | { k: "order"; prompt: string; items: string[] }                                                 // drag into the correct order (array = correct order)
  | { k: "match"; prompt: string; pairs: { l: string; r: string }[] }                               // match left to right
  | { k: "reveal"; prompt?: string; cards: { front: string; back: string }[] };                     // tap to flip

export interface QuizQ { q: string; opts: string[]; a: number; fb?: string }
export interface Lesson { id: string; title: string; mins: number; blocks: Block[] }
export interface CourseDoc { id: string; title: string; cat: "Mandatory" | "Recommended" | "Optional"; blurb: string; cover: string; lessons: Lesson[]; pass?: number; quiz?: QuizQ[] }

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
    { id: "l6", title: "Practise what you've learned", mins: 8, blocks: [
      { k: "sort", prompt: "Which type of abuse does each sign most point to? Drag each into a group.", buckets: ["Physical", "Emotional", "Sexual", "Neglect"], items: [
        { text: "Unexplained, patterned bruising", bucket: 0 }, { text: "Flinches when touched", bucket: 0 },
        { text: "Withdrawn, very low self-worth", bucket: 1 }, { text: "Extremes of compliance or defiance", bucket: 1 },
        { text: "Sexual language beyond their age", bucket: 2 }, { text: "Sudden fear of a specific person", bucket: 2 },
        { text: "Always hungry, poor hygiene", bucket: 3 }, { text: "Untreated health needs", bucket: 3 },
      ] },
      { k: "order", prompt: "Put your response to a disclosure in the right order.", items: [
        "Respond — listen, reassure, and don't promise secrecy",
        "Record — write the facts in the child's own words, dated and signed",
        "Report — tell the DSL the same day (sooner if there's immediate danger)",
      ] },
      { k: "match", prompt: "Match each safeguarding term to what it means.", pairs: [
        { l: "DSL", r: "Designated Safeguarding Lead — leads on safeguarding and decides referrals" },
        { l: "LADO", r: "Local Authority Designated Officer — handles allegations against staff" },
        { l: "Disclosure", r: "When a child tells you about abuse or harm" },
        { l: "Low-level concern", r: "A worry about an adult's behaviour, below the harm threshold" },
      ] },
      { k: "reveal", prompt: "Tap each specific safeguarding issue to see what to watch for.", cards: [
        { front: "County lines / CCE", back: "A child used to run drugs — going missing, unexplained cash, a second phone, found out-of-area." },
        { front: "Child sexual exploitation", back: "An older “partner”, gifts, secrecy, going missing, sexualised behaviour." },
        { front: "Online harm", back: "Grooming, bullying and harmful content — the risk follows the child home." },
        { front: "Radicalisation (Prevent)", back: "Drawn toward extremist views; Channel offers early, supportive help." },
      ] },
      { k: "check", q: "You can't reach the DSL or deputy and a child is in immediate danger. You should:", opts: ["Wait until the DSL is free", "Go home and try tomorrow", "Contact the police or children's social care directly", "Ask the child's parents to sort it"], a: 2, fb: "Correct — safeguarding never waits. Contact the police (999) or children's social care yourself." },
    ] },
  ],
  pass: 80,
  quiz: [
    { q: "Safeguarding is the responsibility of:", opts: ["Only the DSL", "Only managers", "Every member of staff", "Only qualified teachers"], a: 2, fb: "Everyone shares the responsibility to notice and act." },
    { q: "Which is NOT one of the four categories of abuse?", opts: ["Physical", "Emotional", "Financial", "Neglect"], a: 2, fb: "The four are physical, emotional, sexual and neglect. Financial abuse relates to adults." },
    { q: "A child begins to disclose and asks you to keep it a secret. You should:", opts: ["Promise secrecy so they keep talking", "Explain you must share it with the person who can help", "Stop them talking", "Tell them to speak to a friend"], a: 1, fb: "Never promise confidentiality — be honest you must share it." },
    { q: "When recording a disclosure you should write:", opts: ["Your opinion of who's to blame", "The facts, in the child's own words, dated and signed", "Only a brief summary weeks later", "Nothing — just tell someone"], a: 1, fb: "Facts, the child's words, same-day, dated and signed." },
    { q: "You must report a concern to your DSL:", opts: ["Within a month", "The same day", "Only if you're certain", "Only if the child asks you to"], a: 1, fb: "Act the same day — sooner if a child is in immediate danger." },
    { q: "A ‘cluster’ of small worries about a normally-happy child is:", opts: ["Nothing to act on without proof", "Enough to record and raise", "Only relevant if the child says so", "A discipline matter"], a: 1, fb: "You don't need proof — a pattern is exactly what you record and raise." },
    { q: "Child-on-child abuse should be:", opts: ["Dismissed as banter", "Left for the children to resolve", "Taken as seriously as any other safeguarding concern", "Only logged if a parent complains"], a: 2, fb: "Never minimised as ‘just kids’." },
    { q: "A teenager on your scheme adds you on social media and messages late at night. You:", opts: ["Reply to build trust", "Ignore, don't accept, and tell your manager/DSL", "Block and say nothing", "Meet up to talk it through"], a: 1, fb: "Keep the boundary and be transparent so nothing is misread." },
    { q: "The DSL's role includes:", opts: ["Deciding whether to refer to children's social care", "Punishing the child", "Investigating the family themselves", "Keeping concerns off any record"], a: 0, fb: "The DSL assesses, refers and coordinates — you notice and report." },
    { q: "A girl mentions a “special holiday to become a woman.” This may indicate:", opts: ["Nothing of concern", "A risk of FGM — record and report today", "A reward to celebrate", "A private family matter to ignore"], a: 1, fb: "Potential FGM risk — a safeguarding concern to raise immediately." },
    { q: "‘It could happen here’ means:", opts: ["Abuse only happens elsewhere", "Assume abuse can occur in your setting and stay alert", "Only worry about certain families", "Safeguarding is someone else's job"], a: 1, fb: "Never think ‘not our children’ — stay alert." },
    { q: "You can't reach the DSL and a child is in immediate danger. You:", opts: ["Wait for the DSL", "Contact the police or children's social care directly", "Do nothing until tomorrow", "Ask another child to help"], a: 1, fb: "Safeguarding never waits — contact the authorities yourself." },
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

const safeguardingL1: CourseDoc = {
  id: "c11", title: "Safeguarding Children (Level 1) — Awareness", cat: "Mandatory", cover: "shield",
  blurb: "The essentials for everyone: what abuse is, that it's your business, and how to raise a concern.",
  lessons: [
    { id: "l1", title: "The essentials", mins: 5, blocks: [
      { k: "art", art: "shield", caption: "If you're unsure — say something. Better a false alarm than a missed child." },
      { k: "text", t: "Level 1 is awareness: you don't need to be an expert, you need to notice and pass it on. Abuse can be physical, emotional, sexual or neglect — and it can happen anywhere, including here." },
      { k: "points", title: "Three things everyone must know", items: [
        "The four types of abuse and a few signs of each.",
        "Who your Designated Safeguarding Lead (DSL) is — before your first session.",
        "How to report: write the facts, tell the DSL the same day, never promise secrecy.",
      ] },
      { k: "callout", tone: "law", title: "If in doubt, report", t: "It is never your job to decide whether abuse is “really” happening. Your job is to notice and raise it. The DSL decides what happens next." },
      { k: "check", q: "You have a niggling worry about a child but no proof. You should:", opts: ["Wait until you're sure", "Record what you noticed and tell the DSL today", "Ask the child's friends", "Forget it — no proof"], a: 1, fb: "Correct — you don't need proof; note it and raise it the same day." },
    ] },
  ],
};

const safeguardingL3: CourseDoc = {
  id: "c12", title: "Safeguarding Children (Level 3) — DSL", cat: "Recommended", cover: "shield",
  blurb: "For Designated Safeguarding Leads: managing concerns, thresholds, referrals and allegations.",
  lessons: [
    { id: "l1", title: "The DSL's remit", mins: 6, blocks: [
      { k: "text", t: "As DSL you hold lead responsibility for safeguarding: you're the point of contact for staff, you decide on referrals, you keep secure records, and you liaise with children's social care, the police and other agencies. Deputies share the load so there's always cover." },
      { k: "points", title: "Your core duties", items: [
        "Receive, assess and act on concerns — deciding whether the threshold for a referral is met.",
        "Make referrals to children's social care and, where a child is at immediate risk, the police.",
        "Keep clear, secure, chronological records — separate from the main file.",
        "Manage allegations against staff and low-level concerns (see next lesson).",
        "Keep the safeguarding culture alive: train, remind, and make it easy to report.",
      ] },
    ] },
    { id: "l2", title: "Thresholds, referrals & allegations", mins: 6, blocks: [
      { k: "steps", title: "When a concern comes in", items: [
        { h: "Clarify the facts", t: "Get the recorded facts from the staff member; don't investigate the family yourself." },
        { h: "Assess the threshold", t: "Immediate danger → police/999. Significant harm → children's social care referral. Lower level → early help, monitor, review." },
        { h: "Refer & record", t: "Make the referral without delay, confirm in writing, and record your decision and reasons." },
        { h: "Follow up", t: "Chase for a response; escalate if you don't hear back. A referral is not the end." },
      ] },
      { k: "callout", tone: "warn", title: "Allegations against staff", t: "A concern that an adult may have harmed a child, or behaved in a way that suggests they're unsuitable, goes to the Local Authority Designated Officer (LADO). Handle low-level concerns early — patterns matter." },
      { k: "check", q: "A referral to children's social care gets no response after several days. You:", opts: ["Assume it's fine", "Chase it and escalate — a referral isn't the end", "Close the case", "Tell the parents to follow it up"], a: 1, fb: "Correct — follow up and escalate; the child's safety depends on it." },
    ] },
  ],
};

const autism: CourseDoc = {
  id: "c13", title: "Autism Awareness", cat: "Recommended", cover: "autism",
  blurb: "Understand autistic children and small, practical changes that make your camp or club work for them.",
  lessons: [
    { id: "l1", title: "What autism is", mins: 6, blocks: [
      { k: "art", art: "autism", caption: "A different way of experiencing the world — not less, just different." },
      { k: "text", t: "Autism is a lifelong difference in how a person communicates, relates to others and experiences the world. It's a spectrum — every autistic child is different — and it is not an illness to be “fixed”. Your job is to understand and adapt." },
      { k: "points", title: "Common differences", items: [
        "Social communication — may take language literally, find eye contact hard, or read tone and body language differently.",
        "Social interaction — may prefer their own company, or want to join in but not know how.",
        "Routine & change — predictability feels safe; unexpected change can be very distressing.",
        "Sensory — sounds, lights, textures, smells or crowds may feel overwhelming (or under-stimulating).",
        "Focused interests — deep, passionate interests that can be a brilliant way to connect.",
      ] },
      { k: "callout", tone: "info", title: "Behaviour is communication", t: "What looks like “naughtiness” or a “meltdown” is usually distress or sensory overload — not defiance. A meltdown is not a tantrum; it's an overwhelmed nervous system." },
    ] },
    { id: "l2", title: "Small changes, big difference", mins: 6, blocks: [
      { k: "steps", title: "Practical support at camp", items: [
        { h: "Prepare for change", t: "Give clear, visual timetables and warn about transitions: “Five more minutes, then we tidy up.”" },
        { h: "Communicate clearly", t: "Short, literal instructions. Avoid sarcasm and vague phrases. Allow processing time — count to ten before repeating." },
        { h: "Manage the senses", t: "Offer a quiet space, ear defenders, or a break from the crowd. Notice what overwhelms them and reduce it." },
        { h: "Use their interests", t: "Weave their passion into activities — it builds trust and engagement fast." },
      ] },
      { k: "scenario", t: "During a noisy, fast game an autistic child covers their ears, drops to the floor and won't respond. The best response is to:", choices: [
        { label: "Insist they rejoin so they don't miss out", ok: false, fb: "Pushing through overload makes it worse. They need less, not more." },
        { label: "Calmly reduce noise, give space and offer a quiet break", ok: true, fb: "Correct — lower the sensory load and let them regulate. Rejoin when ready." },
        { label: "Give a consequence for not joining in", ok: false, fb: "This is distress, not defiance — a consequence is unfair and unhelpful." },
      ] },
      { k: "callout", tone: "tip", title: "Ask the family", t: "Parents are the experts on their child. Ask what helps, what to avoid, and the words the child uses — then share it with the team." },
    ] },
  ],
};

const adhd: CourseDoc = {
  id: "c14", title: "ADHD Awareness", cat: "Recommended", cover: "adhd",
  blurb: "See past the labels of “disruptive” — understand ADHD and channel that energy positively.",
  lessons: [
    { id: "l1", title: "Understanding ADHD", mins: 6, blocks: [
      { k: "art", art: "adhd", caption: "Not won't sit still — can't, without support." },
      { k: "text", t: "ADHD (attention deficit hyperactivity disorder) affects how a child regulates attention, activity and impulses. It's a genuine neurological difference, not bad parenting or bad behaviour — and these children often have huge energy, creativity and enthusiasm to work with." },
      { k: "points", title: "Three presentations", items: [
        "Inattentive — easily distracted, forgetful, loses things, drifts off, hard to finish tasks.",
        "Hyperactive-impulsive — always on the go, fidgety, blurts out, interrupts, struggles to wait.",
        "Combined — a mix of both, the most common presentation.",
      ] },
      { k: "callout", tone: "info", title: "They're not choosing it", t: "A child with ADHD can't simply “try harder” to focus or sit still. Shaming rarely works and damages self-esteem — structure and encouragement do." },
    ] },
    { id: "l2", title: "Strategies that work", mins: 5, blocks: [
      { k: "points", title: "Set them up to succeed", items: [
        "Short, clear, one-step instructions — and check they've landed.",
        "Build in movement: jobs, active roles, regular breaks to burn energy.",
        "Structure and routine, with warnings before changes.",
        "Catch them being good — specific praise beats constant correction.",
        "Reduce distractions where they need to focus; seat them near an adult, not the door.",
      ] },
      { k: "scenario", t: "A child with ADHD keeps leaving the craft table and running around. A helpful first step is to:", choices: [
        { label: "Make them sit and finish before anyone else moves", ok: false, fb: "Forcing stillness usually backfires and fuels frustration." },
        { label: "Give them an active job and shorten the task into steps", ok: true, fb: "Correct — channel the energy and chunk the task; movement helps them focus." },
        { label: "Remove them from the activity as a punishment", ok: false, fb: "Exclusion damages self-esteem and rarely teaches the skill." },
      ] },
    ] },
  ],
};

const mentalHealth: CourseDoc = {
  id: "c15", title: "Children's Mental Health", cat: "Recommended", cover: "mind",
  blurb: "Spot when a child is struggling, know how to talk to them, and when to escalate.",
  lessons: [
    { id: "l1", title: "Noticing the signs", mins: 6, blocks: [
      { k: "art", art: "mind", caption: "You don't need to fix it — you need to notice and connect." },
      { k: "text", t: "One in five children has a probable mental-health condition. Camps and clubs can be a safe, positive break — and a place a struggling child is spotted. You're not a therapist; you're a trusted, steady adult who notices and passes on." },
      { k: "points", title: "Signs a child may be struggling", items: [
        "A clear change — withdrawn, tearful, irritable, or “not themselves”.",
        "Anxiety — clinginess, avoidance, physical complaints (tummy aches), constant reassurance-seeking.",
        "Low mood — flat, hopeless, tired, losing interest in things they loved.",
        "Signs of self-harm, disordered eating, or talk of not wanting to be here.",
      ] },
      { k: "callout", tone: "warn", title: "Take any talk of self-harm or suicide seriously", t: "Never dismiss it as attention-seeking. Stay calm, don't promise secrecy, and report to your DSL the same day — sooner if a child is in immediate danger." },
    ] },
    { id: "l2", title: "How to help", mins: 5, blocks: [
      { k: "steps", title: "If a child opens up", items: [
        { h: "Listen and validate", t: "“That sounds really hard. Thank you for telling me.” Don't rush to solve or minimise." },
        { h: "Stay calm and steady", t: "Your calm helps them feel safe. Don't react with shock or panic." },
        { h: "Be honest about sharing", t: "Explain you'll pass it to the person who can help — never promise to keep it secret." },
        { h: "Report and record", t: "Tell the DSL; they involve parents, GP or CAMHS as needed. Write down what was said." },
      ] },
      { k: "points", title: "Protective factors you can offer", items: [
        "A predictable, welcoming routine and a sense of belonging.",
        "One trusted adult who notices them.",
        "Success and fun — activities where they feel good at something.",
      ] },
      { k: "check", q: "A child quietly tells you they've been hurting themselves. You:", opts: ["Promise not to tell so they trust you", "Stay calm, thank them, and report to the DSL today", "Tell them to stop and move on", "Announce it so others can help"], a: 1, fb: "Correct — calm, validate, no secrecy, and report the same day." },
    ] },
  ],
};

const cse: CourseDoc = {
  id: "c16", title: "Child Sexual Exploitation (CSE)", cat: "Mandatory", cover: "cse",
  blurb: "How children are groomed and exploited for sex, the signs, and how to respond — it's abuse, never a choice.",
  lessons: [
    { id: "l1", title: "What CSE is", mins: 6, blocks: [
      { k: "art", art: "cse", caption: "Gifts, attention and “love” used to control and abuse." },
      { k: "text", t: "Child sexual exploitation is a type of abuse where a child is manipulated or coerced into sexual activity, often in exchange for something — attention, affection, gifts, money, status, or simply to stop threats. It happens to boys and girls, online and in person, and the child rarely sees themselves as a victim." },
      { k: "callout", tone: "law", title: "A child can never consent to their own abuse", t: "Even if it looks “consensual” or the child insists they're in a relationship, exploitation is abuse. Power, age and manipulation make real consent impossible." },
    ] },
    { id: "l2", title: "Grooming & warning signs", mins: 6, blocks: [
      { k: "points", title: "How grooming works", items: [
        "Targeting a vulnerable child and making them feel special and understood.",
        "Building dependence with gifts, alcohol, drugs or a sense of belonging.",
        "Isolating them from friends and family, then introducing secrecy, guilt and threats.",
      ] },
      { k: "points", title: "Signs to watch for", items: [
        "An older or controlling “boyfriend/girlfriend” or new secretive friends.",
        "Unexplained money, phones, gifts, or being collected by unknown adults.",
        "Going missing, staying out, or being found in unusual places.",
        "Secrecy about online contacts; sexualised behaviour or language beyond their age.",
        "Sexually transmitted infections, or physical signs of assault.",
      ] },
      { k: "scenario", t: "A 15-year-old is being picked up by a much older adult, has an expensive new phone, and is secretive and defensive about the “relationship.” You:", choices: [
        { label: "Warn them the relationship is wrong and confront the adult", ok: false, fb: "Never confront — it can escalate danger and push the child away." },
        { label: "Record the facts and report to the DSL the same day", ok: true, fb: "Correct — note it, don't investigate, and pass to the DSL who involves the right agencies." },
        { label: "Wait until you have proof it's sexual", ok: false, fb: "You don't need proof. A cluster of signs is enough to raise." },
      ] },
    ] },
  ],
};

const fgm: CourseDoc = {
  id: "c17", title: "FGM Awareness & Mandatory Reporting", cat: "Mandatory", cover: "fgm",
  blurb: "Female genital mutilation is illegal child abuse — recognise the risk and know your duty to report.",
  lessons: [
    { id: "l1", title: "What FGM is", mins: 5, blocks: [
      { k: "art", art: "fgm", caption: "Illegal. Harmful. A safeguarding emergency." },
      { k: "text", t: "Female genital mutilation (FGM) is the partial or total removal of, or injury to, the external female genitalia for non-medical reasons. It has no health benefits, causes serious lifelong harm, and is a criminal offence and a form of child abuse. It's also illegal to take a girl abroad for FGM." },
      { k: "callout", tone: "law", title: "The mandatory reporting duty", t: "In England & Wales, regulated professionals (teachers, health and social-care staff) have a legal duty to report to the police any case where a girl under 18 tells them she's had FGM, or they see physical signs of it. Whatever your role — always report concerns to your DSL, without delay." },
    ] },
    { id: "l2", title: "Risk signs & response", mins: 5, blocks: [
      { k: "points", title: "Possible warning signs", items: [
        "Talk of a “special procedure”, a ceremony to “become a woman”, or a long trip to visit family abroad (often over the summer holidays).",
        "A relative or “cutter” visiting from abroad.",
        "After a trip: being withdrawn, in pain, having trouble sitting, walking or with toileting.",
        "Reluctance to be involved in physical activity, or asking for help with something they can't explain.",
      ] },
      { k: "steps", title: "If you're worried", items: [
        { h: "Before it happens (a girl at risk)", t: "This is a safeguarding concern — record it and tell your DSL the same day so protection can be put in place." },
        { h: "If it has happened", t: "Report to the DSL immediately; the mandatory duty means the police must be informed for a known case in an under-18." },
        { h: "Stay factual & sensitive", t: "Don't examine the child or promise secrecy. Record the facts in the child's words." },
      ] },
      { k: "check", q: "A 9-year-old mentions a “special holiday to become a woman.” You:", opts: ["Assume it's just a family celebration", "Record it and tell the DSL the same day", "Ask lots of detailed questions first", "Tell her parents you're concerned"], a: 1, fb: "Correct — this is a potential FGM risk; record and report to the DSL immediately." },
    ] },
  ],
};

const domestic: CourseDoc = {
  id: "c18", title: "Domestic Abuse — the Impact on Children", cat: "Recommended", cover: "domestic",
  blurb: "Children living with domestic abuse are victims in their own right — recognise it and respond.",
  lessons: [
    { id: "l1", title: "Children are victims too", mins: 5, blocks: [
      { k: "art", art: "domestic", caption: "Living with abuse harms a child, even if they're “only” watching." },
      { k: "text", t: "Domestic abuse isn't only physical — it includes emotional, psychological, financial, sexual and coercive-controlling behaviour between people aged 16+ who are personally connected. Crucially, a child who sees, hears or lives with domestic abuse is legally recognised as a victim in their own right (Domestic Abuse Act 2021)." },
      { k: "points", title: "How it can show in a child", items: [
        "Anxiety, aggression, withdrawal or being unusually watchful.",
        "Regression, poor sleep, low self-worth, or difficulty trusting adults.",
        "Talking about violence or fear at home; worry about a parent.",
        "Being tired, hungry or unkempt if home life is chaotic.",
      ] },
    ] },
    { id: "l2", title: "Responding safely", mins: 4, blocks: [
      { k: "callout", tone: "warn", title: "Confidentiality can be safety-critical", t: "Be careful who you speak to and how — the wrong word to the wrong adult can put a child or parent in danger. Share only with your DSL." },
      { k: "steps", title: "If you have a concern", items: [
        { h: "Respond & record", t: "Listen without judgement, don't promise secrecy, and write the facts down." },
        { h: "Report to the DSL", t: "They assess risk and involve the right agencies. In immediate danger, call 999." },
        { h: "Keep it safe", t: "Don't contact the alleged abuser or investigate — you could increase the risk." },
      ] },
    ] },
  ],
};

const foodSafety: CourseDoc = {
  id: "c19", title: "Food Safety & Hygiene", cat: "Recommended", cover: "food",
  blurb: "The everyday basics of preparing and serving food safely to children — the 4 Cs and allergens.",
  lessons: [
    { id: "l1", title: "The 4 Cs", mins: 5, blocks: [
      { k: "art", art: "food", caption: "Cleaning · Cooking · Chilling · Cross-contamination." },
      { k: "text", t: "Most food-poisoning at settings comes down to four things going wrong. Get the 4 Cs right and you prevent almost all of it." },
      { k: "table", head: ["The 4 Cs", "What it means"], rows: [
        ["Cleaning", "Wash hands well and often; keep surfaces, boards and utensils clean."],
        ["Cooking", "Cook food thoroughly — piping hot all the way through, especially chicken, mince and eggs."],
        ["Chilling", "Keep cold food cold (fridge ≤ 5°C); don't leave food out; cool and refrigerate leftovers quickly."],
        ["Cross-contamination", "Keep raw and ready-to-eat foods apart; separate boards; wash hands between them."],
      ] },
      { k: "points", title: "Personal hygiene", items: [
        "Wash hands before handling food, after the toilet, and after touching raw food or bins.",
        "Tie hair back, cover cuts with a blue plaster, and don't handle food if you have sickness or diarrhoea.",
      ] },
    ] },
    { id: "l2", title: "Allergens — Natasha's Law", mins: 4, blocks: [
      { k: "callout", tone: "law", title: "The 14 allergens must be known and declared", t: "Always know which of the 14 major allergens are in the food you serve, check every child's record, and never guess. Cross-contact can be as dangerous as the ingredient itself." },
      { k: "check", q: "You're serving a snack and aren't sure if it contains nuts. You should:", opts: ["Serve it — it's probably fine", "Check the label and the children's allergy records before serving", "Ask a child if they're allergic", "Remove obvious nuts and serve"], a: 1, fb: "Correct — never guess with allergens; check the label and the records every time." },
    ] },
  ],
};

export const SEED_LIBRARY: CourseDoc[] = [
  safeguarding, safeguardingL1, safeguardingL3, countyLines, cse, fgm, prevent, saferRecruitment,
  autism, adhd, mentalHealth, behaviour, domestic, allergy, foodSafety, firstAid, online, dataProtection, fireSafety,
];

export const blankCourse = (id: string): CourseDoc => ({
  id, title: "Untitled course", cat: "Recommended", cover: "shield", blurb: "",
  lessons: [{ id: "l1", title: "Lesson 1", mins: 3, blocks: [{ k: "text", t: "Start writing your lesson…" }] }],
});
