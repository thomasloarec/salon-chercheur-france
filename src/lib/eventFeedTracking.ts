import { supabase } from '@/integrations/supabase/client';

/**
 * Le Fil du Salon — mesure d'audience.
 *
 * Calqué sur src/lib/exhibitorTracking.ts : appel direct à une RPC
 * SECURITY DEFINER, erreurs systématiquement avalées. Une panne d'analytics ne
 * doit jamais casser l'affichage d'une page publique.
 *
 * La RPC track_event_update refuse d'elle-même les annonces non actives, les
 * salons masqués ou terminés, et ne compte ni l'organisateur ni les admins.
 * Aucune donnée personnelle n'est transmise : seulement l'identifiant de
 * l'annonce et le type d'événement.
 */

export type FeedEventType = 'impression' | 'feed_open' | 'cta_click';

/**
 * Déduplication par session.
 *
 * Une impression est comptée une fois par annonce et par session de
 * navigation. Sans cela, un aller-retour entre la page salon et la page
 * exposant gonflerait le compteur à chaque retour. Les clics et les ouvertures
 * de panneau ne sont pas dédupliqués : ce sont des actes volontaires, les
 * répéter a du sens.
 */
function alreadyCounted(updateId: string): boolean {
  try {
    const key = `lotexpo_feed_imp_${updateId}`;
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, '1');
    return false;
  } catch {
    // Navigation privée ou stockage bloqué : on compte, sans dédupliquer.
    return false;
  }
}

export function trackFeedEvent(updateId: string, eventType: FeedEventType): void {
  if (!updateId) return;
  if (eventType === 'impression' && alreadyCounted(updateId)) return;

  try {
    void supabase
      .rpc('track_event_update' as any, {
        p_event_update_id: updateId,
        p_event_type: eventType,
      } as any)
      .then(
        () => {},
        () => {}
      );
  } catch {
    /* ne bloque jamais l'interface */
  }
}

/* -------------------------------------------------------------------------
 * Pastille « Nouveau »
 * ---------------------------------------------------------------------- */

const SEEN_KEY = 'lotexpo_event_feed_seen';
const SEEN_MAX = 50;

type SeenMap = Record<string, string>;

function readSeen(): SeenMap {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as SeenMap) : {};
  } catch {
    return {};
  }
}

/** Date de la dernière annonce vue par ce visiteur sur ce salon. */
export function getLastSeen(eventId: string): string | null {
  return readSeen()[eventId] ?? null;
}

/**
 * Mémorise la dernière annonce vue.
 * Une seule clé pour tous les salons, plafonnée à 50 entrées : sur 500 pages
 * salon, une clé par événement finirait par encombrer le stockage local.
 */
export function markSeen(eventId: string, publishedAt: string): void {
  try {
    const map = readSeen();
    map[eventId] = publishedAt;
    const keys = Object.keys(map);
    if (keys.length > SEEN_MAX) {
      const trimmed: SeenMap = {};
      for (const k of keys.slice(-SEEN_MAX)) trimmed[k] = map[k];
      localStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
      return;
    }
    localStorage.setItem(SEEN_KEY, JSON.stringify(map));
  } catch {
    /* stockage indisponible : la pastille réapparaîtra, sans dommage */
  }
}
