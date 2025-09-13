import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Users, ExternalLink } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { supabase } from '@/integrations/supabase/client';
import type { Event } from '@/types/event';

interface Exhibitor {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  participation: Array<{
    stand_exposant?: string;
    urlexpo_event?: string;
  }>;
}

interface ExhibitorsSidebarProps {
  event: Event;
  className?: string;
}

export default function ExhibitorsSidebar({ event, className }: ExhibitorsSidebarProps) {
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Fetch exhibitors
  useEffect(() => {
    const fetchExhibitors = async () => {
      if (!event.id) return;

      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase.functions.invoke('exhibitors-manage', {
          body: {
            event_id: event.id,
            q: debouncedSearchQuery || undefined
          }
        });

        if (error) throw error;

        setExhibitors(data || []);
      } catch (err) {
        console.error('Error fetching exhibitors:', err);
        setError('Erreur lors du chargement des exposants');
      } finally {
        setLoading(false);
      }
    };

    fetchExhibitors();
  }, [event.id, debouncedSearchQuery]);

  // Filter exhibitors based on search
  const filteredExhibitors = useMemo(() => {
    if (!debouncedSearchQuery) return exhibitors;
    
    return exhibitors.filter(exhibitor =>
      exhibitor.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
    );
  }, [exhibitors, debouncedSearchQuery]);

  return (
    <aside className={`sticky top-24 max-h-[75vh] overflow-hidden ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Exposants ({filteredExhibitors.length})
          </CardTitle>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un exposant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Loading State */}
          {loading && (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Chargement...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 text-center">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredExhibitors.length === 0 && (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Aucun exposant trouvé' : 'Aucun exposant enregistré'}
              </p>
            </div>
          )}

          {/* Exhibitors List */}
          {!loading && !error && filteredExhibitors.length > 0 && (
            <div className="max-h-[400px] overflow-y-auto">
              <div className="divide-y">
                {filteredExhibitors.map((exhibitor) => (
                  <div key={exhibitor.id} className="p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {/* Logo */}
                      {exhibitor.logo_url ? (
                        <img
                          src={exhibitor.logo_url}
                          alt={exhibitor.name}
                          className="w-6 h-6 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded bg-muted flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-muted-foreground">
                            {exhibitor.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/exposants/${exhibitor.slug}`}
                          className="block font-medium text-sm hover:text-primary transition-colors truncate"
                          title={exhibitor.name}
                        >
                          {exhibitor.name}
                        </Link>
                        
                        {/* Stand Info */}
                        {exhibitor.participation?.[0]?.stand_exposant && (
                          <p className="text-xs text-muted-foreground">
                            Stand {exhibitor.participation[0].stand_exposant}
                          </p>
                        )}
                      </div>

                      {/* External Link */}
                      {exhibitor.participation?.[0]?.urlexpo_event && (
                        <a
                          href={exhibitor.participation[0].urlexpo_event}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors"
                          title="Voir la page exposant sur le site officiel"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer CTA */}
          {!loading && !error && filteredExhibitors.length > 0 && (
            <div className="p-4 border-t">
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link to={`#exposants`}>
                  Voir tous les exposants
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}