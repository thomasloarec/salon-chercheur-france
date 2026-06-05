import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, ClipboardList, CopyCheck, Globe, GitMerge } from 'lucide-react';
import AdminExhibitorsList from '@/components/admin/exhibitors/AdminExhibitorsList';
import AdminClaimRequests from '@/components/admin/exhibitors/AdminClaimRequests';
import AdminExhibitorDetailPanel from '@/components/admin/exhibitors/AdminExhibitorDetailPanel';
import AdminNonExhibitorPanel from '@/components/admin/exhibitors/AdminNonExhibitorPanel';
import AdminDuplicateReviews from '@/components/admin/exhibitors/AdminDuplicateReviews';
import AdminInvalidWebsites from '@/components/admin/exhibitors/AdminInvalidWebsites';
import AdminReconciliationPreview from '@/components/admin/exhibitors/AdminReconciliationPreview';
import { isUuid, type AdminSelection } from '@/components/admin/exhibitors/types';

const AdminExhibitors = () => {
  const [selection, setSelection] = useState<AdminSelection | null>(null);
  const [activeTab, setActiveTab] = useState('exhibitors');

  if (selection) {
    if (selection.kind === 'exhibitor' && isUuid(selection.exhibitor_id)) {
      return (
        <div className="space-y-6">
          <AdminExhibitorDetailPanel
            exhibitorId={selection.exhibitor_id}
            onBack={() => setSelection(null)}
          />
        </div>
      );
    }
    if (selection.kind === 'outreach' || selection.kind === 'legacy') {
      return (
        <div className="space-y-6">
          <AdminNonExhibitorPanel selection={selection} onBack={() => setSelection(null)} />
        </div>
      );
    }
    // Defensive fallback (invalid id)
    console.warn('[AdminDetail] invalid selection, ignoring', selection);
    setSelection(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exposants & Entreprises</h1>
        <p className="text-muted-foreground mt-1">
          Gestion des entreprises, gouvernance et demandes de gestion
        </p>
      </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="exhibitors" className="gap-2">
              <Building2 className="h-4 w-4" />
              Entreprises
            </TabsTrigger>
            <TabsTrigger value="claims" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Demandes de gestion
            </TabsTrigger>
            <TabsTrigger value="duplicates" className="gap-2">
              <CopyCheck className="h-4 w-4" />
              Doublons exposants
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="gap-2">
              <GitMerge className="h-4 w-4" />
              Réconciliation (preview)
            </TabsTrigger>
            <TabsTrigger value="invalid-websites" className="gap-2">
              <Globe className="h-4 w-4" />
              Websites invalides
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exhibitors">
            <AdminExhibitorsList onSelectResult={setSelection} />
          </TabsContent>

          <TabsContent value="claims">
            <AdminClaimRequests
              onSelectExhibitor={(id) =>
                isUuid(id)
                  ? setSelection({ kind: 'exhibitor', exhibitor_id: id })
                  : console.warn('[AdminDetail] non-uuid id from claims', id)
              }
            />
          </TabsContent>

          <TabsContent value="duplicates">
            <AdminDuplicateReviews />
          </TabsContent>

          <TabsContent value="reconciliation">
            <AdminReconciliationPreview />
          </TabsContent>

          <TabsContent value="invalid-websites">
            <AdminInvalidWebsites />
          </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminExhibitors;
