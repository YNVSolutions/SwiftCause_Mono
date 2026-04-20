import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Minus, Plus, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';
import { Slider } from './slider';

interface SquareImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  onConfirm: (file: File) => Promise<void> | void;
  title?: string;
  description?: string;
  aspectRatio?: number;
}

const CROP_SIZE_PX = 320;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const DEFAULT_ZOOM = 1;
const DEFAULT_OFFSET = { x: 0, y: 0 };
const WHEEL_ZOOM_SENSITIVITY = 0.0012;

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const loadImageElement = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = src;
  });
};

const buildCroppedFileName = (name: string): string => {
  const lastDotIndex = name.lastIndexOf('.');
  if (lastDotIndex <= 0) {
    return `${name}-cropped.png`;
  }
  const base = name.slice(0, lastDotIndex);
  const extension = name.slice(lastDotIndex);
  return `${base}-cropped${extension}`;
};

export function SquareImageCropDialog({
  open,
  onOpenChange,
  file,
  onConfirm,
  title = 'Adjust image',
  description = 'Drag and zoom to fit inside the square frame.',
  aspectRatio = 1,
}: SquareImageCropDialogProps) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [offset, setOffset] = useState(DEFAULT_OFFSET);
  const [isDragging, setIsDragging] = useState(false);
  const [imageNaturalSize, setImageNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const wheelDeltaRef = useRef(0);
  const wheelRafRef = useRef<number | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  const objectUrl = useMemo(() => {
    if (!file) {
      return null;
    }
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  useEffect(() => {
    return () => {
      if (wheelRafRef.current !== null) {
        cancelAnimationFrame(wheelRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open || !objectUrl) {
      return;
    }

    let isMounted = true;
    setZoom(DEFAULT_ZOOM);
    setOffset(DEFAULT_OFFSET);
    setImageNaturalSize(null);

    loadImageElement(objectUrl)
      .then((image) => {
        if (!isMounted) {
          return;
        }
        setImageNaturalSize({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setImageNaturalSize(null);
      });

    return () => {
      isMounted = false;
    };
  }, [open, objectUrl]);

  const { frameWidth, frameHeight } = useMemo(() => {
    if (aspectRatio >= 1) {
      return {
        frameWidth: CROP_SIZE_PX,
        frameHeight: Math.round(CROP_SIZE_PX / aspectRatio),
      };
    }
    return {
      frameWidth: Math.round(CROP_SIZE_PX * aspectRatio),
      frameHeight: CROP_SIZE_PX,
    };
  }, [aspectRatio]);
  const stageWidth = Math.max(frameWidth + 120, 360);
  const stageHeight = Math.max(frameHeight + 120, 260);

  const baseScale = useMemo(() => {
    if (!imageNaturalSize) {
      return 1;
    }
    return Math.max(frameWidth / imageNaturalSize.width, frameHeight / imageNaturalSize.height);
  }, [frameHeight, frameWidth, imageNaturalSize]);

  const baseDisplayWidth = (imageNaturalSize?.width ?? frameWidth) * baseScale;
  const baseDisplayHeight = (imageNaturalSize?.height ?? frameHeight) * baseScale;
  const zoomedDisplayWidth = baseDisplayWidth * zoom;
  const zoomedDisplayHeight = baseDisplayHeight * zoom;
  const maxOffsetX = Math.max(0, (zoomedDisplayWidth - frameWidth) / 2);
  const maxOffsetY = Math.max(0, (zoomedDisplayHeight - frameHeight) / 2);

  const getMaxOffsetsForZoom = (zoomLevel: number) => {
    const widthAtZoom = baseDisplayWidth * zoomLevel;
    const heightAtZoom = baseDisplayHeight * zoomLevel;
    return {
      maxX: Math.max(0, (widthAtZoom - frameWidth) / 2),
      maxY: Math.max(0, (heightAtZoom - frameHeight) / 2),
    };
  };

  const clampOffsetForZoom = (nextOffset: { x: number; y: number }, zoomLevel: number) => {
    const { maxX, maxY } = getMaxOffsetsForZoom(zoomLevel);
    return {
      x: clamp(nextOffset.x, -maxX, maxX),
      y: clamp(nextOffset.y, -maxY, maxY),
    };
  };

  const setZoomUniform = (nextZoomOrUpdater: number | ((previous: number) => number)) => {
    setZoom((previousZoom) => {
      const requestedZoom =
        typeof nextZoomOrUpdater === 'function'
          ? nextZoomOrUpdater(previousZoom)
          : nextZoomOrUpdater;
      const nextZoom = clamp(requestedZoom, MIN_ZOOM, MAX_ZOOM);
      if (nextZoom === previousZoom) {
        return previousZoom;
      }

      const zoomRatio = nextZoom / previousZoom;
      setOffset((previousOffset) => {
        const scaledOffset = {
          x: previousOffset.x * zoomRatio,
          y: previousOffset.y * zoomRatio,
        };
        return clampOffsetForZoom(scaledOffset, nextZoom);
      });

      return nextZoom;
    });
  };

  useEffect(() => {
    setOffset((previous) => ({
      x: clamp(previous.x, -maxOffsetX, maxOffsetX),
      y: clamp(previous.y, -maxOffsetY, maxOffsetY),
    }));
  }, [maxOffsetX, maxOffsetY]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!imageNaturalSize) {
      return;
    }
    setIsDragging(true);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const nextOffsetX = dragState.startOffsetX + (event.clientX - dragState.startX);
    const nextOffsetY = dragState.startOffsetY + (event.clientY - dragState.startY);

    setOffset({
      x: clamp(nextOffsetX, -maxOffsetX, maxOffsetX),
      y: clamp(nextOffsetY, -maxOffsetY, maxOffsetY),
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    setIsDragging(false);
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheelZoom = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    wheelDeltaRef.current += -event.deltaY * WHEEL_ZOOM_SENSITIVITY;

    if (wheelRafRef.current !== null) {
      return;
    }

    wheelRafRef.current = requestAnimationFrame(() => {
      const delta = wheelDeltaRef.current;
      wheelDeltaRef.current = 0;
      wheelRafRef.current = null;
      setZoomUniform((previous) => previous + delta);
    });
  };

  const handleResetPosition = () => {
    setZoom(DEFAULT_ZOOM);
    setOffset(DEFAULT_OFFSET);
  };

  const handleSave = async () => {
    if (!file || !objectUrl || !imageNaturalSize) {
      return;
    }

    setIsSaving(true);
    try {
      const sourceImage = await loadImageElement(objectUrl);
      const sourceRatioX = sourceImage.naturalWidth / zoomedDisplayWidth;
      const sourceRatioY = sourceImage.naturalHeight / zoomedDisplayHeight;
      const sourceCropX = (zoomedDisplayWidth / 2 - frameWidth / 2 - offset.x) * sourceRatioX;
      const sourceCropY = (zoomedDisplayHeight / 2 - frameHeight / 2 - offset.y) * sourceRatioY;
      const sourceCropWidth = frameWidth * sourceRatioX;
      const sourceCropHeight = frameHeight * sourceRatioY;
      const largestSourceCropEdge = Math.max(sourceCropWidth, sourceCropHeight);
      const largestOutputEdge = Math.max(256, Math.min(2048, Math.round(largestSourceCropEdge)));
      const outputWidth = Math.max(
        1,
        Math.round((sourceCropWidth / largestSourceCropEdge) * largestOutputEdge),
      );
      const outputHeight = Math.max(
        1,
        Math.round((sourceCropHeight / largestSourceCropEdge) * largestOutputEdge),
      );

      const canvas = document.createElement('canvas');
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Unable to crop image.');
      }

      context.drawImage(
        sourceImage,
        sourceCropX,
        sourceCropY,
        sourceCropWidth,
        sourceCropHeight,
        0,
        0,
        outputWidth,
        outputHeight,
      );

      const outputType =
        file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/jpeg'
          ? file.type
          : 'image/png';

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((canvasBlob) => {
          if (canvasBlob) {
            resolve(canvasBlob);
          } else {
            reject(new Error('Failed to generate cropped image.'));
          }
        }, outputType);
      });

      const croppedFile = new File([blob], buildCroppedFileName(file.name), { type: outputType });
      await onConfirm(croppedFile);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-center rounded-md bg-slate-100 p-4">
            <div
              className="relative touch-none overflow-hidden rounded-md border border-slate-300 bg-slate-900/90"
              style={{ width: `${stageWidth}px`, height: `${stageHeight}px` }}
              onWheel={handleWheelZoom}
            >
              {objectUrl ? (
                <img
                  src={objectUrl}
                  alt="Image crop preview"
                  draggable={false}
                  className="pointer-events-none absolute select-none"
                  style={{
                    width: `${baseDisplayWidth}px`,
                    height: `${baseDisplayHeight}px`,
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 120ms ease-out',
                    willChange: 'transform',
                  }}
                />
              ) : null}

              <div
                className={`absolute left-1/2 top-1/2 z-20 rounded-md ${
                  isDragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
                style={{
                  width: `${frameWidth}px`,
                  height: `${frameHeight}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />

              <div
                className="pointer-events-none absolute left-1/2 top-1/2 z-30 rounded-md border border-white/80"
                style={{
                  width: `${frameWidth}px`,
                  height: `${frameHeight}px`,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.52)',
                }}
              >
                <div className="absolute inset-y-0 left-1/3 border-l border-white/70" />
                <div className="absolute inset-y-0 left-2/3 border-l border-white/70" />
                <div className="absolute inset-x-0 top-1/3 border-t border-white/70" />
                <div className="absolute inset-x-0 top-2/3 border-t border-white/70" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <LabelText>Zoom</LabelText>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetPosition}
              disabled={!imageNaturalSize}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setZoomUniform((previous) => previous - 0.1)}
              disabled={zoom <= MIN_ZOOM}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Slider
              value={[zoom]}
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              onValueChange={(value) => setZoomUniform(value[0] ?? DEFAULT_ZOOM)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setZoomUniform((previous) => previous + 0.1)}
              disabled={zoom >= MAX_ZOOM}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <span className="w-12 text-right text-xs font-medium text-slate-600">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Drag to reposition. Use mouse wheel or zoom controls to scale.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!imageNaturalSize || isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LabelText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-slate-700">{children}</p>;
}
