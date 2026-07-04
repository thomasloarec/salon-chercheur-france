// Radar CRM · Mode Salon · Capture d'une note vocale (front, format-agnostique, iOS-safe).
// Machine à états : idle → recording → uploading → creating → processing → ready | error.
// Sous-état permission_denied. Ce hook s'arrête à « ready_for_review » : il expose le
// payload structuré au composant mais ne crée AUCUNE note/tâche (validation = run suivant).
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ---- Contrat de capture format-agnostique (CRITIQUE) ----
// Ordre de préférence ; on prend le premier réellement supporté par MediaRecorder.
const MIME_PRIORITY = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'] as const;

// baseMime (jamais « ;codecs ») → extension de fichier Storage.
const EXT_BY_BASE_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

const BUCKET = 'radar-voice-notes';
const MAX_DURATION_MS = 120_000;      // cap dur : stop automatique à 120 s
const MIN_BYTES = 2_048;              // < 2 Ko → micro muet / trop court
const MAX_BYTES = 25 * 1024 * 1024;   // 25 Mo (aligné bucket)
const POLL_INTERVAL_MS = 2_500;
const POLL_TIMEOUT_MS = 90_000;

export type VoiceCaptureState =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'creating'
  | 'processing'
  | 'ready'
  | 'error'
  | 'permission_denied';

/** Payload structuré renvoyé par l'analyse IA (contrat EF ↔ front). Consommé au run suivant. */
export interface VoiceNotePayload {
  summary_note?: string;
  key_points?: string[];
  detected_people?: Array<{ name: string; role?: string | null; confidence?: string }>;
  detected_tasks?: Array<{ body: string; due_at?: string | null; confidence?: string }>;
  follow_up_suggestion?: string | null;
  crm_relevance?: string | null;
  needs_review?: boolean;
}

export interface VoiceCaptureResult {
  voiceNoteId: string;
  summaryNote: string | null;
  payload: VoiceNotePayload | null;
  transcript: string | null;
}

interface UseVoiceNoteCaptureArgs {
  companyId: string;
  eventId: string;
}

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of MIME_PRIORITY) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* isTypeSupported peut jeter sur d'anciens navigateurs → on continue */
    }
  }
  return null;
}

function baseMimeOf(mime: string): string {
  return (mime || '').split(';')[0].trim().toLowerCase();
}

function extFor(baseMime: string): string {
  return EXT_BY_BASE_MIME[baseMime] ?? 'webm';
}

/** Libellé d'étape lisible pendant le traitement serveur. */
function stepLabelFor(status: string): string {
  switch (status) {
    case 'uploaded':
    case 'transcribing':
      return 'Transcription…';
    case 'analyzing':
      return 'Analyse…';
    default:
      return 'Traitement…';
  }
}

