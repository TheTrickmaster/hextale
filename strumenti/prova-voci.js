// Il banco delle voci e dei gridi di battaglia.
//
//   npx electron strumenti/prova-voci.js
//
// PERCHE' ESISTE. Il 9 settembre 2026 nessuna carta gridava piu', e nessuna
// parlava. Non per un difetto nel suono: per una SCORCIATOIA.
// verificaArtCarte scopre due cose insieme — le illustrazioni e l'audio — e da
// v0.77.99 salta il giro quando il catalogo importato le sa gia'. La domanda
// che decideva se fidarsi era "il catalogo porta il campo voci?", e il catalogo
// in linea lo portava per tutte e 111 le carte: vuoto, perche' l'importazione
// non aveva trovato un solo file. Campo si', contenuto no, risposta si'.
// Si prendeva la scorciatoia, che di audio non si occupa, e il gioco taceva.
// Le illustrazioni intanto si vedevano, quindi non sembrava un problema di dati.
//
// Il banco costruisce ESATTAMENTE quel catalogo e pretende che il gioco si
// accorga di non poterselo bere. E prova anche il caso opposto — un catalogo
// che l'audio lo sa davvero — perche' li' la scorciatoia e' giusta, ma deve
// comunque REGISTRARE gli indirizzi: sapere dove sta un file non basta a
// poterlo suonare (vedi registraVociSfx e AUDIO_DATA_URLS).
const { app, BrowserWindow } = require('electron');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var chiaveDi = function(url){ return String(url).split('/').pop().replace(/\\.(mp3|wav)$/i, ''); };
  try {
    var sp = document.getElementById('splash'); if(sp) sp.remove();

    // ── 0. LA CARTELLA ACCANTO AL FILE ─────────────────────────────────
    // Aperto col doppio clic, il gioco deve trovare gli asset sul DISCO. La
    // pagina vive in play/, quindi la radice del sito e' un piano sopra: senza
    // il '../' gli indirizzi relativi puntano a play/cards/art/, che non
    // esiste, e ogni ricerca finisce sulla rete — con i file a mezzo metro.
    // E' andata cosi' per settimane, e il conto l'ha pagato l'importazione:
    // 1300 richieste in raffica a GitHub Pages, 429 Too Many Requests, e ogni
    // richiesta strozzata scritta nel catalogo come "questa carta non ha
    // illustrazione". Questi tre controlli sono la sentinella di quel giorno.
    dice(_daFileLocale, 'il banco gira da file:// (se no i controlli sotto non dicono niente)');
    var primoArte = _candidatiArt('alice/alice-dark')[0];
    var primaVoce = _candidati(VOCI_REL + 'alice-battlecry.mp3', VOCI_BASE + 'alice-battlecry.mp3')[0];
    dice(String(primoArte).indexOf('../') === 0, 'il primo indirizzo dell-arte e- quello locale', primoArte);
    dice(String(primaVoce).indexOf('../') === 0, 'e cosi- quello delle voci', primaVoce);
    var vistoArte = await _provaImmagine(primoArte);
    var vistaVoce = await _provaAudio(primaVoce);
    dice(vistoArte === true, 'e la cartella locale dell-arte risponde davvero');
    dice(vistaVoce === true, 'e quella delle voci pure');

    var base = (FINAL_CARDS || []).map(function(c){
      return { id: c.id, name: c.name, slug: c.slug, values: c.values, rarity: c.rarity };
    });
    dice(base.length >= 3, 'il banco ha delle carte con cui lavorare', base.length);
    var slugNoti = base.map(function(c){ return c.slug; }).join(', ');

    // ── A. IL CATALOGO CHE HA MESSO MUTO IL GIOCO ───────────────────────
    // Campo voci presente e VUOTO per tutte, nessun campo battlecry, e
    // l'illustrazione nota per una sola carta (nel catalogo vero erano 4 su
    // 111): basta quella a far dire si' a _arteGiaNota.
    var bugiardo = base.map(function(c, i){
      var e = JSON.parse(JSON.stringify(c));
      e.voci = [];
      if(i === 0) e.artLayersDark = { url: 'finta.png', aLivelli: false };
      return e;
    });
    _applicaCatalogo(bugiardo);
    for(var k in AUDIO_DATA_URLS){ if(/battlecry/.test(k)) delete AUDIO_DATA_URLS[k]; }
    await verificaArtCarte();
    var conGrido = FINAL_CARDS.filter(function(e){ return !!e.battlecry; });
    dice(conGrido.length > 0, 'catalogo senza audio: i gridi si ritrovano bussando',
      conGrido.length + ' su ' + FINAL_CARDS.length + ' (' + slugNoti + ')');
    var tuttiRegistrati = conGrido.every(function(e){ return !!AUDIO_DATA_URLS[chiaveDi(e.battlecry)]; });
    dice(tuttiRegistrati, 'e i loro indirizzi sono registrati per playSfxFile');
    var uno = conGrido[0];
    dice(!!(uno && /-battlecry\\.mp3$/.test(uno.battlecry)), 'e puntano al file giusto',
      uno && uno.battlecry);
    // La catena vera, dal principio: la carta giocata trova il suo grido.
    var carta = { id: uno.id + '-1-123456-7', baseId: uno.id, owner: 1, name: uno.name };
    dice(_sorgenteVoceGiocata(carta) === uno.battlecry,
      'e una carta giocata lo trova', _sorgenteVoceGiocata(carta));

    // ── B. IL CATALOGO BUONO: si salta il giro, ma si registra ──────────
    var bussate = 0;
    var veroAudio = _provaAudio;
    window._provaAudio = function(){ bussate++; return veroAudio.apply(this, arguments); };
    var buono = FINAL_CARDS.map(function(c){
      var e = JSON.parse(JSON.stringify(c));
      e.voci = ['https://hextalegame.com/audio/voices/' + e.slug + '-1.mp3'];
      e.battlecry = 'https://hextalegame.com/audio/voices/' + e.slug + '-battlecry.mp3';
      e.artLayersDark = { url: 'finta.png', aLivelli: false };
      e.artLayersLight = { url: 'finta.png', aLivelli: false };
      return e;
    });
    _applicaCatalogo(buono);
    for(var k2 in AUDIO_DATA_URLS){ if(/battlecry|-1$/.test(k2)) delete AUDIO_DATA_URLS[k2]; }
    await verificaArtCarte();
    window._provaAudio = veroAudio;
    dice(bussate === 0, 'catalogo buono: non si bussa a nessuna porta', bussate + ' bussate');
    var gridiOk = FINAL_CARDS.every(function(e){ return !!AUDIO_DATA_URLS[chiaveDi(e.battlecry)]; });
    var vociOk  = FINAL_CARDS.every(function(e){ return !!AUDIO_DATA_URLS[chiaveDi(e.voci[0])]; });
    dice(gridiOk, 'ma i gridi del catalogo si registrano lo stesso');
    dice(vociOk,  'e le battute anche');

    // ── B2. IL CATALOGO VERO: gridi si-, battute vuote ──────────────────
    // E- la forma esatta del catalogo in linea dal 9 settembre 2026, e va
    // provata a parte perche- e- il caso che la v0.79.50 sbagliava: in
    // audio/voices/ non esiste NESSUN file <slug>-1.mp3, solo i gridi, quindi
    // voci vuote per tutte e- la risposta VERA. Pretendere anche le battute
    // avrebbe fatto bussare alle 1300 porte con un catalogo perfetto.
    var bussate3 = 0;
    window._provaAudio = function(){ bussate3++; return veroAudio.apply(this, arguments); };
    var veroImg = _provaImmagine;
    window._provaImmagine = function(){ bussate3++; return veroImg.apply(this, arguments); };
    var comeInLinea = FINAL_CARDS.map(function(c){
      var e = JSON.parse(JSON.stringify(c));
      e.voci = [];
      e.battlecry = 'https://hextalegame.com/audio/voices/' + e.slug + '-battlecry.mp3';
      e.artLayersDark = { url: 'finta.png', aLivelli: false };
      e.artLayersLight = { url: 'finta.png', aLivelli: false };
      return e;
    });
    _applicaCatalogo(comeInLinea);
    for(var k3 in AUDIO_DATA_URLS){ if(/battlecry/.test(k3)) delete AUDIO_DATA_URLS[k3]; }
    await verificaArtCarte();
    window._provaAudio = veroAudio;
    window._provaImmagine = veroImg;
    dice(bussate3 === 0, 'catalogo vero (gridi si-, battute vuote): non si bussa', bussate3 + ' bussate');
    dice(FINAL_CARDS.every(function(e){ return !!AUDIO_DATA_URLS[chiaveDi(e.battlecry)]; }),
      'e i gridi sono comunque registrati');

    // ── C. il campo c'e- ma e- vuoto per TUTTE: non ci si fida ──────────
    // E- il caso A guardato dall-altro verso, e vale la pena scriverlo a parte:
    // e- la riga esatta che era sbagliata.
    var vuoto = FINAL_CARDS.map(function(c){
      var e = JSON.parse(JSON.stringify(c));
      e.voci = []; e.battlecry = null;
      e.artLayersDark = { url: 'finta.png', aLivelli: false };
      return e;
    });
    var bussate2 = 0;
    window._provaAudio = function(){ bussate2++; return veroAudio.apply(this, arguments); };
    _applicaCatalogo(vuoto);
    await verificaArtCarte();
    window._provaAudio = veroAudio;
    dice(bussate2 > 0, 'voci vuote per tutte: si torna a bussare', bussate2 + ' bussate');
    dice(FINAL_CARDS.some(function(e){ return !!e.battlecry; }),
      'e i gridi tornano', FINAL_CARDS.filter(function(e){ return !!e.battlecry; }).length);

    return d.join(String.fromCharCode(10));
  } catch(e) {
    return 'PIANTATA: ' + (e && e.message) + ' @ ' + ((e && e.stack) || '').split(String.fromCharCode(10))[1]
      + String.fromCharCode(10) + d.join(String.fromCharCode(10));
  }
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 800,
    webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL('file:///C:/Users/masil/Desktop/Hextale/game-assets/play/index.html');
  // Si aspetta che il caricamento abbia finito la sua verifica: cominciare
  // mentre e' in corso vorrebbe dire due verificaArtCarte sovrapposte sulla
  // stessa FINAL_CARDS, e nessuna delle due risposte sarebbe attendibile.
  await new Promise(r => setTimeout(r, 20000));
  let out;
  try { out = await win.webContents.executeJavaScript(CORPO); }
  catch(e){ out = 'ERRORE NELL\'INIEZIONE: ' + (e && e.message); }
  console.log('\n' + out + '\n');
  app.exit(String(out).indexOf('  NO  ') !== -1 || String(out).indexOf('PIANTATA') === 0 ? 1 : 0);
});
