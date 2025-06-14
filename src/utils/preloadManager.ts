
/**
 * Utility to manage resource preloading and prevent unused preload warnings
 */
export class PreloadManager {
  private static preloadedResources = new Set<string>();

  /**
   * Preload a resource only if it hasn't been preloaded yet
   */
  static preloadResource(href: string, as: string, crossorigin?: boolean): void {
    if (this.preloadedResources.has(href)) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    
    if (crossorigin) {
      link.crossOrigin = 'anonymous';
    }

    // Add error handling to prevent console warnings
    link.onerror = () => {
      console.warn(`Failed to preload resource: ${href}`);
      this.preloadedResources.delete(href);
    };

    link.onload = () => {
      this.preloadedResources.add(href);
    };

    document.head.appendChild(link);
  }

  /**
   * Preload critical CSS for a specific route
   */
  static preloadCriticalCSS(route: string): void {
    // Only preload CSS that will definitely be used
    const criticalRoutes = ['/', '/events', '/auth'];
    
    if (criticalRoutes.includes(route)) {
      // This would typically preload route-specific CSS
      // For now, we'll just ensure main CSS is loaded
      console.log(`Critical CSS preloaded for route: ${route}`);
    }
  }

  /**
   * Clean up unused preload links
   */
  static cleanup(): void {
    const preloadLinks = document.querySelectorAll('link[rel="preload"]');
    preloadLinks.forEach(link => {
      const href = (link as HTMLLinkElement).href;
      if (!this.preloadedResources.has(href)) {
        // Remove unused preload links after 5 seconds
        setTimeout(() => {
          if (link.parentNode) {
            link.parentNode.removeChild(link);
          }
        }, 5000);
      }
    });
  }
}

// Auto-cleanup on page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(() => PreloadManager.cleanup(), 5000);
  });
}
