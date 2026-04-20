/**
 * Resolves a stored character offset back to a valid position in potentially-edited text.
 *
 * Strategy (in order):
 *   1. Verify the stored index still has matching context → return it unchanged.
 *   2. Search the whole text for (contextBefore + contextAfter) → return that split point.
 *   3. Search for just contextBefore (last occurrence) → return end of that occurrence.
 *   4. Fall back to the raw stored index, clamped to text length.
 *
 * @param charIndex      Stored offset (from when the marker was saved).
 * @param contextBefore  Text immediately before charIndex at save time (up to 30 chars).
 * @param contextAfter   Text immediately after charIndex at save time (up to 30 chars).
 * @param currentText    Current body text (may differ due to user edits).
 */
export function resolvePlaceMarkerPosition(
  charIndex: number,
  contextBefore: string,
  contextAfter: string,
  currentText: string
): number {
  if (!currentText) return 0;

  // 1. Check exact position still matches
  if (contextBefore.length > 0 || contextAfter.length > 0) {
    const actualBefore = currentText.slice(
      Math.max(0, charIndex - contextBefore.length),
      charIndex
    );
    const actualAfter = currentText.slice(
      charIndex,
      charIndex + contextAfter.length
    );
    if (actualBefore.endsWith(contextBefore) && actualAfter.startsWith(contextAfter)) {
      return charIndex;
    }

    // 2. Search for combined context string
    const combined = contextBefore + contextAfter;
    if (combined.length > 0) {
      const idx = currentText.indexOf(combined);
      if (idx !== -1) {
        return idx + contextBefore.length;
      }
    }

    // 3. Search for just contextBefore (take last occurrence so we land at the end)
    if (contextBefore.length > 5) {
      const beforeIdx = currentText.lastIndexOf(contextBefore);
      if (beforeIdx !== -1) {
        return beforeIdx + contextBefore.length;
      }
    }
  }

  // 4. Clamp to current text length
  return Math.min(charIndex, currentText.length);
}

/**
 * Extracts the context snippets around a cursor position in text.
 * Returns up to `length` characters on each side.
 */
export function extractPlaceMarkerContext(
  text: string,
  charIndex: number,
  length = 30
): { contextBefore: string; contextAfter: string } {
  const contextBefore = text.slice(Math.max(0, charIndex - length), charIndex);
  const contextAfter = text.slice(charIndex, charIndex + length);
  return { contextBefore, contextAfter };
}
