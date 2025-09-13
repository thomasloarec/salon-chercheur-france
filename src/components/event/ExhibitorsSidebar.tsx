import React, { useState } from 'react';
import { Search, Building2, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounce } from '@/hooks/useDebounce';
import { useExhibitorsByEvent } from '@/hooks/useExhibitorsByEvent';
import type { Event } from '@/types/event';

interface ExhibitorsSidebarProps {
  event: Event;
}

export default function ExhibitorsSidebar({ event }: ExhibitorsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  const { data: exhibitorsData, isLoading, error } = useExhibitorsByEvent(
    event.slug || '', 
    debouncedSearch
  );
  
  const exhibitors = exhibitorsData?.exhibitors || [];

  return (
    <div className="lg:col-span-1">
      <div className="sticky top-24 max-h-[75vh] overflow-y-auto bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">
            Exposants ({isLoading ? '...' : exhibitors.length})
          </h3>
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher un exposant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Content */}
        <div className="mt-4 space-y-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="w-6 h-6 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))
          ) : error ? (
            <div className="text-center py-4">
              <p className="text-sm text-red-600">Erreur lors du chargement</p>
            </div>
          ) : exhibitors.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">
                {debouncedSearch ? 'Aucun exposant trouvé' : 'Aucun exposant inscrit'}
              </p>
            </div>
          ) : (
            exhibitors.map((exhibitor) => (
              <div key={exhibitor.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-6 h-6 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center">
                  {exhibitor.logo_url ? (
                    <img 
                      src={exhibitor.logo_url} 
                      alt={`${exhibitor.name} logo`}
                      className="w-full h-full object-contain rounded"
                    />
                  ) : (
                    <Building2 className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <a 
                    href={`/exhibitors/${exhibitor.slug || exhibitor.id}`}
                    className="font-medium text-sm text-gray-900 hover:text-primary transition-colors block truncate"
                  >
                    {exhibitor.name}
                  </a>
                  {(exhibitor.stand || exhibitor.hall) && (
                    <p className="text-xs text-gray-500 truncate">
                      {[exhibitor.hall, exhibitor.stand].filter(Boolean).join(' • ')}
                    </p>
                  )}
                </div>
                
                <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
              </div>
            ))
          )}
        </div>

        {/* Footer CTA */}
        {exhibitors.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <Button variant="outline" size="sm" className="w-full">
              Voir tous les exposants
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}