// Course builder theming + starter templates — the shared "look & feel" system
// used by the course builder (CourseEditor) and honoured by the player
// (CoursePlayer) via CSS variables. Mirrors the newsletter builder's palette
// model so operators get the same email-campaign-style experience for courses.
import type { Block } from "./courseContent";

export interface CoursePalette { id: string; name: string; accent: string; accent2: string; soft: string; grad: string }

// Single-hue palettes derive their soft tint + gradient from one colour; duo-tone
// palettes pass a second hex for a richer gradient header.
const mk = (id: string, name: string, hex: string, hex2?: string): CoursePalette => ({
  id, name, accent: hex, accent2: hex2 ?? hex, soft: `${hex}14`, grad: `linear-gradient(120deg, ${hex}, ${hex2 ?? hex})`,
});

export const COURSE_PALETTES: CoursePalette[] = [
  mk("indigo", "Indigo", "#1d3a8f"),
  mk("royal", "Royal blue", "#2563eb"),
  mk("sky", "Sky", "#0284c7"),
  mk("teal", "Teal", "#0d9488"),
  mk("emerald", "Emerald", "#059669"),
  mk("lime", "Fresh lime", "#4d7c0f"),
  mk("amber", "Amber", "#d97706"),
  mk("orange", "Orange", "#ea580c"),
  mk("rose", "Rose", "#e11d48"),
  mk("pink", "Pink", "#db2777"),
  mk("purple", "Purple", "#7c3aed"),
  mk("slate", "Graphite", "#334155"),
  mk("sunset", "Sunset", "#f97316", "#db2777"),
  mk("ocean", "Ocean", "#0ea5e9", "#6366f1"),
  mk("forest", "Forest", "#16a34a", "#0d9488"),
  mk("grape", "Grape", "#7c3aed", "#db2777"),
];

export const coursePaletteOf = (id?: string): CoursePalette => COURSE_PALETTES.find((p) => p.id === id) ?? COURSE_PALETTES[0];

// ——— Ready-made SECTIONS ————————————————————————————————————————————
// A section is a pre-built group of blocks with fully-written example content.
// Operators PREVIEW one (rendered exactly as a learner sees it), then ADD it —
// sections APPEND to the current lesson, so several stack on one page as you
// build, exactly like sections in the email/newsletter builder.
export const SECTION_GROUPS = ["Openers", "Teaching", "Interactive", "Media", "Assessment", "Wrap-up"] as const;
export type SectionGroup = (typeof SECTION_GROUPS)[number];
export interface Section { id: string; group: SectionGroup; name: string; icon: string; desc: string; blocks: () => Block[] }

