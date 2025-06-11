
import { Button } from '@/components/ui/button';
import { LayoutGrid, List, Map } from 'lucide-react';
import { useSearchParam } from '@/hooks/useSearchParams';

export const ViewToggle = () => {
  const [view, setView] = useSearchParam('view', 'grid');
  
  return (
    <div className="mb-4 flex gap-2">
      <Button 
        variant={view === 'grid' ? 'default' : 'outline'} 
        size="sm"
        onClick={() => setView('grid')}
      >
        <LayoutGrid className="h-4 w-4 mr-2" />
        Grille
      </Button>
      <Button 
        variant={view === 'list' ? 'default' : 'outline'} 
        size="sm"
        onClick={() => setView('list')}
      >
        <List className="h-4 w-4 mr-2" />
        Liste
      </Button>
      <Button 
        variant={view === 'map' ? 'default' : 'outline'} 
        size="sm"
        onClick={() => setView('map')}
      >
        <Map className="h-4 w-4 mr-2" />
        Carte
      </Button>
    </div>
  );
};
