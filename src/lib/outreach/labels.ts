export const STOP_REASONS = [
  'email_not_found',
  'not_attending_event',
  'not_interested',
  'do_not_contact',
  'irrelevant_contact',
  'handled_offline',
  'other',
] as const;

export type StopReason = (typeof STOP_REASONS)[number];

export const STOP_REASON_LABELS: Record<StopReason, string> = {
  email_not_found: 'Adresse email introuvable',
  not_attending_event: "Société ne participe pas à l'événement",
  not_interested: 'Pas intéressé',
  do_not_contact: 'Demande de ne plus être contacté',
  irrelevant_contact: 'Contact non pertinent',
  handled_offline: 'Déjà traité hors plateforme',
  other: 'Autre',
};

/** Reasons that blacklist the email globally (durable, cross-event). */
export const TERMINAL_BLACKLIST_REASONS: readonly StopReason[] = [
  'email_not_found',
  'do_not_contact',
];

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  not_started: 'Non démarrée',
  active: 'En cours',
  paused: 'En pause',
  ready: 'Prête',
  in_progress: 'En cours',
  completed: 'Terminée',
  stopped: 'Arrêtée manuellement',
  novelty_published: 'Terminée (nouveauté publiée)',
  converted: 'Convertie (nouveauté)',
  opted_out: 'Opt-out / ne plus contacter',
  blocked_invalid_email: 'Email invalide',
};

export const CAMPAIGN_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  in_progress: 'default',
  ready: 'secondary',
  not_started: 'outline',
  paused: 'outline',
  completed: 'secondary',
  converted: 'secondary',
  novelty_published: 'secondary',
  stopped: 'destructive',
  opted_out: 'destructive',
  blocked_invalid_email: 'destructive',
};

export const TERMINAL_CAMPAIGN_STATUSES = new Set([
  'completed',
  'converted',
  'novelty_published',
  'stopped',
  'opted_out',
  'blocked_invalid_email',
]);

export function campaignStatusLabel(s?: string | null): string {
  if (!s) return '—';
  return CAMPAIGN_STATUS_LABELS[s] ?? s;
}

export function stopReasonLabel(r?: string | null): string {
  if (!r) return '';
  return STOP_REASON_LABELS[r as StopReason] ?? r;
}