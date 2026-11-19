import { narrowScreen, reducedMotion } from './media.js';
import { applyFoil, resetFoil } from './card-foil.js';
import { tiltBackdrops } from './scroll.js';

const FLIP_MS = 560;
const TILT_RANGE_DEG = 30;
const PARTS = ['potere', 'livello', 'abilita', 'tratti'];

const clamp = (value) => Math.max(-1, Math.min(1, value));

let scene;
let cards = [];

const activeCard = () => cards.find((card) => card.classList.contains('attiva')) || cards[0];
const restCards = () => cards.forEach(resetFoil);

function tiltCard(x, y) {
  const card = activeCard();
  if (card) applyFoil(card, x, y);
}

function tiltTowards(point) {
  const box = scene.getBoundingClientRect();
  if (!box.width || !box.height) return;

  const x = (point.clientX - box.left) / box.width;
  const y = (point.clientY - box.top) / box.height;
  tiltCard(clamp(x * 2 - 1), clamp(y * 2 - 1));
}

function initFlip() {
  const wrapper = document.getElementById('carte-flip');
  const button = document.getElementById('gira-carta');
  if (!wrapper || !button || cards.length < 2) return;

  const label = button.querySelector('.face-toggle-label');
  const dot = button.querySelector('.face-toggle-dot');
  const dotImage = (face) => `/web-assets/sito/color-${face}.png`;
  let flipping = false;

  new Image().src = dotImage('light');

  button.addEventListener('click', () => {
    if (flipping) return;

    flipping = true;
    restCards();
    wrapper.classList.add('gira');

    setTimeout(() => {
      const hidden = activeCard();
      cards.forEach((card) => card.classList.toggle('attiva', card !== hidden));

      const face = activeCard().dataset.foilVariant === 'light' ? 'light' : 'dark';
      label.textContent = face === 'light' ? 'Light' : 'Dark';
      dot.src = dotImage(face);
    }, FLIP_MS / 2);

    setTimeout(() => {
      wrapper.classList.remove('gira');
      flipping = false;
    }, FLIP_MS + 40);
  });
}

function initPointerTilt() {
  if (reducedMotion.matches) return;

  scene.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') tiltTowards(event);
  });
  scene.addEventListener('pointerleave', restCards);

  scene.addEventListener('touchmove', (event) => {
    if (event.touches.length) tiltTowards(event.touches[0]);
  }, { passive: true });
  scene.addEventListener('touchend', restCards, { passive: true });
  scene.addEventListener('touchcancel', restCards, { passive: true });
}

function initDeviceTilt() {
  if (reducedMotion.matches || !window.DeviceOrientationEvent) return;

  let restingBeta = null;

  const onOrientation = (event) => {
    if (event.beta === null && event.gamma === null) return;
    if (restingBeta === null) restingBeta = event.beta || 0;

    const x = clamp((event.gamma || 0) / TILT_RANGE_DEG);
    const y = clamp(((event.beta || 0) - restingBeta) / TILT_RANGE_DEG);

    if (narrowScreen.matches) tiltCard(x, y);
    tiltBackdrops(x);
  };

  const listen = () => {
    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('deviceorientationabsolute', onOrientation);
  };

  if (typeof DeviceOrientationEvent.requestPermission !== 'function') {
    listen();
    return;
  }

  const gestures = ['pointerdown', 'touchend', 'click'];
  const askOnce = () => {
    gestures.forEach((type) => document.removeEventListener(type, askOnce, true));
    DeviceOrientationEvent.requestPermission()
      .then((answer) => {
        if (answer === 'granted') listen();
      })
      .catch(() => {});
  };

  gestures.forEach((type) => document.addEventListener(type, askOnce, true));
}

function initTapZones() {
  const zones = document.getElementById('tocco');
  const panel = document.getElementById('tocco-detto');
  if (!zones || !panel) return;

  const descriptions = {};
  for (const part of PARTS) {
    const label = document.querySelector(`.cartellino.c-${part}`);
    if (label) descriptions[part] = label.innerHTML;
  }

  zones.addEventListener('click', (event) => {
    const zone = event.target.closest('b[data-che]');
    if (!zone || !descriptions[zone.dataset.che]) return;

    const part = zone.dataset.che;
    for (const other of zones.children) {
      other.classList.toggle('acceso', other.dataset.che === part);
    }

    panel.classList.remove('visto');
    setTimeout(() => {
      panel.innerHTML = descriptions[part];
      panel.classList.add('visto');
    }, 140);
  });

  panel.classList.add('visto');
}

export function initCardShowcase() {
  scene = document.getElementById('carta');
  if (!scene) return;

  cards = [...scene.querySelectorAll('.hx-carta')];

  initFlip();
  initPointerTilt();
  initDeviceTilt();
  initTapZones();
}
