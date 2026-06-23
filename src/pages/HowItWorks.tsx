import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Building2, ArrowRight } from 'lucide-react';
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
          <div className="max-w-4xl mx-auto">
            <div className="bg-card border border-border rounded-2xl p-8 md:p-10 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="bg-primary/10 rounded-xl p-3">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                  Pour les organisateurs de salons
                </h2>
              </div>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Lotexpo référence les salons professionnels en France afin d'aider les visiteurs et exposants à mieux préparer leurs événements. La plateforme est indépendante : lorsqu'un salon est présent sur Lotexpo, cela ne signifie pas que Lotexpo est affilié à l'organisateur ou mandaté par lui, sauf mention explicite.
                </p>
                <p>
                  Pour les organisateurs, ce référencement est gratuit et apporte une visibilité supplémentaire à leur événement. Chaque page salon peut renvoyer vers le site officiel, valoriser les exposants, mettre en avant les nouveautés publiées avant l'ouverture du salon et encourager un public qualifié à préparer sa visite.
                </p>
              </div>
              <Button asChild className="mt-6 gap-2">
                <Link to="/organisateurs">
                  Découvrir les avantages pour les organisateurs <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
