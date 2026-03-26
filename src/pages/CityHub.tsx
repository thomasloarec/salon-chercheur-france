import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, Calendar, Building2 } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import EventCard from '@/components/EventCard';
import { useCityHub } from '@/hooks/useCityHub';
import { useSectors } from '@/hooks/useSectors';
import { SectorIconBar } from '@/components/filters/SectorIconBar';
import { sectorWithCanonicalSlug } from '@/utils/sectorMapping';
import { sectorLabelToSlug } from '@/lib/taxonomy';
import { Badge } from '@/components/ui/badge';
import { groupEventsByMonth } from '@/utils/eventGrouping';
import type { Event } from '@/types/event';
import { useState } from 'react';

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

const CityHub = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: hub, isLoading, error } = useCityHub(slug);
  const { data: allSectors = [] } = useSectors();
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);

  // Build the list of sectors present in this city's events for the icon bar
  const citySectorSlugs = useMemo(() => {
    if (!hub) return new Set<string>();
    const slugs = new Set<string>();
    [...hub.upcomingEvents, ...hub.pastEvents].forEach(e => {
      e.secteur_labels?.forEach((label: string) => {
        const s = sectorLabelToSlug(label);
        if (s) slugs.add(s);
      });
    });
    return slugs;
  }, [hub]);

  // Filter allSectors to only those present in the city
  const citySectors = useMemo(() => {
    return allSectors
      .map(s => sectorWithCanonicalSlug(s))
      .filter(s => citySectorSlugs.has(s.slug));
  }, [allSectors, citySectorSlugs]);

  // Filter events by selected sector
  const filterBySector = (events: any[]) => {
    if (selectedSectors.length === 0) return events;
    return events.filter(e => {
      const labels = e.secteur_labels || [];
      return labels.some((label: string) => {
        const s = sectorLabelToSlug(label);
        return s && selectedSectors.includes(s);
      });
    });
  };

  const filteredUpcoming = useMemo(() => {
    if (!hub) return [];
    return filterBySector(hub.upcomingEvents).map(canonicalToEvent);
  }, [hub, selectedSectors]);

  const filteredPast = useMemo(() => {
    if (!hub) return [];
    return filterBySector(hub.pastEvents).map(canonicalToEvent);
  }, [hub, selectedSectors]);

  // Group upcoming events by month
  const groupedUpcoming = useMemo(() => {
    if (!filteredUpcoming.length) return [];
    return groupEventsByMonth(filteredUpcoming);
  }, [filteredUpcoming]);

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
          <p className="text-muted-foreground mb-6">Aucun salon trouvé pour cette ville ou le seuil minimum n'est pas atteint.</p>
          <Link to="/" className="text-primary hover:underline">Retour à l'accueil</Link>
        </main>
        <Footer />
      </div>
    );
  }

  const canonicalUrl = `https://lotexpo.com/ville/${hub.citySlug}`;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://lotexpo.com" },
      { "@type": "ListItem", "position": 2, "name": "Salons professionnels", "item": "https://lotexpo.com/events" },
      { "@type": "ListItem", "position": 3, "name": `Salons à ${hub.cityName}`, "item": canonicalUrl },
    ],
  };

  const title = `Salons professionnels à ${hub.cityName} | Lotexpo`;
  const metaDescription = `${hub.upcomingEvents.length} salon(s) professionnel(s) à venir à ${hub.cityName}. Calendrier complet, secteurs et informations pratiques sur Lotexpo.`;

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

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-3">
              Salons professionnels à {hub.cityName}
            </h1>
            <p className="text-muted-foreground max-w-3xl">{hub.description}</p>

            {/* Stats */}
            <div className="flex flex-wrap gap-3 mt-4">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                {hub.upcomingEvents.length} salon{hub.upcomingEvents.length > 1 ? 's' : ''} à venir
              </Badge>
              {citySectors.length > 0 && (
                <Badge variant="outline" className="text-sm px-3 py-1">
                  {citySectors.length} secteur{citySectors.length > 1 ? 's' : ''} représentés
                </Badge>
              )}
            </div>
          </div>

          {/* Sector icon bar — same as home page */}
          {citySectors.length > 0 && (
            <div className="mb-8">
              <SectorIconBar
                sectors={citySectors}
                selected={selectedSectors}
                onChange={setSelectedSectors}
              />
            </div>
          )}

          {/* Top venues */}
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

          {/* Upcoming events grouped by month */}
          {groupedUpcoming.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground mb-6">
                Salons à venir à {hub.cityName}
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

          {/* No upcoming events */}
          {filteredUpcoming.length === 0 && (
            <div className="text-center py-12 mb-8 bg-muted/30 rounded-lg">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {selectedSectors.length > 0
                  ? `Aucun salon à venir dans ce secteur à ${hub.cityName}.`
                  : `Aucun salon à venir à ${hub.cityName} n'est actuellement publié.`}
              </p>
            </div>
          )}

          {/* Past events */}
          {filteredPast.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground mb-2">
                Éditions précédentes
              </h2>
              <p className="text-sm text-muted-foreground mb-6">Ces salons ont déjà eu lieu.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5 opacity-75">
                {filteredPast.slice(0, 10).map(e => (
                  <EventCard key={e.id} event={e} view="grid" />
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

export default CityHub;
