import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, Inbox, Building2 } from 'lucide-react';
import AdminSalonsList from '@/components/admin/organisateurs/AdminSalonsList';
import AdminSalonClaimsList from '@/components/admin/organisateurs/AdminSalonClaimsList';
import AdminSalonDetailPanel from '@/components/admin/organisateurs/AdminSalonDetailPanel';
import AdminOrganizersList from '@/components/admin/organisateurs/AdminOrganizersList';

const AdminOrganisateurs = () => {
  const [selectedSalonId, setSelectedSalonId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('salons');

  if (selectedSalonId) {
    return (
      <div className="space-y-6">
        <AdminSalonDetailPanel salonId={selectedSalonId} onBack={() => setSelectedSalonId(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Organisateurs & Salons</h1>
        <p className="text-muted-foreground mt-1">
          Gestion des salons, revendications et propriétaires
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="salons" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Salons
          </TabsTrigger>
          <TabsTrigger value="claims" className="gap-2">
            <Inbox className="h-4 w-4" />
            Demandes en attente
          </TabsTrigger>
          <TabsTrigger value="organizers" className="gap-2">
            <Building2 className="h-4 w-4" />
            Organisateurs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="salons">
          <AdminSalonsList onSelectSalon={setSelectedSalonId} />
        </TabsContent>

        <TabsContent value="claims">
          <AdminSalonClaimsList onSelectSalon={setSelectedSalonId} />
        </TabsContent>

        <TabsContent value="organizers">
          <AdminOrganizersList />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminOrganisateurs;
