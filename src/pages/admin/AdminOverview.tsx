import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Globe, Eye, Users, MousePointerClick, ExternalLink, FileText } from 'lucide-react';

const fmt = (v: number | null | undefined) => (v != null ? v.toLocaleString('fr-FR') : '–');

const DeltaBadge = ({ delta }: { delta: number | null | undefined }) => {
  if (delta == null) return null;
  const color = delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-muted-foreground';
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {delta > 0 ? '+' : ''}{typeof delta === 'number' && delta % 1 !== 0 ? delta.toFixed(1) : delta}
    </span>
  );
};

const MetricCard = ({
  title,
  value,
  subtitle,
  delta,
  icon: IconComp,
}: {
  title: string;
  value: string;
  subtitle: string;
  delta?: number | null;
  icon?: React.ElementType;
}) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center gap-2 mb-1">
        {IconComp && <IconComp className="h-4 w-4 text-muted-foreground" />}
        <p className="text-sm text-muted-foreground">{title}</p>
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-3xl font-bold">{value}</span>
        {delta !== undefined && <DeltaBadge delta={delta} />}
      </div>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </CardContent>
  </Card>
);

// ── (Plausible supprimé — tout passe par GA4) ──

// ── GA4 data hook (visiteurs, pages vues, sessions + top pages/sources) ──
const useGa4Stats = () => {
  return useQuery({
    queryKey: ['ga4-stats-7d'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('ga4-stats', {
        method: 'GET',
      });
      if (error) throw error;
      return data as {
        aggregate: { results: { metrics: number[] } };
        aggregatePrev: { results: { metrics: number[] } } | null;
        topPages: { results: Array<{ dimensions: string[]; metrics: number[] }> };
        topSources: { results: Array<{ dimensions: string[]; metrics: number[] }> };
        source: string;
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

const AdminOverview = () => {
  // ── Plausible (top pages + sources uniquement) ──
  const { data: plausible } = usePlausibleStats();

  // ── GA4 (3 cartes principales) ──
  const { data: ga4, isError: ga4Error } = useGa4Stats();

  const visitors = ga4?.aggregate?.results?.metrics?.[0] ?? null;
  const pageviews = ga4?.aggregate?.results?.metrics?.[1] ?? null;
  const visits = ga4?.aggregate?.results?.metrics?.[2] ?? null;
  const prevVisitors = ga4?.aggregatePrev?.results?.metrics?.[0] ?? null;
  const prevPageviews = ga4?.aggregatePrev?.results?.metrics?.[1] ?? null;
  const prevVisits = ga4?.aggregatePrev?.results?.metrics?.[2] ?? null;

  const visitorsDelta = visitors != null && prevVisitors != null ? visitors - prevVisitors : null;
  const pageviewsDelta = pageviews != null && prevPageviews != null ? pageviews - prevPageviews : null;
  const visitsDelta = visits != null && prevVisits != null ? visits - prevVisits : null;

  // ── Novelties 7d ──
  const { data: novelties7d } = useQuery({
    queryKey: ['overview-novelties-7d'],
    queryFn: async () => {
      const now = new Date();
      const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
      const d14 = new Date(now); d14.setDate(d14.getDate() - 14);
      const [curr, prev] = await Promise.all([
        supabase.from('novelties').select('*', { count: 'exact', head: true })
          .eq('status', 'published').eq('is_test', false).gte('created_at', d7.toISOString()),
        supabase.from('novelties').select('*', { count: 'exact', head: true })
          .eq('status', 'published').eq('is_test', false)
          .gte('created_at', d14.toISOString()).lt('created_at', d7.toISOString()),
      ]);
      if (curr.error || prev.error) return null;
      return { current: curr.count ?? 0, previous: prev.count ?? 0 };
    },
  });

  // ── IA Visite 7d ──
  const { data: iaUses7d } = useQuery({
    queryKey: ['overview-ia-7d'],
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 7);
      const { count, error } = await supabase
        .from('wizard_sessions' as any)
        .select('*', { count: 'exact', head: true })
        .in('step_reached', ['results', 'saved'])
        .gte('created_at', since.toISOString());
      if (error) return null;
      return count ?? 0;
    },
  });

  // ── Upcoming events ──
  const { data: upcomingEvents } = useQuery({
    queryKey: ['overview-upcoming-events'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { count, error } = await supabase.from('events')
        .select('*', { count: 'exact', head: true })
        .gte('date_debut', today).eq('visible', true).eq('is_test', false);
      if (error) return null;
      return count ?? 0;
    },
  });

  // ── Exposants ──
  const { data: exposantsCount } = useQuery({
    queryKey: ['overview-exposants-count'],
    queryFn: async () => {
      const { count, error } = await supabase.from('exposants').select('*', { count: 'exact', head: true });
      if (error) return null;
      return count ?? 0;
    },
  });

  // ── Outreach ──
  const { data: outreachData } = useQuery({
    queryKey: ['overview-outreach'],
    queryFn: async () => {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const { data, error } = await supabase.from('outreach_campaigns')
        .select('campaign_status').neq('campaign_status', 'not_started')
        .gte('created_at', monthStart.toISOString());
      if (error) return null;
      if (!data || data.length === 0) return { contacted: 0, converted: 0, rate: null, empty: true };
      const contacted = data.length;
      const converted = data.filter((r: any) => r.campaign_status === 'converted').length;
      const rate = contacted > 0 ? Math.round((converted / contacted) * 100) : 0;
      return { contacted, converted, rate, empty: false };
    },
  });

  const noveltiesDelta = novelties7d ? novelties7d.current - novelties7d.previous : null;
  const outreachEmpty = !outreachData || outreachData.empty;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Vue d'ensemble</h1>
        <p className="text-muted-foreground text-sm">Métriques clés de la plateforme</p>
      </div>

      {/* Bloc 1 — Trafic GA4 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Trafic – 7 derniers jours</h2>
        {ga4Error && (
          <p className="text-sm text-destructive mb-2">Impossible de charger les données Google Analytics.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Visiteurs uniques"
            value={fmt(visitors)}
            subtitle="7 derniers jours"
            delta={visitorsDelta}
            icon={Users}
          />
          <MetricCard
            title="Pages vues"
            value={fmt(pageviews)}
            subtitle="7 derniers jours"
            delta={pageviewsDelta}
            icon={Eye}
          />
          <MetricCard
            title="Sessions"
            value={fmt(visits)}
            subtitle="7 derniers jours"
            delta={visitsDelta}
            icon={MousePointerClick}
          />
        </div>
      </section>

      {/* Top pages & sources */}
      {plausible && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Pages les plus consultées
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {plausible.topPages?.results?.slice(0, 8).map((row, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="truncate max-w-[70%] text-muted-foreground">{row.dimensions[0]}</span>
                    <span className="font-medium">{row.metrics[0].toLocaleString('fr-FR')} vis.</span>
                  </li>
                ))}
                {(!plausible.topPages?.results?.length) && (
                  <li className="text-muted-foreground">Aucune donnée</li>
                )}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ExternalLink className="h-4 w-4" /> Sources de trafic
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {plausible.topSources?.results?.slice(0, 8).map((row, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="truncate max-w-[70%] text-muted-foreground">
                      {row.dimensions[0] || 'Direct / Aucun'}
                    </span>
                    <span className="font-medium">{row.metrics[0].toLocaleString('fr-FR')} vis.</span>
                  </li>
                ))}
                {(!plausible.topSources?.results?.length) && (
                  <li className="text-muted-foreground">Aucune donnée</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Bloc 2 — Activité plateforme */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Activité plateforme – 7 jours</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* Bloc 3 — Catalogue */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Catalogue</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard title="Salons publiés à venir" value={fmt(upcomingEvents)} subtitle="date_debut ≥ aujourd'hui, visibles" />
          <MetricCard title="Exposants référencés" value={fmt(exposantsCount)} subtitle="Table exposants (legacy)" />
        </div>
      </section>

      {/* Bloc 4 — Campagnes email */}
      <section className={outreachEmpty ? 'opacity-60' : ''}>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-lg font-semibold">Campagnes email</h2>
          {outreachEmpty && (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">Disponible bientôt</span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard title="Entreprises contactées ce mois" value={outreachEmpty ? '–' : fmt(outreachData?.contacted)} subtitle="campaign_status ≠ not_started" />
          <MetricCard title="Taux de conversion → Nouveauté" value={outreachEmpty ? '–' : `${outreachData?.rate ?? 0} %`} subtitle="converted / contactées" />
        </div>
      </section>
    </div>
  );
};

export default AdminOverview;
