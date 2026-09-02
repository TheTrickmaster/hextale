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
// L'indirizzo dell'avatar di un account, o stringa vuota se non ne ha uno.
function _avatarDi(nk, userId) {
  try {
    var u = nk.usersGetId([userId]);
    return (u && u.length && u[0].avatarUrl) ? String(u[0].avatarUrl) : '';
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
// ── v0.77.55 — L'ESITO DI UNA PARTITA, PER UN GIOCATORE ───────────────────
// Era il corpo di rpcPartita. E' diventato una funzione a se' perche' adesso
// ha due chiamanti: la RPC, che serve le partite contro l'IA e resta la strada
// di prima, e la PARTITA IN RETE, dove l'esito non lo dichiara piu' il client
// ma lo decide il server quando i due si sono trovati d'accordo su com'e'
// finito il tabellone. Una regola sola, in un posto solo: se un domani cambia
// quanto vale una vittoria, cambia per tutti e due i modi di giocare.
function applicaEsito(nk, userId, vinta, pari, controIA) {
  var letto = leggiStagione(nk, userId);
  var p = letto.profilo;
  var prima = {
    livello: p.livello, xp: p.xp, rank: p.rank, puntiRank: p.puntiRank,
    xpPerSalire: xpPerSalire(p.livello)
  };
  vinta = !!vinta; pari = !!pari; controIA = !!controIA;

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
  scriviStagione(nk, userId, p);

  return {
    prima: prima,
    profilo: p,
    salito: salito,
    sceso: sceso,
    xpGuadagnata: guadagno,
    xpPerSalire: xpPerSalire(p.livello),
    ranghi: RANGHI
  };
}

// La RPC resta la strada delle partite contro l'IA, dove non c'e' nessun
// avversario che possa confermare com'e' andata.
function rpcPartita(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var dati;
  try { dati = JSON.parse(payload || '{}'); } catch (e) { throw Error('esito illeggibile'); }
  return JSON.stringify(applicaEsito(nk, ctx.userId, !!dati.vinta, !!dati.pari, !!dati.controIA));
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
var OP_IMPRONTA  = 7;   // client -> server: com'e' il mio stato dopo questa giocata
var OP_DISACCORDO= 8;   // server -> client: le due impronte non coincidono
var OP_ESITO     = 9;   // server -> client, personale: com'e' andata, e cosa hai guadagnato

var TURNO_MS = 60000;        // i sessanta secondi del turno
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
function _mazzoDi(nk, logger, userId) {
  var r = nk.storageRead([{ collection: COLL_PROFILO, key: KEY_MAZZI, userId: userId }]);
  var dati = (r && r.length && r[0].value) ? r[0].value : null;
  if (!dati || !dati.mazzi || !dati.mazzi.length) return null;
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
  stato.scadenza = Date.now() + TURNO_MS;

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
    turno: 0, numeroTurno: 0, scadenza: 0,
    iniziata: false, finita: false,
    natoIl: Date.now(),
    rapporti: {},              // per turno: cosa ha raccontato ciascuno
    concordato: null           // l'ultimo tabellone su cui i due erano d'accordo
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

function partitaLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (var i = 0; i < presences.length; i++) {
    var u = presences[i].userId;
    delete state.presenze[u];
    if (state.iniziata && !state.finita) {
      state.finita = true;
      state.motivo = 'abbandono';
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

      if (uno.finita && due.finita) {
        _chiudiPartita(state, dispatcher, logger, nk, uno);
        return { state: state };
      }
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
      esito = applicaEsito(nk, u, suo, pari, false);
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
    info[u] = {
      nome: String(sp.nome || ''),
      avatar: String(sp.avatar || ''),
      rank: (typeof sp.rank === 'number') ? sp.rank : null
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
  function latiColpiti(ambito, valori, carta, seme) {
    if (ambito === 'ALL' || !ambito) return SEI_LATI.slice();
    if (ambito === 'HIGHEST' || ambito === 'LOWEST') {
      var cerca = estremo(valori, ambito === 'HIGHEST');
      var out = [], i;
      for (i = 0; i < SEI_LATI.length; i++) if ((valori[SEI_LATI[i]] || 0) === cerca) out.push(SEI_LATI[i]);
      return out.length ? [out[0]] : [];
    }
    if (ambito === 'RAND' || ambito === 'ONE') {
      var chiave = String((carta && (carta.id || carta.name)) || '?') + '|' + String(seme || '');
      return [SEI_LATI[_semeDi(chiave) % SEI_LATI.length]];
    }
    return SEI_LATI.slice();
  }

  function _stessoPadrone(a, b) {
    return a && b && a.owner !== undefined && b.owner !== undefined && a.owner === b.owner;
  }

  // L'effetto della FONTE colpisce il BERSAGLIO?
  function colpisce(fonte, eff, bersaglio, scena) {
    var chi = eff.chi, dove = eff.dove;
    if (chi === 'self') return bersaglio === fonte;
    if (!bersaglio) return false;
    if (chi === 'ally' && !_stessoPadrone(fonte, bersaglio)) return false;
    if (chi === 'opponent' && _stessoPadrone(fonte, bersaglio)) return false;
    // "any" non guarda il padrone.
    if (dove === 'adjacent') {
      var vic = (scena.vicini && scena.vicini(fonte)) || [];
      for (var i = 0; i < vic.length; i++) if (vic[i] === bersaglio) return true;
      return false;
    }
    if (dove === 'board' || !dove) return bersaglio !== fonte || chi === 'self';
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
          uno.lati = latiColpiti(eff.ambito, (presi[k].valoriBase || presi[k].values) || {}, presi[k], scena.seme);
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
      lati = latiColpiti(eff.ambito, (bersaglio.valoriBase || bersaglio.values) || {}, bersaglio, scena.seme);
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
