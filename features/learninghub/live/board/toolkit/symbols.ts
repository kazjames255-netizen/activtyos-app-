// Special-character palettes. Tap to insert into the text being typed (or as a new text).
export interface SymbolSet { id: string; label: string; chars: string[]; note?: string }
export const SYMBOL_SETS: SymbolSet[] = [
  { id: "fr", label: "French", chars: ["é", "è", "ê", "ë", "à", "â", "ç", "î", "ï", "ô", "ù", "û", "ü", "œ", "«", "»", "É", "À", "Ç"] },
  { id: "es", label: "Spanish", chars: ["á", "é", "í", "ó", "ú", "ü", "ñ", "¿", "¡", "Á", "É", "Í", "Ó", "Ú", "Ñ"] },
  { id: "de", label: "German", chars: ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü", "€", "„", "“"] },
  { id: "it", label: "Italian / Portuguese", chars: ["à", "è", "é", "ì", "ò", "ù", "ã", "õ", "ç", "â", "ê", "ô", "á", "í", "ó", "ú"] },
  { id: "eng", label: "English", chars: ["’", "‘", "“", "”", "—", "–", "…", "£", "€", "?", "!", ";", ":", "(", ")", "@", "&"] },
  { id: "maths", label: "Maths", chars: ["²", "³", "√", "±", "≈", "≠", "≤", "≥", "×", "÷", "π", "θ", "∞", "°", "%", "¼", "½", "¾", "∑", "∫", "→", "∈", "∪", "∩", "∴"] },
  { id: "greek", label: "Greek", chars: ["α", "β", "γ", "δ", "ε", "θ", "λ", "μ", "π", "ρ", "σ", "τ", "φ", "ω", "Δ", "Σ", "Ω", "Φ", "Ψ"] },
  { id: "sci", label: "Science", chars: ["→", "⇌", "°", "Δ", "∞", "±", "≈", "µ", "Ω", "λ", "ν", "ρ", "√", "⁺", "⁻", "²", "³", "⁴", "₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉", "ₙ", "×", "·"] },
];
export const PACK_SYMBOLS: Record<string, string[]> = {
  general: ["eng"], maths: ["maths", "greek"], english: ["eng"], languages: ["fr", "es", "de", "it", "eng"], geography: ["maths"], history: ["eng"], science: ["sci", "greek", "maths"], mine: ["eng", "maths"],
};
