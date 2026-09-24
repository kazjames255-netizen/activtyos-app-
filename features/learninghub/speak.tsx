"use client";

// Read-aloud (R-2): the browser's own speechSynthesis, en-GB, never auto-plays, stops on unmount / navigation.
// One utterance at a time across the page: starting another (or unmounting) cancels the current one.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const supported = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

/** Speak `text` (en-GB). Returns false when the browser can't. */
export function speakText(text: string, rate = 0.9, onEnd?: () => void): boolean {
  try {
    if (!supported()) return false;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB"; u.rate = rate;
    const voice = synth.getVoices().find((v) => v.lang === "en-GB" || v.lang === "en_GB");
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
export function SpeakButton({ text, label = "Read aloud", size = 44, className = "", testId }: { text: string; label?: string; size?: number; className?: string; testId?: string }) {
  const { available, speaking, say, stop } = useSpeak();
  if (!available || !text.trim()) return null;
  return (
    <button type="button" data-testid={testId ?? "hub-read-aloud"} aria-label={speaking ? `Stop reading: ${label}` : label} aria-pressed={speaking}
      onClick={(e) => { e.stopPropagation(); if (speaking) stop(); else say(text); }}
      style={{ minWidth: Math.max(44, size), minHeight: Math.max(44, size) }}
      className={`inline-flex flex-none items-center justify-center rounded-full border-2 border-[var(--brand-line)] bg-[var(--surface)] text-[20px] text-[var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)] focus-visible:outline ${className}`}>
      <span aria-hidden="true">{speaking ? "■" : "🔊"}</span>
    </button>
  );
}
