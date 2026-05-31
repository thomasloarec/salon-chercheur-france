import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
import { AlertCircle, ExternalLink, RefreshCw, Search, Globe } from 'lucide-react';

type InvalidWebsiteRow = {
  public_identity_id: string;
  public_slug: string;
  display_name: string;
  source_type: string;
  website: string;
  exhibitor_id: string | null;
  reason: string;
};

const AdminInvalidWebsites: React.FC = () => {
  const [reasonFilter, setReasonFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['invalid-exhibitor-websites'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_invalid_exhibitor_websites');
      if (error) throw error;
      return (data ?? []) as unknown as InvalidWebsiteRow[];
    },
  });

  const reasons = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((r) => set.add(r.reason));
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (reasonFilter !== 'all') {
      rows = rows.filter((r) => r.reason === reasonFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.display_name?.toLowerCase().includes(q) ||
          r.public_slug?.toLowerCase().includes(q) ||
          r.website?.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [data, reasonFilter, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{data?.length ?? 0} websites invalides</Badge>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto gap-2"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Rafraîchir
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1">
            <Label className="text-xs">Raison</Label>
            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {reasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label className="text-xs">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom, slug ou website…"
                className="pl-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 p-4 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>
              Impossible de charger les websites invalides.{' '}
              {error instanceof Error ? error.message : ''}
            </span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => refetch()}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
            <Globe className="h-8 w-8" />
            <p>Aucun website invalide ne correspond aux filtres.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Website brut</TableHead>
                  <TableHead>Raison</TableHead>
                  <TableHead className="text-right">Liens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.public_identity_id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {r.display_name}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                      /{r.public_slug}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {r.source_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate" title={r.website}>
                      {r.website || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {r.reason}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={`/exposants/${r.public_slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Page publique
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminInvalidWebsites;