import {
  BadgeCheck,
  CalendarClock,
  Globe,
  Linkedin,
  ShieldCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PublicExhibitorProfile } from '@/hooks/useExhibitorProfile';
import { normalizeExternalUrl, normalizeLinkedInUrl } from '@/lib/urlUtils';

/* --------------------------- Trust / info block -------------------------- */

function InfoRow({
  icon: Icon,
  label,
  value,
  muted = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className={`flex items-start gap-2.5${muted ? ' opacity-60' : ''}`}>
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium text-foreground break-words">
          {value}
        </div>
      </div>
    </div>
  );
}

/**
 * Sidebar "Informations" — trust / status block. Surfaces only data that is
 * reliably available on the profile. No fabricated location/country data.
 * Internal-only / technical fields ("type de fiche", "enrichissement IA") are
 * intentionally not exposed publicly.
 */
export default function ExhibitorTrustInfo({ profile }: { profile: PublicExhibitorProfile }) {
  const websiteUrl = normalizeExternalUrl(profile.website);
  const linkedinUrl = normalizeLinkedInUrl(profile.linkedin_url);

  return (
    <Card className="rounded-2xl lg:sticky lg:top-24">
      <CardHeader className="pb-3">
        <CardTitle className="heading-display text-base">Informations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {websiteUrl && (
          <InfoRow
            icon={Globe}
            label="Site web"
            value={
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline break-all"
              >
                {websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            }
          />
        )}

        {linkedinUrl ? (
          <InfoRow
            icon={Linkedin}
            label="LinkedIn"
            value={
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline break-all"
              >
                Voir le profil LinkedIn
              </a>
            }
          />
        ) : (
          <InfoRow
            icon={Linkedin}
            label="LinkedIn"
            value="Non renseigné"
            muted
          />
        )}

        <InfoRow
          icon={BadgeCheck}
          label="Statut de la fiche"
          value={
            profile.is_claimed
              ? 'Revendiquée par l\u2019entreprise'
              : 'Non revendiquée'
          }
        />

        {profile.is_verified && (
          <InfoRow
            icon={ShieldCheck}
            label="Vérification"
            value="Fiche vérifiée"
          />
        )}

        {profile.last_activity_at && (
          <InfoRow
            icon={CalendarClock}
            label="Dernière activité"
            value={format(new Date(profile.last_activity_at), 'dd MMMM yyyy', {
              locale: fr,
            })}
          />
        )}
      </CardContent>
    </Card>
  );
}