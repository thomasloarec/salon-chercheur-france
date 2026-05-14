import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Info,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

type RunRow = {
  id: string;
  created_at: string;
  metadata: any;
};

const SQL_TEMPLATE = `create extension if not exists pg_cron;
create extension if not exists pg_net;

-- À exécuter manuellement dans Supabase SQL Editor
-- après avoir stocké la SERVICE_ROLE_KEY dans Supabase Vault.
select cron.schedule(
  'radar-crm-rematch-daily',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/radar-crm-rematch-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SERVICE_ROLE_KEY')
    ),
    body := jsonb_build_object('dryRun', false, 'maxImports', 500)
  );
  $$
);`;

const fmt = (v: any) => (v === undefined || v === null ? '—' : String(v));

const RadarCrmCronStatus: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [openErrors, setOpenErrors] = useState<Record<string, boolean>>({});
  const [openCron, setOpenCron] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crm_usage_events')
      .select('id, created_at, metadata')
      .eq('event_type', 'radar_rematch_cron_completed')
      .order('created_at', { ascending: false })
      .limit(10);
    setRuns((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const lastRun = runs[0] ?? null;
  const lastRunDate = lastRun ? new Date(lastRun.created_at) : null;
  const ageHours = lastRunDate
    ? (Date.now() - lastRunDate.getTime()) / 36e5
    : null;

  // Cron heuristic: 3+ completed runs in last 7 days, evenly spread (>= 2 distinct days)
  const cronLikelyActive = (() => {
    if (runs.length < 3) return false;
    const recent = runs.filter(
      (r) => Date.now() - new Date(r.created_at).getTime() < 7 * 86400_000,
    );
    const days = new Set(
      recent.map((r) => new Date(r.created_at).toISOString().slice(0, 10)),
    );
    return recent.length >= 3 && days.size >= 2;
  })();

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(SQL_TEMPLATE);
      toast.success('Commande SQL copiée');
    } catch {
      toast.error('Copie impossible');
    }
  };

  return (
    <div className="space-y-4">
      {/* Block 1: Status */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">État du re-matching automatique</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Le re-matching continu permet de détecter automatiquement si les entreprises
              importées par les utilisateurs participent à de nouveaux événements ajoutés sur Lotexpo.
            </p>
          </div>
          <Badge variant={cronLikelyActive ? 'secondary' : 'outline'} className="shrink-0">
            {cronLikelyActive ? 'Cron potentiellement actif' : 'Cron non activé'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
            Quand de nouveaux exposants ou événements sont ajoutés sur Lotexpo, le re-matching
            compare à nouveau les entreprises CRM importées par les utilisateurs avec les
            participations disponibles. Si une nouvelle opportunité est détectée, l'utilisateur
            reçoit une notification Radar CRM.
          </div>

          {/* Last run summary */}
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : !lastRun ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              Aucun re-matching n'a encore été exécuté.
            </div>
          ) : (
            <div className="rounded-md border p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Dernier run</span>
                  <span className="text-sm text-muted-foreground">
                    {lastRunDate!.toLocaleString('fr-FR')}
                  </span>
                  <Badge variant={lastRun.metadata?.dryRun ? 'outline' : 'secondary'}>
                    {lastRun.metadata?.dryRun ? 'Dry-run' : 'Réel'}
                  </Badge>
                </div>
                {ageHours !== null && ageHours > 48 && (
                  <div className="flex items-center gap-1.5 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    Le re-matching n'a pas été exécuté depuis plus de 48h.
                  </div>
                )}
                {ageHours !== null && ageHours > 24 && ageHours <= 48 && (
                  <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-500">
                    <AlertCircle className="h-4 w-4" />
                    Aucun re-matching récent détecté.
                  </div>
                )}
                {ageHours !== null && ageHours <= 24 && (
                  <div className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-500">
                    <CheckCircle2 className="h-4 w-4" />
                    Run récent
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                <Stat label="importsProcessed" value={lastRun.metadata?.importsProcessed} />
                <Stat label="newMatchesCreated" value={lastRun.metadata?.newMatchesCreated} />
                <Stat label="futureNewMatches" value={lastRun.metadata?.futureNewMatches} />
                <Stat label="notificationsCreated" value={lastRun.metadata?.notificationsCreated} />
                <Stat label="notificationsUpdated" value={lastRun.metadata?.notificationsUpdated} />
                <Stat
                  label="reconciliationCandidatesFound"
                  value={lastRun.metadata?.reconciliationCandidatesFound}
                />
                <Stat
                  label="reconciliationGroupsFound"
                  value={lastRun.metadata?.reconciliationGroupsFound}
                />
                <Stat
                  label="missingNotificationsCreated"
                  value={lastRun.metadata?.missingNotificationsCreated}
                />
                <Stat
                  label="missingNotificationsSkippedExisting"
                  value={lastRun.metadata?.missingNotificationsSkippedExisting}
                />
                <Stat
                  label="missingNotificationsSkippedPreferences"
                  value={lastRun.metadata?.missingNotificationsSkippedPreferences}
                />
                <Stat
                  label="errors"
                  value={
                    Array.isArray(lastRun.metadata?.errors)
                      ? lastRun.metadata.errors.length
                      : 0
                  }
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Block 3: history */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">10 derniers runs Radar CRM</CardTitle>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Imports analysés</th>
                <th className="text-left p-2">Nouveaux matches</th>
                <th className="text-left p-2">Notif. créées</th>
                <th className="text-left p-2">Notif. réparées</th>
                <th className="text-left p-2">Notif. déjà existantes</th>
                <th className="text-left p-2">Erreurs</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="p-2 text-muted-foreground">
                    Aucun run enregistré.
                  </td>
                </tr>
              )}
              {runs.map((r) => {
                const m = r.metadata ?? {};
                const errors = Array.isArray(m.errors) ? m.errors : [];
                const isOpen = !!openErrors[r.id];
                return (
                  <React.Fragment key={r.id}>
                    <tr className="border-t">
                      <td className="p-2 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString('fr-FR')}
                      </td>
                      <td className="p-2">
                        <Badge variant={m.dryRun ? 'outline' : 'secondary'} className="text-xs">
                          {m.dryRun ? 'Dry-run' : 'Réel'}
                        </Badge>
                      </td>
                      <td className="p-2">{fmt(m.importsProcessed)}</td>
                      <td className="p-2">
                        {fmt(m.newMatchesCreated ?? m.estimatedNewMatches)}
                      </td>
                      <td className="p-2">{fmt(m.notificationsCreated)}</td>
                      <td className="p-2">{fmt(m.missingNotificationsCreated)}</td>
                      <td className="p-2">{fmt(m.missingNotificationsSkippedExisting)}</td>
                      <td className="p-2">
                        {errors.length > 0 ? (
                          <button
                            className="text-destructive underline-offset-2 hover:underline"
                            onClick={() =>
                              setOpenErrors((s) => ({ ...s, [r.id]: !s[r.id] }))
                            }
                          >
                            {errors.length} {isOpen ? '▴' : '▾'}
                          </button>
                        ) : (
                          0
                        )}
                      </td>
                    </tr>
                    {isOpen && errors.length > 0 && (
                      <tr className="border-t bg-muted/30">
                        <td colSpan={8} className="p-2">
                          <pre className="text-xs bg-background p-2 rounded border max-h-64 overflow-auto">
                            {JSON.stringify(errors, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Block 6: business recommendation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            Quand lancer le re-matching ?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Lancez un re-matching après chaque import important de nouveaux événements ou
            exposants. À terme, le cron quotidien permettra d'automatiser cette vérification.
          </p>
          <p>
            En phase Beta, il est recommandé de surveiller les premiers runs pour vérifier que
            les notifications générées sont pertinentes.
          </p>
        </CardContent>
      </Card>

      {/* Block 5: cron preparation */}
      <Card>
        <Collapsible open={openCron} onOpenChange={setOpenCron}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left"
            >
              <div>
                <p className="text-base font-semibold">Activation future du cron quotidien</p>
                <p className="text-sm text-muted-foreground">
                  Procédure recommandée pour automatiser le re-matching.
                </p>
              </div>
              {openCron ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Une fois les tests manuels validés, vous pourrez activer un cron quotidien
                pour lancer automatiquement le re-matching Radar CRM.
              </p>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={copySql}>
                  <Copy className="h-4 w-4" />
                  Copier la commande SQL
                </Button>
              </div>
              <pre className="text-xs bg-muted p-3 rounded border max-h-96 overflow-auto whitespace-pre">
                {SQL_TEMPLATE}
              </pre>
              <p className="text-xs text-muted-foreground">
                La SERVICE_ROLE_KEY n'est jamais exposée côté frontend : la commande la lit
                depuis Supabase Vault au moment de l'exécution.
              </p>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: any }> = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-lg font-semibold">{fmt(value)}</span>
  </div>
);

export default RadarCrmCronStatus;