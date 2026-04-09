import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, ClipboardList } from 'lucide-react';
import AdminExhibitorsList from '@/components/admin/exhibitors/AdminExhibitorsList';
import AdminClaimRequests from '@/components/admin/exhibitors/AdminClaimRequests';
import AdminExhibitorDetailPanel from '@/components/admin/exhibitors/AdminExhibitorDetailPanel';

const AdminExhibitors = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [selectedExhibitorId, setSelectedExhibitorId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('exhibitors');

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // If an exhibitor is selected (from either tab), show detail panel
  if (selectedExhibitorId) {
    return (
      <MainLayout title="Exposants — Administration">
        <div className="container mx-auto py-8 space-y-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Link to="/admin" className="hover:underline">Administration</Link>
              <span>/</span>
              <span>Exposants & Entreprises</span>
            </div>
          </div>
          <AdminExhibitorDetailPanel
            exhibitorId={selectedExhibitorId}
            onBack={() => setSelectedExhibitorId(null)}
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Exposants — Administration">
      <div className="container mx-auto py-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link to="/admin" className="hover:underline">Administration</Link>
            <span>/</span>
            <span>Exposants & Entreprises</span>
          </div>
          <h1 className="text-3xl font-bold">Exposants & Entreprises</h1>
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
    </MainLayout>
  );
};

export default AdminExhibitors;
