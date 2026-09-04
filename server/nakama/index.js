// ══════════════════════════════════════════════════════════════════════════
// HEXTALE — modulo di runtime di Nakama
// ══════════════════════════════════════════════════════════════════════════
// Da qui in avanti il database delle carte NON e' piu' il foglio Google: e'
// questo server. Il foglio resta lo strumento con cui si scrivono le carte, ma
// la verita' che il gioco legge sta qui, e ci arriva con un'importazione.
//
// PERCHE' SUL SERVER e non nel client. Tre cose non si possono decidere su una
// macchina che il giocatore controlla: quali carte possiede, a che livello, e
// se e' un amministratore. Se quelle risposte le desse il client, chiunque
// aprisse gli strumenti del browser potrebbe darsi tutte le carte al livello
// massimo. Il client chiede, il server risponde.
//
// COSA C'E' DENTRO
//   catalogo   — tutte le carte, in un oggetto di storage di sistema.
//   possesso   — per ogni utente: quali mazzi starter ha, e a che livello.
//   admin      — un contrassegno nei metadati dell'account, che il client NON
//                puo' scrivere (PUT /v2/account accetta username, display
//                name, avatar, lingua, luogo e fuso: non i metadati).
//
// LE DUE COLONNE NUOVE DEL FOGLIO, e come si traducono qui:
//   Starter deck — in che mazzi iniziali entra la carta. Vuoto = in nessuno.
//   Admin = Yes  — carta riservata: non esce mai verso un giocatore normale,
//                  nemmeno dentro al catalogo. Quando e' Yes, "Visible" non
//                  conta piu'; quando e' No, vale Visible come sempre.

var COLL_SISTEMA = 'sistema';
var KEY_CATALOGO = 'catalogo';
var COLL_PROFILO = 'profilo';
var KEY_POSSESSO = 'carte';
var KEY_MAZZI = 'mazzi';
var KEY_STAGIONE = 'stagione';
// La bustina APERTA e non ancora raccolta. Vive fra le due chiamate: il
// sorteggio e la scelta. E' un oggetto a se' e non un campo del possesso
// perche' ha una vita sua, cortissima, e va cancellato appena si e' raccolto.
var KEY_BUSTINA = 'bustina';

// ── v0.79.0 — L'AVATAR E' UNA CARTA ───────────────────────────────────────
// Non un indirizzo: la SIGLA di una carta posseduta (`fox`, `baba-yaga`). Il
// client la trasforma in un'illustrazione, e la trasforma nella variante di
// colore giusta per chi guarda — la stessa carta ha una faccia chiara e una
// scura, e quale delle due si veda dipende da chi la sta guardando e da che
// fazione sta giocando. Un indirizzo scritto qui congelerebbe quella scelta
// sul momento in cui e' stata fatta.
// La verifica e' quindi UNA: la carta ce l'ha davvero? Il resto lo fa il
// client, che e' l'unico a sapere di che colore sta dipingendo.
//
// Fox e' l'avatar di chi comincia: e' l'unica carta che tutti e tre i mazzi
// starter hanno, quindi e' l'unica che si puo' dare senza guardare quale mazzo
// e' uscito.
var AVATAR_DI_PARTENZA = 'fox';

// ══════════════════════════════════════════════════════════════════════════
// LA STAGIONE, IL LIVELLO E IL RANK
// ══════════════════════════════════════════════════════════════════════════
// Stanno QUI e non nel client per la stessa ragione delle carte possedute:
// sono la misura di quanto uno ha giocato, e una misura che il giocatore
// stesso puo' riscrivere non misura niente. Il client dice com'e' finita la
// partita, il server decide cosa cambia.
//
// LA STAGIONE si conta a mesi dal giorno in cui e' cominciata la prima. Non e'
// un numero salvato da qualche parte: e' una funzione della data, cosi' non
// esiste il caso "il server non e' stato acceso il primo del mese e la
// stagione non e' scattata".
var STAGIONE_INIZIO = { anno: 2026, mese: 7, giorno: 27 };   // mese 7 = agosto

function stagioneCorrente() {
  var ora = new Date();
  var mesi = (ora.getUTCFullYear() - STAGIONE_INIZIO.anno) * 12
           + (ora.getUTCMonth() - STAGIONE_INIZIO.mese);
  // Prima del giorno di anniversario il mese non e' ancora compiuto.
  if (ora.getUTCDate() < STAGIONE_INIZIO.giorno) mesi -= 1;
  return Math.max(1, mesi + 1);
}

// I dodici gradini, nell'ordine. L'indice e' cio' che si salva; il nome e
// l'icona si ricavano da qui, cosi' esistono in un posto solo.
var RANGHI = ['bronze-1','bronze-2','bronze-3','bronze-top',
              'silver-1','silver-2','silver-3','silver-top',
              'gold-1','gold-2','gold-3','gold-top'];
var RANK_PUNTI = 10;        // quanti punti riempiono un gradino
var RANK_VITTORIA = 3;      // quanti se ne guadagnano vincendo
var RANK_SCONFITTA = 1;     // quanti se ne perdono perdendo
var RANK_SCONFITTE_PER_SCENDERE = 3;
var RANK_PUNTI_DOPO_RETROCESSIONE = 7;

var LIVELLO_MAX = 30;
// ── v0.78.11 — QUANTO VALE UNA PARTITA ────────────────────────────────────
// Due parti, e si sommano: il TEMPO che uno ci ha messo e come e' FINITA.
//   - due punti per ogni turno giocato da quel giocatore: e' la parte che
//     nessuno puo' perdere, perche' quel tempo l'ha speso davvero;
//   - piu' un premio che dipende da come la partita si e' chiusa PER LUI.
// Il premio e' zero per chi esce: non e' una punizione, e' che una partita
// lasciata a meta' non si e' conclusa in nessun modo — ne' vinta ne' persa. I
// turni giocati restano suoi.
// La tabella sta QUI e in nessun altro posto: e' l'unica cosa che si guarda
// per sapere quanto vale una partita.
var XP_PER_TURNO = 2;
var XP_VITTORIA = 50;
var XP_SCONFITTA = 20;
var XP_RESA = 20;                 // arrendersi e- concludere: e- una sconfitta scelta
var XP_RESTA_VINCENDO = 50;       // gli restano davanti a un tavolo vuoto, mentre vinceva
var XP_RESTA_PERDENDO = 35;       // idem, ma stava perdendo: piu- di una sconfitta, meno di una vittoria
var XP_USCITO = 0;                // chi si disconnette, crasha, o esce: solo i turni

// v0.78.12 — l'inchiostro magico segue la stessa forma dell'esperienza: dieci
// per una vittoria, cinque per una sconfitta, niente per chi lascia la partita
// a meta'. Chi si arrende ha concluso, quindi prende i cinque della sconfitta.
var INK_VITTORIA = 10;
var INK_SCONFITTA = 5;
// E ogni cinque partite si guadagna una bustina. Il conto lo tiene il server
// insieme al resto: e' un premio, e un premio che il client puo' scrivere non
// e' un premio.
var PARTITE_PER_BUSTINA = 5;

// Il premio di fine partita per UN giocatore, dato come e' finita per lui.
// `modo` puo' essere:
//   'finita'  la partita e' arrivata alla fine (anche per resa dell'altro)
//   'resa'    l'ha chiusa lui arrendendosi
//   'uscito'  si e' disconnesso, e' crashato, o e' uscito
//   'resta'   e' rimasto in partita dopo che l'altro e' uscito
function xpDiFine(modo, vinta) {
  if (modo === 'uscito') return XP_USCITO;
  if (modo === 'resa') return XP_RESA;
  if (modo === 'resta') return vinta ? XP_RESTA_VINCENDO : XP_RESTA_PERDENDO;
  return vinta ? XP_VITTORIA : XP_SCONFITTA;
}
function inkDiFine(modo, vinta) {
  if (modo === 'uscito') return 0;
  if (modo === 'resa') return INK_SCONFITTA;   // arrendersi e' concludere, perdendo
  return vinta ? INK_VITTORIA : INK_SCONFITTA;
}
// Un giocatore non puo' aver giocato piu' turni di quante siano le caselle:
// e' il tetto naturale, e serve solo dove il numero lo dichiara un client
// (le partite contro l'IA, dove non c'e' un avversario che possa smentirlo).
function turniPuliti(n) {
  n = Math.floor(Number(n) || 0);
  if (!(n > 0)) return 0;
  var tetto = _caselle().length;
  return n > tetto ? tetto : n;
}
// Il livello L costa 50*(L+1): 50 per il primo, 100 per il secondo, e cosi'
// via. E' la regola che Lorenzo ha scelto, e vive in questa riga sola.
function xpPerSalire(livello) { return 50 * (livello + 1); }

function profiloVuoto() {
  return {
    stagione: stagioneCorrente(),
    livello: 0, xp: 0,
    rank: 0, puntiRank: 0,
    sconfitteDiFila: 0,
    partite: 0, vittorie: 0
  };
}

// Legge il profilo e, se la stagione e' cambiata, lo AZZERA: livelli e rank si
// resettano a ogni stagione. Lo fa qui e non da qualche parte a mezzanotte,
// cosi' il reset avviene alla prima occasione in cui il profilo serve.
function leggiStagione(nk, userId) {
  var r = nk.storageRead([{ collection: COLL_PROFILO, key: KEY_STAGIONE, userId: userId }]);
  var p = (r && r.length && r[0].value) ? r[0].value : null;
  var ora = stagioneCorrente();
  if (!p || p.stagione !== ora) {
    var nuovo = profiloVuoto();
    nuovo.stagione = ora;
    return { profilo: nuovo, azzerato: !!p };
  }
  return { profilo: p, azzerato: false };
}

function scriviStagione(nk, userId, profilo) {
  nk.storageWrite([{
    collection: COLL_PROFILO, key: KEY_STAGIONE, userId: userId,
    value: profilo,
    // Si legge ma non si scrive: si passa da hx_partita, che decide.
    permissionRead: 1, permissionWrite: 0
  }]);
}

// Le regole di un mazzo, ripetute qui perche' il server non puo' fidarsi di
// quelle scritte nel client: chi apre gli strumenti del browser puo' cambiarle.
// Devono restare uguali a MAZZI_SLOT, MAZZO_CARTE, MAZZO_PUNTI e COSTO_RARITA
// nel gioco: se un giorno cambiano li', vanno cambiate anche qui.
var MAZZI_MAX = 12;      // quanti mazzi puo' avere un giocatore
var MAZZO_CARTE = 12;    // quante carte ci stanno in un mazzo
var MAZZO_PUNTI = 24;    // il tetto di costo
var COSTO_RARITA = { timeless: 4, mythic: 3, rare: 2, common: 1 };

// I mazzi iniziali disponibili. Finche' non c'e' una schermata che li fa
// scegliere, se ne assegna uno a caso — ed e' una decisione che si prende UNA
// volta sola e si scrive, altrimenti il giocatore si ritroverebbe un mazzo
// diverso a ogni accesso.
var MAZZI_STARTER = [1, 2, 3];
// I nomi dei tre mazzi iniziali. Stanno qui e non nel client perche' e' il
// server a crearli: il giocatore li trova gia' fatti al primo accesso.
var NOMI_STARTER = { 1: 'Starter Wild', 2: 'Starter Debuff', 3: 'Starter Princess' };
// v0.77.84 — LE CARTE PARTONO DA UNO.
// Era 2, e non per una decisione: si era fermato li'. Su un account normale
// una carta comincia al primo livello e sale giocando; l'admin le ha tutte al
// massimo, che e' il senso di quel contrassegno.
var LIVELLO_NORMALE = 1;
var LIVELLO_ADMIN = 4;

// ── LE VALUTE (dalla v0.77.52) ────────────────────────────────────────────
// Stavano in localStorage. Ci stavano male per la ragione di sempre — si
// perdevano svuotando i dati del sito e non seguivano il giocatore altrove —
// ma soprattutto perche' una valuta che il client puo' scrivere non e' una
// valuta: e' un suggerimento. Adesso il saldo vive qui e il client lo legge.
var VALUTE_INIZIALI = { magicInk: 100, fairyDust: 100 };

// Quanto costa tenere ANCHE la seconda carta di una bustina. Si paga sempre la
// meno cara delle due: cosi' il prezzo non dipende da quale si e' scelta per
// prima, e l'ordine dei clic non cambia il conto.
// Questa tabella e' la copia server di quella del client, ed e' QUESTA che
// vale: il client la mostra, il server la applica.
var COSTO_TENERE_PER_RARITA = { common: 50, rare: 200, mythic: 500, timeless: 1000 };
function costoTenereRarita(chiave) {
  var v = COSTO_TENERE_PER_RARITA[String(chiave || '').toLowerCase()];
  return typeof v === 'number' ? v : COSTO_TENERE_PER_RARITA.common;
}

// Una carta appena sbustata entra al livello dei normali. Se si possedeva
// gia', il livello non scende: si tiene il piu' alto dei due.
// v0.78.3 — UNO, e non "quello con cui si comincia". Erano lo stesso numero e
// per questo stavano insieme, ma sono due regole diverse: il livello di
// partenza di un account puo' cambiare domani, mentre una carta appena
// ottenuta comincia da uno per definizione. Tenerle legate voleva dire che
// alzando l'una si alzava l'altra senza accorgersene.
var LIVELLO_SBUSTATA = 1;

// Gli amministratori si riconoscono da questi nomi finche' il contrassegno non
// e' stato scritto nei loro metadati. Dopo, comanda il contrassegno: e' il
// motivo per cui questi nomi si possono cambiare senza perdere i privilegi.
var NOMI_ADMIN = ['LoreAdmin', 'BoBAdmin'];

// ── PER CHI E' STATO EMESSO IL TOKEN DI GOOGLE ───────────────────────────
// Nakama verifica da se' la FIRMA del token, ma non guarda l'audience: e non
// c'e' un'opzione per fargliela guardare — in Nakama 3.40 le impostazioni
// social sono solo apple, facebook e steam, google non c'e'. Senza questo
// controllo il server accetterebbe un token valido emesso per QUALUNQUE altra
// applicazione Google: chi ce l'ha entrerebbe come il proprietario di
// quell'indirizzo email. Il controllo quindi si fa qui.
var GOOGLE_CLIENT_ID = '947017238895-crsaaks4v9lv08o16jsin68dr3a5s0qh.apps.googleusercontent.com';

// Da base64url a testo. Il runtime consegna un ArrayBuffer; se un domani
// consegnasse una stringa, questa funzione se ne accorge da sola.
function _testoDaBase64Url(nk, pezzo) {
  // I payload dei JWT arrivano SENZA riempimento, ma nk.base64UrlDecode lo
  // pretende: senza, risponde "Failed to decode string" su qualunque token la
  // cui parte di mezzo non abbia lunghezza multipla di quattro — cioe' quasi
  // sempre. Il riempimento si rimette qui.
  var s = String(pezzo);
  var resto = s.length % 4;
  if (resto === 2) s += '==';
  else if (resto === 3) s += '=';
  else if (resto === 1) throw Error('lunghezza base64 impossibile');
  var d = nk.base64UrlDecode(s);
  if (typeof d === 'string') return d;
  var b = new Uint8Array(d), s = '';
  for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
}

function primaDiGoogle(ctx, logger, nk, data) {
  var token = data && data.account && data.account.token;
  if (!token) throw Error('token Google mancante');
  var parti = String(token).split('.');
  if (parti.length !== 3) throw Error('token Google malformato');
  var payload;
  try {
    // nk.base64UrlDecode restituisce un ArrayBuffer, NON una stringa: passarlo
    // a String() dava "[object ArrayBuffer]" e JSON.parse falliva su ogni
    // accesso con Google. Verificato sul server, non dedotto.
    // I byte si rileggono uno per uno: qui serve solo `aud`, che e' ASCII.
    payload = JSON.parse(_testoDaBase64Url(nk, parti[1]));
  } catch (e) { throw Error('token Google illeggibile: ' + String(e && e.message || e)); }
  // aud puo essere una stringa o un elenco, secondo come Google lo emette.
  var aud = payload.aud;
  var ok = (aud === GOOGLE_CLIENT_ID) ||
           (Object.prototype.toString.call(aud) === '[object Array]' && aud.indexOf(GOOGLE_CLIENT_ID) !== -1);
  if (!ok) {
    logger.warn('token Google per un altra applicazione: aud=%s', String(aud));
    throw Error('questo accesso Google non e per Hextale');
  }
  return data;
}

// ── utilita' ──────────────────────────────────────────────────────────────
function leggiSistema(nk, chiave) {
  var r = nk.storageRead([{ collection: COLL_SISTEMA, key: chiave, userId: '00000000-0000-0000-0000-000000000000' }]);
  return (r && r.length && r[0].value) ? r[0].value : null;
}

function scriviSistema(nk, chiave, valore) {
  nk.storageWrite([{
    collection: COLL_SISTEMA, key: chiave,
    userId: '00000000-0000-0000-0000-000000000000',
    value: valore,
    // Nessuno legge questo oggetto direttamente dal client: ci si passa sempre
    // dalle RPC, che filtrano. Permessi a zero = solo il server.
    permissionRead: 0, permissionWrite: 0
  }]);
}

function leggiPossesso(nk, userId) {
  var r = nk.storageRead([{ collection: COLL_PROFILO, key: KEY_POSSESSO, userId: userId }]);
  return (r && r.length && r[0].value) ? r[0].value : null;
}

function scriviPossesso(nk, userId, valore) {
  nk.storageWrite([{
    collection: COLL_PROFILO, key: KEY_POSSESSO, userId: userId,
    value: valore,
    // Il giocatore puo' LEGGERE cosa possiede, ma non scriverlo: il permesso
    // di scrittura resta al server. E' l'intero motivo per cui questa roba sta
    // qui e non in localStorage.
    permissionRead: 1, permissionWrite: 0
  }]);
}

function eAdmin(nk, userId, username) {
  var conti = nk.usersGetId([userId]);
  var meta = (conti && conti.length && conti[0].metadata) ? conti[0].metadata : {};
  if (meta && meta.admin === true) return true;
  // Semina: il nome sta nell'elenco ma il contrassegno non c'e' ancora.
  var nome = username || ((conti && conti.length) ? conti[0].username : '');
  for (var i = 0; i < NOMI_ADMIN.length; i++) {
    if (String(nome || '').toLowerCase() === NOMI_ADMIN[i].toLowerCase()) {
      meta.admin = true;
      nk.accountUpdateId(userId, null, null, null, null, null, null, meta);
      return true;
    }
  }
  return false;
}

// Assegna il mazzo iniziale se non ce l'ha ancora. Torna il possesso, sempre.
// Si chiama sia dopo l'autenticazione sia all'avvio: se il primo aggancio
// fallisse per qualunque motivo, il secondo rimedia invece di lasciare un
// giocatore senza carte.
function assicuraPossesso(ctx, nk, logger, userId, username) {
  var attuale = leggiPossesso(nk, userId);
  var admin = eAdmin(nk, userId, username);
  if (attuale && attuale.mazzi && attuale.mazzi.length) {
    var daRiscrivere = false;
    // Un account che diventa admin dopo aver gia' avuto un mazzo deve passare
    // a "tutte le carte": il contrassegno vince su cio' che era stato scritto.
    if (admin !== !!attuale.admin) {
      attuale.admin = admin;
      attuale.livello = admin ? LIVELLO_ADMIN : LIVELLO_NORMALE;
      daRiscrivere = true;
    }
    // Chi si e' registrato prima che le valute esistessero non ha un saldo.
    // Gliene si da' uno iniziale invece di lasciarlo a zero: il saldo mancante
    // e' un vuoto della nostra storia, non una scelta sua.
    if (!attuale.valute || typeof attuale.valute.fairyDust !== 'number') {
      attuale.valute = { magicInk: VALUTE_INIZIALI.magicInk, fairyDust: VALUTE_INIZIALI.fairyDust };
      daRiscrivere = true;
    }
    // Le carte sbustate, che si aggiungono a quelle dei mazzi starter.
    if (!attuale.carte) { attuale.carte = {}; daRiscrivere = true; }
    // v0.78.16 — chi c'era gia' ha GIA' VISTO cio' che possiede: la novita'
    // comincia da adesso. Senza questa riga, il giorno del rilascio ognuno si
    // troverebbe l'intera collezione accesa, e "nuovo" non vorrebbe dire niente.
    if (!attuale.viste) {
      attuale.viste = {};
      for (var sv in (attuale.carte || {})) attuale.viste[sv] = 1;
      daRiscrivere = true;
    }
    // v0.79.0 — e chi c'era prima che gli avatar esistessero ne riceve uno.
    // Il campo vuoto sarebbe una scelta ("nessun avatar"), e non lo e': e' un
    // vuoto della nostra storia, come il saldo mancante qui sopra.
    if (typeof attuale.avatar !== 'string' || !attuale.avatar) {
      attuale.avatar = AVATAR_DI_PARTENZA;
      daRiscrivere = true;
    }
    if (daRiscrivere) scriviPossesso(nk, userId, attuale);
    return attuale;
  }
  var scelto = MAZZI_STARTER[Math.floor(Math.random() * MAZZI_STARTER.length)];
  var possesso = {
    admin: admin,
    // Un admin non ha "un mazzo": ha tutto. Il numero si scrive lo stesso,
    // cosi' se un giorno perdesse i privilegi non resterebbe senza niente.
    mazzi: [scelto],
    livello: admin ? LIVELLO_ADMIN : LIVELLO_NORMALE,
    assegnatoIl: Math.floor(Date.now() / 1000),
    // Perche' quel mazzo: "caso" adesso, "scelta" quando ci sara' la schermata.
    origine: 'caso',
    // Il saldo di partenza e le carte guadagnate dopo, sbustando.
    valute: { magicInk: VALUTE_INIZIALI.magicInk, fairyDust: VALUTE_INIZIALI.fairyDust },
    carte: {},
    // v0.79.0 — con una faccia da subito. Vedi AVATAR_DI_PARTENZA.
    avatar: AVATAR_DI_PARTENZA
  };
  scriviPossesso(nk, userId, possesso);
  // v0.77.84 — e il mazzo si crea GIA' FATTO.
  // Prima il giocatore riceveva le carte ma nessun mazzo: doveva costruirselo
  // prima di poter giocare, e la prima cosa che vedeva era una libreria vuota.
  // Le carte sono gia' scelte — sono quelle del mazzo starter — quindi il
  // mazzo esiste gia' nei fatti: mancava solo scriverlo.
  try { creaMazzoStarter(nk, logger, userId, scelto, admin); }
  catch (e) { logger.warn('mazzo starter non creato per %s: %s', userId, String(e)); }
  logger.info('possesso assegnato a %s: mazzo %d (%s), admin=%s',
    userId, scelto, NOMI_STARTER[scelto] || '?', String(admin));
  return possesso;
}

