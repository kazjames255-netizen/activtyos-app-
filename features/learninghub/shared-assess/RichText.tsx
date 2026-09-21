"use client";
// Renders Oak-style text: prose (with **bold** and line breaks) + LaTeX in $$…$$ via KaTeX. £ not $. Use this for EVERY learner-facing string
// that can come from an import (question stems, options, feedback, hints, keywords, learning points, transcript).
import { Fragment, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { fixCurrency, splitRich } from "@/lib/richTextCore";

const boldify = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
const lines = (s: string) => s.split("\n").map((l, i, a) => <Fragment key={i}>{boldify(l)}{i < a.length - 1 ? <br /> : null}</Fragment>);

export function RichText({ text, className }: { text: string; className?: string }) {
  const nodes = useMemo(() => splitRich(text).map((seg, i) => {
    if (!seg.math) return <Fragment key={i}>{lines(fixCurrency(seg.s, text))}</Fragment>;
    let html = "";
    try { html = katex.renderToString(seg.s, { throwOnError: false, strict: "ignore", trust: false, output: "htmlAndMathml" }); } catch { html = ""; }
    return html ? <span key={i} dangerouslySetInnerHTML={{ __html: html }} /> : <Fragment key={i}>{seg.s}</Fragment>;
  }), [text]);
  return <span className={className}>{nodes}</span>;
}
