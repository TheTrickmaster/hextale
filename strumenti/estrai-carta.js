// LA CARTA DEL GIOCO, PRESA DAL GIOCO.
//
//     $ELECTRON strumenti/estrai-carta.js [nome] [livello]
//
// Scrive tre file in web-assets/sito/ che la pagina d'ingresso si mette
// dentro: il markup della carta, le regole di stile che la fanno funzionare e
// le funzioni che la muovono.
//
// PERCHE' TRE FILE E NON UNA FOTOGRAFIA. La carta del sito deve essere quella
// del gioco "in tutto e per tutto": il riflesso che segue il puntatore, la
// lucentezza per materiale, la lamina vera con le sue due trame che scorrono
// in verso opposto, e il parallax dei livelli d'arte. Nessuna di queste cose
// e' un'immagine: sono un SVG con dentro maschere e trame, un foglio di stile
// e una funzione che a ogni movimento riscrive una dozzina di numeri.
// Riscriverle a mano vorrebbe dire avere due lamine diverse — quella del gioco
// e una che le somiglia — e vederle divergere alla prima modifica.
//
// Questo banco NON copia a mano niente: apre il gioco, costruisce la carta
// esattamente come fa la finestra dell'ingrandimento (stesso percorso, stesse
// funzioni), poi porta via il DOM che ne esce, le regole di stile che lo
// riguardano e il codice sorgente delle funzioni che lo animano — chiedendolo
// alle funzioni stesse.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.replace(/\\/g, '/') + '/play/index.html';
const CATALOGO = RADICE + '/server/importazione/.lavoro/catalogo.json';
const FUORI = RADICE + '/web-assets/sito';
const NOME = process.argv[2] || 'Alice';
const LIVELLO = parseInt(process.argv[3] || '4', 10);
const LARGO = 374, ALTO = 642;

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
setTimeout(() => { console.error('PIANTATA'); app.exit(2); }, 150000);

