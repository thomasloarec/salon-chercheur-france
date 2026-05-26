import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Loader2, Calendar, MapPin, Briefcase, ArrowRight, ChevronDown, Clock } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import EventCard from '@/components/EventCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAnnualHub, ANNUAL_HUB_THRESHOLD } from '@/hooks/useAnnualHub';
import type { CanonicalEvent } from '@/types/lotexpo';
import type { Event } from '@/types/event';

const YEAR = 2026;
const CANONICAL = `https://lotexpo.com/salons-professionnels-${YEAR}`;
const TITLE = `Salons professionnels ${YEAR} en France | Lotexpo`;
const DESCRIPTION = `Découvrez les salons professionnels ${YEAR} en France : dates, villes, secteurs d'activité, lieux et événements référencés sur Lotexpo.`;

function toEvent(e: CanonicalEvent): Event {
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

const SalonsAnnualHub = () => {
  const { data, isLoading } = useAnnualHub(YEAR);

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://lotexpo.com' },
      { '@type': 'ListItem', position: 2, name: 'Salons professionnels', item: 'https://lotexpo.com/events' },
      { '@type': 'ListItem', position: 3, name: `Salons professionnels ${YEAR}`, item: CANONICAL },
    ],
  };

  const itemListSchema = data && data.events.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: TITLE,
    numberOfItems: data.totalCount,
    itemListElement: data.events.slice(0, 50).map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://lotexpo.com/events/${e.slug}`,
      name: e.title,
    })),
  } : null;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Lotexpo" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        {itemListSchema && <script type="application/ld+json">{JSON.stringify(itemListSchema)}</script>}
      </Helmet>

      <Header />

      <main>
        {/* Hero */}
        <section className="border-b border-border bg-gradient-to-b from-muted/40 to-background">
          <div className="w-full px-6 mx-auto max-w-[1400px] py-12 md:py-16">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">
                Calendrier annuel
              </p>
              <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
                Salons professionnels {YEAR} en France
              </h1>
              <p className="text-base md:text-lg text-muted-foreground mb-6">
                Retrouvez les salons professionnels programmés en France en {YEAR}. Explorez les
                événements par secteur, ville ou période, puis accédez aux fiches détaillées des
                salons référencés sur Lotexpo.
              </p>
              {data && (
                <div className="flex flex-wrap gap-2 mb-6">
                  <Badge variant="secondary" className="text-sm px-3 py-1.5">
                    <Calendar className="h-3.5 w-3.5 mr-1.5" />
                    {data.totalCount} salon{data.totalCount > 1 ? 's' : ''} à venir
                  </Badge>
                  <Badge variant="secondary" className="text-sm px-3 py-1.5">
                    <Briefcase className="h-3.5 w-3.5 mr-1.5" />
                    {data.sectors.length} secteur{data.sectors.length > 1 ? 's' : ''}
                  </Badge>
                  <Badge variant="secondary" className="text-sm px-3 py-1.5">
                    <MapPin className="h-3.5 w-3.5 mr-1.5" />
                    {data.cities.length} ville{data.cities.length > 1 ? 's' : ''}
                  </Badge>
                  {data.periodLabel && (
                    <Badge variant="outline" className="text-sm px-3 py-1.5">
                      <Clock className="h-3.5 w-3.5 mr-1.5" />
                      {data.periodLabel}
                    </Badge>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <a href="#secteurs">
                    <Briefcase className="h-4 w-4 mr-2" />
                    Explorer par secteur
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href="#prochains">
                    Voir les prochains salons
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="w-full px-6 mx-auto max-w-[1400px] py-12">

          {isLoading && (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {data && (
            <>
              {/* Sectors */}
              {data.sectors.length > 0 && (
                <section id="secteurs" className="mb-16 scroll-mt-24">
                  <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                        Explorer par secteur
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {data.sectors.length} secteurs d'activité représentés en {YEAR}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {data.sectors.map(s => (
                      <Link
                        key={s.slug}
                        to={`/secteur/${s.slug}/${YEAR}`}
                        className="group block p-5 rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                            {s.label}
                          </h3>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {s.count} salon{s.count > 1 ? 's' : ''} en {YEAR}
                        </p>
                        {s.topCities.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {s.topCities.join(' · ')}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Cities */}
              {data.cities.length > 0 && (
                <section id="villes" className="mb-16 scroll-mt-24">
                  <div className="mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                      Explorer par ville
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {data.cities.length} villes accueillent au moins {ANNUAL_HUB_THRESHOLD} salons en {YEAR}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {data.cities.map(c => (
                      <Link
                        key={c.slug}
                        to={`/ville/${c.slug}/${YEAR}`}
                        className="group block p-5 rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {c.name}
                          </h3>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {c.count} salon{c.count > 1 ? 's' : ''} en {YEAR}
                        </p>
                        {c.topSectors.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {c.topSectors.join(' · ')}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Featured */}
              {data.featured.length > 0 && (
                <section id="prochains" className="mb-16 scroll-mt-24">
                  <div className="mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                      Prochains salons professionnels {YEAR}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Les prochains événements référencés sur Lotexpo.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
                    {data.featured.map(e => (
                      <EventCard key={e.id} event={toEvent(e)} view="grid" />
                    ))}
                  </div>
                </section>
              )}

              {/* Calendar by month — native <details> keeps content in the DOM */}
              {data.monthGroups.length > 0 && (
                <section id="calendrier" className="mb-16 scroll-mt-24">
                  <div className="mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                      Calendrier {YEAR} mois par mois
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Parcourez les salons à venir mois par mois.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {data.monthGroups.map((group, idx) => (
                      <details
                        key={group.key}
                        open={idx < 2}
                        className="group rounded-lg border border-border bg-card overflow-hidden"
                      >
                        <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none hover:bg-muted/30 transition-colors">
                          <div className="flex items-baseline gap-3 flex-wrap">
                            <h3 className="text-lg font-semibold text-foreground capitalize">
                              {group.monthLabel}
                            </h3>
                            <span className="text-sm text-muted-foreground">
                              {group.total} salon{group.total > 1 ? 's' : ''}
                            </span>
                          </div>
                          <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="px-5 pb-5 pt-1 border-t border-border/50">
                          <ul className="divide-y divide-border/40">
                            {group.events.map(e => (
                              <li key={e.id} className="py-3 flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <Link
                                    to={`/events/${e.slug}`}
                                    className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                                  >
                                    {e.title}
                                  </Link>
                                  {e.ville && (
                                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {e.ville}
                                    </p>
                                  )}
                                </div>
                                {e.start_date && (
                                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                                    {new Date(e.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                          {group.total > group.events.length && (
                            <p className="mt-4 text-xs text-muted-foreground">
                              + {group.total - group.events.length} autre{group.total - group.events.length > 1 ? 's' : ''} salon{group.total - group.events.length > 1 ? 's' : ''} ce mois-ci —{' '}
                              <Link to="/" className="text-primary hover:underline font-medium">
                                voir tous les salons
                              </Link>
                            </p>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SalonsAnnualHub;