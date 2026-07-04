// Radar CRM · Mode Salon · UI de capture d'une note vocale (mobile-first, 360px).
// Consomme useVoiceNoteCapture. Ce run s'arrête à un accusé discret « analysée — revue à venir » :
// PAS de carte de validation, PAS d'appel à validate_radar_voice_note (run suivant).
import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, Square, X, Sparkles, AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceNoteCapture } from '@/hooks/useVoiceNoteCapture';

const fmtClock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

const NAVY = '#04316d';

const VoiceNoteCapture: React.FC<{ companyId: string; eventId: string }> = ({ companyId, eventId }) => {
  const {
    state, errorMessage, elapsedMs, stepLabel, slow,
    start, stop, cancel, reset, retry, maxDurationMs,
  } = useVoiceNoteCapture({ companyId, eventId });

  const [open, setOpen] = React.useState(false);

  const openRecorder = () => { setOpen(true); void start(); };
  const closeAll = () => { cancel(); setOpen(false); };

  // Au repos : bouton neutre (JAMAIS orange — orange = « à valider », run suivant).
  if (!open && state === 'idle') {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={openRecorder}
        className="w-full min-h-[44px] gap-2 border-border/70 text-foreground/80 hover:text-foreground"
      >
        <Mic className="h-4 w-4" />
        Note vocale
      </Button>
    );
  }

  const isRecording = state === 'recording';
  const isBusy = state === 'uploading' || state === 'creating' || state === 'processing';
  const isReady = state === 'ready';
  const isError = state === 'error' || state === 'permission_denied';

  return (
    <div className="rounded-xl border bg-muted/10 p-4 space-y-4">
      {/* Enregistrement en cours */}
      {isRecording && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Parlez librement. Radar CRM transformera votre message en note structurée et tâches.
          </p>
          <div className="flex items-center justify-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
            <span className="font-display text-3xl tabular-nums" style={{ color: NAVY }}>
              {fmtClock(elapsedMs)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Arrêt automatique à {fmtClock(maxDurationMs)}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeAll}
              className="flex-1 min-h-[48px] gap-2"
            >
              <X className="h-4 w-4" /> Annuler
            </Button>
            <Button
              type="button"
              onClick={stop}
              className="flex-1 min-h-[48px] gap-2 text-white"
              style={{ backgroundColor: NAVY }}
            >
              <Square className="h-4 w-4" /> Terminer
            </Button>
          </div>
        </div>
      )}

      {/* Envoi / création / analyse — non bloquant */}
      {isBusy && (
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin" style={{ color: NAVY }} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {stepLabel ?? 'Analyse en cours…'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Vous pouvez continuer votre mission, l'analyse se poursuit.
            </p>
          </div>
        </div>
      )}

      {/* Analyse plus longue que prévu (timeout de polling, non définitif) */}
      {slow && !isReady && !isError && (
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 shrink-0" style={{ color: NAVY }} />
          <div className="min-w-0 space-y-2">
            <p className="text-sm text-foreground/90">
              L'analyse prend plus de temps que prévu, la note apparaîtra dans la mission une fois prête.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => { reset(); setOpen(false); }}>
              Fermer
            </Button>
          </div>
        </div>
      )}

      {/* Accusé discret — PAS de carte de validation dans ce run */}
      {isReady && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-700">
            <Check className="h-4 w-4 shrink-0" />
            <p className="text-sm font-medium">Note vocale analysée — revue à venir</p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { reset(); }}
            >
              <Mic className="h-4 w-4 mr-1.5" /> Nouvelle note
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { reset(); setOpen(false); }}>
              Fermer
            </Button>
          </div>
        </div>
      )}

      {/* Erreur / permission refusée */}
      {isError && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-sm">{errorMessage ?? 'Une erreur est survenue.'}</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={retry} className="min-h-[44px] gap-2 text-white" style={{ backgroundColor: NAVY }}>
              <Mic className="h-4 w-4" /> Réessayer
            </Button>
            <Button type="button" variant="ghost" onClick={closeAll} className="min-h-[44px]">
              Fermer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceNoteCapture;