import { Link } from 'react-router-dom';
import { Building2, Clock, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyPendingClaims } from '@/hooks/useMyPendingClaims';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';

/**
 * Displays the current user's pending claim requests so they don't feel
 * lost in a "black hole" between submission and admin validation.
 *
 * IMPORTANT — doctrine "open funnel + manual moderation":
 *   - No "Modifier" button
 *   - No "Gérer l'équipe" button
 *   - No suggestion that the user can already administer the page
 */
const MyPendingClaimsSection = () => {
  const { data: claims, isLoading } = useMyPendingClaims();

  if (isLoading) {
    return (
      <Card className="p-6 rounded-2xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Mes demandes en cours
        </h2>
        <div className="space-y-3">
          {Array.from({ length: 1 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
              <Skeleton className="h-10 w-10 rounded" />
              <div className="flex-1">
                <Skeleton className="h-4 w-40 mb-1" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!claims || claims.length === 0) {
    return null;
  }

  return (
    <Card className="p-6 rounded-2xl shadow-sm">
      <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
        <Clock className="h-5 w-5 text-amber-600" />
        Mes demandes en cours
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Ces entreprises sont en attente de validation par l'équipe Lotexpo.
        Vous pouvez déjà soumettre une nouveauté pendant l'attente.
      </p>

      <div className="space-y-3">
        {claims.map((claim) => {
          const ex = claim.exhibitor;
          const logoUrl = getExhibitorLogoUrl(ex.logo_url, undefined);
          const exhibitorHref = ex.slug ? `/exposants/${ex.slug}` : undefined;

          return (
            <div
              key={claim.id}
              className="border border-amber-200 bg-amber-50/50 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              {logoUrl ? (
                <div className="h-10 w-10 rounded bg-background border flex items-center justify-center flex-shrink-0 p-1">
                  <img
                    src={logoUrl}
                    alt={ex.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {exhibitorHref ? (
                    <Link
                      to={exhibitorHref}
                      className="font-medium truncate hover:underline"
                    >
                      {ex.name}
                    </Link>
                  ) : (
                    <span className="font-medium truncate">{ex.name}</span>
                  )}
                  <Badge variant="outline" className="text-xs border-amber-300 text-amber-800 bg-amber-100/60">
                    <Clock className="h-3 w-3 mr-1" />
                    En attente de validation
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Votre demande sera vérifiée par l'équipe Lotexpo.
                </p>
              </div>

              <div className="flex-shrink-0">
                <Button size="sm" variant="outline" asChild>
                  <Link to="/publier-nouveaute">
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Soumettre une nouveauté
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default MyPendingClaimsSection;
