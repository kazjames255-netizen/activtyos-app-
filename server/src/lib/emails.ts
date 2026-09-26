import sharp from "sharp";
import { randomBytes } from "node:crypto";
import type { Booking } from "../../../features/bookings/types";
import { db } from "../firebase";
import { autoEmailOn, type AutoEmailPrefs } from "./autoEmails";
import { sendMail, type MailAttachment } from "./mailer";
import { tenantSender, inboundDomain, inboundConfigured } from "./sender";
import { webUrl } from "./stripe";
import { AOS_MARK_PNG_B64 } from "./brandLogo";
import { geocodeAddress } from "../routes/geo";

/** A random, always-lowercase local part for a lead's reply address —
 * deliberately NOT the Firestore doc id: that's mixed-case, and real mail
 * transit routinely lowercases addresses somewhere along the way (many
 * clients/providers do, regardless of what we send), which would silently
 * break matching for any id containing an uppercase letter. Assigned once
 * per lead and reused on every subsequent email to the same lead. */
async function ensureLeadReplyToken(leadId: string): Promise<string> {
  const ref = db.collection("leads").doc(leadId);
  const existing = (await ref.get()).data() as { replyToken?: string } | undefined;
  if (existing?.replyToken) return existing.replyToken;
  const token = randomBytes(6).toString("hex"); // hex: always [a-f0-9], nothing to lowercase
  await ref.set({ replyToken: token }, { merge: true });
  return token;
}

/** A reply-able address for a lead-facing email — hitting "reply" lands back
 * on our inbound webhook (routes/emails.ts), which now recognises
 * "lead-<token>@…" and files it onto that lead instead of a tenant, so a
 * prospect's reply doesn't just vanish into an unmonitored mailbox. Falls
 * back to undefined (plain no-reply) when inbound mail isn't configured in
 * this environment. */
const leadReplySender = async (leadId: string): Promise<{ replyTo: string } | undefined> =>
  inboundConfigured ? { replyTo: `lead-${await ensureLeadReplyToken(leadId)}@${inboundDomain}` } : undefined;

/** A real, working video-call room for a lead's booked slot — Jitsi Meet
 * (meet.jit.si): free, no account needed to join or host, works instantly.
 * No Google/Zoom account to connect (that would need real OAuth, set up by
 * hand in that provider's own console — not something done from here), and
 * a static personal link would mean every booking shares the same room.
 * One random slug per lead, assigned once and reused for every email about
 * that lead's call (rescheduling keeps the same room) — unguessable, so
 * only people who were actually sent the link can join. */
export async function ensureLeadVideoUrl(leadId: string): Promise<string> {
  const ref = db.collection("leads").doc(leadId);
  const existing = (await ref.get()).data() as { videoRoom?: string } | undefined;
  const room = existing?.videoRoom || `Activly-${randomBytes(8).toString("hex")}`;
  if (!existing?.videoRoom) await ref.set({ videoRoom: room }, { merge: true });
  return `https://meet.jit.si/${room}`;
}

/** The ActivityOS mark as an inline (CID) attachment. Embedded rather than
 *  hot-linked so it renders in every client and regardless of environment —
 *  Gmail/Outlook strip SVG and data-URIs and can't reach a localhost URL. Any
 *  email that shows the mark must include this in its attachments. */
export function aosLogoAttachment(): MailAttachment {
  return { filename: "activityos.png", content: Buffer.from(AOS_MARK_PNG_B64, "base64"), contentType: "image/png", cid: "aos-mark" };
}

// Booking email templates. Plain, inline-styled HTML — per-provider sending
// domains come with the white-label milestone; until then every send carries
// the provider's name on the From line and their address on Reply-To
// (lib/sender.ts).

const gbp = (n: number) => `£${(Math.round(n * 100) / 100).toFixed(2)}`;

/** Send unless the provider has switched this category of automatic email off
 *  (Setup → Email → Automatic emails). Same fire-and-forget contract as
 *  sendMail: a suppressed or failed email never fails the booking. */
function sendGated(
  tenantId: string | undefined,
  key: keyof Pick<AutoEmailPrefs, "bookings" | "payments" | "waitlist">,
  to: string,
  subject: string,
  html: string,
  /** The name already rendered in the template — reused as the From name so
   *  the envelope and the letterhead can't disagree. */
  providerName?: string,
  /** Inline images / files the template references (e.g. cid:provider-logo,
   *  cid:aos-mark). */
  attachments?: MailAttachment[],
): void {
  void autoEmailOn(tenantId, key)
    .then(async (on) => {
      if (!on) { console.log(`[mail] "${subject}" → ${to} skipped (autoEmails.${key} off)`); return; }
      return sendMail(to, subject, html, await tenantSender(tenantId, providerName), attachments?.length ? { attachments } : undefined);
    })
    .catch((e) => console.error(`[mail] gate check failed for "${subject}":`, (e as Error).message));
}

/** Inline attachments a customer booking email needs: ActivityOS mark for the
 *  "powered by" footer, plus the provider's own logo when they have one. */
function brandAttachments(brand: { logo?: MailAttachment }): MailAttachment[] {
  return [aosLogoAttachment(), ...(brand.logo ? [brand.logo] : [])];
}

/** Ungated provider-branded send (account access, invites, message alerts —
 *  things an automatic-email toggle must never silence).
 *
 *  `replyTo: false` keeps the From name but leaves the Reply-To header unset:
 *  §JJ's reply-by-email ingest claims that header for thread routing
 *  (`reply+<threadId>@inbound.…`), so mail that will one day be repliable must
 *  not squat on it now. */
function sendAs(
  tenantId: string | undefined,
  providerName: string,
  to: string,
  subject: string,
  html: string,
  opts: { replyTo?: boolean; attachments?: MailAttachment[] } = {},
): void {
  void tenantSender(tenantId, providerName)
    .then((s) => sendMail(to, subject, html, opts.replyTo === false ? { name: s.name } : s, opts.attachments?.length ? { attachments: opts.attachments } : undefined))
    .catch((e) => console.error(`[mail] sender lookup failed for "${subject}":`, (e as Error).message));
}

/** Customer-facing branding: the PROVIDER's own logo (if they've uploaded one)
 *  as an inline cid attachment, else just their name. Customer emails carry the
 *  provider's identity — ActivityOS only appears as "powered by" in the footer. */
async function customerBrand(
  tenantId: string | undefined,
  providerName: string,
): Promise<{ name: string; logo?: MailAttachment }> {
  if (!tenantId) return { name: providerName };
  try {
    const lib = await db.collection("libraries").doc(tenantId).get();
    const logoUrl = ((lib.data()?.settings as { billing?: { logoUrl?: string } } | undefined)?.billing?.logoUrl) || undefined;
    const imgId = logoUrl?.match(/\/api\/images\/([^/?#]+)/)?.[1];
    if (imgId) {
      const img = (await db.collection("images").doc(imgId).get()).data() as { contentType?: string; b64?: string } | undefined;
      if (img?.b64) return { name: providerName, logo: { filename: "logo", content: Buffer.from(img.b64, "base64"), contentType: img.contentType || "image/png", cid: "provider-logo" } };
    }
  } catch { /* fall back to the name */ }
  return { name: providerName };
}

// —— Static venue map (booking-confirmation attachment) ————————————————————
const project = (lon: number, lat: number, z: number) => {
  const n = 2 ** z;
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n,
  };
};
/** A small static map of the venue with a pin, stitched from OSM tiles. Returns
 *  a PNG buffer, or null on any failure (the email still sends without it). */
async function venueMapPng(lat: number, lng: number): Promise<Buffer | null> {
  try {
    const z = 15, COLS = 3, ROWS = 2, T = 256;
    const p = project(lng, lat, z);
    const originX = Math.floor(p.x - COLS / 2);
    const originY = Math.floor(p.y - ROWS / 2);
    const layers: { input: Buffer; left: number; top: number }[] = [];
    for (let dx = 0; dx < COLS; dx++)
      for (let dy = 0; dy < ROWS; dy++) {
        const r = await fetch(`https://tile.openstreetmap.org/${z}/${originX + dx}/${originY + dy}.png`, {
          headers: { "User-Agent": "ActivityOS/1.0 (booking confirmation maps)" },
          signal: AbortSignal.timeout(5000),
        });
        if (!r.ok) return null;
        layers.push({ input: Buffer.from(await r.arrayBuffer()), left: dx * T, top: dy * T });
      }
    const W = COLS * T, H = ROWS * T;
    const px = Math.round((p.x - originX) * T);
    const py = Math.round((p.y - originY) * T);
    // Stitch the tiles into the base map. (The pin is added AFTER the crop —
    // compositing a full-canvas SVG here fails, because sharp renders SVGs at a
    // higher density so the overlay comes out larger than the base and it
    // throws "must have same dimensions or smaller", killing the whole map.)
    const base = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 233, g: 235, b: 240, alpha: 1 } } })
      .composite(layers)
      .png()
      .toBuffer();
    // Crop to a landscape window centred on the pin (the 3×2 grid otherwise
    // leaves the venue low), clamped to the stitched bounds.
    const CW = Math.min(W, 600), CH = Math.min(H, 300);
    const left = Math.round(Math.max(0, Math.min(W - CW, px - CW / 2)));
    const top = Math.round(Math.max(0, Math.min(H - CH, py - CH / 2)));
    // A small pin, pre-rendered to an exact PW×PH PNG so its size never depends
    // on sharp's SVG density, then dropped at the venue's spot in the crop.
    const PW = 30, PH = 30;
    const pin = await sharp(
      Buffer.from(`<svg width="${PW}" height="${PH}" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="10" fill="#EE1F63" stroke="#fff" stroke-width="3"/><circle cx="15" cy="15" r="3.5" fill="#fff"/></svg>`),
      { density: 72 },
    ).resize(PW, PH).png().toBuffer();
    const pinLeft = Math.round(Math.max(0, Math.min(CW - PW, (px - left) - PW / 2)));
    const pinTop = Math.round(Math.max(0, Math.min(CH - PH, (py - top) - PH / 2)));
    return await sharp(base)
      .extract({ left, top, width: CW, height: CH })
      .composite([{ input: pin, left: pinLeft, top: pinTop }])
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

