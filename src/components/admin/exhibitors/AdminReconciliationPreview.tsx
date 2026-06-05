import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Download, Search, Info } from 'lucide-react';
import {
  useReconciliationSummary,
  useReconciliationPairs,
  type ReconPair,
} from '@/hooks/useReconciliationPreview';
import {
  STATUS_META,
  CATEGORY_META,
  confidenceLabel,
  readableReasons,
} from './reconciliationLabels';
import ReconciliationPairDetail from './ReconciliationPairDetail';

type FilterKey =
  | 'all'
  | 'auto_reconcilable'
  | 'manual_review'
  | 'dangerous'
  | 'likely_false_positive'
  | 'cat_B'
  | 'cat_A_SAFE'
  | 'cat_A2'
  | 'cat_DE'
  | 'has_novelties'
  | 'has_owner_team'
  | 'has_leads'
  | 'has_crm';

const FILTERS: { value: FilterKey; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'auto_reconcilable', label: 'Auto-réconciliables' },
  { value: 'manual_review', label: 'À valider manuellement' },
  { value: 'dangerous', label: 'Dangereux' },
  { value: 'likely_false_positive', label: 'Faux positifs probables' },
  { value: 'cat_B', label: 'Catégorie B' },
  { value: 'cat_A_SAFE', label: 'Catégorie A_SAFE' },
  { value: 'cat_A2', label: 'Catégorie A2' },
  { value: 'cat_DE', label: 'Catégorie D/E' },
  { value: 'has_novelties', label: 'Avec nouveautés' },
  { value: 'has_owner_team', label: 'Avec owner / équipe' },
  { value: 'has_leads', label: 'Avec leads' },
  { value: 'has_crm', label: 'Avec CRM' },
];

const num = (v: number | null | undefined) => v ?? 0;

function sideHas(p: ReconPair, fn: (s: ReconPair['side_keep']) => boolean): boolean {
  return fn(p.side_keep) || fn(p.side_deactivate);
}

function matchFilter(p: ReconPair, f: FilterKey): boolean {
  switch (f) {
    case 'all': return true;
    case 'auto_reconcilable':
    case 'manual_review':
    case 'dangerous':
    case 'likely_false_positive':
      return p.status === f;
    case 'cat_B': return p.category === 'B';
    case 'cat_A_SAFE': return p.category === 'A_SAFE';
    case 'cat_A2': return p.category === 'A2';
    case 'cat_DE': return p.category === 'D' || p.category === 'E';
    case 'has_novelties': return sideHas(p, (s) => num(s?.published_novelties_count) > 0);
    case 'has_owner_team': return sideHas(p, (s) => !!s?.owner_present || num(s?.active_team_count) > 0);
    case 'has_leads': return sideHas(p, (s) => num(s?.leads_count) > 0);
    case 'has_crm': return sideHas(p, (s) => num(s?.crm_matches_count) > 0);
    default: return true;
  }
}

function matchSearch(p: ReconPair, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const fields = [
    p.pair_key,
    p.group_key,
    p.recommended_keep_slug,
    p.recommended_deactivate_slug,
    p.side_keep?.canonical_name,
    p.side_keep?.public_slug,
    p.side_keep?.normalized_domain,
    p.side_keep?.exhibitor_name,
    p.side_keep?.legacy_name,
    p.side_deactivate?.canonical_name,
    p.side_deactivate?.public_slug,
    p.side_deactivate?.normalized_domain,
    p.side_deactivate?.exhibitor_name,
    p.side_deactivate?.legacy_name,
  ];
  return fields.some((v) => v && v.toLowerCase().includes(needle));
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={m.variant} className={m.className}>{m.label}</Badge>;
}

function CategoryBadge({ category }: { category: string }) {
  const m = CATEGORY_META[category] ?? { label: category, hint: '' };
  return <Badge variant="secondary" title={m.hint}>{m.label}</Badge>;
}

