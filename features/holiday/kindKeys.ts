// Display-only catalogue keys for the canonical leave kinds / statuses (the stored values stay English: "annual", "approved"...).
// Shared by the operator Holiday planner, My leave and the Payroll screen so every leave label reads the same in every language.
import type { AbsenceKind, AbsenceStatus } from "@/lib/holiday";

export const KIND_KEY: Record<AbsenceKind, string> = {
  annual: "staffp.holKindAnnual", sickness: "staffp.holKindSickness", toil: "staffp.holKindToil", unpaid: "staffp.holKindUnpaid",
  maternity: "staffp.holKindMaternity", adoption: "staffp.holKindAdoption", parental: "staffp.holKindParental",
  bereavement: "staffp.holKindBereavement", other: "staffp.holKindOther",
};
export const STATUS_KEY: Record<AbsenceStatus, string> = { pending: "staffp.holStPending", approved: "staffp.holStApproved", declined: "staffp.holStDeclined", cancelled: "staffp.holStCancelled" };
