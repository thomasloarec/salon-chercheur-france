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
 * Set OAuth state with secure cookie and localStorage fallback
 */
export const setOAuthState = (value: string): void => {
  // Set secure cookie with domain for lotexpo.com
  document.cookie = `oauth_state=${encodeURIComponent(value)}; Max-Age=600; Path=/; Domain=.lotexpo.com; SameSite=Lax; Secure`;
  
  // Set localStorage fallback
  localStorage.setItem("oauth_state", value);
  
  console.log('🔒 OAuth state set:', value.substring(0, 8) + '...');
};

/**
 * Read OAuth state from cookie and localStorage
 */
export const readOAuthState = (): { cookie: string | null; local: string | null } => {
  // Read from cookie
  let cookie: string | null = null;
  const cookies = document.cookie.split(';');
  for (const c of cookies) {
    const [name, value] = c.trim().split('=');
    if (name === 'oauth_state') {
      cookie = decodeURIComponent(value);
      break;
    }
  }
  
  // Read from localStorage
  const local = localStorage.getItem("oauth_state");
  
  return { cookie, local };
};

/**
 * Clear OAuth state from both cookie and localStorage
 */
export const clearOAuthState = (): void => {
  // Clear cookie
  document.cookie = "oauth_state=; Max-Age=0; Path=/; Domain=.lotexpo.com; SameSite=Lax; Secure";
  
  // Clear localStorage
  localStorage.removeItem("oauth_state");
  
  console.log('🗑️ OAuth state cleared');
};

// Legacy functions for backward compatibility
export const setOAuthStateCookie = (state: string, provider: string = 'hubspot'): void => {
  setOAuthState(state);
};

export const getOAuthStateCookie = (provider: string = 'hubspot'): string | null => {
  const { cookie, local } = readOAuthState();
  return cookie ?? local;
};

export const clearOAuthStateCookie = (provider: string = 'hubspot'): void => {
  clearOAuthState();
};

export const validateOAuthState = (receivedState: string, provider: string = 'hubspot'): boolean => {
  const { cookie, local } = readOAuthState();
  const storedState = cookie ?? local;
  
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