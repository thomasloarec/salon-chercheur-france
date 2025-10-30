import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Download, Heart, MessageCircle, Eye, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import CalendlyModal from '@/components/modals/CalendlyModal';
import AuthRequiredModal from '@/components/AuthRequiredModal';

interface MockNovelty {
  id: string;
  title: string;
  type: string;
  excerpt: string;
  images: string[];
  brochureUrl?: string;
  exhibitor: { name: string; logo?: string };
  fair: { name: string; startDate: string; endDate: string; city: string; venue: string };
  tags: string[];
  metrics: { likes: number; comments: number; views: number };
  calendlyUrl?: string;
}

const mockNovelty: MockNovelty = {
  id: '1',
  title: 'Lancement du capteur X-200 "Zero Drift"',
  type: 'Lancement produit',
  excerpt: 'Démo en live d\'un capteur sub-ppm avec API temps réel. Offre salon : kit dev -20% et créneau 1:1 de 15 min.',
  images: ['/placeholder.svg'],
  brochureUrl: '/brochures/x200.pdf',
  exhibitor: { name: 'NexaSense', logo: undefined },
  fair: { 
    name: 'SIDO Lyon', 
    startDate: '2025-09-18', 
    endDate: '2025-09-19', 
    city: 'Lyon',
    venue: 'Cité Internationale'
  },
  tags: ['Technologie & Innovation', 'IoT'],
  metrics: { likes: 128, comments: 23, views: 1942 },
  calendlyUrl: 'https://calendly.com/example'
};