export function useVoiceNoteCapture({ companyId, eventId }: UseVoiceNoteCaptureArgs) {
  const [state, setState] = useState<VoiceCaptureState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [result, setResult] = useState<VoiceCaptureResult | null>(null);
  const [slow, setSlow] = useState(false); // analyse plus longue que prévu (non bloquant)

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const baseMimeRef = useRef<string>('audio/webm');
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollDeadlineRef = useRef<number>(0);
  // Référence toujours à jour vers finalize() : évite les closures périmées
  // dans recorder.onstop (défini au moment de l'enregistrement).
  const finalizeRef = useRef<() => void>(() => {});

  const clearTimers = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
  }, []);

  const clearPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Nettoyage global au démontage.
  useEffect(() => () => {
    clearTimers();
    clearPoll();
    stopStream();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch { /* noop */ }
    }
  }, [clearTimers, clearPoll, stopStream]);

  const fail = useCallback((message: string) => {
    clearTimers();
    clearPoll();
    stopStream();
    setStepLabel(null);
    setErrorMessage(message);
    setState('error');
  }, [clearTimers, clearPoll, stopStream]);

  // ---- Poll de la ligne radar_mission_voice_notes jusqu'à ready_for_review / failed ----
  const startPolling = useCallback((voiceNoteId: string) => {
    clearPoll();
    pollDeadlineRef.current = Date.now() + POLL_TIMEOUT_MS;
    setSlow(false);

    const poll = async () => {
      const { data, error } = await supabase
        .from('radar_mission_voice_notes')
        .select('status, summary_note, structured_payload, transcript_raw, error_message')
        .eq('id', voiceNoteId)
        .maybeSingle();

      if (error || !data) return; // transitoire : on retentera au prochain tick

      const status = String(data.status ?? '');
      if (status === 'ready_for_review') {
        clearPoll();
        setStepLabel(null);
        setResult({
          voiceNoteId,
          summaryNote: (data.summary_note as string | null) ?? null,
          payload: (data.structured_payload as VoiceNotePayload | null) ?? null,
          transcript: (data.transcript_raw as string | null) ?? null,
        });
        setState('ready');
        return;
      }
      if (status === 'failed') {
        clearPoll();
        fail((data.error_message as string | null) ?? "L'analyse a échoué. Réessayez.");
        return;
      }
      // uploaded | transcribing | analyzing → on continue en affichant l'étape
      setStepLabel(stepLabelFor(status));

      // Timeout de sécurité : NE PAS traiter comme un échec définitif (le serveur poursuit).
      if (Date.now() > pollDeadlineRef.current) {
        clearPoll();
        setSlow(true);
      }
    };

    pollRef.current = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
    void poll(); // premier tick immédiat
  }, [clearPoll, fail]);

  // ---- start() : permission micro + enregistrement ----
  const start = useCallback(async () => {
    setErrorMessage(null);
    setResult(null);
    setSlow(false);
    setStepLabel(null);
    setElapsedMs(0);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMessage('Autorisez le micro pour enregistrer une note vocale.');
      setState('permission_denied');
      return;
    }
    streamRef.current = stream;

    const requested = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = requested ? new MediaRecorder(stream, { mimeType: requested }) : new MediaRecorder(stream);
    } catch {
      // Certains navigateurs refusent l'option mimeType → fallback sans contrainte.
      recorder = new MediaRecorder(stream);
    }
    recorderRef.current = recorder;

    // Lire le VRAI mime produit (pas la valeur demandée).
    baseMimeRef.current = baseMimeOf(recorder.mimeType || requested || 'audio/webm') || 'audio/webm';

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => { finalizeRef.current(); };

    startedAtRef.current = Date.now();
    recorder.start();
    setState('recording');

    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 250);
    autoStopRef.current = setTimeout(() => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch { /* noop */ }
      }
    }, MAX_DURATION_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- finalize() : garde-fous → upload → create → invoke → polling ----
  const finalize = useCallback(async () => {
    clearTimers();
    const baseMime = baseMimeRef.current;
    const ext = extFor(baseMime);
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));

    const blob = new Blob(chunksRef.current, { type: baseMime });
    stopStream();

    if (blob.size < MIN_BYTES) {
      fail('Enregistrement trop court ou micro muet. Réessayez en parlant à voix haute.');
      return;
    }
    if (blob.size > MAX_BYTES) {
      fail('Enregistrement trop long. Refaites une note plus courte.');
      return;
    }

    const voiceNoteId = crypto.randomUUID();

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) {
      fail('Session expirée. Reconnectez-vous puis réessayez.');
      return;
    }
    const path = `${uid}/${voiceNoteId}.${ext}`;

    // (a) upload — en échec, aucune ligne créée.
    setState('uploading');
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: baseMime, upsert: false });
    if (upErr) {
      fail("L'envoi de l'audio a échoué. Vérifiez votre connexion et réessayez.");
      return;
    }

    // (b) create — enregistre la ligne (le serveur dérive mission/compte).
    setState('creating');
    const { error: rpcErr } = await supabase.rpc('create_radar_mission_voice_note', {
      p_crm_company_id: companyId,
      p_event_id: eventId,
      p_id: voiceNoteId,
      p_audio_storage_path: path,
      p_audio_mime_type: baseMime,
      p_audio_duration_seconds: durationSeconds,
    });
    if (rpcErr) {
      fail("La note n'a pas pu être créée. Réessayez dans un instant.");
      return;
    }

    // (c) invoke — 202 immédiat, traitement en fond ; on ne l'attend pas.
    setState('processing');
    setStepLabel('Transcription…');
    void supabase.functions.invoke('radar-process-voice-note', {
      body: { voice_note_id: voiceNoteId },
    });
    startPolling(voiceNoteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, eventId, clearTimers, stopStream, fail, startPolling]);

  // Garde la ref alignée sur la dernière version de finalize.
  useEffect(() => { finalizeRef.current = () => { void finalize(); }; }, [finalize]);

  // ---- stop() : demande l'arrêt ; finalize() est déclenché par onstop ----
  const stop = useCallback(() => {
    clearTimers();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch { finalizeRef.current(); }
    } else {
      finalizeRef.current();
    }
  }, [clearTimers]);

  // ---- cancel() : abandon complet, rien n'est envoyé ----
  const cancel = useCallback(() => {
    clearTimers();
    clearPoll();
    if (recorderRef.current) {
      recorderRef.current.ondataavailable = null;
      recorderRef.current.onstop = null;
      if (recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch { /* noop */ }
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    stopStream();
    setStepLabel(null);
    setErrorMessage(null);
    setElapsedMs(0);
    setResult(null);
    setSlow(false);
    setState('idle');
  }, [clearTimers, clearPoll, stopStream]);

  // ---- reset() : repartir à zéro (après ready/error/slow) ----
  const reset = useCallback(() => {
    cancel();
  }, [cancel]);

  const retry = useCallback(() => {
    reset();
    void start();
  }, [reset, start]);

  return {
    state,
    errorMessage,
    elapsedMs,
    stepLabel,
    result,
    slow,
    start,
    stop,
    cancel,
    reset,
    retry,
    maxDurationMs: MAX_DURATION_MS,
  };
}