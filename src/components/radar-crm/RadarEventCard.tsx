import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar, MapPin, Check, CalendarPlus, Target, ExternalLink, ChevronDown,
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
import { formatDate, CompanyAvatar, CompanyChip } from './RadarShared';

/** Carte salon — variante compacte (repliable) et détaillée, sans visuel. */
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
          <Check className="h-3.5 w-3.5 mr-1" />
        ) : (
          <CalendarPlus className="h-3.5 w-3.5 mr-1" />
        )}
        Je participe
      </Button>
      <AuthRequiredModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </>
  );
};

const EventCard: React.FC<{
  group: EventGroup;
  importId?: string | null;
  variant?: 'detailed' | 'compact';
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
}> = ({ group, importId, variant = 'detailed', getPref, onView, similarCount = 0, onCompanyClick }) => {
  useEffect(() => { void trackRadarEvent('crm_result_event_card_viewed', { eventId: group.event_id }); }, [group.event_id]);

  // Comptes prioritaires d'abord, puis ordre existant.
  const ordered = [...group.companies].sort((a, b) => {
    const as = getPref?.(a.company.id) === 'starred' ? 0 : 1;
    const bs = getPref?.(b.company.id) === 'starred' ? 0 : 1;
    return as - bs;
  });
  const firstThree = ordered.slice(0, 3);
  const extra = ordered.length - firstThree.length;
  const namesLine = `${firstThree.map((x) => x.company.company_name).join(', ')}${
    extra > 0 ? ` et ${extra} autre${extra > 1 ? 's' : ''} compte${extra > 1 ? 's' : ''}` : ''
  } y expose${ordered.length > 1 ? 'nt' : ''}`;

  const imminent = group.days_until != null && group.days_until < 10;
  const deadline = group.days_until != null ? `J-${Math.max(0, group.days_until)}` : null;
  const place = [group.nom_lieu, group.ville].filter(Boolean).join(' · ');

  if (variant === 'compact') {
    return (
      <Card
        role="button"
        tabIndex={0}
        onClick={onView}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(); } }}
        className="cursor-pointer border-border/60 shadow-none hover:border-border hover:shadow-sm transition-all bg-card"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-foreground truncate" title={group.nom_event}>
              {group.nom_event}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {formatDate(group.date_debut)}{group.ville ? ` · ${group.ville}` : ''} · {group.companies.length} compte{group.companies.length > 1 ? 's' : ''}
            </p>
          </div>
          {deadline && <span className="shrink-0 text-xs text-muted-foreground">{deadline}</span>}
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border/60 shadow-none hover:shadow-sm hover:border-border transition-all bg-card">
      {/* Bandeau image pleine largeur */}
      <div className="w-full bg-muted overflow-hidden max-h-[120px]">
        {group.url_image ? (
          <img
            src={group.url_image}
            alt={group.nom_event}
            className="w-full h-[120px] object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-[120px] flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}
          >
            <span className="text-2xl font-bold text-primary-foreground tracking-wider opacity-90">
              {eventInitials(group.nom_event)}
            </span>
          </div>
        )}
      </div>

      <div className="p-5 md:p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onView}
              disabled={!group.slug}
              title={group.nom_event}
              className="group flex items-center gap-1 min-w-0 text-left text-[17px] font-medium leading-snug text-foreground hover:underline disabled:opacity-60 disabled:hover:no-underline"
            >
              <span className="truncate">{group.nom_event}</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(group.date_debut)}{group.date_fin ? ` — ${formatDate(group.date_fin)}` : ''}
              </span>
              {place && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{place}</span>}
            </div>
          </div>
          {deadline && (
            <Badge className={cn(
              'shrink-0 border-none',
              imminent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
            )}>
              {deadline}
            </Badge>
          )}
        </div>

        {/* Les comptes du CRM — sujet principal */}
        {ordered.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex shrink-0">
              {firstThree.map(({ company }, idx) => (
                <div key={company.id} className={cn('rounded-md ring-2 ring-card', idx > 0 && '-ml-2')}>
                  <CompanyAvatar company={company} size="xs" />
                </div>
              ))}
            </div>
            <p className="text-[13px] text-foreground min-w-0">{namesLine}</p>
          </div>
        )}

        {/* Suggestions d'exposants similaires (lazy) */}
        <SimilarExhibitorsSection eventId={group.event_id} initialCount={similarCount} />

        <div className="border-t border-border/60 pt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              const first = ordered[0];
              if (first) onCompanyClick(first.company, first.id_exposant, first.stand, first.nom_exposant, first.needs_review);
            }}
            disabled={ordered.length === 0}
          >
            <Target className="h-3.5 w-3.5 mr-1" /> Préparer mes visites
          </Button>
          <AgendaLotexpoButton eventId={group.event_id} importId={importId} />
        </div>
      </div>
    </Card>
  );
};

export default EventCard;
