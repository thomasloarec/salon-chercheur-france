import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Check, Search, Star, Trash2 } from 'lucide-react';

/**
 * Refonte Nouveautés, lots B2b + B2c : choix de la nouveauté mise en avant en tête de /nouveautes.
 *
 * Règles :
 * - une mise en avant = une nouveauté publiée + une période (du … au …, inclus) ;
 * - choix éditorial de l'admin, jamais lié au premium (règle F2) ;
 * - sans mise en avant active, la page publique choisira automatiquement (lot F1.4).
 * Table : public.novelty_spotlights (écriture réservée aux admins par RLS).
 *
 * Lot B2c : le choix se fait sur une grille d'images (format 4:5), avec recherche
 * et filtre par salon, aperçu de la nouveauté choisie et vignettes dans la liste.
 */

interface CandidateNovelty {
  id: string;
  title: string;
  origin: string | null;
  display_mode: string | null;
  is_test?: boolean | null;
  media_urls: string[] | null;
  exhibitors: { name: string } | null;
  events: { id: string; nom_event: string; date_debut: string | null; date_fin: string | null; is_test: boolean | null } | null;
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

/** Recherche insensible à la casse et aux accents. */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function firstImage(n: CandidateNovelty | undefined): string | null {
  const url = (n?.media_urls?.[0] ?? '').trim();
  return url || null;
}

/**
 * Vignette 4:5. Affiche l'image si elle existe et se charge ; sinon une composition
 * texte (fond sombre, titre), comme le fera la carte publique.
 */
function Thumb({ novelty, className = '' }: { novelty: CandidateNovelty | undefined; className?: string }) {
  const [broken, setBroken] = useState(false);
  const src = firstImage(novelty);
  const title = novelty?.title ?? 'Nouveauté indisponible';
  return (
    <div className={`relative aspect-[4/5] w-full overflow-hidden rounded-md bg-muted ${className}`}>
      {src && !broken ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-end bg-[#0b132b] p-2">
          <span className="line-clamp-4 text-xs font-semibold leading-snug text-white">{title}</span>
        </div>
      )}
    </div>
  );
}

export default function NoveltySpotlightManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = localDay(new Date());

  const [noveltyId, setNoveltyId] = useState('');
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(localDay(endOfWeek(new Date())));
  const [search, setSearch] = useState('');
  const [salonFilter, setSalonFilter] = useState('');

