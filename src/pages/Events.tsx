
import EventsList from '@/components/EventsList';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Events = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <EventsList />
      </main>
      <Footer />
    </div>
  );
};

export default Events;
