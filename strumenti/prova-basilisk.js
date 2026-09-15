// IL BASILISCO, "Rocky", NEL GIOCO VERO (v0.80.30).
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-basilisk.js
//
// Lorenzo: "Basilisk congela per 1 turno, ma la carta alleata messa in campo,
// prima di congelarsi attacca". Si carica il gioco vero e si chiamano le sue
// funzioni su un tabellone costruito a mano; la riga la legge il parser vero.
//   1. il gioco non manda la riga al motore (la prossima carta non c'e' ancora) e
//      la prende in carico il foglio;
//   2. all'on_play resta una promessa sul giocatore: nessuna alleata gia' in campo
//      si congela, ne' il Basilisco; l'anteprima non promette niente;
//   3. la carta calata dopo si congela: dal turno in cui e' calata fino a quello
//      dopo l'avversario, e poi no; mentre e' congelata non si conquista;
//   4. la promessa vale per UNA carta e per il giocatore che l'ha lasciata;
//   5. nel piazzamento vero si riscuote DOPO le conquiste (attacca, poi si
//      congela), e ogni partita riparte senza promesse.
const { app, BrowserWindow } = require('electron');
require('./dal-disco');
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
const P = require(path.join(RADICE, 'server', 'importazione', 'abilita-parser.js'));
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const intestazione = ['Name'].concat(P.COLONNE);
const riga = (valori) => intestazione.map(c => (c in valori ? valori[c] : '-'));
const ABILITA = P.abilitaDaRiga('Basilisk', P.lettoreDi(intestazione)(riga({
  Name: 'Basilisk', 'Is unique': 'No', Trigger: 'on_play', Frequency: 'once_per_game', Window: 'always',
  'Player selection': 'no', Action: 'freeze', Who: 'ally', Which: 'next', Where: 'board', What: 'card',
  Amount: '1', Duration: 'n_turns', Link: '-', 'Player selection 2': 'no'
})));
const SORGENTE = fs.readFileSync(path.join(RADICE, 'play', 'index.html'), 'utf8');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('  NO  il banco non ha finito in tempo'); app.exit(2); }, 90000);
  const win = new BrowserWindow({ show: false, width: 1280, height: 800, webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 3000));

  const esito = await win.webContents.executeJavaScript(`(function(){ try{
    const ABILITA = ${JSON.stringify(ABILITA)};
    const dette = [];
    const dice = (ok, che, perche) => dette.push({ ok: !!ok, che: che, perche: perche === undefined ? '' : String(perche) });

    const celle = [];
    for(let q=-2;q<=2;q++) for(let r=-2;r<=2;r++){ if(Math.abs(q+r)>2) continue; celle.push({q:q,r:r}); }
    const finto = { cells:celle, board:{}, holes:new Set(), destroyedHoles:new Set(), currentPlayer:1, numeroTurno:5,
                    p1Hand:[], p2Hand:[], p1Deck:[], p2Deck:[], geloProssimaGiocata:{1:null,2:null} };
    const vecchio = {};
    for(const k in finto) vecchio[k] = G[k];
    Object.assign(G, finto);

    const carta = (nome, owner) => ({ id:'x'+nome, name:nome, owner:owner, level:1,
      values:{NW:3,NE:3,E:3,SE:3,SW:3,W:3}, valoriBase:{NW:3,NE:3,E:3,SE:3,SW:3,W:3}, traits:[], traitNames:[] });
    const metti = (q, r, c) => { G.board[key(q,r)] = { card:c, owner:c.owner }; };

    // ── 1. chi la prende in carico ──────────────────────────────────────────
    const basilisco = carta('Basilisk', 1);
    basilisco.abilita = JSON.parse(JSON.stringify(ABILITA));
    dice(_effettoSemplice(ABILITA.effetto) === false, 'un gelo sulla PROSSIMA carta non e- roba da motore');
    dice(motoreFaLEvento(basilisco, 'on_play') === false && _foglioFaLEvento(basilisco, 'on_play') === true, 'il motore non la prende, il foglio si-');

    // ── 2. la promessa ──────────────────────────────────────────────────────
    const giaInCampo = carta('GiaInCampo', 1);
    metti(1,0, giaInCampo);
    metti(0,0, basilisco);
    _simulazioneInCorso = true;
    try { eseguiDalFoglio(basilisco, 'on_play', {q:0, r:0}); } finally { _simulazioneInCorso = false; }
    dice(!G.geloProssimaGiocata[1], 'l-anteprima non promette niente');
    dice(eseguiDalFoglio(basilisco, 'on_play', {q:0, r:0}) === true, 'all-on_play la riga viene eseguita');
    const pr = G.geloProssimaGiocata[1];
    dice(pr && pr.postoDa === basilisco.id && pr.turni === 1, 'resta una promessa sul giocatore 1, per un turno', JSON.stringify(pr));
    dice(!cartaCongelata(giaInCampo) && !cartaCongelata(basilisco), 'nessuna alleata gia- in campo si congela, ne- il Basilisco');
    dice(riscuotiGeloProssimaGiocata(basilisco, 1) === false && !!G.geloProssimaGiocata[1], 'il Basilisco non riscuote la sua promessa');

    // ── 3. la carta dopo ────────────────────────────────────────────────────
    const nuova = carta('Nuova', 1);
    metti(0,1, nuova);
    dice(riscuotiGeloProssimaGiocata(nuova, 1) === true && nuova.congelataFinoAlTurno === 7, 'la carta calata dopo si congela (calata al turno 5: fino al 7)', nuova.congelataFinoAlTurno);
    const nemica = carta('Nemica', 2);
    dice(cartaCongelata(nuova) && puoConquistare(nemica, nuova, {}) === false, 'al turno 5 e- congelata e non si conquista');
    G.numeroTurno = 6;
    dice(cartaCongelata(nuova) && puoConquistare(nemica, nuova, {}) === false, 'al turno 6 (quello dell-avversario) ancora congelata');
    G.numeroTurno = 7;
    dice(!cartaCongelata(nuova) && puoConquistare(nemica, nuova, {}) === true, 'al turno 7 torna conquistabile');

    // ── 4. una carta sola, un giocatore solo ────────────────────────────────
    const terza = carta('Terza', 1);
    dice(riscuotiGeloProssimaGiocata(terza, 1) === false && !terza.congelataFinoAlTurno, 'la promessa vale per una carta sola');
    eseguiDalFoglio(basilisco, 'on_play', {q:0, r:0});
    const avversaria = carta('Avversaria', 2);
    dice(riscuotiGeloProssimaGiocata(avversaria, 2) === false && !!G.geloProssimaGiocata[1], 'la carta dell-avversario non riscuote la promessa del giocatore 1');

    Object.assign(G, vecchio);
    return dette;
  }catch(e){ return [{ok:false, che:'GUASTO: '+(e&&e.message), perche:String((e&&e.stack)||'').slice(0,400)}]; } })()`);

  // ── 5. nel sorgente ──────────────────────────────────────────────────────
  const inizio = SORGENTE.indexOf('function resolveConquestAndEndTurn(');
  const corpo = SORGENTE.slice(inizio, SORGENTE.indexOf('\nfunction ', inizio + 10));
  const conquiste = corpo.indexOf('puoConquistare(card, nb.card');
  const premio = corpo.indexOf('riscuotiPremioProssimaGiocata(card, player, conquered.length)');
  const gelo = corpo.indexOf('riscuotiGeloProssimaGiocata(card, player)');
  esito.push({ ok: conquiste > 0 && premio > conquiste && gelo > premio, che: 'nel piazzamento vero il gelo si riscuote DOPO le conquiste (prima attacca, poi si congela)', perche: [conquiste, premio, gelo].join(' / ') });
  esito.push({ ok: /premioProssimaGiocata:\{1:null,2:null\},\s*geloProssimaGiocata:\{1:null,2:null\}/.test(SORGENTE), che: 'ogni partita riparte senza promesse di gelo' });

  let male = 0;
  for (const d of esito) {
    if (!d.ok) male++;
    console.log((d.ok ? '  ok   ' : '  NO   ') + d.che);
    if (!d.ok && d.perche) console.log('        ' + d.perche);
  }
  console.log(male ? '\n' + male + ' cose non tornano' : '\ntutto a posto (' + esito.length + ' controlli)');
  app.exit(male ? 1 : 0);
}).catch(e => { console.error(e); app.exit(1); });
