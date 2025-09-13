import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StickyFiltersBar from '@/components/filters/StickyFiltersBar';
import NoveltyTile from '@/components/novelty/NoveltyTile';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
  const [searchParams] = useSearchParams();
  const [novelties, setNovelties] = useState<Novelty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const pageSize = 12;

  const fetchNovelties = async (pageNum: number, reset = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const params = new URLSearchParams();
      params.set('page', pageNum.toString());
      params.set('pageSize', pageSize.toString());
      
      // Add filters from search params
      const sector = searchParams.get('sector');
      const type = searchParams.get('type');
      const month = searchParams.get('month');
      const region = searchParams.get('region');

      if (sector) params.set('sector', sector);
      if (type) params.set('type', type);
      if (month) params.set('month', month);
      if (region) params.set('region', region);

      const { data, error } = await supabase.functions.invoke('novelties-list', {
        body: Object.fromEntries(params.entries())
      });

      if (error) throw error;

      const result = data;
      
      if (reset || pageNum === 1) {
        setNovelties(result.data || []);
      } else {
        setNovelties(prev => [...prev, ...(result.data || [])]);
      }

      setHasMore((result.data?.length || 0) === pageSize);
      setError(null);
    } catch (err) {
      console.error('Error fetching novelties:', err);
      setError('Erreur lors du chargement des nouveautés');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Fetch on mount and when filters change
  useEffect(() => {
    setPage(1);
    fetchNovelties(1, true);
  }, [searchParams]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNovelties(nextPage);
  };

  const hasActiveFilters = !!(
    searchParams.get('sector') ||
    searchParams.get('type') ||
    searchParams.get('month') ||
    searchParams.get('region')
  );

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
      <StickyFiltersBar defaultCollapsed />
      
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Hero Section */}
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
            
            {!loading && (
              <p className="text-sm text-muted-foreground">
                {novelties.length} nouveauté{novelties.length !== 1 ? 's' : ''} trouvée{novelties.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-12">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={() => fetchNovelties(1, true)} variant="outline">
                Réessayer
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && novelties.length === 0 && (
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold mb-2">Aucune nouveauté trouvée</h2>
              <p className="text-muted-foreground">
                {hasActiveFilters
                  ? 'Essayez de modifier vos filtres pour voir plus de résultats.'
                  : 'Les nouveautés seront bientôt disponibles.'
                }
              </p>
            </div>
          )}

          {/* Novelties Grid */}
          {!loading && !error && novelties.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {novelties.map((novelty) => (
                  <NoveltyTile
                    key={novelty.id}
                    novelty={novelty}
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