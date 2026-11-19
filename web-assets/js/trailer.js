const PERMISSIONS = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';

export function initTrailer() {
  const screen = document.getElementById('video-schermo');
  if (!screen) return;

  const play = () => {
    const id = screen.dataset.youtube;
    if (!id || screen.classList.contains('acceso')) return;

    const player = document.createElement('iframe');
    player.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
    player.title = 'Hextale';
    player.allow = PERMISSIONS;
    player.allowFullscreen = true;
    player.loading = 'lazy';

    screen.classList.add('acceso');
    screen.removeAttribute('role');
    screen.removeAttribute('tabindex');
    screen.append(player);
  };

  screen.addEventListener('click', play);
  screen.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    play();
  });
}
