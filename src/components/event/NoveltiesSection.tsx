import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2 } from 'lucide-react';
import NoveltyCard from '@/components/novelty/NoveltyCard';
import NoveltyPager from '@/components/novelty/NoveltyPager';
import AddNoveltyButton from '@/components/novelty/AddNoveltyButton';
import { useNovelties } from '@/hooks/useNovelties';
import type { Event } from '@/types/event';

interface NoveltiesSectionProps {
  event: Event;
}

export default function NoveltiesSection({ event }: NoveltiesSectionProps) {
  const [sortBy, setSortBy] = useState<'awaited' | 'recent'>('awaited');
  const [page, setPage] = useState(1);
  const [allNovelties, setAllNovelties] = useState<any[]>([]);
  const [currentNoveltyIndex, setCurrentNoveltyIndex] = useState(0);
  // Initialize from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sortParam = params.get('sort');
    if (sortParam === 'recent') {
      setSortBy('recent');
    }
  }, []);

  const [loadingMore, setLoadingMore] = useState(false);

  const pageSize = 10;

  const { data: noveltiesData, isLoading, error } = useNovelties({
    event_id: event.id,
    sort: sortBy,
    page,
    pageSize,
    enabled: !!event.id
  });

  // Update novelties when data changes
  useEffect(() => {
    if (noveltiesData?.data) {
      if (page === 1) {
        setAllNovelties(noveltiesData.data);
        setCurrentNoveltyIndex(0);
      } else {
        setAllNovelties(prev => [...prev, ...noveltiesData.data]);
      }
    }
  }, [noveltiesData, page]);

  // Update URL with sort param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (sortBy === 'awaited') {
      params.delete('sort');
    } else {
      params.set('sort', sortBy);
    }
    
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, [sortBy]);

  const handleLoadMore = () => {
    setLoadingMore(true);
    setPage(prev => prev + 1);
  };

  useEffect(() => {
    if (!isLoading) {
      setLoadingMore(false);
    }
  }, [isLoading]);

  const hasMore = noveltiesData ? allNovelties.length < noveltiesData.total : false;
  const currentNovelty = allNovelties[currentNoveltyIndex];

  const handlePreviousNovelty = () => {
    if (currentNoveltyIndex > 0) {
      setCurrentNoveltyIndex(prev => prev - 1);
      // Scroll to the novelty
      const noveltyElement = document.getElementById(`novelty-${allNovelties[currentNoveltyIndex - 1]?.id}`);
      if (noveltyElement) {
        noveltyElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleNextNovelty = () => {
    if (currentNoveltyIndex < allNovelties.length - 1) {
      setCurrentNoveltyIndex(prev => prev + 1);
      // Scroll to the novelty
      const noveltyElement = document.getElementById(`novelty-${allNovelties[currentNoveltyIndex + 1]?.id}`);
      if (noveltyElement) {
        noveltyElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  if (isLoading && page === 1) {
    return (
      <section className="py-8">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </section>
    );
  }

  return (
    <section className="py-8" id="nouveautes">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Nouveautés</h2>
            <p className="text-muted-foreground">
              Découvrez les innovations présentées lors de cet événement
              {noveltiesData && (
                <Badge variant="secondary" className="ml-2">
                  {noveltiesData.total} nouveauté{noveltiesData.total !== 1 ? 's' : ''}
                </Badge>
              )}
            </p>
          </div>
          
          <AddNoveltyButton event={event} />
        </div>

        {/* Sort Tabs */}
        <Tabs value={sortBy} onValueChange={(value) => setSortBy(value as 'awaited' | 'recent')} className="mb-6">
          <TabsList>
            <TabsTrigger value="awaited">Les plus attendus</TabsTrigger>
            <TabsTrigger value="recent">Récents</TabsTrigger>
          </TabsList>

          <TabsContent value={sortBy} className="space-y-6">
            {/* Error State */}
            {error && (
              <div className="text-center py-8">
                <p className="text-destructive mb-4">Erreur lors du chargement des nouveautés</p>
                <Button onClick={() => window.location.reload()} variant="outline">
                  Réessayer
                </Button>
              </div>
            )}

            {/* Empty State */}
            {!error && allNovelties.length === 0 && !isLoading && (
              <div className="text-center py-12 bg-muted/50 rounded-lg">
                <h3 className="text-xl font-semibold mb-2">Aucune nouveauté pour le moment</h3>
                <p className="text-muted-foreground mb-4">
                  Les exposants n'ont pas encore publié de nouveautés pour cet événement.
                </p>
                <AddNoveltyButton event={event} variant="outline" />
              </div>
            )}

            {/* Novelties List */}
            {allNovelties.length > 0 && (
              <>
                <div className="space-y-8">
                  {allNovelties.map((novelty, index) => (
                    <div
                      key={novelty.id}
                      id={`novelty-${novelty.id}`}
                      className={`scroll-mt-24 ${
                        index === currentNoveltyIndex ? 'ring-2 ring-primary ring-offset-4 rounded-2xl' : ''
                      }`}
                    >
                      <NoveltyCard novelty={novelty} />
                    </div>
                  ))}
                </div>

                {/* Load More Button */}
                {hasMore && (
                  <div className="text-center pt-6">
                    <Button
                      onClick={handleLoadMore}
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Novelty Pager */}
      {allNovelties.length > 1 && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-background/95 backdrop-blur border rounded-lg shadow-lg">
            <NoveltyPager
              currentIndex={currentNoveltyIndex}
              total={allNovelties.length}
              onPrevious={handlePreviousNovelty}
              onNext={handleNextNovelty}
            />
          </div>
        </div>
      )}
    </section>
  );
}