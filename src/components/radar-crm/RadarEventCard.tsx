import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Calendar, MapPin, Radar, CalendarPlus, CalendarCheck, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useIsFavorite, useToggleFavorite } from '@/hooks/useFavorites';
import AuthRequiredModal from '@/components/AuthRequiredModal';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';
import SimilarExhibitorsSection from '@/components/radar-crm/SimilarExhibitorsSection';
import { eventPhase, showModeSalon, modeSalonIsHot, showDebrief } from '@/lib/radarCrm/eventPhase';
import { type RelationshipStatus } from '@/lib/radarCrm/relationship';
import { type Company, type EventGroup, type Pref } from '@/types/radar';
import { formatDate, eventInitials, priorityFor, CompanyChip } from './RadarShared';

/** Compact horizontal event card — image left, info center, actions right */
const AgendaLotexpoButton: React.FC<{ eventId: string; importId?: string | null }> = ({ eventId, importId }) => {
  const { user } = useAuth();
  const { data: isFavorite = false } = useIsFavorite(eventId);
  const toggleFavorite = useToggleFavorite();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    try {
      void trackRadarEvent('crm_favorite_clicked', {
        source: 'radar_crm',
        favoriteType: 'event_agenda',
        eventId,
        importId: importId ?? null,
      });
      await toggleFavorite.mutateAsync(eventId);
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={toggleFavorite.isPending}
        className={cn(
          'transition-all duration-200',
          isFavorite && 'bg-primary text-primary-foreground hover:bg-primary/90 border-primary',
        )}
      >
        {isFavorite ? (
          <CalendarCheck className="h-3.5 w-3.5 mr-1" />
        ) : (
          <CalendarPlus className="h-3.5 w-3.5 mr-1" />
        )}
        {isFavorite ? 'Dans mon agenda' : 'Ajouter à mon agenda'}
      </Button>
      <AuthRequiredModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </>
  );
};

const EventCard: React.FC<{
  group: EventGroup;
  importId?: string | null;
  getPref?: (companyId: string) => Pref;
  getRel?: (company: Company) => RelationshipStatus;
  onSetRel?: (company: Company, next: RelationshipStatus) => void;
  onView: () => void;
  onModeSalon?: () => void;
  onDebrief?: () => void;
  similarCount?: number;
  onCompanyClick: (
    c: Company,
    id_exposant: string,
    stand: string | null,
    nom_exposant: string | null,
    needs_review: boolean,
  ) => void;
}> = ({ group, importId, getPref, getRel, onSetRel, onView, onModeSalon, onDebrief, similarCount = 0, onCompanyClick }) => {
  useEffect(() => { void trackRadarEvent('crm_result_event_card_viewed', { eventId: group.event_id }); }, [group.event_id]);
  const prio = priorityFor(group.companies.length);
  // Phase du salon (avant / pendant / après) → pilote la visibilité et la
  // mise en avant des actions « Mode salon » et « Débrief ».
  const phase = eventPhase(group.date_debut, group.date_fin);

  return (
    <Card className="overflow-hidden border-border/60 shadow-none hover:shadow-sm hover:border-border transition-all bg-card">
      <div className="flex flex-col sm:flex-row sm:items-start">
        {/* Thumbnail — largeur fixe, hauteur naturelle (object-contain) : image entière, jamais coupée */}
        <div className="relative w-full sm:w-[180px] sm:min-w-[180px] bg-muted overflow-hidden">
          {group.url_image ? (
            <img
              src={group.url_image}
              alt={group.nom_event}
              className="w-full h-auto object-contain sm:max-h-[280px]"
              loading="lazy"
            />
          ) : (
            <div
              className="w-full h-[140px] sm:h-[200px] flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}
            >
              <span className="text-2xl font-bold text-primary-foreground tracking-wider opacity-90">
                {eventInitials(group.nom_event)}
              </span>
            </div>
          )}
          {group.days_until != null && (
            <Badge className={cn(
              'absolute top-2 left-2 border-none text-xs',
              group.days_until < 30
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}>
              J-{Math.max(0, group.days_until)}
            </Badge>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 p-5 md:p-6 flex flex-col gap-4 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-lg leading-snug text-foreground line-clamp-2">{group.nom_event}</h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground mt-1.5">
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(group.date_debut)}</span>
                {(group.ville || group.nom_lieu) && (
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[group.nom_lieu, group.ville].filter(Boolean).join(' · ')}</span>
                )}
              </div>
            </div>
            {prio && (
              <Badge className={`${prio.tone} border-none whitespace-nowrap shrink-0`}>
                {prio.icon}{prio.label}
              </Badge>
            )}
          </div>

          {/* CRM companies — the heart of the card */}
          <div className="bg-muted/30 border border-border/60 rounded-lg p-4 md:p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {group.companies.length} entreprise{group.companies.length > 1 ? 's' : ''} de votre CRM
            </p>
            <div className="flex flex-wrap gap-2">
              {group.companies.map(({ company, id_exposant, stand, nom_exposant, needs_review }) => (
                <CompanyChip
                  key={company.id}
                  company={company}
                  stand={stand}
                  nomExposant={nom_exposant}
                  needsReview={needs_review}
                  starred={getPref?.(company.id) === 'starred'}
                  relationship={getRel?.(company)}
                  onSetRelationship={onSetRel ? (next) => onSetRel(company, next) : undefined}
                  onClick={() => onCompanyClick(company, id_exposant, stand, nom_exposant, needs_review)}
                />
              ))}
            </div>
          </div>

          {/* Suggestions d'exposants similaires (lazy) */}
          <SimilarExhibitorsSection eventId={group.event_id} initialCount={similarCount} />

          <div className="flex flex-wrap gap-2 mt-auto">
            <Button size="sm" onClick={onView} disabled={!group.slug}>
              Voir l'événement <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
            <AgendaLotexpoButton eventId={group.event_id} importId={importId} />
            {onModeSalon && showModeSalon(phase) && (
              modeSalonIsHot(phase) ? (
                <Button
                  size="sm"
                  onClick={onModeSalon}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Radar className="h-3.5 w-3.5 mr-1" /> Mode salon
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onModeSalon}
                  className="text-muted-foreground/70 hover:text-foreground"
                >
                  <Radar className="h-3.5 w-3.5 mr-1" /> Mode salon
                </Button>
              )
            )}
            {onDebrief && showDebrief(phase) && (
              <Button size="sm" variant="ghost" onClick={onDebrief} className="text-muted-foreground hover:text-foreground">
                <ClipboardList className="h-3.5 w-3.5 mr-1" /> Débrief
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default EventCard;
