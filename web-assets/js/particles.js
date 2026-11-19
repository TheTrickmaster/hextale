const SPRITE_COUNT = 12;
const INK_ALPHA = 30;

const sprites = [];

function inkScale(image) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0);

  const { data } = context.getImageData(0, 0, width, height);
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= INK_ALPHA) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  const ink = Math.max(right - left + 1, bottom - top + 1);
  return ink > 0 ? Math.max(width, height) / ink : 1;
}

export function loadSprites() {
  if (sprites.length) return;

  for (let i = 1; i <= SPRITE_COUNT; i++) {
    const sprite = { image: new Image(), scale: 0 };

    sprite.image.onload = () => {
      sprite.scale = inkScale(sprite.image);
    };
    sprite.image.src = `/ui/particles/particle${String(i).padStart(2, '0')}.png`;
    sprites.push(sprite);
  }
}

export function randomSprite() {
  return sprites[Math.floor(Math.random() * sprites.length)];
}
