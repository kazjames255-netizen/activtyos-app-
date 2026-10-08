"use client";

import { useEffect, useState } from "react";
import { SESSION_EXPIRED_EVENT } from "@/lib/api";
import { translateApiMessage } from "@/lib/i18n/apiErrors";
import { SESSION_EXPIRED_TEXT } from "@/lib/authExpiry";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";

/** Where "Sign in" takes the visitor: the login page, which sends them straight back to the page they were on. */
export function signInHref(): string {
  if (typeof window === "undefined") return "/login";
  return `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}

/** "Sign in" button that keeps the return path. */
export function SignInAgainButton({ className }: { className?: string }) {
  const t = useT();
  return <Button variant="primary" className={className} onClick={() => window.location.assign(signInHref())}>{t("p8lst.pvSignInBtn")}</Button>;
}

/** App-wide notice: any request that failed because the session expired (after one silent token refresh) lands here, whatever screen made it.
 *  A screen that shows its own Sign in button sets `data-aos-inline-signin` on <body> while mounted, so the two never stack. */
export function SessionExpiredNotice() {
  const [shown, setShown] = useState(false);
  const [inline, setInline] = useState(false);
  useEffect(() => {
    const read = () => setInline(document.body.hasAttribute("data-aos-inline-signin"));
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.body, { attributes: true, attributeFilter: ["data-aos-inline-signin"] });
    return () => mo.disconnect();
  }, []);
  useEffect(() => {
    const on = () => {
      if (/^\/(login|signup)(\/|$)/.test(window.location.pathname)) return;
      setShown(true);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, on);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, on);
  }, []);
  if (!shown || inline) return null;
  return (
    <div role="alert" className="fixed inset-x-0 bottom-0 z-[10050] flex flex-wrap items-center justify-center gap-3 border-t px-4 py-3 text-[13.5px] font-bold" style={{ background: "var(--surface)", color: "var(--ink)", borderColor: "var(--line)" }}>
      <span>{translateApiMessage(SESSION_EXPIRED_TEXT)}</span>
      <SignInAgainButton />
    </div>
  );
}
