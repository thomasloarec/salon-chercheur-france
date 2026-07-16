// Radar CRM · Mode Salon · Capture vocale COMPACTE inline (ligne de la check-list terrain).
// Réutilise useVoiceNoteCapture tel quel (aucune duplication de logique d'enregistrement).
// Ce composant ne crée NI note NI tâche : il capture + signale. La validation reste dans le Sheet.
// Feedback post-enregistrement explicite & NON bloquant : dès « Terminer » et pendant tout
// uploading→creating→processing, on affiche « Note vocale envoyée — analyse en cours… ».
import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, Square, X, AlertCircle } from 'lucide-react';
import { useVoiceNoteCapture } from '@/hooks/useVoiceNoteCapture';

const NAVY = '#04316d';

const fmtClock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

interface Props {
  companyId: string;
  eventId: string;
  /** Le traitement serveur a démarré (uploading/creating/processing) → parent affiche « analyse… » et surveille la map. */
  onProcessing?: () => void;
  /** L'analyse est prête (ready) → parent rafraîchit la map « à valider » puis referme la capture. */
  onReady?: () => void;
  /** Fermeture de la capture inline (annulation ou repli). */
  onClose?: () => void;
}

/** Capture inline compacte : démarre l'enregistrement au montage, converge vers un état d'attente non bloquant. */
const TerrainVoiceCapture: React.FC<Props> = ({ companyId, eventId, onProcessing, onReady, onClose }) => {
  const cap = useVoiceNoteCapture({ companyId, eventId });
  const { state, errorMessage, elapsedMs, stepLabel, slow, start, stop, cancel, retry, maxDurationMs } = cap;

  const startedRef = React.useRef(false);
  const processingFiredRef = React.useRef(false);
  const readyFiredRef = React.useRef(false);

  // Démarrage immédiat de l'enregistrement à l'ouverture de la capture.
  React.useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signale au parent le passage en traitement serveur (une seule fois).
  React.useEffect(() => {
    if (!processingFiredRef.current && (state === 'uploading' || state === 'creating' || state === 'processing')) {
      processingFiredRef.current = true;
      onProcessing?.();
    }
  }, [state, onProcessing]);

  // Note prête : prévenir le parent (rafraîchit le badge) puis refermer la capture.
  React.useEffect(() => {
    if ((state === 'ready' || slow) && !readyFiredRef.current) {
      readyFiredRef.current = true;
      onReady?.();
      onClose?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, slow]);

  const handleCancel = () => { cancel(); onClose?.(); };

  const isRecording = state === 'recording';
  const isBusy = state === 'uploading' || state === 'creating' || state === 'processing';
  const isError = state === 'error' || state === 'permission_denied';

  return (
    <div className="rounded-xl border bg-muted/10 p-3 space-y-3">
      {isRecording && (
        <div className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-danger animate-pulse" aria-hidden="true" />
            <span className="font-display text-2xl tabular-nums" style={{ color: NAVY }}>
              {fmtClock(elapsedMs)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">Arrêt auto à {fmtClock(maxDurationMs)}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} className="flex-1 min-h-[44px] gap-2">
              <X className="h-4 w-4" /> Annuler
            </Button>
            <Button
              type="button"
              onClick={stop}
              className="flex-1 min-h-[44px] gap-2 text-white"
              style={{ backgroundColor: NAVY }}
            >
              <Square className="h-4 w-4" /> Terminer
            </Button>
          </div>
        </div>
      )}

      {/* Attente explicite & NON bloquante — jamais « terminé/réussi » à ce stade. */}
      {isBusy && (
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin mt-0.5" style={{ color: NAVY }} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Note vocale envoyée — analyse en cours
              </p>
              <p className="text-[11px] text-muted-foreground">
                Tes notes et tâches arrivent dans quelques secondes. Tu peux continuer ta visite.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onClose?.()}
            className="w-full text-muted-foreground"
          >
            Continuer la visite
          </Button>
        </div>
      )}

      {isError && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-sm">{errorMessage ?? 'Une erreur est survenue.'}</p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={retry}
              className="min-h-[44px] gap-2 text-white"
              style={{ backgroundColor: NAVY }}
            >
              <Mic className="h-4 w-4" /> Réessayer
            </Button>
            <Button type="button" variant="ghost" onClick={handleCancel} className="min-h-[44px]">
              Fermer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TerrainVoiceCapture;