// ── RPC: il catalogo e cio' che il giocatore possiede ─────────────────────
// Una chiamata sola all'avvio. Torna:
//   carte     — le definizioni COMPLETE, che al gioco servono tutte: una carta
//               non posseduta puo' comunque comparire in partita, evocata o
//               per trasformazione (Excalibur, The Green Prince). Filtrarle
//               qui vorrebbe dire romperle la' .
//   possedute — { slug: livello }. E' QUESTO che la Collezione e i mazzi
//               guardano. Due domande diverse, due risposte separate: e' lo
//               stesso errore che il gioco aveva gia' pagato confondendo
//               "Visible" con "Drop rate".
// ══════════════════════════════════════════════════════════════════════════
// v0.77.90 — TUTTO CIO' CHE E' DEL GIOCATORE STA QUI, NON NEL BROWSER
// ══════════════════════════════════════════════════════════════════════════
// Fino a ieri una manciata di cose vivevano in localStorage: la fazione
// scelta, i volumi, il conto alla rovescia della bustina gratuita, il progresso
// dell'Unicorno, quali note di rilascio erano gia' state lette.
// Due difetti, e il secondo e' grosso:
//   - localStorage e' del BROWSER, non dell'account. Due finestre con due
//     account diversi lo condividono, e i dati dell'uno finiscono addosso
//     all'altro. E' esattamente quello che si e' visto.
//   - il conto della bustina e il progresso dell'Unicorno sono economia di
//     gioco. Scritti nel browser, si azzerano svuotando la cronologia: non
//     sono un dato, sono un suggerimento.
// Adesso stanno nel possesso, che e' gia' per-utente e gia' scritto in modo
// controllato. Il client non li salva piu' da nessuna parte: li chiede
// all'avvio e li rimanda quando cambiano.
var BUSTINA_ATTESA_MS = 8 * 60 * 60 * 1000;   // deve combaciare col client
var UNICORNO_TETTO = 65;                       // idem: vedi UNICORNO_TETTO li'

// Solo le chiavi che conosciamo, e ognuna del tipo giusto. Un blob che arriva
// dal client non si scrive com'e': sarebbe una porta aperta per mettere
// qualunque cosa nel profilo di qualcuno.
function _preferenzePulite(dentro, gia) {
  var fuori = {};
  var vecchie = gia || {};
  for (var k in vecchie) if (Object.prototype.hasOwnProperty.call(vecchie, k)) fuori[k] = vecchie[k];
  if (!dentro) return fuori;

  // v0.79.0 — "random" e' una scelta come le altre, ed e' quella di partenza.
  // Non e' una fazione: e' il modo in cui si decide quale sara', partita per
  // partita. Chi legge la preferenza non deve mai riceverne una a caso senza
  // saperlo, quindi il valore resta 'random' e il sorteggio lo fa il client
  // all'inizio di ogni partita.
  if (dentro.fazione === 'light' || dentro.fazione === 'dark' || dentro.fazione === 'random') fuori.fazione = dentro.fazione;
  // E l'ultima fazione USCITA dal sorteggio. Serve al menu, che deve mostrare
  // l'arte del mazzo e l'avatar in un colore anche quando la preferenza non ne
  // nomina nessuno. Solo un colore vero: 'random' qui non vuol dire niente.
  if (dentro.fazioneUltima === 'light' || dentro.fazioneUltima === 'dark') fuori.fazioneUltima = dentro.fazioneUltima;
  if (typeof dentro.aiutoEsagono === 'boolean') fuori.aiutoEsagono = dentro.aiutoEsagono;
  if (typeof dentro.patchNotesLette === 'string') fuori.patchNotesLette = String(dentro.patchNotesLette).slice(0, 40);
  if (typeof dentro.unicorno === 'number' && isFinite(dentro.unicorno)) {
    // Il progresso sale e non scende, e non supera il tetto: un client che
    // mandasse un numero qualunque non deve poter regalarsi l'Unicorno.
    var prima = (typeof fuori.unicorno === 'number') ? fuori.unicorno : 0;
    fuori.unicorno = Math.max(0, Math.min(UNICORNO_TETTO, Math.max(prima, dentro.unicorno)));
  }
  if (dentro.audio && typeof dentro.audio === 'object') {
    var a = {};
    for (var nome in dentro.audio) {
      if (!Object.prototype.hasOwnProperty.call(dentro.audio, nome)) continue;
      var v = dentro.audio[nome];
      if (typeof v === 'number' && isFinite(v)) a[String(nome).slice(0, 20)] = Math.max(0, Math.min(1, v));
      else if (typeof v === 'boolean') a[String(nome).slice(0, 20)] = v;
    }
    fuori.audio = a;
  }
  return fuori;
}

function rpcPreferenze(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var dentro = {};
  try { dentro = payload ? JSON.parse(payload) : {}; } catch (e) { dentro = {}; }
  var possesso = assicuraPossesso(ctx, nk, logger, ctx.userId, ctx.username);
  possesso.preferenze = _preferenzePulite(dentro, possesso.preferenze);
  scriviPossesso(nk, ctx.userId, possesso);
  return JSON.stringify({ preferenze: possesso.preferenze });
}

// ── v0.79.0 — SI SCEGLIE LA PROPRIA FACCIA ────────────────────────────────
// Arriva una sigla di carta e basta. La domanda che il server si fa e' una
// sola, ed e' quella che il client non puo' farsi da solo: quella carta ce
// l'ha? Senza questo controllo un avatar sarebbe la lista completa delle carte
// del gioco, e "si sbloccano ottenendo la carta" non vorrebbe dire niente.
//
// La sigla vuota e' ammessa e vuol dire "torna a quello di partenza": e' il
// modo in cui si ripara un avatar rimasto su una carta che non c'e' piu'.
function rpcAvatar(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var dentro = {};
  try { dentro = payload ? JSON.parse(payload) : {}; } catch (e) { dentro = {}; }
  var sigla = String(dentro.avatar || '').trim().toLowerCase();
  if (sigla.length > 60) throw Error('sigla non valida');
  if (sigla && !/^[a-z0-9-]+$/.test(sigla)) throw Error('sigla non valida');

  var possesso = assicuraPossesso(ctx, nk, logger, ctx.userId, ctx.username);
  if (!sigla) sigla = AVATAR_DI_PARTENZA;

  if (sigla !== AVATAR_DI_PARTENZA) {
    var catalogo = leggiSistema(nk, KEY_CATALOGO);
    if (!catalogo || !catalogo.carte) throw Error('catalogo non ancora importato');
    var admin = !!possesso.admin;
    var carte = [];
    for (var i = 0; i < catalogo.carte.length; i++) {
      var c = catalogo.carte[i];
      if (c.soloAdmin && !admin) continue;
      carte.push(c);
    }
    var sue = _possedute(carte, possesso, admin);
    if (!sue[sigla]) throw Error('questa carta non e tua');
  }

  possesso.avatar = sigla;
  scriviPossesso(nk, ctx.userId, possesso);
  return JSON.stringify({ avatar: sigla });
}

// ── v0.79.0 — E SI PUO' ANDARSENE PER SEMPRE ──────────────────────────────
// La password si richiede QUI, e non ci si accontenta di averla chiesta nella
// finestra: una finestra la si salta, una sessione aperta la si trova su un
// computer lasciato acceso. `authenticateEmail` con create=false e' l'unico
// modo che il runtime ha di dire "questa password e' giusta", e si controlla
// che l'account che risponde sia PROPRIO chi sta chiedendo — altrimenti
// basterebbe la password di un altro.
//
// Poi si cancella tutto quello che e' nostro e infine l'account: in
// quest'ordine, perche' dopo la cancellazione dell'account il suo userId non
// apre piu' niente e cio' che fosse rimasto resterebbe li' per sempre, senza
// nessuno a cui appartenere.
//
// La mail torna libera: chi se ne va deve potersi riscrivere da zero.
function rpcEliminaAccount(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var dentro = {};
  try { dentro = payload ? JSON.parse(payload) : {}; } catch (e) { dentro = {}; }
  var password = String(dentro.password || '');
  if (!password) throw Error('serve la password');

  var conto = nk.accountGetId(ctx.userId);
  var email = (conto && conto.email) || '';
  if (!email) throw Error('questo account non ha una email: scrivici');

  var chi = nk.authenticateEmail(email, password, null, false);
  if (!chi || chi.userId !== ctx.userId) throw Error('password sbagliata');

  var chiavi = [KEY_POSSESSO, KEY_MAZZI, KEY_STAGIONE, KEY_BUSTINA, 'stato'];
  for (var i = 0; i < chiavi.length; i++) {
    try { nk.storageDelete([{ collection: COLL_PROFILO, key: chiavi[i], userId: ctx.userId }]); }
    catch (e) { logger.warn('cancellando %s di %s: %s', chiavi[i], ctx.userId, String(e)); }
  }
  // Il battito che dice "sono online" non si tocca: e' un'ora scritta in un
  // registro condiviso, e smette di contare da sola dopo un minuto e mezzo
  // (vedi PRESENZA_VIVA_MS). Andare a riscrivere quel registro qui vorrebbe
  // dire prendersi il rischio di una scrittura in mezzo alla cancellazione per
  // guadagnare novanta secondi.
  nk.accountDeleteId(ctx.userId, true);
  logger.info('account cancellato: %s', ctx.userId);
  return JSON.stringify({ fatto: true });
}

function rpcAvvio(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var richiesta = {};
  try { richiesta = payload ? JSON.parse(payload) : {}; } catch (e) { richiesta = {}; }

  var catalogo = leggiSistema(nk, KEY_CATALOGO);
  if (!catalogo || !catalogo.carte) throw Error('catalogo non ancora importato');

  var possesso = assicuraPossesso(ctx, nk, logger, ctx.userId, ctx.username);
  var admin = !!possesso.admin;

  // Le carte riservate non escono MAI verso un giocatore normale: non basta
  // nasconderle nella Collezione, non devono proprio arrivargli.
  var carte = [];
  for (var i = 0; i < catalogo.carte.length; i++) {
    var c = catalogo.carte[i];
    if (c.soloAdmin && !admin) continue;
    carte.push(c);
  }

  var possedute = _possedute(carte, possesso, admin);

  // Il catalogo pesa una settantina di chilobyte: se il client ce l'ha gia' e
  // non e' cambiato, non si rimanda.
  var invariato = richiesta.versioneNota && richiesta.versioneNota === catalogo.versione;

  var st = leggiStagione(nk, ctx.userId);
  if (st.azzerato) { scriviStagione(nk, ctx.userId, st.profilo); logger.info('stagione nuova: profilo azzerato per %s', ctx.userId); }

  return JSON.stringify({
    versione: catalogo.versione,
    invariato: !!invariato,
    admin: admin,
    profilo: st.profilo,
    ranghi: RANGHI,
    rankPunti: RANK_PUNTI,
    livelloMax: LIVELLO_MAX,
    mazzi: possesso.mazzi,
    livello: possesso.livello,
    valute: valuteDi(possesso),
    // v0.77.90 — cio' che prima stava nel browser. Arriva con la stessa
    // risposta di tutto il resto: una domanda sola all'avvio.
    preferenze: possesso.preferenze || {},
    // Quando la prossima bustina gratuita sara' pronta, in millisecondi. Zero
    // vuol dire "adesso": chi non ne ha mai raccolta una non deve aspettare.
    bustinaProssima: (typeof possesso.bustinaProssima === 'number') ? possesso.bustinaProssima : 0,
    // v0.78.12 — le bustine GUADAGNATE giocando, e a che punto si e' della
    // prossima. Sono un'altra strada per averne una, indipendente dall'attesa.
    bustineExtra: possesso.bustineExtra || 0,
    versoBustina: possesso.versoBustina || 0,
    // v0.78.16 — quali carte non sono ancora state guardate in Collezione.
    nuove: _nuoveDi(possesso),
    partitePerBustina: PARTITE_PER_BUSTINA,
    // v0.77.53 — l'avatar dell'account, che i pannelli di partita mostrano
    // accanto al nome. Sta fra i campi che Nakama tiene da se' (non nei
    // metadati), quindi si legge di la' e non da un oggetto nostro.
    avatar: _avatarDi(nk, ctx.userId),
    possedute: possedute,
    carte: invariato ? null : carte
  });
}

// ── RPC di servizio: l'importazione del catalogo ──────────────────────────
// Si chiama da fuori con la chiave http del runtime, MAI da un client: non ha
// ctx.userId e non deve averlo. E' il modo in cui il foglio entra nel database.
function rpcImporta(ctx, logger, nk, payload) {
  if (ctx.userId) throw Error('questa RPC non si chiama da un client');
  var catalogo = JSON.parse(payload);
  if (!catalogo || !catalogo.carte || !catalogo.carte.length) throw Error('catalogo vuoto');
  scriviSistema(nk, KEY_CATALOGO, catalogo);
  logger.info('catalogo importato: %d carte, versione %s', catalogo.carte.length, catalogo.versione);
  return JSON.stringify({ ok: true, carte: catalogo.carte.length, versione: catalogo.versione });
}

// ── IL MAZZO INIZIALE, GIA' COMPILATO ─────────────────────────────────────
// Si scrive UNA volta sola, alla prima assegnazione: se il giocatore ne ha
// gia' uno non si tocca niente, o si sovrascriverebbe il suo lavoro.
// Le carte del mazzo sono quelle che il foglio marca per quel numero di
// starter deck — le stesse che il giocatore riceve — quindi il mazzo e' fatto
// di roba che ha davvero.
function creaMazzoStarter(nk, logger, userId, numero, admin) {
  var gia = nk.storageRead([{ collection: COLL_PROFILO, key: KEY_MAZZI, userId: userId }]);
  if (gia && gia.length && gia[0].value && gia[0].value.mazzi && gia[0].value.mazzi.length) return;

  var catalogo = leggiSistema(nk, KEY_CATALOGO);
  if (!catalogo || !catalogo.carte) { logger.warn('mazzo starter: catalogo non ancora importato'); return; }

  var carte = [], i, k;
  for (i = 0; i < catalogo.carte.length && carte.length < MAZZO_CARTE; i++) {
    var carta = catalogo.carte[i];
    if (!carta || (carta.soloAdmin && !admin)) continue;
    var sd = carta.starterDecks || [];
    for (k = 0; k < sd.length; k++) {
      if (sd[k] === numero) { carte.push(String(carta.id)); break; }
    }
  }
  // Un mazzo con un numero di carte diverso da MAZZO_CARTE il server lo
  // rifiuta all'inizio della partita (vedi _mazzoDi), e lo farebbe in
  // silenzio: meglio dirlo adesso, quando si sa ancora perche'.
  if (carte.length !== MAZZO_CARTE) {
    logger.warn('mazzo starter %d: il foglio ne marca %d invece di %d — il mazzo NON viene creato',
      numero, carte.length, MAZZO_CARTE);
    return;
  }
  nk.storageWrite([{
    collection: COLL_PROFILO, key: KEY_MAZZI, userId: userId,
    value: {
      mazzi: [{ id: 'starter-' + numero, nome: NOMI_STARTER[numero] || ('Starter ' + numero), carte: carte }],
      scelto: 'starter-' + numero,
      modificatoIl: Math.floor(Date.now() / 1000)
    },
    // Come rpcMazziScrivi: il giocatore li legge, non li scrive.
    permissionRead: 1, permissionWrite: 0
  }]);
  logger.info('mazzo starter creato per %s: "%s" con %d carte', userId, NOMI_STARTER[numero], carte.length);
}

// Ricalcola il possesso di TUTTI gli utenti gia' esistenti. Serve una volta,
// per chi si era registrato prima che questa logica esistesse.
function rpcSistemaUtenti(ctx, logger, nk, payload) {
  if (ctx.userId) throw Error('questa RPC non si chiama da un client');
  // Nakama non offre "elenca tutti gli utenti" al runtime: si passa dai nomi,
  // che il chiamante conosce. Il payload e' un elenco di username.
  var esito = [];
  var nomi = [];
  try { nomi = JSON.parse(payload || '[]'); } catch (e) { nomi = []; }
  if (!nomi.length) throw Error('serve un elenco di username');
  var conti = nk.usersGetUsername(nomi);
  for (var i = 0; i < conti.length; i++) {
    var u = conti[i];
    var p = assicuraPossesso(ctx, nk, logger, u.userId, u.username);
    esito.push({ username: u.username, admin: !!p.admin, mazzi: p.mazzi, livello: p.livello });
  }
  return JSON.stringify({ ok: true, utenti: esito });
}

// ── aggancio: alla prima autenticazione si assegna il mazzo ───────────────
function dopoAccesso(ctx, logger, nk, data, request) {
  try { assicuraPossesso(ctx, nk, logger, ctx.userId, ctx.username); }
  catch (e) { logger.error('assegnazione mazzo fallita: %s', String(e)); }
}

