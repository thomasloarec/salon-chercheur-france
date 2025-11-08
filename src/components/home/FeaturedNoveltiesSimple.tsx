import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, ArrowRight, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays } from 'date-fns';

const FeaturedNoveltiesSimple = () => {
  const navigate = useNavigate();
  
  const { data: novelties = [], isLoading } = useQuery({
    queryKey: ['home-featured-novelties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('novelties')
        .select(`
          *,
          exhibitors(name, slug),
          events!inner(id, nom_event, slug, date_debut, visible)
        `)
        .eq('status', 'published')
        .eq('events.visible', true)
        .gte('events.date_debut', new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false })
        .limit(4);

      if (error) throw error;

      // Fetch likes and comments for these novelties
      const noveltyIds = data?.map(n => n.id) || [];
      
      const [likesData, commentsData] = await Promise.all([
        supabase.from('novelty_likes').select('novelty_id').in('novelty_id', noveltyIds),
        supabase.from('novelty_comments').select('novelty_id').in('novelty_id', noveltyIds)
      ]);

      const likesMap = (likesData.data || []).reduce((acc, like) => {
        acc[like.novelty_id] = (acc[like.novelty_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const commentsMap = (commentsData.data || []).reduce((acc, comment) => {
        acc[comment.novelty_id] = (acc[comment.novelty_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return (data || []).map(n => ({
        ...n,
        likes_count: likesMap[n.id] || 0,
        comments_count: commentsMap[n.id] || 0
      }));
    }
  });

  return (
    <section className="bg-secondary py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Nouveautés à l'affiche des salons
          </h2>
          <Button 
            onClick={() => navigate('/nouveautes')}
            variant="ghost"
            className="text-accent hover:text-accent/80"
          >
            Voir toutes les Nouveautés
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-muted rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {novelties.map((novelty: any) => {
              const imageUrl = novelty.media_urls?.[0] || '/placeholder.svg';
              const daysUntil = novelty.events?.date_debut 
                ? differenceInDays(new Date(novelty.events.date_debut), new Date())
                : null;
              
              return (
                <div 
                  key={novelty.id}
                  onClick={() => navigate(`/nouveautes`)}
                  className="bg-card rounded-2xl overflow-hidden border border-border hover:border-accent/50 transition-all duration-300 cursor-pointer group"
                >
                  <div className="relative aspect-video bg-muted">
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
                    {daysUntil !== null && daysUntil > 0 && (
                      <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs">
                        J-{daysUntil}
                      </Badge>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-accent transition-colors">
                      {novelty.title}
                    </h3>

                    <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                      {novelty.exhibitors?.name}
                    </p>
                    
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {novelty.events?.nom_event}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {novelty.likes_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {novelty.comments_count}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default FeaturedNoveltiesSimple;
