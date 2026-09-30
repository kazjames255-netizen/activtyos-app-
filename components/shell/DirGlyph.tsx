"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { isRTL } from "@/lib/i18n/config";

/** A directional glyph (→ › ▸ …) that mirrors itself in right-to-left languages (Arabic, Urdu). */
export function DirGlyph({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { locale } = useI18n();
  return <span aria-hidden className={`inline-block ${className}`} style={isRTL(locale) ? { transform: "scaleX(-1)" } : undefined}>{children}</span>;
}
