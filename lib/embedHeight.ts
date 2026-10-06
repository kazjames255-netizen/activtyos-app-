// Height reporting for pages shown inside a provider's own website via /embed.js (?embed=1).
// document.documentElement.scrollHeight can never be smaller than the iframe's own height, so an inline embed could grow but never
// shrink (a short storefront sat in 900px of blank space). Measure the CONTENT instead: the lowest edge of the page's own elements.
export function embedContentHeight(): number {
  const kids = Array.from(document.body.children).filter((c) => !/^(SCRIPT|STYLE|NEXTJS-PORTAL|LINK|NOSCRIPT)$/.test(c.tagName));
  const bottom = kids.reduce((m, c) => Math.max(m, c.getBoundingClientRect().bottom), 0);
  return Math.ceil(bottom + window.scrollY);
}

/** Starts reporting the content height to the embedding page (both the legacy and the neutral message type). Returns a stop function. */
export function startEmbedHeightReports(): () => void {
  const post = () => {
    const value = embedContentHeight();
    window.parent?.postMessage({ type: "activityos:height", value }, "*");
    window.parent?.postMessage({ type: "booking-embed:height", value }, "*");
  };
  const ro = new ResizeObserver(post);
  ro.observe(document.body);
  post();
  return () => ro.disconnect();
}
