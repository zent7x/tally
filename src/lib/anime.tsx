import {
  animate,
  createScope,
  createTimeline,
  stagger,
} from "animejs";
import {
  useEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { cn } from "./utils";

export { animate, createTimeline, stagger, createScope };

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type AnimeRevealProps = {
  children: ReactNode;
  className?: string;
  /** Element type for the wrapper. Use `span` inside links. */
  as?: ElementType;
  /** Query for staggered children. Defaults to `[data-anime]`. */
  selector?: string;
  /** Stagger between items in ms. */
  staggerMs?: number;
  /** Initial Y offset in px. */
  y?: number;
  /** Delay before the sequence starts. */
  delayMs?: number;
  /** Duration per item. */
  duration?: number;
  /** Only run when scrolled into view. */
  inView?: boolean;
  style?: CSSProperties;
};

/**
 * Stagger-fade children marked with `data-anime` using anime.js.
 * Respects `prefers-reduced-motion`.
 */
export function AnimeReveal({
  children,
  className,
  as: Tag = "div",
  selector = "[data-anime]",
  staggerMs = 70,
  y = 14,
  delayMs = 0,
  duration = 700,
  inView = false,
  style,
}: AnimeRevealProps) {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const targets = root.querySelectorAll(selector);
    if (!targets.length) return;

    if (prefersReducedMotion()) {
      targets.forEach((el) => {
        (el as HTMLElement).style.opacity = "1";
        (el as HTMLElement).style.transform = "none";
      });
      return;
    }

    let scope: ReturnType<typeof createScope> | null = null;
    let observer: IntersectionObserver | null = null;
    let played = false;

    const play = () => {
      if (played) return;
      played = true;

      scope = createScope({ root }).add(() => {
        animate(targets, {
          opacity: [0, 1],
          translateY: [y, 0],
          delay: stagger(staggerMs, { start: delayMs }),
          duration,
          ease: "outExpo",
        });
      });
    };

    if (inView && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            play();
            observer?.disconnect();
          }
        },
        { threshold: 0.25, rootMargin: "0px 0px -8% 0px" },
      );
      observer.observe(root);
    } else {
      play();
    }

    return () => {
      observer?.disconnect();
      scope?.revert();
    };
  }, [selector, staggerMs, y, delayMs, duration, inView]);

  return (
    <Tag ref={rootRef} className={cn("anime-reveal", className)} style={style}>
      {children}
    </Tag>
  );
}

/** Run a one-shot anime.js timeline against a mounted root element. */
export function useAnimeMount(
  run: (root: HTMLElement) => void | (() => void),
  deps: unknown[] = [],
) {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;

    const scope = createScope({ root }).add(() => {
      run(root);
    });

    return () => {
      scope.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return rootRef;
}
