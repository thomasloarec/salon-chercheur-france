import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Eye, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    <section className="bg-[#0F1424] py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <h2 className="text-3xl md:text-4xl font-bold text-[#E6EAF3]">
            Nouveautés à l'affiche
          </h2>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select>
              <SelectTrigger className="w-[180px] bg-[#11182A] border-white/10 text-[#E6EAF3]">
                <SelectValue placeholder="Secteur" />
              </SelectTrigger>
              <SelectContent className="bg-[#11182A] border-white/10">
                <SelectItem value="all">Tous les secteurs</SelectItem>
                <SelectItem value="tech">Technologie</SelectItem>
                <SelectItem value="health">Santé</SelectItem>
              </SelectContent>
            </Select>

            <Select>
              <SelectTrigger className="w-[180px] bg-[#11182A] border-white/10 text-[#E6EAF3]">
                <SelectValue placeholder="Mois" />
              </SelectTrigger>
              <SelectContent className="bg-[#11182A] border-white/10">
                <SelectItem value="all">Tous les mois</SelectItem>
                <SelectItem value="current">Mois en cours</SelectItem>
              </SelectContent>
            </Select>

            <Select>
              <SelectTrigger className="w-[180px] bg-[#11182A] border-white/10 text-[#E6EAF3]">
                <SelectValue placeholder="Région" />
              </SelectTrigger>
              <SelectContent className="bg-[#11182A] border-white/10">
                <SelectItem value="all">Toutes régions</SelectItem>
                <SelectItem value="idf">Île-de-France</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-[#0B0F19]/60 rounded-xl h-64 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {novelties.map((novelty: any) => (
              <div 
                key={novelty.id}
                onClick={() => navigate(`/nouveautes`)}
                className="bg-[#0B0F19]/60 backdrop-blur-xl rounded-xl p-4 border border-white/10 hover:border-[#FF7A00]/50 transition-all duration-300 cursor-pointer group"
              >
                {/* Image */}
                <div className="relative aspect-video mb-4 rounded-lg overflow-hidden bg-[#11182A]">
                  <img 
                    src={novelty.images?.[0] || '/placeholder.svg'}
                    alt={novelty.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <Badge className="absolute top-2 left-2 bg-[#FF7A00] text-white text-xs">
                    {novelty.type}
                  </Badge>
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold text-[#E6EAF3] mb-2 line-clamp-2 group-hover:text-[#FF7A00] transition-colors">
                  {novelty.title}
                </h3>

                <p className="text-sm text-[#E6EAF3]/70 mb-3">
                  {novelty.exhibitor?.name} • {novelty.event?.nom_event}
                </p>

                {/* Metrics */}
                <div className="flex items-center gap-4 text-xs text-[#E6EAF3]/60">
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
            ))}
          </div>
        )}

        <div className="text-center">
          <Button 
            onClick={() => navigate('/nouveautes')}
            variant="outline"
            className="border-[#FF7A00] text-[#FF7A00] hover:bg-[#FF7A00]/10"
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
