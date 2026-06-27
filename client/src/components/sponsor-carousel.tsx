import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { FormSponsor } from "@shared/schema";

interface SponsorCarouselProps {
  sponsors: FormSponsor[];
  onSponsorClick: (sponsor: FormSponsor) => void;
}

function getItemsPerSlide() {
  if (typeof window === "undefined") return 3;
  if (window.innerWidth < 640) return 1;
  if (window.innerWidth < 768) return 2;
  return 3;
}

export default function SponsorCarousel({ sponsors, onSponsorClick }: SponsorCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [itemsPerSlide, setItemsPerSlide] = useState(getItemsPerSlide);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    const handleResize = () => setItemsPerSlide(getItemsPerSlide());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const totalSlides = Math.ceil(sponsors.length / itemsPerSlide);

  useEffect(() => {
    setCurrentSlide(prev => Math.min(prev, Math.max(0, totalSlides - 1)));
  }, [totalSlides]);

  useEffect(() => {
    if (isPaused || totalSlides <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % totalSlides);
    }, 1500);
    return () => clearInterval(timer);
  }, [isPaused, totalSlides]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) setCurrentSlide(prev => (prev + 1) % totalSlides);
      else setCurrentSlide(prev => (prev - 1 + totalSlides) % totalSlides);
    }
  };

  const goNext = () => { if (totalSlides > 0) setCurrentSlide(prev => (prev + 1) % totalSlides); };
  const goPrev = () => { if (totalSlides > 0) setCurrentSlide(prev => (prev - 1 + totalSlides) % totalSlides); };

  const slides = Array.from({ length: totalSlides }, (_, slideIdx) =>
    sponsors.slice(slideIdx * itemsPerSlide, (slideIdx + 1) * itemsPerSlide)
  );

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      data-testid="sponsor-carousel"
    >
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((slideSponsors, slideIdx) => (
            <div
              key={slideIdx}
              className="flex-shrink-0 w-full flex items-center justify-center gap-6 px-8"
            >
              {slideSponsors.map((sponsor) => {
                const logo = (
                  <img
                    src={sponsor.logoUrl}
                    alt={sponsor.name || "Patrocinador"}
                    title={sponsor.name || undefined}
                    className="h-12 sm:h-16 max-w-[120px] object-contain opacity-90 hover:opacity-100 transition-all duration-300 hover:scale-105"
                    data-testid={`img-sponsor-${sponsor.id}`}
                  />
                );
                return (
                  <div key={sponsor.id} className="flex flex-col items-center gap-1">
                    {sponsor.linkUrl ? (
                      <button
                        type="button"
                        onClick={() => onSponsorClick(sponsor)}
                        className="cursor-pointer"
                        data-testid={`link-sponsor-${sponsor.id}`}
                      >
                        {logo}
                      </button>
                    ) : (
                      logo
                    )}
                    {sponsor.name && (
                      <p className="text-[10px] text-muted-foreground text-center truncate max-w-[100px]">{sponsor.name}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {totalSlides > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-background/80 border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            data-testid="carousel-prev"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-background/80 border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            data-testid="carousel-next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="flex justify-center gap-1.5 mt-3">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentSlide(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentSlide ? "bg-primary w-4" : "bg-muted-foreground/30 w-1.5"
                }`}
                data-testid={`carousel-dot-${i}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
