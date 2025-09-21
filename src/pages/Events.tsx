
import { useEffect } from 'react';
import { useEventsList } from '@/hooks/useEventsList';
import { useUrlFilters } from '@/lib/useUrlFilters';
import { EventsResults } from '@/components/EventsResults';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StickyFiltersBar from '@/components/filters/StickyFiltersBar';

const Events = () => {
  const { filters, filtersKey } = useUrlFilters(); // ← source de vérité
  const { data: events, isLoading, error } = useEventsList(filters);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Convert CanonicalEvents to Event format for compatibility
  const displayEvents = events?.map(event => ({
    id: event.id,
    nom_event: event.title,
    description_event: '',
    date_debut: event.start_date || '',
    date_fin: event.end_date || '',
    secteur: event.secteur_labels.join(', '),
    nom_lieu: event.nom_lieu || '',
    ville: event.ville || '',
    country: 'France',
    url_image: event.image_url || '', // Map from canonical to legacy field
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
            {events && (
              <div className="sr-only" aria-hidden="true">
                {/* compteur accessible pour debug */}
                Chargement terminé — {events.length} événements
              </div>
            )}
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
