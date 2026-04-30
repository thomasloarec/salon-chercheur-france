import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, ExternalLink, Check, X } from 'lucide-react';
import {
  useEventDuplicates,
  useRebuildDuplicates,
  useResolveDuplicate,
  type DuplicateMatchLevel,
} from '@/hooks/useEventDuplicates';

const LEVEL_LABEL: Record<DuplicateMatchLevel, string> = {
  probable_duplicate: 'Doublon probable',
  potential_duplicate: 'Doublon potentiel',
  to_watch: 'À vérifier',
};

const LEVEL_TONE: Record<DuplicateMatchLevel, string> = {
  probable_duplicate: 'bg-destructive/10 text-destructive border-destructive/30',
  potential_duplicate: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200',
  to_watch: 'bg-muted text-muted-foreground border-border',
};

function formatDateRange(d?: string | null, f?: string | null) {
  if (!d && !f) return '—';
  if (d && f && d !== f) return `${d} → ${f}`;
  return d ?? f ?? '—';
}

function reasonsText(r: Record<string, unknown>): string {
  const parts: string[] = [];
  if (r.same_dates) parts.push('mêmes dates');
  if (r.same_url) parts.push('même URL officielle');
  else if (r.same_domain) parts.push('même domaine');
  if (typeof r.name_similarity === 'number' && (r.name_similarity as number) >= 0.5) {
    parts.push(`nom proche (${Math.round((r.name_similarity as number) * 100)}%)`);
  }
  if (r.same_city) parts.push('même ville');
  return parts.length ? parts.join(' · ') : 'signaux faibles';
}

export function DuplicateEventsPanel() {
  const { data, isLoading } = useEventDuplicates();
  const rebuild = useRebuildDuplicates();
  const resolve = useResolveDuplicate();

  const groups = data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Doublons potentiels détectés ({groups.length})
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => rebuild.mutate()}
            disabled={rebuild.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${rebuild.isPending ? 'animate-spin' : ''}`} />
            Recalculer
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        )}
        {!isLoading && groups.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucun doublon détecté pour le moment. Lancez un recalcul pour scanner la base.
          </p>
        )}
        {groups.map((group) => {
          const topRow = group.rows[0];
          const tone = LEVEL_TONE[topRow.match_level];
          return (
            <div
              key={`${group.source_kind}:${group.source_id}`}
              className={`rounded-lg border p-4 space-y-3 ${tone}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {group.source_kind === 'staging' ? 'Staging' : 'Events'}
                    </Badge>
                    <Badge className="text-xs">{LEVEL_LABEL[topRow.match_level]}</Badge>
                    <span className="text-xs">Score max&nbsp;: {topRow.score}</span>
                  </div>
                  <p className="text-xs mt-1 opacity-80">
                    Source ID&nbsp;: <code>{group.source_id.slice(0, 8)}…</code>
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {group.rows.map((row) => (
                  <div
                    key={row.id}
                    className="bg-background/60 backdrop-blur rounded-md border border-border/60 p-3 text-sm text-foreground"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {row.matched?.nom_event ?? '(événement introuvable)'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatDateRange(row.matched?.date_debut, row.matched?.date_fin)}
                          {row.matched?.ville ? ` · ${row.matched.ville}` : ''}
                          {' · '}
                          {row.matched?.visible ? 'Publié' : 'En attente / masqué'}
                        </div>
                        <div className="text-xs mt-1">
                          ⚠️ {reasonsText(row.reasons as Record<string, unknown>)} — score {row.score}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {row.matched?.slug && (
                          <Button asChild size="sm" variant="ghost">
                            <a
                              href={`/events/${row.matched.slug}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="h-3.5 w-3.5 mr-1" />
                              Voir
                            </a>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resolve.isPending}
                          onClick={() =>
                            resolve.mutate({
                              source_kind: row.source_kind,
                              source_id: row.source_id,
                              matched_kind: row.matched_kind,
                              matched_id: row.matched_id,
                              resolution: 'confirmed_distinct',
                            })
                          }
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Distinct
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={resolve.isPending}
                          onClick={() =>
                            resolve.mutate({
                              source_kind: row.source_kind,
                              source_id: row.source_id,
                              matched_kind: row.matched_kind,
                              matched_id: row.matched_id,
                              resolution: 'confirmed_duplicate',
                            })
                          }
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Doublon
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default DuplicateEventsPanel;