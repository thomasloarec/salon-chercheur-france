import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Loader2, Calendar, MapPin, Briefcase } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import EventCard from '@/components/EventCard';
import { Badge } from '@/components/ui/badge';
import { useAnnualHub } from '@/hooks/useAnnualHub';
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

      <main className="py-8">
        <div className="w-full px-6 mx-auto max-w-[1400px]">
          <header className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Salons professionnels {YEAR} en France
            </h1>
            <p className="text-muted-foreground max-w-3xl">
              Retrouvez les salons professionnels programmés en France en {YEAR}. Cette page
              regroupe les événements à venir par mois, secteur et ville, avec des liens vers
              les fiches détaillées des salons référencés sur Lotexpo.
            </p>
            {data && (
              <div className="flex flex-wrap gap-3 mt-4">
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  <Calendar className="h-3.5 w-3.5 mr-1.5" />
                  {data.totalCount} salon{data.totalCount > 1 ? 's' : ''} à venir
                </Badge>
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  <Briefcase className="h-3.5 w-3.5 mr-1.5" />
                  {data.sectors.length} secteur{data.sectors.length > 1 ? 's' : ''}
                </Badge>
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  <MapPin className="h-3.5 w-3.5 mr-1.5" />
                  {data.cities.length} ville{data.cities.length > 1 ? 's' : ''}
                </Badge>
              </div>
            )}
          </header>

          {isLoading && (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {data && (
            <>
              {/* Sectors */}
              {data.sectors.length > 0 && (
                <section className="mb-12">
                  <h2 className="text-2xl font-semibold text-foreground mb-4">
                    Salons {YEAR} par secteur
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {data.sectors.map(s => (
                      <Link
                        key={s.slug}
                        to={`/secteur/${s.slug}/${YEAR}`}
                        className="inline-flex items-center text-sm px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent/10 hover:border-primary/30 transition-colors text-foreground"
                      >
                        Salons {s.label} {YEAR}
                        <span className="ml-1.5 text-muted-foreground">({s.count})</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Cities */}
              {data.cities.length > 0 && (
                <section className="mb-12">
                  <h2 className="text-2xl font-semibold text-foreground mb-4">
                    Salons {YEAR} par ville
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {data.cities.map(c => (
                      <Link
                        key={c.slug}
                        to={`/ville/${c.slug}/${YEAR}`}
                        className="inline-flex items-center text-sm px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent/10 hover:border-primary/30 transition-colors text-foreground"
                      >
                        Salons professionnels à {c.name} en {YEAR}
                        <span className="ml-1.5 text-muted-foreground">({c.count})</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Featured */}
              {data.featured.length > 0 && (
                <section className="mb-12">
                  <h2 className="text-2xl font-semibold text-foreground mb-6">
                    Prochains salons à venir
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5">
                    {data.featured.map(e => (
                      <EventCard key={e.id} event={toEvent(e)} view="grid" />
                    ))}
                  </div>
                </section>
              )}

              {/* By month */}
              {data.monthGroups.length > 0 && (
                <section className="mb-12">
                  <h2 className="text-2xl font-semibold text-foreground mb-6">
                    Calendrier {YEAR} mois par mois
                  </h2>
                  <div className="space-y-10">
                    {data.monthGroups.map(group => (
                      <div key={group.monthLabel} className="border-t border-border pt-8 first:border-t-0 first:pt-0">
                        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
                          <h3 className="text-xl font-semibold text-foreground capitalize">{group.monthLabel}</h3>
                          <span className="text-sm text-muted-foreground">
                            {group.total} salon{group.total > 1 ? 's' : ''}
                          </span>
                        </div>
                        <ul className="space-y-2">
                          {group.events.map(e => (
                            <li key={e.id} className="flex flex-wrap gap-x-2 text-sm">
                              <Link to={`/events/${e.slug}`} className="text-primary hover:underline font-medium">
                                {e.title}
                              </Link>
                              {e.ville && <span className="text-muted-foreground">— {e.ville}</span>}
                              {e.start_date && (
                                <span className="text-muted-foreground">
                                  ({new Date(e.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })})
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                        {group.total > group.events.length && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            + {group.total - group.events.length} autre{group.total - group.events.length > 1 ? 's' : ''} salon{group.total - group.events.length > 1 ? 's' : ''} ce mois-ci —{' '}
                            <Link to="/" className="text-primary hover:underline">voir tous les salons sur la home</Link>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Internal linking */}
              <section className="mb-12 border-t border-border pt-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">Explorer Lotexpo</h2>
                <div className="flex flex-wrap gap-3 text-sm">
                  <Link to="/" className="text-primary hover:underline">Tous les salons à venir</Link>
                  <span className="text-muted-foreground">·</span>
                  <Link to="/events" className="text-primary hover:underline">Calendrier complet</Link>
                  <span className="text-muted-foreground">·</span>
                  <Link to="/exposants" className="text-primary hover:underline">Exposants</Link>
                  <span className="text-muted-foreground">·</span>
                  <Link to="/nouveautes" className="text-primary hover:underline">Nouveautés</Link>
                  <span className="text-muted-foreground">·</span>
                  <Link to="/blog" className="text-primary hover:underline">Blog</Link>
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SalonsAnnualHub;