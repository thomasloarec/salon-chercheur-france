import React from 'react';
import TestModeManager from '@/components/admin/TestModeManager';

const AdminSystemTestPage = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Données de test</h1>
      <TestModeManager />
    </div>
  );
};

export default AdminSystemTestPage;
