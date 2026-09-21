"use client";

import { useEffect, useRef, useState } from "react";
import { get } from "@/lib/api";
import { Avatar, DISPLAY, FOCUS, HERO_BG, fmtClock, humanSpan, relDay, useNow, withQs } from "../teachKit";
import { useFamily } from "../family/FamilyContext";
import { Ico, GradientTile } from "../teachIcons";
import { Person, Stack } from "../home/homeKit";
import { LessonNotes, stageInfo } from "./liveKit";
import { lessonTiming, type Lesson } from "./lessonTypes";
import { useMediaPreview, type DevStatus } from "./useMediaPreview";

// The pre-join lobby: a live self-preview, a camera + microphone check with
// friendly help when the browser says no, then one clear "Join" button. It is
// the same dark stage as the call itself so entering the room feels like one
// motion. Joining is never blocked by a failed check — the call has its own
// device prompts — but the person is told exactly what's wrong and how to fix it.

export interface JoinPrefs { camOn: boolean; micOn: boolean }

const STATUS_TEXT: Record<DevStatus, { text: string; good: boolean }> = {
  pending: { text: "Checking…", good: false },
  ok: { text: "Working", good: true },
  off: { text: "Switched off", good: false },
  denied: { text: "Blocked by your browser", good: false },
  missing: { text: "Not found", good: false },
  busy: { text: "In use by another app", good: false },
  unsupported: { text: "Not supported here", good: false },
};

function CheckRow({ icon, label, status, detail }: { icon: "video" | "mic" | "camOff" | "micOff"; label: string; status: DevStatus; detail?: string }) {
  const s = STATUS_TEXT[status];
  const bad = status === "denied" || status === "missing" || status === "busy" || status === "unsupported";
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/8 px-3.5 py-3" data-check={label.toLowerCase()} data-status={status}>
      <span aria-hidden className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-white/12"><Ico name={icon} size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-extrabold">{label}</span>
        <span className="block truncate text-[11.5px] text-white/70">{detail || s.text}</span>
      </span>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${s.good ? "bg-[var(--green)]/25 text-white" : bad ? "bg-[var(--red)]/30 text-white" : "bg-white/15 text-white/85"}`}>
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.good ? "bg-[var(--green)]" : bad ? "bg-[var(--red)]" : "bg-white/60"}`} />
        {s.text}
      </span>
    </li>
  );
}

function LevelMeter({ level, on }: { level: number; on: boolean }) {
  const bars = 12;
  const lit = Math.round(level * bars);
  return (
    <div className="flex h-5 items-end gap-[3px]" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className="w-[4px] rounded-full transition-colors duration-75" style={{ height: 5 + i * 1.2, background: on && i < lit ? (i > 9 ? "var(--gold)" : "var(--green)") : "rgba(255,255,255,.25)" }} />
      ))}
    </div>
  );
}

/** A parent with 2+ children: which of THEM are in this lesson? The hub's own list is narrowed to the child chosen in the header, so this asks
 *  for the un-narrowed list (the API only ever returns this parent's children). Null until known / when there is nothing to choose. */
function useKidsInLesson(lessonId: string, qs: string | undefined, enabled: boolean) {
  const [kids, setKids] = useState<{ childId: string; childName: string }[] | null>(null);
  useEffect(() => {
    if (!enabled || qs === undefined) return;
    let live = true;
    get<unknown>(`/api/learning-hub/lessons${withQs(qs, {})}`)
      .then((r) => { if (!live) return; const l = (Array.isArray(r) ? (r as Lesson[]) : []).find((x) => x.id === lessonId); setKids(l?.students ?? []); })
      .catch(() => { /* no picker — the server still refuses an ambiguous join (child_required) */ });
    return () => { live = false; };
  }, [lessonId, qs, enabled]);
  return kids;
}

