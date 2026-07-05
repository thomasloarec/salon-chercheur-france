import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import {
  CalendarIcon, Check, ChevronDown, Loader2, MapPin, MessageSquare, Plus,
  RotateCcw, StickyNote, Target,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';
import {
  type RelationshipStatus, RELATIONSHIP_ORDER, RELATIONSHIP_META,
  triggerClassFor,
} from '@/lib/radarCrm/relationship';
import ExpandableText from '@/components/exhibitor/ExpandableText';
import { cn } from '@/lib/utils';
import VoiceNoteCapture from '@/components/radar-crm/VoiceNoteCapture';
import RadarAuthorBadge from '@/components/radar-crm/RadarAuthorBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';


/** Compte ciblé par le panneau mission (couple crm_company_id + salon). */
export interface MissionTarget {
  companyId: string;
  companyName: string;
  nomExposant: string | null;
  stand: string | null;
  eventId: string;
  eventName: string;
}

interface MissionFields {
  objective: string;
  opening_line: string;
  top_q1: string;
  top_q2: string;
  top_q3: string;
}

/** Métadonnées IA produites par radar-mission-strategist (lecture seule côté front). */
interface MissionAiMeta {
  q0_role_check?: string;
  question_intents?: { q1?: string; q2?: string; q3?: string };
  confidence_score?: number;
  confidence_band?: 'faible' | 'moyen' | 'fort';
  missing_profile_fields?: string[];
  generator?: 'ai' | 'scaffold';
  model?: string;
}

/** Champs de mission éligibles à l'indicateur « modifié » (source-aware). */
const EDITABLE_KEYS = ['objective', 'opening_line', 'top_q1', 'top_q2', 'top_q3'] as const;

/** Traduction des blocs de profil manquants (nudge de complétion). */
const MISSING_PROFILE_LABELS: Record<string, string> = {
  offer_archetype: "Type d'offre",
  problems_solved: 'Problèmes résolus',
  business_outcomes: 'Résultats business',
  personas: 'Personas (décideur, utilisateur, technique…)',
  target_segments: 'Segments cibles (secteurs, tailles)',
};

/**
 * Verrou de génération inter-rendus (par crm_company_id).
 * Empêche deux invokes concurrents (ex. caractérisation + ouverture simultanée).
 * Module-level : survit au remontage du Sheet.
 */
const missionGenInFlight = new Set<string>();

/** Note de mission (capture terrain, ajout seul en V1). */
interface MissionNote {
  id: string;
  body: string;
  created_at: string;
  created_by?: string | null;
  author_name?: string | null;
}

/** Tâche de mission (ajout + toggle done en V1). */
interface MissionTask {
  id: string;
  body: string;
  due_at: string | null;
  done: boolean;
  created_at?: string | null;
  created_by?: string | null;
  author_name?: string | null;
}

const EMPTY: MissionFields = {
  objective: '', opening_line: '', top_q1: '', top_q2: '', top_q3: '',
};

const nonEmpty = (v: string | null | undefined) => (v ?? '').trim().length > 0;

/**
 * Skeleton multi-lignes aux dimensions proches d'une zone de texte de mission.
 * Sobre (doctrine chargement : pas d'accent orange), la dernière ligne est raccourcie.
 */
const LineSkeleton: React.FC<{ lines?: number }> = ({ lines = 2 }) => (
  <div className="space-y-2" aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-4/5' : 'w-full')} />
    ))}
  </div>
);

/** Horodatage lisible fr : « 12 mars, 14:30 ». */
const fmtStamp = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'd MMM, HH:mm', { locale: fr });
};

/** Échéance lisible fr : « 12 mars ». */
const fmtDue = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'd MMM yyyy', { locale: fr });
};

/** Plage de dates lisible fr : « 12 – 14 mars 2026 » (niveau salon). */
const fmtRange = (start?: string | null, end?: string | null) => {
  if (!start) return '';
  const s = new Date(start);
  if (Number.isNaN(s.getTime())) return '';
  if (!end || end === start) return format(s, 'd MMM yyyy', { locale: fr });
  const e = new Date(end);
  if (Number.isNaN(e.getTime())) return format(s, 'd MMM yyyy', { locale: fr });
  return `${format(s, 'd MMM', { locale: fr })} – ${format(e, 'd MMM yyyy', { locale: fr })}`;
};

