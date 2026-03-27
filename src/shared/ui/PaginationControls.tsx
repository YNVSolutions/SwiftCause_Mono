import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

interface PaginationControlsProps {
  pageNumber: number; // 1-indexed, for display
  pageSize: number;
  totalOnPage: number; // how many rows are actually visible
  canGoNext: boolean;
  canGoPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
  loading?: boolean;
}

export function PaginationControls({
  pageNumber,
  pageSize,
  totalOnPage,
  canGoNext,
  canGoPrev,
  onNext,
  onPrev,
  loading = false,
}: PaginationControlsProps) {
  // Avoid invalid range like "Showing 1–0" when the page is empty
  const start = totalOnPage === 0 ? 0 : (pageNumber - 1) * pageSize + 1;
  const end = totalOnPage === 0 ? 0 : (pageNumber - 1) * pageSize + totalOnPage;

  // Guards against rapid clicks firing handlers while a fetch is in-flight
  const handleNext = () => {
    if (loading || !canGoNext) return;
    onNext();
  };

  const handlePrev = () => {
    if (loading || !canGoPrev) return;
    onPrev();
  };

  return (
    <div className="flex items-center justify-between px-1 py-3">
      <span className="text-sm text-muted-foreground">
        {totalOnPage === 0 ? 'No results' : `Showing ${start}–${end} items`}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrev}
          disabled={!canGoPrev || loading}
          aria-label="Go to previous page"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">Page {pageNumber}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={!canGoNext || loading}
          aria-label="Go to next page"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
