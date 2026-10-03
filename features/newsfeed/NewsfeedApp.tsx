"use client";

import { dateLocale as dl } from "@/lib/i18n/format";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { Button } from "@/components/ui";
import { useT, tNow } from "@/lib/i18n/provider";
import { RichB } from "@/features/common/richB";
import { SettingsLink } from "@/components/OperatorPage";
import { TourLauncher } from "@/features/common/TourLauncher";
import { StaffNotifyComposer } from "./StaffNotifyComposer";
import { useHoScope, HO_OWN } from "@/components/franchise/HoScope";
import { NewsletterBuilder, NewsletterView, PostImage, NL_PALETTES, downscaleImage, newMeta, newsletterToText, newsletterToHtml, type Newsletter, type NlMeta } from "./newsletter";

// ─────────────────────────────────────────────────────────────────────────
// Newsfeed (operator) — announcements to families, built from templates. Each
// template (announcement / event / reminder / urgent / celebration / booking)
// drives styling + which fields the post carries. See server/src/routes/posts.ts.
// ─────────────────────────────────────────────────────────────────────────

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;
const HERO = "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)";
const BLUE = "#1d3a8f";

type Tpl = "announce" | "event" | "reminder" | "urgent" | "celebrate" | "booking" | "newsletter";
type Status = "draft" | "published" | "scheduled" | "archived";
interface Cta { label: string; target?: string; listingId?: string; url?: string }
interface Rsvp { yes: number; no: number; maybe: number }
interface Post {
  id: string; tpl?: Tpl; title?: string; body: string; photoUrl?: string; imageAspect?: string; imageX?: number; imageY?: number; imageZoom?: number;
  priority?: "normal" | "urgent"; colour?: string; pinned?: boolean; ackRequired?: boolean; react?: boolean;
  status?: Status; audience?: "all" | "site" | "listing"; audId?: string; audIds?: string[]; audLabel?: string;
  date?: string; time?: string; location?: string; cta?: Cta | null; publishAt?: string;
  rsvp?: Rsvp | null; seen?: number; reactions?: number; newsletter?: Newsletter | null; folder?: string; ref?: string;
  postedByName?: string; createdAt?: string; editedAt?: string;
  // Head-office / franchise targeting (set by the server). franchiseId = TARGET
  // (null = the whole network); authorLabel = who sent it; targetName = the
  // franchise's name when a single franchise was targeted.
  franchiseId?: string | null; authorLabel?: string; authorScope?: "network" | "franchise" | "own"; targetName?: string | null;
}

const TPL: Record<Tpl, { label: string; color: string; hint: string }> = {
  announce: { label: "Announcement", color: "#2596df", hint: "General news for families" },
  event: { label: "Event", color: "#7c5cff", hint: "Date, time + RSVP" },
  reminder: { label: "Reminder", color: "#f59e0b", hint: "Short, actionable, pinned" },
  urgent: { label: "Urgent / closure", color: "#ef4444", hint: "High priority + acknowledge" },
  celebrate: { label: "Celebration", color: "#e22295", hint: "Wins & shout-outs" },
  booking: { label: "Booking nudge", color: "#15b364", hint: "Promote a listing" },
  newsletter: { label: "Newsletter", color: "#1d3a8f", hint: "A designed, multi-section update" },
};
const TPL_ORDER: Tpl[] = ["announce", "event", "reminder", "urgent", "celebrate", "booking"];
// Display label/hint for a template (the English TPL.label stays for the emailed HTML / PDF export).
type TFn = (k: string, v?: Record<string, string | number>) => string;
const tplLabel = (t: TFn, k: Tpl) => t("p8em.nfTpl_" + k);
const tplHint = (t: TFn, k: Tpl) => t("p8em.nfHint_" + k);
// Stored audience labels are English; show them translated.
const audShown = (t: TFn, label: string) => (label === "All families" ? t("p8em.nfAudAll") : label.startsWith("Listings: ") ? t("p8em.nfAudListings", { list: label.slice(10) }) : label);

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(dl(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

// Plain-text of a post — for the "email to parents" hand-off.
function postToText(d: Draft): string {
  const parts = [d.body.trim()];
  if (d.tpl === "event") { const e = [d.date, d.time, d.location].filter(Boolean).join(" · "); if (e) parts.push(e); }
  if (d.ctaKind !== "none" && d.ctaLabel) parts.push(`${d.ctaLabel}${d.ctaUrl ? `: ${d.ctaUrl}` : d.ctaTarget ? `: ${d.ctaTarget}` : ""}`);
  return parts.filter(Boolean).join("\n\n");
}
// Designed, email-safe HTML of a post — the "whole document" embedded in the email.
function postToHtml(d: Draft): string {
  const tpl = TPL[d.tpl];
  const accent = d.colour || tpl.color;
  const esc = (s?: string) => (s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
  const img = d.image ? `<img src="${d.image}" alt="" style="display:block;width:100%;max-width:600px" />` : `<div style="height:6px;background:${accent}"></div>`;
  const ev = d.tpl === "event" && (d.date || d.time || d.location) ? `<div style="margin-top:12px;background:${accent};color:#fff;border-radius:8px;padding:10px 14px;font-weight:700;font-size:14px">${esc([d.date, d.time, d.location].filter(Boolean).join(" · "))}</div>` : "";
  const cta = d.ctaKind !== "none" && d.ctaLabel ? `<div style="padding:0 24px 18px">${d.ctaUrl ? `<a href="${esc(d.ctaUrl)}" style="display:inline-block;text-decoration:none;` : `<span style="display:inline-block;`}background:${accent};color:#fff;font-weight:800;font-size:14px;padding:11px 22px;border-radius:8px">${esc(d.ctaLabel)}${d.ctaUrl ? "</a>" : "</span>"}</div>` : "";
  return `<div style="max-width:600px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#171534;border:1px solid #ece6f1;border-radius:12px;overflow:hidden">${img}<div style="padding:18px 24px 8px"><span style="display:inline-block;background:${accent};color:#fff;font-weight:800;font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:5px 12px;border-radius:999px">${esc(tpl.label)}</span>${d.title ? `<div style="font-size:23px;font-weight:800;line-height:1.15;margin-top:10px">${esc(d.title)}</div>` : ""}<div style="font-size:15px;line-height:1.6;margin-top:8px;white-space:pre-wrap">${esc(d.body)}</div>${ev}</div>${cta}</div>`;
}
// Open a printable window (browser "Save as PDF"), full A4 page, colours forced.
function printPost(d: Draft) {
  const w = typeof window !== "undefined" ? window.open("", "_blank", "width=820,height=1060") : null;
  if (!w) return;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
  const img = !d.image ? ""
    : d.imageAspect === "full" || !d.imageAspect
      ? `<div style="text-align:center;margin:16px 0"><img src="${d.image}" style="max-width:100%;max-height:520px;border-radius:12px" alt=""/></div>`
      : `<div style="position:relative;width:100%;aspect-ratio:${d.imageAspect.replace("/", " / ")};overflow:hidden;border-radius:12px;margin:16px 0;background:#0b1020"><img src="${d.image}" style="width:100%;height:100%;object-fit:cover;transform:translate(${d.imageX}%, ${d.imageY}%) scale(${d.imageZoom});transform-origin:center" alt=""/></div>`;
  const ev = d.tpl === "event" ? `<p style="font-weight:700;color:#1d3a8f;font-size:16px">${esc([d.date, d.time, d.location].filter(Boolean).join(" · "))}</p>` : "";
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.title || "Post")}</title><style>*{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:12mm}html,body{margin:0}body{font-family:system-ui,-apple-system,sans-serif;color:#171534;line-height:1.6}.wrap{width:100%;max-width:100%}h1{font-size:32px;margin:0 0 6px;line-height:1.14}</style></head><body><div class="wrap"><h1>${esc(d.title)}</h1>${ev}${img}<div style="white-space:pre-wrap;font-size:16px">${esc(d.body)}</div></div><script>window.onload=function(){window.focus();window.print();}</script></body></html>`);
  w.document.close();
}
// Download the WHOLE post as a PNG image (title + photo + text, designed). Renders
// the post's HTML into an SVG foreignObject → canvas. The photo is inlined as a
// data URL so the canvas isn't tainted; falls back to the print/PDF path on error.
async function downloadPostImage(d: Draft) {
  if (typeof document === "undefined") return;
  const name = (d.title || "post").replace(/[^a-z0-9]+/gi, "-").slice(0, 60) || "post";
  try {
    let imageForHtml = d.image;
    if (d.image) {
      const blob = await (await fetch(d.image)).blob();
      imageForHtml = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onerror = () => rej(new Error("read")); r.onload = () => res(r.result as string); r.readAsDataURL(blob); });
    }
    const html = postToHtml({ ...d, image: imageForHtml });
    const width = 600;
    const holder = document.createElement("div");
    holder.style.cssText = `position:fixed;left:-9999px;top:0;width:${width}px`;
    holder.innerHTML = html;
    document.body.appendChild(holder);
    const height = (holder.firstElementChild as HTMLElement | null)?.offsetHeight || holder.offsetHeight || 400;
    document.body.removeChild(holder);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="background:#ffffff">${html}</div></foreignObject></svg>`;
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("svg")); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
    const canvas = document.createElement("canvas"); canvas.width = width * 2; canvas.height = height * 2;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("ctx");
    ctx.scale(2, 2); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height); ctx.drawImage(img, 0, 0);
    await new Promise<void>((res) => canvas.toBlob((blob) => { if (blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name}.png`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href); } res(); }, "image/png"));
  } catch { printPost(d); } // couldn't rasterise (browser/CORS) — give the PDF instead
}

