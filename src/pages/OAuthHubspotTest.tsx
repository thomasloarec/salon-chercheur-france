import React, { useState, useEffect } from 'react';
import { HUBSPOT_CLIENT_ID, HUBSPOT_REDIRECT_URI, buildHubSpotAuthUrl, CRM_OAUTH_ENABLED, isHubspotConfigValid, getHubspotConfigIssues } from '@/lib/hubspotConfig';

export default function OAuthHubspotTest() {
  const debug = new URLSearchParams(window.location.search).has('oauthDebug');
  const [diag, setDiag] = useState({ 
    cookie: false, 
    local: false, 
    authorizeUrl: "",
    error: ""
  });

  useEffect(() => {
    const cookie = document.cookie.includes('oauth_state=');
    const local = !!localStorage.getItem('oauth_state');
    setDiag(d => ({ ...d, cookie, local }));
  }, []);

  const handleConnect = async () => {
    try {
      // Check if CRM OAuth is enabled
      if (!CRM_OAUTH_ENABLED) {
        alert('Intégrations CRM désactivées (flag CRM_OAUTH_ENABLED)');
        return;
      }

      // Check HubSpot configuration
      if (!isHubspotConfigValid()) {
        const issues = getHubspotConfigIssues();
        alert('Configuration HubSpot invalide: ' + issues.join(', '));
        return;
      }

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
      
      // Build authorize URL using centralized config
      const authResult = buildHubSpotAuthUrl(state);
      
      if (authResult.error) {
        alert('Erreur de configuration: ' + authResult.error);
        setDiag(d => ({ ...d, error: authResult.error || "" }));
        return;
      }

      if (!authResult.url) {
        alert('Impossible de générer l\'URL d\'autorisation');
        return;
      }
      
      // Store return URL for redirect after completion
      sessionStorage.setItem('oauth_return_to', window.location.href);
      
      if (debug) {
        console.log('AuthorizeURL:', authResult.url);
        setDiag(d => ({ ...d, authorizeUrl: authResult.url || "", error: "" }));
      }
      
      // Try to open popup, fallback to same window
      const popup = window.open(authResult.url, 'hubspot_oauth', 'width=600,height=700,scrollbars=yes,resizable=yes');
      if (!popup) {
        window.location.href = authResult.url;
      }
    } catch (error) {
      console.error('Error initiating OAuth:', error);
      alert('Erreur lors de l\'initiation OAuth: ' + (error instanceof Error ? error.message : 'erreur inconnue'));
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-foreground">Test HubSpot OAuth</h1>
        
        {(!CRM_OAUTH_ENABLED || !isHubspotConfigValid()) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-6 text-sm">
            <div className="flex items-start gap-2">
              <div className="text-yellow-600">⚠️</div>
              <div>
                <h4 className="font-medium text-yellow-800 mb-1">Configuration OAuth indisponible</h4>
                <div className="text-yellow-700">
                  {!CRM_OAUTH_ENABLED ? (
                    <p>Intégrations CRM désactivées (flag CRM_OAUTH_ENABLED)</p>
                  ) : (
                    <div>
                      <p>Configuration HubSpot incomplète :</p>
                      <ul className="mt-1 ml-4 list-disc">
                        {getHubspotConfigIssues().map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-card p-6 rounded-lg border mb-6">
          <button 
            onClick={handleConnect}
            disabled={!CRM_OAUTH_ENABLED || !isHubspotConfigValid()}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Connecter HubSpot (test)
          </button>
        </div>

        {debug && (
          <div className="bg-muted p-4 rounded-lg border">
            <h3 className="font-semibold mb-4 text-foreground">🔍 Diagnostic OAuth (Debug Mode)</h3>
            
            <div className="space-y-3">
              <div className="mb-4 text-sm space-y-2">
                <div><span className="font-medium">CRM OAuth Enabled:</span> <code className="bg-muted-foreground/10 px-1 rounded">{CRM_OAUTH_ENABLED ? 'Oui' : 'Non'}</code></div>
                <div><span className="font-medium">Config Valid:</span> <code className="bg-muted-foreground/10 px-1 rounded">{isHubspotConfigValid() ? 'Oui' : 'Non'}</code></div>
                <div><span className="font-medium">HubSpot CLIENT_ID:</span> <code className="bg-muted-foreground/10 px-1 rounded">{HUBSPOT_CLIENT_ID || 'manquant'}</code></div>
                <div><span className="font-medium">Redirect URI:</span> <code className="bg-muted-foreground/10 px-1 rounded">{HUBSPOT_REDIRECT_URI || 'manquant'}</code></div>
                {getHubspotConfigIssues().length > 0 && (
                  <div><span className="font-medium">Issues:</span> <code className="bg-red-100 px-1 rounded">{getHubspotConfigIssues().join(', ')}</code></div>
                )}
              </div>
              
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
              
              {diag.error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  <span className="font-medium">Erreur:</span> {diag.error}
                </div>
              )}
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