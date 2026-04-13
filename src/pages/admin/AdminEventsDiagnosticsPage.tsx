import React from 'react';
import AirtableDiagnostic from '@/components/admin/AirtableDiagnostic';
import AirtableStatusWidget from '@/components/admin/AirtableStatusWidget';
import AirtableValidationTest from '@/components/admin/AirtableValidationTest';
import { OAuthHubSpotDiagnostic } from '@/components/admin/OAuthHubSpotDiagnostic';

const AdminEventsDiagnosticsPage = () => {
  const handleSecretsConfigured = () => {
    console.log('🔄 Secrets configured - triggering component refreshes');
    window.dispatchEvent(new CustomEvent('airtable-secrets-configured'));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Diagnostics</h1>
      <AirtableDiagnostic />
      <OAuthHubSpotDiagnostic />
      <AirtableStatusWidget autoRefresh={true} onSecretsConfigured={handleSecretsConfigured} />
      <AirtableValidationTest />
    </div>
  );
};

export default AdminEventsDiagnosticsPage;
