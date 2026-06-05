import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  Users,
  GitMerge,
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import {
  useReconciliationSummary,
  useReconciliationStatusBreakdown,
  useReconciliationPage,
  useReconciliationGroupsPage,
  useReconciliationGroupsBreakdown,
  type ReconPair,
  type ReconGroup,
} from '@/hooks/useReconciliationPreview';
import {
  STATUS_META,
  CATEGORY_META,
  confidenceLabel,
  readableReasons,
  riskLabel,
} from './reconciliationLabels';
import ReconciliationPairDetail from './ReconciliationPairDetail';
import ReconciliationGroupDetail from './ReconciliationGroupDetail';

const PAGE_SIZE = 50;
const MIN_SCORE = 60;

const num = (v: number | null | undefined) => v ?? 0;

function isTimeout(err: unknown): boolean {
  const m = (err as Error)?.message || '';
  return /timeout|canceling statement|statement timeout/i.test(m);
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

function PreviewWarning() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <p>
        Prévisualisation <strong>en lecture seule</strong>. Aucune fusion, désactivation ou remap n'est
        effectué. Cet écran sert uniquement à comprendre les doublons et les plans théoriques.
      </p>
    </div>
  );
}

/* ============================ GROUPS VIEW ============================ */

type GroupFilterMode = 'all' | 'status' | 'category' | 'client';
interface GroupFilterDef {
  value: string;
  label: string;
  mode: GroupFilterMode;
  param?: string;
  clientFn?: (g: ReconGroup) => boolean;
}

const GROUP_FILTERS: GroupFilterDef[] = [
  { value: 'all', label: 'Tous', mode: 'all' },
  { value: 'auto_reconcilable', label: 'Auto-réconciliables', mode: 'status', param: 'auto_reconcilable' },
  { value: 'manual_review', label: 'À valider manuellement', mode: 'status', param: 'manual_review' },
  { value: 'dangerous', label: 'Dangereux', mode: 'status', param: 'dangerous' },
  { value: 'likely_false_positive', label: 'Faux positifs probables', mode: 'status', param: 'likely_false_positive' },
  { value: 'cat_B', label: 'Catégorie B', mode: 'category', param: 'B' },
  { value: 'cat_A_SAFE', label: 'Catégorie A_SAFE', mode: 'category', param: 'A_SAFE' },
  { value: 'with_novelties', label: 'Avec nouveautés (page)', mode: 'client', clientFn: (g) => num(g.total_novelties) > 0 },
  { value: 'with_leads', label: 'Avec leads (page)', mode: 'client', clientFn: (g) => num(g.total_leads) > 0 },
  { value: 'with_owner', label: 'Avec owner/équipe (page)', mode: 'client', clientFn: (g) => num(g.total_teams) > 0 },
  { value: 'with_crm', label: 'Avec CRM (page)', mode: 'client', clientFn: (g) => num(g.total_crm) > 0 },
  { value: 'size3', label: '3 identités ou plus (page)', mode: 'client', clientFn: (g) => num(g.identities_count) >= 3 },
];

