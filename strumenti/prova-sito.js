// LA PAGINA D'INGRESSO.
//
//     $ELECTRON strumenti/prova-sito.js [scatto.png]
//     HX_SCHERMO=390x844 $ELECTRON strumenti/prova-sito.js [scatto.png]
//
// La seconda forma la guarda su un telefono, dove la pagina non e' un'altra
// pagina ma la stessa ripiegata: la carta torna nel flusso, i cinque
// cartellini spariscono e al loro posto c'e' quello che si riempie toccando.
//
// Come per la 404 non si apre il file: si tira su un server sulla radice del
// sito. Tutti gli indirizzi della pagina partono da / — deve essere cosi',
// perche' hextalegame.com/ e' la radice — e aprendola come file quelli
// punterebbero al disco. Servendola si vede anche l'altra meta' della cosa:
// QUALI file chiede davvero, e se qualcuno di quelli non c'e'.
const { app, BrowserWindow } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
const SCATTO = process.argv[2] || '';
const [LARGO, ALTO] = (process.env.HX_SCHERMO || '1600x1000').split('x').map(Number);
const STRETTO = LARGO <= 980;   // la soglia del @media dentro alla pagina
const TIPI = { '.html':'text/html', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml',
               '.ttf':'font/ttf', '.js':'text/javascript', '.css':'text/css' };

const mancanti = [];
const server = http.createServer((req, res) => {
  const via = decodeURIComponent(req.url.split('?')[0]);
  const dove = path.join(RADICE, via === '/' ? 'index.html' : via.replace(/^\/+/, ''));
  if (fs.existsSync(dove) && fs.statSync(dove).isFile()) {
    res.writeHead(200, { 'Content-Type': TIPI[path.extname(dove).toLowerCase()] || 'application/octet-stream' });
    return res.end(fs.readFileSync(dove));
  }
  mancanti.push(via);
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('no');
});

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
setTimeout(() => { console.error('PIANTATA'); app.exit(2); }, 150000);

