import { SHOTS } from "./shots.gen";
import type { Shot } from "./types";

type Row = { src: string; w: number; h: number; device: string };
const FALLBACK: Row = { src: "", w: 1440, h: 900, device: "desktop" };
export type ShotName = string;
/** A captured real screen, by name (public/how-it-works/<name>.webp). `url` is the address shown in the little browser bar.
 *  Never throws: an unknown name gives an empty picture (the spec checks every name exists). */
export const shot = (name: ShotName, url?: string): Shot => {
  const r = (SHOTS as unknown as Record<string, Row>)[name] ?? FALLBACK;
  return { src: r.src, w: r.w, h: r.h, device: r.device === "phone" ? "phone" : "desktop", url };
};
export const shotExists = (name: string): boolean => name in (SHOTS as object);
