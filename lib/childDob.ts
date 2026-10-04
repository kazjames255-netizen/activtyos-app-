import { dobRequired as settingsDobRequired, type ChildQuestion, type TenantSettings } from "@/lib/settings";

/**
 * Is a child's date of birth compulsory at checkout / on the child form?
 * Follows the provider's Setup toggle (requireDob); an age-gated question forces it on.
 * Missing settings (not loaded yet) read as REQUIRED, the safe default.
 *
 * Wire-up for features/listings/checkout.tsx:  const needDob = dobRequired(settings, allQuestions);
 */
export function dobRequired(settings: TenantSettings | null | undefined, questions: ChildQuestion[] = []): boolean {
  if (!settings) return true;
  return settingsDobRequired(settings, questions).required;
}

/** Message keys for what stops working for a child without a DOB (shown in Setup's warning). */
export const DOB_OPTIONAL_LOSSES = [
  "p8set.dobLossAgeRange",
  "p8set.dobLossAgeCaps",
  "p8set.dobLossRatios",
  "p8set.dobLossGroups",
  "p8set.dobLossCard",
] as const;
