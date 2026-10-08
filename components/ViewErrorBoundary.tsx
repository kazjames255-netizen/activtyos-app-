"use client";

import { Component, type ReactNode } from "react";
import { reportClientError } from "@/lib/reportClientError";
import { tNow } from "@/lib/i18n/provider";

// A view that throws while rendering used to leave a BLANK screen (seen on an iPhone, Quick book, 9 Oct 2026). This wraps a view so a
// crash explains itself: friendly message, Reload, and a one-tap "Send to support" that files the error text with the existing
// bug-report intake (POST /api/support/report). Nothing is sent without the tap, so it cannot spam the HQ inbox.
type Props = { name: string; children: ReactNode };
type State = { error: Error | null; sent: "idle" | "busy" | "done" | "fail" };

export class ViewErrorBoundary extends Component<Props, State> {
  state: State = { error: null, sent: "idle" };
  static getDerivedStateFromError(error: Error): State { return { error, sent: "idle" }; }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(`[${this.props.name} crashed]`, error, info.componentStack);
  }
  private send = () => {
    const e = this.state.error;
    if (!e || this.state.sent === "busy") return;
    this.setState({ sent: "busy" });
    reportClientError(this.props.name, e)
      .then(() => this.setState({ sent: "done" }))
      .catch(() => this.setState({ sent: "fail" }));
  };
  render() {
    const { error, sent } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="m-3 rounded-2xl border border-[#e3e9f5] bg-white p-6 text-center text-[#171534] shadow-sm">
        <div className="text-[34px]">⚠️</div>
        <div className="mt-1 text-[17px] font-extrabold">{tNow("p8pub.errTitle")}</div>
        <p className="mt-2 text-[13px] leading-relaxed text-[#4a4763]">{tNow("p8pub.errBody")}</p>
        <p className="mt-2 break-words text-[11.5px] text-[#8a86a3]">{error.message.slice(0, 200)}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => window.location.reload()} className="rounded-full bg-[#1d3a8f] px-5 py-2.5 text-[13px] font-bold text-white">{tNow("p8pub.tryAgain")}</button>
          <button type="button" onClick={this.send} disabled={sent === "busy" || sent === "done"} className="rounded-full border border-[#dbe0ec] bg-white px-5 py-2.5 text-[13px] font-bold text-[#4a4763] disabled:opacity-60">
            {sent === "done" ? tNow("p7shell.bugThanks") : tNow("p7shell.bugSend")}
          </button>
        </div>
      </div>
    );
  }
}
