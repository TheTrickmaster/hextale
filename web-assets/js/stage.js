function fitStages() {
  for (const stage of document.querySelectorAll('.palco')) {
    const shell = stage.parentNode;

    if (getComputedStyle(stage).position === 'static') {
      shell.style.height = '';
      continue;
    }

    const width = parseFloat(stage.dataset.largo);
    const height = parseFloat(stage.dataset.alto);
    const scale = Math.min(1, shell.clientWidth / width);

    stage.style.width = `${width}px`;
    stage.style.height = `${height}px`;
    stage.style.marginLeft = `${-width / 2}px`;
    stage.style.transform = `scale(${scale.toFixed(4)})`;
    shell.style.height = `${Math.round(height * scale)}px`;
  }
}

export function initStages() {
  window.addEventListener('resize', fitStages);
  window.addEventListener('load', fitStages);
  fitStages();
}
