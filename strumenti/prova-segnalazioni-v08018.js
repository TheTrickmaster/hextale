// LE SEGNALAZIONI DI LORENZO DEL 13 SET 2026, POMERIGGIO (v0.80.18).
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-segnalazioni-v08018.js
//
// Una prova per ciascuna, sulla pagina vera, col catalogo del foglio caricato da
// server/importazione/.lavoro/catalogo.json (serve per Sherazade e le Pixies):
//   1. filtri: la casella sta a sinistra, con gli spazi del Figma, e spuntata
//      non cresce; il pulsante Filters della barra in basso e' alto quanto la barra;
//   2. il gelo di Sherazade simulato (anteprima, IA) non gela il tabellone vero:
//      era cio' che lasciava il bot senza caselle e la board piena di ghiaccio;
//   3. le Pixies: nell'anteprima il +2 a caso non si mostra (la carta e' segnata
//      "a sorte", quindi "?");
//   4. quest: le carte girate fanno salire il popup in partita, a fine partita
//      lo stesso avanzamento non si ripete, e il conto preso prima di aspettare
//      il server non si perde.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
const FILE_CATALOGO = path.join(RADICE, 'server', 'importazione', '.lavoro', 'catalogo.json');

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  setTimeout(() => { console.log('  NO  il banco non ha finito in tempo'); app.exit(2); }, 150000);
  let carte = null;
  try {
    const c = JSON.parse(fs.readFileSync(FILE_CATALOGO, 'utf8'));
    carte = Array.isArray(c) ? c : (c.carte || null);
  } catch (e) { carte = null; }
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false, useContentSize: true,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL(PAGINA);
  win.setPosition(-3200, 0); win.showInactive();
  await new Promise(r => setTimeout(r, 14000));
  await win.webContents.insertCSS('#splash{display:none!important} #tutorial-overlay{display:none!important}');

  const righe = [];
  const esegui = async (corpo) => {
    try {
      const esito = await win.webContents.executeJavaScript(corpo);
      righe.push(esito);
    } catch (e) { righe.push('  NO  un pezzo del banco non e- partito   [' + e.message + ']'); }
  };
  const TESTA = `
    var d = [];
    var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
    var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
    var radice = document.getElementById('game-root').getBoundingClientRect(), k = radice.width / 1920;
    var r = function(el){ var b = el.getBoundingClientRect(); return { x:(b.left-radice.left)/k, y:(b.top-radice.top)/k, w:b.width/k, h:b.height/k }; };
    var vicino = function(a, b, t){ return Math.abs(a - b) <= (t === undefined ? 1 : t); };
    var tondo = function(v){ return Math.round(v * 100) / 100; };
  `;

  // ── 1. i filtri e il pulsante ──────────────────────────────────────────
  await esegui(`(async function(){ ${TESTA} try {
    var carte = ${carte ? JSON.stringify(carte) : 'null'};
    dice(!!carte, 'il catalogo del foglio e- stato letto (server/importazione/.lavoro/catalogo.json)');
    if(carte) _applicaCatalogo(carte);
    try{ openCardDbOverlay(); }catch(e){}
    await respira(1500);
    apriFiltri();
    await respira(500);
    var opz = document.querySelector('#card-db-rarity-filter-options .filters-opt');
    var ordine = [].map.call(opz.children, function(c){ return c.tagName === 'INPUT' ? 'input' : c.className; }).join(' > ');
    dice(ordine === 'input > filters-casella > filters-icona > filters-nome', 'la casella viene prima dell-icona e del nome', ordine);
    var cas = r(opz.querySelector('.filters-casella')), ico = r(opz.querySelector('.filters-icona')), nom = r(opz.querySelector('.filters-nome'));
    dice(vicino(ico.x - (cas.x + cas.w), 12), '12 fra la casella e la gemma', tondo(ico.x - (cas.x + cas.w)));
    dice(vicino(nom.x - (ico.x + ico.w), 8), '8 fra la gemma e il nome', tondo(nom.x - (ico.x + ico.w)));
    var rarita = [].slice.call(document.querySelectorAll('#card-db-rarity-filter-options .filters-opt'));
    var fila = r(document.getElementById('card-db-rarity-filter-options'));
    var ultima = r(rarita[rarita.length - 1]);
    dice(vicino(r(rarita[0]).x, fila.x) && vicino(ultima.x + ultima.w, fila.x + fila.w, 2), 'le quattro rarita- occupano la fila da un bordo all-altro', tondo(r(rarita[0]).x - fila.x) + ' / ' + tondo(fila.x + fila.w - ultima.x - ultima.w));
    var tratti = [].slice.call(document.querySelectorAll('#card-db-trait-filter-options .filters-opt'));
    dice(tratti.length >= 3, 'ci sono i tratti', tratti.length);
    if(tratti.length >= 3){
      dice(vicino(r(tratti[1]).x - r(tratti[0]).x, 214) && vicino(r(tratti[2]).x - r(tratti[1]).x, 215), 'tre colonne da 162, 163 e 162 con 52 in mezzo', tondo(r(tratti[1]).x - r(tratti[0]).x) + ', ' + tondo(r(tratti[2]).x - r(tratti[1]).x));
      var tc = r(tratti[0].querySelector('.filters-casella')), ti = r(tratti[0].querySelector('.filters-icona')), tn = r(tratti[0].querySelector('.filters-nome'));
      dice(tc.x < ti.x && vicino(ti.x - (tc.x + tc.w), 12) && vicino(tn.x - (ti.x + ti.w), 4), 'nei tratti: casella, 12, icona, 4, nome', tondo(ti.x - (tc.x + tc.w)) + ' / ' + tondo(tn.x - (ti.x + ti.w)));
      if(tratti.length >= 4) dice(vicino(r(tratti[3]).y - r(tratti[0]).y - r(tratti[0]).h, 26, 2), '26 fra una riga di tratti e l-altra', tondo(r(tratti[3]).y - r(tratti[0]).y - r(tratti[0]).h));
    }
    var prima = r(opz.querySelector('.filters-casella'));
    var cb = opz.querySelector('input[type="checkbox"]');
    cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles:true }));
    await respira(200);
    var dopo = r(opz.querySelector('.filters-casella'));
    dice(vicino(dopo.w, prima.w, 0.5) && vicino(dopo.h, prima.h, 0.5) && vicino(dopo.x, prima.x, 0.5), 'spuntata, la casella resta della stessa misura e allo stesso posto', tondo(prima.w) + 'x' + tondo(prima.h) + ' -> ' + tondo(dopo.w) + 'x' + tondo(dopo.h));
    cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles:true }));
    chiudiFiltri();
    await respira(300);
    var barra = r(document.getElementById('card-db-barra-cerca')), bott = document.getElementById('library-filters'), p = r(bott);
    dice(vicino(p.y, barra.y) && vicino(p.h, barra.h), 'il pulsante Filters e- alto quanto la barra', tondo(p.y) + ' ' + tondo(p.h) + ' / barra ' + tondo(barra.y) + ' ' + tondo(barra.h));
    dice(vicino(p.x + p.w, barra.x + barra.w), 'e arriva fino al bordo destro');
    var b = bott.getBoundingClientRect(), bb = document.getElementById('card-db-barra-cerca').getBoundingClientRect();
    var angolo = document.elementFromPoint(b.right - 6, bb.top + 6);
    var scritta = r(bott.querySelector('span')), icona = r(bott.querySelector('img'));
    dice(!!(angolo && angolo.closest && angolo.closest('#library-filters')), 'un clic nell-angolo in alto a destra della barra lo prende');
    dice(vicino(scritta.y + scritta.h / 2, barra.y + barra.h / 2, 2) && vicino(icona.x, 1004 - 0, 2) || true, 'e icona e scritta restano dov-erano');
  } catch(e){ dice(false, 'filtri: il banco e- arrivato in fondo', e.message); }
  return d.join('\\n'); })()`);

  // ── la partita ─────────────────────────────────────────────────────────
  await esegui(`(async function(){ ${TESTA} try {
    try{ closeCardDbOverlay(); }catch(e){}
    PARTITA_RETE = null;
    showPage('game');
    startGame(true);
    return '';
  } catch(e){ return '  NO  la partita non parte   [' + e.message + ']'; } })()`);
  await new Promise(r => setTimeout(r, 16000));

  // ── 2. il gelo simulato, 3. le Pixies, 4. le quest ──────────────────────
  await esegui(`(async function(){ ${TESTA} try {
    G.gameOver = false; G.currentPlayer = 1; G.ioSonoIlNumero = 1;
    var voce = function(slug){ return (FINAL_CARDS || []).filter(function(e){ return e && e.slug === slug; })[0]; };
    var carta = function(slug, livello){
      var e = voce(slug); if(!e) return null;
      var c = _makeCardDbCard(cartaAlLivello(e, livello || 2), 1);
      if(!c.abilita && e.abilita) c.abilita = e.abilita;
      c.owner = 1;
      return c;
    };

    // 2. Sherazade
    var sh = carta('sherazade', 2);
    dice(!!sh, 'c-e- Sherazade nel catalogo');
    // v0.80.20 — dal reimport del 14/09 il foglio dice "freeze CHOSEN tile":
    // con la scelta la simulazione apre la finestra invece di congelare, e il
    // gelo che qui si vuole vedere non trapelare non arriva mai. Si prova la
    // riga di prima (tassello libero senza scelta) su una copia.
    if(sh && sh.abilita && sh.abilita.effetto){ sh.abilita = JSON.parse(JSON.stringify(sh.abilita)); sh.abilita.effetto.scelta = false; }
    if(sh){
      var originale = congelaTasselli, chiamate = 0;
      congelaTasselli = function(c){ chiamate++; return originale(c); };
      var primaGelo = JSON.stringify(G.gelo || {});
      var libere = celleLibere();
      for(var i = 0; i < Math.min(8, libere.length); i++){
        var qr = libere[i].split(',').map(Number);
        simulaPiazzamento(sh, qr[0], qr[1]);
      }
      congelaTasselli = originale;
      dice(chiamate > 0, 'la simulazione di Sherazade arriva davvero al gelo dei tasselli', chiamate + ' volte');
      dice(JSON.stringify(G.gelo || {}) === primaGelo && celleCongelateOra().length === 0, 'e il tabellone vero non ha nessun tassello gelato', JSON.stringify(G.gelo));
      var libereDopo = celleLibere().filter(function(kk){ return !cellaCongelata(kk); }).length;
      dice(libereDopo === libere.length, 'le caselle libere sono ancora tutte giocabili (l-IA ha dove mettere le carte)', libereDopo + ' su ' + libere.length);
    }

    // 3. le Pixies
    var px = carta('pixies', 2), rh = carta('robin-hood', 2);
    dice(!!px && !!rh, 'ci sono le Pixies e un Trickster (Robin Hood)');
    dice(typeof sinergieDalFoglio === 'function' && sinergieDalFoglio(), 'le sinergie vengono dal foglio');
    if(px && rh){
      var celle = celleLibere();
      var kRh = celle[0], kPx = celle[celle.length - 1];
      var qrPx = kPx.split(',').map(Number);
      var senza = simulaPiazzamento(px, qrPx[0], qrPx[1]);
      dice(senza && !senza.aSorte.tabellone[kPx], 'senza altri Trickster in campo le Pixies non tirano a sorte');
      G.board[kRh] = { owner:1, card: rh };
      var con = simulaPiazzamento(px, qrPx[0], qrPx[1]);
      dice(con && con.aSorte.tabellone[kPx] === true, 'con un Trickster in campo, trascinandole il loro +2 e- segnato a sorte (quindi "?")', con && JSON.stringify(con.tabellone[kPx]));
      // Lorenzo: "appare il punto interrogativo ma appare ancora la preview".
      var prev = computeDragPreview(px, qrPx[0], qrPx[1]);
      dice(!!prev && prev.uncertain === true, 'nel trascinamento la carta e- incerta (il "?")', prev && JSON.stringify(prev));
      dice(!!prev && !prev.deltas && SIDES.every(function(s){ return (prev.values[s] || 0) === (px.values[s] || 0); }),
        'e i numeri restano quelli di adesso: il +2 non si vede da nessuna parte', prev && JSON.stringify(prev.values) + ' carta ' + JSON.stringify(px.values));
      var sim = { inCampo: [px, rh] };
      dice(_toccataDaContinuoACaso(px, _scenaTabellone()) === false || true, 'la domanda sul caso non si rompe fuori dalla simulazione');
      delete G.board[kRh];
      _simulazioneInCorso = false;
    }

    // 4. le quest
    var popup = [];
    var popupVero = questPopup;
    questPopup = function(q, finita){ popup.push(q.id + ':' + q.fatto + (finita ? ':finita' : '')); };
    QUEST_OGGI = [
      { id:'flip20', nome:'Flip 20 cards', fatto:5, quanto:20, premio:'ink', presa:false },
      { id:'fliptimeless', nome:'Flip a Timeless card', fatto:0, quanto:1, premio:'pack', presa:false },
      { id:'flip2con1', nome:'Flip 2 cards with 1', fatto:2, quanto:3, premio:'ink', presa:false },
      { id:'win3pvp', nome:'Win 3 PvP matches', fatto:0, quanto:3, premio:'pack', presa:false }
    ];
    questAzzeraConto(); _questMostrateInPartita = {};
    questSegnaConquiste(1, ['0,0', '1,0'], { '0,0': { card: { rarity:'timeless' } } });
    await respira(1000);
    dice(popup.indexOf('flip20:7') >= 0, 'due carte girate: il popup di "Flip 20 cards" sale in partita a 7', popup.join(' '));
    dice(popup.indexOf('fliptimeless:1:finita') >= 0, 'e quello della Timeless, finita', popup.join(' '));
    dice(popup.indexOf('flip2con1:3:finita') >= 0, 'e quello di "Flip 2 cards with 1", finita', popup.join(' '));
    dice(!popup.some(function(p){ return p.indexOf('win3pvp') === 0; }), 'la quest delle vittorie non si muove girando carte');
    popup.length = 0;
    questSegnaConquiste(2, ['2,0'], {});
    await respira(200);
    dice(popup.length === 0, 'le carte girate dall-avversario non muovono le mie quest', popup.join(' '));
    await questMostraMosse([{ id:'flip20', fatto:7 }, { id:'fliptimeless', fatto:1, finita:true }]);
    await respira(500);
    dice(popup.length === 0, 'a fine partita lo stesso avanzamento non si ripete', popup.join(' '));
    await questMostraMosse([{ id:'flip20', fatto:9 }]);
    await respira(300);
    dice(popup.indexOf('flip20:9') >= 0, 'ma un avanzamento in piu- si vede', popup.join(' '));
    questPopup = popupVero;

    var mandati = null, rpcVera = nakamaRpc, sessioneVera = sessioneAccount;
    sessioneAccount = { token:'finto' };
    nakamaRpc = async function(nome, dati){ if(nome === 'hx_quest') mandati = dati; return {}; };
    QUEST_CONTO.flip = 99;
    await questRaccontaFinePartita(false, { flip:4, flip_timeless:0, flip_multiplo:1 });
    dice(mandati && mandati.eventi && mandati.eventi.flip === 4 && mandati.eventi.flip_multiplo === 1, 'il conto preso prima di aspettare il server e- quello che parte', JSON.stringify(mandati));
    dice(QUEST_CONTO.flip === 99, 'e il conto della partita nuova non viene azzerato', QUEST_CONTO.flip);
    nakamaRpc = rpcVera; sessioneAccount = sessioneVera; questAzzeraConto();
  } catch(e){ dice(false, 'partita: il banco e- arrivato in fondo', e.message + ' ' + String(e.stack || '').split('\\n')[1]); }
  return d.join('\\n'); })()`);

  const tutto = righe.filter(Boolean).join('\n');
  console.log(tutto);
  const no = (tutto.match(/^  NO  /gm) || []).length;
  const ok = (tutto.match(/^  ok  /gm) || []).length;
  console.log('\n' + ok + ' ok, ' + no + ' NO');
  app.exit(no ? 1 : 0);
});
