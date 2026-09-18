import { useMemo, useState } from 'react';
import { ChevronRight, Info, Loader2, Search, Star, Tags, X } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

import {
  translateCategoriesError,
  useExhibitorCategories,
  useSetExhibitorCategories,
  useTaxonomyTree,
  type ExhibitorCategory,
} from '@/hooks/useExhibitorCategories';

const MAX_CATEGORIES = 3;
const LIMIT_HINT = '3 catégories maximum. Décochez-en une pour en choisir une autre.';

interface Props {
  exhibitorId: string;
  publicSlug: string | null;
}

interface Choice {
  id: string;
  name: string;
  sectorName: string;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export default function ExhibitorCategoriesSection({ exhibitorId, publicSlug }: Props) {
  const isMobile = useIsMobile();
  const { data, isLoading, isError } = useExhibitorCategories(exhibitorId);
  const { data: tree, isLoading: treeLoading } = useTaxonomyTree();
  const saveMutation = useSetExhibitorCategories(exhibitorId, publicSlug);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [openSectorId, setOpenSectorId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Choice[]>([]);

  const current: ExhibitorCategory[] = data?.categories ?? [];

  const openDialog = () => {
    setSelection(
      current.map((c) => ({
        id: c.sub_sector_id,
        name: c.sub_sector_name,
        sectorName: c.sector_name ?? '',
      })),
    );
    setQuery('');
    setOpenSectorId(null);
    setOpen(true);
  };

  const allSubSectors = useMemo(
    () =>
      (tree ?? []).flatMap((sec) =>
        sec.subSectors.map((sub) => ({ id: sub.id, name: sub.name, sectorName: sec.name })),
      ),
    [tree],
  );

  const searchResults = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    return allSubSectors.filter((s) => normalize(s.name).includes(q)).slice(0, 40);
  }, [allSubSectors, query]);

  const activeSector = (tree ?? []).find((s) => s.id === openSectorId) ?? null;
  const selectedIds = new Set(selection.map((s) => s.id));
  const atLimit = selection.length >= MAX_CATEGORIES;

  const toggle = (choice: Choice) => {
    setSelection((prev) => {
      if (prev.some((p) => p.id === choice.id)) return prev.filter((p) => p.id !== choice.id);
      if (prev.length >= MAX_CATEGORIES) return prev;
      return [...prev, choice];
    });
  };

  const makePrimary = (id: string) => {
    setSelection((prev) => {
      const item = prev.find((p) => p.id === id);
      if (!item) return prev;
      return [item, ...prev.filter((p) => p.id !== id)];
    });
  };

  const handleSave = async () => {
    if (selection.length === 0) {
      toast.error('Sélectionnez au moins une catégorie.');
      return;
    }
    try {
      await saveMutation.mutateAsync(selection.map((s) => s.id));
      setOpen(false);
      toast.success(
        'Vos catégories sont à jour. Elles sont prises en compte dès maintenant dans les recommandations aux visiteurs.',
      );
    } catch (err) {
      toast.error(translateCategoriesError(err));
    }
  };

  const renderSubSectorRow = (choice: Choice, withSectorCaption: boolean) => {
    const checked = selectedIds.has(choice.id);
    const disabled = !checked && atLimit;
    return (
      <li key={choice.id}>
        <label
          title={disabled ? LIMIT_HINT : undefined}
          className={cn(
            'flex items-start gap-3 rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-muted',
            disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
          )}
        >
          <Checkbox
            checked={checked}
            disabled={disabled}
            onCheckedChange={() => toggle(choice)}
            aria-label={choice.name}
            className="mt-0.5"
          />
          <span className="min-w-0">
            <span className="block">{choice.name}</span>
            {withSectorCaption && (
              <span className="block text-xs text-muted-foreground">{choice.sectorName}</span>
            )}
          </span>
        </label>
      </li>
    );
  };

