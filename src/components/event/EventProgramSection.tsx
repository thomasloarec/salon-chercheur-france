import React, { useMemo, useState } from 'react';
import { Calendar, Clock, ExternalLink, Languages, MapPin } from 'lucide-react';
import {
  useEventProgram,
  type ProgramSession,
  type ProgramSpeaker,
} from '@/hooks/useEventProgram';
import { getMonogram } from '@/components/event/ExhibitorAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Event } from '@/types/event';

/**
 * Lot 4 — Section Programme publique de la page salon.
 *
 * Consomme la RPC get_public_event_program (lot 3). Le tri
 * jour → heure → position est fait côté SQL ; ce composant ne fait
 * que regrouper pour l'affichage. Comportements dégradés alignés sur
 * la maquette Maquette_Section_Programme_Lotexpo.html :
 *  - ≥ 3 intervenants distincts → galerie d'intervenants
 *  - ≥ 2 jours → onglets Jour 1 / Jour 2 (+ « Non daté » si besoin)
 *  - sessions sans heure → bloc « Également au programme »
 *  - aucune session horodatée → liste simple sans marqueur d'ordre
 *  - < 3 sessions → cartes simples côte à côte
 *  - > 8 sessions → filtres par type de session puis par track
 */

const SESSION_TYPE_LABELS: Record<string, string> = {
  keynote: 'Keynote',
  conference: 'Conférence',
  table_ronde: 'Table ronde',
  atelier: 'Atelier',
  demo: 'Démo',
  remise_prix: 'Remise de prix',
  networking: 'Networking',
  autre: 'Au programme',
};

/** Types rendus avec la pastille alternative bleue (maquette). */
const ALT_BADGE_TYPES = new Set(['atelier', 'demo', 'networking']);

/** Préfixes de rôle affichés quand le rôle n'est pas « intervenant ». */
const ROLE_PREFIX: Record<string, string> = {
  animateur: 'animé par',
  moderateur: 'modéré par',
};

const UNDATED_KEY = '__sans_date__';

function sessionTypeLabel(type: string | null): string {
  if (!type) return 'Au programme';
  return SESSION_TYPE_LABELS[type] ?? 'Au programme';
}

