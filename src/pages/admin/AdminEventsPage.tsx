import React from 'react';
import { AirtableImport } from '@/components/admin/AirtableImport';
import { ImportErrorsPanel } from '@/components/admin/ImportErrorsPanel';
import { ExposantAirtableCorrections } from '@/components/admin/ExposantAirtableCorrections';
import { ExposantReviewQueue } from '@/components/admin/ExposantReviewQueue';
import { PendingEventsImport } from '@/components/admin/PendingEventsImport';
import AirtableAntiDuplicateCheck from '@/components/admin/AirtableAntiDuplicateCheck';
import { ExhibitorVisibilitySuggestions } from '@/components/admin/ExhibitorVisibilitySuggestions';
import AdminAllEvents from '@/components/admin/AdminAllEvents';
import { DuplicateEventsPanel } from '@/components/admin/DuplicateEventsPanel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

const AdminEventsPage = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Événements — Liste & Import</h1>

      <AirtableImport />
      <ImportErrorsPanel />

      <ExposantAirtableCorrections />
      <ExposantReviewQueue />

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Diagnostic Import Détaillé</h3>
              <p className="text-sm text-muted-foreground">Analyser les échecs d'import (dry-run)</p>
            </div>
            <Button asChild variant="outline">
              <a href="/admin/import-diagnostics">
                <Search className="h-4 w-4 mr-2" />
                Diagnostic
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <PendingEventsImport />
      <DuplicateEventsPanel />
      <ExhibitorVisibilitySuggestions />
      <AirtableAntiDuplicateCheck />
      <AdminAllEvents />
    </div>
  );
};

export default AdminEventsPage;
