/**
 * Returns the best available logo/avatar URL for an exhibitor.
 *
 * Priority:
 * 1. logo_url (if truthy)
 * 2. Google favicon from the exhibitor's website domain (128px)
 * 3. null → caller should render a placeholder (Building2 icon or initials)
 */
export function getExhibitorLogoUrl(
  logoUrl: string | null | undefined,
  website: string | null | undefined,
): string | null {
  if (logoUrl) return logoUrl;

  if (website) {
    const domain = extractDomain(website);
    if (domain) {
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    }
  }

  return null;
}

/**
 * Extracts a bare domain (e.g. "example.com") from a URL or domain string.
 * Strips protocol, www., trailing slashes and paths.
 */
function extractDomain(input: string): string | null {
  try {
    let cleaned = input.trim();
    if (!cleaned) return null;

    // Add protocol if missing so URL constructor works
    if (!/^https?:\/\//i.test(cleaned)) {
      cleaned = `https://${cleaned}`;
    }

    const url = new URL(cleaned);
    let hostname = url.hostname.toLowerCase();

    // Strip leading "www."
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }

    return hostname || null;
  } catch {
    return null;
  }
}
