import { useEffect, useRef, useState, type ReactNode } from "react";
import { pinchScale } from "@/lib/camera";
import { cn } from "@/lib/utils";

type Point = { x: number; y: number };
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Pinça com dois dedos amplia só esta mídia (a página não tem zoom).
 * No feed volta ao normal ao soltar, como no Instagram; com `persist`, fica ampliada e dá para arrastar.
 */
export function PinchZoom({ children, persist = false, className }: { children: ReactNode; persist?: boolean; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const start = useRef<{ distance: number; scale: number; origin: Point } | null>(null);
  const panFrom = useRef<{ p: Point; offset: Point } | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [origin, setOrigin] = useState<Point>({ x: 50, y: 50 });
  const [active, setActive] = useState(false);

  // Com dois dedos na foto, o navegador não pode rolar a página (senão cancela a pinça).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const stop = (e: TouchEvent) => {
      if (e.touches.length >= 2) e.preventDefault();
    };
    el.addEventListener("touchmove", stop, { passive: false });
    return () => el.removeEventListener("touchmove", stop);
  }, []);

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      const rect = box.current?.getBoundingClientRect();
      const m = mid(pts[0]!, pts[1]!);
      if (rect && scale === 1) setOrigin({ x: ((m.x - rect.left) / rect.width) * 100, y: ((m.y - rect.top) / rect.height) * 100 });
      start.current = { distance: dist(pts[0]!, pts[1]!), scale, origin: m };
      panFrom.current = null;
      setActive(true);
    } else if (pts.length === 1 && persist && scale > 1) {
      panFrom.current = { p: pts[0]!, offset };
    }
  };

  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && start.current) {
      const next = pinchScale(start.current.distance, dist(pts[0]!, pts[1]!)) * start.current.scale;
      setScale(Math.min(4, Math.max(1, next)));
    } else if (pts.length === 1 && panFrom.current) {
      const p = pts[0]!;
      setOffset({ x: panFrom.current.offset.x + (p.x - panFrom.current.p.x), y: panFrom.current.offset.y + (p.y - panFrom.current.p.y) });
    }
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) start.current = null;
    if (pointers.current.size === 0) {
      panFrom.current = null;
      setActive(false);
      if (!persist || scale <= 1.02) reset();
    }
  };

  const zoomed = scale > 1;
  return (
    <div
      ref={box}
      className={cn("relative size-full", zoomed && "z-40", className)}
      // Um dedo continua rolando a página e deslizando o carrossel; dois dedos são nossos (pinça).
      style={{ touchAction: persist && zoomed ? "none" : "pan-x pan-y" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={persist && zoomed ? reset : undefined}
      data-pinch-zoom=""
    >
      <div
        className={cn("size-full", !active && "transition-transform duration-200")}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: `${origin.x}% ${origin.y}%`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
