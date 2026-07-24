import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useEmailBlacklist } from '@/hooks/useEmailBlacklist';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertCircle, Search } from 'lucide-react';

type Filter = 'all' | 'auto' | 'admin';

const AdminDesinscriptions: React.FC = () => {
  const { data, isLoading, isError, error } = useEmailBlacklist();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const rows = data ?? [];
  const total = rows.length;
  const autoCount = useMemo(() => rows.filter((r) => r.auto_desinscrit).length, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (filter === 'auto') out = out.filter((r) => r.auto_desinscrit === true);
    else if (filter === 'admin') out = out.filter((r) => r.auto_desinscrit === false);
    const q = search.trim().toLowerCase();
    if (q) out = out.filter((r) => r.email_normalized?.toLowerCase().includes(q));
    return out;
  }, [rows, filter, search]);

  const formatDate = (iso: string | null) => {
    if (!iso) return '';
    try {
      return format(new Date(iso), 'dd/MM/yyyy à HH:mm');
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Désinscriptions et adresses bloquées
        </h1>
        {isLoading ? (
          <Skeleton className="h-4 w-72" />
        ) : (
          <p className="text-sm text-muted-foreground">
            {total} adresses bloquées, dont {autoCount} désinscriptions volontaires
          </p>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border p-1 gap-1">
          <Button
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            Toutes
          </Button>
          <Button
            variant={filter === 'auto' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('auto')}
          >
            Désinscriptions destinataire
          </Button>
          <Button
            variant={filter === 'admin' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('admin')}
          >
            Actions admin
          </Button>
        </div>
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isError ? (
        <Card>
          <CardContent className="p-6 flex items-start gap-3 text-sm">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Impossible de charger la liste.</p>
              <p className="text-muted-foreground">
                {(error as Error)?.message ?? 'Erreur inconnue.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Origine</TableHead>
                  <TableHead>Contexte</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Clics</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-sm text-muted-foreground">
                      {total === 0
                        ? 'Aucune adresse bloquée pour le moment.'
                        : 'Aucune adresse ne correspond au filtre actif.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => {
                    const dateIso = r.derniere_desinscription ?? r.blackliste_le;
                    return (
                      <TableRow key={`${r.email_normalized}-${r.blackliste_le}`}>
                        <TableCell className="font-medium">{r.email_normalized}</TableCell>
                        <TableCell>
                          <Badge variant={r.auto_desinscrit ? 'default' : 'secondary'}>
                            {r.origine_libelle}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {r.company_name || r.event_name ? (
                            <div className="space-y-0.5">
                              {r.company_name && (
                                <div className="text-sm">{r.company_name}</div>
                              )}
                              {r.event_name && (
                                <div className="text-xs text-muted-foreground">{r.event_name}</div>
                              )}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(dateIso)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.nb_clics > 1 ? r.nb_clics : ''}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminDesinscriptions;