import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, MapPin, Calendar, Copy, Download, Check, StickyNote,
  CheckSquare, Sparkles, Target, Mic,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';
import {
  type RelationshipStatus, RELATIONSHIP_META, normalizeRelationship,
} from '@/lib/radarCrm/relationship';
import { cn } from '@/lib/utils';

/** Note / tâche telles que renvoyées par get_radar_salon_missions. */
interface MissionNote { body?: string | null; created_at?: string | null; source?: string | null }
interface MissionTask { body?: string | null; due_at?: string | null; done?: boolean | null; source?: string | null }

interface DebriefCompany {
  crm_company_id: string;
  company_name: string | null;
  website: string | null;
  normalized_domain: string | null;
  nom_exposant: string | null;
  stands: string[] | null;
  relationship_status: string | null;
  objective: string | null;
  opening_line: string | null;
  top_q1: string | null;
  top_q2: string | null;
  top_q3: string | null;
  origin: string | null;
  visited: boolean | null;
  notes: MissionNote[] | null;
  tasks: MissionTask[] | null;
  description: string | null;
}

interface DebriefEvent {
  event_id?: string | null;
  nom_event?: string | null;
  ville?: string | null;
  date_debut?: string | null;
  date_fin?: string | null;
}

interface DebriefPayload {
  event: DebriefEvent | null;
  companies: DebriefCompany[];
}

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

const standLabel = (stands: string[] | null): string => {
  const list = (stands ?? []).map((s) => (s ?? '').trim()).filter(Boolean);
  return list.length ? list.join(', ') : '';
};

const companyLabel = (c: DebriefCompany): string =>
  c.nom_exposant ?? c.company_name ?? 'Entreprise';

const notesOf = (c: DebriefCompany): MissionNote[] =>
  Array.isArray(c.notes) ? c.notes : [];
const tasksOf = (c: DebriefCompany): MissionTask[] =>
  Array.isArray(c.tasks) ? c.tasks : [];

/** Une entreprise est « travaillée » dès qu'il y a la moindre trace d'activité. */
const isWorked = (c: DebriefCompany): boolean =>
  !!c.visited
  || notesOf(c).length > 0
  || tasksOf(c).length > 0
  || !!(c.relationship_status && c.relationship_status.trim())
  || !!(c.objective && c.objective.trim());

const isNew = (c: DebriefCompany): boolean => c.origin === 'rencontre';

