"use client";

// Translation layer for the ~50 generated prototype widgets (legacy/*.gen.ts — "do not edit", they are regenerated from scratch/prototype).
// Their UI text lives inside html() strings and is rewritten by init() at runtime, so it cannot be keyed with t(). Instead the wrapper
// (LegacyWidget.tsx) translates the RENDERED DOM: a table per locale maps the English string to its translation
// (lib/i18n/messages/areas/hubtoolsb-legacy/<locale>.json; English is the fallback; source.json lists every English candidate, produced by
// scripts/i18n-hubtoolsb-extract.mjs). Keys are whole "chunks" (text between block-level tags, inline <b>/<i>/<span>… kept WITHOUT attributes),
// with `{0} {1}` standing for template-literal values (numbers, names) — those are captured from the live text and re-inserted.
// A MutationObserver re-translates whenever the widget rewrites its text. Exercise CONTENT (words to sort, drilled foreign words, sentences to
// punctuate) is deliberately absent from the tables, so it stays as authored.

import { useEffect, useState } from "react";
import type { LocaleCode } from "@/lib/i18n/config";

export type LegacyTable = Record<string, string>;

const LOADERS: Partial<Record<LocaleCode, () => Promise<{ default: LegacyTable }>>> = {
  pl: () => import("@/lib/i18n/messages/areas/hubtoolsb-legacy/pl.json"),
  ro: () => import("@/lib/i18n/messages/areas/hubtoolsb-legacy/ro.json"),
  ur: () => import("@/lib/i18n/messages/areas/hubtoolsb-legacy/ur.json"),
  pa: () => import("@/lib/i18n/messages/areas/hubtoolsb-legacy/pa.json"),
  bn: () => import("@/lib/i18n/messages/areas/hubtoolsb-legacy/bn.json"),
  ar: () => import("@/lib/i18n/messages/areas/hubtoolsb-legacy/ar.json"),
  pt: () => import("@/lib/i18n/messages/areas/hubtoolsb-legacy/pt.json"),
  es: () => import("@/lib/i18n/messages/areas/hubtoolsb-legacy/es.json"),
  fr: () => import("@/lib/i18n/messages/areas/hubtoolsb-legacy/fr.json"),
  cy: () => import("@/lib/i18n/messages/areas/hubtoolsb-legacy/cy.json"),
};
const cache = new Map<LocaleCode, LegacyTable>();
const pending = new Map<LocaleCode, Promise<LegacyTable>>();
export function loadLegacyTable(locale: LocaleCode): Promise<LegacyTable> {
  const hit = cache.get(locale);
  if (hit) return Promise.resolve(hit);
  const load = LOADERS[locale];
  if (!load) return Promise.resolve({});
  let p = pending.get(locale);
  if (!p) { p = load().then((m) => { cache.set(locale, m.default); return m.default; }).catch(() => ({})); pending.set(locale, p); }
  return p;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const INLINE = new Set(["B", "I", "EM", "STRONG", "U", "SUB", "SUP", "CODE", "SMALL", "SPAN", "KBD", "MARK", "A"]);
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT"]);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface Translator { run(): void; stop(): void }

/** Translate the rendered widget under `root` with `table`, and keep doing so as the widget rewrites its text. */
export function createTranslator(root: HTMLElement, table: LegacyTable): Translator {
  const exact = new Map<string, string>();
  const pats: { re: RegExp; tr: string }[] = [];
  for (const [k, v] of Object.entries(table)) {
    if (!v) continue;
    if (/\{\d+\}/.test(k)) pats.push({ re: new RegExp("^" + esc(k).replace(/\\\{\d+\\\}/g, "([\\s\\S]*?)") + "$"), tr: v });
    else exact.set(norm(k), v);
  }
  pats.sort((a, b) => b.re.source.length - a.re.source.length);
  const lookup = (key: string): string | null => {
    const k = norm(key);
    const e = exact.get(k);
    if (e !== undefined) return e;
    for (const p of pats) { const m = p.re.exec(k); if (m) return p.tr.replace(/\{(\d+)\}/g, (_, i) => m[Number(i) + 1] ?? ""); }
    return null;
  };
  const out = new WeakMap<Node, string>(); // what we last wrote, so we never re-translate our own output

  // "Some <b>bold</b> text" -> "Some <b>bold</b> text" (tags without attributes); null when the element holds anything but text + inline tags.
  const serialise = (el: Element): string | null => {
    let s = "";
    for (const c of Array.from(el.childNodes)) {
      if (c.nodeType === 3) s += c.nodeValue ?? "";
      else if (c.nodeType === 1) {
        const ce = c as Element;
        if (!INLINE.has(ce.tagName) || ce.namespaceURI !== "http://www.w3.org/1999/xhtml") return null;
        const inner = serialise(ce);
        if (inner === null) return null;
        const t = ce.tagName.toLowerCase();
        s += `<${t}>${inner}</${t}>`;
      }
    }
    return s;
  };
  // Put a translation containing inline tags back, re-using the ORIGINAL inline elements (ids, classes, listeners survive).
  const rebuild = (el: Element, tr: string) => {
    const tpl = document.createElement("template");
    tpl.innerHTML = tr;
    const pool = new Map<string, Element[]>();
    const collect = (n: Element) => { for (const c of Array.from(n.children)) { const k = c.tagName; (pool.get(k) ?? pool.set(k, []).get(k)!).push(c); collect(c); } };
    collect(el);
    const build = (from: Node, into: Node) => {
      for (const c of Array.from(from.childNodes)) {
        if (c.nodeType === 3) into.appendChild(document.createTextNode(c.nodeValue ?? ""));
        else if (c.nodeType === 1) {
          const orig = pool.get((c as Element).tagName)?.shift();
          const node = orig ?? document.createElement((c as Element).tagName.toLowerCase());
          while (node.firstChild) node.removeChild(node.firstChild);
          build(c, node); into.appendChild(node);
        }
      }
    };
    const frag = document.createDocumentFragment();
    build(tpl.content, frag);
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(frag);
  };

  const doEl = (el: Element) => {
    if (SKIP.has(el.tagName)) return;
    for (const a of ["aria-label", "title", "placeholder", "alt"]) {
      const v = el.getAttribute(a);
      if (v && out.get(el) !== `${a}:${v}`) { const t = lookup(v); if (t !== null) { el.setAttribute(a, t); out.set(el, `${a}:${t}`); } }
    }
    const ser = serialise(el);
    if (ser !== null) {
      if (!ser.trim() || out.get(el) === ser) return;
      const t = lookup(ser);
      if (t !== null) {
        if (!/[<]/.test(ser) && !/[<]/.test(t)) el.textContent = t; else rebuild(el, t);
        out.set(el, serialise(el) ?? t);
        return;
      }
    }
    for (const c of Array.from(el.childNodes)) {
      if (c.nodeType !== 3) continue;
      const raw = c.nodeValue ?? "";
      if (!raw.trim() || out.get(c) === raw) continue;
      const t = lookup(raw);
      if (t !== null) { const lead = /^\s*/.exec(raw)![0], trail = /\s*$/.exec(raw)![0]; c.nodeValue = lead + t + trail; out.set(c, c.nodeValue); }
    }
  };
  const mo = new MutationObserver(() => run());
  const opts: MutationObserverInit = { childList: true, characterData: true, subtree: true };
  let busy = false;
  function run() {
    if (busy) return;
    busy = true; mo.disconnect();
    try { doEl(root); root.querySelectorAll("*").forEach(doEl); } finally { busy = false; mo.observe(root, opts); }
  }
  return { run, stop: () => mo.disconnect() };
}

/** For UI outside the widget (picker titles, intros): translate one English string. Re-renders once the locale's table has loaded. */
export function useLegacyText(locale: LocaleCode): (s: string) => string {
  const [table, setTable] = useState<LegacyTable | null>(() => cache.get(locale) ?? null);
  useEffect(() => {
    let live = true;
    if (locale === "en") { setTable(null); return; }
    loadLegacyTable(locale).then((t) => { if (live) setTable(t); });
    return () => { live = false; };
  }, [locale]);
  return (s) => (table && locale !== "en" ? table[s] ?? s : s);
}