function GroupsView() {
  const [filterValue, setFilterValue] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 400);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ReconGroup | null>(null);
  const [open, setOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const filterDef = GROUP_FILTERS.find((f) => f.value === filterValue) ?? GROUP_FILTERS[0];
  const serverStatus = filterDef.mode === 'status' ? filterDef.param ?? null : null;
  const serverCategory = filterDef.mode === 'category' ? filterDef.param ?? null : null;

  const { data: summary, isLoading: loadingSummary, error: summaryError } =
    useReconciliationSummary(MIN_SCORE);
  const {
    data: breakdown,
    isLoading: loadingBreakdown,
    error: breakdownError,
  } = useReconciliationGroupsBreakdown(MIN_SCORE, showBreakdown);

  const {
    data: pageData,
    isLoading: loadingPage,
    isFetching: fetchingPage,
    error: pageError,
  } = useReconciliationGroupsPage(
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
      'group_key', 'status', 'category', 'risk', 'identities_count', 'score_max',
      'main_name', 'main_domain', 'sources', 'participations', 'novelties', 'leads', 'teams', 'crm',
      'recommended_keep_slug',
    ];
    const lines = rows.map((g) => [
      g.group_key, g.status_group, g.category_group, g.risk_level, g.identities_count, g.score_max,
      g.main_name ?? '', g.main_domain ?? '', (g.sources ?? []).join('|'),
      g.total_participations, g.total_novelties, g.total_leads, g.total_teams, g.total_crm,
      g.recommended_keep_slug ?? '',
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation_groupes_page${page + 1}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        <Kpi label="Paires analysées" value={summary?.pairs_analyzed} loading={loadingSummary} />
        <Kpi label="Identités uniques" value={summary?.unique_identities} loading={loadingSummary} />
        <Kpi label="Groupes distincts" value={breakdown?.groups_total} loading={showBreakdown && loadingBreakdown} />
        {showBreakdown ? (
          <>
            <Kpi label="Groupes auto-réconc." value={breakdown?.auto_reconcilable} loading={loadingBreakdown} tone="text-emerald-600" />
            <Kpi label="Groupes à valider" value={breakdown?.manual_review} loading={loadingBreakdown} tone="text-amber-600" />
            <Kpi label="Groupes dangereux" value={breakdown?.dangerous} loading={loadingBreakdown} tone="text-destructive" />
            <Kpi label="Faux positifs" value={breakdown?.likely_false_positive} loading={loadingBreakdown} tone="text-slate-500" />
          </>
        ) : (
          <Card className="col-span-2 md:col-span-3 lg:col-span-4 flex items-center justify-center">
            <CardContent className="p-4 text-center">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowBreakdown(true)}>
                <RefreshCw className="h-4 w-4" /> Calculer la synthèse par groupe
              </Button>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Comptage par statut au niveau groupe (peut prendre quelques secondes).
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
            ? 'La synthèse par groupe a pris trop de temps. La table reste utilisable ; utilisez les filtres ou la recherche.'
            : 'Impossible de calculer la synthèse par groupe pour le moment.'}
        </div>
      )}

      <PreviewWarning />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2 items-center">
          <Select value={filterValue} onValueChange={setFilterValue}>
            <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {GROUP_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Rechercher (nom, domaine, slug, id_exposant, exhibitor_id)…"
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
              <TableHead>Statut groupe</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Nom principal</TableHead>
              <TableHead>Domaine</TableHead>
              <TableHead className="text-right">Identités</TableHead>
              <TableHead>Sources</TableHead>
              <TableHead className="text-right">Part.</TableHead>
              <TableHead className="text-right">Nouv.</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Own/CRM</TableHead>
              <TableHead>Risque</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingPage &&
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 11 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            {!loadingPage && !pageError && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  Aucun groupe ne correspond aux filtres.
                </TableCell>
              </TableRow>
            )}
            {!loadingPage &&
              rows.map((g) => {
                const risk = riskLabel(g.risk_level);
                return (
                  <TableRow
                    key={g.group_key}
                    className="cursor-pointer"
                    onClick={() => { setSelected(g); setOpen(true); }}
                  >
                    <TableCell><StatusBadge status={g.status_group} /></TableCell>
                    <TableCell><CategoryBadge category={g.category_group} /></TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate" title={g.main_name ?? ''}>
                      {g.main_name ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs max-w-[140px] truncate" title={g.main_domain ?? ''}>
                      {g.main_domain ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">{g.identities_count}</TableCell>
                    <TableCell className="text-[11px]">
                      {(g.sources ?? []).map((s) => (
                        <Badge key={s} variant="outline" className="mr-1 text-[10px]">{s}</Badge>
                      ))}
                    </TableCell>
                    <TableCell className="text-right text-xs">{g.total_participations}</TableCell>
                    <TableCell className="text-right text-xs">{g.total_novelties}</TableCell>
                    <TableCell className="text-right text-xs">{g.total_leads}</TableCell>
                    <TableCell className="text-right text-xs">{g.total_teams}/{g.total_crm}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={risk.className}>{risk.label}</Badge>
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
            : `${rangeStart}–${rangeEnd} sur ${total} groupe(s). Cliquez une ligne pour le détail.`}
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
          <span className="text-xs text-muted-foreground">Page {page + 1} / {totalPages}</span>
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

      <ReconciliationGroupDetail group={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
}

/* ============================ PAIRS VIEW ============================ */

type FilterMode = 'all' | 'status' | 'category' | 'client';
interface FilterDef {
  value: string;
  label: string;
  mode: FilterMode;
  param?: string;
  clientFn?: (p: ReconPair) => boolean;
}

const sideHas = (p: ReconPair, fn: (s: ReconPair['side_keep']) => boolean) =>
  fn(p.side_keep) || fn(p.side_deactivate);

const PAIR_FILTERS: FilterDef[] = [
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

function PairsView() {
  const [filterValue, setFilterValue] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 400);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ReconPair | null>(null);
  const [open, setOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const filterDef = PAIR_FILTERS.find((f) => f.value === filterValue) ?? PAIR_FILTERS[0];
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

      <PreviewWarning />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2 items-center">
          <Select value={filterValue} onValueChange={setFilterValue}>
            <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAIR_FILTERS.map((f) => (
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
          <span className="text-xs text-muted-foreground">Page {page + 1} / {totalPages}</span>
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

/* ============================ WRAPPER ============================ */

export default function AdminReconciliationPreview() {
  return (
    <Tabs defaultValue="groups" className="space-y-4">
      <TabsList>
        <TabsTrigger value="groups" className="gap-1.5">
          <Users className="h-4 w-4" /> Vue par groupes
        </TabsTrigger>
        <TabsTrigger value="pairs" className="gap-1.5">
          <GitMerge className="h-4 w-4" /> Vue par paires
        </TabsTrigger>
      </TabsList>
      <TabsContent value="groups">
        <GroupsView />
      </TabsContent>
      <TabsContent value="pairs">
        <PairsView />
      </TabsContent>
    </Tabs>
  );
}
