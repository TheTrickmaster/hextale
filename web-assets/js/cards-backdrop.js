import { narrowScreen, reducedMotion } from './media.js';

const CARD_LAYERS = [
  { id: 'cards-far', speed: 0.6 },
  { id: 'cards-mid', speed: 0.8 },
  { id: 'cards-near', speed: 1.15 },
];

function imageUrl(element) {
  const match = /url\(["']?(.+?)["']?\)/.exec(getComputedStyle(element).backgroundImage);
  return match ? match[1] : '';
}

function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve();

    const image = new Image();
    image.onload = () => (image.decode ? image.decode().then(resolve, resolve) : resolve());
    image.onerror = resolve;
    image.src = url;
  });
}

export function initCardsBackdrop() {
  const backdrop = document.getElementById('cards-backdrop');
  if (!backdrop) return;

  const layers = CARD_LAYERS
    .map((layer) => ({ ...layer, element: document.getElementById(layer.id) }))
    .filter((layer) => layer.element);

  let shown = false;
  let queued = false;

  const place = () => {
    queued = false;

    const still = narrowScreen.matches || reducedMotion.matches;
    const scrolled = Math.min(window.scrollY, backdrop.offsetHeight * 2);

    for (const layer of layers) {
      const offset = still ? 0 : scrolled * (1 - layer.speed);
      layer.element.style.transform = offset ? `translate3d(0, ${offset.toFixed(1)}px, 0)` : '';
    }
  };

  const requestPlace = () => {
    if (queued) return;

    queued = true;
    requestAnimationFrame(place);
  };

  const show = () => {
    if (shown || narrowScreen.matches) return;

    shown = true;
    Promise.all(layers.map((layer) => loadImage(imageUrl(layer.element)))).then(() => {
      requestAnimationFrame(() => backdrop.classList.add('su'));
    });
  };

  window.addEventListener('scroll', requestPlace, { passive: true });
  window.addEventListener('resize', requestPlace);
  narrowScreen.addEventListener('change', () => {
    show();
    requestPlace();
  });
  reducedMotion.addEventListener('change', requestPlace);

  show();
  place();
}
