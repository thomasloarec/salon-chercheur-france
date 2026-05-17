import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, Mail, Info, ChevronDown, ChevronUp } from 'lucide-react';

type Preview = {
  userId: string;
  emailTo: string | null;
  subject: string;
  eventsCount: number;
  companiesCount: number;
  notifications: Array<{
    notificationId: string;
    notificationIds?: string[];
    mergedNotificationsCount?: number;
    importIds?: string[];
    eventId: string;
    eventName: string | null;
    eventDate: string | null;
    eventCity: string | null;
    eventVenue: string | null;
    eventSlug: string | null;
    companies: Array<{ crmCompanyId: string | null; companyName: string | null; stand: string | null }>;
  }>;
};

type Result = {
  success?: boolean;
  dryRun?: boolean;
  usersScanned?: number;
  usersEligible?: number;
  emailsWouldSend?: number;
  notificationsIncluded?: number;
  skippedUsersPreferences?: number;
  skippedUsersQuota?: number;
  skippedNotificationsAlreadyEmailed?: number;
  previews?: Preview[];
  errors?: Array<{ userId: string; message: string }>;
  error?: string;
};

const RadarCrmEmailPreviewPanel: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [maxUsers, setMaxUsers] = useState('50');
  const [lookaheadDays, setLookaheadDays] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const payload: Record<string, unknown> = {
        dryRun: true,
        maxUsers: Number(maxUsers) || 50,
      };
      if (userId.trim()) payload.userId = userId.trim();
      if (lookaheadDays.trim()) payload.lookaheadDays = Number(lookaheadDays);

      const { data, error } = await supabase.functions.invoke('radar-crm-email-dispatcher', {
        body: payload,
      });
      if (error) throw error;
      const res = data as Result;
      setResult(res);
      if (res?.success) {
        toast.success(`Prévisualisation terminée — ${res.emailsWouldSend ?? 0} emails simulés`);
      } else {
        toast.error(res?.error ?? 'Échec de la prévisualisation');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
      setResult({ success: false, error: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" /> Emails Radar CRM — Prévisualisation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Cette section prévisualise les emails Radar CRM <strong>sans les envoyer</strong>.
            Les envois réels via Resend seront activés plus tard en Beta.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="rcep-user" className="text-xs">User ID (optionnel)</Label>
            <Input
              id="rcep-user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="UUID utilisateur"
              className="mt-1"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced((s) => !s)}
            className="gap-1"
          >
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Options avancées
          </Button>
          <Button onClick={run} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            Prévisualiser les emails Radar CRM
          </Button>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-md bg-muted/40">
            <div>
              <Label htmlFor="rcep-max" className="text-xs">Max users</Label>
              <Input id="rcep-max" value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="rcep-look" className="text-xs">Lookahead days (optionnel)</Label>
              <Input
                id="rcep-look"
                value={lookaheadDays}
                onChange={(e) => setLookaheadDays(e.target.value)}
                placeholder="Par défaut : préférence utilisateur (14j)"
                className="mt-1"
              />
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            {result.error && (
              <Alert variant="destructive">
                <AlertDescription>{result.error}</AlertDescription>
              </Alert>
            )}
            {result.success && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <Stat label="Users analysés" value={result.usersScanned ?? 0} />
                  <Stat label="Users éligibles" value={result.usersEligible ?? 0} />
                  <Stat label="Emails simulés" value={result.emailsWouldSend ?? 0} highlight />
                  <Stat label="Notifications incluses" value={result.notificationsIncluded ?? 0} />
                  <Stat label="Ignorés (préférences)" value={result.skippedUsersPreferences ?? 0} />
                  <Stat label="Ignorés (quota)" value={result.skippedUsersQuota ?? 0} />
                  <Stat label="Notifs déjà emailées" value={result.skippedNotificationsAlreadyEmailed ?? 0} />
                  <Stat label="Erreurs" value={result.errors?.length ?? 0} />
                </div>

                {(result.previews ?? []).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Aperçus des emails</h4>
                    {result.previews!.map((p, i) => (
                      <div key={i} className="border rounded-md p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm">
                            <div className="font-medium">{p.emailTo ?? '—'}</div>
                            <div className="text-muted-foreground text-xs">User: {p.userId}</div>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="secondary">{p.eventsCount} salons</Badge>
                            <Badge variant="secondary">{p.companiesCount} entreprises</Badge>
                          </div>
                        </div>
                        <div className="text-sm"><span className="text-muted-foreground">Sujet :</span> {p.subject}</div>
                        <ul className="text-xs space-y-1 pl-3 border-l">
                          {p.notifications.map((n) => (
                            <li key={n.notificationId}>
                              <div className="font-medium">{n.eventName ?? '—'}</div>
                              <div className="text-muted-foreground">
                                {n.eventDate ? new Date(n.eventDate).toLocaleDateString('fr-FR') : '—'} ·{' '}
                                {n.eventCity ?? '—'}
                                {n.eventSlug && (
                                  <> · <a className="underline" href={`/radar-crm/results?eventId=${n.eventId}`} target="_blank" rel="noreferrer">Voir Radar</a></>
                                )}
                                {n.mergedNotificationsCount && n.mergedNotificationsCount > 1 && (
                                  <> · <span className="italic">{n.mergedNotificationsCount} notifications regroupées</span></>
                                )}
                              </div>
                              {n.companies.length > 0 && (
                                <div className="text-muted-foreground">
                                  Entreprises ({n.companies.length}) : {n.companies.map((c) => c.companyName).filter(Boolean).join(', ') || '—'}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {(result.errors ?? []).length > 0 && (
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm text-destructive">Erreurs</h4>
                    {result.errors!.map((e, i) => (
                      <div key={i} className="text-xs text-destructive">{e.userId}: {e.message}</div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Stat: React.FC<{ label: string; value: number; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={`rounded-md border p-2 ${highlight ? 'bg-primary/5 border-primary/30' : ''}`}>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-lg font-bold">{value}</div>
  </div>
);

export default RadarCrmEmailPreviewPanel;