import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertCircle,
  ExternalLink,
  Linkedin,
  Globe,
  RefreshCw,
  Search,
  ShieldQuestion,
  Check,
  X,
  Copy,
} from 'lucide-react';
import { GitMerge } from 'lucide-react';
import MergePreviewDialog from './MergePreviewDialog';

type DuplicateRow = {
  identity_a_id: string;
  identity_b_id: string;
  score: number;
  confidence: string;
  reasons: Record<string, boolean> | null;
  a_slug: string;
  a_name: string;
  a_source: string;
  a_website: string | null;
  a_linkedin: string | null;
  a_participations: number;
  a_future: number;
  a_next_event: string | null;
  b_slug: string;
  b_name: string;
  b_source: string;
  b_website: string | null;
  b_linkedin: string | null;
  b_participations: number;
  b_future: number;
  b_next_event: string | null;
  status: string;
  reviewed_at: string | null;
};

const REASON_LABELS: Record<string, string> = {
  same_domain: 'Même domaine',
  same_linkedin: 'Même LinkedIn',
  same_name: 'Même nom',
  same_base_slug: 'Même base slug',
  name_close: 'Nom proche',
  source_complementary: 'Source complémentaire',
};

const STATUS_LABELS: Record<string, string> = {
  review_required: 'À revoir',
  probable_duplicate: 'Doublon probable',
  distinct: 'Distinct',
  ignored: 'Ignoré',
};

const SOURCE_LABELS: Record<string, string> = {
  legacy: 'legacy',
  modern: 'modern',
  linked: 'linked',
};

function confidenceBadgeVariant(confidence: string): 'default' | 'secondary' | 'outline' {
  if (confidence === 'high') return 'default';
  if (confidence === 'medium') return 'secondary';
  return 'outline';
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'probable_duplicate':
      return 'default';
    case 'distinct':
      return 'secondary';
    case 'ignored':
      return 'outline';
    default:
      return 'destructive';
  }
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR');
  } catch {
    return d;
  }
}

