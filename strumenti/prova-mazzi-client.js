// I MAZZI DEL CLIENT CONTRO LA COPIA VECCHIA (v0.80.16).
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-mazzi-client.js
//
// Meta' client del "Match error" del 13 set 2026 (l'altra meta' e'
// prova-mazzi-server.js). Il server e' finto: nakamaRpc risponde da qui. Si
// guarda che:
//   1. un mazzo con carte non tue non sia "giocabile" (ne' cercare, ne'
//      scegliere, ne' salvare), mentre mazzoValido resta com'era per i mazzi
//      degli altri;
//   2. di due letture dei mazzi valga l'ultima partita, anche se arriva prima;
//   3. il salvataggio mandi la versione letta, adotti la copia del server se
//      questa dice "conflitto" e lo dica al giocatore, e adotti anche cio' che
//      il server ha scritto davvero;
//   4. importando un codice restino solo le carte tue, e si dica quante no;
//   5. il Match error non dia la colpa a chi legge e rilegga i mazzi.
const { app, BrowserWindow } = require('electron');
require('./dal-disco');   // v0.80.22 — gli asset di hextalegame.com dal disco, non dal sito
const path = require('path');
const { pathToFileURL } = require('url');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  try {
    var sp = document.getElementById('splash'); if(sp) sp.remove();
    var base = FINAL_CARDS.slice();
    for(var i = 1; FINAL_CARDS.length < 16; i++){
      base.forEach(function(c){ if(FINAL_CARDS.length < 16) FINAL_CARDS.push(Object.assign({}, c, { id:String(c.id)+'-k'+i, slug:c.slug+'-k'+i, name:c.name+' '+i })); });
    }
    // Tutte comuni: dodici carte stanno nei 24 punti, e il banco guarda il possesso, non la capacita-.
    FINAL_CARDS.forEach(function(c){ c.rarity = "common"; });
    // Possiedi tutte le carte tranne le ultime quattro.
    CARTE_POSSEDUTE = {};
    FINAL_CARDS.forEach(function(c, j){ if(j < 12) CARTE_POSSEDUTE[c.slug] = 1; });
    _possessoNoto = true;
    GIOCATORE_ADMIN = false;
    sessioneAccount = { token:'finto' };
    var ids = FINAL_CARDS.map(function(c){ return String(c.id); });
    var tue = ids.slice(0, 12), conUnaNonTua = ids.slice(0, 11).concat([ids[15]]);

    var chiamate = [];
    var risponde = null;
    nakamaRpc = async function(nome, dati){ chiamate.push({ nome:nome, dati:JSON.parse(JSON.stringify(dati || {})) }); return risponde ? risponde(nome, dati) : {}; };
    var avvisi = [];
    apriAvviso = function(t, x, g){ avvisi.push({ t:t, x:x, g:g }); };

    // ── 1. carte tue ─────────────────────────────────────────────────────
    var buono = { id:'a', nome:'Buono', carte:tue }, misto = { id:'b', nome:'Misto', carte:conUnaNonTua };
    dice(mazzoGiocabile(buono), 'dodici carte tue: giocabile');
    dice(!mazzoGiocabile(misto), 'una carta non tua: non giocabile');
    dice(mazzoValido(misto), 'ma mazzoValido lo accetta ancora (serve per i mazzi degli altri)');
    _possessoNoto = false;
    dice(mazzoGiocabile(misto), 'senza possesso noto (in locale) non si toglie niente');
    _possessoNoto = true;
    MAZZI = [buono, misto]; MAZZO_SCELTO = 'a';
    dice(selezionaMazzo('b') === false && MAZZO_SCELTO === 'a', 'il mazzo con una carta non tua non si sceglie');

    // ── 2. vale l'ultima lettura ─────────────────────────────────────────
    chiamate.length = 0;
    risponde = function(nome){
      if(nome !== 'hx_mazzi_leggi') return {};
      var n = chiamate.filter(function(c){ return c.nome === 'hx_mazzi_leggi'; }).length;
      return n === 1
        ? new Promise(function(r){ setTimeout(function(){ r({ mazzi:[{ id:'starter-3', nome:'Starter Princess', carte:tue }], scelto:'starter-3', versione:1 }); }, 300); })
        : new Promise(function(r){ setTimeout(function(){ r({ mazzi:[{ id:'starter-2', nome:'Starter Trickster', carte:tue }], scelto:'starter-2', versione:2 }); }, 40); });
    };
    var prima = sincronizzaMazzi();
    await respira(10);
    var seconda = sincronizzaMazzi();
    await Promise.all([prima, seconda]);
    dice(MAZZI.length === 1 && MAZZI[0].id === 'starter-2' && MAZZO_SCELTO === 'starter-2', 'la lettura partita per prima e arrivata per ultima non passa sopra', MAZZI.map(function(m){ return m.id; }).join());
    dice(_mazziVersione === 2, 'e la versione e- quella dell-ultima lettura', _mazziVersione);

    // ── 3. il salvataggio ────────────────────────────────────────────────
    chiamate.length = 0; avvisi.length = 0;
    risponde = function(nome){
      if(nome !== 'hx_mazzi_scrivi') return {};
      return { conflitto:true, mazzi:[{ id:'starter-2', nome:'Dal server', carte:tue }], scelto:'starter-2', versione:5, modificatoIl:9 };
    };
    MAZZI[0].nome = 'Rinominato qui';
    await mandaMazziAlServer();
    var scritta = chiamate.filter(function(c){ return c.nome === 'hx_mazzi_scrivi'; })[0];
    dice(scritta && scritta.dati.base === 2, 'il salvataggio manda la versione letta (base)', scritta && scritta.dati.base);
    dice(MAZZI[0].nome === 'Dal server' && _mazziVersione === 5, 'col conflitto si adotta la copia del server', MAZZI[0].nome + ' v' + _mazziVersione);
    dice(avvisi.some(function(a){ return a.t === 'Decks updated'; }), 'e si dice al giocatore che la modifica non e- passata');

    chiamate.length = 0; avvisi.length = 0;
    risponde = function(nome, dati){
      if(nome !== 'hx_mazzi_scrivi') return {};
      return { mazzi:[{ id:'starter-2', nome:dati.mazzi[0].nome, carte:tue.slice(0, 11) }], scelto:'starter-2', versione:6, modificatoIl:10 };
    };
    MAZZI[0].nome = 'Nuovo nome';
    await mandaMazziAlServer();
    dice(!chiamate.length || chiamate[0].dati.base === 5, 'la volta dopo manda la versione adottata', chiamate[0] && chiamate[0].dati.base);
    dice(_mazziVersione === 6 && MAZZI[0].carte.length === 11 && MAZZI[0].nome === 'Nuovo nome', 'a salvataggio riuscito, in memoria c-e- cio- che il server ha scritto', 'v' + _mazziVersione + ', ' + MAZZI[0].carte.length + ' carte');
    dice(!avvisi.length, 'senza avvisi');

    // ── 4. importare un codice ───────────────────────────────────────────
    risponde = function(){ return { mazzi:MAZZI, scelto:MAZZO_SCELTO, versione:_mazziVersione + 1 }; };
    showPage('collection');
    document.getElementById('card-db-overlay').classList.add('show');
    renderListaMazzi();
    await respira(200);
    mazzoDaCodice = function(){ return { nome:'Importato', carte:conUnaNonTua.slice(0, 9).concat([ids[13], ids[14], ids[15]]), perse:[] }; };
    avvisi.length = 0;
    var quanti = MAZZI.length;
    importaMazzoDalCampo();
    var importato = MAZZI[MAZZI.length - 1];
    dice(MAZZI.length === quanti + 1 && importato.nome === 'Importato', 'il codice diventa un mazzo');
    dice(importato.carte.length === 9 && importato.carte.every(function(id){ return cartaTua(entryDaId(id)); }), 'con dentro solo le carte tue', importato.carte.length);
    var detto = avvisi.filter(function(a){ return a.t === 'Deck imported'; })[0];
    dice(detto && detto.x.indexOf('3 cards') === 0 && !detto.g, 'e un avviso dice quante sono rimaste fuori', detto && detto.x);
    await respira(100);

    // ── 5. il Match error ────────────────────────────────────────────────
    chiamate.length = 0; avvisi.length = 0;
    risponde = function(nome){ return nome === 'hx_mazzi_leggi' ? { mazzi:MAZZI, scelto:MAZZO_SCELTO, versione:_mazziVersione } : {}; };
    showPage('mainmenu');
    await respira(300);
    _mm2Cercando = true;
    mmTrovato({ self:{ presence:{ user_id:'io' } }, users:[ { presence:{ user_id:'io' } }, { presence:{ user_id:'altro' }, string_properties:{ nome:'Altro' } } ] });
    await respira(200);
    var errore = avvisi.filter(function(a){ return a.t === 'Match error'; })[0];
    dice(errore && errore.x.indexOf('one of the two decks') >= 0 && errore.x.indexOf('Check that your selected deck is valid') < 0, 'il Match error non da- la colpa a chi legge', errore && errore.x);
    dice(chiamate.some(function(c){ return c.nome === 'hx_mazzi_leggi'; }), 'e i mazzi si rileggono dal server');
  } catch(e){
    dice(false, 'il banco e- arrivato in fondo', e.message + ' ' + (e.stack || '').split('\\n')[1]);
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
