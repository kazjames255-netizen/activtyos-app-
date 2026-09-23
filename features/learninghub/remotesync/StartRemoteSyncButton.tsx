"use client";

import { useState } from "react";
import { HUB_DEFAULTS, type HubSettings } from "@/lib/hubConfig";
import { Icon } from "../kit";
import { FOCUS } from "../teachKit";
import { RemoteSyncApp } from "./RemoteSyncApp";

// The entry point for "Start lesson now (remote)": a tutor broadcasts THIS lesson to students who are neither
// physically present nor on a video call — each opens it on their own device and it stays in step with the
// tutor's screen. Mirrors features/learninghub/inperson/TeachInPersonButton.tsx; the two sit side by side wherever
// a lesson can be taught (they're different modes — this one needs `noteId`, since it always drives one lesson).

export function StartRemoteSyncButton({ qs, config, noteId, title, readOnly, variant = "outline", className = "", testId = "start-remote-sync" }: {
  qs: string; config?: HubSettings; noteId: string; title: string; readOnly?: boolean;
  variant?: "solid" | "outline"; className?: string; testId?: string;
}) {
  const [open, setOpen] = useState(false);
  if (readOnly) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid={testId} title="Broadcast this lesson to students on their own devices — no video call, their screen follows yours"
        className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[13px] font-extrabold transition ${FOCUS} ${variant === "solid" ? "border border-[var(--brand)] bg-[var(--brand)] text-white hover:brightness-110" : "border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--brand)]"} ${className}`}>
        <Icon name="play" size={16} />Share with children
      </button>
      {open && <RemoteSyncApp qs={qs} config={config ?? HUB_DEFAULTS} noteId={noteId} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}