type CtaKind = "none" | "listing" | "url";
interface Draft {
  editId: string; tpl: Tpl; title: string; body: string; colour: string; image: string; imageAspect: string; imageX: number; imageY: number; imageZoom: number; folder: string; ref: string;
  audScope: "all" | "listing"; audIds: string[];
  frTarget: string; // HO only: "" = all franchises across the network, else a franchiseId
  date: string; time: string; location: string;
  pinned: boolean; priority: "normal" | "urgent"; ackRequired: boolean; react: boolean;
  ctaKind: CtaKind; ctaLabel: string; ctaTarget: string; ctaListingId: string; ctaUrl: string;
  when: "now" | "later" | "draft"; publishAt: string;
}
const draftFor = (tpl: Tpl, listings: { id: string; title: string }[]): Draft => ({
  editId: "", tpl, title: "", body: "", colour: "", image: "", imageAspect: "full", imageX: 0, imageY: 0, imageZoom: 1, folder: "", ref: "", audScope: "all", audIds: [], frTarget: "",
  date: "", time: "", location: "",
  pinned: tpl === "urgent" || tpl === "reminder",
  priority: tpl === "urgent" ? "urgent" : "normal",
  ackRequired: tpl === "urgent", react: true,
  ctaKind: tpl === "booking" ? "listing" : "none", ctaLabel: tpl === "booking" ? "Book now" : "", ctaTarget: tpl === "booking" ? (listings[0]?.title ?? "") : "", ctaListingId: tpl === "booking" ? (listings[0]?.id ?? "") : "", ctaUrl: "",
  when: "now", publishAt: "",
});

