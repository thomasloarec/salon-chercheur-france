import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Copy, Check, Download, RefreshCw, Search, ChevronLeft, ChevronRight,
} from 'lucide-react';

type CleanupRow = {
  id: string;
  airtable_action: string;
  id_exposant_a_corriger: string;
  nom_actuel: string | null;
  valeur_actuelle: string | null;
  valeur_cible: string | null;
  id_exposant_canonique: string;
  nom_canonique: string | null;
  merge_reason: string;
  confidence: string;
  participations_moved: number;
  airtable_done: boolean;
  airtable_done_at: string | null;
};

const PAGE_SIZE = 50;

const ACTION_LABEL: Record<string, string> = {
  delete: 'Supprimer dans Airtable',
  fix_domain: 'Corriger le domaine',
  rename: 'Renommer',
};

export function ExposantAirtableCorrections() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'done'>('todo');
  const [page, setPage] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['exposant-cleanup-actions'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('v_exposant_cleanup_actions' as any)
        .select('*') as any);
      if (error) throw error;
      return (data ?? []) as CleanupRow[];
    },
  });

  const rows = data ?? [];

  const markMutation = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await (supabase.rpc as any)('mark_exposant_correction_done', {
        p_id: id, p_done: done,
      });
      if (error) throw error;
    },
    onMutate: async ({ id, done }: { id: string; done: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ['exposant-cleanup-actions'] });
      const prev = queryClient.getQueryData<CleanupRow[]>(['exposant-cleanup-actions']);
      queryClient.setQueryData<CleanupRow[]>(['exposant-cleanup-actions'], (old) =>
        (old ?? []).map((r) => (r.id === id ? { ...r, airtable_done: done } : r)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(['exposant-cleanup-actions'], ctx.prev);
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour le statut.', variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['exposant-cleanup-actions'] });
    },
  });

  const total = rows.length;
  const done = rows.filter((r) => r.airtable_done).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === 'todo' && r.airtable_done) return false;
      if (statusFilter === 'done' && !r.airtable_done) return false;
      if (!q) return true;
      return (
        (r.nom_actuel ?? '').toLowerCase().includes(q) ||
        (r.nom_canonique ?? '').toLowerCase().includes(q) ||
        r.id_exposant_a_corriger.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  React.useEffect(() => { setPage(0); }, [search, statusFilter]);

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1200);
    } catch {
      toast({ title: 'Copie impossible', variant: 'destructive' });
    }
  };

  const exportCsv = () => {
    const header = ['id_exposant_a_supprimer', 'nom', 'action', 'id_exposant_canonique', 'nom_canonique', 'participations_deplacees', 'traite'];
    const lines = filtered.map((r) => [
      r.id_exposant_a_corriger,
      (r.nom_actuel ?? '').replace(/"/g, '""'),
      r.airtable_action,
      r.id_exposant_canonique,
      (r.nom_canonique ?? '').replace(/"/g, '""'),
      String(r.participations_moved),
      r.airtable_done ? 'oui' : 'non',
    ]);
    const csv = [header, ...lines].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'corrections-airtable-exposants.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="space-y-1">
            <h3 className="font-medium">Nettoyage exposants — corrections à répercuter dans Airtable</h3>
            <p className="text-sm text-muted-foreground max-w-3xl">
              Ces fiches Airtable sont des doublons fusionnés sur Lotexpo. Supprime-les dans Airtable (via leur{' '}
              <code className="text-xs">id_exposant</code>) pour éviter qu'elles ne reviennent au prochain import.
              La fiche canonique à conserver est indiquée à droite.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Rafraîchir
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{total} corrections</Badge>
          <Badge variant="outline">{total - done} à traiter</Badge>
          <Badge variant="outline">{done} traitées</Badge>

          <div className="relative ml-auto w-full sm:w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un nom ou un id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">À traiter</SelectItem>
              <SelectItem value="done">Traitées</SelectItem>
              <SelectItem value="all">Toutes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Aucune correction dans ce filtre.</p>
        ) : (
          <>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[70px]">Traité</TableHead>
                    <TableHead>Fiche à supprimer</TableHead>
                    <TableHead>id_exposant (Airtable)</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Fiche canonique à conserver</TableHead>
                    <TableHead className="text-right">Part. déplacées</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {current.map((r) => (
                    <TableRow key={r.id} className={r.airtable_done ? 'opacity-60' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={r.airtable_done}
                          onCheckedChange={(v) => markMutation.mutate({ id: r.id, done: Boolean(v) })}
                          aria-label="Traité dans Airtable"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{r.nom_actuel ?? '—'}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => copyId(r.id_exposant_a_corriger)}
                          className="inline-flex items-center gap-1 font-mono text-xs hover:underline"
                          title="Copier"
                        >
                          {r.id_exposant_a_corriger}
                          {copiedId === r.id_exposant_a_corriger
                            ? <Check className="h-3 w-3 text-green-600" />
                            : <Copy className="h-3 w-3 text-muted-foreground" />}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{ACTION_LABEL[r.airtable_action] ?? r.airtable_action}</Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{r.nom_canonique ?? '—'}</p>
                        <p className="font-mono text-xs text-muted-foreground">{r.id_exposant_canonique}</p>
                      </TableCell>
                      <TableCell className="text-right">{r.participations_moved}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filtered.length} ligne(s) · page {page + 1} / {pageCount}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default ExposantAirtableCorrections;