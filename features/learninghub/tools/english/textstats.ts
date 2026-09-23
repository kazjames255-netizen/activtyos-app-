// Pure, deterministic text statistics for the FrameWriter family. No dictionaries, no network, no AI. Advice only — never a grade.

const WORD_RE = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;

export function words(text: string): string[] { return text.match(WORD_RE) ?? []; }
export function wordCount(text: string): number { return words(text).length; }

export function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => wordCount(p) > 0);
}
export function paragraphCount(text: string): number { return paragraphs(text).length; }

const ABBREVIATIONS = new Set(["mr", "mrs", "ms", "dr", "prof", "st", "e.g", "i.e", "vs", "no", "approx", "dept", "jr", "sr"]);

/** Split into sentences. Handles "Mr. Smith", "e.g.", decimals, ellipses and closing quotes; blank lines always end a sentence. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n\s*\n/)) {
    let start = 0;
    const re = /[.!?]+["'”’)\]]*(?=\s|$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(para))) {
      const end = m.index + m[0].length;
      const punct = m[0].replace(/["'”’)\]]+$/, "");
      const closed = punct.length !== m[0].length;
      const rest = para.slice(end);
      const next = rest.trimStart().charAt(0);
      const lowerNext = next !== "" && next === next.toLowerCase() && next !== next.toUpperCase();
      if (punct === ".") {
        const before = /(\S+)$/.exec(para.slice(start, m.index))?.[1] ?? "";
        const key = before.replace(/^["'“‘(\[]+/, "").toLowerCase();
        if (ABBREVIATIONS.has(key)) continue;
      } else if (lowerNext && (closed || /^\.{2,}$/.test(punct))) {
        continue; // ellipsis / quoted speech continuing: "Stop!" he said.
      }
      const s = para.slice(start, end).trim();
      if (wordCount(s) > 0) out.push(s);
      start = end;
    }
    const tail = para.slice(start).trim();
    if (wordCount(tail) > 0) out.push(tail);
  }
  return out;
}
export function sentenceCount(text: string): number { return splitSentences(text).length; }

const round1 = (n: number) => Math.round(n * 10) / 10;
export function averageSentenceLength(text: string): number {
  const n = sentenceCount(text);
  return n === 0 ? 0 : round1(wordCount(text) / n);
}

export const LENGTH_BUCKETS = ["1-5", "6-10", "11-15", "16-20", "21+"] as const;
const bucketOf = (n: number) => (n <= 5 ? 0 : n <= 10 ? 1 : n <= 15 ? 2 : n <= 20 ? 3 : 4);

export interface Variety { lengths: number[]; histogram: { bucket: string; count: number }[]; tips: string[] }
export function sentenceVariety(text: string): Variety {
  const lengths = splitSentences(text).map(wordCount);
  const histogram = LENGTH_BUCKETS.map((bucket) => ({ bucket, count: 0 }));
  for (const l of lengths) histogram[bucketOf(l)]!.count++;
  const tips: string[] = [];
  const n = lengths.length;
  if (n >= 4) {
    if (Math.max(...lengths) > 35) tips.push("One sentence is very long. Could you split it in two?");
    if (Math.min(...lengths) > 5) tips.push("Try a short sentence for impact.");
    if (Math.max(...lengths) < 15) tips.push("Try one longer sentence that adds extra detail with a connective.");
  }
  return { lengths, histogram, tips };
}

const STOP = new Set(("a about above after again all also am an and any are as at be because been before being but by can could did do does doing down for from had has have he her here hers him his how i if in into is it its just me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up us very was we were what when where which while who why will with would you your yours said").split(" "));
export const isStopWord = (w: string) => STOP.has(w.toLowerCase().replace(/[’]/g, "'"));

export function repeatedWords(text: string, minCount = 3): { word: string; count: number }[] {
  const c = new Map<string, number>();
  for (const w of words(text)) {
    const k = w.toLowerCase().replace(/’/g, "'");
    if (k.length < 3 || isStopWord(k) || /^\d+$/.test(k)) continue;
    c.set(k, (c.get(k) ?? 0) + 1);
  }
  return [...c].filter(([, n]) => n >= minCount).map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

export interface Openers { openers: { word: string; count: number }[]; maxRun: number; tip: string | null }
export function sentenceOpeners(text: string): Openers {
  const firsts = splitSentences(text).map((s) => (words(s)[0] ?? "").toLowerCase());
  const c = new Map<string, number>();
  let maxRun = firsts.length ? 1 : 0, run = 1;
  firsts.forEach((w, i) => {
    c.set(w, (c.get(w) ?? 0) + 1);
    if (i > 0) { run = w === firsts[i - 1] ? run + 1 : 1; if (run > maxRun) maxRun = run; }
  });
  const openers = [...c].filter(([, n]) => n >= 2).map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  const top = openers[0];
  let tip: string | null = null;
  if (maxRun >= 2) tip = `${maxRun} sentences in a row start with the same word. Try starting one differently.`;
  else if (top && top.count >= 3) tip = `${top.count} sentences start with "${top.word}". Try a different opener for one of them.`;
  return { openers, maxRun, tip };
}

export const CONNECTIVES = ["on the other hand", "in addition", "as a result", "for example", "for instance", "in contrast", "in conclusion", "as well as", "even though", "because", "although", "however", "therefore", "meanwhile", "furthermore", "moreover", "whereas", "consequently", "similarly", "firstly", "secondly", "finally", "nevertheless", "despite", "unless", "but"] as const;
export function connectivesUsed(text: string): { word: string; count: number }[] {
  const lower = text.toLowerCase().replace(/’/g, "'");
  const out: { word: string; count: number }[] = [];
  for (const w of CONNECTIVES) {
    const n = (lower.match(new RegExp(`(?<![\\p{L}\\p{N}])${w.replace(/ /g, "\\s+")}(?![\\p{L}\\p{N}])`, "gu")) ?? []).length;
    if (n > 0) out.push({ word: w, count: n });
  }
  return out;
}

/** Reading time at 200 words a minute. */
export function readingTime(text: string): { minutes: number; label: string } {
  const w = wordCount(text);
  const minutes = round1(w / 200);
  return { minutes, label: w === 0 ? "nothing yet" : minutes < 1 ? "under a minute" : `about ${Math.round(minutes)} min` };
}

