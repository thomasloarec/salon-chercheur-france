import { BadgeCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface VerifiedBadgeProps {
  className?: string;
}

const VerifiedBadge = ({ className }: VerifiedBadgeProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`border-info/30 bg-info/10 text-info gap-1 ${className ?? ''}`}
          >
            <BadgeCheck className="h-3.5 w-3.5" />
            Vérifié
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs max-w-48">
            Ce profil entreprise est géré par un représentant officiel vérifié par Lotexpo
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default VerifiedBadge;
