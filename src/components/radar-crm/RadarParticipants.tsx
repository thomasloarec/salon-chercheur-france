import React from 'react';
import { cn } from '@/lib/utils';
import { type RadarParticipant } from '@/types/radar';

const initials = (p: RadarParticipant) => {
  if (p.is_me && !p.display_name) return 'Moi';
  const n = (p.display_name ?? '').trim();
  if (!n) return '?';
  return n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
};

const firstName = (p: RadarParticipant) =>
  p.is_me ? 'Vous' : ((p.display_name ?? '').trim().split(/\s+/)[0] || 'Un collègue');

export const ParticipantAvatar: React.FC<{ participant: RadarParticipant; size?: number; className?: string }> = ({
  participant, size = 24, className,
}) => (
  participant.avatar_url ? (
    <img
      src={participant.avatar_url}
      alt={participant.display_name ?? 'Participant'}
      style={{ width: size, height: size }}
      className={cn('rounded-full object-cover', className)}
      loading="lazy"
    />
  ) : (
    <span
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.4)) }}
      className={cn('inline-flex items-center justify-center rounded-full bg-primary/15 font-medium text-primary', className)}
      aria-hidden
    >
      {initials(participant)}
    </span>
  )
);

/** « Vous participez », « Vous et Marc participez », « Marc et Julie y vont »… */
export function participationSentence(participants: RadarParticipant[]): string {
  if (participants.length === 0) return '';
  const me = participants.find((p) => p.is_me);
  const ordered = me ? [me, ...participants.filter((p) => !p.is_me)] : participants;
  const names = ordered.map(firstName);
  const verb = me ? 'participez' : 'y vont';
  if (names.length === 1) return me ? 'Vous participez' : `${names[0]} y va`;
  if (names.length === 2) return `${names[0]} et ${names[1]} ${verb}`;
  const rest = names.length - 2;
  return `${names[0]}, ${names[1]} et ${rest} autre${rest > 1 ? 's' : ''}`;
}

export const ParticipantsRow: React.FC<{ participants: RadarParticipant[]; max?: number; size?: number }> = ({
  participants, max = 3, size = 24,
}) => {
  if (participants.length === 0) return null;
  const me = participants.find((p) => p.is_me);
  const ordered = me ? [me, ...participants.filter((p) => !p.is_me)] : participants;
  const shown = ordered.slice(0, max);
  const extra = ordered.length - shown.length;
  return (
    <div className="flex shrink-0 items-center">
      {shown.map((p, i) => (
        <div key={p.user_id} className={cn('rounded-full ring-2 ring-card', i > 0 && '-ml-2')}>
          <ParticipantAvatar participant={p} size={size} />
        </div>
      ))}
      {extra > 0 && (
        <span
          style={{ height: size, fontSize: Math.max(9, Math.round(size * 0.42)) }}
          className="-ml-2 inline-flex items-center justify-center rounded-full bg-muted px-1.5 font-medium text-muted-foreground ring-2 ring-card"
        >
          +{extra}
        </span>
      )}
    </div>
  );
};
