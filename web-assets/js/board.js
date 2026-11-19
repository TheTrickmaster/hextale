import { reducedMotion } from './media.js';
import { loadSprites, randomSprite } from './particles.js';

const SPIRAL = [0, 1, 2, 11, 12, 13, 3, 10, 17, 18, 14, 4, 9, 16, 15, 5, 8, 7, 6];
const CENTRE = 9;
const TILE_STAGGER_MS = 1110 / 18;
const FILL_MS = 1410;
const WALL_COUNTS = [3, 5];
const WALL_VARIANTS = 4;
const WALL_STAGGER_MS = 220;
const LAND_MS = 520;
const GROWTH_MS = 1900;
const HOLD_MS = 3200;
const FADE_MS = 400;

const VINES_WIDTH = 1264.8;
const VINES_HEIGHT = 1097.4;
const SOFT_TIP = 0.22;
const MAP_WIDTH = 272;
const SPARKS_PER_SECOND = 110;
const SPARK_SCALE = 0.93;

const random = (min, max) => min + Math.random() * (max - min);
const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - (2 - 2 * p) ** 2 / 2);

function shuffled(items) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function pickWalls(cellCount) {
  const count = WALL_COUNTS[Math.floor(Math.random() * WALL_COUNTS.length)];
  const free = shuffled([...Array(cellCount).keys()].filter((index) => index !== CENTRE));
  const variants = shuffled([...Array(WALL_VARIANTS).keys()]);

  return free.slice(0, count).sort((a, b) => a - b).map((cell, slot) => ({
    cell,
    variant: variants[slot % WALL_VARIANTS] + 1,
    delay: FILL_MS + slot * WALL_STAGGER_MS,
  }));
}

function branchMap(image) {
  const height = Math.round(MAP_WIDTH * image.naturalHeight / image.naturalWidth);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = MAP_WIDTH;
  canvas.height = height;
  context.drawImage(image, 0, 0, MAP_WIDTH, height);

  const { data } = context.getImageData(0, 0, MAP_WIDTH, height);
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (data[(y * MAP_WIDTH + x) * 4 + 3] > 90) row.push(x);
    }
    rows.push(row);
  }

  const scale = Math.min(VINES_WIDTH / image.naturalWidth, VINES_HEIGHT / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const drawnHeight = image.naturalHeight * scale;

  return {
    rows,
    width,
    height: drawnHeight,
    left: (VINES_WIDTH - width) / 2,
    top: (VINES_HEIGHT - drawnHeight) / 2,
  };
}

function pointOnBranch(map, frontY) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const y = frontY + random(-0.025, 0.025) * VINES_HEIGHT;
    const row = map.rows[Math.floor((y - map.top) / map.height * map.rows.length)];
    if (!row || !row.length) continue;

    const column = row[Math.floor(Math.random() * row.length)];
    return { x: map.left + (column + Math.random()) / MAP_WIDTH * map.width, y };
  }
  return null;
}

function createSparks(canvas, vines) {
  const context = canvas.getContext('2d');
  let map = null;
  let sparks = [];
  let frame = null;
  let start = 0;
  let last = 0;

  canvas.width = Math.round(VINES_WIDTH);
  canvas.height = Math.round(VINES_HEIGHT);

  const tick = (time) => {
    const elapsed = Math.min(64, time - last);
    const progress = (time - start) / GROWTH_MS;
    const front = VINES_HEIGHT * (1 + SOFT_TIP / 2 - easeInOut(Math.min(1, progress)) * (1 + SOFT_TIP));
    last = time;

    if (map && progress < 1 && front > 0 && front < VINES_HEIGHT) {
      let due = SPARKS_PER_SECOND * elapsed / 1000;
      while (due >= 1 || Math.random() < due) {
        due -= 1;
        const point = pointOnBranch(map, front);
        if (!point) continue;

        sparks.push({
          ...point,
          speedX: random(-30, 30) * SPARK_SCALE,
          speedY: -random(40, 150) * SPARK_SCALE,
          radius: random(8, 18) * SPARK_SCALE,
          born: time,
          life: random(650, 1300),
          sprite: randomSprite(),
        });
      }
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    sparks = sparks.filter((spark) => time - spark.born < spark.life);

    for (const spark of sparks) {
      spark.x += spark.speedX * elapsed / 1000;
      spark.y += spark.speedY * elapsed / 1000;
      spark.speedY *= 0.985;
      spark.speedX += random(-4, 4);

      if (!spark.sprite.scale) continue;

      const age = (time - spark.born) / spark.life;
      const radius = spark.radius * (1 - age * 0.6) * spark.sprite.scale;
      context.globalAlpha = age < 0.15 ? age / 0.15 : 1 - (age - 0.15) / 0.85;
      context.drawImage(spark.sprite.image, spark.x - radius, spark.y - radius, radius * 2, radius * 2);
    }

    frame = progress < 1 || sparks.length ? requestAnimationFrame(tick) : null;
  };

  return {
    start() {
      if (!map && vines.complete && vines.naturalWidth) map = branchMap(vines);
      sparks = [];
      start = last = performance.now();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    },
    stop() {
      cancelAnimationFrame(frame);
      frame = null;
      context.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}

export function initBoard() {
  const board = document.getElementById('tabellone');
  if (!board) return;

  const cells = [...board.querySelectorAll('.casella')];

  const placeWalls = () => {
    const walls = pickWalls(cells.length);

    for (const { cell, variant, delay } of walls) {
      const wall = document.createElement('b');
      wall.className = `muro m${variant}`;
      wall.style.animationDelay = `${delay}ms`;
      cells[cell].classList.add('murata');
      cells[cell].append(wall);
    }
    return walls.length;
  };

  const clearWalls = () => {
    for (const cell of cells) {
      cell.classList.remove('murata');
      cell.replaceChildren();
    }
  };

  if (reducedMotion.matches) {
    placeWalls();
    return;
  }

  const sparks = createSparks(board.querySelector('.scintille'), board.querySelector('.rami'));
  let timers = [];

  const later = (delay, action) => timers.push(setTimeout(action, delay));

  const reset = () => {
    timers.forEach(clearTimeout);
    timers = [];
    sparks.stop();
    board.classList.remove('gira', 'spento');
    clearWalls();
  };

  const play = () => {
    const wallCount = placeWalls();
    const length = FILL_MS + (wallCount - 1) * WALL_STAGGER_MS + LAND_MS;

    void board.offsetWidth;
    board.classList.add('gira');
    sparks.start();

    later(Math.max(length, GROWTH_MS) + HOLD_MS, () => {
      board.classList.add('spento');
      later(FADE_MS, () => {
        reset();
        board.classList.add('spento');
        play();
        board.classList.remove('spento');
      });
    });
  };

  cells.forEach((cell, index) => {
    cell.style.animationDelay = `${Math.round(SPIRAL[index] * TILE_STAGGER_MS)}ms`;
  });

  loadSprites();

  new IntersectionObserver(([entry]) => {
    reset();
    if (entry.isIntersecting) play();
  }, { threshold: 0.3 }).observe(board);
}
