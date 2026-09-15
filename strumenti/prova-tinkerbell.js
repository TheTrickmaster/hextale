// TINKER BELL, "Jealous Spark", NEL GIOCO VERO (v0.80.30).
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-tinkerbell.js
//
// Lorenzo: Tinker Bell ruba un buff. Si carica il gioco vero e si chiamano le sue
// funzioni su un tabellone costruito a mano (come prova-king-louie.js); la riga
// del foglio la legge il parser vero, qui nel processo principale.
//   1. i buff si ricordano lato per lato (perLato), anche sommando due colpi;
//   2. la finestra si apre e offre solo chi ha un buff da prendere: non chi ha solo
//      una sinergia viva, non chi e' protetto, non un'alleata, non un buff vecchio
//      senza lati;
//   3. l'IA sceglie il buff piu' grande;
//   4. il furto: via dal derubato sui lati da cui era arrivato, sugli stessi lati di
//      Tinker Bell, la riga "+N from <derubato>", gli altri buff del derubato restano;
//   5. l'anteprima non tocca il registro; un buff rubato si puo' rubare di nuovo;
//   6. la scena dice al motore chi ha un buff (il furto senza scelta).
const { app, BrowserWindow } = require('electron');
require('./dal-disco');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
const P = require(path.join(RADICE, 'server', 'importazione', 'abilita-parser.js'));
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const intestazione = ['Name'].concat(P.COLONNE);
const riga = (valori) => intestazione.map(c => (c in valori ? valori[c] : '-'));
const ABILITA = P.abilitaDaRiga('Tinker Bell', P.lettoreDi(intestazione)(riga({
  Name: 'Tinker Bell', 'Is unique': 'No', Trigger: 'on_play', Frequency: 'once_per_game', Window: 'always',
  'Player selection': 'yes', Action: 'steal', Who: 'opponent', Which: 'single', Where: 'board', What: 'buff',
  Duration: 'permanent', Link: '-', 'Player selection 2': 'no'
})));

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
    const finto = { cells:celle, board:{}, holes:new Set(), destroyedHoles:new Set(),
                    currentPlayer:1, numeroTurno:1, p1Hand:[], p2Hand:[], p1Deck:[], p2Deck:[] };
    const vecchio = {};
    for(const k in finto) vecchio[k] = G[k];
    Object.assign(G, finto);
    const bagheraVera = protettoDaBagheera;

    const carta = (nome, owner) => ({ id:'x'+nome, name:nome, owner:owner, level: 1,
      values:{NW:3,NE:3,E:3,SE:3,SW:3,W:3}, valoriBase:{NW:3,NE:3,E:3,SE:3,SW:3,W:3}, traits:[], traitNames:[] });
    const metti = (q, r, c) => { G.board[key(q,r)] = { card:c, owner:c.owner }; };
    const dona = (c, lati, quanto, da) => modificaValori(c, lati, quanto, null, { chiave:'dono:'+da, da:da, id:'x'+da });

    // ── 1. perLato ──────────────────────────────────────────────────────────
    const tinker = carta('Tinker', 1);
    tinker.abilita = JSON.parse(JSON.stringify(ABILITA));
    metti(0,0, tinker);
    const conDue = carta('ConDue', 2);            // +1 ALL da Merlin e +3 SE da Fata
    dona(conDue, ['NW','NE','E','SE','SW','W'], 1, 'Merlin');
    dona(conDue, ['SE'], 3, 'Fata');
    dona(conDue, ['SE'], 1, 'Fata');              // due colpi della stessa fonte: +4 su SE
    metti(1,0, conDue);
    const voceFata = conDue.modificatori['dono:Fata#buff'];
    dice(voceFata && voceFata.delta === 4 && voceFata.perLato && voceFata.perLato.SE === 4 && Object.keys(voceFata.perLato).length === 1,
      'i buff si ricordano lato per lato, anche sommando due colpi', JSON.stringify(voceFata));
    dice(conDue.modificatori['dono:Merlin#buff'].perLato.NW === 1 && Object.keys(conDue.modificatori['dono:Merlin#buff'].perLato).length === 6,
      'e un +1 ALL su tutti e sei', JSON.stringify(conDue.modificatori['dono:Merlin#buff']));

    const conUno = carta('ConUno', 2);  dona(conUno, ['NW','W'], 2, 'Genio'); metti(0,1, conUno);
    const soloSinergia = carta('SoloSinergia', 2); annotaModificatore(soloSinergia, 'bear_necessities', 'Baloo', 1, 'ALL'); metti(-1,0, soloSinergia);
    const protetta = carta('Protetta', 2); dona(protetta, ['E'], 5, 'Re'); metti(0,-1, protetta);
    const amica = carta('Amica', 1); dona(amica, ['E'], 6, 'Regina'); metti(1,-1, amica);
    const vecchia = carta('Vecchia', 2); vecchia.modificatori = { 'dono:Antico#buff': { da:'Antico', delta:7, ambito:'', id:'xAntico' } }; metti(-1,1, vecchia);
    const senza = carta('Senza', 2); metti(2,-1, senza);

    // ── 2. la finestra ──────────────────────────────────────────────────────
    protettoDaBagheera = (c) => c === protetta;
    const scelta = sceltaDalFoglio(tinker, 0, 0, 1);
    dice(!!scelta && scelta.chiave === 'ruba_buff', 'la finestra della scelta si apre', scelta && scelta.chiave);
    const b = ((scelta && scelta.bersagli) || []).slice().sort();
    const nomi = b.map(k => G.board[k].card.name).sort().join();
    dice(nomi === 'ConDue,ConUno', 'si possono indicare solo le avversarie con un buff da prendere', nomi);
    dice(b.indexOf(key(-1,0)) < 0, 'non chi ha solo una sinergia viva (Baloo)');
    dice(b.indexOf(key(0,-1)) < 0, 'non chi e- protetto (Bagheera)');
    dice(b.indexOf(key(1,-1)) < 0, 'non un-alleata (Who = opponent)');
    dice(b.indexOf(key(-1,1)) < 0, 'non un buff vecchio che non sa da quali lati veniva');
    dice(b.indexOf(key(2,-1)) < 0, 'e non chi non ha niente');

    // ── 3. l-IA ─────────────────────────────────────────────────────────────
    dice(scelta.valuta(scelta) === key(1,0), 'l-IA sceglie il buff piu- grande (+4 SE)', scelta.valuta(scelta));

    // ── 4. il furto ─────────────────────────────────────────────────────────
    const primaT = Object.assign({}, tinker.values), primaD = Object.assign({}, conDue.values);
    scelta.applica(key(1,0));
    dice(conDue.values.SE === primaD.SE - 4 && conDue.values.NW === primaD.NW, 'dal derubato il buff se ne va dai lati da cui era arrivato (SE -4)', JSON.stringify([primaD, conDue.values]));
    dice(tinker.values.SE === primaT.SE + 4 && tinker.values.NW === primaT.NW, 'e arriva sugli stessi lati di Tinker Bell (SE +4)', JSON.stringify([primaT, tinker.values]));
    dice(!conDue.modificatori['dono:Fata#buff'] && !!conDue.modificatori['dono:Merlin#buff'], 'la riga del buff rubato sparisce, gli altri buff restano', JSON.stringify(Object.keys(conDue.modificatori)));
    const righe = elencoModificatori(tinker).map(x => x.testo);
    dice(righe.indexOf('+4 from ConDue') >= 0, 'su Tinker Bell: "+4 from ConDue"', JSON.stringify(righe));
    dice(tinker.valoriBase.SE === primaT.SE + 4, 'e la base dei ricalcoli segue il furto', JSON.stringify(tinker.valoriBase));

    // ── 5. anteprima e furto del furto ──────────────────────────────────────
    const primaUno = JSON.stringify(conUno.modificatori);
    _simulazioneInCorso = true;
    try { rubaUnBuff(carta('Ombra', 1), conUno); } finally { _simulazioneInCorso = false; }
    dice(JSON.stringify(conUno.modificatori) === primaUno, 'l-anteprima non tocca il registro dei buff', JSON.stringify(conUno.modificatori));
    const campanellino = carta('Campanellino', 2);
    const presi = rubaUnBuff(campanellino, tinker);
    dice(presi.SE === 4 && campanellino.values.SE === 7 && tinker.values.SE === primaT.SE, 'un buff rubato si puo- rubare di nuovo', JSON.stringify([presi, campanellino.values, tinker.values]));

    // ── 6. la scena ─────────────────────────────────────────────────────────
    const scena = _scenaTabellone();
    dice(typeof scena.haBuffRubabile === 'function' && scena.haBuffRubabile(conUno) && !scena.haBuffRubabile(senza), 'la scena dice al motore chi ha un buff da prendere');

    protettoDaBagheera = bagheraVera;
    Object.assign(G, vecchio);
    return dette;
  }catch(e){ return [{ok:false, che:'GUASTO: '+(e&&e.message), perche:String((e&&e.stack)||'').slice(0,400)}]; } })()`);

  let male = 0;
  for (const d of esito) {
    if (!d.ok) male++;
    console.log((d.ok ? '  ok   ' : '  NO   ') + d.che);
    if (!d.ok && d.perche) console.log('        ' + d.perche);
  }
  console.log(male ? '\n' + male + ' cose non tornano' : '\ntutto a posto (' + esito.length + ' controlli)');
  app.exit(male ? 1 : 0);
}).catch(e => { console.error(e); app.exit(1); });
