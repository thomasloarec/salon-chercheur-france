
import { buildSecretCommand } from '../secretsCommandBuilder';

describe('buildSecretCommand', () => {
  it('should build command with real values for table names and base ID', () => {
    const missing = ['AIRTABLE_BASE_ID', 'EVENTS_TABLE_NAME', 'EXHIBITORS_TABLE_NAME', 'PARTICIPATION_TABLE_NAME'];
    const command = buildSecretCommand(missing);
    
    expect(command).toBe('supabase functions secrets set AIRTABLE_BASE_ID="SLxgKrY3BSA1nX" EVENTS_TABLE_NAME="All_Events" EXHIBITORS_TABLE_NAME="All_Exposants" PARTICIPATION_TABLE_NAME="Participation"');
    expect(command).not.toMatch(/YOUR_.*_HERE/);
  });

  it('should leave PAT empty for security', () => {
    const missing = ['AIRTABLE_PAT'];
    const command = buildSecretCommand(missing);
    
    expect(command).toBe('supabase functions secrets set AIRTABLE_PAT=""');
    expect(command).not.toMatch(/YOUR_.*_HERE/);
  });

  it('should handle mixed missing variables with real values', () => {
    const missing = ['AIRTABLE_PAT', 'AIRTABLE_BASE_ID', 'EVENTS_TABLE_NAME'];
    const command = buildSecretCommand(missing);
    
    expect(command).toBe('supabase functions secrets set AIRTABLE_PAT="" AIRTABLE_BASE_ID="SLxgKrY3BSA1nX" EVENTS_TABLE_NAME="All_Events"');
    expect(command).not.toMatch(/YOUR_.*_HERE/);
  });

  it('should handle empty missing array', () => {
    const missing: string[] = [];
    const command = buildSecretCommand(missing);
    
    expect(command).toBe('supabase functions secrets set ');
  });

  it('should maintain order of missing variables', () => {
    const missing = ['PARTICIPATION_TABLE_NAME', 'AIRTABLE_PAT', 'EVENTS_TABLE_NAME'];
    const command = buildSecretCommand(missing);
    
    expect(command).toBe('supabase functions secrets set PARTICIPATION_TABLE_NAME="Participation" AIRTABLE_PAT="" EVENTS_TABLE_NAME="All_Events"');
  });
});
