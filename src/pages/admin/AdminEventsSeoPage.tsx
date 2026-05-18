import React from 'react';
import { SeoEnrichmentPanel } from '@/components/admin/SeoEnrichmentPanel';
import { EnrichedDescriptionValidation } from '@/components/admin/EnrichedDescriptionValidation';
import { SeoEnrichmentDashboard } from '@/components/admin/SeoEnrichmentDashboard';

const AdminEventsSeoPage = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Enrichissement SEO</h1>
      <SeoEnrichmentDashboard />
      <SeoEnrichmentPanel />
      <EnrichedDescriptionValidation />
    </div>
  );
};

export default AdminEventsSeoPage;
