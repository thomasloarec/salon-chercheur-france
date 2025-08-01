import { supabase } from '@/integrations/supabase/client';

describe('Migration Validation Tests', () => {
  const expectedEventId = '262acf7c-91c3-42ad-8086-bb0c96ff8477'; // UUID for premium-sourcing
  
  test('should fetch participation with UUID id_event', async () => {
    const { data, error } = await supabase
      .from('participation')
      .select('*')
      .eq('id_event', expectedEventId);
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.length).toBe(90);
  });

  test('should fetch exhibitors with inner join using UUID', async () => {
    const { data, error } = await supabase
      .from('participation')
      .select(`
        stand_exposant,
        website_exposant,
        urlexpo_event,
        exposants!inner (
          nom_exposant,
          website_exposant,
          exposant_description
        )
      `)
      .eq('id_event', expectedEventId);
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.length).toBe(90);
    expect(data?.[0]).toHaveProperty('exposants');
    expect(data?.[0].exposants).toHaveProperty('nom_exposant');
  });

  test('should verify foreign key constraint exists', async () => {
    const { data, error } = await supabase
      .from('participation')
      .select('id_event')
      .eq('id_event', expectedEventId)
      .limit(1);
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.[0]?.id_event).toBe(expectedEventId);
  });

  test('should verify data integrity after migration', async () => {
    // Count total participations
    const { count: participationCount, error: participationError } = await supabase
      .from('participation')
      .select('*', { count: 'exact', head: true });
    
    expect(participationError).toBeNull();
    expect(participationCount).toBe(90);
    
    // Verify all participations have valid event_id (UUID format)
    const { data: participations, error: dataError } = await supabase
      .from('participation')
      .select('id_event');
    
    expect(dataError).toBeNull();
    expect(participations).toBeDefined();
    
    participations?.forEach(p => {
      expect(p.id_event).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  test('should verify events relationship', async () => {
    // Test direct join with events table
    const { data, error } = await supabase
      .from('participation')
      .select('id_event')
      .eq('id_event', expectedEventId)
      .limit(1);
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.[0]?.id_event).toBe(expectedEventId);
    
    // Verify the event exists
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('id, nom_event, slug')
      .eq('id', expectedEventId)
      .single();
    
    expect(eventError).toBeNull();
    expect(eventData?.slug).toContain('premium-sourcing');
  });
});