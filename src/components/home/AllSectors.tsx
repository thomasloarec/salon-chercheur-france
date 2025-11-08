import { useSectors } from '@/hooks/useSectors';
import { Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SectorIconBar } from '@/components/filters/SectorIconBar';
import { sectorWithCanonicalSlug } from '@/utils/sectorMapping';

const AllSectors = () => {
  const { data: sectors = [], isLoading } = useSectors();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleSectorsChange = (selectedSlugs: string[]) => {
    const params = new URLSearchParams(searchParams);
    if (selectedSlugs.length > 0) {
      params.set('sectors', selectedSlugs.join(','));
    } else {
      params.delete('sectors');
    }
    navigate(`/events?${params.toString()}`);
  };

  return (
    <section className="bg-background py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8 text-center">
          Tous les secteurs d'activité
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <SectorIconBar
            sectors={sectors.map(s => sectorWithCanonicalSlug(s))}
            selected={[]}
            onChange={handleSectorsChange}
          />
        )}
      </div>
    </section>
  );
};

export default AllSectors;
