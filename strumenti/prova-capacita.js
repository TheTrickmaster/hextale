// L'IA GIOCA CON UN MAZZO CHE COSTA QUANTO IL TUO.
//
//     $ELECTRON strumenti/prova-capacita.js
//
// La capacita' di un mazzo e' la somma dei costi di rarita' — timeless 4,
// mythic 3, rare 2, common 1 — e il gioco te ne concede ventiquattro. Fino
// alla v0.79.29 l'IA li spendeva TUTTI a ogni partita: le composizioni ammesse
// erano solo quelle che costavano esattamente il massimo, quindi contro un
// mazzo iniziale da dodici punti scendeva in campo con dodici rare.
//
// Il pareggio che c'era gia' guardava la POTENZA, cioe' i valori sui lati. La
// potenza non vede le abilita', che sono quasi tutta la differenza fra una
// common e una rare: due mazzi possono avere la stessa somma di numeri e non
// essere per niente la stessa partita. Per questo la capacita' va pareggiata
// per conto suo.
//
// Il roster del file aperto da solo ha quattro carte: non basta per generare
// niente. Qui si carica il catalogo vero (107 carte, tutte e quattro le
// rarita'), che e' lo stesso da cui il server importa.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
const CATALOGO = path.join(RADICE, 'server', 'importazione', '.lavoro', 'catalogo.json');

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
setTimeout(() => { console.error('PIANTATA: nessuna risposta in 120s'); app.exit(2); }, 120000);

