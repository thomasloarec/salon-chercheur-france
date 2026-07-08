import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
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
import RechercheIASidebarTrigger from '@/components/recherche-ia/RechercheIASidebarTrigger';

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

  if (error) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="py-12">
          <div className="text-center">
            <p className="text-destructive">Erreur lors du chargement des événements</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Salons professionnels en France | Lotexpo</title>
        <meta name="description" content="Retrouvez les salons professionnels à venir en France, classés par secteur, ville et période. Calendrier B2B complet, dates, lieux et exposants sur Lotexpo." />
        <link rel="canonical" href="https://lotexpo.com" />
        <meta property="og:title" content="Salons professionnels en France | Lotexpo" />
        <meta property="og:description" content="Retrouvez les salons professionnels à venir en France, classés par secteur, ville et période." />
        <meta property="og:url" content="https://lotexpo.com" />
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
        <div className="container mx-auto px-4">
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
          <div className="mb-10 section-rule">
            <h1 className="heading-display text-3xl md:text-4xl text-foreground">
              Salons professionnels en France
            </h1>
            <p className="text-muted-foreground mt-3 max-w-3xl text-sm md:text-base">
              Retrouvez les salons professionnels à venir en France, classés par secteur, ville et période.{' '}
              <Link to="/salons-professionnels-2026" className="text-accent hover:underline font-medium whitespace-nowrap">
                Voir les salons professionnels 2026 →
              </Link>
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {isLoading ? 'Chargement…' : `${totalCount} salon${totalCount > 1 ? 's' : ''} référencé${totalCount > 1 ? 's' : ''}`}
            </p>
            {data && (
              <div className="sr-only" aria-hidden="true">
                Chargement terminé — {totalCount} événements
              </div>
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

      {/* Recherche IA — déclencheur flottant + sidebar (n'affecte pas la grille) */}
      <RechercheIASidebarTrigger />
    </div>
  );
};

export default Events;
