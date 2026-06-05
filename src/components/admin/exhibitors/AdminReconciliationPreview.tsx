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
  Sparkles,
  Eye,
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import {
  useReconciliationSummary,
  useReconciliationStatusBreakdown,
  useReconciliationPage,
  useReconciliationGroupsBreakdown,
  useReconciliationGroupsSearch,
  useReconciliationGroupsLight,
  useReconciliationGroupDetail,
  type ReconPair,
  type ReconGroupLight,
} from '@/hooks/useReconciliationPreview';
import {
  STATUS_META,
  CATEGORY_META,
  confidenceLabel,
  readableReasons,
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

/** Normalized lightweight row used by the grouped table (from search or light list). */
interface LightRow {
  group_key: string;
  identity_ids: string[];
  identities_count: number;
  main_name: string | null;
  main_domain: string | null;
  sources: string[] | null;
  score_max: number;
  confidence_max: string;
}

function toLightRow(g: ReconGroupLight): LightRow {
  return {
    group_key: g.group_key,
    identity_ids: g.identity_ids ?? [],
    identities_count: g.identities_count,
    main_name: (g.names && g.names[0]) || null,
    main_domain: (g.domains && g.domains[0]) || null,
    sources: g.sources,
    score_max: g.score_max,
    confidence_max: g.confidence_max,
  };
}

function GroupsTable({
  rows,
  loading,
  emptyLabel,
  onSelect,
}: {
  rows: LightRow[];
  loading: boolean;
  emptyLabel: string;
  onSelect: (ids: string[]) => void;
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom principal</TableHead>
            <TableHead>Domaine</TableHead>
            <TableHead className="text-right">Identités</TableHead>
            <TableHead>Sources</TableHead>
            <TableHead className="text-right">Score max</TableHead>
            <TableHead>Confiance</TableHead>
            <TableHead className="text-right">Détail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 7 }).map((__, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                {emptyLabel}
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            rows.map((g) => (
              <TableRow key={g.group_key} className="cursor-pointer" onClick={() => onSelect(g.identity_ids)}>
                <TableCell className="text-xs max-w-[200px] truncate" title={g.main_name ?? ''}>
                  {g.main_name ?? '—'}
                </TableCell>
                <TableCell className="text-xs max-w-[160px] truncate" title={g.main_domain ?? ''}>
                  {g.main_domain ?? '—'}
                </TableCell>
                <TableCell className="text-right font-medium">{g.identities_count}</TableCell>
                <TableCell className="text-[11px]">
                  {(g.sources ?? []).map((s) => (
                    <Badge key={s} variant="outline" className="mr-1 text-[10px]">{s}</Badge>
                  ))}
                </TableCell>
                <TableCell className="text-right font-medium">{g.score_max}</TableCell>
                <TableCell className="text-xs">{confidenceLabel(g.confidence_max)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 h-7"
                    onClick={(e) => { e.stopPropagation(); onSelect(g.identity_ids); }}
                  >
                    <Eye className="h-3.5 w-3.5" /> Voir détail
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}

function GroupsView() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 400);
  const term = search.trim();
  const searchActive = term.length >= 2;

  const [priorityOn, setPriorityOn] = useState(false);
  const [priorityPage, setPriorityPage] = useState(0);

  const [detailIds, setDetailIds] = useState<string[] | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const { data: summary, isLoading: loadingSummary, error: summaryError } =
    useReconciliationSummary(MIN_SCORE);
  const {
    data: breakdown,
    isLoading: loadingBreakdown,
    error: breakdownError,
  } = useReconciliationGroupsBreakdown(MIN_SCORE, showBreakdown);

  // Search-first (only when a term of >= 2 chars is present).
  const {
    data: searchData,
    isLoading: loadingSearch,
    isFetching: fetchingSearch,
    error: searchError,
  } = useReconciliationGroupsSearch(searchActive ? term : null, MIN_SCORE, PAGE_SIZE);

  // Priority light list (only when explicitly requested and no active search).
  const lightEnabled = priorityOn && !searchActive;
  const {
    data: lightData,
    isLoading: loadingLight,
    isFetching: fetchingLight,
    error: lightError,
  } = useReconciliationGroupsLight(
    { minScore: MIN_SCORE, limit: PAGE_SIZE, offset: priorityPage * PAGE_SIZE },
    lightEnabled,
  );

  // On-demand detail.
  const { data: detailGroup, isLoading: loadingDetail, error: detailError } =
    useReconciliationGroupDetail(detailOpen ? detailIds : null, MIN_SCORE);

  React.useEffect(() => {
    setPriorityPage(0);
  }, [priorityOn]);

  const openDetail = (ids: string[]) => {
    setDetailIds(ids);
    setDetailOpen(true);
  };

  // Resolve which dataset drives the table.
  const searchRows: LightRow[] = useMemo(
    () =>
      (searchData?.rows ?? []).map((g) => ({
        group_key: g.group_key,
        identity_ids: g.identity_ids ?? [],
        identities_count: g.identities_count,
        main_name: g.main_name ?? (g.names && g.names[0]) ?? null,
        main_domain: g.main_domain ?? (g.domains && g.domains[0]) ?? null,
        sources: g.sources,
        score_max: g.score_max,
        confidence_max: g.confidence_max,
      })),
    [searchData],
  );
  const lightRows: LightRow[] = useMemo(
    () => (lightData?.rows ?? []).map(toLightRow),
    [lightData],
  );

  const lightTotal = lightData?.total ?? 0;
  const lightTotalPages = Math.max(1, Math.ceil(lightTotal / PAGE_SIZE));

  const exportCsv = (rows: LightRow[], label: string) => {
    const header = ['group_key', 'main_name', 'main_domain', 'identities_count', 'sources', 'score_max', 'confidence'];
    const lines = rows.map((g) => [
      g.group_key, g.main_name ?? '', g.main_domain ?? '', g.identities_count,
      (g.sources ?? []).join('|'), g.score_max, g.confidence_max,
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation_groupes_${label}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* KPIs légers */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        <Kpi label="Paires analysées" value={summary?.pairs_analyzed} loading={loadingSummary} />
        <Kpi label="Identités uniques" value={summary?.unique_identities} loading={loadingSummary} />
        <Kpi label="Groupes distincts" value={breakdown?.groups_total ?? summary?.distinct_group_keys} loading={loadingSummary} />
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
                <RefreshCw className="h-4 w-4" /> Calculer la synthèse par statut
              </Button>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Comptage lourd par statut. Peut prendre du temps (ou expirer) ; n'est jamais lancé automatiquement.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {summaryError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          La synthèse n'a pas pu être calculée pour le moment. La recherche ci-dessous reste utilisable.
        </div>
      )}
      {showBreakdown && breakdownError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {isTimeout(breakdownError)
            ? 'La synthèse par statut a pris trop de temps. Utilisez la recherche ou les groupes prioritaires.'
            : 'Impossible de calculer la synthèse par statut pour le moment.'}
        </div>
      )}

      <PreviewWarning />

      {/* Recherche */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Rechercher une entreprise (nom, domaine, slug, id)…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        {!searchActive && (
          <Button
            variant={priorityOn ? 'secondary' : 'default'}
            size="sm"
            className="gap-1.5"
            onClick={() => setPriorityOn((v) => !v)}
          >
            <Sparkles className="h-4 w-4" />
            {priorityOn ? 'Masquer les groupes prioritaires' : 'Analyser les groupes prioritaires'}
          </Button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5 shrink-0" />
        Les filtres avancés (nouveautés, leads, owner, CRM) sont disponibles dans le détail d'un groupe uniquement,
        pour éviter les analyses lourdes automatiques.
      </p>

      {/* ===== Mode recherche ===== */}
      {searchActive && (
        <>
          {searchError && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {isTimeout(searchError)
                ? "La recherche a pris trop de temps. Affinez le terme recherché."
                : `Erreur de chargement : ${(searchError as Error).message}`}
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              {loadingSearch || fetchingSearch
                ? 'Recherche…'
                : `${searchRows.length} groupe(s) pour « ${term} » (max ${PAGE_SIZE}). Cliquez pour le détail.`}
            </p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportCsv(searchRows, `recherche`)} disabled={!searchRows.length}>
              <Download className="h-4 w-4" /> Exporter
            </Button>
          </div>
          <GroupsTable
            rows={searchRows}
            loading={loadingSearch}
            emptyLabel={`Aucun groupe ne correspond à « ${term} ».`}
            onSelect={openDetail}
          />
        </>
      )}

      {/* ===== Mode groupes prioritaires ===== */}
      {!searchActive && priorityOn && (
        <>
          {lightError && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {isTimeout(lightError)
                ? "Le chargement des groupes prioritaires a pris trop de temps. Préférez la recherche."
                : `Erreur de chargement : ${(lightError as Error).message}`}
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              {loadingLight
                ? 'Chargement…'
                : `${lightTotal} groupe(s) au total — page ${priorityPage + 1}/${lightTotalPages}. Cliquez pour le détail.`}
            </p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportCsv(lightRows, `prioritaires_p${priorityPage + 1}`)} disabled={!lightRows.length}>
              <Download className="h-4 w-4" /> Exporter la page
            </Button>
          </div>
          <GroupsTable
            rows={lightRows}
            loading={loadingLight}
            emptyLabel="Aucun groupe prioritaire trouvé."
            onSelect={openDetail}
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={priorityPage === 0 || fetchingLight}
              onClick={() => setPriorityPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" /> Précédent
            </Button>
            <span className="text-xs text-muted-foreground">Page {priorityPage + 1} / {lightTotalPages}</span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={priorityPage + 1 >= lightTotalPages || fetchingLight}
              onClick={() => setPriorityPage((p) => p + 1)}
            >
              Suivant <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {/* ===== État initial ===== */}
      {!searchActive && !priorityOn && (
        <div className="rounded-lg border bg-muted/30 p-6 text-center space-y-3">
          <Users className="h-8 w-8 mx-auto text-muted-foreground" />
          <div>
            <p className="font-medium">La vue groupée détaillée est calculée à la demande.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Pour éviter les timeouts, lancez une recherche par nom, domaine ou slug, utilisez les
              groupes prioritaires, ou basculez sur la vue par paires paginée.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="text-muted-foreground">Exemples :</span>
            {['BNBxTECH', 'AB MAURI', 'arjo.com'].map((ex) => (
              <Button key={ex} variant="outline" size="sm" className="h-7" onClick={() => setSearchInput(ex)}>
                {ex}
              </Button>
            ))}
          </div>
          <Button variant="default" size="sm" className="gap-1.5 mt-1" onClick={() => setPriorityOn(true)}>
            <Sparkles className="h-4 w-4" /> Analyser les groupes prioritaires
          </Button>
        </div>
      )}

      {detailError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {isTimeout(detailError)
            ? "Le détail du groupe a pris trop de temps."
            : `Erreur de chargement du détail : ${(detailError as Error).message}`}
        </div>
      )}

      <ReconciliationGroupDetail
        group={detailGroup ?? null}
        loading={loadingDetail}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
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