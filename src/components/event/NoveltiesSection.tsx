import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import NoveltyCard from '@/components/novelty/NoveltyCard';
import AddNoveltyButton from '@/components/novelty/AddNoveltyButton';
import { useNovelties } from '@/hooks/useNovelties';
import type { Event } from '@/types/event';

interface NoveltiesSectionProps {
  event: Event;
}

export default function NoveltiesSection({ event }: NoveltiesSectionProps) {
  // Fetch only 2 novelties for preview on event page
  const { data: noveltiesData, isLoading, error } = useNovelties({
    event_id: event.id,
    sort: 'awaited',
    page: 1,
    pageSize: 2,
    enabled: !!event.id
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
  const novelties = noveltiesData?.data || [];

  // Empty state
  if (!error && total === 0) {
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
    <div className="space-y-4">
      {/* Header with count and add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Nouveautés</h2>
          <Badge variant="secondary">
            {total} nouveauté{total > 1 ? 's' : ''}
          </Badge>
        </div>
        <AddNoveltyButton event={event} />
      </div>

      {/* Grid of 2 novelties */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {novelties.map((novelty) => (
          <div key={novelty.id} className="h-full">
            <NoveltyCard novelty={novelty} />
          </div>
        ))}
      </div>

      {/* CTA to view all novelties (LinkedIn-style) */}
      {total > 2 && (
        <Link
          to={`/events/${event.slug}/nouveautes`}
          className="block w-full rounded-xl border p-4 text-center text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Voir les ${total} nouveautés de ${event.nom_event}`}
        >
          Afficher toutes les nouveautés →
        </Link>
      )}
    </div>
  );
}