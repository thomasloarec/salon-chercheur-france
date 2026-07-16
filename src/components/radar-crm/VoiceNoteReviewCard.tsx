// Radar CRM · Mode Salon · Carte de revue d'une note vocale (status='ready_for_review').
// Ferme la boucle : afficher l'analyse IA, laisser corriger, puis créer note + tâches
// réelles via la RPC validate_radar_voice_note. Gère aussi les états processing / failed
// d'une note existante (poll autonome) et les actions Supprimer / Refaire l'analyse.
// Orange #ff751f UNIQUEMENT sur « Valider » (état action-requise). Tout le reste neutre / navy.
import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertTriangle, Check, Loader2, RotateCcw, Sparkles, Trash2, X,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { VoiceNotePayload } from '@/hooks/useVoiceNoteCapture';

const NAVY = '#04316d';
const ORANGE = '#ff751f'; // SEUL usage orange du flux vocal : bouton Valider.

const POLL_INTERVAL_MS = 2_500;

/** Ligne brute de radar_mission_voice_notes consommée par la carte. */
export interface VoiceNoteRow {
  id: string;
  mission_id: string | null;
  status: string;
  summary_note: string | null;
  transcript_raw: string | null;
  structured_payload: VoiceNotePayload | null;
  error_message: string | null;
  audio_storage_path: string | null;
  created_at: string;
}

interface DraftTask {
  key: string;
  body: string;
  due_at: string | null;
  checked: boolean;
  confidence?: string | null;
}

const PROCESSING = new Set(['uploaded', 'transcribing', 'analyzing']);

const stepLabelFor = (status: string): string => {
  switch (status) {
    case 'uploaded':
    case 'transcribing':
      return 'Transcription…';
    case 'analyzing':
      return 'Analyse…';
    default:
      return 'Traitement…';
  }
};

const fmtDue = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

const buildDraftTasks = (payload: VoiceNotePayload | null): DraftTask[] => {
  const detected = payload?.detected_tasks ?? [];
  return detected.map((t, i) => ({
    key: `${i}-${t.body?.slice(0, 12) ?? ''}`,
    body: t.body ?? '',
    due_at: t.due_at ?? null,
    // high & medium cochées par défaut ; low décochée. Inconnu → coché.
    checked: (t.confidence ?? '').toLowerCase() !== 'low',
    confidence: t.confidence ?? null,
  }));
};

interface Props {
  note: VoiceNoteRow;
  onValidated: (payload: { noteBody: string; tasks: Array<{ body: string; due_at: string | null }> }) => void;
  onDeleted: (id: string) => void;
  /** Met à jour la ligne dans la liste parente (après poll / refaire analyse). */
  onRowChange: (row: VoiceNoteRow) => void;
}

