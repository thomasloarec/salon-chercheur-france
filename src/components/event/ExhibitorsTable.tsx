
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Building, ExternalLink } from 'lucide-react';

interface Exhibitor {
  name: string;
  stand?: string;
  website?: string;
}

interface ExhibitorsTableProps {
  exhibitors: Exhibitor[];
  crmTargets: Exhibitor[];
}

export const ExhibitorsTable = ({ exhibitors, crmTargets }: ExhibitorsTableProps) => {
  const isTarget = (exhibitor: Exhibitor) => {
    return crmTargets.some(target => target.name === exhibitor.name);
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
                  {exhibitor.name}
                </TableCell>
                <TableCell>
                  {exhibitor.stand && (
                    <Badge variant="outline">{exhibitor.stand}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {exhibitor.website && (
                    <a 
                      href={`https://${exhibitor.website}`}
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
