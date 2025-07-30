import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ExternalLink } from 'lucide-react';
import { CrmMatch } from '@/hooks/useCrmMatches';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import FavoriteButton from '@/components/FavoriteButton';

interface CrmCompanyCardProps {
  company: CrmMatch;
}

export const CrmCompanyCard = ({ company }: CrmCompanyCardProps) => {
  const providerLabels = {
    hubspot: 'HubSpot',
    salesforce: 'Salesforce',
    pipedrive: 'Pipedrive',
    zoho: 'Zoho'
  };

  return (
    <Card className="border-l-4 border-l-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{company.name}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {providerLabels[company.provider]}
              </Badge>
              {company.eventsCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  {company.eventsCount} salon{company.eventsCount > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
          {company.website && (
            <a 
              href={company.website} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </CardHeader>
      
      {company.upcomingEvents.length > 0 && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Salons à venir :
            </h4>
            <div className="space-y-2">
              {company.upcomingEvents.map((event) => (
                <div 
                  key={event.id} 
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {event.nom_event}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(event.date_debut), 'dd/MM/yyyy', { locale: fr })}
                      {event.ville && ` • ${event.ville}`}
                    </p>
                  </div>
                  <FavoriteButton 
                    eventId={event.id} 
                    variant="inline" 
                    size="sm"
                    className="ml-2 flex-shrink-0"
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};