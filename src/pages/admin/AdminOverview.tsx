import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const fmt = (v: number | null | undefined) => (v != null ? v.toLocaleString('fr-FR') : '–');

const DeltaBadge = ({ delta }: { delta: number | null | undefined }) => {
  if (delta == null) return null;
  const color = delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-muted-foreground';
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {delta > 0 ? '+' : ''}{delta}
    </span>
  );
};

const MetricCard = ({
  title,
  value,
  subtitle,
  delta,
}: {
  title: string;
  value: string;
  subtitle: string;
  delta?: number | null;
}) => (
  <Card>
    <CardContent className="pt-6">
      <p className="text-sm text-muted-foreground">{title}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-3xl font-bold">{value}</span>
        {delta !== undefined && <DeltaBadge delta={delta} />}
      </div>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </CardContent>
  </Card>
);

const AdminOverview = () => {
  // IA Visite 7d — reuse existing wizard_sessions query
  const { data: iaUses7d } = useQuery({
    queryKey: ['overview-ia-7d'],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { count, error } = await supabase
        .from('wizard_sessions' as any)
        .select('*', { count: 'exact', head: true })
        .in('step_reached', ['results', 'saved'])
        .gte('created_at', since.toISOString());
      if (error) return null;
      return count ?? 0;
    },
  });

  // Novelties published last 7d + previous 7d for delta
  const { data: novelties7d } = useQuery({
    queryKey: ['overview-novelties-7d'],
    queryFn: async () => {
      const now = new Date();
      const d7 = new Date(now);
      d7.setDate(d7.getDate() - 7);
      const d14 = new Date(now);
      d14.setDate(d14.getDate() - 14);

      const [curr, prev] = await Promise.all([
        supabase
          .from('novelties')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'published')
          .eq('is_test', false)
          .gte('created_at', d7.toISOString()),
        supabase
          .from('novelties')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'published')
          .eq('is_test', false)
          .gte('created_at', d14.toISOString())
          .lt('created_at', d7.toISOString()),
      ]);

      if (curr.error || prev.error) return null;
      return { current: curr.count ?? 0, previous: prev.count ?? 0 };
    },
  });

  // Upcoming visible events
  const { data: upcomingEvents } = useQuery({
    queryKey: ['overview-upcoming-events'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { count, error } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .gte('date_debut', today)
        .eq('visible', true)
        .eq('is_test', false);
      if (error) return null;
      return count ?? 0;
    },
  });

  // Exposants count (legacy table)
  const { data: exposantsCount } = useQuery({
    queryKey: ['overview-exposants-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('exposants')
        .select('*', { count: 'exact', head: true });
      if (error) return null;
      return count ?? 0;
    },
  });

  // Outreach campaigns this month
  const { data: outreachData } = useQuery({
    queryKey: ['overview-outreach'],
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('outreach_campaigns')
        .select('campaign_status')
        .neq('campaign_status', 'not_started')
        .gte('created_at', monthStart.toISOString());

      if (error) return null;
      if (!data || data.length === 0) return { contacted: 0, converted: 0, rate: null, empty: true };

      const contacted = data.length;
      const converted = data.filter((r: any) => r.campaign_status === 'converted').length;
      const rate = contacted > 0 ? Math.round((converted / contacted) * 100) : 0;
      return { contacted, converted, rate, empty: false };
    },
  });

  const noveltiesDelta =
    novelties7d ? novelties7d.current - novelties7d.previous : null;

  const outreachEmpty = !outreachData || outreachData.empty;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Vue d'ensemble</h1>
        <p className="text-muted-foreground text-sm">Métriques clés de la plateforme</p>
      </div>

      {/* Bloc 1 — Activité 7j */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Activité des 7 derniers jours</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Visiteurs uniques"
            value="–"
            subtitle="Non disponible"
          />
          <MetricCard
            title="Nouveautés publiées"
            value={fmt(novelties7d?.current)}
            subtitle="7 derniers jours"
            delta={noveltiesDelta}
          />
          <MetricCard
            title="Utilisations IA Visite"
            value={fmt(iaUses7d)}
            subtitle="7 derniers jours"
          />
        </div>
      </section>

      {/* Bloc 2 — Catalogue */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Catalogue</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            title="Salons publiés à venir"
            value={fmt(upcomingEvents)}
            subtitle="date_debut ≥ aujourd'hui, visibles"
          />
          <MetricCard
            title="Exposants référencés"
            value={fmt(exposantsCount)}
            subtitle="Table exposants (legacy)"
          />
        </div>
      </section>

      {/* Bloc 3 — Campagnes email */}
      <section className={outreachEmpty ? 'opacity-60' : ''}>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-lg font-semibold">Campagnes email</h2>
          {outreachEmpty && (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
              Disponible bientôt
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            title="Entreprises contactées ce mois"
            value={outreachEmpty ? '–' : fmt(outreachData?.contacted)}
            subtitle="campaign_status ≠ not_started"
          />
          <MetricCard
            title="Taux de conversion → Nouveauté"
            value={outreachEmpty ? '–' : `${outreachData?.rate ?? 0} %`}
            subtitle="converted / contactées"
          />
        </div>
      </section>
    </div>
  );
};

export default AdminOverview;
