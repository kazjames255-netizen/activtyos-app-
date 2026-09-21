// X4 English pictures C: text types and structure, writing process, reading skills, handwriting.
// Generic layouts/frames only. Nothing here depicts a specific book, character or event.
import type { Pic } from "./types";
import { ln, arrow, circ, path } from "./helpers";
import { mk, T, wrap, box, chip, row, sentence, est } from "./ext-english-kit";

const B = "f1", G = "f2", Y = "f3", R = "f4", V = "f5", N = "f6";
/** n grey text lines (a block of text) */
const lines = (x: number, y: number, w: number, n: number, gap = 6) => Array.from({ length: n }, (_, i) => ln(x, y + i * gap, x + (i === n - 1 ? w * 0.6 : w), y + i * gap, "th")).join("");
/** a labelled bar */
const bar = (y: number, label: string, sub: string, fill: string, h = 26, x = 12, w = 216) => box(x, y, w, h, fill, 6) + T(x + w / 2, y + (sub ? 11 : h / 2 + 4), label, "ts") + (sub ? T(x + w / 2, y + 21, sub, "tx tm") : "");

const paragraph = mk({
  id: "paragraph-structure", title: "Paragraph structure", alt: "A paragraph drawn as three stacked bars: a topic sentence that states the main idea, supporting sentences that give details or evidence, and a concluding sentence that sums up the idea.",
  caption: "Topic sentence, details, concluding sentence", concepts: ["paragraph", "paragraphs", "topic sentence", "topic sentences", "concluding sentence", "concluding sentences", "supporting sentence", "supporting sentences"],
  doesNotShow: "paragraph length; linking words between paragraphs", evidence: "Oak keywords: 'paragraph' = a section of writing indicated by a new line and an indentation; 'topic sentence' = the first sentence of a paragraph, stating its main idea; 'concluding sentence' = the last sentence, concluding the paragraph's main idea.",
  build: () => {
    let s = T(120, 18, "A paragraph", "tb");
    s += bar(28, "topic sentence", "the main idea", B) + bar(60, "supporting sentences", "details, examples, evidence", G, 40) + bar(104, "concluding sentence", "sums up the idea", Y);
    return s;
  },
});
const essay = mk({
  id: "essay-structure", title: "Essay structure", alt: "An essay drawn as three stacked parts: the introduction with the thesis (the main argument), body paragraphs that each support the thesis, and a conclusion that sums up and links back to the thesis.",
  caption: "Introduction, body paragraphs, conclusion", concepts: ["essay", "essays", "essay structure", "thesis", "thesis statement", "essay plan"],
  avoid: ["essay question", "exam", "examination", "poem", "poetry"],
  doesNotShow: "the number of body paragraphs; how to write each part", evidence: "Oak keyword 'thesis': the overarching argument to an essay, supported by the entire text. Standard essay frame: introduction (with thesis), body paragraphs each supporting it, conclusion.",
  build: () => {
    let s = T(120, 18, "An essay", "tb");
    s += bar(28, "introduction", "the thesis: your main argument", B) + bar(60, "body paragraphs", "each one supports the thesis", G, 30) + bar(96, "conclusion", "sums up, links back to the thesis", Y);
    return s;
  },
});
const pee = mk({
  id: "point-evidence-explain", title: "Point, evidence, explain", alt: "Three connected steps: Point (make your point), Evidence (a short quotation from the text, in inverted commas) and Explain (say what the evidence shows and why it matters).",
  caption: "Point, then evidence, then explain", concepts: ["point evidence explain", "pee", "peel", "evidence", "textual evidence", "quotation", "quotations", "supporting quotation", "main quotation", "embedded quotation", "embedded quotations"],
  avoid: ["historical evidence", "scientific evidence", "evidence of bias", "no evidence", "lack of evidence", "eyewitness"],
  doesNotShow: "how to choose a quotation; a specific text", evidence: "Oak keywords: 'evidence' = information or facts to show something is true; 'quotation' = a word, phrase or sentence taken directly from a text and presented within quotation marks. Frame: make a point, support it with a short quotation, explain what it shows.",
  build: () => {
    let s = T(120, 18, "Point, evidence, explain", "t");
    s += bar(28, "point", "what you want to say", B) + arrow(120, 55, 120, 62, "a", 6) + bar(62, "evidence", "a short quotation “…”", G) + arrow(120, 89, 120, 96, "a", 6) + bar(96, "explain", "what it shows and why", Y);
    return s;
  },
});
const report = mk({
  id: "non-chronological-report", title: "Non-chronological report layout", alt: "A page layout for a non-chronological report: a title at the top, an opening paragraph of general information, a subheading followed by facts, and a picture with a caption underneath.",
  caption: "Title, subheadings, facts and captions", concepts: ["non chronological report", "non-chronological report", "subheading", "subheadings", "caption", "captions", "general information"],
  avoid: ["chronological order of events", "diary", "presenting", "presentation", "delivering", "perform"],
  doesNotShow: "the content of any particular report", evidence: "Oak keywords: 'non-chronological report' = a non-fiction text that informs about a subject or event and is written out of time order; 'subheading' = a word, phrase or sentence used to introduce part of a text. Layout frame: title, general information, subheadings with facts, picture + caption.",
  build: () => {
    let s = box(24, 8, 192, 138, "f0", 6) + box(34, 14, 172, 16, B, 4) + T(120, 26, "Title", "ts");
    s += lines(34, 40, 172, 2) + T(200, 54, "general information", "tt tm te");
    s += box(34, 64, 70, 12, G, 3) + T(69, 73, "subheading", "tt") + lines(34, 84, 70, 3) + lines(34, 106, 70, 2, 6);
    s += box(114, 64, 92, 48, "f6", 4) + ln(114, 64, 206, 112, "th") + ln(206, 64, 114, 112, "th") + T(160, 126, "caption", "tt tm") + lines(114, 132, 92, 1);
    return s;
  },
});
const recount = mk({
  id: "recount-structure", title: "Recount", alt: "A recount drawn as three parts in order: an opening that says who, what, when and where; events told in the order they happened; and a closing comment about how the writer felt.",
  caption: "A recount tells what happened, in order", concepts: ["recount", "recounts"],
  doesNotShow: "the content of a particular event", evidence: "Oak keyword 'recount': a piece of writing that recalls an event or experience. Standard frame: orientation (who, what, when, where), events in time order, closing comment.",
  build: () => {
    let s = T(120, 18, "Recount", "tb");
    s += bar(28, "opening", "who, what, when, where", B) + bar(60, "events", "in the order they happened", G) + bar(92, "ending", "how you felt", Y);
    s += arrow(120, 54, 120, 60, "a", 6) + arrow(120, 86, 120, 92, "a", 6);
    s += T(120, 134, "first, next, then, finally", "ts tm");
    return s;
  },
});
const diary = mk({
  id: "diary-entry", title: "Diary entry layout", alt: "A diary page with labels: the day at the top, the greeting Dear Diary, events in the order they happened written as I, and thoughts and feelings.",
  caption: "A diary entry: first person, in order", concepts: ["diary entry", "diary entries", "diary writing", "diary"],
  avoid: ["diary of a", "anne frank", "pepys"],
  doesNotShow: "the content of a real diary", evidence: "Oak keyword 'diary': a personal book where you write about your thoughts, feelings and experiences. Layout frame: day, Dear Diary, events in order in the first person (I), feelings.",
  build: () => {
    let s = box(30, 8, 180, 138, "f0", 6) + T(42, 24, "Monday", "ts tl") + T(42, 40, "Dear Diary,", "ts tl");
    s += lines(42, 50, 156, 2) + T(198, 66, "what happened, in order", "tt tm te") + lines(42, 76, 156, 2) + T(198, 92, "how I felt", "tt tm te") + lines(42, 100, 156, 2);
    s += T(42, 132, "I (first person)", "ts tl tm");
    return s;
  },
});
const letterLayout = mk({
  id: "letter-layout", title: "Letter layout", alt: "A letter layout: the writer's address at the top right, the date, a greeting such as Dear Mr Smith, the body of the letter, and an ending: Yours sincerely if you know the name, Yours faithfully if you do not.",
  caption: "Address, date, greeting, body, ending", concepts: ["formal letter", "formal letters", "informal letter", "letter layout", "letter of complaint"],
  doesNotShow: "the content of any letter", evidence: "Standard UK letter conventions: sender's address, date, Dear ..., body, Yours sincerely (named person) or Yours faithfully (Dear Sir or Madam), then the name.",
  build: () => {
    let s = box(24, 6, 192, 142, "f0", 6) + lines(140, 16, 66, 2) + T(200, 36, "address", "tt tm te") + T(200, 46, "date", "tt tm te");
    s += T(34, 60, "Dear Mr Smith,", "tx tl") + lines(34, 70, 172, 4) + T(34, 106, "Yours sincerely,", "tx tl") + T(34, 122, "Name", "tx tl tm");
    s += T(200, 106, "named person", "tt tm te") + T(200, 132, "Dear Sir or Madam: Yours faithfully", "tt tm te");
    return s;
  },
});
const newspaper = mk({
  id: "newspaper-article", title: "Newspaper article layout", alt: "A newspaper article layout: a big headline, a byline saying who wrote it, an opening paragraph that answers who, what, where, when and why, columns of detail, and a photograph with a caption.",
  caption: "Headline, byline, first paragraph", concepts: ["newspaper article", "newspaper articles", "newspaper report", "newspaper reports", "headline", "headlines", "byline", "journalistic report", "journalistic writing"],
  requires: ["newspaper", "journalistic", "journalist", "article", "news", "reporter", "byline"],
  avoid: ["advert", "advertisement", "advertising", "poster", "leaflet", "flyer", "brochure", "slogan", "campaign", "commercial", "website", "web page", "webpage", "blog"],
  doesNotShow: "the content of a real article; adverts, posters, leaflets or web pages", evidence: "Standard news-report frame: headline, byline, lead paragraph answering who/what/where/when/why, body in columns, picture with caption.",
  build: () => {
    let s = box(14, 6, 212, 142, "f0", 4) + box(22, 12, 196, 20, B, 3) + T(120, 27, "HEADLINE", "t") + T(24, 44, "byline: by the reporter", "tt tm tl");
    s += box(22, 50, 196, 20, G, 3) + T(120, 63, "opening paragraph: who, what, where, when", "tt") + lines(22, 82, 92, 5) + box(124, 78, 94, 40, "f6", 3) + ln(124, 78, 218, 118, "th") + ln(218, 78, 124, 118, "th") + T(171, 130, "photo caption", "tt tm") + lines(22, 118, 92, 4);
    return s;
  },
});
const instructions = mk({
  id: "instructions-layout", title: "Instructions layout", alt: "An instructions layout: a title saying what you will make, a list headed You will need, and steps in the order to do them, each introduced by a sequencing word: First, Next, Then, Finally.",
  caption: "Equipment list, then steps in order", concepts: ["instructions", "instruction text", "instructional text", "instruction writing", "instruction"],
  avoid: ["exam", "examination", "task instructions", "follow the instructions on", "safety instructions"],
  doesNotShow: "the content of any recipe or set of instructions", evidence: "Standard instruction-text frame: title (goal), equipment list, steps in time order starting with imperative (command) verbs, time words first/next/then/finally.",
  build: () => {
    let s = T(120, 18, "How to make ...", "t") + box(14, 26, 212, 26, B, 6) + T(120, 36, "You will need:", "ts") + T(120, 47, "a list of equipment", "tx tm");
    [["First,", 58], ["Next,", 80], ["Then,", 102], ["Finally,", 124]].forEach(([w, y]) => { s += chip(14, y as number, w as string, Y, "tx", 17, 6).svg + lines(78, (y as number) + 6, 160, 1); });
    return s;
  },
});
const persuasive = mk({
  id: "persuasive-writing", title: "Persuasive writing", alt: "A persuasive text frame in four parts: an opening that states your opinion, reasons with evidence, an answer to the other side, and a call to action. Beside it, a list of persuasive techniques: rhetorical question, rule of three, emotive language, direct address.",
  caption: "Persuasive writing frame and techniques", concepts: ["persuasive writing", "persuasive text", "persuasive texts", "persuasive technique", "persuasive techniques", "persuasive language", "persuade", "persuasion"],
  avoid: ["persuasive essay"],
  doesNotShow: "the content of any speech or advert", evidence: "Oak keyword 'persuasive technique': a structure or device used in writing to try to change someone's mind or behaviour. Frame: opinion, reasons + evidence, counter-argument answered, call to action. Techniques: rhetorical question, rule of three, emotive language, direct address.",
  build: () => {
    let s = T(120, 18, "Persuasive writing", "tb");
    ["opinion", "reasons + evidence", "the other side", "call to action"].forEach((l, i) => { s += box(8, 28 + i * 28, 100, 22, [B, G, Y, R][i], 5) + T(58, 43 + i * 28, l, "tx"); });
    s += T(172, 36, "techniques", "ts tm");
    ["rhetorical question", "rule of three", "emotive language", "direct address"].forEach((l, i) => { s += T(172, 56 + i * 24, l, "tx"); });
    s += ln(114, 30, 114, 136, "th");
    return s;
  },
});
const debate = mk({
  id: "debate-structure", title: "Debate", alt: "A debate drawn as two teams facing each other across a motion: one team speaks for the motion, the other against it. A chairperson keeps order and a timekeeper keeps time.",
  caption: "Two teams argue for and against a motion", concepts: ["debate", "debates", "debating", "how to debate"],
  avoid: ["debate about the poem", "debate the merits"],
  doesNotShow: "the order of speeches in any particular format", evidence: "Oak keyword 'debate': a structured argument between two teams; Oak roles chairperson and timekeeper. Drawn: team for, team against, motion, chairperson, timekeeper.",
  build: () => {
    let s = T(120, 18, "A debate", "tb");
    s += box(10, 44, 78, 52, G, 8) + T(49, 66, "for", "t") + T(49, 82, "the motion", "tx tm") + box(152, 44, 78, 52, R, 8) + T(191, 66, "against", "t") + T(191, 82, "the motion", "tx tm");
    s += box(96, 30, 48, 20, Y, 6) + T(120, 44, "motion", "tx") + arrow(90, 70, 150, 70, "l", 6) + arrow(150, 78, 90, 78, "l", 6);
    s += chip(22, 112, "chairperson", B, "tx", 18, 6).svg + chip(134, 112, "timekeeper", B, "tx", 18, 6).svg;
    return s;
  },
});
const writingProcess = mk({
  id: "writing-process", title: "The writing process", alt: "Four steps in a row joined by arrows: plan, write a draft, edit (check and improve), then publish the final copy.",
  caption: "Plan, draft, edit, publish", concepts: ["writing process", "editing", "proofreading", "proofread", "drafting", "peer editing", "plan", "planning"],
  requires: ["write", "writing", "story", "essay", "text", "edit", "draft", "paragraph", "poem", "report", "letter", "sentence"],
  avoid: ["lesson plan", "floor plan", "plan of action", "planning permission", "plan a trip", "film", "video", "plan of the"],
  doesNotShow: "how to plan any particular text", evidence: "Oak keyword 'plan': a framework that writers create before they write a section or whole text; 'editing' = checking and improving writing. Standard process: plan, draft, edit, publish.",
  build: () => {
    let s = T(120, 18, "The writing process", "t");
    [["plan", B], ["draft", G], ["edit", Y], ["publish", V]].forEach(([l, f], i) => { s += box(8 + i * 58, 50, 50, 30, f as string, 6) + T(33 + i * 58, 69, l as string, "ts"); if (i < 3) s += arrow(58 + i * 58, 65, 66 + i * 58, 65, "l", 6); });
    [["think of ideas", 0], ["write it", 1], ["check and improve", 2], ["final copy", 3]].forEach(([l, i]) => { s += T(33 + (i as number) * 58, 100, l as string, "tt tm"); });
    return s;
  },
});
const storyElements = mk({
  id: "story-elements", title: "Story elements", alt: "Three boxes for the parts of a story: characters (who is in the story), setting (where and when it happens) and plot (what happens).",
  caption: "Characters, setting and plot", concepts: ["setting", "settings", "plot", "plots", "story elements", "narrative elements", "story ingredients"],
  requires: ["story", "narrative", "novel", "play", "fiction", "character", "characters", "text", "tale"],
  avoid: ["setting out", "setting up", "set up", "plot diagram", "plot structure", "climax", "story mountain", "narrative arc", "rising action", "poem", "poetry"],
  doesNotShow: "the characters, setting or plot of any particular story", evidence: "Oak keywords: 'character' = a person or animal in a story; 'setting' = where the story takes place; 'plot' = what happens in the story.",
  build: () => {
    let s = T(120, 18, "Parts of a story", "tb");
    [["characters", "who is in it", B], ["setting", "where, when", G], ["plot", "what happens", Y]].forEach(([a, b, f], i) => { s += box(10 + i * 76, 34, 70, 70, f as string, 8) + T(45 + i * 76, 66, a as string, "ts") + T(45 + i * 76, 82, b as string, "tx tm"); });
    return s;
  },
});
const storyStructure = mk({
  id: "story-structure", title: "Story structure", alt: "Five story parts drawn as steps in order: opening, build-up, problem, resolution and ending. A note says the resolution is where the problem is solved.",
  caption: "Five parts of a story", concepts: ["story structure", "narrative structure", "resolution", "exposition", "build up", "beginning middle and end"],
  requires: ["story", "narrative", "plot", "novel", "text", "fiction"],
  avoid: ["climax", "rising action", "falling action", "story mountain", "narrative arc", "plot diagram", "plot structure", "anti-climax", "poem", "argument", "essay", "non-fiction", "resolution of"],
  doesNotShow: "any particular story; the climax", evidence: "Oak keywords: 'exposition' = sets up the setting, characters and atmosphere; 'resolution' = the part of the story that resolves the problem. Five-part frame: opening, build-up, problem, resolution, ending.",
  build: () => {
    let s = T(120, 18, "Parts of a story", "tb");
    [["opening", "who and where"], ["build-up", "events lead to a problem"], ["problem", "something goes wrong"], ["resolution", "the problem is solved"], ["ending", "how the story finishes"]].forEach(([l, sub], i) => {
      const y = 28 + i * 24; s += box(10, y, 220, 19, [B, G, Y, R, V][i], 5) + T(18, y + 13, l, "ts tl") + T(88, y + 13, sub, "tx tl tm");
    });
    return s;
  },
});

