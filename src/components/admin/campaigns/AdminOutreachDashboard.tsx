
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, CheckCircle2, XCircle, Clock, AlertTriangle, ArrowRight, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ── Types ──
interface CampaignRow {
  id: string;
  event_id: string;
  company_name: string | null;
  website: string | null;
  campaign_status: string | null;
  hunter_status: string | null;
  current_step: number | null;
  next_send_at: string | null;
  last_sent_at: string | null;
  opt_out: boolean | null;
  claude_classification: string | null;
  created_at: string | null;
}

interface EventRow {
  id: string;
  nom_event: string;
  date_debut: string | null;
}

interface ContactRow {
  outreach_campaign_id: string;
  contact_email: string;
  is_primary: boolean;
}

// ── Hook ──
function useOutreachData() {
  return useQuery({
    queryKey: ['admin-outreach-dashboard'],
    queryFn: async () => {
      const [campaignsRes, eventsRes, contactsRes] = await Promise.all([
        supabase.from('outreach_campaigns').select('id, event_id, company_name, website, campaign_status, hunter_status, current_step, next_send_at, last_sent_at, opt_out, claude_classification, created_at'),
        supabase.from('events').select('id, nom_event, date_debut').in('id', []),
        supabase.from('outreach_contacts').select('outreach_campaign_id, contact_email, is_primary').eq('is_primary', true),
      ]);

      // Get campaigns first, then fetch relevant events
      const campaigns = (campaignsRes.data ?? []) as CampaignRow[];
      const eventIds = [...new Set(campaigns.map(c => c.event_id))];

      const { data: events } = await supabase
        .from('events')
        .select('id, nom_event, date_debut')
        .in('id', eventIds);

      const contacts = (contactsRes.data ?? []) as ContactRow[];

      return { campaigns, events: (events ?? []) as EventRow[], contacts };
    },
    staleTime: 30_000,
  });
}

