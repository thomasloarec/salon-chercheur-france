
import {
  AIRTABLE_BASE_ID,
  EVENTS_TABLE_NAME,
  EXHIBITORS_TABLE_NAME,
  PARTICIPATION_TABLE_NAME,
} from '@/config/airtable';

/**
 * Builds the supabase functions secrets set command with available values
 */
export function buildSecretCommand(missing: string[]): string {
  // Default values - use real config values instead of placeholders
  const defaultValues: Record<string, string> = {
    'AIRTABLE_BASE_ID': AIRTABLE_BASE_ID,
    'EVENTS_TABLE_NAME': EVENTS_TABLE_NAME,
    'EXHIBITORS_TABLE_NAME': EXHIBITORS_TABLE_NAME,  
    'PARTICIPATION_TABLE_NAME': PARTICIPATION_TABLE_NAME
  };

  // Build command parts
  const parts = missing.map(key => {
    const defaultValue = defaultValues[key];
    if (defaultValue) {
      return `${key}="${defaultValue}"`;
    } else {
      // For sensitive values like PAT, leave empty for security
      return `${key}=""`;
    }
  });

  return `supabase functions secrets set ${parts.join(' ')}`;
}

/**
 * Copies text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (fallbackError) {
      console.error('Fallback copy failed:', fallbackError);
      return false;
    }
  }
}
