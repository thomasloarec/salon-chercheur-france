import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface NoveltyTileProps {
  novelty: {
    id: string;
    title: string;
    type: string;
    media_urls: string[];
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
    };
    in_user_route?: boolean;
  };
  hoverCycleMs: number;
}

export default function NoveltyTile({ novelty, hoverCycleMs }: NoveltyTileProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isInRoute, setIsInRoute] = useState(novelty.in_user_route || false);
  const [routeCount, setRouteCount] = useState(novelty.novelty_stats?.route_users_count || 0);
  const [isToggling, setIsToggling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const images = novelty.media_urls?.filter(url => {
    // Basic check if URL looks like an image
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  }) || [];

  const hasImages = images.length > 0;
  const hasMultipleImages = images.length > 1;

  useEffect(() => {
    if (isHovered && hasMultipleImages) {
      intervalRef.current = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
      }, hoverCycleMs);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Reset to first image when not hovering
      if (!isHovered) {
        setCurrentImageIndex(0);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isHovered, hasMultipleImages, images.length, hoverCycleMs]);

  const handleRouteToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast({
        title: 'Connexion requise',
        description: 'Connectez-vous pour ajouter des nouveautés à votre parcours.',
        variant: 'destructive',
      });
      return;
    }

    setIsToggling(true);

    try {
      const { data, error } = await supabase.functions.invoke('route-toggle', {
        body: {
          event_id: novelty.events.id,
          novelty_id: novelty.id,
        },
      });

      if (error) throw error;

      setIsInRoute(data.added);
      setRouteCount(data.route_users_count);

      toast({
        title: data.added ? 'Ajouté au parcours' : 'Retiré du parcours',
        description: data.added
          ? 'Cette nouveauté a été ajoutée à votre parcours.'
          : 'Cette nouveauté a été retirée de votre parcours.',
      });
    } catch (error) {
      console.error('Error toggling route:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier votre parcours.',
        variant: 'destructive',
      });
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div
      className="group relative rounded-2xl overflow-hidden shadow-sm border hover:shadow-md transition-all duration-300 hover:-translate-y-1 bg-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        {hasImages ? (
          <>
            <img
              src={images[currentImageIndex]}
              alt={novelty.title}
              className="w-full h-full object-cover transition-opacity duration-300"
              loading="lazy"
            />
            
            {/* Image Counter */}
            {hasMultipleImages && (
              <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                {currentImageIndex + 1}/{images.length}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <div className="text-muted-foreground text-center">
              <div className="text-2xl mb-1">🎯</div>
              <div className="text-sm">{novelty.type}</div>
            </div>
          </div>
        )}

        {/* Hover CTA */}
        {isHovered && !isInRoute && user && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <Button
              size="sm"
              onClick={handleRouteToggle}
              disabled={isToggling}
              className="bg-white/90 text-black hover:bg-white"
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter au parcours
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Company Line */}
        <div className="flex items-center gap-2">
          {novelty.exhibitors.logo_url && (
            <img
              src={novelty.exhibitors.logo_url}
              alt={novelty.exhibitors.name}
              className="w-6 h-6 rounded object-cover"
            />
          )}
          <Link
            to={`/exposants/${novelty.exhibitors.slug}`}
            className="text-sm font-medium hover:underline truncate"
          >
            {novelty.exhibitors.name}
          </Link>
        </div>

        {/* Event Badge */}
        <div className="flex items-center justify-between">
          <Link to={`/events/${novelty.events.slug}#novelties`}>
            <Badge variant="secondary" className="hover:bg-secondary/80 cursor-pointer">
              {novelty.events.nom_event}
            </Badge>
          </Link>
        </div>

        {/* Route Counter */}
        <div className="flex items-center justify-between">
          <h3 className="font-medium line-clamp-2 text-sm leading-tight">
            {novelty.title}
          </h3>
          
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors",
              isInRoute
                ? "bg-emerald-100 text-emerald-700"
                : "bg-neutral-100 text-neutral-600"
            )}
            title={isInRoute ? "Dans votre parcours" : `${routeCount} personnes intéressées`}
          >
            {isInRoute ? (
              <Check className="h-3 w-3" />
            ) : (
              <span>✓</span>
            )}
            <span>{routeCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}