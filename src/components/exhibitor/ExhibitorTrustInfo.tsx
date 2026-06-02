import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import type { PublicExhibitorProfile } from '@/hooks/useExhibitorProfile';

/* --------------------------- Trust / info block -------------------------- */

const SOURCE_TYPE_LABELS: Record<string, string> = {
  modern: 'Fiche entreprise enrichie',
  linked: 'Fiche reliée à un exposant identifié',
  legacy: 'Fiche issue de notre base historique',
};

export default function ExhibitorTrustInfo({ profile }: { profile: PublicExhibitorProfile }) {
  return (
    <section>
      <h2 className="text-xl font-bold mb-4">Informations</h2>
      <div className="text-sm text-muted-foreground space-y-1">
        <p>
          Statut :{' '}
          {profile.is_claimed
            ? 'fiche revendiquée par l\u2019entreprise'
            : 'fiche non revendiquée'}
        </p>
        <p>
          Type de fiche :{' '}
          {SOURCE_TYPE_LABELS[profile.source_type || ''] || 'Fiche exposant'}
        </p>
        {profile.last_activity_at && (
          <p>
            Dernière activité :{' '}
            {format(new Date(profile.last_activity_at), 'dd MMMM yyyy', {
              locale: fr,
            })}
          </p>
        )}
      </div>
    </section>
  );
}