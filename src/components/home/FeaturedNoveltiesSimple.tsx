import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NoveltyTile from '@/components/novelty/NoveltyTile';

interface Novelty {
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
}

const FeaturedNoveltiesSimple = () => {
  const navigate = useNavigate();

  const { data: novelties, isLoading } = useQuery({
    queryKey: ['featured-novelties-simple'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      // Fetch novelties with their related data
      const { data, error } = await supabase
        .from('novelties')
        .select(`
          id,
          title,
          type,
          reason_1,
          media_urls,
          created_at,
          exhibitors!inner (
            id,
            name,
            slug,
            logo_url
          ),
          events!inner (
            id,
            nom_event,
            slug,
            date_debut,
            visible
          ),
          novelty_stats (
            route_users_count
          )
        `)
        .eq('status', 'published')
        .eq('events.visible', true)
        .gte('events.date_debut', today)
        .order('created_at', { ascending: false })
        .limit(4);

      if (error) throw error;

      return (data || []) as Novelty[];
    }
  });

  if (isLoading) {
    return (
      <section className="bg-muted/30 py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Nouveautés à l'affiche des salons
            </h2>
          </div>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </section>
    );
  }

  if (!novelties || novelties.length === 0) {
    return null;
  }

  return (
    <section className="bg-muted/30 py-16 px-4">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {novelties.map((novelty) => (
            <NoveltyTile key={novelty.id} novelty={novelty} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedNoveltiesSimple;
