"use client";

import { useTimetableStore } from "./store";

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`relative inline-block h-5 w-9 flex-none rounded-full transition-colors ${
        on ? "bg-[var(--brand)]" : "bg-[var(--line)]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`}
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
  const published = !!pubStatus && pubStatus.startsWith("Published ✓");

  return (
    <div>
      <button onClick={() => setTab(1)} className="mb-3.5 cursor-pointer text-[12.5px] font-bold text-[var(--ink-2)]">
        ← Back to timetable
      </button>

      {/* Post-publish success — gives the flow somewhere to land. */}
      {published && (
        <div className="mb-3.5 overflow-hidden rounded-2xl border border-[var(--green-line,#bfe9d2)] bg-white">
          <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: "linear-gradient(120deg,#12995a,#37cf83)" }}>
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white/25 text-[17px]">✓</span>
            <div>
              <div className="text-[14px] font-extrabold">Timetable published</div>
              <div className="text-[11.5px] text-white/85">{pubStatus.replace("Published ✓ · ", "")}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <button
              onClick={() => setTab(3)}
              className="rounded-full px-4 py-2 text-[12.5px] font-bold text-white"
              style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}
            >
              Go to My timetables →
            </button>
            <button onClick={() => setTab(1)} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-[12.5px] font-bold text-[var(--ink-2)]">
              Back to the builder
            </button>
            {toParents && (
              <span className="text-[11.5px] text-[var(--ink-3)]">
                Families {audience === "booked" ? "with a booking" : "viewing the listing"} can see it on their Timetable now.
              </span>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="mb-3.5 text-[13px] leading-relaxed text-[var(--ink-2)]">
          Publish the finished week so staff see the sessions they’re running and parents see the day plan for the days
          their child is booked.
        </div>
        <ToggleRow on={!!share.staff} onClick={() => toggleShare("staff")} title="Publish to the Staff portal" desc="The team sees the published day plans in their own Timetable." />
        <ToggleRow on={!!share.parents} onClick={() => toggleShare("parents")} title="Share with Parents" desc="Shows on the family's Timetable for the days their child is booked." />

        {toParents && (
          <>
            <div className="mb-1 mt-1.5 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">
              Parent audience
            </div>
            <div className="mb-3.5 flex flex-wrap gap-4">
              {(["booked", "everyone"] as const).map((a) => (
                <label key={a} className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--ink-2)]">
                  <input type="radio" name="ttbAud" checked={audience === a} onChange={() => setAudience(a)} />
                  {a === "booked" ? "Booked families only" : "Everyone viewing the listing"}
                </label>
              ))}
            </div>

            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">
              Notify families
            </div>
            <div className="mb-1 text-[11.5px] text-[var(--ink-3)]">
              When you publish, let {audience === "booked" ? "booked" : "these"} families know their week is ready.
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <ToggleRow small on={notifyEmail} onClick={() => setNotify({ email: !notifyEmail })} title="✉️ Email" desc="A short email with the published week." />
              <ToggleRow small on={notifyPush} onClick={() => setNotify({ push: !notifyPush })} title="🔔 In-app notification" desc="A bell alert in their dashboard." />
            </div>
          </>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => void publish()}
            disabled={publishing}
            className="rounded-full px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}
          >
            {publishing ? "Publishing…" : published ? "Re-publish with changes" : "Publish timetable"}
          </button>
          {pubStatus && !published && <span className="text-[12px] text-[var(--ink-3)]">{pubStatus}</span>}
        </div>
      </div>
    </div>
  );
}
