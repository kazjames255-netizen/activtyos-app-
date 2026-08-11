import type { LiveTourSteps } from "./LiveTour";

// ─────────────────────────────────────────────────────────────────────────
// The Gmail-connect walkthrough, authored as a LiveTour "slides" deck so it
// runs through the SAME shell as every other walkthrough — robot narrator,
// British voice, splash and controls. The real steps happen inside Gmail (an
// external site we can't embed), so each step is a hand-built recreation of
// the screen the provider will see, taken from their own screen recording.
//
// The stage renders these strings via innerHTML, so everything is inline-styled
// (no Tailwind), exactly like the robot narrator scenes.
// ─────────────────────────────────────────────────────────────────────────

const INK = "#12203c", INK2 = "#3a4a68", FAINT = "#9aa6bd", LINE = "#e6ebf5", BLUE = "#1a73e8";

// A faux browser window so a mock reads as "a screen", not part of ActivityOS.
function chrome(url: string, body: string): string {
  return `
  <div style="width:min(540px,100%);border:1px solid ${LINE};border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 14px 34px -14px rgba(20,48,110,.4)">
    <div style="display:flex;align-items:center;gap:8px;background:#f1f3f6;border-bottom:1px solid #e9edf4;padding:8px 12px">
      <span style="display:flex;gap:6px">
        <i style="width:10px;height:10px;border-radius:50%;background:#ff5f57;display:block"></i>
        <i style="width:10px;height:10px;border-radius:50%;background:#febc2e;display:block"></i>
        <i style="width:10px;height:10px;border-radius:50%;background:#28c840;display:block"></i>
      </span>
      <span style="flex:1;background:#fff;border-radius:7px;padding:5px 10px;font:600 11px/1 system-ui;color:${FAINT};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${url}</span>
    </div>
    <div style="padding:16px">${body}</div>
  </div>`;
}

// The little red Gmail "M".
const gmailMark = `<svg width="20" height="15" viewBox="0 0 24 18" style="flex:none"><rect x="0" y="0" width="24" height="18" rx="3" fill="#fff" stroke="#e6e8ec"/><path d="M2 3v12h3V7l7 5 7-5v8h3V3l-10 7z" fill="#ea4335"/></svg>`;

// The Gmail settings gear — the icon the provider needs to spot and click.
const gearIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3a4a68" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const helpIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6b7f" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 1.8-2 3" stroke-linecap="round"/><circle cx="12" cy="17" r=".6" fill="#5f6b7f" stroke="none"/></svg>`;

const pill = (t: string, bg: string, col = "#fff") =>
  `<span style="display:inline-block;border-radius:999px;padding:7px 16px;font:800 12px/1 system-ui;background:${bg};color:${col}">${t}</span>`;

function centre(inner: string): string {
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:system-ui;width:100%;max-width:600px">${inner}</div>`;
}