export interface Progress { done: number; total: number; fraction: number; percent: number }
export function checklistProgress(items: readonly string[], ticked: Iterable<string>): Progress {
  const set = new Set(ticked);
  const total = items.length;
  const done = items.filter((i) => set.has(i)).length;
  const fraction = total === 0 ? 0 : done / total;
  return { done, total, fraction, percent: Math.round(fraction * 100) };
}

export type TargetStatus = "none" | "below" | "inRange" | "above";
export interface Target { words: number; status: TargetStatus; toMin: number; over: number; message: string }
export function wordsToTarget(text: string, min?: number, max?: number): Target {
  const w = wordCount(text);
  const toMin = min !== undefined ? Math.max(0, min - w) : 0;
  const over = max !== undefined ? Math.max(0, w - max) : 0;
  let status: TargetStatus = "none", message = `${w} word${w === 1 ? "" : "s"}`;
  if (min !== undefined && w < min) { status = "below"; message = `${w} words: about ${toMin} more to reach ${min}`; }
  else if (max !== undefined && w > max) { status = "above"; message = `${w} words: ${over} over the ${max} target`; }
  else if (min !== undefined || max !== undefined) { status = "inRange"; message = `${w} words: right on target`; }
  return { words: w, status, toMin, over, message };
}

export interface Report {
  words: number; sentences: number; paragraphs: number; avgSentenceLength: number; reading: string;
  variety: Variety; repeated: { word: string; count: number }[]; openers: Openers; connectives: { word: string; count: number }[];
}
export function analyse(text: string): Report {
  return {
    words: wordCount(text), sentences: sentenceCount(text), paragraphs: paragraphCount(text), avgSentenceLength: averageSentenceLength(text),
    reading: readingTime(text).label, variety: sentenceVariety(text), repeated: repeatedWords(text), openers: sentenceOpeners(text), connectives: connectivesUsed(text),
  };
}
