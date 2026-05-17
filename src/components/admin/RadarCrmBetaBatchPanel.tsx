import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Info, Activity, Eye } from 'lucide-react';

type BatchPreview = {
  success?: boolean;
  usersScanned?: number;
  usersEligible?: number;
  emailsWouldSend?: number;
  notificationsIncluded?: number;
  skippedUsersPreferences?: number;
  skippedUsersQuota?: number;
  skippedNotificationsAlreadyEmailed?: number;
  error?: string;
};

type UsageEvent = {
  id: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const RadarCrmBetaBatchPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<BatchPreview | null>(null);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);

  const loadHistory = async () => {
    const { data: usageRows } = await supabase
      .from('crm_usage_events')
      .select('id, event_type, metadata, created_at')
      .in('event_type', [
        'radar_email_dispatch_started',
        'radar_email_dispatch_completed',
        'radar_email_sent',
        'radar_email_failed',
      ])
      .order('created_at', { ascending: false })
      .limit(20);
    setEvents((usageRows ?? []) as UsageEvent[]);

    const { count } = await supabase
      .from('crm_notification_preferences')
      .select('user_id', { count: 'exact', head: true })
      .eq('radar_email_enabled', true)
      .is('radar_email_unsubscribed_at', null);
    setEligibleCount(count ?? 0);
  };

  useEffect(() => { loadHistory(); }, []);

  const runPreview = async () => {
    setLoading(true);
    setPreview(null);
    try {
      const { data, error } = await supabase.functions.invoke('radar-crm-email-dispatcher', {
        body: { dryRun: true, sendReal: false, maxUsers: 100 },
      });
      if (error) throw error;
      setPreview(data as BatchPreview);
      toast.success(`Batch preview — ${(data as BatchPreview).emailsWouldSend ?? 0} emails simulés`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
      setPreview({ error: msg });
    } finally {
      setLoading(false);
      loadHistory();
    }
  };

  const lastCompleted = events.find((e) => e.event_type === 'radar_email_dispatch_completed');
  const cronActive = Boolean(
    lastCompleted &&
    Date.now() - new Date(lastCompleted.created_at).getTime() < 36 * 60 * 60 * 1000 &&
    (lastCompleted.metadata as any)?.dispatcher_source === 'cron',
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" /> Envoi automatique Beta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Les emails automatiques ne sont envoyés qu'aux utilisateurs ayant activé
            <code className="mx-1">radar_email_enabled</code>. L'envoi batch réel est
            réservé au <strong>service_role</strong> (cron) — aucun bouton admin ne déclenche
            d'envoi global.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={cronActive ? 'default' : 'outline'}>
            Cron : {cronActive ? 'actif' : 'non actif'}
          </Badge>
          <Badge variant="secondary">
            Utilisateurs éligibles : {eligibleCount ?? '—'}
          </Badge>
          <div className="ml-auto">
            <Button onClick={runPreview} disabled={loading} variant="outline">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
              Prévisualiser le batch email Beta
            </Button>
          </div>
        </div>

        {preview && (
          <div className="rounded-md border p-3 text-sm space-y-1">
            {preview.error ? (
              <div className="text-destructive">{preview.error}</div>
            ) : (
              <>
                <div>Users analysés : <strong>{preview.usersScanned ?? 0}</strong></div>
                <div>Users éligibles : <strong>{preview.usersEligible ?? 0}</strong></div>
                <div>Emails qui seraient envoyés : <strong>{preview.emailsWouldSend ?? 0}</strong></div>
                <div className="text-xs text-muted-foreground">
                  Notifications incluses : {preview.notificationsIncluded ?? 0} ·
                  Quota : {preview.skippedUsersQuota ?? 0} ·
                  Déjà emailées : {preview.skippedNotificationsAlreadyEmailed ?? 0}
                </div>
              </>
            )}
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold mb-2">Historique des runs</h4>
          {events.length === 0 ? (
            <div className="text-xs text-muted-foreground">Aucun run enregistré.</div>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {events.map((ev) => {
                const meta = (ev.metadata ?? {}) as Record<string, unknown>;
                return (
                  <div key={ev.id} className="text-xs border-b py-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="text-muted-foreground">{new Date(ev.created_at).toLocaleString('fr-FR')}</span>
                    <span className="font-mono">{ev.event_type}</span>
                    {meta.mode ? <span>mode={String(meta.mode)}</span> : null}
                    {meta.dispatcher_source ? <span>src={String(meta.dispatcher_source)}</span> : null}
                    {meta.emailsSent !== undefined ? <span>sent={String(meta.emailsSent)}</span> : null}
                    {meta.usersEligible !== undefined ? <span>eligible={String(meta.usersEligible)}</span> : null}
                    {meta.emailsFailed !== undefined && Number(meta.emailsFailed) > 0 ? (
                      <span className="text-destructive">failed={String(meta.emailsFailed)}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RadarCrmBetaBatchPanel;