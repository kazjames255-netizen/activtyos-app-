// Checkout wallet choice (9 Oct 2026). The family is ASKED whether to spend their credit with this provider; nothing is applied silently.
// Pure helpers only (no money rules: the server clamps and re-prices). `avail` = the most that could come off this booking
// (min(balance, total after codes)); it is computed by the checkout and passed in.

export type WalletChoice = "use" | "part" | "keep" | null;

const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : 0));

/** The card is shown (and a choice required) only when there is credit that could be spent on this booking. */
export function walletChoiceRequired(parentMode: boolean, avail: number): boolean {
  return parentMode && avail > 0.004;
}

/** True while the parent still has to answer: the button stays disabled and says so. */
export function walletChoiceMissing(parentMode: boolean, avail: number, choice: WalletChoice): boolean {
  return walletChoiceRequired(parentMode, avail) && choice === null;
}

/** How much credit comes off this booking for the current choice. No choice yet = nothing (never the old silent "all"). */
export function walletAppliedFor(choice: WalletChoice, part: number, avail: number): number {
  const a = Math.max(0, avail);
  if (choice === "use") return r2(a);
  if (choice === "part") return r2(clamp(part, 0, a));
  return 0;
}

/** The figure the browser sends as walletCap: ALWAYS a number (0 = do not use), never undefined/null. */
export function walletCapToSend(parentMode: boolean, choice: WalletChoice, part: number, avail: number): number {
  return parentMode ? walletAppliedFor(choice, part, avail) : 0;
}

/** Credit left with the provider after this booking. */
export function walletLeftAfter(balance: number, applied: number): number {
  return r2(Math.max(0, balance - applied));
}

/** The credit alone pays the whole booking. */
export function walletCoversWhole(avail: number, afterCode: number): boolean {
  return afterCode > 0 && avail + 0.004 >= afterCode;
}

/** A sensible starting point for the "use part of it" slider: half, to the penny. */
export function defaultPart(avail: number): number {
  return r2(Math.max(0, avail) / 2);
}

/** If the amount that could be spent shrinks (a code was added), a chosen part must follow it down. */
export function clampPart(part: number, avail: number): number {
  return r2(clamp(part, 0, Math.max(0, avail)));
}

/** Multi-block basket (one POST per block): what to offer on the next POST = the chosen total minus what earlier POSTs actually spent. */
export function walletRemaining(chosen: number, spentSoFar: number): number {
  return r2(Math.max(0, chosen - spentSoFar));
}
