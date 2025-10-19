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
  
  const { data: leads, isLoading } = useQuery({
    queryKey: ['novelty-leads', noveltyId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('novelty-leads', {
        body: { novelty_id: noveltyId }
      });
      
      if (error) throw error;
      return data.leads as Lead[];
    }
  });

  const handleExportCSV = () => {
    if (!leads) return;

    // Convert leads to CSV
    const headers = ['Prénom', 'Nom', 'Email', 'Téléphone', 'Entreprise', 'Poste', 'Type', 'Date'];
    const rows = leads.map(lead => [
      lead.first_name,
      lead.last_name,
      lead.email,
      lead.phone || '',
      lead.company || '',
      lead.role || '',
      lead.lead_type === 'resource_download' ? 'Téléchargement' : 'Rendez-vous',
      new Date(lead.created_at).toLocaleDateString('fr-FR'),
    ]);

    const csvContent = [
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

  // Leads 1-3: 100% visible
  const visibleLeads = leads?.slice(0, 3) || [];
  // Leads 4-6: Blurred preview
  const previewLeads = isPremium ? [] : (leads?.slice(3, 6) || []);
  // Leads 7+: Hidden
  const hiddenCount = Math.max(0, (leads?.length || 0) - 6);

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
      
      {/* Leads 1-3: Full visibility */}
      {visibleLeads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} isPremium={true} />
      ))}
      
      {/* Leads 4-6: Blurred (freemium) */}
      {previewLeads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} isPremium={false} />
      ))}
      
      {/* Premium upsell - shown when there are blurred or hidden leads */}
      {(previewLeads.length > 0 || hiddenCount > 0) && (
        <Card className="p-4 bg-muted/50 border-dashed">
          <div className="text-center">
            <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium mb-1">
              {previewLeads.length + hiddenCount} lead{(previewLeads.length + hiddenCount) > 1 ? 's' : ''} {previewLeads.length > 0 ? 'flouté' : 'supplémentaire'}{(previewLeads.length + hiddenCount) > 1 ? 's' : ''}
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              Passez en Premium pour débloquer tous vos leads
            </p>
            <Button size="sm" variant="default" onClick={() => setShowPremiumDialog(true)}>
              Passer en Premium - 99€ HT
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