export function NewsfeedApp() {
  const t = useT();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [listings, setListings] = useState<{ id: string; title: string }[]>([]);
  const [coupons, setCoupons] = useState<{ code: string; desc: string }[]>([]);
  const { settings } = useSettings();
  // Seed a new newsletter's banner/footer with the provider's own details (name
  // auto-fills from onboarding; every field stays editable in the builder).
  const nlCompany = useMemo(() => ({ name: settings.providerName || settings.billing?.businessName || "", phone: settings.billing?.phone, email: settings.billing?.email, address: settings.billing?.address, logo: settings.billing?.logoUrl }), [settings]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [nlOpen, setNlOpen] = useState<{ initial?: Newsletter; editId?: string; meta?: NlMeta } | null>(null);
  const [filter, setFilter] = useState<"all" | Tpl | "draft" | "scheduled" | "archived">("all");
  const [folderFilter, setFolderFilter] = useState("");
  const [folderKind, setFolderKind] = useState<"all" | "post" | "newsletter">("all"); // sub-filter inside an open folder
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<{ label: string; run: () => void } | null>(null); // live-post countdown
  const [audience, setAudience] = useState<"parents" | "staff">("parents"); // Newsfeed = parents; Staff = internal notices
  const router = useRouter();
  const portal = usePathname()?.split("/")[1] || "freelancer";
  // Head-office targeting: a company that has franchises, viewing the combined
  // "all franchises" scope, can aim each post at the whole network or one
  // franchise. When drilled into a single franchise the target pre-selects it.
  const hoScope = useHoScope();
  const [franchises, setFranchises] = useState<{ franchiseId: string; name: string; area: string | null }[]>([]);
  useEffect(() => { if (portal === "company") apiGet<{ franchiseId: string; name: string; area: string | null }[]>("/api/franchises").then(setFranchises).catch(() => {}); }, [portal]);
  const isHo = portal === "company" && franchises.length > 0;
  const scopedFr = hoScope && hoScope !== HO_OWN ? hoScope : "";

  const refresh = useCallback(() => {
    apiGet<Post[]>("/api/posts").then((p) => { setPosts(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : tNow("p8em.cLoadFailed")));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ id: string; title?: string; name?: string }[]>("/api/listings?mine=1").then((l) => setListings(l.map((x) => ({ id: x.id, title: x.title || x.name || "Listing" })))).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ code: string; type: string; value: number; expiry?: string; active?: boolean }[]>("/api/discounts").then((cs) => setCoupons(cs.filter((c) => c.active !== false && c.code).map((c) => { const v = c.type === "percent" ? `${c.value}% off` : c.type === "perAttendee" ? `£${c.value} off per child` : `£${c.value} off`; return { code: c.code, desc: c.expiry ? `${v} — until ${c.expiry}` : v }; }))).catch(() => {}); }, []);
  useRealtime(["posts"], refresh);

  const all = useMemo(() => posts ?? [], [posts]);
  const live = useMemo(() => all.filter((p) => (p.status ?? "published") === "published"), [all]);
  const folders = useMemo(() => [...new Set(all.map((p) => p.folder).filter((f): f is string => !!f && f.trim() !== ""))].sort(), [all]);
  const live1 = (p: Post) => (p.status ?? "published") !== "archived" && p.status !== "draft";
  const shown = useMemo(() => {
    let list = filter === "all" ? all.filter(live1)
      : filter === "scheduled" ? all.filter((p) => p.status === "scheduled")
      : filter === "draft" ? all.filter((p) => p.status === "draft")
      : filter === "archived" ? all.filter((p) => p.status === "archived")
      : all.filter((p) => (p.tpl ?? "announce") === filter && live1(p));
    if (folderFilter) {
      list = list.filter((p) => (p.folder ?? "") === folderFilter);
      if (folderKind !== "all") list = list.filter((p) => (folderKind === "newsletter" ? p.tpl === "newsletter" : p.tpl !== "newsletter"));
    }
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((p) => `${p.ref ?? ""} ${p.title ?? ""} ${p.body ?? ""} ${p.folder ?? ""} ${p.audLabel ?? ""} ${p.newsletter?.company.name ?? ""}`.toLowerCase().includes(q));
    return list;
  }, [all, filter, folderFilter, folderKind, query]);
  const pinnedCount = live.filter((p) => p.pinned).length;
  const scheduledCount = all.filter((p) => p.status === "scheduled").length;

  // Live posts to families go through a 5-second cancellable countdown. Drafts,
  // schedules, PDF and email hand-off don't (nothing hits families yet).
  function publish(d: Draft, channel: "page" | "email" | "both" | "download") {
    if (channel === "page" && d.when === "now") {
      if (!d.title.trim() || !d.body.trim()) { setError(t("p8em.nfAddTitleMsg")); return; }
      setPending({ label: d.editId ? t("p8em.nfUpdatingPost") : t("p8em.nfPostingToFeed"), run: () => commitPublish(d, channel) });
      return;
    }
    commitPublish(d, channel);
  }
  async function commitPublish(d: Draft, channel: "page" | "email" | "both" | "download") {
    if (!d.title.trim() || !d.body.trim()) { setError(t("p8em.nfAddTitleMsg")); return; }
    if (channel === "download") { printPost(d); return; }
    const chosen = d.audScope === "listing" ? listings.filter((l) => d.audIds.includes(l.id)) : [];
    const audLabel = d.audScope === "all" ? "All families" : `Listings: ${chosen.map((l) => l.title).join(", ") || "—"}`;
    const scheduled = d.when === "later" && !!d.publishAt;
    const cta: Cta | null = d.ctaKind === "listing" && d.ctaTarget ? { label: d.ctaLabel.trim() || "Book now", target: d.ctaTarget, listingId: d.ctaListingId || undefined }
      : d.ctaKind === "url" && d.ctaUrl.trim() ? { label: d.ctaLabel.trim() || "Open link", url: d.ctaUrl.trim() }
      : null;
    // Email only → filed as a draft; posting to the page (or both) follows the When choice.
    const status: Status = channel === "email" ? "draft" : d.when === "draft" ? "draft" : scheduled ? "scheduled" : "published";
    const payload: Partial<Post> = {
      tpl: d.tpl, title: d.title.trim(), body: d.body.trim(), colour: d.colour || undefined, photoUrl: d.image || undefined, imageAspect: d.image ? d.imageAspect : undefined, imageX: d.image ? d.imageX : undefined, imageY: d.image ? d.imageY : undefined, imageZoom: d.image ? d.imageZoom : undefined,
      priority: d.priority, pinned: d.pinned, ackRequired: d.ackRequired, react: d.react,
      status,
      audience: d.audScope, audIds: d.audScope === "listing" ? d.audIds : undefined, audLabel,
      ...(isHo ? { franchiseId: d.frTarget || null } : {}),
      folder: d.folder.trim() || undefined,
      ref: d.ref.trim() || undefined,
      ...(d.tpl === "event" ? { date: d.date, time: d.time, location: d.location } : {}),
      cta,
      ...(scheduled ? { publishAt: d.publishAt } : {}),
    };
    try {
      if (d.editId) await api(`/api/posts/${encodeURIComponent(d.editId)}`, { method: "PUT", body: JSON.stringify(payload) });
      else await apiPost("/api/posts", payload);
      if (channel === "email" || channel === "both") {
        try { localStorage.setItem("aos.email.draft.v1", JSON.stringify({ subject: d.title.trim(), body: postToText(d), html: postToHtml(d) })); } catch { /* private mode */ }
        setDraft(null); router.push(`/${portal}/email`); return;
      }
      setDraft(null); setError(null); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : t("p8em.nfCouldntPost")); }
  }
  const patch = async (id: string, f: Partial<Post>) => {
    setPosts((ps) => (ps ?? []).map((p) => (p.id === id ? { ...p, ...f } : p)));
    try { await api(`/api/posts/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(f) }); } catch (e) { setError(e instanceof Error ? e.message : t("p8em.nfCouldntSave")); refresh(); }
  };
  // Delete a folder = un-file everything in it (posts are NOT deleted, just moved
  // to Unfiled). Confirmed first because it touches several posts at once.
  const deleteFolder = (f: string) => {
    const inside = all.filter((p) => (p.folder ?? "") === f);
    if (!confirm(t("p8em.nfDeleteFolderConfirm", { folder: f, n: inside.length }))) return;
    inside.forEach((p) => patch(p.id, { folder: "" }));
    if (folderFilter === f) setFolderFilter("");
  };
  async function remove(p: Post) {
    if (!confirm(t("p8em.nfDeletePostConfirm"))) return;
    try { await api(`/api/posts/${encodeURIComponent(p.id)}`, { method: "DELETE" }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : t("p8em.nfFailed")); }
  }
  function saveNewsletter(nl: Newsletter, meta: NlMeta, channel: "page" | "email" | "both", editId?: string) {
    if (channel === "page" && meta.when === "now") {
      setPending({ label: editId ? t("p8em.nfUpdatingNl") : t("p8em.nfPostingToFeed"), run: () => commitNewsletter(nl, meta, channel, editId) });
      return;
    }
    commitNewsletter(nl, meta, channel, editId);
  }
  async function commitNewsletter(nl: Newsletter, meta: NlMeta, channel: "page" | "email" | "both", editId?: string) {
    const name = nl.company.name || "us";
    const firstHeading = nl.blocks.find((b) => b.heading)?.heading;
    const title = (meta.name.trim() || firstHeading || nl.company.name || "Newsletter").replace(/\{company\}/g, name).slice(0, 120);
    const body = (nl.blocks.map((b) => [b.heading, b.body, b.left, b.right, b.codeDesc].filter(Boolean).join(" ")).filter(Boolean).join("\n").replace(/\{company\}/g, name).slice(0, 900)) || title;
    const scheduled = meta.when === "later" && !!meta.publishAt;
    // Email-only → filed as a draft (not live); posting to the page (or both)
    // follows the When choice.
    const status: Status = channel === "email" ? "draft" : meta.when === "draft" ? "draft" : scheduled ? "scheduled" : "published";
    const chosen = meta.audScope === "listing" ? listings.filter((l) => meta.audIds.includes(l.id)) : [];
    const audLabel = meta.audScope === "all" ? "All families" : `Listings: ${chosen.map((l) => l.title).join(", ") || "—"}`;
    const payload: Partial<Post> = {
      tpl: "newsletter", title, body, newsletter: nl,
      status,
      audience: meta.audScope, audIds: meta.audScope === "listing" ? meta.audIds : undefined, audLabel,
      ...(isHo ? { franchiseId: scopedFr || null } : {}),
      pinned: meta.pinned, ackRequired: meta.ackRequired, react: meta.react, priority: meta.priority,
      folder: meta.folder.trim() || undefined,
      ...(scheduled ? { publishAt: meta.publishAt } : {}),
    };
    try {
      if (editId) await api(`/api/posts/${encodeURIComponent(editId)}`, { method: "PUT", body: JSON.stringify(payload) });
      else await apiPost("/api/posts", payload);
      if (channel === "email" || channel === "both") {
        try { localStorage.setItem("aos.email.draft.v1", JSON.stringify({ subject: title, body: newsletterToText(nl), html: newsletterToHtml(nl), newsletter: nl })); } catch { /* private mode */ }
        setNlOpen(null); router.push(`/${portal}/email`); return;
      }
      setNlOpen(null); setError(null); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : t("p8em.nfCouldntSaveNl")); }
  }
  const metaFromPost = (p: Post): NlMeta => ({ ...newMeta(), name: p.title ?? "", folder: p.folder ?? "", audScope: p.audience === "listing" ? "listing" : "all", audIds: p.audIds ?? (p.audId ? [p.audId] : []), pinned: !!p.pinned, ackRequired: !!p.ackRequired, react: p.react !== false, priority: p.priority ?? "normal" });
  const draftFromPost = (p: Post): Draft => ({
    editId: p.id, tpl: p.tpl ?? "announce", title: p.title ?? "", body: p.body, colour: p.colour ?? "", image: p.photoUrl ?? "", imageAspect: p.imageAspect ?? "full", imageX: p.imageX ?? 0, imageY: p.imageY ?? 0, imageZoom: p.imageZoom ?? 1, folder: p.folder ?? "", ref: p.ref ?? "",
    audScope: p.audience === "listing" ? "listing" : "all", audIds: p.audIds ?? (p.audId ? [p.audId] : []),
    frTarget: p.franchiseId ?? "",
    date: p.date ?? "", time: p.time ?? "", location: p.location ?? "",
    pinned: !!p.pinned, priority: p.priority ?? "normal", ackRequired: !!p.ackRequired, react: p.react !== false,
    ctaKind: p.cta?.url ? "url" : p.cta?.target ? "listing" : "none", ctaLabel: p.cta?.label ?? "", ctaTarget: p.cta?.target ?? "", ctaListingId: p.cta?.listingId ?? "", ctaUrl: p.cta?.url ?? "", when: "now", publishAt: "",
  });
  const editPost = (p: Post) => setDraft(draftFromPost(p));
  // Duplicate a saved post/newsletter → immediately create a fresh copy filed as
  // a DRAFT (never re-blasts families), then jump to the Drafts view so it's
  // visible to edit/publish. The original is untouched.
  const duplicate = async (p: Post) => {
    const payload: Partial<Post> = {
      tpl: p.tpl ?? "announce",
      title: `${(p.title ?? (p.tpl === "newsletter" ? "Newsletter" : "Post"))} (copy)`.trim(),
      body: p.body,
      colour: p.colour, photoUrl: p.photoUrl, imageAspect: p.imageAspect, imageX: p.imageX, imageY: p.imageY, imageZoom: p.imageZoom,
      priority: p.priority, pinned: false, ackRequired: p.ackRequired, react: p.react,
      status: "draft",
      audience: p.audience, audId: p.audId, audIds: p.audIds, audLabel: p.audLabel,
      folder: p.folder, ref: p.ref ? `${p.ref} (copy)` : undefined,
      ...(p.tpl === "event" ? { date: p.date, time: p.time, location: p.location } : {}),
      cta: p.cta ?? null,
      ...(p.tpl === "newsletter" && p.newsletter ? { newsletter: p.newsletter } : {}),
    };
    try { await apiPost("/api/posts", payload); setFilter("draft"); setFolderFilter(""); setError(null); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : t("p8em.tplDupFailed")); }
  };

  if (!posts) return <div className="-m-3 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}><div className="py-16 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8em.nfLoading")}</div></div>;

  const kpis: [string, number][] = [[t("p8em.nfPublished"), live.length], [t("p8em.cPinned"), pinnedCount], [t("p8em.nfScheduled"), scheduledCount]];

  // Parents (this newsfeed) vs Staff (internal notices → their Announcements board).
  const audienceSwitch = (
    <div className="mb-3.5 inline-flex rounded-full border border-[#E4E9F5] bg-[var(--surface)] p-1 shadow-sm">
      {([["parents", t("p8em.nfToParents")], ["staff", t("p8em.nfToStaff")]] as const).map(([a, label]) => (
        <button key={a} type="button" onClick={() => setAudience(a)} className={"rounded-full px-4 py-1.5 text-[12.5px] font-extrabold transition-colors " + (audience === a ? "bg-[#1d3a8f] text-white" : "text-[var(--ink-3)] hover:text-[var(--ink)]")}>{label}</button>
      ))}
    </div>
  );

  if (audience === "staff") {
    return (
      <div className="-m-3 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-3 sm:-m-5 sm:p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
        <div className="op-hero relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), ${HERO}`, backgroundSize: "18px 18px, cover, cover, cover, cover", backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat" }}>
          <div className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("p8em.nfNotifications")}</div>
          <p className="mt-1 max-w-[640px] text-[12.5px] text-white/85">{t("p8em.nfNotifSub")}</p>
        </div>
        {audienceSwitch}
        <StaffNotifyComposer listings={listings} authorName={settings.providerName || settings.billing?.businessName} />
      </div>
    );
  }

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-3 sm:-m-5 sm:p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c02636]">{error}</div>}

      {/* Hero */}
      <div className="op-hero relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), ${HERO}`, backgroundSize: "18px 18px, cover, cover, cover, cover", backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("p8em.nfTitle")}</div>
          <div className="flex flex-none flex-wrap items-center gap-2"><TourLauncher view="newsfeed" compact /><SettingsLink /></div>
        </div>
        <p className="mt-1 max-w-[640px] text-[12.5px] text-white/85">{t("p8em.nfHeroSub")}</p>
        <div className="mt-3.5 flex flex-wrap gap-2.5">
          {kpis.map(([label, n]) => (
            <div key={label} className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>{n}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{label}</div></div>
          ))}
        </div>
      </div>

      {audienceSwitch}

      {canManage && (
        <div className="mb-4 rounded-2xl border border-[#dbe6fb] bg-[var(--surface)] p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.nfPickType")}</div>
            <button type="button" onClick={() => setNlOpen({})} className="rounded-lg bg-[#1d3a8f] px-3 py-1.5 text-[12px] font-extrabold text-white shadow-sm transition hover:-translate-y-px">{t("p8em.nfDesignNl")}</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {TPL_ORDER.map((k) => (
              <button key={k} type="button" onClick={() => setDraft({ ...draftFor(k, listings), frTarget: scopedFr })} className="flex flex-col items-start gap-0.5 rounded-xl border p-2.5 text-start transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: `${TPL[k].color}44`, background: `${TPL[k].color}0c` }}>
                <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: TPL[k].color, color: "#fff" }}>{tplLabel(t, k)}</span>
                <span className="text-[10.5px] text-[var(--ink-3)]">{tplHint(t, k)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters + quick search */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {([["all", t("p8em.cAll")], ...TPL_ORDER.map((k) => [k, tplLabel(t, k)] as const), ["newsletter", t("p8em.nfTpl_newsletter")], ["draft", t("p8em.nfDrafts")], ["scheduled", t("p8em.nfScheduled")], ["archived", t("p8em.nfArchived")]] as [typeof filter, string][]).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className="rounded-full border px-3 py-1 text-[11.5px] font-bold" style={filter === k ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>
        ))}
        <div className="relative ms-auto">
          <span className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--ink-3)]">🔍</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("p8em.nfSearchPh")} className="w-[190px] rounded-full border border-[var(--line)] bg-[var(--surface)] py-1 ps-7 pe-7 text-[12px] text-[var(--ink)] outline-none focus:border-[color:var(--brand,#1d3a8f)]" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label={t("p8em.nfClearSearch")} className="absolute end-2 top-1/2 -translate-y-1/2 text-[13px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)]">×</button>}
        </div>
      </div>
      {folders.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.nfFolders")}</span>
          <button type="button" onClick={() => { setFolderFilter(""); setFolderKind("all"); }} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={!folderFilter ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{t("p8em.cAll")}</button>
          {folders.map((f) => (
            <span key={f} className="inline-flex items-center overflow-hidden rounded-full border" style={folderFilter === f ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
              <button type="button" onClick={() => { setFolderFilter(folderFilter === f ? "" : f); setFolderKind("all"); }} className="py-1 ps-2.5 pe-1.5 text-[11.5px] font-bold">📁 {f}</button>
              {canManage && <button type="button" onClick={() => deleteFolder(f)} title={t("p8em.nfDeleteFolderTitle", { folder: f })} aria-label={t("p8em.nfDeleteFolderTitle", { folder: f })} className="py-1 ps-1 pe-2 text-[11px] text-[var(--ink-3)] hover:text-[#c02636]">×</button>}
            </span>
          ))}
        </div>
      )}
      {folderFilter && (
        <div className="mb-3 -mt-1 flex flex-wrap items-center gap-1.5 ps-1">
          <span className="text-[11px] font-bold text-[var(--ink-3)]">{t("p8em.nfInFolder", { folder: folderFilter })}</span>
          {([["all", t("p8em.cAll")], ["post", t("p8em.nfPosts")], ["newsletter", t("p8em.nfNewsletters")]] as const).map(([k, label]) => <button key={k} type="button" onClick={() => setFolderKind(k)} className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold" style={folderKind === k ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>)}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-14 text-center text-[13px] text-[var(--ink-3)]">{query.trim() ? t("p8em.nfNoMatch", { q: query.trim() }) : canManage ? t("p8em.nfEmptyManage") : t("p8em.nfEmptyParent")}</div>
      ) : (
        <div className="grid items-start gap-3 md:grid-cols-2">
          {shown.map((p) => <PostCard key={p.id} p={p} canManage={canManage} folders={folders} onMove={(f) => patch(p.id, { folder: f || undefined })} onEdit={() => (p.tpl === "newsletter" && p.newsletter ? setNlOpen({ initial: p.newsletter, editId: p.id, meta: metaFromPost(p) }) : editPost(p))} onDuplicate={() => duplicate(p)} onPin={() => patch(p.id, { pinned: !p.pinned })} onArchive={() => patch(p.id, { status: p.status === "archived" ? "published" : "archived" })} onDelete={() => remove(p)} />)}
        </div>
      )}

      {draft && <Composer draft={draft} setDraft={setDraft} listings={listings} folders={folders} franchises={isHo ? franchises : []} onClose={() => setDraft(null)} onPublish={publish} />}
      {nlOpen && <NewsletterBuilder initial={nlOpen.initial} initialCompany={nlCompany} initialMeta={nlOpen.meta} brandColor={settings.brandColor} listings={listings} coupons={coupons} folders={folders} onCancel={() => setNlOpen(null)} onSave={(nl, meta, channel) => saveNewsletter(nl, meta, channel, nlOpen.editId)} />}
      {pending && <PostCountdown label={pending.label} onSend={() => { const run = pending.run; setPending(null); run(); }} onCancel={() => setPending(null)} />}
    </div>
  );
}

// A big, unmissable 5-second countdown before anything goes live to families.
// Tap Cancel any time in those 5 seconds and nothing is sent.
function PostCountdown({ label, onSend, onCancel }: { label: string; onSend: () => void; onCancel: () => void }) {
  const t = useT();
  const [left, setLeft] = useState(5);
  useEffect(() => {
    const iv = setInterval(() => setLeft((n) => (n <= 1 ? 0 : n - 1)), 1000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => { if (left === 0) onSend(); }, [left, onSend]);
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0b1020]/80 p-6 text-center backdrop-blur-sm" style={LIGHT_PALETTE}>
      <style>{`@keyframes cd-ring{from{stroke-dashoffset:0}to{stroke-dashoffset:339}}@keyframes cd-pop{0%{transform:scale(.8);opacity:0}100%{transform:scale(1);opacity:1}}`}</style>
      <div className="text-[15px] font-bold uppercase tracking-[0.18em] text-white/80">{label}</div>
      <div className="relative my-6 h-[220px] w-[220px]" style={{ animation: "cd-pop .3s ease both" }}>
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="8" />
          <circle cx="60" cy="60" r="54" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeDasharray="339" style={{ animation: "cd-ring 5s linear forwards" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[110px] font-black leading-none text-white" style={{ fontVariantNumeric: "tabular-nums" }}>{left}</span>
        </div>
      </div>
      <div className="text-[14px] text-white/85"><RichB text={t("p8em.nfGoingIn", { n: left })} /></div>
      <button type="button" onClick={onCancel} className="mt-6 rounded-full bg-[var(--surface)] px-10 py-4 text-[18px] font-black text-[#2f5fd0] shadow-xl transition hover:scale-105 active:scale-95">{t("p8em.nfCancelCountdown")}</button>
      <div className="mt-3 text-[12px] text-white/60">{t("p8em.nfCancelHint")}</div>
    </div>
  );
}

function PostCard({ p, canManage, folders = [], onMove, onEdit, onDuplicate, onPin, onArchive, onDelete }: { p: Post; canManage: boolean; folders?: string[]; onMove?: (f: string) => void; onEdit: () => void; onDuplicate: () => void; onPin: () => void; onArchive: () => void; onDelete: () => void }) {
  const t = useT();
  const tpl = TPL[p.tpl ?? "announce"];
  const tplName = tplLabel(t, p.tpl ?? "announce");
  // One clear line saying who this was shared to and when (or its pre-share state).
  const audience = p.audLabel ? audShown(t, p.audLabel) : (p.audience === "listing" ? t("p8em.nfAudChosen") : t("p8em.nfAudAll"));
  const sharedLine = p.status === "draft"
    ? <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-[10px] font-extrabold text-[#92600a]">{t("p8em.nfDraftNotShared")}</span>
    : p.status === "scheduled"
    ? <span className="rounded-full bg-[#efeaff] px-2 py-0.5 text-[10px] font-extrabold text-[#5b3fd8]">{t("p8em.nfWillShare", { aud: audience, when: p.publishAt || t("p8em.nfLater") })}</span>
    : p.status === "archived"
    ? <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-3)]">{t("p8em.nfWasShared", { aud: audience, when: when(p.createdAt) })}</span>
    : <span className="rounded-full bg-[#e7f6ee] px-2 py-0.5 text-[10px] font-extrabold text-[#0f8a4a]">{t("p8em.nfShared", { aud: audience, when: when(p.createdAt) })}</span>;
  // Who sent it + where it landed across the network (HO / franchise posts only).
  const frBadge = (p.authorScope === "network" || p.authorScope === "franchise") ? (
    <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[10px] font-extrabold text-[#3730a3]">
      📣 {p.authorLabel || t("p8em.nfHeadOffice")}
      {p.authorScope === "network" ? ` → ${t("p8em.snAllNetwork")}` : p.targetName ? ` → ${p.targetName}` : ""}
    </span>
  ) : null;
  const manageBar = canManage && (
    <span className="ms-auto flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={onPin} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{p.pinned ? t("p8em.nfUnpin") : t("p8em.nfPin")}</button>
      <button type="button" onClick={onEdit} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8em.cEdit")}</button>
      <button type="button" onClick={onDuplicate} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8em.cDuplicate")}</button>
      <button type="button" onClick={onArchive} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{p.status === "archived" ? t("p8em.nfRestore") : t("p8em.nfArchive")}</button>
      <button type="button" onClick={onDelete} className="rounded-md border border-[#f6c9cc] px-2 py-0.5 text-[10.5px] font-bold text-[#c02636] hover:bg-[#fdebec]">{t("p8em.cDelete")}</button>
    </span>
  );
  if (p.tpl === "newsletter" && p.newsletter) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5 px-3.5 pt-3">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: `${tpl.color}18`, color: tpl.color }}>{t("p8em.nfTpl_newsletter")}</span>
          {p.folder && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-2)]">📁 {p.folder}</span>}
          {p.pinned && <span className="rounded-full bg-[#fff4d6] px-2 py-0.5 text-[10px] font-extrabold text-[#8a6d1a]">{t("p8em.cPinned")}</span>}
          {frBadge}
          {sharedLine}
        </div>
        {p.title && <div className="px-3.5 pt-2 text-[15px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>🔖 {p.title}</div>}
        <div className="p-3.5 pt-2"><NewsletterView data={p.newsletter} /></div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line)] px-3.5 py-2 text-[11px] text-[var(--ink-3)]">
          <span>{p.postedByName} · {when(p.createdAt)}{p.editedAt ? t("p8em.nfEdited") : ""}</span>
          {p.ref && <span className="rounded bg-[var(--panel)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--ink-2)]">🔖 {p.ref}</span>}
          <span>{t("p8em.nfSeen", { n: p.seen ?? 0 })} · ♥ {p.reactions ?? 0}</span>
          {canManage && onMove && (
            <label className="flex items-center gap-1">📁
              <select value={p.folder ?? ""} onChange={(e) => onMove(e.target.value)} className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] outline-none">
                <option value="">{t("p8em.nfUnfiled")}</option>
                {folders.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
          )}
          {manageBar}
        </div>
      </div>
    );
  }
  const accent = p.colour || tpl.color;
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm transition hover:shadow-md">
      {p.photoUrl
        ? <PostImage url={p.photoUrl} aspect={p.imageAspect} x={p.imageX} y={p.imageY} zoom={p.imageZoom} rounded={false} />
        : <div className="h-1.5 w-full" style={{ background: accent }} />}
      <div className="p-4">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-wide text-white" style={{ background: accent }}>{tplName}</span>
          {p.pinned && <span className="rounded-full bg-[#fff4d6] px-2 py-0.5 text-[10.5px] font-extrabold text-[#8a6d1a]">{t("p8em.cPinned")}</span>}
          {p.priority === "urgent" && <span className="rounded-full bg-[#fde2e4] px-2 py-0.5 text-[10.5px] font-extrabold text-[#c02636]">{t("p8em.cUrgent")}</span>}
          {p.ackRequired && <span className="rounded-full bg-[#eef4fd] px-2 py-0.5 text-[10.5px] font-extrabold text-[#1d3a8f]">{t("p8em.nfAck")}</span>}
          {frBadge}
          <span className="ms-auto">{sharedLine}</span>
        </div>
        {p.title && <div className="text-[19px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{p.title}</div>}
        <div className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--ink-2)]">{p.body}</div>

        {p.tpl === "event" && (p.date || p.time || p.location) && (
          <div className="mt-2.5 inline-flex flex-wrap items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-bold text-white" style={{ background: accent }}>{[p.date, p.time, p.location].filter(Boolean).join(" · ")}</div>
        )}
        {p.cta && <div className="mt-2.5"><span className="inline-flex rounded-lg px-3.5 py-2 text-[12.5px] font-extrabold text-white shadow-sm" style={{ background: accent }}>{p.cta.label} →</span></div>}

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-2.5 text-[11px] text-[var(--ink-3)]">
          <span>{p.postedByName} · {when(p.createdAt)}{p.editedAt ? t("p8em.nfEdited") : ""}</span>
          {p.ref && <span className="rounded bg-[var(--panel)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--ink-2)]">🔖 {p.ref}</span>}
          <span className="flex items-center gap-2.5">
            <span title={t("p8em.nfSeenTitle")}>{t("p8em.nfSeen", { n: p.seen ?? 0 })}</span>
            {p.react !== false && <span title={t("p8em.nfReactions")}>♥ {p.reactions ?? 0}</span>}
            {p.rsvp && <span title={t("p8em.nfRsvps")}>{t("p8em.nfRsvpLine", { yes: p.rsvp.yes, maybe: p.rsvp.maybe, no: p.rsvp.no })}</span>}
          </span>
          {canManage && (
            <span className="ms-auto flex flex-wrap items-center gap-1.5">
              {onMove && <label className="flex items-center gap-1">📁<select value={p.folder ?? ""} onChange={(e) => onMove(e.target.value)} className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] outline-none"><option value="">{t("p8em.nfUnfiled")}</option>{folders.map((f) => <option key={f} value={f}>{f}</option>)}</select></label>}
              <button type="button" onClick={onPin} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{p.pinned ? t("p8em.nfUnpin") : t("p8em.nfPin")}</button>
              <button type="button" onClick={onEdit} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8em.cEdit")}</button>
              <button type="button" onClick={onDuplicate} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8em.cDuplicate")}</button>
              <button type="button" onClick={onArchive} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{p.status === "archived" ? t("p8em.nfRestore") : t("p8em.nfArchive")}</button>
              <button type="button" onClick={onDelete} className="rounded-md border border-[#f6c9cc] px-2 py-0.5 text-[10.5px] font-bold text-[#c02636] hover:bg-[#fdebec]">{t("p8em.cDelete")}</button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Live preview of the post exactly as a family sees it.
function PostPreview({ d }: { d: Draft }) {
  const t = useT();
  const tpl = TPL[d.tpl];
  const accent = d.colour || tpl.color;
  const tag = <span className="rounded-full px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-wide text-white" style={{ background: accent }}>{tplLabel(t, d.tpl)}</span>;
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      {d.image
        ? <PostImage url={d.image} aspect={d.imageAspect} x={d.imageX} y={d.imageY} zoom={d.imageZoom} rounded={false} />
        : <div className="h-1.5 w-full" style={{ background: accent }} />}
      <div className="p-4">
        <div className="mb-1.5">{tag}</div>
        {d.title && <div className="text-[19px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{d.title}</div>}
        <div className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--ink-2)]">{d.body || t("p8em.nfYourMessage")}</div>
        {d.tpl === "event" && (d.date || d.time || d.location) && <div className="mt-2.5 inline-flex flex-wrap items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-bold text-white" style={{ background: accent }}>{[d.date, d.time, d.location].filter(Boolean).join(" · ")}</div>}
        {d.ctaKind !== "none" && d.ctaLabel && <div className="mt-2.5"><span className="inline-flex rounded-lg px-3.5 py-2 text-[12.5px] font-extrabold text-white shadow-sm" style={{ background: accent }}>{d.ctaLabel} →</span></div>}
        <div className="mt-2.5"><span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-2)]">{t("p8em.nfMsgUs")}</span></div>
      </div>
    </div>
  );
}

