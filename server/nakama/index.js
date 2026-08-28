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
var XP_VITTORIA = 50;
var XP_SCONFITTA = 20;
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
var LIVELLO_NORMALE = 2;
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
var LIVELLO_SBUSTATA = LIVELLO_NORMALE;

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
    carte: {}
  };
  scriviPossesso(nk, userId, possesso);
  logger.info('possesso assegnato a %s: mazzo %d, admin=%s', userId, scelto, String(admin));
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

  var scelto = dati && dati.scelto ? String(dati.scelto) : null;
  if (scelto && !visti[scelto]) scelto = null;
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
function rpcPartita(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var dati;
  try { dati = JSON.parse(payload || '{}'); } catch (e) { throw Error('esito illeggibile'); }
  var vinta = !!dati.vinta;
  var pari = !!dati.pari;
  var controIA = !!dati.controIA;

  var letto = leggiStagione(nk, ctx.userId);
  var p = letto.profilo;
  var prima = {
    livello: p.livello, xp: p.xp, rank: p.rank, puntiRank: p.puntiRank,
    xpPerSalire: xpPerSalire(p.livello)
  };

  // ── esperienza ──────────────────────────────────────────────────────────
  // Un pareggio non e' una vittoria: vale come una sconfitta per l'esperienza,
  // e non muove il rank.
  var guadagno = vinta ? XP_VITTORIA : XP_SCONFITTA;
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
  if (!controIA && !pari) {
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

  p.partite = (p.partite || 0) + 1;
  if (vinta) p.vittorie = (p.vittorie || 0) + 1;
  scriviStagione(nk, ctx.userId, p);

  return JSON.stringify({
    prima: prima,
    profilo: p,
    salito: salito,
    sceso: sceso,
    xpGuadagnata: guadagno,
    xpPerSalire: xpPerSalire(p.livello),
    ranghi: RANGHI
  });
}

function InitModule(ctx, logger, nk, initializer) {
  initializer.registerRpc('hx_avvio', rpcAvvio);
  initializer.registerRpc('hx_importa', rpcImporta);
  initializer.registerRpc('hx_sistema_utenti', rpcSistemaUtenti);
  initializer.registerRpc('hx_mazzi_leggi', rpcMazziLeggi);
  initializer.registerRpc('hx_mazzi_scrivi', rpcMazziScrivi);
  initializer.registerRpc('hx_partita', rpcPartita);
  initializer.registerRpc('hx_bustina_apri', rpcBustinaApri);
  initializer.registerRpc('hx_bustina_raccogli', rpcBustinaRaccogli);
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
