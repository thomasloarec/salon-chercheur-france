import React from 'react';
import { Crown, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePremiumEntitlement } from '@/hooks/usePremiumEntitlement';

interface PremiumActionButtonsProps {
  exhibitorId: string;
  eventId: string;
  onGrant: () => void;
  onRevoke: () => void;
  isGranting: boolean;
  isRevoking: boolean;
}

export function PremiumActionButtons({
  exhibitorId,
  eventId,
  onGrant,
  onRevoke,
  isGranting,
  isRevoking,
}: PremiumActionButtonsProps) {
  const { data: entitlement, isLoading } = usePremiumEntitlement(exhibitorId, eventId);

  if (isLoading) {
    return (
      <Button size="sm" variant="outline" disabled>
        <Crown className="h-4 w-4 mr-1" />
        ...
      </Button>
    );
  }

  if (entitlement?.isPremium) {
    return (
      <Button
        size="sm"
        variant="destructive"
        onClick={onRevoke}
        disabled={isRevoking}
      >
        <ShieldOff className="h-4 w-4 mr-1" />
        Révoquer Premium
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onGrant}
      disabled={isGranting}
    >
      <Crown className="h-4 w-4 mr-1" />
      Activer Premium
    </Button>
  );
}
