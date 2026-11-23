import { reducedMotion } from './media.js';

const REACH_X = 24;
const REACH_Y = 16;
const SETTLE_SECONDS = 0.22;

export function initCollectionBackdrop() {
  const backdrop = document.getElementById('collection-backdrop');
  if (!backdrop) return;

  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  let frame = null;
  let lastTime = 0;
  let inView = false;

  const step = (time) => {
    const elapsed = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0.016;
    const blend = 1 - Math.exp(-elapsed / SETTLE_SECONDS);

    lastTime = time;
    current.x += (target.x - current.x) * blend;
    current.y += (target.y - current.y) * blend;

    if (Math.abs(target.x - current.x) < 0.05 && Math.abs(target.y - current.y) < 0.05) {
      current.x = target.x;
      current.y = target.y;
      frame = null;
      lastTime = 0;
    } else {
      frame = requestAnimationFrame(step);
    }

    backdrop.style.transform = `translate3d(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px, 0)`;
  };

  const wake = () => {
    if (frame || !inView) return;
    frame = requestAnimationFrame(step);
  };

  window.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || reducedMotion.matches) return;

    target.x = (0.5 - event.clientX / window.innerWidth) * 2 * REACH_X;
    target.y = (0.5 - event.clientY / window.innerHeight) * 2 * REACH_Y;
    wake();
  }, { passive: true });

  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    wake();
  }).observe(backdrop.parentNode);
}