export function Lobby({ lesson, isTutor, tutorLabel, attendees, topicLabel, joining, onJoin, onClose, qs }: {
  lesson: Lesson;
  isTutor: boolean;
  tutorLabel: string;
  attendees: string[];
  topicLabel?: string;
  joining: boolean;
  /** `asChildId` is set when the parent has more than one child in this lesson (the picker). */
  onJoin: (prefs: JoinPrefs, asChildId?: string) => void;
  onClose: () => void;
  /** The hub's `?tenantId=…` (a parent's lobby uses it to find which of their children are in this lesson). */
  qs?: string;
}) {
  const family = useFamily();
  const kids = useKidsInLesson(lesson.id, qs, !isTutor && family.active && family.multi);
  const choose = !isTutor && kids && kids.length > 1 ? kids : null;
  // Pre-select the child the hub shows only if a parent chose them on purpose; otherwise nobody is joined until they pick.
  const [pick, setPick] = useState<string | null>(null);
  const asChild = choose ? (pick && choose.some((k) => k.childId === pick) ? pick : family.confirmed && choose.some((k) => k.childId === family.childId) ? family.childId : null) : null;
  const needPick = !!choose && !asChild;
  const now = useNow(1000);
  const info = stageInfo(lesson, now, isTutor);
  const t = lessonTiming(lesson, now);
  const media = useMediaPreview(true);
  const video = useRef<HTMLVideoElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const me = isTutor ? tutorLabel : "You";

  useEffect(() => {
    const el = video.current;
    if (el) el.srcObject = media.stream;
  }, [media.stream]);

  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = o; document.removeEventListener("keydown", key); };
  }, [onClose]);

  const blocked = media.cam === "denied" || media.mic === "denied";
  const problem = blocked || media.cam === "missing" || media.mic === "missing" || media.cam === "busy" || media.mic === "busy" || media.cam === "unsupported";
  const showVideo = media.stream && media.cam === "ok";
  const camList = media.cams.length > 1, micList = media.mics.length > 1;
  const devLabel = (list: MediaDeviceInfo[], fallback: string) => list[0]?.label || fallback;
  const start = () => { if (needPick) return; media.release(); onJoin({ camOn: media.camOn && media.cam !== "denied" && media.cam !== "missing", micOn: media.micOn && media.mic !== "denied" && media.mic !== "missing" }, asChild ?? undefined); };

  const selectCls = `min-h-[44px] w-full rounded-xl border border-white/25 bg-white/10 px-3 text-[12.5px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-white [&>option]:text-[var(--ink)]`;

  return (
    <section id="hub-lobby" role="dialog" aria-modal="true" aria-label={`Get ready for ${lesson.title}`} data-stage={info.stage}
      className="fixed inset-0 z-[350] overflow-y-auto overscroll-contain p-3 text-white sm:p-6" style={HERO_BG}>
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={onClose} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3.5 text-[12.5px] font-bold backdrop-blur-sm hover:bg-white/20 ${FOCUS}`}><Ico name="arrowLeft" size={15} /> Live lessons</button>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/70">Before you join</div>
            <h2 className="m-0 truncate text-[20px] font-extrabold sm:text-[24px]" style={DISPLAY}>{lesson.title}</h2>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]">
          {/* ── self preview ── */}
          <div className="grid content-start gap-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/20 bg-[var(--brand-ink)] shadow-[0_18px_50px_rgba(0,0,0,0.3)] sm:aspect-video" data-testid="hub-lobby-preview">
              <video ref={video} autoPlay playsInline muted aria-label="Your camera preview" className={`absolute inset-0 h-full w-full object-cover ${showVideo && media.camOn ? "opacity-100" : "opacity-0"}`} style={{ transform: "scaleX(-1)" }} />
              {!(showVideo && media.camOn) && (
                <div className="absolute inset-0 grid place-content-center justify-items-center gap-3 px-6 text-center">
                  {media.cam === "pending" ? (
                    <>
                      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/25 border-t-white motion-reduce:animate-none" />
                      <div className="text-[13px] font-semibold text-white/85">Asking your browser for the camera…</div>
                    </>
                  ) : (
                    <>
                      <Person name={me} size={84} />
                      <div className="max-w-[320px] text-[13px] font-semibold text-white/80">
                        {media.cam === "off" ? "Your camera is off. Others will see your initials."
                          : media.cam === "denied" ? "Camera access is blocked — allow it to see yourself here."
                          : media.cam === "missing" ? "We couldn't find a camera. You can still join with audio."
                          : media.cam === "busy" ? "Another app is using your camera. Close it, then try again."
                          : "Camera preview isn't available in this browser."}
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" aria-hidden />
              <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-[12px] font-bold backdrop-blur-sm">
                <Person name={me} size={20} />{me}
              </div>
              <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3">
                <button type="button" onClick={media.toggleMic} disabled={media.mic === "denied" || media.mic === "missing" || media.mic === "pending"} aria-pressed={media.micOn} aria-label={media.micOn ? "Mute microphone" : "Unmute microphone"}
                  className={`grid h-12 w-12 place-items-center rounded-full border backdrop-blur-sm transition-transform active:scale-95 disabled:opacity-40 motion-reduce:transition-none ${FOCUS} ${media.micOn ? "border-white/30 bg-white/20 hover:bg-white/30" : "border-transparent bg-[var(--red)]"}`}>
                  <Ico name={media.micOn ? "mic" : "micOff"} size={20} />
                </button>
                <button type="button" onClick={media.toggleCam} disabled={media.cam === "denied" || media.cam === "missing" || media.cam === "pending"} aria-pressed={media.camOn} aria-label={media.camOn ? "Turn camera off" : "Turn camera on"}
                  className={`grid h-12 w-12 place-items-center rounded-full border backdrop-blur-sm transition-transform active:scale-95 disabled:opacity-40 motion-reduce:transition-none ${FOCUS} ${media.camOn ? "border-white/30 bg-white/20 hover:bg-white/30" : "border-transparent bg-[var(--red)]"}`}>
                  <Ico name={media.camOn ? "video" : "camOff"} size={20} />
                </button>
              </div>
              <div className="absolute bottom-4 right-4 hidden sm:block"><LevelMeter level={media.level} on={media.mic === "ok"} /></div>
            </div>

            {(camList || micList) && (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {camList && (
                  <label className="grid gap-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/70">Camera
                    <select className={selectCls} value={media.camId || media.cams[0]?.deviceId} onChange={(e) => media.setCamId(e.target.value)}>
                      {media.cams.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
                    </select>
                  </label>
                )}
                {micList && (
                  <label className="grid gap-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/70">Microphone
                    <select className={selectCls} value={media.micId || media.mics[0]?.deviceId} onChange={(e) => media.setMicId(e.target.value)}>
                      {media.mics.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>)}
                    </select>
                  </label>
                )}
              </div>
            )}

            {problem && (
              <div role="alert" className="rounded-2xl border border-white/25 bg-white/12 p-4 backdrop-blur-sm" data-testid="hub-lobby-help">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[var(--gold)] text-[var(--brand-ink)]"><Ico name="warning" size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-extrabold">{blocked ? "Your browser is blocking the camera or microphone" : media.cam === "busy" || media.mic === "busy" ? "Your camera or microphone is busy" : "We couldn't find everything"}</div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-white/85">You can still join — but fix this first and the lesson goes much smoother.</p>
                    <button type="button" aria-expanded={helpOpen} onClick={() => setHelpOpen((v) => !v)} className={`mt-2 inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 rounded-lg text-[12.5px] font-extrabold underline-offset-2 hover:underline ${FOCUS}`}>
                      How to fix it <Ico name="chevronDown" size={14} className={helpOpen ? "rotate-180" : ""} />
                    </button>
                    {helpOpen && (
                      <ol className="mt-1 list-decimal space-y-1.5 pl-5 text-[12.5px] leading-relaxed text-white/90">
                        <li>Click the camera or padlock icon at the left of the address bar.</li>
                        <li>Set <strong>Camera</strong> and <strong>Microphone</strong> to <strong>Allow</strong>.</li>
                        <li>Close other apps that may hold the camera (Zoom, Teams, FaceTime).</li>
                        <li>Press <strong>Check again</strong> below — no need to reload the page.</li>
                      </ol>
                    )}
                    <button type="button" onClick={media.retry} className={`mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-4 text-[13px] font-extrabold hover:bg-white/25 ${FOCUS}`}><Ico name="refresh" size={16} /> Check again</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── lesson + checks + join ── */}
          <div className="grid content-start gap-3">
            <div className="rounded-3xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm sm:p-5">
              <div className="flex items-start gap-3">
                <GradientTile icon="video" size={46} tone="glass" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-extrabold uppercase tracking-wide ${info.stage === "live" ? "bg-[var(--red)]" : "bg-white/20"}`}>
                      {info.stage === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" />}{info.pill}
                    </span>
                    {topicLabel && <span className="max-w-full truncate text-[11.5px] font-bold text-white/80">{topicLabel}</span>}
                  </div>
                  <div className="mt-1.5 text-[13px] text-white/85">{relDay(lesson.startsAt, now)} · {fmtClock(lesson.startsAt)}–{fmtClock(new Date(t.endMs).toISOString())} · {lesson.durationMins} min</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2.5 text-[12.5px] text-white/85">
                <Stack names={isTutor ? attendees : [tutorLabel]} size={28} />
                <span className="min-w-0 truncate">{isTutor ? (attendees.length ? attendees.join(", ") : "No students yet") : `with ${tutorLabel === "Your tutor" ? "your tutor" : tutorLabel}`}</span>
              </div>
              <p className="mt-3 rounded-xl bg-black/15 px-3 py-2 text-[12.5px] leading-relaxed text-white/90">{info.sub}</p>
              <LessonNotes lesson={lesson} isTutor={isTutor} tone="dark" className="mt-3" />
            </div>

            <ul className="grid gap-2" aria-label="Equipment check">
              <CheckRow icon={media.cam === "off" ? "camOff" : "video"} label="Camera" status={media.cam} detail={media.cam === "ok" ? devLabel(media.cams, "Camera ready") : undefined} />
              <CheckRow icon={media.mic === "off" ? "micOff" : "mic"} label="Microphone" status={media.mic} detail={media.mic === "ok" ? devLabel(media.mics, "Microphone ready") : undefined} />
            </ul>
            <div className="flex items-center gap-2 text-[11.5px] text-white/70 sm:hidden"><LevelMeter level={media.level} on={media.mic === "ok"} /><span>Say something to test your mic</span></div>
            <p className="flex items-center gap-2 text-[12px] text-white/70"><Ico name="headphones" size={15} /> Headphones stop echo — especially with more than one student.</p>

            {choose && (
              <div role="radiogroup" aria-label="Which child is joining?" data-testid="hub-lobby-who" className="rounded-2xl border border-white/25 bg-white/10 p-3.5 backdrop-blur-sm">
                <div className="mb-2 text-[13px] font-extrabold">Which child is joining?</div>
                <div className="flex flex-wrap gap-2">
                  {choose.map((k) => {
                    const on = asChild === k.childId;
                    return (
                      <button key={k.childId} type="button" role="radio" aria-checked={on} data-testid="hub-lobby-who-kid" data-child-id={k.childId} onClick={() => setPick(k.childId)}
                        className={`inline-flex min-h-[52px] items-center gap-2 rounded-2xl border-2 pl-1.5 pr-4 text-[14px] font-extrabold ${FOCUS} ${on ? "border-white bg-white text-[var(--brand-strong)]" : "border-transparent bg-white/15 text-white hover:border-white/60"}`}>
                        <Avatar name={k.childName} size={38} />{k.childName}
                      </button>
                    );
                  })}
                </div>
                <p className="m-0 mt-2 text-[12px] text-white/80">{needPick ? "Attendance and the whiteboard are recorded for the child you choose — pick one to join." : "Attendance and the whiteboard are recorded for this child. Another child can join from a second device."}</p>
              </div>
            )}

            <div className="sticky bottom-0 z-10 -mx-3 grid gap-3 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-6 sm:static sm:mx-0 sm:p-0" style={{ background: "linear-gradient(180deg, transparent, color-mix(in srgb, var(--brand-strong) 92%, transparent) 40%)" }}>
            <button type="button" id="hub-lobby-join" disabled={!info.canJoin || joining || needPick} onClick={start}
              className={`inline-flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-2xl px-6 text-[16px] font-extrabold shadow-[0_10px_28px_rgba(0,0,0,0.3)] transition hover:-translate-y-px disabled:cursor-not-allowed motion-reduce:transition-none motion-reduce:hover:transform-none ${FOCUS} ${info.canJoin ? "bg-white text-[var(--brand-strong)]" : "bg-white/20 text-white/80 shadow-none"}`}>
              <Ico name={info.canJoin ? "video" : "lock"} size={19} />
              {joining ? "Connecting…" : info.canJoin ? (info.cta ?? "Join lesson") : info.waiting ? (info.cta ?? "Waiting for your tutor") : `Opens in ${humanSpan(t.opensMs - now)}`}
            </button>
            {info.waiting && <p className="text-center text-[12px] text-white/75">{info.sub}</p>}
            {!info.canJoin && !info.waiting && <p className="text-center text-[12px] text-white/75">You can test your camera and microphone now — the room opens 10 minutes before the start.</p>}
            {info.canJoin && problem && <p className="text-center text-[12px] text-white/75">Joining without a working camera or microphone? You&rsquo;ll still see and hear everyone.</p>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