// Cosa possiede un giocatore, dato il catalogo e il suo profilo. Un admin ha
// tutto al livello massimo; gli altri le carte dei mazzi starter che hanno.
function _possedute(carte, possesso, admin) {
  var out = {};
  var extra = (possesso && possesso.carte) || {};
  for (var j = 0; j < carte.length; j++) {
    var carta = carte[j];
    if (admin) { out[carta.slug] = LIVELLO_ADMIN; continue; }
    var dentro = false;
    var sd = carta.starterDecks || [];
    for (var k = 0; k < sd.length; k++) {
      if (possesso.mazzi.indexOf(sd[k]) !== -1) { dentro = true; break; }
    }
    if (dentro) out[carta.slug] = possesso.livello || LIVELLO_NORMALE;
    // Le carte sbustate si SOMMANO a quelle dei mazzi starter, e fra i due
    // livelli vince il piu' alto: sbustare una carta che si aveva gia' non
    // deve poterla far scendere di livello.
    var liv = extra[carta.slug];
    if (typeof liv === 'number' && liv > 0) {
      out[carta.slug] = Math.max(out[carta.slug] || 0, liv);
    }
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════════════
// LE BUSTINE (dalla v0.77.52)
// ══════════════════════════════════════════════════════════════════════════
// Due chiamate, e la ragione per cui sono due e' tutta qui.
//
//   hx_bustina_apri      il server SORTEGGIA due carte e se le segna.
//   hx_bustina_raccogli  il giocatore dice quali tiene; il server fa pagare e
//                        le scrive nel suo roster.
//
// PERCHE' SORTEGGIA IL SERVER. Prima pescava il client, e il server si sarebbe
// limitato a registrare cio' che gli veniva dichiarato: chiunque avesse aperto
// la console avrebbe potuto raccogliere la carta che voleva. Una valuta e un
// possesso che il client puo' scrivere non sono una valuta e un possesso.
//
// PERCHE' LA BUSTINA APERTA SI SCRIVE. Fra il sorteggio e la scelta passano
// dieci secondi di animazioni, ed e' in quella finestra che il server deve
// ricordarsi cosa e' uscito. Tenerlo in memoria non basterebbe — il runtime e'
// un pool, la chiamata dopo puo' finire altrove — e chiederlo al client
// vorrebbe dire tornare a fidarsi di lui, che e' esattamente cio' da cui si
// sta scappando.

function leggiBustina(nk, userId) {
  var r = nk.storageRead([{ collection: COLL_PROFILO, key: KEY_BUSTINA, userId: userId }]);
  return (r && r.length && r[0].value) ? r[0].value : null;
}

function scriviBustina(nk, userId, valore) {
  nk.storageWrite([{
    collection: COLL_PROFILO, key: KEY_BUSTINA, userId: userId,
    value: valore,
    // Il giocatore la legge — gli serve sapere cosa e' uscito se ricarica la
    // pagina a carte gia' scoperte — ma non la scrive.
    permissionRead: 1, permissionWrite: 0
  }]);
}

function cancellaBustina(nk, userId) {
  try { nk.storageDelete([{ collection: COLL_PROFILO, key: KEY_BUSTINA, userId: userId }]); }
  catch (e) { /* gia' cancellata: va bene lo stesso */ }
}

// Il saldo di un possesso, sempre con tutti e due i campi e sempre numeri.
// ── v0.77.83 — L'AVATAR NON VIENE MAI DALL'ACCOUNT ────────────────────────
// Leggeva `avatarUrl` dall'utente Nakama. Quel campo, per chi entra con
// Google, lo riempie Nakama da solo con la FOTO DEL PROFILO GOOGLE: bastava
// accedere con Google per portarsi in partita un'immagine presa da fuori.
// Nel gioco sono ammessi solo gli avatar del gioco, e la regola si fa
// rispettare alla fonte: qui non si guarda piu' l'account.
//
// L'avatar sta nel NOSTRO profilo, che e' l'unico posto in cui puo' finirci
// scegliendolo da dentro. Finche' non c'e' una scelta, il campo e' vuoto e i
// pannelli usano il ritratto di ripiego — che e' il comportamento giusto:
// meglio nessun avatar che uno preso da un altro sito.
function _avatarDi(nk, userId) {
  try {
    var p = leggiPossesso(nk, userId);
    return (p && typeof p.avatar === 'string') ? p.avatar : '';
  } catch (e) { return ''; }
}

function valuteDi(possesso) {
  var v = (possesso && possesso.valute) || {};
  return {
    magicInk: (typeof v.magicInk === 'number' && isFinite(v.magicInk)) ? v.magicInk : VALUTE_INIZIALI.magicInk,
    fairyDust: (typeof v.fairyDust === 'number' && isFinite(v.fairyDust)) ? v.fairyDust : VALUTE_INIZIALI.fairyDust
  };
}

// Le carte che possono USCIRE da una bustina: quelle visibili al giocatore e
// con una probabilita' maggiore di zero. Una carta a dropRate 0 esiste nel
// gioco ma non si sbusta — e' il modo in cui il foglio dice "questa si ottiene
// in un altro modo".
function _sorteggiabili(catalogo, admin) {
  var out = [];
  for (var i = 0; i < catalogo.carte.length; i++) {
    var c = catalogo.carte[i];
    if (c.soloAdmin && !admin) continue;
    if (!(typeof c.dropRate === 'number' && c.dropRate > 0)) continue;
    out.push(c);
  }
  return out;
}

// Una pescata pesata sul dropRate, escludendo cio' che e' gia' uscito: due
// carte uguali nella stessa bustina sarebbero una delusione, non una rarita'.
function _pesca(carte, escluse) {
  var buone = [];
  var totale = 0;
  for (var i = 0; i < carte.length; i++) {
    if (escluse.indexOf(carte[i].slug) !== -1) continue;
    buone.push(carte[i]);
    totale += carte[i].dropRate;
  }
  if (!buone.length) return null;
  var r = Math.random() * totale;
  for (var j = 0; j < buone.length; j++) {
    r -= buone[j].dropRate;
    if (r <= 0) return buone[j];
  }
  return buone[buone.length - 1];
}

// ── RPC: apri una bustina ─────────────────────────────────────────────────
// Torna gli slug delle due carte, non le definizioni: il client ha gia' il
// catalogo intero dall'avvio, e rimandarlo sarebbe peso per niente.
function rpcBustinaApri(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var catalogo = leggiSistema(nk, KEY_CATALOGO);
  if (!catalogo || !catalogo.carte) throw Error('catalogo non ancora importato');

  var possesso = assicuraPossesso(ctx, nk, logger, ctx.userId, ctx.username);
  var admin = !!possesso.admin;

  // Una bustina gia' aperta e non raccolta si RIPRENDE invece di sorteggiarne
  // un'altra. Senza, ricaricare la pagina a carte scoperte sarebbe un modo per
  // ripescare finche' non esce quello che si vuole.
  var aperta = leggiBustina(nk, ctx.userId);
  if (aperta && aperta.carte && aperta.carte.length === 2) {
    return JSON.stringify({ carte: aperta.carte, ripresa: true, costo: aperta.costo });
  }

  var sorteggiabili = _sorteggiabili(catalogo, admin);
  if (sorteggiabili.length < 2) throw Error('non ci sono abbastanza carte sorteggiabili');

  var a = _pesca(sorteggiabili, []);
  var b = _pesca(sorteggiabili, [a.slug]);

  // Il prezzo si fissa ADESSO e si scrive insieme alla bustina. Ricalcolarlo
  // alla raccolta darebbe lo stesso numero, ma scriverlo vuol dire che il
  // prezzo mostrato e quello addebitato sono lo STESSO dato, non due conti
  // che si spera coincidano.
  var costo = Math.min(costoTenereRarita(a.rarity), costoTenereRarita(b.rarity));
  var bustina = {
    carte: [a.slug, b.slug],
    costo: costo,
    apertaIl: Math.floor(Date.now() / 1000)
  };
  scriviBustina(nk, ctx.userId, bustina);
  logger.info('bustina aperta per %s: %s e %s (seconda a %d)', ctx.userId, a.slug, b.slug, costo);
  return JSON.stringify({ carte: bustina.carte, ripresa: false, costo: costo });
}

// ── RPC: raccogli cio' che si e' scelto ───────────────────────────────────
// Il payload dice quali slug si tengono. Il server controlla che siano
// davvero quelli della bustina aperta: non se ne accettano altri, ed e' il
// punto in cui il sorteggio lato server smette di essere una formalita'.
function rpcBustinaRaccogli(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var richiesta = {};
  try { richiesta = payload ? JSON.parse(payload) : {}; } catch (e) { richiesta = {}; }

  var bustina = leggiBustina(nk, ctx.userId);
  if (!bustina || !bustina.carte || bustina.carte.length !== 2) throw Error('nessuna bustina aperta');

  // Solo slug della bustina, senza ripetizioni: chiedere due volte la stessa
  // carta non deve poter valere per due.
  var tieni = [];
  var chiesti = richiesta.tieni || [];
  for (var i = 0; i < chiesti.length; i++) {
    var s = String(chiesti[i]);
    if (bustina.carte.indexOf(s) === -1) throw Error('carta non uscita da questa bustina: ' + s);
    if (tieni.indexOf(s) === -1) tieni.push(s);
  }
  if (!tieni.length) throw Error('non hai scelto niente');

  var possesso = assicuraPossesso(ctx, nk, logger, ctx.userId, ctx.username);
  var valute = valuteDi(possesso);

  // Si paga solo la SECONDA. Il pagamento e il possesso finiscono nello stesso
  // oggetto e in una sola scrittura: cosi' non esiste l'istante in cui la
  // polvere e' gia' andata e le carte non sono ancora arrivate.
  var costo = 0;
  if (tieni.length >= 2) {
    costo = (typeof bustina.costo === 'number') ? bustina.costo : 0;
    if (valute.fairyDust < costo) throw Error('polvere insufficiente');
    valute.fairyDust -= costo;
  }

  if (!possesso.carte) possesso.carte = {};
  for (var j = 0; j < tieni.length; j++) {
    var avuto = possesso.carte[tieni[j]] || 0;
    possesso.carte[tieni[j]] = Math.max(avuto, LIVELLO_SBUSTATA);
  }
  possesso.valute = valute;
  // v0.78.16 — le carte appena raccolte NON si segnano come viste: sono
  // esattamente quelle che devono accendersi in Collezione. Qui si scrive solo
  // che l'elenco esiste, cosi' chi non ne ha mai avuto uno non risulta con
  // tutta la collezione da guardare.
  if (!possesso.viste) possesso.viste = {};
  // v0.77.90 — LE OTTO ORE LE CONTA IL SERVER.
  // Prima il momento della prossima bustina lo scriveva il client nel proprio
  // localStorage: bastava svuotarlo per averne un'altra subito, e due account
  // sullo stesso browser si passavano l'attesa a vicenda. Adesso il conto parte
  // qui, nella stessa scrittura che consegna le carte, e non c'e' modo di
  // separare le due cose.
  // v0.78.12 — se c'e' una bustina GUADAGNATA (cinque partite giocate), si
  // spende quella e l'attesa delle otto ore non si tocca: sono due strade
  // diverse per avere una bustina, e farle interferire vorrebbe dire che
  // vincerne una ti allontana dalla prossima gratuita.
  if ((possesso.bustineExtra || 0) > 0) possesso.bustineExtra -= 1;
  else possesso.bustinaProssima = Date.now() + BUSTINA_ATTESA_MS;
  scriviPossesso(nk, ctx.userId, possesso);
  cancellaBustina(nk, ctx.userId);

  var catalogo = leggiSistema(nk, KEY_CATALOGO);
  var admin = !!possesso.admin;
  var carte = [];
  for (var k = 0; k < catalogo.carte.length; k++) {
    if (catalogo.carte[k].soloAdmin && !admin) continue;
    carte.push(catalogo.carte[k]);
  }

  logger.info('bustina raccolta da %s: %d carte, %d di polvere', ctx.userId, tieni.length, costo);
  return JSON.stringify({
    tenute: tieni,
    speso: costo,
    valute: valute,
    bustinaProssima: possesso.bustinaProssima,
    bustineExtra: possesso.bustineExtra || 0,
    // v0.78.16 — le carte appena prese sono nuove per definizione: si manda
    // l-elenco aggiornato subito, cosi- il pallino compare tornando al menu
    // senza aspettare la prossima lettura del profilo.
    nuove: _nuoveDi(possesso),
    possedute: _possedute(carte, possesso, admin)
  });
}

// ══════════════════════════════════════════════════════════════════════════
// I MAZZI (dalla v0.77.37)
// ══════════════════════════════════════════════════════════════════════════
// Erano nella cache del browser. Ci stavano male per due motivi: si perdevano
// svuotando i dati del sito, e non seguivano il giocatore su un altro computer.
//
// PERCHE' PASSANO DA UNA RPC e non dallo storage scritto dal client. Perche' un
// mazzo si puo' CONTROLLARE, e i controlli che stanno nel client non contano:
// chi apre gli strumenti del browser scriverebbe dodici mazzi di carte che non
// possiede. Qui invece si verifica che ogni carta sia sua, che i mazzi non
// siano piu' di dodici, che le carte non siano piu' di dodici e che il costo
// stia nel tetto. Oggi le partite sono locali e barare danneggia solo chi bara,
// ma il PvP in rete arrivera', e quel giorno queste regole devono gia' essere
// dalla parte giusta.
//
// COSA NON SI CONTROLLA, di proposito: che un mazzo sia COMPLETO. Un mazzo
// appena creato e' vuoto, e il gioco lo salva com'e'. La regola "dodici carte"
// vale per SCENDERE IN CAMPO, non per esistere.
// La sigla del "mazzo casuale". Non e' l'id di nessun mazzo: e' la richiesta
// di sceglierne uno a caso al momento di scendere in campo. Deve combaciare
// con MAZZO_CASUALE del client.
var MAZZO_CASUALE = '__casuale';
function _mazziPuliti(ctx, nk, dati) {
  var catalogo = leggiSistema(nk, KEY_CATALOGO);
  if (!catalogo || !catalogo.carte) throw Error('catalogo non ancora importato');
  var possesso = assicuraPossesso(ctx, nk, { info: function () {} }, ctx.userId, ctx.username);
  var admin = !!possesso.admin;

  // Le carte del catalogo che il giocatore puo' mettere in un mazzo, per id.
  // Nel mazzo le carte stanno per ID ("final-robin-hood"), non per slug.
  var possedute = _possedute(catalogo.carte, possesso, admin);
  var perId = {};
  for (var i = 0; i < catalogo.carte.length; i++) {
    var c = catalogo.carte[i];
    if (c.soloAdmin && !admin) continue;
    if (possedute[c.slug]) perId[String(c.id)] = c;
  }

  var dentro = (dati && dati.mazzi) || [];
  if (dentro.length > MAZZI_MAX) throw Error('non si possono avere piu\' di ' + MAZZI_MAX + ' mazzi');

  var fuori = [];
  var visti = {};
  for (var m = 0; m < dentro.length; m++) {
    var mazzo = dentro[m] || {};
    var id = String(mazzo.id || '');
    if (!id) throw Error('un mazzo senza id');
    if (visti[id]) throw Error('due mazzi con lo stesso id: ' + id);
    visti[id] = true;
    var nome = String(mazzo.nome || 'Untitled deck').slice(0, 40);
    var carte = [];
    var punti = 0;
    var elenco = mazzo.carte || [];
    if (elenco.length > MAZZO_CARTE) throw Error('"' + nome + '" ha piu\' di ' + MAZZO_CARTE + ' carte');
    for (var k2 = 0; k2 < elenco.length; k2++) {
      var idCarta = String(elenco[k2]);
      var carta = perId[idCarta];
      // Una carta non posseduta non entra: non e' un errore da fermare tutto,
      // e' una carta che si toglie. Puo' capitare in buona fede — una carta
      // tolta dal foglio, o un mazzo importato da un codice.
      if (!carta) continue;
      carte.push(idCarta);
      punti += (COSTO_RARITA[String(carta.rarity || '').toLowerCase()] || 1);
    }
    if (punti > MAZZO_PUNTI) throw Error('"' + nome + '" supera il tetto di ' + MAZZO_PUNTI + ' punti');
    fuori.push({ id: id, nome: nome, carte: carte });
  }

  // ── v0.77.89 — IL MAZZO CASUALE E' UNA SCELTA, NON UN MAZZO ─────────────
  // Qui si buttava via qualunque `scelto` che non fosse l'id di un mazzo, e
  // il "mazzo casuale" del menu non lo e': e' un valore a parte, la richiesta
  // di pescarne uno a caso. Chi lo sceglieva se lo ritrovava sostituito dal
  // primo mazzo della lista al rientro successivo, e la scelta sembrava non
  // essere mai stata salvata — mentre invece era stata scartata qui.
  // La sigla deve restare uguale a quella del client (MAZZO_CASUALE): sono le
  // due meta' dello stesso accordo, e se un giorno cambia va cambiata in tutti
  // e due i posti.
  var scelto = dati && dati.scelto ? String(dati.scelto) : null;
  if (scelto && scelto !== MAZZO_CASUALE && !visti[scelto]) scelto = null;
  if (!scelto && fuori.length) scelto = fuori[0].id;

  return {
    mazzi: fuori,
    scelto: scelto,
    // Serve al client per sapere quale copia e' piu' recente fra la sua e
    // questa, quando si e' giocato scollegati.
    modificatoIl: Math.floor(Date.now() / 1000)
  };
}

function rpcMazziLeggi(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var r = nk.storageRead([{ collection: COLL_PROFILO, key: KEY_MAZZI, userId: ctx.userId }]);
  var v = (r && r.length && r[0].value) ? r[0].value : { mazzi: [], scelto: null, modificatoIl: 0 };
  return JSON.stringify(v);
}

function rpcMazziScrivi(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var dati;
  try { dati = JSON.parse(payload || '{}'); } catch (e) { throw Error('mazzi illeggibili'); }
  var puliti = _mazziPuliti(ctx, nk, dati);
  nk.storageWrite([{
    collection: COLL_PROFILO, key: KEY_MAZZI, userId: ctx.userId,
    value: puliti,
    // Il giocatore li LEGGE ma non li SCRIVE: si passa da qui, che controlla.
    permissionRead: 1, permissionWrite: 0
  }]);
  return JSON.stringify(puliti);
}

// ── L'ESITO DI UNA PARTITA ────────────────────────────────────────────────
// Il client dice com'e' finita; il server decide cosa cambia. Torna il PRIMA e
// il DOPO, perche' il menu deve poter far vedere la barra che sale da dove era
// invece di trovarla gia' piena.
//
// Contro l'IA si guadagna esperienza ma NON punti rank: il rank e' la misura
// del gioco contro persone, ed e' quello su cui si basera' l'accoppiamento.
// Lasciarlo crescere da soli lo renderebbe una misura di quanto uno ha voglia
// di battere il computer.
// ── v0.77.55 — L'ESITO DI UNA PARTITA, PER UN GIOCATORE ───────────────────
// Era il corpo di rpcPartita. E' diventato una funzione a se' perche' adesso
// ha due chiamanti: la RPC, che serve le partite contro l'IA e resta la strada
// di prima, e la PARTITA IN RETE, dove l'esito non lo dichiara piu' il client
// ma lo decide il server quando i due si sono trovati d'accordo su com'e'
// finito il tabellone. Una regola sola, in un posto solo: se un domani cambia
// quanto vale una vittoria, cambia per tutti e due i modi di giocare.
function applicaEsito(nk, userId, vinta, pari, controIA, turni, modo) {
  var letto = leggiStagione(nk, userId);
  var p = letto.profilo;
  var prima = {
    livello: p.livello, xp: p.xp, rank: p.rank, puntiRank: p.puntiRank,
    xpPerSalire: xpPerSalire(p.livello)
  };
  vinta = !!vinta; pari = !!pari; controIA = !!controIA;
  turni = turniPuliti(turni);
  modo = modo || 'finita';

  // ── v0.78.12 — CONTRO L'IA NON SI GUADAGNA NIENTE. MAI. ─────────────────
  // Ne' esperienza, ne' rank, ne' inchiostro, ne' avanzamento verso la
  // bustina. Il rank era gia' fuori dalla v0.77.x; l'esperienza no, e bastava
  // battere il computer in fila per salire di livello — cioe' una misura di
  // quanta voglia si ha di premere un pulsante, non di quanto si gioca.
  // Una partita contro l'IA e' una partita di prova: si gioca per giocare.
  var premia = !controIA;

  // ── esperienza ──────────────────────────────────────────────────────────
  // Un pareggio non e' una vittoria: vale come una sconfitta per l'esperienza,
  // e non muove il rank.
  // v0.78.11 — e i turni giocati si sommano al premio di fine. Le due parti
  // viaggiano anche separate nella risposta: la schermata di fine partita puo'
  // dire "18 dai turni + 50 per la vittoria" invece di un 68 che non si
  // spiega.
  var xpTurni = premia ? (XP_PER_TURNO * turni) : 0;
  var xpEsito = premia ? xpDiFine(modo, vinta) : 0;
  var guadagno = xpTurni + xpEsito;
  if (p.livello < LIVELLO_MAX) {
    p.xp += guadagno;
    while (p.livello < LIVELLO_MAX && p.xp >= xpPerSalire(p.livello)) {
      p.xp -= xpPerSalire(p.livello);
      p.livello += 1;
    }
    // Arrivati in cima l'esperienza non si accumula: non ci sarebbe piu' dove
    // spenderla, e una barra che continua a riempirsi senza salire mentirebbe.
    if (p.livello >= LIVELLO_MAX) p.xp = 0;
  }

  // ── rank ────────────────────────────────────────────────────────────────
  var salito = false, sceso = false;
  // v0.78.11 — una partita che nessuno ha concluso non muove il rank. Il
  // server non puo' distinguere un crash da un abbandono per ripicca, e
  // trattarli come una sconfitta punirebbe chi ha perso la corrente. In
  // compenso non premia nemmeno chi resta: il rank misura le partite giocate
  // fino in fondo.
  var conclusa = (modo !== 'uscito' && modo !== 'resta');
  if (premia && !pari && conclusa) {
    if (vinta) {
      p.sconfitteDiFila = 0;
      p.puntiRank += RANK_VITTORIA;
      while (p.puntiRank >= RANK_PUNTI && p.rank < RANGHI.length - 1) {
        // L'eccesso si porta dietro: da 9 una vittoria fa 12, cioe' il gradino
        // dopo con 2 punti gia' fatti.
        p.puntiRank -= RANK_PUNTI;
        p.rank += 1;
        salito = true;
      }
      // In cima al gradino piu' alto i punti non straboccano.
      if (p.rank >= RANGHI.length - 1 && p.puntiRank > RANK_PUNTI) p.puntiRank = RANK_PUNTI;
    } else {
      p.puntiRank = Math.max(0, p.puntiRank - RANK_SCONFITTA);
      p.sconfitteDiFila += 1;
      // Si scende solo dopo TRE sconfitte di fila, e mai sotto il primo
      // gradino: da Bronze I non si retrocede.
      if (p.sconfitteDiFila >= RANK_SCONFITTE_PER_SCENDERE && p.rank > 0) {
        p.rank -= 1;
        p.puntiRank = RANK_PUNTI_DOPO_RETROCESSIONE;
        p.sconfitteDiFila = 0;
        sceso = true;
      }
    }
  }

  // La partita si conta comunque: quel tempo il giocatore l'ha speso, e le
  // partite giocate sono un conto di tempo.
  // ── v0.78.12 — L'INCHIOSTRO E LA BUSTINA ────────────────────────────────
  // Non stanno nel profilo di stagione ma nel POSSESSO, che e' dove vivono le
  // valute e le carte. Si scrivono qui perche' qui si sa com'e' andata: e' lo
  // stesso principio dell'esperienza, e per la stessa ragione non lo si chiede
  // al client.
  // `try` intorno a tutto: una bustina non consegnata non deve poter far
  // fallire la scrittura dell'esperienza, che e' la cosa piu' importante.
  var ink = 0, versoBustina = 0, bustinaVinta = false, valute = null;
  if (premia) {
    try {
      var possesso = leggiPossesso(nk, userId);
      if (possesso) {
        ink = inkDiFine(modo, vinta);
        var v = valuteDi(possesso);
        v.magicInk += ink;
        possesso.valute = v;
        // L'avanzamento verso la bustina lo fa ogni partita conclusa. Chi esce
        // a meta' non avanza: e' lo stesso metro dell'inchiostro.
        if (conclusa) {
          versoBustina = (possesso.versoBustina || 0) + 1;
          if (versoBustina >= PARTITE_PER_BUSTINA) {
            versoBustina = 0;
            possesso.bustineExtra = (possesso.bustineExtra || 0) + 1;
            bustinaVinta = true;
          }
          possesso.versoBustina = versoBustina;
        } else {
          versoBustina = possesso.versoBustina || 0;
        }
        scriviPossesso(nk, userId, possesso);
        valute = v;
      }
    } catch (ep) { /* i premi non devono poter rompere l'esito */ }
  }

  p.partite = (p.partite || 0) + 1;
  // La VITTORIA no, se la partita non si e' conclusa. Chi resta in campo
  // mentre stava vincendo prende l'esperienza di una vittoria — gli hanno
  // tolto la partita dalle mani, e quello e' giusto — ma "stava vincendo" non
  // e' "ha vinto", e nel conto delle vittorie ci vanno solo le partite che
  // qualcuno ha davvero portato a termine.
  if (vinta && conclusa) p.vittorie = (p.vittorie || 0) + 1;
  scriviStagione(nk, userId, p);

  return {
    prima: prima,
    profilo: p,
    salito: salito,
    sceso: sceso,
    xpGuadagnata: guadagno,
    xpTurni: xpTurni,
    xpEsito: xpEsito,
    turniGiocati: turni,
    modoFine: modo,
    // v0.78.12 — cosa si e' guadagnato oltre all'esperienza, e a che punto si
    // e' del cammino verso la prossima bustina. La schermata di fine partita
    // disegna esattamente questi numeri: non ne calcola nessuno per conto suo.
    inkGuadagnato: ink,
    valute: valute,
    versoBustina: versoBustina,
    partitePerBustina: PARTITE_PER_BUSTINA,
    bustinaVinta: bustinaVinta,
    controIA: controIA,
    xpPerSalire: xpPerSalire(p.livello),
    ranghi: RANGHI
  };
}

// ── v0.78.16 — QUANTI STANNO GIOCANDO ADESSO ──────────────────────────────
// Non si tiene un contatore: si CHIEDE. Un numero tenuto a mano andrebbe alzato
// quando qualcuno entra e abbassato quando esce, e la seconda meta' e' quella
// che prima o poi si dimentica — una disconnessione brusca, un processo
// riavviato, e il numero resta gonfio per sempre senza che nessuno sappia
// perche'.
// `matchList` invece descrive cio' che c'e' in questo istante: le partite vive
// e quanta gente c'e' dentro. Se sbaglia, sbaglia per un attimo e si corregge
// da sola al giro dopo.
// Il numero e' pubblico e non dice niente di nessuno: quante persone, punto.
// ── v0.78.21 — "ONLINE" VUOL DIRE COLLEGATO, NON "IN PARTITA" ─────────────
// La prima versione contava le presenze nelle partite vive. Era il numero
// sbagliato: due persone nel menu principale sono due persone online, e
// `matchList` le vedeva come zero.
//
// Non si tiene comunque un contatore da alzare e abbassare — quello si gonfia
// alla prima disconnessione brusca e non torna piu' giu'. Si tiene l'ULTIMA
// VOLTA IN CUI CIASCUNO SI E' FATTO VIVO: il client batte ogni trenta secondi
// (vedi battitoOnline), e online e' chi si e' fatto vivo di recente. Un client
// che sparisce smette semplicemente di battere, e sparisce da se': non c'e'
// nessuna "uscita" da ricordarsi di gestire, che e' la meta' che si dimentica
// sempre.
//
// La finestra e' piu' larga del passo del battito, cosi' un battito perso per
// strada non fa lampeggiare il numero.
//
// Due client che battono nello stesso istante si sovrascrivono a vicenda e uno
// dei due battiti va perso: torna trenta secondi dopo, e nel frattempo il
// numero e' piu' basso di uno. E' il prezzo di tenere tutto in un record solo,
// ed e' accettabile finche' i giocatori sono decine; diventando centinaia,
// questo record va spezzato.
var PRESENZA_VIVA_MS = 90 * 1000;
var KEY_PRESENZE = 'presenze';
// ══════════════════════════════════════════════════════════════════════════
// v0.79.3 — UN ACCOUNT, UN POSTO SOLO
// ══════════════════════════════════════════════════════════════════════════
// Lo stesso account aperto due volte non e' un dettaglio estetico: sono due
// client che credono di essere lo stesso giocatore. Cercano partite in due,
// spendono lo stesso saldo, si scrivono addosso le stesse preferenze, e chi ne
// paga il conto e' il secondo salvataggio che arriva.
//
// La sedia la tiene il BATTITO che gia' c'era (vedi PRESENZA_VIVA_MS): non
// serve un secondo registro, serve sapere CHI sta battendo. La presenza quindi
// non e' piu' solo un'ora, e' { q: quando, s: quale sessione }.
// Le presenze vecchie sono numeri e basta: si continuano a leggere: chi era
// gia' collegato al momento dello schieramento non deve essere buttato fuori.
//
// SEDIA_LIBERA_MS e' PIU' CORTO della finestra del contatore, ed e' voluto.
// Sono due domande diverse:
//   "quante persone ci sono?"   — meglio contare uno di troppo per mezzo
//                                 minuto che vedere il numero ballare.
//   "il posto e' occupato?"     — qui sbagliare costa a chi resta chiuso
//                                 fuori, quindi la sedia si libera prima.
// Il client batte ogni trenta secondi: quarantacinque e' un battito saltato
// piu' il margine. Chi chiude la scheda di brutto — non dalla porta, che
// avvisa (vedi rpcEsco) — aspetta al massimo quel tempo prima di poter
// rientrare.
var SEDIA_LIBERA_MS = 45 * 1000;

// Legge una presenza nelle due forme, la vecchia e la nuova.
function _presenzaLetta(v) {
  if (typeof v === 'number') return { q: v, s: '' };
  if (v && typeof v === 'object' && typeof v.q === 'number') return { q: v.q, s: String(v.s || '') };
  return null;
}
// C'e' qualcun ALTRO seduto su questo account in questo momento?
function _sediaOccupataDaAltri(nk, userId, sessione) {
  var visti = null;
  try { visti = leggiSistema(nk, KEY_PRESENZE); } catch (e) { visti = null; }
  if (!visti || typeof visti !== 'object') return false;
  var p = _presenzaLetta(visti[userId]);
  if (!p) return false;
  if ((Date.now() - p.q) > SEDIA_LIBERA_MS) return false;   // se n'e' andato
  // Nessuna sessione scritta: e' una presenza di prima di questa versione.
  // Vale come occupata — e' comunque qualcuno che stava battendo.
  return p.s !== sessione;
}

// Ci si siede. Si chiama UNA VOLTA, appena l'accesso e' riuscito e prima che
// il menu si apra: e' l'unico momento in cui rifiutare costa poco, perche' non
// si e' ancora dentro a niente.
function rpcEntro(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var dati = {};
  try { dati = payload ? JSON.parse(payload) : {}; } catch (e) { dati = {}; }
  var sessione = String(dati.sessione || '').slice(0, 64);
  if (!sessione) throw Error('serve una sessione');
  if (_sediaOccupataDaAltri(nk, ctx.userId, sessione)) {
    logger.info('accesso rifiutato a %s: gia. in gioco', ctx.userId);
    return JSON.stringify({ dentro: false, motivo: 'gia in gioco' });
  }
  var visti = null;
  try { visti = leggiSistema(nk, KEY_PRESENZE); } catch (e) { visti = null; }
  if (!visti || typeof visti !== 'object') visti = {};
  visti[ctx.userId] = { q: Date.now(), s: sessione };
  try { scriviSistema(nk, KEY_PRESENZE, visti); }
  catch (e2) { logger.warn('presenza non scritta: %s', String(e2)); }
  return JSON.stringify({ dentro: true });
}

// E ci si alza. Chi se ne va dalla porta lo dice, cosi' puo' rientrare subito
// invece di aspettare che la sedia si liberi da sola. Solo la propria sedia:
// una sessione non puo' far alzare un'altra.
function rpcEsco(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var dati = {};
  try { dati = payload ? JSON.parse(payload) : {}; } catch (e) { dati = {}; }
  var sessione = String(dati.sessione || '').slice(0, 64);
  var visti = null;
  try { visti = leggiSistema(nk, KEY_PRESENZE); } catch (e) { visti = null; }
  if (!visti || typeof visti !== 'object') return JSON.stringify({ fuori: true });
  var p = _presenzaLetta(visti[ctx.userId]);
  if (p && (!sessione || p.s === sessione || !p.s)) {
    delete visti[ctx.userId];
    try { scriviSistema(nk, KEY_PRESENZE, visti); }
    catch (e2) { logger.warn('presenza non tolta: %s', String(e2)); }
  }
  return JSON.stringify({ fuori: true });
}

function rpcGiocatoriOnline(ctx, logger, nk, payload) {
  var ora = Date.now();
  var dati = {};
  try { dati = payload ? JSON.parse(payload) : {}; } catch (eP) { dati = {}; }
  var sessione = String(dati.sessione || '').slice(0, 64);
  var visti = null;
  try { visti = leggiSistema(nk, KEY_PRESENZE); } catch (e) { visti = null; }
  if (!visti || typeof visti !== 'object') visti = {};
  // v0.79.3 — il battito dice anche CHI sta battendo, e non ruba la sedia a
  // nessuno: se il posto risulta di un'altra sessione viva, questo client non
  // ci scrive sopra. Non e' un caso teorico — e' quello che succede al secondo
  // client se qualcuno gli mette le mani sul codice per saltare il rifiuto.
  if (ctx.userId && !(sessione && _sediaOccupataDaAltri(nk, ctx.userId, sessione))) {
    visti[ctx.userId] = sessione ? { q: ora, s: sessione } : ora;
  }
  var vivi = {}, quanti = 0;
  for (var u in visti) {
    var letta = _presenzaLetta(visti[u]);
    if (letta && (ora - letta.q) <= PRESENZA_VIVA_MS) {
      vivi[u] = visti[u]; quanti++;
    }
  }
  // La scrittura non deve poter far fallire la risposta: il numero e' gia'
  // buono, e un battito non scritto si riscrive fra trenta secondi.
  try { scriviSistema(nk, KEY_PRESENZE, vivi); }
  catch (e2) { logger.warn('battito non scritto: %s', String(e2)); }
  return JSON.stringify({ giocatori: quanti });
}

// ── v0.78.16 — LE CARTE ANCORA DA GUARDARE ────────────────────────────────
// Una carta appena sbustata resta "nuova" finche' non la si e' vista nella
// Collezione. Il conto lo tiene il server per la stessa ragione di tutto il
// resto: nel browser non vive niente, e due account sullo stesso computer si
// passerebbero le novita' a vicenda.
// Si tiene l'elenco di quelle GIA' VISTE e non di quelle nuove: le nuove sono
// una differenza — cio' che si possiede meno cio' che si e' guardato — e una
// differenza non puo' rimanere indietro rispetto ai fatti. Con l'elenco delle
// nuove, una carta ottenuta per una strada che si dimentica di aggiungerla non
// sarebbe mai nuova, e nessuno se ne accorgerebbe.
function _visteDi(possesso) {
  return (possesso && possesso.viste && typeof possesso.viste === 'object') ? possesso.viste : {};
}
function _nuoveDi(possesso) {
  var avute = (possesso && possesso.carte) || {};
  var viste = _visteDi(possesso);
  var out = [];
  for (var slug in avute) if (!viste[slug]) out.push(slug);
  return out;
}
// Il client dice quali ha appena guardato. E' una dichiarazione innocua — al
// massimo si toglie da se' un pallino — quindi non c'e' niente da verificare
// oltre al fatto che siano carte che possiede davvero.
function rpcCarteViste(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var dati = {};
  try { dati = JSON.parse(payload || '{}'); } catch (e) { dati = {}; }
  var elenco = dati.carte;
  var possesso = leggiPossesso(nk, ctx.userId);
  if (!possesso) return JSON.stringify({ nuove: [] });
  var viste = _visteDi(possesso);
  var avute = possesso.carte || {};
  if (elenco === 'tutte') {
    for (var s in avute) viste[s] = 1;
  } else if (Array.isArray(elenco)) {
    for (var i = 0; i < elenco.length && i < 500; i++) {
      var slug = String(elenco[i]);
      if (avute[slug]) viste[slug] = 1;
    }
  }
  possesso.viste = viste;
  scriviPossesso(nk, ctx.userId, possesso);
  return JSON.stringify({ nuove: _nuoveDi(possesso) });
}

// La RPC resta la strada delle partite contro l'IA, dove non c'e' nessun
// avversario che possa confermare com'e' andata.
function rpcPartita(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var dati;
  try { dati = JSON.parse(payload || '{}'); } catch (e) { throw Error('esito illeggibile'); }
  // I turni li dichiara il client, come l'esito: contro l'IA non c'e' nessun
  // avversario che possa confermare, e turniPuliti mette il tetto oltre il
  // quale la dichiarazione non e' piu' credibile.
  return JSON.stringify(applicaEsito(nk, ctx.userId, !!dati.vinta, !!dati.pari,
    !!dati.controIA, dati.turni, 'finita'));
}

// ══════════════════════════════════════════════════════════════════════════
// LA PARTITA IN RETE (dalla v0.77.53) — TAPPA 1
// ══════════════════════════════════════════════════════════════════════════
// Fino alla v0.77.52 il matchmaking trovava un avversario, ne scaricava il
// mazzo, e poi la partita si giocava TUTTA sulla macchina di chi giocava: due
// mani sullo stesso schermo, due mazzi nella stessa memoria. Chiunque aprisse
// la console vedeva le carte dell'altro, e nessuno controllava le mosse.
//
// Questa e' la prima tappa di tre. Qui il server diventa padrone di:
//
//   • LE CARTE      — mescola i due mazzi e distribuisce le mani. Ogni
//                     giocatore riceve SOLO la propria: dell'altra sa quante
//                     carte contiene, non quali. Non e' un accorgimento
//                     grafico, e' che quei dati non attraversano mai la rete.
//   • IL TABELLONE  — quali caselle sono bloccate lo decide lui, una volta,
//                     uguale per tutti e due.
//   • I TURNI       — di chi e' il turno, e quante volte si e' giocato.
//   • LA LEGALITA'  — e' il tuo turno? la carta e' davvero nella tua mano? la
//                     casella esiste, non e' un muro, non e' gia' occupata?
//   • IL TEMPO      — i sessanta secondi li conta lui. Il client mostra un
//                     conto alla rovescia, ma la scadenza e' quella del
//                     server, e a deciderla e' sempre lui.
//
// COSA NON FA ANCORA, e va detto: le CONQUISTE e le 44 ABILITA' restano
// calcolate dai client. Sono novemilaseicento righe di regole, e portarle qui
// e' la tappa 2 e la 3. Nel frattempo il server non e' cieco: a ogni giocata
// i client gli mandano un'IMPRONTA del proprio stato, e se le due impronte
// non coincidono la partita si ferma. Non impedisce di barare, ma impedisce
// di barare SENZA CHE SI VEDA, che e' la differenza fra un problema e un
// problema silenzioso.

var OP_AVVIO     = 1;   // server -> client, personale: la tua mano, e quante ne ha lui
var OP_GIOCA     = 2;   // client -> server: voglio mettere questa carta qui
var OP_GIOCATA   = 3;   // server -> client: e' stata messa (a chi tocca, entro quando)
var OP_TEMPO     = 4;   // server -> client: la scadenza, ogni tanto, per non andare alla deriva
var OP_RIFIUTO   = 5;   // server -> client, personale: la tua mossa non vale, ed ecco perche'
var OP_FINE      = 6;   // server -> client: finita, e come
// v0.78.6 — client -> server: mi arrendo. Non e' la stessa cosa di andarsene:
// chi si arrende resta collegato, e il server deve poterlo dire all'altro
// SUBITO invece di aspettare che una presenza cada.
var OP_MI_ARRENDO = 12;
var OP_IMPRONTA  = 7;   // client -> server: com'e' il mio stato dopo questa giocata
var OP_DISACCORDO= 8;   // server -> client: le due impronte non coincidono
var OP_ESITO     = 9;   // server -> client, personale: com'e' andata, e cosa hai guadagnato
// v0.77.81 — le abilita' che chiedono un bersaglio. La finestra si apre da
// tutte e due le parti (l'abilita' scatta su tutti e due i client, perche' la
// giocata arriva a tutti e due), ma il bersaglio lo indica UNO SOLO. Se non
// passasse di qui, l'altro non lo saprebbe e i due tabelloni si separerebbero
// alla prima carta che chiede qualcosa.
var OP_SCELGO    = 10;  // client -> server: il bersaglio che ho indicato
var OP_SCELTA    = 11;  // server -> client: il bersaglio indicato, per tutti e due

var TURNO_MS = 60000;        // i sessanta secondi del turno
// v0.78.23 — quanto dura la schermata che presenta i due avversari, e quindi
// quanto tempo in piu- ha il primo turno. Sta qui e non solo nel client perche-
// e- il server a tenere l-orologio: se il client la allunga senza dirlo, i
// secondi tornano a mancare, e questo numero e- il posto in cui accordarsi.
// v0.78.27 — quanto passa fra "la partita comincia sul server" e "il giocatore
// puo- davvero calare una carta": sei secondi di schermata versus, poi la
// caduta dei tasselli (TILE_DROP_TOTAL_MS, 1410) e il banner del turno, che
// adesso girano DOPO la schermata invece che dietro di essa.
// I 1600 del banner sono una stima, non una misura: e- l-unico pezzo di questo
// conto che non ho misurato. La strada pulita, il giorno in cui quei secondi
// contassero davvero, e- che sia il client a dire al server "sono pronto"
// invece che il server a indovinare quanto ci mette.
var VERSUS_MS = 9000;
var GRAZIA_MS = 2500;        // quanto si aspetta oltre la scadenza prima di troncare
var MANO_INIZIALE = 4;
var ATTESA_INGRESSO_MS = 30000;  // se il secondo non entra, la partita muore da sola

// ── il tabellone ──────────────────────────────────────────────────────────
// Le stesse diciannove caselle del client: q e r da -2 a 2, con |q+r| <= 2.
function _caselle() {
  var out = [];
  for (var q = -2; q <= 2; q++)
    for (var r = -2; r <= 2; r++)
      if (Math.abs(q + r) <= 2) out.push(q + ',' + r);
  return out;
}

// Da due a cinque caselle bloccate, mai il centro. Le sceglie il server: se le
// scegliesse un client, l'altro giocherebbe su un tabellone diverso.
function _buchi() {
  var caselle = _caselle().filter(function (k) { return k !== '0,0'; });
  var quanti = 2 + Math.floor(Math.random() * 4);
  var presi = {};
  var out = [];
  while (out.length < quanti) {
    var k = caselle[Math.floor(Math.random() * caselle.length)];
    if (presi[k]) continue;
    presi[k] = true;
    out.push(k);
  }
  return out;
}

function _mescola(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// Il mazzo scelto di un giocatore, in id di carta. Passa dalle stesse regole
// del resto: se una carta non e' sua, non entra. E' il motivo per cui il mazzo
// si legge QUI e non si accetta dal client — un mazzo che arriva dal client e'
// una richiesta, non un fatto.
// ── v0.78.4 — IL MAZZO CASUALE LO COMPONE IL SERVER ──────────────────────
// Il client puo' generarsi un mazzo casuale per giocare contro l'IA, ma in rete
// no: qui vale la regola scritta sopra _mazzoDi — "un mazzo che arriva dal
// client e' una richiesta, non un fatto". Se il casuale glielo lasciassimo
// dichiarare, chiunque potrebbe dichiarare dodici Excalibur.
// Quindi lo compone il server, con le stesse carte che il giocatore possiede
// davvero e le stesse due regole di sempre: dodici carte, ventiquattro punti.
//
// NON PUO' USCIRNE UNO NON VALIDO. Si prende una carta alla volta e la si
// accetta solo se il budget regge ANCHE i posti che restano da riempire, dando
// per scontato che costino almeno uno l'uno. Con quel controllo dodici caselle
// si riempiono sempre, perche' la carta piu' economica costa uno e dodici per
// uno fa dodici — cioe' meta' del budget.
function _mazzoCasualeDi(nk, logger, userId) {
  var catalogo = leggiSistema(nk, KEY_CATALOGO);
  if (!catalogo || !catalogo.carte) return null;
  var possesso = leggiPossesso(nk, userId);
  if (!possesso) return null;
  var admin = !!possesso.admin;
  var possedute = _possedute(catalogo.carte, possesso, admin);

  var candidate = [], i;
  for (i = 0; i < catalogo.carte.length; i++) {
    var c = catalogo.carte[i];
    if (c.soloAdmin && !admin) continue;
    if (!possedute[c.slug]) continue;
    candidate.push(c);
  }
  if (candidate.length < MAZZO_CARTE) {
    logger.warn('mazzo casuale per %s: possiede solo %d carte', userId, candidate.length);
    return null;
  }
  // Mescolata alla Fisher-Yates. Qui il caso deve essere caso: e' il server, e
  // non c'e' nessun secondo tabellone con cui doversi trovare d'accordo.
  for (i = candidate.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = candidate[i]; candidate[i] = candidate[j]; candidate[j] = tmp;
  }
  var costoDi = function (r) { return COSTO_RARITA[String(r || '').toLowerCase()] || 1; };
  var prese = [], punti = 0;
  for (i = 0; i < candidate.length && prese.length < MAZZO_CARTE; i++) {
    var q = costoDi(candidate[i].rarity);
    var restanti = MAZZO_CARTE - prese.length - 1;
    if (punti + q + restanti > MAZZO_PUNTI) continue;
    prese.push(String(candidate[i].id));
    punti += q;
  }
  if (prese.length !== MAZZO_CARTE) {
    logger.warn('mazzo casuale per %s: non ne esce uno da %d carte entro %d punti', userId, MAZZO_CARTE, MAZZO_PUNTI);
    return null;
  }
  logger.info('mazzo casuale per %s: %d carte, %d punti su %d', userId, prese.length, punti, MAZZO_PUNTI);
  return { nome: 'Random deck', carte: prese };
}

function _mazzoDi(nk, logger, userId) {
  var r = nk.storageRead([{ collection: COLL_PROFILO, key: KEY_MAZZI, userId: userId }]);
  var dati = (r && r.length && r[0].value) ? r[0].value : null;
  if (!dati) return null;
  // v0.78.4 — se ha scelto il casuale, se ne compone uno adesso. Sta PRIMA del
  // controllo sui mazzi salvati: col casuale non serve averne nemmeno uno, e
  // finora si finiva per ripiegare sul primo — cioe' si giocava un mazzo
  // preciso avendo chiesto il caso.
  if (String(dati.scelto) === MAZZO_CASUALE) {
    var casuale = _mazzoCasualeDi(nk, logger, userId);
    if (casuale) return casuale;
    logger.warn('mazzo casuale non componibile per %s: ripiego sui suoi mazzi', userId);
  }
  if (!dati.mazzi || !dati.mazzi.length) return null;
  var scelto = null;
  for (var i = 0; i < dati.mazzi.length; i++) {
    if (String(dati.mazzi[i].id) === String(dati.scelto)) { scelto = dati.mazzi[i]; break; }
  }
  if (!scelto) scelto = dati.mazzi[0];
  var carte = (scelto.carte || []).map(String);
  if (carte.length !== MAZZO_CARTE) {
    logger.warn('mazzo di %s con %d carte invece di %d', userId, carte.length, MAZZO_CARTE);
    return null;
  }
  return { nome: String(scelto.nome || ''), carte: carte };
}

// Quel che si puo' dire a TUTTI di una mano: quante carte, non quali.
function _pubblico(stato) {
  var out = {};
  for (var i = 0; i < stato.giocatori.length; i++) {
    var u = stato.giocatori[i];
    out[i + 1] = { carteInMano: stato.mano[u].length, carteNelMazzo: stato.mazzo[u].length };
  }
  return out;
}

function _indiceDi(stato, userId) {
  for (var i = 0; i < stato.giocatori.length; i++) if (stato.giocatori[i] === userId) return i;
  return -1;
}

function _presenzaDi(stato, userId) {
  return stato.presenze[userId] || null;
}

// Manda a UNO solo. Le mani viaggiano sempre di qui: un dispatch a tutti con
// dentro la mano di uno dei due sarebbe esattamente la cosa da non fare.
function _aUno(dispatcher, stato, userId, op, dati) {
  var p = _presenzaDi(stato, userId);
  if (!p) return;
  dispatcher.broadcastMessage(op, JSON.stringify(dati), [p]);
}

function _aTutti(dispatcher, op, dati) {
  dispatcher.broadcastMessage(op, JSON.stringify(dati), null);
}

// ── l'avvio ───────────────────────────────────────────────────────────────
function _comincia(stato, dispatcher, logger, nk) {
  stato.iniziata = true;
  stato.buchi = _buchi();
  // Chi comincia si tira a sorte. Il primo turno vale, e non deve dipendere
  // da chi ha premuto prima o da chi ha la connessione piu' svelta.
  stato.turno = Math.floor(Math.random() * 2);
  stato.numeroTurno = 1;
  // ── v0.78.23 — IL PRIMO TURNO ASPETTA LA SCHERMATA VERSUS ──────────────
  // Trovato l-avversario, i due client mostrano per qualche secondo chi
  // sfideranno. Il cronometro pero- partiva da questo istante, e quei secondi
  // se li mangiava il primo turno: chi apre la partita si trovava con meno
  // tempo degli altri, per una cosa che non ha nemmeno visto succedere.
  // Il tempo in piu- lo si da- QUI, una volta sola, perche- qui e- l-unico
  // punto in cui si sa che quel turno e- il primo.
  stato.scadenza = Date.now() + TURNO_MS + VERSUS_MS;

  for (var i = 0; i < stato.giocatori.length; i++) {
    var u = stato.giocatori[i];
    var mescolato = _mescola(stato.mazzoIniziale[u].slice());
    stato.mano[u] = mescolato.slice(0, MANO_INIZIALE);
    stato.mazzo[u] = mescolato.slice(MANO_INIZIALE);
  }

  for (var j = 0; j < stato.giocatori.length; j++) {
    var uid = stato.giocatori[j];
    _aUno(dispatcher, stato, uid, OP_AVVIO, {
      tu: j + 1,
      mano: stato.mano[uid],
      // Anche il RESTO del suo mazzo, nell'ordine in cui e' stato mescolato.
      // Non e' un segreto — e' roba sua — e mandarlo adesso evita di dover
      // sincronizzare ogni pescata: il client pesca da solo, nello stesso
      // ordine, e quel che pesca coincide sempre con quel che il server sa.
      // Del mazzo dell'AVVERSARIO, invece, non arriva niente.
      mazzo: stato.mazzo[uid],
      buchi: stato.buchi,
      turno: stato.turno + 1,
      scadenza: stato.scadenza,
      numeroTurno: stato.numeroTurno,
      avversario: stato.info[stato.giocatori[1 - j]] || {},
      pubblico: _pubblico(stato)
    });
  }
  logger.info('partita cominciata: %s contro %s, comincia il %d',
    stato.giocatori[0], stato.giocatori[1], stato.turno + 1);
}

// Passa il turno e pesca per chi ha appena giocato.
function _passaTurno(stato, dispatcher, chiHaGiocato) {
  var pescata = null;
  if (stato.mazzo[chiHaGiocato].length && stato.mano[chiHaGiocato].length < MANO_INIZIALE) {
    pescata = stato.mazzo[chiHaGiocato].shift();
    stato.mano[chiHaGiocato].push(pescata);
  }
  stato.turno = 1 - stato.turno;
  stato.numeroTurno++;
  stato.scadenza = Date.now() + TURNO_MS;
  return pescata;
}

// ── i sette momenti di una partita ──────────────────────────────────────────
// Funzioni GLOBALI e con un nome, non funzioni anonime dentro all'oggetto:
// il runtime le cerca per id globale, e di una funzione anonima non ce n'e'
// uno. Scritte inline il modulo non parte affatto — "javascript functions
// cannot be inlined" — e Nakama entra in ciclo di riavvio.
// ══════════════════════════════════════════════════════════════════════════
// IL TABELLONE IN OMBRA
// ══════════════════════════════════════════════════════════════════════════
// Rifa' i conti della partita sul server e li confronta con quelli dei client.
// Tutto quel che sta qui sotto e' scritto con funzioni NOMINATE e con `var`:
// il runtime e' goja, e le funzioni anonime dentro al gestore di partita hanno
// gia' fatto cadere il server una volta.

var OMBRA_DIR = [
  { dq: 0, dr: -1, mio: 'NW', suo: 'SE' },
  { dq: 1, dr: -1, mio: 'NE', suo: 'SW' },
  { dq: 1, dr: 0, mio: 'E', suo: 'W' },
  { dq: 0, dr: 1, mio: 'SE', suo: 'NW' },
  { dq: -1, dr: 1, mio: 'SW', suo: 'NE' },
  { dq: -1, dr: 0, mio: 'W', suo: 'E' }
];

// Il catalogo si legge UNA volta per partita, e si tiene solo cio' che serve
// alle carte dei due mazzi: il catalogo intero pesa una settantina di
// chilobyte e non c'e' motivo di portarselo dietro tutto in memoria.
function ombraPrepara(ctx, nk, logger, state) {
  if (state.ombra.pronta) return;
  // IL SEME. I lati "a caso" (Scope RAND) escono da un numero ricavato dal
  // seme della partita, e il client usa il match id che gli e' arrivato. Se il
  // server ne usasse un altro, quelle carte finirebbero su lati diversi e
  // l'ombra segnalerebbe divergenze che non esistono.
  // Se un giorno il registro mostrasse divergenze concentrate sulle carte con
  // RAND, e' QUESTA la prima cosa da guardare.
  state.matchId = String((ctx && ctx.matchId) || '');
  state.ombra.pronta = true;                 // anche se fallisce: non si riprova a ogni giocata
  var catalogo = leggiSistema(nk, KEY_CATALOGO);
  if (!catalogo || !catalogo.carte) { logger.warn('ombra: nessun catalogo, il server non ricalcola'); return; }
  var servono = {};
  var g, i, j;
  for (g = 0; g < state.giocatori.length; g++) {
    var mazzo = state.mazzoIniziale[state.giocatori[g]] || [];
    for (i = 0; i < mazzo.length; i++) servono[String(mazzo[i])] = true;
  }
  var quante = 0;
  for (j = 0; j < catalogo.carte.length; j++) {
    var e = catalogo.carte[j];
    if (!e || !servono[String(e.id)]) continue;
    var v = e.values || {};
    state.ombra.carte[String(e.id)] = {
      nome: e.name || '',
      valori: { NW: v.NW || 0, NE: v.NE || 0, E: v.E || 0, SE: v.SE || 0, SW: v.SW || 0, W: v.W || 0 },
      abilita: e.abilita || null,
      tratti: e.traitNames || e.traits || [],
      // ── v0.77.92 — E I GRUPPI, CHE NON SONO DEDUCIBILI DAI NUMERI ────────
      // Da quando gli effetti colpiscono un GRUPPO intero e non un lato solo
      // (vedi latiColpiti), il motore ha bisogno di sapere come la carta e'
      // divisa. Senza `groupSides` se li ricava dai numeri — fasce contigue
      // di lati uguali — e quella deduzione NON coincide sempre con la verita':
      // due gruppi distinti possono mostrare lo stesso numero, e dedotti
      // diventerebbero uno solo.
      // Sarebbe la peggiore delle divergenze: il client colpisce un gruppo, il
      // server ne colpisce due, le impronte non tornano e la partita viene
      // fermata per un guasto che non c'e'. I gruppi stanno nel catalogo:
      // basta portarseli.
      gruppi: e.groupSides || null
    };
    quante++;
  }
  // ── CHI FARA' DIVERGERE, DETTO PRIMA ────────────────────────────────────
  // "Quante partite servono?" e' la domanda sbagliata: una partita in cui non
  // e' successo niente di esotico non dimostra niente. Quella giusta e' QUALI
  // carte il server non sa ancora rifare — e si sanno gia' all'inizio, dalle
  // carte dei due mazzi.
  // Cosi' il registro non dice solo "e' divergente": dice in anticipo chi sono
  // i sospetti, e una divergenza senza nessun sospetto in campo e' un guasto
  // vero da guardare subito.
  var sospetti = [];
  for (var s in state.ombra.carte) {
    if (ombraSaRifare(state.ombra.carte[s].abilita)) continue;
    sospetti.push(state.ombra.carte[s].nome || s);
  }
  logger.info('ombra: pronta con %d carte sulle %d dei due mazzi | non so rifare: %s',
    quante, Object.keys(servono).length, sospetti.length ? sospetti.join(', ') : 'nessuna');
}

// Il server sa rifare un'abilita'? Sa fare i NUMERI (buff, debuff, set) e le
// REGOLE, che il motore consulta da se'. Non sa ancora fare tutto il resto:
// spostare, distruggere, trasformare, evocare, cambiare padrone, rubare un
// tratto o un'abilita', e ovviamente non sa scegliere al posto del giocatore.
// Finche' e' cosi', una partita con queste carte diverge — e va bene: e'
// esattamente cio' che l'ombra deve dirci PRIMA di comandare.
function ombraSaRifare(a) {
  if (!a) return true;                     // nessuna abilita': niente da rifare
  if (a.unica) return false;               // scritta a mano nel client, il server non la vede
  var effetti = [a.effetto, a.effetto2], i;
  for (i = 0; i < effetti.length; i++) {
    var e = effetti[i];
    if (!e) continue;
    if (e.scelta) return false;                                  // la sceglie il giocatore
    if (e.azione !== 'buff' && e.azione !== 'debuff' && e.azione !== 'set') return false;
    if (e.cosa && e.cosa !== 'power') return false;
    if (e.dove === 'drawn' || e.dove === 'deck') return false;    // fuori dal tabellone
    if (e.quale === 'next' || e.quale === 'last') return false;   // aspetta qualcosa che non c'e' ancora
  }
  return true;
}

// Una carta dell'ombra ha la forma che il motore si aspetta.
function ombraCarta(state, id, di) {
  var b = state.ombra.carte[String(id)];
  if (!b) return null;
  var v = { NW: b.valori.NW, NE: b.valori.NE, E: b.valori.E, SE: b.valori.SE, SW: b.valori.SW, W: b.valori.W };
  var vb = { NW: b.valori.NW, NE: b.valori.NE, E: b.valori.E, SE: b.valori.SE, SW: b.valori.SW, W: b.valori.W };
  // v0.77.92 — `groupSides` col nome che il motore si aspetta (lo stesso del
  // client): e' cio' che decide quali lati si muovono insieme.
  var gs = null, gi;
  if (b.gruppi && b.gruppi.length) {
    gs = [];
    for (gi = 0; gi < b.gruppi.length; gi++) gs.push(b.gruppi[gi].slice());
  }
  return { id: String(id), baseId: String(id), name: b.nome, owner: di,
           values: v, valoriBase: vb, traitNames: b.tratti, traits: b.tratti,
           groupSides: gs, abilita: b.abilita };
}

// La scena che il motore vuole: chi c'e' in campo, chi e' vicino a chi.
function ombraScena(state) {
  var celle = state.ombra.celle;
  var inCampo = [], dove = {}, k;
  for (k in celle) {
    if (!celle[k] || !celle[k].carta) continue;
    inCampo.push(celle[k].carta);
    dove[celle[k].carta.id + '@' + k] = k;
  }
  return {
    inCampo: inCampo,
    inMano: [],
    // v0.77.93 — la stessa risposta che da' il client (vedi _occasione).
    cellaDi: function (carta) { return ombraCellaDi(state, carta); },
    turno: state.numeroTurno,
    seme: state.matchId || '',
    vicini: function (carta) { return ombraVicini(state, carta); },
    latiLiberi: function (carta) { return ombraLatiLiberi(state, carta); }
  };
}

function ombraCellaDi(state, carta) {
  var k;
  for (k in state.ombra.celle) {
    if (state.ombra.celle[k] && state.ombra.celle[k].carta === carta) return k;
  }
  return null;
}

function ombraVicini(state, carta) {
  var k = ombraCellaDi(state, carta);
  if (!k) return [];
  var qr = k.split(','), q = Number(qr[0]), r = Number(qr[1]);
  var out = [], i;
  for (i = 0; i < OMBRA_DIR.length; i++) {
    var nk = (q + OMBRA_DIR[i].dq) + ',' + (r + OMBRA_DIR[i].dr);
    if (state.ombra.celle[nk] && state.ombra.celle[nk].carta) out.push(state.ombra.celle[nk].carta);
  }
  return out;
}

function ombraLatiLiberi(state, carta) {
  var k = ombraCellaDi(state, carta);
  if (!k) return 0;
  var qr = k.split(','), q = Number(qr[0]), r = Number(qr[1]);
  var liberi = 0, i;
  for (i = 0; i < OMBRA_DIR.length; i++) {
    var nk = (q + OMBRA_DIR[i].dq) + ',' + (r + OMBRA_DIR[i].dr);
    if (_caselle().indexOf(nk) === -1) continue;
    if (!state.ombra.celle[nk] || !state.ombra.celle[nk].carta) liberi++;
  }
  return liberi;
}

// I valori con dentro le sinergie continue: e' quel che il client confronta
// quando risolve uno scontro.
function ombraValori(state, carta, scena) {
  return ABILITA_MOTORE.valoriEffettivi(carta, scena);
}

// Una giocata, rifatta dal server: si posa la carta, si applica cio' che il
// motore sa fare al piazzamento, e si risolvono le conquiste.
function ombraGiocata(state, logger, k, id, di) {
  if (!state.ombra.pronta) return;
  var carta = ombraCarta(state, id, di);
  if (!carta) { ombraRinuncia(state, logger, 'la carta ' + id + ' non e\' nel catalogo'); return; }
  state.ombra.celle[k] = { id: String(id), di: di, carta: carta };

  var scena = ombraScena(state);
  try {
    var cambi = ABILITA_MOTORE.cambiamentiAllEvento(carta, 'on_play', scena);
    ombraApplica(cambi);
  } catch (e) { ombraRinuncia(state, logger, 'on_play: ' + e.message); return; }

  try { ombraConquiste(state, k, carta, di); }
  catch (e2) { ombraRinuncia(state, logger, 'conquiste: ' + e2.message); }
}

// Solo i cambiamenti fatti di numeri: gli altri il server non li sa ancora
// eseguire, ed e' proprio quel che l'ombra deve far venire fuori.
function ombraApplica(cambi) {
  var i, j;
  for (i = 0; i < (cambi || []).length; i++) {
    var c = cambi[i];
    if (!c || !c.carta || !c.lati || !c.lati.length) continue;
    for (j = 0; j < c.lati.length; j++) {
      var l = c.lati[j];
      if (c.azione === 'set') c.carta.valoriBase[l] = c.valore;
      else if (c.delta) c.carta.valoriBase[l] = Math.max(0, (c.carta.valoriBase[l] || 0) + c.delta);
      c.carta.values[l] = c.carta.valoriBase[l];
    }
  }
}

// La stessa regola del client: per ogni lato, il valore d'attacco contro il
// valore del lato opposto del vicino. Le eccezioni (intoccabile, lato
// protetto, chi puo' conquistare chi, con che valore attacca) le sa gia' il
// motore — sono le stesse righe che gira il client.
function ombraConquiste(state, k, carta, di) {
  var qr = k.split(','), q = Number(qr[0]), r = Number(qr[1]);
  var scena = ombraScena(state);
  var miei = ombraValori(state, carta, scena);
  var i;
  for (i = 0; i < OMBRA_DIR.length; i++) {
    var d = OMBRA_DIR[i];
    var nk = (q + d.dq) + ',' + (r + d.dr);
    var posto = state.ombra.celle[nk];
    if (!posto || !posto.carta || posto.di === di) continue;
    var suo = posto.carta;
    if (ABILITA_MOTORE.intoccabile(suo)) continue;
    if (ABILITA_MOTORE.latoProtetto(suo, d.suo)) continue;
    var suoi = ombraValori(state, suo, scena);
    var attacco = ABILITA_MOTORE.valoreDiAttacco(carta, miei, d.mio);
    if (!ABILITA_MOTORE.conquistabileDa(suo, carta, {
      differenza: Math.abs(attacco - (suoi[d.suo] || 0)), valoreAttacco: attacco
    })) continue;
    if (!ABILITA_MOTORE.vince(carta, attacco, suoi[d.suo] || 0)) continue;
    posto.di = di;
    // Le reazioni alla conquista che sono numeri, il server le sa fare.
    try {
      var scenaColpo = ombraScena(state);
      scenaColpo.attaccante = carta; scenaColpo.attaccato = suo;
      scenaColpo.differenza = Math.abs(attacco - (suoi[d.suo] || 0));
      ombraApplica(ABILITA_MOTORE.cambiamentiAllEvento(suo, 'on_conquered', scenaColpo));
      ombraApplica(ABILITA_MOTORE.cambiamentiAllEvento(carta, 'on_conquer', scenaColpo));
    } catch (e) { /* la nota la lascia il confronto, non serve fermarsi qui */ }
  }
}

// L'impronta, nella STESSA forma di quella dei client (vedi reteImpronta):
// cella:idCarta:proprietario, in ordine di cella.
function ombraImpronta(state) {
  var chiavi = [], k;
  for (k in state.ombra.celle) if (state.ombra.celle[k] && state.ombra.celle[k].carta) chiavi.push(k);
  chiavi.sort();
  var pezzi = [], i;
  for (i = 0; i < chiavi.length; i++) {
    var c = state.ombra.celle[chiavi[i]];
    pezzi.push(chiavi[i] + ':' + c.id + ':' + c.di);
  }
  return pezzi.join('|');
}

// Quando l'ombra non ce la fa, smette di provarci per questa partita: un
// ricalcolo sbagliato che continua a girare produrrebbe divergenze finte, e
// le divergenze finte sono peggio di nessun controllo — insegnano a non
// fidarsi dell'unico strumento che dovrebbe dire la verita'.
function ombraRinuncia(state, logger, perche) {
  if (!state.ombra.pronta) return;
  state.ombra.pronta = false;
  logger.warn('ombra spenta per questa partita: %s', perche);
}

// Il confronto. NON ferma niente e non cambia niente: prende nota.
function ombraConfronta(state, logger, turno, improntaVera) {
  if (!state.ombra.pronta) return;
  state.ombra.confronti++;
  var mia = ombraImpronta(state);
  if (mia === improntaVera) return;
  state.ombra.divergenze++;
  if (!state.ombra.primaDivergenza) {
    state.ombra.primaDivergenza = { turno: turno, server: mia, client: improntaVera };
    // Le carte in campo al momento della divergenza: senza, si sa che i due
    // tabelloni non coincidono ma non da dove cominciare a guardare.
    var inCampo = [], kk;
    for (kk in state.ombra.celle) {
      if (state.ombra.celle[kk] && state.ombra.celle[kk].carta) inCampo.push(state.ombra.celle[kk].carta.name);
    }
    logger.warn('ombra: PRIMA divergenza al turno %s | in campo: %s\n  server: %s\n  client: %s',
      turno, inCampo.join(', '), mia, improntaVera);
  }
}

// -- v0.78.9 -- LE CASELLE OCCUPATE LE DICE IL RACCONTO CONCORDE ----------
// `state.occupate` era una somma di sole giocate: cresceva e non calava mai.
// Ma una carta puo' USCIRE dal tabellone -- Mordred ne distrugge una -- o
// SPOSTARSI -- Rapunzel la tira accanto a se'. Il server non lo sapeva: quella
// casella restava occupata per sempre nella sua contabilita', e chi provava a
// giocarci si sentiva rispondere "quella casella e' gia' occupata" davanti a
// una casella vuota. Il difetto non era di Mordred: era di ogni abilita' che
// toglie o sposta una carta, oggi e domani.
//
// Non lo si chiede al client. Sarebbe la sua parola, e con quella si potrebbe
// liberare qualunque casella. Lo si legge invece dal racconto che i due client
// hanno gia' fatto UGUALE (vedi OP_IMPRONTA): l'impronta e' esattamente
// "casella:carta:proprietario" per ogni casella piena, cioe' E' GIA' la mappa
// delle occupate, concordata da tutti e due. Per falsificarla non basta un
// client modificato: dovrebbero mentire nello stesso identico modo.
//
// Si taglia sul PRIMO e sull'ULTIMO due punti: la casella e' "q,r" e il
// proprietario e' una cifra, mentre in mezzo c'e' un identificativo di carta
// su cui non conviene fare promesse.
function _occupateDaImpronta(state, impronta) {
  var nuove = {};
  var pezzi = String(impronta || '').split('|');
  for (var i = 0; i < pezzi.length; i++) {
    var p = pezzi[i];
    if (!p) continue;
    var a = p.indexOf(':'), b = p.lastIndexOf(':');
    if (a < 0 || b <= a) continue;
    nuove[p.slice(0, a)] = { carta: p.slice(a + 1, b), di: parseInt(p.slice(b + 1), 10) || 0 };
  }
  state.occupate = nuove;
}

function partitaInit(ctx, logger, nk, params) {
  var giocatori = JSON.parse(params.giocatori || '[]');
  var info = JSON.parse(params.info || '{}');
  var stato = {
    giocatori: giocatori,       // [userId, userId] — l'ordine E' il numero di giocatore
    info: info,                 // nome, rank, avatar, per l'altro
    presenze: {},
    mazzoIniziale: {},
    mano: {}, mazzo: {},
    buchi: [], occupate: {},
    // v0.78.11 — quanti turni ha giocato CIASCUNO. Non si ricava da
    // numeroTurno: quello conta i turni della partita, e a fine partita i due
    // giocatori non ne hanno quasi mai giocati altrettanti. E' il server a
    // contarli perche' e' la base dell'esperienza, e un numero che decide un
    // premio non lo si chiede a chi lo riceve.
    turniGiocati: {},
    turno: 0, numeroTurno: 0, scadenza: 0,
    iniziata: false, finita: false,
    natoIl: Date.now(),
    rapporti: {},              // per turno: cosa ha raccontato ciascuno
    // v0.77.86 — chi ha fatto l'ULTIMA giocata. Serve alle abilita' che
    // chiedono un bersaglio: la scelta arriva DOPO il piazzamento, e a quel
    // punto il turno e' gia' passato all'altro (vedi _passaTurno). Chiedere
    // "tocca a te?" a chi deve scegliere darebbe sempre no.
    ultimaGiocataDi: -1,
    concordato: null,          // l'ultimo tabellone su cui i due erano d'accordo
    // ── v0.77.76 — IL TABELLONE IN OMBRA ──────────────────────────────────
    // Il server ricalcola la partita per conto suo e confronta il risultato
    // con quello su cui i due client si sono trovati d'accordo. NON comanda:
    // guarda e prende nota. Diventera' arbitro vero quando avra' dimostrato,
    // su un po' di partite, di dire sempre la stessa cosa.
    //
    // Si comincia in ombra e non subito al comando per una ragione precisa:
    // oggi il server non sa fare TUTTO cio' che fa una carta (spostare,
    // trasformare, cambiare padrone), e un arbitro che sbaglia e' peggio di
    // nessun arbitro. L'ombra dice esattamente QUALI carte lo fanno sbagliare,
    // invece di farlo scoprire a una partita vera.
    ombra: {
      pronta: false,
      carte: {},        // id di catalogo -> { valori, abilita, tratti, nome }
      celle: {},        // cella -> { id, di, valori }
      confronti: 0, divergenze: 0, primaDivergenza: null
    }
  };
  for (var i = 0; i < giocatori.length; i++) {
    var m = _mazzoDi(nk, logger, giocatori[i]);
    if (!m) { logger.error('senza mazzo valido: %s', giocatori[i]); return null; }
    stato.mazzoIniziale[giocatori[i]] = m.carte;
    stato.mano[giocatori[i]] = [];
    stato.mazzo[giocatori[i]] = [];
  }
  // Un tick al secondo basta: qui non si anima niente, si guarda un orologio.
  return { state: stato, tickRate: 1, label: JSON.stringify({ gioco: 'hextale' }) };
}

function partitaJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  // Entra solo chi e' stato accoppiato. Un match id che gira non deve essere
  // un invito per chiunque lo intercetti.
  if (_indiceDi(state, presence.userId) === -1) return { state: state, accept: false, rejectMessage: 'non sei di questa partita' };
  if (state.presenze[presence.userId]) return { state: state, accept: false, rejectMessage: 'sei gia\' dentro' };
  return { state: state, accept: true };
}

function partitaJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (var i = 0; i < presences.length; i++) state.presenze[presences[i].userId] = presences[i];
  var dentro = 0;
  for (var j = 0; j < state.giocatori.length; j++) if (state.presenze[state.giocatori[j]]) dentro++;
  if (dentro === state.giocatori.length && !state.iniziata) _comincia(state, dispatcher, logger, nk);
  return { state: state };
}

// ── v0.78.6 — LA RESA LA DICHIARA CHI SI ARRENDE, E LA ARBITRA IL SERVER ──
// Prima il client si arrendeva DA SOLO: chiudeva la propria partita e non
// diceva niente a nessuno. L'altro restava davanti a un tavolo fermo finche'
// il tempo non scadeva, senza sapere perche'.
// Adesso la resa e' un messaggio come una giocata, e il server ne fa quel che
// fa di ogni fine: lo dice a tutti e due, e SCRIVE L'ESITO — chi si arrende
// perde, l'altro vince. Una resa e' una sconfitta scelta, non una partita
// senza risultato.
// ── v0.78.14 — LA REGOLA DELLA RESA, PER INTERO ──────────────────────────
// Chi si arrende PERDE, e chi resta in partita vince. Sempre — anche se stava
// perdendo, anche all'ultimo turno. Una sola eccezione, ed e' quando non c'e'
// niente da assegnare: a ZERO A ZERO non ha vinto nessuno, e il risultato e'
// un pareggio.
// Il metro e' il PUNTEGGIO, non quante carte ci siano in campo: due carte
// calate senza nessuna conquista lasciano il punteggio a zero, e li' non e'
// successo niente di piu' che su un tabellone vuoto.
// I punti il server non li calcola: li legge dall'ultimo racconto su cui i due
// client si sono trovati D'ACCORDO (vedi OP_IMPRONTA). Se non ce n'e' ancora
// nessuno, nessuno ha ancora fatto punti — che e' zero a zero.
// Il client decide con lo stesso metro dalla sua parte (vedi punteggioAZero),
// o il profilo direbbe "vittoria" mentre lo schermo dice "Draw".
function _punteggioAZero(state) {
  var acc = state.concordato;
  if (!acc) return true;
  var p = acc.hp || acc.punteggio || {};
  return !((typeof p['1'] === 'number' && p['1'] !== 0) ||
           (typeof p['2'] === 'number' && p['2'] !== 0));
}

function _resa(state, dispatcher, logger, nk, chi) {
  if (!state.iniziata || state.finita) return;
  state.finita = true;
  state.motivo = 'resa';
  var perdente = _indiceDi(state, chi);
  if (perdente < 0) return;
  // A zero a zero non c'e' un vincitore: zero, cioe' nessuno.
  var vuoto = _punteggioAZero(state);
  var vincitore = vuoto ? 0 : ((perdente === 0) ? 2 : 1);
  for (var i = 0; i < state.giocatori.length; i++) {
    var u = state.giocatori[i];
    var suo = (i + 1) === vincitore;
    try {
      // v0.78.11 — chi si arrende ha CONCLUSO la partita, e quello vale 20:
      // e' una sconfitta scelta, non una partita lasciata a meta'. Chi si
      // trova vincitore per la resa dell'altro ha vinto, e vale 50.
      // v0.78.14 — a zero a zero e' un pareggio per tutti e due, e un pareggio
      // paga quanto una sconfitta: nessuno dei due ha `vinta`.
      var esito = applicaEsito(nk, u, vuoto ? false : suo, vuoto, false,
        state.turniGiocati[u], (vuoto || suo) ? 'finita' : 'resa');
      esito.vinta = vuoto ? false : suo;
      esito.pari = vuoto;
      esito.perResa = true;
      _aUno(dispatcher, state, u, OP_ESITO, esito);
    } catch (e) {
      logger.error('esito non scritto per %s dopo una resa: %s', u, String(e));
    }
  }
  _aTutti(dispatcher, OP_FINE, { motivo: 'resa', chi: perdente + 1, vincitore: vincitore });
  if (vuoto) logger.info('resa di %s a zero a zero: pareggio, nessun vincitore', chi);
  else logger.info('partita finita per resa di %s: vince il giocatore %d', chi, vincitore);
}

// ── v0.78.11 — CHI STAVA VINCENDO, QUANDO L'ALTRO E' USCITO ───────────────
// Non lo si puo' chiedere al client che resta — sarebbe la sua parola su un
// premio che riceve lui. Lo si legge dall'ultimo racconto su cui i due si erano
// trovati D'ACCORDO (vedi OP_IMPRONTA e state.concordato): e' l'ultima cosa
// vera che si sappia di quella partita.
// Se non c'e' ancora nessun racconto — uno esce prima che il primo turno si
// chiuda — non stava vincendo nessuno, e i turni giocati sono zero comunque.
function _chiStavaVincendo(state) {
  var acc = state.concordato;
  if (!acc) return 0;
  var p = acc.hp || acc.punteggio || {};
  var d1 = (typeof p['1'] === 'number') ? p['1'] : 0;
  var d2 = (typeof p['2'] === 'number') ? p['2'] : 0;
  if (d1 === d2) return 0;
  return d1 > d2 ? 1 : 2;
}

// ── v0.78.11 — UNA PARTITA LASCIATA A META' PAGA COMUNQUE IL TEMPO ────────
// Prima qui non si scriveva NIENTE: chi usciva e chi restava tornavano al menu
// come se quella mezz'ora non fosse esistita.
// Adesso i turni giocati si pagano a tutti e due — quelli li ha giocati
// davvero anche chi e' uscito, e togliergli anche quelli sarebbe punire un
// crash. Il premio di fine invece dipende dalla parte in cui uno si trova:
// zero per chi esce, perche' la sua partita non si e' conclusa in nessun modo;
// per chi resta, quanto una vittoria se stava vincendo, e una via di mezzo se
// stava perdendo — gli hanno tolto la partita dalle mani, e questo non e' colpa
// sua ne' merito suo.
// Il rank non si muove per nessuno dei due: vedi applicaEsito.
function _uscita(state, dispatcher, logger, nk, chiEUscito) {
  var vincente = _chiStavaVincendo(state);
  for (var i = 0; i < state.giocatori.length; i++) {
    var u = state.giocatori[i];
    var uscito = (u === chiEUscito);
    var stavaVincendo = (i + 1) === vincente;
    try {
      var esito = applicaEsito(nk, u, uscito ? false : stavaVincendo, false, false,
        state.turniGiocati[u], uscito ? 'uscito' : 'resta');
      esito.vinta = false;          // nessuno ha vinto: la partita non e' finita
      esito.pari = false;
      esito.perAbbandono = true;
      esito.stavaVincendo = uscito ? false : stavaVincendo;
      _aUno(dispatcher, state, u, OP_ESITO, esito);
    } catch (e) {
      logger.error('esito non scritto per %s dopo un abbandono: %s', u, String(e));
    }
  }
}

function partitaLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (var i = 0; i < presences.length; i++) {
    var u = presences[i].userId;
    delete state.presenze[u];
    if (state.iniziata && !state.finita) {
      state.finita = true;
      state.motivo = 'abbandono';
      // v0.78.11 — prima dell'annuncio: l'esperienza si scrive, e chi resta la
      // riceve insieme alla notizia invece di tornare al menu a mani vuote.
      try { _uscita(state, dispatcher, logger, nk, u); }
      catch (eu) { logger.error('esperienza non scritta dopo un abbandono: %s', String(eu)); }
      _aTutti(dispatcher, OP_FINE, { motivo: 'abbandono', chi: _indiceDi(state, u) + 1 });
      logger.info('partita finita per abbandono di %s', u);
    }
  }
  return { state: state };
}

function partitaLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
  // Nessuno e' entrato entro il tempo: la partita non c'e' mai stata.
  if (!state.iniziata && Date.now() - state.natoIl > ATTESA_INGRESSO_MS) {
    logger.info('partita mai cominciata: nessuno e\' entrato in tempo');
    return null;
  }
  if (state.finita) return null;

  for (var i = 0; i < messages.length; i++) {
    var m = messages[i];
    var chi = m.sender.userId;
    var idx = _indiceDi(state, chi);
    if (idx === -1) continue;
    var corpo = {};
    try { corpo = JSON.parse(nk.binaryToString(m.data)); } catch (e) { corpo = {}; }

    // v0.78.6 — la resa, prima di tutto il resto: chi si arrende non ha altro
    // da dire, e continuare a leggere i suoi messaggi dopo la fine non avrebbe
    // senso. Non si controlla di chi sia il turno: ci si puo' arrendere quando
    // si vuole, ed e' proprio quando NON tocca a te che se ne sente il bisogno.
    if (m.opCode === OP_MI_ARRENDO) {
      _resa(state, dispatcher, logger, nk, chi);
      return { state: state };
    }

    if (m.opCode === OP_IMPRONTA) {
      // ── v0.77.55 — IL SERVER FA L'ARBITRO ───────────────────────────
      // Le regole stanno ancora nei client (conquiste e abilita': sono
      // novemilaseicento righe, e portarle qui e' un lavoro a se'). Ma un
      // fatto raccontato UGUALE da tutti e due i giocatori e' molto piu' di
      // un fatto dichiarato da uno solo: per falsificarlo non basta piu'
      // modificare il proprio client, servirebbe che anche l'avversario
      // mentisse nello stesso identico modo. Fra due sconosciuti accoppiati
      // dal matchmaking, quello non e' piu' un attacco: e' un accordo.
      //
      // Da questi due racconti concordi il server ricava il punteggio e,
      // quando la partita finisce, il RISULTATO — che prima ognuno si
      // dichiarava da solo.
      var t = String(corpo.turno);
      if (!state.rapporti[t]) state.rapporti[t] = {};
      state.rapporti[t][chi] = {
        impronta: String(corpo.impronta || ''),
        punteggio: corpo.punteggio || null,
        hp: corpo.hp || null,
        finita: !!corpo.finita
      };
      var uno = state.rapporti[t][state.giocatori[0]];
      var due = state.rapporti[t][state.giocatori[1]];
      if (!uno || !due) continue;    // si aspetta l'altro

      if (uno.impronta !== due.impronta) {
        // Non si sa CHI ha torto — solo che i due non stanno giocando alla
        // stessa partita. Fermarla e' l'unica cosa onesta.
        state.finita = true;
        _aTutti(dispatcher, OP_DISACCORDO, { turno: corpo.turno });
        logger.warn('racconti diversi al turno %s: %s contro %s', t, uno.impronta, due.impronta);
        return { state: state };
      }

      state.concordato = { turno: t, impronta: uno.impronta, punteggio: uno.punteggio, hp: uno.hp };
      // v0.78.9 — e da quello stesso racconto si rifanno le caselle occupate.
      _occupateDaImpronta(state, uno.impronta);
      // v0.77.76 — i due client sono d'accordo: e' il momento buono per
      // chiedere al server se avrebbe detto la stessa cosa. Non decide niente:
      // se sbaglia, lo sapremo dal registro invece che da una partita persa.
      try { ombraConfronta(state, logger, t, uno.impronta); }
      catch (ec) { ombraRinuncia(state, logger, 'confronto: ' + ec.message); }

      if (uno.finita && due.finita) {
        _chiudiPartita(state, dispatcher, logger, nk, uno);
        return { state: state };
      }
      continue;
    }

    if (m.opCode === OP_SCELGO) {
      // Il server non sa QUALI bersagli fossero leciti — non simula le
      // abilita' — quindi non puo' verificare la scelta nel merito. Verifica
      // pero' l'unica cosa che sa: che a scegliere sia chi ha appena giocato
      // la carta. Il resto lo prende l'impronta, che dopo deve coincidere.
      //
      // v0.77.86 — QUI GUARDAVO `state.turno`, ED ERA SBAGLIATO.
      // Il turno passa all'altro nell'istante del piazzamento, mentre la
      // scelta arriva un momento DOPO: il controllo rifiutava quindi sempre
      // proprio chi doveva scegliere, e la finestra restava aperta finche' non
      // scadeva il tempo. Non si guarda di chi e' il turno adesso: si guarda
      // chi ha calato la carta che sta chiedendo.
      //
      // Non si azzera dopo una scelta: un'abilita' puo' aprire una finestra
      // dentro l'altra (lo sceriffo che usa subito l'abilita' rubata), e
      // sarebbero due scelte per una sola giocata.
      if (idx !== state.ultimaGiocataDi) {
        _aUno(dispatcher, state, chi, OP_RIFIUTO, { perche: 'non tocca a te scegliere' });
        continue;
      }
      var scelta = (corpo.cella === null || corpo.cella === undefined) ? null : String(corpo.cella);
      _aTutti(dispatcher, OP_SCELTA, { cella: scelta, di: idx + 1 });
      continue;
    }

    if (m.opCode !== OP_GIOCA) continue;
    if (!state.iniziata) { _aUno(dispatcher, state, chi, OP_RIFIUTO, { perche: 'la partita non e\' ancora cominciata' }); continue; }
    if (idx !== state.turno) { _aUno(dispatcher, state, chi, OP_RIFIUTO, { perche: 'non e\' il tuo turno' }); continue; }

    var carta = String(corpo.carta || '');
    var q = corpo.q, r = corpo.r;
    var k = q + ',' + r;

    var posto = state.mano[chi].indexOf(carta);
    if (posto === -1) { _aUno(dispatcher, state, chi, OP_RIFIUTO, { perche: 'quella carta non e\' nella tua mano' }); continue; }
    if (_caselle().indexOf(k) === -1) { _aUno(dispatcher, state, chi, OP_RIFIUTO, { perche: 'quella casella non esiste' }); continue; }
    if (state.buchi.indexOf(k) !== -1) { _aUno(dispatcher, state, chi, OP_RIFIUTO, { perche: 'quella casella e\' bloccata' }); continue; }
    if (state.occupate[k]) { _aUno(dispatcher, state, chi, OP_RIFIUTO, { perche: 'quella casella e\' gia\' occupata' }); continue; }

    state.mano[chi].splice(posto, 1);
    state.occupate[k] = { carta: carta, di: idx + 1 };
    state.turniGiocati[chi] = (state.turniGiocati[chi] || 0) + 1;
    // v0.77.86 — da adesso, se quella carta chiede un bersaglio, a rispondere
    // puo' essere solo lui (vedi OP_SCELGO).
    state.ultimaGiocataDi = idx;
    // v0.77.76 — e la stessa giocata la rifa' il server, per conto suo.
    // `try` attorno a tutto: l'ombra non deve poter rovinare una partita vera.
    try { ombraPrepara(ctx, nk, logger, state); ombraGiocata(state, logger, k, carta, idx + 1); }
    catch (eo) { ombraRinuncia(state, logger, 'giocata: ' + eo.message); }
    var pescata = _passaTurno(state, dispatcher, chi);

    _aTutti(dispatcher, OP_GIOCATA, {
      giocatore: idx + 1, carta: carta, q: q, r: r,
      turno: state.turno + 1, scadenza: state.scadenza,
      numeroTurno: state.numeroTurno, pubblico: _pubblico(state)
    });
    // La carta pescata la sa solo chi l'ha pescata.
    if (pescata) _aUno(dispatcher, state, chi, OP_AVVIO, { pescata: pescata, mano: state.mano[chi] });
  }

  // ── il tempo ────────────────────────────────────────────────────────────
  // Scaduto il turno con un po' di grazia (il client puo' aver mandato la
  // giocata all'ultimo istante e il messaggio essere ancora per strada), si
  // gioca d'ufficio: la prima carta della mano sulla prima casella libera.
  // Passare e basta bloccherebbe la partita fra due giocatori fermi.
  if (state.iniziata && Date.now() > state.scadenza + GRAZIA_MS) {
    var tocca = state.giocatori[state.turno];
    var mano = state.mano[tocca];
    var libera = null;
    var tutte = _caselle();
    for (var c = 0; c < tutte.length; c++) {
      if (state.buchi.indexOf(tutte[c]) === -1 && !state.occupate[tutte[c]]) { libera = tutte[c]; break; }
    }
    if (!mano.length || !libera) {
      state.finita = true;
      _aTutti(dispatcher, OP_FINE, { motivo: 'tabellone pieno' });
      return { state: state };
    }
    var scelta = mano.shift();
    var pezzi = libera.split(',');
    state.occupate[libera] = { carta: scelta, di: state.turno + 1 };
    // Anche un turno giocato d'ufficio e' un turno passato in partita: chi era
    // al tavolo c'e' stato. Non contarlo penalizzerebbe una connessione lenta.
    state.turniGiocati[tocca] = (state.turniGiocati[tocca] || 0) + 1;
    // Anche la giocata d'ufficio e' una giocata: se quella carta chiede un
    // bersaglio, la rinuncia deve poter arrivare da chi l'ha "giocata".
    state.ultimaGiocataDi = state.turno;
    var chiEra = tocca;
    var pescata2 = _passaTurno(state, dispatcher, chiEra);
    _aTutti(dispatcher, OP_GIOCATA, {
      giocatore: _indiceDi(state, chiEra) + 1, carta: scelta,
      q: parseInt(pezzi[0], 10), r: parseInt(pezzi[1], 10),
      turno: state.turno + 1, scadenza: state.scadenza,
      numeroTurno: state.numeroTurno, pubblico: _pubblico(state),
      dOfficio: true
    });
    if (pescata2) _aUno(dispatcher, state, chiEra, OP_AVVIO, { pescata: pescata2, mano: state.mano[chiEra] });
    return { state: state };
  }

  // Un battito ogni cinque secondi: il client corregge la sua barra invece
  // di lasciarla scivolare. Una scheda in secondo piano rallenta i timer del
  // browser, e senza questo il conto alla rovescia mentirebbe.
  if (state.iniziata && tick % 5 === 0) {
    _aTutti(dispatcher, OP_TEMPO, { scadenza: state.scadenza, turno: state.turno + 1, numeroTurno: state.numeroTurno });
  }

  return { state: state };
}

function partitaTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
  return { state: state };
}

function partitaSignal(ctx, logger, nk, dispatcher, tick, state, data) {
  return { state: state, data: data };
}

var partita = {
  matchInit: partitaInit,
  matchJoinAttempt: partitaJoinAttempt,
  matchJoin: partitaJoin,
  matchLeave: partitaLeave,
  matchLoop: partitaLoop,
  matchTerminate: partitaTerminate,
  matchSignal: partitaSignal,
};

// ── v0.77.55 — LA PARTITA FINISCE QUI, NON NEL CLIENT ─────────────────────
// Ci si arriva solo quando TUTTI E DUE hanno detto "finita" raccontando lo
// stesso tabellone. Da li' il vincitore lo decide il server: vince chi ha fatto
// piu' punti, e a parita' e' pari. Poi scrive esperienza e rank di tutti e due, con la stessa
// funzione che serve le partite contro l'IA.
//
// Un solo client che dicesse "ho vinto" non basta: senza il racconto uguale
// dell'altro, qui non ci si arriva nemmeno.
function _chiudiPartita(state, dispatcher, logger, nk, rapporto) {
  if (state.finita) return;
  state.finita = true;

  // v0.77.76 — il consuntivo dell'ombra. E' la riga che dira' quando il server
  // e' pronto a fare l'arbitro davvero: quando per un po' di partite di fila
  // dira' "0 divergenze".
  try {
    if (state.ombra && state.ombra.confronti) {
      logger.info('ombra: %d confronti, %d divergenze%s',
        state.ombra.confronti, state.ombra.divergenze,
        state.ombra.primaDivergenza ? (' (prima al turno ' + state.ombra.primaDivergenza.turno + ')') : '');
    } else if (state.ombra && !state.ombra.pronta) {
      logger.info('ombra: spenta durante questa partita, nessun confronto');
    }
  } catch (eo) { /* un consuntivo non deve poter rompere la chiusura */ }

  var hp = rapporto.hp || {};
  var d1 = (typeof hp['1'] === 'number') ? hp['1'] : 0;
  var d2 = (typeof hp['2'] === 'number') ? hp['2'] : 0;
  var pari = d1 === d2;
  // Vince chi ha fatto PIU' punti. Il campo si chiama 'hp' per ragioni
  // storiche — una volta erano danni subiti, e vinceva chi ne aveva meno — ma
  // dalla v0.77.0 sono i PUNTI FATTI e il verso e' rovesciato. Scritto al
  // contrario, il server avrebbe premiato il perdente a ogni partita.
  var vincitore = pari ? 0 : (d1 > d2 ? 1 : 2);

  for (var i = 0; i < state.giocatori.length; i++) {
    var u = state.giocatori[i];
    var suo = (i + 1) === vincitore;
    var esito;
    try {
      // controIA = false: questa e' una partita fra persone, e muove il rank.
      esito = applicaEsito(nk, u, suo, pari, false, state.turniGiocati[u], 'finita');
    } catch (e) {
      logger.error('esito non scritto per %s: %s', u, String(e));
      continue;
    }
    esito.vinta = suo;
    esito.pari = pari;
    esito.punteggio = rapporto.punteggio || null;
    _aUno(dispatcher, state, u, OP_ESITO, esito);
  }
  _aTutti(dispatcher, OP_FINE, { motivo: 'finita', vincitore: vincitore, pari: pari });
  logger.info('partita finita: punti %d contro %d, vincitore %d', d1, d2, vincitore);
}

