const CONTACT_ENDPOINT = 'https://api.hextalegame.com/contatto';
const RECAPTCHA_KEY = '6LcHza4tAAAAANKA7-KguwbNTWynByVPHYi4G4QG';
const LEGAL_PAGES = ['terms', 'privacy', 'cookies'];
const FOCUS_DELAY_MS = 60;

let recaptcha = null;

function loadRecaptcha() {
  if (recaptcha) return recaptcha;

  const notice = document.getElementById('c-google');
  if (notice) notice.hidden = false;

  recaptcha = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(RECAPTCHA_KEY)}`;
    script.async = true;
    script.onload = () => window.grecaptcha.ready(() => resolve(window.grecaptcha));
    script.onerror = () => reject(new Error('reCAPTCHA failed to load'));
    document.head.appendChild(script);
  });
  return recaptcha;
}

function recaptchaToken() {
  return loadRecaptcha()
    .then((api) => api.execute(RECAPTCHA_KEY, { action: 'contatto' }))
    .catch(() => '');
}

function show(dialog) {
  dialog.classList.add('aperta');
  dialog.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function hide(dialog) {
  dialog.classList.remove('aperta');
  dialog.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function initContact() {
  const dialog = document.getElementById('contatto');
  const form = document.getElementById('modulo-contatto');
  if (!dialog || !form) return;

  const email = document.getElementById('c-email');
  const message = document.getElementById('c-messaggio');
  const status = document.getElementById('c-esito');
  const submit = document.getElementById('c-invia');
  let opener = null;

  const open = (from) => {
    opener = from;
    loadRecaptcha().catch(() => {});
    show(dialog);
    setTimeout(() => email.focus(), FOCUS_DELAY_MS);
  };

  const close = () => {
    hide(dialog);
    if (opener) opener.focus();
  };

  const say = (kind, text) => {
    status.className = kind ? `esito ${kind}` : 'esito';
    status.textContent = text;
  };

  document.querySelectorAll('#apri-contatto, #apri-contatto-piede').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      open(button);
    });
  });

  document.getElementById('chiudi-contatto').addEventListener('click', close);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dialog.classList.contains('aperta')) close();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const address = email.value.trim();
    const text = message.value.trim();

    if (address.indexOf('@') < 1) {
      say('no', 'Please write a valid email address.');
      return;
    }
    if (text.length < 10) {
      say('no', 'Please write a little more, so we can actually help.');
      return;
    }

    submit.disabled = true;
    say('', 'Sending…');

    try {
      const token = await recaptchaToken();
      const response = await fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: address, messaggio: text, gettone: token }),
      });
      if (!response.ok) throw new Error(`Contact request failed: ${response.status}`);

      form.reset();
      say('ok', 'Thank you — your message is on its way. We answer everything.');
      setTimeout(close, 2600);
    } catch {
      say('no', 'Something went wrong. Please write to support@hextalegame.com directly.');
    } finally {
      submit.disabled = false;
    }
  });
}

function initLegal() {
  let current = null;
  let opener = null;

  const close = ({ keepHash = false } = {}) => {
    if (!current) return;

    hide(current);
    current = null;
    if (!keepHash) history.replaceState(null, '', location.pathname + location.search);
    if (opener) opener.focus();
  };

  const open = (name, from = null) => {
    const dialog = LEGAL_PAGES.includes(name) && document.getElementById(`legale-${name}`);
    if (!dialog) return;

    if (current && current !== dialog) close({ keepHash: true });
    current = dialog;
    opener = from;
    show(dialog);

    const text = dialog.querySelector('.scorre');
    text.scrollTop = 0;
    setTimeout(() => text.focus(), FOCUS_DELAY_MS);

    if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
  };

  const openFromHash = () => open(location.hash.slice(1));

  document.querySelectorAll('[data-legale]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      open(link.dataset.legale, link);
    });
  });

  document.querySelectorAll('.legale').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) close();
    });
    dialog.querySelector('[data-chiudi-legale]').addEventListener('click', () => close());
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  window.addEventListener('hashchange', openFromHash);

  openFromHash();
}

export function initDialogs() {
  initContact();
  initLegal();
}
