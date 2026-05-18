import React from 'react';
import { SeoEnrichmentPanel } from '@/components/admin/SeoEnrichmentPanel';
import { EnrichedDescriptionValidation } from '@/components/admin/EnrichedDescriptionValidation';
import { SeoEnrichmentDashboard } from '@/components/admin/SeoEnrichmentDashboard';

const AdminEventsSeoPage = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Enrichissement SEO</h1>
      <SeoEnrichmentDashboard />
      <EnrichedDescriptionValidation />
      <details className="rounded-lg border bg-muted/20 p-4">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
          Outils avancés — batch meta uniquement (legacy)
        </summary>
        <div className="mt-4">
          <SeoEnrichmentPanel />
        </div>
      </details>
    </div>
  );
};

export default AdminEventsSeoPage;
