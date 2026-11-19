import { narrowScreen } from './media.js';

const BASE_STRENGTH = 0.06;
const TILT_SHIFT = 26;

const bar = document.getElementById('barra');
const hero = document.getElementById('cappello');
const backdrops = [...document.querySelectorAll('[data-parallasse]')].map((element) => ({
  element,
  strength: parseFloat(element.dataset.parallasse) || BASE_STRENGTH,
}));

let tilt = 0;
let queued = false;

function update() {
  const scrolled = window.scrollY;

  if (bar) {
    const heroEnd = hero ? hero.offsetHeight - 80 : 600;
    bar.classList.toggle('staccata', scrolled > 40);
    bar.classList.toggle('via', narrowScreen.matches && scrolled < heroEnd);
  }

  const middle = window.innerHeight / 2;
  for (const { element, strength } of backdrops) {
    const box = element.getBoundingClientRect();
    if (box.bottom < -400 || box.top > window.innerHeight + 400) continue;

    const x = tilt * TILT_SHIFT * (strength / BASE_STRENGTH);
    const y = (middle - box.top - box.height / 2) * strength;
    element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }
}

function requestUpdate() {
  if (queued) return;

  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    update();
  });
}

function revealOnScroll() {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('dentro-vista');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.06 });

  document.querySelectorAll('.entra').forEach((element) => observer.observe(element));
}

export function tiltBackdrops(amount) {
  tilt = amount;
  requestUpdate();
}

export function initScroll() {
  revealOnScroll();
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  window.addEventListener('load', requestUpdate);
  update();
}
