import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Mail, CheckCircle2, XCircle, Clock, AlertTriangle, Ban, X, Search, Copy, ExternalLink, Send, UserCheck, UserX, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ─────────── Types ───────────
interface CampaignRow {
  id: string;
  event_id: string;
  company_name: string | null;
  website: string | null;
  contact_email: string | null;
  hunter_status: string | null;
  hunter_prenom: string | null;
  hunter_poste: string | null;
  hunter_score: number | null;
  claude_classification: string | null;
  campaign_status: string | null;
  current_step: number | null;
  last_sent_at: string | null;
  next_send_at: string | null;
  opt_out: boolean | null;
  stop_reason: string | null;
  reply_status: string | null;
  created_at: string | null;
  updated_at: string | null;
}
interface EventRow { id: string; nom_event: string; slug: string | null; date_debut: string | null; campagne_active: boolean | null }
interface ContactRow {
  id: string;
  outreach_campaign_id: string;
  contact_email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  job_title: string | null;
  department_guess: string | null;
  hunter_score: number | null;
  hunter_confidence: number | null;
  is_primary: boolean | null;
  contact_status: string | null;
  last_sent_at: string | null;
  last_reply_at: string | null;
}

// ─────────── Data hook ───────────
function useData() {
  return useQuery({
    queryKey: ['admin-outreach-dashboard-v2'],
    queryFn: async () => {
      // Pull all campaigns paginated to bypass 1000-row limit
      const all: CampaignRow[] = [];
      let from = 0; const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('outreach_campaigns')
          .select('id,event_id,company_name,website,contact_email,hunter_status,hunter_prenom,hunter_poste,hunter_score,claude_classification,campaign_status,current_step,last_sent_at,next_send_at,opt_out,stop_reason,reply_status,created_at,updated_at')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data ?? []) as CampaignRow[];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      const eventIds = [...new Set(all.map(c => c.event_id))];
      const events: EventRow[] = [];
      for (let i = 0; i < eventIds.length; i += 200) {
        const slice = eventIds.slice(i, i + 200);
        const { data } = await supabase.from('events').select('id,nom_event,slug,date_debut,campagne_active').in('id', slice);
        events.push(...((data ?? []) as EventRow[]));
      }
      const campaignIds = all.map(c => c.id);
      const contacts: ContactRow[] = [];
      for (let i = 0; i < campaignIds.length; i += 200) {
        const slice = campaignIds.slice(i, i + 200);
        const { data } = await supabase
          .from('outreach_contacts')
          .select('id,outreach_campaign_id,contact_email,first_name,last_name,full_name,job_title,department_guess,hunter_score,hunter_confidence,is_primary,contact_status,last_sent_at,last_reply_at')
          .in('outreach_campaign_id', slice);
        contacts.push(...((data ?? []) as ContactRow[]));
      }
      return { campaigns: all, events, contacts };
    },
    staleTime: 30_000,
  });
}

// ─────────── Helpers ───────────
const today = () => new Date().toISOString().slice(0, 10);
const isFutureEvent = (d: string | null) => d ? d >= today() : false;
const fmtDate = (d: string | null) => d ? format(new Date(d), 'dd MMM yy HH:mm', { locale: fr }) : '–';
const fmtDateShort = (d: string | null) => d ? format(new Date(d), 'dd/MM', { locale: fr }) : '–';

