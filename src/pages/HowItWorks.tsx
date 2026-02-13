import { Helmet } from 'react-helmet-async';
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
              { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://lotexpo.com" },
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
      </main>
      <Footer />
    </div>
  );
};

export default Index;
