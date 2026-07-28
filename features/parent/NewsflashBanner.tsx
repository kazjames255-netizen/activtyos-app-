"use client";
/* eslint-disable @next/next/no-img-element -- post thumbnail is an arbitrary operator-uploaded URL; next/image doesn't fit. */

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { get as apiGet } from "@/lib/api";

// A big, flashy "newsflash" bar across the top of the parent app whenever a
// provider has posted something the family hasn't seen. Click it to jump to the
// Newsfeed; once seen (viewed or dismissed) it's gone. Bigger and louder than
// the bell — it carries the post's headline and a mini visual.

interface FlashPost { id: string; tpl?: string; title?: string; body: string; photoUrl?: string; tenantName?: string; pinned?: boolean; newsletter?: { blocks?: { image?: string }[] } | null; status?: string }
const LS = "aos.newsflash.seen.v1";
const readSeen = (): string[] => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch { return []; } };
const writeSeen = (ids: string[]) => { try { localStorage.setItem(LS, JSON.stringify(ids.slice(-500))); } catch { /* private mode */ } };
const TPLC: Record<string, string> = { announce: "#2596df", event: "#7c5cff", reminder: "#f59e0b", urgent: "#ef4444", celebrate: "#e22295", booking: "#15b364", newsletter: "#1d3a8f" };
const TAG: Record<string, string> = { urgent: "URGENT", event: "EVENT", celebrate: "GOOD NEWS", booking: "DON’T MISS", reminder: "REMINDER", newsletter: "NEWSLETTER", announce: "NEWS" };

export function NewsflashBanner() {
  const [posts, setPosts] = useState<FlashPost[]>([]);
  const [seen, setSeen] = useState<string[]>(() => (typeof window === "undefined" ? [] : readSeen()));
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
  if (onNewsfeed || !p) return null;

  const color = TPLC[p.tpl ?? "announce"] ?? "#1d3a8f";
  const tag = TAG[p.tpl ?? "announce"] ?? "NEWS";
  const thumb = p.newsletter?.blocks?.find((b) => b.image)?.image || p.photoUrl;
  const headline = p.title || p.body.slice(0, 90);

  const dismissOne = () => { const ids = [...seen, p.id]; setSeen(ids); writeSeen(ids); };
  const view = () => { const ids = [...new Set([...seen, ...posts.map((x) => x.id)])]; setSeen(ids); writeSeen(ids); router.push("/custdash/newsfeed"); };

  return (
    <>
      <style>{`
        @keyframes nf-in { from { transform: translateY(-100%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes nf-shimmer { from { transform: translateX(-120%) } to { transform: translateX(220%) } }
        @keyframes nf-pulse { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
        .nf-bar { animation: nf-in .45s cubic-bezier(.2,.9,.3,1.2) both }
        .nf-shine { animation: nf-shimmer 2.6s ease-in-out infinite }
        .nf-dot { animation: nf-pulse 1.1s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .nf-bar,.nf-shine,.nf-dot { animation: none } }
      `}</style>
      <div className="nf-bar relative overflow-hidden text-white shadow-md" style={{ background: `linear-gradient(120deg, ${color}, ${color}cc 55%, ${color}88)` }}>
        {/* moving shine */}
        <div className="nf-shine pointer-events-none absolute inset-y-0 left-0 w-1/3" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent)" }} />
        <button type="button" onClick={view} className="relative flex w-full items-center gap-3 px-4 py-2.5 text-left">
          {thumb
            ? <img src={thumb} alt="" className="h-10 w-14 flex-none rounded-lg object-cover ring-2 ring-white/60" />
            : <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/20 text-[18px] font-black">📣</span>}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/90">
              <span className="nf-dot inline-block h-1.5 w-1.5 rounded-full bg-white" /> {tag}
              {p.tenantName && <span className="font-bold text-white/70">· {p.tenantName}</span>}
              {unseen.length > 1 && <span className="rounded-full bg-white/25 px-1.5 font-extrabold">+{unseen.length - 1} more</span>}
            </span>
            <span className="truncate text-[15px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{headline}</span>
          </span>
          <span className="flex-none rounded-full bg-white px-3 py-1 text-[12px] font-extrabold" style={{ color }}>View →</span>
        </button>
        <button type="button" onClick={dismissOne} aria-label="Dismiss" className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[15px] font-bold text-white/80 hover:bg-white/20">×</button>
      </div>
    </>
  );
}
