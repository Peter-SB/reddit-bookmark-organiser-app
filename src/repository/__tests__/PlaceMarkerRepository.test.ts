import { PlaceMarkerRepository } from '../PlaceMarkerRepository';

describe('PlaceMarkerRepository', () => {
  let repo: PlaceMarkerRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      runAsync: jest.fn(),
      getAllAsync: jest.fn(),
      getFirstAsync: jest.fn(),
    };
    repo = new (PlaceMarkerRepository as any)(mockDb);
  });

  // ---------------------------------------------------------------------------
  // setPlaceMarker
  // ---------------------------------------------------------------------------
  describe('setPlaceMarker', () => {
    it('should call runAsync with an UPSERT statement', async () => {
      mockDb.runAsync.mockResolvedValue({});

      await repo.setPlaceMarker(1, 42, 'before text', 'after text');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO place_markers'),
        1,
        42,
        'before text',
        'after text'
      );
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT(post_id) DO UPDATE'),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it('should pass through empty context strings', async () => {
      mockDb.runAsync.mockResolvedValue({});

      await repo.setPlaceMarker(5, 0, '', '');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        5,
        0,
        '',
        ''
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getPlaceMarker
  // ---------------------------------------------------------------------------
  describe('getPlaceMarker', () => {
    it('should return a PlaceMarker when a row exists', async () => {
      const mockRow = {
        id: 1,
        post_id: 10,
        char_index: 100,
        context_before: 'some before',
        context_after: 'some after',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };
      mockDb.getFirstAsync.mockResolvedValue(mockRow);

      const result = await repo.getPlaceMarker(10);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.postId).toBe(10);
      expect(result!.charIndex).toBe(100);
      expect(result!.contextBefore).toBe('some before');
      expect(result!.contextAfter).toBe('some after');
      expect(result!.createdAt).toBeInstanceOf(Date);
      expect(result!.updatedAt).toBeInstanceOf(Date);
    });

    it('should return null when no marker exists for a post', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const result = await repo.getPlaceMarker(999);

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getAllPlaceMarkers
  // ---------------------------------------------------------------------------
  describe('getAllPlaceMarkers', () => {
    it('should return markers sorted by updated_at descending', async () => {
      const mockRows = [
        {
          id: 2,
          post_id: 2,
          char_index: 50,
          context_before: 'b2',
          context_after: 'a2',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-03T00:00:00Z',
        },
        {
          id: 1,
          post_id: 1,
          char_index: 25,
          context_before: 'b1',
          context_after: 'a1',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
      ];
      mockDb.getAllAsync.mockResolvedValue(mockRows);

      const results = await repo.getAllPlaceMarkers();

      expect(results).toHaveLength(2);
      expect(results[0].postId).toBe(2);
      expect(results[1].postId).toBe(1);
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY updated_at DESC')
      );
    });

    it('should return an empty array when no markers exist', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const results = await repo.getAllPlaceMarkers();

      expect(results).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // consumePlaceMarker
  // ---------------------------------------------------------------------------
  describe('consumePlaceMarker', () => {
    it('should return the marker and then delete it', async () => {
      const mockRow = {
        id: 1,
        post_id: 3,
        char_index: 200,
        context_before: 'ctx before',
        context_after: 'ctx after',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };
      mockDb.getFirstAsync.mockResolvedValue(mockRow);
      mockDb.runAsync.mockResolvedValue({});

      const result = await repo.consumePlaceMarker(3);

      expect(result).not.toBeNull();
      expect(result!.charIndex).toBe(200);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM place_markers'),
        3
      );
    });

    it('should return null when no marker exists', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const result = await repo.consumePlaceMarker(999);

      expect(result).toBeNull();
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // deletePlaceMarker
  // ---------------------------------------------------------------------------
  describe('deletePlaceMarker', () => {
    it('should execute a DELETE statement for the given post_id', async () => {
      mockDb.runAsync.mockResolvedValue({});

      await repo.deletePlaceMarker(7);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM place_markers WHERE post_id = ?'),
        7
      );
    });
  });
});
