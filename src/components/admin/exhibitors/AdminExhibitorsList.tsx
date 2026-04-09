import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Building2, Shield, Clock, AlertCircle, ExternalLink, RefreshCw, FlaskConical } from 'lucide-react';
import { useAdminExhibitors, type AdminExhibitorsFilters, type GovernanceStatus } from '@/hooks/useAdminExhibitors';
import { useDebounce } from '@/hooks/useDebounce';

const statusLabels: Record<GovernanceStatus, string> = {
  unmanaged: 'Non gérée',
  pending: 'Demande en cours',
  managed: 'Gérée',
  test: 'Test',
};

const statusColors: Record<GovernanceStatus, string> = {
  unmanaged: 'bg-muted text-muted-foreground',
  pending: 'bg-amber-100 text-amber-800 border-amber-300',
  managed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  test: 'bg-purple-100 text-purple-800 border-purple-300',
};

const statusIcons: Record<GovernanceStatus, React.ReactNode> = {
  unmanaged: <AlertCircle className="h-3.5 w-3.5" />,
  pending: <Clock className="h-3.5 w-3.5" />,
  managed: <Shield className="h-3.5 w-3.5" />,
  test: <FlaskConical className="h-3.5 w-3.5" />,
};

interface Props {
  onSelectExhibitor?: (id: string) => void;
}

const AdminExhibitorsList = ({ onSelectExhibitor }: Props) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<GovernanceStatus | 'all'>('all');
  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [testFilter, setTestFilter] = useState<'all' | 'test' | 'production'>('production');

  const filters: AdminExhibitorsFilters = {
    search: debouncedSearch,
    status: statusFilter,
    verified: verifiedFilter,
    isTest: testFilter,
  };

  const { data: exhibitors, isLoading, refetch } = useAdminExhibitors(filters);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Entreprises exposantes
            {exhibitors && (
              <Badge variant="secondary" className="ml-2">{exhibitors.length}</Badge>
            )}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Statut gouvernance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="unmanaged">Non gérée</SelectItem>
              <SelectItem value="pending">Demande en cours</SelectItem>
              <SelectItem value="managed">Gérée</SelectItem>
              <SelectItem value="test">Test</SelectItem>
            </SelectContent>
          </Select>
          <Select value={verifiedFilter} onValueChange={v => setVerifiedFilter(v as any)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Vérification" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="verified">Vérifiées</SelectItem>
              <SelectItem value="unverified">Non vérifiées</SelectItem>
            </SelectContent>
          </Select>
          <Select value={testFilter} onValueChange={v => setTestFilter(v as any)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Données" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="test">Test</SelectItem>
              <SelectItem value="all">Toutes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !exhibitors?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            Aucune entreprise trouvée
          </div>
        ) : (
          <div className="rounded-md border divide-y">
            {exhibitors.map(ex => (
              <button
                key={ex.id}
                onClick={() => onSelectExhibitor?.(ex.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {ex.logo_url ? (
                    <img src={ex.logo_url} alt="" className="w-8 h-8 rounded object-contain bg-white border" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{ex.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {ex.slug || '—'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <Badge variant="outline" className={`text-xs gap-1 ${statusColors[ex.governance_status]}`}>
                    {statusIcons[ex.governance_status]}
                    {statusLabels[ex.governance_status]}
                  </Badge>

                  {ex.verified_at && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      Vérifiée
                    </Badge>
                  )}

                  <span className="text-xs text-muted-foreground w-16 text-right">
                    {ex.team_count} membre{ex.team_count !== 1 ? 's' : ''}
                  </span>

                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminExhibitorsList;
