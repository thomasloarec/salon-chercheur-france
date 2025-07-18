
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Building, ExternalLink, Target } from 'lucide-react';

interface Exhibitor {
  nom_exposant: string;
  stand_exposant?: string;
  website_exposant?: string;
}

interface ExhibitorsListProps {
  exhibitors: Exhibitor[];
  crmTargets: Exhibitor[];
}

export const ExhibitorsList = ({ exhibitors, crmTargets }: ExhibitorsListProps) => {
  const isTarget = (exhibitor: Exhibitor) => {
    return crmTargets.some(target => target.nom_exposant === exhibitor.nom_exposant);
  };

  if (exhibitors.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Building className="h-5 w-5 mr-2 text-accent" />
            Exposants
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">
            La liste des exposants sera bientôt disponible.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Building className="h-5 w-5 mr-2 text-accent" />
            Exposants ({exhibitors.length})
          </div>
          {crmTargets.length > 0 && (
            <Badge variant="default" className="bg-accent">
              <Target className="h-3 w-3 mr-1" />
              {crmTargets.length} cible{crmTargets.length > 1 ? 's' : ''} CRM
            </Badge>
          )}
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
                className={isTarget(exhibitor) ? 'bg-accent/10 border-l-4 border-l-accent' : ''}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center">
                    {isTarget(exhibitor) && (
                      <Target className="h-4 w-4 text-accent mr-2" />
                    )}
                    {exhibitor.nom_exposant}
                  </div>
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
                      🎯 Cible CRM
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
