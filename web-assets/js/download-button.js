const DOWNLOADS = 'https://download.hextalegame.com/installatore/';
const BUILDS = [
  { key: 'win', name: 'Windows', file: 'Hextale-Setup.exe' },
  { key: 'intel', name: 'MacOS (Intel)', file: 'Hextale-x64.dmg' },
  { key: 'arm', name: 'MacOS (Apple Silicon)', file: 'Hextale-arm64.dmg' },
];
const ARROW = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">'
  + '<path d="M5 8.5 12 15.5 19 8.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const EDGE_GAP = 12;

const openMenus = new Set();

function isMac() {
  const data = navigator.userAgentData;
  if (data && typeof data.platform === 'string') return /mac/i.test(data.platform);
  return /Mac|iPad|iPhone/i.test(navigator.platform || navigator.userAgent || '');
}

function graphicsCard() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
  } catch {
    return '';
  }
}

function macBuildFromGraphics() {
  const card = graphicsCard();
  if (/Apple\s*(M\d|GPU|Silicon)/i.test(card)) return 'arm';
  if (/Intel|AMD|Radeon/i.test(card)) return 'intel';
  return 'arm';
}

async function detectBuild() {
  if (!isMac()) return 'win';

  const data = navigator.userAgentData;
  if (data && data.getHighEntropyValues) {
    try {
      const { architecture } = await data.getHighEntropyValues(['architecture']);
      if (architecture === 'arm') return 'arm';
      if (architecture === 'x86') return 'intel';
    } catch {
      return macBuildFromGraphics();
    }
  }
  return macBuildFromGraphics();
}

function setUpButton(link, detected) {
  let build = detected;

  link.href = DOWNLOADS + build.file;
  if (link.dataset.scarica !== 'menu') return;

  const label = link.querySelector('.etichetta') || link;
  const title = label.textContent.trim();
  const prefix = link.dataset.scaricaPrefisso || 'Download for';

  label.classList.add('scarica-a-due');
  label.innerHTML = '<span class="scarica-titolo"></span>'
    + '<span class="scarica-sotto" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false">'
    + `<span class="prefisso"></span> <span class="quale"></span>${ARROW}</span>`;
  label.querySelector('.scarica-titolo').textContent = title;
  label.querySelector('.prefisso').textContent = prefix;

  const chosen = label.querySelector('.quale');
  const toggle = label.querySelector('.scarica-sotto');
  chosen.textContent = build.name;

  const group = document.createElement('span');
  group.className = 'scarica-gruppo';
  link.before(group);
  group.append(link);

  const menu = document.createElement('div');
  menu.className = 'scarica-menu';
  menu.hidden = true;
  document.body.append(menu);

  const place = () => {
    const button = link.getBoundingClientRect();

    menu.style.minWidth = `${Math.max(260, button.width * 0.92)}px`;
    menu.style.visibility = 'hidden';
    menu.style.left = '0px';
    menu.style.top = '0px';

    const box = menu.getBoundingClientRect();
    const maxLeft = document.documentElement.clientWidth - box.width - EDGE_GAP;
    const left = Math.max(EDGE_GAP, Math.min(button.left + button.width / 2 - box.width / 2, maxLeft));
    let top = button.top + button.height * 0.58;
    if (top + box.height > window.innerHeight - EDGE_GAP) {
      top = Math.max(EDGE_GAP, button.top - box.height + button.height * 0.42);
    }

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    menu.style.visibility = '';
  };

  const follow = () => {
    if (!menu.hidden) place();
  };

  const close = () => {
    menu.hidden = true;
    group.classList.remove('aperto');
    toggle.setAttribute('aria-expanded', 'false');
    window.removeEventListener('scroll', follow, true);
    window.removeEventListener('resize', follow);
    openMenus.delete(close);
  };

  const choose = (picked) => {
    build = picked;
    link.href = DOWNLOADS + build.file;
    chosen.textContent = build.name;
    close();
  };

  const fill = () => {
    const ordered = [build, ...BUILDS.filter((other) => other !== build)];

    menu.replaceChildren(...ordered.map((option, index) => {
      const item = document.createElement('a');
      item.href = DOWNLOADS + option.file;
      item.innerHTML = `<span></span>${index === 0 ? ARROW : ''}`;
      item.querySelector('span').textContent = option.name;
      item.addEventListener('click', () => choose(option));
      return item;
    }));
  };

  const open = () => {
    openMenus.forEach((closeOther) => closeOther());
    openMenus.add(close);

    fill();
    menu.hidden = false;
    place();
    group.classList.add('aperto');
    toggle.setAttribute('aria-expanded', 'true');
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
  };

  const flip = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (menu.hidden) open();
    else close();
  };

  fill();

  toggle.addEventListener('click', flip);
  toggle.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') flip(event);
  });
  group.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      close();
      toggle.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!group.contains(event.target) && !menu.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
}

async function init() {
  const links = document.querySelectorAll('[data-scarica]');
  if (!links.length) return;

  const key = await detectBuild();
  const build = BUILDS.find((candidate) => candidate.key === key) || BUILDS[0];
  links.forEach((link) => setUpButton(link, build));
}

init();
