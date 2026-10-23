import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/components/HomeMotion";
import { CAROUSEL_HOLD_MS, CAROUSEL_TRANSITION_MS, nextSlide, swipeDirection } from "@/lib/home-motion";
import type { Dish } from "@/lib/dishes";
import hero from "@/assets/hero-food.jpg";

export function HomeCarousel({ dishes }: { dishes: Dish[] }) {
  const pics = dishes.filter((dish): dish is Dish & { image_url: string } => Boolean(dish.image_url));
  const chosen = pics.filter((dish) => dish.in_carousel);
  const slides = (chosen.length ? chosen : pics).slice(0, 8);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [moving, setMoving] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const [manualPause, setManualPause] = useState(false);
  const start = useRef<number | null>(null);
  const reduced = useReducedMotion();
  const paused = hovered || focused || touched || manualPause || reduced;
  const current = slides.length ? index % slides.length : 0;
  const change = useCallback((step: number) => {
    setDirection(step);
    setIndex((value) => nextSlide(value, step, slides.length));
    setMoving(!reduced);
  }, [slides.length, reduced]);
  useEffect(() => {
    if (!moving) return;
    const timer = setTimeout(() => setMoving(false), CAROUSEL_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [moving, index]);
  useEffect(() => {
    if (paused || moving || slides.length < 2) return;
    const timer = setTimeout(() => change(1), CAROUSEL_HOLD_MS);
    return () => clearTimeout(timer);
  }, [paused, moving, index, slides.length, change]);

  if (!slides.length) return <img src={hero} alt="Plats africains appétissants" width={1280} height={896} className="aspect-[4/3] w-full rounded-[2.5rem] object-cover shadow-bubble" />;
  return (
    <div className="home-carousel relative" role="region" aria-roledescription="carrousel" aria-label="Nos plats"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); change(event.key === "ArrowRight" ? 1 : -1); } }}>
      <div className="home-carousel-window relative aspect-[4/3] overflow-hidden rounded-[2.5rem] shadow-bubble"
        onPointerDown={(event) => { if (event.pointerType === "mouse") return; start.current = event.clientX; setTouched(true); event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerUp={(event) => { if (start.current === null) return; const step = swipeDirection(start.current, event.clientX); start.current = null; if (step) change(step); }}
        onPointerCancel={() => { start.current = null; }}>
        {slides.map((dish, slide) => (
          <div key={dish.id} aria-hidden={slide !== current} data-active={slide === current} data-direction={direction > 0 ? "next" : "previous"} className="home-carousel-slide absolute inset-0">
            <img src={dish.image_url} alt={dish.name} draggable={false} className="h-full w-full object-cover" />
            <span className="absolute bottom-4 left-4 right-4 w-fit max-w-[calc(100%-2rem)] rounded-full bg-background/90 px-4 py-1 text-sm font-bold text-foreground">{dish.name}</span>
          </div>
        ))}
      </div>
      {slides.length > 1 && <div className="mt-3 flex items-center justify-center gap-2">
        <Button variant="ghost" size="icon" className="home-control" onClick={() => change(-1)} aria-label="Plat précédent" title="Plat précédent"><ChevronLeft /></Button>
        <div className="flex items-center gap-1">{slides.map((dish, slide) => <Button key={dish.id} variant="ghost" size="icon" className="home-dot-button" aria-label={`Photo ${slide + 1} : ${dish.name}`} aria-pressed={slide === current} onClick={() => change(slide - current)}><span className={`home-dot ${slide === current ? "home-dot-active" : ""}`} /></Button>)}</div>
        <Button variant="ghost" size="icon" className="home-control" onClick={() => change(1)} aria-label="Plat suivant" title="Plat suivant"><ChevronRight /></Button>
        <Button variant="ghost" size="icon" className="home-control" onClick={() => { setTouched(false); setManualPause(!manualPause && !touched); }} aria-label={manualPause || touched ? "Reprendre le carrousel" : "Mettre le carrousel en pause"} title={manualPause || touched ? "Reprendre le carrousel" : "Mettre le carrousel en pause"}>{manualPause || touched ? <Play /> : <Pause />}</Button>
      </div>}
    </div>
  );
}