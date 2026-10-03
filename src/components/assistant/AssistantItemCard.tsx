import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Check, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import NoveltyImage from '@/components/novelty/NoveltyImage';
import { RequestMeetingButton } from '@/components/exhibitor/RequestMeetingButton';
import type { AssistantItem } from './types';
import { useAssistantActions, type NotForMeReason } from './useAssistantActions';
import { dayLabel, sessionTypeLabel, timeLabel } from './format';

interface Props {
  item: AssistantItem;
  profileId?: string;
  readOnly?: boolean;
  compact?: boolean;
  onProposeDistance?: () => void;
}

export default function AssistantItemCard({ item, profileId, readOnly, compact, onProposeDistance }: Props) {
  const actions = useAssistantActions({ onProposeDistance });
  const [collapsed, setCollapsed] = useState(false);
  const [reason, setReason] = useState<NotForMeReason>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const close = () => {
    if (timer.current) window.clearTimeout(timer.current);
    actions.invalidateFeed();
  };

  const handleNotForMe = async () => {
    if (!profileId) return;
    const res = await actions.notForMe(item, null, profileId);
    if (!res) return;
    setCollapsed(true);
    timer.current = window.setTimeout(() => actions.invalidateFeed(), 20000);
  };

  const pickReason = async (r: Exclude<NotForMeReason, null>) => {
    if (!profileId) return;
    setReason(r);
    await actions.notForMe(item, r, profileId);
  };

  const isSession = item.item_type === 'session';
  const s = item.session;
  const n = item.novelty;
  const titleCls = compact ? 'text-[17px]' : 'text-[19px] sm:text-[21px]';

  if (collapsed) {
    const chips: { key: Exclude<NotForMeReason, null>; label: string }[] = [];
    if (item.subject_label) chips.push({ key: 'sujet', label: `Pas ce sujet (${item.subject_label})` });
    if (item.sector) chips.push({ key: 'secteur', label: `Pas mon secteur (${item.sector.name})` });
    chips.push({ key: 'trop_general', label: 'Trop général' });
    return (
      <div className="space-y-3 py-4">
        <p className={cn('font-bold text-muted-foreground line-through', titleCls)}>{item.title}</p>
        <p className="text-[15px]">
          <span className="font-bold text-foreground">Pourquoi ?</span>{' '}
          <span className="text-muted-foreground">(facultatif, pour mieux chercher)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => pickReason(c.key)}
              aria-pressed={reason === c.key}
              className={cn(
                'h-[42px] rounded-full border border-primary px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                reason === c.key ? 'bg-primary text-primary-foreground' : 'bg-background text-primary hover:bg-violet-soft',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="ghost" className="min-h-11" onClick={close}>
            Fermer
          </Button>
        </div>
      </div>
    );
  }

  const title = item.title ?? '';
  const titleNode =
    !isSession && n?.slug ? (
      <Link to={`/nouveautes/${n.slug}`} className="hover:underline focus-visible:underline">
        {title}
      </Link>
    ) : (
      title
    );

  const hours = [timeLabel(s?.start_time), timeLabel(s?.end_time)].filter(Boolean).join(' – ');
  const day = dayLabel(s?.day_date);
  const mobileTitleCls = isSession ? 'text-[18px]' : 'text-[17px]';
  const desktopTitleCls = compact ? 'sm:text-[17px]' : 'sm:text-[21px]';

  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:gap-4">
      {isSession ? (
        <div className="hidden w-20 shrink-0 text-center sm:block">
          <div className="text-[22px] font-bold leading-tight text-foreground">{timeLabel(s?.start_time)}</div>
          <div className="text-xs text-muted-foreground">{day}</div>
        </div>
      ) : (
        <div className={cn('hidden shrink-0 overflow-hidden rounded-lg sm:block', compact ? 'w-[90px]' : 'w-[120px]')}>
          <NoveltyImage src={n?.image_url} alt={title} type="novelty" ratioClassName="aspect-[3/4]" fit="contain" />
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 text-sm sm:gap-x-2 sm:gap-y-1">
          {isSession ? (
            <>
              <span className="rounded bg-primary px-2 py-0.5 text-xs font-bold uppercase text-primary-foreground">
                {sessionTypeLabel(s?.session_type)}
              </span>
              {hours && (
                <span className="font-bold text-foreground sm:font-normal sm:text-muted-foreground">{hours}</span>
              )}
              {day && <span className="text-muted-foreground sm:hidden">· {day}</span>}
              {s?.location && (
                <span className="text-muted-foreground">
                  {hours || day ? '· ' : ''}
                  {s.location}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="rounded bg-info px-2 py-0.5 text-xs font-bold uppercase text-info-foreground">
                Nouveauté
              </span>
              {n?.exhibitor_name &&
                (n.exhibitor_slug ? (
                  <Link to={`/exposants/${n.exhibitor_slug}`} className="font-bold text-foreground hover:underline">
                    {n.exhibitor_name}
                  </Link>
                ) : (
                  <span className="font-bold text-foreground">{n.exhibitor_name}</span>
                ))}
              <span className="text-muted-foreground">· {n?.stand_info || 'Stand à confirmer'}</span>
            </>
          )}
        </div>

        <div className="flex items-start gap-3 sm:block">
          {!isSession && (
            <div className="w-[72px] shrink-0 overflow-hidden rounded-lg sm:hidden">
              <NoveltyImage src={n?.image_url} alt="" type="novelty" ratioClassName="aspect-[3/4]" fit="contain" />
            </div>
          )}
          <h3
            className={cn(
              'min-w-0 flex-1 break-words font-bold leading-snug text-foreground',
              mobileTitleCls,
              desktopTitleCls,
            )}
          >
            {titleNode}
          </h3>
        </div>
        {item.promise && <p className="line-clamp-2 text-[15px] text-muted-foreground">{item.promise}</p>}

        {item.reason ? (
          <div className="rounded-lg bg-violet-soft p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[13px] font-bold text-primary">
              <Target className="h-4 w-4" aria-hidden />
              Pourquoi pour vous
            </div>
            <p className="break-words text-[15px] text-foreground">{item.reason}</p>
          </div>
        ) : item.kept ? (
          <p className="text-[15px] text-muted-foreground">Vous l'avez ajoutée à votre agenda.</p>
        ) : null}

        {!readOnly && (
          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
            {item.kept ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-violet-soft px-3 text-sm font-medium text-primary">
                  <Check className="h-4 w-4" aria-hidden />
                  Dans votre agenda
                </span>
                <Button type="button" variant="ghost" className="min-h-11" onClick={() => actions.removeFromAgenda(item)}>
                  Retirer
                </Button>
              </div>
            ) : (
              <>
                <Button type="button" className="min-h-11 w-full gap-2 sm:w-auto" onClick={() => actions.addToAgenda(item)}>
                  <CalendarPlus className="h-4 w-4" aria-hidden />
                  Ajouter à mon agenda
                </Button>
                {s?.registration_url && profileId && (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={() => actions.register(item, profileId)}
                  >
                    S'inscrire
                  </Button>
                )}
                {n?.can_request_meeting && n.exhibitor_id && (
                  <div
                    className="w-full sm:w-auto [&_button]:min-h-11 [&_button]:w-full sm:[&_button]:w-auto"
                    onClickCapture={(e) => {
                      if (profileId && (e.target as HTMLElement).closest('button') === e.currentTarget.querySelector('button')) {
                        void actions.meetingIntent(item, profileId);
                      }
                    }}
                  >
                    <RequestMeetingButton
                      exhibitorRef={n.exhibitor_id}
                      eventId={item.event_id}
                      exhibitorName={n.exhibitor_name ?? ''}
                      variant="compact"
                    />
                  </div>
                )}
              </>
            )}
            {!item.kept && profileId && (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 self-start text-muted-foreground sm:ml-auto sm:self-auto"
                onClick={handleNotForMe}
              >
                Pas pour moi
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
