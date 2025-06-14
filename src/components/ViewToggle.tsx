
import { Button } from '@/components/ui/button';
import { LayoutGrid, List, Map } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export const ViewToggle = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentView = searchParams.get('view') ?? 'grid';
  
  const handleChangeView = (view: 'grid' | 'list' | 'map') => {
    // Clone les params pour préserver les filtres existants
    const newParams = new URLSearchParams(searchParams);
    newParams.set('view', view);
    // Remplacer l'entrée courante (pas de push dans l'historique)
    navigate({ search: newParams.toString() }, { replace: true });
  };
  
  return (
    <div className="mb-4 flex gap-2">
      <Button 
        variant={currentView === 'grid' ? 'default' : 'outline'} 
        size="sm"
        onClick={() => handleChangeView('grid')}
      >
        <LayoutGrid className="h-4 w-4 mr-2" />
        Grille
      </Button>
      <Button 
        variant={currentView === 'list' ? 'default' : 'outline'} 
        size="sm"
        onClick={() => handleChangeView('list')}
      >
        <List className="h-4 w-4 mr-2" />
        Liste
      </Button>
      <Button 
        variant={currentView === 'map' ? 'default' : 'outline'} 
        size="sm"
        onClick={() => handleChangeView('map')}
      >
        <Map className="h-4 w-4 mr-2" />
        Carte
      </Button>
    </div>
  );
};