const HeroNovelty = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showCalendly, setShowCalendly] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [liked, setLiked] = useState(false);

  const daysUntilEvent = Math.ceil(
    (new Date(mockNovelty.fair.startDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  const handleLike = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setLiked(!liked);
  };

  const handleDownload = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    // Track download
    console.log('Brochure downloaded');
  };

  const handleRequestMeeting = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setShowCalendly(true);
  };

  return (
    <section className="relative min-h-[90vh] bg-[#0B0F19] text-[#E6EAF3] py-16 px-4 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FF7A00]/5 via-transparent to-[#5B9DFF]/5" />
      
      <div className="relative max-w-7xl mx-auto">
        {/* Main heading */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Avant d'ouvrir leurs portes, <span className="text-[#FF7A00]">les salons commencent ici.</span>
          </h1>
          <p className="text-lg md:text-xl text-[#E6EAF3]/80 max-w-4xl mx-auto">
            Les exposants attirent leurs premiers leads avant le salon. Les visiteurs repèrent les stands à ne pas manquer et optimisent chaque déplacement.
          </p>
        </div>

        {/* Two column layout */}
        <div className="grid xl:grid-cols-12 gap-8 items-start">
          {/* Left: Large Novelty Card */}
          <div className="xl:col-span-7">
            <div className="bg-[#0F1424]/80 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl hover:shadow-[#FF7A00]/20 transition-shadow duration-300">
              {/* Event badge and countdown */}
              <div className="flex items-center gap-3 mb-4">
                <Badge className="bg-[#FF7A00] text-white hover:bg-[#FF7A00]/90">
                  Événement à venir
                </Badge>
                <span className="text-sm text-[#E6EAF3]/70">J-{daysUntilEvent}</span>
              </div>

              {/* Image */}
              <div className="relative aspect-video mb-6 rounded-xl overflow-hidden bg-[#11182A]">
                <img 
                  src={mockNovelty.images[0]} 
                  alt={mockNovelty.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Type badge */}
              <Badge variant="outline" className="mb-3 border-[#5B9DFF] text-[#5B9DFF]">
                {mockNovelty.type}
              </Badge>

              {/* Title */}
              <h2 className="text-2xl md:text-3xl font-bold mb-4">{mockNovelty.title}</h2>

              {/* Exhibitor & Fair info */}
              <div className="space-y-2 mb-4 text-sm text-[#E6EAF3]/80">
                <p><strong className="text-[#FF7A00]">Exposant :</strong> {mockNovelty.exhibitor.name}</p>
                <p>
                  <strong className="text-[#FF7A00]">Salon :</strong> {mockNovelty.fair.name} — {' '}
                  {new Date(mockNovelty.fair.startDate).toLocaleDateString('fr-FR')} – {' '}
                  {new Date(mockNovelty.fair.endDate).toLocaleDateString('fr-FR')} — {' '}
                  {mockNovelty.fair.venue}, {mockNovelty.fair.city}
                </p>
              </div>

              {/* Excerpt */}
              <p className="text-[#E6EAF3]/90 mb-6 leading-relaxed">{mockNovelty.excerpt}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-6">
                {mockNovelty.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-[#11182A] text-[#E6EAF3]">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Metrics */}
              <div className="flex items-center gap-6 mb-6 text-sm text-[#E6EAF3]/70">
                <button 
                  onClick={handleLike}
                  className="flex items-center gap-2 hover:text-[#FF7A00] transition-colors"
                >
                  <Heart className={`h-5 w-5 ${liked ? 'fill-[#FF7A00] text-[#FF7A00]' : ''}`} />
                  <span>{mockNovelty.metrics.likes + (liked ? 1 : 0)}</span>
                </button>
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  <span>{mockNovelty.metrics.comments}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  <span>{mockNovelty.metrics.views}</span>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={handleRequestMeeting}
                  className="flex-1 bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-white"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Réserver un RDV
                </Button>
                <Button 
                  onClick={handleDownload}
                  variant="outline"
                  className="flex-1 border-[#5B9DFF] text-[#5B9DFF] hover:bg-[#5B9DFF]/10"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger la brochure
                </Button>
              </div>
            </div>
          </div>

          {/* Right: Persona Panel */}
          <div className="xl:col-span-5">
            <div className="bg-[#0F1424]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/10 sticky top-24">
              <Tabs defaultValue="visitors" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-[#11182A]">
                  <TabsTrigger value="visitors" className="data-[state=active]:bg-[#FF7A00]">
                    Visiteurs
                  </TabsTrigger>
                  <TabsTrigger value="exhibitors" className="data-[state=active]:bg-[#FF7A00]">
                    Exposants
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="visitors" className="space-y-6">
                  <p className="text-lg text-[#E6EAF3]/90 leading-relaxed">
                    Découvrez les annonces des exposants (démos, lancements, offres salon) 
                    et décidez si le déplacement vaut le coup.
                  </p>
                  
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-[#FF7A00] flex-shrink-0 mt-1" />
                      <span>Voyez les démos et offres qui vous concernent</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-[#FF7A00] flex-shrink-0 mt-1" />
                      <span>Réservez des RDV ciblés sur les stands utiles</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-[#FF7A00] flex-shrink-0 mt-1" />
                      <span>Ne ratez plus aucun événement de votre secteur</span>
                    </li>
                  </ul>

                  <Button 
                    onClick={() => navigate('/nouveautes')}
                    className="w-full bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-white"
                  >
                    Découvrir les Nouveautés
                  </Button>
                </TabsContent>

                <TabsContent value="exhibitors" className="space-y-6">
                  <p className="text-lg text-[#E6EAF3]/90 leading-relaxed">
                    Publiez vos Nouveautés, attirez des rendez-vous avant l'ouverture 
                    et rentabilisez votre stand.
                  </p>
                  
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-[#FF7A00] flex-shrink-0 mt-1" />
                      <span>Captez des RDV avant l'ouverture</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-[#FF7A00] flex-shrink-0 mt-1" />
                      <span>Sortez de la "loterie de l'emplacement"</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-[#FF7A00] flex-shrink-0 mt-1" />
                      <span>Centralisez vos leads et mesurez l'impact</span>
                    </li>
                  </ul>

                  <Button 
                    onClick={() => navigate('/agenda')}
                    className="w-full bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-white"
                  >
                    Publier une Nouveauté
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>

      {showCalendly && (
        <CalendlyModal 
          url={mockNovelty.calendlyUrl || ''}
          onClose={() => setShowCalendly(false)}
        />
      )}

      {showAuthModal && (
        <AuthRequiredModal
          open={showAuthModal}
          onOpenChange={setShowAuthModal}
        />
      )}
    </section>
  );
};

export default HeroNovelty;
