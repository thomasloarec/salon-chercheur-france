// OAuth Security utilities for state management and CSRF protection

/**
 * Generate a cryptographically secure nonce for OAuth state parameter
 */
export const generateOAuthNonce = (): string => {
  // Generate 32 bytes of randomness and encode as base64url
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

/**
 * Set OAuth state cookie with security flags
 */
export const setOAuthStateCookie = (state: string, provider: string = 'hubspot'): void => {
  const cookieName = `oauth_state_${provider}`;
  const cookieValue = `${cookieName}=${state}; Path=/; SameSite=Lax; Secure; Max-Age=600`; // 10 minutes
  
  document.cookie = cookieValue;
  console.log(`🔒 OAuth state cookie set for ${provider}:`, state.substring(0, 8) + '...');
};

/**
 * Get OAuth state cookie value
 */
export const getOAuthStateCookie = (provider: string = 'hubspot'): string | null => {
  const cookieName = `oauth_state_${provider}`;
  const cookies = document.cookie.split(';');
  
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === cookieName) {
      return value;
    }
  }
  
  return null;
};

/**
 * Clear OAuth state cookie after use
 */
export const clearOAuthStateCookie = (provider: string = 'hubspot'): void => {
  const cookieName = `oauth_state_${provider}`;
  document.cookie = `${cookieName}=; Path=/; SameSite=Lax; Secure; Max-Age=0`;
  console.log(`🗑️ OAuth state cookie cleared for ${provider}`);
};

/**
 * Validate OAuth state against stored cookie
 */
export const validateOAuthState = (receivedState: string, provider: string = 'hubspot'): boolean => {
  const storedState = getOAuthStateCookie(provider);
  
  if (!storedState) {
    console.warn(`⚠️ No stored OAuth state found for ${provider}`);
    return false;
  }
  
  if (storedState !== receivedState) {
    console.error(`❌ OAuth state mismatch for ${provider}:`, {
      stored: storedState.substring(0, 8) + '...',
      received: receivedState.substring(0, 8) + '...'
    });
    return false;
  }
  
  console.log(`✅ OAuth state validation successful for ${provider}`);
  return true;
};