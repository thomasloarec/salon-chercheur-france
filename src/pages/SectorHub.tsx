import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronRight, Loader2, Calendar, MapPin, ArrowRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import EventCard from '@/components/EventCard';
import { useSectorHub } from '@/hooks/useSectorHub';
import { useSectorArticles } from '@/hooks/useSectorArticles';
import { getCityUrl } from '@/lib/cityUrl';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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

const SectorHub = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: hub, isLoading, error } = useSectorHub(slug);
  const { data: articles = [] } = useSectorArticles(hub?.sectorLabel ? [hub.sectorLabel] : []);

  // Group upcoming events by month
  const groupedUpcoming = useMemo(() => {
    if (!hub?.upcomingEvents?.length) return [];
    const events = hub.upcomingEvents.map(canonicalToEvent);
    return groupEventsByMonth(events);
  }, [hub?.upcomingEvents]);

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
          <h1 className="text-2xl font-bold text-foreground mb-2">Secteur introuvable</h1>
          <p className="text-muted-foreground mb-6">Ce secteur n'existe pas ou n'a aucun salon associé.</p>
          <Link to="/" className="text-primary hover:underline">Retour à l'accueil</Link>
        </main>
        <Footer />
      </div>
    );
  }

  const canonicalUrl = `https://lotexpo.com/secteur/${hub.sectorSlug}`;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://lotexpo.com" },
      { "@type": "ListItem", "position": 2, "name": "Salons professionnels", "item": "https://lotexpo.com/events" },
      { "@type": "ListItem", "position": 3, "name": `Salons ${hub.sectorLabel}`, "item": canonicalUrl },
    ],
  };

  const title = `Salons ${hub.sectorLabel} en France | Lotexpo`;
  const metaDescription = `${hub.upcomingEvents.length} salon(s) ${hub.sectorLabel} à venir en France. Dates, lieux, exposants et informations pratiques sur Lotexpo.`;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={metaDescription.slice(0, 160)} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="Lotexpo" />
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      <Header />

      <main className="py-8">
        <div className="w-full px-6 mx-auto max-w-[1600px]">
          {/* Breadcrumb */}
          <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap mb-6">
            <Link to="/" className="hover:text-foreground transition-colors">Accueil</Link>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            <Link to="/events" className="hover:text-foreground transition-colors">Salons professionnels</Link>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-foreground font-medium">Salons {hub.sectorLabel}</span>
          </nav>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-3">
              Salons {hub.sectorLabel} en France
            </h1>
            <p className="text-muted-foreground max-w-3xl">{hub.description}</p>

            {/* Stats */}
            <div className="flex flex-wrap gap-3 mt-4">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                {hub.upcomingEvents.length} salon{hub.upcomingEvents.length > 1 ? 's' : ''} à venir
              </Badge>
              <Badge variant="outline" className="text-sm px-3 py-1">
                {hub.totalCount} salon{hub.totalCount > 1 ? 's' : ''} au total
              </Badge>
            </div>
          </div>

          {/* Top cities */}
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

          {/* Upcoming events grouped by month */}
          {groupedUpcoming.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground mb-6">
                Salons {hub.sectorLabel} à venir
              </h2>
              <div className="space-y-10">
                {groupedUpcoming.map(({ monthLabel, events: monthEvents }) => (
                  <div key={monthLabel} className="border-t border-border pt-8 first:border-t-0 first:pt-0">
                    <h3 className="text-2xl font-semibold text-foreground mb-6 capitalize">
                      {monthLabel}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5">
                      {monthEvents.map(e => (
                        <EventCard key={e.id} event={e} view="grid" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* No upcoming events message */}
          {hub.upcomingEvents.length === 0 && (
            <div className="text-center py-12 mb-8 bg-muted/30 rounded-lg">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                Aucun salon {hub.sectorLabel} à venir n'est actuellement publié.
              </p>
            </div>
          )}

          {/* Past events */}
          {hub.pastEvents.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground mb-2">
                Éditions précédentes
              </h2>
              <p className="text-sm text-muted-foreground mb-6">Ces salons ont déjà eu lieu.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5 opacity-75">
                {hub.pastEvents.slice(0, 10).map(e => (
                  <EventCard key={e.id} event={canonicalToEvent(e)} view="grid" />
                ))}
              </div>
            </section>
          )}

          {/* Blog articles */}
          {articles.length > 0 && (
            <section className="mb-12">
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <ArrowRight className="h-5 w-5 text-primary" />
                Articles liés au secteur {hub.sectorLabel}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {articles.map(article => (
                  <Link key={article.id} to={`/blog/${article.slug}`} className="group">
                    <Card className="p-4 h-full hover:shadow-md transition-shadow border-primary/10 hover:border-primary/30">
                      <h3 className="font-medium text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors mb-2">
                        {article.title}
                      </h3>
                      {article.intro_text && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{article.intro_text}</p>
                      )}
                    </Card>
                  </Link>
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

export default SectorHub;
