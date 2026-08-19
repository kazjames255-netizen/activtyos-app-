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
  | { k: "image"; src: string; caption?: string }                                                  // uploaded (data URL) or linked image
  | { k: "video"; src: string; caption?: string }                                                  // mp4 / YouTube / Vimeo URL
  // ——— interactive activities ———
  | { k: "sort"; prompt: string; buckets: string[]; items: { text: string; bucket: number }[] }   // drag each item into the right bucket
  | { k: "order"; prompt: string; items: string[] }                                                 // drag into the correct order (array = correct order)
  | { k: "match"; prompt: string; pairs: { l: string; r: string }[] }                               // match left to right
  | { k: "reveal"; prompt?: string; cards: { front: string; back: string }[] }                       // tap to flip
  | { k: "figure"; fig: string; caption?: string }                                                    // a detailed inline SVG diagram (see CourseFigures)
  // ——— animated, video-like lesson ———
  | { k: "motion"; title?: string; voice?: boolean; accent?: string; scenes: MotionScene[] };         // scene-based motion-graphics film with synced narration/captions

// One scene of a motion lesson. `visual` selects a scene renderer (like the ART
// registry). `seconds` is the authored budget (the literal duration in text
// mode; the minimum dwell in voice mode — the voice can hold the scene longer).
export interface MotionScene {
  id: string;
  visual: string;
  seconds: number;
  narration: string;                 // spoken aloud AND used to time the key words
  keys?: string[];                    // key words that pop up in sync with the narration (substrings of it, in order)
  onScreenText?: OnScreenText[];      // (legacy) kinetic phrases; superseded by `keys`
  props?: Record<string, unknown>;    // per-template knobs (icon, items, value, good/bad, …)
  interactive?: boolean;             // pause the film here until the learner answers (your-turn beat)
  choices?: { label: string; ok: boolean; fb: string }[];
}
export interface OnScreenText { t: string; at?: number; until?: number; emphasis?: "normal" | "strong" | "muted" }

export interface QuizQ { q: string; opts: string[]; a: number; fb?: string }
export interface Lesson { id: string; title: string; mins: number; blocks: Block[]; hidden?: boolean }
export interface CourseDoc {
  id: string; title: string; cat: "Mandatory" | "Recommended" | "Optional"; blurb: string; cover: string;
  category?: string;          // topical category key (for company-created courses; platform courses use COURSE_META)
  logo?: string;              // uploaded brand logo (data URL) shown in the player for company courses
  theme?: string;             // course builder colour palette id (see courseTheme.ts); themes the player accents
  renewMonths?: number;       // how often this course must be renewed (months); certificate expiry = completed + this
  lessons: Lesson[]; pass?: number;
  quiz?: QuizQ[];              // the master end-of-course question bank (= Version 1)
  quizzes?: QuizQ[][];         // optional hand-authored alternative versions (up to 3); overrides derivation
  activeQuiz?: number;         // which end-of-course quiz version is live (0-based)
}
import { GENERATED_COURSES } from "./courseContent.generated";
import { NEW_COURSES } from "./courseContent.newcourses";

// ————————————————————————————————————————————————————————————————
// END-OF-COURSE QUIZ VERSIONS
// Every course has THREE selectable versions of its end-of-course quiz so an
// operator can switch which one learners get (e.g. to stop retakes memorising
// answer positions). Version 1 is the master bank; Versions 2 & 3 reshuffle the
// question order and rotate the answer options (with the correct index remapped)
// unless the course hand-authors its own `quizzes` array.
// ————————————————————————————————————————————————————————————————
export const QUIZ_VERSION_LABELS = ["Version 1", "Version 2", "Version 3"];
const rotate = <T,>(arr: T[], by: number): T[] => { const n = arr.length; if (!n) return arr; const s = ((by % n) + n) % n; return arr.map((_, i) => arr[(i + s) % n]); };
function variantOf(qs: QuizQ[], qShift: number, oShift: number): QuizQ[] {
  return rotate(qs, qShift).map((q) => {
    const n = q.opts.length; const s = ((oShift % n) + n) % n;
    return { ...q, opts: q.opts.map((_, k) => q.opts[(k + s) % n]), a: ((q.a - s) % n + n) % n };
  });
}
export function quizVersions(course: CourseDoc): QuizQ[][] {
  if (course.quizzes && course.quizzes.length) return course.quizzes.slice(0, 3);
  const base = course.quiz ?? [];
  if (!base.length) return [];
  return [base, variantOf(base, Math.ceil(base.length / 2), 1), variantOf(base, (Math.floor(base.length / 3) || 1) + 1, 2)];
}
export function activeQuizVersion(course: CourseDoc): { qs: QuizQ[]; idx: number; count: number } {
  const vs = quizVersions(course);
  const idx = Math.min(Math.max(course.activeQuiz ?? 0, 0), Math.max(vs.length - 1, 0));
  return { qs: vs[idx] ?? [], idx, count: vs.length };
}

// ————————————————————————————————————————————————————————————————
// SEED COURSES
// ————————————————————————————————————————————————————————————————