// ── dal matchmaker alla partita ───────────────────────────────────────────
// Accoppiati due giocatori, si crea la partita e Nakama consegna il suo id ai
// due client dentro allo stesso messaggio che gia' ricevevano. Nessun giro in
// piu': l'accoppiamento e la partita sono lo stesso momento.
function accoppiati(ctx, logger, nk, matches) {
  var giocatori = [];
  var info = {};
  for (var i = 0; i < matches.length; i++) {
    var u = matches[i].presence.userId;
    giocatori.push(u);
    var sp = matches[i].properties || {};
    // v0.77.87 — IL LIVELLO LO DICE IL SERVER, NON IL CLIENT.
    // Nome, avatar e rank arrivano dalle proprieta' del biglietto, cioe' da
    // quel che il client DICHIARA: se anche mentisse cambierebbe solo cio' che
    // si legge accanto al ritratto. Il livello no — decide i valori sui lati
    // delle carte, cioe' chi conquista chi. Si legge quindi dal possesso, che
    // e' l'unica fonte che il giocatore non tocca.
    var pos = null;
    try { pos = leggiPossesso(nk, u); } catch (e) { pos = null; }
    info[u] = {
      nome: String(sp.nome || ''),
      avatar: String(sp.avatar || ''),
      rank: (typeof sp.rank === 'number') ? sp.rank : null,
      livello: (pos && typeof pos.livello === 'number') ? pos.livello : LIVELLO_NORMALE
    };
  }
  if (giocatori.length !== 2) {
    logger.warn('accoppiamento con %d giocatori: non e\' una partita', giocatori.length);
    return '';
  }
  return nk.matchCreate('hextale', {
    giocatori: JSON.stringify(giocatori),
    info: JSON.stringify(info)
  });
}

