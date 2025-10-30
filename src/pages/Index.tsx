
import Header from '@/components/Header';
import HeroNovelty from '@/components/home/HeroNovelty';
import HowItWorks from '@/components/home/HowItWorks';
import FeaturedNovelties from '@/components/home/FeaturedNovelties';
import UpcomingFairs from '@/components/home/UpcomingFairs';
import ForExhibitors from '@/components/home/ForExhibitors';
import ForVisitors from '@/components/home/ForVisitors';
import HomeFaq from '@/components/home/HomeFaq';
import Footer from '@/components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen w-full bg-[#0B0F19]">
      <Header />
      <main>
        <HeroNovelty />
        <HowItWorks />
        <FeaturedNovelties />
        <UpcomingFairs />
        <ForExhibitors />
        <ForVisitors />
        <HomeFaq />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
