import { useState, useCallback } from 'react';
import { DocumentSnapshot } from 'firebase/firestore';

export const PAGE_SIZE = 20;

export interface PaginationResult {
  /** The last document of the current page — pass to updatePage() after each fetch */
  lastDoc: DocumentSnapshot | null;
  /** Whether there is a next page — determined by fetching PAGE_SIZE + 1 */
  hasNextPage: boolean;
}

export interface UsePaginationReturn {
  /**
   * Cursor to pass to the current Firestore query via startAfter().
   * null means "start from the beginning" (page 1).
   */
  currentCursor: DocumentSnapshot | null;
  /** 1-indexed page number for display */
  pageNumber: number;
  canGoNext: boolean;
  canGoPrev: boolean;
  /**
   * Call this after every successful fetch with the last doc of the page
   * and whether a next page exists. Replaces raw setLastDoc + setHasNextPage.
   */
  updatePage: (result: PaginationResult) => void;
  /** Advance to the next page. No-op if no next page or last doc is missing. */
  goNext: () => void;
  /** Go back to the previous page. No-op on page 1. */
  goPrev: () => void;
  /**
   * Reset to page 1. Call whenever filters or sort order change so the
   * existing cursor stack is not applied to a different query shape.
   */
  reset: () => void;
}

export function usePagination(): UsePaginationReturn {
  /**
   * Cursor stack — each entry is the last DocumentSnapshot of that page.
   *
   * stack = []          → page 1, no startAfter cursor
   * stack = [d20]       → page 2, startAfter(d20)
   * stack = [d20, d40]  → page 3, startAfter(d40)
   *
   * goNext pushes the current page's lastDoc.
   * goPrev pops the top entry, moving back one page.
   */
  const [cursorStack, setCursorStack] = useState<DocumentSnapshot[]>([]);

  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);

  const currentCursor = cursorStack.at(-1) ?? null;
  const pageNumber = cursorStack.length + 1;
  const canGoPrev = cursorStack.length > 0;
  const canGoNext = hasNextPage && lastDoc !== null;

  /**
   * Normalizes inputs before storing:
   * - lastDoc is always null or a valid snapshot (never undefined)
   * - hasNextPage can only be true when lastDoc is non-null — prevents the
   *   impossible state where the UI shows "Next" but there's no cursor to use
   */
  const updatePage = useCallback(({ lastDoc: doc, hasNextPage: next }: PaginationResult) => {
    const safeDoc = doc ?? null;
    setLastDoc(safeDoc);
    // hasNextPage is only meaningful when we have a cursor to advance with
    setHasNextPage(Boolean(safeDoc) && Boolean(next));
  }, []);

  /**
   * All safety checks are performed inside setCursorStack's updater function
   * so they run against the latest state even under rapid successive calls.
   * No non-null assertions — lastDoc is read from the closure and re-validated
   * inside the updater before being pushed.
   */
  const goNext = useCallback(() => {
    // Capture both values synchronously at call time.
    // Passing them into the updater makes the check self-contained —
    // the updater no longer reads from the outer closure, eliminating
    // the stale-closure risk under React concurrent rendering.
    const docAtCallTime = lastDoc;
    const hasNextAtCallTime = hasNextPage;
    setCursorStack((prev) => {
      if (!docAtCallTime || !hasNextAtCallTime) return prev;
      const alreadyPushed = prev.at(-1)?.id === docAtCallTime.id;
      return alreadyPushed ? prev : [...prev, docAtCallTime];
    });
  }, [lastDoc, hasNextPage]);

  /**
   * goPrev clears lastDoc and hasNextPage so the UI doesn't show stale
   * "Next" availability while the previous page re-fetches.
   * TanStack Query's placeholderData keeps the previous page visible,
   * so clearing these values does not cause a visible flicker.
   */
  const goPrev = useCallback(() => {
    if (!canGoPrev) return;
    setCursorStack((prev) => prev.slice(0, -1));
    setLastDoc(null);
    setHasNextPage(false);
  }, [canGoPrev]);

  const reset = useCallback(() => {
    setCursorStack([]);
    setLastDoc(null);
    setHasNextPage(false);
  }, []);

  return {
    currentCursor,
    pageNumber,
    canGoNext,
    canGoPrev,
    updatePage,
    goNext,
    goPrev,
    reset,
  };
}
