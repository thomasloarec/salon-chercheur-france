
/**
 * Builds the supabase functions secrets set command with available values
 */
export function buildSecretCommand(missing: string[]): string {
  // Default values for table names (non-sensitive)
  const defaultValues: Record<string, string> = {
    'EVENTS_TABLE_NAME': 'All_Events',
    'EXHIBITORS_TABLE_NAME': 'All_Exposants',  
    'PARTICIPATION_TABLE_NAME': 'Participation'
  };

  // Build command parts
  const parts = missing.map(key => {
    const defaultValue = defaultValues[key];
    if (defaultValue) {
      return `${key}="${defaultValue}"`;
    } else {
      // For sensitive values like PAT and BASE_ID, leave placeholder
      return `${key}="YOUR_${key}_HERE"`;
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
