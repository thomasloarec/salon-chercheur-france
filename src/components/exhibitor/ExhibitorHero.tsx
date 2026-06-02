import {
  Building2,
  Globe,
  Linkedin,
  BadgeCheck,
  ShieldCheck,
  Sparkles,
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

/* --------------------------------- Hero --------------------------------- */

function SourceBadge({ sourceType }: { sourceType: string | null }) {
  if (sourceType === 'modern' || sourceType === 'linked') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Sparkles className="h-3 w-3" />
        Profil enrichi
      </Badge>
    );
  }
  return null;
}

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
    <Card className="rounded-2xl overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          {/* Logo / avatar fallback */}
          <div className="w-20 h-20 rounded-xl bg-white border flex items-center justify-center flex-shrink-0 overflow-hidden">
            {logo ? (
              <img
                src={logo}
                alt={`Logo ${name}`}
                className="max-w-full max-h-full object-contain p-1"
              />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
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
              <SourceBadge sourceType={profile.source_type} />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-2">
              {name}
            </h1>

            {profile.description ? (
              <p className="text-sm text-muted-foreground line-clamp-3">
                {profile.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Cette fiche n'a pas encore été complétée par l'entreprise.
              </p>
            )}

            {!hasAnyActivity && (
              <p className="text-sm text-muted-foreground mt-2">
                Aucune participation aux salons identifiée pour le moment.
              </p>
            )}

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
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
              <ExhibitorClaimCta profile={profile} />
              {profile.public_slug && profile.is_test !== true && (
                <ExhibitorAlertButton publicSlug={profile.public_slug} />
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}