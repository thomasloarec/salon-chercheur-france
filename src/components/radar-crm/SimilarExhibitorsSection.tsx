import React, { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, MapPin, ExternalLink, Sparkles, Plus, X, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import ExpandableText from '@/components/exhibitor/ExpandableText';

/** One suggestion row returned by get_radar_salon_similar. */
type Suggestion = {
  id_exposant: string;
  nom_exposant: string | null;
  website: string | null;
  normalized_domain: string | null;
  secteur: string | null;
  reason: string | null;
  stands: string | null;
  description: string | null;
};

const PAGE_SIZE = 5;

/**
 * « Découvrir d'autres exposants à potentiel » — section repliée par défaut,
 * chargement paresseux (RPC appelée seulement à l'ouverture). Façon Spotify :
 * petit lot, on garde/écarte, on en redemande.
 *
 * Front only : réutilise les 3 RPC existantes
 *  - get_radar_salon_similar (lecture)
 *  - add_radar_company_from_exposant (garder)
 *  - set_radar_exposant_ignored (écarter)
 */
const SimilarExhibitorsSection: React.FC<{
  eventId: string;
  initialCount?: number;
  /** Appelé après un « Garder » réussi pour rafraîchir le cockpit (get_my_radar_view). */
  onKept?: () => void;
}> = ({ eventId, initialCount = 0, onKept }) => {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  // `endReached` ne passe à true QUE lorsqu'un appel RPC renvoie une liste vide.
  // Il est totalement découplé des actions garder/écarter.
  const [endReached, setEndReached] = useState(false);
  // Compteur restant (à trier). Part du total backend et décroît à chaque
  // garder/écarter (optimiste). Coexiste avec `endReached` : les deux peuvent
  // conclure « terminé ».
  const [remaining, setRemaining] = useState(initialCount);
  // Tous les id_exposant déjà proposés (pour construire p_exclude).
  const seenRef = useRef<Set<string>>(new Set());

  const fetchBatch = useCallback(async () => {
    setLoading(true);
    try {
      const exclude = Array.from(seenRef.current);
      const { data, error } = await supabase.rpc('get_radar_salon_similar', {
        p_event_id: eventId,
        p_limit: PAGE_SIZE,
        p_exclude: exclude,
      });
      if (error) throw error;
      const payload = (data ?? {}) as { suggestions?: Suggestion[]; count?: number };
      const raw = payload.suggestions ?? [];
      const fresh = raw.filter(
        (s) => s.id_exposant && !seenRef.current.has(s.id_exposant),
      );
      fresh.forEach((s) => seenRef.current.add(s.id_exposant));
      setItems((prev) => [...prev, ...fresh]);
      // Fin propre : seulement si le backend n'a plus rien renvoyé.
      if (raw.length === 0) setEndReached(true);
    } catch {
      toast({ title: 'Impossible de charger les suggestions', variant: 'destructive' });
      setEndReached(true);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [eventId]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && !loaded && !loading) void fetchBatch();
  };

  const removeCard = (id: string) =>
    setItems((prev) => prev.filter((s) => s.id_exposant !== id));

  const handleKeep = async (s: Suggestion) => {
    if (busy[s.id_exposant]) return;
    setBusy((b) => ({ ...b, [s.id_exposant]: true }));
    removeCard(s.id_exposant); // optimiste
    setRemaining((n) => Math.max(0, n - 1)); // décrément optimiste
    try {
      const { error } = await supabase.rpc('add_radar_company_from_exposant', {
        p_id_exposant: s.id_exposant,
        p_event_id: eventId,
      });
      if (error) throw error;
      toast({
        title: 'Ajouté à vos comptes en prospect froid',
        description: 'Visible dans « À suivre » et sur ce salon.',
      });
      onKept?.();
    } catch {
      toast({ title: "Échec de l'ajout", variant: 'destructive' });
      setItems((prev) => [s, ...prev]); // rollback
      setRemaining((n) => n + 1); // rollback
    } finally {
      setBusy((b) => ({ ...b, [s.id_exposant]: false }));
    }
  };

  const handleIgnore = async (s: Suggestion) => {
    if (busy[s.id_exposant]) return;
    setBusy((b) => ({ ...b, [s.id_exposant]: true }));
    removeCard(s.id_exposant); // optimiste
    setRemaining((n) => Math.max(0, n - 1)); // décrément optimiste
    try {
      const { error } = await supabase.rpc('set_radar_exposant_ignored', {
        p_id_exposant: s.id_exposant,
      });
      if (error) throw error;
      toast({ title: 'Retiré des suggestions' });
    } catch {
      toast({ title: "Échec de l'action", variant: 'destructive' });
      setItems((prev) => [s, ...prev]); // rollback
      setRemaining((n) => n + 1); // rollback
    } finally {
      setBusy((b) => ({ ...b, [s.id_exposant]: false }));
    }
  };

  const isEmpty = loaded && items.length === 0;
  // « Terminé » : soit le backend n'a plus rien renvoyé, soit le compteur est à 0.
  const finished = endReached || remaining <= 0;

  // Gating : n'afficher la section que si le comptage backend est > 0.
  if (!(typeof initialCount === 'number' && initialCount > 0)) return null;

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange} className="mt-1">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'group flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-border/70',
            'px-4 py-2.5 text-left text-sm font-medium text-muted-foreground',
            'hover:border-border hover:text-foreground transition-colors',
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 shrink-0 text-accent" />
            <span className="truncate">
              {remaining > 0
                ? `Découvrir ${remaining} autre${remaining > 1 ? 's' : ''} exposant${remaining > 1 ? 's' : ''} à potentiel`
                : 'Terminé pour ce salon'}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-3">
        {loading && items.length === 0 ? (
          <div className="flex items-center gap-2 px-1 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Recherche d'exposants similaires…
          </div>
        ) : items.length === 0 && finished ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">
            Terminé pour ce salon.
          </p>
        ) : (
          <div className="space-y-2.5">
            {items.map((s) => (
              <div
                key={s.id_exposant}
                className="rounded-lg border border-border/60 bg-card p-3.5 sm:p-4"
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h4 className="font-display font-semibold text-foreground leading-snug min-w-0 break-words">
                      {s.nom_exposant || 'Exposant'}
                    </h4>
                    {s.stands && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {s.stands}
                      </span>
                    )}
                  </div>
                  {s.reason && (
                    <p className="text-xs text-muted-foreground">{s.reason}</p>
                  )}
                  {s.description && (
                    <ExpandableText text={s.description} className="mt-0.5" />
                  )}
                  {s.website && (
                    <a
                      href={/^https?:\/\//.test(s.website) ? s.website : `https://${s.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {s.normalized_domain || 'Site web'}
                    </a>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 border-accent/60 bg-accent/[0.06] text-foreground hover:bg-accent/10"
                    disabled={busy[s.id_exposant]}
                    onClick={() => handleKeep(s)}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Garder
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 text-muted-foreground hover:text-foreground"
                    disabled={busy[s.id_exposant]}
                    onClick={() => handleIgnore(s)}
                  >
                    <X className="h-4 w-4 mr-1" /> Écarter
                  </Button>
                </div>
              </div>
            ))}

            {finished ? (
              items.length > 0 && (
                <p className="px-1 py-1 text-xs text-muted-foreground">
                  Terminé pour ce salon.
                </p>
              )
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground hover:text-foreground"
                disabled={loading}
                onClick={() => void fetchBatch()}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Chargement…</>
                ) : (
                  <><ChevronDown className="h-4 w-4 mr-1.5" /> Voir plus</>
                )}
              </Button>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default SimilarExhibitorsSection;