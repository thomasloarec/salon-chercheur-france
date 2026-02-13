import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useInfiniteEvents } from '@/hooks/useInfiniteEvents';
import { useUrlFilters } from '@/lib/useUrlFilters';
import { useSectors } from '@/hooks/useSectors';
import { EventsResultsInfinite } from '@/components/EventsResultsInfinite';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StickyFiltersBar from '@/components/filters/StickyFiltersBar';
import { SectorIconBar } from '@/components/filters/SectorIconBar';
import { Loader2 } from 'lucide-react';
import { sectorWithCanonicalSlug } from '@/utils/sectorMapping';

const Events = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, filtersKey } = useUrlFilters();
  const { 
    data, 
    isLoading, 
    error, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useInfiniteEvents({ filters, pageSize: 24 });
  const { data: sectors = [], isLoading: sectorsLoading } = useSectors();

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Handler for sector selection changes
  const handleSectorsChange = (selectedSlugs: string[]) => {
    const newParams = new URLSearchParams(searchParams);
    if (selectedSlugs.length > 0) {
      newParams.set('sectors', selectedSlugs.join(','));
    } else {
      newParams.delete('sectors');
    }
    setSearchParams(newParams);
  };

  // Flatten all pages into a single array of events
  const allEvents = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.data);
  }, [data?.pages]);

  // Get total count from the first page
  const totalCount = data?.pages?.[0]?.total ?? 0;

  // Convert CanonicalEvents to Event format for compatibility
  const displayEvents = allEvents.map(event => ({
    id: event.id,
    nom_event: event.title,
    description_event: '',
    date_debut: event.start_date || '',
    date_fin: event.end_date || '',
    secteur: event.secteur_labels.join(', '),
    nom_lieu: event.nom_lieu || '',
    ville: event.ville || '',
    country: 'France',
    url_image: event.image_url || '',
    url_site_officiel: event.url_site_officiel || '',
    tags: [],
    tarif: '',
    affluence: '',
    estimated_exhibitors: undefined,
    is_b2b: event.is_b2b,
    type_event: (event.type_code || 'salon') as "salon" | "convention" | "congres" | "conference" | "exposition" | "forum" | "autre",
    created_at: '',
    updated_at: '',
    last_scraped_at: undefined,
    scraped_from: undefined,
    rue: event.rue || '',
    code_postal: event.code_postal || '',
    visible: event.visible || true,
    slug: event.slug,
    sectors: []
  }));

  const hasActiveFilters = !!(filters.sectors.length > 0 || filters.type || filters.month || filters.region);

  if (error) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="py-12">
          <div className="text-center">
            <p className="text-red-600">Erreur lors du chargement des événements</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>Salons professionnels en France | Calendrier B2B – Lotexpo</title>
        <meta name="description" content="Lotexpo référence tous les salons professionnels B2B en France. Dates, lieux, secteurs, exposants et informations pratiques en un seul site." />
        <link rel="canonical" href="https://lotexpo.com/events" />
        <meta property="og:title" content="Salons professionnels en France | Calendrier B2B – Lotexpo" />
        <meta property="og:description" content="Lotexpo référence tous les salons professionnels B2B en France. Dates, lieux, secteurs, exposants et informations pratiques en un seul site." />
        <meta property="og:url" content="https://lotexpo.com/events" />
        <meta property="og:site_name" content="Lotexpo" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Lotexpo",
            "url": "https://lotexpo.com"
          })}
        </script>
      </Helmet>
      <Header />
      
      {/* Filters: Type / Month / Region */}
      <StickyFiltersBar />

      {/* Sector Icon Bar - Horizontal carousel */}
      <div className="sticky top-[calc(4rem+3.5rem)] z-30 bg-background border-b">
        <div className="container mx-auto">
          {sectorsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <SectorIconBar
              sectors={sectors.map(s => sectorWithCanonicalSlug(s))}
              selected={filters.sectors}
              onChange={handleSectorsChange}
            />
          )}
        </div>
      </div>
      
      <main className="py-8">
        <div className="w-full px-6 mx-auto">
          {/* Header with results count */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              {isLoading ? 'Chargement...' : `${totalCount} salon(s) trouvé(s)`}
            </h1>
            {data && (
              <div className="sr-only" aria-hidden="true">
                Chargement terminé — {totalCount} événements
              </div>
            )}
            {hasActiveFilters && (
              <p className="text-gray-600 mt-2">
                Résultats filtrés
                {filters.sectors.length > 0 && (
                  <span className="ml-2 text-accent font-medium">
                    • Secteur{filters.sectors.length > 1 ? 's' : ''}: {filters.sectors.join(', ')}
                  </span>
                )}
                {filters.type && (
                  <span className="ml-2 text-accent font-medium">
                    • Type: {filters.type}
                  </span>
                )}
                {filters.month && (
                  <span className="ml-2 text-accent font-medium">
                    • Mois: {filters.month}
                  </span>
                )}
                {filters.region && (
                  <span className="ml-2 text-accent font-medium">
                    • Région: {filters.region}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Results with infinite scroll */}
          <EventsResultsInfinite 
            events={displayEvents} 
            isLoading={isLoading}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage ?? false}
            fetchNextPage={fetchNextPage}
            totalCount={totalCount}
          />
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Events;
