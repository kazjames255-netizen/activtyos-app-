/** Regression (9 Oct): the online-session join card ("How to join" on the booking-done screen, My bookings, parent home) was near-black with dark
 *  green / grey text on a light page. Every text/background pair on the card must be >= 4.5:1 (disabled "Opens HH:MM" label too) in every variable scope
 *  the card can render in: the default dark :root, the light custdash portal, and the aos-light pin used inside the public booking-done card.
 *  The 25 booking-page themes do not recolour this card (the done screen is a fixed white card), so the scopes above are the full set. Pure. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contrast } from "../../features/listings/pageThemes";

const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const src = readFileSync(new URL("../../features/onlinesessions/OnlineSessionsPanel.tsx", import.meta.url), "utf8");

function block(sel: string): Record<string, string> {
  const i = css.indexOf(sel + " {");
  assert.ok(i >= 0, `${sel} block exists`);
  const body = css.slice(i, css.indexOf("}", i));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
}
const root = block(":root");
const scopes: Record<string, Record<string, string>> = {
  "dark :root": root,
  "custdash light": { ...root, ...block('.portal[data-portal="custdash"]') },
  "aos-light (booking-done card)": { ...root, ...block(".aos-light") },
};

/** The colour each piece of text really uses, read from the component source (so a revert to a hard-coded dark green fails). */
function tokenOf(re: RegExp, v: Record<string, string>, fallback: string): string {
  const m = re.exec(src);
  assert.ok(m, `component line ${re} exists`);
  const cls = m![1];
  const t = /var\(--([a-z0-9-]+)\)/.exec(cls);
  if (t) return v[t[1]] ?? fallback;
  const h = /#[0-9a-fA-F]{6}/.exec(cls);
  return h ? h[0] : fallback;
}

test("join card text is >= 4.5:1 on the card background in every scope", () => {
  const fails: string[] = [];
  for (const [name, v] of Object.entries(scopes)) {
    const pairs: [string, string, string][] = [
      ["title (ink)", v["ink"], v["panel"]],
      ["grey line", tokenOf(/(text-\[var\(--ink-[23]\)\])">\{day\(s.startsAt\)\}/, v, ""), v["panel"]],
      ["booked/early explanation", tokenOf(/(text-\[[^\]]+\])" data-testid="os-early-text"/, v, ""), v["panel"]],
      ["unpaid explanation", tokenOf(/(text-\[[^\]]+\])" data-testid="os-unpaid-text"/, v, ""), v["panel"]],
      ["disabled Opens label", tokenOf(/(?:bg-\[var\(--line\)\] )(text-\[[^\]]+\])`\} data-testid="os-opens-later"/, v, ""), v["line"]],
      ["Join button", "#ffffff", tokenOf(/(bg-\[#[0-9a-fA-F]{6}\]) text-white`\} data-testid="os-join"/, v, "")],
    ];
    for (const [l, fg, bg] of pairs) {
      if (!fg || !bg) { fails.push(`${name}: ${l} colour unresolved`); continue; }
      const c = contrast(fg, bg);
      if (c < 4.5) fails.push(`${name}: ${l} ${fg} on ${bg} = ${c.toFixed(2)}`);
    }
  }
  assert.deepEqual(fails, []);
});

test("the compact variant (inside the white booking-done card) pins the light scope", () => {
  assert.match(src, /compact \? <div className="aos-light">/);
});
