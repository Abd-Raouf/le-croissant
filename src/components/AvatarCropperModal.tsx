"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

type AvatarCropperModalProps = {
  isOpen: boolean;
  file: File | null;
  onCancel: () => void;
  onCrop: (file: File) => void;
};

const cropSize = 280;
const outputSize = 512;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function AvatarCropperModal({
  isOpen,
  file,
  onCancel,
  onCrop,
}: AvatarCropperModalProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragState = useRef<{
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!previewUrl) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [previewUrl]);

  const displayScale = baseScale * zoom;

  const displaySize = useMemo(() => {
    const img = imageRef.current;
    if (!img) return { width: cropSize, height: cropSize };
    return {
      width: img.naturalWidth * displayScale,
      height: img.naturalHeight * displayScale,
    };
  }, [displayScale]);

  const clampOffset = (nextX: number, nextY: number) => {
    const minX = cropSize - displaySize.width;
    const minY = cropSize - displaySize.height;
    return {
      x: clamp(nextX, minX, 0),
      y: clamp(nextY, minY, 0),
    };
  };

  const handleImageLoad = () => {
    const img = imageRef.current;
    if (!img) return;
    const nextBaseScale = Math.max(
      cropSize / img.naturalWidth,
      cropSize / img.naturalHeight,
    );
    setBaseScale(nextBaseScale);
    const width = img.naturalWidth * nextBaseScale;
    const height = img.naturalHeight * nextBaseScale;
    setOffset({ x: (cropSize - width) / 2, y: (cropSize - height) / 2 });
  };

  useEffect(() => {
    setOffset((prev) => clampOffset(prev.x, prev.y));
  }, [displayScale, displaySize.width, displaySize.height]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!imageRef.current) return;
    dragState.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const deltaX = event.clientX - dragState.current.x;
    const deltaY = event.clientY - dragState.current.y;
    const next = clampOffset(
      dragState.current.offsetX + deltaX,
      dragState.current.offsetY + deltaY,
    );
    setOffset(next);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.current) {
      dragState.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
  };

  const handleCrop = async () => {
    const img = imageRef.current;
    if (!img || !file) return;

    const scale = baseScale * zoom;
    const srcWidth = cropSize / scale;
    const srcHeight = cropSize / scale;
    const rawX = -offset.x / scale;
    const rawY = -offset.y / scale;
    const maxX = Math.max(0, img.naturalWidth - srcWidth);
    const maxY = Math.max(0, img.naturalHeight - srcHeight);
    const srcX = clamp(rawX, 0, maxX);
    const srcY = clamp(rawY, 0, maxY);

    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      img,
      srcX,
      srcY,
      srcWidth,
      srcHeight,
      0,
      0,
      outputSize,
      outputSize,
    );

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/png", 0.92);
    });

    if (!blob) return;
    const croppedFile = new File(
      [blob],
      file.name.replace(/\.[^/.]+$/, "") + "-crop.png",
      { type: "image/png" },
    );
    onCrop(croppedFile);
  };

  if (!isOpen || !file || !previewUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6">
      <div className="w-full max-w-md rounded-lg bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--border-subtle)]">
          <div>
            <div className="text-sm font-semibold">Crop photo</div>
            <div className="text-xs text-[var(--text-muted)]">
              Drag to reposition and use the slider to zoom.
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded text-[var(--text-muted)] transition hover:bg-[var(--bg-hover-secondary)] hover:text-[var(--text-primary)]"
            aria-label="Close"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="px-4 py-4">
          <div
            className={`relative mx-auto h-[280px] w-[280px] overflow-hidden rounded border border-[var(--border-light)] bg-black touch-none ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <img
              ref={imageRef}
              src={previewUrl}
              alt="Crop preview"
              onLoad={handleImageLoad}
              className="absolute left-0 top-0 select-none"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${displayScale})`,
                transformOrigin: "top left",
              }}
              draggable={false}
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs text-[var(--text-muted)]">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-4 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-[var(--bg-hover-secondary)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCrop}
            className="rounded bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--accent-strong)]"
          >
            Crop and save
          </button>
        </div>
      </div>
    </div>
  );
}
