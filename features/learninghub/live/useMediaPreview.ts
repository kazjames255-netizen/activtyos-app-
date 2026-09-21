"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Camera + microphone self-check for the pre-join lobby. Everything here is the
// browser's own getUserMedia — no server involved. The stream is stopped on
// unmount and whenever a new one is requested, so the camera light never stays
// on and Daily can take the device over when the call starts.

export type DevStatus = "pending" | "ok" | "off" | "denied" | "missing" | "busy" | "unsupported";

const classify = (e: unknown): DevStatus => {
  const n = (e as { name?: string } | null)?.name ?? "";
  if (n === "NotAllowedError" || n === "PermissionDeniedError" || n === "SecurityError") return "denied";
  if (n === "NotFoundError" || n === "DevicesNotFoundError" || n === "OverconstrainedError") return "missing";
  return "busy"; // NotReadableError / AbortError / TrackStartError: another app holds it
};

const exact = (id: string) => (id ? { deviceId: { exact: id } } : true);

interface State { cam: DevStatus; mic: DevStatus; stream: MediaStream | null; cams: MediaDeviceInfo[]; mics: MediaDeviceInfo[] }

export function useMediaPreview(active: boolean) {
  const [s, setS] = useState<State>({ cam: "pending", mic: "pending", stream: null, cams: [], mics: [] });
  const [camId, setCamId] = useState("");
  const [micId, setMicId] = useState("");
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [level, setLevel] = useState(0);
  const [nonce, setNonce] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // (Re)acquire when opened, when a device is picked, or on "Try again".
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    void (async () => {
      stopStream();
      if (!md?.getUserMedia) { setS((c) => ({ ...c, cam: "unsupported", mic: "unsupported", stream: null })); return; }
      setS((c) => ({ ...c, cam: "pending", mic: "pending", stream: null }));
      let stream: MediaStream | null = null;
      let cam: DevStatus = "ok", mic: DevStatus = "ok";
      try {
        stream = await md.getUserMedia({ video: exact(camId), audio: exact(micId) });
      } catch (e) {
        // One device failing must not hide the other: probe them separately.
        const first = classify(e);
        const tracks: MediaStreamTrack[] = [];
        try { tracks.push(...(await md.getUserMedia({ video: exact(camId) })).getTracks()); } catch (e2) { cam = classify(e2); }
        try { tracks.push(...(await md.getUserMedia({ audio: exact(micId) })).getTracks()); } catch (e3) { mic = classify(e3); }
        if (cam === "ok" && mic === "ok") { cam = first; mic = first; }
        stream = tracks.length ? new MediaStream(tracks) : null;
      }
      if (cancelled) { stream?.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      let cams: MediaDeviceInfo[] = [], mics: MediaDeviceInfo[] = [];
      try {
        const all = await md.enumerateDevices();
        cams = all.filter((d) => d.kind === "videoinput");
        mics = all.filter((d) => d.kind === "audioinput");
      } catch { /* labels are a nicety */ }
      if (cancelled) return;
      if (stream) {
        stream.getVideoTracks().forEach((t) => { t.enabled = camOn; });
        stream.getAudioTracks().forEach((t) => { t.enabled = micOn; });
      }
      setS({ cam, mic, stream, cams, mics });
    })();
    return () => { cancelled = true; };
    // camOn/micOn are applied below without re-acquiring
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, camId, micId, nonce, stopStream]);

  useEffect(() => () => stopStream(), [stopStream]);

  // A device plugged in / removed while the lobby is open.
  useEffect(() => {
    if (!active) return;
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const on = () => { void md.enumerateDevices().then((all) => setS((c) => ({ ...c, cams: all.filter((d) => d.kind === "videoinput"), mics: all.filter((d) => d.kind === "audioinput") }))).catch(() => undefined); };
    md.addEventListener("devicechange", on);
    return () => md.removeEventListener("devicechange", on);
  }, [active]);

  // Live mic level (0–1) so people can see they're being heard.
  useEffect(() => {
    const stream = s.stream;
    if (!stream || s.mic !== "ok" || !stream.getAudioTracks().length) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    let raf = 0, last = 0;
    let ctx: AudioContext | null = null;
    try {
      ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = (t: number) => {
        raf = requestAnimationFrame(tick);
        if (t - last < 66) return;
        last = t;
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) { const d = (v - 128) / 128; sum += d * d; }
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4.2));
      };
      raf = requestAnimationFrame(tick);
    } catch { /* no meter — the mic still works */ }
    return () => { cancelAnimationFrame(raf); void ctx?.close().catch(() => undefined); setLevel(0); };
  }, [s.stream, s.mic]);

  const toggleCam = () => { const v = !camOn; setCamOn(v); s.stream?.getVideoTracks().forEach((t) => { t.enabled = v; }); };
  const toggleMic = () => { const v = !micOn; setMicOn(v); s.stream?.getAudioTracks().forEach((t) => { t.enabled = v; }); };

  const cam: DevStatus = s.cam === "ok" && !camOn ? "off" : s.cam;
  const mic: DevStatus = s.mic === "ok" && !micOn ? "off" : s.mic;
  return {
    stream: s.stream, cam, mic, cams: s.cams, mics: s.mics, camId, micId, setCamId, setMicId,
    camOn, micOn, toggleCam, toggleMic, level: micOn && s.stream && s.mic === "ok" ? level : 0,
    retry: () => setNonce((n) => n + 1),
    /** Release the devices (call before handing them to the video call). */
    release: stopStream,
  };
}
