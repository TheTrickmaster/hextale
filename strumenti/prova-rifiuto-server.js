// CHI TORNA IN CERCA DOPO UN "MATCH FOUND!" ANDATO A VUOTO — SUL SERVER.
//
//     node strumenti/prova-rifiuto-server.js [percorso/index.js]
//
// La regola di Lorenzo, per intero:
//   - chi preme Decline esce dalla ricerca;
//   - chi non preme Accept in tempo esce dalla ricerca, SEMPRE;
//   - chi aveva accettato torna in cerca da solo;
//   - chi viene interrotto da un Decline mentre ha ancora tempo torna in cerca.
//
// A dire a ciascuno se tornare e' il server, dentro alla notifica che manda
// quando qualcuno rifiuta, perche' e' l'unico che conosce la scadenza vera. Il
// difetto che questo banco tiene lontano era il caso piu' banale: nessuno dei
// due accetta, il primo a scadere avvisa l'altro, e l'altro — il cui orologio
// segnava ancora qualche centesimo — veniva rimesso in coda.
//
// Come prova-quest-server: si carica index.js in un contesto finto, senza
// Nakama, e si chiama partitaSignal con un tavolo e un dispatcher scritti a
// mano che annotano cosa viene mandato a chi.
const fs = require('fs');
const vm = require('vm');

const DOVE = process.argv[2] || 'C:/Users/masil/Desktop/Hextale/game-assets/server/nakama/index.js';
console.log('provo ' + DOVE + String.fromCharCode(10));
const mondo = { console, Date, Math, JSON, parseInt, parseFloat, isFinite, String, Object, Array, Error };
mondo.global = mondo;
vm.createContext(mondo);
new vm.Script(fs.readFileSync(DOVE, 'utf8')).runInContext(mondo);

let male = 0;
const dice = (ok, che, perche) => {
  if (!ok) male++;
  console.log((ok ? '  ok   ' : '  NO   ') + che);
  if (perche) console.log('        ' + perche);
};

// Un tavolo nato `msFa` millisecondi fa, con dentro chi ha gia' accettato.
const tavolo = (msFa, dentro, extra) => Object.assign({
  giocatori: ['A', 'B'],
  presenze: Object.fromEntries(dentro.map(u => [u, { userId: u }])),
  natoIl: Date.now() - msFa,
  iniziata: false, finita: false
}, extra || {});

// Un giro di partitaSignal: torna l'esito e cosa e' stato mandato.
const giro = (stato, dati) => {
  const notifiche = [], messaggi = [];
  const nk = {
    notificationSend: (u, oggetto, contenuto, codice, mittente, persistente) =>
      notifiche.push({ u, contenuto, codice, mittente, persistente })
  };
  const dispatcher = {
    broadcastMessage: (op, data, presenze) =>
      messaggi.push({ op, a: (presenze || []).map(p => p.userId) })
  };
  const logger = { info() {}, warn() {}, error() {} };
  const esito = mondo.partitaSignal({ matchId: 'm1' }, logger, nk, dispatcher, 0, stato, JSON.stringify(dati));
  return { esito, notifiche, messaggi };
};
const aB = (g) => g.notifiche.filter(n => n.u === 'B');

dice(typeof mondo.partitaSignal === 'function' && typeof mondo.PRONTI_MS === 'number',
  'il server ha la sua regola e la sua scadenza', 'PRONTI_MS = ' + mondo.PRONTI_MS);

// ── 1. NESSUNO ACCETTA ────────────────────────────────────────────────────
const g1 = giro(tavolo(mondo.PRONTI_MS + 200, []), { rifiuta: 'A', perTempo: true });
dice(aB(g1).length === 1 && aB(g1)[0].contenuto.torna === false,
  'nessuno accetta: il primo a scadere avvisa l-altro, e l-altro NON torna in cerca',
  'B riceve torna = ' + (aB(g1)[0] && aB(g1)[0].contenuto.torna) + '. Era il caso rotto.');
dice(g1.notifiche.every(n => n.u !== 'A'), 'e chi ha rifiutato non avvisa se stesso');
dice(g1.esito === null, 'e il tavolo si chiude');

// Lo stesso, ma chi rifiuta NON dice che era per tempo: vale l'orologio del
// server, che segna gia' oltre la scadenza.
const g1b = giro(tavolo(mondo.PRONTI_MS + 1000, []), { rifiuta: 'A' });
dice(aB(g1b).length === 1 && aB(g1b)[0].contenuto.torna === false,
  'e se la scadenza la segna solo il server, vale lo stesso',
  'torna = ' + (aB(g1b)[0] && aB(g1b)[0].contenuto.torna));

// ── 2. B AVEVA ACCETTATO, A LASCIA SCADERE ────────────────────────────────
const g2 = giro(tavolo(mondo.PRONTI_MS + 200, ['B']), { rifiuta: 'A', perTempo: true });
dice(aB(g2).length === 1 && aB(g2)[0].contenuto.torna === true,
  'chi aveva accettato torna in cerca, anche se il tempo era finito',
  'torna = ' + (aB(g2)[0] && aB(g2)[0].contenuto.torna));
dice(g2.messaggi.some(m => m.op === mondo.OP_NON_ACCETTATO && m.a.indexOf('B') >= 0),
  'e lo sente anche dalla partita, in cui e- dentro',
  'OP_NON_ACCETTATO = ' + mondo.OP_NON_ACCETTATO);

// ── 3. A DICE DI NO SUBITO, B NON HA ANCORA PREMUTO ───────────────────────
const g3 = giro(tavolo(3000, []), { rifiuta: 'A', perTempo: false });
dice(aB(g3).length === 1 && aB(g3)[0].contenuto.torna === true,
  'un Decline a tre secondi rimette in cerca chi non aveva ancora risposto',
  'B aveva ancora sette secondi: non ha mancato niente, e stato interrotto.');

// ── 4. LA NOTIFICA E- FATTA BENE ──────────────────────────────────────────
const n = aB(g3)[0] || {};
dice(n.codice === 101 && n.mittente === null && n.persistente === false && n.contenuto.matchId === 'm1',
  'la notifica ha codice 101, nessun mittente, non resta, e dice di quale partita',
  'codice ' + n.codice + ', mittente ' + n.mittente + ', persistente ' + n.persistente + ', partita ' + (n.contenuto && n.contenuto.matchId) +
  '. Il mittente e- null e non una stringa vuota: il runtime vuole un id valido o niente.');

// ── 5. CHI NON C-ENTRA NON CHIUDE NIENTE ──────────────────────────────────
const g5 = giro(tavolo(3000, []), { rifiuta: 'Z' });
dice(g5.esito !== null && g5.notifiche.length === 0,
  'un rifiuto da chi non e- fra i due accoppiati non chiude il tavolo');
const g6 = giro(tavolo(3000, ['A', 'B'], { iniziata: true }), { rifiuta: 'A' });
dice(g6.esito !== null && g6.notifiche.length === 0,
  'e a partita cominciata un rifiuto non conta piu-');

console.log(male ? String.fromCharCode(10) + male + ' cose non tornano' : String.fromCharCode(10) + 'tutto a posto');
process.exit(male ? 1 : 0);
