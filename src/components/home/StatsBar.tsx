import { useHomeStats } from '@/hooks/useHomeStats';
import { TrendingUp, Building2, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const StatsBar = () => {
  const { data: stats, isLoading } = useHomeStats();
  const [eventsCount, setEventsCount] = useState(0);
  const [exhibitorsCount, setExhibitorsCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated && stats) {
          setHasAnimated(true);
          animateCounter(stats.totalEvents, setEventsCount, 2000);
          animateCounter(stats.totalExhibitors || 0, setExhibitorsCount, 2000);
        }
      },
      { threshold: 0.5 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [stats, hasAnimated]);

  const animateCounter = (target: number, setter: (val: number) => void, duration: number) => {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setter(target);
        clearInterval(timer);
      } else {
        setter(Math.floor(current));
      }
    }, 16);
  };

  return (
    <div 
      ref={sectionRef}
      className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 py-12"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <TrendingUp className="h-8 w-8 text-accent" />
              <div className="text-4xl md:text-5xl font-bold text-foreground">
                {isLoading ? '...' : `${eventsCount}+`}
              </div>
            </div>
            <div className="text-muted-foreground text-lg">
              Événements publiés
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Building2 className="h-8 w-8 text-accent" />
              <div className="text-4xl md:text-5xl font-bold text-foreground">
                {isLoading ? '...' : `${exhibitorsCount}+`}
              </div>
            </div>
            <div className="text-muted-foreground text-lg">
              Exposants listés
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Check className="h-8 w-8 text-accent" />
              <div className="text-4xl md:text-5xl font-bold text-foreground">
                100%
              </div>
            </div>
            <div className="text-muted-foreground text-lg">
              Gratuit
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsBar;
