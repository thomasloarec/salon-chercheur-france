// Radar CRM · Mode Salon · Capture + revue des notes vocales (mobile-first, 360px).
// Container : (1) enregistrement live via useVoiceNoteCapture, (2) reprise au montage des
// notes NON validées de la mission (garantie « rien de perdu »), (3) carte de revue par note
// via VoiceNoteReviewCard qui ferme la boucle (validate_radar_voice_note).
// Une note fraîchement enregistrée converge vers le même rendu que les notes reprises.
import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, Square, X, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useVoiceNoteCapture } from '@/hooks/useVoiceNoteCapture';
import VoiceNoteReviewCard, { type VoiceNoteRow } from '@/components/radar-crm/VoiceNoteReviewCard';

const fmtClock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

const NAVY = '#04316d';

/** Colonnes de reprise lues sur radar_mission_voice_notes. */
const ROW_COLS =
  'id, mission_id, status, summary_note, transcript_raw, structured_payload, error_message, audio_storage_path, created_at';

interface Props {
  companyId: string;
  eventId: string;
  /** Remonte la note validée pour insertion optimiste dans les listes notes/tâches de la mission. */
  onValidated?: (payload: { noteBody: string; tasks: Array<{ body: string; due_at: string | null }> }) => void;
}

const VoiceNoteCapture: React.FC<Props> = ({ companyId, eventId, onValidated }) => {
  const cap = useVoiceNoteCapture({ companyId, eventId });
  const { state, errorMessage, elapsedMs, slow, start, stop, cancel, retry, reset, maxDurationMs } = cap;

  const [recording, setRecording] = React.useState(false); // l'utilisateur a ouvert l'enregistreur
  const [pending, setPending] = React.useState<VoiceNoteRow[]>([]);
  const missionIdRef = React.useRef<string | null>(null);

  // ---- Reprise au montage : résoudre la mission puis charger les notes non validées ----
  const refresh = React.useCallback(async () => {
    let missionId = missionIdRef.current;
    if (!missionId) {
      const { data: mission } = await supabase
        .from('radar_missions')
        .select('id')
        .eq('crm_company_id', companyId)
        .eq('event_id', eventId)
        .maybeSingle();
      missionId = (mission?.id as string | undefined) ?? null;
      missionIdRef.current = missionId;
    }
    if (!missionId) { setPending([]); return; }
    const { data } = await supabase
      .from('radar_mission_voice_notes')
      .select(ROW_COLS)
      .eq('mission_id', missionId)
      .neq('status', 'validated')
      .order('created_at', { ascending: false });
    setPending((data ?? []) as unknown as VoiceNoteRow[]);
  }, [companyId, eventId]);

  React.useEffect(() => {
    missionIdRef.current = null;
    void refresh();
  }, [refresh]);

  // Une note live analysée / lente converge : on recharge la liste et on remet l'enregistreur au repos.
  React.useEffect(() => {
    if (state === 'ready' || slow) {
      void refresh().then(() => { reset(); setRecording(false); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, slow]);

  const openRecorder = () => { setRecording(true); void start(); };
  const closeRecorder = () => { cancel(); setRecording(false); };

  const handleValidated = (id: string) =>
    (payload: { noteBody: string; tasks: Array<{ body: string; due_at: string | null }> }) => {
      onValidated?.(payload);
      // La carte affiche son accusé « validé » ; on retire la ligne du suivi après un court délai.
      setTimeout(() => setPending((rows) => rows.filter((r) => r.id !== id)), 1600);
    };

  const handleDeleted = (id: string) => setPending((rows) => rows.filter((r) => r.id !== id));
  const handleRowChange = (row: VoiceNoteRow) =>
    setPending((rows) => rows.map((r) => (r.id === row.id ? row : r)));

  const isRecording = state === 'recording';
  const isBusy = state === 'uploading' || state === 'creating' || state === 'processing';
  const isError = state === 'error' || state === 'permission_denied';
  const captureActive = recording && (isRecording || isBusy || isError);

  return (
    <div className="space-y-3">
      {/* Cartes de revue / reprise (rien n'est perdu au retour sur la mission) */}
      {pending.map((row) => (
        <VoiceNoteReviewCard
          key={row.id}
          note={row}
          onValidated={handleValidated(row.id)}
          onDeleted={handleDeleted}
          onRowChange={handleRowChange}
        />
      ))}

      {/* Enregistrement live */}
      {captureActive ? (
        <div className="rounded-xl border bg-muted/10 p-4 space-y-4">
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
                <Button type="button" variant="outline" onClick={closeRecorder} className="flex-1 min-h-[48px] gap-2">
                  <X className="h-4 w-4" /> Annuler
                </Button>
                <Button type="button" onClick={stop} className="flex-1 min-h-[48px] gap-2 text-white" style={{ backgroundColor: NAVY }}>
                  <Square className="h-4 w-4" /> Terminer
                </Button>
              </div>
            </div>
          )}

          {isBusy && (
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" style={{ color: NAVY }} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Note vocale envoyée — analyse en cours
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Vos notes et tâches arrivent dans quelques secondes. Vous pouvez continuer votre mission.
                </p>
              </div>
            </div>
          )}

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
                <Button type="button" variant="ghost" onClick={closeRecorder} className="min-h-[44px]">
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Au repos : bouton neutre (JAMAIS orange — l'orange est réservé à « Valider »).
        <Button
          type="button"
          variant="outline"
          onClick={openRecorder}
          className="w-full min-h-[44px] gap-2 border-border/70 text-foreground/80 hover:text-foreground"
        >
          <Mic className="h-4 w-4" />
          Note vocale
        </Button>
      )}
    </div>
  );
};

export default VoiceNoteCapture;