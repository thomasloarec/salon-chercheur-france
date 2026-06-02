import { Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Card, CardContent } from '@/components/ui/card';
import type { PublicExhibitorProfile } from '@/hooks/useExhibitorProfile';

/* ------------------------------- Stats block ----------------------------- */

export default function ExhibitorStats({ profile }: { profile: PublicExhibitorProfile }) {
  const future = profile.future_participations_count ?? 0;
  const past = profile.past_participations_count ?? 0;
  const novelties = profile.published_novelties_count ?? 0;
  const total = profile.total_participations ?? 0;

  const stats = [
    { label: 'Salons à venir / en cours', value: future },
    { label: 'Participations passées', value: past },
    { label: 'Nouveautés publiées', value: novelties },
    { label: 'Participations connues', value: total },
  ];

  return (
    <section>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-xl">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {profile.next_event_at && (
        <p className="text-sm text-muted-foreground mt-3 flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          Prochain salon / salon en cours :{' '}
          <span className="font-medium text-foreground">
            {format(new Date(profile.next_event_at), 'dd MMMM yyyy', { locale: fr })}
          </span>
        </p>
      )}
    </section>
  );
}