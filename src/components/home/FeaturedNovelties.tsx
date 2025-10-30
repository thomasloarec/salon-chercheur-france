import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Eye, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FeaturedNovelties = () => {
  const navigate = useNavigate();
  
  const { data: novelties = [], isLoading } = useQuery({
    queryKey: ['featured-novelties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('novelties')
        .select(`
          *,
          exhibitor:exhibitors(*),
          event:events(id, nom_event, slug)
        `)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(4);

      if (error) throw error;
      return data || [];
    }
  });

  return (
    <section className="bg-background py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Nouveautés à l'affiche
          </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-muted rounded-xl h-64 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {novelties.map((novelty: any) => {
              // Get first image from media_urls array or use placeholder
              const imageUrl = novelty.media_urls && novelty.media_urls.length > 0 
                ? novelty.media_urls[0] 
                : '/placeholder.svg';
              
              return (
                <div 
                  key={novelty.id}
                  onClick={() => navigate(`/nouveautes`)}
                  className="bg-card backdrop-blur-xl rounded-xl p-4 border border-border hover:border-accent/50 transition-all duration-300 cursor-pointer group"
                >
                  {/* Image */}
                  <div className="relative aspect-video mb-4 rounded-lg overflow-hidden bg-muted">
                    <img 
                      src={imageUrl}
                      alt={novelty.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.svg';
                      }}
                    />
                    <Badge className="absolute top-2 left-2 bg-accent text-accent-foreground text-xs">
                      {novelty.type}
                    </Badge>
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-accent transition-colors">
                    {novelty.title}
                  </h3>

                  <p className="text-sm text-muted-foreground mb-3">
                    {novelty.exhibitor?.name} • {novelty.event?.nom_event}
                  </p>

                  {/* Metrics */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {novelty.metrics_likes || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {novelty.metrics_comments || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {novelty.metrics_views || 0}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-center">
          <Button 
            onClick={() => navigate('/nouveautes')}
            variant="outline"
            className="border-accent text-accent hover:bg-accent/10"
          >
            Voir toutes les Nouveautés
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedNovelties;
