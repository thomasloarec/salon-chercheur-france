import { useEffect, useRef, useState } from 'react';
import { Mic, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceRecorder, VOICE_COUNTDOWN_FROM_MS, VOICE_MAX_MS, type VoiceRecording } from './useVoiceRecorder';

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Bouton de dictée et panneau d'enregistrement. Masqué si le navigateur ne sait pas enregistrer. */
export default function VoiceDictation({
  label,
  hint,
  disabled = false,
  disabledText,
  footer,
  className = '',
  autoStart = false,
  onRecorded,
  onCancel,
  onDenied,
}: {
  onCancel?: () => void;
  onDenied?: () => void;
  /** Lance l'enregistrement dès l'affichage (ouverture directe en dictée). */
  autoStart?: boolean;
  label: string;
  hint?: string;
  disabled?: boolean;
  disabledText?: string;
  footer?: React.ReactNode;
  className?: string;
  onRecorded: (r: VoiceRecording) => void;
}) {
  const rec = useVoiceRecorder(onRecorded);
  const [help, setHelp] = useState(false);
  const autoDone = useRef(false);
  useEffect(() => {
    if (!autoStart || autoDone.current || disabled || !rec.supported) return;
    autoDone.current = true;
    void rec.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, disabled, rec.supported]);
  const deniedRef = useRef(onDenied);
  deniedRef.current = onDenied;
  useEffect(() => {
    if (rec.state === 'denied') deniedRef.current?.();
  }, [rec.state]);
  if (!rec.supported) return null;

  if (rec.state === 'recording') {
    const left = VOICE_MAX_MS - rec.elapsedMs;
    return (
      <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-center" role="status">
        <p className="flex items-center justify-center gap-2 text-2xl font-semibold tabular-nums">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
          {clock(rec.elapsedMs)}
        </p>
        {rec.elapsedMs >= VOICE_COUNTDOWN_FROM_MS && (
          <p className="text-sm font-medium text-destructive">Arrêt dans {Math.ceil(left / 1000)} s</p>
        )}
        <Button size="lg" className="min-h-[64px] w-full text-lg font-semibold md:w-auto md:min-w-[240px]" onClick={rec.stop}>
          <Square className="mr-2 h-5 w-5" /> Terminer
        </Button>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        <Button variant="ghost" className="min-h-[44px]" onClick={() => { rec.cancel(); onCancel?.(); }}>
          <X className="mr-1 h-4 w-4" /> Annuler
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <Button
        type="button"
        variant="outline"
        className="min-h-[56px] w-full text-base md:w-auto md:min-w-[200px]"
        disabled={disabled}
        onClick={() => {
          rec.resetDenied();
          void rec.start();
        }}
      >
        <Mic className="mr-2 h-5 w-5" /> {label}
      </Button>
      {disabled && disabledText && <p className="text-xs text-muted-foreground">{disabledText}</p>}
      {rec.state === 'denied' && (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p>Autorisez le micro pour dicter.</p>
          <button type="button" className="min-h-[44px] font-medium text-primary underline" onClick={() => setHelp((v) => !v)}>
            Comment faire ?
          </button>
          {help && (
            <p className="text-muted-foreground">
              Ouvrez les réglages du navigateur (ou du téléphone), trouvez ce site et autorisez le micro, puis revenez ici.
            </p>
          )}
        </div>
      )}
      {!disabled && footer}
    </div>
  );
}
