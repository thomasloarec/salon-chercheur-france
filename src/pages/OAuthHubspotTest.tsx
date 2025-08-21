import React, { useState, useEffect } from 'react';
import { HUBSPOT_CLIENT_ID, HUBSPOT_REDIRECT_URI, CRM_OAUTH_ENABLED, isHubspotConfigValid, getHubspotConfigIssues, maskClientId, getEffectiveHubspotConfig } from '@/lib/hubspotConfig';

export default function OAuthHubspotTest() {
  const debug = new URLSearchParams(window.location.search).has('oauthDebug');
  const [diag, setDiag] = useState({ 
    cookie: false, 
    local: false, 
    authorizeUrl: "",
    error: ""
  });
  const [debugConfig, setDebugConfig] = useState({
    clientId: '',
    redirectUri: ''
  });

  useEffect(() => {
    const cookie = document.cookie.includes('oauth_state=');
    const local = !!localStorage.getItem('oauth_state');
    setDiag(d => ({ ...d, cookie, local }));
    
    // Load debug config from sessionStorage if available
    const debugClientId = sessionStorage.getItem('oauth_debug_client_id') || '';
    const debugRedirectUri = sessionStorage.getItem('oauth_debug_redirect_uri') || '';
    setDebugConfig({ clientId: debugClientId, redirectUri: debugRedirectUri });
  }, []);

  const handleConnect = async () => {
    try {
      // Check if CRM OAuth is enabled
      if (!CRM_OAUTH_ENABLED) {
        alert('Intégrations CRM désactivées (flag CRM_OAUTH_ENABLED)');
        return;
      }

      // Get effective configuration
      const { source, clientId, redirectUri } = getEffectiveHubspotConfig();
      
      if (source === 'none') {
        alert('Configuration HubSpot invalide : renseignez client_id et redirect_uri (env publiques ou debug).');
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
      
      // Build OAuth URL using effective config
      const scope = 'oauth crm.objects.companies.read crm.objects.contacts.read';
      const authorizeUrl =
        `https://app-eu1.hubspot.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}&response_type=code&state=${encodeURIComponent(state)}`;
      
      // Store return URL for redirect after completion
      sessionStorage.setItem('oauth_return_to', window.location.href);
      
      if (debug) {
        console.log('AuthorizeURL:', authorizeUrl);
        setDiag(d => ({ ...d, authorizeUrl: authorizeUrl, error: "" }));
      }
      
      // Try to open popup, fallback to same window
      const popup = window.open(authorizeUrl, 'hubspot_oauth', 'width=600,height=700,scrollbars=yes,resizable=yes');
      if (!popup) {
        window.location.href = authorizeUrl;
      }
    } catch (error) {
      console.error('Error initiating OAuth:', error);
      alert('Erreur lors de l\'initiation OAuth: ' + (error instanceof Error ? error.message : 'erreur inconnue'));
    }
  };

  const handleSaveDebugConfig = () => {
    if (!debugConfig.clientId || !debugConfig.redirectUri) {
      alert('Veuillez renseigner le Client ID et le Redirect URI');
      return;
    }
    
    sessionStorage.setItem('oauth_debug_client_id', debugConfig.clientId);
    sessionStorage.setItem('oauth_debug_redirect_uri', debugConfig.redirectUri);
    alert('Configuration debug sauvegardée temporairement');
  };

  const handleClearDebugConfig = () => {
    sessionStorage.removeItem('oauth_debug_client_id');
    sessionStorage.removeItem('oauth_debug_redirect_uri');
    setDebugConfig({ clientId: '', redirectUri: '' });
    alert('Configuration debug effacée');
  };

  const effectiveConfigData = getEffectiveHubspotConfig();
  const hasDebugConfig = effectiveConfigData.source === 'debug';
  const effectiveConfig = {
    clientId: effectiveConfigData.clientId,
    redirectUri: effectiveConfigData.redirectUri
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
          <h3 className="font-semibold mb-4 text-foreground">Configuration OAuth</h3>
          
          <div className="space-y-3 mb-6 text-sm">
            <div><span className="font-medium">CRM OAuth Enabled:</span> <code className="bg-muted px-1 rounded">{CRM_OAUTH_ENABLED ? 'Oui' : 'Non'}</code></div>
            <div><span className="font-medium">HubSpot CLIENT_ID:</span> <code className="bg-muted px-1 rounded">{maskClientId(effectiveConfig.clientId)} {hasDebugConfig && <span className="text-orange-600">(debug)</span>}</code></div>
            <div><span className="font-medium">Redirect URI:</span> <code className="bg-muted px-1 rounded">{effectiveConfig.redirectUri || 'manquant'} {hasDebugConfig && <span className="text-orange-600">(debug)</span>}</code></div>
            <div><span className="font-medium">Config Valid:</span> <code className={`px-1 rounded ${isHubspotConfigValid(effectiveConfig.clientId, effectiveConfig.redirectUri) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {isHubspotConfigValid(effectiveConfig.clientId, effectiveConfig.redirectUri) ? 'Oui' : 'Non'}
            </code></div>
          </div>

          {debug && (!CRM_OAUTH_ENABLED || !isHubspotConfigValid()) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6">
              <h4 className="font-medium text-yellow-800 mb-3">Mode Debug - Configuration manuelle</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-yellow-700 mb-1">Client ID (UUID format)</label>
                  <input
                    type="text"
                    placeholder="ex: d5e83145-1234-5678-9abc-def123456789"
                    value={debugConfig.clientId}
                    onChange={(e) => setDebugConfig(prev => ({ ...prev, clientId: e.target.value }))}
                    className="w-full px-3 py-2 border border-yellow-300 rounded-md text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-yellow-700 mb-1">Redirect URI</label>
                  <input
                    type="text"
                    placeholder="https://lotexpo.com/oauth/hubspot/callback"
                    value={debugConfig.redirectUri}
                    onChange={(e) => setDebugConfig(prev => ({ ...prev, redirectUri: e.target.value }))}
                    className="w-full px-3 py-2 border border-yellow-300 rounded-md text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleSaveDebugConfig}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors text-sm font-medium"
                  >
                    Utiliser ces valeurs (debug)
                  </button>
                  {hasDebugConfig && (
                    <button 
                      onClick={handleClearDebugConfig}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
                    >
                      Effacer debug
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <button 
            onClick={handleConnect}
            disabled={!CRM_OAUTH_ENABLED || effectiveConfigData.source === 'none'}
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
                <h4 className="font-medium mb-2">Configuration utilisée</h4>
                <div><span className="font-medium">Source:</span> <code className="bg-muted-foreground/10 px-1 rounded">{effectiveConfigData.source === 'debug' ? 'Debug (sessionStorage)' : effectiveConfigData.source === 'env' ? 'Variables d\'environnement' : 'Aucune'}</code></div>
                <div><span className="font-medium">CRM OAuth Enabled:</span> <code className="bg-muted-foreground/10 px-1 rounded">{CRM_OAUTH_ENABLED ? 'Oui' : 'Non'}</code></div>
                <div><span className="font-medium">Config Valid:</span> <code className="bg-muted-foreground/10 px-1 rounded">{effectiveConfigData.source !== 'none' ? 'Oui' : 'Non'}</code></div>
                <div><span className="font-medium">HubSpot CLIENT_ID:</span> <code className="bg-muted-foreground/10 px-1 rounded">{maskClientId(effectiveConfig.clientId)}</code></div>
                <div><span className="font-medium">Redirect URI:</span> <code className="bg-muted-foreground/10 px-1 rounded">{effectiveConfig.redirectUri || 'manquant'}</code></div>
                {effectiveConfigData.source === 'none' && (
                  <div><span className="font-medium">Issues:</span> <code className="bg-red-100 px-1 rounded">
                    Configuration manquante ou invalide
                  </code></div>
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