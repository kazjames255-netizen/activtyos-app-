import { Fragment, type ReactNode } from "react";

/** Render a catalogue string that marks bold runs with **double asterisks** (keeps emphasis in every language). */
export function rich(s: string): ReactNode {
  return s.split("**").map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>));
}
