import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, Save, UserCheck, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

type Period = '7' | '30' | '90';

const PERIOD_LABELS: Record<Period, string> = {
  '7': '7 derniers jours',
  '30': '30 derniers jours',
  '90': '90 derniers jours',
};

const ROLE_COLORS = [
  'hsl(var(--primary))',
  'hsl(210, 70%, 55%)',
  'hsl(150, 60%, 45%)',
  'hsl(40, 80%, 50%)',
  'hsl(340, 65%, 50%)',
  'hsl(270, 55%, 55%)',
  'hsl(0, 0%, 55%)',
];

export default function AdminIaVisite() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [period, setPeriod] = useState<Period>('30');

  // Wizard sessions for the selected period
  const { data: sessions = [] } = useQuery({
    queryKey: ['wizard-sessions', period],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - Number(period));
      const { data, error } = await supabase
        .from('wizard_sessions' as any)
        .select('*')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false });
      if (error) { console.error(error); return []; }
      return (data || []) as any[];
    },
    enabled: isAdmin,
  });

  // All visit_plans (for role donut + total saved)
  const { data: allPlans = [] } = useQuery({
    queryKey: ['visit-plans-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visit_plans' as any)
        .select('id, role, event_id, created_at');
      if (error) { console.error(error); return []; }
      return (data || []) as any[];
    },
    enabled: isAdmin,
  });

  // All wizard sessions (for all-time funnel if needed)
  const { data: allSessions = [] } = useQuery({
    queryKey: ['wizard-sessions-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wizard_sessions' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) { console.error(error); return []; }
      return (data || []) as any[];
    },
    enabled: isAdmin,
  });

  // Top events — join wizard_sessions with events
  const { data: topEvents = [] } = useQuery({
    queryKey: ['wizard-top-events'],
    queryFn: async () => {
      // Get all wizard sessions with event info
      const { data: ws, error } = await supabase
        .from('wizard_sessions' as any)
        .select('event_id, step_reached, saved');
      if (error || !ws) return [];

      // Group by event_id
      const byEvent: Record<string, { uses: number; saves: number }> = {};
      (ws as any[]).forEach(s => {
        if (!s.event_id) return;
        if (!byEvent[s.event_id]) byEvent[s.event_id] = { uses: 0, saves: 0 };
        if (['results', 'saved'].includes(s.step_reached)) byEvent[s.event_id].uses++;
        if (s.saved) byEvent[s.event_id].saves++;
      });

      // Also count from visit_plans
      const { data: vp } = await supabase
        .from('visit_plans' as any)
        .select('event_id');
      (vp || []).forEach((p: any) => {
        if (!p.event_id) return;
        if (!byEvent[p.event_id]) byEvent[p.event_id] = { uses: 0, saves: 0 };
        byEvent[p.event_id].saves++;
      });

      const eventIds = Object.keys(byEvent);
      if (eventIds.length === 0) return [];

      // Fetch event names
      const { data: events } = await supabase
        .from('events')
        .select('id, nom_event')
        .in('id', eventIds);
      const eventMap = new Map((events || []).map(e => [e.id, e.nom_event]));

      // Fetch id_event for participation counts
      const { data: eventRows } = await supabase
        .from('events')
        .select('id, id_event')
        .in('id', eventIds);
      const idEventMap = new Map((eventRows || []).map(e => [e.id, e.id_event]));

      // Fetch participation counts per id_event
      const idEvents = [...new Set((eventRows || []).map(e => e.id_event).filter(Boolean))];
      const participationCounts: Record<string, number> = {};
      if (idEvents.length > 0) {
        const { data: partRows } = await supabase
          .from('participation' as any)
          .select('id_event')
          .in('id_event', idEvents);
        (partRows || []).forEach((p: any) => {
          participationCounts[p.id_event] = (participationCounts[p.id_event] || 0) + 1;
        });
      }

      const result = eventIds.map(eid => {
        const idEvent = idEventMap.get(eid) || '';
        return {
          event_id: eid,
          nom_event: eventMap.get(eid) || 'Inconnu',
          uses: byEvent[eid].uses,
          saves: byEvent[eid].saves,
          id_event: idEvent,
          nb_exposants: idEvent ? (participationCounts[idEvent] || 0) : 0,
        };
      });

      result.sort((a, b) => b.uses - a.uses);
      return result.slice(0, 10);
    },
    enabled: isAdmin,
  });

  // ── Compute KPIs ──
  const kpis = useMemo(() => {
    // 7-day usage (results or saved)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recent7 = allSessions.filter((s: any) =>
      new Date(s.created_at) >= sevenDaysAgo && ['results', 'saved'].includes(s.step_reached)
    );

    // Period-based
    const opened = sessions.filter((s: any) => s.step_reached).length;
    const saved = sessions.filter((s: any) => s.saved).length;
    const completionRate = opened > 0 ? Math.round((saved / opened) * 100) : 0;

    const authShown = sessions.filter((s: any) => s.auth_shown).length;
    const authSuccess = sessions.filter((s: any) => s.auth_success).length;
    const conversionRate = authShown > 0 ? Math.round((authSuccess / authShown) * 100) : 0;

    return {
      uses7d: recent7.length,
      totalSaved: allPlans.length,
      completionRate,
      conversionRate,
    };
  }, [sessions, allSessions, allPlans]);

  // ── Funnel data ──
  const funnelData = useMemo(() => {
    const steps = [
      { key: 'opened', label: 'Ouvertures' },
      { key: 'step1', label: 'Étape 1 complétée' },
      { key: 'step2', label: 'Étape 2 complétée' },
      { key: 'results', label: 'Résultats affichés' },
      { key: 'saved', label: 'Plans sauvegardés' },
    ];

    const stepOrder = ['opened', 'step1', 'step2', 'results', 'saved'];

    return steps.map(({ key, label }, idx) => {
      const count = sessions.filter((s: any) => {
        const sIdx = stepOrder.indexOf(s.step_reached);
        return sIdx >= idx;
      }).length;
      return { label, count, key };
    });
  }, [sessions]);

  // ── Role distribution from visit_plans ──
  const roleData = useMemo(() => {
    const freq: Record<string, number> = {};
    allPlans.forEach((p: any) => {
      const r = p.role || 'Autre';
      // Shorten role labels
      const short = r.split(' / ')[0] || r;
      freq[short] = (freq[short] || 0) + 1;
    });
    return Object.entries(freq)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [allPlans]);

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/admin"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Dashboard IA Visite
              </h1>
              <p className="text-sm text-muted-foreground">Suivi de la fonctionnalité "Préparer ma visite avec l'IA"</p>
            </div>
          </div>
          <div className="flex gap-2">
            {(['7', '30', '90'] as Period[]).map(p => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p)}
              >
                {PERIOD_LABELS[p]}
              </Button>
            ))}
          </div>
        </div>

        {/* Zone 1 — KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Utilisations (7j)"
            value={kpis.uses7d}
            icon={<Sparkles className="h-4 w-4" />}
            description="Résultats affichés"
          />
          <KpiCard
            title="Taux de complétion"
            value={`${kpis.completionRate}%`}
            icon={<TrendingUp className="h-4 w-4" />}
            description={`Sur ${PERIOD_LABELS[period]}`}
          />
          <KpiCard
            title="Plans sauvegardés"
            value={kpis.totalSaved}
            icon={<Save className="h-4 w-4" />}
            description="Total all time"
          />
          <KpiCard
            title="Conversion compte"
            value={`${kpis.conversionRate}%`}
            icon={<UserCheck className="h-4 w-4" />}
            description={`Sur ${PERIOD_LABELS[period]}`}
          />
        </div>

        {/* Zone 2 — Funnel + Roles */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Funnel */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Funnel d'abandon — {PERIOD_LABELS[period]}</CardTitle>
            </CardHeader>
            <CardContent>
              {funnelData[0]?.count === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Aucune session sur cette période. Les données apparaîtront dès les premières utilisations.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={funnelData} layout="vertical" margin={{ left: 0, right: 30, top: 5, bottom: 5 }}>
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={160} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number, _name: string, props: any) => {
                        const total = funnelData[0]?.count || 1;
                        const pct = Math.round((value / total) * 100);
                        return [`${value} (${pct}%)`, 'Sessions'];
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {funnelData.map((_, idx) => (
                        <Cell key={idx} fill={`hsl(var(--primary) / ${1 - idx * 0.15})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Roles donut */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Répartition des rôles</CardTitle>
            </CardHeader>
            <CardContent>
              {roleData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Pas encore de données de rôles.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <Pie
                      data={roleData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                      label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                      startAngle={90}
                      endAngle={-270}
                    >
                      {roleData.map((_, idx) => (
                        <Cell key={idx} fill={ROLE_COLORS[idx % ROLE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Zone 3 — Top événements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top événements</CardTitle>
          </CardHeader>
          <CardContent>
            {topEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucune donnée encore disponible.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                     <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Événement</th>
                      <th className="text-right py-2 px-4 font-medium text-muted-foreground">Nb exposants</th>
                      <th className="text-right py-2 px-4 font-medium text-muted-foreground">Utilisations</th>
                      <th className="text-right py-2 px-4 font-medium text-muted-foreground">Plans sauvegardés</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topEvents.map((ev: any) => (
                      <tr key={ev.event_id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 pr-4 font-medium">{ev.nom_event}</td>
                        <td className="text-right py-2 px-4">{ev.nb_exposants}</td>
                        <td className="text-right py-2 px-4">{ev.uses}</td>
                        <td className="text-right py-2 px-4">{ev.saves}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon, description }: { title: string; value: string | number; icon: React.ReactNode; description: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className="text-primary">{icon}</div>
        </div>
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