const VoiceNoteReviewCard: React.FC<Props> = ({ note, onValidated, onDeleted, onRowChange }) => {
  const [summary, setSummary] = React.useState(note.summary_note ?? '');
  const [tasks, setTasks] = React.useState<DraftTask[]>(() => buildDraftTasks(note.structured_payload));
  const [validating, setValidating] = React.useState(false);
  const [validated, setValidated] = React.useState(note.status === 'validated');
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmReanalyze, setConfirmReanalyze] = React.useState(false);
  const [busy, setBusy] = React.useState<null | 'delete' | 'reanalyze'>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const status = note.status;
  const isProcessing = PROCESSING.has(status);
  const isReady = status === 'ready_for_review';
  const isFailed = status === 'failed';
  const payload = note.structured_payload;

  // Ré-hydrate les champs éditables quand la ligne passe à ready_for_review (poll / reanalyze).
  React.useEffect(() => {
    if (isReady) {
      setSummary(note.summary_note ?? '');
      setTasks(buildDraftTasks(note.structured_payload));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id, note.status]);

  const clearPoll = React.useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // Poll autonome tant que la note est en traitement (reprise ou re-analyse).
  React.useEffect(() => {
    if (!isProcessing) { clearPoll(); return; }
    const poll = async () => {
      const { data, error } = await supabase
        .from('radar_mission_voice_notes')
        .select('id, mission_id, status, summary_note, transcript_raw, structured_payload, error_message, audio_storage_path, created_at')
        .eq('id', note.id)
        .maybeSingle();
      if (error || !data) return;
      if (String(data.status) !== status) {
        onRowChange(data as unknown as VoiceNoteRow);
      }
    };
    pollRef.current = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
    void poll();
    return clearPoll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id, status, isProcessing]);

  React.useEffect(() => clearPoll, [clearPoll]);

  const toggleTask = (key: string, next: boolean) =>
    setTasks((ts) => ts.map((t) => (t.key === key ? { ...t, checked: next } : t)));

  const editTask = (key: string, body: string) =>
    setTasks((ts) => ts.map((t) => (t.key === key ? { ...t, body } : t)));

  const handleValidate = async () => {
    if (validating) return;
    const checked = tasks
      .filter((t) => t.checked && t.body.trim().length > 0)
      .map((t) => ({ body: t.body.trim(), due_at: t.due_at ?? null }));
    setValidating(true);
    const { error } = await supabase.rpc('validate_radar_voice_note', {
      p_voice_note_id: note.id,
      p_edited_summary: summary.trim(),
      p_checked_tasks: checked as unknown as never,
    });
    setValidating(false);
    if (error) {
      console.error('[RadarCRM] validate_radar_voice_note failed:', error);
      toast({ title: 'Validation impossible', description: 'Réessayez dans un instant.', variant: 'destructive' });
      return;
    }
    setValidated(true);
    onValidated({ noteBody: summary.trim(), tasks: checked });
    toast({ title: 'Note enregistrée', description: 'La note et les tâches ont été ajoutées à la mission.' });
  };

  const handleDelete = async () => {
    if (busy) return;
    setBusy('delete');
    if (note.audio_storage_path) {
      await supabase.storage.from('radar-voice-notes').remove([note.audio_storage_path]);
    }
    const { error } = await supabase.from('radar_mission_voice_notes').delete().eq('id', note.id);
    setBusy(null);
    if (error) {
      console.error('[RadarCRM] delete voice note failed:', error);
      toast({ title: 'Suppression impossible', description: 'Réessayez dans un instant.', variant: 'destructive' });
      return;
    }
    onDeleted(note.id);
  };

  const handleReanalyze = async () => {
    if (busy) return;
    setBusy('reanalyze');
    setConfirmReanalyze(false);
    const { error } = await supabase
      .from('radar_mission_voice_notes')
      .update({ status: 'uploaded' })
      .eq('id', note.id);
    if (error) {
      setBusy(null);
      console.error('[RadarCRM] reanalyze reset failed:', error);
      toast({ title: 'Action impossible', description: 'Réessayez dans un instant.', variant: 'destructive' });
      return;
    }
    void supabase.functions.invoke('radar-process-voice-note', { body: { voice_note_id: note.id } });
    setBusy(null);
    onRowChange({ ...note, status: 'uploaded', error_message: null });
  };

  // ---- État VALIDÉ : accusé discret (navy/emerald), plus d'action orange ----
  if (validated) {
    return (
      <div className="rounded-xl border bg-info/10 p-4">
        <div className="flex items-center gap-2 text-info">
          <Check className="h-4 w-4 shrink-0" />
          <p className="text-sm font-medium">Note enregistrée dans la mission</p>
        </div>
      </div>
    );
  }

  // ---- État EN TRAITEMENT (reprise / re-analyse) — non bloquant ----
  if (isProcessing) {
    return (
      <div className="rounded-xl border bg-muted/10 p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin" style={{ color: NAVY }} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{stepLabelFor(status)}</p>
            <p className="text-[11px] text-muted-foreground">
              La note apparaîtra ici une fois prête. Vous pouvez continuer votre mission.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---- État ÉCHEC ----
  if (isFailed) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
        <div className="flex items-start gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="text-sm">{note.error_message ?? "L'analyse de cette note vocale a échoué."}</p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReanalyze}
            disabled={busy === 'reanalyze'}
            className="gap-1.5"
            style={{ color: NAVY, borderColor: NAVY }}
          >
            {busy === 'reanalyze' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Réessayer
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={busy === 'delete'}
            className="gap-1.5 text-muted-foreground"
          >
            {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Supprimer
          </Button>
        </div>
      </div>
    );
  }

  // ---- État READY_FOR_REVIEW : la carte de revue complète ----
  if (!isReady) return null;

  const keyPoints = payload?.key_points ?? [];
  const people = payload?.detected_people ?? [];
  const followUp = payload?.follow_up_suggestion ?? null;
  const crmRelevance = payload?.crm_relevance ?? null;
  const needsReview = payload?.needs_review === true;
  const hasDetails = !!(followUp || crmRelevance);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0" style={{ color: NAVY }} />
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: NAVY }}>
          Note vocale à revoir
        </span>
      </div>

      {needsReview && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-surface px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
          <p className="text-xs text-warning-foreground">
            L'audio était ambigu — relisez attentivement avant de valider.
          </p>
        </div>
      )}

      {/* Note proposée — champ principal, éditable */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">Note proposée</label>
        <Textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
          className="resize-none text-base"
          placeholder="Résumé de l'échange…"
        />
      </div>

      {/* Tâches détectées — cases à cocher, texte éditable inline */}
      {tasks.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Tâches détectées</label>
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li key={t.key} className="flex items-start gap-2.5 rounded-lg border bg-muted/10 px-3 py-2.5">
                <Checkbox
                  checked={t.checked}
                  onCheckedChange={(v) => toggleTask(t.key, v === true)}
                  className="mt-2 h-5 w-5"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <Input
                    value={t.body}
                    onChange={(e) => editTask(t.key, e.target.value)}
                    className="h-9 text-sm"
                  />
                  {t.due_at && (
                    <p className="text-[11px] text-muted-foreground">Échéance : {fmtDue(t.due_at)}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Contexte secondaire — lecture seule, discret */}
      {keyPoints.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Points clés</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {keyPoints.map((k, i) => (
              <li key={i} className="text-xs text-muted-foreground">{k}</li>
            ))}
          </ul>
        </div>
      )}

      {people.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Personnes</p>
          <ul className="space-y-0.5">
            {people.map((p, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                {p.name}{p.role ? ` — ${p.role}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(hasDetails || note.transcript_raw) && (
        <Accordion type="single" collapsible className="border-t">
          {hasDetails && (
            <AccordionItem value="details" className="border-b-0">
              <AccordionTrigger className="py-3 text-sm text-muted-foreground hover:no-underline">
                Détails
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                {followUp && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">Relance : </span>{followUp}
                  </p>
                )}
                {crmRelevance && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">Pertinence CRM : </span>{crmRelevance}
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          )}
          {note.transcript_raw && (
            <AccordionItem value="transcript" className="border-b-0">
              <AccordionTrigger className="py-3 text-sm text-muted-foreground hover:no-underline">
                Transcription brute
              </AccordionTrigger>
              <AccordionContent>
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">{note.transcript_raw}</p>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-1">
        <Button
          type="button"
          onClick={handleValidate}
          disabled={validating}
          className="w-full min-h-[48px] gap-2 text-white hover:opacity-90"
          style={{ backgroundColor: ORANGE }}
        >
          {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Valider
        </Button>

        <div className="flex items-center justify-between gap-2">
          {confirmReanalyze ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReanalyze}
                disabled={busy === 'reanalyze'}
                style={{ color: NAVY, borderColor: NAVY }}
                className="gap-1.5"
              >
                {busy === 'reanalyze' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Confirmer
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmReanalyze(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmReanalyze(true)}
              className="gap-1.5 text-muted-foreground"
              title="Remplace l'analyse actuelle et les éditions non validées"
            >
              <RotateCcw className="h-4 w-4" /> Refaire l'analyse
            </Button>
          )}

          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={busy === 'delete'}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Confirmer
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="gap-1.5 text-muted-foreground"
            >
              <Trash2 className="h-4 w-4" /> Supprimer
            </Button>
          )}
        </div>
        {confirmReanalyze && (
          <p className="text-[11px] text-muted-foreground">
            Relance l'analyse sans re-transcrire. Cela remplacera l'analyse actuelle et vos éditions non validées.
          </p>
        )}
      </div>
    </div>
  );
};

export default VoiceNoteReviewCard;