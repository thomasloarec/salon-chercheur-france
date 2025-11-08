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
