"use client";
/* eslint-disable @next/next/no-img-element -- post thumbnail is an arbitrary operator-uploaded URL; next/image doesn't fit. */

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { NewsletterView, PostImage, type Newsletter } from "@/features/newsfeed/newsletter";

// A big, flashy "newsflash" bar across the top of the parent app whenever a
// provider has posted something the family hasn't seen. Clicking it opens THAT
// post on its own as a popup (not the whole feed), with a "See other newsfeeds"
// link underneath to browse the rest. Once seen (opened or dismissed) it's gone.

interface FlashPost {
  id: string; tpl?: string; title?: string; body: string; photoUrl?: string;
  imageAspect?: string; imageX?: number; imageY?: number; imageZoom?: number;
  colour?: string; tenantName?: string; pinned?: boolean;
  date?: string; time?: string; location?: string;
  newsletter?: Newsletter | null; status?: string;
}
const LS = "aos.newsflash.seen.v1";
const readSeen = (): string[] => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch { return []; } };
const writeSeen = (ids: string[]) => { try { localStorage.setItem(LS, JSON.stringify(ids.slice(-500))); } catch { /* private mode */ } };
const TPLC: Record<string, string> = { announce: "#2596df", event: "#7c5cff", reminder: "#f59e0b", urgent: "#ef4444", celebrate: "#e22295", booking: "#15b364", newsletter: "#1d3a8f" };
const TAG: Record<string, string> = { urgent: "URGENT", event: "EVENT", celebrate: "GOOD NEWS", booking: "DON’T MISS", reminder: "REMINDER", newsletter: "NEWSLETTER", announce: "NEWS" };
const colourOf = (p: FlashPost) => p.colour || TPLC[p.tpl ?? "announce"] || "#1d3a8f";

