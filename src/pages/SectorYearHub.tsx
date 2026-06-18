import { useMemo } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, Calendar, MapPin, ArrowLeft } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import EventCard from '@/components/EventCard';
import { useSectorHub, SECTOR_YEAR_INDEX_THRESHOLD } from '@/hooks/useSectorHub';
import { useEventCardStats } from '@/hooks/useEventCardStats';
import { getCityUrl } from '@/lib/cityUrl';
import { Badge } from '@/components/ui/badge';
import { groupEventsByMonth } from '@/utils/eventGrouping';
import type { Event } from '@/types/event';

function canonicalToEvent(e: any): Event {
  return {
    id: e.id,
    nom_event: e.title,
    date_debut: e.start_date || '',
    date_fin: e.end_date || '',
    secteur: e.secteur_labels?.join(', ') || '',
    nom_lieu: e.nom_lieu || '',
    ville: e.ville || '',
    country: 'France',
    url_image: e.image_url || '',
    url_site_officiel: e.url_site_officiel || '',
    rue: e.rue || '',
    code_postal: e.code_postal || '',
    visible: e.visible ?? true,
    slug: e.slug,
    type_event: (e.type_code || 'salon') as Event['type_event'],
  };
}

const SectorYearHub = () => {
  const { slug, year: yearParam } = useParams<{ slug: string; year: string }>();
  const year = Number(yearParam);
  const yearValid = Number.isInteger(year) && year >= 2020 && year <= 2099;

  const { data: hub, isLoading, error } = useSectorHub(slug, { year: yearValid ? year : null });

  const grouped = useMemo(() => {
    if (!hub?.upcomingEvents?.length) return [];
    return groupEventsByMonth(hub.upcomingEvents.map(canonicalToEvent));
  }, [hub?.upcomingEvents]);

  const statEventIds = useMemo(
    () => (hub?.upcomingEvents ?? []).map((e: any) => e.id),
    [hub?.upcomingEvents]
  );
  const { data: statsMap } = useEventCardStats(statEventIds);

  if (!yearValid) {
    return <Navigate to={`/secteur/${slug ?? ''}`} replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !hub) {
    return (
      <div className="min-h-screen bg-background">
        <Helmet>
          <title>Salons professionnels par secteur | Lotexpo</title>
          <meta name="description" content="Explorez les salons professionnels par secteur d'activité en France sur Lotexpo." />
          <link rel="canonical" href="https://lotexpo.com/events" />
          <meta name="robots" content="noindex,follow" />
        </Helmet>
        <Header />
        <main className="py-24 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Secteur introuvable</h1>
          <Link to="/" className="text-primary hover:underline">Retour à l'accueil</Link>
        </main>
        <Footer />
      </div>
    );
  }

  const count = hub.upcomingEvents.length;
  const indexable = count >= SECTOR_YEAR_INDEX_THRESHOLD;
  const evergreenUrl = `https://lotexpo.com/secteur/${hub.sectorSlug}`;
  const selfUrl = `https://lotexpo.com/secteur/${hub.sectorSlug}/${year}`;
  const canonicalUrl = indexable ? selfUrl : evergreenUrl;

  const title = `Salons ${hub.sectorLabel} en France en ${year} | Lotexpo`;
  const metaDescription = `${count} salons ${hub.sectorLabel} programmés en ${year} en France. Consultez les dates, lieux, villes, exposants et informations pratiques sur Lotexpo.`.slice(0, 160);

  const cityList = hub.topCities.slice(0, 4).join(', ');
  const intro = count > 0
    ? `Retrouvez les ${count} salons professionnels du secteur ${hub.sectorLabel} programmés en France en ${year}.${cityList ? ` Principales villes représentées : ${cityList}.` : ''} Cette page regroupe les événements de l'année avec leurs dates, villes, lieux et liens vers les fiches détaillées.`
    : `Aucun salon ${hub.sectorLabel} n'est actuellement référencé en France pour l'année ${year} sur Lotexpo.`;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Salons', item: 'https://lotexpo.com' },
      { '@type': 'ListItem', position: 2, name: 'Salons professionnels', item: 'https://lotexpo.com/events' },
      { '@type': 'ListItem', position: 3, name: `Salons ${hub.sectorLabel}`, item: evergreenUrl },
      { '@type': 'ListItem', position: 4, name: `Salons ${hub.sectorLabel} ${year}`, item: selfUrl },
    ],
  };

  const itemListSchema = count > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Salons ${hub.sectorLabel} en France en ${year}`,
    numberOfItems: count,
    itemListElement: hub.upcomingEvents.slice(0, 50).map((e: any, i: number) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://lotexpo.com/events/${e.slug}`,
      name: e.title,
    })),
  } : null;

  const otherYears = hub.yearsBreakdown.filter(y => y.year !== year);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        {!indexable && <meta name="robots" content="noindex,follow" />}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={selfUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Lotexpo" />
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        {itemListSchema && <script type="application/ld+json">{JSON.stringify(itemListSchema)}</script>}
      </Helmet>

      <Header />

      <main className="py-8">
        <div className="w-full px-6 mx-auto max-w-[1600px]">
          <div className="mb-4">
            <Link
              to={`/secteur/${hub.sectorSlug}`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour aux salons {hub.sectorLabel}
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-3">
              Salons {hub.sectorLabel} en France en {year}
            </h1>
            <p className="text-muted-foreground max-w-3xl">{intro}</p>
            <div className="flex flex-wrap gap-3 mt-4">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                {count} salon{count > 1 ? 's' : ''} en {year}
              </Badge>
            </div>
          </div>

          {hub.topCities.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {hub.topCities.map(city => (
                <Link
                  key={city}
                  to={getCityUrl(city)}
                  className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent/10 hover:border-primary/30 transition-colors text-foreground"
                >
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  {city}
                </Link>
              ))}
            </div>
          )}

          {grouped.length > 0 ? (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground mb-6">
                Programme {year}
              </h2>
              <div className="space-y-10">
                {grouped.map(({ monthLabel, events: monthEvents }) => (
                  <div key={monthLabel} className="border-t border-border pt-8 first:border-t-0 first:pt-0">
                    <h3 className="text-2xl font-semibold text-foreground mb-6 capitalize">{monthLabel}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5">
                      {monthEvents.map(e => (
                        <EventCard
                          key={e.id}
                          event={e}
                          view="grid"
                          exhibitorCount={statsMap?.[e.id]?.exhibitor_count}
                          noveltyCount={statsMap?.[e.id]?.novelty_count}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <div className="text-center py-12 mb-8 bg-muted/30 rounded-lg">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">
                Aucun salon {hub.sectorLabel} à venir en {year}.
              </p>
              <Link to={`/secteur/${hub.sectorSlug}`} className="text-primary hover:underline">
                Voir tous les salons {hub.sectorLabel}
              </Link>
            </div>
          )}

          {/* Autres années disponibles */}
          {(otherYears.length > 0 || true) && (
            <section className="mb-12 border-t border-border pt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Autres années disponibles
              </h2>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/secteur/${hub.sectorSlug}`}
                  className="inline-flex items-center text-sm px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-foreground"
                >
                  Tous les salons {hub.sectorLabel}
                </Link>
                <Link
                  to="/salons-professionnels-2026"
                  className="inline-flex items-center text-sm px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent/10 hover:border-primary/30 transition-colors text-foreground"
                >
                  Tous les salons 2026
                </Link>
                {otherYears.map(y => (
                  y.indexable ? (
                    <Link
                      key={y.year}
                      to={`/secteur/${hub.sectorSlug}/${y.year}`}
                      className="inline-flex items-center text-sm px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent/10 hover:border-primary/30 transition-colors text-foreground"
                    >
                      {hub.sectorLabel} {y.year} ({y.count})
                    </Link>
                  ) : (
                    <span
                      key={y.year}
                      className="inline-flex items-center text-sm px-3 py-1.5 rounded-full border border-border bg-muted/30 text-muted-foreground cursor-not-allowed"
                      title="Peu d'événements référencés"
                    >
                      {y.year} : peu d'événements référencés
                    </span>
                  )
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SectorYearHub;