export function gmailTour(address: string, code = "184973"): LiveTourSteps {
  const addrChip = `<code style="border-radius:6px;background:#fff;padding:2px 6px;font:700 12px/1.4 ui-monospace,monospace;color:${INK2}">${address}</code>`;

  const flowBox = (label: string, mark: string, border: string, bg: string, col: string) => `
    <div style="width:150px;border:2px solid ${border};background:${bg};border-radius:14px;padding:14px;text-align:center">
      <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px">${mark}<span style="font:800 12px/1 system-ui;color:${col}">${label}</span></div>
      <div style="display:flex;flex-direction:column;gap:5px">
        <span style="height:7px;border-radius:99px;background:${border}"></span>
        <span style="height:7px;border-radius:99px;background:${border};opacity:.6"></span>
        <span style="height:7px;border-radius:99px;background:${border};opacity:.4"></span>
      </div>
    </div>`;

  const arrow = `
    <div style="display:flex;flex-direction:column;align-items:center;color:${BLUE}">
      <svg width="40" height="18" viewBox="0 0 40 18"><path d="M0 9h32M25 3l8 6-8 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span style="font:800 9px/1 system-ui;text-transform:uppercase;letter-spacing:.5px;margin-top:3px">a copy</span>
    </div>`;

  return {
    title: "Connect your Gmail",
    slides: true,
    introLine:
      "Let me show you how to connect your Gmail — it takes about two minutes, and you only do it once. Your Gmail keeps working exactly as it does now; you just also get parents' replies here in ActivityOS.",
    doneLine:
      "And that's it — from now on, parents' emails arrive in your normal Gmail and here in ActivityOS. Nothing about your Gmail changes, and you can reply from either place.",
    steps: [
      // 1 — copy your address
      {
        line: "First, copy your ActivityOS address. This private address is yours alone — nobody else can use it. You'll paste it into Gmail in a moment.",
        slide: centre(`
          <div style="font:800 11px/1 system-ui;text-transform:uppercase;letter-spacing:.6px;color:${FAINT}">Step 1 — your inbound address</div>
          <div style="display:flex;align-items:center;gap:10px;border:1px solid ${LINE};background:#f7f9fd;border-radius:14px;padding:12px 14px">
            <code style="font:700 14px/1 ui-monospace,monospace;color:${INK}">${address}</code>
            ${pill("Copy", "linear-gradient(180deg,#4f8bf5,#2f6bd8)")}
          </div>
          <div style="font:600 12px/1.5 system-ui;color:${FAINT};text-align:center">The real Copy button is on your setup panel, just behind this window.</div>`),
      },
      // 2 — open forwarding settings (show the gear they need to click)
      {
        line: "Over in Gmail, click the gear at the top, then See all settings, and open the Forwarding and P-O-P slash I-MAP tab.",
        slide: centre(chrome("mail.google.com", `
          <!-- Gmail top toolbar: search + help + the highlighted gear + apps grid -->
          <div style="display:flex;align-items:center;gap:12px">
            <div style="flex:1;display:flex;align-items:center;gap:9px;background:#eaf1fb;border-radius:999px;padding:9px 15px;min-width:0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5f6b7f" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" stroke-linecap="round"/></svg>
              <span style="font:600 12px/1 system-ui;color:${FAINT}">Search mail</span>
            </div>
            <span style="display:inline-flex">${helpIcon}</span>
            <span style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#e8f0fe;box-shadow:0 0 0 3px rgba(26,115,232,.4)">
              ${gearIcon}
              <span style="position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:8px;white-space:nowrap;background:${BLUE};color:#fff;font:800 10px/1 system-ui;padding:5px 9px;border-radius:7px">See all settings ▾</span>
            </span>
            <span style="display:grid;grid-template-columns:repeat(3,4px);gap:3px">${Array.from({ length: 9 }).map(() => `<i style="width:4px;height:4px;border-radius:50%;background:#8a97ab;display:block"></i>`).join("")}</span>
          </div>
          <!-- After the gear → the settings tabs, Forwarding highlighted -->
          <div style="display:flex;align-items:center;gap:7px;margin-top:34px;padding-bottom:6px">${gmailMark}<span style="font:700 12px/1 system-ui;color:${FAINT}">Settings</span></div>
          <div style="display:flex;flex-wrap:wrap;gap:12px;border-bottom:1px solid #eef1f5;padding-bottom:6px;font:600 11px/1 system-ui;color:${FAINT}">
            <span>General</span><span>Labels</span><span>Inbox</span><span>Accounts</span><span>Filters</span>
            <span style="color:${BLUE};font-weight:800;border-bottom:2px solid ${BLUE};padding-bottom:6px;margin-bottom:-7px">Forwarding and POP/IMAP</span>
          </div>`)),
      },
      // 3 — add a forwarding address
      {
        line: "Click Add a forwarding address, paste the address you copied, and press Next.",
        slide: centre(chrome("mail.google.com/…/settings/fwdandpop", `
          <div style="border:1px solid ${LINE};border-radius:12px;padding:16px;box-shadow:0 10px 26px -12px rgba(20,48,110,.3)">
            <div style="font:800 13px/1 system-ui;color:${INK}">Add a forwarding address</div>
            <div style="margin-top:8px;font:600 11px/1 system-ui;color:${FAINT}">Please enter a new forwarding email address:</div>
            <div style="margin-top:8px;border:1px solid ${BLUE};border-radius:6px;padding:8px 10px;font:700 12px/1 ui-monospace,monospace;color:${INK}">${address}</div>
            <div style="margin-top:16px;display:flex;justify-content:flex-end;align-items:center;gap:12px">
              <span style="font:700 12px/1 system-ui;color:${FAINT}">Cancel</span>${pill("Next", BLUE)}
            </div>
          </div>`)),
      },
      // 4 — Gmail sends its confirmation
      {
        line: "Gmail pops up to say it's sent a confirmation. Press OK — this is just Gmail checking the address is really yours before it forwards anything.",
        slide: centre(chrome("mail.google.com/…/settings/fwdandpop", `
          <div style="border:1px solid ${LINE};border-radius:12px;padding:16px;box-shadow:0 10px 26px -12px rgba(20,48,110,.3)">
            <div style="font:800 13px/1 system-ui;color:${INK}">Add a forwarding address</div>
            <div style="margin-top:10px;font:600 12px/1.6 system-ui;color:${INK2}">A confirmation link has been sent to ${addrChip} to verify permission.</div>
            <div style="margin-top:16px;display:flex;justify-content:flex-end">${pill("OK", BLUE)}</div>
          </div>`)),
      },
      // 5 — the code shows up here automatically (the verify step — may or may not)
      {
        line:
          "Here's the clever bit. Because that address is yours, Gmail's confirmation code appears right here on your setup panel, all by itself, within a minute. Usually that's all it takes. If Gmail also asks you to type the code in, just pop it into the box in Gmail and press Verify.",
        slide: centre(`
          <div style="width:100%;border:1px solid #f3d98a;background:#fdf6e3;border-radius:14px;padding:18px 20px">
            <div style="font:800 12px/1 system-ui;color:#7a5a12">Gmail sent us your confirmation code</div>
            <div style="margin-top:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              <code style="border-radius:9px;background:#fff;padding:8px 12px;font:800 17px/1 ui-monospace,monospace;letter-spacing:.15em;color:#7a5a12">${code}</code>
              <span style="font:600 12px/1.4 system-ui;color:#7a5a12">appears on your setup panel automatically.</span>
            </div>
          </div>
          <div style="font:600 12px/1.5 system-ui;color:${FAINT};text-align:center">Most of the time there's nothing to do here — it just turns green.</div>`),
      },
      // 6 — keep a copy & save
      {
        line:
          "Last of all, back in Gmail, choose to forward a copy of incoming mail and keep Gmail's copy in the inbox, then press Save Changes — and that's what makes every email land in both places.",
        slide: centre(chrome("mail.google.com/…/settings/fwdandpop", `
          <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">
            <span style="margin-top:2px;width:14px;height:14px;flex:none;border-radius:50%;border:4px solid ${BLUE}"></span>
            <span style="font:600 12px/1.5 system-ui;color:${INK}">Forward a copy of incoming mail to <b>${address}</b> and <b>keep Gmail's copy in the Inbox</b></span>
          </div>
          <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:14px;opacity:.5">
            <span style="margin-top:2px;width:14px;height:14px;flex:none;border-radius:50%;border:2px solid ${LINE}"></span>
            <span style="font:600 12px/1.5 system-ui;color:${INK2}">Disable forwarding</span>
          </div>
          ${pill("Save Changes", BLUE)}`)),
      },
      // 7 — done (also carried by doneLine; this slide is the visual payoff)
      {
        line: "You're connected. Every email now arrives in both your Gmail and here in ActivityOS.",
        slide: centre(`
          <div style="display:flex;align-items:center;gap:16px">
            ${flowBox("Your Gmail", gmailMark, "#cdeacd", "#f3fbf3", "#127a3e")}
            ${arrow}
            ${flowBox("ActivityOS", "📧", "#cdeacd", "#f3fbf3", "#16306e")}
          </div>
          <div style="font:800 13px/1 system-ui;color:#127a3e">✓ The same email lands in both places</div>`),
      },
    ],
  };
}
