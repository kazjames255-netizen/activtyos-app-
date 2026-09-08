"use client";

import { useEffect, useMemo, useState } from "react";
import { BACKLOG, bySeverity, type BacklogItem, type Who } from "@/lib/testing/backlog";

/**
 * HQ → Tasks.
 *
 * Two sources in one list: the 39 CONFIRMED issues from the 8 Sept audit and
 * the 5-reviewer critique (lib/testing/backlog.ts, fixed in code so they can't
 * be lost), and anything you add yourself while testing.
 *
 * localStorage, like the test run — a platform account has no tenant to hang a
 * document on. The copy-out buttons are therefore the backup, not a nicety.
 */

const KEY = "aos.platform.tasks.v1";
const TICK_KEY = "aos.testing.ticks.v1"; // shared with the Testing page, so a tick in one shows in the other

interface OwnTask { id: string; title: string; detail?: string; who: Who; severity: BacklogItem["severity"]; at: string }

const loadOwn = (): OwnTask[] => {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as OwnTask[]; } catch { return []; }
};
const saveOwn = (t: OwnTask[]) => { localStorage.setItem(KEY, JSON.stringify(t)); window.dispatchEvent(new Event("aos:testing")); };
const loadTicks = (): Record<string, boolean> => {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(TICK_KEY) ?? "{}") as Record<string, boolean>; } catch { return {}; }
};
const setTick = (id: string, on: boolean) => {
  const t = loadTicks(); if (on) t[id] = true; else delete t[id];
  localStorage.setItem(TICK_KEY, JSON.stringify(t));
  window.dispatchEvent(new Event("aos:testing"));
};

const WHO: Record<Who, { label: string; bg: string; fg: string }> = {
  amir: { label: "Amir", bg: "rgba(47,107,216,.12)", fg: "#2f6bd8" },
  claude: { label: "Front-end", bg: "rgba(107,77,230,.12)", fg: "#6b4de6" },
  kaz: { label: "You", bg: "#fdf1dc", fg: "#a5760a" },
  decision: { label: "Decision", bg: "rgba(200,30,94,.10)", fg: "#b3123c" },
};
const SEV: Record<string, { bg: string; fg: string }> = {
  critical: { bg: "#fdeaee", fg: "#b3123c" },
  high: { bg: "#fdf1dc", fg: "#a5760a" },
  medium: { bg: "var(--panel)", fg: "var(--ink-2)" },
};

