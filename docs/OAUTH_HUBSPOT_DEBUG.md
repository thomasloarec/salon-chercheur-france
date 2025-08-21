# HubSpot OAuth Debug Guide

## State Storage Matrix

| Cookie State | LocalStorage State | Debug Mode | Result |
|--------------|-------------------|------------|--------|
| ✅ Present | ✅ Present | Any | Use cookie (priority) |
| ✅ Present | ❌ Missing | Any | Use cookie |
| ❌ Missing | ✅ Present | Any | Use localStorage (fallback) |
| ❌ Missing | ❌ Missing | Normal | 400 csrf_state error |
| ❌ Missing | ❌ Missing | Debug (`?oauthDebug=1`) | Use URL state + warning |

## State Storage Implementation

### Setting State (before HubSpot redirect)

```javascript
// Set secure cookie with proper domain
document.cookie = "oauth_state=" + encodeURIComponent(value) + 
  "; Max-Age=600; Path=/; Domain=.lotexpo.com; SameSite=Lax; Secure";

// Set localStorage fallback
localStorage.setItem("oauth_state", value);
```

### Reading State (on callback page)

```javascript
const { cookie, local } = readOAuthState();

// Priority: cookie > localStorage > URL state (debug only)
const headerState = cookie ?? local ?? (isDebug ? urlState : null);
```

### Cleanup (after success)

```javascript
// Clear cookie
document.cookie = "oauth_state=; Max-Age=0; Path=/; Domain=.lotexpo.com; SameSite=Lax; Secure";

// Clear localStorage
localStorage.removeItem("oauth_state");
```

## Debug Mode

Enable debug mode by adding `?oauthDebug=1` to any OAuth URL:

- `/crm-integrations?oauthDebug=1` - Shows debug info when initiating OAuth
- `/oauth/hubspot/callback?oauthDebug=1` - Shows diagnostic card on callback page

### Debug Features

1. **Console logging**: Detailed state management logs
2. **Diagnostic card**: Shows state presence flags
3. **No auto-redirect**: Stays on callback page for inspection
4. **Fallback to URL state**: Uses URL state if cookie/localStorage missing

## Testing Scenarios

### Normal Flow (Production)
1. Navigate to `/crm-integrations`
2. Click "Connecter HubSpot"
3. Complete HubSpot OAuth
4. Should redirect back with success

### Debug Flow
1. Navigate to `/crm-integrations?oauthDebug=1`
2. Open DevTools → Application → Storage
3. Click "Connecter HubSpot"
4. Verify cookie `oauth_state` and localStorage entry
5. Complete HubSpot OAuth
6. Check diagnostic card on `/oauth/hubspot/callback?oauthDebug=1`

### Error Testing
1. Clear all cookies and localStorage
2. Navigate directly to `/oauth/hubspot/callback?code=test&state=test`
3. Should get 400 csrf_state error (normal mode)
4. Add `?oauthDebug=1` - should use URL state with warning

## Expected Headers

POST request to Edge Function should include:

```
Content-Type: application/json
X-OAuth-State: [base64url_state_value]
```

## Common Issues

- **"No stored state found"**: Check cookie domain (should be `.lotexpo.com`)
- **CORS errors**: Verify `X-OAuth-State` in allowed headers
- **State mismatch**: Check URL encoding/decoding consistency
- **Cookie not set**: Verify Secure flag compatibility with HTTPS

## Monitoring

Edge Function logs include:
- `header_state_present`: Boolean flag
- `redirect_uri_used`: Masked redirect URI
- `cookie_state_present`/`local_state_present`: Debug flags