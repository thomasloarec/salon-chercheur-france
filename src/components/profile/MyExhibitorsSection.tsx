import { Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import VerifiedBadge from '@/components/exhibitor/VerifiedBadge';
import { useMyExhibitors } from '@/hooks/useMyExhibitors';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';

const MyExhibitorsSection = () => {
  const { data: memberships, isLoading } = useMyExhibitors();

  if (isLoading) {
    return (
      <Card className="p-6 rounded-2xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Entreprises que je gère</h2>
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

  if (!memberships || memberships.length === 0) {
    return null; // Don't show section if no memberships
  }

  const roleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'Propriétaire';
      case 'admin': return 'Administrateur';
      default: return role;
    }
  };

  return (
    <Card className="p-6 rounded-2xl shadow-sm">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Building2 className="h-5 w-5" />
        Entreprises que je gère
      </h2>

      <div className="space-y-3">
        {memberships.map((m) => {
          const logoUrl = getExhibitorLogoUrl(m.exhibitor.logo_url, undefined);
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              {logoUrl ? (
                <div className="h-10 w-10 rounded bg-background border flex items-center justify-center flex-shrink-0 p-1">
                  <img
                    src={logoUrl}
                    alt={m.exhibitor.name}
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
                  <span className="font-medium truncate">{m.exhibitor.name}</span>
                  {m.exhibitor.verified_at && <VerifiedBadge />}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-xs">
                    {roleLabel(m.role)}
                  </Badge>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default MyExhibitorsSection;
