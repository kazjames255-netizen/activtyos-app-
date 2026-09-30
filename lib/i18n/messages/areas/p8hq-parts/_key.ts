// Keys for p8hq "label by English text" lookups (HQ screens whose labels live in big module-level tables).
// `hqKey("Holiday camps & clubs")` -> "lw_holiday_camps_clubs_<hash>". A leading emoji/symbol token is ignored
// (translate the words, the runtime re-attaches the emoji), so catalogues hold plain text.
const LEAD_SYM = /^([^\p{L}\p{N}\s]+)\s+(.+)$/u;

export function splitLead(s: string): [string, string] {
  const m = LEAD_SYM.exec(s);
  return m ? [m[1] + " ", m[2]] : ["", s];
}

function hash36(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Key (without the `p8hq.` prefix) for the plain English text. */
export function hqKey(plain: string): string {
  const slug = plain.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  return `lw_${slug}_${hash36(plain)}`;
}
