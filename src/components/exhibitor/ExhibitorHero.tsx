import {
  Building2,
  Globe,
  Linkedin,
  BadgeCheck,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

import type { PublicExhibitorProfile } from '@/hooks/useExhibitorProfile';
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

  return (
    <Card className="rounded-2xl overflow-hidden border shadow-sm">
      {/* Bande d'accent premium — purement décorative */}
      <div
        className="h-20 bg-gradient-to-r from-primary/10 via-bubble to-primary/5"
        aria-hidden="true"
      />
      <CardContent className="p-6 pt-0">
        <div className="flex flex-col sm:flex-row sm:items-end gap-5 -mt-12">
          {/* Logo / avatar fallback */}
          <div className="w-24 h-24 rounded-2xl bg-white border shadow-sm flex items-center justify-center flex-shrink-0 overflow-hidden">
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
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className="gap-1">
                <Building2 className="h-3 w-3" />
                Entreprise exposante
              </Badge>
              {profile.is_claimed && (
                <Badge variant="secondary" className="gap-1">
                  <BadgeCheck className="h-3 w-3" />
                  Fiche revendiquée
                </Badge>
              )}
              {profile.is_verified && (
                <Badge className="gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Vérifiée
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
              {name}
            </h1>
          </div>
        </div>

        {/* Description — reste dans le DOM pour le SEO. Les résumés IA "refus"
            (ex. « Données insuffisantes… ») sont filtrés et remplacés par un
            libellé lisible. Tronquée à 3 lignes avec bascule « Voir plus ». */}
        {cleanAiDescription(profile.description) ? (
          <ExpandableText
            text={cleanAiDescription(profile.description) as string}
            className="mt-4"
          />
        ) : (
          <p className="text-sm text-muted-foreground italic mt-4">
            {NO_DESCRIPTION_LABEL}
          </p>
        )}

        {!hasAnyActivity && (
          <p className="text-sm text-muted-foreground mt-2">
            Aucune participation aux salons identifiée pour le moment.
          </p>
        )}

        {/* CTAs — hiérarchie : 1 action principale, le reste en secondaire.
            Site officiel reste l'action principale quand il existe ; sinon
            la revendication / modification devient l'action principale. */}
        <div className="flex flex-wrap items-center gap-2 mt-5">
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
      </CardContent>
    </Card>
  );
}