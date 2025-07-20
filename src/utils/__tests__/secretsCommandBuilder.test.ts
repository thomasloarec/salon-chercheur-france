
import { buildSecretCommand } from '../secretsCommandBuilder';

describe('buildSecretCommand', () => {
  it('should build command with default values for table names', () => {
    const missing = ['EVENTS_TABLE_NAME', 'EXHIBITORS_TABLE_NAME', 'PARTICIPATION_TABLE_NAME'];
    const command = buildSecretCommand(missing);
    
    expect(command).toBe('supabase functions secrets set EVENTS_TABLE_NAME="All_Events" EXHIBITORS_TABLE_NAME="All_Exposants" PARTICIPATION_TABLE_NAME="Participation"');
  });

  it('should build command with placeholders for sensitive values', () => {
    const missing = ['AIRTABLE_PAT', 'AIRTABLE_BASE_ID'];
    const command = buildSecretCommand(missing);
    
    expect(command).toBe('supabase functions secrets set AIRTABLE_PAT="YOUR_AIRTABLE_PAT_HERE" AIRTABLE_BASE_ID="YOUR_AIRTABLE_BASE_ID_HERE"');
  });

  it('should handle mixed missing variables', () => {
    const missing = ['AIRTABLE_PAT', 'EVENTS_TABLE_NAME', 'AIRTABLE_BASE_ID'];
    const command = buildSecretCommand(missing);
    
    expect(command).toBe('supabase functions secrets set AIRTABLE_PAT="YOUR_AIRTABLE_PAT_HERE" EVENTS_TABLE_NAME="All_Events" AIRTABLE_BASE_ID="YOUR_AIRTABLE_BASE_ID_HERE"');
  });

  it('should handle empty missing array', () => {
    const missing: string[] = [];
    const command = buildSecretCommand(missing);
    
    expect(command).toBe('supabase functions secrets set ');
  });

  it('should maintain order of missing variables', () => {
    const missing = ['PARTICIPATION_TABLE_NAME', 'AIRTABLE_PAT', 'EVENTS_TABLE_NAME'];
    const command = buildSecretCommand(missing);
    
    expect(command).toBe('supabase functions secrets set PARTICIPATION_TABLE_NAME="Participation" AIRTABLE_PAT="YOUR_AIRTABLE_PAT_HERE" EVENTS_TABLE_NAME="All_Events"');
  });
});
