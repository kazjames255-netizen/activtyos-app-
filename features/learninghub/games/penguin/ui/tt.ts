"use client";
import { useCallback } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useHubMessagesReady } from "@/lib/i18n/hubMessages";
import { pickPlural } from "@/lib/i18n/plural";
import { GAME_TITLE } from "../theme";
import { HOST_NAME } from "../characters/host";

export type TT = (k: string, v?: Record<string, string | number>) => string;
export type TPl = (base: string, n: number, v?: Record<string, string | number>) => string;
/** Every word in the game comes through here: the `hubgames` catalogue, with {game} and {mascot} always filled in from their ONE constants. */
export function useGameT(skin: "junior" | "explorer" = "junior") {
  const { locale, t } = useI18n();
  useHubMessagesReady(locale);
  // Explorer speaks in a shorter, older voice: a catalogue key `<key>__x` overrides `<key>` when the child has chosen the Explorer look (and falls back to the shared wording when there is none)
  const T: TT = useCallback((k, v) => {
    const vars = { game: GAME_TITLE, mascot: HOST_NAME, ...v };
    if (skin === "explorer") { const xk = `hubgames.${k}__x`; const r = t(xk, vars); if (r && r !== xk) return r; }
    return t(`hubgames.${k}`, vars);
  }, [t, skin]);
  const TP: TPl = useCallback((base, n, v) => pickPlural((k, vv) => t(`hubgames.${k}`, { game: GAME_TITLE, mascot: HOST_NAME, ...vv }), locale, base, n, v), [t, locale]);
  return { T, TP, locale };
}
