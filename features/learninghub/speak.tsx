"use client";

// Read-aloud (R-2): the browser's own speechSynthesis, in the active UI language (en-GB for English), never auto-plays, stops on unmount / navigation.
// One utterance at a time across the page: starting another (or unmounting) cancels the current one.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/provider";

const supported = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

const SPEECH_LANG: Record<string, string> = { en: "en-GB", pl: "pl-PL", ro: "ro-RO", ur: "ur-PK", pa: "pa-IN", bn: "bn-BD", ar: "ar-SA", pt: "pt-PT", es: "es-ES", fr: "fr-FR", cy: "cy-GB" };
/** The speech language for the active locale (the provider mirrors it on <html lang>). */
const speechLang = () => SPEECH_LANG[(typeof document !== "undefined" ? document.documentElement.lang : "").split("-")[0] || "en"] ?? "en-GB";

/** Speak `text` in the active UI language. Returns false when the browser can't. */
export function speakText(text: string, rate = 0.9, onEnd?: () => void): boolean {
  try {
    if (!supported()) return false;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const lang = speechLang();
    u.lang = lang; u.rate = rate;
    const norm = (l: string) => l.replace("_", "-").toLowerCase();
    const voices = synth.getVoices();
    const voice = voices.find((v) => norm(v.lang) === lang.toLowerCase()) ?? voices.find((v) => norm(v.lang).split("-")[0] === lang.split("-")[0].toLowerCase());
    if (voice) u.voice = voice;
    u.onend = () => onEnd?.(); u.onerror = () => onEnd?.();
    synth.speak(u);
    return true;
  } catch { return false; }
}
export const stopSpeaking = () => { try { if (supported()) window.speechSynthesis.cancel(); } catch { /* nothing to stop */ } };

/** `available` is false on the server and on browsers without speech, so a button can simply not render. */
export function useSpeak() {
  const available = useSyncExternalStore(() => () => {}, supported, () => false); // false on the server, so no hydration mismatch
  const [speaking, setSpeaking] = useState(false);
  const mine = useRef(false);
  useEffect(() => () => { if (mine.current) stopSpeaking(); }, []);
  const stop = useCallback(() => { stopSpeaking(); mine.current = false; setSpeaking(false); }, []);
  const say = useCallback((text: string) => {
    if (!text.trim()) return;
    mine.current = true; setSpeaking(true);
    if (!speakText(text, 0.9, () => { mine.current = false; setSpeaking(false); })) { mine.current = false; setSpeaking(false); }
  }, []);
  return { available, speaking, say, stop };
}

/** A speaker button (44px+). Toggles: tap to hear `text`, tap again to stop. Renders nothing when speech is unavailable. */
export function SpeakButton({ text, label: labelIn, size = 44, className = "", testId }: { text: string; label?: string; size?: number; className?: string; testId?: string }) {
  const tr = useT();
  const label = labelIn ?? tr("hubshell.k_readAloud");
  const { available, speaking, say, stop } = useSpeak();
  if (!available || !text.trim()) return null;
  return (
    <button type="button" data-testid={testId ?? "hub-read-aloud"} aria-label={speaking ? tr("hubshell.k_stopReading", { label }) : label} aria-pressed={speaking}
      onClick={(e) => { e.stopPropagation(); if (speaking) stop(); else say(text); }}
      style={{ minWidth: Math.max(44, size), minHeight: Math.max(44, size) }}
      className={`inline-flex flex-none items-center justify-center rounded-full border-2 border-[var(--brand-line)] bg-[var(--surface)] text-[20px] text-[var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)] focus-visible:outline ${className}`}>
      <span aria-hidden="true">{speaking ? "■" : "🔊"}</span>
    </button>
  );
}