const characterisation = mk({
  id: "characterisation", title: "How we get to know a character", alt: "A character in the centre with five arrows to the ways a writer shows what a character is like: what they say, what they do, what they think and feel, how they look, and what other characters say about them.",
  caption: "Five ways a writer shows a character", concepts: ["characterisation", "character trait", "character traits", "characterization"],
  doesNotShow: "any particular character", evidence: "Oak KS2 'characterisation' / 'character traits': a character's personality is shown through what they say, do, think and feel, how they look, and what others say about them (standard characterisation methods).",
  build: () => {
    let s = box(86, 62, 68, 26, B, 8) + T(120, 79, "character", "ts");
    [[8, 28, "says"], [92, 24, "does"], [150, 28, "thinks, feels"], [8, 112, "looks"], [130, 112, "others say"]].forEach(([x, y, l]) => {
      const w = Math.round(est(l as string, "tx") + 16); s += box(x as number, y as number, w, 18, G, 5) + T((x as number) + w / 2, (y as number) + 13, l as string, "tx");
      const cx = (x as number) + w / 2; s += ln(cx, (y as number) < 60 ? (y as number) + 18 : y as number, cx < 120 ? 90 : 150, (y as number) < 60 ? 62 : 88, "th");
    });
    s += T(120, 14, "what a character is like", "ts tm");
    return s;
  },
});
const showTell = mk({
  id: "show-dont-tell", title: "Show, don't tell", alt: "Two sentences. Telling: She was sad. Showing: Tears rolled down her cheeks. A note says showing uses actions and details to let the reader work out the feeling.",
  caption: "Show the feeling; don't just name it", concepts: ["show not tell", "show dont tell", "showing not telling", "show dont tell writing"],
  doesNotShow: "any particular text", evidence: "Standard writing technique (Oak KS2/KS3 'show, don't tell', also 'show-not-tell'): telling names a feeling (She was sad); showing uses action and detail (Tears rolled down her cheeks).",
  build: () => {
    let s = T(120, 18, "Show, don’t tell", "tb");
    s += T(120, 40, "telling", "ts tm") + box(20, 46, 200, 24, R, 6) + T(120, 62, "She was sad.", "t");
    s += T(120, 92, "showing", "ts tm") + box(20, 98, 200, 24, G, 6) + T(120, 114, "Tears rolled down her cheeks.", "ts");
    return s;
  },
});
const perspective = mk({
  id: "narrative-perspective", title: "First and third person", alt: "Two columns. First person: the narrator is a character and uses I or we (I opened the door). Third person: the narrator is outside the story and uses he, she, it or they (She opened the door).",
  caption: "First person: I or we. Third person: he, she, they", concepts: ["first person", "third person", "first person perspective", "third person perspective", "narrative perspective", "narrative voice", "narrator", "narrators"],
  avoid: ["first person plural", "second person"],
  doesNotShow: "second person; omniscient or limited narrators", evidence: "Oak keywords: 'first person' = the I/we perspective; 'third person' = the he/she/it/they perspective. Drawn: I opened the door / She opened the door.",
  build: () => {
    let s = T(120, 18, "Who is telling the story?", "t");
    s += T(60, 40, "first person", "ts tm") + T(180, 40, "third person", "ts tm") + ln(120, 34, 120, 118, "th");
    s += box(10, 48, 100, 30, B, 6) + T(60, 67, "I ran home.", "tx") + box(130, 48, 100, 30, G, 6) + T(180, 67, "She ran home.", "tx");
    s += T(60, 100, "I  we", "t") + T(180, 100, "he  she  it  they", "ts");
    return s;
  },
});
const inference = mk({
  id: "inference", title: "Making an inference", alt: "A sum: a clue from the text (Sam grabbed his umbrella) plus what I already know (umbrellas keep you dry in the rain) makes an inference (it is raining). A note says an inference is worked out from clues, not stated.",
  caption: "Clue + what I know = inference", concepts: ["inference", "inferences", "infer", "inferring", "make an inference"],
  doesNotShow: "a specific text", evidence: "Oak keywords: 'inference' = using clues from within the text to draw conclusions; 'infer' = to form an opinion because of the information you have. Drawn with a neutral example.",
  build: () => {
    let s = T(120, 18, "Inference", "tb");
    s += box(8, 28, 224, 24, B, 6) + T(120, 44, "clue: Sam grabbed his umbrella.", "ts") + T(120, 66, "+", "t");
    s += box(8, 72, 224, 24, G, 6) + T(120, 88, "I know: umbrellas keep us dry.", "ts") + T(120, 110, "=", "t");
    s += box(8, 116, 224, 24, Y, 6) + T(120, 132, "inference: it is probably raining.", "ts");
    return s;
  },
  capMax: 40,
});
const retrieve = mk({
  id: "retrieve", title: "Retrieve information", alt: "A block of text lines with a magnifying glass over one highlighted line. A note says retrieving means finding information that is stated in the text.",
  caption: "Retrieve: find it stated in the text", concepts: ["retrieve", "retrieval", "retrieving", "retrieve information"],
  doesNotShow: "a specific text", evidence: "Oak keyword 'retrieve': to find information within the text.",
  build: () => {
    let s = T(120, 18, "Retrieve", "tb") + box(30, 30, 140, 90, "f0", 6) + lines(40, 44, 120, 3, 9) + box(38, 68, 124, 10, Y, 2) + lines(40, 72, 120, 1) + lines(40, 90, 120, 3, 9);
    s += circ(176, 84, 20, "l f0") + ln(190, 98, 210, 118, "l") + T(120, 138, "find it in the text", "ts tm");
    return s;
  },
});
const summarise = mk({
  id: "summarise", title: "Summarise", alt: "A long block of text on the left, an arrow, and a short block of text on the right. A note says a summary keeps only the main points in fewer words.",
  caption: "A summary: main points in fewer words", concepts: ["summarise", "summarising", "summarize"],
  avoid: ["executive summary"],
  doesNotShow: "a specific text", evidence: "Oak keyword 'summarise': to sum up or conclude the main body of a text. Drawn: long text > short text.",
  build: () => {
    let s = T(120, 18, "Summarise", "tb") + box(12, 34, 100, 84, "f0", 6) + lines(20, 46, 84, 8, 9) + arrow(116, 76, 140, 76, "a", 7) + box(146, 50, 80, 50, Y, 6) + lines(154, 62, 64, 3, 10);
    s += T(62, 132, "all the words", "tx tm") + T(186, 132, "main points", "tx tm");
    return s;
  },
});
const predict = mk({
  id: "prediction", title: "Predicting", alt: "Three steps: clues from the text so far, then a prediction (I think ... will happen because ...), then read on to check it.",
  caption: "Use clues to guess what happens next", concepts: ["prediction", "predictions", "predict", "predicting"],
  avoid: ["weather", "forecast"],
  doesNotShow: "a specific text", evidence: "Oak keyword 'prediction': making a guess using what we already know.",
  build: () => {
    let s = T(120, 18, "Predicting", "tb");
    s += bar(28, "clues", "the title, pictures, what has happened", B) + arrow(120, 55, 120, 62, "a", 6) + bar(62, "prediction", "I think ... because ...", G) + arrow(120, 89, 120, 96, "a", 6) + bar(96, "read on", "was I right?", Y);
    return s;
  },
});
const compare = mk({
  id: "compare-contrast", title: "Compare and contrast", alt: "Two overlapping circles (a Venn diagram). The overlap holds what is the same; the two outer parts hold what is different.",
  caption: "Same in the middle, different at the sides", concepts: ["compare", "compares", "comparing", "contrast", "contrasts", "comparison", "similarities", "differences", "compare and contrast"],
  avoid: ["comparative", "superlative", "contrasting colour", "colour contrast", "compare nouns", "comparing nouns", "compare two nouns", "adjective to compare", "adjectives to compare", "adjectives that compare", "adjectives can compare", "adjectives compare"],
  doesNotShow: "the things being compared", evidence: "Standard Venn frame: the overlap = similarities (compare), outer parts = differences (contrast). Oak 'compare' / 'contrast'.",
  build: () => {
    let s = T(120, 16, "Compare and contrast", "t") + `<circle cx="92" cy="80" r="46" class="l f1" style="fill-opacity:.55"/><circle cx="148" cy="80" r="46" class="l f2" style="fill-opacity:.55"/>`;
    s += T(66, 84, "different", "tt") + T(120, 84, "same", "tx") + T(174, 84, "different", "tt");
    return s;
  },
});
const cohesion = mk({
  id: "cohesive-devices", title: "Linking ideas", alt: "Three short sentences linked by linking words: First, ... Then, ... However, ... Finally, .... A note says cohesive devices such as connectives and pronouns link ideas so the text flows.",
  caption: "Linking words help a text flow", concepts: ["cohesive devices", "cohesive device", "text cohesion", "cohesion", "text flow", "discourse marker", "discourse markers", "connective", "connectives"],
  doesNotShow: "any particular text", evidence: "Oak keywords: 'cohesive devices' = language structures that develop text cohesion; 'text flow'. Linking words (First, Then, However, Finally) and pronouns join ideas.",
  build: () => {
    let s = T(120, 18, "Linking ideas", "tb");
    ["First,", "Then,", "However,", "Finally,"].forEach((w, i) => { const y = 28 + i * 26; s += chip(10, y, w, Y, "ts", 20, 6).svg + lines(74, y + 10, 150, 1); });
    s += T(120, 138, "linking words join ideas", "ts tm");
    return s;
  },
});
const speaking = mk({
  id: "speaking-skills", title: "Speaking well", alt: "Five cards for speaking well: volume (loud enough), pace (not too fast), pitch (vary your voice), eye contact, and posture.",
  caption: "Volume, pace, pitch, eye contact, posture", concepts: ["eye contact", "volume", "pitch", "posture", "presenting", "speaking and listening", "performing"],
  requires: ["speak", "speaking", "present", "presenting", "presentation", "perform", "performing", "audience", "listen", "listening", "talk", "voice"],
  avoid: ["novel", "story", "plot", "character", "reading", "sound of", "mathematics", "active listening"],
  doesNotShow: "a particular speech or performance; listening skills", evidence: "Oak KS1-KS3 speaking and listening keywords: volume, pace, pitch, eye contact, posture.",
  build: () => {
    let s = T(120, 18, "Speaking well", "tb");
    [["volume", "loud enough", 0, 0], ["pace", "not too fast", 1, 0], ["pitch", "vary voice", 2, 0], ["eye contact", "look up", 0, 1], ["posture", "stand tall", 1, 1]].forEach(([a, b, c, r]) => {
      s += box(8 + (c as number) * 78, 32 + (r as number) * 52, 74, 46, [B, G, Y, R, V][(c as number) + (r as number) * 3], 6) + T(45 + (c as number) * 78, 52 + (r as number) * 52, a as string, "ts") + T(45 + (c as number) * 78, 66 + (r as number) * 52, b as string, "tx tm");
    });
    return s;
  },
});
const senses = mk({
  id: "sensory-imagery", title: "Imagery", alt: "Imagery: words that paint a picture in the mind. It can appeal to any of the five senses, with a phrase for each that a writer might use: sight (a golden sunset), sound (a roaring engine), smell (fresh bread), taste (sour lemons), touch (rough bark).",
  caption: "Imagery paints pictures in the mind", concepts: ["imagery", "sensory language", "sensory detail", "sensory details", "senses", "five senses"],
  avoid: ["imagery of the poem"],
  doesNotShow: "a specific poem or passage", evidence: "Oak keyword 'imagery': the use of language to create a mental picture or sensory experience for the reader or listener. Drawn: sight, sound, smell, taste, touch with neutral example phrases.",
  build: () => {
    let s = T(120, 16, "Imagery: pictures in the mind", "t") + T(120, 28, "it can appeal to any of the senses", "tx tm");
    [["sight", "a golden sunset"], ["sound", "a roaring engine"], ["smell", "fresh bread"], ["taste", "sour lemons"], ["touch", "rough bark"]].forEach(([a, b], i) => {
      const y = 36 + i * 21; s += box(10, y, 56, 18, [B, G, Y, R, V][i], 4) + T(38, y + 13, a, "ts") + T(74, y + 13, b, "ts tl");
    });
    return s;
  },
});
const figurative = mk({
  id: "figurative-language", title: "Figurative language", alt: "Four kinds of figurative language, each with a short neutral example: simile (as cold as ice), metaphor (time is a thief), personification (the wind whispered) and hyperbole (a million years). A note says figurative language is not meant literally.",
  caption: "Language that is not meant literally", concepts: ["figurative language"],
  doesNotShow: "the full list of figurative devices", evidence: "Oak keyword 'figurative language': the use of simile and personification to paint vivid pictures for the reader. Drawn: simile, metaphor, personification, hyperbole with generic examples.",
  build: () => {
    let s = T(120, 18, "Figurative language", "tb");
    [["simile", "as cold as ice"], ["metaphor", "time is a thief"], ["personification", "the wind whispered"], ["hyperbole", "a million years"]].forEach(([a, b], i) => {
      const y = 28 + i * 26; s += box(8, y, 84, 20, [B, G, Y, R][i], 5) + T(50, y + 14, a, "tx") + T(100, y + 14, b, "ts tl");
    });
    s += T(120, 138, "not meant literally", "ts tm");
    return s;
  },
});

