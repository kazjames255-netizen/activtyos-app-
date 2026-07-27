import type { CSSProperties, ReactNode } from "react";

export function Card({
  children,
  className = "",
  style,
  id,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
}) {
  return (
    <div
      id={id}
      data-ui="card"
      className={`rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)] ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

// A Card with a titled header band, used by multi-section forms (e.g. the
// timetable setup wizard).
export function Panel({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-3.5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3">
        <h3 className="m-0 font-[var(--ff-display)] text-[15px] font-extrabold text-[var(--ink)]">
          {title}
        </h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