const IdentityCard: React.FC<{
  label: string;
  name: string;
  slug: string;
  source: string;
  website: string | null;
  linkedin: string | null;
  participations: number;
  future: number;
  nextEvent: string | null;
}> = ({ label, name, slug, source, website, linkedin, participations, future, nextEvent }) => (
  <div className="flex-1 rounded-lg border bg-muted/30 p-3 space-y-2 min-w-0">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-semibold text-muted-foreground">Fiche {label}</span>
      <Badge variant="outline" className="text-[10px]">
        {SOURCE_LABELS[source] ?? source}
      </Badge>
    </div>
    <p className="font-medium leading-tight break-words">{name}</p>
    <p className="text-xs text-muted-foreground break-all">/{slug}</p>
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      <span>
        {participations} participation{participations > 1 ? 's' : ''}
      </span>
      <span>·</span>
      <span>{future} à venir</span>
      <span>·</span>
      <span>Prochain : {formatDate(nextEvent)}</span>
    </div>
    <div className="flex flex-wrap items-center gap-3 pt-1">
      <a
        href={`/exposants/${slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <ExternalLink className="h-3 w-3" />
        Page publique
      </a>
      {website && (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline break-all"
        >
          <Globe className="h-3 w-3 shrink-0" />
          Site
        </a>
      )}
      {linkedin && (
        <a
          href={linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          <Linkedin className="h-3 w-3" />
          LinkedIn
        </a>
      )}
    </div>
  </div>
);

const AdminDuplicateReviews: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [minScore, setMinScore] = useState<number>(60);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [previewPair, setPreviewPair] = useState<DuplicateRow | null>(null);

  const queryKey = ['exhibitor-duplicates', minScore, includeResolved];

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('detect_exhibitor_duplicates', {
        p_min_score: minScore,
        p_include_resolved: includeResolved,
      });
      if (error) throw error;
      return (data ?? []) as unknown as DuplicateRow[];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (vars: {
      row: DuplicateRow;
      status: string;
    }) => {
      const { error } = await supabase.rpc('review_exhibitor_duplicate', {
        p_a: vars.row.identity_a_id,
        p_b: vars.row.identity_b_id,
        p_status: vars.status,
        p_score: vars.row.score,
        p_confidence: vars.row.confidence,
        p_reasons: (vars.row.reasons ?? {}) as never,
      });
      if (error) throw error;
      return vars;
    },
    onSuccess: ({ row, status }) => {
      const hidden = !includeResolved && (status === 'distinct' || status === 'ignored');
      queryClient.setQueryData<DuplicateRow[]>(queryKey, (prev) => {
        if (!prev) return prev;
        if (hidden) {
          return prev.filter(
            (r) =>
              !(
                r.identity_a_id === row.identity_a_id &&
                r.identity_b_id === row.identity_b_id
              ),
          );
        }
        return prev.map((r) =>
          r.identity_a_id === row.identity_a_id && r.identity_b_id === row.identity_b_id
            ? { ...r, status, reviewed_at: new Date().toISOString() }
            : r,
        );
      });
      if (status === 'probable_duplicate') {
        toast({
          title: 'Doublon probable marqué',
          description: 'La fusion sera traitée dans une phase ultérieure.',
        });
      } else {
        toast({ title: `Statut mis à jour : ${STATUS_LABELS[status] ?? status}` });
      }
    },
    onError: (err: unknown) => {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Action impossible',
        variant: 'destructive',
      });
    },
  });

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (confidenceFilter !== 'all') {
      rows = rows.filter((r) => r.confidence === confidenceFilter);
    }
    if (statusFilter !== 'all') {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.a_name?.toLowerCase().includes(q) ||
          r.b_name?.toLowerCase().includes(q) ||
          r.a_slug?.toLowerCase().includes(q) ||
          r.b_slug?.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [data, confidenceFilter, statusFilter, search]);

  const counts = useMemo(() => {
    const rows = data ?? [];
    return {
      total: rows.length,
      high: rows.filter((r) => r.confidence === 'high').length,
      medium: rows.filter((r) => r.confidence === 'medium').length,
      low: rows.filter((r) => r.confidence === 'low').length,
    };
  }, [data]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setPage(1);
  }, [confidenceFilter, statusFilter, search, minScore, includeResolved]);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{counts.total} couples</Badge>
        <Badge variant="default">{counts.high} high</Badge>
        <Badge variant="secondary">{counts.medium} medium</Badge>
        <Badge variant="outline">{counts.low} low</Badge>
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

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1">
            <Label className="text-xs">Confiance</Label>
            <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Statut</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="review_required">À revoir</SelectItem>
                <SelectItem value="probable_duplicate">Doublon probable</SelectItem>
                <SelectItem value="distinct">Distinct</SelectItem>
                <SelectItem value="ignored">Ignoré</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Score minimum</Label>
            <Select
              value={String(minScore)}
              onValueChange={(v) => setMinScore(Number(v))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="40">40</SelectItem>
                <SelectItem value="60">60</SelectItem>
                <SelectItem value="80">80</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch
              id="include-resolved"
              checked={includeResolved}
              onCheckedChange={setIncludeResolved}
            />
            <Label htmlFor="include-resolved" className="text-xs">
              Inclure les résolus
            </Label>
          </div>
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label className="text-xs">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom ou slug…"
                className="pl-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* States */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 p-4 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>
              Impossible de charger les doublons.{' '}
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
            <ShieldQuestion className="h-8 w-8" />
            <p>Aucun doublon ne correspond aux filtres.</p>
          </CardContent>
        </Card>
      )}

      {/* Rows */}
      {!isLoading &&
        !isError &&
        pageRows.map((row) => {
          const key = `${row.identity_a_id}_${row.identity_b_id}`;
          const isPending =
            reviewMutation.isPending &&
            reviewMutation.variables?.row.identity_a_id === row.identity_a_id &&
            reviewMutation.variables?.row.identity_b_id === row.identity_b_id;
          const activeReasons = Object.entries(row.reasons ?? {})
            .filter(([, v]) => v)
            .map(([k]) => k);
          return (
            <Card key={key} className={isPending ? 'opacity-60' : undefined}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={confidenceBadgeVariant(row.confidence)}>
                    {row.confidence} · {row.score}
                  </Badge>
                  <Badge variant={statusBadgeVariant(row.status)}>
                    {STATUS_LABELS[row.status] ?? row.status}
                  </Badge>
                  {activeReasons.map((r) => (
                    <Badge key={r} variant="outline" className="text-[10px]">
                      {REASON_LABELS[r] ?? r}
                    </Badge>
                  ))}
                  {row.reviewed_at && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      Revu le {formatDate(row.reviewed_at)}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3 md:flex-row">
                  <IdentityCard
                    label="A"
                    name={row.a_name}
                    slug={row.a_slug}
                    source={row.a_source}
                    website={row.a_website}
                    linkedin={row.a_linkedin}
                    participations={row.a_participations}
                    future={row.a_future}
                    nextEvent={row.a_next_event}
                  />
                  <IdentityCard
                    label="B"
                    name={row.b_name}
                    slug={row.b_slug}
                    source={row.b_source}
                    website={row.b_website}
                    linkedin={row.b_linkedin}
                    participations={row.b_participations}
                    future={row.b_future}
                    nextEvent={row.b_next_event}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => reviewMutation.mutate({ row, status: 'review_required' })}
                  >
                    À revoir
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => reviewMutation.mutate({ row, status: 'distinct' })}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Distinct
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={isPending}
                    onClick={() => reviewMutation.mutate({ row, status: 'probable_duplicate' })}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Doublon probable
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => reviewMutation.mutate({ row, status: 'ignored' })}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Ignorer
                  </Button>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isPending}
                      onClick={() => setPreviewPair(row)}
                    >
                      <GitMerge className="h-4 w-4 mr-1" />
                      Prévisualiser fusion
                    </Button>
                    <Badge variant="outline" className="text-muted-foreground">
                      Fusion non disponible
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

      {/* Pagination */}
      {!isLoading && !isError && filtered.length > pageSize && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Précédent
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} / {totalPages} ({filtered.length} couples)
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Suivant
          </Button>
        </div>
      )}

      {previewPair && (
        <MergePreviewDialog
          open={!!previewPair}
          onOpenChange={(o) => !o && setPreviewPair(null)}
          aId={previewPair.identity_a_id}
          bId={previewPair.identity_b_id}
          aName={previewPair.a_name}
          bName={previewPair.b_name}
        />
      )}
    </div>
  );
};

export default AdminDuplicateReviews;