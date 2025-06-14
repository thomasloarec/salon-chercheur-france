
import { Button } from '@/components/ui/button';
import { LayoutGrid, List, Map } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export const ViewToggle = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') || 'grid';
  
  const setView = (newView: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('view', newView);
    setSearchParams(newParams);
  };
  
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
