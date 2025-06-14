
import { matchExhibitorsWithCRM } from '../crmMatching';

// Mock Supabase
jest.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        data: [
          { name: 'Entreprise A', website: 'entreprise-a.com' },
          { name: 'Société B', website: 'societe-b.fr' },
          { name: 'Company C', website: 'company-c.net' }
        ],
        error: null
      }))
    }))
  }
}));

describe('matchExhibitorsWithCRM', () => {
  const mockExhibitors = [
    { name: 'Entreprise A', stand: 'A12', website: 'entreprise-a.com' },
    { name: 'Unknown Company', stand: 'B15', website: 'unknown.com' },
    { name: 'Société B', stand: 'C08' },
    { name: 'Random Corp', stand: 'D10' }
  ];

  it('should match exhibitors with CRM companies by name', async () => {
    const result = await matchExhibitorsWithCRM(mockExhibitors);
    
    expect(result.exhibitors).toHaveLength(4);
    expect(result.crmTargets).toHaveLength(2);
    expect(result.crmTargets.map(t => t.name)).toContain('Entreprise A');
    expect(result.crmTargets.map(t => t.name)).toContain('Société B');
  });

  it('should match exhibitors with CRM companies by website', async () => {
    const exhibitorsWithWebsite = [
      { name: 'Different Name', stand: 'A12', website: 'entreprise-a.com' }
    ];
    
    const result = await matchExhibitorsWithCRM(exhibitorsWithWebsite);
    
    expect(result.crmTargets).toHaveLength(1);
    expect(result.crmTargets[0].name).toBe('Different Name');
  });

  it('should return empty crmTargets when no matches found', async () => {
    const noMatchExhibitors = [
      { name: 'No Match Company', stand: 'A12', website: 'nomatch.com' }
    ];
    
    const result = await matchExhibitorsWithCRM(noMatchExhibitors);
    
    expect(result.exhibitors).toHaveLength(1);
    expect(result.crmTargets).toHaveLength(0);
  });
});
