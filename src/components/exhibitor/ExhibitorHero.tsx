import {
  Building2,
  Globe,
  Linkedin,
  BadgeCheck,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import type { PublicExhibitorProfile } from '@/hooks/useExhibitorProfile';
import { useExhibitorProducts } from '@/hooks/useExhibitorProfile';
import ExhibitorAlertButton from '@/components/exhibitor/ExhibitorAlertButton';
import ExhibitorClaimCta from '@/components/exhibitor/ExhibitorClaimCta';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import { trackExhibitorEvent } from '@/lib/exhibitorTracking';
import { normalizeExternalUrl, normalizeLinkedInUrl } from '@/lib/urlUtils';
import { cleanAiDescription, NO_DESCRIPTION_LABEL } from '@/lib/exhibitorDescription';
import ExpandableText from '@/components/exhibitor/ExpandableText';

/* --------------------------------- Hero --------------------------------- */

export default function ExhibitorHero({
  profile,
  hasAnyActivity,
}: {
  profile: PublicExhibitorProfile;
  hasAnyActivity: boolean;
}) {
  const slug = profile.public_slug || '';
  const name = profile.display_name || profile.canonical_name || 'Exposant';
  const logo = getExhibitorLogoUrl(profile.logo_url, profile.website);
  // Normalized external links — CTAs only render for valid, absolute URLs.
  const websiteUrl = normalizeExternalUrl(profile.website);
  const linkedinUrl = normalizeLinkedInUrl(profile.linkedin_url);
  const { data: aiData } = useExhibitorProducts(profile.public_slug || undefined);
  const sector = aiData?.secteur_principal ?? null;
  const products = aiData?.produits_services ?? [];

  return (
    <section
      aria-label="En-tête de la fiche exposant"
      className="relative w-full overflow-hidden border-b bg-gradient-to-b from-bubble/60 via-background to-background"
    >
      {/* Couche décorative 1 : nom en très grand, débordant à gauche */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute -left-8 top-1/2 -translate-y-1/2 heading-display text-foreground/[0.04] whitespace-nowrap text-[12rem] leading-none tracking-tight [mask-image:linear-gradient(to_bottom,black_0%,black_40%,transparent_78%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_40%,transparent_78%)]"
      >
        {name}
      </div>
      {/* Couche décorative 2 : halo derrière la tuile logo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 w-64 h-64 -translate-x-1/4 -translate-y-1/3 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative max-w-6xl mx-auto px-4 py-10 sm:py-14">
        <div className="flex flex-col sm:flex-row sm:items-end gap-5">
          {/* Logo / avatar fallback */}
          <div className="w-24 h-24 rounded-2xl bg-white border shadow-sm flex items-center justify-center flex-shrink-0 overflow-hidden hero-in">
            {logo ? (
              <img
                src={logo}
                alt={`Logo ${name}`}
                className="max-w-full max-h-full object-contain p-2"
              />
            ) : (
              <span className="text-3xl font-bold text-muted-foreground">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0 sm:pb-1">
            <div className="flex flex-wrap items-center gap-2 mb-2 hero-in" style={{ animationDelay: '80ms' }}>
              <Badge variant="outline" className="gap-1">
                <Building2 className="h-3 w-3" />
                Entreprise exposante
              </Badge>
              {profile.is_claimed ? (
                <Badge className="gap-1">
                  <BadgeCheck className="h-3 w-3" />
                  Revendiquée par l’entreprise
                </Badge>
              ) : profile.is_verified ? (
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Vérifiée par Lotexpo
                </Badge>
              ) : null}
            </div>

            <h1 className="heading-display text-2xl sm:text-3xl font-bold leading-tight hero-in" style={{ animationDelay: '140ms' }}>
              {name}
            </h1>
            {sector && (
              <p
                className="text-sm text-muted-foreground mt-1 hero-in"
                style={{ animationDelay: '170ms' }}
              >
                {sector}
              </p>
            )}
          </div>
        </div>

        {/* Description — reste dans le DOM pour le SEO. Les résumés IA "refus"
            (ex. « Données insuffisantes… ») sont filtrés et remplacés par un
            libellé lisible. Tronquée à 3 lignes avec bascule « Voir plus ». */}
        {cleanAiDescription(profile.description) ? (
          <div className="hero-in [&_p]:text-foreground/90" style={{ animationDelay: '200ms' }}>
            <ExpandableText
              text={cleanAiDescription(profile.description) as string}
              className="mt-4"
            />
          </div>
        ) : (
          <p
            className="text-sm text-muted-foreground italic mt-4 hero-in"
            style={{ animationDelay: '200ms' }}
          >
            {NO_DESCRIPTION_LABEL}
          </p>
        )}

        {!hasAnyActivity && (
          <p className="text-sm text-muted-foreground mt-2">
            Aucune participation aux salons identifiée pour le moment.
          </p>
        )}

        {products.length > 0 && (
          <ul
            className="flex flex-wrap gap-2 mt-4 hero-in"
            style={{ animationDelay: '230ms' }}
          >
            {products.slice(0, 4).map((p) => (
              <li
                key={p}
                title={p}
                className="max-w-full truncate rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
              >
                {p}
              </li>
            ))}
          </ul>
        )}

        {/* CTAs — hiérarchie : 1 action principale, le reste en secondaire.
            Site officiel reste l'action principale quand il existe ; sinon
            la revendication / modification devient l'action principale. */}
        <div
          className="flex flex-wrap items-center gap-2 mt-5 hero-in"
          style={{ animationDelay: '260ms' }}
        >
          {websiteUrl && (
            <Button
              asChild
              variant="default"
              className="gap-2"
              onClick={() =>
                trackExhibitorEvent('website_click', slug, {
                  target_url: websiteUrl,
                })
              }
            >
              <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                <Globe className="h-4 w-4" />
                Site officiel
              </a>
            </Button>
          )}
          <ExhibitorClaimCta profile={profile} websiteAvailable={!!websiteUrl} />
          {linkedinUrl && (
            <Button
              asChild
              variant="outline"
              className="gap-2"
              onClick={() =>
                trackExhibitorEvent('linkedin_click', slug, {
                  target_url: linkedinUrl,
                })
              }
            >
              <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </a>
            </Button>
          )}
          {profile.public_slug && profile.is_test !== true && (
            <ExhibitorAlertButton publicSlug={profile.public_slug} />
          )}
        </div>
      </div>
    </section>
  );
}