import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Play, FlaskConical, RefreshCw } from 'lucide-react';

type RematchResult = {
  success?: boolean;
  dryRun?: boolean;
  importsProcessed?: number;
  estimatedNewMatches?: number;
  estimatedFutureNewMatches?: number;
  estimatedNotifications?: number;
  newMatchesCreated?: number;
  futureNewMatches?: number;
  notificationsCreated?: number;
  notificationsUpdated?: number;
  skippedNotificationsPreferences?: number;
  errors?: Array<{ importId: string; userId: string; message: string }>;
  error?: string;
};

type RunHistoryRow = {
  id: string;
  event_type: string;
  created_at: string;
  metadata: any;
};

const RadarCrmRematchPanel: React.FC = () => {
  const [maxImports, setMaxImports] = useState<string>('50');
  const [userId, setUserId] = useState('');
  const [importId, setImportId] = useState('');
  const [loading, setLoading] = useState<'dry' | 'real' | null>(null);
  const [result, setResult] = useState<RematchResult | null>(null);
  const [resultMode, setResultMode] = useState<'dry' | 'real' | null>(null);
  const [history, setHistory] = useState<RunHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    const { data } = await supabase
      .from('crm_usage_events')
      .select('id, event_type, created_at, metadata')
      .in('event_type', [
        'radar_rematch_cron_started',
        'radar_rematch_cron_completed',
        'radar_rematch_new_matches_detected',
        'radar_notification_created',
      ])
      .order('created_at', { ascending: false })
      .limit(20);
    setHistory((data as any[]) ?? []);
    setHistoryLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const invoke = async (dryRun: boolean) => {
    setLoading(dryRun ? 'dry' : 'real');
    setResult(null);
    try {
      const payload: Record<string, unknown> = {
        dryRun,
        maxImports: Number(maxImports) || 50,
      };
      if (userId.trim()) payload.userId = userId.trim();
      if (importId.trim()) payload.importId = importId.trim();

      const { data, error } = await supabase.functions.invoke('radar-crm-rematch-cron', {
        body: payload,
      });
      if (error) throw error;
      setResult(data as RematchResult);
      setResultMode(dryRun ? 'dry' : 'real');
      if ((data as RematchResult)?.success) {
        toast.success(dryRun ? 'Dry-run terminé' : 'Re-matching terminé');
      } else {
        toast.error('Échec du re-matching');
      }
      await loadHistory();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      toast.error(`Erreur: ${msg}`);
      setResult({ success: false, error: msg });
      setResultMode(dryRun ? 'dry' : 'real');
    } finally {
      setLoading(null);
    }
  };

  const handleRealRun = () => {
    const ok = window.confirm(
      `Lancer le re-matching réel sur ${maxImports} import(s) ?\n\nCela écrira de nouveaux matches et notifications en base.`,
    );
    if (ok) invoke(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Re-matching continu Radar CRM</CardTitle>
          <p className="text-sm text-muted-foreground">
            Relance le matching sur les imports CRM existants pour détecter les nouvelles
            opportunités créées par les nouveaux exposants ou événements ajoutés à Lotexpo.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">maxImports</Label>
              <Select value={maxImports} onValueChange={setMaxImports}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Accordion type="single" collapsible>
            <AccordionItem value="advanced">
              <AccordionTrigger className="text-sm">Options avancées (debug)</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div>
                    <Label className="text-xs">userId (filtre)</Label>
                    <Input
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      placeholder="uuid utilisateur"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">importId (filtre)</Label>
                    <Input
                      value={importId}
                      onChange={(e) => setImportId(e.target.value)}
                      placeholder="uuid import"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => invoke(true)} disabled={loading !== null}>
              {loading === 'dry' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="h-4 w-4" />
              )}
              Lancer un dry-run
            </Button>
            <Button
              variant="destructive"
              onClick={handleRealRun}
              disabled={loading !== null}
            >
              {loading === 'real' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Lancer le re-matching réel
            </Button>
          </div>

          {result && (
            <div className="rounded-md border p-4 bg-muted/30 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={result.success ? 'secondary' : 'destructive'}>
                  {resultMode === 'dry' ? 'Dry-run' : 'Run réel'}
                </Badge>
                {result.success ? (
                  <span className="text-sm text-muted-foreground">Terminé avec succès</span>
                ) : (
                  <span className="text-sm text-destructive">{result.error ?? 'Échec'}</span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Stat label="importsProcessed" value={result.importsProcessed} />
                {resultMode === 'dry' ? (
                  <>
                    <Stat label="estimatedNewMatches" value={result.estimatedNewMatches} />
                    <Stat
                      label="estimatedFutureNewMatches"
                      value={result.estimatedFutureNewMatches}
                    />
                    <Stat
                      label="estimatedNotifications"
                      value={result.estimatedNotifications}
                    />
                  </>
                ) : (
                  <>
                    <Stat label="newMatchesCreated" value={result.newMatchesCreated} />
                    <Stat label="futureNewMatches" value={result.futureNewMatches} />
                    <Stat label="notificationsCreated" value={result.notificationsCreated} />
                    <Stat label="notificationsUpdated" value={result.notificationsUpdated} />
                    <Stat
                      label="skippedNotificationsPreferences"
                      value={result.skippedNotificationsPreferences}
                    />
                  </>
                )}
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-semibold text-destructive mb-1">
                    Erreurs ({result.errors.length})
                  </p>
                  <pre className="text-xs bg-background p-2 rounded border max-h-48 overflow-auto">
                    {JSON.stringify(result.errors, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Derniers runs Radar CRM</CardTitle>
          <Button size="sm" variant="ghost" onClick={loadHistory} disabled={historyLoading}>
            <RefreshCw className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Imports</th>
                <th className="text-left p-2">New matches</th>
                <th className="text-left p-2">Notif. créées</th>
                <th className="text-left p-2">Notif. MAJ</th>
                <th className="text-left p-2">Erreurs</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td className="p-2 text-muted-foreground" colSpan={7}>
                    Aucun run enregistré.
                  </td>
                </tr>
              )}
              {history.map((row) => {
                const m = row.metadata ?? {};
                return (
                  <tr key={row.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString('fr-FR')}
                    </td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-xs">
                        {row.event_type.replace('radar_', '')}
                      </Badge>
                    </td>
                    <td className="p-2">{m.importsProcessed ?? '—'}</td>
                    <td className="p-2">
                      {m.newMatchesCreated ?? m.estimatedNewMatches ?? m.futureNewMatches ?? '—'}
                    </td>
                    <td className="p-2">{m.notificationsCreated ?? '—'}</td>
                    <td className="p-2">{m.notificationsUpdated ?? '—'}</td>
                    <td className="p-2">
                      {Array.isArray(m.errors) ? m.errors.length : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number | undefined }> = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-lg font-semibold">{value ?? 0}</span>
  </div>
);

export default RadarCrmRematchPanel;