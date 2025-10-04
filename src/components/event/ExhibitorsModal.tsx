import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, Building2 } from 'lucide-react';

interface Exhibitor {
  id_exposant: string;
  exhibitor_name: string;
  stand_exposant?: string;
  website_exposant?: string;
  exposant_description?: string;
}

interface ExhibitorsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exhibitors: Exhibitor[];
  onSelect: (exhibitor: Exhibitor) => void;
}

export const ExhibitorsModal: React.FC<ExhibitorsModalProps> = ({ 
  open, 
  onOpenChange, 
  exhibitors = [], 
  onSelect 
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return exhibitors;
    return exhibitors.filter((e) =>
      (e.exhibitor_name ?? '').toLowerCase().includes(query) ||
      (e.stand_exposant ?? '').toLowerCase().includes(query)
    );
  }, [searchQuery, exhibitors]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Tous les exposants ({exhibitors.length})</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher un exposant…" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-auto pr-1">
            {filtered.map((ex) => (
              <button
                key={ex.id_exposant}
                className="text-left rounded-lg border p-3 hover:bg-accent transition-colors"
                onClick={() => onSelect(ex)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{ex.exhibitor_name}</div>
                    {ex.stand_exposant && (
                      <div className="text-xs text-muted-foreground">Stand {ex.stand_exposant}</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-2 text-center py-8 text-muted-foreground">
                Aucun exposant trouvé
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
