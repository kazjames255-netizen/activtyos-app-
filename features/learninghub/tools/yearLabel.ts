/** "Year 5" → 5 (1–13), anything else → null. */
export const yearFromLabel = (label: string | null | undefined): number | null => { const m = /(\d{1,2})/.exec(label ?? ""); const n = m ? Number(m[1]) : NaN; return n >= 1 && n <= 13 ? n : null; };
