import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ForExhibitors from '@/components/home/ForExhibitors';
import { Button } from '@/components/ui/button';
import { Plus, Users, TrendingUp, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Exposants = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-background">
      <Header />
      <main>
        {/* Hero Section */}
        <section className="gradient-hero text-white py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 animate-fade-in-up">
              Lotexpo pour les
              <span className="block text-accent">Exposants</span>
            </h1>
            <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto text-gray-200">
              Attirez des visiteurs qualifiés avant même l'ouverture du salon. 
              Publiez vos nouveautés et transformez votre participation en opportunités concrètes.
            </p>
            <Button
              onClick={() => navigate('/agenda')}
              size="lg"
              className="bg-accent hover:bg-accent/90 text-lg font-semibold px-8 h-14"
            >
              <Plus className="mr-2 h-5 w-5" />
              Publier une Nouveauté
            </Button>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="bg-background py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-4xl font-bold text-center text-foreground mb-16">
              Pourquoi publier vos nouveautés sur Lotexpo ?
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <div className="bg-accent/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-accent" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Visibilité pré-événement
                </h3>
                <p className="text-muted-foreground">
                  Les visiteurs découvrent vos innovations avant le salon et planifient de vous rendre visite
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <div className="bg-accent/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-accent" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Leads qualifiés
                </h3>
                <p className="text-muted-foreground">
                  Collectez les coordonnées de prospects réellement intéressés par vos produits
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <div className="bg-accent/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="h-8 w-8 text-accent" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  ROI mesuré
                </h3>
                <p className="text-muted-foreground">
                  Suivez les performances de vos nouveautés avec des statistiques détaillées
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Premium Section - Reusing existing component */}
        <ForExhibitors />

        {/* CTA Section */}
        <section className="bg-gradient-to-br from-accent/10 via-primary/10 to-accent/10 py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              Prêt à maximiser votre ROI salon ?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Rejoignez les exposants qui utilisent Lotexpo pour attirer des visiteurs qualifiés
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate('/agenda')}
                size="lg"
                className="bg-accent hover:bg-accent/90 text-lg font-semibold px-8 h-14"
              >
                <Plus className="mr-2 h-5 w-5" />
                Publier une Nouveauté
              </Button>
              <Button
                onClick={() => navigate('/premium')}
                size="lg"
                variant="outline"
                className="text-lg font-semibold px-8 h-14 border-2"
              >
                Découvrir Premium
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Exposants;
