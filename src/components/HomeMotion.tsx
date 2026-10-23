import { useEffect, useRef, useState, type ReactNode } from "react";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function HomeReveal({ children, direction = "up", className = "" }: {
  children: ReactNode;
  direction?: "left" | "right" | "up";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const element = ref.current;
    if (!element || reduced) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setVisible(entry.isIntersecting);
    }, { threshold: 0, rootMargin: "0px 0px -24px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [reduced]);
  return <div ref={ref} data-visible={visible} data-direction={direction} className={`home-reveal ${className}`}>{children}</div>;
}

export function HomeParallax({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const element = ref.current;
    if (!element || reduced) {
      element?.style.removeProperty("--parallax-y");
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const box = element.getBoundingClientRect();
      if (box.bottom > 0 && box.top < window.innerHeight) {
        element.style.setProperty("--parallax-y", `${Math.max(-12, Math.min(12, -window.scrollY * 0.035))}px`);
      }
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, [reduced]);
  return <div ref={ref} className="home-parallax">{children}</div>;
}