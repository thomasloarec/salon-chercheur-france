import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft } from 'lucide-react';
import NoveltyCard from '@/components/novelty/NoveltyCard';
import ExhibitorsSidebar from '@/components/event/ExhibitorsSidebar';
import EventPracticalInfoCard from '@/components/event/EventPracticalInfoCard';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useNovelties } from '@/hooks/useNovelties';
import { convertSecteurToString } from '@/utils/sectorUtils';
import type { Event } from '@/types/event';

type SortBy = 'awaited' | 'recent';

const EventNovelties = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sortParam = searchParams.get('sort') as SortBy | null;
  const sortBy: SortBy = sortParam === 'recent' ? 'recent' : 'awaited';

  const [page, setPage] = useState(1);
  const [allNovelties, setAllNovelties] = useState<any[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const pageSize = 20;

  // Fetch event
  useEffect(() => {
    const fetchEvent = async () => {
      if (!slug) {
        setError('Slug manquant');
        setLoading(false);
        return;
      }

      try {
        const isAdmin = user?.email === 'admin@lotexpo.com';
        
        let query = supabase
          .from('events')
          .select('*')
          .eq('slug', slug);

        if (!isAdmin) {
          query = query.eq('visible', true);
        }

        const { data, error: fetchError } = await query.maybeSingle();

        if (fetchError) {
          setError('Erreur lors du chargement de l\'événement');
          setLoading(false);
          return;
        }

        if (!data) {
          setError('Événement introuvable');
          setLoading(false);
          return;
        }

        // Check if favorite
        let isFavorite = false;
        if (user && data) {
          const { data: favoriteData } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', user.id)
            .eq('event_uuid', data.id)
            .maybeSingle();
          isFavorite = !!favoriteData;
        }

        const typedEvent: Event = {
          id: data.id,
          id_event: data.id_event,
          nom_event: data.nom_event || '',
          description_event: data.description_event,
          date_debut: data.date_debut,
          date_fin: data.date_fin,
          secteur: convertSecteurToString(data.secteur),
          nom_lieu: data.nom_lieu,
          ville: data.ville,
          country: data.pays,
          url_image: data.url_image,
          url_site_officiel: data.url_site_officiel,
          tags: [],
          tarif: data.tarif,
          affluence: data.affluence,
          estimated_exhibitors: undefined,
          is_b2b: data.is_b2b,
          type_event: data.type_event as Event['type_event'],
          created_at: data.created_at,
          updated_at: data.updated_at,
          last_scraped_at: undefined,
          scraped_from: undefined,
          rue: data.rue,
          code_postal: data.code_postal,
          visible: data.visible,
          slug: data.slug,
          sectors: [],
          is_favorite: isFavorite
        };

        setEvent(typedEvent);
      } catch (err) {
        console.error('Error fetching event:', err);
        setError('Une erreur inattendue s\'est produite');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [slug, user]);

  // Fetch novelties
  const { data: noveltiesData, isLoading: isLoadingNovelties } = useNovelties({
    event_id: event?.id,
    sort: sortBy,
    page,
    pageSize,
    enabled: !!event?.id
  });

  // Update all novelties list
  useEffect(() => {
    if (noveltiesData?.data) {
      if (page === 1) {
        setAllNovelties(noveltiesData.data);
      } else {
        setAllNovelties(prev => [...prev, ...noveltiesData.data]);
      }
      setLoadingMore(false);
    }
  }, [noveltiesData, page]);

  // Reset page when sort changes
  useEffect(() => {
    setPage(1);
    setAllNovelties([]);
  }, [sortBy]);

  const handleSortChange = (newSort: SortBy) => {
    const params = new URLSearchParams(searchParams);
    if (newSort === 'awaited') {
      params.delete('sort');
    } else {
      params.set('sort', newSort);
    }
    setSearchParams(params);
  };

  const handleLoadMore = () => {
    setLoadingMore(true);
    setPage(prev => prev + 1);
  };

  const hasMore = noveltiesData ? allNovelties.length < noveltiesData.total : false;

  if (loading || !event) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-40 bg-muted rounded-2xl" />
                ))}
              </div>
              <div className="lg:col-span-4">
                <div className="h-64 bg-muted rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Erreur</h1>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main content */}
          <div className="lg:col-span-8 space-y-6">
            {/* Back link */}
            <Link
              to={`/events/${event.slug}`}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Retour à l'événement
            </Link>

            {/* Header with filters */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h1 className="text-2xl font-semibold">
                Toutes les nouveautés
              </h1>

              {/* Filter buttons */}
              <div className="inline-flex gap-2">
                <Button
                  variant={sortBy === 'awaited' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSortChange('awaited')}
                  aria-pressed={sortBy === 'awaited'}
                >
                  Les plus attendus
                </Button>
                <Button
                  variant={sortBy === 'recent' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSortChange('recent')}
                  aria-pressed={sortBy === 'recent'}
                >
                  Récents
                </Button>
              </div>
            </div>

            {/* Loading state */}
            {isLoadingNovelties && page === 1 ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                {/* Empty state */}
                {allNovelties.length === 0 ? (
                  <div className="rounded-2xl border p-8 text-center bg-muted/50">
                    <p className="text-sm text-muted-foreground">
                      Aucune nouveauté à afficher
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Novelties feed */}
                    <div className="space-y-6">
                      {allNovelties.map((novelty) => (
                        <NoveltyCard key={novelty.id} novelty={novelty} />
                      ))}
                    </div>

                    {/* Load more button */}
                    {hasMore && (
                      <div className="text-center">
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
              </>
            )}
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-6">
            <EventPracticalInfoCard event={event} />
            <ExhibitorsSidebar event={event} />
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default EventNovelties;