function Composer({ draft, setDraft, listings, folders = [], franchises = [], onClose, onPublish }: { draft: Draft; setDraft: (d: Draft) => void; listings: { id: string; title: string }[]; folders?: string[]; franchises?: { franchiseId: string; name: string; area: string | null }[]; onClose: () => void; onPublish: (d: Draft, channel: "page" | "email" | "both" | "download") => void }) {
  const t = useT();
  const tpl = TPL[draft.tpl];
  const set = (f: Partial<Draft>) => setDraft({ ...draft, ...f });
  const inputCls = "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[12.5px] outline-none focus:border-[#1d3a8f]";
  const field = (name: string, node: ReactNode) => <div><div className="mb-0.5 text-[11px] font-bold text-[var(--ink-3)]">{name}</div>{node}</div>;
  const [imgBusy, setImgBusy] = useState(false);
  const [imgErr, setImgErr] = useState("");
  async function uploadImage(file: File) {
    setImgBusy(true); setImgErr("");
    try {
      const dataUrl = await downscaleImage(file);
      const { url } = await apiPost<{ url: string }>("/api/uploads", { dataUrl });
      set({ image: url, imageAspect: "full", imageX: 0, imageY: 0, imageZoom: 1 });
    } catch (e) { setImgErr(e instanceof Error ? e.message : t("p8em.nfUploadFail")); }
    finally { setImgBusy(false); }
  }
  const setAspect = (a: string) => set({ imageAspect: a, imageX: 0, imageY: 0, imageZoom: a === "full" ? 1 : 1.2 });
  const toggleListing = (id: string) => set({ audIds: draft.audIds.includes(id) ? draft.audIds.filter((x) => x !== id) : [...draft.audIds, id] });
  // Drag the image to reposition (translate x/y in % of frame), clamped so no
  // gap shows at the current zoom.
  const maxShift = (zoom: number) => ((zoom - 1) / 2) * 100;
  const clampS = (v: number, zoom: number) => { const m = maxShift(zoom); return Math.max(-m, Math.min(m, v)); };
  const setZoom = (z: number) => set({ imageZoom: z, imageX: clampS(draft.imageX, z), imageY: clampS(draft.imageY, z) });
  const drag = useRef<{ sx: number; sy: number; x: number; y: number; w: number; h: number } | null>(null);
  const onImgDown = (e: React.PointerEvent<HTMLDivElement>) => { drag.current = { sx: e.clientX, sy: e.clientY, x: draft.imageX, y: draft.imageY, w: e.currentTarget.clientWidth || 1, h: e.currentTarget.clientHeight || 1 }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onImgMove = (e: React.PointerEvent<HTMLDivElement>) => { const d = drag.current; if (!d) return; const nx = clampS(d.x + ((e.clientX - d.sx) / d.w) * 100, draft.imageZoom); const ny = clampS(d.y + ((e.clientY - d.sy) / d.h) * 100, draft.imageZoom); set({ imageX: nx, imageY: ny }); };
  const onImgUp = () => { drag.current = null; };

  // AI "help me write" — the operator gives the gist + specifics, picks a length,
  // and the model drafts the title + message (server: POST /api/ai/compose).
  const [aiNotes, setAiNotes] = useState("");
  const [aiCost, setAiCost] = useState("");
  const [aiLen, setAiLen] = useState<"short" | "medium" | "long">("medium");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState("");
  const aiPrompt: Partial<Record<Tpl, string>> = {
    announce: t("p8em.nfAiHint_announce"),
    event: t("p8em.nfAiHint_event"),
    reminder: t("p8em.nfAiHint_reminder"),
    urgent: t("p8em.nfAiHint_urgent"),
    celebrate: t("p8em.nfAiHint_celebrate"),
    booking: t("p8em.nfAiHint_booking"),
  };
  async function generate() {
    if (!aiNotes.trim()) { setAiErr(t("p8em.nfAiNeedNotes")); return; }
    setAiBusy(true); setAiErr("");
    const fields: Record<string, string> = {};
    if (draft.tpl === "event") { if (draft.date) fields.date = draft.date; if (draft.time) fields.time = draft.time; if (draft.location) fields.location = draft.location; }
    if (aiCost.trim()) fields.cost = aiCost.trim();
    if (draft.ctaKind === "listing" && draft.ctaTarget) fields.listing = draft.ctaTarget;
    try {
      const r = await apiPost<{ title: string; body: string }>("/api/ai/compose", { kind: draft.tpl, notes: aiNotes.trim(), fields, length: aiLen });
      set({ title: r.title || draft.title, body: r.body || draft.body });
    } catch (e) { setAiErr(e instanceof Error ? e.message : t("p8em.nfAiFail")); }
    finally { setAiBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[5vh]" onClick={onClose}>
      <div className="w-full max-w-[560px] overflow-hidden rounded-3xl bg-[var(--surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 text-white" style={{ background: `linear-gradient(120deg, ${tpl.color}, ${tpl.color}bb)` }}>
          <div className="text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t(draft.editId ? "p8em.nfEditHdr" : "p8em.nfNewHdr", { label: tplLabel(t, draft.tpl) })}</div>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[15px] font-bold">×</button>
        </div>
        <div className="max-h-[72vh] space-y-2.5 overflow-y-auto p-4">
          <div className="flex flex-wrap gap-1.5">
            {TPL_ORDER.map((k) => <button key={k} type="button" onClick={() => set({ tpl: k })} className="rounded-full border px-2.5 py-1 text-[11px] font-bold" style={draft.tpl === k ? { borderColor: TPL[k].color, background: `${TPL[k].color}18`, color: TPL[k].color } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{tplLabel(t, k)}</button>)}
          </div>

          {/* AI assist */}
          <div className="rounded-xl border border-[#dbe6fb] bg-[#f4f8ff] p-2.5">
            <div className="mb-1 text-[11.5px] font-extrabold text-[#1d3a8f]">{t("p8em.nfHelpWrite")}</div>
            <textarea value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} rows={2} placeholder={aiPrompt[draft.tpl]} className={inputCls} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {(draft.tpl === "event" || draft.tpl === "booking") && <input value={aiCost} onChange={(e) => setAiCost(e.target.value)} placeholder={t("p8em.nfCostPh")} className="w-[150px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] outline-none" />}
              <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)]">
                {(["short", "medium", "long"] as const).map((l) => <button key={l} type="button" onClick={() => setAiLen(l)} className="px-2.5 py-1 text-[11px] font-bold transition-colors" style={aiLen === l ? { background: "#2f5fd0", color: "#fff" } : { color: "var(--ink-2)" }}>{t(l === "short" ? "p8em.nfLenShort" : l === "medium" ? "p8em.nfLenMedium" : "p8em.nfLenLong")}</button>)}
              </div>
              <button type="button" onClick={generate} disabled={aiBusy} className="ms-auto rounded-lg bg-[#1d3a8f] px-3 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-60">{aiBusy ? t("p8em.nfWriting") : t("p8em.nfWriteForMe")}</button>
            </div>
            {aiErr && <div className="mt-1 text-[11px] font-bold text-[#c02636]">{aiErr}</div>}
          </div>

          {field(t("p8em.nfColour"), (
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => set({ colour: "" })} className="rounded-full border px-2.5 py-1 text-[11px] font-bold" style={!draft.colour ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{t("p8em.nfAuto")}</button>
              {NL_PALETTES.map((pl) => <button key={pl.id} type="button" title={pl.name} onClick={() => set({ colour: pl.accent })} className="h-7 w-7 rounded-full" style={{ background: pl.accent, boxShadow: draft.colour === pl.accent ? "0 0 0 2px #fff, 0 0 0 4px #111" : "none" }} />)}
            </div>
          ))}
          {field(t("p8em.nfTitleLbl"), <input autoFocus value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder={t("p8em.nfTitlePh")} className={inputCls} />)}
          {field(t("p8em.cMessage"), <textarea value={draft.body} onChange={(e) => set({ body: e.target.value })} rows={4} placeholder={t("p8em.nfBodyPh")} className={inputCls} />)}
          {field(t("p8em.nfImage"), (
            draft.image ? (
              <div>
                <div className={draft.imageAspect !== "full" ? "cursor-move touch-none select-none" : ""} onPointerDown={draft.imageAspect !== "full" ? onImgDown : undefined} onPointerMove={draft.imageAspect !== "full" ? onImgMove : undefined} onPointerUp={onImgUp} onPointerCancel={onImgUp}>
                  <PostImage url={draft.image} aspect={draft.imageAspect} x={draft.imageX} y={draft.imageY} zoom={draft.imageZoom} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-[var(--ink-3)]">{t("p8em.nfShape")}</span>
                  {([["full", t("p8em.nfShapeFull")], ["16/9", t("p8em.nfShapeWide")], ["4/5", t("p8em.nfShapePortrait")], ["1/1", t("p8em.nfShapeSquare")]] as const).map(([a, label]) => <button key={a} type="button" onClick={() => setAspect(a)} className="rounded-full border px-2.5 py-1 text-[11px] font-bold" style={draft.imageAspect === a ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>)}
                </div>
                {draft.imageAspect !== "full" && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-[var(--ink-3)]">{t("p8em.nfZoom")}</span>
                    <input type="range" min={1} max={4} step={0.02} value={draft.imageZoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="h-1 flex-1 accent-[#1d3a8f]" />
                  </div>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{imgBusy ? t("p8em.nfUploading") : t("p8em.nfReplace")}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} /></label>
                  <button type="button" onClick={() => set({ image: "" })} className="text-[11px] font-bold text-[#c02636]">{t("p8em.cRemove")}</button>
                  <span className="text-[10.5px] text-[var(--ink-3)]">{draft.imageAspect === "full" ? t("p8em.nfFullHint") : t("p8em.nfCropHint")}</span>
                </div>
                {imgErr && <div className="mt-1 text-[11px] font-bold text-[#c02636]">{imgErr}</div>}
              </div>
            ) : (
              <div>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[11.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{imgBusy ? t("p8em.nfUploading") : t("p8em.nfUploadImage")}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} /></label>
                {imgErr && <div className="mt-1 text-[11px] font-bold text-[#c02636]">{imgErr}</div>}
              </div>
            )
          ))}

          {draft.tpl === "event" && (
            <div className="grid grid-cols-3 gap-2.5">
              {field(t("p8em.nfDate"), <input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} className={inputCls} />)}
              {field(t("p8em.nfTime"), <input type="time" value={draft.time} onChange={(e) => set({ time: e.target.value })} className={inputCls} />)}
              {field(t("p8em.nfLocation"), <input value={draft.location} onChange={(e) => set({ location: e.target.value })} placeholder={t("p8em.nfLocationPh")} className={inputCls} />)}
            </div>
          )}
          {field(t("p8em.nfLink"), (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {([["none", t("p8em.nfNoLink")], ["listing", t("p8em.nfLinkListing")], ["url", t("p8em.nfLinkWeb")]] as const).map(([k, label]) => <button key={k} type="button" onClick={() => set({ ctaKind: k })} className="rounded-full border px-2.5 py-1 text-[11px] font-bold" style={draft.ctaKind === k ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>)}
              </div>
              {draft.ctaKind !== "none" && (
                <div className="grid grid-cols-2 gap-2.5">
                  <input value={draft.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} placeholder={draft.tpl === "booking" ? t("p8em.nfBookNow") : t("p8em.nfButtonLabel")} className={inputCls} />
                  {draft.ctaKind === "listing"
                    ? <select value={draft.ctaListingId} onChange={(e) => { const l = listings.find((x) => x.id === e.target.value); set({ ctaListingId: e.target.value, ctaTarget: l?.title ?? "" }); }} className={inputCls}><option value="">{t("p8em.nfChooseListing")}</option>{listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select>
                    : <input value={draft.ctaUrl} onChange={(e) => set({ ctaUrl: e.target.value })} placeholder="https://…" className={inputCls} />}
                </div>
              )}
            </div>
          ))}

          {franchises.length > 0 && field(t("p8em.nfSendAcross"), (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => set({ frTarget: "" })} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={draft.frTarget === "" ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>🌐 {t("p8em.snAllNetwork")}</button>
                {franchises.map((f) => <button key={f.franchiseId} type="button" onClick={() => set({ frTarget: f.franchiseId })} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={draft.frTarget === f.franchiseId ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{f.name}{f.area ? ` · ${f.area}` : ""}</button>)}
              </div>
              <span className="block text-[10.5px] text-[var(--ink-3)]">{draft.frTarget === "" ? t("p8em.nfReachAll") : t("p8em.nfReachOne", { name: franchises.find((f) => f.franchiseId === draft.frTarget)?.name ?? t("p8em.snThisFranchise") })}</span>
            </div>
          ))}

          {field(t("p8em.nfWhoSees"), (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {([["all", t("p8em.nfAudAll")], ["listing", t("p8em.nfChosenFamilies")]] as const).map(([k, label]) => <button key={k} type="button" onClick={() => set({ audScope: k, audIds: [] })} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={draft.audScope === k ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>)}
              </div>
              {draft.audScope === "listing" && (
                <div className="flex flex-wrap gap-1.5">
                  {listings.length === 0 ? <span className="text-[11px] text-[var(--ink-3)]">{t("p8em.nfNoListings")}</span>
                    : listings.map((l) => { const on = draft.audIds.includes(l.id); return <button key={l.id} type="button" onClick={() => toggleListing(l.id)} className="rounded-full border px-2.5 py-1 text-[11px] font-bold" style={on ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{on ? "✓ " : ""}{l.title}</button>; })}
                </div>
              )}
            </div>
          ))}

          {field(t("p8em.nfSaveAs"), (
            <><input value={draft.ref} onChange={(e) => set({ ref: e.target.value })} placeholder={t("p8em.nfSaveAsPh", { name: draft.title.trim() || t("p8em.nfSaveAsDefault") })} className={inputCls} /><span className="mt-1 block text-[10.5px] text-[var(--ink-3)]">{t("p8em.nfSaveAsHint")}</span></>
          ))}

          {field(t("p8em.nfFolderOpt"), (
            <><input list="post-folders" value={draft.folder} onChange={(e) => set({ folder: e.target.value })} placeholder={t("p8em.nfFolderPh")} className={inputCls} /><datalist id="post-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist></>
          ))}

          <div className="flex flex-wrap gap-1.5">
            {([["pinned", t("p8em.nfTogglePin")], ["ackRequired", t("p8em.nfToggleAck")], ["react", t("p8em.nfToggleReact")]] as const).map(([f, label]) => <button key={f} type="button" onClick={() => set({ [f]: !draft[f] } as Partial<Draft>)} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={draft[f] ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{draft[f] ? "✓ " : ""}{label}</button>)}
            <button type="button" onClick={() => set({ priority: draft.priority === "urgent" ? "normal" : "urgent" })} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={draft.priority === "urgent" ? { borderColor: "#c02636", background: "#fde2e4", color: "#c02636" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{draft.priority === "urgent" ? "✓ " : ""}{t("p8em.nfHighPriority")}</button>
          </div>

          {field(t("p8em.nfWhen"), (
            <div className="flex flex-wrap items-center gap-2">
              {([["now", t("p8em.nfPublishNow")], ["later", t("p8em.nfSchedule")], ["draft", t("p8em.nfSaveDraftOpt")]] as const).map(([k, label]) => <button key={k} type="button" onClick={() => set({ when: k })} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={draft.when === k ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>)}
              {draft.when === "later" && <input type="datetime-local" value={draft.publishAt} onChange={(e) => set({ publishAt: e.target.value })} className="rounded-lg border border-[var(--line)] px-2 py-1 text-[12px] outline-none" />}
            </div>
          ))}

          <div className="border-t border-[var(--line)] pt-2.5">
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.nfPreviewHdr")}</div>
            <PostPreview d={draft} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] px-4 py-3">
          <Button sm onClick={onClose}>{t("p8em.cCancel")}</Button>
          <span className="me-auto text-[11px] text-[var(--ink-3)]">{t("p8em.nfDoOne")}</span>
          <button type="button" onClick={() => downloadPostImage(draft)} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8em.nfBtnImage")}</button>
          <button type="button" onClick={() => onPublish(draft, "download")} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">⬇ PDF</button>
          <button type="button" onClick={() => onPublish(draft, "email")} className="rounded-lg border border-[#1d3a8f] px-3 py-1.5 text-[12px] font-extrabold text-[#1d3a8f] hover:bg-[#eef4fd]">{t("p8em.nfBtnEmail")}</button>
          <button type="button" onClick={() => onPublish(draft, "page")} className="rounded-lg bg-[#1d3a8f] px-4 py-1.5 text-[12px] font-extrabold text-white">{draft.editId ? t("p8em.nfSaveChanges") : draft.when === "draft" ? t("p8em.nfSaveDraft") : draft.when === "later" ? t("p8em.nfSchedule") : t("p8em.nfPostToFeed")}</button>
        </div>
      </div>
    </div>
  );
}
