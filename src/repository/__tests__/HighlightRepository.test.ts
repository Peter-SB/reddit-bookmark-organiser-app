import { HighlightRepository } from '../HighlightRepository';

describe('HighlightRepository', () => {
  let repo: HighlightRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      runAsync: jest.fn(),
      getAllAsync: jest.fn(),
      getFirstAsync: jest.fn(),
    };
    repo = new (HighlightRepository as any)(mockDb);
  });

  describe('createHighlight', () => {
    it('should create a highlight with all fields', async () => {
      // Arrange
      const postId = 1;
      const payload = {
        text: 'This is a highlight',
        note: 'My note',
        startOffset: 10,
        endOffset: 30,
      };
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 42 });

      // Act
      const id = await repo.createHighlight(postId, payload);

      // Assert
      expect(id).toBe(42);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO highlights'),
        postId,
        payload.text,
        payload.note,
        payload.startOffset,
        payload.endOffset
      );
    });

    it('should create a highlight with minimal fields', async () => {
      // Arrange
      const postId = 1;
      const payload = { text: 'Simple highlight' };
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 43 });

      // Act
      const id = await repo.createHighlight(postId, payload);

      // Assert
      expect(id).toBe(43);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO highlights'),
        postId,
        payload.text,
        null,
        null,
        null
      );
    });
  });

  describe('getHighlightsByPostId', () => {
    it('should return highlights for a post', async () => {
      // Arrange
      const postId = 1;
      const mockRows = [
        {
          id: 1,
          post_id: postId,
          text: 'Highlight 1',
          note: 'Note 1',
          start_offset: 0,
          end_offset: 10,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          is_deleted: 0,
        },
        {
          id: 2,
          post_id: postId,
          text: 'Highlight 2',
          note: null,
          start_offset: null,
          end_offset: null,
          created_at: '2025-01-02T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
          is_deleted: 0,
        },
      ];
      mockDb.getAllAsync.mockResolvedValue(mockRows);

      // Act
      const highlights = await repo.getHighlightsByPostId(postId);

      // Assert
      expect(highlights).toHaveLength(2);
      expect(highlights[0].text).toBe('Highlight 1');
      expect(highlights[0].note).toBe('Note 1');
      expect(highlights[1].text).toBe('Highlight 2');
      expect(highlights[1].note).toBeUndefined();
    });

    it('should return empty array when no highlights exist', async () => {
      // Arrange
      mockDb.getAllAsync.mockResolvedValue([]);

      // Act
      const highlights = await repo.getHighlightsByPostId(999);

      // Assert
      expect(highlights).toHaveLength(0);
    });
  });

  describe('getAllHighlights', () => {
    it('should return all non-deleted highlights', async () => {
      // Arrange
      const mockRows = [
        {
          id: 1,
          post_id: 1,
          text: 'Highlight from post 1',
          note: null,
          start_offset: null,
          end_offset: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          is_deleted: 0,
        },
        {
          id: 2,
          post_id: 2,
          text: 'Highlight from post 2',
          note: null,
          start_offset: null,
          end_offset: null,
          created_at: '2025-01-02T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
          is_deleted: 0,
        },
      ];
      mockDb.getAllAsync.mockResolvedValue(mockRows);

      // Act
      const highlights = await repo.getAllHighlights();

      // Assert
      expect(highlights).toHaveLength(2);
      expect(highlights[0].postId).toBe(1);
      expect(highlights[1].postId).toBe(2);
    });
  });

  describe('updateHighlight', () => {
    it('should update highlight text and note', async () => {
      // Arrange
      const highlightId = 1;
      const existingHighlight = {
        id: highlightId,
        postId: 1,
        text: 'Old text',
        note: 'Old note',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
        isDeleted: false,
      };
      mockDb.getFirstAsync.mockResolvedValue({
        id: existingHighlight.id,
        post_id: existingHighlight.postId,
        text: existingHighlight.text,
        note: existingHighlight.note,
        start_offset: null,
        end_offset: null,
        created_at: existingHighlight.createdAt.toISOString(),
        updated_at: existingHighlight.updatedAt.toISOString(),
        is_deleted: 0,
      });
      mockDb.runAsync.mockResolvedValue({});

      // Act
      await repo.updateHighlight(highlightId, {
        text: 'New text',
        note: 'New note',
      });

      // Assert
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE highlights'),
        'New text',
        'New note',
        null,
        null,
        highlightId
      );
    });
  });

  describe('deleteHighlight', () => {
    it('should soft delete a highlight', async () => {
      // Arrange
      const highlightId = 1;
      mockDb.runAsync.mockResolvedValue({});

      // Act
      await repo.deleteHighlight(highlightId);

      // Assert
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE highlights'),
        highlightId
      );
    });
  });
});
