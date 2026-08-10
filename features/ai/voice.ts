"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Same narrator as the guided tours: Google UK English Female where available,
// else the closest British female / en-GB voice.
export function pickBritishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const vs = window.speechSynthesis.getVoices();
  if (!vs.length) return null;
  return vs.find((v) => v.name === "Google UK English Female")
    || vs.find((v) => /en-GB/i.test(v.lang) && /female|Sonia|Serena|Kate|Fiona|Libby|Hazel/i.test(v.name))
    || vs.find((v) => /en-GB/i.test(v.lang))
    || vs.find((v) => /^en/i.test(v.lang)) || vs[0];
}

// Strip markdown so the voice reads clean prose (bullets, bold, links, etc.).
function forSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>]/g, " ")
    .replace(/^\s*[-•]\s+/gm, ", ")
    .replace(/[—–]/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Text-to-speech in the co-pilot's voice, with a `speaking` flag for the mouth. */
export function useTts() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (!supported) return;
    const set = () => { voiceRef.current = pickBritishVoice(); };
    set();
    window.speechSynthesis.onvoiceschanged = set;
    return () => { window.speechSynthesis.onvoiceschanged = null; window.speechSynthesis.cancel(); };
  }, [supported]);

  const cancel = useCallback(() => { if (supported) window.speechSynthesis.cancel(); setSpeaking(false); }, [supported]);

  const speak = useCallback((text: string, onend?: () => void) => {
    const clean = forSpeech(text || "");
    if (!supported || !clean) { onend?.(); return; }
    const s = window.speechSynthesis;
    s.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    if (voiceRef.current) { u.voice = voiceRef.current; u.lang = voiceRef.current.lang; }
    u.rate = 1.0; u.pitch = 1.05;
    u.onstart = () => setSpeaking(true);
    u.onend = () => { setSpeaking(false); onend?.(); };
    u.onerror = () => { setSpeaking(false); onend?.(); };
    s.speak(u);
  }, [supported]);

  return { supported, speaking, speak, cancel };
}

/** Microphone dictation via the Web Speech API (Chrome/Edge/Safari). */
export function useMic(onFinal: (text: string) => void) {
  const supported = typeof window !== "undefined" && !!((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<{ stop: () => void; start: () => void } | null>(null);
  const cbRef = useRef(onFinal);
  useEffect(() => { cbRef.current = onFinal; });

  const stop = useCallback(() => { try { recRef.current?.stop(); } catch { /* ignore */ } setListening(false); }, []);

  const start = useCallback(() => {
    if (!supported) return;
    const w = window as unknown as Record<string, new () => SpeechRecognitionLike>;
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    const r = new Rec();
    r.lang = "en-GB"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    let final = "";
    r.onresult = (e: SpeechRecognitionEventLike) => {
      let itr = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final += res[0].transcript;
        else itr += res[0].transcript;
      }
      setInterim(itr);
    };
    r.onend = () => { setListening(false); setInterim(""); const t = final.trim(); if (t) cbRef.current(t); };
    r.onerror = () => { setListening(false); setInterim(""); };
    recRef.current = r;
    setListening(true); setInterim("");
    try { r.start(); } catch { setListening(false); }
  }, [supported]);

  return { supported, listening, interim, start, stop };
}

// Minimal shapes for the Web Speech API (not in TS's DOM lib).
interface SpeechRecognitionEventLike { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }
interface SpeechRecognitionLike {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: (e: SpeechRecognitionEventLike) => void; onend: () => void; onerror: () => void;
  start: () => void; stop: () => void;
}
