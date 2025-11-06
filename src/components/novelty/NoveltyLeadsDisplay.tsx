import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lock, Users, Download } from 'lucide-react';
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
  
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['novelty-leads', noveltyId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('novelty-leads', {
        body: { novelty_id: noveltyId }
      });
      
      if (error) throw error;
      return {
        leads: data.leads as Lead[],
        total: data.total as number,
        blurredCount: data.blurredCount as number,
        hiddenCount: data.hiddenCount as number,
      };
    }
  });

  const leads = leadsData?.leads;
  const totalLeads = leadsData?.total ?? 0;
  const serverBlurredCount = leadsData?.blurredCount ?? 0;
  const serverHiddenCount = leadsData?.hiddenCount ?? 0;

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

  // Server-side masking: leads are already masked/filtered by the API
  // No client-side logic needed for non-premium users
  const visibleLeads = leads || [];
  
  // For display: separate first 3 (full) from next 3 (blurred)
  const fullyVisibleLeads = visibleLeads.slice(0, 3);
  const previewLeads = visibleLeads.slice(3, 6);
  
  // Use server-provided counts for accurate display
  const blurredCount = isPremium ? 0 : serverBlurredCount;
  const hiddenCount = isPremium ? 0 : serverHiddenCount;

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
      
      {/* Leads 1-3: Full visibility (always shown with full data) */}
      {fullyVisibleLeads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} isPremium={true} />
      ))}
      
      {/* Leads 4-6: Blurred preview (already masked by server) */}
      {previewLeads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} isPremium={false} />
      ))}
      
      {/* Premium upsell - shown when there are blurred or hidden leads */}
      {(blurredCount > 0 || hiddenCount > 0) && (
        <Card className="p-4 bg-muted/50 border-dashed">
          <div className="text-center">
            <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium mb-1">
              {blurredCount + hiddenCount} lead{(blurredCount + hiddenCount) > 1 ? 's' : ''} {blurredCount > 0 ? 'flouté' : 'supplémentaire'}{(blurredCount + hiddenCount) > 1 ? 's' : ''}
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              Passez en Premium pour débloquer tous vos leads
            </p>
            <Button size="sm" variant="default" onClick={() => setShowPremiumDialog(true)}>
              Débloquer les leads cachés - 99€ HT
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
