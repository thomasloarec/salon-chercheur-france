import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StickyFiltersBar from '@/components/filters/StickyFiltersBar';
import NoveltyTile from '@/components/novelty/NoveltyTile';
import NoveltiesEmptyState from '@/components/novelty/NoveltiesEmptyState';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useUrlFilters } from '@/lib/useUrlFilters'; 
import { useNoveltiesList } from '@/hooks/useNoveltiesList';

interface Novelty {
  id: string;
  title: string;
  type: string;
  media_urls: string[];
  created_at: string;
  exhibitors: {
    id: string;
    name: string;
    slug: string;
    logo_url?: string;
  };
  events: {
    id: string;
    nom_event: string;
    slug: string;
    ville: string;
  };
  novelty_stats: {
    route_users_count: number;
    popularity_score: number;
  };
  in_user_route?: boolean;
}

const HOVER_CYCLE_MS = 3000;

export default function Nouveautes() {
  const filters = useUrlFilters(); // ← source de vérité
  const [page, setPage] = useState(1);
  
  // Reset page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [filters]);
  
  const { data: noveltiesResponse, isLoading, error, refetch } = useNoveltiesList(filters, {
    page,
    pageSize: 12
  });

  const novelties = noveltiesResponse?.data || [];
  const hasMore = (noveltiesResponse?.data?.length || 0) >= 12;
  const loading = isLoading && page === 1;
  const loadingMore = isLoading && page > 1;

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  const hasActiveFilters = !!(filters.sector || filters.type || filters.month || filters.region);

  return (
    <>
      <Helmet>
        <title>Nouveautés - LotExpo</title>
        <meta 
          name="description" 
          content="Découvrez les dernières nouveautés des salons professionnels. Innovations, lancements produits et tendances à ne pas manquer." 
        />
      </Helmet>

      <Header />
      <StickyFiltersBar />
      
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Hero Section - Only show when there are results */}
          {!loading && !error && novelties.length > 0 && (
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                Nouveautés des salons
              </h1>
              <p className="text-lg text-muted-foreground mb-6">
                {hasActiveFilters
                  ? `Découvrez les nouveautés filtrées des salons professionnels`
                  : `Découvrez les nouveautés les plus attendues des salons professionnels`
                }
              </p>
              
              <p className="text-sm text-muted-foreground">
                {novelties.length} nouveauté{novelties.length !== 1 ? 's' : ''} trouvée{novelties.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-12">
              <p className="text-destructive mb-4">Erreur lors du chargement des nouveautés</p>
              <Button onClick={() => refetch()} variant="outline">
                Réessayer
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && novelties.length === 0 && (
            <NoveltiesEmptyState hasActiveFilters={hasActiveFilters} />
          )}

          {/* Novelties Grid */}
          {!loading && !error && novelties.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {novelties.map((novelty) => (
                  <NoveltyTile
                    key={novelty.id}
                    novelty={{
                      ...novelty,
                      events: novelty.events || {
                        id: '',
                        nom_event: '',
                        slug: '',
                        ville: ''
                      },
                      novelty_stats: novelty.novelty_stats || {
                        route_users_count: 0,
                        popularity_score: 0
                      }
                    }}
                    hoverCycleMs={HOVER_CYCLE_MS}
                  />
                ))}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="text-center">
                  <Button
                    onClick={loadMore}
                    disabled={loadingMore}
                    variant="outline"
                    className="min-w-32"
                  >
                    {loadingMore && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {loadingMore ? 'Chargement...' : 'Charger plus'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}