// ── KPI Card ──
function KpiCard({ label, value, icon: Icon, color = 'text-foreground' }: { label: string; value: string | number; icon: React.ElementType; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
          <Icon className={`h-8 w-8 opacity-20`} />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Urgency badge ──
function UrgencyBadge({ nextSendAt }: { nextSendAt: string | null }) {
  if (!nextSendAt) return <Badge variant="outline">Non planifié</Badge>;
  const diff = (new Date(nextSendAt).getTime() - Date.now()) / (1000 * 60 * 60);
  if (diff <= 0) return <Badge variant="destructive">À envoyer maintenant</Badge>;
  if (diff <= 24) return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Aujourd'hui</Badge>;
  if (diff <= 72) return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Dans 3 jours</Badge>;
  return <Badge variant="secondary">Plus tard</Badge>;
}

// ── Main Dashboard ──
export default function AdminOutreachDashboard() {
  const { data, isLoading, error, dataUpdatedAt } = useOutreachData();
  const queryClient = useQueryClient();
  const [excludingId, setExcludingId] = useState<string | null>(null);

  const excludeMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      setExcludingId(campaignId);
      const { error } = await supabase
        .from('outreach_campaigns' as any)
        .update({ opt_out: true, campaign_status: 'opted_out', stop_reason: 'Exclu manuellement (admin)' } as any)
        .eq('id', campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Campagne exclue');
      queryClient.invalidateQueries({ queryKey: ['admin-outreach-dashboard'] });
      setExcludingId(null);
    },
    onError: () => {
      toast.error("Erreur lors de l'exclusion");
      setExcludingId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" />
        <p className="text-destructive">Erreur lors du chargement des données campagnes.</p>
      </div>
    );
  }

  const { campaigns, events, contacts } = data;
  const eventsMap = Object.fromEntries(events.map(e => [e.id, e]));
  const contactsMap = Object.fromEntries(contacts.map(c => [c.outreach_campaign_id, c.contact_email]));

  // ── KPIs ──
  const total = campaigns.length;
  const sent = campaigns.filter(c => (c.current_step ?? 0) > 0).length;
  const converted = campaigns.filter(c => c.campaign_status === 'converted').length;
  const conversionRate = sent > 0 ? Math.round((converted / sent) * 100) : 0;
  const active = campaigns.filter(c => ['active', 'not_started'].includes(c.campaign_status ?? '') && c.hunter_status === 'ready').length;
  const excluded = campaigns.filter(c => c.hunter_status === 'excluded' || c.opt_out).length;

  // ── Per event ──
  const eventIds = [...new Set(campaigns.map(c => c.event_id))];
  const perEvent = eventIds.map(eid => {
    const ec = campaigns.filter(c => c.event_id === eid);
    const ev = eventsMap[eid];
    const ecSent = ec.filter(c => (c.current_step ?? 0) > 0).length;
    const ecConverted = ec.filter(c => c.campaign_status === 'converted').length;
    return {
      eventId: eid,
      name: ev?.nom_event ?? 'Inconnu',
      date: ev?.date_debut,
      total: ec.length,
      ready: ec.filter(c => c.hunter_status === 'ready').length,
      sent: ecSent,
      converted: ecConverted,
      excluded: ec.filter(c => c.hunter_status === 'excluded' || c.opt_out).length,
      rate: ecSent > 0 ? Math.round((ecConverted / ecSent) * 100) : 0,
    };
  }).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  // ── Pipeline (campaigns that are ready and not yet completed) ──
  const pipeline = campaigns
    .filter(c => c.hunter_status === 'ready' && !['converted', 'opted_out', 'completed'].includes(c.campaign_status ?? '') && !c.opt_out)
    .sort((a, b) => {
      const at = a.next_send_at ? new Date(a.next_send_at).getTime() : Infinity;
      const bt = b.next_send_at ? new Date(b.next_send_at).getTime() : Infinity;
      return at - bt;
    })
    .slice(0, 30);

  // ── Funnel ──
  const funnel = [
    { label: 'Importées', count: total, color: 'bg-muted' },
    { label: 'Enrichies (Hunter)', count: campaigns.filter(c => c.hunter_status === 'ready').length, color: 'bg-blue-100' },
    { label: 'Éligibles (PME/Incertain)', count: campaigns.filter(c => c.hunter_status === 'ready' && ['PME', 'INCERTAIN'].includes(c.claude_classification ?? '')).length, color: 'bg-indigo-100' },
    { label: 'Envoyées (step>0)', count: sent, color: 'bg-amber-100' },
    { label: 'Converties', count: converted, color: 'bg-green-100' },
  ];
  const maxFunnel = Math.max(...funnel.map(f => f.count), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campagnes exposants</h1>
          <p className="text-sm text-muted-foreground">
            Suivi de la prospection automatisée
            {dataUpdatedAt && (
              <span> · MàJ {format(new Date(dataUpdatedAt), "HH:mm", { locale: fr })}</span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-outreach-dashboard'] })}>
          Actualiser
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total campagnes" value={total} icon={Mail} />
        <KpiCard label="Emails envoyés" value={sent} icon={Mail} color="text-blue-600" />
        <KpiCard label="Conversions" value={converted} icon={CheckCircle2} color="text-green-600" />
        <KpiCard label="Taux conversion" value={`${conversionRate}%`} icon={ArrowRight} color={conversionRate > 0 ? 'text-green-600' : 'text-muted-foreground'} />
        <KpiCard label="Prêtes à envoyer" value={active} icon={Clock} color="text-amber-600" />
        <KpiCard label="Exclues" value={excluded} icon={XCircle} color="text-destructive" />
      </div>

      {/* Per event table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Par salon</CardTitle>
        </CardHeader>
        <CardContent>
          {perEvent.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun salon avec campagne.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Salon</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium text-center">Total</th>
                    <th className="pb-2 font-medium text-center">Prêtes</th>
                    <th className="pb-2 font-medium text-center">Envoyées</th>
                    <th className="pb-2 font-medium text-center">Converties</th>
                    <th className="pb-2 font-medium text-center">Exclues</th>
                    <th className="pb-2 font-medium text-center">Taux</th>
                  </tr>
                </thead>
                <tbody>
                  {perEvent.map(row => (
                    <tr key={row.eventId} className="border-b last:border-0">
                      <td className="py-2 font-medium">{row.name}</td>
                      <td className="py-2 text-muted-foreground">
                        {row.date ? format(new Date(row.date), 'dd MMM yyyy', { locale: fr }) : '–'}
                      </td>
                      <td className="py-2 text-center">{row.total}</td>
                      <td className="py-2 text-center">{row.ready}</td>
                      <td className="py-2 text-center">{row.sent}</td>
                      <td className="py-2 text-center font-medium text-green-600">{row.converted}</td>
                      <td className="py-2 text-center text-destructive">{row.excluded}</td>
                      <td className="py-2 text-center">{row.rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funnel de conversion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {funnel.map((step, i) => (
              <div key={step.label} className="flex items-center gap-3">
                <span className="w-40 text-sm text-muted-foreground shrink-0">{step.label}</span>
                <div className="flex-1 h-7 rounded overflow-hidden bg-muted/30">
                  <div
                    className={`h-full ${step.color} rounded flex items-center px-2 text-xs font-medium transition-all`}
                    style={{ width: `${Math.max((step.count / maxFunnel) * 100, 2)}%` }}
                  >
                    {step.count}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline — Prochaines relances</CardTitle>
        </CardHeader>
        <CardContent>
          {pipeline.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune relance en attente.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Entreprise</th>
                    <th className="pb-2 font-medium">Salon</th>
                    <th className="pb-2 font-medium text-center">Étape</th>
                    <th className="pb-2 font-medium">Contact</th>
                    <th className="pb-2 font-medium">Urgence</th>
                    <th className="pb-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pipeline.map(c => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2 font-medium max-w-[200px] truncate">{c.company_name ?? '–'}</td>
                      <td className="py-2 text-muted-foreground max-w-[160px] truncate">
                        {eventsMap[c.event_id]?.nom_event ?? '–'}
                      </td>
                      <td className="py-2 text-center">
                        <Badge variant="outline">{c.current_step ?? 0}/3</Badge>
                      </td>
                      <td className="py-2 text-muted-foreground text-xs max-w-[180px] truncate">
                        {contactsMap[c.id] ?? '–'}
                      </td>
                      <td className="py-2">
                        <UrgencyBadge nextSendAt={c.next_send_at} />
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={excludingId === c.id}
                          onClick={() => {
                            if (confirm(`Exclure ${c.company_name ?? 'cette entreprise'} ?`)) {
                              excludeMutation.mutate(c.id);
                            }
                          }}
                        >
                          {excludingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3 mr-1" />}
                          Exclure
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
