import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Download, Heart, MessageCircle, Eye, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import lakantoImage from '@/assets/lakanto-almonds.jpg';
import scalapayImage from '@/assets/scalapay-payplug.jpg';
import eatonImage from '@/assets/eaton-dubai.jpg';

interface MockNovelty {
  id: string;
  title: string;
  type: string;
  excerpt: string;
  image: string;
  exhibitor: { name: string };
  fair: { name: string; startDate: string; endDate: string; city: string; venue: string };
  tags: string[];
  metrics: { likes: number; comments: number; views: number };
}

const mockNovelties: MockNovelty[] = [
  {
    id: '1',
    title: 'Lakanto Sweet & Savory Almonds : 3 nouvelles saveurs sans sucre',
    type: 'Lancement produit',
    excerpt: "Après des années de développement, nous lançons notre nouvelle gamme d'amandes épicées sans sucre ajouté. 3 saveurs audacieuses : Smokey BBQ, Cajun Style et Honey Habanero. L'équilibre parfait entre goût intense et snacking santé.",
    image: lakantoImage,
    exhibitor: { name: 'Lakanto' },
    fair: { 
      name: 'Snack Show',
      startDate: '2026-04-01',
      endDate: '2026-04-02',
      city: 'Paris',
      venue: 'Porte de Versailles'
    },
    tags: ['Agroalimentaire', 'Innovation'],
    metrics: { likes: 342, comments: 67, views: 2847 }
  },
  {
    id: '2',
    title: 'Scalapay choisit Payplug pour accélérer en Europe',
    type: 'Partenariat',
    excerpt: "Alliance stratégique entre Scalapay et Payplug : acquisition des flux de paiement pour maximiser l'autorisation des transactions et déploiement de la solution de paiement fractionné auprès des marchands Payplug dès Q1. Une innovation commune pour l'e-commerce européen.",
    image: scalapayImage,
    exhibitor: { name: 'Scalapay' },
    fair: { 
      name: 'Tech Show',
      startDate: '2025-11-05',
      endDate: '2025-11-06',
      city: 'Paris',
      venue: 'Expo Porte de Versailles'
    },
    tags: ['Fintech', 'E-commerce'],
    metrics: { likes: 256, comments: 45, views: 1923 }
  },
  {
    id: '3',
    title: 'Eaton lance un centre de fabrication nouvelle génération à Dubaï',
    type: 'Innovation',
    excerpt: "Construction d'un nouveau centre de fabrication et d'ingénierie à Dubaï intégrant 20 technologies Industrie 4.0. Production de composants électriques avancés pour data centers et infrastructures. Certification LEED Gold visée, 700 emplois créés. Ouverture 2026.",
    image: eatonImage,
    exhibitor: { name: 'Eaton' },
    fair: { 
      name: 'Global Industries 2027',
      startDate: '2027-03-15',
      endDate: '2027-03-18',
      city: 'Lyon',
      venue: 'Parc des Expositions'
    },
    tags: ['Industrie 4.0', 'Durabilité'],
    metrics: { likes: 189, comments: 34, views: 1547 }
  }
];

