/**
 * Analytics tracking helper
 * Safely wraps RudderStack calls with no-op fallback when SDK is not loaded
 */

export function track(event: string, props?: Record<string, any>) {
  try {
    if (typeof window !== 'undefined' && (window as any).rudderanalytics?.track) {
      (window as any).rudderanalytics.track(event, props || {});
      console.log('[Analytics]', event, props);
    } else {
      console.log('[Analytics] SDK not loaded:', event, props);
    }
  } catch (error) {
    console.error('[Analytics] Error:', error);
  }
}

export function identify(userId: string, traits?: Record<string, any>) {
  try {
    if (typeof window !== 'undefined' && (window as any).rudderanalytics?.identify) {
      (window as any).rudderanalytics.identify(userId, traits || {});
      console.log('[Analytics] identify:', userId, traits);
    }
  } catch (error) {
    console.error('[Analytics] Error:', error);
  }
}

export function page(name?: string, properties?: Record<string, any>) {
  try {
    if (typeof window !== 'undefined' && (window as any).rudderanalytics?.page) {
      (window as any).rudderanalytics.page(name, properties || {});
      console.log('[Analytics] page:', name, properties);
    }
  } catch (error) {
    console.error('[Analytics] Error:', error);
  }
}
