const bar = document.getElementById('barra');
const heroButtons = document.querySelector('#cappello .bottoni');

let queued = false;

function update() {
  if (!bar) return;

  const heroInView = heroButtons && heroButtons.getBoundingClientRect().bottom > 0;

  bar.classList.toggle('staccata', window.scrollY > 40);
  bar.classList.toggle('via', Boolean(heroInView));
}

function requestUpdate() {
  if (queued) return;

  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    update();
  });
}

function revealOnScroll() {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('dentro-vista');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.06 });

  document.querySelectorAll('.entra').forEach((element) => observer.observe(element));
}

export function initScroll() {
  revealOnScroll();
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  window.addEventListener('load', requestUpdate);
  update();
}
