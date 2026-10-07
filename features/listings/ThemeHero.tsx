"use client";
// Decorative hero artwork for the booking-page themes. Shown only when a listing has no photo
// (a listing with a photo keeps its photo). Pure CSS / inline SVG, no images; the artwork is
// authored on a fixed 1200 x 330 canvas (styles live in app/globals.css under `.aos-art`) and
// scaled to the width it is given, so it looks the same on a phone as on a desktop.
//
// Text in the art is the listing's own title / dates, never invented copy. The whole layer is
// aria-hidden: the real title is already in the page heading.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { themeFontHref, THEME_TOKENS, isNewTheme, type NewThemeKey } from "./pageThemes";

/** Greedy word-wrap into at most `n` lines of about `max` characters; the rest is cut with an ellipsis. */
export function artLines(text: string, n: number, max: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  let i = 0;
  for (; i < words.length; i++) {
    const w = words[i];
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max && cur) {
      out.push(cur); cur = w;
      if (out.length === n) break;
    } else cur = next;
  }
  if (out.length < n && cur) { out.push(cur); i = words.length; }
  let lines = out.slice(0, n).map((l) => (l.length > max + 4 ? l.slice(0, max + 3) + "…" : l));
  if (i < words.length && lines.length) lines = lines.map((l, k) => (k === lines.length - 1 && !l.endsWith("…") ? l + "…" : l));
  return lines;
}
const fit = (lines: string[], base: number, wide: number) => Math.max(34, Math.min(base, Math.floor(wide / Math.max(5, ...lines.map((l) => l.length)))));

/** Loads a theme's Google display font once, only while that theme is on screen. */
export function useThemeFont(key: string) {
  useEffect(() => {
    const href = themeFontHref(key);
    if (!href || typeof document === "undefined") return;
    if (document.head.querySelector(`link[data-aos-theme-font="${key}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = href; l.setAttribute("data-aos-theme-font", key);
    document.head.appendChild(l);
  }, [key]);
}

const initials = (s: string) => (s.match(/[A-Za-z0-9]/g) ?? ["A"]).slice(0, 1).join("").toUpperCase() + ((s.trim().split(/\s+/)[1]?.[0] ?? "").toUpperCase());

function Crest({ letters }: { letters: string }) {
  return (
    <svg className="crest" viewBox="0 0 200 240" aria-hidden>
      <path d="M100 8 L186 34 V110 C186 168 146 206 100 230 C54 206 14 168 14 110 V34 Z" fill="#14213D" stroke="#E5B94E" strokeWidth="5" />
      <path d="M100 22 L172 44 V110 C172 160 138 194 100 214 C62 194 28 160 28 110 V44 Z" fill="none" stroke="#E5B94E" strokeWidth="1.5" opacity=".7" />
      <text x="100" y="138" textAnchor="middle" fontFamily="Georgia,serif" fontStyle="italic" fontSize="70" fill="#E5B94E">{letters}</text>
      <path d="M30 74 H170" stroke="#E5B94E" strokeWidth="1.5" />
      <path d="M60 168 H140" stroke="#E5B94E" strokeWidth="1.5" />
    </svg>
  );
}

export function ThemeHero({ theme, title, run, brand }: { theme: NewThemeKey; title: string; run: string; brand: string }) {
  useThemeFont(theme);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const set = () => setScale(el.clientWidth / 1200);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const name = title.trim() || brand;
  const l2 = artLines(name, 2, 11), l3 = artLines(name, 3, 12), l1 = artLines(name, 1, 18);
  let art: React.ReactNode = null;
  switch (theme) {
    case "lagoon": art = <><div className="deco" /><div className="wave" /></>; break;
    case "arcade": art = <><div className="stars" /><div className="sun" /><div className="deco" /></>; break;
    case "aurora": art = <><div className="deco" /><div className="ridge" /></>; break;
    case "sherbet": art = <><div className="deco" /><div className="scoop" /></>; break;
    case "varsity": art = <><Crest letters={initials(brand)} /><div className="motto"><small>{run}</small>{l3.map((l, i) => <span key={i} style={{ display: "block", fontSize: fit(l3, 56, 460) }}>{l}</span>)}</div></>; break;
    case "plum": art = <><div className="big" style={{ fontSize: fit(l2, 120, 900) }}>{l2.map((l, i) => <span key={i} style={{ display: "block" }}>{l}</span>)}</div><div className="ring" /></>; break;
    case "halftone": art = <><div className="slab" /><div className="shout" style={{ fontSize: fit(l3, 76, 430) }}>{l3.map((l, i) => <span key={i}>{l}</span>)}</div></>; break;
    case "wildwood": art = <div className="trees" />; break;
    case "pirouette": art = <><div className="deco" /><span className="spark" style={{ left: 180, top: 60 }} /><span className="spark" style={{ left: 520, top: 200, width: 22, height: 22 }} /><span className="spark" style={{ left: 860, top: 50, width: 26, height: 26 }} /><div className="script" style={{ fontSize: fit(l3, 72, 520) }}>{l3.map((l, i) => <span key={i} style={{ display: "block" }}>{l}</span>)}</div></>; break;
    case "riso": art = <><div className="yel" /><div className="dotA" /><div className="dotB" /><div className="word" style={{ fontSize: fit(l2, 150, 900) }}>{l2.map((l, i) => <span key={i} style={{ display: "block", position: "static", color: "inherit" }}>{l}</span>)}<span aria-hidden>{l2.map((l, i) => <span key={i} style={{ display: "block", position: "static", color: "inherit" }}>{l}</span>)}</span></div><span className="stick" style={{ left: 880, top: 250 }}>{run}</span></>; break;
    case "brite": art = <><div className="hl"><span>{l1[0]}</span><br /><em>{run}</em></div><div className="burst" /></>; break;
    case "pitch": art = <><div className="lines" /><div className="lights" /><div className="kick" style={{ fontSize: fit(l2, 96, 700) }}>{l2.map((l, i) => <span key={i} style={{ display: "block", color: "#fff" }}>{l}</span>)}<span style={{ fontSize: 44, color: "#C7F464" }}>{run}</span></div></>; break;
    case "frost": art = <><div className="deco" /><div className="glass"><small>{run}</small><b>{l3.join(" ")}</b></div></>; break;
    case "mint": art = <><div className="drip" /><div className="cone" /></>; break;
    case "poster": art = <><div className="rows"><span>{l1[0]}</span><span className="f">{l1[0]}</span><span>{l1[0]}</span><span className="f">{run}</span></div><div className="dot" /></>; break;
  }
  if (!isNewTheme(theme)) return null;
  const t = THEME_TOKENS[theme].t;
  return (
    <div ref={box} aria-hidden className="relative w-full overflow-hidden" style={{ aspectRatio: "1200 / 330" }}>
      <div className={`aos-art th-${theme}`} style={{ transform: `scale(${scale})`, ["--t-grain" as string]: t.grain } as React.CSSProperties}>{art}</div>
    </div>
  );
}
