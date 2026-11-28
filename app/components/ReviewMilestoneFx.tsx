"use client";

import { useEffect, useRef } from "react";

interface ReviewMilestoneFxProps {
  variant: "feature" | "compact";
  /** Numeric milestone the counter animates towards (e.g. 500). */
  target: number;
  /** Final server-rendered figure (e.g. "500+"); always restored at the end. */
  figure: string;
  children: React.ReactNode;
}

const COUNTER_DELAY_MS = 500;
const COUNTER_DURATION_MS = 1300;
const CONFETTI_DELAY_MS = 2200;
const CONFETTI_COLORS = ["#FFD700", "#00FF88", "#B6FF00", "#FFF4B0", "#FFFFFF"];

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function setFigure(nodes: HTMLElement[], value: string): void {
  for (const node of nodes) {
    node.dataset.value = value;
    // The depth layer renders from data-value only; never give it text.
    if (node.dataset.rmFigure !== "depth") node.textContent = value;
  }
}

function seedParticles(host: HTMLElement, count: number): void {
  if (host.childElementCount > 0) return;
  for (let index = 0; index < count; index += 1) {
    const dot = document.createElement("i");
    const gold = index % 3 !== 0;
    dot.className = gold ? "rm-particle is-gold" : "rm-particle is-emerald";
    dot.style.setProperty("--x", `${(index * 37 + 11) % 100}%`);
    dot.style.setProperty("--d", `${9 + ((index * 7) % 8)}s`);
    dot.style.setProperty("--delay", `${-((index * 1.3) % 9)}s`);
    dot.style.setProperty("--s", `${2 + (index % 3)}px`);
    host.appendChild(dot);
  }
}

function burstConfetti(card: HTMLElement, count: number): void {
  const layer = document.createElement("span");
  layer.className = "rm-confetti";
  layer.setAttribute("aria-hidden", "true");
  card.appendChild(layer);
  const animations: Animation[] = [];
  for (let index = 0; index < count; index += 1) {
    const piece = document.createElement("i");
    piece.style.background = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
    layer.appendChild(piece);
    const angle = (Math.PI * 2 * index) / count + (index % 2) * 0.2;
    const distance = 140 + ((index * 53) % 220);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance * 0.7 - 60;
    const spin = ((index * 97) % 540) - 270;
    animations.push(
      piece.animate(
        [
          { transform: "translate3d(0,0,0) rotate(0deg) scale(1)", opacity: 1 },
          { transform: `translate3d(${dx}px, ${dy}px, 0) rotate(${spin}deg) scale(1)`, opacity: 1, offset: 0.65 },
          { transform: `translate3d(${dx * 1.1}px, ${dy + 120}px, 0) rotate(${spin * 1.4}deg) scale(0.6)`, opacity: 0 },
        ],
        { duration: 1600 + (index % 5) * 120, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" },
      ),
    );
  }
  Promise.all(animations.map((animation) => animation.finished))
    .catch(() => undefined)
    .finally(() => layer.remove());
}

/**
 * Decorative motion for ReviewMilestoneCard. Content is already rendered on
 * the server; this only arms the reveal timeline when the card is below the
 * fold, plays it once on entry, and pauses ambient loops offscreen.
 */
export function ReviewMilestoneFx({ variant, target, figure, children }: ReviewMilestoneFxProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const card = root?.querySelector<HTMLElement>("[data-rm-card]");
    if (!root || !card) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || typeof IntersectionObserver === "undefined") {
      root.dataset.state = "static";
      return;
    }

    const figures = Array.from(root.querySelectorAll<HTMLElement>("[data-rm-figure]"));
    const isFeature = variant === "feature";
    const isNarrow = window.matchMedia("(max-width: 640px)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const timers: number[] = [];
    let counterFrame = 0;
    let played = false;

    const particleHost = root.querySelector<HTMLElement>("[data-rm-particles]");
    if (isFeature && particleHost) seedParticles(particleHost, isNarrow ? 8 : 18);

    const rect = root.getBoundingClientRect();
    const alreadyVisible = rect.top < window.innerHeight * 0.85 && rect.bottom > 0;
    root.dataset.state = alreadyVisible ? "playing" : "armed";

    const runCounter = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / COUNTER_DURATION_MS);
        const value = Math.round(target * easeOutCubic(progress));
        setFigure(figures, progress >= 1 ? figure : String(value));
        if (progress < 1) counterFrame = requestAnimationFrame(tick);
      };
      counterFrame = requestAnimationFrame(tick);
    };

    const play = () => {
      if (played) return;
      played = true;
      root.dataset.state = "playing";
      if (target > 0) {
        setFigure(figures, "0");
        timers.push(window.setTimeout(runCounter, COUNTER_DELAY_MS));
      }
      if (isFeature) {
        timers.push(window.setTimeout(() => burstConfetti(card, isNarrow ? 22 : 44), CONFETTI_DELAY_MS));
      }
      timers.push(window.setTimeout(() => (root.dataset.state = "ambient"), 3000));
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          root.dataset.inview = entry.isIntersecting ? "true" : "false";
          if (entry.isIntersecting && entry.intersectionRatio >= 0.3) play();
        }
      },
      { threshold: [0, 0.3] },
    );
    observer.observe(root);
    if (alreadyVisible) play();

    // Pointer-driven spotlight, desktop tilt and magnetic CTA (feature only).
    let pointerFrame = 0;
    const cta = card.querySelector<HTMLElement>("[data-rm-magnetic]");
    const onMove = (event: PointerEvent) => {
      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        const box = card.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width;
        const y = (event.clientY - box.top) / box.height;
        card.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
        card.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
        card.style.setProperty("--ry", `${((x - 0.5) * 6).toFixed(2)}deg`);
        card.style.setProperty("--rx", `${((0.5 - y) * 5).toFixed(2)}deg`);
        if (cta) {
          const ctaBox = cta.getBoundingClientRect();
          const cx = event.clientX - (ctaBox.left + ctaBox.width / 2);
          const cy = event.clientY - (ctaBox.top + ctaBox.height / 2);
          const near = Math.hypot(cx, cy) < 140;
          cta.style.setProperty("--tx", near ? `${(cx * 0.18).toFixed(1)}px` : "0px");
          cta.style.setProperty("--ty", near ? `${(cy * 0.25).toFixed(1)}px` : "0px");
        }
      });
    };
    const onLeave = () => {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
      cta?.style.setProperty("--tx", "0px");
      cta?.style.setProperty("--ty", "0px");
    };
    const interactive = isFeature && finePointer;
    if (interactive) {
      card.dataset.interactive = "true";
      card.addEventListener("pointermove", onMove);
      card.addEventListener("pointerleave", onLeave);
    }

    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      cancelAnimationFrame(counterFrame);
      cancelAnimationFrame(pointerFrame);
      setFigure(figures, figure);
      if (interactive) {
        card.removeEventListener("pointermove", onMove);
        card.removeEventListener("pointerleave", onLeave);
      }
    };
  }, [variant, target, figure]);

  return (
    <div className="rm-fx" ref={rootRef}>
      {children}
    </div>
  );
}
