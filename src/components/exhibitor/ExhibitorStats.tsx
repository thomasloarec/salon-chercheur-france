import StatsStrip, { type StatTile } from '@/components/common/StatsStrip';
import type { PublicExhibitorProfile } from '@/hooks/useExhibitorProfile';

/* ------------------------------- Stats block ----------------------------- */

/**
 * Lot 15 — la frise exposant reprend le style de la page salon via le
 * composant partagé StatsStrip. Les statistiques affichées sont inchangées :
 * salons à venir, participations passées, nouveautés publiées. Seule
 * différence : une valeur à zéro n'est plus rendue (aucune tuile dégradée).
 */
export default function ExhibitorStats({ profile }: { profile: PublicExhibitorProfile }) {
  const future = profile.future_participations_count ?? 0;
  const past = profile.past_participations_count ?? 0;
  const novelties = profile.published_novelties_count ?? 0;

  const tiles: StatTile[] = [];
  if (future > 0) {
    tiles.push({
      key: 'future',
      value: future.toLocaleString('fr-FR'),
      label: future > 1 ? 'Salons à venir' : 'Salon à venir',
    });
  }
  if (past > 0) {
    tiles.push({
      key: 'past',
      value: past.toLocaleString('fr-FR'),
      label: past > 1 ? 'Participations passées' : 'Participation passée',
    });
  }
  if (novelties > 0) {
    tiles.push({
      key: 'novelties',
      value: novelties.toLocaleString('fr-FR'),
      label: novelties > 1 ? 'Nouveautés publiées' : 'Nouveauté publiée',
    });
  }

  // Une seule statistique disponible reste utile sur une fiche exposant :
  // on abaisse le seuil à 1, la frise disparaît entièrement si rien n'existe.
  return <StatsStrip tiles={tiles} minTiles={1} ariaLabel="Chiffres clés de l'exposant" />;
}
