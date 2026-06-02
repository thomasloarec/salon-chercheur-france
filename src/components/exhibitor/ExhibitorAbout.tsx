import type { PublicExhibitorProfile } from '@/hooks/useExhibitorProfile';

/* ------------------------------- About block ----------------------------- */

export default function ExhibitorAbout({ profile }: { profile: PublicExhibitorProfile }) {
  const text = profile.description || profile.ai_summary;
  return (
    <section>
      <h2 className="text-xl font-bold mb-4">À propos</h2>
      {text ? (
        <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
          {text}
        </p>
      ) : (
        <p className="text-muted-foreground">
          Aucune description publique disponible pour le moment.
        </p>
      )}
    </section>
  );
}