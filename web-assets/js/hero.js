import { reducedMotion } from './media.js';

const random = (min, max) => min + Math.random() * (max - min);

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
  startLogoShine();
}
