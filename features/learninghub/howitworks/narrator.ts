// Browser read-aloud for the explainers: speechSynthesis (works offline with the device's own voices), split into sentences so a long
// scene never stalls the engine, with word-boundary events so the key words and captions follow the VOICE. Silent no-op where speech
// isn't available. Nothing here speaks until a caller (always a click / key press) asks it to.

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

/** Voices for a language ("en", "pl", "ar" ...): matched on the primary subtag of the voice's BCP-47 tag (en-GB, ar-SA, pt_BR ...). */
export function voicesFor(lang: string): SpeechSynthesisVoice[] {
  if (!speechSupported()) return [];
  const prim = lang.toLowerCase().split(/[-_]/)[0];
  const all = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().split(/[-_]/)[0] === prim);
  // local (offline) voices first, then British, then by name — stable order for the picker
  return all.sort((a, b) => Number(b.localService) - Number(a.localService) || Number(/en[-_]GB/i.test(b.lang)) - Number(/en[-_]GB/i.test(a.lang)) || a.name.localeCompare(b.name));
}
const PREFER = /(Serena|Daniel|Kate|Stephanie|Google UK English Female|Microsoft (Sonia|Libby|Ryan)|Samantha|Karen)/i;
export const englishVoices = () => voicesFor("en");
/** The best voice for `lang` (default English): the viewer's pick, else a local voice of the exact regional tag, else any voice of that language, else null (the caller then stays silent for non-English). */
export function pickVoice(uri?: string | null, lang = "en-GB"): SpeechSynthesisVoice | null {
  const v = voicesFor(lang);
  if (!v.length) return null;
  if (uri) { const chosen = v.find((x) => x.voiceURI === uri); if (chosen) return chosen; }
  if (!/^en/i.test(lang)) { const tag = lang.toLowerCase().replace("_", "-"); return v.find((x) => x.lang.toLowerCase().replace("_", "-") === tag && x.localService) || v.find((x) => x.localService) || v[0]; }
  return v.find((x) => /en[-_]GB/i.test(x.lang) && x.localService && PREFER.test(x.name)) || v.find((x) => /en[-_]GB/i.test(x.lang) && x.localService) || v.find((x) => /en[-_]GB/i.test(x.lang)) || v[0];
}

interface Chunk { text: string; at: number }
function chunks(text: string, from: number): Chunk[] {
  const out: Chunk[] = [];
  const re = /[^.!?؟۔।]+[.!?؟۔।]+["')\]»”]*\s*|[^.!?؟۔।]+$/g;   // also Arabic / Urdu / Devanagari-style full stops
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) if (m.index + m[0].length > from) out.push({ text: m[0], at: m.index });
  return out;
}
/** Start of the sentence containing char `pos` — where a resume picks up. */
export function sentenceStart(text: string, pos: number): number {
  let s = 0;
  for (const c of chunks(text, 0)) { if (c.at <= pos) s = c.at; else break; }
  return s;
}

export interface SpeakOpts {
  rate: number; voiceURI?: string | null; from?: number; /** BCP-47 language of the text (default en-GB): picks a matching voice, else the engine is told the language and the caller should have gone silent. */ lang?: string;
  onStart?: () => void; onBoundary?: (charPos: number) => void; onEnd?: () => void; onError?: () => void;
}
let gen = 0;
export function cancelSpeech() { gen++; try { if (speechSupported()) speechSynthesis.cancel(); } catch { /* ignore */ } }
export function speak(text: string, o: SpeakOpts): void {
  if (!speechSupported()) { o.onError?.(); return; }
  cancelSpeech();
  const my = gen;
  const list = chunks(text, o.from ?? 0);
  if (!list.length) { o.onEnd?.(); return; }
  const lang = o.lang ?? "en-GB";
  const voice = pickVoice(o.voiceURI, lang);
  let i = 0;
  const next = () => {
    if (my !== gen) return;
    if (i >= list.length) { o.onEnd?.(); return; }
    const c = list[i++];
    const u = new SpeechSynthesisUtterance(c.text);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = lang;
    u.rate = o.rate; u.pitch = 1;
    if (i === 1) u.onstart = () => { if (my === gen) o.onStart?.(); };
    u.onboundary = (e) => { if (my === gen && e.charIndex != null) o.onBoundary?.(c.at + e.charIndex + (e.charLength || 0)); };
    u.onend = () => { if (my !== gen) return; o.onBoundary?.(c.at + c.text.length); setTimeout(next, /[.!?؟۔।]\s*$/.test(c.text) ? 220 : 0); }; // a natural breath between sentences
    u.onerror = (e) => { if (my !== gen) return; if (e.error === "canceled" || e.error === "interrupted") return; o.onError?.(); };
    try { speechSynthesis.speak(u); } catch { o.onError?.(); }
  };
  next();
}
