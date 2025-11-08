import { useSectors } from '@/hooks/useSectors';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AllSectors = () => {
  const { data: sectors = [], isLoading } = useSectors();
  const navigate = useNavigate();

  const handleSectorClick = (sectorId: string) => {
    navigate(`/events?sectors=${sectorId}`);
  };

  return (
    <section className="bg-background py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8 text-center">
          Tous les secteurs d'activité
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {sectors.map((sector) => (
              <Button
                key={sector.id}
                onClick={() => handleSectorClick(sector.id)}
                variant="outline"
                className="h-auto py-6 px-4 flex flex-col items-center justify-center text-center border-2 hover:border-accent hover:bg-accent/5 transition-all group"
              >
                <span className="font-semibold text-sm group-hover:text-accent transition-colors line-clamp-2">
                  {sector.name}
                </span>
                <ArrowRight className="h-4 w-4 mt-2 opacity-0 group-hover:opacity-100 text-accent transition-opacity" />
              </Button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default AllSectors;