const safeguarding: CourseDoc = {
 "id": "c1",
 "title": "Safeguarding Children (Level 2)",
 "cat": "Mandatory",
 "cover": "shield",
 "blurb": "The core course for everyone who works directly and regularly with children. Builds on Level 1 awareness: recognise abuse and wider risks, respond to disclosures, understand thresholds and early help, work safely, and report the same day. Grounded primarily in Working Together to Safeguard Children 2023 and our own safeguarding policy (with good practice drawn from Keeping Children Safe in Education). Progression: Level 1 = awareness, Level 2 = this course, Level 3 = advanced DSL training.",
 "pass": 80,
 "lessons": [
  {
   id: "l0",
   title: "Watch first — Safeguarding in two minutes",
   mins: 2,
   blocks: [
    { k: "text", t: "Before the detail, here's the whole of safeguarding in one short film. Press play — turn your sound on, or switch to text at the bottom." },
    {
     k: "motion",
     title: "Safeguarding in two minutes",
     scenes: [
      { id: "s0", visual: "intro", seconds: 5, narration: "Safeguarding. The whole of it — in two minutes.", keys: ["Safeguarding", "two minutes"] },
      { id: "s1", visual: "cold-open", seconds: 8, narration: "Every day, Kai raced in first. Today he's last. Hood up. Silent. You notice.", keys: ["raced in first", "Hood up", "Silent", "You notice"] },
      { id: "s2", visual: "everyone", seconds: 7, narration: "You don't need a title to keep a child safe. Safeguarding is everyone's job.", keys: ["a title", "keep a child safe", "everyone's job"] },
      { id: "s3", visual: "notice", seconds: 12, narration: "A mark no one can explain. A flinch near the changing rooms. A child who's gone quiet. Notice the change.", keys: ["A mark", "A flinch", "gone quiet", "Notice the change"] },
      { id: "s4", visual: "respond", seconds: 8, narration: "If he opens up, stay calm. Listen — don't dig. Let him use his own words.", keys: ["stay calm", "Listen", "his own words"] },
      { id: "s5", visual: "not-secret", seconds: 10, narration: "Never promise to keep it secret. Say: to keep you safe, I'll share this with the person who can help.", keys: ["Never promise", "secret", "to keep you safe", "the person who can help"] },
      { id: "s6", visual: "record", seconds: 8, narration: "Then write it down. The facts, the time, his own words. Not what you assume.", keys: ["write it down", "The facts", "his own words", "Not what you assume"] },
      { id: "s7", visual: "report", seconds: 8, narration: "Now hand it on. Tell your Designated Safeguarding Lead the same day. Every time.", keys: ["hand it on", "Designated Safeguarding Lead", "the same day"] },
      { id: "s8", visual: "your-turn", seconds: 11, narration: "But if a child is in immediate danger, don't wait. Your turn — what's your first move?", onScreenText: [{ t: "Your turn.", at: 0.2 }], interactive: true, choices: [
        { label: "Investigate it yourself first", ok: false, fb: "No — you never investigate. Notice, record, report." },
        { label: "Wait and tell someone tomorrow", ok: false, fb: "Safeguarding never waits — immediate danger means act now." },
        { label: "Call 999 or children's social care", ok: true, fb: "Right. Immediate danger: call 999 or children's social care straight away." },
      ] },
      { id: "s9", visual: "close", seconds: 9, narration: "Notice. Respond. Record. Report — the same day. That's how you keep every child safe.", keys: ["Notice", "Respond", "Record", "Report", "keep every child safe"] },
     ],
    },
    { k: "callout", tone: "tip", title: "That's the whole job", t: "Everything else in this course is detail on those four steps. If you only remember one thing: Notice, Respond, Record, Report — and tell the DSL the same day." },
   ],
  },
  {
   "id": "l1",
   "title": "Safeguarding at Level 2 — from awareness to action",
   "mins": 6,
   "blocks": [
    {
     "k": "art",
     "art": "shield",
     "caption": "Level 2 turns awareness into confident, correct action."
    },
    {
     "k": "text",
     "t": "Level 1 gave you the awareness that safeguarding is everyone's job and that abuse can happen anywhere. This is a short bridge, not a re-teach: Level 2 is for everyone who works directly and regularly with children, and it builds the practical judgement to recognise a wider range of harm, respond well to a disclosure, understand how the system decides what help a child needs, and record and report to a defensible standard. On camp or at club you are often the adult a child sees most, which makes you one of the most important people in their safety net."
    },
    {
     "k": "callout",
     "tone": "law",
     "title": "The golden rule",
     "t": "'It could happen here.' Assume abuse can occur in your setting and stay alert. Working Together to Safeguard Children 2023 places a shared duty on every member of staff to notice, record and act."
    },
    {
     "k": "callout",
     "tone": "info",
     "title": "Which framework do we work to?",
     "t": "Camps and clubs work primarily to Working Together to Safeguard Children 2023 and to our own safeguarding policy, and (where we are Ofsted-registered for early years) to the EYFS and Ofsted requirements. Keeping Children Safe in Education is the statutory framework for schools and colleges. We are not a school, so we borrow its good practice but it is not our governing framework."
    },
    {
     "k": "points",
     "title": "What Level 2 will make second nature",
     "items": [
      "Recognise the signs of the four categories of abuse and the wider risks around them.",
      "Respond calmly and correctly if a child tells you something, and record it to a defensible standard.",
      "Understand thresholds and early help, so you know why some concerns get an early-help conversation and others a child-protection referral.",
      "Work within safe professional boundaries and know the specific risks — exploitation, online harm, radicalisation, FGM.",
      "Overcome the very human barriers that stop people speaking up."
     ]
    },
    {
     "k": "reveal",
     "prompt": "Quick refresher from Level 1 — tap each card.",
     "cards": [
      {
       "front": "Safeguarding vs child protection",
       "back": "Safeguarding is the broad, proactive work of keeping ALL children safe and well. Child protection is the sharper response for a specific child at risk of significant harm."
      },
      {
       "front": "The paramountcy principle",
       "back": "The Children Act 1989 makes the child's welfare the paramount consideration, above adult convenience or reputation."
      },
      {
       "front": "Your job in four words",
       "back": "Notice, Respond, Record, Report. You don't investigate and you don't need to be certain."
      }
     ]
    },
    {
     "k": "check",
     "q": "How does Level 2 differ from Level 1?",
     "opts": [
      "It replaces the need for a DSL",
      "It moves from general awareness to the practical judgement to recognise, respond, record and report",
      "It is only for managers",
      "It removes your duty to act"
     ],
     "a": 1,
     "fb": "Correct — Level 1 builds awareness; Level 2 builds the practical judgement and skills to act well. Level 3 then trains the DSL in depth."
    }
   ]
  },
  {
   "id": "l2",
   "title": "The four categories of abuse & their signs",
   "mins": 9,
   "blocks": [
    {
     "k": "text",
     "t": "UK guidance groups abuse into four categories: physical, emotional, sexual and neglect. At Level 2 the skill is not just naming them but reading a pattern: abuse is rarely obvious, several types often overlap, and a run of small signs matters as much as one dramatic one. You are not there to diagnose — you are there to notice and pass it on."
    },
    {
     "k": "table",
     "head": [
      "Type",
      "What it is",
      "Signs you might notice"
     ],
     "rows": [
      [
       "Physical",
       "Deliberately causing harm — hitting, shaking, burning, poisoning.",
       "Unexplained or patterned bruising, burns, injuries at different stages of healing, flinching from touch, inconsistent stories."
      ],
      [
       "Emotional",
       "Persistent harm to a child's emotional development.",
       "Withdrawn or over-anxious, low self-worth, extremes of compliance or defiance, delayed development."
      ],
      [
       "Sexual",
       "Forcing or enticing a child into sexual activity (incl. online, contact and non-contact).",
       "Sexualised language or play beyond their age, fear of a person or place, regression, sleep problems, reluctance to change clothes for sport or swimming."
      ],
      [
       "Neglect",
       "Persistent failure to meet basic physical or emotional needs.",
       "Poor hygiene, always hungry, unsuitable clothing, untreated health needs, poor supervision, frequent absence."
      ]
     ]
    },
    {
     "k": "callout",
     "tone": "warn",
     "title": "Trust your instinct",
     "t": "You don't need proof. A change in a normally happy child, or a small comment that sits wrong with you, is enough to record and raise. A pattern of 'little' things is often the picture — neglect in particular is easy to normalise and is the most commonly identified category."
    },
    {
     "k": "sort",
     "prompt": "Sort each indicator under the category it most points to.",
     "buckets": [
      "Physical",
      "Emotional",
      "Sexual",
      "Neglect"
     ],
     "items": [
      {
       "text": "Bruising shaped like a hand or object",
       "bucket": 0
      },
      {
       "text": "Injuries at different stages of healing",
       "bucket": 0
      },
      {
       "text": "Desperate to please, very low self-worth",
       "bucket": 1
      },
      {
       "text": "Extremes of passivity or aggression",
       "bucket": 1
      },
      {
       "text": "Sexual knowledge inappropriate for their age",
       "bucket": 2
      },
      {
       "text": "Sudden fear of a specific person",
       "bucket": 2
      },
      {
       "text": "Always hungry, dressed for the wrong weather",
       "bucket": 3
      },
      {
       "text": "Untreated medical or dental needs",
       "bucket": 3
      }
     ]
    },
    {
     "k": "scenario",
     "t": "A usually bubbly 8-year-old has been quiet all week and today flinched when you patted their shoulder to say well done. What do you do?",
     "choices": [
      {
       "label": "Decide it's probably nothing and carry on",
       "ok": false,
       "fb": "A clear change plus flinching is exactly the kind of thing to note. Don't explain it away."
      },
      {
       "label": "Ask them repeatedly what's wrong until they tell you",
       "ok": false,
       "fb": "Never interrogate. Stay warm and available, but don't press or lead."
      },
      {
       "label": "Note what you saw factually and tell your DSL today",
       "ok": true,
       "fb": "Exactly right — observe, record the facts, and pass to the DSL the same day."
      }
     ]
    },
    {
     "k": "check",
     "q": "A child at your club is regularly hungry, often has no coat in winter and has an untreated skin condition. This most points to:",
     "opts": [
      "Physical abuse",
      "Neglect",
      "Emotional abuse",
      "Nothing — children forget coats"
     ],
     "a": 1,
     "fb": "A persistent pattern of unmet basic needs is the hallmark of neglect — record it and pass it to the DSL."
    }
   ]
  },
  {
   "id": "l3",
   "title": "Wider risks — peer abuse, exploitation, online & extremism",
   "mins": 9,
   "blocks": [
    {
     "k": "text",
     "t": "Harm doesn't only come from adults at home. Increasingly children are harmed by other children, online, or by people who deliberately exploit them for sex or crime. Much of this harm happens outside the family — in peer groups, neighbourhoods, on transport and online. Assessing and responding to those wider settings, not just the home, is called 'contextual safeguarding', and a child can be well cared for at home yet exploited in the community."
    },
    {
     "k": "art",
     "art": "county",
     "caption": "Exploitation is abuse disguised as friendship, status or a good time."
    },
    {
     "k": "points",
     "title": "Named safeguarding issues to know",
     "items": [
      "Child-on-child (peer) abuse — bullying, sexual harassment or violence, sharing nudes, initiation or 'hazing'; never 'banter' or 'kids being kids'.",
      "Child sexual exploitation (CSE) — a child manipulated into sexual activity for gifts, status or affection (see the CSE course).",
      "Child criminal exploitation and county lines (CCE) — coerced into moving drugs, money or weapons (see the County Lines course).",
      "Online safety — grooming, bullying and harmful content; the risk follows the child home and moves across apps in minutes.",
      "Radicalisation (Prevent) — drawn toward extremist views; Channel offers early, voluntary support.",
      "FGM — illegal in the UK and a form of child abuse."
     ]
    },
    {
     "k": "callout",
     "tone": "law",
     "title": "FGM: who holds the mandatory reporting duty?",
     "t": "The legal duty to report a known case of FGM in an under-18 directly to the police falls only on teachers and on regulated health and social care professionals — not on camp or club staff generally. If a child discloses FGM to you, or you see signs, treat it like any other disclosure: record it and report to the DSL the same day, and the DSL ensures the police are informed."
    },
    {
     "k": "callout",
     "tone": "info",
     "title": "Mental health is a safeguarding issue",
     "t": "A child's mental health and emotional wellbeing can be a safeguarding concern in its own right. Significant distress, self-harm, disordered eating or thoughts of suicide are not 'just a phase' to manage alone — record what you notice and pass it to the DSL, who can arrange the right support."
    },
    {
     "k": "points",
     "title": "Online harm — the KCSIE four Cs",
     "items": [
      "Content — being exposed to harmful, illegal or age-inappropriate material.",
      "Contact — harmful interaction with others, including grooming by adults or peers.",
      "Conduct — the child's own online behaviour that increases risk, e.g. sharing nudes.",
      "Commerce — financial risks such as scams, gambling and coercion into money muling."
     ]
    },
    {
     "k": "reveal",
     "prompt": "Tap each risk to see what to watch for.",
     "cards": [
      {
       "front": "County lines / CCE",
       "back": "Going missing, unexplained cash or gifts, a second phone, found out-of-area, an unpayable 'debt' to older 'friends'."
      },
      {
       "front": "Child sexual exploitation",
       "back": "An older 'partner', gifts, secrecy, going missing, hotel key cards, sexualised behaviour. Boys are exploited too and often missed."
      },
      {
       "front": "Online harm & sextortion",
       "back": "Secrecy about who they talk to, night-time anxiety about a phone, being coerced into images then blackmailed with them."
      },
      {
       "front": "Radicalisation (Prevent)",
       "back": "Sudden extreme 'us and them' views from a group chat, new symbols, withdrawing from old friends. Notice, Check, Share."
      }
     ]
    },
    {
     "k": "scenario",
     "t": "A 13-year-old shows off an expensive new phone and mentions an older 'boyfriend' she met online who 'gets her whatever she wants'; she's twice slipped away from a trip to 'meet a friend'. You:",
     "choices": [
      {
       "label": "Leave it — she seems happy and it's not your business who she dates",
       "ok": false,
       "fb": "Unexplained gifts, a secretive older online 'partner' and going missing are classic exploitation indicators. This needs a safeguarding response."
      },
      {
       "label": "Warn her that older boyfriends are dangerous and tell her to end it",
       "ok": false,
       "fb": "Confronting or lecturing can push her away and alert the perpetrator. Record and report instead."
      },
      {
       "label": "Record exactly what you saw and heard, keep her safe on the trip, and tell the DSL without delay",
       "ok": true,
       "fb": "Correct — note the facts, maintain supervision, and pass to the DSL. Don't investigate or confront."
      }
     ]
    },
    {
     "k": "check",
     "q": "Child-on-child abuse should be treated as:",
     "opts": [
      "Banter to be ignored",
      "A safeguarding concern, taken as seriously as any other",
      "Something only the children should sort out",
      "A discipline issue only"
     ],
     "a": 1,
     "fb": "Correct — never dismissed as 'just kids'; it's a safeguarding concern for both the harmed child and the child causing harm."
    }
   ]
  },
  {
   "id": "l4",
   "title": "If a child discloses: the 5 R's",
   "mins": 8,
   "blocks": [
    {
     "k": "art",
     "art": "listen",
     "caption": "Listen, reassure, and take it seriously — then pass it on."
    },
    {
     "k": "text",
     "t": "It takes courage for a child to tell an adult they've been harmed, and they often test the water with a small hint first. How you react in those first moments shapes whether they feel believed and whether the information can later protect them. The recognised model has five steps — Receive, Reassure, React, Record, Refer — and it fits inside your job in four words: Notice, Respond, Record, Report."
    },
    {
     "k": "steps",
     "title": "The 5 R's of responding to a disclosure",
     "items": [
      {
       "h": "Receive",
       "t": "Stay calm and give full attention. Let the child speak in their own words. Never promise to keep it secret."
      },
      {
       "h": "Reassure",
       "t": "Tell them they've done the right thing and are not in trouble — without promising secrecy."
      },
      {
       "h": "React",
       "t": "Don't interrupt or interrogate. Use only open TED prompts (Tell me, Explain, Describe); avoid leading questions like 'Did your dad hit you?'"
      },
      {
       "h": "Record",
       "t": "As soon as you can, write the facts — date, time, the child's own words, what you saw, their demeanour, and what you did. Sign and date it. Opinion goes on a separate line marked as opinion."
      },
      {
       "h": "Refer",
       "t": "Tell your Designated Safeguarding Lead the same day — sooner if a child is in immediate danger. The DSL then decides next steps and contacts agencies."
      }
     ]
    },
    {
     "k": "callout",
     "tone": "warn",
     "title": "Never say 'I promise I won't tell anyone'",
     "t": "You cannot keep a safeguarding disclosure secret. Instead say: 'Thank you for telling me. To keep you safe I need to share this with one person whose job is to help.'"
    },
    {
     "k": "callout",
     "tone": "law",
     "title": "If a child names a worker or volunteer as the abuser",
     "t": "Allegations against an adult who works or volunteers with children follow a different route: they go to your manager and the Local Authority Designated Officer (LADO), who oversees how the allegation is handled. Don't investigate it yourself and don't warn the person — record the facts and report immediately so the LADO route can start."
    },
    {
     "k": "order",
     "prompt": "Put the 5 R's of responding to a disclosure in order.",
     "items": [
      "Receive — stay calm, give full attention, let them speak in their own words",
      "Reassure — tell them they were right to tell you, without promising secrecy",
      "React — no interrupting, no leading questions, only open TED prompts",
      "Record — the facts in the child's own words, dated and signed",
      "Refer — tell the DSL the same day"
     ]
    },
    {
     "k": "check",
     "q": "A child starts to tell you something serious and asks you to keep it a secret. You should:",
     "opts": [
      "Promise to keep the secret so they keep talking",
      "Explain you can't keep it secret but will only tell the person who can help",
      "Stop them talking immediately",
      "Tell them to speak to their parents"
     ],
     "a": 1,
     "fb": "Correct — be honest that you must share it, with the one person whose job is to help. Never promise secrecy."
    }
   ]
  },
  {
   "id": "l5",
   "title": "Recording well & the DSL",
   "mins": 7,
   "blocks": [
    {
     "k": "text",
     "t": "Records are the backbone of protection: they evidence what was known and when, and let patterns be seen over time. A weak record can hide a child's true situation. Every provider has a Designated Safeguarding Lead (DSL) — and a deputy — with lead responsibility for safeguarding. Know who yours is before your first session, and where the policy and reporting forms are kept."
    },
    {
     "k": "points",
     "title": "What makes a good safeguarding record",
     "items": [
      "Factual and objective — what you saw and heard, not what you assume.",
      "The child's own words in quotation marks where possible.",
      "Date, time, location and who else was present.",
      "The child's demeanour, and any injury described (not photographed by you).",
      "Written as soon as possible, then signed, dated and stored securely."
     ]
    },
    {
     "k": "sort",
     "prompt": "Sort each phrase into a GOOD record entry or a POOR one.",
     "buckets": [
      "Good record",
      "Poor record"
     ],
     "items": [
      {
       "text": "'At 3.10pm J said: Daddy hit me with his belt'",
       "bucket": 0
      },
      {
       "text": "'J had a 3cm bruise on the left forearm; said it happened last night'",
       "bucket": 0
      },
      {
       "text": "'Mum's new partner is obviously the problem'",
       "bucket": 1
      },
      {
       "text": "'I think J is being abused at home'",
       "bucket": 1
      },
      {
       "text": "'J seemed withdrawn and flinched when touched (noted 9:15am)'",
       "bucket": 0
      },
      {
       "text": "'Wrote it up a few weeks later from memory'",
       "bucket": 1
      }
     ]
    },
    {
     "k": "callout",
     "tone": "tip",
     "title": "If you can't reach the DSL and a child is in danger",
     "t": "Don't wait. Call the police (999) or children's social care directly. Safeguarding never waits for a manager to be free."
    },
    {
     "k": "match",
     "prompt": "Match each role or term to what it means.",
     "pairs": [
      {
       "l": "DSL",
       "r": "Designated Safeguarding Lead — leads on safeguarding and decides what to refer"
      },
      {
       "l": "LADO",
       "r": "Local Authority Designated Officer — handles allegations against adults who work with children"
      },
      {
       "l": "MASH / front-door team",
       "r": "Multi-Agency Safeguarding Hub or equivalent 'front door' where referrals to children's social care are received"
      },
      {
       "l": "Low-level concern",
       "r": "A worry about an adult's behaviour, below the harm threshold, still logged"
      }
     ]
    },
    {
     "k": "check",
     "q": "Which is the best safeguarding record entry?",
     "opts": [
      "'I think the stepdad is to blame.'",
      "'At 3.10pm J said he hit me and had a 3cm bruise on the left forearm.'",
      "'J is definitely being abused.'",
      "'Nothing worth writing down.'"
     ],
     "a": 1,
     "fb": "Correct — factual, timed, the child's own words, the injury described. Opinion and assumption stay out of the factual record."
    }
   ]
  },
  {
   "id": "l6",
   "title": "Thresholds & early help",
   "mins": 7,
   "blocks": [
    {
     "k": "text",
     "t": "Not every concern is a child-protection emergency. Working Together frames children's needs on a continuum, and understanding it helps you see why some worries lead to a supportive early-help conversation and others to an urgent referral. At Level 2 you need to recognise the levels. You do not decide the threshold: that decision is made by children's social care, who assess against the local threshold. Your DSL decides whether and what to refer to them."
    },
    {
     "k": "table",
     "head": [
      "Level",
      "What it means",
      "Typical response"
     ],
     "rows": [
      [
       "Universal",
       "Needs met by everyday services",
       "Good day-to-day provision"
      ],
      [
       "Early help",
       "Emerging or additional needs that, unmet, may escalate",
       "An early-help assessment and coordinated support, usually with consent"
      ],
      [
       "Child in need (s17)",
       "Unlikely to reach a reasonable standard of health or development without help",
       "Referral to children's social care for assessment and support"
      ],
      [
       "Child protection (s47)",
       "Suffering, or likely to suffer, significant harm",
       "Immediate referral; social care leads an enquiry"
      ]
     ]
    },
    {
     "k": "callout",
     "tone": "law",
     "title": "'Significant harm' looks forward, not just back",
     "t": "The section 47 threshold covers children suffering OR likely to suffer significant harm — you never wait for harm to happen before acting. When in doubt, your job is still simply to record and pass the concern to the DSL, who decides whether to refer; children's social care then decide the threshold."
    },
    {
     "k": "sort",
     "prompt": "Sort each situation to the level it most likely reflects (in practice these are discussed, not decided alone).",
     "buckets": [
      "Early help",
      "Child in need (s17)",
      "Child protection (s47)"
     ],
     "items": [
      {
       "text": "A tired family would welcome support after a new baby; attendance has dipped",
       "bucket": 0
      },
      {
       "text": "A young carer is missing sessions caring for a disabled parent and falling behind",
       "bucket": 0
      },
      {
       "text": "A disabled child's health is unlikely to reach a reasonable standard without extra coordinated support",
       "bucket": 1
      },
      {
       "text": "A child with additional needs whose development is stalling and needs a social-care assessment",
       "bucket": 1
      },
      {
       "text": "A child discloses a parent's partner hits them and shows fingertip bruising",
       "bucket": 2
      },
      {
       "text": "A child makes a clear disclosure of sexual abuse by a family member",
       "bucket": 2
      }
     ]
    },
    {
     "k": "check",
     "q": "Under section 47, the child-protection threshold applies when there is reasonable cause to suspect a child:",
     "opts": [
      "Has already suffered serious injury only",
      "Is suffering, or is likely to suffer, significant harm",
      "Has missed several sessions",
      "Has refused an early-help offer"
     ],
     "a": 1,
     "fb": "Correct — it is forward-looking: suffering OR likely to suffer significant harm. You don't wait for harm to occur."
    }
   ]
  },
  {
   "id": "l7",
   "title": "Safe working practice & professional boundaries",
   "mins": 6,
   "blocks": [
    {
     "k": "text",
     "t": "Good safeguarding protects children — and protects you. Clear professional boundaries mean nothing you do can be misread, and they close down the situations abusers try to create. This is 'safer working practice', and it applies to every member of staff and volunteer."
    },
    {
     "k": "points",
     "title": "The boundaries that keep everyone safe",
     "items": [
      "Stay visible — avoid being alone 1:1 with a child out of sight of others.",
      "No personal social-media contact, private messaging or sharing personal phone numbers with children.",
      "Follow the photo and image-consent rules on each child's record — never on your own device.",
      "No lifts home alone, no gifts, no secrets, no favouritism.",
      "Use appropriate language and physical contact; if something could be misread, tell your manager and record it."
     ]
    },
    {
     "k": "callout",
     "tone": "law",
     "title": "Low-level concerns are part of a safe culture",
     "t": "If an adult's behaviour towards children makes you uneasy — even below the 'abuse' threshold — report it. These low-level concerns are logged so patterns can be spotted early. Reporting them is a sign of a healthy culture, not tale-telling."
    },
    {
     "k": "scenario",
     "t": "A 14-year-old on your holiday scheme adds you on Instagram and messages you late at night. You:",
     "choices": [
      {
       "label": "Reply — it's friendly and builds trust",
       "ok": false,
       "fb": "Personal contact crosses a professional boundary and puts you both at risk."
      },
      {
       "label": "Don't respond, don't accept, and tell your manager/DSL",
       "ok": true,
       "fb": "Correct — keep the boundary and be transparent so nothing can be misread."
      },
      {
       "label": "Block them and say nothing",
       "ok": false,
       "fb": "Blocking is fine, but you must still tell your manager so it's on record."
      }
     ]
    },
    {
     "k": "reveal",
     "prompt": "Tap each grey-area situation to see the safe response.",
     "cards": [
      {
       "front": "A child wants your phone number",
       "back": "Decline warmly and explain the rule. Contact goes through the setting, never your personal phone."
      },
      {
       "front": "A colleague keeps giving one child gifts and lifts home",
       "back": "This blurs boundaries — raise it as a low-level concern with the DSL so any pattern is caught early."
      },
      {
       "front": "You had to physically hold a child to keep them safe",
       "back": "Record it the same day — what happened, why, and who saw it — and tell your manager, so it can't be misread."
      }
     ]
    },
    {
     "k": "check",
     "q": "An adult's behaviour towards children makes you uneasy but isn't clearly 'abuse'. You should:",
     "opts": [
      "Ignore it unless you're certain",
      "Report it as a low-level concern so patterns can be spotted",
      "Warn the children yourself",
      "Wait for something serious to happen"
     ],
     "a": 1,
     "fb": "Correct — log low-level concerns with the DSL. Early reporting is how patterns are caught before harm occurs."
    }
   ]
  },
  {
   "id": "l8",
   "title": "Barriers to reporting & professional curiosity",
   "mins": 5,
   "blocks": [
    {
     "k": "text",
     "t": "Knowing what to do is only half the battle. Serious case reviews repeatedly find that someone noticed something but didn't act — not because they didn't care, but because of very human barriers. Recognising them in yourself is the first step to overcoming them, and 'professional curiosity' is the habit that beats them."
    },
    {
     "k": "reveal",
     "prompt": "Tap each barrier to see how to overcome it.",
     "cards": [
      {
       "front": "'What if I'm wrong?'",
       "back": "You only have to report a genuine concern in good faith. The DSL and professionals decide what it means. Staying silent and being wrong is far worse."
      },
      {
       "front": "'Someone else will deal with it.'",
       "back": "The bystander effect is deadly in safeguarding. Assume it's your responsibility — if everyone thinks that, no one acts."
      },
      {
       "front": "'They're such a lovely family / colleague.'",
       "back": "Abuse crosses every background. Being liked is not evidence of safety — perpetrators rely on that assumption."
      },
      {
       "front": "'I'll get in trouble for making a fuss.'",
       "back": "Whistleblowing law and policy protect anyone who raises a genuine concern in good faith. A child's safety outranks organisational loyalty."
      }
     ]
    },
    {
     "k": "callout",
     "tone": "tip",
     "title": "Professional curiosity",
     "t": "Notice, wonder, and check — don't accept the first easy explanation. Ask yourself 'what is this child's daily life actually like?' and 'what am I NOT being told?' Then record and share what you see."
    },
    {
     "k": "scenario",
     "t": "You reported a concern to your DSL two weeks ago, but nothing seems to have happened and the child still looks distressed. You:",
     "choices": [
      {
       "label": "Accept you did your bit — it's out of your hands now",
       "ok": false,
       "fb": "Your duty of care doesn't end at one report. If a child still appears at risk, you must follow up and escalate."
      },
      {
       "label": "Follow up with the DSL, and if still concerned, escalate to a senior manager or children's social care",
       "ok": true,
       "fb": "Correct — persistent, unresolved concern is a reason to escalate through the proper channels. Systems rely on people who don't give up."
      },
      {
       "label": "Post about it on social media to force action",
       "ok": false,
       "fb": "This breaches confidentiality and could put the child at greater risk. Use internal and statutory escalation routes."
      }
     ]
    },
    {
     "k": "check",
     "q": "Which is the safest mindset for a member of staff?",
     "opts": [
      "'Only report what I'm certain about.'",
      "'Give nice families the benefit of the doubt and say nothing.'",
      "'Report any genuine concern in good faith, however small, and escalate if it isn't acted on.'",
      "'Once I've reported once, my job is done.'"
     ],
     "a": 2,
     "fb": "Correct — report every genuine concern, don't be swayed by reputation, and escalate if a child still appears at risk."
    }
   ]
  },
  {
   "id": "l9",
   "title": "Consolidated practice",
   "mins": 10,
   "blocks": [
    {
     "k": "text",
     "t": "One lesson to pull it all together and apply it. Whatever the type of harm, your response is always the same: Notice, Respond, Record, Report to the DSL the same day (999 or children's social care if a child is in immediate danger)."
    },
    {
     "k": "reveal",
     "prompt": "Tap each type of harm to refresh the key signs.",
     "cards": [
      {
       "front": "Physical abuse",
       "back": "Deliberate harm — hitting, shaking, burning. Watch for unexplained or patterned bruising, injuries at different stages of healing, flinching from touch."
      },
      {
       "front": "Emotional abuse",
       "back": "Persistent harm to a child's emotional development. Watch for very low self-worth, being withdrawn or over-anxious, extremes of compliance or defiance."
      },
      {
       "front": "Sexual abuse",
       "back": "Forcing or enticing a child into sexual activity — contact OR non-contact (incl. showing images, online). Watch for sexual knowledge beyond their age, fear of a person, regression."
      },
      {
       "front": "Neglect",
       "back": "Persistent failure to meet basic needs — the most commonly identified category. Watch for hunger, poor hygiene, wrong clothing for the weather, untreated health needs."
      },
      {
       "front": "Domestic abuse",
       "back": "A child who sees, hears or lives with domestic abuse is a victim in their own right (Domestic Abuse Act 2021). Watch for anxiety, reluctance to go home, aggression in play."
      },
      {
       "front": "Online harm & grooming",
       "back": "Grooming, bullying, harmful content and sextortion; the risk follows the child home. Watch for secrecy, night-time anxiety about a phone, new older online 'friends'."
      }
     ]
    },
    {
     "k": "scenario",
     "t": "A 15-year-old shows you a bank card that isn't in their name and says an older 'friend' pays them £50 to 'let money pass through' their account. You:",
     "choices": [
      {
       "label": "Treat it as harmless pocket money — their own business",
       "ok": false,
       "fb": "Being used to move money is financial/criminal exploitation (money muling), not pocket money. The child is a victim."
      },
      {
       "label": "Tell them to stop and keep it between the two of you",
       "ok": false,
       "fb": "You can't keep it secret and telling them to stop leaves the exploitation unaddressed. It needs a safeguarding response."
      },
      {
       "label": "Record their exact words and the card details you saw, and report to the DSL the same day",
       "ok": true,
       "fb": "Correct — money muling is a safeguarding concern. Record the facts and refer to the DSL; the child is treated as a victim."
      }
     ]
    },
    {
     "k": "scenario",
     "t": "A mixed picture: an 11-year-old at holiday club has become withdrawn, is often hungry and wearing a thin summer top in cold weather, and today mentioned an older 'mate' online who sends him game credits and 'told him not to tell'. What do you do?",
     "choices": [
      {
       "label": "Give him a snack and a spare jumper and leave it there",
       "ok": false,
       "fb": "Meeting the immediate need is kind and right — but the pattern (possible neglect plus online grooming) still has to be recorded and reported."
      },
      {
       "label": "Question him hard about who the online 'mate' is until he tells you",
       "ok": false,
       "fb": "Never interrogate. Use gentle open prompts if he wants to talk, then record and refer."
      },
      {
       "label": "Meet the immediate need, record every indicator factually, and tell the DSL the same day",
       "ok": true,
       "fb": "Correct — several signs cluster here (neglect and possible online grooming). Meet the need, record the whole picture, and refer to the DSL."
      }
     ]
    },
    {
     "k": "match",
     "prompt": "Match each specific risk to the single most important point.",
     "pairs": [
      {
       "l": "FGM",
       "r": "Report to the DSL, who ensures police are informed; the police-reporting duty itself sits with teachers and health/social-care professionals"
      },
      {
       "l": "County lines",
       "r": "Treat the child as a victim of exploitation, not an offender"
      },
      {
       "l": "Prevent",
       "r": "Notice, Check, Share — early, supportive help through Channel"
      },
      {
       "l": "CSE",
       "r": "A child can never consent to their own exploitation"
      },
      {
       "l": "Domestic abuse",
       "r": "The child is a victim in their own right"
      }
     ]
    },
    {
     "k": "reveal",
     "prompt": "Tap each exploitation or extremism risk for the one thing to remember.",
     "cards": [
      {
       "front": "Child sexual exploitation (CSE)",
       "back": "Sexual abuse in exchange for gifts, status or affection. A child can NEVER consent to their own exploitation. Boys are exploited too and often missed."
      },
      {
       "front": "County lines / criminal exploitation",
       "back": "Children coerced into moving drugs, money or weapons. Treat the child as a VICTIM, not an offender — even if found with drugs."
      },
      {
       "front": "Radicalisation (Prevent)",
       "back": "Being drawn towards extremist views. Notice, Check, Share. Channel offers voluntary, early support. It is safeguarding, not surveillance."
      },
      {
       "front": "Honour-based abuse & forced marriage",
       "back": "Abuse to 'protect honour', and marriage without full free consent. Never mediate with the family — refer to the DSL, who involves specialist services."
      },
      {
       "front": "Modern slavery & trafficking",
       "back": "Children exploited for labour, crime or sex. The National Referral Mechanism (NRM) identifies and supports victims."
      }
     ]
    },
    {
     "k": "check",
     "q": "Sexual abuse only counts when there is physical contact.",
     "opts": [
      "True",
      "False — it also includes non-contact acts like showing pornography or online abuse"
     ],
     "a": 1,
     "fb": "Correct — sexual abuse covers both contact and non-contact acts, including online."
    },
    {
     "k": "order",
     "prompt": "Put your response to a disclosure in the right order.",
     "items": [
      "Respond — listen, reassure, and don't promise secrecy",
      "Record — write the facts in the child's own words, dated and signed",
      "Report — tell the DSL the same day (sooner if there's immediate danger)"
     ]
    },
    {
     "k": "check",
     "q": "You can't reach the DSL or deputy and a child is in immediate danger. You should:",
     "opts": [
      "Wait until the DSL is free",
      "Go home and try tomorrow",
      "Contact the police or children's social care directly",
      "Ask the child's parents to sort it"
     ],
     "a": 2,
     "fb": "Correct — safeguarding never waits. Contact the police (999) or children's social care yourself."
    }
   ]
  }
 ],
 "quiz": [
  {
   "q": "A learner has completed Level 1 and asks what Level 2 adds for them. The best answer is that Level 2:",
   "opts": [
    "Hands their safeguarding duty over to the DSL so they can step back",
    "Is only needed if they become a manager one day",
    "Turns awareness into the practical judgement to recognise wider harm, respond to disclosures, and record and refer to a defensible standard",
    "Removes the need to report concerns because the DSL now does that"
   ],
   "a": 2,
   "fb": "Level 1 = awareness; Level 2 = practical judgement and action; Level 3 = advanced DSL training. Your duty to notice and report never goes away."
  },
  {
   "q": "A colleague uses 'safeguarding' and 'child protection' as if they mean the same thing. Which correction is right?",
   "opts": [
    "Safeguarding is the broad, proactive work of keeping all children safe and well; child protection is the sharper response for a specific child at risk of significant harm",
    "They are identical terms with no difference",
    "Safeguarding applies to staff and child protection applies to volunteers",
    "Child protection is about buildings and equipment"
   ],
   "a": 0,
   "fb": "Safeguarding is the wide umbrella for all children; child protection is the reactive response for a specific child at risk of significant harm."
  },
  {
   "q": "Which is NOT one of the four categories of abuse?",
   "opts": [
    "Physical",
    "Emotional",
    "Financial",
    "Neglect"
   ],
   "a": 2,
   "fb": "The four statutory categories are physical, emotional, sexual and neglect. Financial or economic exploitation of children (for example money muling) is a genuine safeguarding concern, but it sits within exploitation rather than being one of the four categories."
  },
  {
   "q": "Which category is the most commonly identified and involves persistent failure to meet basic needs?",
   "opts": [
    "Physical",
    "Sexual",
    "Neglect",
    "Emotional"
   ],
   "a": 2,
   "fb": "Neglect is the most commonly identified category and causes serious cumulative harm."
  },
  {
   "q": "A child begins to disclose and asks you to keep it a secret. You should:",
   "opts": [
    "Promise secrecy so they keep talking",
    "Stop them talking",
    "Tell them to speak to a friend",
    "Explain you must share it with the person who can help"
   ],
   "a": 3,
   "fb": "Never promise confidentiality — be honest you must share it with the one person whose job is to help."
  },
  {
   "q": "Which is a leading question you should avoid during a disclosure?",
   "opts": [
    "'Tell me what happened.'",
    "'Did your dad hit you with his belt?'",
    "'Explain what you mean.'",
    "'Can you describe where you were?'"
   ],
   "a": 1,
   "fb": "It introduces information the child hasn't given and can contaminate the account. Use open TED prompts."
  },
  {
   "q": "When recording a disclosure you should write:",
   "opts": [
    "The facts, in the child's own words, dated and signed",
    "Your opinion of who's to blame",
    "Only a brief summary weeks later",
    "Nothing — just tell someone"
   ],
   "a": 0,
   "fb": "Facts, the child's words, same-day, dated and signed. Opinion goes on a separate line marked as opinion."
  },
  {
   "q": "You must report a concern to your DSL:",
   "opts": [
    "Within a month",
    "Only if you're certain",
    "Only if the child asks you to",
    "The same day"
   ],
   "a": 3,
   "fb": "Act the same day — sooner if a child is in immediate danger."
  },
  {
   "q": "A worsening but non-acute neglect picture, with parental consent achievable, most likely fits:",
   "opts": [
    "An immediate s47 child-protection referral",
    "Early help — coordinated support kept under review",
    "No action until the child discloses",
    "Telling parents the child will be removed"
   ],
   "a": 1,
   "fb": "A deteriorating but non-acute picture with achievable consent fits early help; escalate if it worsens."
  },
  {
   "q": "Under section 47, the child-protection threshold applies when a child is:",
   "opts": [
    "Only already seriously injured",
    "Simply missing sessions",
    "Suffering, OR likely to suffer, significant harm",
    "Refusing early help"
   ],
   "a": 2,
   "fb": "It is forward-looking — you don't wait for harm to occur. Children's social care decide the threshold; your DSL decides whether to refer."
  },
  {
   "q": "A child found carrying drugs for a county lines gang should be treated as:",
   "opts": [
    "A victim of exploitation first",
    "An offender who chose it",
    "Partly responsible",
    "No longer the setting's concern"
   ],
   "a": 0,
   "fb": "A child can never consent to their own exploitation — the response is safeguarding, not blame."
  },
  {
   "q": "Child-on-child abuse should be:",
   "opts": [
    "Dismissed as banter",
    "Left for the children to resolve",
    "Taken as seriously as any other safeguarding concern",
    "Only logged if a parent complains"
   ],
   "a": 2,
   "fb": "Never minimised as 'just kids'."
  },
  {
   "q": "A teenager on your scheme adds you on social media and messages late at night. You:",
   "opts": [
    "Reply to build trust",
    "Ignore, don't accept, and tell your manager/DSL",
    "Meet up to talk it through",
    "Block and say nothing"
   ],
   "a": 1,
   "fb": "Keep the boundary and be transparent so nothing is misread."
  },
  {
   "q": "A child at your club discloses that a named volunteer has been hurting them. The correct route is to:",
   "opts": [
    "Ask the volunteer for their side first",
    "Handle it quietly yourself to avoid embarrassment",
    "Wait to see if it happens again",
    "Record the facts and report at once so it goes to your manager and the LADO"
   ],
   "a": 3,
   "fb": "Allegations against an adult who works with children follow the LADO route. Don't investigate or warn the person — record and report immediately."
  },
  {
   "q": "A girl mentions a 'special holiday to become a woman'. You should:",
   "opts": [
    "Treat it as nothing of concern",
    "Record it and report to the DSL today, who ensures the police are informed",
    "Report it yourself directly to the police as a mandatory duty",
    "Treat it as a private family matter to ignore"
   ],
   "a": 1,
   "fb": "Possible FGM risk. The mandatory police-reporting duty falls on teachers and health/social-care professionals; camp and club staff record and report to the DSL, who ensures the police are informed."
  },
  {
   "q": "You reported a concern but two weeks later the child still looks at risk. You:",
   "opts": [
    "Accept it's out of your hands",
    "Follow up and, if still concerned, escalate to a senior manager or children's social care",
    "Post about it online",
    "Confront the DSL publicly"
   ],
   "a": 1,
   "fb": "Your duty doesn't end at one report — follow up and escalate through proper channels."
  },
  {
   "q": "You can't reach the DSL and a child is in immediate danger. You:",
   "opts": [
    "Wait for the DSL",
    "Contact the police or children's social care directly",
    "Do nothing until tomorrow",
    "Ask another child to help"
   ],
   "a": 1,
   "fb": "Safeguarding never waits — contact the authorities yourself."
  }
 ]
};

