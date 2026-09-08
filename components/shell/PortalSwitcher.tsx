"use client";

import { useEffect, useState } from "react";
import { get as apiGet, getActAs } from "@/lib/api";
import type { Me } from "@/lib/roles";
import type { PortalKey } from "@/lib/nav/config";
import { AccountPicker } from "./AccountPicker";

// Super-admin tool: the Platform (HQ) owner can OPEN any real provider or parent
// account and see the app exactly as they do (impersonation). Replaces the old
// empty-portal-shell preview — now it drops you into a real account's data.
// Platform-only; hidden while already impersonating (the red bar drives Exit).
export function PortalSwitcher({ portal: _portal }: { portal: PortalKey }) {
  const [isPlatform, setIsPlatform] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    apiGet<Me>("/api/me")
      .then((me) => setIsPlatform(me.role === "platform"))
      .catch(() => setIsPlatform(false));
  }, []);

  // While impersonating you ARE that account (not platform) — the red bar owns Exit.
  if (!isPlatform || getActAs()) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Super-admin: open any provider or parent account and see what they see"
        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold text-[#2f5fd0] ring-1 ring-[var(--line)] transition-colors hover:text-[var(--brand)] hover:ring-[var(--brand)]"
      >
        🔎 Open account
      </button>
      {open && <AccountPicker onClose={() => setOpen(false)} />}
    </>
  );
}
