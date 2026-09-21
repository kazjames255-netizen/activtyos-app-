// X4 English pictures: unit tests (run by art/cli.ts check).
//   generated: every picture gets (1) a POSITIVE test (its first concept as a key-word term, plus a `requires` word when it has one -> it is chosen),
//              (2) a PASSING-MENTION test (the concept only inside a definition on a slide about something else -> not chosen),
//              (3) a QUESTION test (same slide as a practice slide -> no picture), (4) an AVOID test when the picture has `avoid` (-> vetoed),
//              (5) a WRONG-SUBJECT test (Maths deck -> not chosen).
//   hand-written: the contradictions found while reviewing real slides.
import type { Slide } from "../../../../../features/learninghub/lesson/slides/types";
import { chooseArt } from "./select";
import { EXT_ENGLISH, EXT_ENGLISH_WARN } from "./ext-english";

type SL = Pick<Slide, "kind" | "title" | "blocks">;
const keyWords = (term: string, def: string): SL => ({ kind: "intro", title: "Key words", blocks: [{ t: "define", items: [{ term, def }] }] as Slide["blocks"] });
const lead = (title: string, text: string, kind: Slide["kind"] = "explain"): SL => ({ kind, title, blocks: [{ t: "lead", text }] as Slide["blocks"] });
const clean = (s: string) => s.replace(/[-’']/g, " ");

export function runExtEnglishChecks(): { problems: string[]; n: number } {
  const bad: string[] = []; let n = 0;
  const ctx = { subject: "English", lessonTitle: "", unitTitle: "" };
  for (const p of EXT_ENGLISH) {
    const term = p.concepts[0];
    const req = p.requires?.[0] ?? "";
    const def = `${req ? `a ${req} ` : ""}idea used in English lessons`.trim();
    // 1 positive
    n++; const pos = chooseArt(keyWords(term, def), ctx);
    if (!pos.pics.includes(p.id)) bad.push(`X4 ${p.id}: positive test failed for "${term}" (got [${pos.pics}]; ${pos.notes.slice(0, 2).join("; ")})`);
    // 2 passing mention: the concept only in a definition of another term, on a slide titled about something else
    n++; const pass = chooseArt({ kind: "intro", title: "Key words", blocks: [{ t: "define", items: [{ term: "zebra crossing", def: `${req} a place to cross where a ${term} is not the topic` }] }] as Slide["blocks"] }, ctx);
    if (pass.pics.includes(p.id)) bad.push(`X4 ${p.id}: shown for a passing mention of "${term}"`);
    // 3 never on a question slide
    n++; const q = chooseArt({ kind: "practice", title: "Key word practice", blocks: [{ t: "choice", q: `Which key word? ${term} ${req}`, options: [term, "other", "another"], answer: 0 }] as Slide["blocks"] }, ctx);
    if (q.pics.length) bad.push(`X4 ${p.id}: picture on a question slide`);
    // 4 avoid veto
    if (p.avoid?.length) {
      const a = clean(p.avoid[0]).replace(/^=/, "");
      n++; const v = chooseArt(keyWords(term, `${def} about ${a}`), ctx);
      if (v.pics.includes(p.id)) bad.push(`X4 ${p.id}: not vetoed by avoid phrase "${p.avoid[0]}"`);
    }
    // 5 subject gate
    n++; const m = chooseArt(keyWords(term, def), { subject: "Maths", lessonTitle: "", unitTitle: "" });
    if (m.pics.includes(p.id)) bad.push(`X4 ${p.id}: chosen for a Maths deck`);
  }
  // hand-written: contradictions found while reviewing real generated slides
  const has = (name: string, s: SL, id: string, want: boolean, lessonTitle = "", unitTitle = "") => { n++; const r = chooseArt(s, { subject: "English", lessonTitle, unitTitle }); if (r.pics.includes(id) !== want) bad.push(`X4 test "${name}": expected ${id} ${want ? "present" : "absent"}, got [${r.pics}]`); };
  has("comparative imagery is not the tall/taller picture", lead("Today’s learning", "I can understand and explain the use of comparative imagery in a poem.", "intro"), "comparative-superlative", false, "Explaining comparative imagery in unseen poetry");
  has("comparative paragraphs are not adjectives", lead("Comparative main body paragraphs", "The opening of comparative paragraphs could start with a topic sentence."), "comparative-superlative", false);
  has("comparatives of adjectives get the picture", lead("Developing comparatives and superlatives", "Comparatives are used to compare two things; superlatives compare one noun to a group. They are forms of an adjective."), "comparative-superlative", true);
  has("no lead-ins lesson: no lead-in picture", keyWords("lead out", "the stroke that guides us to smoothly finish a letter"), "lead-in-out", false, "Reviewing high frequency words, no lead-ins", "Handwriting review, with no lead-ins");
  has("lead in / lead out (handwriting) gets the picture", keyWords("lead in", "the stroke or line that guides us into starting a letter in cursive handwriting"), "lead-in-out", true, "The second join: ck, ch with lead in");
  has("declarative/exclamatory sentence types: not the simple/compound/complex picture", lead("Understanding different sentence types", "Declarative sentences convey facts; exclamatory sentences express strong feelings. Sentence structures vary."), "sentence-types", false);
  has("a slide titled Summary is not the summarise skill", { kind: "summary", title: "Summary", blocks: [{ t: "list", items: ["Dickens uses Gothic conventions."] }] as Slide["blocks"] }, "summarise", false);
  has("summarise skill gets the picture", keyWords("summarise", "to pull out the key events and ideas from the text"), "summarise", true);
  has("plan for a lesson plan is not the writing process", keyWords("plan", "a lesson plan for the teacher"), "writing-process", false);
  has("Presenting a report: no report page layout", lead("Presenting a non-chronological report", "Presentations should be spoken clearly and at a suitable volume."), "non-chronological-report", false);
  has("essay question not an essay structure", lead("Reading the essay question", "An essay question tells you what to write about in the exam."), "essay-structure", false);
  has("story mountain slides do not also get the five-part structure", lead("The story mountain", "The story mountain shows the rising action, climax and resolution of a narrative."), "story-structure", false);
  has("setting out is not a story setting", lead("Setting out your work", "Setting out your work neatly in the story book helps the reader."), "story-elements", false);
  has("a poem’s tragedy of the commons is not a tragic hero", lead("Tragedy of the commons", "The tragedy of the commons is an idea about shared land."), "tragic-hero-arc", false);
  has("Shakespeare tragedy gets the tragic hero arc", lead("The conventions of a Shakespearean tragedy", "A tragic hero has a fatal flaw called hamartia."), "tragic-hero-arc", true);
  has("body language in fiction is not speaking skills", keyWords("body language", "how a character moves and stands in a novel"), "speaking-skills", false);
  has("relative clause has its own picture, not the because picture", lead("Relative complex sentences", "A relative clause joined with a main clause forms the relative complex sentence."), "complex-sentence", false);
  has("dramatic irony is not verbal irony", keyWords("dramatic irony", "the audience knows something the characters do not"), "irony", false);
  has("extended metaphor is not the simple metaphor picture", keyWords("extended metaphor", "a metaphor that continues over several lines"), "metaphor", false);
  has("apostrophe for plural possession does not get the singular picture", lead("Plural possession", "The apostrophe for plural possession comes after the s."), "apostrophe-possession", false);
  has("hyphen and dash are different", keyWords("dash", "a punctuation mark to add extra information in a clause"), "hyphen", false);
  has("chemical symbols are not literary symbolism", keyWords("symbol", "a chemical symbol for an element"), "symbolism", false);
  has("a quoted book title is not a concept", lead("Reading ‘The Simile Tree’", "The novel ‘The Simile Tree’ follows a girl."), "simile", false);
  has("tense = nervous is not the verb-tense timeline", keyWords("tense", "nervous and worried and unable to relax"), "tense-timeline", false);
  // independent image QA (English + languages): defects found while reviewing every picture against generated slides
  has("an advert headline is not a newspaper headline", lead("Developing an eye-catching headline", "The headline of a persuasive advert should be eye catching and hook the reader.", "intro"), "newspaper-article", false, "Generating a headline and opening for a persuasive advert");
  has("a newspaper headline gets the newspaper layout", keyWords("headline", "the heading at the top of a newspaper article"), "newspaper-article", true);
  has("possession (something owned) is not the apostrophe picture", keyWords("possession", "something that is owned or possessed"), "apostrophe-possession", false, "Planning the opening of a journalistic report about the Titanic");
  has("apostrophes for possession get the picture", keyWords("apostrophe for possession", "a punctuation mark used to show if a noun belongs to another noun"), "apostrophe-possession", true);
  has("adjectives that compare are not the compare-and-contrast Venn", lead("Adjectives: to compare", "Adjectives are words that can compare nouns. Comparing nouns is another way to describe them.", "explain"), "compare-contrast", false, "Adjectives: to compare");
  has("comparing two poems gets the Venn", lead("Comparing two poems", "When we compare two poems we look at similarities and differences.", "explain"), "compare-contrast", true);
  has("active listening is not the speaking-skills picture", keyWords("active listening", "fully concentrating and responding thoughtfully to what someone is saying"), "speaking-skills", false, "Working together: productive discussions and active listening skills");
  has("a turning point is not drawn on the five-part story picture", keyWords("turning point", "a moment in a story that changes what happens next"), "story-structure", false, "Turning points in a story");
  // layout check: no label may leave the canvas
  n++; if (EXT_ENGLISH_WARN.length) for (const w of EXT_ENGLISH_WARN) bad.push(`X4 layout: ${w}`);
  return { problems: bad, n };
}
