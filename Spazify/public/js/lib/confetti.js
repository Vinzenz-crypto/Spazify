// A small confetti burst for completed challenges.
import { prefersReducedMotion } from './util.js';

const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#22d3ee', '#34d399', '#ffffff'];

export function confetti({ count = 160, duration = 2600 } = {}) {
  if (prefersReducedMotion()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const resize = () => {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  };
  resize();
  const pieces = Array.from({ length: count }, (_, i) => ({
    x: innerWidth * (0.2 + Math.random() * 0.6),
    y: innerHeight * 0.35 + Math.random() * 40,
    vx: (Math.random() - 0.5) * 14,
    vy: -8 - Math.random() * 11,
    size: 5 + Math.random() * 7,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.35,
    color: COLORS[i % COLORS.length],
    shape: Math.random() < 0.5 ? 'rect' : 'circle',
  }));
  const start = performance.now();
  function frame(t) {
    const elapsed = t - start;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const fade = Math.max(0, 1 - Math.max(0, elapsed - duration * 0.6) / (duration * 0.4));
    for (const p of pieces) {
      p.vy += 0.32;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (elapsed < duration) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
