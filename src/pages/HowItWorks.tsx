import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Building2, ArrowRight, BadgeEuro, ShieldCheck, Users, Quote } from 'lucide-react';
import Header from '@/components/Header';
import HeroWithFilters from '@/components/home/HeroWithFilters';
import StatsBar from '@/components/home/StatsBar';
import RegionalEvents from '@/components/home/RegionalEvents';
import FeaturedNoveltiesSimple from '@/components/home/FeaturedNoveltiesSimple';
import JoinBlock from '@/components/home/JoinBlock';
import AllSectors from '@/components/home/AllSectors';
import HowItWorksNew from '@/components/home/HowItWorksNew';
import TestimonialsNew from '@/components/home/TestimonialsNew';
import NewsletterImproved from '@/components/home/NewsletterImproved';
import ExhibitorsReference from '@/components/home/ExhibitorsReference';
import Footer from '@/components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen w-full bg-background">
      <Helmet>
        <title>Comment ça marche | Guide Lotexpo – Lotexpo</title>
        <meta 
          name="description" 
          content="Découvrez comment utiliser Lotexpo pour trouver les meilleurs salons professionnels B2B en France, préparer vos visites et maximiser votre ROI événementiel." 
        />
        <link rel="canonical" href="https://lotexpo.com/comment-ca-marche" />
        <meta property="og:title" content="Comment ça marche | Guide Lotexpo – Lotexpo" />
        <meta property="og:url" content="https://lotexpo.com/comment-ca-marche" />
        <meta property="og:site_name" content="Lotexpo" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Salons", "item": "https://lotexpo.com" },
              { "@type": "ListItem", "position": 2, "name": "Comment ça marche", "item": "https://lotexpo.com/comment-ca-marche" }
            ]
          })}
        </script>
      </Helmet>
      <Header />
      <main>
        <HeroWithFilters />
        <StatsBar />
        <RegionalEvents />
        <FeaturedNoveltiesSimple />
        <JoinBlock />
        <AllSectors />
        <HowItWorksNew />
        <TestimonialsNew />
        <NewsletterImproved />
        <ExhibitorsReference />

        {/* Bloc dédié aux organisateurs de salons */}
        <section className="bg-secondary py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="bg-card border border-border rounded-2xl p-6 md:p-10 shadow-lg">
              <div className="grid md:grid-cols-2 gap-8 md:gap-10 items-start">
                {/* Colonne gauche : titre + texte */}
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="bg-primary/10 rounded-xl p-3">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                      Organisateurs de salons
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                    Organisateurs de salons : Lotexpo renforce votre visibilité
                  </h2>
                  <div className="space-y-3 text-muted-foreground leading-relaxed text-sm md:text-base">
                    <p>
                      Lotexpo référence les salons professionnels en France pour aider les visiteurs et exposants à identifier les événements utiles dans leur secteur.
                    </p>
                    <p>
                      La plateforme est indépendante : la présence d'un salon sur Lotexpo ne signifie pas que Lotexpo est affilié à l'organisateur, partenaire officiel ou mandaté par lui, sauf mention explicite.
                    </p>
                    <p>
                      Notre objectif est simple : donner plus de visibilité à votre événement, valoriser vos exposants et rediriger les utilisateurs vers vos informations officielles.
                    </p>
                  </div>
                  <Button asChild size="lg" className="mt-6 gap-2">
                    <Link to="/organisateurs">
                      Découvrir les avantages pour les organisateurs <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>

                {/* Colonne droite : mini-cards + encadré */}
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-1 gap-3">
                    {[
                      {
                        icon: BadgeEuro,
                        title: '100% gratuit',
                        text: "Aucun paiement n'est demandé pour référencer un salon professionnel.",
                      },
                      {
                        icon: ShieldCheck,
                        title: 'Indépendant',
                        text: 'Lotexpo complète votre communication sans remplacer votre site officiel.',
                      },
                      {
                        icon: Users,
                        title: 'Orienté visiteurs qualifiés',
                        text: 'Vos exposants, leurs Nouveautés et votre événement gagnent en visibilité.',
                      },
                    ].map((b) => (
                      <div
                        key={b.title}
                        className="flex gap-3 items-start bg-secondary/60 border border-border rounded-xl p-4"
                      >
                        <div className="bg-accent/10 rounded-lg p-2 flex-shrink-0">
                          <b.icon className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">{b.title}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">{b.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 items-start bg-primary/5 border-l-4 border-primary rounded-xl p-4">
                    <Quote className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground/90 leading-relaxed italic">
                      Lotexpo ne remplace pas les organisateurs. La plateforme leur donne une voix supplémentaire pour attirer un public plus qualifié.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
