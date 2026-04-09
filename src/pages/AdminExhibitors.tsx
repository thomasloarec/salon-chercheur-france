import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, ClipboardList } from 'lucide-react';
import AdminExhibitorsList from '@/components/admin/exhibitors/AdminExhibitorsList';
import AdminClaimRequests from '@/components/admin/exhibitors/AdminClaimRequests';

const AdminExhibitors = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

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

        <Tabs defaultValue="exhibitors" className="space-y-6">
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
            <AdminExhibitorsList />
          </TabsContent>

          <TabsContent value="claims">
            <AdminClaimRequests />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default AdminExhibitors;
