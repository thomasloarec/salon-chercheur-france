import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useAuth } from '@/contexts/AuthContext';
import { useExhibitorGovernance } from '@/hooks/useExhibitorGovernance';
import type { PublicExhibitorProfile } from '@/hooks/useExhibitorProfile';
import ExhibitorClaimModal from '@/components/exhibitor/ExhibitorClaimModal';
import ExhibitorOwnerEditDrawer from '@/components/exhibitor/ExhibitorOwnerEditDrawer';
import AuthRequiredModal from '@/components/AuthRequiredModal';
import { canEditExhibitorProfile } from '@/lib/exhibitorOwnerEdit';
import { trackExhibitorEvent } from '@/lib/exhibitorTracking';
import { readCampFromParams, persistClaimCampaign } from '@/lib/claimCampaign';

/* ------------------------------- Claim CTA ------------------------------- */

export default function ExhibitorClaimCta({
  profile,
  websiteAvailable = false,
}: {
  profile: PublicExhibitorProfile;
  /** When no official website CTA is shown, the claim/edit action becomes the
   *  primary (default) button so the hierarchy keeps one clear main action. */
  websiteAvailable?: boolean;
}) {
  const { user } = useAuth();
  const [claimOpen, setClaimOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const slug = profile.public_slug || '';
  const [searchParams] = useSearchParams();

  // Claim-first attribution: capture a valid ?camp= deep-link on arrival and
  // persist it so it survives the mandatory authentication step.
  const camp = readCampFromParams(searchParams);
  useEffect(() => {
    if (camp && slug) persistClaimCampaign(camp, slug);
  }, [camp, slug]);

  // Origin-relative return URL forwarded to the auth flow (keeps ?camp=).
  const authRedirectTo = slug
    ? `/exposants/${slug}${camp ? `?camp=${camp}` : ''}`
    : undefined;

  const governance = useExhibitorGovernance(
    profile.exhibitor_id || profile.legacy_exposant_id || undefined,
    profile.display_name || profile.canonical_name || undefined
  );

  const isClaimed = profile.is_claimed === true || governance.hasActiveOwner;

  // Bouton "Modifier cette fiche" : visible uniquement si l'utilisateur est
  // connecté, la fiche est moderne (exhibitor_id présent), non-test, et
  // l'utilisateur est gestionnaire validé (owner direct ou team member
  // owner/admin actif). Les profils legacy purs / test n'affichent rien.
  const canEdit = canEditExhibitorProfile({
    isAuthenticated: !!user,
    exhibitorId: profile.exhibitor_id,
    isTest: profile.is_test,
    isManager: governance.isManager,
  });

  const handleClaimClick = () => {
    trackExhibitorEvent('claim_click', slug, {
      authenticated: !!user,
    });
    if (!user) {
      setAuthOpen(true);
    } else {
      setClaimOpen(true);
    }
  };

  if (governance.isLoading) {
    return <Skeleton className="h-9 w-44" />;
  }

  // State 5: validated manager → "Modifier cette fiche" (active, Phase 4A-C).
  if (canEdit) {
    return (
      <>
        <Button
          variant={websiteAvailable ? 'secondary' : 'default'}
          className="gap-2"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-4 w-4" />
          Modifier cette fiche
        </Button>
        <ExhibitorOwnerEditDrawer
          open={editOpen}
          onOpenChange={setEditOpen}
          exhibitorId={profile.exhibitor_id as string}
          publicSlug={profile.public_slug}
          exhibitorName={profile.display_name || profile.canonical_name || 'Exposant'}
        />
      </>
    );
  }

  // State 4: claimed by a third party → no claim button (badge shown in hero).
  if (isClaimed) {
    return null;
  }

  // State 3: user has a pending claim → static message, no second button.
  if (governance.hasPendingClaim) {
    return (
      <p className="text-sm text-muted-foreground bg-muted/50 border rounded-md px-3 py-2">
        Votre demande de gestion est en cours de traitement.
      </p>
    );
  }

  // States 1 & 2: not claimed → "Revendiquer cette fiche".
  return (
    <>
      <Button
        variant={websiteAvailable ? 'outline' : 'default'}
        onClick={handleClaimClick}
        className="gap-2"
      >
        <ShieldCheck className="h-4 w-4" />
        Revendiquer cette fiche
      </Button>

      <ExhibitorClaimModal
        open={claimOpen}
        onOpenChange={setClaimOpen}
        exhibitorId={profile.exhibitor_id || ''}
        exhibitorName={profile.display_name || profile.canonical_name || ''}
        exhibitorWebsite={profile.website || undefined}
        idExposant={profile.legacy_exposant_id || undefined}
        publicSlug={slug || undefined}
      />
      <AuthRequiredModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        actionType="add-novelty"
        redirectTo={authRedirectTo}
      />
    </>
  );
}