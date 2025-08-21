import React, { useState, useEffect } from 'react';

export default function OAuthHubspotTest() {
  const debug = new URLSearchParams(window.location.search).has('oauthDebug');
  const [diag, setDiag] = useState({ 
    cookie: false, 
    local: false, 
    authorizeUrl: "" 
  });

  useEffect(() => {
    const cookie = document.cookie.includes('oauth_state=');
    const local = !!localStorage.getItem('oauth_state');
    setDiag(d => ({ ...d, cookie, local }));
  }, []);

  const handleConnect = async () => {
    try {
      // Generate secure state nonce
      const state = crypto.randomUUID();
      
      // Set secure cookie with proper domain
      document.cookie = `oauth_state=${encodeURIComponent(state)}; Max-Age=600; Path=/; Domain=.lotexpo.com; SameSite=Lax; Secure`;
      
      // Set localStorage fallback
      localStorage.setItem('oauth_state', state);
      
      // Update diagnostic immediately after setting
      const cookie = document.cookie.includes('oauth_state=');
      const local = !!localStorage.getItem('oauth_state');
      setDiag(d => ({ ...d, cookie, local }));
      
      // Get environment variables
      const REDIRECT_URI = import.meta.env.VITE_HUBSPOT_REDIRECT_URI || 
                          (window as any).NEXT_PUBLIC_HUBSPOT_REDIRECT_URI ||
                          'https://lotexpo.com/oauth/hubspot/callback';
      
      if (!REDIRECT_URI) {
        alert('HUBSPOT_REDIRECT_URI manquante');
        return;
      }
      
      const CLIENT_ID = import.meta.env.VITE_HUBSPOT_CLIENT_ID || 
                       (window as any).NEXT_PUBLIC_HUBSPOT_CLIENT_ID ||
                       '4b4ff106-7f78-46a3-bf87-bc7a2e000403'; // Default client ID
      
      if (!CLIENT_ID) {
        alert('HUBSPOT_CLIENT_ID manquante');
        return;
      }
      
      const SCOPE = 'oauth crm.objects.companies.read crm.objects.contacts.read';
      const authorizeUrl = `https://app-eu1.hubspot.com/oauth/authorize?client_id=${encodeURIComponent(CLIENT_ID)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPE)}&response_type=code&state=${encodeURIComponent(state)}`;
      
      // Store return URL for redirect after completion
      sessionStorage.setItem('oauth_return_to', window.location.href);
      
      if (debug) {
        console.log('AuthorizeURL:', authorizeUrl);
        setDiag(d => ({ ...d, authorizeUrl }));
      }
      
      // Try to open popup, fallback to same window
      const popup = window.open(authorizeUrl, 'hubspot_oauth', 'width=600,height=700,scrollbars=yes,resizable=yes');
      if (!popup) {
        window.location.href = authorizeUrl;
      }
    } catch (error) {
      console.error('Error initiating OAuth:', error);
      alert('Erreur lors de l\'initiation OAuth: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-foreground">Test HubSpot OAuth</h1>
        
        <div className="bg-card p-6 rounded-lg border mb-6">
          <button 
            onClick={handleConnect}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-md hover:bg-primary/90 transition-colors font-medium"
          >
            Connecter HubSpot (test)
          </button>
        </div>

        {debug && (
          <div className="bg-muted p-4 rounded-lg border">
            <h3 className="font-semibold mb-4 text-foreground">🔍 Diagnostic OAuth (Debug Mode)</h3>
            
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">Cookie State:</span>
                  <span className={`ml-2 ${diag.cookie ? 'text-green-600' : 'text-red-600'}`}>
                    {diag.cookie ? '✅ Present' : '❌ Missing'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Local State:</span>
                  <span className={`ml-2 ${diag.local ? 'text-green-600' : 'text-red-600'}`}>
                    {diag.local ? '✅ Present' : '❌ Missing'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Authorize URL:</span>
                  <span className={`ml-2 ${diag.authorizeUrl ? 'text-green-600' : 'text-gray-500'}`}>
                    {diag.authorizeUrl ? '✅ Generated' : '⏳ Waiting'}
                  </span>
                </div>
              </div>
            </div>

            {diag.authorizeUrl && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">URL d'autorisation générée:</h4>
                <div className="bg-background p-3 rounded text-xs font-mono break-all border">
                  {diag.authorizeUrl}
                </div>
                <div className="mt-2 text-sm">
                  <span className="font-medium">Redirect URI décodé:</span>
                  <span className="ml-2 text-blue-600">
                    {decodeURIComponent(diag.authorizeUrl.split('redirect_uri=')[1]?.split('&')[0] || '')}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-4 text-xs text-muted-foreground">
              <p>💡 Cette page ne charge aucun provider Apollo ni useQuery</p>
              <p>🔒 Le state OAuth est stocké dans un cookie sécurisé + localStorage</p>
            </div>
          </div>
        )}

        <div className="mt-8 text-sm text-muted-foreground">
          <h3 className="font-medium mb-2">Instructions:</h3>
          <ul className="space-y-1 list-disc ml-4">
            <li>Ajoutez <code className="bg-muted px-1 rounded">?oauthDebug=1</code> pour activer le mode debug</li>
            <li>Le cookie <code className="bg-muted px-1 rounded">oauth_state</code> sera visible dans DevTools</li>
            <li>Au retour, vous serez redirigé vers <code className="bg-muted px-1 rounded">/oauth/hubspot/callback</code></li>
            <li>Puis retour automatique sur cette page après succès</li>
          </ul>
        </div>
      </div>
    </div>
  );
}