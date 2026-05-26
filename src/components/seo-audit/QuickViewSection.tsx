import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle, FileText, Server, Sparkles, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  results: any;
}

type Tone = 'good' | 'warn' | 'bad' | 'idle';

const toneClass: Record<Tone, string> = {
  good: 'text-green-600 bg-green-50 border-green-200',
  warn: 'text-orange-600 bg-orange-50 border-orange-200',
  bad: 'text-red-600 bg-red-50 border-red-200',
  idle: 'text-muted-foreground bg-muted border-border',
};

function MetricCard({
  icon: Icon,
  value,
  label,
  tone,
  hint,
}: {
  icon: any;
  value: React.ReactNode;
  label: string;
  tone: Tone;
  hint?: string;
}) {
  return (
    <Card className={`border ${toneClass[tone]}`}>
      <CardContent className="pt-5 pb-4 px-4 flex items-start gap-3">
        <div className={`rounded-md p-2 ${toneClass[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-bold text-foreground leading-tight truncate">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
          {hint && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function toneFromPercent(pct: number, good = 90, warn = 70): Tone {
  if (pct >= good) return 'good';
  if (pct >= warn) return 'warn';
  return 'bad';
}

function toneFromCount(n: number, good: number, warn: number): Tone {
  if (n >= good) return 'good';
  if (n >= warn) return 'warn';
  return 'bad';
}

function toneFromHoursAgo(h: number): Tone {
  if (h < 24) return 'good';
  if (h < 72) return 'warn';
  return 'bad';
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const h = Math.round(diffMs / 36e5);
  if (h < 1) return 'il y a moins d’une heure';
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} j`;
}

export default function QuickViewSection({ results }: Props) {
  const [enriched, setEnriched] = useState<{ done: number; total: number } | null>(null);
  const [lastEnrichAt, setLastEnrichAt] = useState<Date | null>(null);
  const [lastBuildAt, setLastBuildAt] = useState<Date | null>(null);

  useEffect(() => {
    const db = supabase as any;
    (async () => {
      // Enriched events
      const [{ count: total }, { count: done }, { data: lastRow }] = await Promise.all([
        db.from('events').select('id', { count: 'exact', head: true }).eq('visible', true),
        db
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('visible', true)
          .not('meta_description_gen', 'is', null),
        db
          .from('events')
          .select('updated_at')
          .not('meta_description_gen', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setEnriched({ done: done ?? 0, total: total ?? 0 });
      if (lastRow?.updated_at) setLastEnrichAt(new Date(lastRow.updated_at));
    })();

    // Last prerender build time via HEAD on a known prerendered page
    fetch('https://lotexpo.com/salons-professionnels-2026', { method: 'HEAD' })
      .then((r) => {
        const lm = r.headers.get('last-modified');
        if (lm) setLastBuildAt(new Date(lm));
      })
      .catch(() => {});
  }, []);

  // Pages indexables
  const indexables: number = results?.crawlability?.sitemap?.urlCount ?? 0;
  const indexTone = toneFromCount(indexables, 400, 300);

  // Pages pré-rendues : proxy = pages on-page avec title correct
  const onpage = results?.onpage;
  const allOnpage = [...(onpage?.events || []), ...(onpage?.articles || [])];
  const analyzed = allOnpage.length;
  const withGoodTitle = allOnpage.filter((p: any) => p.titleOk || p.metaTitleOk).length;
  const prerenderPct = analyzed > 0 ? Math.round((withGoodTitle / analyzed) * 100) : 0;
  const prerenderTone: Tone = analyzed === 0 ? 'idle' : toneFromPercent(prerenderPct);

  // Événements enrichis
  const enrichedPct = enriched && enriched.total > 0 ? Math.round((enriched.done / enriched.total) * 100) : 0;
  const enrichTone: Tone = !enriched ? 'idle' : toneFromPercent(enrichedPct);

  // Dernier build
  const buildTone: Tone = lastBuildAt
    ? toneFromHoursAgo((Date.now() - lastBuildAt.getTime()) / 36e5)
    : 'idle';

  // Alertes
  const alerts: { tone: 'warn' | 'good'; text: string }[] = [];

  // 1. events DB vs sitemap
  const cov = results?.crawlability?.sitemapCoverage;
  if (cov && typeof cov.expectedTotal === 'number' && typeof cov.inSitemap === 'number') {
    const missing = cov.expectedTotal - cov.inSitemap;
    if (missing > 0) {
      alerts.push({ tone: 'warn', text: `${missing} pages estimées absentes du sitemap` });
    }
  }

  // 2. titles génériques
  const genericTitles = analyzed - withGoodTitle;
  if (analyzed > 0 && genericTitles > 0) {
    alerts.push({ tone: 'warn', text: `${genericTitles} page(s) avec title manquant ou hors norme` });
  }

  // 3. URL issues / doublons
  const urlIssues = results?.urls?.summary?.withIssues ?? 0;
  if (urlIssues === 0 && results?.urls) {
    alerts.push({ tone: 'good', text: 'Aucun problème d’URL canonique détecté' });
  } else if (urlIssues > 0) {
    alerts.push({ tone: 'warn', text: `${urlIssues} URL(s) avec problème structurel` });
  }

  // 4. enrichissement IA
  if (lastEnrichAt) {
    const d = Math.round((Date.now() - lastEnrichAt.getTime()) / 86400000);
    if (d >= 3) {
      alerts.push({ tone: 'warn', text: `Dernier enrichissement IA : il y a ${d} jours` });
    }
  }

  // 5. thin content
  const thin = onpage?.summary?.thinContentCount ?? 0;
  if (thin > 0) {
    alerts.push({ tone: 'warn', text: `${thin} page(s) au contenu trop mince` });
  }

  const displayed = alerts.slice(0, 5);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Vue rapide</h2>
        <p className="text-sm text-muted-foreground">État SEO de Lotexpo en un coup d’œil</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={FileText}
          value={indexables || '—'}
          label="pages dans le sitemap"
          tone={results?.crawlability ? indexTone : 'idle'}
        />
        <MetricCard
          icon={Server}
          value={analyzed > 0 ? `${withGoodTitle} / ${analyzed}` : '—'}
          label="pages avec contenu serveur"
          tone={prerenderTone}
          hint={analyzed > 0 ? `${prerenderPct}% pré-rendues` : undefined}
        />
        <MetricCard
          icon={Sparkles}
          value={enriched ? `${enriched.done} / ${enriched.total}` : '—'}
          label="événements avec meta description"
          tone={enrichTone}
          hint={enriched ? `${enrichedPct}% enrichis` : undefined}
        />
        <MetricCard
          icon={Clock}
          value={
            lastBuildAt
              ? lastBuildAt.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
              : '—'
          }
          label="dernier pré-rendu"
          tone={buildTone}
          hint={lastBuildAt ? formatRelative(lastBuildAt) : undefined}
        />
      </div>

      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="text-sm font-semibold mb-3">Points d’attention</div>
          {displayed.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" /> Tout est en ordre
            </div>
          ) : (
            <ul className="space-y-1.5">
              {displayed.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {a.tone === 'good' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                  )}
                  <span className="text-foreground">{a.text}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}