function Kpi({ label, value, loading, tone }: { label: string; value?: number; loading: boolean; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        {loading ? (
          <Skeleton className="h-7 w-14 mt-1" />
        ) : (
          <div className={`text-2xl font-bold mt-0.5 ${tone || ''}`}>{value ?? 0}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminReconciliationPreview() {
  const MIN_SCORE = 60;
  const { data: summary, isLoading: loadingSummary } = useReconciliationSummary(MIN_SCORE);
  const { data: pairs, isLoading: loadingPairs, error } = useReconciliationPairs(MIN_SCORE);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ReconPair | null>(null);
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => {
    const list = pairs ?? [];
    return list.filter((p) => matchFilter(p, filter) && matchSearch(p, search));
  }, [pairs, filter, search]);

  const exportCsv = () => {
    const header = [
      'pair_key', 'status', 'category', 'score', 'confidence',
      'keep_slug', 'keep_name', 'deactivate_slug', 'deactivate_name', 'domain',
    ];
    const lines = rows.map((p) => [
      p.pair_key, p.status, p.category, p.score, p.confidence,
      p.recommended_keep_slug ?? '', p.side_keep?.canonical_name ?? '',
      p.recommended_deactivate_slug ?? '', p.side_deactivate?.canonical_name ?? '',
      p.side_keep?.normalized_domain ?? '',
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation_preview_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <Kpi label="Paires analysées" value={summary?.pairs_analyzed} loading={loadingSummary} />
        <Kpi label="Identités uniques" value={summary?.unique_identities} loading={loadingSummary} />
        <Kpi label="Groupes distincts" value={summary?.distinct_group_keys} loading={loadingSummary} />
        <Kpi label="Auto-réconciliables" value={summary?.auto_reconcilable} loading={loadingSummary} tone="text-emerald-600" />
        <Kpi label="À valider" value={summary?.manual_review} loading={loadingSummary} tone="text-amber-600" />
        <Kpi label="Dangereux" value={summary?.dangerous} loading={loadingSummary} tone="text-destructive" />
        <Kpi label="Faux positifs" value={summary?.likely_false_positive} loading={loadingSummary} tone="text-slate-500" />
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          Cette analyse est une prévisualisation <strong>par paire</strong>. Elle ne réalise aucune
          fusion et ne doit pas encore être utilisée pour corriger automatiquement des groupes complets.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2 items-center">
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Rechercher (nom, domaine, slug)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={!rows.length}>
          <Download className="h-4 w-4" /> Exporter CSV
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          Erreur de chargement : {(error as Error).message}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Statut</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead>Confiance</TableHead>
              <TableHead>À garder</TableHead>
              <TableHead>Doublon potentiel</TableHead>
              <TableHead>Domaine</TableHead>
              <TableHead>Pourquoi détecté</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingPairs &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            {!loadingPairs && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Aucune paire ne correspond aux filtres.
                </TableCell>
              </TableRow>
            )}
            {!loadingPairs &&
              rows.map((p) => {
                const reasons = readableReasons(p.reasons);
                return (
                  <TableRow
                    key={p.pair_key}
                    className="cursor-pointer"
                    onClick={() => { setSelected(p); setOpen(true); }}
                  >
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell><CategoryBadge category={p.category} /></TableCell>
                    <TableCell className="text-right font-medium">{p.score}</TableCell>
                    <TableCell className="text-xs">{confidenceLabel(p.confidence)}</TableCell>
                    <TableCell className="text-xs max-w-[160px] truncate" title={p.side_keep?.canonical_name ?? ''}>
                      {p.side_keep?.canonical_name ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs max-w-[160px] truncate" title={p.side_deactivate?.canonical_name ?? ''}>
                      {p.side_deactivate?.canonical_name ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs">{p.side_keep?.normalized_domain ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      {reasons.slice(0, 2).map((r) => (
                        <Badge key={r} variant="outline" className="mr-1 text-[10px]">{r}</Badge>
                      ))}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5" />
        {loadingPairs ? 'Chargement…' : `${rows.length} paire(s) affichée(s). Cliquez une ligne pour le détail.`}
      </p>

      <ReconciliationPairDetail pair={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
}
