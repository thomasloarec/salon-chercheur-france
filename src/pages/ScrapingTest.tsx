
import ScrapingTest from '@/components/ScrapingTest';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const ScrapingTestPage = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="py-8">
        <ScrapingTest />
      </main>
      <Footer />
    </div>
  );
};

export default ScrapingTestPage;