// ─── MOTORE DELLE ABILITA (iniettato, non modificare qui) ───────────────
// ══════════════════════════════════════════════════════════════════════════
// IL MOTORE DELLE ABILITA' — scritto una volta, eseguito in due posti
// ══════════════════════════════════════════════════════════════════════════
// Legge l'abilita' STRUTTURATA che il parser ha messo nel catalogo
// (vedi server/importazione/abilita-parser.js) e risponde alle domande che il
// gioco fa: questa carta si puo' conquistare? con che valore attacca? questo
// lato e' protetto?
//
// PERCHE' UN FILE SOLO. Le stesse regole devono dare la stessa risposta sul
// computer di chi gioca e sul server, altrimenti i due vedono due partite
// diverse — ed e' esattamente cio' che l'impronta della v0.77.55 sorprende e
// punisce fermando la partita. Due copie dello stesso codice divergono: questa
// viene INIETTATA in tutti e due (vedi inietta-motore.js), e chi la modifica
// la modifica per entrambi.
//
// PERCHE' ES5. Il runtime JavaScript di Nakama e' goja: niente `let`, niente
// funzioni a freccia, niente destrutturazione. Il prezzo e' qualche `var` di
// troppo; il guadagno e' che lo stesso file gira in tutti e due i posti senza
// una compilazione in mezzo.

