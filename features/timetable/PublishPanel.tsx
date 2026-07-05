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

export function PublishPanel() {
  const share = useTimetableStore((s) => s.share);
  const audience = useTimetableStore((s) => s.audience);
  const pubStatus = useTimetableStore((s) => s.pubStatus);
  const toggleShare = useTimetableStore((s) => s.toggleShare);
  const setAudience = useTimetableStore((s) => s.setAudience);
  const publish = useTimetableStore((s) => s.publish);
  const setTab = useTimetableStore((s) => s.setTab);

  const Row = ({ k, title, desc }: { k: string; title: string; desc: string }) => (
    <div
      onClick={() => toggleShare(k)}
      className="mb-2.5 flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3"
    >
      <Toggle on={!!share[k]} />
      <div>
        <div className="text-[13px] font-bold text-[var(--ink)]">{title}</div>
        <div className="text-[11.5px] text-[var(--ink-3)]">{desc}</div>
      </div>
    </div>
  );

  return (
    <div>
      <button onClick={() => setTab(1)} className="mb-3.5 cursor-pointer text-[12.5px] font-bold text-[var(--ink-2)]">
        ← Back to timetable
      </button>
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="mb-3.5 text-[13px] leading-relaxed text-[var(--ink-2)]">
          Publish the finished week so staff see the sessions they’re running and parents see the day plan for the days
          their child is booked.
        </div>
        <Row k="staff" title="Publish to the Staff portal" desc="Each staff member sees their assigned sessions in their own Timetable." />
        <Row k="parents" title="Share with Parents" desc="Shows on the customer portal timetable for their booked days." />

        <div className="mb-1 mt-1.5 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">
          Parent audience
        </div>
        <div className="flex flex-wrap gap-4">
          {(["booked", "everyone"] as const).map((a) => (
            <label key={a} className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--ink-2)]">
              <input type="radio" name="ttbAud" checked={audience === a} onChange={() => setAudience(a)} />
              {a === "booked" ? "Booked families only" : "Everyone viewing the listing"}
            </label>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={publish}
            className="rounded-full bg-[var(--cta,#e22295)] px-4 py-2 text-[12.5px] font-bold text-white"
          >
            Publish timetable
          </button>
          {pubStatus && <span className="text-[12px] text-[var(--ink-3)]">{pubStatus}</span>}
        </div>
      </div>
    </div>
  );
}