const Chip = ({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) => (
  <span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold" style={{ background: bg, color: fg }}>{children}</span>
);

export function PlatformTasksApp() {
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [own, setOwn] = useState<OwnTask[]>([]);
  const [filter, setFilter] = useState<Who | "all" | "done">("all");
  const [title, setTitle] = useState("");
  const [who, setWho] = useState<Who>("amir");
  const [sev, setSev] = useState<BacklogItem["severity"]>("high");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => { setTicks(loadTicks()); setOwn(loadOwn()); };
    sync();
    window.addEventListener("aos:testing", sync);
    return () => window.removeEventListener("aos:testing", sync);
  }, []);

  const all: (BacklogItem & { own?: boolean })[] = useMemo(
    () => [...BACKLOG, ...own.map((t) => ({ id: t.id, title: t.title, detail: t.detail ?? "", who: t.who, severity: t.severity, own: true }))],
    [own],
  );

  const open = all.filter((t) => !ticks[t.id]);
  const shown = (filter === "all" ? open : filter === "done" ? all.filter((t) => ticks[t.id]) : open.filter((t) => t.who === filter)).sort(bySeverity);

  const count = (w: Who) => open.filter((t) => t.who === w).length;

  const add = () => {
    if (!title.trim()) return;
    const t: OwnTask = { id: `own-${Date.now()}`, title: title.trim(), who, severity: sev, at: new Date().toISOString() };
    const next = [t, ...own]; saveOwn(next); setOwn(next); setTitle("");
  };

  const copyFor = (w: Who) => {
    const list = open.filter((t) => t.who === w).sort(bySeverity);
    const md = [`# ${WHO[w].label} — ${list.length} open`, "",
      ...list.map((t) => `## [${t.severity}] ${t.title}\n${t.detail}${t.file ? `\n\nWhere: ${t.file}` : ""}${t.step ? `\nTest step: ${t.step}` : ""}`)].join("\n\n");
    navigator.clipboard.writeText(md).then(() => { setCopied(w); setTimeout(() => setCopied(null), 1600); });
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6">
      <header className="rounded-[20px] p-6 text-white" style={{ background: "linear-gradient(120deg,#16306e,#274ba3 58%,#3f78d8)" }}>
        <div className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#f5b81f]">Tasks</div>
        <h1 className="mt-2 text-[30px] font-extrabold leading-tight">{open.length} open.</h1>
        <p className="mt-2 max-w-[74ch] text-[14.5px] text-white/80">
          Every confirmed issue from the portal audit and the test-plan review, plus anything you add. Nothing here is
          speculative &mdash; each one was verified against the code. Ticks are shared with the Testing page.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Chip bg="rgba(255,255,255,.16)" fg="#fff">{open.filter((t) => t.severity === "critical").length} critical</Chip>
          <Chip bg="rgba(255,255,255,.16)" fg="#fff">{count("amir")} Amir</Chip>
          <Chip bg="rgba(255,255,255,.16)" fg="#fff">{count("claude")} front-end</Chip>
          <Chip bg="rgba(255,255,255,.16)" fg="#fff">{count("decision")} need a decision</Chip>
        </div>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {([["all", `All open (${open.length})`], ["amir", `Amir (${count("amir")})`], ["claude", `Front-end (${count("claude")})`], ["decision", `Decision (${count("decision")})`], ["kaz", `You (${count("kaz")})`], ["done", `Done (${all.length - open.length})`]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(k as Who | "all" | "done")}
            className="rounded-full px-4 py-2 text-[13px] font-extrabold"
            style={filter === k ? { background: "#16306e", color: "#fff" } : { background: "var(--panel)", color: "var(--ink-2)" }}>
            {label}
          </button>
        ))}
        <button type="button" onClick={() => copyFor("amir")}
          className="ml-auto rounded-full bg-[#2f6bd8] px-4 py-2 text-[13px] font-extrabold text-white">
          {copied === "amir" ? "Copied ✓" : "Copy Amir's list"}
        </button>
      </div>

      <div className="mt-4 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder="Add a task — what did you just find?"
            className="min-w-[240px] flex-1 rounded-[10px] border border-[var(--line)] p-2.5 text-[13.5px]" />
          <select value={who} onChange={(e) => setWho(e.target.value as Who)} className="rounded-[10px] border border-[var(--line)] p-2.5 text-[13px]">
            <option value="amir">Amir</option><option value="claude">Front-end</option>
            <option value="kaz">Me</option><option value="decision">Decision</option>
          </select>
          <select value={sev} onChange={(e) => setSev(e.target.value as BacklogItem["severity"])} className="rounded-[10px] border border-[var(--line)] p-2.5 text-[13px]">
            <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option>
          </select>
          <button type="button" onClick={add} className="rounded-full bg-[#16306e] px-5 py-2.5 text-[13px] font-extrabold text-white">Add</button>
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-2.5">
        {shown.map((t) => (
          <li key={t.id} className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-4" style={ticks[t.id] ? { opacity: 0.45 } : undefined}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={!!ticks[t.id]} onChange={(e) => { setTick(t.id, e.target.checked); setTicks(loadTicks()); }}
                className="mt-1 h-5 w-5 shrink-0 accent-[#0b7a52]" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip bg={SEV[t.severity].bg} fg={SEV[t.severity].fg}>{t.severity}</Chip>
                  <Chip bg={WHO[t.who].bg} fg={WHO[t.who].fg}>{WHO[t.who].label}</Chip>
                  {t.step && <code className="rounded-md bg-[var(--panel)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-2)]">{t.step}</code>}
                  {t.own && <Chip bg="var(--panel)" fg="var(--ink-3)">yours</Chip>}
                </div>
                <div className="mt-1.5 text-[14px] font-extrabold text-[var(--ink)]">{t.title}</div>
                {t.detail && <p className="mt-1 text-[13px] text-[var(--ink-2)]">{t.detail}</p>}
                {t.file && <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">{t.file}</p>}
              </div>
            </div>
          </li>
        ))}
        {!shown.length && (
          <li className="rounded-[14px] border border-dashed border-[var(--line)] p-8 text-center text-[13.5px] text-[var(--ink-3)]">
            Nothing here.
          </li>
        )}
      </ul>
    </div>
  );
}
