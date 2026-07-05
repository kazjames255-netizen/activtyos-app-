"use client";

import { useEffect, useRef } from "react";
import { mountBookings } from "./mountBookings";
import { mountTimetable } from "./mountTimetable";

/**
 * LegacyPrototype — the "strangler fig" host for the original single-file
 * prototype.
 *
 * It fetches the untouched prototype.html from /public/legacy, injects its
 * <head> styles/fonts and its <body> markup into the live document, then
 * re-executes every inline <script> in document order so the ~180
 * interdependent legacy modules initialise exactly as they did standalone.
 *
 * As individual views are rewritten as real React routes, we progressively
 * carve them out of this legacy surface — the un-migrated remainder keeps
 * running here untouched.
 */

// Module-scoped guard. Set only AFTER a successful injection so that React
// StrictMode's mount → cleanup → remount cycle (which cancels the first run
// before it injects) still lets the second run complete exactly once.
let injected = false;

export default function LegacyPrototype() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function mountLegacy() {
      const host = hostRef.current;
      if (!host || injected) return;

      const res = await fetch("/legacy/prototype.html");
      const html = await res.text();
      if (cancelled || injected) return;

      const doc = new DOMParser().parseFromString(html, "text/html");

      // 1. Bring the prototype's <head> fonts + stylesheets into this document.
      //    (Style/link tags inside <body> ride along with innerHTML below and
      //    apply globally, so we only need to relocate the <head> ones.)
      doc
        .querySelectorAll(
          'head link[rel="stylesheet"], head link[rel="preconnect"], head style',
        )
        .forEach((node) => document.head.appendChild(document.importNode(node, true)));

      // 2. Inject the body markup. Inline <script> tags do NOT execute when set
      //    via innerHTML — they become inert nodes we activate in step 3.
      host.innerHTML = doc.body.innerHTML;

      // 3. Spoof document.readyState to "loading" while we run the scripts.
      //    Many legacy modules use the pattern
      //      if (readyState === "loading") addEventListener("DOMContentLoaded", init)
      //      else init()
      //    Because we inject after the real document has already finished
      //    loading, the else-branch would fire init() immediately — before a
      //    global that a later script defines exists (this is what threw
      //    "reading 'admin'"). Forcing "loading" makes them all defer to the
      //    DOMContentLoaded we dispatch in step 4, restoring the original
      //    parse-time ordering.
      let readyStateSpoofed = false;
      try {
        Object.defineProperty(document, "readyState", {
          configurable: true,
          get: () => "loading",
        });
        readyStateSpoofed = true;
      } catch {
        /* if the environment forbids shadowing, fall back to eager init */
      }

      // Re-execute scripts in document order. Replacing each inert node with a
      // freshly created <script> runs it synchronously, preserving the ordering
      // the legacy monkeypatch chain depends on.
      const scripts = Array.from(host.querySelectorAll("script"));
      for (const stale of scripts) {
        const fresh = document.createElement("script");
        for (const attr of Array.from(stale.attributes)) {
          fresh.setAttribute(attr.name, attr.value);
        }
        fresh.text = stale.textContent ?? "";
        stale.replaceWith(fresh);
      }

      // Restore the native readyState getter.
      if (readyStateSpoofed) {
        delete (document as unknown as Record<string, unknown>).readyState;
      }

      // 4. Now that every module has registered its handlers, fire the
      //    lifecycle events the legacy code waits on so initialisation runs in
      //    the original order.
      document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true }));
      window.dispatchEvent(new Event("load"));

      injected = true;

      // 5. Carve migrated views out of the legacy surface. The legacy pbRender
      //    runs on a setTimeout(0), so retry briefly until the admin bookings
      //    node exists, then hand it to React.
      let tries = 0;
      const pending = [mountBookings, mountTimetable];
      const takeover = () => {
        for (let i = pending.length - 1; i >= 0; i--) {
          if (pending[i]()) pending.splice(i, 1);
        }
        if (pending.length && tries++ < 40) setTimeout(takeover, 25);
      };
      takeover();
    }

    mountLegacy();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div ref={hostRef} id="legacy-root" />;
}
