import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Calendar, Building2, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNoveltyLike, useNoveltyLikesCount } from '@/hooks/useNoveltyLike';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ✅ Labels alignés avec le formulaire de création (Step2NoveltyDetails)
const TYPE_LABELS: Record<string, string> = {
  Launch: 'Lancement produit',
  Update: 'Mise à jour',
  Demo: 'Démonstration',
  Special_Offer: 'Offre spéciale',
  Partnership: 'Partenariat',
  Innovation: 'Innovation',
};

interface NoveltyTileProps {
  novelty: {
    id: string;
    title: string;
    type: string;
    reason_1?: string;
    media_urls?: string[];
    created_at: string;
    exhibitors: {
      id: string;
      name: string;
      slug?: string;
      logo_url?: string;
    };
    events: {
      id: string;
      nom_event: string;
      slug: string;
      date_debut?: string;
    };
    novelty_stats?: {
      route_users_count: number;
    };
  };
  hoverCycleMs?: number;
  className?: string;
}

export default function NoveltyTile({ novelty, className }: NoveltyTileProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isLiked, toggleLike, isPending } = useNoveltyLike(novelty.id);
  const { data: likesCount, isLoading: likesLoading } = useNoveltyLikesCount(novelty.id);

  // Sécurité : vérifier que exhibitors existe
  const exhibitor = novelty.exhibitors ?? {
    id: novelty.id,
    name: 'Exposant inconnu',
    slug: '',
    logo_url: undefined
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      navigate('/auth');
      return;
    }

    toggleLike();
  };

  const mainImage = novelty.media_urls?.[0];
  const typeLabel = TYPE_LABELS[novelty.type] || novelty.type;

  return (
    <Card className={cn("group overflow-hidden hover:shadow-xl transition-all duration-300", className)}>
      <Link to={`/events/${novelty.events.slug}`} className="block">
        {/* Image Header avec format carré - fond gris pour les images non carrées */}
        <div className="relative aspect-square overflow-hidden bg-muted">
          {mainImage ? (
            <>
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <img
                  src={mainImage}
                  alt={novelty.title}
                  className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              {/* Gradient overlay pour meilleure lisibilité des badges */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10 pointer-events-none" />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Building2 className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}

          {/* Badge type en haut à gauche */}
          <div className="absolute top-3 left-3">
            <Badge className="bg-white/95 text-foreground border-0 shadow-lg backdrop-blur-sm">
              {typeLabel}
            </Badge>
          </div>

          {/* Bouton Like en haut à droite */}
          <div className="absolute top-3 right-3">
            <Button
              size="sm"
              variant={isLiked ? "default" : "secondary"}
              onClick={handleLikeClick}
              disabled={isPending || likesLoading}
              className={cn(
                "gap-2 shadow-lg backdrop-blur-sm transition-all",
                isLiked 
                  ? "bg-red-500 hover:bg-red-600 text-white" 
                  : "bg-white/95 hover:bg-white text-foreground"
              )}
            >
              <Heart 
                className={cn(
                  "h-4 w-4 transition-all",
                  isLiked && "fill-current"
                )} 
              />
              <span className="font-semibold">
                {likesLoading ? '...' : likesCount || 0}
              </span>
            </Button>
          </div>

          {/* Badge trending si beaucoup de likes */}
          {(likesCount || 0) >= 10 && (
            <div className="absolute bottom-3 left-3">
              <Badge className="bg-orange-500 text-white border-0 shadow-lg gap-1">
                <TrendingUp className="h-3 w-3" />
                Tendance
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <CardContent className="p-4 space-y-3">
          {/* Titre de la nouveauté - PRIORITÉ VISUELLE */}
          <h3 className="font-bold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {novelty.title}
          </h3>

          {/* Description courte */}
          {novelty.reason_1 && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {novelty.reason_1}
            </p>
          )}

          {/* Séparateur subtil */}
          <div className="border-t pt-3" />

          {/* Footer : Exposant + Événement */}
          <div className="space-y-2">
            {/* Exposant avec logo */}
            <div className="flex items-center gap-2">
              {exhibitor.logo_url ? (
                <div className="w-6 h-6 rounded bg-white flex items-center justify-center flex-shrink-0 border">
                  <img
                    src={exhibitor.logo_url}
                    alt={exhibitor.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
              <span className="text-sm font-medium text-foreground truncate">
                {exhibitor.name}
              </span>
            </div>

            {/* Événement en badge secondaire */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">
                {novelty.events.nom_event}
              </span>
              {novelty.events.date_debut && (
                <>
                  <span>•</span>
                  <span className="flex-shrink-0">
                    {format(new Date(novelty.events.date_debut), 'dd MMM yyyy', { locale: fr })}
                  </span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
