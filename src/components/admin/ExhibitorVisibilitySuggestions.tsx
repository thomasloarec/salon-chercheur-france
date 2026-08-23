import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getEventTypeLabel } from '@/constants/eventTypes';
import { toast } from 'sonner';

interface SuggestionRow {
  id: string;
  nom_event: string;
  type_event: string | null;
  date_debut: string | null;
  ville: string | null;
  slug: string | null;
  has_exhibitors: boolean;
  novelty_count: number;
  is_upcoming: boolean;
  suggestion_forte: boolean;
}

const formatDate = (d: string | null) => {
  if (!d) return '—';
  try {
    return format(new Date(d), 'd MMM yyyy', { locale: fr });
  } catch {
    return d;
  }
};

export const ExhibitorVisibilitySuggestions: React.FC = () => {
  const { isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['admin-events-without-exhibitors'],
    queryFn: async (): Promise<SuggestionRow[]> => {
      const { data, error } = await supabase.rpc('admin_list_events_without_exhibitors');
      if (error) throw error;
      const list = (data ?? []) as unknown as SuggestionRow[];
      // Tri : suggestions fortes d'abord, événements à venir d'abord, puis date.
      return [...list].sort((a, b) => {
        if (a.suggestion_forte !== b.suggestion_forte) return a.suggestion_forte ? -1 : 1;
        if (a.is_upcoming !== b.is_upcoming) return a.is_upcoming ? -1 : 1;
        return (a.date_debut ?? '').localeCompare(b.date_debut ?? '');
      });
    },
    enabled: isAdmin,
  });

  const groups = useMemo(
    () => ({
      fortes: (rows ?? []).filter((r) => r.suggestion_forte),
      faibles: (rows ?? []).filter((r) => !r.suggestion_forte),
    }),
    [rows],
  );

  const handleToggle = async (row: SuggestionRow, value: boolean) => {
    const previous = row.has_exhibitors;
    setUpdatingId(row.id);
    // Optimistic update (décochage unitaire et délibéré, aucune action de masse)
    queryClient.setQueryData(['admin-events-without-exhibitors'], (old: SuggestionRow[] | undefined) =>
      old?.map((r) => (r.id === row.id ? { ...r, has_exhibitors: value } : r)),
    );
    try {
      const { error } = await supabase.rpc('set_event_exhibitor_visibility', {
        p_event_id: row.id,
        p_enabled: value,
      });
      if (error) throw error;
      toast.success(
        value
          ? `Section exposants réactivée pour « ${row.nom_event} ».`
          : `Section exposants masquée pour « ${row.nom_event} ».`,
      );
      queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (err) {
      console.error('Erreur set_event_exhibitor_visibility:', err);
      queryClient.setQueryData(['admin-events-without-exhibitors'], (old: SuggestionRow[] | undefined) =>
        old?.map((r) => (r.id === row.id ? { ...r, has_exhibitors: previous } : r)),
      );
      toast.error("La modification n'a pas pu être appliquée.");
    } finally {
      setUpdatingId(null);
    }
  };

  const renderTable = (list: SuggestionRow[]) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Événement</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Ville</TableHead>
            <TableHead className="text-center">Nouveautés publiées</TableHead>
            <TableHead>État actuel</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((row) => {
            const enabled = row.has_exhibitors !== false;
            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium max-w-[280px]">
                  <Link
                    to={`/events/${row.slug || row.id}`}
                    className="text-primary hover:underline line-clamp-2"
                  >
                    {row.nom_event}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {row.type_event ? getEventTypeLabel(row.type_event) : '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(row.date_debut)}</TableCell>
                <TableCell className="whitespace-nowrap">{row.ville || '—'}</TableCell>
                <TableCell className="text-center">{row.novelty_count}</TableCell>
                <TableCell>
                  <Badge variant={enabled ? 'default' : 'secondary'}>
                    {enabled ? 'Section activée' : 'Section masquée'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <TooltipProvider delayDuration={200}>
                    <div className="inline-flex items-center gap-2">
                      {row.novelty_count > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex" role="img" aria-label="Avertissement">
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            <p>
                              {row.novelty_count} nouveauté{row.novelty_count > 1 ? 's' : ''} déjà
                              publiée{row.novelty_count > 1 ? 's' : ''} : décocher les masquera de la
                              page publique.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <Switch
                        checked={enabled}
                        onCheckedChange={(v) => handleToggle(row, v)}
                        disabled={updatingId === row.id}
                        aria-label={`Section exposants pour ${row.nom_event}`}
                      />
                    </div>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Événements sans exposants — visibilité des sections</CardTitle>
            <CardDescription>
              Masquer la section expose aussi les nouveautés. Action unitaire et délibérée — aucune
              action de masse.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-events-without-exhibitors'] })}
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <>
            <section>
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Candidats probables ({groups.fortes.length})
                <span className="ml-2 font-normal text-muted-foreground">
                  congrès, conférences et conventions sans exposants référencés
                </span>
              </h3>
              {groups.fortes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun candidat probable.</p>
              ) : (
                renderTable(groups.fortes)
              )}
            </section>

            <section>
              <h3 className="mb-1 text-sm font-semibold text-foreground">
                Salons sans exposants référencés ({groups.faibles.length})
              </h3>
              <p className="mb-3 text-sm text-muted-foreground">
                Ces salons ont probablement des exposants non encore référencés. Décocher ici
                masquerait la section à tort.
              </p>
              {groups.faibles.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun salon dans ce groupe.</p>
              ) : (
                renderTable(groups.faibles)
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
};
