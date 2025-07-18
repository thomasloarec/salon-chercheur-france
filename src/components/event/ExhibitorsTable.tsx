
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Building, ExternalLink } from 'lucide-react';

interface Exhibitor {
  nom_exposant: string;
  stand_exposant?: string;
  website_exposant?: string;
}

interface ExhibitorsTableProps {
  exhibitors: Exhibitor[];
  crmTargets: Exhibitor[];
}

export const ExhibitorsTable = ({ exhibitors, crmTargets }: ExhibitorsTableProps) => {
  const isTarget = (exhibitor: Exhibitor) => {
    return crmTargets.some(target => target.nom_exposant === exhibitor.nom_exposant);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Building className="h-5 w-5 mr-2 text-accent" />
          Exposants ({exhibitors.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entreprise</TableHead>
              <TableHead>Stand</TableHead>
              <TableHead>Site web</TableHead>
              <TableHead>CRM</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exhibitors.map((exhibitor, index) => (
              <TableRow 
                key={index}
                className={isTarget(exhibitor) ? 'target bg-accent/10' : ''}
              >
                <TableCell className="font-medium">
                  {exhibitor.nom_exposant}
                </TableCell>
                <TableCell>
                  {exhibitor.stand_exposant && (
                    <Badge variant="outline">{exhibitor.stand_exposant}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {exhibitor.website_exposant && (
                    <a 
                      href={`https://${exhibitor.website_exposant}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-accent hover:underline"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Site
                    </a>
                  )}
                </TableCell>
                <TableCell>
                  {isTarget(exhibitor) && (
                    <Badge variant="default" className="bg-accent">
                      Cible CRM
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