// ── handwriting ─────────────────────────────────────────────────────────────
const tramlines = (() => {
  const top = 34, xh = 64, base = 94, desc = 124;
  const glyphs = (() => {
    const r = (base - xh) / 2;
    const a = `<circle cx="50" cy="${xh + r}" r="${r}" class="l f0"/><line x1="${50 + r}" y1="${xh}" x2="${50 + r}" y2="${base}" class="l"/>`;
    const b = `<line x1="100" y1="${top}" x2="100" y2="${base}" class="l"/><circle cx="${100 + r}" cy="${xh + r}" r="${r}" class="l f0"/>`;
    const p = `<line x1="150" y1="${xh}" x2="150" y2="${desc}" class="l"/><circle cx="${150 + r}" cy="${xh + r}" r="${r}" class="l f0"/>`;
    return a + b + p;
  })();
  return mk({
    id: "tramlines", title: "Tramlines", alt: "Straight parallel writing lines used as a guide, with the letters a, b and p written on them: a sits between the middle lines, b rises to the top line, p drops below the bottom line.",
    caption: "Tramlines keep letters neat and the same size", concepts: ["tramlines", "tramline"],
    doesNotShow: "how to form the letters", evidence: "Oak keyword 'tramlines': straight, parallel lines that we can use as a guide to help us write neatly and keep our letters the same size. Drawn: guide lines with the letters a, b, p (x-height, ascender, descender).",
    build: () => `<g>${[top, xh, base].map((y) => ln(14, y, 226, y, y === base ? "l" : "th")).join("")}${ln(14, desc, 226, desc, "th")}${glyphs}</g>`,
  });
})();
const leadInOut = (() => {
  const base = 100, xh = 66;
  return mk({
    id: "lead-in-out", title: "Lead in and lead out", alt: "A joined-up (cursive) letter i drawn on a baseline and an x-height line, with its lead-in stroke at the start labelled lead in, and its lead-out stroke at the end labelled lead out.",
    caption: "The strokes that go into and out of a letter", concepts: ["lead in", "lead ins", "lead out", "lead outs", "lead-in stroke", "lead-out stroke"],
    requires: ["cursive", "handwriting", "join", "joins", "letter", "letters", "writing"],
    avoid: ["no lead", "without lead"],
    doesNotShow: "how any particular join is formed; joins between letters", evidence: "Oak keywords: 'lead in' = the stroke or line that guides us into starting a letter; 'lead out' = the stroke or line that guides us to smoothly finish a letter. Drawn on one cursive letter i with baseline and x-height lines.",
    build: () => {
      let s = ln(14, xh, 226, xh, "th") + ln(14, base, 226, base, "th");
      s += path(`M44 ${base} C60 ${base} 76 ${base - 16} 82 ${xh} L82 ${base - 8} C82 ${base + 2} 96 ${base + 2} 114 ${base - 14}`, "a") + `<circle cx="82" cy="${xh - 12}" r="2.6" class="dot"/>`;
      s += T(46, 128, "lead in", "ts tl") + ln(50, 120, 50, base + 3, "th") + T(176, 128, "lead out", "ts te") + ln(150, 120, 112, base - 12, "th");
      s += T(120, 26, "one cursive letter", "ts tm");
      return s;
    },
  });
})();

export const PIC_C: Pic[] = [paragraph, essay, pee, report, recount, diary, letterLayout, newspaper, instructions, persuasive, debate, writingProcess, storyElements, storyStructure, characterisation, showTell, perspective, inference, retrieve, summarise, predict, compare, cohesion, speaking, senses, figurative, tramlines, leadInOut];
void V; void N; void G; void wrap; void row; void sentence;
