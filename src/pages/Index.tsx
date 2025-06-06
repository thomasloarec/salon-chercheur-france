
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import FeaturesSection from '@/components/FeaturesSection';
import SectorsSection from '@/components/SectorsSection';
import RecentEventsSection from '@/components/RecentEventsSection';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <HeroSection />
        <FeaturesSection />
        <SectorsSection />
        <RecentEventsSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
