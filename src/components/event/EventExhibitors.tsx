
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building, ExternalLink, Link } from 'lucide-react';

interface Exhibitor {
  nom_exposant: string;
  stand_exposant?: string;
  website_exposant?: string;
}

interface EventExhibitorsProps {
  exhibitors: Exhibitor[];
}

export const EventExhibitors = ({ exhibitors }: EventExhibitorsProps) => {
  if (exhibitors.length === 0) {
    return (
      <Card className="mb-8">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl">
            <h2 className="flex items-center justify-between">
              <div className="flex items-center">
                <Building className="h-6 w-6 mr-3 text-accent" />
                Exposants
              </div>
              {/* Bouton Connecter CRM désactivé temporairement - à réactiver plus tard */}
              {false && (
                <Button className="bg-accent hover:bg-accent/90">
                  <Link className="h-4 w-4 mr-2" />
                  Connecter mon CRM
                </Button>
              )}
            </h2>
          </CardTitle>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <p className="text-blue-800 text-sm">
              💡 <strong>Conseil :</strong> Connectez votre CRM pour découvrir facilement vos prospects parmi les exposants.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Building className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-6">
              La liste des exposants sera bientôt disponible.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl">
          <h2 className="flex items-center justify-between">
            <div className="flex items-center">
              <Building className="h-6 w-6 mr-3 text-accent" />
              Exposants ({exhibitors.length})
            </div>
            {/* Bouton Connecter CRM désactivé temporairement - à réactiver plus tard */}
            {false && (
              <Button className="bg-accent hover:bg-accent/90">
                <Link className="h-4 w-4 mr-2" />
                Connecter mon CRM
              </Button>
            )}
          </h2>
        </CardTitle>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <p className="text-blue-800 text-sm">
            💡 <strong>Conseil :</strong> Connectez votre CRM pour découvrir facilement vos prospects parmi les exposants.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Entreprise</TableHead>
              <TableHead className="font-semibold">Stand</TableHead>
              <TableHead className="font-semibold">Site web</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exhibitors.map((exhibitor, index) => (
              <TableRow key={index} className="hover:bg-gray-50">
                <TableCell className="font-medium text-left">
                  {exhibitor.nom_exposant}
                </TableCell>
                <TableCell className="text-left">
                  {exhibitor.stand_exposant && (
                    <Badge variant="outline" className="font-normal">
                      {exhibitor.stand_exposant}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-left">
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