  const modalBody = (
    <div className="space-y-4">
      {/* Recherche transversale — chemin le plus rapide */}
      <div className="space-y-1.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une catégorie (le plus rapide)"
            className="pl-9"
            aria-label="Rechercher une catégorie"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          La recherche porte sur toutes les catégories, tous secteurs confondus.
        </p>
      </div>

      {treeLoading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : query.trim() ? (
        <div className="rounded-lg border">
          <ul className="max-h-[45vh] overflow-y-auto p-1">
            {searchResults.length === 0 ? (
              <li className="px-3 py-6 text-sm text-muted-foreground text-center">
                Aucune catégorie ne correspond à cette recherche.
              </li>
            ) : (
              searchResults.map((r) => renderSubSectorRow(r, true))
            )}
          </ul>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)] gap-3">
          <div className="rounded-lg border">
            <ul className="max-h-[45vh] overflow-y-auto p-1">
              {(tree ?? []).map((sec) => {
                const isActive = sec.id === openSectorId;
                const count = sec.subSectors.filter((s) => selectedIds.has(s.id)).length;
                return (
                  <li key={sec.id}>
                    <button
                      type="button"
                      onClick={() => setOpenSectorId(isActive ? null : sec.id)}
                      aria-expanded={isActive}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-foreground',
                      )}
                    >
                      <span className="min-w-0 truncate">{sec.name}</span>
                      <span className="flex items-center gap-1 shrink-0">
                        {count > 0 && (
                          <span className="text-xs tabular-nums">{count}</span>
                        )}
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>
                    {/* Sur mobile, les sous-secteurs s'ouvrent en accordéon sous le secteur */}
                    {isActive && (
                      <ul className="sm:hidden pl-3 border-l ml-3 my-1">
                        {sec.subSectors.map((sub) =>
                          renderSubSectorRow(
                            { id: sub.id, name: sub.name, sectorName: sec.name },
                            false,
                          ),
                        )}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="hidden sm:block rounded-lg border">
            {activeSector ? (
              <div className="p-1">
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  {activeSector.name} <span aria-hidden="true">&gt;</span> choisissez un
                  sous-secteur
                </p>
                <ul className="max-h-[40vh] overflow-y-auto">
                  {activeSector.subSectors.map((sub) =>
                    renderSubSectorRow(
                      { id: sub.id, name: sub.name, sectorName: activeSector.name },
                      false,
                    ),
                  )}
                </ul>
              </div>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">
                Sélectionnez un secteur à gauche pour afficher ses sous-secteurs.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Votre sélection */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <p className="text-sm font-medium">
          Votre sélection ({selection.length}/{MAX_CATEGORIES})
        </p>
        {selection.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune catégorie sélectionnée.</p>
        ) : (
          <ul className="space-y-1.5">
            {selection.map((s, index) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-md bg-card border px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block text-sm truncate">{s.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {index === 0 ? 'Principal' : s.sectorName}
                  </span>
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  {index !== 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => makePrimary(s.id)}
                    >
                      Définir comme principale
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    aria-label={`Retirer ${s.name}`}
                    onClick={() => toggle(s)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground leading-relaxed">
          Commencez par votre métier principal, celui pour lequel on vous consulte en premier.
          N'ajoutez une deuxième ou une troisième catégorie que si elle correspond à une activité
          réelle de l'entreprise : elles élargissent le nombre de visiteurs à qui vous êtes
          recommandé, mais une catégorie hors sujet dilue votre visibilité auprès des bons profils.
          C'est pour cela que la limite est de 3.
        </p>
      </div>
    </div>
  );

  const actions = (
    <>
      <Button variant="outline" onClick={() => setOpen(false)} disabled={saveMutation.isPending}>
        Annuler
      </Button>
      <Button onClick={handleSave} disabled={selection.length === 0 || saveMutation.isPending}>
        {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Enregistrer
      </Button>
    </>
  );

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-base font-semibold inline-flex items-center gap-2">
          <Tags className="h-4 w-4" />
          Catégories d'activité
        </h3>
        <span className="text-sm text-muted-foreground tabular-nums">
          {current.length} / {MAX_CATEGORIES} catégories
        </span>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm font-medium inline-flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          Pourquoi ces catégories comptent
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          Quand un visiteur prépare sa visite, Lotexpo lui recommande les exposants à rencontrer à
          partir de ces catégories, pas à partir de votre texte de présentation. Plus elles sont
          justes, plus les visiteurs qui s'arrêtent sur votre stand correspondent réellement à
          votre cible.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-10 w-full rounded-lg" />
      ) : isError ? (
        <p className="text-sm text-muted-foreground">
          Impossible de charger vos catégories pour le moment. Réessayez plus tard.
        </p>
      ) : current.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune catégorie n'est encore définie pour votre fiche.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {current.map((c) => (
            <li key={c.sub_sector_id}>
              <Badge variant={c.is_primary ? 'default' : 'outline'} className="gap-1">
                {c.is_primary && <Star className="h-3 w-3" />}
                {c.sub_sector_name}
                {c.is_primary ? ' · Principal' : ''}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <div>
        <Button variant="outline" onClick={openDialog} disabled={isError}>
          Modifier mes catégories
        </Button>
      </div>

      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="h-[92vh] overflow-y-auto">
            <SheetHeader className="text-left">
              <SheetTitle>Choisir vos catégories d'activité</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{modalBody}</div>
            <div className="mt-4 flex justify-end gap-2">{actions}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Choisir vos catégories d'activité</DialogTitle>
              <DialogDescription>
                Sélectionnez de 1 à 3 catégories issues du référentiel Lotexpo.
              </DialogDescription>
            </DialogHeader>
            {modalBody}
            <DialogFooter>{actions}</DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
