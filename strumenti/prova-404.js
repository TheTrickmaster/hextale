// LA PAGINA CHE NON C'E'.
//
//     $ELECTRON strumenti/prova-404.js [scatto.png]
//     HX_SCHERMO=390x844 $ELECTRON strumenti/prova-404.js [scatto.png]
//
// La seconda forma la guarda su uno schermo stretto: la pagina ha tre stacchi
// da cento, e su un telefono cento tre volte non ci sono. I controlli sono gli
// stessi, tranne le cinque misure che il CSS cala apposta li' sotto.
//
// Il rischio vero di una 404 non e' come sta in piedi: e' che venga servita
// SOTTO un indirizzo che non esiste. Un percorso relativo cercherebbe i font
// dentro a una cartella immaginaria, e la pagina arriverebbe nuda proprio nel
// momento in cui il visitatore si e' gia' perso una volta.
// Per questo qui non si apre il file: si tira su un server sulla radice del
// sito e la si chiede da /play/roba/che/non/esiste, cioe' com'e' fatta la
// giornata storta di chi ci finisce davvero.
const { app, BrowserWindow } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
const SCATTO = process.argv[2] || '';
const [LARGO, ALTO] = (process.env.HX_SCHERMO || '1920x1080').split('x').map(Number);
const STRETTO = LARGO <= 640;   // la soglia del @media dentro alla pagina
const TIPI = { '.html':'text/html', '.png':'image/png', '.jpg':'image/jpeg',
               '.ttf':'font/ttf', '.js':'text/javascript', '.css':'text/css' };

