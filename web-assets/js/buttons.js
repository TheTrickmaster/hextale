const LABEL_ROOM = 188;
const DEFAULT_LABEL_SIZE = 26;
const MIN_LABEL_SIZE = 16;

function fitLabels() {
  document.querySelectorAll('.btn .etichetta').forEach((label) => {
    label.style.fontSize = '';

    let size = parseFloat(getComputedStyle(label).fontSize) || DEFAULT_LABEL_SIZE;
    while (label.scrollWidth > LABEL_ROOM && size > MIN_LABEL_SIZE) {
      size -= 1;
      label.style.fontSize = `${size}px`;
    }
  });
}

function trackPressedCursor() {
  const { classList } = document.body;

  document.addEventListener('mousedown', () => classList.add('mouse-down'));
  document.addEventListener('mouseup', () => classList.remove('mouse-down'));
  document.addEventListener('mouseleave', () => classList.remove('mouse-down'));
}

export function initButtons() {
  trackPressedCursor();

  document.fonts.ready.then(fitLabels);
  window.addEventListener('load', fitLabels);
  window.addEventListener('resize', fitLabels);
}
