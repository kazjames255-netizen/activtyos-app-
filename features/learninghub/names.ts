// The page has two audiences and two names: providers and tutors work in the Teaching Hub; families and children learn in My Classroom.
export const TEACHING_HUB = "Teaching Hub";
export const MY_CLASSROOM = "My Classroom";
export const hubName = (mode: "student" | "tutor"): string => (mode === "student" ? MY_CLASSROOM : TEACHING_HUB);