// Il server minimo che serve: file se c'e', altrimenti 404.html con lo stato
// 404 — che e' esattamente il patto di GitHub Pages.
const chieste = [];
const mancanti = [];
const server = http.createServer((req, res) => {
  const via = decodeURIComponent(req.url.split('?')[0]);
  chieste.push(via);
  const dove = path.join(RADICE, via.replace(/^\/+/, ''));
  if (via !== '/' && fs.existsSync(dove) && fs.statSync(dove).isFile()) {
    res.writeHead(200, { 'Content-Type': TIPI[path.extname(dove).toLowerCase()] || 'application/octet-stream' });
    return res.end(fs.readFileSync(dove));
  }
  // La pagina stessa e' arrivata da un indirizzo che non esiste: e' il senso
  // della prova, non un guasto. Quello che conta sono le richieste che PARTONO
  // da lei — font, disegni, pezzi del pulsante — e quelle non devono mai
  // finire fuori strada. La prima richiesta e' sempre la pagina.
  if (via !== '/' && chieste.length > 1) mancanti.push(via);
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(fs.readFileSync(path.join(RADICE, '404.html')));
});

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const porta = server.address().port;
  const win = new BrowserWindow({ show: false, width: LARGO, height: ALTO, frame: false,
    webPreferences: { contextIsolation: false } });
  // L'indirizzo storto, non il file. E' il punto di tutta la prova.
  await win.loadURL('http://127.0.0.1:' + porta + '/play/roba/che/non/esiste');
  await new Promise(r => setTimeout(r, 1800));

  const dette = await win.webContents.executeJavaScript(`(function(){
    const STRETTO = ${STRETTO};
    // Le cinque misure che il @media cala. Stanno qui e non sparse nei
    // controlli: cosi' il banco dice cosa si aspetta invece di ripeterlo.
    const GRANDE = STRETTO ? 56 : 100;
    const PERDUTA = STRETTO ? '26px' : '36px';
    const BATTUTA = STRETTO ? '28px' : '40px';
    const POSTILLA = STRETTO ? '18px' : '24px';
    const dette = [];
    const dice = (ok, che, perche) => dette.push({ ok:!!ok, che:che, perche:perche||'' });
    const q = (s) => document.querySelector(s);
    const st = (s, p) => getComputedStyle(q(s))[p];
    // Le distanze in mezzo: dal fondo di uno alla cima del successivo, letto
    // sullo SCHERMO. E' l'unico modo onesto — un margine dichiarato puo'
    // essere schiacciato da un altro margine e nessuno se ne accorge.
    const stacco = (a, b) => Math.round(q(b).getBoundingClientRect().top - q(a).getBoundingClientRect().bottom);

    dice(document.title.indexOf('Page not found') >= 0, 'il titolo della scheda dice che la pagina non c-e-');

    // ── l'ordine e le distanze ─────────────────────────────────────────────
    const ordine = [...q('.quattroquattro').children].map(e=>e.className.split(' ')[0]).join(' ');
    dice(ordine === 'q-logo q-404 q-perduta q-battuta q-postilla hx-btn',
      'logo, 404, "Page not found", la battuta, la postilla, il pulsante', ordine);
    dice(stacco('.q-logo','.q-404') === GRANDE, GRANDE + ' fra il logo e il 404', stacco('.q-logo','.q-404') + '');
    dice(stacco('.q-404','.q-perduta') === 16, 'sedici fra il 404 e "Page not found"', stacco('.q-404','.q-perduta') + '');
    dice(stacco('.q-perduta','.q-battuta') === GRANDE, GRANDE + ' fra "Page not found" e la battuta', stacco('.q-perduta','.q-battuta') + '');
    dice(stacco('.q-postilla','.hx-btn') === GRANDE, GRANDE + ' fra la postilla e il pulsante', stacco('.q-postilla','.hx-btn') + '');

    // ── i caratteri e i colori ─────────────────────────────────────────────
    dice(st('.q-perduta','fontSize') === PERDUTA, '"Page not found" a ' + PERDUTA, st('.q-perduta','fontSize'));
    dice(st('.q-perduta','color') === 'rgb(116, 131, 134)', '"Page not found" 748386', st('.q-perduta','color'));
    dice(/^["']?Rosarivo/.test(st('.q-perduta','fontFamily')), '"Page not found" in Rosarivo', st('.q-perduta','fontFamily'));
    dice(st('.q-battuta','fontSize') === BATTUTA, 'la battuta a ' + BATTUTA, st('.q-battuta','fontSize'));
    dice(st('.q-battuta','color') === 'rgb(237, 224, 198)', 'la battuta EDE0C6', st('.q-battuta','color'));
    // Il nome esce fra virgolette perche' contiene uno spazio: si guarda che sia
    // il PRIMO della lista, non che compaia da qualche parte.
    dice(/^["']?Marcellus/.test(st('.q-battuta','fontFamily')), 'la battuta in Marcellus', st('.q-battuta','fontFamily'));
    dice(st('.q-postilla','fontSize') === POSTILLA, 'la postilla a ' + POSTILLA, st('.q-postilla','fontSize'));
    dice(st('.q-postilla','color') === 'rgb(237, 224, 198)', 'la postilla EDE0C6', st('.q-postilla','color'));
    dice(/^["']?Rosarivo/.test(st('.q-postilla','fontFamily')), 'la postilla in Rosarivo', st('.q-postilla','fontFamily'));

    // ── il blocco sta in mezzo ─────────────────────────────────────────────
    const r = q('.quattroquattro').getBoundingClientRect();
    dice(Math.abs((r.left + r.right)/2 - innerWidth/2) <= 1, 'il blocco e- centrato in orizzontale');
    dice(Math.abs((r.top + r.bottom)/2 - innerHeight/2) <= 1, 'il blocco e- centrato in verticale');
    // Su uno schermo largo il blocco deve starci tutto; su un telefono no —
    // li' la pagina scorre, che e' meglio di tagliare.
    if(!STRETTO) dice(r.height <= innerHeight, 'ci sta tutto nello schermo', Math.round(r.height) + ' su ' + innerHeight);
    // Il "404" invece non deve MAI uscire di lato: sotto ai 352px della sua
    // immagine e' il max-width a tenerlo dentro, e questo lo verifica.
    const r4 = q('.q-404').getBoundingClientRect();
    dice(r4.left >= -1 && r4.right <= innerWidth + 1, 'il 404 non esce dallo schermo',
      Math.round(r4.width) + ' su ' + innerWidth);

    // ── il pulsante ────────────────────────────────────────────────────────
    const b = q('.hx-btn');
    dice(b.getAttribute('href') === '/', 'il pulsante torna alla radice', b.getAttribute('href'));
    dice(b.querySelector('.hxb-label').textContent.trim() === 'Back to homepage', 'dice "Back to homepage"');
    dice(b.offsetWidth >= 200 && b.offsetWidth <= 400, 'largo fra 200 e 400', b.offsetWidth + '');
    dice(b.offsetHeight === 68, 'alto 68', b.offsetHeight + '');
    // I cinque pezzi ci sono e nessuno e' schiacciato a zero: e' la firma del
    // pulsante rotto — sotto i 156px di pezzi fissi i riempitivi spariscono e
    // le tre immagini finiscono attaccate.
    const pezzi = [...b.querySelectorAll('.hxb-strip > span')];
    dice(pezzi.length === 5, 'cinque pezzi nella striscia', pezzi.length + '');
    dice(pezzi.every(p=>p.offsetWidth > 0), 'nessun pezzo schiacciato a zero',
      pezzi.map(p=>p.offsetWidth).join(' '));
    dice(pezzi.every(p=>getComputedStyle(p).backgroundImage.indexOf('button-opaque-') > 0),
      'e- la versione grigia opaca', getComputedStyle(pezzi[0]).backgroundImage);
    // L'etichetta in mezzo al pulsante, nei due versi.
    const rb = b.getBoundingClientRect(), rl = b.querySelector('.hxb-label').getBoundingClientRect();
    dice(Math.abs((rl.left+rl.right)/2 - (rb.left+rb.right)/2) <= 1, 'l-etichetta centrata in orizzontale');
    dice(Math.abs((rl.top+rl.bottom)/2 - (rb.top+rb.bottom)/2) <= 1, 'l-etichetta centrata in verticale');

    // ── il fondale ─────────────────────────────────────────────────────────
    dice(getComputedStyle(document.body).backgroundImage.indexOf('404-bg.jpg') > 0,
      'il fondale e- 404-bg', getComputedStyle(document.body).backgroundImage);
    dice(getComputedStyle(document.body).backgroundSize === 'cover', 'il fondale copre senza deformarsi');

    // ── le immagini sono arrivate DAVVERO ──────────────────────────────────
    // naturalWidth a zero vuol dire "non caricata": il tag c'e', il disegno no.
    [...document.images].forEach(im=>{
      dice(im.naturalWidth > 0, 'caricata: ' + im.getAttribute('src'),
        'e- l-indirizzo che il browser ha chiesto partendo da /play/roba/che/non/esiste');
    });
    return dette;
  })()`);

  if (SCATTO) {
    win.setPosition(-3200, 0); win.showInactive();
    await new Promise(r => setTimeout(r, 400));
    fs.writeFileSync(SCATTO, (await win.webContents.capturePage()).toPNG());
    console.log('scatto  ' + SCATTO);
  }

  // I font e i pezzi del pulsante sono richieste che partono dal CSS: se un
  // indirizzo fosse relativo il server le vedrebbe arrivare sotto
  // /play/roba/che/... e risponderebbe con la 404 stessa. Il conto dei
  // mancanti e' quindi la prova che i percorsi assoluti reggono.
  dette.push({ ok: mancanti.length === 0, che: 'nessuna risorsa cercata nel posto sbagliato',
    perche: mancanti.length ? mancanti.join('\n        ') : '' });
  const font = chieste.filter(v => v.indexOf('/fonts/') === 0);
  dette.push({ ok: font.length >= 2, che: 'i font chiesti dalla radice', perche: font.join('  ') });

  let male = 0;
  for (const d of dette) {
    console.log((d.ok ? '  ok  ' : '  NO  ') + d.che + (d.ok || !d.perche ? '' : '\n        ' + d.perche));
    if (!d.ok) male++;
  }
  console.log('\n' + dette.length + ' controlli, ' + male + ' storti');
  server.close();
  app.exit(male ? 1 : 0);
});
