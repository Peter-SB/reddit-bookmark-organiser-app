import {
  extractPlaceMarkerContext,
  resolvePlaceMarkerPosition,
} from '../placeMarkerUtils';

// ---------------------------------------------------------------------------
// extractPlaceMarkerContext
// ---------------------------------------------------------------------------
describe('extractPlaceMarkerContext', () => {
  it('extracts full context when far from edges', () => {
    const text = 'Hello world this is a test string for context extraction';
    const pos = 11; // after "Hello world"
    const { contextBefore, contextAfter } = extractPlaceMarkerContext(text, pos, 5);
    expect(contextBefore).toBe('world');
    expect(contextAfter).toBe(' this');
  });

  it('handles position at the start of text', () => {
    const text = 'Hello world';
    const { contextBefore, contextAfter } = extractPlaceMarkerContext(text, 0, 5);
    expect(contextBefore).toBe('');
    expect(contextAfter).toBe('Hello');
  });

  it('handles position at the end of text', () => {
    const text = 'Hello world';
    const { contextBefore, contextAfter } = extractPlaceMarkerContext(text, text.length, 5);
    expect(contextBefore).toBe('world');
    expect(contextAfter).toBe('');
  });

  it('uses default length of 30', () => {
    const text = 'A'.repeat(100);
    const { contextBefore, contextAfter } = extractPlaceMarkerContext(text, 50);
    expect(contextBefore).toHaveLength(30);
    expect(contextAfter).toHaveLength(30);
  });
});

// ---------------------------------------------------------------------------
// resolvePlaceMarkerPosition
// ---------------------------------------------------------------------------
describe('resolvePlaceMarkerPosition', () => {
  describe('exact match (no edits)', () => {
    it('returns the stored charIndex when context still matches', () => {
      const text = 'Hello world this is a test string';
      const charIndex = 11; // after "Hello world"
      const contextBefore = 'world';
      const contextAfter = ' this';

      const result = resolvePlaceMarkerPosition(charIndex, contextBefore, contextAfter, text);
      expect(result).toBe(11);
    });
  });

  describe('text inserted before marker', () => {
    it('finds the correct position when text is inserted before the marker', () => {
      const originalText = 'Hello world this is a test';
      const charIndex = 11; // after "Hello world"
      const contextBefore = 'world';
      const contextAfter = ' this';

      // Insert "foo " at position 0, shifting everything by 4
      const modifiedText = 'foo Hello world this is a test';

      const result = resolvePlaceMarkerPosition(charIndex, contextBefore, contextAfter, modifiedText);
      // "world" ends at position 15, " this" starts there → resolved = 15
      expect(result).toBe(15);
    });
  });

  describe('text inserted after marker', () => {
    it('returns the stored charIndex when text is inserted only after the marker', () => {
      const text = 'Hello world INSERTED TEXT this is a test';
      const charIndex = 11; // after "Hello world"
      const contextBefore = 'world';
      const contextAfter = ' this'; // no longer directly after; combined search needed

      const result = resolvePlaceMarkerPosition(charIndex, contextBefore, contextAfter, text);
      // Combined "world this" not found; falls back to contextBefore "world" last occurrence
      // "world" appears at index 6, so resolved = 6 + 5 = 11
      expect(result).toBe(11);
    });
  });

  describe('text deleted around marker', () => {
    it('falls back to contextBefore search when combined context is broken', () => {
      // Original: "prefix marker_before|marker_after suffix"
      // Delete "marker_after" — combined no longer present but before still exists
      const text = 'The quick brown fox jumped over the lazy dog';
      const charIndex = 19; // after "The quick brown fox"
      const contextBefore = 'n fox';
      const contextAfter = ' jump';

      const result = resolvePlaceMarkerPosition(charIndex, contextBefore, contextAfter, text);
      expect(result).toBe(19);
    });
  });

  describe('context completely gone', () => {
    it('clamps to text length when stored index is out of range', () => {
      const text = 'Short';
      const result = resolvePlaceMarkerPosition(1000, 'gone', 'also gone', text);
      expect(result).toBe(text.length);
    });

    it('returns 0 for empty text', () => {
      const result = resolvePlaceMarkerPosition(50, 'before', 'after', '');
      expect(result).toBe(0);
    });
  });

  describe('no context snippets stored', () => {
    it('clamps stored charIndex to text length when no context', () => {
      const text = 'Hello';
      const result = resolvePlaceMarkerPosition(3, '', '', text);
      // With empty context, all match checks are skipped → clamped to min(3, 5)
      expect(result).toBe(3);
    });

    it('clamps if charIndex exceeds text length', () => {
      const text = 'Hi';
      const result = resolvePlaceMarkerPosition(100, '', '', text);
      expect(result).toBe(2);
    });
  });

  describe('identical repeated text', () => {
    it('uses combined context to disambiguate repeated patterns', () => {
      // "aaa|bbb aaa|bbb" → two split points; combined "aaabbb" is found at first occurrence
      const text = 'aaabbb aaabbb';
      const result = resolvePlaceMarkerPosition(3, 'aaa', 'bbb', text);
      // combined "aaabbb" found at idx 0 → ctx before length 3 → returns 3
      expect(result).toBe(3);
    });
  });
});
