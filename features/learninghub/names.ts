// The page has two audiences and two names: providers and tutors work in the Teaching Hub; families and children learn in the Learning Hub.
export const TEACHING_HUB = "Teaching Hub";
export const MY_CLASSROOM = "Learning Hub";
export const hubName = (mode: "student" | "tutor"): string => (mode === "student" ? MY_CLASSROOM : TEACHING_HUB);