export const SECTIONS: Section[] = [
  // —— Openers ——
  {
    id: "welcome", group: "Openers", name: "Welcome & intro", icon: "👋", desc: "A warm opener with objectives",
    blocks: () => [
      { k: "art", art: "listen", caption: "Welcome to the course" },
      { k: "text", t: "Welcome! This short course takes you through the essentials, step by step. Work through it at your own pace — you can pause and pick up where you left off at any time." },
      { k: "points", title: "By the end you'll be able to", items: ["Recognise the key signs and situations that matter", "Know exactly what to do and who to tell", "Feel confident applying this in your everyday role"] },
    ],
  },
  {
    id: "objectives", group: "Openers", name: "Learning objectives", icon: "🎯", desc: "Set out what the lesson covers",
    blocks: () => [
      { k: "callout", tone: "info", title: "What you'll learn", t: "This lesson covers the three things every team member needs to know before working with children." },
      { k: "points", title: "Objectives", items: ["Understand why this topic matters", "Learn the correct procedure to follow", "Practise making the right decision under pressure"] },
    ],
  },
  {
    id: "whymatters", group: "Openers", name: "Why it matters", icon: "💡", desc: "A big stat to hook attention",
    blocks: () => [
      { k: "stat", value: "9 in 10", label: "incidents are preventable with the right response" },
      { k: "text", t: "Getting this right protects the children in your care, supports your colleagues, and keeps your setting safe and trusted. The next few minutes are well worth it." },
    ],
  },
  // —— Teaching ——
  {
    id: "teachcheck", group: "Teaching", name: "Teach & check", icon: "📘", desc: "Key points, a tip, then a quick check",
    blocks: () => [
      { k: "text", t: "Let's start with the basics. Read the key points below, then try the quick check to see what's stuck." },
      { k: "points", title: "Key points", items: ["Always follow your setting's written policy — it takes priority.", "Act quickly, but stay calm and don't jump to conclusions.", "Write down what you saw or heard, in the person's own words where you can."] },
      { k: "callout", tone: "tip", title: "Good practice", t: "When in doubt, share your concern with your designated lead. It's always better to ask." },
      { k: "check", q: "A child tells you something worrying. What should you do first?", opts: ["Listen carefully and reassure them, then report it", "Promise to keep it a secret", "Investigate the details yourself before telling anyone"], a: 0, fb: "Correct — listen, reassure, and pass it on. You don't investigate, and you can't promise secrecy." },
    ],
  },
  {
    id: "keypoints", group: "Teaching", name: "Key points + note", icon: "📌", desc: "The essentials with a warning",
    blocks: () => [
      { k: "points", title: "The essentials", items: ["Keep each point to a single, clear idea.", "Write it as a full sentence so it stands on its own.", "End with the most important thing to remember."] },
      { k: "callout", tone: "warn", title: "Watch out", t: "A common mistake is to assume someone else has already dealt with it. Never assume — always check." },
    ],
  },
  {
    id: "howto", group: "Teaching", name: "Step-by-step how-to", icon: "🪜", desc: "A numbered procedure",
    blocks: () => [
      { k: "steps", title: "How to handle it", items: [{ h: "Stay calm", t: "Take a breath and give the child your full attention." }, { h: "Listen", t: "Let them speak in their own words — don't lead or interrupt." }, { h: "Reassure", t: "Tell them they did the right thing by telling you." }, { h: "Record & report", t: "Write down the facts and tell your designated lead the same day." }] },
    ],
  },
  {
    id: "dosdonts", group: "Teaching", name: "Do's & don'ts table", icon: "📋", desc: "A two-column comparison",
    blocks: () => [
      { k: "table", head: ["Do", "Don't"], rows: [["Listen calmly and take it seriously", "Promise to keep it a secret"], ["Record the facts as soon as you can", "Investigate or ask leading questions"], ["Report to your designated lead", "Share it with people who don't need to know"]] },
    ],
  },
  {
    id: "mythfact", group: "Teaching", name: "Myth vs fact", icon: "🔍", desc: "Bust common misconceptions",
    blocks: () => [
      { k: "reveal", prompt: "Tap each card to reveal the fact", cards: [{ front: "Myth: It's not my job to raise concerns.", back: "Fact: Safeguarding is everyone's responsibility — whatever your role." }, { front: "Myth: I need to be certain before I say anything.", back: "Fact: You only need a concern, not proof. Report it and let the experts decide." }] },
    ],
  },
  {
    id: "define", group: "Teaching", name: "Key definitions", icon: "📖", desc: "Flip cards for key terms",
    blocks: () => [
      { k: "reveal", prompt: "Learn the key terms — tap to flip", cards: [{ front: "Safeguarding", back: "The action we take to promote children's welfare and protect them from harm." }, { front: "Disclosure", back: "When a child tells you something that raises a concern about their safety." }] },
    ],
  },
  {
    id: "quote", group: "Teaching", name: "Quote & reflection", icon: "❝", desc: "A principle to reflect on",
    blocks: () => [
      { k: "quote", t: "The welfare of the child is paramount.", by: "a principle every setting shares" },
      { k: "text", t: "Take a moment to think about what this means in your day-to-day role. What's one thing you'd do differently after today?" },
    ],
  },
  // —— Interactive ——
  {
    id: "scenario", group: "Interactive", name: "Scenario decision", icon: "🎭", desc: "Set a scene, then decide",
    blocks: () => [
      { k: "text", t: "Picture this situation and decide how you'd respond." },
      { k: "scenario", t: "At pick-up, a parent arrives who seems upset and smells of alcohol, asking to take their child home. What do you do?", choices: [{ label: "Calmly involve your manager and follow the collection policy", ok: true, fb: "Yes — you keep the child safe without confronting the parent alone." }, { label: "Refuse and tell the parent to leave", ok: false, fb: "This can escalate things. Follow your policy and get support." }, { label: "Hand the child over to avoid a scene", ok: false, fb: "The child's safety comes first, even if the moment feels awkward." }] },
    ],
  },
  {
    id: "sortgroups", group: "Interactive", name: "Sort into groups", icon: "🗂", desc: "Drag examples into categories",
    blocks: () => [
      { k: "sort", prompt: "Sort each example into the right category", buckets: ["Report immediately", "Monitor and record"], items: [{ text: "A child discloses they've been hurt at home", bucket: 0 }, { text: "A one-off change in a child's mood", bucket: 1 }, { text: "Unexplained injuries that don't add up", bucket: 0 }, { text: "A child seems a little quieter than usual", bucket: 1 }] },
    ],
  },
  {
    id: "matchpairs", group: "Interactive", name: "Match the pairs", icon: "🔗", desc: "Match roles to responsibilities",
    blocks: () => [
      { k: "match", prompt: "Match each role to what they do", pairs: [{ l: "Designated Lead", r: "Coordinates safeguarding and makes referrals" }, { l: "All staff", r: "Notice, record and report concerns" }, { l: "Manager", r: "Ensures training and policy stay up to date" }] },
    ],
  },
  {
    id: "ordersteps", group: "Interactive", name: "Put in order", icon: "↕", desc: "Sequence the response steps",
    blocks: () => [
      { k: "order", prompt: "Put the response steps in the correct order", items: ["Listen to the child", "Reassure them", "Record what was said", "Report to the designated lead"] },
    ],
  },
  {
    id: "spotsigns", group: "Interactive", name: "Signs to spot", icon: "🃏", desc: "Flip cards of warning signs",
    blocks: () => [
      { k: "reveal", prompt: "Tap to reveal what to look for", cards: [{ front: "Physical signs", back: "Unexplained injuries, or explanations that don't quite fit." }, { front: "Behaviour changes", back: "Becoming withdrawn, anxious, or unusually aggressive." }, { front: "What they say", back: "Comments or disclosures that worry you, even in passing." }] },
    ],
  },
  {
    id: "oddoneout", group: "Interactive", name: "Odd one out", icon: "🕵️", desc: "Spot the one that doesn't fit",
    blocks: () => [
      { k: "text", t: "Three of these matter. One doesn't. Can you spot the odd one out?" },
      { k: "check", q: "Which of these is NOT a reason to raise a concern?", opts: ["A child flinches when someone moves quickly", "A child is excited about their birthday party", "Unexplained bruises in unusual places", "A child seems frightened of going home"], a: 1, fb: "Right — being excited about a party is perfectly normal. The others are all worth noticing." },
    ],
  },
  {
    id: "tfquickfire", group: "Interactive", name: "True or false quickfire", icon: "⚡", desc: "A fast true-or-false round",
    blocks: () => [
      { k: "text", t: "Quickfire round — true or false?" },
      { k: "check", q: "True or false: you should always follow your setting's written policy, even over your own instinct.", opts: ["True", "False"], a: 0, fb: "True — the policy exists to keep everyone safe and consistent." },
      { k: "check", q: "True or false: if you're unsure whether something is a concern, it's best to say nothing.", opts: ["True", "False"], a: 1, fb: "False — if in doubt, always share it with your designated lead." },
    ],
  },
  {
    id: "spotmistake", group: "Interactive", name: "Spot the mistake", icon: "🔦", desc: "Find what went wrong",
    blocks: () => [
      { k: "text", t: "Read what happened, then choose what went wrong." },
      { k: "scenario", t: "A colleague hears a worrying comment from a child, writes it down a week later from memory, and mentions it to a friend outside work. What's the biggest mistake?", choices: [{ label: "Waiting a week to record it, and sharing it outside work", ok: true, fb: "Exactly — record promptly, and only share on a need-to-know basis." }, { label: "Writing it down at all", ok: false, fb: "Recording is right — it's the delay and the gossip that are the problem." }, { label: "Listening to the child in the first place", ok: false, fb: "Listening was absolutely the right thing to do." }] },
    ],
  },
  {
    id: "rankpriority", group: "Interactive", name: "Rank by priority", icon: "🥇", desc: "Order things by urgency",
    blocks: () => [
      { k: "text", t: "Drag these into the order you'd deal with them — most urgent first." },
      { k: "order", prompt: "Order these from most to least urgent", items: ["A child says they were hurt at home", "A minor scraped knee in the playground", "A child left their water bottle behind", "A display board needs tidying"] },
    ],
  },
  {
    id: "truthsmyth", group: "Interactive", name: "Two truths & a myth", icon: "🎲", desc: "Which statement is the myth?",
    blocks: () => [
      { k: "text", t: "Two of these statements are true. One is a myth. Which is the myth?" },
      { k: "check", q: "Which statement is the MYTH?", opts: ["Safeguarding is everyone's responsibility", "You need firm proof before you can report a concern", "A concern can be reported without the child's permission"], a: 1, fb: "That's the myth — you only need a concern, not proof. Report it and let the experts decide." },
    ],
  },
  // —— Media ——
  {
    id: "watch", group: "Media", name: "Watch & learn", icon: "🎬", desc: "Video with a takeaways list",
    blocks: () => [
      { k: "text", t: "Watch the short video below, then check the key takeaways underneath." },
      { k: "video", src: "", caption: "Paste a YouTube, Vimeo or MP4 link here" },
      { k: "points", title: "What to notice", items: ["The main point the video makes", "How it applies to your own setting"] },
    ],
  },
  {
    id: "imagecaption", group: "Media", name: "Image with caption", icon: "🖼", desc: "A photo to bring it to life",
    blocks: () => [
      { k: "image", src: "", caption: "Add a photo and describe what it shows" },
      { k: "text", t: "Use images to bring your training to life — a real photo from your setting helps people connect with it." },
    ],
  },
  // —— Assessment ——
  {
    id: "checkset", group: "Assessment", name: "Knowledge check set", icon: "✅", desc: "A short run of questions",
    blocks: () => [
      { k: "text", t: "Answer each question to check your understanding before moving on." },
      { k: "check", q: "Who is responsible for safeguarding?", opts: ["Only the designated lead", "Everyone who works or volunteers here", "Only managers"], a: 1, fb: "Right — it's everyone's responsibility." },
      { k: "check", q: "How soon should you report a concern?", opts: ["Within the week", "The same day", "Only if it happens again"], a: 1, fb: "Concerns should be reported the same day." },
    ],
  },
  {
    id: "mixedcheck", group: "Assessment", name: "Mixed activity check", icon: "🧠", desc: "A check plus a matching task",
    blocks: () => [
      { k: "check", q: "True or false: you should investigate a concern yourself before reporting it.", opts: ["True", "False"], a: 1, fb: "False — record and report; leave investigating to the experts." },
      { k: "match", prompt: "Match the term to its meaning", pairs: [{ l: "Concern", r: "Something that worries you about a child's welfare" }, { l: "Referral", r: "Passing a concern on to children's services" }] },
    ],
  },
  // —— Wrap-up ——
  {
    id: "summary", group: "Wrap-up", name: "Summary recap", icon: "📝", desc: "Pull the key points together",
    blocks: () => [
      { k: "callout", tone: "tip", title: "In summary", t: "You've learned why this matters, what to look for, and exactly what to do about it." },
      { k: "points", title: "Remember", items: ["Notice — stay alert to signs and changes.", "Record — write down the facts, promptly.", "Report — tell your designated lead the same day."] },
    ],
  },
  {
    id: "nextsteps", group: "Wrap-up", name: "Next steps & resources", icon: "➡️", desc: "Where to go from here",
    blocks: () => [
      { k: "text", t: "Well done for completing this lesson. Here's how to keep learning and where to go for help." },
      { k: "points", title: "Next steps", items: ["Find your setting's policy and read the key sections.", "Save your designated lead's name and contact details.", "Complete the final quiz to earn your certificate."] },
    ],
  },
  {
    id: "pledge", group: "Wrap-up", name: "Takeaway pledge", icon: "🤝", desc: "Make it personal",
    blocks: () => [
      { k: "text", t: "Before you finish, make it personal — commit to one thing you'll act on." },
      { k: "scenario", t: "Which action will you commit to this week?", choices: [{ label: "I'll re-read our safeguarding policy", ok: true, fb: "Great choice — knowing the policy makes acting easy." }, { label: "I'll check I know who our designated lead is", ok: true, fb: "Essential — you'll know exactly who to tell." }, { label: "I'll speak up straight away if something worries me", ok: true, fb: "That's exactly the right mindset." }] },
    ],
  },
];

