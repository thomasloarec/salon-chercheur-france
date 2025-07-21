
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import AirtableValidationTest from '@/components/admin/AirtableValidationTest';
import AirtableAntiDuplicateCheck from '@/components/admin/AirtableAntiDuplicateCheck';
import { PendingEventsTable } from '@/components/admin/PendingEventsTable';
import { PendingEventsImport } from '@/components/admin/PendingEventsImport';
import AdminPastEvents from '@/components/admin/AdminPastEvents';
import MainLayout from '@/components/layout/MainLayout';
import AirtableStatusWidget from '@/components/admin/AirtableStatusWidget';
import AirtableDiagnostic from '@/components/admin/AirtableDiagnostic';
import { AirtableImport } from '@/components/admin/AirtableImport';

const Admin = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  const isAdmin = user?.email === 'admin@salonspro.com';

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleSecretsConfigured = () => {
    console.log('🔄 Secrets configured - triggering component refreshes');
    // This will be called when secrets transition from false to true
    // Components can listen to this event to refresh their data
    window.dispatchEvent(new CustomEvent('airtable-secrets-configured'));
  };

  return (
    <MainLayout title="Administration">
      <div className="container mx-auto py-8 space-y-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Administration</h1>
          <p className="text-gray-600">Gestion des événements et synchronisation des données</p>
        </div>

        {/* Nouveau composant de diagnostic */}
        <AirtableDiagnostic />

        {/* Widget de vérification finale */}
        <AirtableStatusWidget 
          autoRefresh={true} 
          onSecretsConfigured={handleSecretsConfigured}
        />

        {/* Tests de validation Airtable */}
        <AirtableValidationTest />

        {/* Import Airtable simplifié */}
        <AirtableImport />

        {/* Événements importés en attente de publication */}
        <PendingEventsImport />

        {/* Vérification anti-doublons */}
        <AirtableAntiDuplicateCheck />

        {/* Événements en attente de publication (table events) */}
        <PendingEventsTable />
        
        {/* Événements passés */}
        <AdminPastEvents />

        {/* Statistiques rapides */}
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Statistiques rapides</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">0</div>
              <div className="text-sm text-gray-600">Événements publiés ce mois</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">0</div>
              <div className="text-sm text-gray-600">Événements en attente</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">0</div>
              <div className="text-sm text-gray-600">Total événements visibles</div>
            </div>
          </div>
        </div>

        {/* Contrôle qualité */}
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Contrôle qualité</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
              <span className="text-red-800">Événements sans image</span>
              <span className="font-semibold text-red-600">0</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
              <span className="text-orange-800">Événements sans URL officielle</span>
              <span className="font-semibold text-orange-600">0</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
              <span className="text-yellow-800">Événements sans exposants</span>
              <span className="font-semibold text-yellow-600">0</span>
            </div>
          </div>
        </div>

        {/* Outils admin */}
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Outils d'administration</h3>
          <div className="flex flex-wrap gap-3">
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
              Exporter CSV (tous les événements)
            </button>
            <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors">
              Générer rapport mensuel
            </button>
            <button className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors">
              Nettoyer les données obsolètes
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Admin;
