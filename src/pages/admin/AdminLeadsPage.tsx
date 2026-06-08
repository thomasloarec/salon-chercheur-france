import React from 'react';
import { useAdminLeadsStats } from '@/hooks/useAdminLeadsStats';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Calendar, Download, Users } from 'lucide-react';

const fmt = (v: number | null | undefined) => (v != null ? v.toLocaleString('fr-FR') : '–');

const StatCard = ({
  title,
  value,
  icon: IconComp,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
}) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center gap-2 mb-1">
        <IconComp className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{title}</p>
      </div>
      <span className="text-3xl font-bold">{value}</span>
    </CardContent>
  </Card>
);

const AdminLeadsPage = () => {
  const { data, isLoading, isError } = useAdminLeadsStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Suivi des leads</h1>
        <p className="text-muted-foreground text-sm">
          Vue d'ensemble des leads générés par les nouveautés
        </p>
      </div>

      {/* État d'erreur (distinct du vide) */}
      {isError ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive font-medium">
              Impossible de charger les statistiques de leads.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Une erreur est survenue. Veuillez réessayer plus tard.
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6 space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="py-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Les 3 chiffres */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Total leads" value={fmt(data?.totals.total_leads)} icon={Users} />
            <StatCard title="Demandes de rendez-vous" value={fmt(data?.totals.total_rdv)} icon={Calendar} />
            <StatCard title="Téléchargements brochure" value={fmt(data?.totals.total_brochure)} icon={Download} />
          </div>

          {/* Tableau "Quelle nouveauté convertit" */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Quelle nouveauté convertit</h2>
            {!data?.by_novelty?.length ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Aucun lead généré pour le moment</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nouveauté</TableHead>
                        <TableHead>Exposant</TableHead>
                        <TableHead>Salon</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">RDV</TableHead>
                        <TableHead className="text-right">Brochure</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.by_novelty.map((row) => (
                        <TableRow key={row.novelty_id}>
                          <TableCell className="font-medium">
                            {row.novelty_slug ? (
                              <a
                                href={`/nouveautes/${row.novelty_slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 hover:underline"
                              >
                                {row.novelty_title || 'Sans titre'}
                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                              </a>
                            ) : (
                              row.novelty_title || 'Sans titre'
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{row.exhibitor_name || '–'}</TableCell>
                          <TableCell className="text-muted-foreground">{row.event_name || '–'}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(row.leads_total)}</TableCell>
                          <TableCell className="text-right">{fmt(row.leads_rdv)}</TableCell>
                          <TableCell className="text-right">{fmt(row.leads_brochure)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default AdminLeadsPage;
