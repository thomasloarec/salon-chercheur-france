import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';
import { type RelationshipStatus } from '@/lib/radarCrm/relationship';
import { type Company, type EventGroup } from '@/types/radar';
import { formatDate, eventInitials, CompanyChip } from './RadarShared';

/** Past event card — same horizontal pattern, muted but companies still visible */
const PastEventCard: React.FC<{
  group: EventGroup;
  onView: () => void;
  getRel?: (company: Company) => RelationshipStatus;
  onSetRel?: (company: Company, next: RelationshipStatus) => void;
  onCompanyClick: (
    c: Company,
    id_exposant: string,
    stand: string | null,
    nom_exposant: string | null,
    needs_review: boolean,
  ) => void;
}> = ({ group, onView, getRel, onSetRel, onCompanyClick }) => {
  return (
    <Card className="overflow-hidden border-border/60 shadow-none hover:shadow-sm transition-all bg-card">
      <div className="flex flex-col sm:flex-row">
        <div className="relative w-full sm:w-[140px] sm:min-w-[140px] h-[110px] sm:h-auto bg-muted overflow-hidden">
          {group.url_image ? (
            <img src={group.url_image} alt={group.nom_event} className="w-full h-full object-cover opacity-90" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center text-foreground/40 font-bold">
              {eventInitials(group.nom_event)}
            </div>
          )}
        </div>
        <div className="flex-1 p-5 flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-base text-foreground leading-tight">{group.nom_event}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(group.date_debut)}{group.ville ? ` · ${group.ville}` : ''}
              </p>
            </div>
            <Badge className="bg-muted text-muted-foreground border-none font-medium">
              {group.companies.length} compte{group.companies.length > 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="bg-muted/30 border border-border/60 rounded-lg p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Entreprises détectées
            </p>
            <div className="flex flex-wrap gap-2">
              {group.companies.map(({ company, id_exposant, stand, nom_exposant, needs_review }) => (
                <CompanyChip
                  key={company.id}
                  company={company}
                  stand={stand}
                  nomExposant={nom_exposant}
                  needsReview={needs_review}
                  relationship={getRel?.(company)}
                  onSetRelationship={onSetRel ? (next) => onSetRel(company, next) : undefined}
                  onClick={() => onCompanyClick(company, id_exposant, stand, nom_exposant, needs_review)}
                />
              ))}
            </div>
          </div>
          <div className="mt-auto">
            <Button size="sm" variant="ghost" onClick={onView} disabled={!group.slug} className="text-primary hover:text-primary hover:bg-primary/5 -ml-2">
              Voir l'événement <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PastEventCard;
