import { z } from "zod";
import { ukToday, isRealDay } from "./ukDate";

// The parent's child-profile payload (POST/PUT /api/my/children). Extracted verbatim from routes/my.ts so it can be unit tested.
export const childSchema = z.object({
  name: z.string().trim().min(1).max(80),
  age: z.number().int().min(0).max(17).optional(),
  // A real calendar date in the past (or blank). "banana" / a future date used to be stored, leave the child's age unknown, and so
  // skip the listing age gate on every booking.
  dob: z.string().trim().max(20).refine((v) => v === "" || (isRealDay(v) && v <= ukToday()), "Enter a real date of birth (not in the future)").optional(),
  school: z.string().trim().max(120).optional(),
  allergies: z.string().trim().max(300).optional(),
  medical: z.string().trim().max(300).optional(),
  send: z.string().trim().max(300).optional(),
  // Safeguarding: the word anyone other than the usual adult must give to
  // collect this child. Plain text on purpose — staff read it off the
  // register — so it must never be treated as, or reused as, a credential.
  collectionPassword: z.string().trim().max(60).optional(),
  /** The child's HMRC Tax-Free Childcare payment reference, saved once their
   *  account is linked so a returning family never links twice. Not a
   *  credential — it's the reference the money arrives under, which the
   *  provider already sees on the booking. */
  tfcReference: z.string().trim().max(40).optional(),
  /** Who to ring if the parent can't be reached. Either of them can fill it
   *  in — the provider usually takes it on the call. Split, because a
   *  register prints the name and dials the number. */
  emergencyName: z.string().trim().max(80).optional(),
  emergencyPhone: z.string().trim().max(40).optional(),
  // §K safeguarding record — entered once by the parent, surfaced to the
  // provider whose sessions the child attends.
  dietary: z.string().trim().max(300).optional(), // distinct from allergies
  swimming: z.enum(["none", "weak", "confident", "strong"]).optional(),
  careNotes: z.string().trim().max(500).optional(), // care & behaviour
  suncreamConsent: z.boolean().optional(),
  firstAidConsent: z.boolean().optional(),
  walkHomeConsent: z.boolean().optional(),
  // A SEND/EHCP plan, held by routes/childFiles.ts rather than inline: a real
  // EHCP is a multi-page scan and would blow Firestore's 1MB document cap.
  // Only the id and the filename live on the child.
  sendPlanId: z.string().trim().max(60).optional(),
  sendPlanName: z.string().trim().max(200).optional(),
  // What settles them and what doesn't — the things a parent tells you at the
  // door, kept so they don't have to say it twice.
  likes: z.string().trim().max(300).optional(),
  dislikes: z.string().trim().max(300).optional(),
  /** The child's chip colour keys on this. A free string, not an enum: the
   *  provider sets their own list (incl. "Prefer not to say"), so any fixed
   *  set is wrong for someone. */
  sex: z.string().trim().max(40).optional(),
  /** Provider-defined question answers (§N): question id → answer as a
   *  string. Strings survive a provider renaming an option; enums don't. */
  answers: z.record(z.string().max(60), z.string().max(2_000)).optional(),
  // Photo consent — safeguarding: may this child appear in photos
  // (Moments/newsfeed)? Defaults to NO (privacy-safe).
  photoConsent: z.boolean().optional().default(false),
  // Small avatar as a data URL (client resizes to ~128px). Placeholder until
  // the real file-storage milestone.
  photo: z
    .string()
    // Raster images only — not SVG, which can carry script (acceptance test d26s8).
    .regex(/^data:image\/(jpeg|png|webp|gif);base64,/, "Photo must be a JPEG, PNG, WebP or GIF")
    .max(150_000)
    .optional(),
});
