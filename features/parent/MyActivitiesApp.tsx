"use client";

import { ScheduleApp } from "./ScheduleApp";
import { PaymentsApp } from "./PaymentsApp";

/**
 * custdash/schedule — one page for the two things a parent checks most: where
 * their child needs to be (Schedule, with its own child filters + booking
 * controls) and what the family owes/has paid (Payments), stacked below.
 * Replaces the separate Payments nav item.
 */
export function MyActivitiesApp() {
  return (
    <div>
      <ScheduleApp />
      <div className="mx-auto my-7 max-w-[1100px] border-t border-[var(--line)]" />
      <PaymentsApp />
    </div>
  );
}
