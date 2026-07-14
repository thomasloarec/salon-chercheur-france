import { CalendarDays, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import VerifiedBadge from '@/components/exhibitor/VerifiedBadge';
import { useUserSalons } from '@/hooks/useExhibitorAdmin';
import { useEventScorecard } from '@/hooks/useEventScorecard';
import { Sparkles } from 'lucide-react';

const SalonCompletenessBadge = ({ eventId }: { eventId: string }) => {
  const { data, isLoading } = useEventScorecard(eventId);
  if (isLoading) {
    return <Skeleton className="h-3 w-24 mt-1" />;
  }
  const anyData = data as any;
  const pct = anyData?.completude?.pct_enrichies;
  if (typeof pct !== 'number') return null;
  return (
    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
      <Sparkles className="h-3 w-3" />
      <span>{pct}% de fiches enrichies</span>
    </div>
  );
};

const MySalonsSection = () => {
  const { data: salons, isLoading } = useUserSalons();

  if (isLoading) {
    return (
      <Card className="p-6 rounded-2xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Salons que je gère</h2>
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
              <Skeleton className="h-10 w-10 rounded" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!salons || salons.length === 0) {
    return null;
  }

  return (
    <Card className="p-6 rounded-2xl shadow-sm">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <CalendarDays className="h-5 w-5" />
        Salons que je gère
      </h2>
      <div className="space-y-3">
        {salons.map((salon) => (
          <div key={salon.id} className="border rounded-lg overflow-hidden">
            {/* Header row */}
            <div className="flex items-center gap-3 p-3 w-full text-left">
              {salon.url_image ? (
                <div className="h-10 w-10 rounded bg-background border flex items-center justify-center flex-shrink-0 p-1">
                  <img
                    src={salon.url_image}
                    alt={salon.nom_event}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  <CalendarDays className="h-5 w-5 text-muted-foreground" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{salon.nom_event}</span>
                  {salon.verified_at && <VerifiedBadge />}
                </div>
                <SalonCompletenessBadge eventId={salon.id} />
              </div>
            </div>

            {/* Action row */}
            <div className="px-3 pb-3 pt-0">
              {salon.slug ? (
                <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                  <Link to={`/events/${salon.slug}`}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Voir la page du salon
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="w-full sm:w-auto" disabled>
                  Page en préparation
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default MySalonsSection;