// ————————————————————————————————————————————————————————————————
// KCSIE 2026 — Key Changes. Built from the NSPCC CASPAR briefing "Keeping
// children safe in education 2026" (DfE, July 2026). KCSIE is the statutory
// framework for schools/colleges in England; camps and clubs are not schools,
// so this course frames the 2026 updates as good practice to adopt.
const kcsie2026: CourseDoc = {
  id: "c40",
  title: "KCSIE 2026 — What's Changed",
  cat: "Recommended",
  cover: "shield",
  category: "saf",
  renewMonths: 12,
  blurb: "A concise update on the key changes in Keeping Children Safe in Education (KCSIE) 2026 — the statutory safeguarding guidance for schools and colleges in England, in force from 1 September 2026. KCSIE is not our governing framework (camps and clubs work primarily to Working Together to Safeguard Children 2023 and our own policy), but its updates are respected good practice. This course summarises what changed and what's worth adopting: an expanded view of child-on-child abuse, new online-safety duties (generative AI, mobile phones, filtering reviews), a major safer-recruitment change removing the supervision exemption from regulated activity, DSL cover arrangements, and new sections on young carers, medical conditions and single-sex facilities. Source: NSPCC CASPAR briefing, July 2026.",
  pass: 80,
  lessons: [
    {
      id: "l1",
      title: "What KCSIE 2026 is and when it applies",
      mins: 5,
      blocks: [
        { k: "art", art: "shield", caption: "KCSIE 2026 — the statutory safeguarding guidance for schools, refreshed." },
        { k: "text", t: "Keeping Children Safe in Education (KCSIE) is statutory guidance that sets out what schools and colleges in England must do to safeguard and promote the welfare of children. It is directed at governing bodies, proprietors, management committees of pupil referral units and senior leadership teams. Each year the Department for Education refreshes it, and this short course covers the additions in the 2026 edition." },
        { k: "callout", tone: "law", title: "In force from 1 September 2026", t: "KCSIE 2026 was published for information on 7 July 2026 and comes into force, replacing the previous edition, on 1 September 2026 (DfE, 2026)." },
        { k: "callout", tone: "info", title: "Are we in scope?", t: "KCSIE is the statutory framework for schools and colleges — we are a camp/club, not a school, so we work primarily to Working Together to Safeguard Children 2023 and our own safeguarding policy. KCSIE is borrowed good practice: this course highlights the 2026 changes worth adopting." },
        { k: "points", title: "The big themes in KCSIE 2026", items: [
          "Child-on-child abuse — expanded, including misogyny and the highest-risk times of day.",
          "Online safety — new guidance on generative AI, mobile-phone-free settings, and yearly filtering reviews.",
          "Safer recruitment — the supervision exemption is removed from regulated activity.",
          "New sections — young carers, children with medical conditions, sport and single-sex facilities.",
          "DSL cover — robust arrangements for when the designated lead is unavailable.",
        ] },
        { k: "check", q: "When does KCSIE 2026 come into force?", opts: ["7 July 2026", "1 September 2026", "Immediately on publication"], a: 1, fb: "Correct — published for information on 7 July 2026, in force from 1 September 2026." },
      ],
    },
    {
      id: "l2",
      title: "Part one — changes for all staff",
      mins: 6,
      blocks: [
        { k: "points", title: "New and clarified for everyone", items: [
          "Child-to-caregiver abuse is named as a form of abuse staff should be aware of.",
          "Verbal abuse is clarified as a possible form of emotional abuse.",
          "A child who is pregnant or a parent, or showing early abusive or harmful behaviours, may benefit from support before statutory intervention.",
          "New detail on community-based Family Help assessments and when to refer to Family Help or children's social care.",
        ] },
        { k: "callout", tone: "warn", title: "Child-on-child abuse — expanded", t: "The guidance now highlights the times children are at highest risk (such as immediately after school), references misogyny, stresses it is a safeguarding issue for all children involved, and emphasises that it is preventable through recognising indicators early." },
        { k: "points", title: "Exploitation (CCE & CSE)", items: [
          "This harm can be committed or facilitated by an organised network or gang, and children may identify with one.",
          "Most sexual abuse is committed by someone known to the victim.",
          "Children are not always recognised as victims and can be criminalised for actions they take while under coercion.",
        ] },
        { k: "callout", tone: "info", title: "Mental health & serious violence", t: "All staff should know that mental health problems can develop into safeguarding concerns — staff recognise the warning signs but only trained professionals diagnose. Concerns that a child is carrying, using or intending to use a weapon must be reported to the DSL, who carries out a risk assessment." },
        { k: "check", q: "Which is now clarified as a possible form of emotional abuse?", opts: ["Verbal abuse", "A single argument", "Strict rules"], a: 0, fb: "Right — KCSIE 2026 clarifies that verbal abuse can be a form of emotional abuse." },
      ],
    },
    {
      id: "l3",
      title: "Part two — managing safeguarding",
      mins: 6,
      blocks: [
        { k: "steps", title: "What changed in the management of safeguarding", items: [
          { h: "DSL cover", t: "Settings should have robust arrangements for when the DSL is unavailable (illness, leave) — for example a confidential shared mailbox, so concerns are still received, monitored and acted on without delay." },
          { h: "Information sharing", t: "Share what is relevant, proportionate and well-contextualised; when a child changes setting and there is a risk, the receiving setting assesses risk and puts a plan in place, and both DSLs should talk." },
          { h: "Online safety", t: "New guidance on the safe, legal use of generative AI; all schools should be mobile-phone-free with a clear policy; and filtering and monitoring should be reviewed at least once a year, with a record kept." },
        ] },
        { k: "points", title: "New sections in Part two", items: [
          "Young carers — caring responsibilities can affect attendance, attainment, behaviour and wellbeing; identify early.",
          "Children with medical conditions — a safeguarding referral is only needed where an incident shows increased risk (e.g. essential medication repeatedly missing).",
          "Attendance is recognised as a key safeguarding factor.",
        ] },
        { k: "callout", tone: "info", title: "Sport, facilities & social transition", t: "KCSIE 2026 adds detailed new guidance on single-sex sport, toilets, changing rooms, showers and boarding, and on requests for support with a child's social transition — including recording biological sex accurately, involving parents, keeping clear records and taking a careful approach (reflecting the Cass Review). Follow your own setting's policy and the full guidance for the detail." },
        { k: "check", q: "How often should filtering and monitoring systems be reviewed?", opts: ["At least once a year", "Once every three years", "Only if something goes wrong"], a: 0, fb: "Correct — at least once a year, checking all devices, with a record kept." },
      ],
    },
    {
      id: "l4",
      title: "Parts three to five — recruitment, allegations & child-on-child sexual harm",
      mins: 6,
      blocks: [
        { k: "callout", tone: "law", title: "Safer recruitment — the big change", t: "In line with the Crime and Policing Act 2026, the supervision exemption is removed from regulated activity. Work carried out in specified places by supervised staff or volunteers can now fall under regulated activity." },
        { k: "points", title: "What that means for volunteers", items: [
          "Volunteering that involves teaching, training, instructing or supervising children for more than 3 days in a 30-day period, or overnight, is now regulated activity.",
          "That requires an enhanced DBS check with barred-list check — including for existing volunteers who now fall into scope.",
          "Where a volunteer is not in regulated activity, carry out a written risk assessment to decide which checks are needed.",
        ] },
        { k: "callout", tone: "warn", title: "Nude and semi-nude images", t: "Every incident of sharing nude or semi-nude images requires a safeguarding response — whether it was consensual or not — with a proportionate approach that considers the children's age, development and any coercion, exploitation or vulnerability." },
        { k: "points", title: "Allegations & child-on-child sexual harm", items: [
          "For an allegation about someone from a third-party agency, the setting shares responsibility — gathering the facts and managing the safeguarding process while the agency usually leads any disciplinary action.",
          "The child-on-child sexual harassment and violence chapter is rewritten around the continuum from harmful sexual behaviour to sexual violence.",
        ] },
        { k: "check", q: "Under the Crime and Policing Act 2026, what changed for regulated activity?", opts: ["The supervision exemption was removed", "DBS checks were abolished", "All volunteers became exempt"], a: 0, fb: "Correct — supervised staff and volunteers in specified places can now be in regulated activity." },
      ],
    },
    {
      id: "l5",
      title: "What this means for our camps and clubs",
      mins: 5,
      blocks: [
        { k: "points", title: "Practical actions to take", items: [
          "Re-check who now counts as regulated activity (supervision no longer exempts them) and make sure DBS and barred-list checks are right.",
          "Set clear expectations on mobile phones and staff use of AI, and review any filtering/monitoring at least once a year.",
          "Make sure there is cover so safeguarding concerns are still received when your DSL is away.",
          "Treat every nude-image incident as a safeguarding matter, and stay alert to young carers and medical-condition risks.",
          "Know your highest-risk moments (for example pick-up and changeovers).",
        ] },
        { k: "reveal", prompt: "Tap each card to check the big ideas.", cards: [
          { front: "Do we have to follow KCSIE?", back: "Not as our governing framework — we work to Working Together 2023 and our own policy. But KCSIE is respected good practice and worth adopting." },
          { front: "The single biggest change for us", back: "The supervision exemption is gone: supervised staff and volunteers in specified places can now be in regulated activity, needing enhanced DBS with barred-list checks." },
          { front: "Who diagnoses mental health?", back: "Not us. Staff recognise warning signs and refer; only appropriately trained professionals diagnose." },
        ] },
        { k: "callout", tone: "tip", title: "The golden thread is unchanged", t: "Whatever the update, the job is the same: notice it, record it, and report it to your DSL the same day — and call 999 or children's social care if a child is in immediate danger." },
        { k: "check", q: "A consensual sharing of a nude image between two children — what is the response?", opts: ["No action, because it was consensual", "Always a safeguarding response, proportionate to age and any coercion", "Only act if a parent complains"], a: 1, fb: "Right — every nude/semi-nude image incident needs a safeguarding response, consensual or not." },
      ],
    },
  ],
};

// Order the three Safeguarding levels first, in progression order (L1 → L2 → L3),
// then the rest of the library. (L2 is the hand-authored flagship above; L1=c11, L3=c12.)
const _L1 = GENERATED_COURSES.find((c) => c.id === "c11");
const _L3 = GENERATED_COURSES.find((c) => c.id === "c12");
const _rest = GENERATED_COURSES.filter((c) => c.id !== "c11" && c.id !== "c12");
export const SEED_LIBRARY: CourseDoc[] = [_L1, safeguarding, _L3, kcsie2026, ..._rest, ...NEW_COURSES].filter(Boolean) as CourseDoc[];

export const blankCourse = (id: string): CourseDoc => ({
  id, title: "Untitled course", cat: "Recommended", cover: "shield", blurb: "",
  lessons: [{ id: "l1", title: "Lesson 1", mins: 3, blocks: [{ k: "text", t: "Start writing your lesson…" }] }],
});
