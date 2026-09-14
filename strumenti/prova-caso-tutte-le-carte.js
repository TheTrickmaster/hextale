// IL CASO NON SI VEDE IN ANTEPRIMA, CARTA PER CARTA (v0.80.18).
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-caso-tutte-le-carte.js
//
// Lorenzo (13 set 2026): "quando c'e' incertezza, mostra sempre i '?' e mai i
// valori in anteprima. Fai un check di tutte le carte."
// Non si fa l'elenco a mano delle carte "a sorte": si chiede alla simulazione.
// Per OGNI carta del catalogo (server/importazione/.lavoro/catalogo.json, al
// livello 4 perche' l'abilita' sia sbloccata) si simula il piazzamento sulla
// stessa casella dello stesso tabellone piu' volte, cambiando solo il seme del
// caso (G._semeSinergie; le abilita' scritte a mano usano Math.random, che
// cambia da se'). Se il risultato cambia fra una prova e l'altra, a decidere e'
// il caso, e allora:
//   - la carta trascinata e' incerta ("?") e non mostra numeri simulati;
//   - ogni carta in campo o in mano i cui numeri cambiano e' segnata a sorte.
// In piu', per ogni carta: la simulazione non lascia niente sulla partita vera
// (gelo, premio per la prossima giocata, briciole, muri).
// E il premio "sulla prossima carta" a lato RAND (Tin Woodman) si prova a parte.
const { app, BrowserWindow } = require('electron');
require('./dal-disco');   // v0.80.22 — gli asset di hextalegame.com dal disco, non dal sito
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
const FILE_CATALOGO = path.join(RADICE, 'server', 'importazione', '.lavoro', 'catalogo.json');
const PROVE = 6;

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  setTimeout(() => { console.log('  NO  il banco non ha finito in tempo'); app.exit(2); }, 300000);
  let carte = null;
  try { const c = JSON.parse(fs.readFileSync(FILE_CATALOGO, 'utf8')); carte = Array.isArray(c) ? c : (c.carte || null); } catch (e) { carte = null; }
  if (!carte) { console.log('  NO  catalogo non letto: ' + FILE_CATALOGO); app.exit(1); return; }
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false, useContentSize: true,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL(PAGINA);
  win.setPosition(-3200, 0); win.showInactive();
  await new Promise(r => setTimeout(r, 14000));
  await win.webContents.insertCSS('#splash{display:none!important} #tutorial-overlay{display:none!important}');

  await win.webContents.executeJavaScript(`(function(){ try{
    _applicaCatalogo(${JSON.stringify(carte)});
    PARTITA_RETE = null; showPage('game'); startGame(true); return 'ok';
  }catch(e){ return e.message; } })()`);
  await new Promise(r => setTimeout(r, 16000));

  const esito = await win.webContents.executeJavaScript(`(async function(){
    var d = [], contaOk = 0, aSorte = [], senzaEffetto = 0, guaste = [];
    var dice = function(ok, n, x){ if(ok){ contaOk++; if(x !== 'zitto') d.push('  ok  ' + n); } else d.push('  NO  ' + n + (x !== undefined ? '   [' + x + ']' : '')); };
    try {
      G.gameOver = false; G.currentPlayer = 1; G.ioSonoIlNumero = 1;
      var voce = function(slug){ return (FINAL_CARDS || []).filter(function(e){ return e && e.slug === slug; })[0]; };
      var nuova = function(e, owner){ var c = _makeCardDbCard(cartaAlLivello(e, 4), owner); if(!c.abilita && e.abilita) c.abilita = e.abilita; c.owner = owner; return c; };
      var conTratto = function(t, salta){ return (FINAL_CARDS || []).filter(function(e){ return e && !soloEvocabile(e) && (e.traits || []).indexOf(t) >= 0 && (salta || []).indexOf(e.slug) < 0; })[0]; };

      // ── la scena: una casella in mezzo, vicini di tratti diversi, e due mani ──
      // Due giri: nel secondo alleati e nemici si scambiano, cosi' ogni tratto si
      // prova da tutte e due le parti (Dorothy, per dire, vuole un Explorer ALLEATO).
      var libere, centro;
      var tratti = ['trickster', 'explorer', 'small', 'wild', 'princess', 'noble'];
      var montaScena = function(scambia){
        G.board = {}; G.gelo = {}; G.premioProssimaGiocata = {}; G.briciole = {};
        libere = celleLibere();
        centro = libere.map(function(k){ var p = k.split(',').map(Number); return { k:k, q:p[0], r:p[1], vicini: DIRS.map(function(dd){ return key(p[0]+dd.dq, p[1]+dd.dr); }).filter(function(v){ return libere.indexOf(v) >= 0; }) }; })
          .sort(function(a, b){ return b.vicini.length - a.vicini.length; })[0];
        var usate = [];
        centro.vicini.slice(0, 5).forEach(function(v, i){
          var e = conTratto(tratti[i], usate); if(!e) return; usate.push(e.slug);
          var o = ((i % 2 === 0) !== !!scambia) ? 1 : 2;
          G.board[v] = { owner: o, card: nuova(e, o) };
        });
        G.p1Hand = [conTratto('trickster', usate), conTratto('small', usate), conTratto('explorer', usate)].filter(Boolean).map(function(e){ return nuova(e, 1); });
        G.p2Hand = [conTratto('wild', usate), conTratto('noble', usate)].filter(Boolean).map(function(e){ return nuova(e, 2); });
        d.push('scena ' + (scambia ? '2 (alleati e nemici scambiati)' : '1') + ': casella ' + centro.k + ', ' + Object.keys(G.board).length + ' vicini, mani ' + G.p1Hand.length + '+' + G.p2Hand.length);
      };

      var semeVero = G._semeSinergie;
      var fotoPartita = function(){ return JSON.stringify({ gelo: G.gelo || {}, premio: G.premioProssimaGiocata || {}, briciole: G.briciole || {},
        pescata: G.bonusProssimaPescata || null, rimozioni: G.rimozioniInAttesa || null, ultimaConquista: G.ultimaConquista || null,
        muri: G.holes ? [].concat(Array.from(G.holes)).sort() : [], rotti: G.destroyedHoles ? [].concat(Array.from(G.destroyedHoles)).sort() : [] }); };
      var impronta = function(es){
        var o = {};
        for(var k in es.tabellone) o['t:' + k] = JSON.stringify(es.tabellone[k]);
        for(var p in es.mani) for(var id in es.mani[p]) o['m' + p + ':' + id] = JSON.stringify(es.mani[p][id]);
        return o;
      };
      var giocabili = (FINAL_CARDS || []).filter(function(e){ return e && !soloEvocabile(e); });
      for(var giro = 0; giro < 2; giro++){
      montaScena(giro === 1);
      for(var n = 0; n < giocabili.length; n++){
        var e = giocabili[n];
        var carta = nuova(e, 1);
        var primaPartita = fotoPartita();
        var viste = [], rotta = null;
        for(var i = 0; i < ${PROVE}; i++){
          G._semeSinergie = 'prova-caso-' + i;
          var es = null;
          try{ es = simulaPiazzamento(carta, centro.q, centro.r); }catch(err){ rotta = err.message; }
          if(!es){ rotta = rotta || 'simulazione nulla'; break; }
          viste.push(impronta(es));
        }
        G._semeSinergie = semeVero;
        dice(fotoPartita() === primaPartita, e.slug + ': la simulazione non lascia niente sulla partita vera', fotoPartita() === primaPartita ? 'zitto' : fotoPartita().slice(0, 160));
        G.gelo = {}; G.premioProssimaGiocata = {}; G.briciole = {};
        if(rotta){ guaste.push(e.slug + ' (' + rotta + ')'); continue; }
        var cambiano = [];
        Object.keys(viste[0]).forEach(function(kk){ if(viste.some(function(v){ return v[kk] !== viste[0][kk]; })) cambiano.push(kk); });
        if(!cambiano.length){ senzaEffetto++; continue; }
        aSorte.push(e.slug);
        // la stessa anteprima che vede il giocatore: seme vero, una simulazione sola
        var vista = simulaPiazzamento(carta, centro.q, centro.r);
        var cellaMia = 't:' + centro.k;
        if(cambiano.indexOf(cellaMia) >= 0){
          var prev = computeDragPreview(carta, centro.q, centro.r);
          var stessi = prev && SIDES.every(function(s){ return (prev.values[s] || 0) === (carta.values[s] || 0); });
          dice(!!prev && prev.uncertain === true && !prev.deltas && stessi,
            e.slug + ': trascinata, "?" e nessun numero simulato', prev ? JSON.stringify({ incerta: prev.uncertain, delta: prev.deltas, valori: prev.values }) : 'nessuna anteprima');
        }
        cambiano.filter(function(kk){ return kk !== cellaMia; }).forEach(function(kk){
          var segnata;
          if(kk.indexOf('t:') === 0) segnata = !!vista.aSorte.tabellone[kk.slice(2)];
          else { var p = kk.charAt(1), id = kk.slice(3); segnata = !!vista.aSorte.mani[p][id]; }
          dice(segnata, e.slug + ': ' + (kk.indexOf('t:') === 0 ? 'la carta in campo ' : 'la carta in mano ') + kk.slice(kk.indexOf(':') + 1) + ' cambia a caso ed e- segnata "?"', viste.map(function(v){ return v[kk]; }).join(' | ').slice(0, 200));
        });
      }
      }
      var uniche = aSorte.filter(function(v, i, a){ return a.indexOf(v) === i; });
      d.push('carte provate: ' + giocabili.length + ' (due giri); coi numeri a sorte in anteprima: ' + uniche.length + ' (' + uniche.join(', ') + ')');
      dice(guaste.length === 0, 'nessuna simulazione si rompe', guaste.join('; '));

      // ── il premio sulla prossima carta, a lato RAND (Tin Woodman) ──
      var tin = voce('tin-woodman');
      var semplice = nuova(conTratto('noble', []), 1);
      G.premioProssimaGiocata = { 1: { quanto: 2, ambito: 'RAND', chiave: 'tin', da: 'Tin Woodman', postoDa: tin ? 'tin-prova' : 'x' } };
      var semi = [];
      for(var j = 0; j < ${PROVE}; j++){ G._semeSinergie = 'premio-' + j; var s2 = simulaPiazzamento(semplice, centro.q, centro.r); semi.push(JSON.stringify(s2 && s2.tabellone[centro.k])); }
      G._semeSinergie = semeVero;
      var cambiaPremio = semi.some(function(v){ return v !== semi[0]; });
      var pp = computeDragPreview(semplice, centro.q, centro.r);
      dice(!cambiaPremio || (pp && pp.uncertain && !pp.deltas), 'la carta che riscuote un premio RAND (Tin Woodman) mostra "?" e non il +2', JSON.stringify(pp));
      G.premioProssimaGiocata = {};

      // ── gli effetti a sorte "una tantum" del motore ──
      // In simulazione non si applicano (applicaCambiamenti salta gli aCaso), quindi
      // i loro numeri non cambiano fra un seme e l'altro e il giro qui sopra non li
      // vede. Qui si chiede che l'incertezza sia DICHIARATA: la carta trascinata
      // incerta, o le carte che toccherebbe segnate a sorte.
      montaScena(false);
      ['the-genie', 'guinevere', 'cowardly-lion'].forEach(function(slug){
        var e = voce(slug);
        if(!e){ dice(false, slug + ' nel catalogo'); return; }
        var c = nuova(e, 1);
        var es3 = simulaPiazzamento(c, centro.q, centro.r);
        var p3 = computeDragPreview(c, centro.q, centro.r);
        var segnate = es3 ? Object.keys(es3.aSorte.tabellone).length + Object.keys(es3.aSorte.mani[1]).length + Object.keys(es3.aSorte.mani[2]).length : 0;
        var dichiarata = (p3 && p3.uncertain) || segnate > 0;
        dice(dichiarata, slug + ': l-incertezza e- dichiarata in anteprima ("?")', JSON.stringify({ trascinata: p3 && p3.uncertain, segnate: segnate }));
        var nessunNumero = !p3 || !p3.deltas || !p3.uncertain;
        dice(nessunNumero, slug + ': e nessun numero simulato accanto al "?"', p3 && JSON.stringify(p3.deltas));
      });
    } catch(err){ dice(false, 'il banco e- arrivato in fondo', err.message + ' ' + String(err.stack || '').split('\\n')[1]); }
    return d.join('\\n') + '\\n(controlli passati senza riga: ' + contaOk + ')';
  })()`);
  console.log(esito);
  const no = (esito.match(/^  NO  /gm) || []).length;
  console.log('\n' + (no ? no + ' NO' : 'tutto a posto'));
  app.exit(no ? 1 : 0);
});