function StatusBadge({ status, kind }: { status: string | null; kind: 'campaign' | 'hunter' }) {
  const s = status ?? 'unknown';
  const map: Record<string, { label: string; className: string }> = {
    // campaign
    not_started: { label: 'Non démarré', className: 'bg-muted text-muted-foreground' },
    active: { label: 'Actif', className: 'bg-blue-500/15 text-blue-700 border-blue-300' },
    completed: { label: 'Terminé', className: 'bg-slate-500/15 text-slate-700 border-slate-300' },
    converted: { label: 'Converti', className: 'bg-green-500/15 text-green-700 border-green-300' },
    opted_out: { label: 'Exclu', className: 'bg-destructive/15 text-destructive border-destructive/30' },
    // hunter
    pending: { label: 'À enrichir', className: 'bg-amber-500/15 text-amber-700 border-amber-300' },
    ready: { label: 'Prêt', className: 'bg-green-500/15 text-green-700 border-green-300' },
    excluded: { label: 'Exclu', className: 'bg-destructive/15 text-destructive border-destructive/30' },
    failed: { label: 'Échec', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  };
  const info = map[s] ?? { label: s, className: 'bg-muted text-muted-foreground' };
  return <Badge variant="outline" className={info.className}>{info.label}</Badge>;
}

function StepBadge({ step }: { step: number | null }) {
  const s = step ?? 0;
  const colors = ['bg-muted', 'bg-blue-500/15 text-blue-700', 'bg-indigo-500/15 text-indigo-700', 'bg-purple-500/15 text-purple-700'];
  return <Badge variant="outline" className={colors[Math.min(s, 3)]}>{s}/3</Badge>;
}

function UrgencyBadge({ at }: { at: string | null }) {
  if (!at) return <span className="text-xs text-muted-foreground">–</span>;
  const diff = (new Date(at).getTime() - Date.now()) / 3_600_000;
  if (diff <= 0) return <Badge className="bg-destructive text-destructive-foreground">À envoyer</Badge>;
  if (diff <= 24) return <Badge className="bg-orange-500/15 text-orange-700 border-orange-300" variant="outline">&lt;24h</Badge>;
  if (diff <= 72) return <Badge className="bg-yellow-500/15 text-yellow-700 border-yellow-300" variant="outline">&lt;3j</Badge>;
  return <Badge variant="outline">{fmtDateShort(at)}</Badge>;
}

function KpiCard({ label, value, icon: Icon, color = 'text-foreground', onClick, active }: { label: string; value: string | number; icon: React.ElementType; color?: string; onClick?: () => void; active?: boolean }) {
  return (
    <Card className={`${onClick ? 'cursor-pointer hover:bg-primary/30 transition-colors' : ''} ${active ? 'ring-2 ring-primary' : ''}`} onClick={onClick}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
          <Icon className="h-6 w-6 opacity-20 shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────── Anomaly detection ───────────
function detectAnomalies(c: CampaignRow, primaryContact: ContactRow | undefined, isFuture: boolean): string[] {
  const issues: string[] = [];
  if (c.hunter_status === 'ready' && !c.contact_email) issues.push('Prêt sans email');
  if (c.hunter_status === 'ready' && !primaryContact) issues.push('Aucun contact primaire');
  if ((c.current_step ?? 0) > 0 && !c.last_sent_at) issues.push('Step>0 sans dernier envoi');
  if (c.campaign_status === 'active' && !c.next_send_at && (c.current_step ?? 0) < 3) issues.push('Active sans prochaine relance');
  if (c.campaign_status === 'completed' && (c.current_step ?? 0) < 3) issues.push('Terminé avant step 3');
  if (c.opt_out && c.campaign_status === 'active') issues.push('Opt-out mais active');
  if (primaryContact && c.contact_email && primaryContact.contact_email.toLowerCase() !== c.contact_email.toLowerCase()) issues.push('Email campagne ≠ contact principal');
  if (c.hunter_status === 'ready' && !c.claude_classification) issues.push('Prêt sans classification');
  if (!isFuture && ['active', 'not_started'].includes(c.campaign_status ?? '') && c.hunter_status === 'ready') issues.push('Salon passé encore actif');
  return issues;
}

// ─────────── Main ───────────
export default function AdminOutreachDashboard() {
  const { data, isLoading, error, dataUpdatedAt } = useData();
  const qc = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [hunterFilter, setHunterFilter] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [stepFilter, setStepFilter] = useState<string>('all');
  const [emailFilter, setEmailFilter] = useState<string>('all'); // all|with|without
  const [optOutFilter, setOptOutFilter] = useState<string>('all'); // all|yes|no
  const [quickFilter, setQuickFilter] = useState<string>('all'); // all|due|anomalies|future
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Presentation toggles (display only)
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [showCampaignList, setShowCampaignList] = useState(false);

  // Detail
  const [selected, setSelected] = useState<CampaignRow | null>(null);

  // Mutations
  const [excludingId, setExcludingId] = useState<string | null>(null);
  const exclude = useMutation({
    mutationFn: async (id: string) => {
      setExcludingId(id);
      const { error } = await supabase.from('outreach_campaigns' as any)
        .update({ opt_out: true, campaign_status: 'opted_out', stop_reason: 'Exclu manuellement (admin)' } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Campagne exclue'); qc.invalidateQueries({ queryKey: ['admin-outreach-dashboard-v2'] }); setExcludingId(null); },
    onError: () => { toast.error('Erreur'); setExcludingId(null); },
  });

  const computed = useMemo(() => {
    if (!data) return null;
    const { campaigns, events, contacts } = data;
    const eventsMap = Object.fromEntries(events.map(e => [e.id, e]));
    const futureEvents = new Set(events.filter(e => isFutureEvent(e.date_debut)).map(e => e.id));

    // contacts grouped by campaign
    const contactsByCampaign: Record<string, ContactRow[]> = {};
    contacts.forEach(ct => {
      (contactsByCampaign[ct.outreach_campaign_id] ||= []).push(ct);
    });
    const primaryByCampaign: Record<string, ContactRow | undefined> = {};
    Object.entries(contactsByCampaign).forEach(([k, v]) => {
      primaryByCampaign[k] = v.find(x => x.is_primary) ?? v[0];
    });

    // Enrich
    const enriched = campaigns.map(c => {
      const isFuture = futureEvents.has(c.event_id);
      const anomalies = detectAnomalies(c, primaryByCampaign[c.id], isFuture);
      return { c, isFuture, anomalies, primary: primaryByCampaign[c.id], allContacts: contactsByCampaign[c.id] ?? [] };
    });

    // Apply filters
    const now = Date.now();
    const filtered = enriched.filter(({ c, isFuture, anomalies }) => {
      if (eventFilter !== 'all' && c.event_id !== eventFilter) return false;
      if (hunterFilter !== 'all' && (c.hunter_status ?? 'pending') !== hunterFilter) return false;
      if (campaignFilter !== 'all' && (c.campaign_status ?? 'not_started') !== campaignFilter) return false;
      if (classFilter !== 'all' && (c.claude_classification ?? '_null') !== classFilter) return false;
      if (stepFilter !== 'all' && String(c.current_step ?? 0) !== stepFilter) return false;
      if (emailFilter === 'with' && !c.contact_email) return false;
      if (emailFilter === 'without' && c.contact_email) return false;
      if (optOutFilter === 'yes' && !c.opt_out) return false;
      if (optOutFilter === 'no' && c.opt_out) return false;
      if (quickFilter === 'due' && (!c.next_send_at || new Date(c.next_send_at).getTime() > now)) return false;
      if (quickFilter === 'anomalies' && anomalies.length === 0) return false;
      if (quickFilter === 'future' && !isFuture) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = [c.company_name, c.contact_email, c.website, c.hunter_prenom, c.hunter_poste].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });

    // Sort: due first, then anomalies, then by next_send_at, then created_at
    filtered.sort((a, b) => {
      const aDue = a.c.next_send_at && new Date(a.c.next_send_at).getTime() <= now ? 1 : 0;
      const bDue = b.c.next_send_at && new Date(b.c.next_send_at).getTime() <= now ? 1 : 0;
      if (aDue !== bDue) return bDue - aDue;
      if (a.anomalies.length !== b.anomalies.length) return b.anomalies.length - a.anomalies.length;
      const at = a.c.next_send_at ? new Date(a.c.next_send_at).getTime() : Infinity;
      const bt = b.c.next_send_at ? new Date(b.c.next_send_at).getTime() : Infinity;
      if (at !== bt) return at - bt;
      return new Date(b.c.created_at ?? 0).getTime() - new Date(a.c.created_at ?? 0).getTime();
    });

    // KPIs over filtered set (so KPIs match table)
    const total = filtered.length;
    const counts = {
      pending: filtered.filter(x => x.c.hunter_status === 'pending').length,
      ready: filtered.filter(x => x.c.hunter_status === 'ready').length,
      excluded: filtered.filter(x => x.c.hunter_status === 'excluded').length,
      not_started: filtered.filter(x => x.c.campaign_status === 'not_started').length,
      active: filtered.filter(x => x.c.campaign_status === 'active').length,
      completed: filtered.filter(x => x.c.campaign_status === 'completed').length,
      opted_out: filtered.filter(x => x.c.campaign_status === 'opted_out' || x.c.opt_out).length,
      converted: filtered.filter(x => x.c.campaign_status === 'converted').length,
      stopped: filtered.filter(x => x.c.campaign_status === 'stopped').length,
      blocked_invalid_email: filtered.filter(x => x.c.campaign_status === 'blocked_invalid_email').length,
      expired: filtered.filter(x => x.c.campaign_status === 'expired').length,
      novelty_published: filtered.filter(x => x.c.campaign_status === 'novelty_published').length,
      stop_email_not_found: filtered.filter(x => x.c.stop_reason === 'email_not_found').length,
      stop_not_attending: filtered.filter(x => x.c.stop_reason === 'not_attending_event').length,
      stop_not_interested: filtered.filter(x => x.c.stop_reason === 'not_interested').length,
      withEmail: filtered.filter(x => !!x.c.contact_email).length,
      withoutEmail: filtered.filter(x => !x.c.contact_email).length,
      dueNow: filtered.filter(x => x.c.next_send_at && new Date(x.c.next_send_at).getTime() <= now).length,
      followUpDue: filtered.filter(x => (x.c.current_step ?? 0) > 0 && x.c.next_send_at && new Date(x.c.next_send_at).getTime() <= now + 72 * 3600_000).length,
      replied: filtered.filter(x => x.c.reply_status && x.c.reply_status !== 'none').length,
      anomalies: filtered.filter(x => x.anomalies.length > 0).length,
    };

    // Per-event aggregation (full set, ignoring quick filter for accuracy)
    const eventAgg = events.map(ev => {
      const ec = enriched.filter(x => x.c.event_id === ev.id);
      return {
        ev,
        total: ec.length,
        ready: ec.filter(x => x.c.hunter_status === 'ready').length,
        sent: ec.filter(x => (x.c.current_step ?? 0) > 0).length,
        converted: ec.filter(x => x.c.campaign_status === 'converted').length,
        anomalies: ec.filter(x => x.anomalies.length > 0).length,
        isFuture: futureEvents.has(ev.id),
      };
    }).filter(r => r.total > 0).sort((a, b) => (a.ev.date_debut ?? '').localeCompare(b.ev.date_debut ?? ''));

    // Distinct classifications
    const classifications = [...new Set(campaigns.map(c => c.claude_classification).filter(Boolean))] as string[];

    const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return { filtered, paginated, counts, total, eventAgg, eventsMap, classifications, primaryByCampaign, contactsByCampaign };
  }, [data, search, eventFilter, hunterFilter, campaignFilter, classFilter, stepFilter, emailFilter, optOutFilter, quickFilter, page]);

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (error || !data || !computed) return <div className="text-center py-20"><AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" /><p className="text-destructive">Erreur de chargement.</p></div>;

  const { filtered, paginated, counts, total, eventAgg, eventsMap, classifications, primaryByCampaign, contactsByCampaign } = computed;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const copy = (txt: string) => { navigator.clipboard.writeText(txt); toast.success('Copié'); };

  const resetFilters = () => {
    setSearch(''); setEventFilter('all'); setHunterFilter('all'); setCampaignFilter('all');
    setClassFilter('all'); setStepFilter('all'); setEmailFilter('all'); setOptOutFilter('all');
    setQuickFilter('all'); setPage(0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Campagnes exposants</h1>
          <p className="text-sm text-muted-foreground">
            Pilotage du pipeline email · {data.campaigns.length} campagnes en base
            {dataUpdatedAt && <span> · MàJ {format(new Date(dataUpdatedAt), 'HH:mm:ss', { locale: fr })}</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['admin-outreach-dashboard-v2'] })}>Actualiser</Button>
      </div>

      {/* Main KPIs — 5 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Actives" value={counts.active} icon={Send} color="text-blue-600" />
        <KpiCard label="Converties" value={counts.converted} icon={CheckCircle2} color="text-green-600" />
        <KpiCard label="Terminées" value={counts.completed} icon={CheckCircle2} />
        <KpiCard label="À traiter" value={counts.blocked_invalid_email + counts.stopped + counts.opted_out} icon={AlertCircle} color={(counts.blocked_invalid_email + counts.stopped + counts.opted_out) > 0 ? 'text-destructive' : ''} />
        <KpiCard label="Total" value={total} icon={Mail} />
      </div>

      {/* Detailed stats — collapsed by default */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => setShowDetailedStats(v => !v)}>
          {showDetailedStats ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
          Statistiques détaillées
        </Button>
        {showDetailedStats && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <KpiCard label="À envoyer maintenant" value={counts.dueNow} icon={Send} color={counts.dueNow > 0 ? 'text-destructive' : ''} />
            <KpiCard label="Anomalies" value={counts.anomalies} icon={AlertCircle} color={counts.anomalies > 0 ? 'text-destructive' : ''} />
            <KpiCard label="Hunter prêts" value={counts.ready} icon={UserCheck} color="text-green-600" />
            <KpiCard label="À enrichir" value={counts.pending} icon={Clock} color="text-amber-600" />
            <KpiCard label="Hunter exclus" value={counts.excluded} icon={UserX} color="text-muted-foreground" />
            <KpiCard label="Non démarré" value={counts.not_started} icon={Mail} />
            <KpiCard label="Expirées" value={counts.expired} icon={Clock} color="text-muted-foreground" />
            <KpiCard label="Avec email" value={counts.withEmail} icon={Mail} />
            <KpiCard label="Sans email" value={counts.withoutEmail} icon={XCircle} color="text-amber-600" />
            <KpiCard label="Stoppées (admin)" value={counts.stopped} icon={XCircle} color="text-destructive" />
            <KpiCard label="Email invalide" value={counts.blocked_invalid_email} icon={UserX} color="text-destructive" />
            <KpiCard label="Opt-out" value={counts.opted_out} icon={UserX} color="text-destructive" />
            <KpiCard label="Nouveauté publiée" value={counts.novelty_published} icon={CheckCircle2} color="text-green-600" />
            <KpiCard label="Email introuvable" value={counts.stop_email_not_found} icon={AlertCircle} color="text-amber-600" />
            <KpiCard label="Ne participe pas" value={counts.stop_not_attending} icon={AlertCircle} color="text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Per-event summary — upcoming events by default */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Synthèse par salon</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setShowPastEvents(v => !v)}>
            {showPastEvents ? 'Masquer les salons passés' : 'Afficher les salons passés'}
          </Button>
        </CardHeader>
        <CardContent>
          {(() => {
            const rows = eventAgg.filter(r => showPastEvents || r.isFuture);
            if (rows.length === 0) return <p className="text-muted-foreground text-sm py-6 text-center">Aucun salon à venir avec des campagnes.</p>;
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">Salon</th>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium text-center">État</th>
                      <th className="pb-2 font-medium text-center">Total</th>
                      <th className="pb-2 font-medium text-center">Prêtes</th>
                      <th className="pb-2 font-medium text-center">Envoyées</th>
                      <th className="pb-2 font-medium text-center">Converties</th>
                      <th className="pb-2 font-medium text-center">Anomalies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.ev.id} className={`border-b last:border-0 cursor-pointer hover:bg-primary/30 ${!r.isFuture ? 'opacity-60' : ''}`} onClick={() => { setEventFilter(r.ev.id); setPage(0); setShowCampaignList(true); }}>
                        <td className="py-2 font-medium">{r.ev.nom_event}</td>
                        <td className="py-2 text-muted-foreground">{r.ev.date_debut ? format(new Date(r.ev.date_debut), 'dd MMM yyyy', { locale: fr }) : '–'}</td>
                        <td className="py-2 text-center">{r.isFuture ? <Badge className="bg-green-500/15 text-green-700 border-green-300" variant="outline">À venir</Badge> : <Badge variant="outline">Passé</Badge>}</td>
                        <td className="py-2 text-center">{r.total}</td>
                        <td className="py-2 text-center">{r.ready}</td>
                        <td className="py-2 text-center">{r.sent}</td>
                        <td className="py-2 text-center font-medium text-green-600">{r.converted}</td>
                        <td className="py-2 text-center">{r.anomalies > 0 ? <Badge className="bg-destructive/15 text-destructive border-destructive/30" variant="outline">{r.anomalies}</Badge> : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Campaign list — collapsed behind toggle */}
      <Button variant="outline" onClick={() => setShowCampaignList(v => !v)}>
        {showCampaignList ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
        {showCampaignList ? 'Masquer les campagnes' : `Voir toutes les campagnes (${filtered.length})`}
      </Button>

      {showCampaignList && (<>
      {/* Quick action chips */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={quickFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickFilter('all'); setPage(0); }}>Tout</Button>
        <Button variant={quickFilter === 'due' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickFilter('due'); setPage(0); }}><Send className="h-3 w-3 mr-1" />À envoyer maintenant</Button>
        <Button variant={quickFilter === 'anomalies' ? 'destructive' : 'outline'} size="sm" onClick={() => { setQuickFilter('anomalies'); setPage(0); }}><AlertCircle className="h-3 w-3 mr-1" />Anomalies ({data.campaigns.reduce((acc, c) => acc + (detectAnomalies(c, primaryByCampaign[c.id], true).length > 0 ? 1 : 0), 0)})</Button>
        <Button variant={quickFilter === 'future' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickFilter('future'); setPage(0); }}>Salons à venir uniquement</Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input placeholder="Entreprise, email, site web..." className="pl-8" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
            </div>
            <Select value={eventFilter} onValueChange={v => { setEventFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Salon" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les salons</SelectItem>
                {eventAgg.map(({ ev }) => <SelectItem key={ev.id} value={ev.id}>{ev.nom_event}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={hunterFilter} onValueChange={v => { setHunterFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Statut Hunter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous Hunter</SelectItem>
                <SelectItem value="pending">À enrichir</SelectItem>
                <SelectItem value="ready">Prêt</SelectItem>
                <SelectItem value="excluded">Exclu</SelectItem>
                <SelectItem value="failed">Échec</SelectItem>
              </SelectContent>
            </Select>
            <Select value={campaignFilter} onValueChange={v => { setCampaignFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Statut campagne" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="not_started">Non démarré</SelectItem>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="completed">Terminé</SelectItem>
                <SelectItem value="converted">Converti</SelectItem>
                <SelectItem value="opted_out">Exclu</SelectItem>
              </SelectContent>
            </Select>
            <Select value={classFilter} onValueChange={v => { setClassFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Classification Claude" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toute classification</SelectItem>
                <SelectItem value="_null">Sans classification</SelectItem>
                {classifications.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stepFilter} onValueChange={v => { setStepFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Étape" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes étapes</SelectItem>
                <SelectItem value="0">Étape 0</SelectItem>
                <SelectItem value="1">Étape 1</SelectItem>
                <SelectItem value="2">Étape 2</SelectItem>
                <SelectItem value="3">Étape 3</SelectItem>
              </SelectContent>
            </Select>
            <Select value={emailFilter} onValueChange={v => { setEmailFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Email" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Avec / sans email</SelectItem>
                <SelectItem value="with">Avec email</SelectItem>
                <SelectItem value="without">Sans email</SelectItem>
              </SelectContent>
            </Select>
            <Select value={optOutFilter} onValueChange={v => { setOptOutFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Opt-out" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Opt-out: tous</SelectItem>
                <SelectItem value="yes">Opt-out oui</SelectItem>
                <SelectItem value="no">Opt-out non</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>{filtered.length} campagne{filtered.length > 1 ? 's' : ''} affichée{filtered.length > 1 ? 's' : ''}</span>
            <Button variant="ghost" size="sm" onClick={resetFilters}><X className="h-3 w-3 mr-1" />Reset filtres</Button>
          </div>
        </CardContent>
      </Card>

      {/* Main table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Campagnes</CardTitle></CardHeader>
        <CardContent>
          {paginated.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Aucune campagne ne correspond aux filtres.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Entreprise</th>
                    <th className="pb-2 font-medium">Salon</th>
                    <th className="pb-2 font-medium">Contact</th>
                    <th className="pb-2 font-medium">Classif.</th>
                    <th className="pb-2 font-medium text-center">Hunter</th>
                    <th className="pb-2 font-medium text-center">Campagne</th>
                    <th className="pb-2 font-medium text-center">Étape</th>
                    <th className="pb-2 font-medium">Dernier envoi</th>
                    <th className="pb-2 font-medium">Prochain</th>
                    <th className="pb-2 font-medium text-center">⚠</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(({ c, anomalies, primary }) => {
                    const ev = eventsMap[c.event_id];
                    return (
                      <tr key={c.id} className={`border-b last:border-0 hover:bg-primary/20 ${anomalies.length > 0 ? 'bg-destructive/5' : ''}`}>
                        <td className="py-2">
                          <button className="font-medium hover:underline text-left" onClick={() => setSelected(c)}>
                            {c.company_name ?? '–'}
                          </button>
                          {c.website && <div className="text-xs text-muted-foreground truncate max-w-[180px]">{c.website}</div>}
                        </td>
                        <td className="py-2 text-muted-foreground max-w-[140px] truncate">{ev?.nom_event ?? '–'}</td>
                        <td className="py-2 max-w-[200px]">
                          {c.contact_email ? (
                            <>
                              <div className="text-xs truncate">{c.contact_email}</div>
                              {(primary?.full_name || c.hunter_prenom) && <div className="text-xs text-muted-foreground truncate">{primary?.full_name ?? c.hunter_prenom} {primary?.job_title || c.hunter_poste ? `· ${primary?.job_title ?? c.hunter_poste}` : ''}</div>}
                            </>
                          ) : <span className="text-xs text-muted-foreground">–</span>}
                        </td>
                        <td className="py-2"><span className="text-xs">{c.claude_classification ?? '–'}</span></td>
                        <td className="py-2 text-center"><StatusBadge status={c.hunter_status} kind="hunter" /></td>
                        <td className="py-2 text-center"><StatusBadge status={c.campaign_status} kind="campaign" /></td>
                        <td className="py-2 text-center"><StepBadge step={c.current_step} /></td>
                        <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDateShort(c.last_sent_at)}</td>
                        <td className="py-2"><UrgencyBadge at={c.next_send_at} /></td>
                        <td className="py-2 text-center">{anomalies.length > 0 && <Badge className="bg-destructive/15 text-destructive border-destructive/30" variant="outline" title={anomalies.join(', ')}>{anomalies.length}</Badge>}</td>
                        <td className="py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelected(c)}>Détail</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-muted-foreground">Page {page + 1} / {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Précédent</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Suivant</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </>)}

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (() => {
            const ev = eventsMap[selected.event_id];
            const cts = contactsByCampaign[selected.id] ?? [];
            const primary = primaryByCampaign[selected.id];
            const anomalies = detectAnomalies(selected, primary, !!ev?.date_debut && isFutureEvent(ev.date_debut));
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    {selected.company_name ?? 'Sans nom'}
                    {selected.website && <a href={selected.website.startsWith('http') ? selected.website : `https://${selected.website}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" /></a>}
                  </SheetTitle>
                  <SheetDescription>{ev?.nom_event ?? 'Salon inconnu'} · créée le {fmtDate(selected.created_at)}</SheetDescription>
                </SheetHeader>

                {anomalies.length > 0 && (
                  <div className="mt-4 p-3 rounded-md bg-destructive/10 border border-destructive/30">
                    <div className="flex items-center gap-2 font-medium text-destructive mb-2"><AlertCircle className="h-4 w-4" />Anomalies détectées</div>
                    <ul className="text-sm space-y-1">{anomalies.map(a => <li key={a}>• {a}</li>)}</ul>
                  </div>
                )}

                <Tabs defaultValue="campaign" className="mt-4">
                  <TabsList>
                    <TabsTrigger value="campaign">Campagne</TabsTrigger>
                    <TabsTrigger value="contacts">Contacts ({cts.length})</TabsTrigger>
                    <TabsTrigger value="event">Salon</TabsTrigger>
                  </TabsList>

                  <TabsContent value="campaign" className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Statut campagne"><StatusBadge status={selected.campaign_status} kind="campaign" /></Field>
                      <Field label="Statut Hunter"><StatusBadge status={selected.hunter_status} kind="hunter" /></Field>
                      <Field label="Étape"><StepBadge step={selected.current_step} /></Field>
                      <Field label="Classification">{selected.claude_classification ?? '–'}</Field>
                      <Field label="Dernier envoi">{fmtDate(selected.last_sent_at)}</Field>
                      <Field label="Prochain envoi">{fmtDate(selected.next_send_at)}</Field>
                      <Field label="Réponse">{selected.reply_status ?? 'none'}</Field>
                      <Field label="Opt-out">{selected.opt_out ? 'Oui' : 'Non'}</Field>
                      <Field label="Score Hunter">{selected.hunter_score ?? '–'}</Field>
                      <Field label="MàJ">{fmtDate(selected.updated_at)}</Field>
                    </div>
                    {selected.stop_reason && <Field label="Motif d'arrêt">{selected.stop_reason}</Field>}
                    {selected.contact_email && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <span className="text-muted-foreground">Email campagne:</span>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{selected.contact_email}</code>
                        <Button variant="ghost" size="sm" onClick={() => copy(selected.contact_email!)}><Copy className="h-3 w-3" /></Button>
                      </div>
                    )}
                    <div className="pt-3 border-t">
                      <Button variant="destructive" size="sm" disabled={selected.opt_out || excludingId === selected.id} onClick={() => { if (confirm('Exclure cette campagne ?')) exclude.mutate(selected.id); }}>
                        {excludingId === selected.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Ban className="h-3 w-3 mr-1" />}
                        {selected.opt_out ? 'Déjà exclue' : 'Exclure la campagne'}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="contacts" className="space-y-3">
                    {cts.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">Aucun contact en table outreach_contacts.</p>
                    ) : cts.sort((a, b) => Number(b.is_primary) - Number(a.is_primary)).map(ct => (
                      <Card key={ct.id} className={ct.is_primary ? 'border-primary' : ''}>
                        <CardContent className="pt-4 text-sm space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{ct.full_name ?? (`${ct.first_name ?? ''} ${ct.last_name ?? ''}`.trim() || '(sans nom)')}</div>
                            {ct.is_primary && <Badge>Primaire</Badge>}
                          </div>
                          <div className="flex items-center gap-2"><code className="text-xs bg-muted px-1.5 py-0.5 rounded flex-1 truncate">{ct.contact_email}</code><Button variant="ghost" size="sm" onClick={() => copy(ct.contact_email)}><Copy className="h-3 w-3" /></Button></div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div>Poste: <span className="text-foreground">{ct.job_title ?? '–'}</span></div>
                            <div>Dépt: <span className="text-foreground">{ct.department_guess ?? '–'}</span></div>
                            <div>Score Hunter: <span className="text-foreground">{ct.hunter_score ?? '–'}</span></div>
                            <div>Confiance: <span className="text-foreground">{ct.hunter_confidence ?? '–'}</span></div>
                            <div>Statut: <span className="text-foreground">{ct.contact_status ?? '–'}</span></div>
                            <div>Dernier envoi: <span className="text-foreground">{fmtDateShort(ct.last_sent_at)}</span></div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="event" className="space-y-3 text-sm">
                    {ev ? (
                      <>
                        <Field label="Nom">{ev.nom_event}</Field>
                        <Field label="Date début">{ev.date_debut ?? '–'}</Field>
                        <Field label="Slug">{ev.slug ?? '–'}</Field>
                        <Field label="Campagne active">{ev.campagne_active ? 'Oui' : 'Non'}</Field>
                        {ev.slug && <a href={`/events/${ev.slug}`} target="_blank" rel="noreferrer" className="text-primary text-sm flex items-center gap-1"><ExternalLink className="h-3 w-3" />Voir la fiche salon</a>}
                      </>
                    ) : <p className="text-muted-foreground">Salon introuvable.</p>}
                  </TabsContent>
                </Tabs>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
