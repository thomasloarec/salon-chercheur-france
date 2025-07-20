
import { AirtableClient } from '../airtableClient';

// Mock fetch globally
global.fetch = jest.fn();

describe('AirtableClient', () => {
  let client: AirtableClient;
  const mockConfig = {
    baseId: 'appTestBase',
    pat: 'test-pat-token',
    eventsTableName: 'All_Events',
    exhibitorsTableName: 'All_Exposants',
    participationTableName: 'Participation'
  };

  beforeEach(() => {
    client = new AirtableClient(mockConfig);
    (fetch as jest.Mock).mockClear();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('listRecords', () => {
    it('should fetch records successfully', async () => {
      const mockResponse = {
        records: [
          { id: 'rec1', fields: { name: 'Event 1' } },
          { id: 'rec2', fields: { name: 'Event 2' } }
        ]
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const promise = client.listRecords('All_Events');
      
      // Fast-forward past the throttle delay
      jest.advanceTimersByTime(200);
      
      const result = await promise;

      expect(fetch).toHaveBeenCalledWith(
        'https://api.airtable.com/v0/appTestBase/All_Events',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-pat-token',
            'Content-Type': 'application/json'
          })
        })
      );

      expect(result).toEqual({
        records: mockResponse.records,
        offset: undefined
      });
    });

    it('should handle API errors', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' })
      });

      const promise = client.listRecords('All_Events');
      jest.advanceTimersByTime(200);

      await expect(promise).rejects.toThrow('Airtable API error (401): Unauthorized');
    });

    it('should handle pagination parameters', async () => {
      const mockResponse = { records: [], offset: 'nextOffset' };
      
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const promise = client.listRecords('All_Events', {
        maxRecords: 50,
        offset: 'startOffset',
        filterByFormula: '{status} = "active"'
      });
      
      jest.advanceTimersByTime(200);
      await promise;

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('maxRecords=50&offset=startOffset&filterByFormula=%7Bstatus%7D%20%3D%20%22active%22'),
        expect.any(Object)
      );
    });
  });

  describe('createRecords', () => {
    it('should create records in batches', async () => {
      const records = Array.from({ length: 25 }, (_, i) => ({ name: `Event ${i}` }));
      const mockResponse = {
        records: records.slice(0, 10).map((record, i) => ({ id: `rec${i}`, fields: record }))
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const promise = client.createRecords('All_Events', records, 10);
      
      // Fast-forward through all batch delays
      jest.advanceTimersByTime(200 * 3); // 3 batches * 200ms delay
      
      const result = await promise;

      expect(fetch).toHaveBeenCalledTimes(3); // 25 records / 10 per batch = 3 batches
      expect(result).toHaveLength(30); // 3 batches * 10 records per mock response
    });
  });

  describe('updateRecords', () => {
    it('should update records with PATCH method', async () => {
      const records = [
        { id: 'rec1', fields: { name: 'Updated Event 1' } },
        { id: 'rec2', fields: { name: 'Updated Event 2' } }
      ];

      const mockResponse = {
        records: records.map(record => ({ id: record.id, fields: record.fields }))
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const promise = client.updateRecords('All_Events', records);
      jest.advanceTimersByTime(200);
      
      const result = await promise;

      expect(fetch).toHaveBeenCalledWith(
        'https://api.airtable.com/v0/appTestBase/All_Events',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ records })
        })
      );

      expect(result).toEqual(mockResponse.records);
    });
  });

  describe('deleteRecords', () => {
    it('should delete records with proper query parameters', async () => {
      const recordIds = ['rec1', 'rec2', 'rec3'];
      const mockResponse = {
        records: recordIds.map(id => ({ deleted: true, id }))
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const promise = client.deleteRecords('All_Events', recordIds);
      jest.advanceTimersByTime(200);
      
      const result = await promise;

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('records%5B%5D=rec1&records%5B%5D=rec2&records%5B%5D=rec3'),
        expect.objectContaining({
          method: 'DELETE'
        })
      );

      expect(result).toEqual(mockResponse.records);
    });
  });

  describe('upsertRecords', () => {
    it('should create new records and update existing ones', async () => {
      const records = [
        { id_event: 'Event_1', name: 'New Event' },
        { id_event: 'Event_2', name: 'Existing Event' }
      ];

      // Mock findRecordByUniqueField - first returns null, second returns existing record
      (fetch as jest.Mock)
        .mockResolvedValueOnce({ // First search - no match
          ok: true,
          json: async () => ({ records: [] })
        })
        .mockResolvedValueOnce({ // Second search - match found
          ok: true,
          json: async () => ({ records: [{ id: 'recExisting', fields: { id_event: 'Event_2' } }] })
        })
        .mockResolvedValueOnce({ // Create operation
          ok: true,
          json: async () => ({ records: [{ id: 'recNew', fields: records[0] }] })
        })
        .mockResolvedValueOnce({ // Update operation
          ok: true,
          json: async () => ({ records: [{ id: 'recExisting', fields: records[1] }] })
        });

      const promise = client.upsertRecords('All_Events', records, 'id_event');
      jest.advanceTimersByTime(200 * 4); // 4 API calls
      
      const result = await promise;

      expect(fetch).toHaveBeenCalledTimes(4);
      expect(result.created).toHaveLength(1);
      expect(result.updated).toHaveLength(1);
    });
  });

  describe('throttling', () => {
    it('should respect rate limiting with 200ms delay', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ records: [] })
      });

      const startTime = Date.now();
      
      const promise1 = client.listRecords('Table1');
      const promise2 = client.listRecords('Table2');
      
      jest.advanceTimersByTime(200);
      await promise1;
      
      jest.advanceTimersByTime(200);
      await promise2;

      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});
