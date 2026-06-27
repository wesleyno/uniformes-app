import { useState, useRef, useCallback, useEffect } from "react";
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import JerseyPreview from "./jersey-preview";

interface JerseyImageModalProps {
  open: boolean;
  onClose: () => void;
  images: string[];
  jerseyName: string;
  description?: string | null;
  price?: string | null;
  themeColor?: string;
  previewNumber?: string;
  previewNickname?: string;
}

export default function JerseyImageModal({
  open,
  onClose,
  images,
  jerseyName,
  description,
  price,
  themeColor,
  previewNumber,
  previewNickname,
}: JerseyImageModalProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showPreview, setShowPreview] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef(0);
  const initialPinchDistRef = useRef(0);
  const initialPinchZoomRef = useRef(1);

  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setShowPreview(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setActiveIndex(i => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setActiveIndex(i => Math.min(images.length - 1, i + 1));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose, images.length]);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom(prev => {
      const next = Math.min(5, Math.max(1, prev + delta));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
      initialPinchZoomRef.current = zoom;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        if (zoom > 1) {
          resetZoom();
        } else {
          setZoom(2.5);
        }
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;
      if (zoom > 1) {
        setIsDragging(true);
        setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
      }
    }
  }, [zoom, pan, resetZoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / initialPinchDistRef.current;
      const next = Math.min(5, Math.max(1, initialPinchZoomRef.current * scale));
      setZoom(next);
      if (next <= 1) setPan({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && isDragging) {
      setPan({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
    }
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleThumbnailClick = useCallback((index: number) => {
    setActiveIndex(index);
    resetZoom();
  }, [resetZoom]);

  const hasPreviewData = !!(previewNumber || previewNickname);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && modalRef.current) {
      const closeBtn = modalRef.current.querySelector('[data-testid="button-close-modal"]') as HTMLElement;
      closeBtn?.focus();
    }
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  if (!open || images.length === 0) return null;

  const labels = ["Frente", "Costas", "Detalhe"];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jersey-modal-title"
      data-testid="modal-jersey-image"
      ref={modalRef}
      onKeyDown={(e) => {
        if (e.key === "Tab") {
          const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (!focusable || focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        data-testid="modal-backdrop"
      />

      <div className="relative z-10 w-full max-w-4xl mx-4 max-h-[95vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex-1 min-w-0">
            <h2 id="jersey-modal-title" className="text-lg font-bold text-gray-900 dark:text-white truncate" data-testid="text-modal-jersey-name">
              {jerseyName}
            </h2>
            {price && (
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400" data-testid="text-modal-jersey-price">
                R$ {price}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            {hasPreviewData && themeColor && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  showPreview
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200"
                }`}
                data-testid="button-toggle-preview"
              >
                {showPreview ? "Ocultar Preview" : "Ver Preview"}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Fechar"
              data-testid="button-close-modal"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          <div className="flex-1 relative bg-gray-50 dark:bg-gray-950 min-h-[300px] md:min-h-[400px]">
            <div
              ref={imageContainerRef}
              className="w-full h-full flex items-center justify-center overflow-hidden select-none"
              style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in", touchAction: "none" }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              data-testid="container-zoomable-image"
            >
              <img
                src={images[activeIndex]}
                alt={`${jerseyName} - ${labels[activeIndex] || `Imagem ${activeIndex + 1}`}`}
                className="max-w-full max-h-full object-contain transition-transform duration-150"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  willChange: "transform",
                }}
                loading="lazy"
                draggable={false}
                data-testid="img-zoomed-jersey"
              />
            </div>

            {images.length > 1 && (
              <>
                {activeIndex > 0 && (
                  <button
                    onClick={() => { setActiveIndex(i => i - 1); resetZoom(); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg hover:bg-white transition-colors"
                    data-testid="button-prev-image"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                {activeIndex < images.length - 1 && (
                  <button
                    onClick={() => { setActiveIndex(i => i + 1); resetZoom(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg hover:bg-white transition-colors"
                    data-testid="button-next-image"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </>
            )}

            <div className="absolute bottom-3 right-3 flex gap-1.5">
              <button
                onClick={() => setZoom(prev => Math.min(5, prev + 0.5))}
                className="p-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 shadow hover:bg-white transition-colors"
                data-testid="button-zoom-in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={resetZoom}
                className="p-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 shadow hover:bg-white transition-colors"
                data-testid="button-zoom-reset"
              >
                <span className="text-xs font-medium px-1">{Math.round(zoom * 100)}%</span>
              </button>
              <button
                onClick={() => { setZoom(prev => { const n = Math.max(1, prev - 0.5); if (n <= 1) setPan({ x: 0, y: 0 }); return n; }); }}
                className="p-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 shadow hover:bg-white transition-colors"
                data-testid="button-zoom-out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
            </div>

            {zoom > 1 && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 text-white text-xs rounded-full pointer-events-none">
                Arraste para mover • Scroll para zoom
              </div>
            )}
          </div>

          {showPreview && hasPreviewData && themeColor && (
            <div className="w-full md:w-56 border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-800 p-4 flex flex-col items-center justify-center bg-white dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Preview da Camisa</p>
              <JerseyPreview
                number={previewNumber || ""}
                nickname={previewNickname || ""}
                themeColor={themeColor}
              />
            </div>
          )}
        </div>

        {description && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400" data-testid="text-modal-description">
              {description}
            </p>
          </div>
        )}

        {images.length > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex gap-2 justify-center" data-testid="container-thumbnails">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => handleThumbnailClick(idx)}
                  className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    idx === activeIndex
                      ? "border-blue-500 shadow-md ring-2 ring-blue-200"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-400"
                  }`}
                  data-testid={`button-thumbnail-${idx}`}
                >
                  <img
                    src={img}
                    alt={labels[idx] || `Imagem ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] text-center py-0.5">
                    {labels[idx] || `${idx + 1}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
