import type { PublicExhibitorProfile } from '@/hooks/useExhibitorProfile';
import { useExhibitorProducts } from '@/hooks/useExhibitorProfile';

/* --------------------------- Produits et services ------------------------- */

export default function ExhibitorAbout({ profile }: { profile: PublicExhibitorProfile }) {
  const { data } = useExhibitorProducts(profile.public_slug || undefined);
  const products = data?.produits_services ?? [];

  if (products.length === 0) return null;

  const shown = products.slice(0, 8);
  const remaining = products.length - shown.length;

  return (
    <section aria-labelledby="exhibitor-products-heading" className="space-y-4">
      <h2
        id="exhibitor-products-heading"
        className="heading-display text-xl text-foreground"
      >
        Produits et services
      </h2>
      <ul className="flex flex-wrap gap-2">
        {shown.map((p) => (
          <li
            key={p}
            title={p}
            className="max-w-full truncate rounded-full bg-bubble px-3 py-1 text-sm text-foreground"
          >
            {p}
          </li>
        ))}
        {remaining > 0 && (
          <li className="rounded-full px-3 py-1 text-sm text-muted-foreground">
            et {remaining} autre{remaining > 1 ? 's' : ''}
          </li>
        )}
      </ul>
    </section>
  );
}