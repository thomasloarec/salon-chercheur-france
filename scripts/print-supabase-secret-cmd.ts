
#!/usr/bin/env -S deno run -A

/**
 * Helper script to generate Supabase secrets command
 * Reads from environment variables and generates the proper command
 * 
 * Usage: deno run -A scripts/print-supabase-secret-cmd.ts
 */

const REQUIRED_SECRETS = [
  'AIRTABLE_PAT',
  'AIRTABLE_BASE_ID',
  'EVENTS_TABLE_NAME',
  'EXHIBITORS_TABLE_NAME', 
  'PARTICIPATION_TABLE_NAME'
];

const DEFAULT_VALUES = {
  'EVENTS_TABLE_NAME': 'All_Events',
  'EXHIBITORS_TABLE_NAME': 'All_Exposants',
  'PARTICIPATION_TABLE_NAME': 'Participation'
};

function generateSecretsCommand(): string {
  const secretPairs: string[] = [];
  const missing: string[] = [];

  for (const secret of REQUIRED_SECRETS) {
    const value = Deno.env.get(secret) || (DEFAULT_VALUES as any)[secret] || '';
    
    if (!value) {
      missing.push(secret);
      secretPairs.push(`${secret}="YOUR_${secret}_HERE"`);
    } else {
      secretPairs.push(`${secret}="${value}"`);
    }
  }

  const command = `supabase functions secrets set ${secretPairs.join(' ')}`;
  
  console.log('🔐 Supabase Functions Secrets Command:');
  console.log('');
  console.log(command);
  console.log('');
  
  if (missing.length > 0) {
    console.log('⚠️  Missing environment variables:');
    missing.forEach(key => console.log(`   - ${key}`));
    console.log('');
    console.log('💡 Please set these values in your environment or replace the placeholder values above.');
  } else {
    console.log('✅ All required environment variables found!');
  }
  
  return command;
}

if (import.meta.main) {
  generateSecretsCommand();
}

export { generateSecretsCommand };
