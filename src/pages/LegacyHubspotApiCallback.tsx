import { useEffect } from 'react';

export default function LegacyHubspotApiCallback() {
  useEffect(() => {
    // Redirection immédiate vers la nouvelle route
    window.location.replace("/oauth/hubspot/callback" + window.location.search);
  }, []);

  return null;
}