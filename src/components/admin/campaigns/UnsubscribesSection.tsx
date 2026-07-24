import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, Search, AlertCircle } from 'lucide-react';
import { useEmailBlacklist } from '@/hooks/useEmailBlacklist';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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

type Filter = 'all' | 'auto' | 'admin';

const formatDate = (iso: string | null) => {
  if (!iso) return '';
  try {
    return format(new Date(iso), 'dd/MM/yyyy à HH:mm');
  } catch {
    return '';
  }
};

export default function UnsubscribesSection() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, error } = useEmailBlacklist();

  const rows = data ?? [];
  const total = rows.length;
  const autoCount = useMemo(
    () => rows.filter((r) => r.auto_desinscrit).length,
    [rows],
  );

  const filtered = useMemo(() => {
    let out = rows;
    if (filter === 'auto') out = out.filter((r) => r.auto_desinscrit === true);
    else if (filter === 'admin') out = out.filter((r) => r.auto_desinscrit === false);
    const q = search.trim().toLowerCase();
    if (q) out = out.filter((r) => r.email_normalized?.toLowerCase().includes(q));
    return out;
  }, [rows, filter, search]);

  const title = `Désinscriptions et adresses bloquées (${total} adresses, dont ${autoCount} désinscriptions volontaires)`;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left hover:bg-muted/40 transition-colors"
          >
            <span className="text-sm font-medium">{title}</span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                open ? 'rotate-180' : ''
              }`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
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
              <div className="flex items-start gap-3 text-sm rounded-md border p-4">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Impossible de charger la liste.</p>
                  <p className="text-muted-foreground">
                    {(error as Error)?.message ?? 'Erreur inconnue.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Qui a bloqué</TableHead>
                      <TableHead>Entreprise</TableHead>
                      <TableHead>Salon</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        </TableRow>
                      ))
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-10 text-sm text-muted-foreground"
                        >
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
                            <TableCell className="font-medium">
                              {r.email_normalized}
                            </TableCell>
                            <TableCell>
                              <Badge variant={r.auto_desinscrit ? 'default' : 'secondary'}>
                                {r.origine_libelle}
                              </Badge>
                            </TableCell>
                            <TableCell>{r.company_name ?? ''}</TableCell>
                            <TableCell>{r.event_name ?? ''}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatDate(dateIso)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}