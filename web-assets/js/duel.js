import { reducedMotion } from './media.js';
import { loadSprites, randomSprite } from './particles.js';

const STEPS = [
  [0, 'atterra'],
  [530, 'affondo'],
  [730, 'colpo'],
  [888, 'conquistata'],
  [1045, 'traballa'],
];
const STATES = STEPS.map(([, state]) => state);
const LEAD_MS = 900;
const HOLD_MS = 4300;
const FADE_MS = 350;

const SHARD_COUNT = 5;
const SHARD_FAN = Math.PI * 0.42;
const HIT_ANGLE = Math.atan2(-0.866, -0.5);
const HIT_CENTRE = { x: 145, y: 225 };
const TILE_SIZE = 240;
const UNMEASURED_SCALE = 2.2;

const random = (min, max) => min + Math.random() * (max - min);

function burst(layer) {
  for (let i = 0; i < SHARD_COUNT; i++) {
    const angle = HIT_ANGLE + random(-0.5, 0.5) * SHARD_FAN;
    const reach = TILE_SIZE * random(0.35, 1);
    const size = random(9, 15);
    const x = HIT_CENTRE.x + Math.cos(angle) * TILE_SIZE * 0.12 + random(-0.125, 0.125) * TILE_SIZE;
    const y = HIT_CENTRE.y + Math.sin(angle) * TILE_SIZE * 0.12 + random(-0.125, 0.125) * TILE_SIZE;
    const dx = Math.cos(angle) * reach;
    const dy = Math.sin(angle) * reach;
    const spin = random(0, 360);
    const endSpin = spin + random(-120, 120);
    const sprite = randomSprite();

    const shard = document.createElement('span');
    shard.className = 'scheggia';
    shard.style.width = `${size}px`;
    shard.style.height = `${size}px`;
    shard.style.left = `${x - size / 2}px`;
    shard.style.top = `${y - size / 2}px`;
    shard.style.backgroundImage = `url(${sprite.image.src})`;
    shard.style.backgroundSize = `${(sprite.scale || UNMEASURED_SCALE) * 100}%`;
    layer.append(shard);

    shard.animate([
      { transform: `rotate(${spin}deg)`, opacity: 1 },
      {
        transform: `translate(${dx * 0.8}px, ${dy * 0.8}px) rotate(${(spin + endSpin) / 2}deg) scale(0.85)`,
        opacity: 0.9,
        offset: 0.5,
      },
      { transform: `translate(${dx}px, ${dy}px) rotate(${endSpin}deg) scale(0.45)`, opacity: 0 },
    ], { duration: random(560, 920), easing: 'cubic-bezier(.12, .82, .3, 1)', fill: 'forwards' });
  }
}

export function initDuel() {
  const scene = document.getElementById('duello');
  if (!scene) return;

  if (reducedMotion.matches) {
    scene.classList.add('atterra', 'conquistata');
    return;
  }

  const shards = scene.querySelector('.schegge');
  let timers = [];

  const later = (delay, action) => timers.push(setTimeout(action, delay));

  const reset = () => {
    timers.forEach(clearTimeout);
    timers = [];
    scene.classList.remove('spenta', ...STATES);
    shards.replaceChildren();
  };

  const play = () => {
    for (const [time, state] of STEPS) {
      later(LEAD_MS + time, () => {
        scene.classList.add(state);
        if (state === 'colpo') burst(shards);
      });
    }

    later(LEAD_MS + HOLD_MS, () => {
      scene.classList.add('spenta');
      later(FADE_MS, () => {
        reset();
        play();
      });
    });
  };

  loadSprites();

  new IntersectionObserver(([entry]) => {
    reset();
    if (entry.isIntersecting) play();
  }, { threshold: 0.35 }).observe(scene);
}
