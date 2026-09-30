"use client";

import { useTimetableStore } from "./store";
import { useT } from "@/lib/i18n/provider";
import { Rich } from "@/features/setup/Rich";

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`relative inline-block h-5 w-9 flex-none rounded-full transition-colors ${
        on ? "bg-[var(--brand)]" : "bg-[var(--line)]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "start-[18px]" : "start-0.5"}`}
      />
    </span>
  );
}

function ToggleRow({ on, onClick, title, desc, small }: { on: boolean; onClick: () => void; title: string; desc: string; small?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 ${small ? "py-2.5" : "mb-2.5 py-3"}`}
    >
      <Toggle on={on} />
      <div>
        <div className={`font-bold text-[var(--ink)] ${small ? "text-[12.5px]" : "text-[13px]"}`}>{title}</div>
        <div className={`text-[var(--ink-3)] ${small ? "text-[11px]" : "text-[11.5px]"}`}>{desc}</div>
      </div>
    </div>
  );
}

export function PublishPanel() {
  const t = useT();
  const share = useTimetableStore((s) => s.share);
  const audience = useTimetableStore((s) => s.audience);
  const notifyEmail = useTimetableStore((s) => s.notifyEmail);
  const notifyPush = useTimetableStore((s) => s.notifyPush);
  const pubStatus = useTimetableStore((s) => s.pubStatus);
  const publishing = useTimetableStore((s) => s.publishing);
  const toggleShare = useTimetableStore((s) => s.toggleShare);
  const setAudience = useTimetableStore((s) => s.setAudience);
  const setNotify = useTimetableStore((s) => s.setNotify);
  const publish = useTimetableStore((s) => s.publish);
  const setTab = useTimetableStore((s) => s.setTab);

  const toParents = !!share.parents;
  const published = !!pubStatus && pubStatus.includes("✓");

  return (
    <div>
      <button onClick={() => setTab(1)} className="mb-3.5 cursor-pointer text-[12.5px] font-bold text-[var(--ink-2)]">
        {t("p8set.pbBack")}
      </button>

      {/* Post-publish success — gives the flow somewhere to land. */}
      {published && (
        <div className="mb-3.5 overflow-hidden rounded-2xl border border-[var(--green-line,#bfe9d2)] bg-white">
          <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: "linear-gradient(120deg,#12995a,#37cf83)" }}>
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white/25 text-[17px]">✓</span>
            <div>
              <div className="text-[14px] font-extrabold">{t("p8set.pbPublished")}</div>
              <div className="text-[11.5px] text-white/85">{pubStatus.replace(/^[^✓]*✓\s*·\s*/, "")}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <button
              onClick={() => setTab(3)}
              className="rounded-full px-4 py-2 text-[12.5px] font-bold text-white"
              style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}
            >
              {t("p8set.pbGoMine")}
            </button>
            <button onClick={() => setTab(1)} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-[12.5px] font-bold text-[var(--ink-2)]">
              {t("p8set.pbBackBuilder")}
            </button>
            {toParents && (
              <span className="text-[11.5px] text-[var(--ink-3)]">
                {audience === "booked" ? t("p8set.pbFamSeeBooked") : t("p8set.pbFamSeeAll")}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="mb-3.5 text-[13px] leading-relaxed text-[var(--ink-2)]">
          {t("p8set.pbIntro")}
        </div>
        <ToggleRow on={!!share.staff} onClick={() => toggleShare("staff")} title={t("p8set.pbToStaff")} desc={t("p8set.pbToStaffD")} />
        <ToggleRow on={!!share.parents} onClick={() => toggleShare("parents")} title={t("p8set.pbToParents")} desc={t("p8set.pbToParentsD")} />

        {toParents && (
          <>
            <div className="mb-1 mt-1.5 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">
              {t("p8set.pbAudience")}
            </div>
            <div className="mb-3.5 flex flex-wrap gap-4">
              {(["booked", "everyone"] as const).map((a) => (
                <label key={a} className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--ink-2)]">
                  <input type="radio" name="ttbAud" checked={audience === a} onChange={() => setAudience(a)} />
                  {a === "booked" ? t("p8set.pbAudBooked") : t("p8set.pbAudEveryone")}
                </label>
              ))}
            </div>

            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">
              {t("p8set.pbNotify")}
            </div>
            <div className="mb-1 text-[11.5px] text-[var(--ink-3)]">
              {audience === "booked" ? t("p8set.pbNotifyBooked") : t("p8set.pbNotifyThese")}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <ToggleRow small on={notifyEmail} onClick={() => setNotify({ email: !notifyEmail })} title={t("p8set.pbEmail")} desc={t("p8set.pbEmailD")} />
              <ToggleRow small on={notifyPush} onClick={() => setNotify({ push: !notifyPush })} title={t("p8set.pbBell")} desc={t("p8set.pbBellD")} />
            </div>
            {/* The publish endpoint accepts these two flags and does nothing with
                them yet (explicit TODO in routes/timetables.ts). Saying so here is
                the difference between "I told the families" and "I believed I
                had" — the timetable is the one thing a parent plans their week
                around. Remove this the moment the send lands. */}
            {(notifyEmail || notifyPush) && (
              <div className="mt-2 rounded-lg border border-[#f0d9a8] bg-[#fdf6e6] px-3 py-2 text-[11.5px] leading-[1.55] text-[#7a5b06]">
                <Rich k="p8set.pbNotSending" slots={{}} />
              </div>
            )}
          </>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => void publish()}
            disabled={publishing}
            className="rounded-full px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}
          >
            {publishing ? t("p8set.pbPublishing") : published ? t("p8set.pbRepublish") : t("p8set.pbPublishBtn")}
          </button>
          {pubStatus && !published && <span className="text-[12px] text-[var(--ink-3)]">{pubStatus}</span>}
        </div>
      </div>
    </div>
  );
}
