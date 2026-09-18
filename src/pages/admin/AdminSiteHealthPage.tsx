import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
  useSiteHealth,
  summarizeHealth,
  categoryLabel,
  STATUS_ORDER,
  type SiteHealthCheck,
} from '@/hooks/useSiteHealth';

const statusDot = (status: SiteHealthCheck['status']) => {
  if (status === 'critical') return <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-600" aria-hidden="true" />;
  if (status === 'warn') return <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />;
  return <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-green-600" aria-hidden="true" />;
};

const HealthRow = ({ check }: { check: SiteHealthCheck }) => (
  <div className="flex items-start gap-3 py-3 border-b last:border-b-0 border-border/60">
    {statusDot(check.status)}
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold leading-tight">{check.label}</p>
      {check.detail && (
        <p className="text-sm text-muted-foreground mt-0.5">{check.detail}</p>
      )}
    </div>
    {check.metric != null && (
      <span className="text-sm font-medium text-muted-foreground tabular-nums shrink-0 ml-2">
        {typeof check.metric === 'number' ? check.metric.toLocaleString('fr-FR') : String(check.metric)}
      </span>
    )}
  </div>
);

const AdminSiteHealthPage = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useSiteHealth();

  // Rafraîchissement automatique à l'ouverture de l'onglet
  useEffect(() => {
    refetch();
  }, [refetch]);

  const summary = summarizeHealth(data);
  const lastUpdated = data?.length ?? 0;

  const groups = React.useMemo(() => {
    const map = new Map<string, SiteHealthCheck[]>();
    for (const check of data ?? []) {
      const key = check.category || 'divers';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(check);
    }
    return Array.from(map.entries())
      .map(([category, checks]) => ({
        category,
        checks: [...checks].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
        worst: Math.min(...checks.map((c) => STATUS_ORDER[c.status])),
      }))
      .sort((a, b) => a.worst - b.worst || a.category.localeCompare(b.category));
  }, [data]);

  const handleRefresh = async () => {
    try {
      await refetch();
   } catch {
      toast({ title: 'Impossible de rafraîchir les contrôles', variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Santé du site</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Contrôles automatiques de l'état de Lotexpo · {lastUpdated} contrôle{lastUpdated > 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Rafraîchir
        </Button>
      </div>

      {summary.level === 'critical' && (
        <p className="text-sm text-destructive font-medium">
          {summary.critical} problème{summary.critical > 1 ? 's' : ''} critique{summary.critical > 1 ? 's' : ''} à traiter en priorité.
        </p>
      )}
      {summary.level === 'warn' && (
        <p className="text-sm text-warning font-medium">
          {summary.warn} alerte{summary.warn > 1 ? 's' : ''} à surveiller.
        </p>
      )}
      {summary.level === 'ok' && !isLoading && (
        <p className="text-sm text-green-700 font-medium">Tous les contrôles sont au vert.</p>
      )}

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            Impossible de charger les contrôles{(error as Error)?.message ? ` : ${(error as Error).message}` : ''}.
          </CardContent>
        </Card>
      )}

      {groups.map((group) => (
        <Card key={group.category}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{categoryLabel(group.category)}</CardTitle>
          </CardHeader>
          <CardContent>
            {group.checks.map((check) => (
              <HealthRow key={check.check_key} check={check} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AdminSiteHealthPage;
