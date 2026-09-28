#!/usr/bin/env node
// Records each How it works video playing (sound off, on the scene clock) to docs/how-it-works-reels/<name>.mp4 so it can be watched
// without opening the app. Public pages only: no accounts, no data.   node scripts/hiw-reel.mjs [name ...]   (dev server on :3000)
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:3000";
const ALL = { "tutors-home": "tutors/home", "tutors-families": "tutors/families", "tutors-students": "tutors/students", "tutors-lessons": "tutors/lessons", "tutors-live": "tutors/live", "tutors-tools": "tutors/tools", "tutors-quizzes": "tutors/quizzes", "tutors-homework": "tutors/homework", "tutors-progress": "tutors/progress", "tutors-messages": "tutors/messages", "parents-start": "parents/start", "parents-homework": "parents/homework", "parents-week": "parents/week", "parents-handover": "parents/handover", children: "children", "children-homework": "children/homework", "children-ks1": "children?band=ks1" };
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ALL);
fs.mkdirSync("docs/how-it-works-reels", { recursive: true }); fs.mkdirSync("scratch/reel-tmp", { recursive: true });
const b = await chromium.launch();
for (const n of want) { try { await fetch(`${BASE}/how-it-works/${ALL[n]}`); } catch { /* warm the dev server */ } }   // compile each route once, so the recordings do not time out
const pool = Number(process.env.POOL || 3); let next = 0;
await Promise.all(Array.from({ length: pool }, async () => { while (next < want.length) { const name = want[next++]; for (let attempt = 1; attempt <= 3; attempt++) { try { await (async () => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: "scratch/reel-tmp", size: { width: 1280, height: 720 } } });
  const p = await ctx.newPage();
  await p.addInitScript(() => { const s = JSON.stringify({ sound: false, music: false, cc: true, speed: 1 }); localStorage.setItem("aos.hiw.prefs", s); localStorage.setItem("aos.hiw.prefs.kid", s); });
  const url = `${BASE}/how-it-works/${ALL[name]}`;
  await p.goto(url, { timeout: 120000 }); await p.getByTestId("hiw-poster").waitFor({ timeout: 90000 });
  await p.locator(".hiw-stage").scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
  await p.getByTestId("hiw-start").click();
  await p.getByTestId("hiw-end").waitFor({ timeout: 600000 });
  await p.waitForTimeout(1500);
  const v = p.video(); await ctx.close();
  const src = await v.path(); const out = `docs/how-it-works-reels/${name}.mp4`;
  execFileSync("ffmpeg", ["-y", "-i", src, "-c:v", "libx264", "-preset", "fast", "-crf", "24", "-pix_fmt", "yuv420p", "-an", out], { stdio: "ignore" });
  console.log("wrote", out);
})(); break; } catch (e) { console.log("retry", name, attempt, String(e).slice(0, 80)); } } } }));
await b.close();
