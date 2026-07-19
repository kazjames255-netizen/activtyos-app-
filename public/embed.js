/**
 * ActivityOS "Book now" embed (build item 11).
 *
 * Plain HTML sites — ONE line where the button should appear:
 *
 *   <script src="https://YOUR-ACTIVITYOS/embed.js" data-listing="LISTING_ID" async></script>
 *
 * React / Next.js / anything that hoists or defers scripts — a MOUNT
 * ELEMENT where the button goes, plus the script anywhere (next/script,
 * layout, whatever):
 *
 *   <div data-activityos-book="LISTING_ID"></div>
 *   <script src="https://YOUR-ACTIVITYOS/embed.js" async></script>
 *
 * Both render a Book-now button that opens the real ActivityOS booking
 * page (the customer page the operator designed, paying through their own
 * Stripe) in an overlay. Options, on the script tag or the mount element:
 *
 *   data-listing / data-activityos-book    one LISTING (the 🔗 Link id)
 *   data-store   / data-activityos-store   the provider's WHOLE storefront
 *                                          (every live listing, bookable)
 *   data-mode     "button" (default) | "inline" — inline embeds the whole
 *                 booking page, auto-sized to its content
 *   data-label    button text (default "Book now")
 *   data-color    button background (default ActivityOS green)
 *
 * Mount elements are picked up whenever they appear (SPA navigations and
 * client-side renders included) and are never mounted twice. No
 * dependencies; one global (window.ActivityOSEmbed.scan). The ActivityOS
 * origin is derived from this script's own src, so the same snippet works
 * in dev and production.
 */
(function () {
  "use strict";

  var script = document.currentScript || document.querySelector('script[src*="embed.js"]');
  if (!script || !script.src) return;
  var origin = new URL(script.src).origin;

  function pageUrl(kind, id) {
    return origin + (kind === "store" ? "/store/" : "/book/") + encodeURIComponent(id) + "?embed=1";
  }

  function makeFrame(kind, id) {
    var frame = document.createElement("iframe");
    frame.src = pageUrl(kind, id);
    frame.title = "Book with ActivityOS";
    frame.allow = "payment *"; // Stripe wallets inside the frame
    frame.style.border = "0";
    frame.style.width = "100%";
    return frame;
  }

  // The booking page reports its height so inline embeds never scroll-in-scroll.
  function listenForHeight(frame) {
    window.addEventListener("message", function (e) {
      if (e.origin !== origin || !e.data || e.data.type !== "activityos:height") return;
      if (e.source === frame.contentWindow) frame.style.height = e.data.value + "px";
    });
  }

  function openOverlay(kind, id) {
    var overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483000;background:rgba(10,14,25,.62);" +
      "display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto;";
    var box = document.createElement("div");
    box.style.cssText = "position:relative;width:100%;max-width:1080px;";
    var close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Close booking");
    close.textContent = "×";
    close.style.cssText =
      "position:absolute;top:-4px;right:0;z-index:1;border:0;background:transparent;" +
      "color:#fff;font-size:30px;line-height:1;cursor:pointer;padding:4px 10px;";
    var frame = makeFrame(kind, id);
    frame.style.height = "min(92vh, 1400px)";
    frame.style.borderRadius = "18px";
    frame.style.background = "#f4f7ff";

    function dismiss() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape") dismiss();
    }
    close.addEventListener("click", dismiss);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) dismiss();
    });
    document.addEventListener("keydown", onKey);

    box.appendChild(close);
    box.appendChild(frame);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  /** Render the widget into `host` (appended; the mount div is the target). */
  function mount(host, opts) {
    if (opts.mode === "inline") {
      var frame = makeFrame(opts.kind, opts.id);
      frame.style.height = "900px"; // until the first height message lands
      listenForHeight(frame);
      host.appendChild(frame);
      return;
    }
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = opts.label;
    button.style.cssText =
      "display:inline-block;padding:12px 22px;border:0;border-radius:12px;cursor:pointer;" +
      "font:700 15px/1 system-ui,-apple-system,sans-serif;color:#fff;background:" + opts.color + ";";
    button.addEventListener("click", function () {
      openOverlay(opts.kind, opts.id);
    });
    host.appendChild(button);
  }

  function optsFrom(el, kind, id) {
    return {
      kind: kind,
      id: id,
      mode: el.getAttribute("data-mode") === "inline" ? "inline" : "button",
      label: el.getAttribute("data-label") || (kind === "store" ? "Book activities" : "Book now"),
      color: el.getAttribute("data-color") || "#15b364",
    };
  }

  // Mount elements: <div data-activityos-book="LISTING_ID">. Scanned now,
  // on DOM ready, and whenever new nodes appear (React renders after this
  // script runs; SPA navigations remove and re-add them).
  function scan() {
    var nodes = document.querySelectorAll(
      "[data-activityos-book]:not([data-activityos-mounted]), [data-activityos-store]:not([data-activityos-mounted])",
    );
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var store = el.getAttribute("data-activityos-store");
      var listing = el.getAttribute("data-activityos-book");
      if (!store && !listing) continue;
      el.setAttribute("data-activityos-mounted", "1");
      mount(el, store ? optsFrom(el, "store", store) : optsFrom(el, "book", listing));
    }
  }

  if (!window.ActivityOSEmbed) {
    window.ActivityOSEmbed = { scan: scan };
    var observer = new MutationObserver(scan);
    function watch() {
      scan();
      observer.observe(document.body, { childList: true, subtree: true });
    }
    if (document.body) watch();
    else document.addEventListener("DOMContentLoaded", watch);
  }

  // Plain-HTML path: the script tag itself carries data-listing and the
  // widget lands right where the tag was pasted. (Script loaders that hoist
  // the tag — next/script etc. — should use a mount element instead.)
  var inlineStore = script.getAttribute && script.getAttribute("data-store");
  var inlineListing = script.getAttribute && script.getAttribute("data-listing");
  if ((inlineListing || inlineStore) && script.parentNode && !script.hasAttribute("data-activityos-mounted")) {
    script.setAttribute("data-activityos-mounted", "1");
    var opts = inlineStore ? optsFrom(script, "store", inlineStore) : optsFrom(script, "book", inlineListing);
    var holder;
    if (opts.mode === "inline") {
      holder = document.createElement("div");
      holder.style.maxWidth = "1080px";
      holder.style.margin = "0 auto";
    } else {
      holder = document.createElement("span");
    }
    script.parentNode.insertBefore(holder, script.nextSibling);
    mount(holder, opts);
  }
})();
