// IL BOTTONE DI DOWNLOAD, CON LA TENDINA DELLE VERSIONI.
//
//   <script defer src="/scarica-app.js"></script>
//   <a class="btn important" data-scarica="menu" href="…/Hextale-Setup.exe"> … </a>
//
// Lorenzo (21/09/2026): "una freccetta sul pulsante di download che se cliccata
// apre un dropdown che ti fa scegliere tra le varie versioni: windows, mac
// intel, mac silicon. Ovviamente se windows o mac lo facciamo rilevare in
// automatico dal browser, e mettiamo come versione mac predefinita quella piu'
// comune."
//
// COSA SA IL BROWSER, E COSA NO.
//   - Windows o Mac: lo dice, e si puo' credergli.
//   - Apple Silicon o Intel: NO. Safari su un Mac M4 dichiara ancora
//     "Intel Mac OS X 10_15_7" — Apple ha congelato quella stringa apposta — e
//     non esiste nessun campo standard che dica il processore. Due appigli
//     parziali: userAgentData.architecture, che c'e' solo su Chrome e derivati,
//     e il nome della scheda grafica via WebGL, che su Apple Silicon contiene
//     "Apple M…". Si usano tutti e due, ma restano deduzioni: per questo la
//     tendina mostra SEMPRE tutte e tre le voci, e non si scarica mai da soli
//     il file sbagliato. Un .dmg per l'architettura sbagliata non si apre.
//   Dal 2020 i Mac nuovi sono tutti Apple Silicon: quando non si capisce, e'
//   quella la scelta predefinita (Lorenzo: "la piu' comune").
//
// NIENTE MEMORIA NEL BROWSER: la scelta vale per il click, non viene salvata
// (regola di Lorenzo: nel browser non si scrive niente).
'use strict';
(function () {
  var DEPOSITO = 'https://download.hextalegame.com/installatore/';
  var VERSIONI = [
    { chiave: 'win',   nome: 'Windows',              file: 'Hextale-Setup.exe' },
    { chiave: 'intel', nome: 'MacOS (Intel)',        file: 'Hextale-x64.dmg' },
    { chiave: 'arm',   nome: 'MacOS (Apple Silicon)', file: 'Hextale-arm64.dmg' },
  ];
  var di = function (chiave) { for (var i = 0; i < VERSIONI.length; i++) if (VERSIONI[i].chiave === chiave) return VERSIONI[i]; return VERSIONI[0]; };

  // ── che macchina e' ────────────────────────────────────────────────────────
  function suMac() {
    var d = navigator.userAgentData;
    if (d && typeof d.platform === 'string') return /mac/i.test(d.platform);
    return /Mac|iPad|iPhone/i.test(navigator.platform || navigator.userAgent || '');
  }
  // Il nome della scheda grafica: su Apple Silicon ci si legge "Apple M…" o
  // "Apple GPU", su un Mac Intel "Intel" o "AMD". Se il browser lo nasconde
  // (alcuni lo fanno per non farsi riconoscere) non si sa, e va bene cosi'.
  function grafica() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return '';
      var info = gl.getExtension('WEBGL_debug_renderer_info');
      var nome = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      return String(nome || '');
    } catch (e) { return ''; }
  }
  function mac64OArm(finita) {
    var g = grafica();
    if (/Apple\s*(M\d|GPU|Silicon)/i.test(g)) return finita('arm');
    if (/Intel|AMD|Radeon/i.test(g)) return finita('intel');
    finita('arm');   // nel dubbio, la macchina che si vende da cinque anni
  }
  function riconosci(finita) {
    if (!suMac()) return finita('win');
    var d = navigator.userAgentData;
    if (d && d.getHighEntropyValues) {
      // Solo Chrome e derivati: quando c'e', e' la risposta vera.
      d.getHighEntropyValues(['architecture']).then(function (v) {
        if (v && v.architecture === 'arm') return finita('arm');
        if (v && v.architecture === 'x86') return finita('intel');
        mac64OArm(finita);
      }).catch(function () { mac64OArm(finita); });
      return;
    }
    mac64OArm(finita);
  }

  // ── la veste ───────────────────────────────────────────────────────────────
  // Sta qui e non nel foglio di stile di ogni pagina: il bottone e' uno solo, e
  // le pagine che lo usano sono quattro.
  var STILE = ''
    + '.scarica-gruppo{ position:relative; display:inline-flex; }'
    // `a.scarica-a-due` e non solo `.scarica-a-due`: la pagina /scarica/ veste il
    // suo bottone con `a.scarica`, che ha la stessa forza — e a parita' vince chi
    // arriva dopo, cioe' noi. Senza, le due righe restavano appaiate.
    + 'a.scarica-a-due, .scarica-a-due{ display:flex; flex-direction:column; align-items:center; gap:3px; line-height:1; }'
    + '.scarica-titolo{ font-size:1em; }'
    + '.scarica-sotto{ display:inline-flex; align-items:center; gap:7px; font-size:.66em; opacity:.92; cursor:pointer; }'
    + '.scarica-sotto .quale{ text-decoration:underline; text-underline-offset:3px; }'
    + '.scarica-sotto svg{ width:.72em; height:.72em; transition:transform .18s ease; }'
    + '.scarica-gruppo.aperto .scarica-sotto svg{ transform:rotate(180deg); }'
    // La tendina vive in fondo alla pagina e non dentro al bottone: le sezioni
    // del sito tagliano cio' che esce dai loro bordi (overflow), e la tendina
    // e' piu' alta del bottone — restava mozzata a meta'.
    + '.scarica-menu{ position:fixed; z-index:400; padding:14px; box-sizing:border-box;'
    + '  background:rgba(38,54,60,.93); border:1px solid rgba(233,222,197,.18); border-radius:16px;'
    + '  box-shadow:0 22px 48px rgba(0,0,0,.55); backdrop-filter:blur(6px);'
    + '  display:flex; flex-direction:column; gap:10px; }'
    + '.scarica-menu[hidden]{ display:none; }'
    + '.scarica-menu a{ display:flex; align-items:center; justify-content:center; gap:7px;'
    + '  padding:13px 16px; border-radius:10px; background:rgba(233,222,197,.07);'
    + "  font-family:'Marcellus SC',Georgia,serif; font-size:20px; line-height:1; color:#EDE0C6;"
    + '  text-decoration:none; white-space:nowrap; transition:background .16s ease; }'
    + '.scarica-menu a span{ text-decoration:underline; text-underline-offset:3px; }'
    + '.scarica-menu a:hover, .scarica-menu a:focus-visible{ background:rgba(233,222,197,.16); outline:none; }'
    + '.scarica-menu svg{ width:14px; height:14px; }'
    + '@media (max-width:520px){ .scarica-menu a{ font-size:17px; padding:11px 12px; } }';

  var FRECCIA = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">'
    + '<path d="M5 8.5 12 15.5 19 8.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function vesti() {
    var s = document.createElement('style');
    s.setAttribute('data-scarica-app', '');
    s.textContent = STILE;
    document.head.appendChild(s);
  }

  // ── il bottone ─────────────────────────────────────────────────────────────
  var aperti = [];
  function chiudiTutti(tranne) {
    for (var i = 0; i < aperti.length; i++) if (aperti[i] !== tranne) aperti[i].chiudi();
  }

  function preparaUno(a, scelta) {
    var modo = a.getAttribute('data-scarica');
    a.href = DEPOSITO + scelta.file;
    if (modo !== 'menu') return;   // il bottone piccolo: solo l'indirizzo giusto

    var etichetta = a.querySelector('.etichetta') || a;
    var titolo = etichetta.textContent.trim();
    etichetta.classList.add('scarica-a-due');
    // "Download for Windows" sul bottone del sito; una pagina che dice gia'
    // "Download" nel titolo usa solo "for" (data-scarica-prefisso).
    var prefisso = a.getAttribute('data-scarica-prefisso') || 'Download for';
    etichetta.innerHTML = '<span class="scarica-titolo"></span>'
      + '<span class="scarica-sotto" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false">'
      + '<span class="prefisso"></span> <span class="quale"></span>' + FRECCIA + '</span>';
    etichetta.querySelector('.scarica-titolo').textContent = titolo;
    etichetta.querySelector('.prefisso').textContent = prefisso;
    var quale = etichetta.querySelector('.quale');
    var sotto = etichetta.querySelector('.scarica-sotto');
    quale.textContent = scelta.nome;

    // Il bottone va dentro a un gruppo, perche' la tendina si appoggia a lui.
    var gruppo = document.createElement('span');
    gruppo.className = 'scarica-gruppo';
    a.parentNode.insertBefore(gruppo, a);
    gruppo.appendChild(a);

    var menu = document.createElement('div');
    menu.className = 'scarica-menu';
    menu.hidden = true;
    document.body.appendChild(menu);

    // Si appoggia al bottone: sotto la riga che dice quale versione, centrata su
    // di lui, e rientra da sola se il bordo della finestra e' vicino.
    function posiziona() {
      var r = a.getBoundingClientRect();
      menu.style.minWidth = Math.max(260, r.width * 0.92) + 'px';
      menu.style.visibility = 'hidden';
      menu.style.left = '0px';
      menu.style.top = '0px';
      var m = menu.getBoundingClientRect();
      var x = r.left + r.width / 2 - m.width / 2;
      x = Math.max(12, Math.min(x, document.documentElement.clientWidth - m.width - 12));
      var y = r.top + r.height * 0.58;
      if (y + m.height > window.innerHeight - 12) y = Math.max(12, r.top - m.height + r.height * 0.42);
      menu.style.left = Math.round(x) + 'px';
      menu.style.top = Math.round(y) + 'px';
      menu.style.visibility = '';
    }

    // La versione scelta sta in cima, con la freccia: e' quella che il bottone
    // scaricherebbe adesso. Si rifa' a ogni apertura, perche' la scelta cambia.
    function riempi() {
      menu.innerHTML = '';
      var ordinate = [scelta].concat(VERSIONI.filter(function (v) { return v !== scelta; }));
      ordinate.forEach(function (v, i) {
        var voce = document.createElement('a');
        voce.href = DEPOSITO + v.file;
        voce.innerHTML = '<span></span>' + (i === 0 ? FRECCIA : '');
        voce.querySelector('span').textContent = v.nome;
        voce.addEventListener('click', function () { scegli(v); });
        menu.appendChild(voce);
      });
    }
    riempi();

    function scegli(v) {
      scelta = v;
      a.href = DEPOSITO + v.file;
      quale.textContent = v.nome;
      chiudi();
    }
    function apri() {
      chiudiTutti(api);
      riempi();
      menu.hidden = false;
      posiziona();
      gruppo.classList.add('aperto');
      sotto.setAttribute('aria-expanded', 'true');
      window.addEventListener('scroll', segui, true);
      window.addEventListener('resize', segui);
    }
    function chiudi() {
      menu.hidden = true;
      gruppo.classList.remove('aperto');
      sotto.setAttribute('aria-expanded', 'false');
      window.removeEventListener('scroll', segui, true);
      window.removeEventListener('resize', segui);
    }
    function segui() { if (!menu.hidden) posiziona(); }
    var api = { chiudi: chiudi };
    aperti.push(api);

    // Cliccare la riga di sotto apre la tendina invece di scaricare: e' la
    // riga che dice QUALE versione, ed e' li' che si va a cambiarla.
    sotto.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (menu.hidden) apri(); else chiudi();
    });
    sotto.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); e.stopPropagation(); if (menu.hidden) apri(); else chiudi(); }
    });
    gruppo.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { chiudi(); sotto.focus(); }
    });
    document.addEventListener('click', function (e) { if (!gruppo.contains(e.target) && !menu.contains(e.target)) chiudi(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') chiudi(); });
  }

  function prepara() {
    var bottoni = document.querySelectorAll('[data-scarica]');
    if (!bottoni.length) return;
    vesti();
    riconosci(function (chiave) {
      var scelta = di(chiave);
      for (var i = 0; i < bottoni.length; i++) preparaUno(bottoni[i], scelta);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', prepara);
  else prepara();
})();