const HeroNovelty = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liked, setLiked] = useState(false);

  const currentNovelty = mockNovelties[currentIndex];

  const daysUntilEvent = Math.ceil(
    (new Date(currentNovelty.fair.startDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  // Auto-scroll carousel every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % mockNovelties.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleLike = () => {
    setLiked(!liked);
  };

  return (
    <section className="relative min-h-[90vh] bg-background text-foreground py-16 px-4 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/5" />
      
      <div className="relative max-w-7xl mx-auto">
        {/* Main heading */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Avant d'ouvrir leurs portes, <span className="text-accent">les salons commencent ici.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-4xl mx-auto">
            Les exposants attirent leurs premiers leads avant le salon. Les visiteurs repèrent les stands à ne pas manquer et optimisent chaque déplacement.
          </p>
        </div>

        {/* Two column layout */}
        <div className="grid xl:grid-cols-12 gap-8 items-start">
          {/* Left: Large Novelty Card with Carousel */}
          <div className="xl:col-span-7">
            <div className="bg-card backdrop-blur-xl rounded-2xl p-6 border border-border shadow-lg hover:shadow-xl transition-shadow duration-300">
              {/* Event badge and countdown */}
              <div className="flex items-center gap-3 mb-4">
                <Badge className="bg-accent text-accent-foreground hover:bg-accent/90">
                  J-{daysUntilEvent} avant {currentNovelty.fair.name}
                </Badge>
              </div>

              {/* Image */}
              <div className="relative aspect-video mb-6 rounded-xl overflow-hidden bg-muted">
                <img 
                  src={currentNovelty.image} 
                  alt={currentNovelty.title}
                  className="w-full h-full object-cover transition-opacity duration-500"
                />
              </div>

              {/* Type badge */}
              <Badge variant="outline" className="mb-3 border-primary text-primary">
                {currentNovelty.type}
              </Badge>

              {/* Title */}
              <h2 className="text-2xl md:text-3xl font-bold mb-4">{currentNovelty.title}</h2>

              {/* Exhibitor & Fair info */}
              <div className="space-y-2 mb-4 text-sm text-muted-foreground">
                <p><strong className="text-accent">Exposant :</strong> {currentNovelty.exhibitor.name}</p>
                <p>
                  <strong className="text-accent">Salon :</strong> {currentNovelty.fair.name} — {' '}
                  {new Date(currentNovelty.fair.startDate).toLocaleDateString('fr-FR')} – {' '}
                  {new Date(currentNovelty.fair.endDate).toLocaleDateString('fr-FR')} — {' '}
                  {currentNovelty.fair.venue}, {currentNovelty.fair.city}
                </p>
              </div>

              {/* Excerpt */}
              <p className="text-foreground mb-6 leading-relaxed">{currentNovelty.excerpt}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-6">
                {currentNovelty.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Metrics */}
              <div className="flex items-center gap-6 mb-6 text-sm text-muted-foreground">
                <button 
                  onClick={handleLike}
                  className="flex items-center gap-2 hover:text-accent transition-colors"
                >
                  <Heart className={`h-5 w-5 ${liked ? 'fill-accent text-accent' : ''}`} />
                  <span>{currentNovelty.metrics.likes + (liked ? 1 : 0)}</span>
                </button>
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  <span>{currentNovelty.metrics.comments}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  <span>{currentNovelty.metrics.views}</span>
                </div>
              </div>

              {/* CTAs - Disabled */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  disabled
                  className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground opacity-70 cursor-not-allowed"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Réserver un RDV
                </Button>
                <Button 
                  disabled
                  variant="outline"
                  className="flex-1 opacity-70 cursor-not-allowed"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger la brochure
                </Button>
              </div>

              {/* Carousel Indicators */}
              <div className="flex justify-center gap-2 mt-6">
                {mockNovelties.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentIndex 
                        ? 'w-8 bg-accent' 
                        : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                    }`}
                    aria-label={`Aller à la nouveauté ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right: Persona Panel */}
          <div className="xl:col-span-5">
            <div className="bg-secondary/50 backdrop-blur-xl rounded-2xl p-6 border border-border sticky top-24">
              <Tabs defaultValue="visitors" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="visitors" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                    Visiteurs
                  </TabsTrigger>
                  <TabsTrigger value="exhibitors" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                    Exposants
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="visitors" className="space-y-6">
                  <p className="text-lg text-foreground leading-relaxed">
                    Découvrez les annonces des exposants (démos, lancements, offres salon) 
                    et décidez si le déplacement vaut le coup.
                  </p>
                  
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                      <span>Voyez les démos et offres qui vous concernent</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                      <span>Réservez des RDV ciblés sur les stands utiles</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                      <span>Ne ratez plus aucun événement de votre secteur</span>
                    </li>
                  </ul>

                  <Button 
                    onClick={() => navigate('/nouveautes')}
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    Découvrir les Nouveautés
                  </Button>
                </TabsContent>

                <TabsContent value="exhibitors" className="space-y-6">
                  <p className="text-lg text-foreground leading-relaxed">
                    Publiez vos Nouveautés, attirez des rendez-vous avant l'ouverture 
                    et rentabilisez votre stand.
                  </p>
                  
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                      <span>Captez des RDV avant l'ouverture</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                      <span>Sortez de la "loterie de l'emplacement"</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                      <span>Centralisez vos leads et mesurez l'impact</span>
                    </li>
                  </ul>

                  <Button 
                    onClick={() => navigate('/agenda')}
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    Publier une Nouveauté
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroNovelty;
