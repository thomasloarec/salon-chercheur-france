import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ExternalLink, EyeOff, RotateCcw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

type CoverageRow = {
  id: string;
  nom_event: string;
  type_event: string | null;
  status_event: string | null;
  date_debut: string | null;
  date_fin: string | null;
  ville: string | null;
  slug: string | null;
  url_site_officiel: string | null;
  salon_priorite: number | null;
  exhibitor_sourcing_ignored: boolean;
  exhibitor_sourcing_ignored_at: string | null;
  nb_exposants: number;
  has_exhibitors: boolean;
  novelty_count: number;
  bucket: 'todo' | 'has_exhibitors' | 'ignored';
};

const normalizeUrl = (url: string | null): string | null => {
  if (!url) return null;
  const t = url.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

const formatDate = (d: string | null) => {
  if (!d) return '—';
  try {
    return format(new Date(d), 'd MMM yyyy', { locale: fr });
  } catch {
    return d;
  }
};

function CoverageTable({
  rows,
  isLoading,
  emptyLabel,
  renderActions,
  updatingVisibilityId,
  onToggleVisibility,
}: {
  rows: CoverageRow[];
  isLoading: boolean;
  emptyLabel: string;
  renderActions: (row: CoverageRow) => React.ReactNode;
  updatingVisibilityId: string | null;
  onToggleVisibility: (row: CoverageRow, value: boolean) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Chargement...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Événement</TableHead>
            <TableHead>Début</TableHead>
            <TableHead>Section exposants (page salon)</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{row.nom_event}</span>
                  <div className="flex flex-wrap gap-1">
                    {row.type_event && (
                      <Badge variant="secondary">{row.type_event}</Badge>
                    )}
                    {row.ville && <Badge variant="outline">{row.ville}</Badge>}
                  </div>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatDate(row.date_debut)}
              </TableCell>
              <TableCell>
                <div className="inline-flex items-center gap-2">
                  <Switch
                    checked={row.has_exhibitors !== false}
                    onCheckedChange={(v) => onToggleVisibility(row, v)}
                    disabled={updatingVisibilityId === row.id}
                    aria-label={`Section exposants (page salon) pour ${row.nom_event}`}
                  />
                  <span className="text-sm">
                    {row.has_exhibitors !== false ? 'Affichée' : 'Masquée'}
                  </span>
                  {row.novelty_count > 0 && (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex" role="img" aria-label="Avertissement">
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <p>
                            {row.novelty_count} nouveauté{row.novelty_count > 1 ? 's' : ''} publiée
                            {row.novelty_count > 1 ? 's' : ''} : masquer la section les retirera aussi
                            de la page publique.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  {renderActions(row)}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const AdminEventsCompletudePage = () => {
  const queryClient = useQueryClient();
  const [updatingVisibilityId, setUpdatingVisibilityId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-events-exhibitor-coverage'],
    staleTime: 30_000,
    queryFn: async (): Promise<CoverageRow[]> => {
      // cast volontaire : la vue peut ne pas figurer dans les types générés
      const { data, error } = await supabase
        .from('admin_events_exhibitor_coverage' as any)
        .select('*')
        .order('date_debut', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CoverageRow[];
    },
  });

  const { todo, has, ignored } = useMemo(() => {
    const rows = data ?? [];
    return {
      todo: rows.filter((r) => r.bucket === 'todo'),
      has: rows.filter((r) => r.bucket === 'has_exhibitors'),
      ignored: rows.filter((r) => r.bucket === 'ignored'),
    };
  }, [data]);

  const setIgnored = async (row: CoverageRow, ignoredValue: boolean) => {
    const { error } = await supabase.rpc(
      'admin_set_event_exhibitor_ignored' as any,
      { p_event_id: row.id, p_ignored: ignoredValue } as any
    );
    if (error) {
      toast({
        title: 'Échec',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: ignoredValue
        ? `« ${row.nom_event} » déplacé dans Ignorés`
        : `« ${row.nom_event} » remis à traiter`,
    });
    await queryClient.invalidateQueries({ queryKey: ['admin-events-exhibitor-coverage'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-pending-counts'] });
  };

  const toggleVisibility = async (row: CoverageRow, value: boolean) => {
    const previous = row.has_exhibitors;
    setUpdatingVisibilityId(row.id);
    // Mise a jour optimiste (bascule unitaire et deliberee)
    queryClient.setQueryData(
      ['admin-events-exhibitor-coverage'],
      (old: CoverageRow[] | undefined) =>
        old?.map((r) => (r.id === row.id ? { ...r, has_exhibitors: value } : r)),
    );
    const { error } = await supabase.rpc(
      'set_event_exhibitor_visibility' as any,
      { p_event_id: row.id, p_enabled: value } as any,
    );
    if (error) {
      // Rollback
      queryClient.setQueryData(
        ['admin-events-exhibitor-coverage'],
        (old: CoverageRow[] | undefined) =>
          old?.map((r) => (r.id === row.id ? { ...r, has_exhibitors: previous } : r)),
      );
      toast({
        title: 'Échec',
        description: error.message,
        variant: 'destructive',
      });
      setUpdatingVisibilityId(null);
      return;
    }
    toast({
      title: value
        ? `Section exposants réaffichée pour « ${row.nom_event} »`
        : `Section exposants masquée pour « ${row.nom_event} »`,
    });
    // La visibilite impacte la page publique : rafraichir le cache events.
    // On NE rafraichit PAS la liste de couverture (le bucket ne change pas).
    await queryClient.invalidateQueries({ queryKey: ['events'] });
    setUpdatingVisibilityId(null);
  };

  const renderLinks = (row: CoverageRow) => {
    const site = normalizeUrl(row.url_site_officiel);
    return (
      <>
        {site && (
          <Button variant="outline" size="sm" asChild>
            <a
              href={site}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center"
            >
              Site officiel
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        )}
        {row.slug && (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/events/${row.slug}`} className="flex items-center">
              Fiche
            </Link>
          </Button>
        )}
      </>
    );
  };

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Exposants à trouver</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <div className="space-y-1">
              <h3 className="font-semibold text-destructive">
                Impossible de charger la liste
              </h3>
              <p className="text-sm text-muted-foreground">
                {(error as Error).message}
              </p>
              <p className="text-sm text-muted-foreground">
                Vérifier que la vue{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  admin_events_exhibitor_coverage
                </code>{' '}
                existe et est accessible.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exposants à trouver</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Événements publiés à venir. « À traiter » = aucun exposant listé. La
          ligne disparaît automatiquement dès que des exposants sont importés
          pour l'événement.
        </p>
      </div>

      <Tabs defaultValue="todo">
        <TabsList>
          <TabsTrigger value="todo">
            À traiter{!isLoading && ` (${todo.length})`}
          </TabsTrigger>
          <TabsTrigger value="has">
            Avec exposants{!isLoading && ` (${has.length})`}
          </TabsTrigger>
          <TabsTrigger value="ignored">
            Ignorés{!isLoading && ` (${ignored.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todo" className="mt-4">
          <CoverageTable
            rows={todo}
            isLoading={isLoading}
            emptyLabel="Tous les événements publiés ont des exposants ou sont ignorés."
            updatingVisibilityId={updatingVisibilityId}
            onToggleVisibility={toggleVisibility}
            renderActions={(row) => (
              <>
                {renderLinks(row)}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIgnored(row, true)}
                >
                  <EyeOff className="mr-2 h-4 w-4" />
                  Ignorer
                </Button>
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="has" className="mt-4">
          <CoverageTable
            rows={has}
            isLoading={isLoading}
            emptyLabel="Aucun événement publié avec des exposants listés."
            updatingVisibilityId={updatingVisibilityId}
            onToggleVisibility={toggleVisibility}
            renderActions={(row) => (
              <>
                <Badge variant="secondary" className="h-7">
                  {row.nb_exposants} exposant{row.nb_exposants > 1 ? 's' : ''}
                </Badge>
                {renderLinks(row)}
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="ignored" className="mt-4">
          <CoverageTable
            rows={ignored}
            isLoading={isLoading}
            emptyLabel="Aucun événement ignoré."
            updatingVisibilityId={updatingVisibilityId}
            onToggleVisibility={toggleVisibility}
            renderActions={(row) => (
              <>
                {renderLinks(row)}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIgnored(row, false)}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Remettre à traiter
                </Button>
              </>
            )}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminEventsCompletudePage;
