"use client";

import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FOCUS, withQs } from "../../teachKit";
import { post } from "@/lib/api";
import { prepareImage, uploadHubImage } from "../../shared-assess/imageUtil";
import { maskName } from "../workspace/wsKit";
import { BIcon } from "./boardIcons";
import { BoardShell } from "./BoardShell";
import { MoreMenu, PageTabs, StudentsSwitchButton, ViewSwitch } from "./BoardUi";
import { attachInbox, busEmit, isPresenting, setLocalPresenting, useCallMeta, useCallObject, type CallLike } from "./callObject";
import { BoardController } from "./controller";
import { downloadBlob, pageToBlob, saveToLessonNotes } from "./exportBoard";
import { ImagePicker } from "./ImagePicker";
import { PadHub, showToClassOps } from "./pads";
import { PadBoard } from "./PadBoard";
import { useBoardPersistence } from "./persist";
import { QuestionDialog, type Question } from "./QuestionDialog";
import { StudentsPop, type Attendee } from "./StudentsPop";
import { BoardLink } from "./sync";
import { readTheme } from "./theme";
import { levelFromYears, packFromSubject } from "./toolkit/packs";
import { makeHandlers } from "./wire";
import { WorkView } from "./WorkView";
import { useCtrl } from "./BoardUi";

// <LessonBoard/> — the live shared whiteboard for a video lesson. Self-contained:
// it takes the lesson, the caller's role and (from the call bridge, or a prop)
// the Daily call object, and looks after drawing, live sync, autosave and export.
// The tutor draws and chooses who else may write; each student also has a private
// page ("workings") the tutor watches live in the Student work view.

export interface LessonBoardProps {
  lessonId: string;
  /** "?tenantId=…" (+ "&childId=…" for a family) — appended to every API path. */
  qs: string;
  isTutor: boolean;
  /** First name shown on this person's work and cursor (defaults to the call's own name for them). */
  userName?: string;
  childId?: string | null;
  lessonTitle: string;
  /** The lesson's students (tutor side: for the "who can write" picker and the Student work view). */
  attendees?: Attendee[];
  /** Privacy: blank every student's name (Student A, B…). */
  hideNames?: boolean;
  /** The lesson topic's subject (as the tutor typed it) — picks the toolkit pack that opens first. */
  subject?: string | null;
  /** Year groups of the students ("Year 4") — picks the Early / Standard / Advanced style. */
  years?: (string | null | undefined)[];
  /** Notes already attached to the lesson (the export appends to them). */
  noteIds?: string[];
  topicId?: string | null;
  /** A topic to file the exported note under when the lesson has none. */
  fallbackTopicId?: string | null;
  /** Is the pane showing? (Drawing pauses while hidden.) */
  active?: boolean;
  /** Override the call object (defaults to the one the video frame publishes). */
  callObject?: CallLike | null;
  onError?: (msg: string) => void;
  /** Tell the host to make the board the main stage / go back (default: the call-layout event bus). */
  onPresent?: (on: boolean) => void;
}

type View = "board" | "work";
const swId = (cid: string) => `sw-${cid.slice(0, 20)}`;

