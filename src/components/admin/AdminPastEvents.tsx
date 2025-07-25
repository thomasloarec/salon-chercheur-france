
import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const AdminPastEvents = () => {
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const { data: pastEvents, isLoading } = useQuery({
    queryKey: ['admin-past-events', page],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('events')
        .select('id_event, slug, nom_event, date_debut, date_fin, ville, visible')
        .lt('date_fin', today)
        .order('date_fin', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;
      return data;
    },
    placeholderData: keepPreviousData,
  });

  if (isLoading && page === 0) {
    return (
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Événements passés</h3>
        <div className="text-center p-4">Chargement des événements passés...</div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border p-6">
      <h3 className="text-lg font-semibold mb-4">
        Événements passés
      </h3>
      
      {(!pastEvents || pastEvents.length === 0) && page === 0 ? (
        <p className="text-muted-foreground">Aucun événement passé trouvé.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Début</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pastEvents?.map((event) => (
                <TableRow 
                  key={event.id_event}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="font-medium">
                    <Link 
                      to={`/events/${event.slug}`}
                      className="text-blue-600 hover:underline"
                    >
                      {event.nom_event}
                    </Link>
                  </TableCell>
                  <TableCell>{event.ville}</TableCell>
                  <TableCell>
                    {new Date(event.date_debut).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell>
                    {new Date(event.date_fin).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                      event.visible 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {event.visible ? 'Publié' : 'Non publié'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {pastEvents && pastEvents.length === pageSize && (
            <div className="mt-4 text-center">
              <Button 
                onClick={() => setPage(p => p + 1)}
                disabled={isLoading}
              >
                {isLoading ? 'Chargement...' : 'Voir plus'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminPastEvents;
