# Journey embed check (Convoy Rush, Sinking Berg)

Method: read both published artifact HTMLs via the Artifact tool, then inspected the live viewer DOM in Chrome.

## How Journey is embedded
- Both games (Convoy Rush a0defa71, Sinking Berg 31dc90e7) use the same code. The Journey button calls `cfg.onJourney` -> `openJourney()`.
- `openJourney()` creates an `<iframe>` with `fr.srcdoc = JSRC` and appends it to the fixed `#jwrap` overlay. It adds no `sandbox` attribute, and uses no blob:, data: or document.write.
- `JSRC` is a full inline HTML document (about 219 KB) with inline script and CSS. It has no external scripts. It loads only the Google Fonts stylesheet (allowed) and inline SVG.
- The Back button removes the iframe and hides `#jwrap`.

## Assessment against the artifact CSP
- Viewer DOM: the artifact runs in a cross-origin frame on `*.frame.claudeusercontent.com` with sandbox `allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups`.
- An `about:srcdoc` iframe is not a network fetch, so `frame-src` and `child-src` do not apply to it. It inherits the parent CSP, and inline scripts are already allowed there. The parent's own inline script already runs, so the child's inline script should too.
- `allow-same-origin` is set, so the srcdoc child gets the parent origin and `localStorage` works. The Journey save is wrapped in try/catch anyway.
- No eval, `new Function`, Worker or external embed appears in the Journey source.
- Conclusion: by rules and DOM evidence the srcdoc embed should open. It is very likely not blocked. No redesign was made.

## Not verified
- I could not read the real CSP response headers. The javascript_tool blocked the header fetch ("Cookie/query string data").
- I could not click Journey mode. The game runs inside a cross-origin iframe, so read_page, find and javascript_tool cannot reach its DOM. I did not attempt coordinate clicks.
- A residual risk is that the real CSP or Chrome blocks srcdoc children in some way I could not observe. If Journey turns out not to open, the fallback is to inline Journey as a second namespaced mode in the same document with a back button. That fallback was not built.
- Other arcade games (River Rush and the rest) were not read.
- Nothing was republished or committed.