// Un `var` al posto di un assegnamento al globale: cosi' lo stesso testo vale
// come variabile di modulo dentro a index.js (goja), come globale dentro allo
// script del gioco, e come esportazione sotto Node. Tre posti, un involucro.
var ABILITA_MOTORE = (function () {
  'use strict';

  var SEI_LATI = ['NW', 'NE', 'E', 'SE', 'SW', 'W'];

  // L'abilita' di una carta, se ce l'ha e se e' sbloccata dal livello.
  // Il livello di sblocco e' la stessa regola di prima: sotto quel livello
  // l'abilita' si vede sulla carta ma non agisce.
  function abilitaDi(carta) {
    if (!carta) return null;
    if (carta.abilityLocked) return null;
    var a = carta.abilita;
    if (!a || a.unica) return null;
    return a;
  }

  // La regola di una carta, per nome. Torna l'oggetto regola o null.
  // Guarda tutti e due i posti: una carta puo' avere una regola e un effetto,
  // o due regole.
  function regolaDi(carta, nome) {
    var a = abilitaDi(carta);
    if (!a) return null;
    if (a.regola && a.regola.nome === nome) return a.regola;
    if (a.regola2 && a.regola2.nome === nome) return a.regola2;
    return null;
  }

  function haTratto(carta, elenco) {
    if (!carta || !elenco || !elenco.length) return false;
    var suoi = carta.traitNames || carta.traits || [];
    var i, j;
    for (i = 0; i < elenco.length; i++) {
      for (j = 0; j < suoi.length; j++) {
        if (String(suoi[j]).toLowerCase() === String(elenco[i]).toLowerCase()) return true;
      }
    }
    return false;
  }

  // Il valore piu' alto e piu' basso fra i sei lati.
  function estremo(valori, alto) {
    var v = null, i, x;
    for (i = 0; i < SEI_LATI.length; i++) {
      x = (valori && valori[SEI_LATI[i]]) || 0;
      if (v === null) v = x;
      else if (alto ? x > v : x < v) v = x;
    }
    return v === null ? 0 : v;
  }

  // ── LA CONDIZIONE ───────────────────────────────────────────────────────
  // `scena` porta chi sono i protagonisti del momento: attaccante, difensore,
  // e il tabellone. Una condizione che parla di qualcuno che in quel momento
  // non c'e' e' falsa, non un errore: "se chi attacca e' nobile" non vale
  // niente quando nessuno sta attaccando.
  function condizioneVera(cond, carta, scena) {
    if (!cond) return true;
    scena = scena || {};
    var sog = cond.soggetto, chi = null;
    if (sog === 'self') chi = carta;
    else if (sog === 'attacker') chi = scena.attaccante;
    else if (sog === 'defender') chi = scena.difensore;
    else if (sog === 'target') chi = scena.bersaglio;
    else if (sog === 'adjacent') chi = null;      // si guarda l'elenco, sotto
    var v = cond.valore || {};

    if (cond.test === 'has_trait') {
      if (sog === 'adjacent') {
        var vic = scena.adiacenti || [];
        for (var i = 0; i < vic.length; i++) if (haTratto(vic[i], v.tratti)) return true;
        return false;
      }
      if (sog === 'board') {
        var tut = scena.inCampo || [];
        for (var j = 0; j < tut.length; j++) if (haTratto(tut[j], v.tratti)) return true;
        return false;
      }
      return haTratto(chi, v.tratti);
    }
    if (cond.test === 'is_character') {
      if (!chi) return false;
      return String(chi.numeroFoglio || chi.idFoglio || '') === String(v.carta);
    }
    if (cond.test === 'power_is') {
      if (!chi) return false;
      var p = scena.valoreAttacco;
      if (typeof p !== 'number') return false;
      var dispari = (p % 2) !== 0;
      return v.parita === 'odd' ? dispari : !dispari;
    }
    if (cond.test === 'power_diff_at_least') {
      if (typeof scena.differenza !== 'number') return false;
      return scena.differenza >= v.numero;
    }
    if (cond.test === 'on_edge') return !!scena.sulBordo;
    if (cond.test === 'did_not_conquer') return scena.haConquistato === false;
    // ── v0.77.67 — LA MONETA LA TIRA IL SERVER ─────────────────────────────
    // Prima questo rispondeva sempre "si", e il caso lo tirava chi eseguiva —
    // con Math.random, cioe' due volte e in modo diverso sui due client: uno
    // vedeva la conquista annullata e l'altro no.
    // Adesso il numero esce dal SEME della partita, che e' l'id assegnato dal
    // server: la moneta la tira lui una volta sola, e i due client leggono lo
    // stesso risultato senza doverselo chiedere a vicenda. Fuori da una
    // partita in rete (contro l'IA) il seme e' quello locale, e va bene lo
    // stesso: li' non c'e' nessuno con cui essere d'accordo.
    if (cond.test === 'chance') {
      var soglia = (v && typeof v.numero === 'number') ? v.numero : 50;
      var chiave = String((chi && (chi.id || chi.name)) || '?') + '|'
        + String((scena && scena.seme) || '') + '|' + String((scena && scena.turno) || 0)
        + '|' + String(cond.soggetto || '');
      return (_semeDi(chiave) % 100) < soglia;
    }
    if (cond.test === 'free_sides_at_least') {
      return (scena.latiLiberi || 0) >= v.numero;
    }
    if (cond.test === 'count_at_least') {
      return (scena.quanti || 0) >= v.numero;
    }
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LE DOMANDE CHE IL GIOCO FA
  // ══════════════════════════════════════════════════════════════════════════

  // Non si tocca in nessun modo: ne' conquistata, ne' spostata, ne' distrutta.
  function intoccabile(carta) {
    return !!regolaDi(carta, 'invincible');
  }

  // Quel lato non cade, qualunque numero gli si punti contro.
  function latoProtetto(carta, lato, valori) {
    var r = regolaDi(carta, 'side_protected');
    if (!r) return false;
    var v = String(r.valore || '').toLowerCase();
    var vals = valori || carta.values || {};
    if (v === 'highest') return (vals[lato] || 0) === estremo(vals, true);
    if (v === 'lowest') return (vals[lato] || 0) === estremo(vals, false);
    return false;
  }

  // Chi puo' conquistare questa carta. La condizione parla dell'ATTACCANTE, ed
  // e' l'unica regola che guarda chi agisce invece di chi subisce.
  function conquistabileDa(difensore, attaccante, scena) {
    var solo = regolaDi(difensore, 'conquerable_only_if');
    if (solo) {
      var a = abilitaDi(difensore);
      var cond = (a.regola && a.regola.nome === 'conquerable_only_if') ? a.se : a.se2;
      if (!condizioneVera(cond, difensore, _conScena(scena, attaccante, difensore))) return false;
    }
    var mai = regolaDi(difensore, 'not_conquerable_if');
    if (mai) {
      var a2 = abilitaDi(difensore);
      var cond2 = (a2.regola && a2.regola.nome === 'not_conquerable_if') ? a2.se : a2.se2;
      if (condizioneVera(cond2, difensore, _conScena(scena, attaccante, difensore))) return false;
    }
    return true;
  }

  function _conScena(scena, attaccante, difensore) {
    var s = {};
    for (var k in (scena || {})) if (Object.prototype.hasOwnProperty.call(scena, k)) s[k] = scena[k];
    s.attaccante = attaccante;
    s.difensore = difensore;
    return s;
  }

  // Con che valore attacca: il lato che tocca, o il piu' alto se una regola lo
  // dice (Merlin).
  function valoreDiAttacco(carta, valori, lato) {
    var r = regolaDi(carta, 'attacks_with');
    var vals = valori || carta.values || {};
    if (r) {
      var v = String(r.valore || '').toLowerCase();
      if (v === 'highest') return estremo(vals, true);
      if (v === 'lowest') return estremo(vals, false);
    }
    return vals[lato] || 0;
  }

  // Vince il confronto? Di norma serve un valore piu' alto; una regola puo'
  // accontentarsi del pari (Shere Khan).
  function vince(attaccante, valoreAttacco, valoreDifesa) {
    var r = regolaDi(attaccante, 'conquers_when');
    if (r && String(r.valore || '').toLowerCase() === 'equal_or_higher') {
      return valoreAttacco >= valoreDifesa;
    }
    return valoreAttacco > valoreDifesa;
  }

  // Si puo' calare su una casella bloccata? (Peter Pan)
  function giocabileSuBloccata(carta) {
    var r = regolaDi(carta, 'playable_on');
    return !!(r && String(r.valore || '').toLowerCase() === 'blocked');
  }

  // Le carte adiacenti a chi ha questa regola non subiscono effetti. (Bagheera)
  function rendeImmuniIVicini(carta) {
    var r = regolaDi(carta, 'immune');
    return !!(r && r.bersaglio === 'adjacent');
  }

  // ══════════════════════════════════════════════════════════════════════
  // GLI EFFETTI CONTINUI
  // ══════════════════════════════════════════════════════════════════════
  // Le sinergie: "+1 ALL per ogni Small in campo", "+2 ALL ai Wild adiacenti".
  // Non si APPLICANO e basta: si RICALCOLANO dallo stato del tabellone ogni
  // volta che il tabellone cambia.
  //
  // PERCHE' RICALCOLARE invece di sommare e sottrarre. Il sistema vecchio
  // teneva un'istantanea dei valori per ogni sinergia (hoorayBaseValues,
  // mischiefBaseValues, nightmareBaseValues, balooBaseValues) e ogni funzione
  // che toccasse un valore doveva ricordarsi di spostare TUTTE le istantanee,
  // o quella sinergia avrebbe riportato la carta indietro al ridisegno dopo.
  // Bastava aggiungere una sinergia e dimenticare una riga. Qui non c'e'
  // niente da ricordare: si parte dai valori base e si risomma tutto.

  // Quali lati tocca un effetto, dato il suo ambito.
  // RAND merita una parola: un lato "a caso" che cambia a ogni ricalcolo
  // sfarfallerebbe, e in rete i due giocatori vedrebbero lati diversi. Si
  // sceglie quindi in modo RIPETIBILE, dal nome della carta e da un seme che
  // vale per tutta la partita: casuale da fuori, identico sui due schermi.
  function _semeDi(testo) {
    var h = 2166136261, i;
    for (i = 0; i < testo.length; i++) { h ^= testo.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h;
  }
  // ── v0.77.91 — L'UNITA' DI UNA CARTA E' IL GRUPPO, NON IL LATO ──────────
  // Una carta di Hextale non ha sei numeri: ha dei GRUPPI di lati, e ogni
  // gruppo porta un numero solo (vedi gruppiDiCarta nel client, e il commento
  // sopra di lei: "chi disegna o ragiona su una carta deve chiamare
  // gruppiDiCarta"). Questa funzione era l'unico posto del gioco che quella
  // regola non la rispettava: per RAND pescava un LATO fra sei, e per
  // HIGHEST/LOWEST ne restituiva uno solo.
  //
  // COSA SUCCEDEVA. Il Genio dice "buff ally in_hand power all RAND 3", e il
  // motore faceva la cosa giusta su chi colpire — tutte le carte in mano — ma
  // poi metteva il +3 su MEZZO gruppo. Il numero che si vede e' quello del
  // primo lato del gruppo, quindi se il lato pescato non era il primo il bonus
  // spariva dalla vista: da fuori sembrava che il Genio buffasse due o tre
  // carte a caso invece di tutte. E non era solo un difetto di disegno — il
  // lato gonfiato combatteva davvero con tre punti in piu', invisibili.
  //
  // Adesso il sorteggio e' fra i GRUPPI, e si colpisce il gruppo intero.
  // ATTENZIONE, E' ANCHE UNA QUESTIONE DI FORZA: un gruppo puo' valere due o
  // tre lati, quindi RAND adesso da' piu' di prima. E' la conseguenza di
  // rispettare il modello della carta, non una scelta di bilanciamento — se il
  // Genio cosi' diventa troppo generoso, il numero si abbassa nel foglio.
  function _gruppiDi(valori, carta) {
    // Se la carta dichiara i propri gruppi, sono quelli e non si discute:
    // due gruppi possono mostrare lo stesso numero e restare distinti.
    var g = carta && carta.groupSides, i;
    if (g && g.length) {
      var copia = [];
      for (i = 0; i < g.length; i++) copia.push(g[i].slice());
      return copia;
    }
    // Senza, si ricavano come fa getGroups nel client: fasce contigue di lati
    // con lo stesso numero, e la fascia finale che si ricongiunge alla prima.
    var out = [], j = 0;
    while (j < SEI_LATI.length) {
      var v = valori[SEI_LATI[j]], k = j;
      while (k < SEI_LATI.length && valori[SEI_LATI[k]] === v) k++;
      out.push(SEI_LATI.slice(j, k));
      j = k;
    }
    if (out.length > 1 && valori[out[out.length - 1][0]] === valori[out[0][0]]) {
      var ultimo = out.pop();
      out[0] = ultimo.concat(out[0]);
    }
    return out;
  }
  function latiColpiti(ambito, valori, carta, seme) {
    if (ambito === 'ALL' || !ambito) return SEI_LATI.slice();
    var gruppi = _gruppiDi(valori || {}, carta), i;
    if (!gruppi.length) return [];
    if (ambito === 'HIGHEST' || ambito === 'LOWEST') {
      var cerca = estremo(valori, ambito === 'HIGHEST');
      // Il primo gruppo che porta quel numero, tutto intero.
      for (i = 0; i < gruppi.length; i++) {
        if ((valori[gruppi[i][0]] || 0) === cerca) return gruppi[i].slice();
      }
      return [];
    }
    if (ambito === 'RAND' || ambito === 'ONE') {
      var chiave = String((carta && (carta.id || carta.name)) || '?') + '|' + String(seme || '');
      return gruppi[_semeDi(chiave) % gruppi.length].slice();
    }
    return SEI_LATI.slice();
  }

  function _stessoPadrone(a, b) {
    return a && b && a.owner !== undefined && b.owner !== undefined && a.owner === b.owner;
  }

  // ── v0.78.18 — DUE CARTE SONO LA STESSA SE HANNO LO STESSO ID ────────────
  // Qui si confrontava per IDENTITA', e va bene finche' gli oggetti sono quelli
  // veri. Ma il gioco fa delle COPIE delle carte — l'anteprima clona il campo,
  // la scheda a schermo intero ricostruisce la carta, la conquista ne passa una
  // con l'owner cambiato — e a una copia il confronto rispondeva "sono due
  // carte diverse".
  // La conseguenza era che una carta si buffava DA SOLA: Little John, appena
  // calato e senza nessuno intorno, si vedeva scritto "+1 ALL from Little
  // John", perche' la copia di se stesso non risultava se stesso e passava per
  // un alleato qualsiasi.
  // Un id e' unico dentro a una partita: e' la stessa carta anche quando non e'
  // lo stesso oggetto.
  function stessaCarta(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    return !!a.id && a.id === b.id;
  }
  // L'effetto della FONTE colpisce il BERSAGLIO?
  function colpisce(fonte, eff, bersaglio, scena) {
    var chi = eff.chi, dove = eff.dove;
    if (chi === 'self') return stessaCarta(bersaglio, fonte);
    if (!bersaglio) return false;
    if (chi === 'ally' && !_stessoPadrone(fonte, bersaglio)) return false;
    if (chi === 'opponent' && _stessoPadrone(fonte, bersaglio)) return false;
    // "any" non guarda il padrone.
    if (dove === 'adjacent') {
      var vic = (scena.vicini && scena.vicini(fonte)) || [];
      for (var i = 0; i < vic.length; i++) if (stessaCarta(vic[i], bersaglio)) return true;
      return false;
    }
    // ── v0.78.15 — "board" E' UN LUOGO, NON "CHIUNQUE" ────────────────────
    // Qui bastava che il bersaglio non fosse la fonte, e non si guardava
    // affatto DOVE si trovasse. Little John dice "buff ally board power": in
    // campo. Le carte in MANO venivano buffate lo stesso, perche' anche loro
    // non sono la fonte — il foglio diceva una cosa e il motore ne faceva
    // un'altra, senza che nessuna delle due parti potesse accorgersene.
    // Adesso il bersaglio deve essere in campo davvero.
    // Se la scena non sa dire chi c'e' in campo si torna al comportamento di
    // prima: meglio un effetto in piu' che spegnere ogni sinergia del gioco
    // per una scena costruita male.
    if (dove === 'board') {
      // ── v0.78.16 — SI CHIEDE "DOVE SEI", NON "SEI NELL'ELENCO" ───────────
      // La v0.78.15 guardava `scena.inCampo`, e sembrava la stessa domanda.
      // Non lo e': chi COSTRUISCE una scena puo' mettere in `inCampo' solo la
      // carta che sta esaminando — lo fa il riquadro dei buff, che per sapere
      // quanto dia OGNI singola fonte ne mette in campo una alla volta (vedi
      // _modificatoriDalMotore). In quella scena il bersaglio non c'e', e la
      // v0.78.15 rispondeva "non e' in campo": il riquadro ha smesso di dire
      // CHI stesse buffando, e restava il numero da solo.
      // `cellaDi` risponde alla domanda giusta — su quale casella sta questa
      // carta — e non dipende da chi il chiamante abbia messo nell'elenco dei
      // contributori. Le due cose erano confuse, ed erano due.
      if (scena && typeof scena.cellaDi === 'function') {
        if (!scena.cellaDi(bersaglio)) return false;
      } else if (scena && scena.inCampo && scena.inCampo.length !== undefined) {
        var dentro = false, k;
        for (k = 0; k < scena.inCampo.length; k++) if (scena.inCampo[k] === bersaglio) { dentro = true; break; }
        if (!dentro) return false;
      }
      return !stessaCarta(bersaglio, fonte) || chi === 'self';
    }
    if (!dove) return !stessaCarta(bersaglio, fonte) || chi === 'self';
    return false;
  }

  // Quanto vale l'effetto: il numero scritto, moltiplicato per il conteggio
  // quando la colonna Per dice di scalare.
  function quantita(fonte, eff, cond, scena) {
    var base = 0;
    if (eff.quanto && typeof eff.quanto.numero === 'number') base = eff.quanto.numero;
    else if (eff.quanto && typeof eff.quanto.da === 'number') base = eff.quanto.da;
    if (!eff.per) return base;

    var tratti = (cond && cond.valore && cond.valore.tratti) || [];
    var quanti = 0, i;
    if (eff.per === 'board_trait') {
      var tutte = scena.inCampo || [];
      for (i = 0; i < tutte.length; i++) {
        if (tutte[i] === fonte) continue;              // "ogni ALTRO": mai se stessa
        if (haTratto(tutte[i], tratti)) quanti++;
      }
    } else if (eff.per === 'adjacent_trait') {
      var vic = (scena.vicini && scena.vicini(fonte)) || [];
      for (i = 0; i < vic.length; i++) if (haTratto(vic[i], tratti)) quanti++;
    } else if (eff.per === 'hand_trait') {
      var mano = scena.inMano || [];
      for (i = 0; i < mano.length; i++) if (haTratto(mano[i], tratti)) quanti++;
    } else if (eff.per === 'free_side') {
      quanti = (scena.latiLiberi && scena.latiLiberi(fonte)) || 0;
    } else if (eff.per === 'power_diff') {
      quanti = (typeof scena.differenza === 'number') ? scena.differenza : 0;
    }
    return base * quanti;
  }

  // ── LA FINESTRA TEMPORALE ───────────────────────────────────────────────
  // "dal turno 4" (Strigoi), "solo nei primi due" (Captain Hook).
  //
  // SE IL TURNO NON SI SA, LA FINESTRA E' CHIUSA. E' la scelta scomoda ed e'
  // voluta: chi dimentica di passare il turno vede l'abilita' non fare niente
  // — un guasto che si nota — invece di vedere una carta silenziosamente piu'
  // forte del dovuto. Questo gioco ha gia' pagato caro il guasto silenzioso.
  function finestraAperta(a, scena) {
    var f = a && a.finestra;
    if (!f || !f.tipo || f.tipo === 'always') return true;
    var t = scena ? scena.turno : undefined;
    if (f.tipo === 'from_turn') return (typeof t === 'number') && t >= f.valore;
    if (f.tipo === 'until_turn') return (typeof t === 'number') && t <= f.valore;
    // for_turns e next_only riguardano effetti che scattano una volta, non le
    // sinergie continue: qui non hanno niente da chiudere.
    return true;
  }

  // ── QUANTE VOLTE (dalla v0.77.63) ────────────────────────────────────────
  // 'Frequency' diceva una cosa che nessuno leggeva: il motore faceva scattare
  // l'abilita' a ogni evento buono, e "once_per_game" restava una promessa
  // scritta sul foglio e mai mantenuta. Adesso la conta la tiene il motore, in
  // un campo privato della carta, e NON il chiamante: due chiamanti — client e
  // server — che devono ricordarsi di segnare sono due occasioni di
  // dimenticare, e la dimenticanza sarebbe silenziosa proprio dove costa di
  // piu' (una carta che ripete un colpo unico per tutta la partita).
  //
  // La memoria sta sulla CARTA e non sull'abilita' perche' "una volta per
  // partita" vale per quell'esemplare li': due copie della stessa carta hanno
  // ciascuna il suo colpo.
  function scattoConsentito(fonte, evento, scena) {
    var a = abilitaDi(fonte);
    if (!fonte || !a) return true;
    var f = a.frequenza || 'every_time';
    if (f === 'every_time') return true;
    var m = fonte._scatti && fonte._scatti[evento];
    if (!m) return true;
    if (f === 'once_per_game') return false;
    if (f === 'once_per_turn') {
      var t = scena ? scena.turno : undefined;
      // Turno ignoto: si tiene chiusa, come per la finestra temporale. Meglio
      // un'abilita' che non parte — e si nota — di una che si ripete di
      // nascosto.
      return (typeof t === 'number') && m.turno !== t;
    }
    return true;
  }

  function segnaScatto(fonte, evento, scena) {
    if (!fonte) return;
    if (!fonte._scatti) fonte._scatti = {};
    var p = fonte._scatti[evento] || { volte: 0, turno: null };
    p.volte++;
    if (scena && typeof scena.turno === 'number') p.turno = scena.turno;
    fonte._scatti[evento] = p;
  }

  // Lo scarto totale che le sinergie in campo fanno su UNA carta.
  // Torna un oggetto lato -> numero (anche negativo).
  function deltaContinuo(bersaglio, scena) {
    scena = scena || {};
    var d = {}, i;
    for (i = 0; i < SEI_LATI.length; i++) d[SEI_LATI[i]] = 0;
    var fonti = scena.inCampo || [];
    for (i = 0; i < fonti.length; i++) {
      var fonte = fonti[i];
      var a = abilitaDi(fonte);
      if (!a || a.trigger !== 'while_on_board') continue;
      if (!finestraAperta(a, scena)) continue;
      _unEffetto(fonte, a.effetto, a.se, bersaglio, scena, d);
      if (a.legame === 'and' || a.legame === 'instead') {
        // "instead" e' un'eccezione: se la seconda condizione vale, la prima
        // non si applica a QUEL bersaglio. Si guarda percio' la seconda prima.
        var vale2 = a.effetto2 && condizioneVera(a.se2, fonte, _scenaPer(fonte, bersaglio, scena));
        if (a.legame === 'instead' && vale2) {
          // si toglie quel che ha messo la prima e si mette la seconda
          _unEffetto(fonte, a.effetto, a.se, bersaglio, scena, d, -1);
        }
        _unEffetto(fonte, a.effetto2, a.se2, bersaglio, scena, d);
      }
    }
    return d;
  }

  function _scenaPer(fonte, bersaglio, scena) {
    var s = {};
    for (var k in scena) if (Object.prototype.hasOwnProperty.call(scena, k)) s[k] = scena[k];
    s.bersaglio = bersaglio;
    s.adiacenti = (scena.vicini && scena.vicini(fonte)) || [];
    return s;
  }

  function _unEffetto(fonte, eff, cond, bersaglio, scena, d, segno) {
    if (!eff) return;
    if (eff.durata !== 'while_true') return;
    if (eff.azione !== 'buff' && eff.azione !== 'debuff') return;
    if (eff.cosa && eff.cosa !== 'power') return;
    if (!colpisce(fonte, eff, bersaglio, scena)) return;
    if (!condizioneVera(cond, fonte, _scenaPer(fonte, bersaglio, scena))) return;
    var q = quantita(fonte, eff, cond, scena);
    if (!q) return;
    if (eff.azione === 'debuff') q = -q;
    if (segno === -1) q = -q;
    var lati = latiColpiti(eff.ambito, bersaglio.values || {}, bersaglio, scena.seme);
    for (var i = 0; i < lati.length; i++) d[lati[i]] += q;
  }

  // ══════════════════════════════════════════════════════════════════════
  // GLI EFFETTI CHE SCATTANO
  // ══════════════════════════════════════════════════════════════════════
  // Una sinergia si RICALCOLA; un effetto a scatto SUCCEDE, una volta, e
  // lascia il segno. Due modelli diversi, e vanno tenuti separati: chi li
  // confonde finisce per riapplicare un furto a ogni ridisegno.
  //
  // QUESTA FUNZIONE NON CAMBIA NIENTE. Torna un ELENCO DI CAMBIAMENTI, e chi
  // la chiama decide cosa farne: il gioco li applica passando da modificaValori
  // (che si porta dietro il lampo verde o rosso e le animazioni), il server li
  // applica al proprio stato senza mostrare niente. La decisione e' una sola e
  // vale per tutti e due — che e' l'unico modo perche' i due tabelloni
  // restino d'accordo.
  //
  // Ogni cambiamento e': { carta, lati:[...], delta:n }  oppure
  //                      { carta, lati:[...], valore:n } per un "set".

  // Chi puo' essere colpito da un effetto a scatto, dato il bersaglio scritto.
  function candidati(fonte, eff, scena) {
    scena = scena || {};
    var chi = eff.chi, dove = eff.dove, out = [], i;

    // I bersagli del momento non si cercano: sono chi sta agendo adesso.
    if (chi === 'self') return [fonte];
    if (chi === 'attacker') return scena.attaccante ? [scena.attaccante] : [];
    if (chi === 'attacked') return scena.attaccato ? [scena.attaccato] : [];

    var pesca = [];
    if (dove === 'adjacent') pesca = (scena.vicini && scena.vicini(fonte)) || [];
    else if (dove === 'in_hand') {
      // Tutte e due le mani, e poi il filtro ally/opponent qui sotto sceglie.
      // Prima si guardava solo la mano di chi agisce: bastava per un dono ai
      // propri (Il Genio), ma un effetto rivolto all'avversario IN MANO non
      // trovava mai nessuno e non faceva niente in silenzio.
      pesca = scena.inMano || (scena.manoDi && scena.manoDi(fonte)) || [];
    }
    else if (dove === 'drawn') return scena.pescata ? [scena.pescata] : [];
    else pesca = scena.inCampo || [];

    for (i = 0; i < pesca.length; i++) {
      var c = pesca[i];
      if (c === fonte && chi !== 'any') continue;
      if (chi === 'ally' && !_stessoPadrone(fonte, c)) continue;
      if (chi === 'opponent' && _stessoPadrone(fonte, c)) continue;
      out.push(c);
    }
    return out;
  }

  // Fra i candidati, quali si prendono davvero.
  function scelti(lista, eff, scena) {
    var q = eff.quale;
    if (!lista.length) return [];
    if (!q || q === 'all') return lista;
    if (q === 'single') {
      // Uno solo, e non importa quale. Se chi chiama ha gia' una scelta in
      // mano (il giocatore ha indicato) si usa quella; senza, il primo.
      if (scena && scena.scelta && lista.indexOf(scena.scelta) !== -1) return [scena.scelta];
      return [lista[0]];
    }
    if (q === 'random') {
      // Ripetibile. In rete i due client devono pescare la STESSA carta, o si
      // troverebbero d'accordo solo per caso: il numero esce dal seme della
      // partita, come il lato "a caso" di RAND. Math.random resta l'ultima
      // spiaggia, per chi chiama senza seme.
      if (scena && scena.seme) {
        return [lista[_semeDi(String(scena.seme) + '|' + String(scena.turno || 0) + '|' + lista.length) % lista.length]];
      }
      var i = Math.floor((scena && typeof scena.sorte === 'number' ? scena.sorte : Math.random()) * lista.length);
      return [lista[Math.min(i, lista.length - 1)]];
    }
    if (q === 'highest' || q === 'lowest') {
      var meglio = lista[0], j;
      for (j = 1; j < lista.length; j++) {
        var a = estremo((lista[j].valoriBase || lista[j].values) || {}, true);
        var b = estremo((meglio.valoriBase || meglio.values) || {}, true);
        if (q === 'highest' ? a > b : a < b) meglio = lista[j];
      }
      return [meglio];
    }
    return lista;
  }

  // Un effetto a scatto, tradotto in cambiamenti.
  // Le azioni che il motore DESCRIVE invece di calcolare. Stanno in un elenco
  // e non sparse in una catena di if perche' chi aggiunge un'azione al
  // vocabolario deve trovarne una sola, di lista.
  // `buff`, `debuff` e `set` non ci sono: quelli il motore li calcola per
  // intero, perche' il risultato e' un numero e un numero non ha bisogno di
  // nessuno che lo interpreti.
  var AZIONI_DESCRITTE = {
    freeze: true, rotate: true, shuffle: true, hide: true, protect: true,
    flip: true, cancel: true, destroy: true, move: true, swap: true,
    transform: true, summon: true, copy: true, draw: true, discard: true
  };

  function _cambiamentiDi(fonte, eff, cond, scena, fuori, finestra) {
    if (!eff) return;
    var az = eff.azione;

    // ── v0.77.66 — QUEL CHE NON E' UN NUMERO ───────────────────────────────
    // Congelare, ruotare, mescolare, trasformare, spostare, distruggere,
    // rubare: nessuna di queste cambia un valore, e per questo il motore le
    // ignorava. Ma la parte che il motore fa bene e' sempre la stessa — SE
    // scatta, su CHI, e QUANTO — ed e' indipendente dal fatto che il risultato
    // sia un numero o una carta che sparisce.
    //
    // Quindi da qui esce un cambiamento DESCRITTO, e chi chiama lo esegue col
    // codice che ha gia': animazioni, suoni e mirino restano dove sono. Il
    // motore decide CHI, il client fa COME. E' lo stesso patto di Alice.
    //
    // QUANDO IL FOGLIO DICE `Player selection = yes` non si sceglie: si
    // consegna l'elenco dei candidati e si lascia che sia il giocatore a
    // indicare. Prendere il primo della lista vorrebbe dire giocare al posto
    // suo.
    // (Prima questo si scriveva "selected" nella colonna Which, che pero' e'
    // un filtro: cosi' non si poteva dire "un tassello BLOCCATO, e lo sceglie
    // il giocatore" — le due cose litigavano per la stessa cella.)
    if (AZIONI_DESCRITTE[az]) {
      if (!condizioneVera(cond, fonte, scena)) return;
      // Un TASSELLO non e' una carta: chi lo cerca sono le caselle, e quelle
      // il motore non le ha. Per queste (e per l'evocazione, che di bersagli
      // non ne ha affatto) esce solo la descrizione, e le caselle le trova chi
      // esegue — che il tabellone ce l'ha davanti.
      var senzaBersagli = (eff.cosa === 'tile' || az === 'summon');
      var possibili = senzaBersagli ? [] : candidati(fonte, eff, scena);
      if (!possibili.length && !senzaBersagli) return;
      var pezzo = {
        azione: az,
        cosa: eff.cosa || null,
        fonte: fonte,
        quanto: eff.quanto || null,
        ambito: eff.ambito || null,
        dove: eff.dove || null,
        quale: eff.quale || null,
        scelta: !!eff.scelta
      };
      // Per quanto dura lo dice la FINESTRA (`for_turns 2`), non la durata:
      // e' li' che il foglio scrive "per due turni".
      if (finestra && finestra.tipo === 'for_turns' && typeof finestra.valore === 'number') pezzo.turni = finestra.valore;
      if (eff.scelta) {
        pezzo.candidati = possibili;                 // chiedilo al giocatore
        fuori.push(pezzo);
        return;
      }
      var presi = scelti(possibili, eff, scena);
      for (var k = 0; k < presi.length; k++) {
        var uno = {}; for (var kk in pezzo) uno[kk] = pezzo[kk];
        uno.carta = presi[k];
        if (az === 'protect' || az === 'swap' || az === 'shuffle' || az === 'rotate') {
          uno.lati = latiColpiti(eff.ambito, (presi[k].valoriBase || presi[k].values) || {}, presi[k], _occasione(fonte, scena));
        }
        fuori.push(uno);
      }
      if (senzaBersagli && !presi.length) fuori.push(pezzo);
      return;
    }

    if (az === 'steal' && eff.cosa && eff.cosa !== 'power') {
      // Rubare un tratto o un'abilita' non e' una sottrazione: e' un travaso.
      // Passa dalla stessa porta delle altre azioni descritte.
      if (!condizioneVera(cond, fonte, scena)) return;
      var daCui = candidati(fonte, eff, scena);
      if (!daCui.length) return;
      if (eff.scelta) {
        fuori.push({ azione: 'steal', cosa: eff.cosa, fonte: fonte, candidati: daCui, quale: eff.quale, dove: eff.dove });
        return;
      }
      var scelte = scelti(daCui, eff, scena);
      for (var s = 0; s < scelte.length; s++) {
        fuori.push({ azione: 'steal', cosa: eff.cosa, fonte: fonte, carta: scelte[s], quale: eff.quale, dove: eff.dove });
      }
      return;
    }
    if (az !== 'buff' && az !== 'debuff' && az !== 'set' && az !== 'steal') return;
    if (eff.cosa && eff.cosa !== 'power') return;      // un furto di potenza, e nient'altro
    if (!condizioneVera(cond, fonte, scena)) return;

    var lista = scelti(candidati(fonte, eff, scena), eff, scena);
    var q = quantita(fonte, eff, cond, scena);
    var i, j, bersaglio, lati;
    for (i = 0; i < lista.length; i++) {
      bersaglio = lista[i];
      lati = latiColpiti(eff.ambito, (bersaglio.valoriBase || bersaglio.values) || {}, bersaglio, _occasione(fonte, scena));
      if (az === 'set') {
        // "diventa un valore fra 1 e 3": il numero si tira QUI e vale per
        // tutti i lati colpiti, cosi' la carta non esce a scacchiera.
        var v = q;
        if (eff.quanto && typeof eff.quanto.da === 'number') {
          var r = (scena && typeof scena.sorte === 'number') ? scena.sorte : Math.random();
          v = eff.quanto.da + Math.floor(r * (eff.quanto.a - eff.quanto.da + 1));
        }
        fuori.push({ carta: bersaglio, lati: lati, valore: v, azione: 'set' });
      } else {
        var d = (az === 'debuff' || az === 'steal') ? -q : q;
        if (!d) continue;
        fuori.push({ carta: bersaglio, lati: lati, delta: d, azione: az });
      }
    }
  }

  // ── v0.77.93 — DUE GENI NON SONO LA STESSA OCCASIONE ────────────────────
  // Il lato "a caso" esce da un numero ricavato dal seme, e il seme conteneva
  // due cose sole: la partita e la carta BERSAGLIO. Mancava chi stava agendo.
  // Il risultato: giocato il primo Genio, il secondo regalava il bonus allo
  // STESSO gruppo di ogni carta in mano, e cosi' il terzo, e il quarto — la
  // scelta era casuale una volta sola, all'inizio della partita, e poi si
  // ripeteva identica per sempre.
  //
  // Serviva quindi un pezzo di seme che cambi a ogni giocata, e che i due
  // client e il server calcolino IDENTICO — se divergesse, i due tabelloni si
  // troverebbero d'accordo solo per caso. La casella su cui la carta agisce ha
  // tutte e due le proprieta': ogni Genio ne occupa una diversa, e su quale sia
  // sono tutti d'accordo perche' l'ha decisa il server. Il turno fa da ripiego
  // per chi agisce dalla mano, dove una casella non c'e'.
  //
  // NON si tocca il seme delle abilita' CONTINUE (_unEffetto): quelle devono
  // restare ferme sullo stesso gruppo finche' durano, o il bonus salterebbe da
  // un lato all'altro a ogni ridisegno. Li' l'occasione non esiste: c'e' uno
  // stato che dura.
  function _occasione(fonte, scena) {
    var dove = (scena && scena.cellaDi) ? scena.cellaDi(fonte) : null;
    if (!dove) dove = 't' + String((scena && scena.turno) || 0);
    return String((scena && scena.seme) || '') + '|' + String(dove);
  }

  // I cambiamenti che l'abilita' di questa carta produce a un dato evento.
  // `evento` e' un trigger: 'on_play', 'on_conquer', 'on_conquered', ...
  function cambiamentiAllEvento(fonte, evento, scena) {
    var a = abilitaDi(fonte);
    var fuori = [];
    if (!a || a.trigger !== evento) return fuori;
    if (!finestraAperta(a, scena)) return fuori;
    if (!scattoConsentito(fonte, evento, scena)) return fuori;
    scena = scena || {};

    // Un effetto continuo non scatta: lo calcola deltaContinuo, e farlo anche
    // qui vorrebbe dire applicarlo due volte.
    if (a.effetto && a.effetto.durata !== 'while_true') _cambiamentiDi(fonte, a.effetto, a.se, scena, fuori, a.finestra);

    if (a.legame === 'and') {
      if (a.effetto2 && a.effetto2.durata !== 'while_true') _cambiamentiDi(fonte, a.effetto2, a.se2, scena, fuori, a.finestra);
    } else if (a.legame === 'instead') {
      // Il secondo prende il posto del primo quando la sua condizione vale.
      if (a.effetto2 && condizioneVera(a.se2, fonte, scena)) {
        fuori.length = 0;
        if (a.effetto2.durata !== 'while_true') _cambiamentiDi(fonte, a.effetto2, a.se2, scena, fuori, a.finestra);
      }
    } else if (a.legame === 'or') {
      // Una delle due, a sorte.
      var testa = (scena && typeof scena.sorte === 'number' ? scena.sorte : Math.random()) < 0.5;
      if (!testa && a.effetto2) { fuori.length = 0; _cambiamentiDi(fonte, a.effetto2, a.se2, scena, fuori, a.finestra); }
    }
    // Si segna solo se l'abilita' ha davvero prodotto qualcosa: se la
    // condizione era falsa e non e' uscito niente, il colpo unico non e' stato
    // speso e resta da spendere.
    if (fuori.length) segnaScatto(fonte, evento, scena);
    return fuori;
  }

  // I valori di una carta con le sinergie gia' dentro.
  function valoriEffettivi(carta, scena) {
    // La base sono i valori al netto delle sinergie: valoriBase se la carta
    // ce l'ha (la muovono gli effetti permanenti), altrimenti quelli correnti.
    var base = (carta && (carta.valoriBase || carta.values)) || {};
    var d = deltaContinuo(carta, scena);
    var out = {}, i, l;
    for (i = 0; i < SEI_LATI.length; i++) {
      l = SEI_LATI[i];
      out[l] = Math.max(0, (base[l] || 0) + (d[l] || 0));
    }
    return out;
  }

  var MOTORE = {
    SEI_LATI: SEI_LATI,
    abilitaDi: abilitaDi,
    regolaDi: regolaDi,
    haTratto: haTratto,
    estremo: estremo,
    condizioneVera: condizioneVera,
    intoccabile: intoccabile,
    latoProtetto: latoProtetto,
    conquistabileDa: conquistabileDa,
    valoreDiAttacco: valoreDiAttacco,
    vince: vince,
    giocabileSuBloccata: giocabileSuBloccata,
    rendeImmuniIVicini: rendeImmuniIVicini,
    // v0.78.5 — l'elenco delle azioni che il motore sa mettere in scena. Lo
    // chiede chi deve decidere se un'abilita' e' "programmata" o va marcata
    // NO_SCRIPT: quella domanda si fa qui e non con una lista ricopiata
    // altrove, che il giorno dopo sarebbe gia' diversa.
    AZIONI_DESCRITTE: AZIONI_DESCRITTE,
    latiColpiti: latiColpiti,
    colpisce: colpisce,
    quantita: quantita,
    finestraAperta: finestraAperta,
    candidati: candidati,
    scelti: scelti,
    scattoConsentito: scattoConsentito,
    segnaScatto: segnaScatto,
    cambiamentiAllEvento: cambiamentiAllEvento,
    deltaContinuo: deltaContinuo,
    valoriEffettivi: valoriEffettivi
  };

  return MOTORE;
})();
// ─── fine del motore delle abilita ──────────────────────────────────────

function InitModule(ctx, logger, nk, initializer) {
  initializer.registerRpc('hx_avvio', rpcAvvio);
  initializer.registerRpc('hx_importa', rpcImporta);
  initializer.registerRpc('hx_sistema_utenti', rpcSistemaUtenti);
  initializer.registerRpc('hx_mazzi_leggi', rpcMazziLeggi);
  initializer.registerRpc('hx_mazzi_scrivi', rpcMazziScrivi);
  initializer.registerRpc('hx_partita', rpcPartita);
  initializer.registerRpc('hx_preferenze', rpcPreferenze);
  initializer.registerRpc('hx_avatar', rpcAvatar);
  initializer.registerRpc('hx_elimina_account', rpcEliminaAccount);
  initializer.registerRpc('hx_giocatori', rpcGiocatoriOnline);
  initializer.registerRpc('hx_entro', rpcEntro);
  initializer.registerRpc('hx_esco', rpcEsco);
  initializer.registerRpc('hx_carte_viste', rpcCarteViste);
  initializer.registerRpc('hx_bustina_apri', rpcBustinaApri);
  initializer.registerRpc('hx_bustina_raccogli', rpcBustinaRaccogli);
  // v0.77.53 — la partita in rete. registerMatch da' un nome al gestore;
  // registerMatchmakerMatched fa in modo che, accoppiati due giocatori, la
  // partita nasca da sola e il suo id arrivi ai due client dentro allo stesso
  // messaggio di accoppiamento che gia' ricevevano.
  initializer.registerMatch('hextale', partita);
  initializer.registerMatchmakerMatched(accoppiati);
  // Tutte le strade d'ingresso, non solo quella con l'email: chi entra con
  // Google deve ricevere il mazzo esattamente come gli altri.
  initializer.registerAfterAuthenticateEmail(dopoAccesso);
  initializer.registerAfterAuthenticateGoogle(dopoAccesso);
  // PRIMA di autenticare con Google si controlla per chi e stato emesso il token.
  initializer.registerBeforeAuthenticateGoogle(primaDiGoogle);
  initializer.registerAfterAuthenticateDevice(dopoAccesso);
  initializer.registerAfterAuthenticateCustom(dopoAccesso);
  logger.info('Hextale: modulo caricato');
}
