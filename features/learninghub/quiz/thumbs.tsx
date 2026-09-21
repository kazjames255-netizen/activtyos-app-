"use client";

import { QImage } from "../shared-assess/QuestionImage";
import type { Pic } from "../shared-assess/api";

/** A tutor-side thumbnail (bank card, builder row). Zooms in a lightbox on click. */
export function QuestionImage({ pic }: { pic: Pic }) {
  return <QImage pic={pic} fit="thumb" />;
}