// ——— Add-block palette, grouped like a design tool's insert menu ————————
export interface BlockKindMeta { k: Block["k"]; label: string; icon: string }
export interface BlockGroup { group: string; tint: string; kinds: BlockKindMeta[] }

export const BLOCK_GROUPS: BlockGroup[] = [
  {
    group: "Text & media", tint: "#1d3a8f",
    kinds: [
      { k: "text", label: "Paragraph", icon: "¶" },
      { k: "image", label: "Image / photo", icon: "🖼" },
      { k: "video", label: "Video", icon: "🎬" },
      { k: "quote", label: "Quote", icon: "❝" },
      { k: "callout", label: "Callout / note", icon: "💬" },
      { k: "art", label: "Illustration", icon: "🎨" },
    ],
  },
  {
    group: "Structure & data", tint: "#0d9488",
    kinds: [
      { k: "points", label: "Key points", icon: "•" },
      { k: "steps", label: "Numbered steps", icon: "①" },
      { k: "stat", label: "Big stat", icon: "％" },
      { k: "table", label: "Table", icon: "▦" },
    ],
  },
  {
    group: "Interactive activities", tint: "#7c3aed",
    kinds: [
      { k: "scenario", label: "Scenario", icon: "🎭" },
      { k: "check", label: "Knowledge check", icon: "✅" },
      { k: "sort", label: "Sort into groups", icon: "🗂" },
      { k: "order", label: "Put in order", icon: "↕" },
      { k: "match", label: "Match pairs", icon: "🔗" },
      { k: "reveal", label: "Flip cards", icon: "🃏" },
    ],
  },
];

export const blockMeta = (k: Block["k"]): BlockKindMeta & { tint: string } => {
  for (const g of BLOCK_GROUPS) { const m = g.kinds.find((x) => x.k === k); if (m) return { ...m, tint: g.tint }; }
  return { k, label: k, icon: "▪", tint: "#64748b" };
};
