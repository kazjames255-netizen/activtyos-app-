import { uiTime, uiDate } from "@/lib/i18n/format";
// Pure UK-time formatters for online sessions. The product runs on UK wall-clock time (booking cards, provider screens, emails), so a session must read
// the same for a family or host whose browser is set to another timezone (a 14:55 session used to read 17:55 on the panel in Dubai).
export const UK_TZ = "Europe/London";
export const ukClock = (iso: string, locale: string) => uiTime(new Date(iso), { hour: "numeric", minute: "2-digit", timeZone: UK_TZ }, locale);
export const ukDay = (iso: string, locale: string) => uiDate(new Date(iso), { weekday: "short", day: "numeric", month: "short", timeZone: UK_TZ }, locale);
