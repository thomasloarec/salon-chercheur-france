import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarCheck,
  CalendarClock,
  Check,
  Download,
  FileText,
  Inbox,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeSelect } from '@/components/ui/SafeSelect';
import { cn } from '@/lib/utils';

import PremiumUpgradeDialog from '@/components/novelty/PremiumUpgradeDialog';
import { usePremiumEntitlement } from '@/hooks/usePremiumEntitlement';
import {
  useExhibitorLeads,
  useSetLeadStatus,
  type ExhibitorLead,
  type LeadOrigin,
} from '@/hooks/useExhibitorLeads';

type TypeFilter = 'all' | 'meeting_request' | 'resource_download';
type StatusFilter = 'all' | 'new' | 'done';

const ORIGIN_LABEL: Record<LeadOrigin, string> = {
  invitation_page: "Page d'invitation",
  novelty: 'Nouveauté',
  visitor_journey: 'Parcours visiteur',
};

const isNew = (l: ExhibitorLead) => (l.status ?? 'new') === 'new';

function initials(l: ExhibitorLead) {
  const a = (l.first_name ?? '').trim().charAt(0);
  const b = l.masked ? '' : (l.last_name ?? '').trim().charAt(0);
  return (a + b).toUpperCase() || '?';
}

function csvCell(v: string | null | undefined) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-border bg-muted/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'px-3 py-1.5 text-sm rounded-[5px] transition-colors whitespace-nowrap',
            value === o.value
              ? 'bg-background text-foreground font-medium shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface ExhibitorLeadsSectionProps {
  exhibitorId: string;
  onGoToNovelties: () => void;
  onGoToInvitations?: () => void;
}

