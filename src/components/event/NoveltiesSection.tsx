import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2, Rocket } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import NoveltyCard from '@/components/novelty/NoveltyCard';
import AddNoveltyButton from '@/components/novelty/AddNoveltyButton';
import { NoveltiesPreLaunchBanner } from './NoveltiesPreLaunchBanner';
import { NoveltyNotificationDialog } from './NoveltyNotificationDialog';
import { useInfiniteNovelties } from '@/hooks/useInfiniteNovelties';
import type { Event } from '@/types/event';
import { Button } from '@/components/ui/button';

type SortBy = 'awaited' | 'recent';

interface NoveltiesSectionProps {
  event: Event;
}

export default function NoveltiesSection({ event }: NoveltiesSectionProps) {
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('awaited');
  const loaderRef = useRef<HTMLDivElement>(null);
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteNovelties({
    event_id: event.id,
    sort: sortBy,
    pageSize: 10,
    enabled: !!event.id
  });

  // Intersection Observer pour le scroll infini
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const option = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    };
    const observer = new IntersectionObserver(handleObserver, option);
    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }
    return () => observer.disconnect();
  }, [handleObserver]);

  // Calculer si on est en phase de pré-lancement (plus de 60 jours avant l'événement)
  const daysUntilEvent = differenceInDays(new Date(event.date_debut), new Date());
  const isPreLaunch = daysUntilEvent > 60;

  // Flatten all pages into a single array
  const allNovelties = data?.pages.flatMap(page => page.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  console.log('🔍 NoveltiesSection debug:', {
    event_id: event.id,
    total,
    displayed: allNovelties.length,
    hasNextPage,
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
      <div className="rounded-2xl border border-[#ffe8d9] p-6 sm:p-8 text-center bg-[#ffe8d9]/40 overflow-hidden">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-[#ff751f]/10 flex items-center justify-center">
            <Rocket className="h-6 w-6 text-[#ff751f]" />
          </div>
        </div>
        <h3 className="text-xl font-semibold mb-2">Soyez parmi les premiers à vous démarquer sur cet événement</h3>
        <p className="text-muted-foreground mb-5 max-w-lg mx-auto">
          Les exposants peuvent publier ici leurs nouveautés, lancements produits ou annonces clés, visibles par les visiteurs de l'événement.
        </p>
        <div className="flex justify-center">
          <AddNoveltyButton 
            event={event} 
            variant="outline" 
            className="max-w-full text-sm sm:text-base whitespace-normal h-auto py-2 border-[#ff751f]/30 hover:bg-[#ff751f]/5" 
            label="👤 Exposant : publier une nouveauté"
          />
        </div>
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
    <div className="flex justify-end">
      {/* Container aligné à droite style LinkedIn - proche de la sidebar */}
      <div className="w-full max-w-xl space-y-6">
        {/* Header with title, info, and add button */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold">Nouveautés</h2>
              <Badge variant="secondary" className="whitespace-nowrap">
                {total} nouveauté{total > 1 ? 's' : ''}
              </Badge>
            </div>
            <AddNoveltyButton event={event} label="Ajouter" className="w-full sm:w-auto" />
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

        {/* Infinite scroll loader */}
        <div ref={loaderRef} className="flex justify-center py-4">
          {isFetchingNextPage && (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  );
}
