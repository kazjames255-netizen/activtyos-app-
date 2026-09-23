import type { HubSettings } from "@/lib/hubConfig";
import type { HubFilter, HubGroup, Student, Topic } from "./types";

/** What every hub panel receives from the shell (LearningHubApp). A panel is a
 *  self-contained module in this folder: it fetches its own data through
 *  lib/api.ts, subscribes with useRealtime, and never reaches outside `props`
 *  for tenancy — `qs` ("?tenantId=…") is already correct for the caller and is
 *  appended to every /api/learning-hub call (tutors: ignored server-side).
 *  See docs/learning-hub.md for the API each panel talks to. */
export interface PanelProps {
  tenantId: string;
  /** "?tenantId=<id>" — append to every /api/learning-hub path (add &childId=… after it). */
  qs: string;
  /** Tutor mode (author/mark) vs student (parent) mode. */
  canEdit: boolean;
  /** Tutor mode, but the account may only LOOK (a staff role with "View" on the Learning Hub): render the tutor screens with every
   *  write control hidden — the server refuses each write with a 403. Never set for a family. */
  readOnly?: boolean;
  /** Tutor: the caller's franchise (null = tenant-level / head office). A franchise's page shows head-office content read-only. */
  franchiseId?: string | null;
  /** Tutor: the caller's own login id and portal role — what "My students / My lessons" match `tutorUid` against. */
  me?: { uid: string; role: string } | null;
  /** Every topic this caller may see, and the sidebar filter over them. */
  topics: Topic[];
  filter: HubFilter;
  /** Topic ids the filter covers (a topic includes its subtopics; none selected = all). */
  covered: Set<string>;
  /** Tutor: the roster. Parent: their own enrolled children here. */
  students: Student[];
  /** Parent mode: the child currently chosen in the header (always set when the
   *  parent has ≥1 child). Tutor mode: null — panels take a student per action. */
  childId: string | null;
  /** The tenant's hub config (question kinds, pass mark, mastery bands…). */
  config: HubSettings;
  /** Surface an error banner on the page. */
  onError: (msg: string) => void;
  // ── additive (shell F1) ────────────────────────────────────────────────
  /** "tutor" (author/mark) or "student" (a parent reading for their child). */
  mode?: "tutor" | "student";
  /** The provider's display name. */
  providerName?: string;
  /** Parent mode: the chosen child's roster row (subjects etc.); null for tutors. */
  child?: Student | null;
  /** Refetch the roster (after the panel changed an enrolment). */
  refreshStudents?: () => void;
  /** Jump to another hub tab (e.g. "notes"). */
  goTo?: (key: PanelMeta["key"]) => void;
  /** Focus mode: a panel asks the shell to hide the hero + subject sidebar while the
   *  student is mid-task (taking a quiz, reviewing flashcards, in a lesson). Call
   *  setFocus(true) on entering and ALWAYS setFocus(false) on leaving/unmount. */
  setFocus?: (on: boolean, opts?: { bare?: boolean }) => void;
  // (bare = also hide the "focus mode" bar — the panel draws its own header, e.g. a call in the page.)
  /** "?tenantId=…&childId=…" for a parent with a chosen child, else same as `qs`.
   *  Use when a call should be narrowed to the child; append further params with "&". */
  childQs?: string;
  /** Tutor: the tutor's student groups (contract §7). Empty for parents / when none exist. */
  groups?: HubGroup[];
  /** Refetch the groups (after the panel changed one). */
  refreshGroups?: () => void;
}

export interface PanelMeta {
  key: "home" | "live" | "dashboard" | "diagnostic" | "quizzes" | "homework" | "notes" | "flashcards" | "students" | "questions";
  label: string;
  icon: string;
  /** "soon" renders greyed with the blurb (never hidden); flip to "live" when built. */
  status: "live" | "soon";
  blurb: string;
}