/** Everything a customer booking email shows about the listing itself: the hero
 *  photo, venue location, and (for confirmations) what's included / to bring and
 *  a map — all as inline cid attachments where they're images. Every piece is
 *  optional; anything missing is simply omitted. */
async function listingContext(
  b: Booking,
  want: { whatIncluded?: boolean; map?: boolean },
): Promise<{ heroCid?: string; location?: string; homeVisit?: boolean; provided?: string[]; toBring?: string[]; mapCid?: string; attachments: MailAttachment[] }> {
  const attachments: MailAttachment[] = [];
  // Home-visit booking: "location" is the family's own service address, not a
  // venue — no venue lookup, no map of their own house.
  if (b.serviceAddress?.address || b.serviceAddress?.postcode) {
    const location = [b.serviceAddress.address, b.serviceAddress.postcode].filter(Boolean).join(", ") || undefined;
    return { location, homeVisit: true, attachments };
  }
  try {
    let listing: Record<string, unknown> | undefined;
    if (b.blockId) {
      const blk = await db.collection("blocks").doc(b.blockId).get();
      const lid = blk.exists ? (blk.get("listingId") as string | undefined) : undefined;
      if (lid) { const l = await db.collection("listings").doc(lid).get(); if (l.exists) listing = l.data() as Record<string, unknown>; }
    }
    if (!listing && b.tenantId) {
      const q = await db.collection("listings").where("tenantId", "==", b.tenantId).where("name", "==", b.listing).limit(1).get();
      if (!q.empty) listing = q.docs[0].data() as Record<string, unknown>;
    }
    if (!listing) return { attachments };

    let heroCid: string | undefined;
    const src = (listing.images as { src?: string }[] | undefined)?.[0]?.src;
    const imgId = src?.match(/\/api\/images\/([^/?#]+)/)?.[1];
    if (imgId) {
      const img = (await db.collection("images").doc(imgId).get()).data() as { contentType?: string; b64?: string } | undefined;
      if (img?.b64) { attachments.push({ filename: "listing", content: Buffer.from(img.b64, "base64"), contentType: img.contentType || "image/jpeg", cid: "listing-hero" }); heroCid = "cid:listing-hero"; }
    }

    let location: string | undefined; let lat: number | undefined; let lng: number | undefined;
    let venueAddress: string | undefined;
    const venueId = listing.venueId as string | undefined;
    if (venueId && b.tenantId) {
      const lib = (await db.collection("libraries").doc(b.tenantId).get()).data() ?? {};
      const v = ((lib.venues ?? []) as { id: string; name?: string; address?: string; lat?: number; lng?: number }[]).find((x) => x.id === venueId);
      if (v) { location = [v.name, v.address].filter(Boolean).join(", ") || undefined; lat = v.lat; lng = v.lng; venueAddress = v.address; }
    }

    let mapCid: string | undefined;
    if (want.map) {
      // Prefer the venue's saved coordinates, but a venue added before
      // geocode-on-save (or whose geocode failed) has none — so geocode the
      // address here so the map still shows. Best-effort; the email sends
      // without it on any miss.
      if ((typeof lat !== "number" || typeof lng !== "number") && venueAddress) {
        const hit = await geocodeAddress(venueAddress);
        if (hit) { lat = hit.lat; lng = hit.lng; }
      }
      if (typeof lat === "number" && typeof lng === "number") {
        const png = await venueMapPng(lat, lng);
        if (png) { attachments.push({ filename: "map.png", content: png, contentType: "image/png", cid: "booking-map" }); mapCid = "cid:booking-map"; }
      }
    }

    const provided = want.whatIncluded ? ((listing.provided as string[] | undefined) ?? []).filter(Boolean) : undefined;
    const toBring = want.whatIncluded ? ((listing.toBring as string[] | undefined) ?? []).filter(Boolean) : undefined;
    return { heroCid, location, provided, toBring, mapCid, attachments };
  } catch {
    return { attachments };
  }
}

/** Every session date, 3-across (date over time) at small text. Session strings
 *  look like "Mon 20 Jul 2026 · 08:00 – 17:30". */
function datesGridHtml(sessions: string[]): string {
  if (!sessions.length) return "<span style='color:#a7a3bd'>Dates to be confirmed</span>";
  const cell = (s: string) => {
    const [day, time] = s.split(" · ");
    return `<td width="33%" style="padding:3px 10px 6px 0;vertical-align:top">
      <div style="font-size:12px;font-weight:700;color:#171534;white-space:nowrap">${escapeHtml(day ?? s)}</div>
      ${time ? `<div style="font-size:11px;color:#8a86a3;white-space:nowrap">${escapeHtml(time)}</div>` : ""}
    </td>`;
  };
  const rows: string[] = [];
  for (let i = 0; i < sessions.length; i += 3) {
    const cells = sessions.slice(i, i + 3).map(cell);
    while (cells.length < 3) cells.push(`<td width="33%"></td>`);
    rows.push(`<tr>${cells.join("")}</tr>`);
  }
  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">${rows.join("")}</table>`;
}

/** The customer booking-email shell: the PROVIDER's logo/name up top, all the
 *  session dates, a button straight to the booking, and "powered by ActivityOS"
 *  at the bottom. `hasLogo` gates the inline provider logo (cid:provider-logo).
 *  `title`/`bodyHtml` are HTML, inserted raw. */
function layout(
  brand: { name: string; hasLogo: boolean },
  title: string,
  bodyHtml: string,
  b: Booking,
  ctx: { heroCid?: string; location?: string; homeVisit?: boolean; provided?: string[]; toBring?: string[]; mapCid?: string } = {},
): string {
  const kids = b.kids?.length ? b.kids.map((k) => k.name).join(", ") : b.child;
  const bookingUrl = `${webUrl}/custdash/bookings?open=${encodeURIComponent(b.ref)}`;
  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:7px 16px 7px 0;font-size:12.5px;color:#8a86a3;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>
      <td style="padding:7px 0;font-size:13.5px;color:#171534;border-bottom:1px solid #eef0f5">${value}</td>
    </tr>`;
  const header = brand.hasLogo
    ? `<img src="cid:provider-logo" alt="${escapeHtml(brand.name)}" style="max-height:48px;max-width:220px;display:inline-block" />`
    : `<span style="font-size:22px;font-weight:800;color:#1d3a8f">${escapeHtml(brand.name)}</span>`;
  const label = (t: string) => `<div style="font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#8a86a3;margin:20px 0 8px">${t}</div>`;
  const chips = (items: string[]) =>
    items.map((x) => `<span style="display:inline-block;background:#eef3ff;color:#1d3a8f;font-size:12.5px;font-weight:700;padding:5px 12px;border-radius:999px;margin:0 6px 6px 0">${escapeHtml(x)}</span>`).join("");
  return `
  <div style="margin:0;padding:0;background:#eef1f7">
  <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#eef1f7;padding:24px 12px">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 34px -18px rgba(20,30,70,.4)">
      <div style="padding:24px 28px 20px;text-align:center;border-bottom:1px solid #eef0f5">${header}</div>
      ${ctx.heroCid ? `<img src="${ctx.heroCid}" alt="${escapeHtml(b.listing)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;object-fit:cover;max-height:220px" />` : ""}
      <div style="padding:24px 28px 28px">
        <h1 style="font-size:22px;line-height:1.25;margin:0 0 14px;color:#171534">${title}</h1>
        ${bodyHtml}
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-top:16px">
          ${row("Activity", escapeHtml(b.listing))}
          ${row("Pass", escapeHtml(b.pass))}
          ${ctx.location ? row(ctx.homeVisit ? "We'll come to you at" : "Location", escapeHtml(ctx.location)) : ""}
          ${row("Child", escapeHtml(kids || "—"))}
          ${row("Total", `<b>${gbp(b.amount)}</b>`)}
        </table>
        ${label("Dates &amp; times")}
        ${datesGridHtml(b.sessions ?? [])}
        ${ctx.mapCid ? `${label("Where")}<img src="${ctx.mapCid}" alt="Map of ${escapeHtml(ctx.location ?? b.listing)}" width="544" style="display:block;width:100%;max-width:544px;height:auto;border-radius:12px;border:1px solid #eef0f5" />${ctx.location ? `<div style="font-size:12px;color:#8a86a3;margin-top:6px">📍 ${escapeHtml(ctx.location)}</div>` : ""}` : ""}
        ${ctx.provided && ctx.provided.length ? `${label("What's included")}<div>${chips(ctx.provided)}</div>` : ""}
        ${ctx.toBring && ctx.toBring.length ? `${label("What to bring")}<div>${chips(ctx.toBring)}</div>` : ""}
        <div style="text-align:center;margin:26px 0 4px">
          <a href="${bookingUrl}" style="display:inline-block;background:#15b364;color:#ffffff;padding:13px 32px;border-radius:999px;text-decoration:none;font-weight:800;font-size:15px;box-shadow:0 8px 20px -8px rgba(21,179,100,.6)">View my booking →</a>
        </div>
      </div>
      <div style="background:#f7f9fd;padding:16px 24px;text-align:center;border-top:1px solid #eef0f5">
        <img src="cid:aos-mark" width="15" height="15" alt="" style="vertical-align:middle;margin-right:6px;border-radius:4px;opacity:.9" />
        <span style="font-size:11.5px;color:#8a86a3;vertical-align:middle">Powered by <b style="color:#4a4763">ActivityOS</b></span>
        <div style="font-size:11px;color:#a7a3bd;margin-top:5px">You're receiving this because a booking was made with ${escapeHtml(brand.name)}.</div>
      </div>
    </div>
  </div>
  </div>`;
}

/** Build + send a customer booking email through the branded shell — resolves
 *  the provider's logo, wraps the body in layout(), attaches the marks. */
function sendCustomerEmail(
  b: Booking,
  providerName: string,
  key: "bookings" | "payments" | "waitlist",
  subject: string,
  title: string,
  body: string,
  /** Pull in the listing's photo + venue (and, with whatIncluded/map, what's
   *  included / to bring / a venue map). Omit for the plainer emails. */
  enrich?: { whatIncluded?: boolean; map?: boolean },
): void {
  void (async () => {
    const brand = await customerBrand(b.tenantId, providerName);
    const ctx: Awaited<ReturnType<typeof listingContext>> = enrich ? await listingContext(b, enrich) : { attachments: [] };
    sendGated(
      b.tenantId,
      key,
      b.email,
      subject,
      layout({ name: brand.name, hasLogo: !!brand.logo }, title, body, b, {
        heroCid: ctx.heroCid,
        location: ctx.location,
        homeVisit: ctx.homeVisit,
        provided: ctx.provided,
        toBring: ctx.toBring,
        mapCid: ctx.mapCid,
      }),
      providerName,
      [...brandAttachments(brand), ...ctx.attachments],
    );
  })().catch((e) => console.error(`[mail] "${subject}" build failed:`, (e as Error).message));
}

export function emailBookingRequestReceived(b: Booking, providerName: string): void {
  sendCustomerEmail(
    b, providerName, "bookings",
    `Booking request received — ${b.listing}`,
    "We've got your booking request",
    `<p style="font-size:14px">Thanks ${escapeHtml(b.booker)} — your request is with ${escapeHtml(providerName)} for approval.
     You'll get another email as soon as it's confirmed. Payment is collected after approval.</p>`,
    {}, // hero photo + venue location
  );
}

export function emailPaymentLink(b: Booking, providerName: string): void {
  sendCustomerEmail(
    b, providerName, "bookings",
    `Complete your booking — ${b.listing}`,
    "Your booking is reserved — payment inside",
    `<p style="font-size:14px">Hi ${escapeHtml(b.booker)}, ${escapeHtml(providerName)} has reserved this booking for you.</p>
     <p><a href="${webUrl}/custdash/bookings?pay=${encodeURIComponent(b.ref)}" style="display:inline-block;background:#1d3a8f;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Pay ${gbp(b.amount)} securely</a></p>
     <p style="color:#8a86a3;font-size:12px">Signing in from the link starts the card payment automatically.</p>`,
  );
}

export function emailBookingConfirmed(b: Booking, providerName: string): void {
  const closing = b.serviceAddress?.postcode
    ? `Great news ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} has confirmed your booking. We'll come to you!`
    : `Great news ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} has confirmed your booking. See you there!`;
  sendCustomerEmail(
    b, providerName, "bookings",
    `Booking confirmed — ${b.listing}`,
    "You're booked in ✓",
    `<p style="font-size:14px">${closing}</p>`,
    { whatIncluded: true, map: true }, // hero + location + what's included / to bring + venue map (skipped automatically for home-visit — see listingContext)
  );
}

export function emailBookingDeclined(b: Booking, providerName: string, reason?: string): void {
  const note = reason?.trim()
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0;border-collapse:separate">
         <tr><td style="background:#fbf1f1;border-left:3px solid #d9736b;border-radius:6px;padding:11px 14px">
           <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#a1443c;margin-bottom:3px">Message from ${escapeHtml(providerName)}</div>
           <div style="font-size:14px;color:#4a2b28;white-space:pre-wrap">${escapeHtml(reason.trim())}</div>
         </td></tr>
       </table>`
    : "";
  sendCustomerEmail(
    b, providerName, "bookings",
    `Booking update — ${b.listing}`,
    "Your booking request was declined",
    `<p style="font-size:14px">Sorry ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} couldn't take this booking.
     Nothing has been charged. Feel free to browse other dates or activities.</p>${note}`,
  );
}

/** The outcome of a family's date/time-change request — branded with the
 *  provider's own logo (via sendCustomerEmail), spelling out each "from → to"
 *  date and the requested time, and whether each was approved or declined. */
export function emailDateChangeResolved(
  b: Booking,
  providerName: string,
  opts: {
    outcome: "approved" | "declined" | "partial";
    moves: { from?: string; to?: string; approved?: boolean }[];
    timing?: string;
    reason?: string;
  },
): void {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const pill = (ok: boolean) =>
    `<span style="font-size:11px;font-weight:800;color:${ok ? "#15803d" : "#b91c1c"};background:${ok ? "#e6f6ec" : "#fceaea"};padding:2px 9px;border-radius:999px;white-space:nowrap">${ok ? "Approved" : "Not approved"}</span>`;
  const rowsHtml = opts.moves
    .filter((m) => m.to)
    .map((m) => {
      const ok = opts.outcome === "declined" ? false : m.approved !== false;
      const change = m.from ? `${fmt(m.from)} &rarr; <b>${fmt(m.to!)}</b>` : `New date: <b>${fmt(m.to!)}</b>`;
      return `<tr><td style="padding:7px 14px 7px 0;font-size:13.5px;color:#4a4763">${change}</td><td style="padding:7px 0;text-align:right">${pill(ok)}</td></tr>`;
    })
    .join("");
  const timingHtml = opts.timing
    ? `<tr><td style="padding:7px 14px 7px 0;font-size:13.5px;color:#4a4763">New time: <b>${escapeHtml(opts.timing)}</b></td><td style="padding:7px 0;text-align:right">${pill(opts.outcome !== "declined")}</td></tr>`
    : "";
  const table = rowsHtml || timingHtml
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:14px 0;border-collapse:collapse">${rowsHtml}${timingHtml}</table>`
    : "";
  const lead =
    opts.outcome === "declined"
      ? `<p style="font-size:14px">Hi ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} wasn't able to make the change you asked for on <b>${escapeHtml(b.listing)}</b>. Your original dates and times stay exactly as they were.</p>`
      : opts.outcome === "partial"
        ? `<p style="font-size:14px">Hi ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} has reviewed your request on <b>${escapeHtml(b.listing)}</b>. Here's what was and wasn't approved:</p>`
        : `<p style="font-size:14px">Good news ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} approved your change on <b>${escapeHtml(b.listing)}</b>:</p>`;
  const note = opts.reason?.trim()
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 2px;border-collapse:separate"><tr><td style="background:#f4f6fb;border-left:3px solid #1d3a8f;border-radius:6px;padding:10px 13px"><div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#3a4a86;margin-bottom:3px">Message from ${escapeHtml(providerName)}</div><div style="font-size:13.5px;color:#2b3350;white-space:pre-wrap">${escapeHtml(opts.reason.trim())}</div></td></tr></table>`
    : "";
  // "date change" / "time change" / "date & time change" — describe what they
  // actually asked to move, so the subject reads naturally (no bare ref).
  const hasDate = opts.moves.some((m) => m.to);
  const changeLabel = hasDate && opts.timing ? "date & time change" : opts.timing ? "time change" : "date change";
  const outcomeWord = opts.outcome === "declined" ? "declined" : opts.outcome === "partial" ? "partly approved" : "approved";
  const title =
    opts.outcome === "declined" ? `Your ${changeLabel} couldn't be made`
      : opts.outcome === "partial" ? `Your ${changeLabel} was partly approved`
        : `Your ${changeLabel} is confirmed`;
  // Ref belongs in the email body, never the subject line.
  const refLine = `<p style="font-size:12px;color:#8a86a3;margin-top:16px">Booking ${escapeHtml(b.ref)} · ${escapeHtml(b.listing)}</p>`;
  sendCustomerEmail(
    b, providerName, "bookings",
    `${providerName}: your ${changeLabel} was ${outcomeWord}`,
    title,
    `${lead}${table}${note}${refLine}`,
  );
}

export function emailRefundApproved(b: Booking, providerName: string): void {
  const toWallet = b.cancel?.refundTo === "wallet";
  const amt = b.cancel?.amount ? gbp(b.cancel.amount) : "";
  sendCustomerEmail(
    b, providerName, "payments",
    toWallet ? `Wallet credit added — ${b.listing}` : `Refund approved — ${b.listing}`,
    toWallet ? "Your wallet credit is ready" : "Your refund is on its way",
    toWallet
      ? `<p style="font-size:14px">Hi ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} approved your refund${amt ? ` of <b>${amt}</b>` : ""} as <b>wallet credit</b>.
         It&rsquo;s <b>already in your wallet</b> and ready to spend on your next booking — nothing else to do.</p>`
      : b.cancel?.refundVia === "offline"
        // A voucher / Tax-Free Childcare / cash booking: the app can't send it
        // back, and it was never on a card — don't say it's going there.
        ? `<p style="font-size:14px">Hi ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} approved the refund for this booking${amt ? ` (<b>${amt}</b>)` : ""}.
           ${b.voucherScheme ? `It will be returned through <b>${escapeHtml(b.voucherScheme)}</b>, the way you paid.` : "They'll return it the way you paid."} If you have questions, reply to this email.</p>`
        : `<p style="font-size:14px">Hi ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} approved the refund for this booking.
         ${amt ? `Amount: <b>${amt}</b>. It should reach your original payment method within a few days.` : ""}</p>`,
  );
}

export function emailPlaceOffered(b: Booking, providerName: string): void {
  const until = b.offerExpiresAt
    ? new Date(b.offerExpiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "";
  sendCustomerEmail(
    b, providerName, "waitlist",
    `A place has opened up — ${b.listing}`,
    "A place is yours if you want it",
    `<p style="font-size:14px">Good news ${escapeHtml(b.booker)} — a place has opened up on the dates you were
     waiting for, and it's being held for you <b>for 2 hours${until ? ` (until ${until})` : ""}</b>.</p>
     <p style="font-size:14px">Sign in to <b>My bookings</b> and accept the offer to take the place —
     if the hold runs out, it passes to the next family in the queue.</p>`,
  );
}


/**
 * "You can see what's on" — the invite an operator sends after a phone
 * enquiry. Carries a set-password link, never a password.
 *
 * Says who created the account and why, because an unexplained login is
 * indistinguishable from a phishing email — and tells them how to be rid of
 * it, which is both courteous and the lawful basis for having made it.
 */
export function emailSignUpInvite(p: {
  to: string;
  firstName: string;
  providerName: string;
  link: string;
  existed: boolean;
  tenantId?: string;
}): void {
  void (async () => {
    const brand = await customerBrand(p.tenantId, p.providerName);
    const cta = p.existed ? "Sign in" : "Set your password";
    const header = brand.logo
      ? `<img src="cid:provider-logo" alt="${escapeHtml(brand.name)}" style="max-height:46px;max-width:220px;display:inline-block" />`
      : `<span style="font-size:22px;font-weight:800;color:#1d3a8f">${escapeHtml(brand.name)}</span>`;
    const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#171534;background:#ffffff">
      <div style="text-align:center;padding:22px 0 12px;border-bottom:3px solid #1d3a8f">${header}</div>
      <div style="padding:26px 22px">
        <h2 style="font-size:21px;margin:0 0 12px;color:#171534">Hi ${escapeHtml(p.firstName)} 👋</h2>
        <p style="font-size:14px;line-height:1.6;margin:0 0 4px">
          <b>${escapeHtml(brand.name)}</b> takes bookings on <b>ActivityOS</b> and has set up an account for you — so you can
          see every session they run, with dates and places left, and book in a couple of taps.
        </p>
        <div style="background:#eef4ff;border-radius:14px;padding:22px;text-align:center;margin:18px 0">
          <a href="${p.link}" style="display:inline-block;background:#1d3a8f;color:#ffffff;padding:13px 32px;border-radius:999px;text-decoration:none;font-weight:800;font-size:15px;box-shadow:0 8px 20px -8px rgba(29,58,143,.55)">${cta} →</a>
          <div style="font-size:12px;line-height:1.5;color:#4a5a94;margin-top:12px">
            ${p.existed
              ? "You already have an ActivityOS account — that link signs you in."
              : "No password is set yet — that link lets you choose your own. Your name and email are already filled in."}
          </div>
        </div>
        <p style="font-size:11.5px;line-height:1.5;color:#8a8fa3;margin:0;text-align:center">
          Didn't expect this? Just ignore it — nothing happens.
        </p>
      </div>
      <div style="text-align:center;padding:14px 0;border-top:1px solid #eef0f5;color:#8a86a3;font-size:11.5px">Powered by <b style="color:#4a4763">ActivityOS</b></div>
    </div>`;
    sendAs(
      p.tenantId,
      p.providerName,
      p.to,
      `${p.providerName} invited you to sign up to their booking platform`,
      html,
      // ONLY the provider's own logo — never the ActivityOS mark (an unreferenced
      // aos-mark attachment shows as a stray "ActivityOS logo" chip in Gmail).
      { attachments: brand.logo ? [brand.logo] : [] },
    );
  })().catch((e) => console.error("[mail] sign-up invite build failed:", (e as Error).message));
}

/** New provider welcome — sent once, right after a company/freelancer signup
 *  creates its tenant (registerRole.ts). Introduces ActivityOS and the first
 *  couple of things worth doing, with a straight link into their new
 *  dashboard. Account-access mail like the sign-up invite: ungated by the
 *  Setup → Email "automatic emails" toggles (those are for booking/payment
 *  traffic, not the once-ever welcome), but still passes through the same
 *  MAIL_LIVE gate as every other send (see sendMail in mailer.ts). */
export function emailProviderWelcome(p: {
  to: string;
  providerName: string;
  /** First name, if we have one, for the greeting — falls back to the
   *  business name. */
  firstName?: string;
  portal: "company" | "freelancer" | "franchise";
  tenantId?: string;
}): void {
  void (async () => {
    const dashUrl = `${webUrl}/${p.portal}/dashboard`;
    const greetingName = p.firstName?.trim() || p.providerName;
    const step = (n: number, title: string, body: string) => `
      <tr>
        <td style="padding:10px 0;vertical-align:top;width:34px">
          <div style="width:26px;height:26px;border-radius:50%;background:#eef4ff;color:#1d3a8f;font-size:13px;font-weight:800;text-align:center;line-height:26px">${n}</div>
        </td>
        <td style="padding:10px 0 10px 4px">
          <div style="font-size:14px;font-weight:800;color:#171534">${escapeHtml(title)}</div>
          <div style="font-size:13px;color:#4a4763;line-height:1.5;margin-top:2px">${body}</div>
        </td>
      </tr>`;
    const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#171534;background:#ffffff">
      <div style="text-align:center;padding:22px 0 12px;border-bottom:3px solid #1d3a8f">
        <span style="font-size:22px;font-weight:800;color:#1d3a8f">ActivityOS</span>
      </div>
      <div style="padding:26px 22px">
        <h2 style="font-size:21px;margin:0 0 12px;color:#171534">Welcome to ActivityOS, ${escapeHtml(greetingName)} 🎉</h2>
        <p style="font-size:14px;line-height:1.6;margin:0 0 16px">
          <b>${escapeHtml(p.providerName)}</b> is now set up. ActivityOS is where you'll run bookings, take payments,
          roster your team and keep families in the loop — all from one place.
        </p>
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:6px">
          ${step(1, "Add your first listing", "A camp, class or club families can book — set the dates, price and how many places you've got.")}
          ${step(2, "Invite your team", "Bring in your staff or franchisees so rotas, registers and messages reach the right people.")}
          ${step(3, "Finish Setup &amp; features", "Your logo, safeguarding contacts, cancellation policy and the rest — a few minutes now saves a chase later.")}
        </table>
        <div style="text-align:center;margin:22px 0 6px">
          <a href="${dashUrl}" style="display:inline-block;background:#1d3a8f;color:#ffffff;padding:13px 32px;border-radius:999px;text-decoration:none;font-weight:800;font-size:15px;box-shadow:0 8px 20px -8px rgba(29,58,143,.55)">Open your dashboard →</a>
        </div>
        <p style="font-size:11.5px;line-height:1.5;color:#8a8fa3;margin:18px 0 0;text-align:center">
          Questions any time? Reply to this email, or use Message ActivityOS from inside the app.
        </p>
      </div>
      <div style="text-align:center;padding:14px 0;border-top:1px solid #eef0f5;color:#8a86a3;font-size:11.5px">Powered by <b style="color:#4a4763">ActivityOS</b></div>
    </div>`;
    sendAs(p.tenantId, "ActivityOS", p.to, "Welcome to ActivityOS — let's get you set up", html);
  })().catch((e) => console.error("[mail] provider welcome build failed:", (e as Error).message));
}

/** Immediate acknowledgement for the pricing page's "Website design &
 * maintenance" add-on — both its "Add website design & maintenance" (now a
 * real slot booking, sharing the same open-slot pool as /demo — see
 * routes/demoSlots.ts) and "Ask a question first" (no slot) buttons land
 * here (POST /api/leads, source "website_build"). Distinct subject/body per
 * kind so a question genuinely reads back what they asked, not a generic
 * "thanks", and a booked slot gets a real confirmation, not a repeat offer
 * to book one. */
export function emailWebsiteAddonAck(p: {
  to: string;
  name: string;
  kind: "signup" | "question";
  message?: string;
  slotAt?: string;
  leadId: string;
}): void {
  void (async () => {
    const firstName = p.name.trim().split(/\s+/)[0] || p.name.trim();
    const demoUrl = `${webUrl}/demo`;
    const videoUrl = p.slotAt ? await ensureLeadVideoUrl(p.leadId) : null;
    const heading = p.kind === "question"
      ? "Got your question — we'll reply shortly"
      : p.slotAt ? "You're booked in — got your website request" : "Got your website request";
    const body = p.kind === "question"
      ? `<p style="font-size:14px;line-height:1.6;margin:0 0 14px">Thanks, ${escapeHtml(firstName)} — here's what you asked us:</p>
         <div style="background:#f5f6fb;border-left:3px solid #1d3a8f;border-radius:6px;padding:12px 14px;margin:0 0 16px;font-size:13.5px;line-height:1.55;color:#171534">${escapeHtml(p.message?.trim() || "(no message included)")}</div>
         <p style="font-size:14px;line-height:1.6;margin:0 0 16px">Someone from the team will get back to you shortly with an answer.</p>`
      : p.slotAt && videoUrl
      ? `<p style="font-size:14px;line-height:1.6;margin:0 0 16px">Thanks, ${escapeHtml(firstName)} — we've got your request for a branded website to match your Activly storefront, and booked you in for a quick call to talk it through:</p>
         <div style="background:#eef4ff;border-radius:10px;padding:14px 16px;margin:0 0 16px;text-align:center;font-size:15px;font-weight:800;color:#1d3a8f">${escapeHtml(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(p.slotAt)))} (UK time)</div>
         <div style="text-align:center;margin:0 0 16px">
           <a href="${videoUrl}" style="display:inline-block;background:#1d3a8f;color:#ffffff;padding:13px 32px;border-radius:999px;text-decoration:none;font-weight:800;font-size:15px;box-shadow:0 8px 20px -8px rgba(29,58,143,.55)">🎥 Join your call</a>
         </div>
         <p style="font-size:13.5px;line-height:1.6;margin:0 0 16px;color:#4a4763">Same link works whenever you're ready to join, no account or download needed. Need to move it? Just reply to this email.</p>`
      : `<p style="font-size:14px;line-height:1.6;margin:0 0 16px">Thanks, ${escapeHtml(firstName)} — we've got your request for a branded website to match your Activly storefront. Someone from the team will be in touch shortly to confirm the details and get started.</p>`;
    const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#171534;background:#ffffff">
      <div style="text-align:center;padding:22px 0 12px;border-bottom:3px solid #1d3a8f">
        <span style="font-size:22px;font-weight:800;color:#1d3a8f">ActivityOS</span>
      </div>
      <div style="padding:26px 22px">
        <h2 style="font-size:21px;margin:0 0 12px;color:#171534">${escapeHtml(heading)}</h2>
        ${body}
        ${!p.slotAt ? `
        <p style="font-size:13.5px;line-height:1.6;margin:0 0 6px;color:#4a4763">${p.kind === "question" ? "Prefer to talk it through instead? Grab a free 1-on-1 walkthrough with the team — no obligation." : "Want a full demo to go through our platform instead? Grab a free 1-on-1 walkthrough with the team — no obligation."}</p>
        <div style="text-align:center;margin:16px 0 6px">
          <a href="${demoUrl}" style="display:inline-block;background:#1d3a8f;color:#ffffff;padding:13px 32px;border-radius:999px;text-decoration:none;font-weight:800;font-size:15px;box-shadow:0 8px 20px -8px rgba(29,58,143,.55)">Book a demo →</a>
        </div>` : ""}
        <p style="font-size:11.5px;line-height:1.5;color:#8a8fa3;margin:18px 0 0;text-align:center">Questions any time? Just reply to this email.</p>
      </div>
      <div style="text-align:center;padding:14px 0;border-top:1px solid #eef0f5;color:#8a86a3;font-size:11.5px">Powered by <b style="color:#4a4763">ActivityOS</b></div>
    </div>`;
    // No tenantId — this is platform mail, before anyone has an account.
    // Reply-To routes a reply back onto this lead (see leadReplySender).
    await sendMail(p.to, heading, html, await leadReplySender(p.leadId));
  })().catch((e) => console.error("[mail] website-addon ack build failed:", (e as Error).message));
}

/** HQ booked a lead onto a real demo-call slot on their behalf (the Sales
 * board's "📹 Book onto a demo" action — for someone who never went through
 * /demo themselves, e.g. a website-add-on enquiry). Confirms the day/time so
 * they're not just told, out of nowhere, that a call is happening. */
export function emailDemoBooked(p: { to: string; name: string; slotAt: string; leadId: string }): void {
  void (async () => {
    const firstName = p.name.trim().split(/\s+/)[0] || p.name.trim();
    const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(p.slotAt));
    const videoUrl = await ensureLeadVideoUrl(p.leadId);
    const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#171534;background:#ffffff">
      <div style="text-align:center;padding:22px 0 12px;border-bottom:3px solid #1d3a8f">
        <span style="font-size:22px;font-weight:800;color:#1d3a8f">ActivityOS</span>
      </div>
      <div style="padding:26px 22px">
        <h2 style="font-size:21px;margin:0 0 12px;color:#171534">You're booked in, ${escapeHtml(firstName)} 🎉</h2>
        <p style="font-size:14px;line-height:1.6;margin:0 0 16px">We've pencilled you in for a free 1-on-1 walkthrough:</p>
        <div style="background:#eef4ff;border-radius:10px;padding:14px 16px;margin:0 0 16px;text-align:center;font-size:15px;font-weight:800;color:#1d3a8f">${escapeHtml(when)} (UK time)</div>
        <div style="text-align:center;margin:0 0 16px">
          <a href="${videoUrl}" style="display:inline-block;background:#1d3a8f;color:#ffffff;padding:13px 32px;border-radius:999px;text-decoration:none;font-weight:800;font-size:15px;box-shadow:0 8px 20px -8px rgba(29,58,143,.55)">🎥 Join your call</a>
        </div>
        <p style="font-size:13.5px;line-height:1.6;margin:0;color:#4a4763">Same link works whenever you're ready to join, no account or download needed. Need to move it? Just reply to this email.</p>
      </div>
      <div style="text-align:center;padding:14px 0;border-top:1px solid #eef0f5;color:#8a86a3;font-size:11.5px">Powered by <b style="color:#4a4763">ActivityOS</b></div>
    </div>`;
    await sendMail(p.to, "You're booked in for your Activly demo", html, await leadReplySender(p.leadId));
  })().catch((e) => console.error("[mail] demo-booked ack build failed:", (e as Error).message));
}

/** HQ's reply to a "website-design-question" lead (Sales board's reply box
 * on the lead card, PUT /api/platform/leads/:id/answer). Quotes their
 * original question back alongside the answer — they asked it once, this
 * shouldn't make them re-find what they said — and always offers a demo,
 * the same closing nudge as the initial acknowledgement. */
export function emailQuestionAnswered(p: { to: string; name: string; question: string; answer: string; leadId: string }): void {
  void (async () => {
    const firstName = p.name.trim().split(/\s+/)[0] || p.name.trim();
    const demoUrl = `${webUrl}/demo`;
    const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#171534;background:#ffffff">
      <div style="text-align:center;padding:22px 0 12px;border-bottom:3px solid #1d3a8f">
        <span style="font-size:22px;font-weight:800;color:#1d3a8f">ActivityOS</span>
      </div>
      <div style="padding:26px 22px">
        <h2 style="font-size:21px;margin:0 0 12px;color:#171534">Here's your answer, ${escapeHtml(firstName)}</h2>
        <p style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#8a8fa3;margin:0 0 4px">You asked</p>
        <div style="background:#f5f6fb;border-left:3px solid #8a8fa3;border-radius:6px;padding:10px 14px;margin:0 0 16px;font-size:13px;line-height:1.55;color:#4a4763">${escapeHtml(p.question || "(no message included)")}</div>
        <p style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#1d3a8f;margin:0 0 4px">Our answer</p>
        <div style="background:#eef4ff;border-left:3px solid #1d3a8f;border-radius:6px;padding:12px 14px;margin:0 0 18px;font-size:14px;line-height:1.6;color:#171534">${escapeHtml(p.answer)}</div>
        <p style="font-size:13.5px;line-height:1.6;margin:0 0 6px;color:#4a4763">Want to see it for yourself instead? Grab a free 1-on-1 walkthrough with the team — no obligation.</p>
        <div style="text-align:center;margin:16px 0 6px">
          <a href="${demoUrl}" style="display:inline-block;background:#1d3a8f;color:#ffffff;padding:13px 32px;border-radius:999px;text-decoration:none;font-weight:800;font-size:15px;box-shadow:0 8px 20px -8px rgba(29,58,143,.55)">Book a demo →</a>
        </div>
        <p style="font-size:11.5px;line-height:1.5;color:#8a8fa3;margin:18px 0 0;text-align:center">Anything else? Just reply to this email.</p>
      </div>
      <div style="text-align:center;padding:14px 0;border-top:1px solid #eef0f5;color:#8a86a3;font-size:11.5px">Powered by <b style="color:#4a4763">ActivityOS</b></div>
    </div>`;
    await sendMail(p.to, "Your question, answered", html, await leadReplySender(p.leadId));
  })().catch((e) => console.error("[mail] question-answered build failed:", (e as Error).message));
}

/** HQ shares a call note with the lead — the Sales board's "Call notes"
 * section, only when the "Share with them?" toggle is set to Yes (kept
 * internal-only otherwise, never emailed). Same reply-routing as everything
 * else lead-facing, so a reply lands back on the thread, not a dead end. */
export function emailCallNote(p: { to: string; name: string; note: string; leadId: string }): void {
  void (async () => {
    const firstName = p.name.trim().split(/\s+/)[0] || p.name.trim();
    const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#171534;background:#ffffff">
      <div style="text-align:center;padding:22px 0 12px;border-bottom:3px solid #1d3a8f">
        <span style="font-size:22px;font-weight:800;color:#1d3a8f">ActivityOS</span>
      </div>
      <div style="padding:26px 22px">
        <h2 style="font-size:21px;margin:0 0 12px;color:#171534">A quick note for you, ${escapeHtml(firstName)}</h2>
        <div style="background:#eef4ff;border-left:3px solid #1d3a8f;border-radius:6px;padding:12px 14px;margin:0 0 16px;font-size:14px;line-height:1.6;color:#171534">${escapeHtml(p.note)}</div>
        <p style="font-size:11.5px;line-height:1.5;color:#8a8fa3;margin:18px 0 0;text-align:center">Questions any time? Just reply to this email.</p>
      </div>
      <div style="text-align:center;padding:14px 0;border-top:1px solid #eef0f5;color:#8a86a3;font-size:11.5px">Powered by <b style="color:#4a4763">ActivityOS</b></div>
    </div>`;
    await sendMail(p.to, "A note from the Activly team", html, await leadReplySender(p.leadId));
  })().catch((e) => console.error("[mail] call-note build failed:", (e as Error).message));
}

/** Team/franchise invite — the join link, who sent it and what it grants.
 * The link is the secret; it can only be used once. */
export function emailTeamInvite(p: {
  to: string;
  tenantName: string;
  role: "franchise" | "staff";
  link: string;
  inviterName?: string;
  /** Settings → Staff & workforce: a personal welcome line from the provider. */
  message?: string;
  tenantId?: string;
}): void {
  const what =
    p.role === "franchise"
      ? `run your own franchise area inside ${escapeHtml(p.tenantName)}`
      : `join the ${escapeHtml(p.tenantName)} team as staff`;
  sendAs(
    p.tenantId,
    p.tenantName,
    p.to,
    `${p.tenantName} — you're invited`,
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#171534">
      <h2 style="font-size:19px;margin:0 0 10px">Join ${escapeHtml(p.tenantName)} on ActivityOS</h2>
      <p style="font-size:14px;line-height:1.55;margin:0 0 14px">
        ${p.inviterName ? `${escapeHtml(p.inviterName)} has invited you` : "You've been invited"} to ${what}.
        The button below creates your account and links it to theirs — nothing to configure.
      </p>
      ${p.message ? `<blockquote style="border-left:3px solid #cdddf7;margin:0 0 14px;padding:6px 0 6px 14px;color:#4a4763;font-size:14px;line-height:1.55;white-space:pre-wrap">${escapeHtml(p.message)}</blockquote>` : ""}
      <p style="margin:0 0 16px">
        <a href="${p.link}" style="display:inline-block;background:#2f6bd8;color:#fff;padding:11px 20px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Accept the invite</a>
      </p>
      <p style="font-size:11.5px;line-height:1.5;color:#8a8fa3;margin:0">
        The link works once. Not expecting this? Ignore it and nothing happens.
      </p>
    </div>`,
  );
}

/** Employment-reference request — sent to the candidate's REFEREE, who has no
 * account and no prior relationship with us. Two things earn the click: it says
 * plainly who is asking and about whom, and it's short. The link is the secret
 * and works once. */
export function emailReferenceRequest(p: {
  to: string;
  refereeName: string;
  tenantName: string;
  candidateName: string;
  jobTitle?: string | null;
  link: string;
  message?: string;
  tenantId?: string;
  /** A reminder rather than a first approach. */
  chase?: boolean;
}): void {
  const role = p.jobTitle ? ` as ${escapeHtml(p.jobTitle)}` : "";
  sendAs(
    p.tenantId,
    p.tenantName,
    p.to,
    p.chase
      ? `Reminder — reference for ${p.candidateName}`
      : `${p.tenantName} — reference request for ${p.candidateName}`,
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#171534">
      <h2 style="font-size:19px;margin:0 0 10px">${p.chase ? "A quick reminder" : `Could you give a reference for ${escapeHtml(p.candidateName)}?`}</h2>
      <p style="font-size:14px;line-height:1.55;margin:0 0 14px">
        Hello ${escapeHtml(p.refereeName)} — <b>${escapeHtml(p.tenantName)}</b> is considering
        <b>${escapeHtml(p.candidateName)}</b> for a role working with children${role}, and they've given your
        name as a referee.${p.chase ? " We sent this a little while ago and haven't heard back yet." : ""}
      </p>
      <p style="font-size:14px;line-height:1.55;margin:0 0 14px">
        It's a short form — a few questions about how you know them and how they worked. It takes about
        three minutes, and you can attach a reference on your own headed paper instead if you'd rather.
      </p>
      ${p.message ? `<blockquote style="border-left:3px solid #cdddf7;margin:0 0 14px;padding:6px 0 6px 14px;color:#4a4763;font-size:14px;line-height:1.55;white-space:pre-wrap">${escapeHtml(p.message)}</blockquote>` : ""}
      <p style="margin:0 0 16px">
        <a href="${p.link}" style="display:inline-block;background:#b45309;color:#fff;padding:11px 20px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Give the reference</a>
      </p>
      <p style="font-size:11.5px;line-height:1.5;color:#8a8fa3;margin:0">
        The link works once. Not the right person, or you'd rather not? Open it and choose
        “I can't give this reference” — that closes the request and stops the reminders.
      </p>
    </div>`,
  );
}

/** The reference came back (or the referee declined) — told to whoever asked
 * for it. A flagged safeguarding concern says so in the subject line: it's the
 * one thing that must not wait until someone next opens the onboarding tab. */
export function emailReferenceReceived(p: {
  to: string;
  tenantName: string;
  candidateName: string;
  refereeName: string;
  concern: boolean;
  /** Set when the referee closed the request instead of completing it. */
  declined?: string;
  /** Which portal the person who asked for it works in — company / franchise /
   *  freelancer all reach the record at <portal>/staff. */
  portal?: string;
  tenantId?: string;
}): void {
  const link = `${webUrl}/${p.portal || "company"}/staff`;
  const subject = p.declined
    ? `${p.refereeName} can't give a reference for ${p.candidateName}`
    : p.concern
      ? `⚠ Reference for ${p.candidateName} — concern flagged`
      : `Reference received for ${p.candidateName}`;
  sendAs(
    p.tenantId,
    p.tenantName,
    p.to,
    subject,
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#171534">
      <h2 style="font-size:19px;margin:0 0 10px">${p.declined ? "Reference declined" : "Reference received"}</h2>
      <p style="font-size:14px;line-height:1.55;margin:0 0 14px">
        <b>${escapeHtml(p.refereeName)}</b> ${p.declined ? "has closed the reference request for" : "has completed the reference for"}
        <b>${escapeHtml(p.candidateName)}</b>.
      </p>
      ${p.declined ? `<blockquote style="border-left:3px solid #e2e5ee;margin:0 0 14px;padding:6px 0 6px 14px;color:#4a4763;font-size:14px;line-height:1.55">${escapeHtml(p.declined)}</blockquote>` : ""}
      ${p.concern ? `<div style="background:#fdecec;border:1px solid #f3c2c2;border-radius:12px;padding:14px;margin:0 0 14px">
        <b style="font-size:14px;color:#a32020">A safeguarding question was answered “yes”.</b>
        <div style="font-size:13px;line-height:1.5;color:#6b2b2b;margin-top:4px">
          Read the full reference before this person starts. They stay on hold until someone records what was done about it.
        </div>
      </div>` : ""}
      <p style="margin:0 0 16px">
        <a href="${link}" style="display:inline-block;background:#1d3a8f;color:#fff;padding:11px 20px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Open the onboarding record</a>
      </p>
      <p style="font-size:11.5px;line-height:1.5;color:#8a8fa3;margin:0">
        The reference itself isn't in this email — it lives on ${escapeHtml(p.candidateName)}'s record where only your team can see it.
      </p>
    </div>`,
  );
}

/** §H — the ONE email when an operator books for a family: confirmation +
 * set-your-password (new accounts) + pay link. Deliberately NO child data:
 * a mistyped address must never leak a child's details. */
export function emailFamilyBookingCreated(
  bookings: Booking[],
  providerName: string,
  opts: { accountCreated: boolean; passwordLink: string | null },
): void {
  const b = bookings[0];
  const total = bookings.reduce((s, x) => s + x.amount, 0);
  const refs = bookings.map((x) => x.ref).join(", ");
  const payUrl = `${webUrl}/custdash/bookings?pay=${encodeURIComponent(b.ref)}`;
  // When the booking just created their account this email carries the ONLY
  // set-password link the family will ever get — the bookings toggle can
  // silence a courtesy confirmation, never account access.
  const send = opts.accountCreated && opts.passwordLink
    ? (to: string, subject: string, html: string) => sendAs(b.tenantId, providerName, to, subject, html)
    : (to: string, subject: string, html: string) => sendGated(b.tenantId, "bookings", to, subject, html, providerName);
  send(
    b.email,
    `Your booking with ${providerName} (${refs})`,
    `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#171534">
    <div style="padding:18px 0 10px;border-bottom:2px solid #1d3a8f">
      <strong style="font-size:18px">${escapeHtml(providerName)}</strong>
      <span style="color:#8a86a3;font-size:12px"> · via ActivityOS</span>
    </div>
    <h2 style="font-size:19px;margin:18px 0 6px">Your booking is confirmed</h2>
    <p style="font-size:14px">Hi ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} has made this booking for you
      (you spoke to them, or they took it over the phone), and it now lives in your own
      ActivityOS account so you can see it, pay it, and manage it any time.</p>
    <table style="margin:14px 0;border-collapse:collapse;font-size:13.5px" cellpadding="0">
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Booking ref${bookings.length > 1 ? "s" : ""}</td><td><b>${refs}</b></td></tr>
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Activity</td><td>${escapeHtml(b.listing)}</td></tr>
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Dates</td><td>${b.dates}</td></tr>
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Total</td><td><b>${gbp(total)}</b></td></tr>
    </table>
    ${
      opts.accountCreated && opts.passwordLink
        ? `<p style="font-size:14px"><b>First, set your password</b> — we created your account for this booking:</p>
           <p><a href="${opts.passwordLink}" style="display:inline-block;background:#1d3a8f;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Set my password</a></p>`
        : ""
    }
    ${total > 0
      ? `<p style="font-size:14px">Then pay securely by card:</p>
    <p><a href="${payUrl}" style="display:inline-block;background:#15b364;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Pay ${gbp(total)}</a></p>`
      : `<p style="font-size:14px">There's nothing to pay for this booking.</p>`}
    <p style="color:#8a86a3;font-size:11.5px;margin-top:22px">
      You're receiving this because ${escapeHtml(providerName)} made a booking for this email address.
      If that wasn't you, reply and tell them.</p>
  </div>`,
  );
}

/** §Q — childcare voucher instructions: the scheme, its reference(s), the
 * amount and the deadline. Re-sendable from the booking (people lose it). */
export function emailVoucherInstructions(
  b: Booking,
  providerName: string,
  scheme: { name: string; details: { label: string; value: string }[] },
  /** When a checkout made several voucher bookings (e.g. across weeks), pass the
   *  GRAND total + every ref so the family is asked for the full amount once,
   *  not one booking's share. Defaults to this booking's own amount/ref.
   *
   *  `payRefs` are the references WE minted (one per booking-and-child, see
   *  lib/childcare.ts). When there are any, they are what the family is asked to
   *  quote — never the reference they typed themselves, which is their own
   *  account's and matches nothing in our bank. */
  opts: { total?: number; refs?: string[]; payRefs?: { child?: string | null; reference: string }[] } = {},
): void {
  const amount = opts.total ?? b.amount;
  const refsLabel = opts.refs?.length ? opts.refs.join(", ") : b.ref;
  const payRefs = (opts.payRefs ?? []).filter((r) => (r.reference ?? "").trim());
  const payRefRows = payRefs
    .map((r) => `<tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Payment reference${payRefs.length > 1 && r.child ? ` · ${escapeHtml(r.child)}` : ""}</td><td><b style="font-size:15px;letter-spacing:.06em">${escapeHtml(r.reference)}</b></td></tr>`)
    .join("");
  const isUrl = (d: { label: string; value: string }) => /website|url|link|portal/i.test(d.label) || /^https?:\/\//i.test(d.value);
  const refRows = scheme.details
    .map((d) => `<tr><td style="color:#8a86a3;padding:3px 14px 3px 0">${d.label}</td><td>${isUrl(d) ? `<a href="${/^https?:\/\//i.test(d.value) ? d.value : `https://${d.value}`}" style="color:#2f6bd8;font-weight:700">${d.value}</a>` : `<b>${d.value}</b>`}</td></tr>`)
    .join("");
  const sendBy = b.voucherSendBy
    ? new Date(`${b.voucherSendBy}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })
    : null;
  // ONE email for a voucher booking: the confirmation AND how to pay, together
  // (not a separate "booked in" + "pay by voucher" pair).
  sendCustomerEmail(
    b, providerName, "payments",
    `Booking confirmed — pay with ${scheme.name} · ${b.listing}`,
    `You're booked in ✓ — pay with ${scheme.name}`,
    `<p style="font-size:14px">Great news ${escapeHtml(b.booker)} — your booking with ${escapeHtml(providerName)} is confirmed.
      It's held as <b>awaiting voucher payment</b> until the money lands. Pay <b>${gbp(amount)}</b> through
      <b>${scheme.name}</b> on their own website, quoting:</p>
     <table style="margin:10px 0;border-collapse:collapse;font-size:13.5px" cellpadding="0">${refRows}${payRefRows}
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Booking ref${opts.refs && opts.refs.length > 1 ? "s" : ""}</td><td><b>${refsLabel}</b></td></tr>
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Amount</td><td><b>${gbp(amount)}</b></td></tr></table>
     ${payRefs.length ? `<p style="font-size:13px;color:#8a86a3">Please put the payment reference${payRefs.length > 1 ? "s" : ""} above in the payment — it's how ${escapeHtml(providerName)} recognises your money when it arrives${payRefs.length > 1 ? ", one per child" : ""}. Your own ${escapeHtml(scheme.name)} account number isn't needed here.</p>` : ""}
     ${sendBy ? `<p style="font-size:14px"><b>Please send it by ${sendBy}</b> so it reaches ${escapeHtml(providerName)} in time to keep the place.</p>` : ""}
     <p style="color:#8a86a3;font-size:12px">Voucher money takes a few working days to arrive — the provider will mark your place paid once it lands.</p>`,
    { whatIncluded: true, map: true },
  );
}

/** The provider has recorded an off-platform payment (voucher / TFC / cash /
 *  bank transfer) against a booking — tell the family it's landed, with all the
 *  booking context (dates, venue, who's on it, the amount). */
export function emailPaymentReceived(b: Booking, providerName: string, opts: { label: string; amount: number }): void {
  sendCustomerEmail(
    b, providerName, "payments",
    `Payment received — ${b.listing}`,
    "Payment received ✓",
    `<p style="font-size:14px">Thanks ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} has received your <b>${escapeHtml(opts.label)}</b>
      payment of <b>${gbp(opts.amount)}</b>. Your booking is now fully paid. Thank you!</p>`,
    {}, // hero photo + venue location; the details table shows dates / who / total
  );
}

// Quotes too: this is also used inside attribute values (alt="…").
function escapeHtml(s: string) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ── The provider's "new booking" email ────────────────────────────────────
// A richly-presented, email-client-safe (tables + inline styles) notification
// for the provider's team: the ActivityOS brand at the top, the listing's
// photo + name, every attendee with their age, allergies, medical and SEND /
// additional-needs notes, a payment breakdown, and a button that opens the
// exact booking. Any EHCP plans ride along as real attachments (added by the
// caller). The button href is the literal `{{VIEW_URL}}` token — notify()
// swaps it for the resolved, portal-correct deep link at send time.

export interface NewBookingAttendee {
  name: string;
  age?: number;
  ticket?: string;
  allergies?: string;
  medical?: string;
  dietary?: string;
  /** SEND / additional needs, free text. */
  send?: string;
  /** The child's EHCP/SEND plan file id, when one is on file. The email links
   *  STRAIGHT to the secure viewer (/plan/:id) — the plan is never attached
   *  (special-category data); the viewer re-checks access server-side. */
  ehcpFileId?: string;
}

export interface NewBookingEmailArgs {
  providerName: string;
  /** "New booking" | "Booking request" | "Waitlist join". */
  kind: string;
  bookerName: string;
  listingName: string;
  /** Absolute URL of the listing's hero image, if it has one. */
  listingImage?: string;
  /** Pass / ticket line, e.g. "SUMMER WEEK 2 (3RD–7TH AUGUST) 9AM–5:30PM". */
  pass?: string;
  /** Human session lines, e.g. "Mon 03 August 2026: 09:00 – 17:30". */
  sessions: string[];
  attendees: NewBookingAttendee[];
  /** Venue name + address, if resolvable. */
  location?: string;
  cardAmount: number;
  childcareAmount: number;
  childcareLabel?: string; // e.g. "Tax-Free Childcare" / "Childcare vouchers"
  total: number;
  /** The parent-visible booking id (#03073…). */
  bookingId: string;
  ref: string;
  needsApproval?: boolean;
}

function detailRow(label: string, valueHtml: string): string {
  return `
    <tr>
      <td style="padding:12px 0 2px;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#8a86a3">${escapeHtml(label)}</td>
    </tr>
    <tr>
      <td style="padding:0 0 12px;font-size:14.5px;line-height:1.5;color:#171534;border-bottom:1px solid #eef0f5">${valueHtml}</td>
    </tr>`;
}

function attendeeCard(a: NewBookingAttendee): string {
  const health = [a.allergies && `Allergies — ${escapeHtml(a.allergies)}`, a.medical && `Medical — ${escapeHtml(a.medical)}`, a.dietary && `Dietary — ${escapeHtml(a.dietary)}`]
    .filter(Boolean)
    .join("<br>");
  const line = (label: string, valueHtml: string, tint: string) =>
    `<div style="margin-top:8px">
       <span style="display:inline-block;font-size:11px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:${tint}">${label}</span>
       <div style="font-size:13.5px;line-height:1.5;color:#3b3860;margin-top:1px">${valueHtml}</div>
     </div>`;
  return `
  <div style="border:1px solid #eef0f5;border-radius:14px;padding:14px 16px;margin:0 0 12px;background:#fbfcfe">
    <div style="font-size:15px;font-weight:800;color:#171534">${escapeHtml(a.name)}${a.age != null ? `<span style="color:#8a86a3;font-weight:600"> · age ${a.age}</span>` : ""}${a.ticket ? `<span style="color:#8a86a3;font-weight:600"> · ${escapeHtml(a.ticket)}</span>` : ""}</div>
    ${line("🩺 Health &amp; allergies", health || "<span style='color:#a7a3bd'>None recorded</span>", "#1d3a8f")}
    ${line("🧩 SEND &amp; additional needs", a.send ? escapeHtml(a.send) : "<span style='color:#a7a3bd'>None recorded — worth asking the family</span>", "#8a3ffb")}
    ${a.ehcpFileId ? `<a href="${webUrl}/plan/${encodeURIComponent(a.ehcpFileId)}" style="margin-top:9px;display:inline-block;background:#eef3ff;color:#1d3a8f;font-size:12px;font-weight:700;padding:6px 12px;border-radius:999px;text-decoration:none">📎 Open ${escapeHtml(a.name)}'s EHCP plan →</a>` : ""}
  </div>`;
}

export function newBookingProviderEmail(a: NewBookingEmailArgs): string {
  const money = (n: number) => `£${(Math.round(n * 100) / 100).toFixed(2)}`;
  const heading =
    a.kind === "Waitlist join" ? "New waitlist join"
    : a.kind === "Booking request" ? "New booking request"
    : "You have a new booking";

  // Every date in a 3-across grid (date over time, small text) so even a long
  // run stays short and tidy. Session strings look like
  // "Mon 20 Jul 2026 · 08:00 – 17:30".
  const dateCell = (s: string) => {
    const [day, time] = s.split(" · ");
    return `<td width="33%" style="padding:3px 10px 6px 0;vertical-align:top">
      <div style="font-size:12px;font-weight:700;color:#171534;white-space:nowrap">${escapeHtml(day ?? s)}</div>
      ${time ? `<div style="font-size:11px;color:#8a86a3;white-space:nowrap">${escapeHtml(time)}</div>` : ""}
    </td>`;
  };
  const dateRows: string[] = [];
  for (let i = 0; i < a.sessions.length; i += 3) {
    const cells = a.sessions.slice(i, i + 3).map(dateCell);
    while (cells.length < 3) cells.push(`<td width="33%"></td>`); // keep columns aligned
    dateRows.push(`<tr>${cells.join("")}</tr>`);
  }
  const sessionsHtml = a.sessions.length
    ? `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">${dateRows.join("")}</table>`
    : "<span style='color:#a7a3bd'>Dates to be confirmed</span>";

  // Only show a payment line that actually has money against it — a card-only
  // booking shouldn't display "Childcare payment £0", and vice versa.
  const payRows = ([
    ...(a.cardAmount > 0 ? [["Card payment", money(a.cardAmount)]] : []),
    ...(a.childcareAmount > 0 ? [[a.childcareLabel || "Childcare payment", money(a.childcareAmount)]] : []),
  ] as [string, string][])
    .map(
      ([l, v]) =>
        `<tr><td style="padding:5px 0;font-size:13.5px;color:#4a4763">${escapeHtml(l)}</td><td style="padding:5px 0;font-size:13.5px;text-align:right;color:#171534">${v}</td></tr>`,
    )
    .join("");

  return `
  <div style="margin:0;padding:0;background:#eef1f7">
  <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#eef1f7;padding:24px 12px">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 34px -18px rgba(20,30,70,.4)">

      <!-- ActivityOS brand header — the real mark, embedded inline (cid) so it
           renders in every client (see aosLogoAttachment). -->
      <div style="background:linear-gradient(120deg,#16306e 0%,#274ba3 55%,#3f78d8 100%);padding:18px 24px;text-align:center">
        <img src="cid:aos-mark" width="26" height="26" alt="" style="vertical-align:middle;margin-right:9px;border-radius:7px" />
        <span style="font-size:21px;font-weight:800;letter-spacing:.2px;color:#ffffff;vertical-align:middle">Activity<span style="color:#EE1F63">OS</span></span>
      </div>

      ${a.listingImage
        ? `<img src="${a.listingImage}" alt="${escapeHtml(a.listingName)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;object-fit:cover;max-height:230px" />`
        : ""}

      <div style="padding:26px 28px 30px">
        <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#3f78d8">${escapeHtml(a.providerName)}</div>
        <h1 style="font-size:23px;line-height:1.25;margin:4px 0 2px;color:#171534">${heading}</h1>
        <div style="font-size:15px;font-weight:700;color:#4a4763;margin-top:6px">${escapeHtml(a.listingName)}</div>

        <p style="font-size:14.5px;line-height:1.6;color:#3b3860;margin:16px 0 4px">
          Hi ${escapeHtml(a.providerName)}, <b>${escapeHtml(a.bookerName)}</b> has ${a.kind === "Booking request" ? "requested a place on" : a.kind === "Waitlist join" ? "joined the waiting list for" : "booked"} <b>${escapeHtml(a.listingName)}</b>${a.needsApproval ? " — this one needs your approval." : "."}
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:14px">
          ${detailRow("Booker", escapeHtml(a.bookerName))}
          ${a.pass ? detailRow("Listing", `${escapeHtml(a.listingName)}<br><span style="color:#8a86a3;font-size:13px">${escapeHtml(a.pass)}</span>`) : detailRow("Listing", escapeHtml(a.listingName))}
          ${detailRow("Dates & times", sessionsHtml)}
          ${a.location ? detailRow("Location", escapeHtml(a.location)) : ""}
        </table>

        <div style="font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#8a86a3;margin:20px 0 10px">Attendees &amp; profile notes</div>
        ${a.attendees.map(attendeeCard).join("")}

        <!-- Payment -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:18px 0 6px;background:#f7f9fd;border-radius:12px">
          <tr><td style="padding:14px 16px 4px" colspan="2"><span style="font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#8a86a3">Payment</span></td></tr>
          <tr><td colspan="2" style="padding:0 16px"><table width="100%" cellpadding="0" cellspacing="0">${payRows}
            <tr><td style="padding:9px 0 3px;border-top:1px solid #e3e8f2;font-size:15px;font-weight:800;color:#171534">Total</td><td style="padding:9px 0 3px;border-top:1px solid #e3e8f2;font-size:15px;font-weight:800;text-align:right;color:#171534">${money(a.total)}</td></tr>
          </table></td></tr>
          <tr><td colspan="2" style="padding:8px 16px 14px;font-size:12.5px;color:#8a86a3">Booking ID <b style="color:#4a4763">${escapeHtml(a.bookingId)}</b> · Ref <b style="color:#4a4763">${escapeHtml(a.ref)}</b></td></tr>
        </table>

        <!-- View booking button (direct to this booking) -->
        <div style="text-align:center;margin:24px 0 6px">
          <a href="{{VIEW_URL}}" style="display:inline-block;background:#15b364;color:#ffffff;padding:14px 34px;border-radius:999px;text-decoration:none;font-weight:800;font-size:15px;box-shadow:0 8px 20px -8px rgba(21,179,100,.6)">View booking →</a>
        </div>
        <p style="text-align:center;font-size:12px;color:#a7a3bd;margin:6px 0 0">Opens this exact booking in ActivityOS.</p>
      </div>

      <div style="background:#f7f9fd;padding:16px 24px;text-align:center;border-top:1px solid #eef0f5">
        <span style="font-size:11.5px;color:#8a86a3">You're receiving this because you're on ${escapeHtml(a.providerName)}'s team on ActivityOS.</span>
      </div>
    </div>
  </div>
  </div>`;
}

/** Notify a recipient (parent or operator) that they've got a new message. The
 * body is quoted inline and a button deep-links to the thread. Reply-by-email
 * ingest is not built yet (handoff §JJ), so we don't invite email replies. */
export function emailNewMessage(
  to: string,
  // emailOnly: the provider has switched in-app messaging off for families, so
  // this email IS the message — no "open it in the app" button, and replies go
  // to the provider's own contact address.
  opts: { providerName: string; senderName: string; body: string; deepLink: string; tenantId?: string; emailOnly?: boolean },
): void {
  sendAs(
    opts.tenantId,
    opts.providerName,
    to,
    `New message from ${opts.senderName}`,
    `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#171534">
    <div style="padding:18px 0 10px;border-bottom:2px solid #1d3a8f">
      <strong style="font-size:18px">${escapeHtml(opts.providerName)}</strong>
      <span style="color:#8a86a3;font-size:12px"> · via ActivityOS</span>
    </div>
    <h2 style="font-size:19px;margin:18px 0 6px">New message from ${escapeHtml(opts.senderName)}</h2>
    <blockquote style="border-left:3px solid #cdddf7;margin:12px 0;padding:6px 0 6px 14px;color:#4a4763;white-space:pre-wrap;font-size:14px">${escapeHtml(opts.body)}</blockquote>
    ${opts.emailOnly
      ? `<p style="font-size:13.5px;color:#4a4763">To answer, just reply to this email — it goes to ${escapeHtml(opts.providerName)}.</p>`
      : `<p><a href="${opts.deepLink}" style="display:inline-block;background:#1d3a8f;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Take me to the message</a></p>`}
    <p style="color:#8a86a3;font-size:11.5px;margin-top:22px">${opts.emailOnly ? `You're receiving this because you've booked with ${escapeHtml(opts.providerName)}.` : "You're receiving this because you have a conversation on ActivityOS."}</p>
  </div>`,
    // Reply-To stays free for §JJ's per-thread reply address — except when
    // this email is the only channel: then a reply reaches the provider.
    { replyTo: opts.emailOnly === true },
  );
}
