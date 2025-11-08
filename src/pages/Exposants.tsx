import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ForExhibitors from '@/components/home/ForExhibitors';
import { Button } from '@/components/ui/button';
import { Users, TrendingUp, BarChart3, Search, Megaphone, LineChart, Quote } from 'lucide-react';
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
              onClick={() => navigate('/events')}
              size="lg"
              className="bg-accent hover:bg-accent/90 text-lg font-semibold px-8 h-14"
            >
              <Search className="mr-2 h-5 w-5" />
              Trouver mon prochain salon
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

        {/* How It Works Section */}
        <section className="py-20 px-4 bg-background">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-4xl font-bold text-center text-foreground mb-4">
              Comment ça marche ?
            </h2>
            <p className="text-xl text-muted-foreground text-center mb-16 max-w-3xl mx-auto">
              3 étapes simples pour transformer votre participation en succès mesurable
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Connecting line */}
              <div className="hidden md:block absolute top-24 left-0 right-0 h-0.5 bg-gradient-to-r from-accent/50 via-primary/50 to-accent/50" style={{ width: 'calc(100% - 8rem)', margin: '0 4rem' }} />
              
              {/* Step 1 */}
              <div className="relative">
                <div className="bg-card border-2 border-accent/20 rounded-2xl p-8 text-center relative z-10 hover:border-accent/40 transition-colors">
                  <div className="bg-gradient-to-br from-accent to-primary rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Search className="h-10 w-10 text-white" />
                  </div>
                  <div className="inline-block bg-accent/10 text-accent font-bold text-sm px-4 py-1 rounded-full mb-4">
                    ÉTAPE 1
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-4">
                    Trouvez votre salon
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Identifiez le salon professionnel auquel votre société participe prochainement sur notre plateforme.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className="bg-card border-2 border-primary/20 rounded-2xl p-8 text-center relative z-10 hover:border-primary/40 transition-colors">
                  <div className="bg-gradient-to-br from-primary to-accent rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Megaphone className="h-10 w-10 text-white" />
                  </div>
                  <div className="inline-block bg-primary/10 text-primary font-bold text-sm px-4 py-1 rounded-full mb-4">
                    ÉTAPE 2
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-4">
                    Publiez votre nouveauté
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Démarquez-vous ! Annoncez un nouveau produit, un partenariat, une démonstration exclusive, une offre spéciale... Soyez remarquable pour attirer des visiteurs sur votre stand.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <div className="bg-card border-2 border-accent/20 rounded-2xl p-8 text-center relative z-10 hover:border-accent/40 transition-colors">
                  <div className="bg-gradient-to-br from-accent to-primary rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <LineChart className="h-10 w-10 text-white" />
                  </div>
                  <div className="inline-block bg-accent/10 text-accent font-bold text-sm px-4 py-1 rounded-full mb-4">
                    ÉTAPE 3
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-4">
                    Générez des leads avant J-0
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Collectez des rendez-vous et téléchargements de brochures <strong>avant l'ouverture</strong>. 
                    Vous capitalisez déjà du ROI avant même le début du salon. 
                    Essentiel quand la participation coûte des dizaines de milliers d'euros.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-20 px-4 bg-gradient-to-br from-accent/5 via-primary/5 to-accent/5">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-4xl font-bold text-center text-foreground mb-4">
              Ils utilisent Lotexpo
            </h2>
            <p className="text-xl text-muted-foreground text-center mb-16 max-w-3xl mx-auto">
              Découvrez comment les professionnels transforment leur présence en salons
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Marketing Manager */}
              <div className="bg-card border border-border rounded-2xl p-8 hover:shadow-lg transition-shadow">
                <Quote className="h-8 w-8 text-accent mb-4" />
                <p className="text-muted-foreground mb-6 leading-relaxed italic">
                  "Avec Lotexpo, notre visibilité ne dépend plus de notre emplacement sur le salon. 
                  On génère de l'attention avant même l'ouverture et on attire du trafic qualifié sur notre stand. 
                  C'est un levier marketing indispensable."
                </p>
                <div className="flex items-center gap-4">
                  <div className="bg-accent/10 rounded-full w-12 h-12 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Marie D.</p>
                    <p className="text-sm text-muted-foreground">Responsable Marketing</p>
                  </div>
                </div>
              </div>

              {/* Sales Team */}
              <div className="bg-card border border-border rounded-2xl p-8 hover:shadow-lg transition-shadow">
                <Quote className="h-8 w-8 text-primary mb-4" />
                <p className="text-muted-foreground mb-6 leading-relaxed italic">
                  "Le nombre de leads, c'est ma metric clé. Sur Lotexpo, je capitalise des rendez-vous 
                  avant même que le salon commence. Je suis noté sur la qualité et la quantité : 
                  Lotexpo me permet d'exceller sur les deux."
                </p>
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Julien B.</p>
                    <p className="text-sm text-muted-foreground">Directeur Commercial</p>
                  </div>
                </div>
              </div>

              {/* CEO */}
              <div className="bg-card border border-border rounded-2xl p-8 hover:shadow-lg transition-shadow">
                <Quote className="h-8 w-8 text-accent mb-4" />
                <p className="text-muted-foreground mb-6 leading-relaxed italic">
                  "Un salon, c'est un investissement énorme pour une PME. Lotexpo me rassure : 
                  je commence à rentabiliser avant même l'ouverture. C'est la sécurité dont j'ai besoin 
                  pour justifier ces dépenses."
                </p>
                <div className="flex items-center gap-4">
                  <div className="bg-accent/10 rounded-full w-12 h-12 flex items-center justify-center">
                    <Users className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Alexandre P.</p>
                    <p className="text-sm text-muted-foreground">Dirigeant d'entreprise</p>
                  </div>
                </div>
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
                onClick={() => navigate('/events')}
                size="lg"
                className="bg-accent hover:bg-accent/90 text-lg font-semibold px-8 h-14"
              >
                <Search className="mr-2 h-5 w-5" />
                Trouver mon prochain salon
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
