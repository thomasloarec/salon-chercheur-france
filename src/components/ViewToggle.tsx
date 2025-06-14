
import { Button } from '@/components/ui/button';
import { LayoutGrid, Map } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export const ViewToggle = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentView = searchParams.get('view') ?? 'grid';
  
  // Synchronisation initiale : forcer ?view=grid si absent ou si c'est 'list'
  useEffect(() => {
    const view = searchParams.get('view');
    if (!view || view === 'list') {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('view', 'grid');
      navigate({ search: newParams.toString() }, { replace: true });
    }
  }, [searchParams, navigate]);
  
  const handleChangeView = (view: 'grid' | 'map') => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('view', view);
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
