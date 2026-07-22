import type { PublicExhibitorProfile } from '@/hooks/useExhibitorProfile';

/* ------------------------------- Stats block ----------------------------- */

export default function ExhibitorStats({ profile }: { profile: PublicExhibitorProfile }) {
  const future = profile.future_participations_count ?? 0;
  const past = profile.past_participations_count ?? 0;
  const novelties = profile.published_novelties_count ?? 0;

  const stats = [
    { label: 'Salons à venir', value: future },
    { label: 'Participations passées', value: past },
    { label: 'Nouveautés publiées', value: novelties },
  ];

  return (
    <section>
      <div className="grid grid-cols-3 divide-x divide-border border-y border-border">
        {stats.map((s) => (
          <div key={s.label} className="px-3 py-5 text-center">
            <p className="heading-display text-3xl leading-none text-foreground tabular-nums">
              {s.value}
            </p>
            <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground leading-snug">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}