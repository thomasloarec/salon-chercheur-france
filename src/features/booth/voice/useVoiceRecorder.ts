import { useCallback, useEffect, useRef, useState } from 'react';
import { baseMime, pickAudioMime } from './mime';

export const VOICE_MAX_MS = 90_000;
export const VOICE_COUNTDOWN_FROM_MS = 75_000;

export interface VoiceRecording {
  blob: Blob;
  mediaType: string;
  durationMs: number;
}

export type RecorderState = 'idle' | 'recording' | 'denied';

export const voiceSupported = () =>
  typeof window !== 'undefined' &&
  typeof window.MediaRecorder !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia;

/** Enregistrement micro natif. onRecorded est appelé à l'arrêt (bouton ou arrêt automatique à 90 s). */
export function useVoiceRecorder(onRecorded: (r: VoiceRecording) => void) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const auto = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cbRef = useRef(onRecorded);
  cbRef.current = onRecorded;

  const cleanup = useCallback(() => {
    if (tick.current) clearInterval(tick.current);
    if (auto.current) clearTimeout(auto.current);
    tick.current = null;
    auto.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      const r = recRef.current;
      if (r) {
        r.ondataavailable = null;
        r.onstop = null;
        if (r.state !== 'inactive') {
          try { r.stop(); } catch { /* ignoré */ }
        }
      }
      cleanup();
    },
    [cleanup],
  );

  const start = useCallback(async () => {
    if (!voiceSupported()) return;
    chunks.current = [];
    setElapsedMs(0);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState('denied');
      return;
    }
    streamRef.current = stream;
    const mime = pickAudioMime((t) => MediaRecorder.isTypeSupported(t));
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32_000 } : { audioBitsPerSecond: 32_000 });
    } catch {
      rec = new MediaRecorder(stream);
    }
    recRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.current.push(e.data);
    };
    rec.onstop = () => {
      const durationMs = Math.min(VOICE_MAX_MS, Date.now() - startedAt.current);
      const type = baseMime(rec.mimeType || mime || 'audio/webm') || 'audio/webm';
      const blob = new Blob(chunks.current, { type });
      chunks.current = [];
      recRef.current = null;
      cleanup();
      setState('idle');
      cbRef.current({ blob, mediaType: type, durationMs });
    };
    startedAt.current = Date.now();
    rec.start();
    setState('recording');
    tick.current = setInterval(() => setElapsedMs(Date.now() - startedAt.current), 250);
    auto.current = setTimeout(() => {
      if (recRef.current && recRef.current.state !== 'inactive') {
        try { recRef.current.stop(); } catch { /* ignoré */ }
      }
    }, VOICE_MAX_MS);
  }, [cleanup]);

  const stop = useCallback(() => {
    const r = recRef.current;
    if (r && r.state !== 'inactive') {
      try { r.stop(); } catch { cleanup(); setState('idle'); }
    }
  }, [cleanup]);

  const cancel = useCallback(() => {
    const r = recRef.current;
    if (r) {
      r.ondataavailable = null;
      r.onstop = null;
      if (r.state !== 'inactive') {
        try { r.stop(); } catch { /* ignoré */ }
      }
    }
    recRef.current = null;
    chunks.current = [];
    cleanup();
    setElapsedMs(0);
    setState('idle');
  }, [cleanup]);

  const resetDenied = useCallback(() => setState('idle'), []);

  return { state, elapsedMs, start, stop, cancel, resetDenied, supported: voiceSupported() };
}