function LessonBoardInner(p: LessonBoardProps) {
  const storeCall = useCallObject();
  const meta = useCallMeta();
  const call = p.callObject ?? storeCall;
  const name = (p.userName || meta?.userName || (p.isTutor ? "Tutor" : "Student")).trim().split(/\s+/)[0]!;
  const root = useRef<HTMLDivElement>(null);
  const linkRef = useRef<BoardLink | null>(null);
  const [picker, setPicker] = useState<null | "board" | "question">(null);
  const importInput = useRef<HTMLInputElement>(null);
  const [qDialog, setQDialog] = useState(false);
  const [presenting, setPresenting] = useState(() => (p.isTutor ? isPresenting() : false));
  const [online, setOnline] = useState(true);
  const nameRef = useRef(name);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<View>("board");
  const [openPad, setOpenPad] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, tick] = useState(0);

  const attendees = useMemo(() => p.attendees ?? [], [p.attendees]);
  const ctrl = useMemo(() => new BoardController({
    isTutor: p.isTutor, readOnlyBoard: false,
    self: p.isTutor ? { tutor: true, own: "T", name } : { tutor: false, own: `c:${p.childId ?? name}`, by: name, cid: p.childId ?? undefined, name },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [p.lessonId, p.isTutor, p.childId]);
  const hub = useMemo(() => new PadHub({ tutor: p.isTutor, cid: p.childId ?? undefined, name }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.lessonId, p.isTutor, p.childId]);
  useCtrl(ctrl);

  // the name arrives with the call's own record: keep the identity current
  useEffect(() => {
    Object.assign(ctrl.opts.self, { name, ...(p.isTutor ? {} : { by: name }) }); hub.role.name = name;
    nameRef.current = name;
    if (linkRef.current) linkRef.current.self.name = name;
  }, [ctrl, hub, name, p.isTutor]);
  useLayoutEffect(() => { if (root.current) { const t = readTheme(root.current); ctrl.setPaper(t.paper, t.palette); } }, [ctrl]);

  // key-stage style: what the tutor last chose, else from the students' year groups, else Standard
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem("hub-board-level"); } catch { /* no storage */ }
    const lv = stored === "early" || stored === "standard" || stored === "advanced" ? stored : levelFromYears(p.years ?? []) ?? "standard";
    ctrl.setLevel(lv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctrl]);

  const persist = useBoardPersistence(ctrl, { lessonId: p.lessonId, qs: p.qs, isTutor: p.isTutor, enabled: true });

  // ── live link over the call ──
  useEffect(() => {
    if (!call || !persist.loaded) return;
    // (the display name is read through a ref: it arrives with the call's own record and must NOT rebuild the link — a rebuild re-introduces us to everyone)
    const link: BoardLink = new BoardLink(call, { tutor: p.isTutor, name: nameRef.current, cid: p.childId ?? undefined }, () => ctrl.state, makeHandlers({
      get state() { return ctrl.state; },
      get page() { return ctrl.page; },
      onRemoteOps: (ops, who) => ctrl.onRemoteOps(ops, who),
      onRemotePtr: (peer, ptr) => ctrl.onRemotePtr(peer, ptr),
      onRemoteGo: (page) => ctrl.onRemoteGo(page),
      peersChanged: (n) => { ctrl.peerCount = n; ctrl.notify(); tick((x) => x + 1); },
      onConn: (ok) => setOnline(ok),
      onOversize: (clipped, dropped) => ctrl.say(dropped ? "Something on the board was too big to share with everyone and stayed on your screen only" : "Some text was too long to share with everyone in full and was shortened for them"),
    }, hub, () => linkRef.current));
    link.presenting = isPresenting();
    linkRef.current = link; ctrl.out = link;
    link.start();
    const detach = attachInbox((m) => link.receive(m));
    tick((x) => x + 1);
    return () => { detach(); link.stop(); if (linkRef.current === link) { linkRef.current = null; ctrl.out = null; } };
  }, [call, ctrl, hub, persist.loaded, p.isTutor, p.childId]);

  // ── who is here / names ──
  const link = linkRef.current;
  // (recomputed every render: a peer's child id can appear without the head-count changing)
  const present = new Set([...(link?.peers.values() ?? [])].filter((x) => !x.tutor && x.cid).map((x) => x.cid!));
  const shown = useCallback((a: Attendee, i: number) => (p.hideNames ? maskName(i) : a.name.trim().split(/\s+/)[0]!), [p.hideNames]);

  // ── actions ──
  const fail = useCallback((e: unknown) => { const m = e instanceof Error ? e.message : "Something went wrong"; if (p.onError) p.onError(m); ctrl.say(m); setBusy(null); }, [p, ctrl]);
  const src = () => ({ paper: ctrl.paper, images: ctrl.images });
  const saveNotes = async (scope: "page" | "all") => {
    setBusy("Saving to your lessons…");
    try {
      await persist.saveNow();
      const pages = (scope === "all" ? ctrl.state.pages : [ctrl.curPage]).filter((pg) => scope === "page" || pg.els.size > 0 || pg.bg !== "blank").map((page) => ({ page }));
      const r = await saveToLessonNotes({ src: src(), lessonId: p.lessonId, qs: p.qs, lessonTitle: p.lessonTitle, noteIds: p.noteIds ?? [], topicId: p.topicId, fallbackTopicId: p.fallbackTopicId ?? null, pages });
      ctrl.say(`Saved to your lessons — “${r.title}”`); setBusy(null);
    } catch (e) { fail(e); }
  };
  const saveWork = async () => {
    setBusy("Saving students' work…");
    try {
      const pages = attendees.map((a, i) => ({ a, i, pad: hub.pads.get(a.childId) })).filter((r) => r.pad && r.pad.state.pages[0]!.els.size > 0)
        .map((r) => ({ page: r.pad!.state.pages[0]!, label: shown(r.a, r.i) }));
      const r = await saveToLessonNotes({ src: src(), lessonId: p.lessonId, qs: p.qs, lessonTitle: p.lessonTitle, noteIds: p.noteIds ?? [], topicId: p.topicId, fallbackTopicId: p.fallbackTopicId ?? null, pages, kind: "Student work" });
      ctrl.say(`Saved ${r.pages} ${r.pages === 1 ? "page" : "pages"} of student work (only you can see this lesson)`); setBusy(null);
    } catch (e) { fail(e); }
  };
  const download = async () => {
    setBusy("Preparing the picture…");
    try { const { blob, ext } = await pageToBlob(src(), ctrl.curPage); downloadBlob(blob, `board-${ctrl.state.pages.findIndex((x) => x.id === ctrl.page) + 1}.${ext}`); setBusy(null); } catch (e) { fail(e); }
  };
  const present_ = () => { const next = !presenting; setPresenting(next); setLocalPresenting(next); linkRef.current?.present(next); if (p.onPresent) p.onPresent(next); else busEmit("present", next); };

  const showToClass = (cid: string) => {
    const pad = hub.pads.get(cid), i = attendees.findIndex((a) => a.childId === cid);
    if (!pad || i < 0) return;
    const id = swId(cid);
    if (!ctrl.state.pages.some((pg) => pg.id === id)) ctrl.commit(showToClassOps(id, pad, `${shown(attendees[i]!, i)}'s working`));
    ctrl.setPage(id); setView("board"); setOpenPad(null); ctrl.say(`${shown(attendees[i]!, i)}'s page is on the board for everyone`);
  };
  const sendBack = (cid: string) => { const id = swId(cid); if (ctrl.state.pages.some((pg) => pg.id === id)) ctrl.deletePage(id); };
  const onBoard = new Set(attendees.filter((a) => ctrl.state.pages.some((pg) => pg.id === swId(a.childId))).map((a) => a.childId));
  const sendQuestion = (q: Question, to: string[]) => {
    const names = Object.fromEntries(attendees.map((a, i) => [a.childId, a.name.trim().split(/\s+/)[0]!]));
    hub.setQuestion(linkRef.current, to, { text: q.text, image: q.image ? { imageId: q.image.imageId, url: q.image.url, w: q.image.w, h: q.image.h } : undefined }, names);
    setQDialog(false); ctrl.say(`Question sent to ${to.length} ${to.length === 1 ? "student" : "students"}`);
  };

  const pages = ctrl.state.pages;
  const pageNo = Math.max(1, pages.findIndex((x) => x.id === ctrl.page) + 1);
  const saveLabel = p.isTutor ? ({ loading: "Loading…", saving: "Saving…", saved: "Saved", idle: "Unsaved changes", error: "Couldn't save", toobig: "Too big to save" } as const)[persist.state] : null;
  const surfaceLabel = `Whiteboard, page ${pageNo} of ${pages.length}. ${ctrl.canDraw ? "You can write here." : "Your tutor is drawing; you can look around."} Keyboard: V select, P pen, H highlighter, E eraser, T text.`;
  const doneCount = [...hub.pads.values()].filter((x) => x.done).length;
  const hereCount = present.size;

  const saveTemplate = async (name: string) => {
    setBusy("Saving the template…");
    try {
      const els = [...ctrl.curPage.els.values()].filter((e) => e.own === "T").map((e) => { const { url: _u, ...rest } = e; return rest; });
      await post(`/api/learning-hub/board-templates${withQs(p.qs, {})}`, { name, background: ctrl.curPage.bg, elements: els });
      ctrl.say(`Saved “${name}” to My templates`); setBusy(null);
    } catch (e) { fail(e); }
  };
  const importFiles = async (files: FileList | null) => {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith("image/")).slice(0, 12);
    if (!list.length) { ctrl.say("Choose PNG, JPEG or WebP pictures (export a PDF page as an image first)"); return; }
    setBusy(`Importing ${list.length} ${list.length === 1 ? "page" : "pages"}…`);
    try {
      const out: { id: string; url: string; w: number; h: number }[] = [];
      for (const f of list) { const prep = await prepareImage(f); const up = await uploadHubImage(prep.dataUrl); out.push({ id: up.id, url: up.url, w: prep.width, h: prep.height }); }
      ctrl.importPages(out); setBusy(null);
    } catch (e) { fail(e); }
  };
  const menuActions = { saveTemplate, saveNotes: (s: "page" | "all") => void saveNotes(s), download: () => void download(), present: present_, presenting, wide: true };
  const basePill = p.isTutor ? (
    <span data-testid="board-save-status" data-state={persist.state} title={persist.error ?? undefined}
      className={`pointer-events-auto inline-flex min-h-[28px] items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-bold ${persist.state === "error" || persist.state === "toobig" ? "border-[var(--red-line)] bg-[var(--red-soft)] text-[var(--red)]" : "border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-3)]"}`}>
      {persist.state === "saved" && <BIcon name="check" size={13} />}{saveLabel}
    </span>
  ) : (
    <span data-testid="board-write-status" data-can-write={ctrl.canDraw ? "1" : "0"} className={`inline-flex min-h-[28px] items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-extrabold ${ctrl.canDraw ? "border-[var(--green-line)] bg-[var(--green-soft)] text-[var(--hub-green-ink)]" : "border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-3)]"}`}>
      <BIcon name={ctrl.canDraw ? "pen" : "lock"} size={13} />{ctrl.canDraw ? "You can write" : "Tutor is drawing"}
    </span>
  );

  const statusPill = online ? basePill : (
    <span className="inline-flex items-center gap-1.5">
      <span role="status" data-testid="board-reconnecting" className="inline-flex min-h-[28px] items-center gap-1.5 rounded-full border border-[var(--gold-line)] bg-[var(--gold-soft)] px-2.5 text-[11.5px] font-extrabold text-[var(--ink)]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--gold)] motion-reduce:animate-none" />Reconnecting…
      </span>
      {basePill}
    </span>
  );

  const viewSwitch = <ViewSwitch view={view} onView={(v) => { setView(v); setOpenPad(null); }} isTutor={p.isTutor} badge={p.isTutor && hereCount > 0 ? `${doneCount}/${hereCount}` : undefined} />;
  const cid = p.childId ?? name;

  return (
    <div ref={root} className="@container relative flex h-full min-h-[300px] w-full flex-col overflow-hidden" style={{ background: "var(--hub-warm)" }} data-testid="lesson-board" data-view={view} data-can-draw={ctrl.canDraw ? "1" : "0"} data-page={ctrl.page} data-elements={ctrl.curPage.els.size} data-tutor={p.isTutor ? "1" : "0"} data-peers={ctrl.peerCount}>
      <div className="relative min-h-0 flex-1">
        {view === "board" && (
          <BoardShell ctrl={ctrl} active={p.active !== false} label={surfaceLabel} busy={busy} statusPill={statusPill}
            empty={`A blank board — ${p.isTutor ? "pick a pen and start. Everyone in the lesson sees it live." : "your tutor will draw here."}`}
            onPicture={() => setPicker("board")} qs={p.isTutor ? p.qs : undefined} onImport={() => importInput.current?.click()} subjectPack={packFromSubject(p.subject)}
            topLeft={<>{viewSwitch}<PageTabs ctrl={ctrl} /></>}
            topRight={(api) => (
              <>
                {p.isTutor && <StudentsSwitchButton ctrl={ctrl} attendees={attendees} onClick={(e) => api.openPop("students", e.currentTarget)} open={api.pop === "students"} />}
                {p.isTutor && (
                  <button type="button" aria-pressed={presenting} data-action="present-board-top" onClick={present_} title="Present the board — it fills the room and the video becomes a small tile"
                    className={`hidden min-h-[52px] items-center gap-1.5 rounded-2xl border px-3.5 text-[13px] font-extrabold ${FOCUS} @[560px]:inline-flex ${presenting ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-2)] shadow-[var(--shadow)] hover:border-[var(--brand)]"}`}>
                    <BIcon name="present" size={18} /><span className="hidden @[1100px]:inline">{presenting ? "Stop presenting" : "Present"}</span>
                  </button>
                )}
                <button type="button" data-pop-trigger aria-haspopup="menu" aria-expanded={api.pop === "more"} aria-label="Board menu" title="More — background, save, download, clear" data-testid="board-more" onClick={(e) => api.openPop("more", e.currentTarget)}
                  className="grid h-[52px] w-[52px] place-items-center rounded-2xl border border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-2)] shadow-[var(--shadow)] hover:border-[var(--brand)]"><BIcon name="more" size={20} /></button>
              </>
            )}
            renderPop={(kind, close) => kind === "more"
              ? <MoreMenu ctrl={ctrl} close={close} actions={menuActions} />
              : <StudentsPop ctrl={ctrl} attendees={attendees} present={present} shown={shown} close={close} />} />
        )}

        {view === "work" && p.isTutor && !openPad && (
          <WorkView leading={viewSwitch} hub={hub} attendees={attendees} present={present} shown={shown} paper={ctrl.paper} compare={compare} onCompare={setCompare}
            onOpen={setOpenPad} onShow={showToClass} onSendBack={sendBack} onlyOnBoard={onBoard} selected={selected} onSelect={setSelected}
            onQuestion={() => setQDialog(true)} onSaveAll={() => void saveWork()} />
        )}
        {view === "work" && p.isTutor && openPad && (
          <PadBoard key={openPad} hub={hub} cid={openPad} name={shown(attendees.find((a) => a.childId === openPad) ?? { childId: openPad, name: "Student" }, Math.max(0, attendees.findIndex((a) => a.childId === openPad)))}
            role="tutor" linkRef={linkRef} paper={ctrl.paper} palette={ctrl.palette} active={p.active !== false} hideName={p.hideNames} onBack={() => setOpenPad(null)} leading={viewSwitch}
            extraRight={onBoard.has(openPad)
              ? <button type="button" data-action="send-back" onClick={() => sendBack(openPad)} className={`inline-flex min-h-[52px] items-center rounded-2xl border border-[var(--gold-line)] bg-[var(--gold-soft)] px-3 text-[13px] font-extrabold text-[var(--ink)] shadow-[var(--shadow)] ${FOCUS}`}>Send back</button>
              : <button type="button" data-action="show-to-class" onClick={() => showToClass(openPad)} className={`inline-flex min-h-[52px] items-center gap-1.5 rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-soft)] px-3 text-[13px] font-extrabold text-[var(--brand-strong)] shadow-[var(--shadow)] ${FOCUS}`}><BIcon name="present" size={17} />Show to class</button>} />
        )}
        {view === "work" && !p.isTutor && (
          <PadBoard hub={hub} cid={cid} name={name} role="student" linkRef={linkRef} paper={ctrl.paper} palette={ctrl.palette} active={p.active !== false} leading={viewSwitch} />
        )}
      </div>

      <input ref={importInput} type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" tabIndex={-1} aria-label="Choose worksheet pictures" data-testid="board-import-input" onChange={(e) => { void importFiles(e.target.files); e.target.value = ""; }} />
      {picker === "board" && <ImagePicker qs={p.qs} onClose={() => setPicker(null)} onPick={(x) => { ctrl.insertImage(x.id, x.url, x.w, x.h); setPicker(null); }} />}
      {qDialog && <QuestionDialog qs={p.qs} attendees={attendees.filter((a) => present.has(a.childId) || hub.pads.has(a.childId))} shown={(a) => shown(a, attendees.findIndex((x) => x.childId === a.childId))} targets={selected.size ? [...selected] : [...present]} onClose={() => setQDialog(false)} onSend={sendQuestion} />}
    </div>
  );
}

/** A problem inside the board must never take the call page down with it. */
class BoardBoundary extends Component<{ children: ReactNode }, { failed: number }> {
  state = { failed: 0 };
  static getDerivedStateFromError() { return { failed: 1 }; }
  componentDidCatch(e: unknown) { console.error("[whiteboard]", e); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="grid h-full place-items-center p-6 text-center" style={{ background: "var(--hub-warm)" }} role="alert" data-testid="board-crashed">
        <div className="max-w-[320px]">
          <div className="text-[15px] font-extrabold text-[var(--ink)]">The whiteboard hit a problem</div>
          <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-[var(--ink-2)]">Your call is fine. Your drawing is saved. Reload the board to carry on.</p>
          <button type="button" onClick={() => this.setState({ failed: 0 })} className={`mt-3 inline-flex min-h-[44px] items-center rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] px-4 text-[13px] font-extrabold text-[var(--ink)] ${FOCUS}`}>Reload the board</button>
        </div>
      </div>
    );
  }
}

export function LessonBoard(p: LessonBoardProps) {
  return <BoardBoundary><LessonBoardInner {...p} /></BoardBoundary>;
}
