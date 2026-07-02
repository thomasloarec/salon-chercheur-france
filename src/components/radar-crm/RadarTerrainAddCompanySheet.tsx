import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, MapPin, Plus, Building2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ExposantResult {
  id_exposant: string;
  nom_exposant: string | null;
  website: string | null;
  normalized_domain: string | null;
  stands: string[] | null;
  secteur: string | null;
  description: string | null;
}

interface SearchPayload {
  query?: string;
  results?: ExposantResult[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  /** Appelé après un ajout réussi (officiel ou manuel) pour rafraîchir la liste terrain. */
  onAdded: () => void;
}

const standLabel = (stands: string[] | null): string | null => {
  const list = (stands ?? []).map((s) => (s ?? '').trim()).filter(Boolean);
  return list.length ? `Stand ${list.join(', ')}` : null;
};

const RadarTerrainAddCompanySheet: React.FC<Props> = ({ open, onOpenChange, eventId, onAdded }) => {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ExposantResult[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);

  // Mini-formulaire création hors liste.
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createWebsite, setCreateWebsite] = useState('');
  const [creating, setCreating] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Réinitialise l'état à chaque ouverture.
  useEffect(() => {
    if (open) {
      setQuery('');
      setDebounced('');
      setResults([]);
      setSearching(false);
      setAddingId(null);
      setCreateOpen(false);
      setCreateName('');
      setCreateWebsite('');
      setCreating(false);
      // Autofocus après montage du Sheet.
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Débounce ~300 ms.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Recherche officielle dès 2 caractères.
  useEffect(() => {
    let cancelled = false;
    if (debounced.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    (async () => {
      const { data, error } = await supabase.rpc('search_radar_salon_exposants', {
        p_event_id: eventId,
        p_query: debounced,
      });
      if (cancelled) return;
      if (error) {
        console.error('[RadarCRM] search_radar_salon_exposants failed:', error);
        setResults([]);
      } else {
        const p = data as unknown as SearchPayload | null;
        setResults(Array.isArray(p?.results) ? p!.results! : []);
      }
      setSearching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, eventId]);

  const finish = useCallback(
    (name: string) => {
      toast({ title: `${name} ajoutée — prospect froid` });
      onOpenChange(false);
      onAdded();
    },
    [onAdded, onOpenChange],
  );

  const addOfficial = async (r: ExposantResult) => {
    if (addingId) return;
    setAddingId(r.id_exposant);
    const { error } = await supabase.rpc('add_radar_company_from_exposant', {
      p_id_exposant: r.id_exposant,
      p_event_id: eventId,
    });
    if (error) {
      console.error('[RadarCRM] add_radar_company_from_exposant failed:', error);
      setAddingId(null);
      toast({
        title: 'Ajout impossible',
        description: 'Impossible d’ajouter cette entreprise. Réessayez.',
        variant: 'destructive',
      });
      return;
    }
    finish(r.nom_exposant ?? 'Entreprise');
  };

  const createManual = async () => {
    const name = createName.trim();
    if (!name || creating) return;
    setCreating(true);
    const website = createWebsite.trim();
    const { error } = await supabase.rpc('add_radar_manual_company', {
      p_event_id: eventId,
      p_name: name,
      ...(website ? { p_website: website } : {}),
    });
    setCreating(false);
    if (error) {
      console.error('[RadarCRM] add_radar_manual_company failed:', error);
      toast({
        title: 'Création impossible',
        description: 'Impossible de créer cette entreprise. Réessayez.',
        variant: 'destructive',
      });
      return;
    }
    finish(name);
  };

  const showCreateEntry = query.trim().length >= 2;
  const typedName = query.trim();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] rounded-t-2xl p-0 flex flex-col gap-0"
      >
        <SheetHeader className="px-4 pt-5 pb-3 text-left space-y-3 border-b border-border/60">
          <SheetTitle className="font-display text-xl">Ajouter une entreprise rencontrée</SheetTitle>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nom de l'entreprise…"
              autoComplete="off"
              className="h-12 pl-10 text-base"
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {query.trim().length < 2 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Tapez le nom de l'entreprise rencontrée.
            </div>
          ) : searching ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : results.length > 0 ? (
            <ul className="space-y-2">
              {results.map((r) => {
                const sLabel = standLabel(r.stands);
                const sub = [r.secteur, r.description].map((s) => (s ?? '').trim()).filter(Boolean).join(' · ');
                const busy = addingId === r.id_exposant;
                return (
                  <li key={r.id_exposant}>
                    <button
                      type="button"
                      disabled={!!addingId}
                      onClick={() => void addOfficial(r)}
                      className={cn(
                        'w-full text-left rounded-xl border border-border/60 bg-card p-4 min-h-[44px]',
                        'hover:bg-secondary/40 active:bg-secondary/60 transition-colors',
                        'disabled:opacity-60 flex items-start gap-3',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground leading-snug truncate">
                          {r.nom_exposant ?? 'Entreprise'}
                        </p>
                        {sLabel && (
                          <p className="text-sm text-foreground/70 mt-0.5 flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {sLabel}
                          </p>
                        )}
                        {sub && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{sub}</p>
                        )}
                      </div>
                      {busy ? (
                        <Loader2 className="h-5 w-5 animate-spin text-accent shrink-0 mt-0.5" />
                      ) : (
                        <Plus className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Aucun exposant trouvé pour « {typedName} ».
            </div>
          )}
        </div>

        {/* Option création hors liste — toujours visible dès 2 caractères */}
        {showCreateEntry && (
          <div className="border-t border-border/60 bg-muted/20 px-4 py-4">
            {!createOpen ? (
              <button
                type="button"
                onClick={() => {
                  setCreateName(typedName);
                  setCreateWebsite('');
                  setCreateOpen(true);
                }}
                className="w-full text-left rounded-xl border border-dashed border-accent/50 bg-card p-4 min-h-[44px] hover:bg-accent/5 active:bg-accent/10 transition-colors flex items-center gap-3"
              >
                <Building2 className="h-5 w-5 text-accent shrink-0" />
                <span className="text-sm font-medium text-foreground">
                  L'entreprise n'est pas dans la liste ? Créer «&nbsp;{typedName}&nbsp;»
                </span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nom</label>
                  <Input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Nom de l'entreprise"
                    className="h-11 text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Site web</label>
                  <Input
                    value={createWebsite}
                    onChange={(e) => setCreateWebsite(e.target.value)}
                    placeholder="optionnel"
                    inputMode="url"
                    autoComplete="off"
                    className="h-11 text-base"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-[44px]"
                    onClick={() => setCreateOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 min-h-[44px] gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                    disabled={!createName.trim() || creating}
                    onClick={() => void createManual()}
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Créer
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ajoutée à vos comptes pour ce salon (prospect froid).
                </p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default RadarTerrainAddCompanySheet;