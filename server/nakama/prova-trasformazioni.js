// BANCO DI PROVA — LE TRASFORMAZIONI VENGONO DAL FOGLIO
//
// Fino alla v0.78.0 le due carte che si trasformavano stavano in una tabella
// scritta a mano nel gioco: la loro riga del foglio poteva dire qualunque cosa,
// non la leggeva nessuno. Chi copiava quella sintassi su una carta nuova non
// otteneva niente, e nemmeno un errore.
// Adesso la descrive il foglio. Questo banco controlla che sia vero:
//   - ogni riga con `transform` indica una carta che esiste;
//   - il momento dichiarato e' uno di quelli che il gioco fa scattare;
//   - e nel gioco non e' rimasto nessun elenco di carte scritto a mano.
//
//     node server/nakama/prova-trasformazioni.js
const fs = require('fs');
const path = require('path');
const cat = require('../importazione/.lavoro/catalogo.json');
const carte = Array.isArray(cat) ? cat : (cat.carte || cat.cards || Object.values(cat)[0]);
const gioco = fs.readFileSync(path.join(__dirname, '..', '..', 'play', 'index.html'), 'utf8');

// I momenti che il gioco sa far scattare. Se il foglio ne scrive un altro,
// l'abilita' resta muta senza dirlo — ed e' esattamente cio' che era successo.
const MOMENTI = ['on_play', 'on_conquer', 'on_conquered', 'on_moved', 'on_drawn',
  'end_of_turn', 'start_of_turn', 'while_on_board', 'while_in_hand', 'always'];

let ko = 0;
const conTrasformazione = carte.filter(c => c.abilita &&
  [c.abilita.effetto, c.abilita.effetto2].some(e => e && e.azione === 'transform'));

console.log('CARTE CHE SI TRASFORMANO: ' + conTrasformazione.length);
for (const c of conTrasformazione) {
  const a = c.abilita;
  const eff = [a.effetto, a.effetto2].find(e => e && e.azione === 'transform');
  const sigla = eff.quanto && eff.quanto.carta;
  const guai = [];

  if (!sigla) guai.push('non dice in chi si trasforma');
  else if (String(sigla).charAt(0) === '#') {
    const n = parseInt(String(sigla).slice(1), 10);
    const bersaglio = carte.find(x => Number(x.numero) === n);
    if (!bersaglio) guai.push('punta alla carta ' + sigla + ', che nel foglio non c-e-');
  }
  if (MOMENTI.indexOf(a.trigger) < 0) guai.push('il momento "' + a.trigger + '" il gioco non lo fa scattare');
  if (eff.chi && eff.chi !== 'self') guai.push('trasforma "' + eff.chi + '", e per ora si sa trasformare solo se stessa');
  if (a.se && (a.se.soggetto !== 'adjacent' || a.se.test !== 'has_trait') && a.trigger === 'on_play')
    guai.push('al piazzamento la condizione sa guardare solo un tratto su un vicino');

  const b = String(sigla).charAt(0) === '#'
    ? (carte.find(x => Number(x.numero) === parseInt(String(sigla).slice(1), 10)) || {}).name
    : sigla;
  ko += guai.length;
  console.log('  ' + (guai.length ? 'ROTTA' : 'ok   ') + ' ' + (c.name || '?').padEnd(24)
    + a.trigger.padEnd(16) + '-> ' + (b || '?'));
  for (const g of guai) console.log('        ' + g);
}

// E che nel gioco non sia rimasto un elenco scritto a mano.
console.log('');
const tabella = /const\s+TRASFORMAZIONI_AL_PIAZZAMENTO\s*=/.test(gioco);
if (tabella) { console.log('  ROTTA la tabella scritta a mano e- ancora nel gioco'); ko++; }
else console.log('  ok    nessun elenco di carte scritto a mano nel gioco');

// e che la strada dal foglio ci sia davvero
for (const f of ['_trasformazioneDelFoglio', '_trasformaDalFoglio', 'cartaIndicataDa', 'motoreMomentoSempre']) {
  const c1 = new RegExp('^function\\s+' + f + '\\b', 'm').test(gioco);
  if (!c1) ko++;
  console.log('  ' + (c1 ? 'ok    ' : 'MANCA ') + f);
}

// -- v0.78.9 -- LE DUE REGOLE CHE MANCAVANO --------------------------------
// 1) UNA RIGA COL "SE" NON SI ESEGUE SE IL "SE" E' FALSO.
//    Il Principe Ranocchio si trasformava senza nessuna principessa accanto, e
//    Cenerentola senza nessun Guardian: la condizione, su quella strada, non la
//    guardava nessuno. La guardia sta ora nella porta da cui passano TUTTE le
//    trasformazioni del foglio, non in una carta.
// 2) UNA TRASFORMAZIONE on_play E' UNA SCENA, NON UN CAMBIO.
//    La carta cade, salta, il bianco sale, e al culmine diventa un'altra. Se
//    eseguiDalFoglio la cambia per conto suo un istante prima, la scena non
//    parte nemmeno: la carta trasformata non porta piu' la riga che la
//    chiedeva. Era il "si trasforma di scatto" segnalato alla v0.78.8.
console.log('');
const REGOLE = [
  { nome: 'ogni trasformazione dal foglio guarda la condizione della riga',
    prova: /function _trasformaDalFoglio[\s\S]{0,600}?_condizioneDiTrasformazione\(a, card\)/,
    perche: 'senza, una riga con "if adjacent has_trait X" si esegue comunque' },
  { nome: 'la condizione sa rispondere in tutti e due i modi',
    prova: /function _condizioneDiTrasformazione[\s\S]{0,1200}?_condizioneAlPiazzamento[\s\S]{0,600}?_condizioneVeraQui/,
    perche: 'sul tabellone si guardano i vicini della casella, altrove risponde il motore' },
  { nome: 'al piazzamento vero la trasformazione la mette in scena doPlace',
    prova: /evento === 'on_play' && !_simulazioneInCorso/,
    perche: 'cambiarla dentro eseguiDalFoglio la farebbe avvenire di scatto, senza transizione' },
  { nome: 'la scena c-e- tutta: salto, lampo, discesa, respiro',
    prova: /TRASF_SU_MS[\s\S]*TRASF_GIU_MS[\s\S]*TRASF_PAUSA_MS/,
    perche: 'il respiro finale e- cio- che impedisce allo scontro di mangiarsi la trasformazione' },
  { nome: 'una carta che si trasforma resta al livello che aveva',
    prova: /cartaAlLivello\(nuova, _liv\)/,
    perche: 'senza, ricadeva al livello del foglio: un debuff che nessuna abilita- aveva ordinato' },
];
for (const r of REGOLE) {
  const buono = r.prova.test(gioco);
  if (!buono) ko++;
  console.log('  ' + (buono ? 'ok    ' : 'ROTTA ') + r.nome);
  if (!buono) console.log('        ' + r.perche);
}

console.log('\n' + (ko ? 'FALLITO: ' + ko + ' cose da sistemare' : 'OK: le trasformazioni vengono tutte dal foglio'));
process.exit(ko ? 1 : 0);