/** Statut relationnel — point 8px + libellé neutre (doctrine visuelle Radar CRM). */
const RelBadge: React.FC<{ status: RelationshipStatus }> = ({ status }) => {
  const meta = RELATIONSHIP_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-foreground ${meta.badge}`}>
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
};

const RadarMissionSheet: React.FC<{
  target: MissionTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relationship: RelationshipStatus;
  onChangeRelationship: (next: RelationshipStatus) => void;
  onOpenSettings: () => void;
  /** Mode d'affichage : « prepa » (défaut, cockpit/préparation) ou « terrain » (mode salon). */
  mode?: 'terrain' | 'prepa';
  /** Terrain : état « visité » du compte (toggle accessible dans le Sheet). */
  visited?: boolean;
  /** Terrain : bascule le statut « visité ». Non fourni en prepa. */
  onToggleVisited?: () => void;
}> = ({
  target, open, onOpenChange, relationship, onChangeRelationship, onOpenSettings,
  mode = 'prepa', visited = false, onToggleVisited,
}) => {
  const [loading, setLoading] = useState(false);
  // Auto-save silencieux (façon Notion) : statut discret + drapeau « dirty ».
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dirty, setDirty] = useState(false);
  const [fields, setFields] = useState<MissionFields>(EMPTY);
  // Métadonnées IA persistées (ai_meta) + provenance par champ (ai_field_sources).
  const [aiMeta, setAiMeta] = useState<MissionAiMeta | null>(null);
  const [aiFieldSources, setAiFieldSources] = useState<Record<string, string>>({});
  const [aiGeneratedAt, setAiGeneratedAt] = useState<string | null>(null);
  // Statut relationnel BRUT lu en base (null = jamais caractérisé, ≠ 'a_qualifier' explicite).
  const [rawRelStatus, setRawRelStatus] = useState<string | null>(null);
  // Génération IA en cours (spinner localisé, non bloquant).
  const [generating, setGenerating] = useState(false);
  // Régénération « force » en cours (« Tout régénérer ») → tous les champs sont remplacés.
  const [regenForce, setRegenForce] = useState(false);
  // Miroir synchrone de `generating` (pour détecter la fin d'un invoke lancé par une autre instance).
  const generatingRef = useRef(false);
  // Confirmation avant d'écraser des champs édités manuellement.
  const [regenConfirm, setRegenConfirm] = useState(false);
  // Description société (résumé IA ou legacy) affichée sous l'en-tête.
  const [description, setDescription] = useState<string | null>(null);
  // Dates du salon (niveau SALON) — lues dans le payload de la RPC, affichées dans l'en-tête.
  const [eventDates, setEventDates] = useState<{ start: string | null; end: string | null } | null>(null);

  // Capture terrain : notes & tâches (actions immédiates, hors bouton Enregistrer).
  const [notes, setNotes] = useState<MissionNote[]>([]);
  const [tasks, setTasks] = useState<MissionTask[]>([]);
  // Nombre de membres actifs du compte (niveau enveloppe RPC) : pilote l'affichage
  // de l'auteur des notes/tâches (uniquement si > 1 = compte partagé).
  const [activeMemberCount, setActiveMemberCount] = useState<number>(1);
  const [noteDraft, setNoteDraft] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [taskDraft, setTaskDraft] = useState('');
  const [taskDue, setTaskDue] = useState<Date | undefined>(undefined);
  const [dueOpen, setDueOpen] = useState(false);
  const [addingTask, setAddingTask] = useState(false);


  /**
   * Recharge l'état persisté du salon via get_radar_salon_missions (source unique de vérité).
   * overwriteFields=true : réécrit les champs éditables (après génération IA fraîche).
   * overwriteFields=false : ne touche pas aux textarea en cours d'édition, met à jour
   * seulement les métadonnées (ai_field_sources, ai_meta, notes, tâches…).
   */
  const loadRow = async ({ overwriteFields }: { overwriteFields: boolean }) => {
    if (!target) return null;
    const { data, error } = await supabase.rpc('get_radar_salon_missions', { p_event_id: target.eventId });
    if (error) {
      console.error('[RadarCRM] get_radar_salon_missions failed:', error);
      return null;
    }
    const payload = data as {
      event?: Record<string, unknown>;
      companies?: Array<Record<string, unknown>>;
      active_member_count?: number | null;
    } | null;
    const ev = payload?.event ?? null;
    setActiveMemberCount(
      typeof payload?.active_member_count === 'number' ? payload.active_member_count : 1,
    );
    setEventDates(
      ev
        ? { start: (ev.date_debut as string | null) ?? null, end: (ev.date_fin as string | null) ?? null }
        : null,
    );
    const row = (payload?.companies ?? []).find(
      (c) => String(c.crm_company_id ?? '') === target.companyId,
    ) ?? null;

    setRawRelStatus((row?.relationship_status as string | null) ?? null);
    setAiMeta((row?.ai_meta as MissionAiMeta | null) ?? null);
    setAiFieldSources((row?.ai_field_sources as Record<string, string> | null) ?? {});
    setAiGeneratedAt((row?.ai_generated_at as string | null) ?? null);
    setDescription((row?.description as string | null) ?? null);
    setNotes(Array.isArray(row?.notes) ? (row!.notes as MissionNote[]) : []);
    setTasks(Array.isArray(row?.tasks) ? (row!.tasks as MissionTask[]) : []);

    if (overwriteFields) {
      setFields({
        objective: (row?.objective as string) ?? '',
        opening_line: (row?.opening_line as string) ?? '',
        top_q1: (row?.top_q1 as string) ?? '',
        top_q2: (row?.top_q2 as string) ?? '',
        top_q3: (row?.top_q3 as string) ?? '',
      });
    }
    return row;
  };

  /**
   * Déclenche radar-mission-strategist (JWT utilisateur via client authentifié), puis
   * refetch : l'UI se rend TOUJOURS depuis l'état persisté, jamais depuis la réponse brute.
   */
  const generateMission = async ({ force }: { force?: boolean } = {}) => {
    if (!target) return;
    const cid = target.companyId;
    if (missionGenInFlight.has(cid)) return;
    missionGenInFlight.add(cid);
    setRegenForce(!!force);
    setGenerating(true);
    try {
      const body: Record<string, unknown> = { crm_company_id: cid, event_id: target.eventId };
      if (force) body.force = true;
      const { error } = await supabase.functions.invoke('radar-mission-strategist', { body });
      if (error) {
        console.error('[RadarCRM] radar-mission-strategist failed:', error);
        toast({
          title: 'Génération indisponible',
          description: "La mission n'a pas pu être générée. Réessayez dans un instant.",
          variant: 'destructive',
        });
        return;
      }
      void trackRadarEvent('radar_mission_generated', { eventId: target.eventId, forced: !!force });
      await loadRow({ overwriteFields: true });
    } finally {
      missionGenInFlight.delete(cid);
      setGenerating(false);
      setRegenForce(false);
    }
  };

  // Ouverture / changement de cible : charge l'état persisté, puis auto-génère si nécessaire.
  useEffect(() => {
    if (!open || !target) return;
    let cancelled = false;
    setLoading(true);
    setEventDates(null);
    // Source de vérité de l'état « régénération en cours » : le verrou par crm_company_id.
    setGenerating(missionGenInFlight.has(target.companyId));
    (async () => {
      const row = await loadRow({ overwriteFields: true });
      if (cancelled) return;
      setDirty(false);
      setSaveStatus('idle');
      setNoteDraft('');
      setTaskDraft('');
      setTaskDue(undefined);
      setLoading(false);
      // Déclencheur (b) : caractérisée mais jamais générée → génération auto (une fois).
      const rawRel = (row?.relationship_status as string | null) ?? null;
      const genAt = (row?.ai_generated_at as string | null) ?? null;
      if (rawRel != null && genAt == null) {
        void generateMission({});
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.companyId, target?.eventId]);

  // Miroir synchrone de l'état de génération (lu par le poll ci-dessous).
  useEffect(() => { generatingRef.current = generating; }, [generating]);

  // Poll du verrou : détecte la fin d'un invoke (même lancé par une autre instance du Sheet)
  // pour retirer les skeletons et réafficher depuis l'état persisté (jamais de skeleton bloqué).
  useEffect(() => {
    if (!open || !target) return;
    const cid = target.companyId;
    const id = window.setInterval(() => {
      const inFlight = missionGenInFlight.has(cid);
      if (inFlight === generatingRef.current) return;
      if (!inFlight) {
        // Régénération terminée ailleurs → refetch de l'état persisté (succès ou erreur).
        void loadRow({ overwriteFields: true });
      }
      setGenerating(inFlight);
    }, 400);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.companyId, target?.eventId]);

  // Édition inline : marque « dirty » (auto-save débouncé → upsert → refetch métadonnées).
  const set = (k: keyof MissionFields) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDirty(true);
    setFields((f) => ({ ...f, [k]: e.target.value }));
  };

  // Déclencheur (a) : caractérisation → persiste le statut (awaité), puis génère la mission.
  const handleRelationshipChange = async (next: RelationshipStatus) => {
    await Promise.resolve(onChangeRelationship(next));
    await generateMission({ force: false });
  };

  // Au moins un champ de mission a été édité manuellement (protection avant régénération).
  const missionEdited = EDITABLE_KEYS.some((k) => aiFieldSources[k] === 'user_edited');

  // Déclencheur (c) : régénération manuelle — confirme si des éditions manuelles existent.
  const onRegenerateClick = () => {
    if (missionEdited) setRegenConfirm(true);
    else void generateMission({ force: false });
  };

  // Ajoute une note (action immédiate, optimiste), indépendante d'« Enregistrer ».
  const addNote = async () => {
    if (!target || !nonEmpty(noteDraft) || addingNote) return;
    const body = noteDraft.trim();
    setAddingNote(true);
    const { data, error } = await supabase.rpc('add_radar_mission_note', {
      p_crm_company_id: target.companyId,
      p_event_id: target.eventId,
      p_body: body,
    });
    setAddingNote(false);
    if (error) {
      console.error('[RadarCRM] add_radar_mission_note failed:', error);
      toast({ title: 'Note non enregistrée', description: 'Réessayez dans un instant.', variant: 'destructive' });
      return;
    }
    const optimistic: MissionNote = {
      id: (data as string) ?? `tmp-${Date.now()}`,
      body,
      created_at: new Date().toISOString(),
    };
    setNotes((n) => [optimistic, ...n]);
    setNoteDraft('');
  };

  // Ctrl/Cmd+Entrée dans la note → ajout rapide.
  const onNoteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void addNote();
    }
  };

  // Ajoute une tâche (échéance optionnelle), optimiste.
  const addTask = async () => {
    if (!target || !nonEmpty(taskDraft) || addingTask) return;
    const body = taskDraft.trim();
    const due = taskDue ? taskDue.toISOString() : null;
    setAddingTask(true);
    const args: { p_crm_company_id: string; p_event_id: string; p_body: string; p_due_at?: string } = {
      p_crm_company_id: target.companyId,
      p_event_id: target.eventId,
      p_body: body,
    };
    if (due) args.p_due_at = due;
    const { data, error } = await supabase.rpc('add_radar_mission_task', args);
    setAddingTask(false);
    if (error) {
      console.error('[RadarCRM] add_radar_mission_task failed:', error);
      toast({ title: 'Tâche non enregistrée', description: 'Réessayez dans un instant.', variant: 'destructive' });
      return;
    }
    const optimistic: MissionTask = {
      id: (data as string) ?? `tmp-${Date.now()}`,
      body,
      due_at: due,
      done: false,
    };
    setTasks((t) => [optimistic, ...t]);
    setTaskDraft('');
    setTaskDue(undefined);
  };

  // Coche / décoche une tâche (optimiste, rollback si erreur).
  const toggleTask = async (taskId: string, next: boolean) => {
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, done: next } : t)));
    const { error } = await supabase.rpc('set_radar_mission_task_done', {
      p_task_id: taskId,
      p_done: next,
    });
    if (error) {
      console.error('[RadarCRM] set_radar_mission_task_done failed:', error);
      setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, done: !next } : t)));
      toast({ title: 'Action impossible', description: 'La tâche n\'a pas pu être mise à jour.', variant: 'destructive' });
    }
  };

  // Note vocale validée → note + tâches créées côté serveur ; insertion optimiste locale.
  const handleVoiceValidated = ({
    noteBody, tasks: voiceTasks,
  }: { noteBody: string; tasks: Array<{ body: string; due_at: string | null }> }) => {
    const stamp = Date.now();
    if (nonEmpty(noteBody)) {
      setNotes((n) => [
        { id: `voice-note-${stamp}`, body: noteBody, created_at: new Date().toISOString() },
        ...n,
      ]);
    }
    if (voiceTasks.length > 0) {
      setTasks((t) => [
        ...voiceTasks.map((vt, i) => ({
          id: `voice-task-${stamp}-${i}`,
          body: vt.body,
          due_at: vt.due_at,
          done: false,
        })),
        ...t,
      ]);
    }
  };

  // Sauvegarde silencieuse des champs de mission via upsert_radar_mission (get-or-create serveur).
  const persistFields = async () => {
    if (!target) return;
    setSaveStatus('saving');
    // COALESCE serveur : on n'envoie que les champs remplis.
    const args: Record<string, string> = {
      p_crm_company_id: target.companyId,
      p_event_id: target.eventId,
    };
    if (nonEmpty(fields.objective)) args.p_objective = fields.objective.trim();
    if (nonEmpty(fields.opening_line)) args.p_opening_line = fields.opening_line.trim();
    if (nonEmpty(fields.top_q1)) args.p_top_q1 = fields.top_q1.trim();
    if (nonEmpty(fields.top_q2)) args.p_top_q2 = fields.top_q2.trim();
    if (nonEmpty(fields.top_q3)) args.p_top_q3 = fields.top_q3.trim();

    const { error } = await supabase.rpc('upsert_radar_mission', args as never);
    if (error) {
      // Échec silencieux, non bloquant : on garde « dirty » pour retenter au prochain cycle.
      console.error('[RadarCRM] upsert_radar_mission failed:', error);
      setSaveStatus('error');
      return;
    }
    setDirty(false);
    setSaveStatus('saved');
    void trackRadarEvent('radar_mission_saved', { eventId: target.eventId });
    // Refetch métadonnées (ai_field_sources → indicateur « modifié ») sans écraser la frappe.
    void loadRow({ overwriteFields: false });
  };

  // Auto-save débouncé (~900 ms) : uniquement sur modification réelle par l'utilisateur.
  useEffect(() => {
    if (!open || !target || !dirty) return;
    const handle = setTimeout(() => { void persistFields(); }, 900);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, dirty, open, target?.companyId, target?.eventId]);

  // Reprise discrète après un échec : nouvelle tentative silencieuse ~2,5 s plus tard.
  useEffect(() => {
    if (saveStatus !== 'error' || !dirty) return;
    const handle = setTimeout(() => { void persistFields(); }, 2500);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveStatus, dirty]);

  const standLabel = useMemo(
    () => (nonEmpty(target?.stand) ? target!.stand!.trim() : 'Stand non renseigné'),
    [target?.stand],
  );

  const showCrm = !!target?.nomExposant && target.nomExposant !== target.companyName;
  const eventDateLabel = useMemo(
    () => fmtRange(eventDates?.start, eventDates?.end),
    [eventDates?.start, eventDates?.end],
  );

  const isTerrain = mode === 'terrain';

  // Hiérarchie adaptative (terrain) : on se base sur l'AVANCEMENT (contenu CRM), pas le temps.
  // Passer à true pour inclure « visité » comme second déclencheur.
  const INCLUDE_VISITED_IN_CRM_SIGNAL = false;
  const hasCrmContent =
    notes.length > 0 || tasks.length > 0 ||
    (INCLUDE_VISITED_IN_CRM_SIGNAL && visited);

  // Indicateur d'auto-save : rendu uniquement quand il a du contenu (aucune bande résiduelle).
  const autoSaveIndicator = saveStatus === 'idle' ? null : (
    <div
      className="flex items-center gap-1.5 text-xs"
      style={{ color: '#04316d' }}
      aria-live="polite"
    >
      {saveStatus === 'saving' && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Enregistrement…</span>
        </>
      )}
      {saveStatus === 'saved' && (
        <>
          <Check className="h-3.5 w-3.5" />
          <span>Enregistré</span>
        </>
      )}
      {saveStatus === 'error' && (
        <span className="text-muted-foreground">Non enregistré — nouvelle tentative…</span>
      )}
    </div>
  );

  // ---- Blocs réutilisables (mêmes données/handlers dans les deux modes) ----

  const statusSelect = (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground shrink-0">
        Statut
      </span>
      <Select value={relationship} onValueChange={(v) => { void handleRelationshipChange(v as RelationshipStatus); }}>
        <SelectTrigger
          className={`h-8 w-auto min-w-0 gap-1.5 rounded-md px-2.5 shadow-none focus:ring-1 focus:ring-ring focus:ring-offset-0 [&>span]:line-clamp-none ${triggerClassFor(relationship)}`}
        >
          <span className={`h-2 w-2 rounded-full shrink-0 ${RELATIONSHIP_META[relationship].dot}`} aria-hidden="true" />
          <span className={`truncate text-sm font-medium ${RELATIONSHIP_META[relationship].badge}`}>
            {RELATIONSHIP_META[relationship].label}
          </span>
        </SelectTrigger>
        <SelectContent>
          {RELATIONSHIP_ORDER.map((s) => (
            <SelectItem
              key={s}
              value={s}
              className="py-2 focus:bg-muted focus:text-foreground data-[state=checked]:bg-muted"
            >
              <RelBadge status={s} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const descriptionBlock = nonEmpty(description) ? (
    <ExpandableText text={description!} className="pt-1" />
  ) : null;

  // Indicateur discret « modifié » quand un champ a été édité manuellement (ai_field_sources).
  const modifiedTag = (k: keyof MissionFields) =>
    aiFieldSources[k] === 'user_edited' ? (
      <span className="ml-2 align-middle text-[11px] font-normal text-muted-foreground">modifié</span>
    ) : null;

  const objectiveBlock = (big: boolean) => (
    <div className="space-y-2">
      <Label htmlFor="mission-objective" className="text-sm font-semibold">
        Objectif de la visite{modifiedTag('objective')}
      </Label>
      {shouldSkeleton('objective') ? (
        <LineSkeleton lines={2} />
      ) : (
        <Textarea
          id="mission-objective"
          value={fields.objective}
          onChange={set('objective')}
          rows={2}
          className={cn('resize-none font-medium', big ? 'text-lg leading-relaxed' : 'text-base')}
        />
      )}
    </div>
  );

  const openingBlock = (big: boolean) => (
    <div className="space-y-2">
      <Label htmlFor="mission-opening" className="text-sm font-semibold">
        Phrase d'ouverture{modifiedTag('opening_line')}
      </Label>
      {shouldSkeleton('opening_line') ? (
        <LineSkeleton lines={3} />
      ) : (
        <Textarea
          id="mission-opening"
          value={fields.opening_line}
          onChange={set('opening_line')}
          rows={big ? 4 : 3}
          className={cn('resize-none', big ? 'text-lg leading-relaxed' : 'text-base')}
        />
      )}
    </div>
  );

  // Question 0 (orientation) — lecture seule (ai_meta), AVANT le TOP 3, ne compte pas dedans.
  const q0Block = (big: boolean) => {
    // Q0 est toujours régénérée par l'IA (non éditable) → skeleton dès qu'une régénération tourne.
    if (regenerating) {
      return (
        <div className="space-y-1.5 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Question d'orientation · pour situer votre interlocuteur
          </p>
          <LineSkeleton lines={2} />
        </div>
      );
    }
    return nonEmpty(aiMeta?.q0_role_check) ? (
      <div className="space-y-1.5 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Question d'orientation · pour situer votre interlocuteur
        </p>
        <p className={cn('text-foreground', big ? 'text-lg leading-relaxed' : 'text-base')}>
          {aiMeta!.q0_role_check}
        </p>
      </div>
    ) : null;
  };

  const top3Block = (big: boolean) => (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">TOP 3 — questions à poser</Label>
      {(['top_q1', 'top_q2', 'top_q3'] as const).map((k, i) => (
        <div key={k} className="flex gap-2 items-start">
          <span
            className={cn(
              'mt-2.5 shrink-0 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center',
              big ? 'h-7 w-7 text-sm' : 'h-6 w-6 text-xs',
            )}
          >
            {i + 1}
          </span>
          <div className="flex-1 space-y-1">
            {shouldSkeleton(k) ? (
              <LineSkeleton lines={2} />
            ) : (
              <>
                <Textarea
                  value={fields[k]}
                  onChange={set(k)}
                  rows={2}
                  className={cn('resize-none', big ? 'text-lg leading-relaxed' : 'text-base')}
                />
                {aiFieldSources[k] === 'user_edited' && (
                  <span className="text-[11px] text-muted-foreground">modifié</span>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  // Badge de confiance — orange UNIQUEMENT si « faible » (action requise), neutre sinon.
  const confidenceBadge = (() => {
    const band = aiMeta?.confidence_band;
    if (!band) return null;
    const score = aiMeta?.confidence_score;
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
          band === 'faible'
            ? 'border-accent/50 bg-accent/[0.06] text-foreground'
            : 'border-border bg-background text-muted-foreground',
        )}
      >
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            band === 'faible' ? 'bg-accent' : band === 'moyen' ? 'bg-stone-400' : 'bg-emerald-600/60',
          )}
          aria-hidden="true"
        />
        Confiance {band}{typeof score === 'number' ? ` · ${score}/100` : ''}
      </span>
    );
  })();

  // Mention discrète si l'IA a basculé sur le scaffold (contenu de base valide).
  const scaffoldNotice = aiMeta?.generator === 'scaffold' ? (
    <span className="text-[11px] text-muted-foreground">
      Enrichissement IA momentanément indisponible.
    </span>
  ) : null;

  // Nudge de complétion — profil faible/moyen : action requise (accent autorisé).
  const completionNudge = (() => {
    const band = aiMeta?.confidence_band;
    if (band !== 'faible' && band !== 'moyen') return null;
    const missing = aiMeta?.missing_profile_fields ?? [];
    return (
      <div className="space-y-1.5 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5">
        <p className="text-xs text-foreground/80">
          Complète ton profil d'offre pour des questions plus précises.
        </p>
        {missing.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            À renseigner : {missing.map((f) => MISSING_PROFILE_LABELS[f] ?? f).join(' · ')}
          </p>
        )}
        <button
          type="button"
          onClick={() => { onOpenChange(false); onOpenSettings(); }}
          className="text-xs text-accent underline underline-offset-2 hover:text-accent/80"
        >
          Compléter mon profil
        </button>
      </div>
    );
  })();

  // « Pourquoi ces questions ? » — intentions Q1/Q2/Q3 (contexte → enjeu → contact).
  const whyQuestions = (() => {
    const intents = aiMeta?.question_intents;
    if (!intents || !(intents.q1 || intents.q2 || intents.q3)) return null;
    const rows: Array<[string, string | undefined]> = [
      ['Q1', intents.q1], ['Q2', intents.q2], ['Q3', intents.q3],
    ];
    return (
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          Pourquoi ces questions ?
        </summary>
        <ul className="mt-2 space-y-1.5 pl-5 text-xs text-muted-foreground">
          {rows.filter(([, v]) => nonEmpty(v)).map(([lbl, v]) => (
            <li key={lbl}>
              <span className="font-medium text-foreground/80">{lbl} —</span> {v}
            </li>
          ))}
        </ul>
      </details>
    );
  })();

  const regenerateButton = (
    <div className="flex items-center justify-between gap-3 pt-1">
      {generating ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Génération…
        </span>
      ) : (
        <span />
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={onRegenerateClick}
        disabled={generating}
        className="h-8 shrink-0"
      >
        <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Régénérer
      </Button>
    </div>
  );

  // Encart sobre : entreprise non caractérisée → inviter à poser un statut (pas de génération auto).
  const characterizeCard = (
    <div className="space-y-1 rounded-lg border border-border bg-muted/20 px-4 py-5 text-center">
      <p className="text-sm font-medium text-foreground">
        Caractérise cette entreprise pour générer sa mission
      </p>
      <p className="text-xs text-muted-foreground">
        Choisis un statut (client, prospect…) ci-dessus — objectif, ouverture, Question 0 et TOP 3
        seront générés automatiquement.
      </p>
    </div>
  );

  const missionSkeleton = (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Génération de la mission…
      </div>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );

  // Mission jamais générée (échec ou en attente) alors que le compte est caractérisé.
  const retryCard = (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 px-4 py-5 text-center">
      <p className="text-sm text-muted-foreground">La mission n'a pas encore été générée.</p>
      <Button variant="outline" size="sm" onClick={() => void generateMission({})} className="h-8">
        <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Générer la mission
      </Button>
    </div>
  );

  // Mission complète (objectif prééminent → ouverture → Q0 → TOP 3 → confiance/nudge/why → régénérer).
  const hasMission =
    aiGeneratedAt != null ||
    nonEmpty(fields.objective) || nonEmpty(fields.opening_line) ||
    nonEmpty(fields.top_q1) || nonEmpty(fields.top_q2) || nonEmpty(fields.top_q3);

  // Régénération IA en cours ALORS qu'un contenu existe déjà : on remplace le texte par des
  // skeletons pour signaler clairement l'arrivée d'un nouveau contenu (≠ première génération,
  // ≠ édition manuelle inline qui, elle, n'active jamais `generating`).
  const regenerating = generating && hasMission;
  // Un champ éditable passe en skeleton s'il va réellement être remplacé :
  //  - force (« Tout régénérer ») → tous les champs ;
  //  - sans force → seulement ceux qui ne sont pas édités à la main (préservés par l'EF).
  const shouldSkeleton = (k: keyof MissionFields) =>
    regenerating && (regenForce || aiFieldSources[k] !== 'user_edited');

  const renderMissionBody = (big: boolean) => {
    if (rawRelStatus == null) return characterizeCard;
    if (generating && !hasMission) return missionSkeleton;
    if (!hasMission) return retryCard;
    return (
      <div className="space-y-4">
        {objectiveBlock(big)}
        {openingBlock(big)}
        {q0Block(big)}
        {top3Block(big)}
        {(confidenceBadge || scaffoldNotice) && (
          <div className="flex flex-wrap items-center gap-2">
            {confidenceBadge}
            {scaffoldNotice}
          </div>
        )}
        {completionNudge}
        {whyQuestions}
        {regenerateButton}
      </div>
    );
  };

  const notesBlock = (
    <div className="space-y-3 pt-2 border-t">
      <Label className="text-sm font-semibold">Notes</Label>
      <div className="space-y-2">
        <Textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onKeyDown={onNoteKeyDown}
          rows={2}
          placeholder="Une info à retenir sur ce compte…"
          className="resize-none text-base"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">Ctrl/Cmd + Entrée pour ajouter</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addNote}
            disabled={!nonEmpty(noteDraft) || addingNote}
            className="h-9"
          >
            {addingNote ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
            Ajouter
          </Button>
        </div>
      </div>
      {notes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune note pour l'instant.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border bg-muted/20 px-3 py-2">
              <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{n.body}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-[11px] text-muted-foreground">{fmtStamp(n.created_at)}</span>
                <RadarAuthorBadge authorName={n.author_name} activeMemberCount={activeMemberCount} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const tasksBlock = (
    <div className="space-y-3 pt-2 border-t">
      <Label className="text-sm font-semibold">Tâches</Label>
      <div className="space-y-2">
        <Input
          value={taskDraft}
          onChange={(e) => setTaskDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addTask(); } }}
          placeholder="Une action à faire…"
          className="h-11 text-base"
        />
        <div className="flex items-center gap-2">
          <Popover open={dueOpen} onOpenChange={setDueOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={`h-9 flex-1 justify-start text-left font-normal ${taskDue ? '' : 'text-muted-foreground'}`}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                {taskDue ? fmtDue(taskDue.toISOString()) : 'Échéance (option.)'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={taskDue}
                onSelect={(d) => { setTaskDue(d ?? undefined); setDueOpen(false); }}
                initialFocus
                locale={fr}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          {taskDue && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTaskDue(undefined)}
              className="h-9 px-2 text-muted-foreground"
            >
              Effacer
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addTask}
            disabled={!nonEmpty(taskDraft) || addingTask}
            className="h-9"
          >
            {addingTask ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
            Ajouter
          </Button>
        </div>
      </div>
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune tâche.</p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
              <Checkbox
                checked={t.done}
                onCheckedChange={(v) => toggleTask(t.id, v === true)}
                className="mt-0.5 h-5 w-5"
              />
              <div className="min-w-0 flex-1">
                <p className={`text-sm break-words ${t.done ? 'line-through text-muted-foreground' : 'text-foreground/90'}`}>
                  {t.body}
                </p>
                {nonEmpty(t.due_at) && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Échéance : {fmtDue(t.due_at)}</p>
                )}
                <RadarAuthorBadge
                  authorName={t.author_name}
                  activeMemberCount={activeMemberCount}
                  className="mt-0.5"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // Contenu « préparation » (mission complète, rendu depuis l'état persisté) réutilisé partout.
  const preparationInner = renderMissionBody(true);

  // Bloc « Ce que je dis » (préparation ouverte, terrain).
  const preparationSection = (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-accent">
        <MessageSquare className="h-4 w-4 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide">Ce que je dis</span>
      </div>
      {preparationInner}
    </section>
  );

  // Bloc « Ce que je capture » (notes + tâches + vocal, terrain).
  const captureSection = (
    <section className="space-y-6">
      <div className="flex items-center gap-2 text-accent">
        <StickyNote className="h-4 w-4 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide">Ce que je capture</span>
      </div>
      {target && (
        <VoiceNoteCapture
          companyId={target.companyId}
          eventId={target.eventId}
          onValidated={handleVoiceValidated}
        />
      )}
      {notesBlock}
      {tasksBlock}
    </section>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col gap-0 p-0 overflow-hidden"
      >
        {/* Une seule zone scrollable : l'en-tête défile avec le contenu (non fixe). */}
        <div className="flex-1 overflow-y-auto">
        {isTerrain ? (
          /* Mode TERRAIN : l'ENTREPRISE est l'élément principal (en-tête compact). */
          <SheetHeader className="px-5 pt-6 pb-4 border-b text-left space-y-2">
            <div className="flex items-center gap-2 text-accent">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wide truncate">
                Mode salon · {target?.eventName ?? 'Salon'}
              </span>
            </div>
            <SheetTitle className="font-display text-2xl leading-tight">
              {target?.nomExposant ?? target?.companyName}
            </SheetTitle>
            <SheetDescription className="space-y-1">
              {showCrm && (
                <span className="block text-xs text-muted-foreground">CRM : {target?.companyName}</span>
              )}
              <span className="flex items-center gap-1 text-sm font-medium text-foreground/80">
                <MapPin className="h-4 w-4 shrink-0" /> {standLabel}
              </span>
            </SheetDescription>
            {statusSelect}
            {descriptionBlock}
            {autoSaveIndicator}
          </SheetHeader>
        ) : (
          /* Mode PREPA (inchangé) : le SALON est l'élément principal. */
          <SheetHeader className="px-5 pt-6 pb-4 border-b text-left space-y-2">
            <div className="flex items-center gap-2 text-accent">
              <Target className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Préparer ma visite</span>
            </div>

            {/* Niveau SALON : le salon est l'élément principal (on prépare CE salon). */}
            <SheetTitle className="font-display text-xl leading-snug">
              {target?.eventName ?? 'Salon'}
            </SheetTitle>
            {nonEmpty(eventDateLabel) && (
              <p className="text-xs text-muted-foreground">{eventDateLabel}</p>
            )}

            {/* Niveau ENTREPRISE : sous-titre discret (identité + CRM + stand). */}
            <SheetDescription className="space-y-1 pt-1">
              <span className="block text-sm font-medium text-foreground/90">
                {target?.nomExposant ?? target?.companyName}
              </span>
              {showCrm && (
                <span className="block text-xs text-muted-foreground">CRM : {target?.companyName}</span>
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {standLabel}
              </span>
            </SheetDescription>

            {/* Statut relationnel — attribut ENTREPRISE : compact, en haut, jamais l'élément principal. */}
            {statusSelect}

            {descriptionBlock}
            {autoSaveIndicator}
          </SheetHeader>
        )}


        <div className="px-5 py-5 space-y-6">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : isTerrain ? (
            /* Mode TERRAIN : ce que je dis (gros) → ce que je capture → secondaire replié. */
            <>
              {onToggleVisited && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onToggleVisited}
                  className={cn(
                    'w-full min-h-[44px] gap-2',
                    visited
                      ? 'border-emerald-600/40 text-emerald-700 hover:text-emerald-700'
                      : 'border-border/70 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Check className={cn('h-4 w-4', visited && 'text-emerald-600')} />
                  {visited ? 'Visité' : 'Marquer comme visité'}
                </Button>
              )}

              {/* Hiérarchie adaptative : le CRM prend le dessus dès qu'il existe du contenu. */}
              {hasCrmContent ? (
                <>
                  {/* CE QUE JE CAPTURE (CRM) — en haut, ouvert */}
                  {captureSection}

                  {/* PRÉPARATION — repliée, rouvrable, jamais supprimée */}
                  <Accordion type="single" collapsible className="border-t">
                    <AccordionItem value="preparation" className="border-b-0">
                      <AccordionTrigger
                        className="text-sm font-semibold hover:no-underline"
                        style={{ color: '#04316d' }}
                      >
                        Préparation
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-1">{preparationInner}</div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </>
              ) : (
                <>
                  {/* CE QUE JE DIS — mis en avant, gros, lecture immédiate */}
                  {preparationSection}

                  {/* CE QUE JE CAPTURE — actions immédiates */}
                  <div className="pt-4 border-t">{captureSection}</div>
                </>
              )}
            </>
          ) : (
            /* Mode PREPA (inchangé). */
            <>
              {/* Corps du Sheet : tout ce qui suit est propre à CE salon. */}
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Préparation pour ce salon
              </p>

              {renderMissionBody(false)}
              {notesBlock}
              {tasksBlock}
            </>
          )}
        </div>
        </div>

      </SheetContent>

      <AlertDialog open={regenConfirm} onOpenChange={setRegenConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tu as modifié une ou plusieurs questions.</AlertDialogTitle>
            <AlertDialogDescription>
              Choisis comment régénérer la mission. « Garder mes modifications » ne régénère que les
              champs non édités ; « Tout régénérer » écrase aussi tes éditions manuelles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setRegenConfirm(false); void generateMission({ force: false }); }}
            >
              Garder mes modifications
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => { setRegenConfirm(false); void generateMission({ force: true }); }}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Tout régénérer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
};

export default RadarMissionSheet;
