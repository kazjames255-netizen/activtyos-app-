"use client";
import { Fragment, type ReactNode } from "react";
import { useT } from "@/lib/i18n/provider";

/** Render a catalogue string that contains inline markup slots: `t("x")` = "Sent to {email}" + slots={{ email: <b>..</b> }}. */
export function Rich({ k, vars, slots }: { k: string; vars?: Record<string, string | number>; slots: Record<string, ReactNode> }) {
  const t = useT();
  const v: Record<string, string | number> = { ...(vars ?? {}) };
  for (const n of Object.keys(slots)) v[n] = `\u0001${n}\u0001`;
  const parts = t(k, v).split(/\u0001(\w+)\u0001/);
  return <>{parts.map((p, i) => (i % 2 ? <Fragment key={i}>{slots[p]}</Fragment> : <Tags key={i} s={p} />))}</>;
}

/** Inline `<b>..</b>`, `<i>..</i>`, `<code>..</code>` in catalogue text. */
export function Tags({ s }: { s: string }) {
  const bits = s.split(/(<b>[\s\S]*?<\/b>|<i>[\s\S]*?<\/i>|<code>[\s\S]*?<\/code>)/);
  return (
    <>
      {bits.map((b, i) => {
        const m = /^<(b|i|code)>([\s\S]*)<\/\1>$/.exec(b);
        if (!m) return <Fragment key={i}>{b}</Fragment>;
        return m[1] === "b" ? <b key={i}>{m[2]}</b> : m[1] === "i" ? <i key={i}>{m[2]}</i> : <code key={i}>{m[2]}</code>;
      })}
    </>
  );
}

/** Translate by key when the catalogue has it, else keep the authored text (data-ish labels from shared libs). */
export function tr(t: (key: string, vars?: Record<string, string | number>) => string, key: string, fallback: string): string {
  const r = t(key);
  return r === key ? fallback : r;
}

/** Slug used for derived keys: "Bookings & money" -> "bookings_money". */
export const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
