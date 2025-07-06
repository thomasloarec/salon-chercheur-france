
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { GoogleSheetsImporter } from '@/components/GoogleSheetsImporter';
import { PendingEventsTable } from '@/components/admin/PendingEventsTable';

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

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Administration</h1>
        <p className="text-gray-600">Gestion des événements et imports de données</p>
      </div>

      <PendingEventsTable />
      
      <GoogleSheetsImporter />
    </div>
  );
};

export default Admin;
