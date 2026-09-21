"use client";

import { useEffect, useRef } from "react";
import type { ImageCache, Paper } from "./render";
import { drawPage } from "./render";
import type { BoardState } from "./model";

// A live thumbnail of a pad: the same vector renderer at a small size, redrawn at
// most ~2 times a second and only while the tile is on screen.

export function MiniCanvas({ state, version, paper, images, w, h, label }: { state: BoardState; version: number; paper: Paper; images: ImageCache; w: number; h: number; label: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const visible = useRef(true);
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(true);

  const paint = () => {
    const c = cv.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const k = Math.min(w / 1240, h / 800);
    drawPage(ctx, state.pages[0]!, { k, x: w / 2, y: h / 2 }, w, h, dpr, { k, paper, images });
    last.current = Date.now(); dirty.current = false;
  };
  const schedule = () => {
    if (timer.current || !visible.current) return;
    const wait = Math.max(0, 500 - (Date.now() - last.current));
    timer.current = setTimeout(() => { timer.current = null; if (visible.current && dirty.current) paint(); }, wait);
  };
  useEffect(() => { dirty.current = true; schedule(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [version, w, h, paper]);
  useEffect(() => {
    const el = cv.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { visible.current = !!e?.isIntersecting; if (visible.current && dirty.current) schedule(); });
    io.observe(el);
    return () => { io.disconnect(); if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <canvas ref={cv} role="img" aria-label={label} className="block rounded-lg" style={{ width: w, height: h, background: paper.paper }} />;
}
