export function initFaq() {
  const list = document.getElementById('lista-faq');
  if (!list) return;

  const fit = (item) => {
    const answer = item.querySelector('.risposta');
    answer.style.height = `${answer.firstElementChild.offsetHeight}px`;
    return answer;
  };

  const open = (item) => {
    item.classList.add('aperta');
    item.querySelector('button').setAttribute('aria-expanded', 'true');
    fit(item);
  };

  const close = (item) => {
    item.classList.remove('aperta');
    item.querySelector('button').setAttribute('aria-expanded', 'false');

    const answer = fit(item);
    void answer.offsetHeight;
    answer.style.height = '0px';
  };

  const refit = () => {
    const item = list.querySelector('.domanda.aperta');
    if (item) fit(item);
  };

  list.addEventListener('click', (event) => {
    const button = event.target.closest('.domanda > button');
    if (!button) return;

    const item = button.parentNode;
    const wasOpen = item.classList.contains('aperta');

    list.querySelectorAll('.domanda.aperta').forEach(close);
    if (!wasOpen) open(item);
  });

  window.addEventListener('resize', refit);
  window.addEventListener('load', refit);
  document.fonts.ready.then(refit);

  const first = list.querySelector('.domanda');
  if (first) open(first);
}
