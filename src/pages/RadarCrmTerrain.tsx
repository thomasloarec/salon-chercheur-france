import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, MapPin, Star, ChevronRight, Calendar, StickyNote, CheckSquare,
  Check, Plus, Loader2, X, Building2, ClipboardList, Mic,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';
import RadarMissionSheet, { type MissionTarget } from '@/components/radar-crm/RadarMissionSheet';
import RadarCrmSettingsDialog from '@/components/radar-crm/RadarCrmSettingsDialog';
import RadarTerrainAddCompanySheet from '@/components/radar-crm/RadarTerrainAddCompanySheet';
import TerrainVoiceCapture from '@/components/radar-crm/TerrainVoiceCapture';
import {
  type RelationshipStatus, RELATIONSHIP_META, normalizeRelationship, DEFAULT_RELATIONSHIP,
} from '@/lib/radarCrm/relationship';
import { cn } from '@/lib/utils';
import { eventPhase, showDebrief } from '@/lib/radarCrm/eventPhase';

type Pref = 'starred' | 'ignored' | 'normal';

/** Orange doctrine : SEUL usage orange de la page = le badge « à valider » (validation différée). */
const ORANGE = '#ff751f';

/** Shape renvoyée par get_radar_salon_missions (typée Json côté RPC). */
interface SalonMissionCompany {
  crm_company_id: string;
  company_name: string | null;
  description: string | null;
  nom_exposant: string | null;
  stands: string[] | null;
  relationship_status: string | null;
  visited: boolean | null;
  mission_id: string | null;
  objective: string | null;
  opening_line: string | null;
  top_q1: string | null;
  top_q2: string | null;
  top_q3: string | null;
  pref_status: Pref | null;
  notes: unknown[] | null;
  tasks: Array<{ done?: boolean | null }> | null;
}

interface SalonMissionEvent {
  event_id?: string | null;
  nom_event?: string | null;
  ville?: string | null;
  nom_lieu?: string | null;
  date_debut?: string | null;
  date_fin?: string | null;
}

interface SalonMissionsPayload {
  event: SalonMissionEvent | null;
  companies: SalonMissionCompany[];
}

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

const standLabelFor = (stands: string[] | null): string => {
  const list = (stands ?? []).map((s) => (s ?? '').trim()).filter(Boolean);
  return list.length ? `Stand ${list.join(', ')}` : 'Stand non renseigné';
};

/** Premier stand exploitable (pour le tri de tournée). null si aucun. */
const primaryStand = (stands: string[] | null): string | null => {
  const list = (stands ?? []).map((s) => (s ?? '').trim()).filter(Boolean);
  return list.length ? list[0] : null;
};

/** Tri naturel de tournée : stands d'abord (A12 < A103 < B4), sans-stand en fin. */
const byStand = (a: SalonMissionCompany, b: SalonMissionCompany): number => {
  const sa = primaryStand(a.stands);
  const sb = primaryStand(b.stands);
  if (sa && !sb) return -1;
  if (!sa && sb) return 1;
  if (sa && sb) {
    const cmp = sa.localeCompare(sb, 'fr', { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) return cmp;
  }
  const na = (a.nom_exposant ?? a.company_name ?? '').toLocaleLowerCase('fr');
  const nb = (b.nom_exposant ?? b.company_name ?? '').toLocaleLowerCase('fr');
  return na.localeCompare(nb, 'fr');
};

/** Statut relationnel — point 8px + libellé neutre, sans pilule (même doctrine que le cockpit). */
const RelBadge: React.FC<{ status: RelationshipStatus }> = ({ status }) => {
  const meta = RELATIONSHIP_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap',
        meta.badge,
      )}
    >
      <span className={cn('h-2 w-2 rounded-full shrink-0', meta.dot)} aria-hidden="true" />
      {meta.label}
    </span>
  );
};

const RadarCrmTerrain: React.FC = () => {
  return <RadarCrmTerrainInner />;
};

