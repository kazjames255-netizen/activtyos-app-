// Verified picture library — types. Everything in factory/art is pure TypeScript (no node imports): the browser imports the library to draw
// slide pictures, the factory imports it to choose / verify them.
//
// POLICY (docs/hub-review/F1-images.md): a slide gets a picture ONLY when a verified match exists; otherwise NO picture. A wrong or
// contradicting picture is a severe bug, a missing one is fine. Every picture below is purpose-drawn with the correct geometry and
// carries the exact keywords/phrases it is valid for (`concepts`) plus an explicit note of what it does NOT show.
export type Subject = "Maths" | "Science" | "English" | "French" | "Spanish" | "German";

export interface Pic {
  /** stable id stored in slide.pics (kebab-case) */
  id: string;
  /** short name shown in the review docs */
  title: string;
  /** alt text: says exactly what is drawn, including what its labels say */
  alt: string;
  /** caption shown under the picture on the slide */
  caption: string;
  subjects: Subject[];
  /** exact words / whole phrases (lower case; the plural of the LAST word also matches) this picture is valid for */
  concepts: string[];
  /** pictures of one family exclude each other: a slide naming another member of the family never gets this picture unless that member is shown too */
  family?: string;
  /** polysemous concepts: at least one of these phrases must ALSO appear in the slide text (e.g. "nucleus" needs "cell") */
  requires?: string[];
  /** never used when any of these phrases is in the slide text (other meaning of the word, or a topic the picture would contradict) */
  avoid?: string[];
  /** names of family members this picture ALSO shows (so a slide naming them is not a conflict) */
  covers?: string[];
  /** the picture draws SPECIFIC numbers/values: it is rejected when the slide text contains any number (digits) */
  numeric?: boolean;
  /** key-stage scope (Oak slugs: ks1..ks4): when set, the picture is refused for any other key stage (a KS2 diagram must not appear on a KS4 slide about the same word) */
  keyStages?: string[];
  /** what the picture deliberately does NOT depict (machine-readable in the review table) */
  doesNotShow: string;
  /** how the drawing was verified (the concept definition + the geometry rules used) */
  evidence: string;
  /** inline SVG (uses the .pic-* theme classes from PIC_CSS; ids are unique to the picture) */
  svg: string;
}

/** A literal-emoji entry: the emoji is an unambiguous depiction of a concrete noun. */
export interface EmojiEntry { emoji: string; /** Unicode short name */ name: string; words: string[]; /** words in other languages (only used in that language's decks) */ fr?: string[]; es?: string[]; de?: string[]; subjects: Subject[]; note?: string }

/** What the deck builder knows about the lesson a slide belongs to. */
export interface ArtContext { subject: string; /** raw Oak subject: Biology / Chemistry / Physics / Combined Science / Science ... */ discipline?: string; keyStage?: string; lessonTitle?: string; unitTitle?: string; keywords?: string[] }

/** The pictures chosen for one slide. */
export interface SlideArt { pics: { id: string }[]; emoji: string[] }
