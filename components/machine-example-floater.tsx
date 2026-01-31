"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ExampleImage = {
  src: string;
  alt?: string;
  label?: string;
};

type MachineExampleFloaterProps = {
  title: string;
  images: ExampleImage[];
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

export default function MachineExampleFloater({ title, images }: MachineExampleFloaterProps) {
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"grid" | "lightbox">("grid");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP)), []);

  if (!images.length) return null;

  const firstImage = images[0];
  const currentImage = images[selectedIndex];

  const openModal = () => {
    setOpen(true);
    setViewMode("grid");
    setSelectedIndex(0);
  };

  const openLightbox = (index: number) => {
    setSelectedIndex(index);
    setViewMode("lightbox");
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Zoom toward cursor (Figma-style)
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (viewMode !== "lightbox" || !containerRef.current) return;
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const contentX = (cursorX - pan.x) / zoom;
      const contentY = (cursorY - pan.y) / zoom;
      const delta = -e.deltaY * 0.002;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta));
      setZoom(newZoom);
      setPan({
        x: cursorX - contentX * newZoom,
        y: cursorY - contentY * newZoom,
      });
    },
    [viewMode, zoom, pan]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    },
    [pan]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStart.current) return;
      setPan({
        x: dragStart.current.panX + (e.clientX - dragStart.current.x),
        y: dragStart.current.panY + (e.clientY - dragStart.current.y),
      });
    },
    []
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
    dragStart.current = null;
  }, []);

  // Non-passive wheel listener so preventDefault works for zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el || viewMode !== "lightbox") return;
    const onWheel = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [viewMode]);

  const closeModal = () => {
    setOpen(false);
    setViewMode("grid");
  };

  const goPrev = () => {
    setSelectedIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  };

  const goNext = () => {
    setSelectedIndex((i) => (i === images.length - 1 ? 0 : i + 1));
  };

  return (
    <>
      {/* Floating bar at bottom */}
      <button
        type="button"
        onClick={openModal}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-3 pr-3  bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors shadow-sm border border-blue-700"
        aria-label={title}
      >
        <span className="relative w-12 h-12 rounded-full overflow-hidden border border-white/40 shrink-0 bg-white/10">
          <Image
            src={firstImage.src}
            alt={firstImage.alt ?? title}
            fill
            className="object-cover"
            sizes="70px"
          />
        </span>
        <span className="text-sm font-medium pr-1">{title}</span>
      </button>

      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && closeModal()}>
        <DialogContent
          className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-gray-200"
          onPointerDownOutside={closeModal}
          onEscapeKeyDown={closeModal}
        >
          <div className="flex items-center px-4 py-3 border-b border-gray-200 shrink-0">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {title}
            </DialogTitle>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {images.map((img, index) => (
                  <button
                    key={img.src + index}
                    type="button"
                    onClick={() => openLightbox(index)}
                    className="relative aspect-[4/3] rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 transition-colors bg-gray-100"
                  >
                    <Image
                      src={img.src}
                      alt={img.alt ?? img.label ?? `Example ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                    />
                    {img.label && (
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-1.5 px-2 text-center">
                        {img.label}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Fixed viewport: no scroll, zoom controls and badge stay fixed */}
                <div
                  ref={containerRef}
                  className="relative w-full aspect-[4/3] max-h-[60vh] bg-gray-100 rounded-lg overflow-hidden border border-gray-200 select-none touch-none"
                  style={{ cursor: isDragging ? "grabbing" : "grab" }}
                  onWheel={handleWheel}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={() => { setIsDragging(false); dragStart.current = null; }}
                >
                  {/* Pannable/zoomable content */}
                  <div
                    className="absolute inset-0 origin-top-left"
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transformOrigin: "0 0",
                    }}
                  >
                    <div className="relative w-full h-full min-h-[280px]">
                      <Image
                        src={currentImage.src}
                        alt={currentImage.alt ?? currentImage.label ?? `Example ${selectedIndex + 1}`}
                        fill
                        className="object-contain pointer-events-none"
                        sizes="(max-width: 896px) 100vw, 896px"
                        draggable={false}
                      />
                    </div>
                  </div>
                  {/* Example badge - right bottom, fixed in viewport */}
                  <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs font-medium rounded pointer-events-none z-10">
                    Example
                  </span>
                  {/* Zoom controls - top right, fixed in viewport (no scroll) */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 z-20 pointer-events-auto">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); zoomOut(); }}
                      disabled={zoom <= MIN_ZOOM}
                      aria-label="Zoom out"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-medium text-gray-700 min-w-[2.5rem] text-center">
                      {Math.round(zoom * 100)}%
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); zoomIn(); }}
                      disabled={zoom >= MAX_ZOOM}
                      aria-label="Zoom in"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goPrev}
                    className="shrink-0"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    {selectedIndex + 1} of {images.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goNext}
                    className="shrink-0"
                    aria-label="Next image"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {images.map((img, index) => (
                    <button
                      key={img.src + index}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      className={`relative w-14 h-14 rounded overflow-hidden border-2 transition-colors shrink-0 ${
                        index === selectedIndex
                          ? "border-blue-600"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <Image
                        src={img.src}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </button>
                  ))}
                </div>
                <div className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="text-gray-600"
                  >
                    Back to all examples
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