function normalizeRole(role: string | null): string {
  return (role ?? 'intervenant')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** '2026-12-01' → 'Mar. 1 déc.' */
function formatDayTab(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  const s = d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** '2026-12-01' → 'mar. 1 déc. 2026' (méta des cartes du mode compact) */
function formatDayMeta(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** '09:00:00' → '09:00' */
function formatTime(t: string | null): string | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

/** Durée calculée : « 45 min », « 1 h », « 1 h 30 ». Jamais inventée. */
function formatDuration(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const toMin = (t: string): number | null => {
    const m = t.match(/^(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const a = toMin(start);
  const b = toMin(end);
  if (a === null || b === null || b <= a) return null;
  const diff = b - a;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** Première occurrence, ordre de données (déjà trié SQL). */
function uniqueSpeakers(sessions: ProgramSession[]): ProgramSpeaker[] {
  const seen = new Set<string>();
  const out: ProgramSpeaker[] = [];
  for (const s of sessions) {
    for (const sp of s.speakers ?? []) {
      const key = sp.id || sp.full_name;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(sp);
    }
  }
  return out;
}

// ── Avatar intervenant : photo > monogramme ─────────────────────

const SpeakerAvatar: React.FC<{
  speaker: ProgramSpeaker;
  size?: 'lg' | 'sm';
  className?: string;
}> = ({ speaker, size = 'lg', className }) => {
  const [failed, setFailed] = useState(false);
  const showPhoto = !!speaker.photo_url && !failed;
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative flex flex-none items-center justify-center overflow-hidden rounded-full bg-violet-soft ring-1 ring-border',
        size === 'lg' ? 'h-24 w-24' : 'h-[34px] w-[34px] border-2 border-background',
        className
      )}
    >
      <span
        className={cn(
          'heading-display font-semibold leading-none text-primary',
          size === 'lg' ? 'text-3xl' : 'text-[13px]'
        )}
      >
        {getMonogram(speaker.full_name || '•')}
      </span>
      {showPhoto && (
        <img
          src={speaker.photo_url as string}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full rounded-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};

// ── Galerie d'intervenants (rail horizontal défilable) ──────────

const ProgramSpeakerGallery: React.FC<{ speakers: ProgramSpeaker[] }> = ({ speakers }) => {
  if (speakers.length < 3) return null;
  return (
    <div
      className="mb-8 flex gap-[18px] overflow-x-auto pb-3 pt-1 [scroll-snap-type:x_mandatory]"
      role="list"
      aria-label="Intervenants"
    >
      {speakers.map((sp) => (
        <div
          key={sp.id || sp.full_name}
          role="listitem"
          className="w-[132px] flex-none text-center [scroll-snap-align:start]"
        >
          <SpeakerAvatar speaker={sp} className="mx-auto mb-2.5" />
          <p className="text-sm font-semibold leading-tight">{sp.full_name}</p>
          {sp.job_title && (
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
              {sp.job_title}
            </p>
          )}
          {sp.company && (
            <p className="mt-0.5 text-xs font-semibold text-primary">{sp.company}</p>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Carte session ───────────────────────────────────────────────

const ProgramSessionCard: React.FC<{
  session: ProgramSession;
  /** Durée déjà affichée dans la colonne horaire → ne pas la répéter. */
  duration?: string | null;
  /** Mode compact (< 3 sessions) : afficher la date dans les méta. */
  showDate?: boolean;
}> = ({ session, duration, showDate = false }) => {
  const speakers = session.speakers ?? [];
  const intervenants = speakers.filter((s) => normalizeRole(s.role) === 'intervenant');
  const others = speakers.filter((s) => normalizeRole(s.role) !== 'intervenant');
  const altBadge = ALT_BADGE_TYPES.has(session.session_type ?? '');

  return (
    <article
      className={cn(
        'rounded-xl border p-4 transition-all sm:px-[18px]',
        session.is_highlight
          ? 'border-primary/30 bg-violet-soft'
          : 'border-border bg-card hover:border-primary/30 hover:shadow-[0_6px_22px_hsl(var(--primary)/0.10)]'
      )}
    >
      <span
        className={cn(
          'inline-block rounded-full px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide',
          altBadge
            ? 'bg-info/10 text-info'
            : session.is_highlight
              ? 'bg-card text-primary'
              : 'bg-violet-soft text-primary'
        )}
      >
        {sessionTypeLabel(session.session_type)}
      </span>

      <h3 className="heading-display mb-1.5 mt-2.5 text-lg font-semibold leading-snug">
        {session.title}
      </h3>

      {(showDate && session.day_date) || session.location || duration || session.language ? (
        <div className="mb-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
          {showDate && session.day_date && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDayMeta(session.day_date)}
            </span>
          )}
          {session.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {session.location}
            </span>
          )}
          {duration && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {duration}
            </span>
          )}
          {session.language && (
            <span className="inline-flex items-center gap-1.5">
              <Languages className="h-3.5 w-3.5" />
              {session.language}
            </span>
          )}
        </div>
      ) : null}

      {session.description && (
        <p className="mb-3 text-sm leading-relaxed text-foreground/80">{session.description}</p>
      )}

      {speakers.length > 0 && (
        <div className="flex items-center">
          <div className="flex">
            {speakers.map((sp, i) => (
              <SpeakerAvatar
                key={sp.id || sp.full_name || i}
                speaker={sp}
                size="sm"
                className={cn(i > 0 && '-ml-2')}
              />
            ))}
          </div>
          <p className="ml-3.5 text-[13px] text-foreground/80">
            {intervenants.map((sp, i) => (
              <span key={sp.id || sp.full_name || i} className="contents">
                {i > 0 && ', '}
                <span className="font-semibold text-foreground">{sp.full_name}</span>
              </span>
            ))}
            {intervenants.length === 1 && intervenants[0].job_title
              ? ` · ${intervenants[0].job_title}`
              : null}
            {others.map((sp) => {
              const norm = normalizeRole(sp.role);
              return ` · ${ROLE_PREFIX[norm] ?? norm} ${sp.full_name ?? ''}`;
            })}
          </p>
        </div>
      )}

      {session.registration_url && (
        <a
          href={session.registration_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          S'inscrire
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </article>
  );
};

// ── Créneau horaire de la timeline ──────────────────────────────

const TimelineSlot: React.FC<{ startTime: string; sessions: ProgramSession[] }> = ({
  startTime,
  sessions,
}) => {
  // La durée ne monte dans la colonne horaire que si toutes les
  // sessions du créneau partagent la même heure de fin.
  const endTimes = new Set(sessions.map((s) => s.end_time).filter(Boolean));
  const sharedDuration =
    endTimes.size === 1 ? formatDuration(startTime, sessions[0].end_time) : null;

  return (
    <div className="relative grid gap-5 sm:grid-cols-[78px_1fr]">
      <span
        aria-hidden="true"
        className="absolute left-[82px] top-6 hidden h-3 w-3 rounded-full bg-primary ring-4 ring-background sm:block"
      />
      <div className="flex items-baseline gap-2 sm:block sm:pt-4 sm:text-right">
        <span className="inline-block rounded-md bg-surface-inverse px-2.5 py-1 text-xs font-bold text-inverse sm:rounded-none sm:bg-transparent sm:p-0 sm:text-[15px] sm:text-foreground">
          {formatTime(startTime)}
        </span>
        {sharedDuration && (
          <span className="text-xs text-muted-foreground sm:mt-0.5 sm:block">
            {sharedDuration}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3 pb-5">
        {sessions.map((s) => (
          <ProgramSessionCard
            key={s.session_id}
            session={s}
            duration={sharedDuration ? null : formatDuration(s.start_time, s.end_time)}
          />
        ))}
      </div>
    </div>
  );
};

// ── Vue d'un groupe de sessions (un jour, ou « Non daté ») ──────

const ProgramDayView: React.FC<{ sessions: ProgramSession[] }> = ({ sessions }) => {
  const timed = sessions.filter((s) => s.start_time);
  const untimed = sessions.filter((s) => !s.start_time);

  // Aucune session horodatée : liste simple, sans marqueur d'ordre.
  if (timed.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {sessions.map((s) => (
          <ProgramSessionCard key={s.session_id} session={s} />
        ))}
      </div>
    );
  }

  const slots: [string, ProgramSession[]][] = [];
  for (const s of timed) {
    const key = s.start_time as string;
    const last = slots[slots.length - 1];
    if (last && last[0] === key) last[1].push(s);
    else slots.push([key, [s]]);
  }

  return (
    <div>
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-[87px] top-0 hidden w-0.5 bg-border sm:block"
        />
        <div className="flex flex-col gap-1">
          {slots.map(([startTime, slotSessions]) => (
            <TimelineSlot key={startTime} startTime={startTime} sessions={slotSessions} />
          ))}
        </div>
      </div>

      {untimed.length > 0 && (
        <div className="mt-6 border-t border-dashed border-border pt-5">
          <p className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
            Également au programme
          </p>
          <div className="flex flex-col gap-3">
            {untimed.map((s) => (
              <ProgramSessionCard key={s.session_id} session={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Section ─────────────────────────────────────────────────────

interface EventProgramSectionProps {
  event: Event;
}

const EventProgramSection: React.FC<EventProgramSectionProps> = ({ event }) => {
  const { data: sessions, isLoading, isError } = useEventProgram(event.id);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [trackFilter, setTrackFilter] = useState<string | null>(null);

  const all = useMemo(() => sessions ?? [], [sessions]);
  const speakers = useMemo(() => uniqueSpeakers(all), [all]);

  const days = useMemo(() => {
    const out: string[] = [];
    for (const s of all) {
      if (s.day_date && !out.includes(s.day_date)) out.push(s.day_date);
    }
    return out;
  }, [all]);
  const hasUndated = all.some((s) => !s.day_date);
  const compact = all.length < 3;
  const showTabs = !compact && days.length >= 2;

  const effectiveDay = activeDay ?? days[0] ?? null;

  const visibleSessions = useMemo(() => {
    let list = all;
    if (showTabs) {
      list =
        effectiveDay === UNDATED_KEY
          ? all.filter((s) => !s.day_date)
          : all.filter((s) => s.day_date === effectiveDay);
    }
    if (typeFilter) list = list.filter((s) => (s.session_type ?? 'autre') === typeFilter);
    if (trackFilter) list = list.filter((s) => s.track === trackFilter);
    return list;
  }, [all, showTabs, effectiveDay, typeFilter, trackFilter]);

  const typeOptions = useMemo(
    () => [...new Set(all.map((s) => s.session_type ?? 'autre'))],
    [all]
  );
  const trackOptions = useMemo(
    () => [...new Set(all.map((s) => s.track).filter((t): t is string => !!t))],
    [all]
  );
  const showFilters = all.length > 8 && (typeOptions.length > 1 || trackOptions.length > 1);

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (days.length >= 2) parts.push(`${days.length} jours de programme`);
    else if (days.length === 1) parts.push('une journée de programme');
    parts.push(`${all.length} session${all.length > 1 ? 's' : ''}`);
    if (speakers.length > 0) {
      parts.push(`${speakers.length} intervenant${speakers.length > 1 ? 's' : ''} attendu${speakers.length > 1 ? 's' : ''}`);
    }
    const s = parts.join(' · ');
    return s.charAt(0).toUpperCase() + s.slice(1) + '.';
  }, [days, all.length, speakers.length]);

  if (isLoading) {
    return (
      <div aria-busy="true" aria-label="Chargement du programme">
        <Skeleton className="mb-2 h-8 w-40" />
        <Skeleton className="mb-8 h-4 w-80 max-w-full" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || all.length === 0) return null;

  return (
    <div>
      <div className="mb-1.5">
        <h2 className="heading-display text-2xl md:text-3xl">Programme</h2>
      </div>
      <p className="mb-8 text-muted-foreground">{subtitle}</p>

      <ProgramSpeakerGallery speakers={speakers} />

      {showTabs && (
        <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Jours du programme">
          {days.map((day, i) => (
            <button
              key={day}
              type="button"
              role="tab"
              aria-selected={effectiveDay === day}
              onClick={() => setActiveDay(day)}
              className={cn(
                'rounded-full border px-4 py-2 text-[13.5px] font-semibold transition-colors',
                effectiveDay === day
                  ? 'border-surface-inverse bg-surface-inverse text-inverse'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
              )}
            >
              <span className="block text-[11px] font-medium opacity-75">{formatDayTab(day)}</span>
              Jour {i + 1}
            </button>
          ))}
          {hasUndated && (
            <button
              type="button"
              role="tab"
              aria-selected={effectiveDay === UNDATED_KEY}
              onClick={() => setActiveDay(UNDATED_KEY)}
              className={cn(
                'rounded-full border px-4 py-2 text-[13.5px] font-semibold transition-colors',
                effectiveDay === UNDATED_KEY
                  ? 'border-surface-inverse bg-surface-inverse text-inverse'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
              )}
            >
              Non daté
            </button>
          )}
        </div>
      )}

      {showFilters && (
        <div className="mb-5 flex flex-wrap gap-2">
          {typeOptions.length > 1 &&
            typeOptions.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={typeFilter === type}
                onClick={() => setTypeFilter((cur) => (cur === type ? null : type))}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  typeFilter === type
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {sessionTypeLabel(type)}
              </button>
            ))}
          {trackOptions.length > 1 &&
            trackOptions.map((track) => (
              <button
                key={track}
                type="button"
                aria-pressed={trackFilter === track}
                onClick={() => setTrackFilter((cur) => (cur === track ? null : track))}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  trackFilter === track
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {track}
              </button>
            ))}
        </div>
      )}

      {compact ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleSessions.map((s) => (
            <ProgramSessionCard key={s.session_id} session={s} showDate />
          ))}
        </div>
      ) : visibleSessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune session ne correspond à ces filtres.
        </p>
      ) : (
        <ProgramDayView sessions={visibleSessions} />
      )}
    </div>
  );
};

export default EventProgramSection;