/** Échappement CSV RFC-4180. */
const csvCell = (v: string | null | undefined): string => {
  const s = (v ?? '').toString();
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const RelBadge: React.FC<{ status: RelationshipStatus }> = ({ status }) => {
  const meta = RELATIONSHIP_META[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap', meta.badge)}>
      <span className={cn('h-2 w-2 rounded-full shrink-0', meta.dot)} aria-hidden="true" />
      {meta.label}
    </span>
  );
};

/** Marqueur discret et neutre pour les contenus issus d'une note vocale. */
const VoiceMarker: React.FC = () => (
  <span
    className="inline-flex items-center gap-1 rounded-full bg-[#04316d]/10 text-[#04316d] px-1.5 py-0.5 text-[10px] font-medium align-middle"
    title="Issu d'une note vocale"
  >
    <Mic className="h-2.5 w-2.5" aria-hidden="true" /> vocal
  </span>
);

const RadarCrmDebrief: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<DebriefPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=${encodeURIComponent(`/radar-crm/debrief/${eventId ?? ''}`)}`);
    }
  }, [user, authLoading, navigate, eventId]);

  const load = useCallback(async () => {
    if (!eventId || !user) return;
    setLoading(true);
    setError(null);

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
    const p = data as unknown as DebriefPayload | null;
    setPayload(
      p
        ? { event: p.event ?? null, companies: Array.isArray(p.companies) ? p.companies : [] }
        : { event: null, companies: [] },
    );
    setLoading(false);
  }, [eventId, user, navigate]);

  useEffect(() => {
    if (!user) return;
    void trackRadarEvent('radar_debrief_viewed', { eventId });
    void load();
  }, [user, load, eventId]);

  const ev = payload?.event ?? null;
  const eventName = ev?.nom_event ?? 'Salon';
  const dateLabel = useMemo(() => {
    const d1 = fmtDate(ev?.date_debut);
    const d2 = fmtDate(ev?.date_fin);
    if (d1 && d2 && d1 !== d2) return `${d1} – ${d2}`;
    return d1 ?? '';
  }, [ev?.date_debut, ev?.date_fin]);

  const allCompanies = payload?.companies ?? [];
  const worked = useMemo(() => allCompanies.filter(isWorked), [allCompanies]);
  const newCompanies = useMemo(() => allCompanies.filter(isNew), [allCompanies]);

  const stats = useMemo(() => {
    const V = worked.filter((c) => c.visited).length;
    const Nn = worked.reduce((acc, c) => acc + notesOf(c).length, 0);
    const Nt = worked.reduce((acc, c) => acc + tasksOf(c).length, 0);
    return { N: worked.length, V, Nn, Nt, Nc: newCompanies.length };
  }, [worked, newCompanies]);

  const displayed = useMemo(() => {
    const list = showAll ? [...allCompanies] : [...worked];
    return list.sort((a, b) => companyLabel(a).localeCompare(companyLabel(b), 'fr'));
  }, [showAll, allCompanies, worked]);

  /** Bloc texte lisible du débrief (une entrée par entreprise travaillée). */
  const buildDebriefText = (): string => {
    const dateRange = [fmtDate(ev?.date_debut), fmtDate(ev?.date_fin)]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .join('–');
    return worked
      .map((c) => {
        const name = companyLabel(c);
        const stand = standLabel(c.stands) || 'NC';
        const rel = RELATIONSHIP_META[normalizeRelationship(c.relationship_status)].label;
        const lines: string[] = [
          `${name} — ${eventName}${dateRange ? ` (${dateRange})` : ''} — Stand ${stand} — Statut: ${rel}`,
        ];
        if (c.objective && c.objective.trim()) lines.push(`  Objectif: ${c.objective.trim()}`);
        const notes = notesOf(c).map((n) => (n.body ?? '').trim()).filter(Boolean);
        if (notes.length) lines.push(`  Notes: ${notes.join(' | ')}`);
        const tasks = tasksOf(c)
          .map((t) => {
            const body = (t.body ?? '').trim();
            if (!body) return '';
            const due = fmtDate(t.due_at) ?? '—';
            return `${body} (échéance ${due})`;
          })
          .filter(Boolean);
        if (tasks.length) lines.push(`  Tâches: ${tasks.join(' | ')}`);
        return lines.join('\n');
      })
      .join('\n\n');
  };

  const copyDebrief = async () => {
    const text = buildDebriefText();
    try {
      await navigator.clipboard.writeText(text);
      void trackRadarEvent('radar_debrief_copied', { eventId, count: worked.length });
      toast({ title: 'Débrief copié' });
    } catch (e) {
      console.error('[RadarCRM] copy debrief failed:', e);
      toast({ title: 'Copie impossible', description: 'Réessayez.', variant: 'destructive' });
    }
  };

  const exportCsv = () => {
    if (newCompanies.length === 0) return;
    const year = ev?.date_debut ? new Date(ev.date_debut).getFullYear().toString() : '';
    const header = [
      'company_name', 'website', 'normalized_domain', 'source_event',
      'event_year', 'stand', 'description', 'note', 'next_action',
    ];
    const rows = newCompanies.map((c) => {
      const note = notesOf(c).map((n) => (n.body ?? '').trim()).filter(Boolean).join(' | ');
      const nextTask = tasksOf(c).find((t) => !t.done && (t.body ?? '').trim());
      const nextAction = nextTask ? (nextTask.body ?? '').trim() : '';
      return [
        c.company_name ?? companyLabel(c),
        c.website ?? '',
        c.normalized_domain ?? '',
        eventName,
        year,
        standLabel(c.stands),
        c.description ?? '',
        note,
        nextAction,
      ].map(csvCell).join(',');
    });
    const csv = [header.join(','), ...rows].join('\r\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = (eventName || 'salon').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    a.download = `nouvelles-entreprises-${slug}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    void trackRadarEvent('radar_debrief_csv_exported', { eventId, count: newCompanies.length });
    toast({ title: `${newCompanies.length} nouvelle${newCompanies.length > 1 ? 's' : ''} entreprise${newCompanies.length > 1 ? 's' : ''} exportée${newCompanies.length > 1 ? 's' : ''}` });
  };

  return (
    <div className="min-h-screen bg-muted/10 font-body">
      <Helmet>
        <title>Débrief — {eventName} | Lotexpo</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Retour"
            onClick={() => navigate(eventId ? `/radar-crm/terrain/${eventId}` : '/radar-crm/results')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-foreground leading-tight truncate">
              {loading ? 'Débrief' : `Débrief · ${eventName}`}
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
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : error ? (
          <div className="text-center py-16 space-y-4">
            <p className="text-sm text-muted-foreground">Impossible de charger ce débrief.</p>
            <Button variant="outline" onClick={() => void load()}>Réessayer</Button>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-foreground leading-tight">
                {eventName}
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {ev?.ville && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {ev.ville}
                  </span>
                )}
                {dateLabel && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> {dateLabel}
                  </span>
                )}
              </p>
              <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
                <span className="font-semibold text-foreground">{stats.N}</span> entreprise{stats.N > 1 ? 's' : ''} travaillée{stats.N > 1 ? 's' : ''}
                {' · '}<span className="font-semibold text-foreground">{stats.V}</span> visitée{stats.V > 1 ? 's' : ''}
                {' · '}<span className="font-semibold text-foreground">{stats.Nn}</span> note{stats.Nn > 1 ? 's' : ''}
                {' · '}<span className="font-semibold text-foreground">{stats.Nt}</span> tâche{stats.Nt > 1 ? 's' : ''}
                {' · '}<span className="font-semibold text-foreground">{stats.Nc}</span> nouvelle{stats.Nc > 1 ? 's' : ''} entreprise{stats.Nc > 1 ? 's' : ''}
              </p>
            </div>

            {/* Actions export */}
            <div className="flex flex-col sm:flex-row gap-2 mb-6">
              <Button
                onClick={() => void copyDebrief()}
                disabled={worked.length === 0}
                className="gap-2 min-h-[44px]"
              >
                <Copy className="h-4 w-4" /> Copier le débrief
              </Button>
              <Button
                variant="outline"
                onClick={exportCsv}
                disabled={newCompanies.length === 0}
                className="gap-2 min-h-[44px]"
              >
                <Download className="h-4 w-4" />
                {newCompanies.length === 0
                  ? 'Aucune nouvelle entreprise'
                  : 'Exporter les nouvelles entreprises (CSV)'}
              </Button>
            </div>

            {/* Toggle affichage */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {showAll ? `Toutes les entreprises (${allCompanies.length})` : `Entreprises travaillées (${worked.length})`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll((v) => !v)}
                className="text-muted-foreground hover:text-foreground"
              >
                {showAll ? 'Voir les travaillées' : 'Tout afficher'}
              </Button>
            </div>

            {displayed.length === 0 ? (
              <div className="text-center py-16 text-sm text-muted-foreground">
                Aucune entreprise travaillée sur ce salon.
              </div>
            ) : (
              <ul className="space-y-3">
                {displayed.map((c) => {
                  const notes = notesOf(c);
                  const tasks = tasksOf(c);
                  const stand = standLabel(c.stands);
                  return (
                    <li key={c.crm_company_id} className="rounded-xl border border-border/60 bg-card p-4 md:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-display text-lg font-semibold leading-snug text-foreground break-words">
                              {companyLabel(c)}
                            </p>
                            {isNew(c) && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-2 py-0.5 text-[11px] font-semibold">
                                <Sparkles className="h-3 w-3" /> Nouvelle entreprise
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-foreground/70 mt-1 flex items-center gap-1 font-medium">
                            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                            {stand ? `Stand ${stand}` : 'Stand non renseigné'}
                          </p>
                        </div>
                        {c.visited && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 shrink-0">
                            <Check className="h-4 w-4" /> Visité
                          </span>
                        )}
                      </div>

                      <div className="mt-3">
                        <RelBadge status={normalizeRelationship(c.relationship_status)} />
                      </div>

                      {c.objective && c.objective.trim() && (
                        <p className="mt-3 text-sm text-foreground/80 flex items-start gap-2">
                          <Target className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                          <span><span className="font-medium text-foreground">Objectif :</span> {c.objective.trim()}</span>
                        </p>
                      )}

                      {notes.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">
                            <StickyNote className="h-3.5 w-3.5" /> Notes ({notes.length})
                          </p>
                          <ul className="space-y-1.5">
                            {notes.map((n, i) => (
                              <li key={i} className="text-sm text-foreground/85 border-l-2 border-border pl-3">
                                <span className="break-words">{(n.body ?? '').trim()}</span>
                                {fmtDateTime(n.created_at) && (
                                  <span className="block text-[11px] text-muted-foreground mt-0.5">{fmtDateTime(n.created_at)}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {tasks.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">
                            <CheckSquare className="h-3.5 w-3.5" /> Tâches ({tasks.length})
                          </p>
                          <ul className="space-y-1.5">
                            {tasks.map((t, i) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <Check className={cn('h-4 w-4 shrink-0 mt-0.5', t.done ? 'text-emerald-600' : 'text-muted-foreground/40')} />
                                <span className={cn('break-words', t.done ? 'text-muted-foreground line-through' : 'text-foreground/85')}>
                                  {(t.body ?? '').trim()}
                                  {fmtDate(t.due_at) && (
                                    <span className="text-muted-foreground"> · échéance {fmtDate(t.due_at)}</span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default RadarCrmDebrief;