app.whenReady().then(async () => {
  const cat = JSON.parse(fs.readFileSync(CATALOGO, 'utf8'));
  const carte = Array.isArray(cat) ? cat : (cat.carte || cat.cards || Object.values(cat));

  const win = new BrowserWindow({ show: false, width: 1280, height: 800, frame: false,
    webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 2500));

  const dette = await win.webContents.executeJavaScript(`(function(){ try{
    const dette = [];
    const dice = (ok, che, perche) => dette.push({ ok:!!ok, che:che, perche:perche||'' });
    // Il banco deve poter girare anche sul codice DI PRIMA, dove questa
    // costante non esiste: senza questa riga si fermerebbe a un ReferenceError
    // invece di mostrare cosa faceva quel codice, che e' il motivo per cui lo
    // si esegue li'.
    const MIN = (typeof MAZZO_PUNTI_MIN === 'number') ? MAZZO_PUNTI_MIN : MAZZO_CARTE;

    // Il roster vero. Si scrive DENTRO all'array che c'e', non se ne mette uno
    // nuovo: FINAL_CARDS e' una costante del documento, e riassegnarla da qui
    // non la sostituisce.
    const CATALOGO = ${JSON.stringify(carte)};
    FINAL_CARDS.length = 0;
    CATALOGO.forEach(c=>FINAL_CARDS.push(c));
    // Le carte possedute: tutte, o carteDelGiocatore() ne lascerebbe zero.
    CARTE_POSSEDUTE = {};
    FINAL_CARDS.forEach(c=>{ if(c.slug) CARTE_POSSEDUTE[c.slug] = 1; });
    const giocabili = carteGiocabili();
    dice(giocabili.length > 40, 'il roster di prova ha abbastanza carte', giocabili.length + ' giocabili');
    const perRarita = {};
    giocabili.forEach(e=>{ const k=String(e.rarity||'common').toLowerCase();
      perRarita[k]=(perRarita[k]||0)+1; });
    // Quante ne servono al massimo per una composizione da 24 punti in 12
    // carte: dodici common (budget minimo), dodici rare (24 = 12x2), sei
    // mythic (3m + (12-m) = 24) e quattro timeless (4t + (12-t) = 24). Sono
    // questi i tetti veri, non un dodici uguale per tutti — chiedere dodici
    // timeless vorrebbe dire far fallire il banco per una composizione che non
    // esiste.
    const SERVONO = { common:12, rare:12, mythic:6, timeless:4 };
    const scarse = Object.keys(SERVONO).filter(k => (perRarita[k]||0) < SERVONO[k]);
    dice(scarse.length === 0, 'e abbastanza carte di ogni rarita- per ogni composizione',
      JSON.stringify(perRarita) + '  mancano: ' + scarse.join(' '));

    // ── IL BUDGET SI RISPETTA ──────────────────────────────────────────────
    // Dal minimo (dodici common) al massimo, ogni budget chiesto dev'essere
    // speso esatto. E' la cosa che non si poteva chiedere prima: makeDeck
    // conosceva un numero solo.
    const fuori = [];
    for(let p = MIN; p <= MAZZO_PUNTI; p++){
      for(let giro=0; giro<6; giro++){
        const m = makeDeck(2, MAZZO_CARTE, p);
        const costo = costoMazzo(m);
        if(m.length !== MAZZO_CARTE) fuori.push(p + ': ' + m.length + ' carte');
        else if(costo !== p) fuori.push(p + ' chiesti, ' + costo + ' spesi');
      }
    }
    dice(fuori.length === 0, 'ogni budget fra ' + MIN + ' e ' + MAZZO_PUNTI + ' viene speso esatto',
      fuori.slice(0,6).join('   '));

    // Senza budget si spende il massimo, come sempre: e' il caso dei due mazzi
    // generati insieme, che si pareggiano fra loro.
    const senza = [];
    for(let i=0;i<6;i++) senza.push(costoMazzo(makeDeck(2, MAZZO_CARTE)));
    dice(senza.every(c=>c === MAZZO_PUNTI), 'senza budget si spende il massimo, come prima',
      senza.join(' '));

    // ── E L'IA SPENDE QUANTO IL GIOCATORE ──────────────────────────────────
    // Si costruisce il mazzo del giocatore a un costo dato e si guarda cosa
    // esce dall'altra parte. E' il giro vero: makeBalancedDecks.
    function mazzoDaPunti(punti){
      // Dodici carte che costano esattamente \`punti\`: si parte da dodici
      // common e si sostituisce finche' il conto ci arriva.
      const perR = {};
      giocabili.forEach(e=>{ const k=String(e.rarity||'common').toLowerCase();
        (perR[k]||(perR[k]=[])).push(e); });
      const comp = composizioniMazzo(punti)
        .filter(c => Object.keys(c).every(k => (perR[k]||[]).length >= c[k]))[0];
      if(!comp) return null;
      const prese = [];
      for(const k in comp) for(let i=0;i<comp[k];i++) prese.push(perR[k][i]);
      return { id:'prova', nome:'Prova', carte: prese.map(e=>String(e.id)) };
    }
    const esiti = [];
    [12, 14, 16, 18, 20, 24].forEach(punti=>{
      const mazzo = mazzoDaPunti(punti);
      if(!mazzo) { esiti.push({punti, saltato:true}); return; }
      MAZZI = [mazzo]; MAZZO_SCELTO = mazzo.id;
      const r = makeBalancedDecks(true);
      esiti.push({ punti, mio: costoMazzo(r.d1), suo: costoMazzo(r.d2), potenza: r.gap });
    });
    esiti.forEach(e=>{
      if(e.saltato){ dice(false, 'niente mazzo di prova da ' + e.punti + ' punti'); return; }
      dice(e.mio === e.punti, 'il mazzo del giocatore da ' + e.punti + ' punti costa ' + e.punti,
        'ne costa ' + e.mio);
      dice(e.suo === e.punti, '   e quello dell-IA costa uguale',
        'il giocatore ' + e.mio + ', l-IA ' + e.suo + ' — e- il guasto del 07/09/2026:\\n' +
        '        l-IA spendeva sempre ' + MAZZO_PUNTI + ' comunque fosse il tuo mazzo');
    });

    // ── E I LIVELLI RESTANO PAREGGIATI ─────────────────────────────────────
    // La capacita' non deve aver rotto l'altro pareggio, che e' arrivato prima.
    const mazzo = mazzoDaPunti(14);
    MAZZI = [mazzo]; MAZZO_SCELTO = mazzo.id;
    const r = makeBalancedDecks(true);
    const liv = c => (c && typeof c.level === 'number') ? c.level : 1;
    const mioLiv = r.d1.reduce((s,c)=>s+liv(c),0), suoLiv = r.d2.reduce((s,c)=>s+liv(c),0);
    dice(mioLiv === suoLiv, 'i livelli restano pareggiati',
      'il tuo ' + mioLiv + ', quello dell-IA ' + suoLiv);
    // E la potenza resta nella forbice chiesta.
    dice(r.gap <= BALANCE_MAX_GAP + 0.001, 'e la potenza resta nella forbice',
      'scarto ' + (r.gap*100).toFixed(1) + '%, massimo ' + (BALANCE_MAX_GAP*100) + '%');

    return dette;
  }catch(e){ return [{ok:false, che:'la prova si e- rotta', perche:String((e && e.stack) || e)}]; } })()`);

  let male = 0;
  for (const d of dette) {
    console.log((d.ok ? '  ok  ' : '  NO  ') + d.che + (d.ok || !d.perche ? '' : '\n        ' + d.perche));
    if (!d.ok) male++;
  }
  console.log('\n' + dette.length + ' controlli, ' + male + ' storti');
  app.exit(male ? 1 : 0);
});
