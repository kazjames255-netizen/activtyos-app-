// Shared Moments image compositor — bakes a caption/quote BANNER beneath a photo
// and returns a JPEG data URL. Used by the operator Moments download menu AND by
// the Email area, which re-renders images an operator saved from Moments. Keeping
// one implementation means a saved image downloads pixel-identical to the preview.

export type MomentRatio = "square" | "portrait" | "story";

export interface MomentQuote {
  text: string;
  byName?: string;
  marketing?: boolean;
}

export interface ComposeOpts {
  photoUrl: string;
  ratio: MomentRatio;
  /** Font + accent-bar colour applied to the caption and quotes. */
  color: string;
  /** Baked caption text (already resolved from the include toggle). */
  caption?: string;
  /** Baked quotes (starred and/or all parent comments). */
  quotes?: MomentQuote[];
  /** Small grey attribution line at the foot of the banner. */
  footer?: string;
  /**
   * How the photo fills the (non-square) frame:
   * - "cover"   → crop to fill (default; fine when the source is already square)
   * - "contain" → show the WHOLE photo, letterboxed over a blurred fill of itself
   */
  fit?: "cover" | "contain";
}

const IMG_H: Record<MomentRatio, number> = { square: 1080, portrait: 1350, story: 1920 };

/**
 * Draw the photo (cover-fit) with a white banner beneath carrying the caption,
 * quotes and footer. Returns a JPEG data URL, or `null` when the image can't be
 * loaded or the canvas is tainted (cross-origin) — callers fall back to the
 * plain photo. Browser-only (uses `document`/`Image`).
 */
export async function composeMomentImage(o: ComposeOpts): Promise<string | null> {
  const W = 1080;
  const imgH = IMG_H[o.ratio] ?? IMG_H.square;
  const cap = o.caption?.trim() ? o.caption : "";
  const quotes = o.quotes ?? [];
  const hasText = !!cap || quotes.length > 0;
  const pad = 64;
  const capF = "700 46px system-ui, sans-serif";
  const capLH = 58;
  const qF = "italic 500 38px system-ui, sans-serif";
  const qLH = 48;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("load"));
      img.src = o.photoUrl;
    });
    const mc = document.createElement("canvas").getContext("2d")!;
    const wrap = (text: string, font: string) => {
      mc.font = font;
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const t = cur ? `${cur} ${w}` : w;
        if (mc.measureText(t).width > W - pad * 2 && cur) { lines.push(cur); cur = w; } else cur = t;
      }
      if (cur) lines.push(cur);
      return lines;
    };
    const capLines = cap ? wrap(cap, capF) : [];
    const qBlocks = quotes.map((c) => ({ lines: wrap(`“${c.text}”`, qF), by: c.byName, marketing: c.marketing }));
    let bannerH = 0;
    if (hasText) {
      bannerH = 92;
      if (capLines.length) bannerH += capLines.length * capLH + 20;
      for (const qb of qBlocks) bannerH += qb.lines.length * qLH + 34 + 24;
      bannerH += 60 + 34;
    }
    const H = imgH + bannerH;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#0b1020"; ctx.fillRect(0, 0, W, imgH);
    const nw = img.naturalWidth, nh = img.naturalHeight;
    const cover = Math.max(W / nw, imgH / nh);
    if (o.fit === "contain") {
      // Blurred, darkened cover fill behind the whole photo — so a portrait/story
      // frame shows the entire image (no crop) without ugly flat bands.
      ctx.save();
      ctx.filter = "blur(28px)";
      const bw = nw * cover * 1.15, bh = nh * cover * 1.15; // over-scale so blur edges don't bleed white
      ctx.drawImage(img, (W - bw) / 2, (imgH - bh) / 2, bw, bh);
      ctx.restore();
      ctx.fillStyle = "rgba(8,12,26,0.42)"; ctx.fillRect(0, 0, W, imgH);
      const s = Math.min(W / nw, imgH / nh);
      const dw = nw * s, dh = nh * s;
      ctx.drawImage(img, (W - dw) / 2, (imgH - dh) / 2, dw, dh);
    } else {
      const dw = nw * cover, dh = nh * cover;
      ctx.drawImage(img, (W - dw) / 2, (imgH - dh) / 2, dw, dh);
    }
    if (hasText) {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, imgH, W, bannerH);
      ctx.fillStyle = o.color; ctx.globalAlpha = 0.85; ctx.fillRect(0, imgH, W, 8); ctx.globalAlpha = 1; // accent matches the text colour
      let y = imgH + 92;
      if (capLines.length) { ctx.fillStyle = o.color; ctx.font = capF; for (const ln of capLines) { ctx.fillText(ln, pad, y); y += capLH; } y += 20; }
      for (const qb of qBlocks) {
        ctx.fillStyle = o.color; ctx.globalAlpha = 0.85; ctx.font = qF;
        for (const ln of qb.lines) { ctx.fillText(ln, pad, y); y += qLH; }
        ctx.globalAlpha = 1; ctx.font = "700 28px system-ui, sans-serif"; ctx.fillStyle = qb.marketing ? "#9a5a00" : "#8a86a3";
        ctx.fillText(`— ${qb.by || "a parent"}${qb.marketing ? "  ★" : ""}`, pad, y + 2); y += 34 + 24;
      }
      if (o.footer) { ctx.font = "600 27px system-ui, sans-serif"; ctx.fillStyle = "#8a86a3"; ctx.fillText(o.footer, pad, imgH + bannerH - 40); }
    }
    return c.toDataURL("image/jpeg", 0.92);
  } catch {
    return null;
  }
}

/** The editable text carried on a saved image so the Email area can re-toggle
 *  caption/quotes just like the Moments download menu. Legacy fields (`caption`,
 *  `quotes`) are tolerated for images saved before this shape existed. */
export interface SavedTextSource {
  include?: { caption: boolean; quote: boolean; comments: boolean };
  sourceCaption?: string;
  customCaption?: string;
  sourceComments?: MomentQuote[];
  caption?: string;        // legacy baked caption
  quotes?: MomentQuote[];  // legacy baked quotes
}

/** Resolve which caption + quotes a saved image bakes in. A custom message wins
 *  over the moment's caption; otherwise the include toggles pick the moment's
 *  caption/quotes (falling back to any legacy baked fields). */
export function resolveSavedText(im: SavedTextSource): { caption?: string; quotes: MomentQuote[] } {
  const hasNew = im.include !== undefined || im.sourceComments !== undefined || im.sourceCaption !== undefined || im.customCaption !== undefined;
  if (!hasNew) return { caption: im.caption, quotes: im.quotes ?? [] };
  const inc = im.include ?? { caption: false, quote: false, comments: false };
  const parent = im.sourceComments ?? [];
  const chosen: MomentQuote[] = [];
  if (inc.quote) chosen.push(...parent.filter((c) => c.marketing));
  if (inc.comments) for (const c of parent) if (!chosen.includes(c)) chosen.push(c);
  const caption = im.customCaption !== undefined ? (im.customCaption || undefined) : (inc.caption ? im.sourceCaption : undefined);
  return { caption, quotes: chosen };
}

/** Kick off a browser download for a data/blob/URL href. */
export function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  if (href.startsWith("http")) a.target = "_blank";
  a.click();
}
