import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import StatsStrip from '@/components/common/StatsStrip';
import {
  getEventTemporalState,
  getEventDurationDays,
  getEventDayIndex,
  getDaysUntilStart,
  parseAffluence,
} from '@/lib/eventCapabilities';
import { formatAffluence } from '@/utils/affluenceUtils';
import type { Event } from '@/types/event';

interface EventStatsStripProps {
  event: Event;
  exhibitorCount: number;
  noveltyCount: number;
}

interface Stat {
  key: string;
  value: string;
  label: string;
}

const MAX_TILES = 4;
const MIN_TILES = 2;

/**
 * Frise statistiques : pool de candidates priorisées, on affiche les
 * premières disponibles (2 à 4). Aucune requête réseau propre : les
 * compteurs proviennent de useEventCardStats côté page.
 */
export const EventStatsStrip = ({ event, exhibitorCount, noveltyCount }: EventStatsStripProps) => {
  const stats = useMemo<Stat[]>(() => {
    const pool: Stat[] = [];

    // 1. Exposants
    if (exhibitorCount > 0) {
      pool.push({
        key: 'exposants',
        value: exhibitorCount.toLocaleString('fr-FR'),
        label: 'Exposants',
      });
    }

    // 2. Affluence
    const affluenceValue = parseAffluence(event.affluence ?? null);
    if (affluenceValue) {
      pool.push({
        key: 'affluence',
        value: formatAffluence(event.affluence ?? undefined),
        label: 'Visiteurs attendus',
      });
    }

    // 3. Durée (inclusive)
    const duration = getEventDurationDays(event.date_debut, event.date_fin);
    if (duration) {
      pool.push({
        key: 'duree',
        value: String(duration),
        label: duration > 1 ? "Jours d'événement" : "Jour d'événement",
      });
    }

    // 4. Repère temporel — toujours disponible
    const state = getEventTemporalState(event.date_debut, event.date_fin);
    let temporal: Stat;
    if (state === 'termine') {
      const year = event.date_fin || event.date_debut;
      temporal = {
        key: 'temporel',
        value: year ? String(year).slice(0, 4) : '—',
        label: 'Dernière édition',
      };
    } else if (state === 'en_cours' || state === 'imminent') {
      const dayIndex = getEventDayIndex(event.date_debut, event.date_fin);
      const total = duration;
      if (dayIndex && total && total > 1) {
        temporal = { key: 'temporel', value: `Jour ${dayIndex} / ${total}`, label: 'En cours' };
      } else if (dayIndex) {
        temporal = { key: 'temporel', value: "Aujourd'hui", label: 'Ouverture' };
      } else {
        temporal = { key: 'temporel', value: 'Demain', label: 'Ouverture' };
      }
    } else {
      const days = getDaysUntilStart(event.date_debut);
      if (state === 'proche' && days !== null && days > 0) {
        temporal =
          days === 1
            ? { key: 'temporel', value: 'Demain', label: 'Ouverture' }
            : { key: 'temporel', value: `J-${days}`, label: "Avant l'ouverture" };
      } else if (event.date_debut) {
        temporal = {
          key: 'temporel',
          value: format(new Date(event.date_debut), 'MMM yyyy', { locale: fr }),
          label: 'Ouverture',
        };
      } else {
        temporal = { key: 'temporel', value: 'À venir', label: 'Ouverture' };
      }
    }
    pool.push(temporal);

    // 5. Nouveautés
    if (noveltyCount > 0) {
      pool.push({
        key: 'nouveautes',
        value: noveltyCount.toLocaleString('fr-FR'),
        label: 'Nouveautés publiées',
      });
    }

    return pool.slice(0, MAX_TILES);
  }, [event, exhibitorCount, noveltyCount]);

  return (
    <StatsStrip
      tiles={stats}
      minTiles={MIN_TILES}
      ariaLabel="Chiffres clés de l'événement"
    />
  );
};

export default EventStatsStrip;