app.whenReady().then(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const porta = server.address().port;
  const win = new BrowserWindow({ show: false, width: LARGO, height: ALTO, frame: false,
    webPreferences: { contextIsolation: false } });
  const lamenti = [];
  win.webContents.on('console-message', (_e, livello, testo) => {
    if (livello >= 2) lamenti.push(testo);
  });
  await win.loadURL('http://127.0.0.1:' + porta + '/');
  await new Promise(r => setTimeout(r, 2600));

  // Si scorre tutta la pagina e si torna su. Le immagini sotto alla prima
  // schermata si caricano quando ci si arriva: senza questa passeggiata il
  // banco le troverebbe vuote e direbbe che mancano, quando invece e' lui a
  // non essere mai sceso a prenderle. Lo scorrimento morbido si spegne prima —
  // in una finestra che non e' a schermo le animazioni non avanzano.
  await win.webContents.executeJavaScript(`
    document.documentElement.style.scrollBehavior = 'auto';
    var passi = []; for(var y = 0; y < document.body.scrollHeight; y += 600) passi.push(y);
    // Alla fine del giro NON si torna su: l'ultima immagine — Geppetto,
    // dietro alle domande — comincia a caricarsi quando entra in vista, e
    // risalendo subito il browser lascia perdere. Si resta li' e le si da' il
    // tempo di arrivare, che e' quel che fa anche un visitatore.
    (function giu(i){ if(i >= passi.length) return;
       scrollTo(0, passi[i]); setTimeout(function(){ giu(i+1); }, 110); })(0);
    true;`);
  await new Promise(r => setTimeout(r, 2600));
  // E si finisce fermi sulle domande: l'ultima immagine — Geppetto, dietro
  // di loro — comincia a caricarsi quando entra in vista, e il giro adesso
  // arriva fino in fondo alla pagina, che e' PIU' IN BASSO di lei.
  await win.webContents.executeJavaScript("document.getElementById('faq').scrollIntoView(); true;");
  await new Promise(r => setTimeout(r, 2000));

  const dette = await win.webContents.executeJavaScript(`(function(){
    const STRETTO = ${STRETTO};
    const dette = [];
    const dice = (ok, che, perche) => dette.push({ ok:!!ok, che:che, perche:perche===undefined?'':String(perche) });
    const q = (s) => document.querySelector(s);
    const tutti = (s) => [...document.querySelectorAll(s)];
    const st = (s, p) => getComputedStyle(typeof s === 'string' ? q(s) : s)[p];
    const rt = (s) => (typeof s === 'string' ? q(s) : s).getBoundingClientRect();
    // Da qui in giu' e' sorvegliato: se un controllo inciampa, il banco lo
    // dice e dice dopo quale, invece di lasciare la promessa rifiutata e
    // morire sul guardiano dei 150 secondi con un 'PIANTATA' che non spiega
    // niente. Le cinque scorciatoie qui sopra restano fuori dal try perche'
    // servono anche a chi raccoglie il guasto.
    try{

    // ── LE TARGHE DEI TITOLI ────────────────────────────────────────────────
    // Il difetto da cui parte tutto: erano immagini STIRATE. Adesso sono una
    // sola immagine tagliata in tre — border-image — e a stirarsi e' solo la
    // fascia di mezzo. Il segno che e' cosi' e' che i bordi laterali esistono e
    // valgono quanto il pezzo d'ornamento, non zero.
    const titoli = tutti('.titolo');
    dice(titoli.length === 4, 'quattro targhe di titolo', titoli.length);
    dice(titoli.every(t => getComputedStyle(t).borderImageSource.indexOf('name-wrapper') > 0),
      'le targhe sono il name-wrapper delle carte', st('.titolo','borderImageSource').slice(0,90));
    dice(titoli.every(t => {
      const b = getComputedStyle(t);
      return parseFloat(b.borderLeftWidth) > 40 && parseFloat(b.borderRightWidth) > 40;
    }), 'i fregi laterali non si stirano: hanno una larghezza loro',
      titoli.map(t=>Math.round(parseFloat(getComputedStyle(t).borderLeftWidth))).join(' '));
    dice(titoli.every(t => getComputedStyle(t).borderImageSlice.indexOf('fill') >= 0),
      'la fascia di mezzo e- riempita, non vuota', st('.titolo','borderImageSlice'));
    // E non deve essere schiacciata: nel disegno e' alta 124.
    if(!STRETTO) dice(titoli.every(t => Math.abs(t.offsetHeight - 124) <= 1),
      'le targhe alte 124', titoli.map(t=>t.offsetHeight).join(' '));

    // ── I PULSANTI ──────────────────────────────────────────────────────────
    const oro = tutti('.btn.important');
    dice(oro.length >= 3, 'ci sono i pulsanti d-oro', oro.length);
    dice(oro.every(b => getComputedStyle(b).color === 'rgb(50, 44, 29)'),
      'l-etichetta d-oro e- 322C1D', st('.btn.important','color'));
    dice(tutti('.btn').every(b => b.querySelectorAll('.pezzi > span').length === 5),
      'ogni pulsante ha i suoi cinque pezzi');
    dice(tutti('.btn').every(b => [...b.querySelectorAll('.pezzi > span')].every(p => p.offsetWidth > 0)),
      'nessun pezzo schiacciato a zero');
    dice(tutti('.btn').every(b => [...b.querySelectorAll('.pezzi > span')]
        .every(p => getComputedStyle(p).backgroundImage.indexOf('/ui/button-') > 0)),
      'i pulsanti sono quelli del gioco, presi da /ui/');
    // Play e Explore: 300 tutti e due, com'e' stato chiesto.
    const due = tutti('#cappello .bottoni .btn');
    dice(due.length === 2, 'due pulsanti sotto al titolo', due.length);
    if(!STRETTO) dice(due.every(b => b.offsetWidth === 300),
      'Play ed Explore larghi 300', due.map(b=>b.offsetWidth).join(' '));
    dice(due[1] && due[1].getAttribute('href') === '#collezione',
      'Explore porta alla sezione, non altrove', due[1] && due[1].getAttribute('href'));
    dice(!!document.getElementById('collezione'), 'e- quella sezione esiste');

    // ── LE DISSOLVENZE DURANO ────────────────────────────────────────────
    // Il blocco 'meno movimento' azzera ogni transizione della pagina con
    // !important. E' giusto che ci sia, ed e' giusto che si accenda per chi lo
    // ha chiesto — ma basta sbagliare la condizione (reduce / no-preference)
    // perche' si accenda per TUTTI: i ritardi restano, quindi le cose
    // continuano ad arrivare nell'ordine giusto, e compaiono solo di scatto.
    // E' successo, e nessun controllo se n'era accorto: guardavano tutti che le
    // cose ci fossero e dove, mai per QUANTO TEMPO.
    (function(){
      const devonoDurare = ['#cappello h1', '#cappello .claim', '.entra',
                            '.domanda .risposta', '#contatto', '.btn'];
      const corte = devonoDurare.filter(function(s){
        const e = q(s); if(!e) return false;
        const d = getComputedStyle(e).transitionDuration.split(',').map(parseFloat);
        return Math.max.apply(null, d) < 0.1;
      });
      dice(corte.length === 0, 'le dissolvenze durano davvero', corte.join(' ') + ' a zero');
      // Lo scorrimento morbido qui non si controlla: il banco lo spegne lui
      // stesso per fare il giro della pagina, e misurarlo vorrebbe dire
      // misurare se stessi.
    })();

    // ── LA CASCATA DEL CAPPELLO ─────────────────────────────────────────────
    // Ogni pezzo arriva per conto suo, e il PRIMO deve essere il fondale: e'
    // lui a dire dove si e' finiti. Non basta che i ritardi ci siano — devono
    // essere in ORDINE, e un ordine sbagliato non lo vede nessuno guardando
    // il foglio di stile riga per riga.
    (function(){
      const pezzi = tutti('#cappello .arriva');
      dice(pezzi.length >= 6, 'il cappello arriva a pezzi', pezzi.length);
      dice(pezzi.every(function(e){ return e.classList.contains('su'); }),
        'e sono arrivati tutti', pezzi.filter(function(e){ return !e.classList.contains('su'); }).length + ' fermi');
      const ritardi = pezzi.map(function(e){ return parseFloat(getComputedStyle(e).transitionDelay) || 0; });
      dice(ritardi[0] === 0 && q('#cappello .fondo').classList.contains('arriva'),
        'il fondale e- il primo, senza attesa', ritardi[0]);
      // Ogni pezzo non prima di quello che lo precede nel markup.
      let inOrdine = true;
      for(let i = 1; i < ritardi.length; i++) if(ritardi[i] < ritardi[i-1]) inOrdine = false;
      dice(inOrdine, 'e i ritardi salgono, uno dietro l-altro', ritardi.join(' '));
      // Sul telefono la barra non fa parte della cascata: non c'e' finche' non
      // si e' passato il cappello, quindi non ha nessun ritardo da rispettare.
      if(!STRETTO) dice(parseFloat(st('#barra','transitionDelay')) >= ritardi[ritardi.length-1],
        'la barra arriva per ultima', st('#barra','transitionDelay'));
    })();

    // ── IL MARCHIO ──────────────────────────────────────────────────────────
    // Gli stessi cinque strati della schermata d'accesso del gioco: due
    // raggiere, la macchia di luce, il segno e il riflesso.
    const m = q('#marchio');
    dice(!!m, 'il marchio c-e-');
    dice(!!q('#marchio .segno'), 'il segno');
    dice(!!q('#marchio .riflesso'), 'il riflesso che lo attraversa');
    dice([...m.querySelectorAll('img')].every(i => /\\/(ui|loading-screen)\\//.test(i.getAttribute('src'))),
      'tutti e cinque vengono dal gioco',
      [...m.querySelectorAll('img')].map(i=>i.getAttribute('src')).join(' '));
    // Le due raggiere e la macchia di luce non ci sono piu': le ha tolte
    // Lorenzo. Restano il segno e il riflesso — i due file del gioco — e il
    // riflesso deve poterlo attraversare: e' una maschera che scorre, e se
    // sparisse quella il marchio resterebbe fermo senza che nessuno lo noti.
    dice(st('#marchio .riflesso','maskImage').indexOf('gradient') >= 0 ||
         st('#marchio .riflesso','webkitMaskImage').indexOf('gradient') >= 0,
      'il riflesso passa da una fessura, non da un-opacita-',
      st('#marchio .riflesso','maskImage').slice(0, 40));
    // La misura: era quella e deve restare quella.
    if(!STRETTO) dice(Math.abs(m.offsetWidth - 500) <= 1, 'il marchio largo 500', m.offsetWidth);

    // ── L'H1 ────────────────────────────────────────────────────────────────
    // Niente alone attaccato ai contorni e niente respiro: le lettere sono
    // solo il gradiente.
    dice(st('h1','textShadow') === 'none', 'l-H1 non ha piu- il text-shadow', st('h1','textShadow'));
    dice(st('h1','animationName') === 'none', 'ne- l-animazione', st('h1','animationName'));
    const sf = st('h1','backgroundImage');
    dice(/90deg/.test(sf), 'il gradiente dell-H1 e- ruotato a 90 gradi', sf.slice(0,80));
    dice(/rgb\\(28, 18, 9\\)[\\s\\S]*rgb\\(137, 105, 53\\)[\\s\\S]*rgb\\(28, 18, 9\\)/.test(sf),
      'scuro 1C1209, centro 896935, scuro 1C1209', sf.slice(0,140));
    dice(st('h1','webkitBackgroundClip') === 'text' || st('h1','backgroundClip') === 'text',
      'la luce sta dentro alle lettere');

    // ── IL FONDALE DELLA COLLEZIONE ────────────────────────────────────────
    // Era enorme. Nel disegno esce dai bordi di una ventina di pixel per parte
    // e basta: si guarda quanto e' largo davvero rispetto alla finestra.
    // Non e' piu' un <img> in parallasse: e' uno sfondo del foglio di stile,
    // ripetuto in orizzontale. Cambia il modo, non la cosa da controllare —
    // che il fondale ci sia e sia quello giusto.
    dice(st('#collezione','backgroundImage').indexOf('bg-collezione') > 0,
      'il fondale della collezione c-e-', st('#collezione','backgroundImage').slice(0, 60));
    dice(st('#collezione','overflow') === 'hidden', 'e la sezione lo ritaglia');

    // ── LE ZONE DA TOCCARE ──────────────────────────────────────────────────
    // Erano cinque rettangoli a occhio, ed erano sbagliati. Adesso ognuna
    // porta la sagoma del pezzo che accende e sta dove sta quel pezzo DENTRO
    // ALL'SVG. Il controllo non e' che i numeri siano quelli scritti — sarebbe
    // rileggere il foglio di stile — ma che ogni zona CADA SOPRA al suo pezzo.
    (function(){
      const svg = q('.hx-carta svg');
      if(!svg) return;
      // Sul largo le zone sono display:none, e un rettangolo nascosto misura
      // zero: si accendono giusto il tempo di guardare dove cadono. Il
      // controllo vale a tutte e due le larghezze, ed e- giusto cosi- —
      // sbagliarle sul largo vorrebbe dire sbagliarle anche sullo stretto.
      const mostra = document.createElement('style');
      mostra.textContent = '.tocco{display:block !important}';
      document.head.appendChild(mostra);
      const carta = rt('.carta-scena');
      // Dove sta un pezzo dell'SVG sullo schermo, in pixel veri.
      const pezzo = function(cerca, quale){
        const tutte = [...svg.querySelectorAll('image')].filter(function(im){
          return (im.getAttribute('href')||'').indexOf(cerca) >= 0; });
        return tutte.length ? tutte[quale||0].getBoundingClientRect() : null;
      };
      const dentro = function(zona, r){
        if(!r) return false;
        const z = zona.getBoundingClientRect();
        const cx = (r.left+r.right)/2, cy = (r.top+r.bottom)/2;
        return cx >= z.left-2 && cx <= z.right+2 && cy >= z.top-2 && cy <= z.bottom+2;
      };
      const zone = {};
      tutti('.tocco b').forEach(function(b){ (zone[b.getAttribute('data-che')] = zone[b.getAttribute('data-che')] || []).push(b); });
      // Il nome non ha piu' la sua zona: il cartellino nella versione larga non
      // c'e', e tenere solo la meta' sul telefono voleva dire tenere le sue
      // parole scritte a mano in un posto in cui non le cercherebbe nessuno.
      dice(!zone.nome, 'la zona del nome non c-e- piu-');
      dice(!!zone.potere && !!zone.tratti && !!zone.livello && !!zone.abilita,
        'ci sono le altre quattro', Object.keys(zone).join(' '));
      dice(zone.potere && zone.potere.length === 3, 'e i poteri sono tre, uno per numero',
        zone.potere && zone.potere.length);
      dice(dentro(zone.tratti[0], pezzo('archetype-icon-explorer')), 'quella dei tratti sui tratti');
      dice(dentro(zone.livello[0], pezzo('card-level-socket', 1)), 'quella del livello sulle gemme');
      dice(dentro(zone.abilita[0], pezzo('card-deco-bottom')), 'quella dell-abilita- sull-abilita-');
      const cerchi = [0,1,2].map(function(i){ return pezzo('value-circle', i); });
      dice(cerchi.every(function(c){ return zone.potere.some(function(z){ return dentro(z, c); }); }),
        'e ogni cerchio del potere ha la sua zona');
      dice(tutti('.tocco b').every(function(b){
        return getComputedStyle(b).backgroundImage.indexOf('/web-assets/sito/hover-') > 0; }),
        'ognuna porta la sagoma disegnata apposta',
        getComputedStyle(tutti('.tocco b')[0]).backgroundImage.slice(0, 60));
      mostra.remove();
    })();

    // ── LA CARTA ────────────────────────────────────────────────────────────
    // E' la carta VERA: l'SVG che il gioco costruisce, non una fotografia.
    // Non basta che ci sia un SVG: ci devono essere i quattro effetti che il
    // gioco mette su una carta di livello 4, e devono essere i SUOI.
    const svg = q('.hx-carta svg');
    dice(!!svg, 'la carta e- un SVG dentro alla pagina');
    dice(svg && svg.querySelectorAll('image').length >= 35,
      'con tutti i suoi pezzi', svg && svg.querySelectorAll('image').length);
    dice(svg && svg.getAttribute('viewBox') === '0 0 374 642', 'alle proporzioni della carta', svg && svg.getAttribute('viewBox'));
    dice([...(svg ? svg.querySelectorAll('image') : [])].every(i => {
      const h = i.getAttribute('href') || i.getAttribute('xlink:href') || '';
      return h.charAt(0) === '/';
    }), 'i suoi disegni li chiede alla radice del sito');
    // I quattro effetti del gioco, coi nomi del gioco.
    dice(!!q('.card-db-foil-wrap') && !!q('.card-db-foil-tilt') && !!q('.card-db-foil-glare'),
      'l-involucro a tre strati del gioco');
    dice(!!q('.hx-carta .card-db-gloss-layer'), 'la lucentezza per materiale (specular)');
    dice(!!q('.hx-carta .card-holo-grad-a') && !!q('.hx-carta .card-holo-grad-b'),
      'la lamina vera, con le sue due trame');
    dice(!!q('.hx-carta .card-holo-bands'), 'e le sue bande');
    dice(!!q('.hx-carta .hex-art-parallax-layer[data-parallax-depth]'), 'il parallax dell-arte');
    dice(typeof cardFoilApply === 'function' && typeof cardFoilReset === 'function',
      'e a muoverla e- il codice del gioco');
    dice(st('.card-db-foil-glare','backgroundImage').indexOf('radial-gradient') >= 0,
      'il glare e- quello del gioco', st('.card-db-foil-glare','backgroundImage').slice(0,40));
    // E si accende DAVVERO: si muove il puntatore e si guarda se i numeri
    // cambiano. Senza questo, un markup giusto e un codice muto passerebbero.
    (function(){
      const c = q('.hx-carta'), tilt = q('.card-db-foil-tilt'), bande = q('.hx-carta .card-holo-bands');
      const prima = bande && bande.getAttribute('transform');
      c.setAttribute('data-foil-active','1');
      cardFoilApply(c, 0.6, -0.4, 0.8, 0.3);
      dice(tilt.style.getPropertyValue('--foil-rx') === '0.600',
        'inclinandola l-inclinazione arriva alla carta', tilt.style.getPropertyValue('--foil-rx'));
      dice(bande && bande.getAttribute('transform') !== prima,
        'e le bande della lamina si muovono', bande && String(bande.getAttribute('transform')).slice(0,40));
      dice(tilt.style.getPropertyValue('--foil-hue') !== '',
        'e la tinta della lamina ruota', tilt.style.getPropertyValue('--foil-hue'));
      const g = q('.hx-carta linearGradient[id^="gloss-g-"]');
      dice(g && g.children[2].getAttribute('offset') !== '0.5',
        'e la banda di luce scorre sul metallo', g && g.children[2].getAttribute('offset'));
      cardFoilReset(c);
      dice(!c.hasAttribute('data-foil-active'), 'e a riposo torna in piano');
    })();

    // ── I CARTELLINI ────────────────────────────────────────────────────────
    const cart = tutti('.cartellino');
    // Erano cinque: il "Name" l'ha tolto Lorenzo. Sul telefono la sua zona
    // resta, perche' la sagoma hover-name.png c'e' e il nome e' la prima cosa
    // che si guarda di una carta.
    dice(cart.length === 4, 'quattro cartellini', cart.length);
    // Stanno SOPRA alla carta. E' la richiesta, ed e' anche l'unico modo di
    // vedere la freccetta: sotto, l'angolo da cui esce e' coperto dalla carta.
    dice(cart.every(c => parseInt(getComputedStyle(c).zIndex,10) >
                         parseInt(st('.carta-scena','zIndex'),10)),
      'i cartellini stanno sopra alla carta',
      st('.cartellino','zIndex') + ' contro ' + st('.carta-scena','zIndex'));
    // La freccetta e' il triangolino d'ORO del disegno, di 10, sull'angolo
    // squadrato — non un triangolo del colore del bordo.
    dice(cart.every(c => {
      const p = getComputedStyle(c, '::after');
      return p.backgroundImage.indexOf('punta-cartellino.svg') > 0
          && Math.round(parseFloat(p.width)) === 10;
    }), 'la freccetta e- quella d-oro del disegno, di 10',
      getComputedStyle(cart[0], '::after').backgroundImage.slice(0,60));
    dice(cart.every(c => {
      const s = getComputedStyle(c);
      return [s.borderTopLeftRadius, s.borderTopRightRadius,
              s.borderBottomLeftRadius, s.borderBottomRightRadius]
             .map(parseFloat).filter(a => a === 0).length === 1;
    }), 'e sta sull-unico angolo squadrato');
    // La trama in sovrimpressione: e' quella che li toglie dall'aria di
    // riquadro di plastica, e non c'era.
    dice(cart.every(c => {
      const p = getComputedStyle(c, '::before');
      return p.backgroundImage.indexOf('trama-cartellino.png') > 0
          && p.mixBlendMode === 'hard-light'
          && Math.abs(parseFloat(p.opacity) - 0.1) < 0.001;
    }), 'la trama in hard-light al 10%',
      getComputedStyle(cart[0], '::before').mixBlendMode + ' ' + getComputedStyle(cart[0], '::before').opacity);
    // I caratteri del disegno.
    dice(st('.cartellino h3','fontSize') === '26px' && st('.cartellino h3','lineHeight') === '43px',
      'il titolo 26 su 43', st('.cartellino h3','fontSize') + '/' + st('.cartellino h3','lineHeight'));
    dice(st('.cartellino h3','color') === 'rgb(232, 212, 169)', 'color E8D4A9', st('.cartellino h3','color'));
    dice(st('.cartellino p','fontSize') === '13px' && st('.cartellino p','color') === 'rgb(159, 177, 179)',
      'il testo 13 color 9FB1B3', st('.cartellino p','fontSize') + ' ' + st('.cartellino p','color'));
    dice(st('.cartellino b','color') === 'rgb(255, 255, 255)', 'e le parti in risalto bianche', st('.cartellino b','color'));
    if(!STRETTO){
      // Le posizioni sono quelle del disegno, dentro al palco.
      const attese = { potere:[-10,185], livello:[745,180], abilita:[715,500], tratti:[100,410] };
      const palco = q('#collezione .palco');
      const sbagliati = Object.keys(attese).filter(k => {
        const c = q('.cartellino.c-' + k);
        if(!c) return true;
        return Math.abs(c.offsetLeft - attese[k][0]) > 1 || Math.abs(c.offsetTop - attese[k][1]) > 1;
      });
      dice(sbagliati.length === 0, 'e stanno dove sta il disegno', sbagliati.join(' '));
      dice(q('.carta-scena').offsetLeft === 450, 'e la carta pure', q('.carta-scena').offsetLeft);
    }

    // ── I PALCHI ────────────────────────────────────────────────────────────
    // Il palco tiene le misure del disegno e si rimpicciolisce tutto insieme.
    // Il guscio deve essere alto quanto il palco rimpicciolito: se resta alto
    // quanto quello intero si apre un buco, se resta a zero le cose sopra e
    // sotto si accavallano.
    tutti('.palco').forEach((p, i) => {
      const g = p.parentNode;
      const s = getComputedStyle(p).position === 'static'
        ? 1 : (new DOMMatrix(getComputedStyle(p).transform)).a;
      const alto = parseFloat(p.getAttribute('data-alto'));
      const atteso = getComputedStyle(p).position === 'static' ? g.offsetHeight : Math.round(alto * s);
      dice(Math.abs(g.offsetHeight - atteso) <= 2,
        'il palco ' + (i+1) + ' occupa esattamente il posto che gli serve',
        g.offsetHeight + ' invece di ' + atteso);
    });
    // E niente deve uscire di lato: e' la firma di un palco che non si e-
    // rimpicciolito.
    dice(document.documentElement.scrollWidth <= innerWidth + 1,
      'la pagina non scorre di lato', document.documentElement.scrollWidth + ' su ' + innerWidth);

    // ── IL MAZZO ────────────────────────────────────────────────────────────
    // Il ventaglio si apre e il palco NON si rimpicciolisce: era quello a far
    // sembrare che le carte si accavallassero invece di aprirsi — si
    // allontanavano e nello stesso momento diventavano tutte piu' piccole.
    (function(){
      const p = q('#mazzo .palco');
      dice(!p.hasAttribute('data-largo-aperto'), 'il palco del ventaglio non ha piu- un secondo fattore');
      dice(p.style.getPropertyValue('--scala-aperta') === '', 'e nessuno glielo scrive');
      // Si apre il ventaglio DAVVERO e si guarda dove finiscono le carte. Le
      // regole si potevano leggere anche prima, ed erano giuste: cadevano solo
      // sulle carte sbagliate, e questo si vede solo misurando.
      const guscio = q('#mazzo .carte');
      const quattro = tutti('#mazzo .carte .carta');
      dice(quattro.length === 4 && quattro.every(function(c, i){ return c.classList.contains('c' + (i+1)); }),
        'ogni carta ha il suo nome, c1..c4',
        quattro.map(function(c){ return c.className; }).join(' | '));
      // Quanto si vede di ognuna: dal suo bordo sinistro a quello della
      // successiva, che le sta sopra. L'ultima si vede tutta.
      const visibili = function(){
        const x = quattro.map(function(c){ return c.getBoundingClientRect(); });
        return [x[1].left - x[0].left, x[2].left - x[1].left, x[3].left - x[2].left];
      };
      // Le transizioni si spengono: in una finestra che non e' a schermo non
      // avanzano, e misurando subito dopo si legge sempre il valore di
      // PARTENZA — cioe' il ventaglio chiuso, due volte.
      const fermo2 = document.createElement('style');
      fermo2.textContent = '#mazzo .carte .carta{transition:none !important}';
      document.head.appendChild(fermo2);
      const chiuso = visibili();
      guscio.classList.add('aperto');
      const aperto = visibili();
      guscio.classList.remove('aperto');
      fermo2.remove();
      dice(aperto.every(function(v, i){ return v > chiuso[i] + 4; }),
        'aprendosi ogni carta si scopre di piu-',
        chiuso.map(Math.round).join(',') + ' -> ' + aperto.map(Math.round).join(','));
      // E nessuna finisce sotto alla vicina: e' il difetto vero, quello che
      // faceva sparire Little John.
      dice(aperto.every(function(v){ return v > 30; }),
        'e nessuna sparisce dietro a quella dopo', aperto.map(Math.round).join(','));
      // E da ferme stanno alle posizioni del disegno: ogni immagine e' centrata
      // sul riquadro che la sua carta occupa in Figma.
      const dove = [-30.9, 90.9, 209.6, 327.2];
      dice(quattro.every(function(c, i){ return Math.abs(c.offsetLeft - dove[i]) <= 1; }),
        'e da ferme stanno alle posizioni del disegno',
        quattro.map(function(c){ return c.offsetLeft; }).join(' '));
    })();
    const carte = tutti('#mazzo .carte .carta');
    dice(carte.length === 4, 'le quattro carte del mazzo', carte.length);
    dice(carte.every(c => c.naturalWidth > 0), 'e sono arrivate tutte',
      carte.map(c=>c.naturalWidth).join(' '));
    dice(carte.every(c => /carta[1-4]\\.png/.test(c.getAttribute('src'))),
      'sono le quattro rasterizzate');

    // ── IL VIDEO ─────────────────────────────────────────────────────────────────
    // L'alone esce di proposito; a tenere la pagina dritta e' il taglio in
    // cima al documento, non un ritaglio su questa sezione.
    dice(st('#video','overflow') === 'visible', 'l-alone del video puo- uscire', st('#video','overflow'));
    dice(st('#video','paddingTop') === '40px' && st('#video','paddingBottom') === '40px',
      'e la sezione ha i suoi 40 sopra e sotto',
      st('#video','paddingTop') + ' ' + st('#video','paddingBottom'));

    // ── LA SFIDA ────────────────────────────────────────────────────────────
    // Il riquadro del testo va SOTTO al tabellone: e' la richiesta, ed e' anche
    // quel che dice la scena. Due prove, perche' sono due cose diverse — chi
    // sta davanti, e che si sovrappongano davvero.
    const tav = rt('#sfida .tavolo'), pan = rt('#sfida .pannello');
    dice(pan.top < tav.bottom, 'il riquadro passa sotto al tabellone',
      Math.round(tav.bottom - pan.top) + 'px di sovrapposizione');
    dice(parseInt(st('#sfida .tavolo','zIndex'),10) > parseInt(st('#sfida .pannello','zIndex'),10),
      'e il tabellone gli sta davanti',
      st('#sfida .tavolo','zIndex') + ' contro ' + st('#sfida .pannello','zIndex'));
    // Il testo non deve finire sotto al tabellone: l'imbottitura alta del
    // riquadro serve a questo.
    const primoTesto = rt('#sfida .pannello .apertura');
    dice(primoTesto.top > tav.bottom - 6, 'ma il testo resta leggibile, sotto al bordo',
      Math.round(primoTesto.top - tav.bottom));
    // I due blocchi erano di due caratteri INVERTITI, in mezzo mancava la riga
    // e il pulsante stava fuori dal riquadro.
    dice(/^["']?Marcellus/.test(st('#sfida .pannello .apertura','fontFamily')) &&
         st('#sfida .pannello .apertura','fontSize') === '24px',
      'il primo blocco e- Marcellus 24',
      st('#sfida .pannello .apertura','fontFamily').slice(0,20) + ' ' + st('#sfida .pannello .apertura','fontSize'));
    dice(st('#sfida .pannello .apertura','color') === 'rgb(196, 210, 212)', 'color C4D2D4', st('#sfida .pannello .apertura','color'));
    dice(/^["']?Rosarivo/.test(st('#sfida .pannello .corpo','fontFamily')) &&
         st('#sfida .pannello .corpo','fontSize') === '16px',
      'il secondo e- Rosarivo 16',
      st('#sfida .pannello .corpo','fontFamily').slice(0,20) + ' ' + st('#sfida .pannello .corpo','fontSize'));
    dice(!!q('#sfida .pannello .riga'), 'e in mezzo c-e- la riga');
    dice(!!q('#sfida .pannello .btn'), 'il pulsante sta dentro al riquadro');
    dice(!q('#sfida .fondo-bottone'), 'e non piu- fuori');
    dice(parseFloat(st('#sfida .pannello','width')) <= 540, 'il riquadro e- largo 540', st('#sfida .pannello','width'));
    dice(st('#sfida .pannello','backdropFilter') === 'blur(20px)', 'con la sua sfocatura di 20', st('#sfida .pannello','backdropFilter'));
    dice(getComputedStyle(q('#sfida .pannello'), '::before').backgroundImage.indexOf('trama-pannello.png') > 0,
      'e la trama del disegno in overlay');

    // ── LE DOMANDE ──────────────────────────────────────────────────────────
    const dom = tutti('.domanda');
    dice(dom.length >= 6, 'le domande ci sono', dom.length);
    dice(dom.every(d => getComputedStyle(d).backdropFilter === 'blur(15px)' ||
                        getComputedStyle(d).webkitBackdropFilter === 'blur(15px)'),
      'sfocatura dietro di 15', st('.domanda','backdropFilter'));
    dice(dom.every(d => Math.round(parseFloat(getComputedStyle(d).borderTopLeftRadius)) === 16),
      'angoli di 16', st('.domanda','borderTopLeftRadius'));
    dice(dom.every(d => getComputedStyle(d).borderTopColor === 'rgb(78, 84, 85)' &&
                        Math.round(parseFloat(getComputedStyle(d).borderTopWidth)) === 1),
      'bordo di 1 color 4E5455', st('.domanda','borderTopColor') + ' ' + st('.domanda','borderTopWidth'));
    dice(st('.domanda','boxShadow').indexOf('rgba(0, 0, 0, 0.3)') >= 0, 'e la sua ombra', st('.domanda','boxShadow'));
    dice(st('.domanda','backgroundImage').indexOf('gradient') >= 0, 'il fondo e- il gradiente del disegno');
    // Venti di stacco, e nessuna riga in mezzo: le righe erano da togliere.
    if(dom.length > 1){
      const stacco = Math.round(rt(dom[1]).top - rt(dom[0]).bottom);
      dice(stacco === 20, 'venti fra una domanda e l-altra', stacco);
    }
    dice(!q('#faq hr') && !q('#faq .riga'), 'e nessuna riga fra le domande');
    dice(dom.filter(d => d.classList.contains('aperta')).length === 1, 'ne resta aperta una sola');
    dice(dom[0].classList.contains('aperta'), 'ed e- la prima, come nel disegno');
    dice(dom[0].querySelector('.risposta').offsetHeight > 20, 'la risposta si vede davvero',
      dom[0].querySelector('.risposta').offsetHeight);

    // ── GEPPETTO ────────────────────────────────────────────────────────────
    // Grande, dietro alle domande. Non nel piede: e' il posto che ha nel
    // disegno, e nel piede stava semplicemente altrove.
    const gep = q('#faq .geppetto');
    dice(!!gep, 'Geppetto sta dietro alle domande');
    dice(gep && gep.naturalWidth > 0, 'ed e- arrivato');
    if(!STRETTO) dice(gep && Math.abs(gep.offsetWidth - 907) <= 1, 'grande 907', gep && gep.offsetWidth);
    dice(!q('footer .geppetto') && !q('footer img[src*="geppetto"]'), 'e nel piede non c-e- piu-');
    dice(gep && gep.hasAttribute('data-parallasse'), 'e si muove in parallasse');

    // ── LA PARALLASSE ───────────────────────────────────────────────────────
    dice(tutti('[data-parallasse]').length >= 2, 'i fondali che restano si muovono',
      tutti('[data-parallasse]').map(e=>e.getAttribute('data-parallasse')).join(' '));

    // ── IL PIEDE ────────────────────────────────────────────────────────────
    // Il colore della pagina, non un altro: un piede di un altro colore sarebbe
    // una fascia, e qui non c'e' nessuna fascia da fare.
    dice(st('footer','backgroundColor') === 'rgb(27, 35, 37)', 'il piede e- del colore della pagina', st('footer','backgroundColor'));
    dice(st('body','backgroundColor') === 'rgb(27, 35, 37)', 'che e- 1B2325', st('body','backgroundColor'));

    // ── LA FINESTRA DEI CONTATTI ────────────────────────────────────────────
    dice(!!q('#contatto') && !!q('#apri-contatto'), 'la finestra dei contatti e il suo pulsante');
    dice(st('#contatto','visibility') === 'hidden', 'e sta chiusa finche- non la si apre');

    // ── LA POLVERE ──────────────────────────────────────────────────────────
    const tele = tutti('.polvere');
    dice(tele.length === 3, 'i tre piani di polvere', tele.length);
    dice(tele.every(t => t.width > 0 && t.height > 0), 'e le tele sono state misurate',
      tele.map(t=>t.width+'x'+t.height).join(' '));
    // Le stesse sfocature del menu del gioco: lontano 1, mezzo niente, vicino 3.5.
    dice(st('#polvere-lontano','filter') === 'blur(1px)', 'il piano lontano sfocato di 1', st('#polvere-lontano','filter'));
    dice(st('#polvere-mezzo','filter') === 'none', 'quello di mezzo nitido', st('#polvere-mezzo','filter'));
    dice(st('#polvere-vicino','filter') === 'blur(3.5px)', 'quello vicino di 3.5', st('#polvere-vicino','filter'));

    // ── NIENTE DATI NEL BROWSER ─────────────────────────────────────────────
    // La regola della casa. Vale anche qui, e qui non c'e' nemmeno niente da
    // ricordare.
    let quanti = -1;
    try { quanti = localStorage.length; } catch(e) { quanti = 0; }
    dice(quanti === 0, 'la pagina non scrive niente nel browser', quanti);
    dice(document.cookie === '', 'e nemmeno un biscotto', document.cookie);

    // ── LO SCHERMO STRETTO ──────────────────────────────────────────────────
    if(STRETTO){
      dice(st('.tocco','display') === 'block', 'le zone da toccare sulla carta ci sono');
      dice(st('#tocco-detto','display') === 'block', 'e il riquadro che si riempie');
      dice(getComputedStyle(q('.cartellino')).display === 'none', 'i cinque cartellini sono spariti');
      dice(st('#collezione .palco','position') === 'static', 'la carta e- tornata nel flusso');
      const c = rt('.carta-scena');
      dice(c.left >= -1 && c.right <= innerWidth + 1, 'e ci sta dentro',
        Math.round(c.left) + ' ' + Math.round(c.right) + ' su ' + innerWidth);
    }
    return dette;
  }catch(e){ dette.push({ ok:false, che:'IL BANCO E- INCIAMPATO, e l ultimo controllo riuscito e stato: ' + (dette.length ? dette[dette.length-1].che : 'nessuno'), perche:String((e && e.stack) || e) }); return dette; } })()`);

  // Un tocco sulla carta, su schermo stretto: il riquadro deve riempirsi col
  // testo del cartellino giusto — che e' lo STESSO testo, preso da li', non una
  // seconda copia da tenere aggiornata.
  if (STRETTO) {
    const tocco = await win.webContents.executeJavaScript(`(function(){
      const z = document.querySelector('.tocco b[data-che="livello"]');
      if(!z) return { ok:false, perche:'la zona non c-e-' };
      z.click();
      return new Promise(r => setTimeout(() => {
        const d = document.getElementById('tocco-detto');
        r({ ok: d.textContent.indexOf('level 4') > 0, perche: d.textContent.slice(0, 46),
            acceso: z.classList.contains('acceso') });
      }, 240));
    })()`);
    dette.push({ ok: tocco.ok, che: 'toccando la carta compare il testo giusto', perche: tocco.perche });
    dette.push({ ok: !!tocco.acceso, che: 'e il pezzo toccato si accende' });
  }

  // LA BARRA SUL TELEFONO. Non c'e' sul cappello e compare dalla seconda
  // sezione in poi. Si SCORRE davvero e si guarda: la classe la mette lo
  // stesso codice che si sta controllando, quindi guardare la classe non
  // proverebbe niente.
  if (STRETTO) {
    const barra = await win.webContents.executeJavaScript(`(function(){
      document.documentElement.style.scrollBehavior = 'auto';
      const b = document.getElementById('barra');
      // Si guarda la CLASSE, non l'opacita'. La classe la mette il gestore
      // nello stesso istante in cui gira; l'opacita' arriva in fondo a una
      // catena — evento, giro di rAF, transizione — che in una finestra non a
      // schermo ci mette un secondo e mezzo, e non sempre lo stesso.
      // Che poi la classe spenga davvero la barra e' un fatto del foglio di
      // stile, e si controlla sotto, a pagina ferma.
      const dopoUnGiro = function(){
        return new Promise(function(r){
          let giri = 0;
          (function guarda(){
            if(++giri > 30) return r();
            requestAnimationFrame(function(){ setTimeout(guarda, 40); });
          })();
        });
      };
      scrollTo(0, 0);
      return dopoUnGiro().then(function(){
        const su = b.classList.contains('via');
        scrollTo(0, document.getElementById('collezione').getBoundingClientRect().top + pageYOffset);
        return dopoUnGiro().then(function(){
          return { cappello: su, giu: b.classList.contains('via'),
                   sfocato: getComputedStyle(b).backdropFilter,
                   dove: Math.round(pageYOffset) };
        });
      });
    })()`);
    dette.push({ ok: barra.cappello === true, che: 'sul cappello la barra si toglie', perche: 'via ' + barra.cappello });
    dette.push({ ok: barra.giu === false, che: 'e dalla seconda sezione in poi torna', perche: 'via ' + barra.giu + ' a ' + barra.dove });
    dette.push({ ok: String(barra.sfocato).indexOf('blur') >= 0, che: 'col suo fondo sfocato', perche: String(barra.sfocato) });
  }

  // Le domande si aprono e si chiudono davvero: l'altezza si misura, e una
  // misura sbagliata qui e' un accordion che non si apre o che non si richiude.
  //
  // Le transizioni si spengono prima. In una finestra che non e' a schermo le
  // transizioni CSS NON AVANZANO: leggere l'altezza a meta' di una transizione
  // ferma restituisce sempre il valore di PARTENZA — cioe' zero — e il banco
  // direbbe che l'accordion e' rotto quando invece e' lui a guardare un
  // fotogramma congelato.
  const apre = await win.webContents.executeJavaScript(`(function(){
    const spegni = document.createElement('style');
    spegni.textContent = '*{transition:none !important}';
    document.head.appendChild(spegni);
    const b = [...document.querySelectorAll('.domanda > button')][2];
    b.click();
    return new Promise(r => setTimeout(() => {
      const d = b.parentNode, alta = d.querySelector('.risposta').offsetHeight;
      const altre = [...document.querySelectorAll('.domanda.aperta')].length;
      b.click();
      setTimeout(() => r({ alta, altre, chiusa: d.querySelector('.risposta').offsetHeight }), 500);
    }, 500));
  })()`);
  dette.push({ ok: apre.alta > 20, che: 'una domanda si apre', perche: apre.alta + 'px' });
  dette.push({ ok: apre.altre === 1, che: 'e chiude quella che era aperta', perche: apre.altre + ' aperte' });
  dette.push({ ok: apre.chiusa === 0, che: 'e si richiude', perche: apre.chiusa + 'px' });

  // Il riflesso sul marchio: lo fa partire un timer, e le due classi si
  // alternano perche' riassegnare la stessa animazione non la fa ripartire.
  const lampo = await win.webContents.executeJavaScript(`(function(){
    const r = document.querySelector('#marchio .riflesso');
    return { classi: r.className, animazione: getComputedStyle(r).animationName };
  })()`);
  dette.push({ ok: /\ba\b|\bb\b/.test(lampo.classi), che: 'il riflesso e- gia- passato almeno una volta', perche: lampo.classi });

  dette.push({ ok: mancanti.length === 0, che: 'ogni file che la pagina chiede esiste', perche: mancanti.join(' ') });
  // L'avviso sulla Content-Security-Policy e' di Electron e parla di Electron:
  // riguarda le pagine caricate dentro a un programma, non un sito servito da
  // un server. Sulla pagina non dice niente.
  const veri = lamenti.filter(l => !/Autofill|DevTools|Security Warning/.test(l));
  dette.push({ ok: veri.length === 0, che: 'e non si lamenta di niente', perche: veri.slice(0, 3).join(' | ') });

  if (SCATTO) {
    const img = await win.webContents.capturePage();
    fs.writeFileSync(SCATTO, img.toPNG());
  }

  let male = 0;
  for (const d of dette) {
    if (!d.ok) male++;
    console.log((d.ok ? '  ok  ' : '  NO  ') + d.che + (d.perche && !d.ok ? '  —  ' + d.perche : ''));
  }
  console.log('\n' + (LARGO + 'x' + ALTO) + (STRETTO ? ' (stretto)' : '') + ': ' +
              (dette.length - male) + ' su ' + dette.length + (male ? '  — ' + male + ' da sistemare' : '  — tutto a posto'));
  if (SCATTO) console.log('scatto in ' + SCATTO);
  app.exit(male ? 1 : 0);
});
