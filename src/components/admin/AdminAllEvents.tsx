import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/useDebounce';

const PAGE_SIZE = 25;

type StatusFilter = 'all' | 'past' | 'upcoming';

interface AdminEventRow {
  id: string;
  nom_event: string | null;
  ville: string | null;
  date_debut: string | null;
  date_fin: string | null;
  visible: boolean | null;
  is_test: boolean | null;
}

interface Filters {
  search: string;
  status: StatusFilter;
  city: string;
  from: string;
  to: string;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Admin — "Tous les événements" : recherche, filtres (statut / ville / plage de
 * dates) combinables en AND, tri par date_debut décroissant, pagination
 * "Voir plus" (offset). Section admin-only ; inclut les événements de test et
 * non visibles (comportement admin habituel).
 */
export const AdminAllEvents = () => {
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [city, setCity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const debouncedSearch = useDebounce(search, 350);
  const debouncedCity = useDebounce(city, 350);

  const filters: Filters = {
    search: debouncedSearch,
    status,
    city: debouncedCity,
    from,
    to,
  };

  // Reset pagination whenever a filter changes.
  React.useEffect(() => {
    setPages(1);
  }, [debouncedSearch, status, debouncedCity, from, to]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-all-events', filters, pages],
    queryFn: async () => {
      let query = supabase
        .from('events')
        .select('id, nom_event, ville, date_debut, date_fin, visible, is_test')
        .order('date_debut', { ascending: false, nullsFirst: false })
        .range(0, pages * PAGE_SIZE - 1);

      if (filters.search.trim()) {
        query = query.ilike('nom_event', `%${filters.search.trim()}%`);
      }
      if (filters.city.trim()) {
        query = query.ilike('ville', `%${filters.city.trim()}%`);
      }
      if (filters.status === 'past') {
        query = query.lt('date_fin', today());
      } else if (filters.status === 'upcoming') {
        query = query.gte('date_fin', today());
      }
      if (filters.from) {
        query = query.gte('date_debut', filters.from);
      }
      if (filters.to) {
        query = query.lte('date_debut', filters.to);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AdminEventRow[];
    },
    placeholderData: keepPreviousData,
  });

  const rows = data ?? [];
  const canLoadMore = rows.length === pages * PAGE_SIZE;
  const t = today();

  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setCity('');
    setFrom('');
    setTo('');
  };

  const hasActiveFilters =
    !!search || status !== 'all' || !!city || !!from || !!to;

  return (
    <div className="bg-card rounded-lg border p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Tous les événements</h3>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Réinitialiser les filtres
          </Button>
        )}
      </div>

      {/* Filtres */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Recherche (nom)</Label>
          <Input
            placeholder="Nom de l'événement…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Statut</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="past">Terminés</SelectItem>
              <SelectItem value="upcoming">En cours ou à venir</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ville</Label>
          <Input
            placeholder="Ville…"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Du (début)</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Au (début)</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Tableau */}
      {isLoading ? (
        <div className="text-center p-4 text-muted-foreground">Chargement…</div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground py-4">Aucun événement trouvé.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((event) => {
                const isPast = !!event.date_fin && event.date_fin < t;
                return (
                  <TableRow key={event.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <Link
                        to={`/admin/events/${event.id}`}
                        className="text-primary hover:underline"
                      >
                        {event.nom_event || '—'}
                      </Link>
                      <div className="flex gap-1 mt-1">
                        {event.is_test && (
                          <Badge className="bg-purple-100 text-purple-800">Test</Badge>
                        )}
                        {event.visible === false && (
                          <Badge variant="outline">Non visible</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{event.ville || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {event.date_debut
                        ? new Date(event.date_debut).toLocaleDateString('fr-FR')
                        : '—'}
                      {event.date_fin
                        ? ` – ${new Date(event.date_fin).toLocaleDateString('fr-FR')}`
                        : ''}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          isPast
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {isPast ? 'Terminé' : 'En cours ou à venir'}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {canLoadMore && (
            <div className="mt-4 text-center">
              <Button onClick={() => setPages((p) => p + 1)} disabled={isFetching}>
                {isFetching ? 'Chargement…' : 'Voir plus'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminAllEvents;
