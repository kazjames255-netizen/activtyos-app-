"use client";

import { Component, type ReactNode } from "react";
import { FOCUS } from "../../teachKit";

// One in-call workspace tab (or the whole workspace) throwing while it renders must NEVER take the video call down with it.
// The Daily frame lives in the same React tree, so an uncaught render error unmounts the call for everyone. This boundary
// catches it, shows a calm card and lets the person reload just that tab.

export class TabBoundary extends Component<{ children: ReactNode; label: string }, { failed: number; attempt: number }> {
  state = { failed: 0, attempt: 0 };
  static getDerivedStateFromError() { return { failed: 1 }; }
  componentDidCatch(e: unknown) { console.error(`[workspace:${this.props.label}]`, e); }
  render() {
    if (!this.state.failed) return <div key={this.state.attempt} className="contents">{this.props.children}</div>;
    return (
      <div className="grid h-full min-h-[160px] place-items-center p-6 text-center" role="alert" data-testid="ws-tab-crashed" data-tab-crashed={this.props.label}>
        <div className="max-w-[320px]">
          <div className="text-[15px] font-extrabold text-[var(--ink)]">This tab hit a problem</div>
          <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-[var(--ink-2)]">Your call is fine. Reload the tab to carry on, or use one of the others.</p>
          <button type="button" onClick={() => this.setState((s) => ({ failed: 0, attempt: s.attempt + 1 }))} data-action="reload-tab"
            className={`mt-3 inline-flex min-h-[44px] items-center rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] px-4 text-[13px] font-extrabold text-[var(--ink)] ${FOCUS}`}>Reload tab</button>
        </div>
      </div>
    );
  }
}
