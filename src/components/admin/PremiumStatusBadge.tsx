import React from 'react';
import { Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePremiumEntitlement } from '@/hooks/usePremiumEntitlement';

interface PremiumStatusBadgeProps {
  exhibitorId: string;
  eventId: string;
}

export function PremiumStatusBadge({ exhibitorId, eventId }: PremiumStatusBadgeProps) {
  const { data: entitlement } = usePremiumEntitlement(exhibitorId, eventId);

  if (!entitlement?.isPremium) {
    return null;
  }

  return (
    <Badge variant="default" className="gap-1">
      <Crown className="h-3 w-3" />
      Premium
    </Badge>
  );
}
