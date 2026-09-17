import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Clock, Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

interface ParticipationRow {
  id_participation: string;
  id_event: string;
  stand_exposant: string | null;
  events: {
    slug: string | null;
    nom_event: string | null;
    date_debut: string | null;
    ville: string | null;
  } | null;
}

interface UpcomingEventResult {
  id: string;
  nom_event: string;
  slug: string | null;
  ville: string | null;
  date_debut: string | null;
  date_fin: string | null;
}

interface ParticipationRequestRow {
  id: string;
  status: string;
  stand: string | null;
  message: string | null;
  admin_note: string | null;
  created_at: string;
  event_id: string | null;
  proposed_event_name: string | null;
  proposed_event_city: string | null;
  proposed_event_start: string | null;
  proposed_event_url: string | null;
  events: { nom_event: string | null; slug: string | null } | null;
}

function formatDate(date: string | null | undefined) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ------------------------- Bloc 1 : stands ------------------------- */

function ParticipationsBlock({ exhibitorId }: { exhibitorId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['exhibitor-participations-stands', exhibitorId],
    enabled: !!exhibitorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participation')
        .select(
          'id_participation, id_event, stand_exposant, events!inner(slug, nom_event, date_debut, ville)',
        )
        .eq('exhibitor_id', exhibitorId);
      if (error) throw error;
      const rows = (data ?? []) as unknown as ParticipationRow[];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ts = (r: ParticipationRow) => {
        const d = r.events?.date_debut ? new Date(r.events.date_debut) : null;
        return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
      };
      const upcoming = (r: ParticipationRow) => ts(r) >= today.getTime();
      return rows.sort((a, b) => {
        const ua = upcoming(a) ? 0 : 1;
        const ub = upcoming(b) ? 0 : 1;
        if (ua !== ub) return ua - ub;
        return ua === 0 ? ts(a) - ts(b) : ts(b) - ts(a);
      });
    },
  });

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleSaveStand = async (row: ParticipationRow) => {
    const current = row.stand_exposant ?? '';
    const next = (drafts[row.id_participation] ?? current).trim();
    if (next === current.trim()) return;
    setSavingId(row.id_participation);
    try {
      const { data, error } = await supabase.functions.invoke('exhibitors-manage', {
        body: {
          action: 'set_stand',
          exhibitor_id: exhibitorId,
          event_id: row.id_event,
          stand: next,
        },
      });
      if (error) throw error;
      if (data && (data as { error?: string }).error) {
        throw new Error((data as { error: string }).error);
      }
      toast.success('Stand mis à jour');
      await refetch();
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[row.id_participation];
        return copy;
      });
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : 'La mise à jour du stand a échoué.',
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-base font-semibold">Vos salons et stands</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Renseignez votre numéro de stand pour chaque salon. Il sera affiché sur la fiche du salon.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ) : isError ? (
        <p className="text-sm text-muted-foreground">
          Impossible de charger vos salons. Réessayez plus tard.
        </p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Vous n'êtes référencé sur aucun salon pour le moment.
        </p>
      ) : (
        <ul className="space-y-2">
          {data.map((row) => {
            const current = row.stand_exposant ?? '';
            const value = drafts[row.id_participation] ?? current;
            const dirty = value.trim() !== current.trim();
            const busy = savingId === row.id_participation;
            const dateLabel = formatDate(row.events?.date_debut);
            return (
              <li key={row.id_participation} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <div className="min-w-0">
                  {row.events?.slug ? (
                    <Link
                      to={`/events/${row.events.slug}`}
                      className="text-sm font-medium hover:text-primary"
                    >
                      {row.events?.nom_event ?? 'Salon'}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium truncate">
                      {row.events?.nom_event ?? 'Salon'}
                    </p>
                  )}
                  {(dateLabel || row.events?.ville) && (
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {[dateLabel, row.events?.ville].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={value}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [row.id_participation]: e.target.value }))
                    }
                    placeholder="Numéro de stand (ex. B12)"
                    maxLength={50}
                    disabled={busy}
                    className="h-9"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveStand(row)}
                    disabled={!dirty || busy}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ------------------- Bloc 2 : déclarer une participation ------------------- */

function DeclareBlock({ exhibitorId }: { exhibitorId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [selected, setSelected] = useState<UpcomingEventResult | null>(null);
  const [manualMode, setManualMode] = useState(false);

  const [proposedName, setProposedName] = useState('');
  const [proposedCity, setProposedCity] = useState('');
  const [proposedStart, setProposedStart] = useState('');
  const [proposedUrl, setProposedUrl] = useState('');

  const [stand, setStand] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['search-upcoming-events', debouncedQuery],
    enabled: !manualMode && debouncedQuery.trim().length >= 2 && !selected,
    queryFn: async (): Promise<UpcomingEventResult[]> => {
      const { data, error } = await supabase.rpc('search_upcoming_events', {
        p_query: debouncedQuery.trim(),
        p_limit: 10,
      });
      if (error) throw error;
      return (data ?? []) as UpcomingEventResult[];
    },
    staleTime: 30_000,
  });

  const resetForm = () => {
    setQuery('');
    setSelected(null);
    setManualMode(false);
    setProposedName('');
    setProposedCity('');
    setProposedStart('');
    setProposedUrl('');
    setStand('');
    setMessage('');
  };

  const canSubmit =
    !submitting && (manualMode ? proposedName.trim().length > 1 : !!selected) && !!user;

  const handleSubmit = async () => {
    if (!canSubmit || !user) return;
    setSubmitting(true);
    try {
      const payload = {
        exhibitor_id: exhibitorId,
        event_id: manualMode ? null : (selected?.id ?? null),
        proposed_event_name: manualMode ? proposedName.trim() : null,
        proposed_event_city: manualMode && proposedCity.trim() ? proposedCity.trim() : null,
        proposed_event_start: manualMode && proposedStart ? proposedStart : null,
        proposed_event_url: manualMode && proposedUrl.trim() ? proposedUrl.trim() : null,
        stand: stand.trim() ? stand.trim() : null,
        message: message.trim() ? message.trim() : null,
        requested_by: user.id,
      };
      const { error } = await supabase.from('exhibitor_participation_requests').insert(payload);
      if (error) {
        if (error.code === '23505') {
          toast.error(
            'Une déclaration est déjà en attente de validation pour ce salon. Inutile de la renvoyer.',
          );
          return;
        }
        throw error;
      }
      toast.success('Déclaration envoyée', {
        description:
          "Votre participation est en attente de validation par l'équipe Lotexpo. Elle apparaîtra sur la page du salon une fois validée.",
      });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['exhibitor-participation-requests', exhibitorId] });
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "L'envoi de la déclaration a échoué. Réessayez.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6 space-y-5">
      <div>
        <h3 className="text-base font-semibold">Annoncer une participation à un salon à venir</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Recherchez le salon concerné. Votre déclaration est vérifiée par l'équipe Lotexpo avant
          d'apparaître publiquement.
        </p>
      </div>

      {!manualMode ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="participation-search">Salon</Label>
            {selected ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selected.nom_event}</p>
                  <p className="text-xs text-muted-foreground">
                    {[formatDate(selected.date_debut), selected.ville].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                  <X className="h-4 w-4 mr-1.5" />
                  Changer
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="participation-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nom du salon ou ville"
                    className="pl-9"
                  />
                </div>
                {debouncedQuery.trim().length >= 2 && (
                  <div className="rounded-lg border divide-y max-h-72 overflow-y-auto">
                    {isFetching ? (
                      <div className="p-3">
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : results.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">
                        Aucun salon à venir ne correspond à cette recherche.
                      </p>
                    ) : (
                      results.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelected(r)}
                          className="w-full text-left p-3 hover:bg-muted transition-colors"
                        >
                          <p className="text-sm font-medium">{r.nom_event}</p>
                          <p className="text-xs text-muted-foreground">
                            {[formatDate(r.date_debut), r.ville].filter(Boolean).join(' · ')}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {!selected && (
            <button
              type="button"
              onClick={() => setManualMode(true)}
              className="text-sm text-primary underline underline-offset-4"
            >
              Mon salon n'est pas dans la liste
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="proposed-name">Nom du salon</Label>
            <Input
              id="proposed-name"
              value={proposedName}
              onChange={(e) => setProposedName(e.target.value)}
              placeholder="Nom du salon"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="proposed-city">Ville</Label>
              <Input
                id="proposed-city"
                value={proposedCity}
                onChange={(e) => setProposedCity(e.target.value)}
                placeholder="Ville"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proposed-start">Date de début</Label>
              <Input
                id="proposed-start"
                type="date"
                value={proposedStart}
                onChange={(e) => setProposedStart(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="proposed-url">Site officiel du salon</Label>
            <Input
              id="proposed-url"
              value={proposedUrl}
              onChange={(e) => setProposedUrl(e.target.value)}
              placeholder="exemple.fr"
              inputMode="url"
            />
          </div>
          <button
            type="button"
            onClick={() => setManualMode(false)}
            className="text-sm text-primary underline underline-offset-4"
          >
            Revenir à la recherche
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="participation-stand">Numéro de stand (facultatif)</Label>
          <Input
            id="participation-stand"
            value={stand}
            onChange={(e) => setStand(e.target.value)}
            placeholder="ex. B12"
            maxLength={50}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="participation-message">Message (facultatif)</Label>
        <Textarea
          id="participation-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Précisions utiles pour l'équipe Lotexpo"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Envoyer la déclaration
        </Button>
      </div>
    </Card>
  );
}

/* ---------------------- Bloc 3 : suivi des demandes ---------------------- */

const STATUS_META: Record<string, { label: string; variant: 'secondary' | 'default' | 'outline' }> =
  {
    pending: { label: 'En attente', variant: 'secondary' },
    approved: { label: 'Acceptée', variant: 'default' },
    rejected: { label: 'Refusée', variant: 'outline' },
  };

function RequestsBlock({ exhibitorId }: { exhibitorId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['exhibitor-participation-requests', exhibitorId],
    enabled: !!exhibitorId,
    queryFn: async (): Promise<ParticipationRequestRow[]> => {
      const { data, error } = await supabase
        .from('exhibitor_participation_requests')
        .select(
          'id, status, stand, message, admin_note, created_at, event_id, proposed_event_name, proposed_event_city, proposed_event_start, proposed_event_url, events(nom_event, slug)',
        )
        .eq('exhibitor_id', exhibitorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ParticipationRequestRow[];
    },
  });

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-base font-semibold">Vos déclarations</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Suivez l'état des participations que vous avez déclarées.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-lg" />
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Vous n'avez déclaré aucune participation pour le moment.
        </p>
      ) : (
        <ul className="space-y-2">
          {data.map((r) => {
            const meta = STATUS_META[r.status] ?? STATUS_META.pending;
            const eventName = r.events?.nom_event ?? r.proposed_event_name ?? 'Salon';
            return (
              <li key={r.id} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    {r.events?.slug ? (
                      <Link
                        to={`/events/${r.events.slug}`}
                        className="text-sm font-medium hover:text-primary"
                      >
                        {eventName}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium">{eventName}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {[
                        formatDate(r.proposed_event_start),
                        r.proposed_event_city,
                        r.stand ? `Stand ${r.stand}` : null,
                        `Déclarée le ${formatDate(r.created_at)}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <Badge variant={meta.variant} className="gap-1">
                    {r.status === 'pending' ? (
                      <Clock className="h-3 w-3" />
                    ) : r.status === 'approved' ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    {meta.label}
                  </Badge>
                </div>
                {r.admin_note && (
                  <p className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2">
                    Note de l'équipe Lotexpo : {r.admin_note}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default function ExhibitorSalonsSection({ exhibitorId }: { exhibitorId: string }) {
  return (
    <div className="space-y-6">
      <ParticipationsBlock exhibitorId={exhibitorId} />
      <DeclareBlock exhibitorId={exhibitorId} />
      <RequestsBlock exhibitorId={exhibitorId} />
    </div>
  );
}
