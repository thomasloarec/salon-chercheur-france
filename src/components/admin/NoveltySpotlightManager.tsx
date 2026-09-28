import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Star, Trash2 } from 'lucide-react';

/**
 * Refonte Nouveautés, lot B2b : choix de la nouveauté mise en avant en tête de /nouveautes.
 *
 * Règles :
 * - une mise en avant = une nouveauté publiée + une période (du … au …, inclus) ;
 * - choix éditorial de l'admin, jamais lié au premium (règle F2) ;
 * - sans mise en avant active, la page publique choisira automatiquement (lot F1.4).
 * Table : public.novelty_spotlights (écriture réservée aux admins par RLS).
 */

interface CandidateNovelty {
  id: string;
  title: string;
  origin: string | null;
  is_test?: boolean | null;
  media_urls: string[] | null;
  exhibitors: { name: string } | null;
  events: { nom_event: string; date_debut: string | null; date_fin: string | null; is_test: boolean | null } | null;
}

interface Spotlight {
  id: string;
  novelty_id: string;
  starts_on: string;
  ends_on: string;
  created_at: string;
}

/** Date locale au format AAAA-MM-JJ (jamais toISOString, qui passe en UTC). */
function localDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Dimanche de la semaine en cours (semaine du lundi au dimanche). */
function endOfWeek(d: Date): Date {
  const res = new Date(d);
  const dow = res.getDay(); // 0 = dimanche
  res.setDate(res.getDate() + (dow === 0 ? 0 : 7 - dow));
  return res;
}

function formatDay(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function NoveltySpotlightManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = localDay(new Date());

  const [noveltyId, setNoveltyId] = useState('');
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(localDay(endOfWeek(new Date())));

  // Nouveautés publiées dont le salon est en cours ou à venir
  const { data: candidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ['admin-spotlight-candidates'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('novelties')
        .select(`
          id, title, origin, media_urls, is_test,
          exhibitors!novelties_exhibitor_id_fkey ( name ),
          events!inner ( nom_event, date_debut, date_fin, is_test )
        `)
        .eq('status', 'published');
      if (error) throw error;
      return ((data ?? []) as CandidateNovelty[])
        .filter((n) => n.is_test !== true && n.events && n.events.is_test !== true)
        .filter((n) => ((n.events?.date_fin || n.events?.date_debut || '') >= today))
        .sort((a, b) => (a.events?.date_debut || '').localeCompare(b.events?.date_debut || ''));
    },
  });

  // Mises en avant en cours ou programmées
  const { data: spotlights = [], isLoading: loadingSpotlights } = useQuery({
    queryKey: ['admin-spotlights'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('novelty_spotlights')
        .select('id, novelty_id, starts_on, ends_on, created_at')
        .gte('ends_on', today)
        .order('starts_on', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Spotlight[];
    },
  });

  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-spotlights'] });
    queryClient.invalidateQueries({ queryKey: ['novelty-spotlight'] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!noveltyId) throw new Error('Choisissez une nouveauté.');
      if (!startsOn || !endsOn) throw new Error('Indiquez les deux dates.');
      if (endsOn < startsOn) throw new Error('La date de fin doit suivre la date de début.');
      const { data, error } = await (supabase as any)
        .from('novelty_spotlights')
        .insert({ novelty_id: noveltyId, starts_on: startsOn, ends_on: endsOn })
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Enregistrement refusé : aucune ligne créée (droits insuffisants ?).');
      }
      return data[0];
    },
    onSuccess: () => {
      invalidate();
      setNoveltyId('');
      toast({ title: 'Mise en avant programmée' });
    },
    onError: (error: any) => {
      toast({ title: 'Erreur', description: error?.message || 'Impossible de programmer la mise en avant.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any)
        .from('novelty_spotlights')
        .delete()
        .eq('id', id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Suppression refusée : aucune ligne supprimée (droits insuffisants ?).');
      }
      return data[0];
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Mise en avant retirée' });
    },
    onError: (error: any) => {
      toast({ title: 'Erreur', description: error?.message || 'Impossible de retirer la mise en avant.', variant: 'destructive' });
    },
  });

  const activeNow = spotlights.filter((s) => s.starts_on <= today && s.ends_on >= today);

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        <div className="flex items-start gap-3">
          <Star className="h-5 w-5 text-primary mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold">À la une de la page Nouveautés</h2>
            <p className="text-sm text-muted-foreground">
              La nouveauté choisie apparaît en tête de /nouveautes pendant la période indiquée.
              Sans mise en avant active, la page en choisit une automatiquement. Le statut premium n’intervient jamais.
            </p>
          </div>
        </div>

        {/* Mises en avant en cours et programmées */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">
            En cours et programmées
            {activeNow.length === 0 && !loadingSpotlights && (
              <span className="ml-2 font-normal text-muted-foreground">(aucune active aujourd’hui : choix automatique)</span>
            )}
          </h3>
          {loadingSpotlights ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : spotlights.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune mise en avant programmée.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {spotlights.map((s) => {
                const n = byId.get(s.novelty_id);
                const isActive = s.starts_on <= today && s.ends_on >= today;
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {isActive ? <Badge>En cours</Badge> : <Badge variant="secondary">Programmée</Badge>}
                        <span className="text-sm text-muted-foreground">
                          du {formatDay(s.starts_on)} au {formatDay(s.ends_on)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium">
                        {n ? n.title : 'Nouveauté indisponible (salon terminé ou dépubliée)'}
                      </p>
                      {n && (
                        <p className="truncate text-xs text-muted-foreground">
                          {n.exhibitors?.name} · {n.events?.nom_event}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label="Retirer cette mise en avant"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(s.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Programmer une mise en avant */}
        <div className="space-y-3 rounded-md border p-4">
          <h3 className="text-sm font-semibold">Programmer une mise en avant</h3>
          <div className="space-y-1.5">
            <Label htmlFor="spotlight-novelty">Nouveauté (salons en cours ou à venir)</Label>
            <select
              id="spotlight-novelty"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={noveltyId}
              onChange={(e) => setNoveltyId(e.target.value)}
              disabled={loadingCandidates}
            >
              <option value="">{loadingCandidates ? 'Chargement…' : 'Choisir une nouveauté'}</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.events?.date_debut ? formatDay(c.events.date_debut) + ' · ' : '') +
                    (c.events?.nom_event ?? '') + ' · ' +
                    (c.exhibitors?.name ?? '') + ' · ' + c.title +
                    (c.origin === 'exhibitor' ? ' (publiée par l’exposant)' : '') +
                    (!c.media_urls || c.media_urls.length === 0 ? ' (sans image)' : '')}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="spotlight-start">Du</Label>
              <Input id="spotlight-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spotlight-end">Au (inclus)</Label>
              <Input id="spotlight-end" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
            </div>
          </div>
          <Button type="button" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !noveltyId}>
            Mettre à la une
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
