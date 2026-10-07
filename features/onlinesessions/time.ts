// Pure UK-time formatters for online sessions. The product runs on UK wall-clock time (booking cards, provider screens, emails), so a session must read
// the same for a family or host whose browser is set to another timezone (a 14:55 session used to read 17:55 on the panel in Dubai).
export const UK_TZ = "Europe/London";
export const ukClock = (iso: string, locale: string) => new Date(iso).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", timeZone: UK_TZ });
export const ukDay = (iso: string, locale: string) => new Date(iso).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: UK_TZ });
