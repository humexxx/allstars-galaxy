/**
 * A burst of confetti from a point on the screen, on a canvas laid over the
 * page and taken away when the last piece has fallen. Nothing for a reader
 * who asks for less motion. A few dozen lines rather than a dependency.
 */

import { prefersReducedMotion } from "./reveal";

const PIECES = 90;
const DURATION_MS = 1800;
const GRAVITY = 0.0012;
/** The hub's own series colours, then gold: whatever the theme resolves them to. */
const SERIES = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];
const GOLD = "#f5c542";

type Piece = { x: number; y: number; vx: number; vy: number; spin: number; angle: number; color: string; w: number; h: number };

export function burstConfetti(from: { x: number; y: number }): void {
  if (prefersReducedMotion()) return;
  const canvas = document.createElement("canvas");
  const ratio = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * ratio;
  canvas.height = window.innerHeight * ratio;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    pointerEvents: "none",
    zIndex: "60",
  });
  const context = canvas.getContext("2d");
  if (!context) return;
  document.body.appendChild(canvas);
  context.scale(ratio, ratio);

  const root = getComputedStyle(document.documentElement);
  const colors = [...SERIES.map((name) => root.getPropertyValue(name).trim()).filter(Boolean), GOLD];
  const pieces: Piece[] = Array.from({ length: PIECES }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
    const speed = 0.45 + Math.random() * 0.55;
    return {
      x: from.x,
      y: from.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: (Math.random() - 0.5) * 0.02,
      angle: Math.random() * Math.PI,
      color: colors[Math.floor(Math.random() * colors.length)],
      w: 5 + Math.random() * 5,
      h: 3 + Math.random() * 4,
    };
  });

  const start = performance.now();
  let last = start;
  const frame = (now: number): void => {
    const dt = Math.min(32, now - last);
    last = now;
    const elapsed = now - start;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    context.globalAlpha = Math.max(0, 1 - Math.max(0, elapsed - DURATION_MS * 0.6) / (DURATION_MS * 0.4));
    for (const p of pieces) {
      p.vy += GRAVITY * dt;
      p.vx *= 0.995;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      context.save();
      context.translate(p.x, p.y);
      context.rotate(p.angle);
      context.fillStyle = p.color;
      context.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      context.restore();
    }
    if (elapsed < DURATION_MS) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