app.whenReady().then(async () => {
  const cat = JSON.parse(fs.readFileSync(CATALOGO, 'utf8'));
  const carte = Array.isArray(cat) ? cat : (cat.carte || cat.cards || Object.values(cat));
  const riga = carte.find(c => c && c.name === NOME);
  if (!riga) { console.error('nel catalogo non c-e- ' + NOME); app.exit(1); return; }

  const win = new BrowserWindow({ show: false, width: 900, height: 900, frame: false,
    webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 3500));

  const esito = await win.webContents.executeJavaScript(`(function(){ try{
    var RIGA = ${JSON.stringify(riga)};
    var s = document.getElementById('splash'); if(s) s.remove();
    FINAL_CARDS.length = 0; FINAL_CARDS.push(RIGA);

    // ── LA CARTA, COSTRUITA COME LA COSTRUISCE IL GIOCO ────────────────────
    // Lo stesso percorso della finestra dell'ingrandimento (disegnaCardModal):
    // la carta al livello scelto, la copia con i permessi della lamina e del
    // parallax, il disegno, l'involucro a tre strati e la lucentezza costruita
    // dopo — che e' l'ordine in cui il gioco la fa, e l'ordine conta.
    var carta = _makeCardDbCard(cartaAlLivello(RIGA, ${LIVELLO}), 1);
    carta.level = ${LIVELLO};
    var vista = cardFoilVisualCard(carta);
    var svg = buildFullHandCardSVG(vista, ${LARGO}, ${ALTO});
    svg.removeAttribute('class');
    svg.removeAttribute('style');
    svg.setAttribute('viewBox', '0 0 ' + ${LARGO} + ' ' + ${ALTO});
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    var host = document.createElement('div');
    host.className = 'hx-carta';
    host.dataset.foilVariant = playerFactionName(carta.owner || 1);
    host.style.width = ${LARGO} + 'px';
    host.style.height = ${ALTO} + 'px';
    host.appendChild(cardFoilWrap(svg, playerFactionIsDark(carta.owner || 1)));
    // Deve stare nel documento perche' cardDbBuildGlossLayer misura.
    document.body.appendChild(host);
    host._glossBuilt = false; host._glossStops = null;
    cardDbBuildGlossLayer(host, cartaAlLivello(RIGA, ${LIVELLO}), svg);

    // ── LE REGOLE DI STILE CHE LA RIGUARDANO ──────────────────────────────
    // Si raccolgono le classi e gli attributi che compaiono davvero nel
    // sottoalbero, poi si tengono le regole del gioco che li nominano. Cosi'
    // non c'e' una lista scritta a mano da tenere aggiornata: cambiando la
    // carta cambia la raccolta.
    var classi = {};
    host.querySelectorAll('*').forEach(function(e){
      (e.getAttribute('class') || '').split(/\\s+/).forEach(function(c){ if(c) classi[c] = 1; });
    });
    classi[host.className] = 1;
    var nomi = Object.keys(classi);
    var serve = function(sel){
      if(/--foil|\\[data-foil/.test(sel)) return true;
      for(var i=0;i<nomi.length;i++) if(sel.indexOf('.' + nomi[i]) >= 0) return true;
      return false;
    };
    var css = [], radice = [], animazioni = {};
    var guarda = function(regole){
      for(var i=0;i<regole.length;i++){
        var r = regole[i];
        if(r.type === 1){                                     // una regola normale
          if(serve(r.selectorText)) css.push(r.cssText);
          // Le proprieta' personalizzate del foil vivono su :root e le legge
          // il foglio di stile della carta: senza, i livelli restano spenti.
          if(/^(:root|html)\\b/.test(r.selectorText)){
            for(var k=0;k<r.style.length;k++){
              var p = r.style[k];
              if(p.indexOf('--foil') === 0 || p.indexOf('--card') === 0 || p.indexOf('--hex') === 0)
                radice.push(p + ':' + r.style.getPropertyValue(p) + ';');
            }
          }
        } else if(r.type === 7){                              // @keyframes
          animazioni[r.name] = r.cssText;
        } else if(r.cssRules){                                // @media e simili
          guarda(r.cssRules);
        }
      }
    };
    for(var f=0;f<document.styleSheets.length;f++){
      try { guarda(document.styleSheets[f].cssRules); } catch(e) {}
    }
    // Le animazioni citate dalle regole raccolte, e solo quelle.
    var testo = css.join('\\n');
    var chiavi = Object.keys(animazioni).filter(function(n){
      return new RegExp('animation[^;]*\\\\b' + n + '\\\\b').test(testo);
    });
    // E quelle scritte a mano su documentElement quando il gioco parte.
    var vive = document.documentElement.style;
    for(var k=0;k<vive.length;k++){
      var p = vive[k];
      if(p.indexOf('--foil') === 0 || p.indexOf('--card') === 0)
        radice.push(p + ':' + vive.getPropertyValue(p) + ';');
    }

    // ── IL CODICE CHE LA MUOVE ────────────────────────────────────────────
    // Chiesto alle funzioni stesse: e' l'unico modo di essere sicuri che sia
    // quello che gira davvero, e non una copia scritta a parte.
    var codice = [
      'var FOIL_PROFILI = ' + JSON.stringify(FOIL_PROFILI, null, 2) + ';',
      'var FOIL = FOIL_PROFILI.dark;',
      'var FOIL_PROFILO_ATTIVO = "dark";',
      'var CARD_DB_PARALLAX_PX = ' + JSON.stringify(CARD_DB_PARALLAX_PX) + ';',
      'var CARD_DB_GLOSS_SWEEP_X = ' + CARD_DB_GLOSS_SWEEP_X + ';',
      'var CARD_DB_GLOSS_SWEEP_Y = ' + CARD_DB_GLOSS_SWEEP_Y + ';',
      'var CARD_DB_GLOSS_BAND = ' + CARD_DB_GLOSS_BAND + ';',
      foilUsaProfilo.toString(),
      cardFoilApply.toString(),
      cardFoilReset.toString()
    ].join('\\n\\n');

    return {
      nome: carta.name, livello: carta.level,
      markup: host.outerHTML,
      immagini: svg.querySelectorAll('image').length,
      lamina: !!svg.querySelector('.card-holo-grad-a'),
      bande: !!svg.querySelector('.card-holo-bands'),
      parallax: svg.querySelectorAll('.hex-art-parallax-layer[data-parallax-depth]').length,
      lucentezza: !!svg.querySelector('.card-db-gloss-layer'),
      css: (radice.length ? ':root{' + radice.join('') + '}\\n' : '')
           + css.join('\\n') + '\\n'
           + chiavi.map(function(n){ return animazioni[n]; }).join('\\n'),
      regole: css.length, animazioni: chiavi.length, proprieta: radice.length,
      codice: codice
    };
  }catch(e){ return { errore: String((e && e.stack) || e) }; } })()`);

  if (esito.errore) { console.error(esito.errore); app.exit(1); return; }

  // Gli indirizzi assoluti diventano relativi alla radice: la stessa carta
  // funziona sul sito vero e su un server di prova.
  const relativo = (t) => t.split('https://hextalegame.com/').join('/');
  fs.writeFileSync(FUORI + '/carta-alice.html', relativo(esito.markup) + '\n');
  fs.writeFileSync(FUORI + '/carta-alice.css', relativo(esito.css));
  fs.writeFileSync(FUORI + '/carta-alice.js', esito.codice + '\n');

  console.log('  carta      ' + esito.nome + ' liv. ' + esito.livello);
  console.log('  markup     ' + ((esito.markup.length / 1024) | 0) + 'KB, ' + esito.immagini + ' immagini');
  console.log('  lamina     ' + (esito.lamina ? 'le due trame ci sono' : 'MANCA'));
  console.log('  bande      ' + (esito.bande ? 'ci sono' : 'MANCANO'));
  console.log('  parallax   ' + esito.parallax + ' livelli d-arte');
  console.log('  lucentezza ' + (esito.lucentezza ? 'costruita' : 'MANCA'));
  console.log('  stile      ' + esito.regole + ' regole, ' + esito.animazioni + ' animazioni, ' + esito.proprieta + ' proprieta');
  console.log('  codice     ' + ((esito.codice.length / 1024) | 0) + 'KB');
  const male = !esito.lamina || !esito.lucentezza || esito.parallax === 0;
  console.log('\n' + (male ? 'MANCA QUALCOSA' : 'scritti in web-assets/sito/carta-alice.{html,css,js}'));
  app.exit(male ? 1 : 0);
});
