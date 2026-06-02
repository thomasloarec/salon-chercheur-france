import {
  BadgeCheck,
  CalendarClock,
  Globe,
  ShieldCheck,
  Sparkles,
  Tag,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PublicExhibitorProfile } from '@/hooks/useExhibitorProfile';
import { normalizeExternalUrl } from '@/lib/urlUtils';

/* --------------------------- Trust / info block -------------------------- */

const SOURCE_TYPE_LABELS: Record<string, string> = {
  modern: 'Fiche entreprise enrichie',
  linked: 'Fiche reliée à un exposant identifié',
  legacy: 'Fiche issue de notre base historique',
};

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
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
 */
export default function ExhibitorTrustInfo({ profile }: { profile: PublicExhibitorProfile }) {
  const websiteUrl = normalizeExternalUrl(profile.website);
  const isAiEnriched =
    profile.source_type === 'modern' || profile.source_type === 'linked';

  return (
    <Card className="rounded-2xl lg:sticky lg:top-24">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Informations</CardTitle>
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

        <InfoRow
          icon={BadgeCheck}
          label="Statut de la fiche"
          value={
            profile.is_claimed
              ? 'Revendiquée par l\u2019entreprise'
              : 'Non revendiquée'
          }
        />

        <InfoRow
          icon={Tag}
          label="Type de fiche"
          value={SOURCE_TYPE_LABELS[profile.source_type || ''] || 'Fiche exposant'}
        />

        {profile.is_verified && (
          <InfoRow
            icon={ShieldCheck}
            label="Vérification"
            value="Fiche vérifiée"
          />
        )}

        {isAiEnriched && (
          <InfoRow
            icon={Sparkles}
            label="Enrichissement"
            value="Profil enrichi par IA"
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