import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldCheck, Clock, CheckCircle2, LogIn } from 'lucide-react';
import type { ExhibitorGovernanceState } from '@/hooks/useExhibitorGovernance';
import ExhibitorClaimModal from './ExhibitorClaimModal';
import { useNavigate } from 'react-router-dom';

interface ExhibitorGovernanceBannerProps {
  governance: ExhibitorGovernanceState;
  exhibitorId: string;
  exhibitorName: string;
}

const ExhibitorGovernanceBanner: React.FC<ExhibitorGovernanceBannerProps> = ({
  governance,
  exhibitorId,
  exhibitorName,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [claimOpen, setClaimOpen] = useState(false);

  if (governance.isLoading) return null;

  // Case: user is already a team member — don't show anything
  if (governance.isTeamMember) return null;

  // Case 2: enterprise already managed
  if (governance.hasActiveOwner) {
    return (
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-emerald-800">
          Cette entreprise est déjà gérée officiellement sur Lotexpo.
        </p>
      </div>
    );
  }

  // Case 3: user already has a pending claim
  if (governance.hasPendingClaim) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-3">
        <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Demande en cours</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Votre demande a bien été envoyée. Elle sera vérifiée par l'équipe Lotexpo.
          </p>
        </div>
      </div>
    );
  }

  // Case 4: user not logged in
  if (!user) {
    return (
      <div className="rounded-lg bg-muted/50 border p-3 flex items-start gap-3">
        <LogIn className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">
            Connectez-vous pour demander la gestion officielle de cette entreprise.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => navigate('/auth')}
          >
            <LogIn className="h-3.5 w-3.5 mr-1.5" />
            Se connecter
          </Button>
        </div>
      </div>
    );
  }

  // Case 1: enterprise not managed, user logged in → CTA
  return (
    <>
      <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">
            Cette entreprise n'est pas encore gérée officiellement sur Lotexpo.
          </p>
          <Button
            size="sm"
            className="mt-2"
            onClick={() => setClaimOpen(true)}
          >
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
            Devenir gestionnaire officiel
          </Button>
        </div>
      </div>

      <ExhibitorClaimModal
        open={claimOpen}
        onOpenChange={setClaimOpen}
        exhibitorId={exhibitorId}
        exhibitorName={exhibitorName}
      />
    </>
  );
};

export default ExhibitorGovernanceBanner;
