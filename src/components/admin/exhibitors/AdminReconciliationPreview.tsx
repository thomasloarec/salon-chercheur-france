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
import {
  AlertTriangle,
  Download,
  Search,
  Info,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import {
  useReconciliationSummary,
  useReconciliationStatusBreakdown,
  useReconciliationPage,
  type ReconPair,
} from '@/hooks/useReconciliationPreview';
import {
  STATUS_META,
  CATEGORY_META,
  confidenceLabel,
  readableReasons,
} from './reconciliationLabels';
import ReconciliationPairDetail from './ReconciliationPairDetail';

const PAGE_SIZE = 50;
const MIN_SCORE = 60;

type FilterMode = 'all' | 'status' | 'category' | 'client';
interface FilterDef {
  value: string;
  label: string;
  mode: FilterMode;
  param?: string; // status or category value sent to server
  clientFn?: (p: ReconPair) => boolean;
}

const num = (v: number | null | undefined) => v ?? 0;
const sideHas = (p: ReconPair, fn: (s: ReconPair['side_keep']) => boolean) =>
  fn(p.side_keep) || fn(p.side_deactivate);

const FILTERS: FilterDef[] = [
  { value: 'all', label: 'Tous', mode: 'all' },
  { value: 'auto_reconcilable', label: 'Auto-réconciliables', mode: 'status', param: 'auto_reconcilable' },
  { value: 'manual_review', label: 'À valider manuellement', mode: 'status', param: 'manual_review' },
  { value: 'dangerous', label: 'Dangereux', mode: 'status', param: 'dangerous' },
  { value: 'likely_false_positive', label: 'Faux positifs probables', mode: 'status', param: 'likely_false_positive' },
  { value: 'cat_B', label: 'Catégorie B', mode: 'category', param: 'B' },
  { value: 'cat_A_SAFE', label: 'Catégorie A_SAFE', mode: 'category', param: 'A_SAFE' },
  { value: 'cat_A2', label: 'Catégorie A2', mode: 'category', param: 'A2' },
  { value: 'cat_D', label: 'Catégorie D', mode: 'category', param: 'D' },
  { value: 'cat_E', label: 'Catégorie E', mode: 'category', param: 'E' },
  { value: 'has_novelties', label: 'Avec nouveautés (page)', mode: 'client', clientFn: (p) => sideHas(p, (s) => num(s?.published_novelties_count) > 0) },
  { value: 'has_owner_team', label: 'Avec owner / équipe (page)', mode: 'client', clientFn: (p) => sideHas(p, (s) => !!s?.owner_present || num(s?.active_team_count) > 0) },
  { value: 'has_leads', label: 'Avec leads (page)', mode: 'client', clientFn: (p) => sideHas(p, (s) => num(s?.leads_count) > 0) },
  { value: 'has_crm', label: 'Avec CRM (page)', mode: 'client', clientFn: (p) => sideHas(p, (s) => num(s?.crm_matches_count) > 0) },
];

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

function isTimeout(err: unknown): boolean {
  const m = (err as Error)?.message || '';
  return /timeout|canceling statement|statement timeout/i.test(m);
}

export default function AdminReconciliationPreview() {
  const [filterValue, setFilterValue] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 400);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ReconPair | null>(null);
  const [open, setOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const filterDef = FILTERS.find((f) => f.value === filterValue) ?? FILTERS[0];
  const serverStatus = filterDef.mode === 'status' ? filterDef.param ?? null : null;
  const serverCategory = filterDef.mode === 'category' ? filterDef.param ?? null : null;

  const { data: summary, isLoading: loadingSummary, error: summaryError } =
    useReconciliationSummary(MIN_SCORE);
  const {
    data: breakdown,
    isLoading: loadingBreakdown,
    error: breakdownError,
  } = useReconciliationStatusBreakdown(MIN_SCORE, showBreakdown);

  const {
    data: pageData,
    isLoading: loadingPage,
    isFetching: fetchingPage,
    error: pageError,
  } = useReconciliationPage(
    {
      minScore: MIN_SCORE,
      status: serverStatus,
      category: serverCategory,
      search: search || null,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    true,
  );

  // Reset to first page whenever the query inputs change.
  React.useEffect(() => {
    setPage(0);
  }, [filterValue, search]);

  const serverRows = pageData?.rows ?? [];
  const total = pageData?.total ?? 0;
  const rows = useMemo(() => {
    if (filterDef.mode === 'client' && filterDef.clientFn) {
      return serverRows.filter(filterDef.clientFn);
    }
    return serverRows;
  }, [serverRows, filterDef]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, (page + 1) * PAGE_SIZE);

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
    a.download = `reconciliation_preview_page${page + 1}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* KPI cards (light summary) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        <Kpi label="Paires analysées" value={summary?.pairs_analyzed} loading={loadingSummary} />
        <Kpi label="Identités uniques" value={summary?.unique_identities} loading={loadingSummary} />
        <Kpi label="Groupes distincts" value={summary?.distinct_group_keys} loading={loadingSummary} />
        {showBreakdown ? (
          <>
            <Kpi label="Auto-réconciliables" value={breakdown?.auto_reconcilable} loading={loadingBreakdown} tone="text-emerald-600" />
            <Kpi label="À valider" value={breakdown?.manual_review} loading={loadingBreakdown} tone="text-amber-600" />
            <Kpi label="Dangereux" value={breakdown?.dangerous} loading={loadingBreakdown} tone="text-destructive" />
            <Kpi label="Faux positifs" value={breakdown?.likely_false_positive} loading={loadingBreakdown} tone="text-slate-500" />
          </>
        ) : (
          <Card className="col-span-2 md:col-span-3 lg:col-span-4 flex items-center justify-center">
            <CardContent className="p-4 text-center">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowBreakdown(true)}>
                <RefreshCw className="h-4 w-4" /> Calculer la synthèse par statut
              </Button>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Calcul détaillé (peut prendre quelques secondes).
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {summaryError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          La synthèse n'a pas pu être calculée pour le moment. La table ci-dessous reste utilisable.
        </div>
      )}
      {showBreakdown && breakdownError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {isTimeout(breakdownError)
            ? 'La synthèse par statut a pris trop de temps. La table reste utilisable ; utilisez les filtres ou la recherche.'
            : 'Impossible de calculer la synthèse par statut pour le moment.'}
        </div>
      )}

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
          <Select value={filterValue} onValueChange={setFilterValue}>
            <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
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
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={!rows.length}>
          <Download className="h-4 w-4" /> Exporter la page
        </Button>
      </div>

      {pageError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {isTimeout(pageError)
            ? "L'analyse a pris trop de temps. Réduisez le filtre ou utilisez la recherche."
            : `Erreur de chargement : ${(pageError as Error).message}`}
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
            {loadingPage &&
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            {!loadingPage && !pageError && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Aucune paire ne correspond aux filtres.
                </TableCell>
              </TableRow>
            )}
            {!loadingPage &&
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

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          {loadingPage
            ? 'Chargement…'
            : `${rangeStart}–${rangeEnd} sur ${total} paire(s). Cliquez une ligne pour le détail.`}
          {filterDef.mode === 'client' && ' (filtre appliqué à la page courante)'}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={page === 0 || fetchingPage}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Précédent
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={page + 1 >= totalPages || fetchingPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ReconciliationPairDetail pair={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
}
