
import { useEffect } from 'react';
import { useEventsList } from '@/hooks/useEventsList';
import { useUrlFilters } from '@/lib/useUrlFilters';
import { EventsResults } from '@/components/EventsResults';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StickyFiltersBar from '@/components/filters/StickyFiltersBar';

const Events = () => {
  const filters = useUrlFilters(); // ← source de vérité
  const { data: events, isLoading, error } = useEventsList(filters);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Transform events to match EventsResults expected format
  const displayEvents = events?.map(event => ({
    id: event.id,
    nom_event: event.nom_event,
    description_event: '', // Not available in new format
    date_debut: event.date_debut,
    date_fin: event.date_fin,
    secteur: event.secteur,
    nom_lieu: event.nom_lieu,
    ville: event.ville,
    country: 'France', // Default
    url_image: event.url_image,
    url_site_officiel: event.url_site_officiel,
    tags: [], // Not available
    tarif: '', // Not available in this query
    affluence: '', // Not available in this query
    estimated_exhibitors: undefined,
    is_b2b: event.is_b2b,
    type_event: (event.type_event as any) || 'salon', // Type assertion for compatibility
    created_at: '', // Not selected
    updated_at: '', // Not selected
    last_scraped_at: undefined,
    scraped_from: undefined,
    rue: event.rue,
    code_postal: event.code_postal,
    visible: event.visible,
    slug: event.slug,
    sectors: event.event_sectors?.map(es => ({
      id: es.sectors.id,
      name: es.sectors.name,
      created_at: '',
    })) || []
  })) || [];

  const hasActiveFilters = !!(filters.sector || filters.type || filters.month || filters.region);

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
      <Header />
      <StickyFiltersBar />
      
      <main className="py-8">
        <div className="w-full px-6 mx-auto">
          {/* Header with results count */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              {isLoading ? 'Chargement...' : `${displayEvents.length || 0} salon(s) trouvé(s)`}
            </h1>
            {hasActiveFilters && (
              <p className="text-gray-600 mt-2">
                Résultats filtrés
                {filters.sector && (
                  <span className="ml-2 text-accent font-medium">
                    • Secteur: {filters.sector}
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

          {/* Results with month grouping */}
          <EventsResults events={displayEvents} isLoading={isLoading} />
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Events;
