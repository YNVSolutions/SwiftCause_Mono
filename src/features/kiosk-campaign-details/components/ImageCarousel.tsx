import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ImageCarouselProps } from '../types';

const AUTO_ROTATE_INTERVAL = 5000; // 5 seconds

export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  images,
  currentIndex,
  onIndexChange,
  fallbackImage = '/campaign-fallback.svg',
  accentColorHex,
}) => {
  const accentColor =
    typeof accentColorHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(accentColorHex.trim())
      ? accentColorHex.trim().toUpperCase()
      : '#0E8F5A';
  const allImages = images.length > 0 ? images : [fallbackImage];
  const hasMultipleImages = allImages.length > 1;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Ensure index is within bounds
  const safeIndex = Math.max(0, Math.min(currentIndex, allImages.length - 1));
  const currentImage = allImages[safeIndex] || fallbackImage;

  // Auto-rotate effect
  useEffect(() => {
    if (!hasMultipleImages) return;

    intervalRef.current = setInterval(() => {
      const nextIndex = safeIndex === allImages.length - 1 ? 0 : safeIndex + 1;
      onIndexChange(nextIndex);
    }, AUTO_ROTATE_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [hasMultipleImages, safeIndex, allImages.length, onIndexChange]);

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newIndex = safeIndex === 0 ? allImages.length - 1 : safeIndex - 1;
    onIndexChange(newIndex);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newIndex = safeIndex === allImages.length - 1 ? 0 : safeIndex + 1;
    onIndexChange(newIndex);
  };

  const handleDotClick = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    onIndexChange(index);
  };

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-gray-100/50">
      {/* Main Image - key forces re-render on index change */}
      <img
        key={`carousel-image-${safeIndex}`}
        src={currentImage}
        alt={`Campaign image ${safeIndex + 1}`}
        className="w-full h-full object-cover object-center"
      />

      {/* Subtle bottom gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/8 to-transparent pointer-events-none" />

      {/* Navigation Arrows */}
      {hasMultipleImages && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-colors z-10 border border-[rgba(15,23,42,0.08)]"
          >
            <ChevronLeft className="w-6 h-6" style={{ color: accentColor }} />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-colors z-10 border border-[rgba(15,23,42,0.08)]"
          >
            <ChevronRight className="w-6 h-6" style={{ color: accentColor }} />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {hasMultipleImages && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {allImages.map((_, index) => (
            <button
              type="button"
              key={index}
              onClick={(e) => handleDotClick(e, index)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                index === safeIndex ? 'bg-gray-200' : 'bg-gray-200'
              }`}
              style={index === safeIndex ? { backgroundColor: accentColor } : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
};
