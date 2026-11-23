import { reducedMotion } from './media.js';

const SHOT_SECONDS = 3;
const SLIDE_MS = 600;
const COPIES = 5;

const shotUrl = (name) => `/web-assets/sito/gallery/web/${name}.jpg`;

export function initGallery() {
  const gallery = document.getElementById('gallery');
  if (!gallery) return;

  const track = gallery.querySelector('.gallery-track');
  const frames = [...gallery.querySelectorAll('.gallery-shot')];
  const originals = [...track.children];
  const count = originals.length;
  if (count < 2 || frames.length < 2) return;

  const shots = originals.map((thumb) => ({ name: thumb.dataset.shot, label: thumb.getAttribute('aria-label') || '' }));
  const start = Math.min(count - 1, Math.max(0, parseInt(gallery.dataset.start, 10) || 0));

  for (let copy = 1; copy < COPIES; copy++) {
    for (const thumb of originals) {
      const clone = thumb.cloneNode(true);
      clone.tabIndex = -1;
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    }
  }

  const thumbs = [...track.children];
  thumbs.forEach((thumb, slot) => {
    thumb.dataset.slot = slot;
  });
  gallery.classList.add('is-looping');

  const home = count * Math.floor(COPIES / 2);
  let slot = home + start;
  let front = 0;
  let request = 0;
  let timer = null;
  let settle = null;
  let inView = false;

  const place = (sliding) => {
    const step = thumbs[1].offsetLeft - thumbs[0].offsetLeft;
    const centre = slot * step + thumbs[0].offsetWidth / 2;

    track.classList.toggle('is-sliding', sliding);
    track.style.transform = `translate3d(${(-centre).toFixed(1)}px, 0, 0)`;
  };

  const mark = () => {
    const current = slot % count;
    thumbs.forEach((thumb, index) => thumb.classList.toggle('is-active', index % count === current));
  };

  const show = (index) => {
    const incoming = frames[1 - front];
    const outgoing = frames[front];
    const mine = ++request;

    incoming.src = shotUrl(shots[index].name);
    const ready = incoming.decode ? incoming.decode().catch(() => {}) : Promise.resolve();

    ready.then(() => {
      if (mine !== request) return;

      incoming.alt = shots[index].label;
      incoming.removeAttribute('aria-hidden');
      outgoing.setAttribute('aria-hidden', 'true');
      incoming.classList.add('is-shown');
      outgoing.classList.remove('is-shown');
      front = 1 - front;
    });
  };

  const recentre = () => {
    settle = null;
    slot = home + (slot % count);
    place(false);
    void track.offsetWidth;
  };

  const goTo = (target) => {
    if (target === slot) return;

    clearTimeout(settle);
    slot = target;
    mark();
    show(slot % count);
    place(true);
    settle = setTimeout(recentre, SLIDE_MS + 50);
  };

  const schedule = () => {
    clearTimeout(timer);
    timer = null;
    if (!inView || document.hidden || reducedMotion.matches) return;

    timer = setTimeout(() => {
      goTo(slot + 1);
      schedule();
    }, SHOT_SECONDS * 1000);
  };

  track.addEventListener('click', (event) => {
    const thumb = event.target.closest('.gallery-thumb');
    if (!thumb) return;

    goTo(Number(thumb.dataset.slot));
    schedule();
  });

  window.addEventListener('resize', () => place(false));
  window.addEventListener('load', () => place(false));
  document.addEventListener('visibilitychange', schedule);
  reducedMotion.addEventListener('change', schedule);
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    schedule();
  }, { threshold: 0.2 }).observe(gallery);

  mark();
  place(false);
}
