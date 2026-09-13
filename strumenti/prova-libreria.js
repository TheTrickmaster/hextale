// Il banco di Library & Decks col Figma nuovo (v0.80.15).
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-libreria.js
//
// Lorenzo: la barra in alto e' la top-bar di Card packs col conto delle carte
// sotto al titolo; la colonna dei mazzi e' piu' bassa e le caselle sono dieci;
// la barra in basso cerca le carte per nome e apre i filtri. Il banco guarda:
//   1. le misure del Figma (top-bar, lista delle carte, barra, colonna);
//   2. che la ricerca trovi per nome senza badare a maiuscole, accenti e spazi,
//      e che si sommi ai filtri invece di sostituirli;
//   3. che l'ultima fila possa salire sopra alla barra, o resterebbe coperta;
//   4. dieci caselle, ma nessun mazzo nascosto a chi ne aveva undici o dodici;
//   5. che il pannello di modifica stia nella colonna piu' bassa senza che
//      niente si schiacci o esca di sotto.
// Offline il foglio ha quattro carte: il banco le clona fino a quaranta.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var radice = document.getElementById('game-root').getBoundingClientRect(), k = radice.width / 1920;
  var r = function(el){ var b = el.getBoundingClientRect(); return { x:(b.left-radice.left)/k, y:(b.top-radice.top)/k, w:b.width/k, h:b.height/k }; };
  var vicino = function(a, b, t){ return Math.abs(a - b) <= (t === undefined ? 0.6 : t); };
  var tondo = function(q){ return [q.x, q.y, q.w, q.h].map(function(v){ return Math.round(v*100)/100; }).join(','); };
  var scatola = function(el, x, y, w, h){ var q = r(el); return vicino(q.x, x) && vicino(q.y, y) && vicino(q.w, w) && vicino(q.h, h); };
  var visibili = function(){ return [...document.querySelectorAll('#card-db-grid .card-db-card-slot')].filter(function(s){ return s.dataset.filterHidden !== 'true' && s.style.display !== 'none'; }); };
  var scrivi = async function(v){ var c = document.getElementById('card-db-cerca'); c.value = v; c.dispatchEvent(new Event('input', { bubbles:true })); await respira(700); };
  try {
    var sp = document.getElementById('splash'); if(sp) sp.remove();
    var base = FINAL_CARDS.slice();
    for(var i = 1; FINAL_CARDS.length < 40; i++){
      base.forEach(function(c){ if(FINAL_CARDS.length < 40) FINAL_CARDS.push(Object.assign({}, c, { id:String(c.id)+'-k'+i, slug:c.slug+'-k'+i, name:(i % 2 ? 'Fox ' : c.name + ' ') + i })); });
    }
    CARTE_POSSEDUTE = {};
    FINAL_CARDS.forEach(function(c){ CARTE_POSSEDUTE[c.slug] = 4; });
    _possessoNoto = true;
    var ids = FINAL_CARDS.map(function(c){ return String(c.id); });
    MAZZI.length = 0;
    for(var m = 0; m < 4; m++) MAZZI.push({ id:'prova'+m, nome:'Deck '+m, carte:ids.slice(m*3, m*3+12) });
    MAZZO_SCELTO = 'prova0';
    var errori = [];
    var ce = console.error;
    console.error = function(){ errori.push([].join.call(arguments, ' ')); ce.apply(console, arguments); };
    openCardDbOverlay();
    await respira(600);
    try{ cardDbFermaCascata(document.getElementById('card-db-grid')); }catch(e){}
    await respira(1200);
    dice(!errori.some(function(e){ return e.indexOf('[libreria] mancano') >= 0; }), 'nessun pezzo della libreria manca (PEZZI_LIBRERIA)', errori.length);
    dice(PEZZI_LIBRERIA.some(function(p){ return p[0] === 'card-db-cerca'; }), 'la ricerca e- fra i pezzi che devono esserci');

    // ── 1. la top-bar ────────────────────────────────────────────────────
    var testa = document.getElementById('card-db-header');
    dice(testa.classList.contains('hx-topbar') && vicino(r(testa).h, 90), 'la barra in alto e- la top-bar di Unpack, alta 90', tondo(r(testa)));
    dice(scatola(document.getElementById('library-back'), 12, 12, 150, 66), 'Back a (12,12) 150x66', tondo(r(document.getElementById('library-back'))));
    dice(scatola(document.getElementById('card-db-toggle-variant'), 1758, 12, 150, 66), 'il colore a (1758,12) 150x66', tondo(r(document.getElementById('card-db-toggle-variant'))));
    var h1 = testa.querySelector('.hx-topbar-titolo h1');
    dice(h1 && h1.textContent === 'Library & decks' && getComputedStyle(h1).fontSize === '36px', 'titolo "Library & decks" a 36', h1 && h1.textContent);
    var conto = document.getElementById('card-db-count');
    var cs = getComputedStyle(conto);
    dice(conto.parentElement.classList.contains('hx-topbar-titolo'), 'il conto sta dentro allo stendardo');
    dice(conto.textContent === '40/40', 'il conto dice possedute/totali', conto.textContent);
    dice(vicino(r(conto).y, 59) && cs.fontSize === '16px' && cs.color === 'rgb(198, 207, 208)', 'sotto al titolo: cima a 59, 16px, C6CFD0', r(conto).y + ' ' + cs.fontSize + ' ' + cs.color);
    var mezzo = r(conto).x + r(conto).w / 2;
    dice(vicino(mezzo, 960.5, 1), 'centrato sullo stendardo (mezzo pixel a destra)', Math.round(mezzo*100)/100);
    dice(!document.getElementById('library-titlebar') && !testa.querySelector('#library-filters'), 'la vecchia barra a tre pezzi e il pulsante dei filtri in alto non ci sono piu-');

    // ── la lista delle carte ─────────────────────────────────────────────
    dice(scatola(document.getElementById('card-db-grid-viewport'), 32, 81, 1424, 999), 'la lista: 1424 a partire da 32, fino in fondo', tondo(r(document.getElementById('card-db-grid-viewport'))));
    var s = visibili();
    dice(s.length === 40, 'quaranta carte a schermo', s.length);
    dice(vicino(r(s[0]).x, 50.67) && vicino(r(s[0]).y, 106) && vicino(r(s[0]).w, 252.34), 'la prima carta a (50.67,106), larga 252.34', tondo(r(s[0])));
    dice(vicino(r(s[1]).x - r(s[0]).x, 282.34), 'fra una colonna e l-altra 282.34 (30 di spazio)', Math.round((r(s[1]).x - r(s[0]).x)*100)/100);
    dice(vicino(r(s[5]).y - r(s[0]).y, r(s[0]).h + 30), 'fra una fila e l-altra 30 di spazio', Math.round((r(s[5]).y - r(s[0]).y)*100)/100);

    // ── la barra in basso ────────────────────────────────────────────────
    var barra = document.getElementById('card-db-barra-cerca');
    dice(scatola(barra, 358, 970, 771, 80), 'la barra: 771x80 a (358,970)', tondo(r(barra)));
    dice(vicino(r(barra).x + r(barra).w / 2, 32 + 1424 / 2, 1), 'centrata sulla lista delle carte, non sullo schermo');
    var campo = document.querySelector('.card-db-cerca-campo');
    dice(vicino(r(campo).h, 48) && document.getElementById('card-db-cerca').placeholder === 'Search card', 'il campo alto 48 dice "Search card"', r(campo).h);
    dice(document.getElementById('card-db-cerca-icona').naturalWidth > 0 && document.getElementById('library-filters-icona').naturalWidth > 0, 'le icone della lente e dei filtri sono caricate');
    var filtri = document.getElementById('library-filters');
    dice(barra.contains(filtri) && filtri.textContent.trim() === 'Filters', '"Filters" sta nella barra in basso');
    filtri.click();
    await respira(300);
    dice(document.getElementById('filters-overlay').classList.contains('show'), 'e apre la finestra dei filtri');
    chiudiFiltri();
    await respira(300);

    // ── 2. la ricerca ────────────────────────────────────────────────────
    await scrivi('fox');
    dice(visibili().length === 20, '"fox" trova le venti Fox', visibili().length);
    dice(visibili().every(function(x){ return x.dataset.nome.indexOf('fox') >= 0; }), 'e solo loro');
    await scrivi('  F\\u00d3X   1 ');
    dice(visibili().length === 4, 'maiuscole, accenti e spazi doppi non contano', visibili().length);
    await scrivi('fox');
    var rarita = visibili()[0].dataset.rarity;
    var casella = document.querySelector('#card-db-rarity-filter-options input[data-rarity-filter="' + rarita + '"]');
    var attese = [...document.querySelectorAll('#card-db-grid .card-db-card-slot')].filter(function(x){ return x.dataset.nome.indexOf('fox') >= 0 && x.dataset.rarity === rarita; }).length;
    if(casella){
      casella.checked = true; casella.dispatchEvent(new Event('change', { bubbles:true }));
      await respira(700);
      dice(visibili().length === attese && attese < 20, 'la ricerca si somma al filtro della rarita-', visibili().length + ' su ' + attese + ' attese');
      casella.checked = false; casella.dispatchEvent(new Event('change', { bubbles:true }));
      await respira(700);
      dice(visibili().length === 20, 'togliendo il filtro resta la ricerca', visibili().length);
    } else dice(false, 'la casella della rarita- ' + rarita + ' esiste');
    await scrivi('');
    dice(visibili().length === 40, 'il campo vuoto le rimette tutte', visibili().length);

    // ── 3. l-ultima fila sale sopra alla barra ───────────────────────────
    var griglia = document.getElementById('card-db-grid');
    griglia.scrollTop = griglia.scrollHeight;
    await respira(300);
    s = visibili();
    var fondo = r(s[s.length - 1]).y + r(s[s.length - 1]).h;
    dice(fondo < 970 && fondo > 900, 'scorsa in fondo, l-ultima fila finisce appena sopra alla barra', Math.round(fondo));
    griglia.scrollTop = 0;

    // ── 4. la colonna e le dieci caselle ─────────────────────────────────
    var colonna = document.getElementById('card-db-right');
    dice(scatola(colonna, 1485, 106, 423, 962) && getComputedStyle(colonna).borderTopLeftRadius === '28px', 'la colonna: 423x962 a (1485,106), angoli da 28', tondo(r(colonna)));
    dice(MAZZI_SLOT === 10, 'le caselle sono dieci', MAZZI_SLOT);
    var caselle = [...document.querySelectorAll('#deck-list .deck-slot')];
    var tipi = function(cl){ return caselle.filter(function(c){ return c.classList.contains(cl); }).length; };
    dice(caselle.length === 10 && tipi('deck-slot-piena') === 4 && tipi('deck-slot-add') === 1 && tipi('deck-slot-vuota') === 5, 'con quattro mazzi: quattro piene, "crea" e cinque vuote', tipi('deck-slot-piena') + '/' + tipi('deck-slot-add') + '/' + tipi('deck-slot-vuota'));
    dice(caselle.every(function(c){ return vicino(r(c).w, 381) && vicino(r(c).h, 70); }), 'caselle 381x70');
    dice(vicino(r(caselle[1]).y - r(caselle[0]).y, 80), 'dieci di spazio fra una casella e l-altra', r(caselle[1]).y - r(caselle[0]).y);
    var importa = document.querySelector('.deck-importa');
    dice(vicino(r(importa).h, 48) && vicino(r(importa).y + r(importa).h, 106 + 962 - 1 - 20), 'il campo per importare, alto 48, appoggiato in fondo', tondo(r(importa)));
    dice(r(document.querySelector('.deck-lista-riga')).h > 20, 'la separazione si prende lo spazio che avanza', r(document.querySelector('.deck-lista-riga')).h);

    // ── 5. il pannello di modifica ───────────────────────────────────────
    apriModificaMazzo('prova0');
    await respira(900);
    var aperta = document.querySelector('.deck-slot-piena.in-modifica');
    var p = aperta.querySelector('.deck-edit');
    dice(vicino(r(aperta).h, 920), 'la riga aperta riempie la colonna', r(aperta).h);
    dice(p.scrollHeight <= p.clientHeight, 'il pannello ci sta', p.scrollHeight + ' in ' + p.clientHeight);
    var salva = p.querySelector('.deck-edit-save');
    dice(r(salva).y + r(salva).h <= r(aperta).y + r(aperta).h - 16 + 0.6, 'Save non esce di sotto', Math.round(r(salva).y + r(salva).h));
    dice(vicino(r(p.querySelector('.hx-capacity')).h, 8) && vicino(r(p.querySelector('.deck-distrib')).h, 54), 'niente si schiaccia: barra 8, distribuzione 54', r(p.querySelector('.hx-capacity')).h + ' ' + r(p.querySelector('.deck-distrib')).h);
    dice(vicino(r(p.querySelector('.deck-edit-top')).y - r(aperta).y, 24), 'il nome parte a 24 dal bordo, come nel Figma', r(p.querySelector('.deck-edit-top')).y - r(aperta).y);
    _mazzoInModifica = null; _mazzoInModificaId = null;

    // ── chi ha gia- dieci, o dodici, mazzi ───────────────────────────────
    for(m = 4; m < 10; m++) MAZZI.push({ id:'prova'+m, nome:'Deck '+m, carte:ids.slice(0, 12) });
    renderListaMazzi();
    caselle = [...document.querySelectorAll('#deck-list .deck-slot')];
    dice(caselle.length === 10 && tipi('deck-slot-add') === 0, 'con dieci mazzi niente "crea"', caselle.length + ' ' + tipi('deck-slot-add'));
    for(m = 10; m < 12; m++) MAZZI.push({ id:'prova'+m, nome:'Deck '+m, carte:ids.slice(0, 12) });
    renderListaMazzi();
    caselle = [...document.querySelectorAll('#deck-list .deck-slot')];
    var lista = document.getElementById('deck-list');
    dice(tipi('deck-slot-piena') === 12, 'con dodici mazzi (di prima) si vedono tutti e dodici', tipi('deck-slot-piena'));
    dice(lista.scrollHeight > lista.clientHeight && getComputedStyle(lista).overflowY === 'auto', 'e la lista scorre', lista.scrollHeight + ' > ' + lista.clientHeight);
  } catch(e){
    dice(false, 'il banco e- arrivato in fondo', e.message);
  }
  return d.join('\\n');
})()`;

app.whenReady().then(async () => {
  setTimeout(() => { console.log('  NO  il banco non ha finito in tempo'); app.exit(2); }, 120000);
  const win = new BrowserWindow({ show:false, width:1920, height:1080, frame:false, useContentSize:true,
    webPreferences:{ contextIsolation:false, webSecurity:false, backgroundThrottling:false } });
  await win.loadURL(pathToFileURL(path.join(__dirname, '..', 'play', 'index.html')).href);
  win.setPosition(-3200, 0); win.showInactive();
  await new Promise(r => setTimeout(r, 12000));
  await win.webContents.insertCSS('#splash{display:none!important} #tutorial-overlay{display:none!important}');
  const esito = await win.webContents.executeJavaScript(CORPO);
  console.log(esito);
  const no = (esito.match(/^  NO  /gm) || []).length;
  const ok = (esito.match(/^  ok  /gm) || []).length;
  console.log('\n' + ok + ' ok, ' + no + ' NO');
  app.exit(no ? 1 : 0);
});
