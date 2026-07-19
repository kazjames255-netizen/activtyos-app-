/**
 * ActivityOS "Book now" embed (build item 11).
 *
 * A provider pastes ONE line into their own website:
 *
 *   <script src="https://YOUR-ACTIVITYOS/embed.js" data-listing="LISTING_ID" async></script>
 *
 * and gets a Book-now button that opens the real ActivityOS booking page
 * (the customer page the operator designed, paying through their own
 * Stripe) in an overlay. Options via data attributes:
 *
 *   data-listing  (required)  the listing id — the 🔗 Link button's id
 *   data-mode     "button" (default) | "inline"
 *                 inline embeds the booking page directly in the page,
 *                 auto-sized to its content
 *   data-label    button text (default "Book now")
 *   data-color    button background (default ActivityOS green)
 *
 * No dependencies, no globals beyond one namespaced init guard. The
 * ActivityOS origin is derived from this script's own src, so the same
 * snippet works in dev and production.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var listing = script.getAttribute("data-listing");
  if (!listing) {
    console.warn("[activityos] embed.js needs data-listing=\"…\"");
    return;
  }
  var mode = script.getAttribute("data-mode") === "inline" ? "inline" : "button";
  var label = script.getAttribute("data-label") || "Book now";
  var color = script.getAttribute("data-color") || "#15b364";
  var origin = new URL(script.src).origin;
  var pageUrl = origin + "/book/" + encodeURIComponent(listing) + "?embed=1";

  function makeFrame() {
    var frame = document.createElement("iframe");
    frame.src = pageUrl;
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

  if (mode === "inline") {
    var holder = document.createElement("div");
    holder.style.maxWidth = "1080px";
    holder.style.margin = "0 auto";
    var frame = makeFrame();
    frame.style.height = "900px"; // until the first height message lands
    listenForHeight(frame);
    holder.appendChild(frame);
    script.parentNode.insertBefore(holder, script.nextSibling);
    return;
  }

  // Button mode: a styled button that opens a full-screen overlay.
  var button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.setAttribute("data-activityos-book", listing);
  button.style.cssText =
    "display:inline-block;padding:12px 22px;border:0;border-radius:12px;cursor:pointer;" +
    "font:700 15px/1 system-ui,-apple-system,sans-serif;color:#fff;background:" + color + ";";

  button.addEventListener("click", function () {
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
    var frame = makeFrame();
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
  });

  script.parentNode.insertBefore(button, script.nextSibling);
})();