export function NewsflashBanner() {
  const t = useT();
  const [posts, setPosts] = useState<FlashPost[]>([]);
  const [seen, setSeen] = useState<string[]>(() => (typeof window === "undefined" ? [] : readSeen()));
  const [shown, setShown] = useState<FlashPost | null>(null); // the post open in the popup
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    const load = () => apiGet<FlashPost[]>("/api/posts").then((p) => { if (alive) setPosts(p.filter((x) => (x.status ?? "published") === "published")); }).catch(() => {});
    load();
    const t = setInterval(load, 90_000); // pick up new posts while they browse
    return () => { alive = false; clearInterval(t); };
  }, []);

  const unseen = useMemo(() => posts.filter((p) => !seen.includes(p.id)), [posts, seen]);
  const onNewsfeed = pathname?.endsWith("/newsfeed") ?? false;
  const p = unseen[0];
  if (onNewsfeed || (!p && !shown)) return null;

  const markSeen = (...ids: string[]) => { const next = [...new Set([...seen, ...ids])]; setSeen(next); writeSeen(next); };
  // Open the popup for THIS post and mark just it seen (the bar then advances to
  // the next unseen once the popup is closed).
  const openPost = () => { if (!p) return; setShown(p); markSeen(p.id); };
  const dismissOne = () => { if (p) markSeen(p.id); };
  // Mark everything seen and go to the full feed.
  const seeAll = () => { markSeen(...posts.map((x) => x.id)); setShown(null); router.push("/custdash/newsfeed"); };

  return (
    <>
      <style>{`
        @keyframes nf-in { from { transform: translateY(-100%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes nf-shimmer { from { transform: translateX(-120%) } to { transform: translateX(220%) } }
        @keyframes nf-pulse { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
        @keyframes nf-pop { from { transform: translateY(12px) scale(.98); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }
        .nf-bar { animation: nf-in .45s cubic-bezier(.2,.9,.3,1.2) both }
        .nf-shine { animation: nf-shimmer 2.6s ease-in-out infinite }
        .nf-dot { animation: nf-pulse 1.1s ease-in-out infinite }
        .nf-pop { animation: nf-pop .3s cubic-bezier(.2,.9,.3,1.2) both }
        @media (prefers-reduced-motion: reduce) { .nf-bar,.nf-shine,.nf-dot,.nf-pop { animation: none } }
      `}</style>

      {p && !shown && (() => {
        const color = colourOf(p);
        const tag = TAG[p.tpl ?? "announce"] ?? "NEWS";
        const thumb = p.newsletter?.blocks?.find((b) => b.image)?.image || p.photoUrl;
        const headline = p.title || p.body.slice(0, 90);
        return (
          <div className="nf-bar relative overflow-hidden text-white shadow-md" style={{ background: `linear-gradient(120deg, ${color}, ${color}cc 55%, ${color}88)` }}>
            <div className="nf-shine pointer-events-none absolute inset-y-0 left-0 w-1/3" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent)" }} />
            <button type="button" onClick={openPost} className="relative flex w-full items-center gap-3 px-4 py-2.5 text-left">
              {thumb
                ? <img src={thumb} alt="" className="h-10 w-14 flex-none rounded-lg object-cover ring-2 ring-white/60" />
                : <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/20 text-[18px] font-black">📣</span>}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/90">
                  <span className="nf-dot inline-block h-1.5 w-1.5 rounded-full bg-white" /> {tag}
                  {p.tenantName && <span className="font-bold text-white/70">· {p.tenantName}</span>}
                  {unseen.length > 1 && <span className="rounded-full bg-white/25 px-1.5 font-extrabold">{t("parent.plusMore", { count: unseen.length - 1 })}</span>}
                </span>
                <span className="truncate text-[15px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{headline}</span>
              </span>
              <span className="flex-none rounded-full bg-white px-3 py-1 text-[12px] font-extrabold" style={{ color }}>{t("parent.viewArrow")}</span>
            </button>
            <button type="button" onClick={dismissOne} aria-label={t("parent.dismiss")} className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[15px] font-bold text-white/80 hover:bg-white/20">×</button>
          </div>
        );
      })()}

      {shown && (() => {
        const color = colourOf(shown);
        const tag = TAG[shown.tpl ?? "announce"] ?? "NEWS";
        const isNl = shown.tpl === "newsletter" && shown.newsletter;
        const more = unseen.filter((x) => x.id !== shown.id).length;
        return (
          <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/55 p-3 sm:p-6" onClick={() => setShown(null)}>
            <div className="nf-pop my-auto flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[var(--surface,#fff)] shadow-2xl" style={{ maxHeight: "88vh" }} onClick={(e) => e.stopPropagation()}>
              {/* header */}
              <div className="flex flex-none items-center gap-2 px-4 py-2.5 text-white" style={{ background: color }}>
                <span className="text-[10px] font-black uppercase tracking-[0.14em]">{tag}</span>
                {shown.tenantName && <span className="text-[11px] font-bold text-white/80">· {shown.tenantName}</span>}
                <button type="button" onClick={() => setShown(null)} aria-label={t("parent.close")} className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-[16px] font-bold text-white/85 hover:bg-white/20">×</button>
              </div>

              {/* the actual post */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {isNl ? (
                  <div className="p-3"><NewsletterView data={shown.newsletter!} /></div>
                ) : (
                  <div>
                    {shown.photoUrl && <PostImage url={shown.photoUrl} aspect={shown.imageAspect} x={shown.imageX} y={shown.imageY} zoom={shown.imageZoom} rounded={false} />}
                    <div className="p-4">
                      {shown.title && <div className="text-[20px] font-extrabold leading-tight text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{shown.title}</div>}
                      <div className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--ink-2)]">{shown.body}</div>
                      {(shown.date || shown.time || shown.location) && (
                        <div className="mt-2.5 inline-flex flex-wrap items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-bold text-white" style={{ background: color }}>{[shown.date, shown.time, shown.location].filter(Boolean).join(" · ")}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* underneath: see other newsfeeds */}
              <div className="flex flex-none items-center justify-between gap-2 border-t border-[var(--line)] bg-[var(--surface,#fff)] px-4 py-2.5">
                <button type="button" onClick={() => setShown(null)} className="text-[12.5px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)]">{t("parent.closeText")}</button>
                <button type="button" onClick={seeAll} className="rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold text-white" style={{ background: color }}>{t("parent.seeOtherNewsfeeds")}{more > 0 ? t("parent.nMoreParen", { count: more }) : ""} →</button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
