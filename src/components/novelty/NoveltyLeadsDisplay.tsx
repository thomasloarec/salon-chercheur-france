import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Download, AlertCircle } from 'lucide-react';
import LeadCard from './LeadCard';
import PremiumUpgradeDialog from './PremiumUpgradeDialog';
import { usePremiumEntitlement } from '@/hooks/usePremiumEntitlement';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company?: string;
  role?: string;
  notes?: string;
  lead_type: 'resource_download' | 'meeting_request';
  created_at: string;
  masked?: boolean;
}

interface NoveltyLeadsDisplayProps {
  noveltyId: string;
  exhibitorId: string;
  eventId: string;
}

export default function NoveltyLeadsDisplay({ noveltyId, exhibitorId, eventId }: NoveltyLeadsDisplayProps) {
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);

  // Check Premium status
  const { data: entitlement } = usePremiumEntitlement(exhibitorId, eventId);
  const isPremium = entitlement?.isPremium ?? false;
  const canExportCSV = entitlement?.csvExport ?? false;

  const { data: leadsData, isLoading, isError } = useQuery({
    queryKey: ['novelty-leads', noveltyId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('novelty-leads', {
        body: { novelty_id: noveltyId }
      });

      if (error) throw error;

      console.log('[NoveltyLeadsDisplay] API response:', {
        total: data.total,
        leadsCount: data.leads?.length,
        maskedCount: data.maskedCount,
        isPremium: data.is_premium
      });

      return {
        leads: data.leads as Lead[],
        total: data.total as number,
        maskedCount: (data.maskedCount ?? 0) as number,
        isPremium: (data.is_premium ?? false) as boolean,
      };
    }
  });

  const leads = leadsData?.leads;
  const totalLeads = leadsData?.total ?? 0;
  const maskedCount = leadsData?.maskedCount ?? 0;

  const handleExportCSV = () => {
    if (!leads) return;

    // Convert leads to CSV (sans accents pour éviter les problèmes d'encodage)
    const headers = ['Prenom', 'Nom', 'Email', 'Telephone', 'Entreprise', 'Poste', 'Type', 'Date'];
    const rows = leads.map(lead => [
      lead.first_name,
      lead.last_name,
      lead.email,
      lead.phone || '',
      lead.company || '',
      lead.role || '',
      lead.lead_type === 'resource_download' ? 'Telechargement' : 'Rendez-vous',
      new Date(lead.created_at).toLocaleDateString('fr-FR'),
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `leads_${noveltyId}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  // Distinct error state: a failed request must not look like an empty list
  if (isError) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md py-3 px-4">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Impossible de charger les leads pour le moment, réessayez.</span>
      </div>
    );
  }

  if (!leads || leads.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Aucun lead pour le moment
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Export CSV button for Premium users */}
      {isPremium && canExportCSV && leads.length > 0 && (
        <div className="flex justify-end mb-4">
          <Button size="sm" variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exporter en CSV
          </Button>
        </div>
      )}

      {/* Leads: clear/blurred display driven by the server-side masked flag */}
      {leads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} isPremium={!lead.masked} />
      ))}

      {/* Premium upsell - shown when there are masked leads */}
      {maskedCount > 0 && (
        <Card className="p-4 bg-muted/50 border-dashed">
          <div className="text-center">
            <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium mb-1">
              {maskedCount} lead{maskedCount > 1 ? 's' : ''} flouté{maskedCount > 1 ? 's' : ''}
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              Passez en Premium pour cet événement afin de débloquer tous vos leads.
            </p>
            <Button size="sm" variant="default" onClick={() => setShowPremiumDialog(true)}>
              Débloquer les leads floutés
            </Button>
          </div>
        </Card>
      )}

      <PremiumUpgradeDialog
        open={showPremiumDialog}
        onOpenChange={setShowPremiumDialog}
        noveltyId={noveltyId}
      />
    </div>
  );
}