  // Nouveautés publiées dont le salon est en cours ou à venir
  const { data: candidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ['admin-spotlight-candidates'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('novelties')
        .select(`
          id, title, origin, display_mode, media_urls, is_test,
          exhibitors!novelties_exhibitor_id_fkey ( name ),
          events!inner ( id, nom_event, date_debut, date_fin, is_test )
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
  const spotlightedIds = useMemo(() => new Set(spotlights.map((s) => s.novelty_id)), [spotlights]);

  // Salons présents parmi les candidates, dans l'ordre chronologique
  const salons = useMemo(() => {
    const map = new Map<string, { id: string; name: string; date: string | null; count: number }>();
    for (const c of candidates) {
      if (!c.events) continue;
      const entry = map.get(c.events.id);
      if (entry) entry.count += 1;
      else map.set(c.events.id, { id: c.events.id, name: c.events.nom_event, date: c.events.date_debut, count: 1 });
    }
    return Array.from(map.values());
  }, [candidates]);

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return candidates.filter((c) => {
      if (salonFilter && c.events?.id !== salonFilter) return false;
      if (!q) return true;
      const haystack = normalize(`${c.title} ${c.exhibitors?.name ?? ''} ${c.events?.nom_event ?? ''}`);
      return haystack.includes(q);
    });
  }, [candidates, search, salonFilter]);

  const selected = noveltyId ? byId.get(noveltyId) : undefined;

  // Chevauchement avec une mise en avant existante sur la période choisie
  const overlapping = useMemo(
    () => (startsOn && endsOn ? spotlights.filter((s) => s.starts_on <= endsOn && s.ends_on >= startsOn) : []),
    [spotlights, startsOn, endsOn],
  );

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
                  <li key={s.id} className="flex items-center gap-3 p-3">
                    <div className="w-12 shrink-0">
                      <Thumb novelty={n} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isActive ? <Badge>En cours</Badge> : <Badge variant="secondary">Programmée</Badge>}
                        <span className="text-sm text-muted-foreground">
                          du {formatDay(s.starts_on)} au {formatDay(s.ends_on)}
                        </span>
                        {n?.display_mode === 'typographic' && (
                          <Badge variant="outline">Composition texte</Badge>
                        )}
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
        <div className="space-y-4 rounded-md border p-4">
          <h3 className="text-sm font-semibold">Programmer une mise en avant</h3>

          {/* Étape 1 : choisir la nouveauté */}
          <div className="space-y-3">
            <p className="text-sm font-medium">
              1. Choisissez la nouveauté
              <span className="ml-2 font-normal text-muted-foreground">
                ({filtered.length} sur {candidates.length}, salons en cours ou à venir)
              </span>
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  aria-label="Rechercher une nouveauté"
                  placeholder="Produit, exposant ou salon"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                aria-label="Filtrer par salon"
                className="flex h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-72"
                value={salonFilter}
                onChange={(e) => setSalonFilter(e.target.value)}
              >
                <option value="">Tous les salons ({salons.length})</option>
                {salons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {(s.date ? formatDay(s.date) + ' · ' : '') + s.name + ' (' + s.count + ')'}
                  </option>
                ))}
              </select>
            </div>

            {loadingCandidates ? (
              <p className="text-sm text-muted-foreground">Chargement des nouveautés…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune nouveauté ne correspond à cette recherche.</p>
            ) : (
              <div className="max-h-[560px] overflow-y-auto rounded-md border bg-muted/30 p-2">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {filtered.map((c) => {
                    const isSelected = c.id === noveltyId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setNoveltyId(isSelected ? '' : c.id)}
                        className={`group relative flex flex-col gap-1.5 rounded-lg border bg-background p-1.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          isSelected ? 'border-primary ring-2 ring-primary' : 'hover:border-primary/40'
                        }`}
                      >
                        <div className="relative">
                          <Thumb novelty={c} />
                          <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
                            <span className="rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">
                              {c.origin === 'exhibitor' ? 'Exposant' : 'Lotexpo'}
                            </span>
                            {c.display_mode === 'typographic' && (
                              <span className="rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">Texte</span>
                            )}
                            {spotlightedIds.has(c.id) && (
                              <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                                Déjà à la une
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-4 w-4" aria-hidden="true" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 px-0.5 pb-0.5">
                          <p className="line-clamp-2 text-xs font-semibold leading-snug">{c.title}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{c.exhibitors?.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {(c.events?.date_debut ? formatDay(c.events.date_debut) + ' · ' : '') + (c.events?.nom_event ?? '')}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Étape 2 : période et validation */}
          <div className="space-y-3">
            <p className="text-sm font-medium">2. Choisissez la période</p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="w-32 shrink-0">
                {selected ? (
                  <Thumb key={selected.id} novelty={selected} />
                ) : (
                  <div className="flex aspect-[4/5] w-full items-center justify-center rounded-md border border-dashed p-2 text-center text-xs text-muted-foreground">
                    Aucune nouveauté choisie
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                {selected && (
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{selected.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {selected.exhibitors?.name} · {selected.events?.nom_event}
                      {selected.events?.date_debut ? ' · ' + formatDay(selected.events.date_debut) : ''}
                    </p>
                  </div>
                )}
                {selected?.display_mode === 'typographic' && (
                  <p className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    Cette nouveauté est réglée sur « Composition texte » : son image ne sera pas montrée à la une.
                    Pour afficher l’image, passez-la en « Automatique » ou « Photo » dans la modération ci-dessous.
                  </p>
                )}
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
                {overlapping.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Cette période chevauche {overlapping.length === 1 ? 'une mise en avant existante' : `${overlapping.length} mises en avant existantes`}.
                    Pendant le chevauchement, la page montrera celle qui correspond au secteur du visiteur, sinon la plus récemment programmée.
                  </p>
                )}
                <Button type="button" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !noveltyId}>
                  Mettre à la une
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
