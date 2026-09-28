"use client";

import "./howitworks.css";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEscapeLayer } from "../escapeLayer";
import type { HowBand, HowRole } from "./types";
import { ALLOWED, scriptFor, hasChooser, topicsFor, topicOfScene, headingFor, SCRIPT_LIST } from "./scripts";
import { markDone } from "./scripts/progress";
import HowItWorksChooser from "./HowItWorksChooser";
import { useHowText } from "./i18n";
import { DirArrow } from "../rtl";
import { hiwEvent, takePending, clearPending, hubGoto, type OpenDetail } from "./open";

// The in-app "How it works" window: a full-screen sheet with the player inside, opened by openHowItWorks() from any button or link
// (hero button, the Enrol dialog's "How does enrolling work?", the parent / child Home). The player itself is lazy-loaded, so nothing
// heavy ships until someone asks. Only the most recently mounted host answers the event, so two buttons never open two windows.
const Player = dynamic(() => import("./HowItWorksPlayer"), { ssr: false, loading: () => <Loading /> });
const hosts: symbol[] = [];
function Loading() { const H = useHowText(); return <p style={{ padding: 24 }}>{H.ui("loading")}</p>; }

export default function HowItWorksHost({ defaultRole, band: defaultBand }: { defaultRole: HowRole; band?: HowBand }) {
  const H = useHowText();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<HowRole>(defaultRole);
  const [scene, setScene] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [band, setBand] = useState<HowBand | undefined>(defaultBand);
  const me = useRef(Symbol("hiw-host"));
  const box = useRef<HTMLDivElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const close = useCallback(() => setOpen(false), []);
  useEscapeLayer(open, close);

  useEffect(() => {
    const id = me.current;
    hosts.push(id);
    const apply = (d: OpenDetail) => {
      opener.current = document.activeElement as HTMLElement | null;
      // a viewer only ever gets the explainers they may see (tutor: tutor; parent: parent + what their child sees; child: child)
      const want = d.role && ALLOWED[defaultRole].includes(d.role) ? d.role : defaultRole;
      setRole(want); setScene(d.scene ?? null); setTopic(d.topic ?? topicOfScene(want, d.scene) ?? null); setBand(d.band ?? defaultBand); setAuto(!!d.autoplay); setOpen(true);
    };
    const on = (e: Event) => {
      if (hosts[hosts.length - 1] !== id) return;
      clearPending();
      apply(((e as CustomEvent<OpenDetail>).detail ?? {}) as OpenDetail);
    };
    const early = takePending();   // a click that beat this (lazy) host to the page
    if (early && hosts[hosts.length - 1] === id) queueMicrotask(() => apply(early));
    window.addEventListener(hiwEvent, on);
    return () => { window.removeEventListener(hiwEvent, on); const i = hosts.indexOf(id); if (i >= 0) hosts.splice(i, 1); };
  }, [defaultRole, defaultBand]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node = box.current;
    node?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>("button:not([disabled]),select,a[href],summary,[tabindex]:not([tabindex='-1'])")].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const a = items[0], z = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === a || !node.contains(document.activeElement))) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && (document.activeElement === z || !node.contains(document.activeElement))) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", trap, true);
    return () => { document.removeEventListener("keydown", trap, true); document.body.style.overflow = prevOverflow; opener.current?.focus?.(); };
  }, [open]);

  const finishedTopic = useCallback(() => { if (topic) markDone(role, topic); }, [role, topic]);
  if (!open || typeof document === "undefined") return null;
  const chooser = hasChooser(role) && !topic;
  const script = H.script(scriptFor(role, band, topic));
  const lib = topicsFor(role);
  const nextTopic = topic && hasChooser(role) ? lib[lib.findIndex((x) => x.topic === topic) + 1] : undefined;
  const tryIt = script.tryIt && role === "tutor" ? () => { const sub = script.tryIt!.sub; close(); window.setTimeout(() => hubGoto(sub), 80); } : undefined;
  const nextVideo = nextTopic ? { label: H.ui("nextVideo", { title: H.script(nextTopic).title }), onPick: () => { setTopic(nextTopic.topic ?? null); setScene(null); setAuto(true); } } : undefined;
  const topicOthers = topic ? [
    ...(hasChooser(role) ? [{ label: H.ui("allVideosPlay"), onPick: () => { setTopic(null); setScene(null); } }] : [{ label: H.ui("fullTour"), onPick: () => { setTopic(null); setScene(null); } }]),
  ] : hasChooser(role) ? [] : lib.map((x) => ({ label: `▶ ${H.script(x).title}`, onPick: () => { setTopic(x.topic ?? null); setScene(null); } }));
  const choices = ALLOWED[defaultRole];
  const kidViewer = defaultRole === "kid";
  return createPortal(
    <div className="hiw-modal" data-testid="hiw-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div ref={box} lang={H.lang} dir={H.dir} className={`hiw-sheet${kidViewer ? " hiw-sheet--kid" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="hiw-sheet-head">
          <h2 id={titleId}>{H.ui("sheetTitle")}</h2>
          {choices.length > 1 ? (
            <div className="hiw-roles" role="tablist" aria-label={H.ui("whichVideo")}>
              {choices.map((r) => {
                const sc = H.script(scriptFor(r, band));
                return <button key={r} type="button" role="tab" aria-selected={r === role} data-testid={`hiw-role-${r}`} onClick={() => { setRole(r); setScene(null); setTopic(null); }}>{r === defaultRole ? sc.audience : sc.viewLabel ?? sc.audience}</button>;
              })}
            </div>
          ) : <div className="hiw-roles" />}
          <button type="button" className="hiw-x" data-autofocus data-testid="hiw-close" aria-label={H.ui("close")} onClick={close}>✕</button>
        </div>
        <div className="hiw-sheet-body">
          {chooser ? (
            <div className="hiw-choose-wrap">
              <h3 data-testid="hiw-chooser-title">{H.script(headingFor(role)).title}</h3>
              <p>{H.script(headingFor(role)).tagline} {H.ui("pickShortLong")}</p>
              <HowItWorksChooser role={role} topics={topicsFor(role)} onPick={(t) => { setTopic(t); setScene(null); }} />
            </div>
          ) : (
            <>
              {topic && hasChooser(role) && <div style={{ padding: "0 0 8px" }}><button type="button" className="hiw-back" data-testid="hiw-all-videos" onClick={() => { setTopic(null); setScene(null); }}><DirArrow dir="back" /> {H.ui("allVideos")}</button></div>}
              <Player key={`${role}:${band ?? ""}:${topic ?? ""}:${scene ?? ""}:${auto ? "a" : ""}`} script={script} startScene={scene} keys kid={kidViewer} onFinish={finishedTopic} autoplay={auto} autofocus onTryIt={tryIt} nextVideo={nextVideo} others={[...topicOthers, ...choices.filter((r) => r !== role).map((r) => ({ label: `▶ ${H.script(scriptFor(r, band)).viewLabel ?? H.script(scriptFor(r, band)).audience}`, onPick: () => { setRole(r); setScene(null); setTopic(null); } }))]} />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
