const HUE_RANGE = 180;
const RAINBOW_TRAVEL = 34;
const STARS_TRAVEL = 10;
const BANDS_ANGLE = 45;
const BANDS_TRAVEL = 500;
const TEXTURE_SIZE = 460;
const PARALLAX_PX = [-10, 3, 7, 11];
const BACKGROUND_SCALE = 'scale(1.06)';
const GLOSS_SWEEP_X = 0.34;
const GLOSS_SWEEP_Y = 0.15;
const GLOSS_BAND = 0.13;

const cache = new WeakMap();

function partsOf(card) {
  if (!cache.has(card)) {
    const gloss = card.querySelector('linearGradient[id^="gloss-g-"]');

    cache.set(card, {
      tilt: card.querySelector('.card-db-foil-tilt'),
      rainbow: card.querySelector('.card-holo-grad-a'),
      stars: card.querySelector('.card-holo-grad-b'),
      bands: card.querySelector('.card-holo-bands'),
      layers: [...card.querySelectorAll('.hex-art-parallax-layer[data-parallax-depth]')],
      glossStops: gloss ? [...gloss.children].slice(1, 4) : [],
    });
  }
  return cache.get(card);
}

const unit = (value) => Math.max(0, Math.min(1, value));
const depthOf = (layer) => parseInt(layer.dataset.parallaxDepth, 10) || 0;

export function applyFoil(card, x, y) {
  const { tilt, rainbow, stars, bands, layers, glossStops } = partsOf(card);

  card.dataset.foilActive = '1';

  if (tilt) {
    const hue = (x * 0.72 + y * 0.28) * HUE_RANGE;
    tilt.style.setProperty('--foil-rx', x.toFixed(3));
    tilt.style.setProperty('--foil-ry', y.toFixed(3));
    tilt.style.setProperty('--foil-mx', ((x + 1) * 50).toFixed(1));
    tilt.style.setProperty('--foil-my', ((y + 1) * 50).toFixed(1));
    tilt.style.setProperty('--foil-hue', `${hue.toFixed(1)}deg`);
  }

  if (rainbow && stars) {
    const scale = (parseFloat(rainbow.getAttribute('width')) || TEXTURE_SIZE) / TEXTURE_SIZE;
    const slide = (pattern, travel) => {
      const reach = travel * scale;
      pattern.setAttribute('patternTransform', `translate(${(x * reach).toFixed(1)},${(y * reach).toFixed(1)})`);
    };
    slide(rainbow, RAINBOW_TRAVEL);
    slide(stars, -STARS_TRAVEL);
  }

  if (bands) {
    const centre = `${parseFloat(bands.dataset.cx) || 0},${parseFloat(bands.dataset.cy) || 0}`;
    const shift = `${(x * BANDS_TRAVEL).toFixed(1)},${(y * BANDS_TRAVEL).toFixed(1)}`;
    bands.setAttribute('transform', `rotate(${BANDS_ANGLE},${centre}) translate(${shift})`);
  }

  for (const layer of layers) {
    const depth = depthOf(layer);
    const reach = PARALLAX_PX[Math.min(depth, PARALLAX_PX.length - 1)];
    const shift = `translate(${(x * reach).toFixed(2)}px, ${(y * reach * 0.7).toFixed(2)}px)`;
    layer.style.transform = depth === 0 ? `${shift} ${BACKGROUND_SCALE}` : shift;
  }

  if (glossStops.length) {
    const centre = 0.5 + x * GLOSS_SWEEP_X + y * GLOSS_SWEEP_Y;
    [centre - GLOSS_BAND, centre, centre + GLOSS_BAND].forEach((offset, index) => {
      glossStops[index].setAttribute('offset', unit(offset).toFixed(4));
    });
  }
}

export function resetFoil(card) {
  const { tilt, layers } = partsOf(card);

  delete card.dataset.foilActive;

  if (tilt) {
    tilt.style.setProperty('--foil-rx', '0');
    tilt.style.setProperty('--foil-ry', '0');
  }
  for (const layer of layers) {
    layer.style.transform = depthOf(layer) === 0 ? BACKGROUND_SCALE : '';
  }
}
