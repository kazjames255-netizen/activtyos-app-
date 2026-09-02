// English is the source-of-truth catalogue. Every key that gets internationalised
// is added here first (with its English text); other locales mirror the same keys.
// A missing key in any locale falls back to English, then to the key itself.
const en = {
  common: {
    signOut: "Sign out",
    save: "Save",
    cancel: "Cancel",
    language: "Language",
    chooseLanguage: "Choose language",
  },
  header: {
    messages: "Messages",
    messageProvider: "Message {name}",
    browse: "Browse activities",
    myBookings: "My bookings",
    memberships: "Memberships",
    bookings: "Bookings",
    announcements: "Announcements",
    families: "Families",
    contactParents: "Contact parents",
    findChild: "Find a child",
    reportBug: "Report a bug",
  },
};

export type Messages = typeof en;
export default en;