interface TerrainRowProps {
  company: SalonMissionCompany;
  visited: boolean;
  relationship: RelationshipStatus;
  noteCount: number;
  noteOpen: boolean;
  noteText: string;
  savingNote: boolean;
  onOpenMission: () => void;
  onToggleVisited: () => void;
  onOpenNote: () => void;
  onCloseNote: () => void;
  onChangeNote: (v: string) => void;
  onSubmitNote: () => void;
}

/** Ligne de check-list terrain : grande, tactile, actions directes. */
const TerrainRow: React.FC<TerrainRowProps> = ({
  company: c, visited, relationship, noteCount, noteOpen, noteText, savingNote,
  onOpenMission, onToggleVisited, onOpenNote, onCloseNote, onChangeNote, onSubmitNote,
}) => {
  const taskCount = Array.isArray(c.tasks) ? c.tasks.filter((t) => !t?.done).length : 0;
  const starred = c.pref_status === 'starred';
  const name = c.nom_exposant ?? c.company_name ?? 'Entreprise';

  return (
    <li>
      <div
        className={cn(
          'rounded-xl border bg-card transition-colors',
          visited ? 'border-border/50 opacity-60' : starred ? 'border-accent/50' : 'border-border/60',
        )}
      >
        {/* Zone tap → Sheet mission (hors boutons) */}
        <button
          type="button"
          onClick={onOpenMission}
          className="group w-full text-left p-4 md:p-5 rounded-t-xl hover:bg-secondary/40 active:bg-secondary/60 transition-colors"
        >
          <div className="flex items-start gap-3">
            {starred && (
              <Star className="h-5 w-5 text-accent fill-accent shrink-0 mt-0.5" aria-label="Compte prioritaire" />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'font-display text-lg md:text-xl font-semibold leading-snug truncate',
                  visited ? 'text-muted-foreground line-through decoration-1' : 'text-foreground',
                )}
                title={name}
              >
                {name}
              </p>
              <p className="text-sm text-foreground/70 mt-1 flex items-center gap-1 font-medium">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                {standLabelFor(c.stands)}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3">
                <RelBadge status={relationship} />
                {(noteCount > 0 || taskCount > 0) && (
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {noteCount > 0 && (
                      <span className="flex items-center gap-1">
                        <StickyNote className="h-3.5 w-3.5" /> {noteCount} note{noteCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {taskCount > 0 && (
                      <span className="flex items-center gap-1">
                        <CheckSquare className="h-3.5 w-3.5" /> {taskCount} tâche{taskCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/50 shrink-0 self-center transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>

        {/* Actions directes — Note = action primaire (accent orange), Visité = secondaire (neutre, discret) */}
        <div className="flex items-stretch gap-2 border-t border-border/60 p-3">
          <Button
            type="button"
            variant="default"
            className="flex-[1.25] min-h-[44px] gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={noteOpen ? onCloseNote : onOpenNote}
            aria-expanded={noteOpen}
          >
            <Plus className="h-4 w-4" /> Note
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 min-h-[44px] gap-2 border-border/70 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            onClick={onToggleVisited}
          >
            <Check className={cn('h-4 w-4', visited && 'text-emerald-600')} />
            {visited ? 'Vu' : 'Visité'}
          </Button>
        </div>

        {/* Capture éclair en place */}
        {noteOpen && (
          <div className="px-3 pb-3 space-y-2">
            <Textarea
              autoFocus
              value={noteText}
              onChange={(e) => onChangeNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSubmitNote();
                }
              }}
              placeholder="Note éclair… (Entrée pour ajouter)"
              className="min-h-[64px] text-base"
            />
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onCloseNote} className="gap-1">
                <X className="h-4 w-4" /> Annuler
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onSubmitNote}
                disabled={savingNote || !noteText.trim()}
                className="gap-1"
              >
                {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Ajouter
              </Button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
};

const RadarCrmTerrainInner: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<SalonMissionsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mission, setMission] = useState<{ target: MissionTarget; companyId: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Surcouche optimiste du statut relationnel (indexée par crm_company_id).
  const [relOverrides, setRelOverrides] = useState<Record<string, RelationshipStatus>>({});

  // Surcouches optimistes terrain (indexées par crm_company_id).
  const [visitedOverrides, setVisitedOverrides] = useState<Record<string, boolean>>({});
  const [noteAdds, setNoteAdds] = useState<Record<string, number>>({});

  // Capture éclair : ligne dont le mini-champ note est ouvert.
  const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Auth gate — même comportement que le cockpit.
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=${encodeURIComponent(`/radar-crm/terrain/${eventId ?? ''}`)}`);
    }
  }, [user, authLoading, navigate, eventId]);

  const load = useCallback(async () => {
    if (!eventId || !user) return;
    setLoading(true);
    setError(null);
    // Gating entitlement : on s'appuie sur get_my_radar_view (comme le cockpit).
    const { data: view, error: viewErr } = await supabase.rpc('get_my_radar_view', { p_import_id: null });
    if (viewErr) {
      console.error('[RadarCRM] get_my_radar_view failed:', viewErr);
    } else {
      const v = view as unknown as { has_access?: boolean; status?: string } | null;
      const locked = v?.status === 'trial_expired' || v?.status === 'free' || v?.has_access === false;
      if (locked) {
        navigate('/radar-crm/results', { replace: true });
        return;
      }
    }

    const { data, error: rpcErr } = await supabase.rpc('get_radar_salon_missions', { p_event_id: eventId });
    if (rpcErr) {
      console.error('[RadarCRM] get_radar_salon_missions failed:', rpcErr);
      setError(rpcErr.message);
      setPayload(null);
      setLoading(false);
      return;
    }
    const p = data as unknown as SalonMissionsPayload | null;
    setPayload(
      p
        ? { event: p.event ?? null, companies: Array.isArray(p.companies) ? p.companies : [] }
        : { event: null, companies: [] },
    );
    setRelOverrides({});
    setVisitedOverrides({});
    setNoteAdds({});
    setNoteOpenFor(null);
    setNoteText('');
    setLoading(false);
  }, [eventId, user, navigate]);

  useEffect(() => {
    if (!user) return;
    void trackRadarEvent('radar_salon_mode_viewed', { eventId });
    void load();
  }, [user, load, eventId]);

  const ev = payload?.event ?? null;
  const eventName = ev?.nom_event ?? 'Salon';
  // Phase du salon : le débrief n'est proposé qu'à partir du 1er jour du salon.
  const phase = eventPhase(ev?.date_debut, ev?.date_fin);
  const dateLabel = useMemo(() => {
    const d1 = fmtDate(ev?.date_debut);
    const d2 = fmtDate(ev?.date_fin);
    if (d1 && d2 && d1 !== d2) return `${d1} – ${d2}`;
    return d1 ?? '';
  }, [ev?.date_debut, ev?.date_fin]);

  const getRel = (c: SalonMissionCompany): RelationshipStatus =>
    relOverrides[c.crm_company_id] ?? normalizeRelationship(c.relationship_status);

  const setRel = async (companyId: string, next: RelationshipStatus) => {
    const prev = getRel(
      (payload?.companies ?? []).find((c) => c.crm_company_id === companyId) ?? ({} as SalonMissionCompany),
    );
    if (prev === next) return;
    setRelOverrides((o) => ({ ...o, [companyId]: next }));
    const { error: rpcErr } = await supabase.rpc('set_radar_company_relationship', {
      p_crm_company_id: companyId,
      p_status: next,
    });
    if (rpcErr) {
      console.error('[RadarCRM] set_radar_company_relationship failed:', rpcErr);
      setRelOverrides((o) => ({ ...o, [companyId]: prev }));
      toast({
        title: 'Action impossible',
        description: 'Impossible de mettre à jour le statut de ce compte.',
        variant: 'destructive',
      });
    }
  };

  const allCompanies = payload?.companies ?? [];

  const getVisited = (c: SalonMissionCompany): boolean =>
    visitedOverrides[c.crm_company_id] ?? !!c.visited;

  const noteCountFor = (c: SalonMissionCompany): number =>
    (Array.isArray(c.notes) ? c.notes.length : 0) + (noteAdds[c.crm_company_id] ?? 0);

  // Check-list de tournée : non visités (par stand) puis visités (par stand).
  const { toSee, seen } = useMemo(() => {
    const list = [...allCompanies];
    const toSee = list.filter((c) => !getVisited(c)).sort(byStand);
    const seen = list.filter((c) => getVisited(c)).sort(byStand);
    return { toSee, seen };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCompanies, visitedOverrides]);

  const totalCount = allCompanies.length;
  const seenCount = seen.length;
  const toSeeCount = toSee.length;

  const toggleVisited = async (c: SalonMissionCompany) => {
    if (!eventId) return;
    const id = c.crm_company_id;
    const next = !getVisited(c);
    setVisitedOverrides((o) => ({ ...o, [id]: next }));
    const { error: rpcErr } = await supabase.rpc('set_radar_mission_visited', {
      p_crm_company_id: id,
      p_event_id: eventId,
      p_visited: next,
    });
    if (rpcErr) {
      console.error('[RadarCRM] set_radar_mission_visited failed:', rpcErr);
      setVisitedOverrides((o) => ({ ...o, [id]: !next }));
      toast({
        title: 'Action impossible',
        description: 'Impossible de mettre à jour le statut « visité ».',
        variant: 'destructive',
      });
    }
  };

  const openNote = (c: SalonMissionCompany) => {
    setNoteOpenFor(c.crm_company_id);
    setNoteText('');
  };
  const closeNote = () => {
    setNoteOpenFor(null);
    setNoteText('');
  };

  const submitNote = async (c: SalonMissionCompany) => {
    if (!eventId) return;
    const body = noteText.trim();
    if (!body || savingNote) return;
    const id = c.crm_company_id;
    setSavingNote(true);
    // Optimiste : incrémente le compteur et ferme le champ.
    setNoteAdds((o) => ({ ...o, [id]: (o[id] ?? 0) + 1 }));
    closeNote();
    const { error: rpcErr } = await supabase.rpc('add_radar_mission_note', {
      p_crm_company_id: id,
      p_event_id: eventId,
      p_body: body,
    });
    setSavingNote(false);
    if (rpcErr) {
      console.error('[RadarCRM] add_radar_mission_note failed:', rpcErr);
      setNoteAdds((o) => ({ ...o, [id]: Math.max(0, (o[id] ?? 1) - 1) }));
      toast({
        title: 'Note non enregistrée',
        description: 'Réessayez d’ajouter cette note.',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Note ajoutée' });
    }
  };

  const openMission = (c: SalonMissionCompany) => {
    if (!eventId) return;
    void trackRadarEvent('radar_mission_opened', { eventId, source: 'salon_mode' });
    setMission({
      companyId: c.crm_company_id,
      target: {
        companyId: c.crm_company_id,
        companyName: c.company_name ?? '',
        nomExposant: c.nom_exposant,
        stand: (c.stands ?? []).filter(Boolean).join(', ') || null,
        eventId,
        eventName,
      },
    });
  };

  /** Ouvre le Sheet mission pour un compte identifié par son id (compte ajouté ou déjà présent). */
  const openMissionById = (companyId: string, name: string) => {
    if (!eventId) return;
    const c = (payload?.companies ?? []).find((x) => x.crm_company_id === companyId);
    if (c) {
      openMission(c);
      return;
    }
    void trackRadarEvent('radar_mission_opened', { eventId, source: 'salon_mode' });
    setMission({
      companyId,
      target: {
        companyId,
        companyName: name,
        nomExposant: name,
        stand: null,
        eventId,
        eventName,
      },
    });
  };

  const activeCompany = mission
    ? (payload?.companies ?? []).find((c) => c.crm_company_id === mission.companyId) ?? null
    : null;

  return (
    <div className="min-h-screen bg-muted/10 font-body">
      <Helmet>
        <title>Mode salon — {eventName} | Lotexpo</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      {/* Barre supérieure fine — usage sur stand */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Retour"
            onClick={() => navigate('/radar-crm/results')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-foreground leading-tight truncate">
              {loading ? 'Mode salon' : eventName}
            </p>
            {dateLabel && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <Calendar className="h-3 w-3 shrink-0" /> {dateLabel}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 md:py-8">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <div className="text-center py-16 space-y-4">
            <p className="text-sm text-muted-foreground">Impossible de charger ce salon.</p>
            <Button variant="outline" onClick={() => void load()}>Réessayer</Button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-foreground leading-tight">
                {eventName}
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {ev?.ville && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {ev.ville}
                  </span>
                )}
              </p>
              {totalCount > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>{seenCount} vus</span>
                    <span className="text-muted-foreground font-normal">·</span>
                    <span className={cn(toSeeCount > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                      {toSeeCount} à voir
                    </span>
                  </div>
                  {showDebrief(phase) && (
                    <Button
                      variant="outline"
                      onClick={() => eventId && navigate(`/radar-crm/debrief/${eventId}`)}
                      className="gap-2 min-h-[44px]"
                    >
                      <ClipboardList className="h-4 w-4" /> Débrief du salon
                    </Button>
                  )}
                </div>
              )}
            </div>

            {totalCount === 0 ? (
              <div className="text-center py-16 text-sm text-muted-foreground">
                Aucune entreprise de votre CRM détectée sur ce salon.
              </div>
            ) : (
              <div className="space-y-3">
                <ul className="space-y-3">
                  {toSee.map((c) => (
                    <TerrainRow
                      key={c.crm_company_id}
                      company={c}
                      visited={false}
                      relationship={getRel(c)}
                      noteCount={noteCountFor(c)}
                      noteOpen={noteOpenFor === c.crm_company_id}
                      noteText={noteText}
                      savingNote={savingNote}
                      onOpenMission={() => openMission(c)}
                      onToggleVisited={() => void toggleVisited(c)}
                      onOpenNote={() => openNote(c)}
                      onCloseNote={closeNote}
                      onChangeNote={setNoteText}
                      onSubmitNote={() => void submitNote(c)}
                    />
                  ))}
                </ul>

                {seen.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 pt-4 pb-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Déjà vus ({seenCount})
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    <ul className="space-y-3">
                      {seen.map((c) => (
                        <TerrainRow
                          key={c.crm_company_id}
                          company={c}
                          visited
                          relationship={getRel(c)}
                          noteCount={noteCountFor(c)}
                          noteOpen={noteOpenFor === c.crm_company_id}
                          noteText={noteText}
                          savingNote={savingNote}
                          onOpenMission={() => openMission(c)}
                          onToggleVisited={() => void toggleVisited(c)}
                          onOpenNote={() => openNote(c)}
                          onCloseNote={closeNote}
                          onChangeNote={setNoteText}
                          onSubmitNote={() => void submitNote(c)}
                        />
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* FAB compact — ajouter une entreprise rencontrée (atteignable au pouce) */}
      {!loading && !error && eventId && (
        <Button
          type="button"
          size="icon"
          onClick={() => setAddOpen(true)}
          aria-label="Ajouter une entreprise"
          className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full shadow-lg bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <span className="relative inline-flex items-center justify-center">
            <Building2 className="h-6 w-6" />
            <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent-foreground text-accent">
              <Plus className="h-3 w-3" strokeWidth={3} />
            </span>
          </span>
        </Button>
      )}

      {eventId && (
        <RadarTerrainAddCompanySheet
          open={addOpen}
          onOpenChange={setAddOpen}
          eventId={eventId}
          onAddedCompany={(id, name) => {
            void load();
            openMissionById(id, name);
          }}
          onOpenExisting={(id, name) => openMissionById(id, name)}
        />
      )}

      <RadarMissionSheet
        target={mission?.target ?? null}
        open={!!mission}
        mode="terrain"
        visited={activeCompany ? getVisited(activeCompany) : false}
        onToggleVisited={() => { if (activeCompany) void toggleVisited(activeCompany); }}
        onOpenChange={(o) => {
          if (!o) {
            setMission(null);
            // Rafraîchit les compteurs notes/tâches capturés dans le Sheet.
            void load();
          }
        }}
        relationship={activeCompany ? getRel(activeCompany) : DEFAULT_RELATIONSHIP}
        onChangeRelationship={(next) => {
          if (mission) void setRel(mission.companyId, next);
        }}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <RadarCrmSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </div>
  );
};

export default RadarCrmTerrain;
