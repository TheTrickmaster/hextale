import { reducedMotion } from './media.js';
import { loadSprites, randomSprite } from './particles.js';

const DUST_COLOR = '#FFF8C3';
const DUST_LAYERS = [
  { id: 'polvere-lontano', count: 90, radius: [0.6, 1.4], speed: [5, 11], alpha: [0.25, 0.55], sway: [2, 7] },
  { id: 'polvere-mezzo', count: 80, radius: [1.4, 3], speed: [12, 22], alpha: [0.45, 0.9], sway: [5, 14] },
  { id: 'polvere-vicino', count: 30, radius: [5, 11], speed: [22, 40], alpha: [0.18, 0.4], sway: [10, 26] },
];

const random = (min, max) => min + Math.random() * (max - min);

function createSpeck(settings, width, height, scattered) {
  const radius = random(...settings.radius);
  const below = height + radius + random(4, Math.min(90, Math.max(8, height * 0.25)));

  return {
    sprite: randomSprite(),
    x: random(-20, width + 20),
    y: scattered ? random(-20, height + 20) : below,
    radius,
    speed: random(...settings.speed),
    sway: random(...settings.sway),
    frequency: random(0.1, 0.34),
    phase: random(0, Math.PI * 2),
    alpha: random(...settings.alpha),
  };
}

function resizeLayer(layer) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const box = layer.canvas.getBoundingClientRect();
  const width = box.width || window.innerWidth;
  const height = box.height || 600;

  if (layer.width && layer.height) {
    for (const speck of layer.specks) {
      speck.x *= width / layer.width;
      speck.y *= height / layer.height;
    }
  }

  layer.width = width;
  layer.height = height;
  layer.canvas.width = Math.max(1, Math.round(width * ratio));
  layer.canvas.height = Math.max(1, Math.round(height * ratio));
  layer.context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawLayer(layer, seconds, elapsed) {
  const { context, specks, settings, width, height } = layer;

  context.clearRect(0, 0, width, height);
  context.fillStyle = DUST_COLOR;

  specks.forEach((speck, index) => {
    speck.y -= speck.speed * elapsed;
    if (speck.y < -(speck.radius + 24)) {
      specks[index] = createSpeck(settings, width, height, false);
      return;
    }

    const x = speck.x + Math.sin(seconds * speck.frequency * Math.PI * 2 + speck.phase) * speck.sway;
    const { image, scale } = speck.sprite;
    context.globalAlpha = speck.alpha;

    if (scale) {
      const side = speck.radius * 2 * scale;
      context.drawImage(image, x - side / 2, speck.y - side / 2, side, side);
      return;
    }

    context.beginPath();
    context.arc(x, speck.y, speck.radius, 0, Math.PI * 2);
    context.fill();
  });

  context.globalAlpha = 1;
}

function startDust() {
  if (reducedMotion.matches) return;

  loadSprites();

  const layers = [];
  for (const settings of DUST_LAYERS) {
    const canvas = document.getElementById(settings.id);
    if (!canvas) continue;

    const layer = { settings, canvas, context: canvas.getContext('2d'), specks: [], width: 0, height: 0 };
    resizeLayer(layer);
    for (let i = 0; i < settings.count; i++) {
      layer.specks.push(createSpeck(settings, layer.width, layer.height, true));
    }
    layers.push(layer);
  }
  if (!layers.length) return;

  let frame = null;
  let lastTime = 0;

  const tick = (time) => {
    frame = requestAnimationFrame(tick);
    const elapsed = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0.016;
    lastTime = time;
    layers.forEach((layer) => drawLayer(layer, time / 1000, elapsed));
  };

  new ResizeObserver(() => layers.forEach(resizeLayer)).observe(layers[0].canvas);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = null;
    } else if (!frame && !reducedMotion.matches) {
      lastTime = 0;
      frame = requestAnimationFrame(tick);
    }
  });

  frame = requestAnimationFrame(tick);
}

function startLogoShine() {
  const shine = document.querySelector('#marchio .riflesso');
  if (!shine) return;

  const flash = () => {
    if (reducedMotion.matches) return;

    if (!document.hidden) {
      shine.classList.remove('passa');
      void shine.offsetWidth;
      shine.classList.add('passa');
    }
    setTimeout(flash, random(3000, 5000));
  };

  setTimeout(flash, 1600);
}

function playArrival() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.querySelectorAll('#cappello .arriva, #barra').forEach((element) => {
        element.classList.add('su');
      });
    });
  });
}

export function initHero() {
  playArrival();
  startDust();
  startLogoShine();
}
