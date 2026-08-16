import React, { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar, MapPin, Check, CalendarPlus, Target, ExternalLink, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import AuthRequiredModal from '@/components/AuthRequiredModal';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';
import { useSetParticipation } from '@/hooks/useRadarParticipation';
import { ParticipantsRow, participationSentence } from '@/components/radar-crm/RadarParticipants';
import SimilarExhibitorsSection from '@/components/radar-crm/SimilarExhibitorsSection';
import { eventPhase, showModeSalon, modeSalonIsHot, showDebrief } from '@/lib/radarCrm/eventPhase';
import { type RelationshipStatus } from '@/lib/radarCrm/relationship';
import { type Company, type EventGroup, type Pref, type RadarParticipant } from '@/types/radar';
import { formatDate, CompanyAvatar, CompanyChip } from './RadarShared';

/** Carte salon — variante compacte (repliable) et détaillée, sans visuel. */
const ParticipationButton: React.FC<{
  eventId: string;
  participating: boolean;
  onOptimistic: (next: boolean | null) => void;
}> = ({ eventId, participating, onOptimistic }) => {
  const { user } = useAuth();
  const setParticipation = useSetParticipation();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    const next = !participating;
    onOptimistic(next); // mise à jour optimiste immédiate
    try {
      await setParticipation.mutateAsync({ eventId, participating: next });
    } catch (err) {
      console.error('Error toggling participation:', err);
      onOptimistic(null);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant={participating ? 'default' : 'outline'}
        onClick={handleClick}
        disabled={setParticipation.isPending}
        className={cn(
          'transition-all duration-200',
          participating && 'bg-[#eeedfe] text-[#6b51ff] hover:bg-[#e4e1fb] border-[#6b51ff]/40',
        )}
      >
        {participating ? (
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
}> = ({ group, importId, variant = 'detailed', getPref, getRel, onSetRel, onView, similarCount = 0, onCompanyClick }) => {
  useEffect(() => { void trackRadarEvent('crm_result_event_card_viewed', { eventId: group.event_id }); }, [group.event_id]);
  const [expanded, setExpanded] = useState(false);
  const [showAllCompanies, setShowAllCompanies] = useState(false);
  const [prepareMode, setPrepareMode] = useState(false);
  const chipsRef = useRef<HTMLDivElement>(null);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  // Participation : état serveur + surcouche optimiste locale.
  const serverParticipants = group.participants ?? [];
  const serverIsMe = serverParticipants.some((p) => p.is_me);
  const isParticipating = optimistic ?? serverIsMe;
  useEffect(() => { setOptimistic(null); }, [serverIsMe]);
  const participants: RadarParticipant[] = React.useMemo(() => {
    if (optimistic === null || optimistic === serverIsMe) return serverParticipants;
    if (optimistic) {
      return [{ user_id: 'me', display_name: null, avatar_url: null, is_me: true }, ...serverParticipants];
    }
    return serverParticipants.filter((p) => !p.is_me);
  }, [optimistic, serverIsMe, serverParticipants]);
  const hasParticipants = participants.length > 0;
  const participationLabel = participationSentence(participants);

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

  // Corps détaillé — partagé entre la variante détaillée et la carte compacte dépliée.
  const body = (
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
          <div className="flex shrink-0 items-start gap-3">
            {deadline && (
              <Badge className={cn(
                'shrink-0 border-none',
                imminent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              )}>
                {deadline}
              </Badge>
            )}
            {hasParticipants && (
              <div className="flex flex-col items-end gap-1">
                <ParticipantsRow participants={participants} />
                <span className="text-[12px] text-muted-foreground whitespace-nowrap">{participationLabel}</span>
              </div>
            )}
          </div>
        </div>

        {/* Les comptes du CRM — sujet principal */}
        {ordered.length > 0 && (
          <div className="flex flex-col gap-2">
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
            {ordered.length > 3 && (
              <button
                type="button"
                onClick={() => { setShowAllCompanies((v) => !v); setPrepareMode(false); }}
                className="w-fit text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                {showAllCompanies ? 'Masquer les comptes' : `Voir les ${ordered.length} comptes`}
              </button>
            )}
            {showAllCompanies && (
              <div className="flex flex-col gap-2" ref={chipsRef}>
                {prepareMode && (
                  <p className="text-xs text-muted-foreground">Choisissez le compte à préparer</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {ordered.map((x) => (
                    <CompanyChip
                      key={`${x.company.id}-${x.id_exposant}`}
                      company={x.company}
                      stand={x.stand}
                      nomExposant={x.nom_exposant}
                      needsReview={x.needs_review}
                      starred={getPref?.(x.company.id) === 'starred'}
                      relationship={getRel?.(x.company)}
                      onSetRelationship={onSetRel ? (next) => onSetRel(x.company, next) : undefined}
                      onClick={() => onCompanyClick(x.company, x.id_exposant, x.stand, x.nom_exposant, x.needs_review)}
                    />
                  ))}
                </div>
              </div>
            )}
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
          <ParticipationButton
            eventId={group.event_id}
            participating={isParticipating}
            onOptimistic={setOptimistic}
          />
        </div>
    </div>
  );

  if (variant === 'compact') {
    return (
      <Card className={cn(
        'overflow-hidden shadow-none hover:shadow-sm transition-all',
        hasParticipants ? 'border-[#6b51ff]/30 bg-[#eeedfe]' : 'border-border/60 hover:border-border bg-card',
      )}>
        {expanded ? (
          body
        ) : (
          <div
            role="button"
            tabIndex={0}
            aria-expanded={false}
            onClick={() => setExpanded(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(true); } }}
            className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <span
                role="link"
                tabIndex={0}
                title={group.nom_event}
                onClick={(e) => { e.stopPropagation(); if (group.slug) onView(); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (group.slug) onView(); } }}
                className="block truncate text-[15px] font-medium text-foreground hover:underline"
              >
                {group.nom_event}
              </span>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {formatDate(group.date_debut)}{group.ville ? ` · ${group.ville}` : ''} · {group.companies.length} compte{group.companies.length > 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {deadline && <span className="text-xs text-muted-foreground">{deadline}</span>}
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
            </div>
          </div>
        )}
        {expanded && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="flex w-full items-center justify-center gap-1 border-t border-border/60 px-4 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Replier <ChevronDown className="h-4 w-4 rotate-180 transition-transform duration-200" />
          </button>
        )}
      </Card>
    );
  }

  return (
    <Card className={cn(
      'overflow-hidden shadow-none hover:shadow-sm transition-all',
      hasParticipants ? 'border-[#6b51ff]/30 bg-[#eeedfe]' : 'border-border/60 hover:border-border bg-card',
    )}>
      {body}
    </Card>
  );
};

export default EventCard;
