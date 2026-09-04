// KING LOUIE, "I Wanna Be Like You": chiede il bersaglio e copia i tratti?
//
// Si carica il gioco vero e si chiamano le sue funzioni vere su un tabellone
// costruito a mano. Non serve una partita: le due cose da provare — quali
// vicini si possono indicare, e cosa succede quando se ne indica uno — non
// dipendono da nient'altro che dal tabellone e dalla riga del foglio.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
const CATALOGO = path.join(RADICE, 'server', 'importazione', '.lavoro', 'catalogo.json');

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

function rigaDi(nome) {
  const c = JSON.parse(fs.readFileSync(CATALOGO, 'utf8'));
  const arr = Array.isArray(c) ? c : (c.carte || c.cards || Object.values(c));
  const x = arr.find(v => v && v.name === nome);
  if (!x) throw new Error('nel catalogo non c-e- "' + nome + '"');
  return x;
}

app.whenReady().then(async () => {
  const louie = rigaDi('King Louie');
  const win = new BrowserWindow({ show: false, width: 1280, height: 800,
    webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 2000));

  const esito = await win.webContents.executeJavaScript(`(function(){ try{
    const RIGA = ${JSON.stringify(louie)};
    const dette = [];
    const dice = (ok, che, perche) => dette.push({ ok: !!ok, che: che, perche: perche || '' });

    // Un tabellone di comodo: il raggio due del gioco vero, senza buchi.
    const celle = [];
    for(let q=-2;q<=2;q++) for(let r=-2;r<=2;r++){ if(Math.abs(q+r)>2) continue; celle.push({q:q,r:r}); }
    // Si SCRIVE DENTRO al G del gioco, non se ne mette un altro al suo posto:
    // \`G\` e' una costante del documento, e riassegnare window.G non la tocca —
    // il gioco continuerebbe a leggere il suo, che a partita non iniziata e'
    // mezzo vuoto. I campi si rimettono a posto in fondo.
    const finto = { cells:celle, board:{}, holes:new Set(), destroyedHoles:new Set(),
                    currentPlayer:1, numeroTurno:1, p1Hand:[], p2Hand:[], p1Deck:[], p2Deck:[] };
    const vecchio = {};
    for(const k in finto) vecchio[k] = G[k];
    Object.assign(G, finto);

    const carta = (nome, tratti, nomi, owner) => ({
      id:'x'+nome, name:nome, owner:owner, values:{NW:1,NE:1,E:1,SE:1,SW:1,W:1},
      valoriBase:{NW:1,NE:1,E:1,SE:1,SW:1,W:1}, traits:tratti.slice(), traitNames:nomi.slice()
    });
    const metti = (q, r, c, owner) => { G.board[key(q,r)] = { card:c, owner:owner }; };

    // King Louie al centro, con la sua riga vera.
    const re = carta('King Louie', RIGA.traits, RIGA.traitNames, 1);
    re.cardAbility = RIGA.cardAbility;
    re.abilita = JSON.parse(JSON.stringify(RIGA.abilita));
    metti(0,0, re, 1);

    // Attorno: un'alleata con due tratti, un'avversaria con uno, una senza
    // tratti, e una lontana che non e' adiacente.
    const amica   = carta('Amica',   ['beast','noble'], ['Beast','Noble'], 1);
    const nemica  = carta('Nemica',  ['wild'],          ['Wild'],          2);
    const spoglia = carta('Spoglia', [],                [],                2);
    metti(1,0,  amica, 1);
    metti(0,1,  nemica, 2);
    metti(-1,0, spoglia, 2);
    metti(2,0,  carta('Lontana', ['royal'], ['Royal'], 2), 2);

    // ── 1. la finestra si apre, e su chi ────────────────────────────────────
    const scelta = sceltaDalFoglio(re, 0, 0, 1);
    dice(!!scelta, 'la finestra della scelta si apre',
      'Senza, la carta scende e non chiede niente: e- il guasto segnalato.');
    if(!scelta){ Object.assign(G, vecchio); return dette; }

    const b = (scelta.bersagli || []).slice().sort();
    dice(b.indexOf(key(1,0)) >= 0, 'si puo- indicare la vicina ALLEATA', '"Who = any" vuol dire di chiunque.');
    dice(b.indexOf(key(0,1)) >= 0, 'e la vicina AVVERSARIA');
    dice(b.indexOf(key(-1,0)) < 0, 'non la vicina senza tratti',
      'Copiare da chi non ha niente non e- un-azione: non e- un bersaglio.');
    dice(b.indexOf(key(2,0)) < 0, 'e non una carta lontana',
      'Il foglio dice "Where = adjacent".');
    dice(b.indexOf(key(0,0)) < 0, 'ne- se stessa');

    // ── 2. l-IA prende quella che le porta piu- tratti nuovi ────────────────
    const ia = scelta.valuta ? scelta.valuta(scelta) : null;
    dice(ia === key(1,0), 'l-IA sceglie il vicino che le da- piu- tratti nuovi',
      'Senza una valutazione tirerebbe a sorte, "lascio stare" compreso.');

    // ── 3. e la copia ───────────────────────────────────────────────────────
    const primaLui  = re.traits.slice();
    scelta.applica(key(1,0));
    const dopoLui   = re.traits.slice();
    const dopoNomi  = (re.traitNames || []).slice();

    dice(dopoLui.indexOf('beast') >= 0 && dopoLui.indexOf('noble') >= 0,
      'i tratti copiati arrivano su King Louie');
    dice(primaLui.every(x => dopoLui.indexOf(x) >= 0),
      'e quelli che aveva restano', 'Copia "all", non "diventa".');
    dice(dopoNomi.length === dopoLui.length
      && dopoNomi.every((n,i) => String(n).toLowerCase() === String(dopoLui[i]).toLowerCase()),
      'i due elenchi dei tratti restano allineati',
      'haTratto legge traitNames PRIMA delle sigle: se resta indietro, il\\n' +
      '        motore non vede i tratti nuovi e la copia non serve a niente.');
    dice(_motore().haTratto(re, ['Beast']) && _motore().haTratto(re, ['Noble']),
      'e il MOTORE li vede', 'E- questo che fa scattare i doni di Baloo e il resto.');
    dice((amica.traits||[]).length === 2,
      'la carta copiata non perde niente', 'E- una copia, non un furto.');

    // ── 4. il furto, che e- l-altra meta- della stessa faccenda ─────────────
    const derubata = carta('Derubata', ['wild'], ['Wild'], 2);
    metti(0,-1, derubata, 2);
    const ladro = carta('Ladro', [], [], 1);
    rubaITratti(ladro, key(0,-1));
    dice(_motore().haTratto(ladro, ['Wild']), 'chi ruba ha davvero il tratto');
    dice(!_motore().haTratto(derubata, ['Wild']),
      'e chi e- stato derubato non ce l-ha piu-',
      'Prima il furto svuotava solo le sigle e lasciava i nomi: per il motore\\n' +
      '        il derubato aveva ancora tutto.');

    Object.assign(G, vecchio);
    return dette;
  }catch(e){ return [{ok:false, che:'GUASTO: '+(e&&e.message), perche:String((e&&e.stack)||'').slice(0,300)}]; } })()`);

  let male = 0;
  for (const d of esito) {
    if (!d.ok) male++;
    console.log((d.ok ? '  ok   ' : '  NO   ') + d.che);
    if (!d.ok && d.perche) console.log('        ' + d.perche);
  }
  console.log(male ? '\n' + male + ' cose non tornano' : '\ntutto a posto (' + esito.length + ' controlli)');
  app.exit(male ? 1 : 0);
}).catch(e => { console.error(e); app.exit(1); });
