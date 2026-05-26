import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, Calendar, Building2, ArrowLeft } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import EventCard from '@/components/EventCard';
import { useCityHub, CITY_YEAR_INDEX_THRESHOLD } from '@/hooks/useCityHub';
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

const CityYearHub = () => {
  const { slug, year: yearParam } = useParams<{ slug: string; year: string }>();
  const year = Number(yearParam);
  const yearValid = Number.isInteger(year) && year >= 2020 && year <= 2099;

  const { data: hub, isLoading, error } = useCityHub(slug, { year: yearValid ? year : null });

  const grouped = useMemo(() => {
    if (!hub?.upcomingEvents?.length) return [];
    return groupEventsByMonth(hub.upcomingEvents.map(canonicalToEvent));
  }, [hub?.upcomingEvents]);

  if (!yearValid) {
    return <Navigate to={`/ville/${slug ?? ''}`} replace />;
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
        <Header />
        <main className="py-24 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Ville introuvable</h1>
          <Link to="/" className="text-primary hover:underline">Retour à l'accueil</Link>
        </main>
        <Footer />
      </div>
    );
  }

  const count = hub.upcomingEvents.length;
  const indexable = count >= CITY_YEAR_INDEX_THRESHOLD;
  const evergreenUrl = `https://lotexpo.com/ville/${hub.citySlug}`;
  const selfUrl = `https://lotexpo.com/ville/${hub.citySlug}/${year}`;
  const canonicalUrl = indexable ? selfUrl : evergreenUrl;

  const title = `Salons professionnels à ${hub.cityName} en ${year} | Lotexpo`;
  const metaDescription = `${count} salons professionnels programmés à ${hub.cityName} en ${year}. Consultez les dates, lieux, secteurs, exposants et informations pratiques sur Lotexpo.`.slice(0, 160);

  const sectorList = hub.topSectors.slice(0, 4).join(', ');
  const venueList = hub.topVenues.slice(0, 3).join(', ');
  const intro = count > 0
    ? `Retrouvez les ${count} salons professionnels programmés à ${hub.cityName} en ${year}.${sectorList ? ` Principaux secteurs représentés : ${sectorList}.` : ''}${venueList ? ` Principaux lieux d'exposition : ${venueList}.` : ''} Cette page regroupe les événements à venir avec leurs dates, lieux, secteurs d'activité et liens vers les fiches détaillées.`
    : `Aucun salon professionnel n'est actuellement référencé à ${hub.cityName} pour l'année ${year} sur Lotexpo.`;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://lotexpo.com' },
      { '@type': 'ListItem', position: 2, name: 'Salons professionnels', item: 'https://lotexpo.com/events' },
      { '@type': 'ListItem', position: 3, name: `Salons à ${hub.cityName}`, item: evergreenUrl },
      { '@type': 'ListItem', position: 4, name: `Salons à ${hub.cityName} ${year}`, item: selfUrl },
    ],
  };

  const itemListSchema = count > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Salons professionnels à ${hub.cityName} en ${year}`,
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
              to={`/ville/${hub.citySlug}`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour aux salons à {hub.cityName}
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-3">
              Salons professionnels à {hub.cityName} en {year}
            </h1>
            <p className="text-muted-foreground max-w-3xl">{intro}</p>
            <div className="flex flex-wrap gap-3 mt-4">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                {count} salon{count > 1 ? 's' : ''} en {year}
              </Badge>
            </div>
          </div>

          {hub.topVenues.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {hub.topVenues.map(venue => (
                <span
                  key={venue}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground"
                >
                  <Building2 className="h-3 w-3" />
                  {venue}
                </span>
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
                        <EventCard key={e.id} event={e} view="grid" />
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
                Aucun salon n'est référencé à {hub.cityName} pour l'année {year}.
              </p>
              <Link to={`/ville/${hub.citySlug}`} className="text-primary hover:underline">
                Voir tous les salons à {hub.cityName}
              </Link>
            </div>
          )}

          <section className="mb-12 border-t border-border pt-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Autres années disponibles
            </h2>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/ville/${hub.citySlug}`}
                className="inline-flex items-center text-sm px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-foreground"
              >
                Tous les salons à {hub.cityName}
              </Link>
              {otherYears.map(y => (
                y.indexable ? (
                  <Link
                    key={y.year}
                    to={`/ville/${hub.citySlug}/${y.year}`}
                    className="inline-flex items-center text-sm px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent/10 hover:border-primary/30 transition-colors text-foreground"
                  >
                    {hub.cityName} {y.year} ({y.count})
                  </Link>
                ) : (
                  <span
                    key={y.year}
                    className="inline-flex items-center text-sm px-3 py-1.5 rounded-full border border-border bg-muted/30 text-muted-foreground cursor-not-allowed"
                    title="Peu d'événements référencés"
                  >
                    {y.year} : peu d'événements référencés ({y.count})
                  </span>
                )
              ))}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CityYearHub;