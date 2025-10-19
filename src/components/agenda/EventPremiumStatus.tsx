import React from 'react';
import { Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePremiumEntitlement } from '@/hooks/usePremiumEntitlement';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface EventPremiumStatusProps {
  exhibitorId: string;
  eventId: string;
}

export function EventPremiumStatus({ exhibitorId, eventId }: EventPremiumStatusProps) {
  const { data: entitlement } = usePremiumEntitlement(exhibitorId, eventId);

  // Count published novelties for this exhibitor/event
  const { data: publishedCount = 0 } = useQuery({
    queryKey: ['published-count', exhibitorId, eventId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('novelties')
        .select('id', { count: 'exact', head: true })
        .eq('exhibitor_id', exhibitorId)
        .eq('event_id', eventId)
        .eq('status', 'published');

      if (error) {
        console.error('[EventPremiumStatus] Count error:', error);
        return 0;
      }

      return count || 0;
    },
    staleTime: 10_000,
  });

  const isPremium = entitlement?.isPremium ?? false;
  const limit = entitlement?.maxNovelties ?? 1;

  return (
    <div className="flex items-center gap-2">
      {isPremium && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="default" className="gap-1 bg-yellow-500 hover:bg-yellow-600 text-white">
                <Crown className="h-3 w-3" />
                Premium
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Premium activé : jusqu'à {limit} nouveautés visibles et leads illimités</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      <Badge variant="secondary" className="font-mono">
        {publishedCount}/{limit}
      </Badge>
    </div>
  );
}
