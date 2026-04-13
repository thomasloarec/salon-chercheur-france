import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, ClipboardList } from 'lucide-react';
import AdminExhibitorsList from '@/components/admin/exhibitors/AdminExhibitorsList';
import AdminClaimRequests from '@/components/admin/exhibitors/AdminClaimRequests';
import AdminExhibitorDetailPanel from '@/components/admin/exhibitors/AdminExhibitorDetailPanel';

const AdminExhibitors = () => {
  const [selectedExhibitorId, setSelectedExhibitorId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('exhibitors');

  // If an exhibitor is selected (from either tab), show detail panel
  if (selectedExhibitorId) {
    return (
      <div className="space-y-6">
        <AdminExhibitorDetailPanel
          exhibitorId={selectedExhibitorId}
          onBack={() => setSelectedExhibitorId(null)}
        />
      </div>
    );
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
          </TabsList>

          <TabsContent value="exhibitors">
            <AdminExhibitorsList onSelectExhibitor={setSelectedExhibitorId} />
          </TabsContent>

          <TabsContent value="claims">
            <AdminClaimRequests onSelectExhibitor={setSelectedExhibitorId} />
          </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminExhibitors;
