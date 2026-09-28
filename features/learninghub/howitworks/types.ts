// Data model for the Teaching Hub "How it works" explainers. A scene is a piece of narration plus VISUAL CUES that are each anchored to a
// phrase of that narration (`on`): when the voice reaches the phrase (or, with sound off, when the scene clock reaches the same spot in
// the text) the camera zooms, the ring lights up, the cursor moves and the callout pops. Copy and animation live in one place per scene.

export type HowRole = "tutor" | "parent" | "kid";

/** Percentages (0-100) are always of the SCREENSHOT's width / height. */
export interface Shot { src: string; w: number; h: number; device?: "desktop" | "phone"; url?: string }
/** A cue is anchored to a phrase of the narration (`on`). Where it points is either the REAL element it names (`el`, resolved against the
 *  element rectangles recorded with the screen: see rects.ts) or, only for old hand-placed cues, explicit percentages. An `el` that
 *  cannot be found draws nothing: a ring never floats over the wrong spot. */
export interface Cue { /** A phrase that appears in the scene's `say`; the cue fires when it has been spoken. "" = at the start. */ on: string; /** The element it points at: its label text, "#testid", "tag:h2", with an optional "@2" for the second match. */ el?: string }
export interface Cam extends Cue { x?: number; y?: number; /** Zoom; omit with `el` to fit the element. */ z?: number }
export interface Ring extends Cue { x?: number; y?: number; w?: number; h?: number; label?: string; off?: string }
export interface Cursor extends Cue { x?: number; y?: number; click?: boolean }
export interface Callout extends Cue { x?: number; y?: number; text: string; dir?: "up" | "down" | "left" | "right"; off?: string }
export interface SwapShot extends Cue, Shot {}
export interface Node extends Cue { icon: string; title: string; sub?: string; tone?: "a" | "b" | "c" | "d" }
export interface Link { label: string; href: string }

export interface Scene {
  id: string;
  chapter: string;
  title: string;
  /** The narration. Plain, warm, benefit-first. Every claim must be true of the current app. */
  say: string;
  /** Kinetic phrases (3-6 words) that stack up in order as the voice reaches them. A phrase is timed by itself (it appears in `say`, any case) or written "Shown text::phrase in say" to be timed by another phrase. */
  keys: string[];
  layout?: "shot" | "flow" | "grid" | "title";
  shot?: Shot;
  /** Screenshot swaps during the scene (first should be `on: ""`). Falls back to `shot`. */
  shots?: SwapShot[];
  cam?: Cam[];
  rings?: Ring[];
  cursor?: Cursor[];
  callouts?: Callout[];
  nodes?: Node[];
  /** Big emoji for title / flow scenes. */
  emoji?: string;
  /** Extra links on the final scene. */
  links?: Link[];
}

/** Which child explainer: Reception to Year 2 gets a shorter, icon-led one. */
export type HowBand = "ks1" | "std";
export interface HowScript {
  role: HowRole;
  slug: "tutors" | "parents" | "children";
  /** "ks1" = the extra-simple child version. */
  band?: HowBand;
  title: string;
  tagline: string;
  /** Tab / pill label on the public page and in the window ("For tutors"). */
  audience: string;
  /** What a viewer of a DIFFERENT role sees it called ("What your child sees"). */
  viewLabel?: string;
  /** Set on a topic video of a library (e.g. "homework"). Undefined = the role's main video / library heading. */
  topic?: string;
  /** Chooser card: one line on what the video covers and its emoji. */
  blurb?: string;
  emoji?: string;
  /** Where the last scene's "Try it now" button lands: a tutor hub sub-tab id (tabGroups.ts), e.g. "set" opens the Set homework form. */
  tryIt?: { sub: string };
  scenes: Scene[];
}

/** "Shown::anchor" -> the text to show and the phrase of the narration that times it. */
export const keyParts = (k: string): [string, string] => { const i = k.indexOf("::"); return i < 0 ? [k, k] : [k.slice(0, i), k.slice(i + 2)]; };
/** Case-insensitive position of a phrase in the narration (-1 when absent). */
export const posIn = (say: string, phrase: string): number => say.toLowerCase().indexOf(phrase.toLowerCase());
