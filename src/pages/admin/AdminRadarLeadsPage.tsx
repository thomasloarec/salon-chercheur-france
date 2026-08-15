import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, Users } from 'lucide-react';

type RadarLead = {
  id: string;
  created_at: string;
  crm: string | null;
  team_size: string | null;
  client_type: string | null;
  product_type: string | null;
  salons_per_year: string | null;
  contact_name: string | null;
  contact_email: string | null;
  message: string | null;
  searched_query: string | null;
  source: string;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }) + ', ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const Cell = ({ value }: { value: string | null }) => {
  if (!value) return <span className="text-muted-foreground">–</span>;
  return <span>{value}</span>;
};

const useAdminRadarLeads = () => {
  return useQuery({
    queryKey: ['admin-radar-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('radar_leads')
        .select('id, created_at, crm, team_size, client_type, product_type, salons_per_year, contact_name, contact_email, message, searched_query, source')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RadarLead[];
    },
    staleTime: 60 * 1000,
  });
};

const AdminRadarLeadsPage = () => {
  const { data: leads, isLoading, isError } = useAdminRadarLeads();
  const count = leads?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Leads commerciaux</h1>
          <p className="text-muted-foreground text-sm">
            Demandes de qualification de la page « Directeur Commercial »
          </p>
        </div>
        <Badge variant="secondary" className="mt-0.5">
          {isLoading ? '…' : count}
        </Badge>
      </div>

      {isError ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive font-medium">
              Impossible de charger les leads commerciaux.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Vérifiez les droits admin ou réessayez plus tard.
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="py-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : count === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Aucun lead pour le moment</p>
            <p className="text-sm text-muted-foreground mt-1">
              Les demandes du formulaire « Équiper mon équipe » apparaîtront ici.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>CRM</TableHead>
                  <TableHead>Taille d'équipe</TableHead>
                  <TableHead>Type de clientèle</TableHead>
                  <TableHead>Type de produit</TableHead>
                  <TableHead>Salons par an</TableHead>
                  <TableHead>Entreprise recherchée</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(lead.created_at)}</TableCell>
                    <TableCell><Cell value={lead.contact_name} /></TableCell>
                    <TableCell>
                      {lead.contact_email ? (
                        <a
                          href={`mailto:${lead.contact_email}`}
                          className="inline-flex items-center gap-1 hover:underline text-primary"
                        >
                          <Mail className="h-3 w-3" />
                          {lead.contact_email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell><Cell value={lead.crm} /></TableCell>
                    <TableCell><Cell value={lead.team_size} /></TableCell>
                    <TableCell><Cell value={lead.client_type} /></TableCell>
                    <TableCell><Cell value={lead.product_type} /></TableCell>
                    <TableCell><Cell value={lead.salons_per_year} /></TableCell>
                    <TableCell><Cell value={lead.searched_query} /></TableCell>
                    <TableCell>
                      {lead.message ? (
                        <span title={lead.message} className="truncate max-w-[200px] inline-block">
                          {lead.message.length > 60 ? `${lead.message.slice(0, 60)}…` : lead.message}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminRadarLeadsPage;
