import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import NoveltyCard from '@/components/novelty/NoveltyCard';
import AddNoveltyButton from '@/components/novelty/AddNoveltyButton';
import { NoveltiesPreLaunchBanner } from './NoveltiesPreLaunchBanner';
import { NoveltyNotificationDialog } from './NoveltyNotificationDialog';
import { useNovelties } from '@/hooks/useNovelties';
import type { Event } from '@/types/event';

type SortBy = 'awaited' | 'recent';

interface NoveltiesSectionProps {
  event: Event;
}

export default function NoveltiesSection({ event }: NoveltiesSectionProps) {
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('awaited');
  const [page, setPage] = useState(1);
  const [allNovelties, setAllNovelties] = useState<any[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const pageSize = 10;
  
  // Fetch novelties with pagination
  const { data: noveltiesData, isLoading, error } = useNovelties({
    event_id: event.id,
    sort: sortBy,
    page,
    pageSize,
    enabled: !!event.id
  });

  // Reset page and novelties when sort changes
  useEffect(() => {
    setPage(1);
    setAllNovelties([]);
  }, [sortBy]);

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
  }, [noveltiesData?.data, page]);

  // Calculer si on est en phase de pré-lancement (plus de 60 jours avant l'événement)
  const daysUntilEvent = differenceInDays(new Date(event.date_debut), new Date());
  const isPreLaunch = daysUntilEvent > 60;

  console.log('🔍 NoveltiesSection debug:', {
    event_id: event.id,
    total: noveltiesData?.total,
    displayed: noveltiesData?.data?.length,
    isLoading,
    error,
    daysUntilEvent,
    isPreLaunch
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-7 w-32 bg-muted animate-pulse rounded" />
          <div className="h-5 w-24 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-40 bg-muted animate-pulse rounded-2xl" />
          <div className="h-40 bg-muted animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  const total = noveltiesData?.total || 0;
  const hasMore = allNovelties.length < total;

  const handleLoadMore = () => {
    setLoadingMore(true);
    setPage(prev => prev + 1);
  };

  // Empty state - Si pré-lancement ET aucune nouveauté, afficher le banner spécial
  if (!error && total === 0) {
    if (isPreLaunch) {
      return (
        <>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Nouveautés</h2>
            </div>
            
            <NoveltiesPreLaunchBanner
              eventDate={event.date_debut}
              eventName={event.nom_event}
              onNotifyMe={() => setNotificationDialogOpen(true)}
            />
          </div>

          {/* Dialog de notification */}
          <NoveltyNotificationDialog
            open={notificationDialogOpen}
            onOpenChange={setNotificationDialogOpen}
            eventId={event.id}
            eventName={event.nom_event}
            eventDate={event.date_debut}
            eventSlug={event.slug}
          />
        </>
      );
    }

    // Cas normal : événement proche mais pas de nouveautés
    return (
      <div className="rounded-2xl border p-8 text-center bg-muted/50">
        <h3 className="text-xl font-semibold mb-2">Aucune nouveauté pour le moment</h3>
        <p className="text-muted-foreground mb-4">
          Les exposants n'ont pas encore publié de nouveautés pour cet événement.
        </p>
        <AddNoveltyButton event={event} variant="outline" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-2xl border p-8 text-center">
        <p className="text-destructive mb-4">Erreur lors du chargement des nouveautés</p>
        <button 
          onClick={() => window.location.reload()} 
          className="text-sm text-primary hover:underline"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with title, info, and add button */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold">Nouveautés</h2>
            <Badge variant="secondary">
              {total} nouveauté{total > 1 ? 's' : ''}
            </Badge>
          </div>
          <AddNoveltyButton event={event} />
        </div>
        
        {/* Explanatory text */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          Les exposants publient leurs nouveautés pour attirer l'attention des visiteurs avant l'événement. 
          Découvrez en avant-première les innovations qui seront présentées et identifiez les stands que vous souhaitez absolument visiter le jour J.
        </p>

        {/* Filter buttons */}
        <div className="flex gap-2">
          <Button
            variant={sortBy === 'awaited' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('awaited')}
            aria-pressed={sortBy === 'awaited'}
          >
            Les plus attendues
          </Button>
          <Button
            variant={sortBy === 'recent' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('recent')}
            aria-pressed={sortBy === 'recent'}
          >
            Récentes
          </Button>
        </div>
      </div>

      {/* Novelties list */}
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
            {loadingMore ? 'Chargement...' : 'Voir plus'}
          </Button>
        </div>
      )}
    </div>
  );
}