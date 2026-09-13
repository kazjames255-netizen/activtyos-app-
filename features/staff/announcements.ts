"use client";

// Staff announcements — the internal notice board posted by managers and read
// by staff. Distinct from the parent-facing newsfeed: this is the STAFF
// audience (the operator composes it from Newsfeed → "To staff").
//
// Server-backed since 12 Sept (GET/POST /api/staff-announcements, plus
// /:id/read). It used to be the posting browser's localStorage, so a post
// reached nobody, and every staff board showed three made-up seed notices.

import { get as apiGet, post as apiPost } from "@/lib/api";

export interface Announcement {
  id: string;
  author: string;          // who posted (name)
  role: string;            // their role/title label, e.g. "Camp Manager"
  title: string;
  body: string;
  date: string;            // ISO date (yyyy-mm-dd)
  audienceLabel?: string;  // e.g. "All staff · Riverside Club"
  pinned?: boolean;
  important?: boolean;
  /** Has THIS viewer read it (server, per person). */
  read?: boolean;
  /** Managers only: how many have read it. */
  readCount?: number;
}

/** The board, newest first, with the caller's own read state. */
export const fetchAnnouncements = () => apiGet<Announcement[]>("/api/staff-announcements");

/** Post to the board — the server bells every member of staff in scope. */
export const postAnnouncement = (input: { author?: string; role?: string; title: string; body: string; audienceLabel?: string; pinned?: boolean; important?: boolean }) =>
  apiPost<Announcement>("/api/staff-announcements", input);

/** Record that I've read it. */
export const markAnnouncementRead = (id: string) => apiPost<{ ok: true }>(`/api/staff-announcements/${encodeURIComponent(id)}/read`, {});
