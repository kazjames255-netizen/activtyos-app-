"use client";

import { useEffect } from "react";

// Runs INSIDE the /tour iframe. Listens for the parent walkthrough's messages:
// given a snippet of visible text, it finds the matching element, scrolls it
// into view, draws a dimming spotlight around its card, and reports the card's
// on-screen rectangle back so the parent can point its cursor at it. No changes
// to the real page components — anchoring is by the text they already render.
export function TourBridge() {
  useEffect(() => {
    let boxEl: HTMLDivElement | null = null;
    const box = () => {
      if (!boxEl) {
        boxEl = document.createElement("div");
        boxEl.setAttribute("aria-hidden", "true");
        // A soft ring around the thing being discussed — NO full-page dim and
        // no filled interior, so it never washes out the card's own text. The
        // moving cursor is the primary pointer; this just frames its target.
        boxEl.style.cssText =
          "position:fixed;z-index:2147483000;pointer-events:none;border:2px solid rgba(47,107,216,.75);border-radius:14px;" +
          "box-shadow:0 0 0 3px rgba(47,107,216,.14),0 10px 28px -14px rgba(20,48,110,.35);" +
          "transition:top .5s cubic-bezier(.4,0,.2,1),left .5s cubic-bezier(.4,0,.2,1),width .5s,height .5s,opacity .3s;opacity:0";
        document.body.appendChild(boxEl);
      }
      return boxEl;
    };

    // Find the smallest element whose visible text contains the needle, then
    // climb to its enclosing card/section so the spotlight frames a whole
    // panel rather than a lone word.
    const find = (needle: string): HTMLElement | null => {
      const n = needle.trim().toLowerCase();
      if (!n) return null;
      const nodes = document.body.querySelectorAll<HTMLElement>("h1,h2,h3,h4,p,span,div,button,a,td,th,li,label");
      let best: HTMLElement | null = null;
      let bestLen = Infinity;
      for (const el of nodes) {
        const t = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (t.length >= n.length && t.includes(n) && t.length < bestLen) {
          best = el;
          bestLen = t.length;
        }
      }
      if (!best) return null;
      const card = best.closest<HTMLElement>('[class*="rounded-2xl"],[class*="rounded-xl"],section,table') || best;
      return card;
    };

    // For "click" steps: prefer an actual clickable (button/link) matching the
    // text, else fall back to the nearest element, and click it.
    const clickable = (needle: string): HTMLElement | null => {
      const n = needle.trim().toLowerCase();
      let best: HTMLElement | null = null;
      let bestLen = Infinity;
      for (const el of document.querySelectorAll<HTMLElement>("button,a,[role='button']")) {
        const t = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (t.includes(n) && t.length < bestLen) { best = el; bestLen = t.length; }
      }
      return best ?? find(needle);
    };

    // Set a controlled input/textarea/select's value the way React expects, so
    // the framework registers the change and the field shows the typed value.
    const setValue = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      setter ? setter.call(el, value) : (el.value = value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };

    // Type a value in character by character so it reads as someone filling the
    // field, not a value teleporting in. A token cancels an in-flight type when
    // a newer fill starts.
    let typeToken = 0;
    const typeInto = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
      const mine = ++typeToken;
      setValue(el, "");
      for (let i = 1; i <= value.length; i++) {
        if (mine !== typeToken) return;
        setValue(el, value.slice(0, i));
        await new Promise((r) => setTimeout(r, 42));
      }
    };

    // Find the input/select/textarea a label points at (by htmlFor, containment,
    // the next field after a bare text label, or a matching placeholder).
    const fieldFor = (labelText: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null => {
      const n = labelText.trim().toLowerCase();
      const fields = [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input,textarea,select")];
      const afterLabel = (lbl: Element) => fields.find((el) => lbl.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) ?? null;
      for (const lbl of document.querySelectorAll<HTMLLabelElement>("label")) {
        if (!(lbl.textContent || "").replace(/\s+/g, " ").trim().toLowerCase().includes(n)) continue;
        if (lbl.htmlFor) { const el = document.getElementById(lbl.htmlFor); if (el) return el as HTMLInputElement; }
        const inner = lbl.querySelector<HTMLInputElement>("input,textarea,select"); if (inner) return inner;
        const nxt = afterLabel(lbl); if (nxt) return nxt;
      }
      // Bare (non-<label>) captions like "AGE FROM"
      for (const el of document.querySelectorAll("p,span,div")) {
        if (el.children.length === 0 && (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase() === n) {
          const nxt = afterLabel(el); if (nxt) return nxt;
        }
      }
      // A <select> whose options mention the label (e.g. "Select a venue…").
      const sel = fields.find((el) => el instanceof HTMLSelectElement && [...el.options].some((o) => o.text.toLowerCase().includes(n)));
      if (sel) return sel;
      return fields.find((el) => "placeholder" in el && (el.placeholder || "").toLowerCase().includes(n)) ?? null;
    };

    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; find?: string; id?: number; field?: string; value?: string; text?: string; noBox?: boolean } | null;
      if (!d || typeof d !== "object") return;
      if (d.type === "tour:click") {
        clickable(String(d.find ?? ""))?.click();
        return;
      }
      if (d.type === "tour:fill") {
        const el = fieldFor(String(d.field ?? ""));
        if (!el) return;
        el.scrollIntoView({ block: "center", behavior: "auto" });
        if (el instanceof HTMLSelectElement) {
          const want = String(d.value ?? "").toLowerCase();
          const opt = [...el.options].find((o) => o.text.toLowerCase().includes(want) || o.value.toLowerCase().includes(want));
          if (opt) setValue(el, opt.value);
        } else if (el instanceof HTMLInputElement && ["date", "time", "datetime-local", "month", "week", "color", "range"].includes(el.type)) {
          // A partial date/time is invalid and would be rejected mid-type — set
          // these in one go.
          setValue(el, String(d.value ?? ""));
        } else {
          void typeInto(el, String(d.value ?? ""));
        }
        return;
      }
      if (d.type === "tour:pick") {
        const t = String(d.text ?? "").trim().toLowerCase();
        // a chip/checkbox/label/button carrying the text
        const el = [...document.querySelectorAll<HTMLElement>("button,label,[role='button'],a,span,div")]
          .filter((x) => (x.textContent || "").replace(/\s+/g, " ").trim().toLowerCase().includes(t))
          .sort((a, b) => (a.textContent || "").length - (b.textContent || "").length)[0];
        el?.click();
        return;
      }
      if (d.type === "tour:find") {
        const el = find(String(d.find ?? ""));
        if (!el) {
          window.parent.postMessage({ type: "tour:rect", id: d.id, ok: false }, "*");
          return;
        }
        // Centre short targets; for a card taller than most of the viewport,
        // align its top (with a little breathing room) so its header isn't cut
        // off above the fold.
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const tall = el.getBoundingClientRect().height > vh * 0.78;
        el.style.scrollMarginTop = "22px";
        // Instant scroll (not smooth) so there's no long glide before the cursor
        // moves — the between-step lag was mostly this settling.
        el.scrollIntoView({ block: tall ? "start" : "center", behavior: "auto" });
        window.setTimeout(() => {
          const r = el.getBoundingClientRect();
          // noBox tours want the cursor only — scroll + report the rect, but
          // never draw the ring.
          if (d.noBox) { if (boxEl) boxEl.style.opacity = "0"; }
          else {
            const b = box();
            b.style.opacity = "1";
            b.style.top = `${r.top - 6}px`;
            b.style.left = `${r.left - 6}px`;
            b.style.width = `${r.width + 12}px`;
            b.style.height = `${r.height + 12}px`;
          }
          window.parent.postMessage(
            { type: "tour:rect", id: d.id, ok: true, rect: { top: r.top, left: r.left, width: r.width, height: r.height } },
            "*",
          );
        }, 180);
      } else if (d.type === "tour:clear") {
        if (boxEl) boxEl.style.opacity = "0";
      }
    };

    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "tour:ready" }, "*");
    return () => {
      window.removeEventListener("message", onMsg);
      boxEl?.remove();
    };
  }, []);

  return null;
}
