// One caption at a time: the narration is cut into sentences (English, Arabic / Urdu ؟ ۔, Devanagari / Bengali / Gurmukhi । ॥, CJK 。),
// and a sentence over `max` words is cut again at its commas / colons so no caption ever holds more than ~20 words.
export interface CapSeg { a: number; b: number }
const END = "[.!?…؟۔।॥。]";
const SENT = new RegExp(`[^.!?…؟۔।॥。]+(?:${END}+["'”’)\\]]*)?|${END}+`, "g");
const SOFT = /[,;:،؛]\s+/g;
const words = (t: string) => (t.match(/\S+/g) ?? []).length;
export function captionSegments(say: string, max = 20): CapSeg[] {
  const out: CapSeg[] = [];
  const push = (a: number, b: number) => { while (a < b && /\s/.test(say[a])) a++; while (b > a && /\s/.test(say[b - 1])) b--; if (b > a) out.push({ a, b }); };
  let m: RegExpExecArray | null; SENT.lastIndex = 0;
  while ((m = SENT.exec(say))) {
    const a = m.index, b = a + m[0].length, text = say.slice(a, b);
    if (words(text) <= max) { push(a, b); continue; }
    // cut at soft breaks, then merge greedily up to `max` words; a piece that is still too long is cut by word count
    const cuts: number[] = [a]; let s: RegExpExecArray | null; SOFT.lastIndex = 0;
    while ((s = SOFT.exec(text))) cuts.push(a + s.index + s[0].length);
    cuts.push(b);
    let start = a;
    for (let k = 1; k < cuts.length; k++) {
      if (words(say.slice(start, cuts[k])) > max && cuts[k - 1] > start) { push(start, cuts[k - 1]); start = cuts[k - 1]; }
      while (words(say.slice(start, cuts[k])) > max) { const ws = [...say.slice(start, cuts[k]).matchAll(/\S+/g)]; const w = ws[max]; push(start, start + w.index!); start += w.index!; }
    }
    push(start, b);
  }
  return out.length ? out : [{ a: 0, b: say.length }];
}
/** Index of the caption that holds character position `pos`. */
export const segAt = (segs: CapSeg[], pos: number): number => { let k = 0; for (let n = 0; n < segs.length; n++) if (segs[n].a <= pos) k = n; return k; };