export default function ExhibitorLeadsSection({ exhibitorId, onGoToNovelties, onGoToInvitations }: ExhibitorLeadsSectionProps) {
  const { data: leads = [], isLoading, isError, refetch } = useExhibitorLeads(exhibitorId);
  const setStatus = useSetLeadStatus(exhibitorId);

  const [eventFilter, setEventFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [premiumEventId, setPremiumEventId] = useState<string | null>(null);

  const { data: entitlement } = usePremiumEntitlement(exhibitorId, eventFilter ?? undefined);
  const canExport = !!eventFilter && !!entitlement?.csvExport;

  const eventOptions = useMemo(() => {
    const seen = new Map<string, string>();
    leads.forEach((l) => {
      if (l.event_id && !seen.has(l.event_id)) seen.set(l.event_id, l.event_name ?? 'Salon');
    });
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [leads]);

  const counts = useMemo(
    () => ({
      toProcess: leads.filter(isNew).length,
      meetings: leads.filter((l) => l.lead_type === 'meeting_request').length,
      brochures: leads.filter((l) => l.lead_type === 'resource_download').length,
    }),
    [leads],
  );

  const filtered = useMemo(
    () =>
      leads.filter((l) => {
        if (eventFilter && l.event_id !== eventFilter) return false;
        if (typeFilter !== 'all' && l.lead_type !== typeFilter) return false;
        if (statusFilter === 'new' && !isNew(l)) return false;
        if (statusFilter === 'done' && isNew(l)) return false;
        return true;
      }),
    [leads, eventFilter, typeFilter, statusFilter],
  );

  const maskedLeads = filtered.filter((l) => l.masked);
  const hasFilters = !!eventFilter || typeFilter !== 'all' || statusFilter !== 'all';

  const resetFilters = () => {
    setEventFilter(null);
    setTypeFilter('all');
    setStatusFilter('all');
  };

  const toggleStatus = (l: ExhibitorLead) => {
    setStatus.mutate(
      { id: l.id, status: isNew(l) ? 'contacted' : 'new' },
      {
        onError: () => toast.error('Impossible de mettre à jour cette demande. Réessayez.'),
      },
    );
  };

  const exportCsv = () => {
    const rows = filtered.filter((l) => !l.masked);
    const header = ['Prenom', 'Nom', 'Email', 'Telephone', 'Societe', 'Fonction', 'Type', 'Origine', 'Creneau souhaite', 'Salon', 'Message', 'Statut', 'Date'];
    const lines = rows.map((l) =>
      [
        l.first_name,
        l.last_name,
        l.email,
        l.phone,
        l.company,
        l.role,
        l.lead_type === 'meeting_request' ? 'Rendez-vous' : 'Brochure',
        ORIGIN_LABEL[l.origin],
        l.preferred_slot,
        l.event_name,
        l.notes,
        isNew(l) ? 'A traiter' : 'Traite',
        format(new Date(l.created_at), 'dd/MM/yyyy'),
      ]
        .map(csvCell)
        .join(','),
    );
    const blob = new Blob(['\uFEFF' + [header.join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rendez-vous_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // Erreur distincte d'une liste vide : un échec ne doit jamais ressembler à « aucune demande ».
  if (isError) {
    return (
      <Card className="p-6 flex items-center justify-between gap-4 flex-wrap border-destructive/40">
        <div className="flex items-center gap-3 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          Impossible de charger vos demandes pour le moment.
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Réessayer
        </Button>
      </Card>
    );
  }

  if (leads.length === 0) {
    return (
      <Card className="p-10 text-center space-y-3">
        <div className="mx-auto w-14 h-14 rounded-full bg-violet-soft flex items-center justify-center">
          <Inbox className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Aucune demande pour le moment</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Les demandes de rendez-vous et les téléchargements de brochure de vos Nouveautés
          arriveront ici, avec les coordonnées de vos contacts.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {onGoToInvitations && (
            <Button onClick={onGoToInvitations}>Créer ma page d'invitation</Button>
          )}
          <Button variant="outline" onClick={onGoToNovelties}>
            Voir mes nouveautés
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Compteurs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'À traiter', value: counts.toProcess, icon: Send, accent: true },
          { label: 'Rendez-vous', value: counts.meetings, icon: CalendarCheck, accent: false },
          { label: 'Brochures', value: counts.brochures, icon: FileText, accent: false },
        ].map(({ label, value, icon: Icon, accent }) => (
          <Card
            key={label}
            className={cn('p-4 flex items-center gap-3', accent && value > 0 && 'border-primary/40 bg-violet-soft/60')}
          >
            <div
              className={cn(
                'hidden sm:flex w-10 h-10 rounded-full items-center justify-center shrink-0',
                accent && value > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {eventOptions.length > 1 && (
            <SafeSelect
              ariaLabel="Filtrer par salon"
              value={eventFilter}
              onChange={setEventFilter}
              placeholder="Tous les salons"
              allLabel="Tous les salons"
              options={eventOptions}
              className="w-[220px]"
            />
          )}
          <Segmented
            label="Type de demande"
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as TypeFilter)}
            options={[
              { value: 'all', label: 'Tout' },
              { value: 'meeting_request', label: 'Rendez-vous' },
              { value: 'resource_download', label: 'Brochures' },
            ]}
          />
          <Segmented
            label="Statut"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            options={[
              { value: 'all', label: 'Tous' },
              { value: 'new', label: 'À traiter' },
              { value: 'done', label: 'Traités' },
            ]}
          />
        </div>
        {canExport && (
          <Button variant="outline" size="sm" onClick={exportCsv} className="self-start lg:self-auto">
            <Download className="h-4 w-4 mr-1.5" />
            Exporter en CSV
          </Button>
        )}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Aucune demande ne correspond à ces filtres.</p>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Réinitialiser les filtres
            </Button>
          )}
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((l) => {
            const pending = setStatus.isPending && setStatus.variables?.id === l.id;
            const isMeeting = l.lead_type === 'meeting_request';
            return (
              <li key={l.id}>
                <Card className={cn('p-4 sm:p-5 transition-colors', isNew(l) && 'border-l-4 border-l-primary')}>
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div
                      aria-hidden
                      className="w-10 h-10 rounded-full bg-violet-soft text-primary font-semibold text-sm flex items-center justify-center shrink-0"
                    >
                      {initials(l)}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Identité + date */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {l.first_name} {l.last_name}
                          </p>
                          {(l.company || l.role) && (
                            <p className={cn('text-sm text-muted-foreground truncate', l.masked && 'blur-[3px] select-none')}>
                              {[l.company, l.role].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(l.created_at), 'd MMM yyyy', { locale: fr })}
                          </p>
                          {isNew(l) ? (
                            <Badge className="mt-1 text-[11px]">À traiter</Badge>
                          ) : (
                            <Badge variant="secondary" className="mt-1 text-[11px]">
                              Traité
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Type, origine, salon */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <Badge variant="outline" className="gap-1 font-normal">
                          {isMeeting ? <CalendarCheck className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                          {isMeeting ? 'Rendez-vous' : 'Brochure'}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            'gap-1 font-normal',
                            l.origin === 'invitation_page' && 'border-primary/40 bg-violet-soft text-foreground',
                          )}
                        >
                          {l.origin === 'invitation_page' && <Sparkles className="h-3 w-3 text-primary" />}
                          {l.origin === 'novelty' && l.novelty_title
                            ? `Nouveauté : ${l.novelty_title}`
                            : ORIGIN_LABEL[l.origin]}
                        </Badge>
                        {l.event_name && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {l.event_name}
                          </span>
                        )}
                      </div>

                      {/* Créneau souhaité : texte libre choisi par le visiteur (D3) */}
                      {isMeeting && l.preferred_slot && (
                        <div className="inline-flex items-center gap-2 rounded-md bg-violet-soft px-3 py-1.5 text-sm text-foreground">
                          <CalendarClock className="h-4 w-4 text-primary" />
                          <span>
                            Créneau souhaité : <span className="font-medium">{l.preferred_slot}</span>
                          </span>
                        </div>
                      )}

                      {/* Coordonnées */}
                      <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-sm', l.masked && 'blur-[3px] select-none')}>
                        {l.masked ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            {l.email}
                          </span>
                        ) : (
                          <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                            <Mail className="h-3.5 w-3.5" />
                            {l.email}
                          </a>
                        )}
                        {l.phone &&
                          (l.masked ? (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              {l.phone}
                            </span>
                          ) : (
                            <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                              <Phone className="h-3.5 w-3.5" />
                              {l.phone}
                            </a>
                          ))}
                      </div>

                      {l.notes && !l.masked && (
                        <p className="rounded-md bg-muted/50 border border-border p-3 text-sm text-foreground whitespace-pre-wrap">
                          {l.notes}
                        </p>
                      )}

                      {l.masked ? (
                        <button
                          type="button"
                          onClick={() => setPremiumEventId(l.event_id)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          Débloquer ce contact
                        </button>
                      ) : (
                        <div className="pt-1">
                          <Button
                            size="sm"
                            variant={isNew(l) ? 'outline' : 'ghost'}
                            className={cn(!isNew(l) && '-ml-3 text-muted-foreground')}
                            disabled={pending}
                            onClick={() => toggleStatus(l)}
                          >
                            {pending ? (
                              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                            ) : isNew(l) ? (
                              <Check className="h-4 w-4 mr-1.5" />
                            ) : (
                              <RotateCcw className="h-4 w-4 mr-1.5" />
                            )}
                            {isNew(l) ? 'Marquer comme traité' : 'Remettre à traiter'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {maskedLeads.length > 0 && (
        <Card className="p-5 border-dashed bg-muted/40 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground">
                {maskedLeads.length} contact{maskedLeads.length > 1 ? 's' : ''} flouté{maskedLeads.length > 1 ? 's' : ''}
              </p>
              <p className="text-sm text-muted-foreground">
                Les 3 premiers contacts de chaque Nouveauté sont offerts. Passez en Premium sur ce
                salon pour débloquer les suivants. Les demandes reçues via votre page d'invitation
                ne sont jamais floutées.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setPremiumEventId(maskedLeads[0].event_id)} className="shrink-0">
            Débloquer les contacts
          </Button>
        </Card>
      )}

      <PremiumUpgradeDialog
        open={!!premiumEventId}
        onOpenChange={(open) => !open && setPremiumEventId(null)}
        eventId={premiumEventId ?? undefined}
        eventName={leads.find((l) => l.event_id === premiumEventId)?.event_name ?? undefined}
        eventSlug={leads.find((l) => l.event_id === premiumEventId)?.event_slug ?? undefined}
      />
    </div>
  );
}
