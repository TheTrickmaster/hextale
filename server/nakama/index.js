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
var XP_RESTA_VINCENDO = 50;       // gli restano davanti a un tavolo vuoto: ha vinto, e vale una vittoria
// v0.79.18 — qui viveva XP_RESTA_PERDENDO (35), per chi restava mentre stava
// perdendo. Da quando abbandonare e' una sconfitta, chi resta ha vinto e basta:
// quel caso non esiste piu'.
var XP_USCITO = 0;                // chi si disconnette, crasha, o esce: solo i turni

// v0.78.12 — l'inchiostro magico segue la stessa forma dell'esperienza: dieci
// per una vittoria, cinque per una sconfitta, niente per chi lascia la partita
// a meta'. Chi si arrende ha concluso, quindi prende i cinque della sconfitta.
var INK_VITTORIA = 10;
var INK_SCONFITTA = 5;
// E ogni cinque partite si guadagna una bustina. Il conto lo tiene il server
// insieme al resto: e' un premio, e un premio che il client puo' scrivere non
// e' un premio.
// ══════════════════════════════════════════════════════════════════════════
// v0.79.75 — LE CINQUE QUEST DEL GIORNO
// ══════════════════════════════════════════════════════════════════════════
// Il pool. Lorenzo lo allunga quando vuole aggiungendo righe qui: e' l'unico
// posto in cui una quest esiste, e la sua definizione non si copia da nessuna
// parte — il giocatore si porta dietro solo l'id, quanto ha fatto e se ha
// riscosso.
//
//   id       la chiave, e non si cambia mai: e' scritta nello stato di chi
//            sta giocando quella quest oggi. Cambiarla vuol dire cancellarla.
//   testo    la riga che si legge, gia' in inglese e gia' col numero dentro.
//   quanto   quante volte va fatta la cosa.
//   premio   'pack' (una bustina) o 'ink' (QUEST_INK di inchiostro).
//   conta    QUALE cosa la fa avanzare. Vedi avanzaQuest.
//   dove     'pvp' solo contro persone, 'pvia' solo contro la macchina,
//            'ovunque' in tutte e due. La regola di Lorenzo: se nel testo
//            c'e' scritto PvP vale solo online, se c'e' PvIA solo contro la
//            macchina, e se non c'e' scritto niente vale sempre. Il campo
//            RIPETE quello che il testo dice, e non e' un doppione inutile:
//            e' la sola delle due cose che il codice sa leggere, e un giorno
//            in cui le due discordassero a valere sarebbe questa.
//   soglia   solo per flip_multiplo: quante carte in una giocata sola.
var QUEST_INK = 25;
var QUEST_AL_GIORNO = 5;
var QUEST_POOL = [
  { id:'win3pvp',      testo:'Win 3 PvP matches',    quanto:3,  premio:'pack', conta:'vittoria',      dove:'pvp' },
  { id:'flip20',       testo:'Flip 20 cards',        quanto:20, premio:'ink',  conta:'flip',          dove:'ovunque' },
  { id:'fliptimeless', testo:'Flip a Timeless card', quanto:1,  premio:'pack', conta:'flip_timeless', dove:'ovunque' },
  { id:'play5pvp',     testo:'Play 5 PvP matches',   quanto:5,  premio:'ink',  conta:'partita',       dove:'pvp' },
  { id:'flip2con1',    testo:'Flip 2 cards with 1',  quanto:3,  premio:'ink',  conta:'flip_multiplo', dove:'ovunque', soglia:2 }
];
function questDefinizione(id) {
  for (var i = 0; i < QUEST_POOL.length; i++) if (QUEST_POOL[i].id === id) return QUEST_POOL[i];
  return null;
}
// Il giorno, contato a MEZZANOTTE GMT. Date.now() e' gia' in tempo universale
// e un giorno e' sempre 86.400.000 millisecondi: dividere e troncare da' un
// numero che cambia di uno a mezzanotte di Greenwich, ovunque si trovi chi
// gioca. Niente fusi orari, niente ora legale, niente da tenere d'accordo fra
// due macchine.
function _giornoGmt() { return Math.floor(Date.now() / 86400000); }
// Le cinque di OGGI, uguali per tutti. Il seme e' il giorno, quindi due
// giocatori che si parlano hanno davanti le stesse cinque cose — che e' meta'
// del senso di una daily.
// Con cinque quest nel pool escono tutte e cinque; il mescolamento comincia a
// contare quando il pool sara' piu' lungo, ed e' scritto adesso perche' quel
// giorno non ci sia niente da cambiare.
function _cinqueDelGiorno(giorno) {
  var indici = [];
  var i;
  for (i = 0; i < QUEST_POOL.length; i++) indici.push(i);
  // Mescolamento deterministico: la stessa giornata da' sempre lo stesso
  // ordine, e giornate vicine non si somigliano.
  var seme = giorno * 2654435761 % 2147483647;
  for (i = indici.length - 1; i > 0; i--) {
    seme = (seme * 1103515245 + 12345) % 2147483647;
    var j = Math.abs(seme) % (i + 1);
    var tmp = indici[i]; indici[i] = indici[j]; indici[j] = tmp;
  }
  var fuori = [];
  for (i = 0; i < indici.length && fuori.length < QUEST_AL_GIORNO; i++) {
    fuori.push({ id: QUEST_POOL[indici[i]].id, fatto: 0, presa: false });
  }
  return fuori;
}
// Paga una quest. Torna cosa ha dato, per poterlo raccontare a chi ha chiesto.
function _pagaQuest(possesso, def) {
  if (!def) return null;
  if (def.premio === 'pack') {
    possesso.bustineExtra = (possesso.bustineExtra || 0) + 1;
    return { premio: 'pack', quanto: 1 };
  }
  var v = valuteDi(possesso);
  v.magicInk += QUEST_INK;
  possesso.valute = v;
  return { premio: 'ink', quanto: QUEST_INK };
}
// Le quest di oggi, generandole se e' cambiato il giorno.
//
// QUEL CHE ERA FINITO E NON RISCOSSO SI PAGA DA SOLO, prima di buttare via la
// giornata vecchia. E' la decisione di Lorenzo del 10/09/2026, ed e' quella
// giusta: un premio guadagnato e non ritirato perche' si e' chiuso il gioco
// cinque minuti prima di mezzanotte non e' un premio che si perde, e' un
// premio che qualcuno ha vinto.
// Ritorna true se ha cambiato qualcosa e va riscritto.
function assicuraQuestDelGiorno(logger, possesso, userId) {
  var oggi = _giornoGmt();
  var q = possesso.quest;
  if (q && q.giorno === oggi && q.lista && q.lista.length) return false;
  if (q && q.lista && q.lista.length) {
    for (var i = 0; i < q.lista.length; i++) {
      var voce = q.lista[i];
      var def = questDefinizione(voce.id);
      if (!def || voce.presa) continue;
      if ((voce.fatto || 0) < def.quanto) continue;
      var dato = _pagaQuest(possesso, def);
      if (logger) logger.info('quest %s scaduta ma finita: pagata a %s (%s)', voce.id, userId, dato.premio);
    }
  }
  possesso.quest = { giorno: oggi, lista: _cinqueDelGiorno(oggi) };
  return true;
}
// L'avanzamento. `conta` e' il verbo ('vittoria', 'flip', ...), `quanto` di
// quanto, `pvp` se e' successo contro una persona.
// Ritorna l'elenco di cio' che si e' mosso, che e' quel che il client mostra
// coi suoi popup: chi avanza e chi, avanzando, ha finito.
function avanzaQuest(possesso, conta, quanto, pvp) {
  var mosse = [];
  var q = possesso.quest;
  if (!q || !q.lista || !quanto) return mosse;
  for (var i = 0; i < q.lista.length; i++) {
    var voce = q.lista[i];
    var def = questDefinizione(voce.id);
    if (!def || def.conta !== conta) continue;
    if (def.dove === 'pvp' && !pvp) continue;
    if (def.dove === 'pvia' && pvp) continue;
    var prima = voce.fatto || 0;
    if (prima >= def.quanto) continue;          // gia' finita: non si conta oltre
    voce.fatto = Math.min(def.quanto, prima + quanto);
    mosse.push({ id: def.id, fatto: voce.fatto, quanto: def.quanto,
                 finita: voce.fatto >= def.quanto });
  }
  return mosse;
}
// Come le vede il client: la definizione e lo stato insieme. Il client non
// conosce il pool e non deve conoscerlo — cosi' una quest nuova non chiede
// una versione nuova del gioco.
function questPerIlClient(possesso) {
  var fuori = [];
  var q = possesso && possesso.quest;
  if (!q || !q.lista) return fuori;
  for (var i = 0; i < q.lista.length; i++) {
    var voce = q.lista[i];
    var def = questDefinizione(voce.id);
    if (!def) continue;                          // una riga tolta dal pool sparisce
    fuori.push({ id: def.id, nome: def.testo, quanto: def.quanto, premio: def.premio,
                 fatto: Math.min(voce.fatto || 0, def.quanto), presa: !!voce.presa });
  }
  return fuori;
}

// Il premio di fine partita per UN giocatore, dato come e' finita per lui.
// `modo` puo' essere:
//   'finita'  la partita e' arrivata alla fine (anche per resa dell'altro)
//   'resa'    l'ha chiusa lui arrendendosi
//   'uscito'  si e' disconnesso, e' crashato, o e' uscito
//   'resta'   e' rimasto in partita dopo che l'altro e' uscito
function xpDiFine(modo, vinta) {
  if (modo === 'uscito') return XP_USCITO;
  if (modo === 'resa') return XP_RESA;
  // v0.79.18 — chi resta ha VINTO, e non c'e' piu' un ramo "restava perdendo":
  // da quando abbandonare e' una sconfitta, chi rimane in piedi ha vinto
  // qualunque fosse il punteggio. XP_RESTA_PERDENDO era il numero di quando
  // nessuno dei due vinceva, ed e' sparito con quella lettura.
  if (modo === 'resta') return XP_RESTA_VINCENDO;
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
var NOMI_STARTER = { 1: 'Starter Wild', 2: 'Starter Trickster', 3: 'Starter Princess' };
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

// ── v0.79.38 — TRE CARTE, DUE SI TENGONO, UNA SI PAGA ─────────────────────
// Da un pacchetto escono TRE carte. Se ne tiene una gratis, una seconda si
// compra, e la terza si scarta sempre.
// Il prezzo e' quello della rarita' della carta MENO CARA fra le due che si
// tengono, quindi non dipende dall'ordine in cui le si sceglie (v0.79.42: per
// due versioni e' stato quello della seconda scelta, e l'ordine dei clic era
// diventato una leva da sfruttare). E si paga in INCHIOSTRO MAGICO, non piu'
// in polvere di fata — la
// polvere e' la valuta comprata coi soldi veri, l'inchiostro quella che si
// guadagna giocando, ed e' anche quella con cui si compra un treasure pack.
var BUSTINA_CARTE = 3;
var BUSTINA_TENIBILI = 2;
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
    // Un admin trova un pacchetto di ogni tipo: uno a tempo gia' maturo, uno
    // premio e uno tesoro. Una volta sola — vedi SEME_ADMIN_VERSIONE.
    if (admin && (attuale.semeAdmin || 0) < SEME_ADMIN_VERSIONE) {
      attuale.semeAdmin = SEME_ADMIN_VERSIONE;
      attuale.bustinaProssima = 0;
      attuale.bustineExtra = (attuale.bustineExtra || 0) + 1;
      attuale.bustineTesoro = (attuale.bustineTesoro || 0) + 1;
      daRiscrivere = true;
    }
    // v0.79.90 — chi c'era prima dei livelli sale subito a quello che le sue
    // copie gli danno, e riceve la copia dello starter che lo sbusto non
    // contava. Vedi _migraLivelliCarte.
    if ((attuale.livelliCarte || 0) < LIVELLI_CARTE_VERSIONE && _migraLivelliCarte(nk, logger, attuale)) {
      attuale.livelliCarte = LIVELLI_CARTE_VERSIONE;
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
    avatar: AVATAR_DI_PARTENZA,
    // v0.79.36 — un admin nasce gia' col pacchetto premio e con quello tesoro.
    // Il contrassegno si scrive QUI e non solo nel ramo di sopra: senza, il
    // regalo arriverebbe al secondo avvio invece che al primo — la prima
    // chiamata crea il possesso e non passa mai dalla migrazione.
    semeAdmin: admin ? SEME_ADMIN_VERSIONE : 0,
    bustineExtra: admin ? 1 : 0,
    bustineTesoro: admin ? 1 : 0,
    // v0.79.90 — nato coi livelli delle carte: niente da migrare.
    livelliCarte: LIVELLI_CARTE_VERSIONE
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

// ══════════════════════════════════════════════════════════════════════════
// v0.79.22 — LA LETTERA: IL MAZZO INIZIALE LO SCEGLIE CHI GIOCA
// ══════════════════════════════════════════════════════════════════════════
// Fino a ieri il mazzo di partenza usciva a sorte, e la riga che lo scriveva
// diceva gia' cosa sarebbe successo un giorno: origine 'caso' adesso, 'scelta'
// quando ci sara' la schermata. La schermata c'e'.
//
// Il sorteggio RESTA, e non e' un residuo: e' la rete. Un account nasce con un
// mazzo comunque, cosi' chi chiude il gioco prima di scegliere — o chi si
// registra da un client vecchio — non si ritrova senza niente da giocare. La
// scelta lo sostituisce finche' e' ancora quello del caso.
//
// E si sceglie UNA volta sola: dopo, `origine` dice 'scelta' e questa porta
// risponde senza scrivere. Non e' una cortesia — e' che il mazzo si puo'
// modificare in Libreria, e una seconda scelta lo riscriverebbe da capo.
//
// Con payload vuoto e' una DOMANDA ("ho gia' scelto?"), con {mazzo:N} e' la
// scelta. Stessa forma di hx_accordo: una porta sola per una cosa sola.
// ══════════════════════════════════════════════════════════════════════════
// v0.79.82 — QUALI TUTORIAL SONO GIA' STATI VISTI
// ══════════════════════════════════════════════════════════════════════════
// Tre momenti diversi, tre ricordi separati: la sequenza d'apertura, la
// finestra dei pacchetti e quella della Libreria. Separati e non un solo
// "tutorial fatto" perche' si vedono in tre momenti lontani fra loro — chi
// apre i pacchetti la prima volta puo' averlo fatto mesi dopo il primo
// accesso, e un ricordo unico glielo toglierebbe.
//
// STA SUL SERVER e non nel browser, come tutto il resto (e' la regola di
// Lorenzo): chi cambia computer non deve rivedersi il tutorial, e chi svuota
// la cronologia nemmeno.
// Il client NON decide: chiede, e qui si controlla che il nome sia uno dei
// tre. Un nome inventato non scrive niente.
var TUTORIAL_NOMI = ['principale', 'pacchetti', 'libreria'];
// v0.79.84 — "non accetto questa partita". Chi la chiama non e' dentro al
// match e non puo' mandargli un messaggio: si passa da matchSignal, che e' la
// porta di servizio. Il controllo su CHI puo' rifiutare lo fa il match (vedi
// partitaSignal): qui si sa solo chi sta chiamando, di la' si sa chi era
// accoppiato.
function rpcRifiuta(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var d = {};
  try { d = payload ? JSON.parse(payload) : {}; } catch (e) { d = {}; }
  var id = String(d.matchId || '');
  if (!id) return JSON.stringify({ ok: false });
  try {
    nk.matchSignal(id, JSON.stringify({ rifiuta: ctx.userId, perTempo: !!d.perTempo }));
  } catch (e) {
    // Un tavolo gia' chiuso non e' un errore: vuol dire che la notizia era
    // gia' arrivata per un'altra strada.
    logger.info('rifiuto su %s senza effetto: %s', id, String(e));
  }
  return JSON.stringify({ ok: true });
}

function rpcTutorial(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var d = {};
  try { d = payload ? JSON.parse(payload) : {}; } catch (e) { d = {}; }
  var possesso = assicuraPossesso(ctx, nk, logger, ctx.userId, ctx.username);
  var visti = possesso.tutorial || {};
  var quale = d.visto;
  if (quale && TUTORIAL_NOMI.indexOf(quale) >= 0 && !visti[quale]) {
    visti[quale] = true;
    possesso.tutorial = visti;
    scriviPossesso(nk, ctx.userId, possesso);
    logger.info('tutorial %s visto da %s', quale, ctx.userId);
  }
  return JSON.stringify({ visti: visti });
}

function rpcStarter(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var d = {};
  try { d = payload ? JSON.parse(payload) : {}; } catch (e) { d = {}; }

  var possesso = assicuraPossesso(ctx, nk, logger, ctx.userId, ctx.username);
  var giaScelto = (possesso.origine === 'scelta');
  var suo = (possesso.mazzi && possesso.mazzi.length) ? possesso.mazzi[0] : 0;

  if (d.mazzo !== undefined && d.mazzo !== null && !giaScelto) {
    var numero = Math.floor(Number(d.mazzo));
    if (MAZZI_STARTER.indexOf(numero) < 0) throw Error('mazzo iniziale non valido');
    possesso.mazzi = [numero];
    possesso.origine = 'scelta';
    scriviPossesso(nk, ctx.userId, possesso);
    try { creaMazzoStarter(nk, logger, ctx.userId, numero, !!possesso.admin); }
    catch (e) { logger.warn('mazzo starter non rifatto per %s: %s', ctx.userId, String(e)); }
    suo = numero;
    giaScelto = true;
    logger.info('mazzo iniziale SCELTO da %s: %d (%s)', ctx.userId, numero, NOMI_STARTER[numero] || '?');
  }

  return JSON.stringify({
    scelto: giaScelto,
    mazzo: suo,
    nome: NOMI_STARTER[suo] || ''
  });
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
var BUSTINA_ATTESA_MS = 12 * 60 * 60 * 1000;  // deve combaciare col client
// ── I TRE PACCHETTI ───────────────────────────────────────────────────────
// 'daily'     matura da solo ogni dodici ore. NON SI ACCUMULA: e' un istante
//             nel tempo (bustinaProssima), non un contatore, quindi averne uno
//             pronto da due giorni resta averne uno. E il conto riparte quando
//             lo si APRE, non quando e' maturato — chi lo lascia li' non
//             guadagna un vantaggio, ma nemmeno lo perde.
// 'reward'    si vince con le quest del giorno (vedi QUEST_POOL).
//             Vive in possesso.bustineExtra, che e' il campo che c'era gia':
//             cambiargli nome avrebbe voluto dire una migrazione per niente.
// 'treasure'  si compra. Vive in possesso.bustineTesoro.
// Reward e treasure sono contatori senza tetto: non c'e' un limite a quanti se
// ne possono tenere da parte senza aprirli.
var PACCHETTO_TIPI = ['daily', 'reward', 'treasure'];
// Quanto costa un treasure pack, in inchiostro magico. E' la cifra scritta sul
// pulsante giallo della schermata: il client la mostra, il server la applica.
var PACCHETTO_PREZZO_INK = 100;
// Quanti pacchetti trova un admin quando entra, una volta sola. Serve a
// guardare la schermata con qualcosa dentro senza dover giocare cinque
// partite. Il numero di versione e' quello che rende il regalo IRRIPETIBILE:
// finche' resta questo, chi l'ha gia' avuto non lo riceve di nuovo. Alzandolo
// di uno, ogni admin lo riceve una volta ancora.
var SEME_ADMIN_VERSIONE = 1;

// Quanti pacchetti di ogni tipo ha addosso un giocatore, adesso.
// Il daily non e' un numero ma una risposta a una domanda ("e' maturato?"),
// ed e' l'unico modo di scriverlo che non permetta di accumularlo per sbaglio.
function pacchettiDi(possesso) {
  var prossima = (typeof possesso.bustinaProssima === 'number') ? possesso.bustinaProssima : 0;
  return {
    dailyProssima: prossima,
    daily: (Date.now() >= prossima) ? 1 : 0,
    reward: possesso.bustineExtra || 0,
    treasure: possesso.bustineTesoro || 0
  };
}
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
// ══════════════════════════════════════════════════════════════════════════
// v0.79.15 — L'ACCORDO DEL PLAYTEST
// ══════════════════════════════════════════════════════════════════════════
// Chi entra la prima volta lo deve accettare, e finche' non lo accetta non
// gioca. La memoria di quel gesto sta QUI e non nel browser per la ragione piu'
// semplice di tutte: e' l'unica prova che esista, e una prova che il diretto
// interessato puo' cancellare svuotando una cartella non e' una prova.
//
// Un oggetto per persona e per TIPO di accordo, con dentro i quattro campi
// chiesti. La chiave e' il tipo: cosi' domani un secondo accordo — le regole
// della community, poniamo — e' una chiave in piu' e non un pezzo di codice in
// piu'.
//
// LA VERSIONE E' LA PARTE CHE LAVORA. Non si guarda "ha accettato?", si guarda
// "ha accettato QUESTA versione?". Il giorno in cui il testo cambia basta
// alzare ACCORDO_VERSIONE e tutti se lo rivedono davanti — che e' esattamente
// cio' che un numero di versione su un contratto deve saper fare. Senza,
// riproporlo vorrebbe dire cancellare a mano le accettazioni di tutti.
var COLL_ACCORDI = 'accordi';
var ACCORDO_TIPO = 'playtest_nca';
// v0.79.16 — 1.1: nel testo 'the Developer' e' diventato 'Hextale'. E' un
// cambio di nome della parte che firma, dentro alla clausola sulla proprieta'
// intellettuale: non e' una virgola, ed e' esattamente il caso per cui questo
// numero esiste. Chi aveva accettato la 1.0 se lo rivede davanti una volta.
//
// v0.79.66 — 1.2, e il testo NON e' cambiato. E' l'unico salto di questo
// numero che non racconta una clausola diversa, quindi va detto perche' esiste:
// dalla v0.79.65 subito dopo la firma compare il disclaimer del prototipo (che
// cosa pensiamo dell'arte fatta con l'IA, e cosa non si comprera' mai coi
// soldi). Quel disclaimer non ha una memoria sua — sta attaccato alla firma —
// quindi chi aveva gia' firmato non l'avrebbe visto mai. Alzare qui e' il modo
// che questo meccanismo ha di dire "ripassate tutti da qui", ed e' una
// decisione di Lorenzo del 10/09/2026.
// Il prezzo e' che tutti rifirmano l'accordo, non solo leggono il disclaimer:
// e' quello che chiedeva, e va saputo.
var ACCORDO_VERSIONE = '1.2';

function _accordoDi(nk, userId) {
  try {
    var r = nk.storageRead([{ collection: COLL_ACCORDI, key: ACCORDO_TIPO, userId: userId }]);
    return (r && r.length && r[0].value) ? r[0].value : null;
  } catch (e) { return null; }
}
// "In regola" vuol dire: ha accettato, e ha accettato la versione di adesso.
function _accordoInRegola(nk, userId) {
  var a = _accordoDi(nk, userId);
  return !!(a && a.agreement_version === ACCORDO_VERSIONE);
}

// Due domande in una porta sola:
//   {}                          -> come sto messo?
//   { accetto:true, versione }  -> accetto, segnatelo.
// La versione arriva dal client ma NON e' il client a deciderla: si scrive
// quella del server. Chi mandasse un numero diverso otterrebbe solo di vedersi
// rifiutare l'accettazione, non di firmare un testo che non ha letto.
function rpcAccordo(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var d = {};
  try { d = payload ? JSON.parse(payload) : {}; } catch (e) { d = {}; }

  if (d.accetto === true) {
    if (String(d.versione || '') !== ACCORDO_VERSIONE) {
      throw Error('versione dell accordo non corrispondente: ricarica il gioco');
    }
    var riga = {
      user_id: ctx.userId,
      agreement_type: ACCORDO_TIPO,
      agreement_version: ACCORDO_VERSIONE,
      // In ISO e non in millisecondi: e' un dato che un giorno qualcuno
      // leggera' con gli occhi, e "2026-09-04T14:22:31.000Z" si legge.
      accepted_at: new Date().toISOString()
    };
    nk.storageWrite([{
      collection: COLL_ACCORDI, key: ACCORDO_TIPO,
      userId: ctx.userId, value: riga,
      // Solo il server: l'accettazione non e' un dato che il suo autore deve
      // poter riscrivere.
      permissionRead: 0, permissionWrite: 0
    }]);
    logger.info('accordo %s v%s accettato da %s', ACCORDO_TIPO, ACCORDO_VERSIONE, ctx.userId);
    return JSON.stringify({ accettato: true, versione: ACCORDO_VERSIONE });
  }

  var gia = _accordoDi(nk, ctx.userId);
  return JSON.stringify({
    accettato: _accordoInRegola(nk, ctx.userId),
    versione: ACCORDO_VERSIONE,
    // Quale aveva accettato prima, se ne aveva accettata una: serve a
    // distinguere "non ha mai firmato" da "ha firmato una versione vecchia".
    versioneAccettata: (gia && gia.agreement_version) || ''
  });
}

// ══════════════════════════════════════════════════════════════════════════
// v0.79.12 — LE SEGNALAZIONI DI GUASTO
// ══════════════════════════════════════════════════════════════════════════
// La finestra dice "submitted successfully", quindi la segnalazione deve
// ARRIVARE da qualche parte: un ringraziamento per un messaggio buttato via
// sarebbe la cosa peggiore che questa schermata possa fare.
//
// Una segnalazione = un oggetto, con una chiave che porta il momento in cui e'
// arrivata. Non si accodano dentro a un unico elenco perche' due giocatori che
// scrivono nello stesso istante si sovrascriverebbero a vicenda: chi legge per
// ultimo vince, e a perdersi sarebbe proprio il difetto che qualcuno ha avuto
// la pazienza di raccontare.
//
// Si legge dal server con storageList sulla collezione "segnalazioni".
var COLL_SEGNALAZIONI = 'segnalazioni';
// Quanto puo' essere lunga ogni risposta. Non e' avarizia: un campo senza
// limite e' un modo di riempire il disco di qualcun altro, e nessuno descrive
// un difetto in duemila caratteri.
var SEGN_TESTO_MAX = 2000;
// E quanto puo' pesare l'immagine, gia' rimpicciolita dal client. Sopra questa
// soglia la segnalazione si salva LO STESSO, senza figura: il testo e' la
// parte che conta, e rifiutare tutto per una foto troppo grande vorrebbe dire
// perdere il racconto per colpa dell'allegato.
var SEGN_FOTO_MAX = 400 * 1024;

var SEGN_CATEGORIE = ['gameplay', 'cards', 'match', 'ui', 'collection',
  'rewards', 'performance', 'visual', 'account', 'other'];
var SEGN_FREQUENZE = ['once', 'sometimes', 'always'];
// ── v0.79.70 — I MOTIVI PER CUI SI SEGNALA UNA PERSONA ────────────────────
// Sono pochi di proposito. Un elenco lungo sembra completo e non lo e' mai,
// e chi non trova la sua voce sceglie quella che gli somiglia di piu': a
// leggere le segnalazioni ci si ritrova con categorie piene di cose che non
// c'entrano. Cinque voci e una casella di testo obbligatoria fanno il lavoro
// meglio, perche' il lavoro lo fa il testo.
// Non c'e' 'linguaggio offensivo in chat' perche' una chat non c'e': quel
// che una persona puo' mandarti addosso qui e' il suo NOME e il suo modo di
// stare in partita.
var REPORT_MOTIVI = ['name', 'stalling', 'cheating', 'unsporting', 'other'];
// Come si leggono nell'email. Nel messaggio vanno le stesse parole che il
// giocatore ha visto nella finestra: chi legge la segnalazione e chi l'ha
// scritta devono parlare della stessa cosa con lo stesso nome. Le sigle
// restano quelle salvate — sono la chiave, non il testo.
var SEGN_ETICHETTE = {
  gameplay: 'Gameplay', cards: 'Cards & Abilities', match: 'Match / Board',
  ui: 'UI & Menus', collection: 'Collection / Progression', rewards: 'Rewards / Packs',
  performance: 'Performance', visual: 'Visual / Audio', account: 'Account', other: 'Other',
  once: 'Once', sometimes: 'Sometimes', always: 'Always',
  // v0.79.70 — e i motivi per cui si segnala una persona.
  name: 'Offensive name', stalling: 'Stalling / wasting time',
  cheating: 'Cheating or exploiting', unsporting: 'Unsporting behaviour'
};
function _etichetta(sigla) { return SEGN_ETICHETTE[sigla] || String(sigla || ''); }

function _inElenco(elenco, v) {
  for (var i = 0; i < elenco.length; i++) if (elenco[i] === v) return true;
  return false;
}
function _testoPulito(v) {
  return String(v == null ? '' : v).slice(0, SEGN_TESTO_MAX);
}

// ── LA POSTA ──────────────────────────────────────────────────────────────
// Le caselle di posta di Hextale stanno da un registrar e parlano SMTP.
// Nakama non parla SMTP: sa fare chiamate HTTP e basta. In mezzo ci va quindi
// un pezzo piccolissimo — il servizio in server/posta/ — che riceve una
// chiamata HTTP e la imbuca. Non e' un giro largo: e' l'unico modo di far
// arrivare una email da qui, e quel pezzo fa una cosa sola.
//
// La CHIAVE non sta in questo file. Questo repository e' pubblico —
// hextalegame.com serve i suoi file — e una chiave scritta qui sarebbe
// pubblica dal primo push, per sempre, anche togliendola il minuto dopo. Sta
// in un oggetto del server, scritto una volta con hx_posta_config.
// La password della casella non passa nemmeno di qui: la conosce solo il
// servizio di inoltro, dal suo file di ambiente sul server.
var KEY_POSTA = 'posta';
// Il numero della segnalazione: uno, due, tre. Serve per parlarne — "il numero
// 47" e' una cosa che si scrive in una risposta, "segn-1757003812345-918273"
// no. Il conto sta sul server e in un posto solo, perche' un numero che due
// posti calcolano per conto proprio prima o poi lo assegna due volte.
var KEY_SEGN_CONTO = 'segnalazioni-conto';
var COLL_REPORT = 'report-giocatori';
var KEY_REPORT_CONTO = 'report-conto';
// ── v0.79.70 — CHI GIOCAVA CONTRO CHI ─────────────────────────────────────
// Un rigo per partita: l'identificativo del tavolo e i due che ci stavano.
// Serve a una cosa sola, ed e' quella che rende una segnalazione qualcosa
// su cui si puo' agire: chi segnala dice "quello con cui sto giocando", e a
// dire CHI e' dev'essere il server. Il nome che il client vede lo scrive il
// client, e su una segnalazione non ci si puo' fidare di quello che dice la
// parte in causa.
var COLL_PARTITE = 'partite';
var SEGN_DESTINATARIO = 'support@hextalegame.com';
// Il servizio vive accanto a Nakama, sulla rete interna di docker: da fuori
// non e' raggiungibile, ed e' voluto — non ha nessuna ragione di esserlo.
var POSTA_URL = 'http://posta:8081/invia';

// La configurazione c'e' o non c'e': se non c'e', la posta e' spenta e la
// segnalazione resta solo sul server. La CHIAVE dentro e' facoltativa — vedi
// il servizio di inoltro per il perche': la vera difesa e' che quel servizio
// non e' raggiungibile da fuori.
function _postaConfig(nk) {
  var c = null;
  try { c = leggiSistema(nk, KEY_POSTA); } catch (e) { c = null; }
  if (!c || !c.attiva) return null;
  return c;
}

// Il corpo del messaggio. Due versioni dello stesso testo: quella scritta, per
// chi legge la posta senza figure, e quella disegnata, con in cima il marchio e
// il numero. Non e' vanita': una casella che riceve segnalazioni le riceve a
// decine, e il numero grosso in alto e' cio' che permette di ritrovarne una.
var POSTA_LOGO = 'https://hextalegame.com/ui/hextale-logo-topbar.png';
// ── v0.79.70 — IL VESTITO E' UNO SOLO ─────────────────────────────────────
// Lo usano la segnalazione di un difetto e quella di un giocatore. Non e' un
// risparmio di righe: quella casella riceve le due cose insieme, e chi le
// legge non deve imparare due modi di leggere. Con due copie basta che
// qualcuno ritocchi una delle due perche' comincino a somigliarsi invece che
// a essere la stessa busta.
//   `titolo`   la riga grossa in cima, accanto al marchio (gia' HTML).
//   `righe`    coppie [etichetta, valore]: la tabella dei fatti.
//   `blocchi`  coppie [titolo, testo]: i pezzi scritti dal giocatore.
//   `piede`    la riga piccola in fondo (gia' HTML).
function _postaHtmlGenerico(titolo, righe, blocchi, piede) {
  var dentro = '';
  var i;
  for (i = 0; i < righe.length; i++) {
    dentro += '<tr><td style="padding:2px 14px 2px 0;color:#8a9a9c;white-space:nowrap">' + righe[i][0] +
      '</td><td style="padding:2px 0;color:#EDE0C6">' + _html(righe[i][1]) + '</td></tr>';
  }
  var testi = '';
  for (i = 0; i < blocchi.length; i++) {
    testi += '<div style="margin:22px 0 0">' +
      '<div style="font:600 14px/1.2 Georgia,serif;color:#8a9a9c;text-transform:uppercase;letter-spacing:.08em">' + blocchi[i][0] + '</div>' +
      '<div style="margin-top:6px;font:16px/1.5 Georgia,serif;color:#EDE0C6;white-space:pre-wrap">' + _html(blocchi[i][1]) + '</div>' +
      '</div>';
  }
  return '<div style="background:#1b2223;padding:26px;font-family:Georgia,serif">' +
    '<div style="max-width:640px;margin:0 auto;background:#232c2d;border:1px solid #36423f;border-radius:14px;padding:26px">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:18px"><tr>' +
        '<td style="padding-right:16px"><img src="' + POSTA_LOGO + '" alt="Hextale" height="46" style="display:block;height:46px;width:auto"></td>' +
        '<td style="font:bold 28px/1 Georgia,serif;color:#EDE0C6">' + titolo + '</td>' +
      '</tr></table>' +
      '<div style="height:1px;background:#36423f;margin:0 0 18px"></div>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font:15px/1.5 Georgia,serif">' +
        dentro +
      '</table>' +
      testi +
      '<div style="margin-top:24px;padding-top:14px;border-top:1px solid #36423f;font:13px/1.5 Georgia,serif;color:#6f7d7f">' +
        piede +
      '</div>' +
    '</div></div>';
}
// La stessa cosa in righe di testo, per chi legge la posta senza figure.
function _postaTestoGenerico(titolo, righe, blocchi, piede) {
  var fuori = [titolo, ''];
  var i;
  // Le etichette incolonnate: dodici caratteri bastano alla piu' lunga, e una
  // tabella storta in un messaggio di solo testo si legge peggio di nessuna.
  for (i = 0; i < righe.length; i++) {
    var e = righe[i][0] + ':';
    while (e.length < 13) e += ' ';
    fuori.push(e + righe[i][1]);
  }
  for (i = 0; i < blocchi.length; i++) {
    fuori.push('', '--- ' + blocchi[i][0] + ' ---', String(blocchi[i][1]));
  }
  fuori.push('', '---');
  for (i = 0; i < piede.length; i++) fuori.push(piede[i]);
  return fuori.join('\n');
}
function _postaHtml(s, chiave) {
  return _postaHtmlGenerico('Bug report n&deg; ' + s.numero, _segnRighe(s),
    [['What happened', s.cosa], ['What they expected', s.atteso || '(not answered)']],
    'On the server: ' + _html(COLL_SEGNALAZIONI + '/' + chiave) +
      (s.conFoto ? '<br>Screenshot attached.' : ''));
}
function _segnRighe(s) {
  return [
    ['Category', _etichetta(s.categoria)],
    ['How often', _etichetta(s.frequenza)],
    ['Player', (s.nome || '(no name)') + '  [' + s.chi + ']'],
    ['Version', (s.versione || '?') + '   screen ' + (s.schermo || '?')],
    ['Browser', s.agente || '?']
  ];
}
function _html(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// La versione scritta, per chi legge la posta senza figure.
function _postaTesto(s, chiave) {
  var piede = ['On the server: ' + COLL_SEGNALAZIONI + '/' + chiave];
  if (s.conFoto) piede.push('Screenshot attached (also in ' + COLL_SEGNALAZIONI + '/' + chiave + '-foto)');
  return _postaTestoGenerico('Bug report n. ' + s.numero, _segnRighe(s),
    [['What happened', s.cosa], ['What they expected', s.atteso || '(not answered)']], piede);
}

// Spedisce, e se non ci riesce lo dice al registro e basta: la segnalazione e'
// gia' salvata, e far fallire la chiamata del giocatore perche' la posta e'
// giu' vorrebbe dire perdere il racconto per un problema che non e' suo.
function _spedisciSegnalazione(nk, logger, s, chiave, foto) {
  var cfg = _postaConfig(nk);
  if (!cfg) { logger.info('posta non configurata: la segnalazione %s resta solo sul server', chiave); return false; }
  var corpo = {
    a: SEGN_DESTINATARIO,
    // Il numero anche nell'oggetto: e' quello che si vede nell'elenco della
    // casella, prima di aprire.
    oggetto: '[Hextale] Bug report n. ' + s.numero + ' - ' + _etichetta(s.categoria),
    testo: _postaTesto(s, chiave),
    html: _postaHtml(s, chiave),
    allegato: foto || ''
  };
  return _spedisci(nk, logger, cfg, corpo, chiave);
}
// v0.79.70 — la consegna vera e propria, per chiunque abbia gia' un corpo.
// Non fa fallire niente: chi la chiama ha gia' salvato quel che doveva.
function _spedisci(nk, logger, cfg, corpo, chiave) {
  try {
    var intestazioni = { 'Content-Type': 'application/json' };
    if (cfg.chiave) intestazioni['X-Hextale-Chiave'] = cfg.chiave;
    // L'ultimo numero e' l'attesa in MILLISECONDI, non in secondi. Con 20 la
    // chiamata scadeva dopo venti millesimi: l'email partiva davvero — il
    // servizio di inoltro la imbucava — ma Nakama non lo sapeva piu' e
    // segnava la segnalazione come non spedita. Un difetto che si vedeva solo
    // mettendo i due registri uno accanto all'altro.
    // Venticinque secondi: aprire una connessione SMTP e consegnare un
    // messaggio con un allegato non e' istantaneo.
    var r = nk.httpRequest(POSTA_URL, 'post', intestazioni, JSON.stringify(corpo), 25000);
    if (r.code >= 200 && r.code < 300) return true;
    logger.warn('la posta ha risposto %d per %s: %s', r.code, chiave, String(r.body).slice(0, 300));
  } catch (e) {
    logger.warn('%s non e partita per posta: %s', chiave, String(e));
  }
  return false;
}

// ══════════════════════════════════════════════════════════════════════════
// v0.79.31 — LA VERIFICA DELL'EMAIL: SEI CIFRE
// ══════════════════════════════════════════════════════════════════════════
// Chi crea un account riceve un codice di sei cifre nella casella che ha
// dichiarato, e finche' non lo digita l'account resta NON VERIFICATO. Serve a
// una cosa sola: sapere che quella casella esiste e che e' sua. Senza, ci si
// registra con l'indirizzo di chiunque.
//
// DOVE STA IL CODICE. In un oggetto dello storage dell'utente, con i permessi
// a ZERO in lettura e scrittura: il client non lo vede e non lo scrive, lo
// confronta il server. E' l'unico modo perche' "inserisci il codice" non sia
// una domanda a cui il client stesso conosce la risposta.
// Il codice sta in chiaro e non cifrato, ed e' una scelta: vale ventiquattro
// ore, si puo' sbagliare otto volte, e la stessa cifra viaggia in chiaro
// nell'email che il giocatore riceve. Nasconderla qui e lasciarla la' sarebbe
// un lucchetto sulla porta di una stanza senza pareti.
//
// CHI C'ERA PRIMA non ha nessun oggetto scritto, e per lui la domanda non si
// pone: verificato. Non gli si puo' chiedere un codice che nessuno gli ha mai
// mandato.
var KEY_VERIFICA = 'verifica';
var VERIFICA_ORE = 24;          // quanto vale un codice
var VERIFICA_TENTATIVI = 8;     // quante volte si puo' sbagliare prima di doverne chiedere un altro
var VERIFICA_ATTESA_S = 60;     // quanto si aspetta fra un invio e il successivo

function leggiVerifica(nk, userId) {
  var r = nk.storageRead([{ collection: COLL_PROFILO, key: KEY_VERIFICA, userId: userId }]);
  return (r && r.length && r[0].value) ? r[0].value : null;
}
function scriviVerifica(nk, userId, v) {
  nk.storageWrite([{
    collection: COLL_PROFILO, key: KEY_VERIFICA, userId: userId,
    value: v,
    // Zero e zero: il codice non e' roba che il giocatore debba poter leggere,
    // e "verificato" non e' roba che debba poter scrivere.
    permissionRead: 0, permissionWrite: 0
  }]);
}

// Sei cifre, prese dal generatore di UUID e non da Math.random: quello di goja
// non promette niente sulla qualita' del caso, e questo e' un numero che
// qualcuno potrebbe voler indovinare.
// I valori da 10 a 15 si SCARTANO invece di piegarli con un resto: col resto
// le cifre da 0 a 5 uscirebbero il 60% piu' spesso delle altre, e un codice con
// cifre piu' probabili di altre e' un codice piu' facile da tirare a indovinare.
function _codiceASeiCifre(nk) {
  var cifre = '';
  var giri = 0;
  while (cifre.length < 6 && giri < 20) {
    var esa = String(nk.uuidv4()).replace(/-/g, '');
    for (var i = 0; i < esa.length && cifre.length < 6; i++) {
      var v = parseInt(esa.charAt(i), 16);
      if (v < 10) cifre += String(v);
    }
    giri++;
  }
  // Non succede: venti UUID sono centoventi caratteri esadecimali, e ne
  // bastano sei sotto al dieci. Ma una funzione che promette sei cifre ne
  // restituisce sei anche nel caso che non succede.
  while (cifre.length < 6) cifre += '0';
  return cifre;
}

// Come si chiama chi legge. Il nome utente vero non esiste ancora — si sceglie
// al primo avvio, e questa email parte prima — quindi si usa la parte davanti
// alla chiocciola, che e' l'unica cosa che il giocatore riconosce come sua.
function _nomeDallEmail(email) {
  var e = String(email || '');
  var a = e.indexOf('@');
  var n = (a > 0 ? e.slice(0, a) : e).slice(0, 40);
  return n || 'player';
}

// ── L'EMAIL ───────────────────────────────────────────────────────────────
// Disegnata da Lorenzo in Figma ("Email template") e tradotta qui dentro ai
// limiti della posta, che non sono quelli del web:
//   - niente <style> in testa e niente classi: Gmail li butta via. Ogni regola
//     e' scritta in linea sul tag che la usa;
//   - niente flexbox e niente grid: si impagina con le TABELLE, che e' come si
//     impaginava nel 1999 ed e' ancora l'unica cosa che tutti disegnano uguale;
//   - niente sfocatura, niente fusioni, niente ombre interne: i gradienti e i
//     veli del disegno sono appiattiti nei colori che producono (campionati
//     dall'artboard, non indovinati);
//   - i caratteri veri si dichiarano lo stesso — chi legge da Apple Mail li
//     vede — ma dietro c'e' sempre un serif di sistema, perche' Outlook non li
//     carichera' mai.
// Il pulsante "Copy code" del disegno non c'e': in una email non gira nessuno
// script, quindi non potrebbe copiare niente. Le sei cifre stanno gia' grandi
// nelle caselle e si selezionano come qualunque altro testo (deciso con
// Lorenzo il 07/09/2026).
var VERIFICA_LOGO = 'https://hextalegame.com/ui/hextale-logo-topbar.png';
function _verificaHtml(nome, codice, dice) {
  // `dice` porta le parole: titolo, le due righe in mezzo e la nota in fondo.
  // Senza, sono quelle dell'attivazione — cosi' chi chiamava prima con due
  // argomenti continua a ricevere la stessa email di sempre.
  dice = dice || {};
  var TITOLO = dice.titolo || 'Account activation';
  var RIGA1 = dice.riga1 || ('Hey ' + _html(nome) + ', welcome to Hextale!');
  var RIGA2 = dice.riga2 || 'Here&rsquo;s the 6 digit code to activate your account:';
  var NOTA = dice.nota || ('The code expires in ' + VERIFICA_ORE + ' hours. ' +
    'If you did not create a Hextale account, you can ignore this message.');
  var cifre = '';
  for (var i = 0; i < 6; i++) {
    cifre +=
      '<td align="center" valign="middle" width="49" style="width:49px;height:66px;' +
        'background:#232B2A;border:1px solid #4E5555;border-radius:16px;' +
        'font-family:Rosarivo,Georgia,\'Times New Roman\',serif;font-size:40px;line-height:1.2;' +
        'color:#EDE0C6;mso-line-height-rule:exactly">' + codice.charAt(i) + '</td>' +
      (i < 5 ? '<td width="10" style="width:10px;font-size:0;line-height:0">&nbsp;</td>' : '');
  }
  return '' +
  '<!DOCTYPE html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  // I caratteri del gioco. Chi puo' caricarli li carica, chi non puo' legge in
  // un serif e non se ne accorge: sono due caratteri con la stessa aria.
  '<style>' +
  '@font-face{font-family:"Marcellus SC";src:url("https://hextalegame.com/fonts/MarcellusSC-Regular.ttf") format("truetype");font-weight:400}' +
  '@font-face{font-family:"Rosarivo";src:url("https://hextalegame.com/fonts/Rosarivo-Regular.ttf") format("truetype");font-weight:400}' +
  '</style></head>' +
  '<body style="margin:0;padding:0;background:#141B1C">' +
  // Una tabella esterna larga tutto: e' cosi' che si centra una email, perche'
  // "margin:0 auto" su un div non lo centra in Outlook.
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
         'style="border-collapse:collapse;background:#141B1C">' +
  '<tr><td align="center" style="padding:40px 20px">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" ' +
           'style="border-collapse:collapse;width:600px;max-width:600px">' +
      // Il marchio, e sotto 23px di stacco come nel disegno.
      '<tr><td align="center" style="padding:0 0 23px">' +
        '<img src="' + VERIFICA_LOGO + '" width="100" height="113" alt="Hextale" ' +
             'style="display:block;width:100px;height:113px;border:0;outline:none">' +
      '</td></tr>' +
      // Il riquadro. Il gradiente del disegno diventa un colore solo: in posta
      // un gradiente CSS non lo disegna quasi nessuno, e mezzo gradiente e'
      // peggio di nessun gradiente.
      // v0.79.35 — niente bordo. Gli angoli arrotondati e il bordo sono due
      // cose che i client di posta trattano separatamente: parecchi disegnano
      // il fondo con gli angoli tondi e il bordo dritto, e quel che si vede e'
      // un rettangolo appoggiato male sopra a un riquadro arrotondato. Senza
      // bordo il riquadro si legge lo stesso — e' il colore a separarlo dalla
      // pagina — e non c'e' piu' niente che possa cadere storto.
      '<tr><td style="background:#333A3A;border-radius:28px;padding:40px">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">' +
          '<tr><td align="center" style="font-family:\'Marcellus SC\',Georgia,\'Times New Roman\',serif;' +
              'font-size:32px;line-height:1.2;color:#EDE0C6;padding:0 0 12px;mso-line-height-rule:exactly">' +
            TITOLO + '</td></tr>' +
          // La riga di stacco: nel disegno e' bianco al 10% su un pannello
          // scuro, cioe' questo colore. Un <hr> in posta si veste da solo in
          // modi diversi a seconda del client: meglio una cella alta 1px.
          '<tr><td style="padding:9px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
              'style="border-collapse:collapse"><tr><td style="height:1px;background:#464C4C;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>' +
          '<tr><td align="center" style="font-family:Rosarivo,Georgia,\'Times New Roman\',serif;' +
              'font-size:20px;line-height:1.2;color:#CCCCCC;padding:12px 0 0;mso-line-height-rule:exactly">' +
            RIGA1 + '<br>' + RIGA2 + '</td></tr>' +
          '<tr><td align="center" style="padding:28px 0 4px">' +
            '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate">' +
              '<tr>' + cifre + '</tr>' +
            '</table></td></tr>' +
          '<tr><td align="center" style="font-family:Rosarivo,Georgia,\'Times New Roman\',serif;' +
              'font-size:14px;line-height:1.4;color:#8A9A9C;padding:22px 0 0">' +
            NOTA + '</td></tr>' +
        '</table>' +
      '</td></tr>' +
    '</table>' +
  '</td></tr></table></body></html>';
}
// La versione scritta, per chi legge la posta senza figure. Non e' un ripiego
// di seconda scelta: e' la stessa cosa detta senza disegno, e per un codice da
// copiare va bene uguale.
function _verificaTesto(nome, codice, dice) {
  dice = dice || {};
  return [
    dice.testo1 || ('Hey ' + nome + ', welcome to Hextale!'),
    '',
    dice.testo2 || 'Here is the 6 digit code to activate your account:',
    '',
    '    ' + codice.split('').join(' '),
    '',
    dice.testo3 || 'Type it in the game to finish creating your account.',
    dice.testo4 || ('The code expires in ' + VERIFICA_ORE + ' hours.'),
    '',
    dice.testo5 || 'If you did not create a Hextale account, you can ignore this message.'
  ].join('\n');
}

// Spedisce il codice. Torna true solo se la posta l'ha davvero preso in
// carico: qui, a differenza della segnalazione di un guasto, un fallimento va
// detto in faccia a chi ha chiamato — senza quella email il giocatore non ha
// nessun altro modo di sapere il codice.
function _spedisciCodice(nk, logger, email, nome, codice, dice) {
  var cfg = _postaConfig(nk);
  if (!cfg) { logger.warn('posta non configurata: il codice non parte'); return false; }
  dice = dice || {};
  var corpo = {
    a: email,
    oggetto: dice.oggetto || ('Your Hextale activation code: ' + codice),
    testo: _verificaTesto(nome, codice, dice),
    html: _verificaHtml(nome, codice, dice)
  };
  try {
    var intestazioni = { 'Content-Type': 'application/json' };
    if (cfg.chiave) intestazioni['X-Hextale-Chiave'] = cfg.chiave;
    var r = nk.httpRequest(POSTA_URL, 'post', intestazioni, JSON.stringify(corpo), 25000);
    if (r.code >= 200 && r.code < 300) return true;
    logger.warn('la posta ha risposto %d al codice di verifica: %s', r.code, String(r.body).slice(0, 300));
  } catch (e) {
    logger.warn('il codice di verifica non e partito: %s', String(e));
  }
  return false;
}

var VERIFICA_MS = VERIFICA_ORE * 3600 * 1000;

// Questo account ha confermato la sua casella? La domanda sta in una funzione
// sola perche' da oggi la fanno in tre — la schermata del codice, la coda del
// matchmaking e la porta della partita — e tre copie della stessa regola
// divergono alla prima modifica.
// Chi non ha l'oggetto scritto e' chi si e' registrato prima che questa
// verifica esistesse: verificato. Vale qui come in rpcVerificaStato, ed e' la
// stessa riga di ragionamento — non gli si puo' chiedere un codice che nessuno
// gli ha mai mandato.
function _verificato(nk, userId) {
  try {
    var v = leggiVerifica(nk, userId);
    return !v || !!v.verificato;
  } catch (e) {
    // Una lettura andata storta non deve chiudere fuori chi ha fatto tutto
    // giusto: nel dubbio si lascia passare, come fa il client. Il prezzo
    // dell'errore non e' lo stesso nei due versi.
    return true;
  }
}

// ── v0.79.32 — E CHI NON HA VERIFICATO NON CERCA AVVERSARI ────────────────
// Il gioco gia' non lo lascerebbe arrivare al menu (vedi accessoEntra), ma
// quello e' il client: e' una cortesia, non una regola. La regola sta qui,
// sulla porta della coda, che e' l'unico modo di entrare in una partita in
// rete — partitaJoinAttempt rifiuta chiunque non sia stato accoppiato, quindi
// non accoppiarsi vuol dire non giocare.
// Si alza un errore invece di restituire una busta vuota: il matchmaker
// prenderebbe una busta senza query come una richiesta buona, e il giocatore
// resterebbe in coda per sempre senza sapere perche'.
function primaDiCercare(ctx, logger, nk, envelope) {
  if (ctx.userId && !_verificato(nk, ctx.userId)) {
    logger.info('coda rifiutata a %s: casella non ancora verificata', ctx.userId);
    throw Error('verifica la tua email prima di giocare in rete');
  }
  return envelope;
}

// Dove sta questo account: gia' verificato, o gli si deve ancora chiedere il
// codice. Il codice NON esce mai da qui.
function rpcVerificaStato(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var v = leggiVerifica(nk, ctx.userId);
  if (!v) return JSON.stringify({ verificato: true, mai: true });
  var conto = nk.accountGetId(ctx.userId);
  return JSON.stringify({
    verificato: !!v.verificato,
    mai: false,
    email: (conto && conto.email) || '',
    scaduto: !v.verificato && !!v.quando && (Date.now() - v.quando) > VERIFICA_MS
  });
}

// Manda (o rimanda) il codice. Genera SEMPRE un codice nuovo: rimandare il
// vecchio vorrebbe dire che un codice vissuto in una casella per ore vale
// ancora, e l'attesa fra un invio e l'altro esiste proprio perche' questa
// chiamata costa una email vera.
function rpcVerificaInvia(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var conto = nk.accountGetId(ctx.userId);
  var email = (conto && conto.email) || '';
  if (!email) throw Error('questo account non ha una email');

  var v = leggiVerifica(nk, ctx.userId) || { verificato: false };
  if (v.verificato) return JSON.stringify({ gia: true });

  var ora = Date.now();
  if (v.inviato && (ora - v.inviato) < VERIFICA_ATTESA_S * 1000) {
    var restano = Math.ceil((VERIFICA_ATTESA_S * 1000 - (ora - v.inviato)) / 1000);
    return JSON.stringify({ inviato: false, aspetta: restano });
  }

  var codice = _codiceASeiCifre(nk);
  var nome = _nomeDallEmail(email);
  var andata = _spedisciCodice(nk, logger, email, nome, codice);
  if (!andata) throw Error('non riesco a mandare l email: riprova fra poco');

  // Si scrive DOPO la spedizione riuscita: se la posta non parte, il codice
  // vecchio resta valido invece di essere sostituito da uno che nessuno ha mai
  // ricevuto. I tentativi ripartono da zero, perche' il codice e' un altro.
  scriviVerifica(nk, ctx.userId, {
    codice: codice, quando: ora, inviato: ora, tentativi: 0, verificato: false
  });
  logger.info('codice di verifica spedito a %s', ctx.userId);
  return JSON.stringify({ inviato: true, aspetta: VERIFICA_ATTESA_S });
}

// Il confronto. Chi sbaglia troppe volte deve chiedere un codice nuovo: senza
// un tetto, sei cifre si provano tutte.
function rpcVerificaProva(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var d = {};
  try { d = payload ? JSON.parse(payload) : {}; } catch (e) { d = {}; }
  var dato = String(d.codice || '').replace(/[^0-9]/g, '');

  var v = leggiVerifica(nk, ctx.userId);
  if (!v) return JSON.stringify({ ok: true, mai: true });
  if (v.verificato) return JSON.stringify({ ok: true });

  if (v.quando && (Date.now() - v.quando) > VERIFICA_MS)
    throw Error('questo codice e scaduto: chiedine uno nuovo');
  if ((v.tentativi || 0) >= VERIFICA_TENTATIVI)
    throw Error('troppi tentativi: chiedi un codice nuovo');
  if (dato.length !== 6) throw Error('servono sei cifre');

  if (dato !== String(v.codice)) {
    v.tentativi = (v.tentativi || 0) + 1;
    scriviVerifica(nk, ctx.userId, v);
    var restano = VERIFICA_TENTATIVI - v.tentativi;
    throw Error(restano > 0
      ? ('codice sbagliato: ti restano ' + restano + ' tentativi')
      : 'codice sbagliato: chiedi un codice nuovo');
  }

  // Giusto. Il codice si CANCELLA: tenerlo scritto accanto a "verificato:true"
  // sarebbe una cifra che non serve piu' a niente e che resta li' per sempre.
  scriviVerifica(nk, ctx.userId, { verificato: true, quando: v.quando, fatto: Date.now() });
  logger.info('account %s verificato', ctx.userId);
  return JSON.stringify({ ok: true });
}

// ══════════════════════════════════════════════════════════════════════════
// v0.79.34 — "FORGOT PASSWORD": SEI CIFRE, DI NUOVO
// ══════════════════════════════════════════════════════════════════════════
// Stesso gesto della verifica, all'altro capo: chi non riesce piu' a entrare
// chiede un codice alla propria casella e con quello sceglie una password
// nuova. E' anche lo stesso disegno di email — cambiano le parole, non la
// forma (vedi _verificaHtml, che adesso le prende da fuori).
//
// PERCHE' QUESTE DUE PORTE SONO DIVERSE DA TUTTE LE ALTRE. Chi ha perso la
// password non ha una sessione, e senza sessione Nakama non risponde: provato,
// e risponde 401 anche con la chiave pubblica del client. L'unica chiave che
// apre una RPC senza sessione e' quella del runtime, che e' un segreto e non
// puo' viaggiare dentro al gioco.
// Quindi non ci arriva il gioco: ci arriva CADDY, che sta gia' davanti a
// Nakama e la chiave ce l'ha nel proprio ambiente. Due indirizzi pubblici e
// due soli — /recupero/chiedi e /recupero/cambia — riscritti in queste due
// RPC. Non un passaggio generico "chiama la RPC che vuoi": quello sarebbe
// consegnare al mondo la chiave del server con un giro in piu'.
// Vedi server/caddy/Caddyfile.
//
// DI CONSEGUENZA QUI ctx.userId E' VUOTO: non c'e' nessun giocatore collegato,
// e tutto quello che si sa e' l'email che e' stata scritta nella casella. Per
// questo lo stato non sta nel profilo di nessuno ma in un oggetto di sistema,
// e la chiave e' l'email.
var VERIFICA_RECUPERO_ORE = 1;   // un codice per rientrare vale meno a lungo
var RECUPERO_TENTATIVI = 8;
var RECUPERO_ATTESA_S = 60;

function _chiaveRecupero(email) {
  return 'recupero-' + String(email || '').toLowerCase().slice(0, 100);
}
// L'email come la scriverebbe chiunque: senza spazi e tutta minuscola. Nakama
// le tiene minuscole, e un "Mario@..." che non trova niente sarebbe un
// giocatore rimandato a casa per una maiuscola.
function _emailPulita(v) {
  return String(v || '').trim().toLowerCase().slice(0, 200);
}
// Chi ha questa email? Non c'e' una funzione del runtime che lo chieda, ma c'e'
// la porta SQL, e la tabella e' quella di Nakama. Si legge e basta.
function _chiHaLEmail(nk, logger, email) {
  try {
    var righe = nk.sqlQuery('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
    if (righe && righe.length && righe[0].id) return String(righe[0].id);
  } catch (e) {
    logger.error('non riesco a cercare l email: %s', String(e));
  }
  return '';
}

// ── v0.79.35 — "I WANT TO KNOW MORE": LA POSTA DAL SITO ──────────────────
// La finestra dei contatti della pagina d'ingresso. Passa dalla stessa porta
// pubblica del recupero password e per la stessa ragione: chi visita il sito
// non ha nessuna sessione, e senza sessione Nakama non risponde.
//
// NON E' UN MODULO CHE MANDA QUELLO CHE GLI SI DA'. Il destinatario e' scritto
// qui — support@hextalegame.com — e non arriva dalla richiesta: un servizio che
// spedisce a un indirizzo passato da fuori e' un servizio che spedisce posta
// per conto di chiunque, e prima o poi qualcuno se ne accorge. Dalla richiesta
// arrivano solo l'indirizzo di CHI SCRIVE, che finisce nel corpo e nel
// "rispondi a", e il messaggio.
var CONTATTO_ATTESA_S = 30;      // un messaggio ogni mezzo minuto per indirizzo
var CONTATTO_MAX = 4000;         // e non piu' lungo di cosi'

// ══════════════════════════════════════════════════════════════════════════
// v0.79.50 — L'ACCESSO CON GOOGLE, DAL CODICE
// ══════════════════════════════════════════════════════════════════════════
// PERCHE' ADESSO PASSA DI QUI. Fino a ieri il pulsante di Google lo disegnava
// Google: un iframe servito da accounts.google.com, dentro al quale non si
// puo' mettere una riga di stile. In una colonna dove ogni altro pulsante e'
// fatto a mano, quello era l'unico che veniva da un'altra parte e si vedeva.
// Google stessa indica la via d'uscita: chi vuole un pulsante suo non usa il
// token, usa il CODICE DI AUTORIZZAZIONE. Il gioco riceve un codice e non un
// token — e un codice, da solo, non apre niente: va scambiato, e per
// scambiarlo serve il SEGRETO del client, che in un deposito pubblico non puo'
// stare. Da qui il giro: il gioco manda il codice, il server lo scambia, e
// quello che torna indietro e' lo stesso id_token che prima arrivava
// direttamente dal pulsante di Google. Da li' in giu' non cambia niente.
//
// IL SEGRETO STA NELLA MEMORIA DI NAKAMA, come quello del reCAPTCHA e per la
// stessa ragione: ce lo scrive rpcGoogleConfig, che e' l'unico punto in cui
// passa, e non entra mai in git ne' in un file di questo deposito.
//
// "postmessage" NON e' un indirizzo: e' la parola che Google vuole come
// redirect_uri quando il codice arriva da una finestra a comparsa invece che
// da un ritorno sul sito. Scriverci un indirizzo vero farebbe rispondere
// redirect_uri_mismatch.
var KEY_GOOGLE = 'google';
var GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function _googleConfig(nk) {
  var c = null;
  try { c = leggiSistema(nk, KEY_GOOGLE); } catch (e) { c = null; }
  if (!c || !c.cliente || !c.segreto) return null;
  return c;
}

// Il codice in cambio dell'id_token. Non autentica: quello lo fa il gioco
// subito dopo, con la chiamata che faceva gia' prima. Tenere separate le due
// cose vuol dire che tutto cio' che viene dopo l'accesso — la sessione, il
// ricordo di un mese, il profilo — resta esattamente com'era e non va
// riprovato.
// Si arriva qui SENZA sessione: e' un accesso, una sessione non c'e' ancora.
// L'indirizzo pubblico che ci porta e' /google/entra, scritto per nome nel
// Caddyfile, che aggiunge lui la chiave del runtime.
function rpcGoogleEntra(ctx, logger, nk, payload) {
  var d = {};
  try { d = payload ? JSON.parse(payload) : {}; } catch (e) { d = {}; }
  var codice = String(d.codice || '');
  if (!codice) throw Error('manca il codice');
  var cfg = _googleConfig(nk);
  if (!cfg) {
    // Non si finge che sia un guasto di rete: e' una cosa da configurare, e il
    // registro deve dirlo a chiare lettere o si cerchera' altrove.
    logger.error('accesso con Google chiesto, ma il segreto non e\'stato ancora scritto (vedi rpcGoogleConfig)');
    throw Error('Google sign-in is not configured yet.');
  }
  var corpo = 'code=' + encodeURIComponent(codice)
    + '&client_id=' + encodeURIComponent(cfg.cliente)
    + '&client_secret=' + encodeURIComponent(cfg.segreto)
    + '&redirect_uri=postmessage'
    + '&grant_type=authorization_code';
  var r;
  try {
    r = nk.httpRequest(GOOGLE_TOKEN_URL, 'post',
      { 'Content-Type': 'application/x-www-form-urlencoded' }, corpo, 15000);
  } catch (e) {
    logger.warn('Google non risponde allo scambio: %s', String(e));
    throw Error('Google is unreachable. Try again.');
  }
  var dati = {};
  try { dati = JSON.parse(r.body); } catch (e) { dati = {}; }
  if (!(r.code >= 200 && r.code < 300) || !dati.id_token) {
    // Il codice vale una volta sola e dura pochi minuti: quasi sempre questo
    // vuol dire "riprova", non "sei tu che sbagli".
    logger.info('Google ha rifiutato il codice: %d %s', r.code, String(dati.error || ''));
    throw Error('Google refused the sign-in. Try again.');
  }
  // Torna SOLO l'id_token. Il token d'accesso e quello di rinnovo di Google
  // non servono a niente qui, e cio' che non serve non si consegna.
  return JSON.stringify({ id_token: dati.id_token });
}

// Il segreto del client di Google, scritto una volta da chi lo conosce. Stessa
// forma della configurazione del reCAPTCHA e della posta, e per la stessa
// ragione: la parola d'ordine si sposta da chi ce l'ha alla memoria del server
// senza passare per un file di questo deposito, che e' pubblico.
//
//   curl -s -X POST "https://api.hextalegame.com/v2/rpc/hx_google_config?unwrap&http_key=..." \
//        -H "Content-Type: application/json" \
//        -d '{"cliente":"<client id>.apps.googleusercontent.com","segreto":"<il segreto>"}'
//
// Il client id NON e' un segreto (sta gia' nella pagina), ma si scrive qui
// insieme all'altro: lo scambio vuole tutti e due, e tenerli nello stesso
// posto evita il giorno in cui se ne cambia uno solo.
function rpcGoogleConfig(ctx, logger, nk, payload) {
  if (ctx.userId) {
    var possesso = assicuraPossesso(ctx, nk, logger, ctx.userId, ctx.username);
    if (!possesso.admin) throw Error('non sei un admin');
  }
  var d = {};
  try { d = payload ? JSON.parse(payload) : {}; } catch (e) { d = {}; }
  var cliente = String(d.cliente || '');
  var segreto = String(d.segreto || '');
  if (!cliente || !segreto) throw Error('servono il client id e il segreto');
  scriviSistema(nk, KEY_GOOGLE, { cliente: cliente, segreto: segreto });
  // Il segreto non si riscrive nella risposta ne' nel registro: si dice solo
  // che c'e'.
  logger.info('accesso con Google configurato per %s', cliente);
  return JSON.stringify({ cliente: cliente, segreto: 'impostato' });
}

// ── IL RECAPTCHA ───────────────────────────────────────────────
// Il freno di mezzo minuto per indirizzo ferma chi insiste, non chi ha mille
// indirizzi: un programma che manda posta ne inventa uno diverso ogni volta e
// passa indisturbato. Il reCAPTCHA guarda invece CHI sta scrivendo.
//
// La chiave del sito viaggia nella pagina e non c'e' modo di nasconderla, per
// costruzione. Il SEGRETO — l'altra meta', quella che permette di verificare un
// gettone — sta qui, e "qui" vuol dire nella memoria di Nakama: ce lo scrive
// rpcRecaptchaConfig, che e' l'unico punto in cui passa, e non entra mai in
// git ne' in un file di questo deposito.
//
// FINCHE' IL SEGRETO NON C'E', NON SI VERIFICA NIENTE. E' l'unica scelta
// onesta: rifiutare tutto vorrebbe dire spegnere la finestra dei contatti nel
// momento in cui si aggiunge questo codice, e accettare tutto e' come stiamo
// adesso. Chi accende il segreto accende la verifica, ed e' un gesto solo.
var KEY_RECAPTCHA = 'recaptcha';
var RECAPTCHA_URL = 'https://www.google.com/recaptcha/api/siteverify';
// Sotto questo punteggio Google dice "quasi certamente un programma". 0.5 e' la
// soglia che consiglia Google stesso: piu' in alto si comincia a rifiutare
// persone vere, e una persona vera rifiutata non riprova, se ne va.
var RECAPTCHA_SOGLIA = 0.5;

function _recaptchaSegreto(nk) {
  var c = null;
  try { c = leggiSistema(nk, KEY_RECAPTCHA); } catch (e) { c = null; }
  if (!c || !c.attiva || !c.segreto) return null;
  return c;
}

// true = si puo' passare. Torna true anche quando il reCAPTCHA e' spento.
function _recaptchaVaBene(nk, logger, gettone, ip) {
  var cfg = _recaptchaSegreto(nk);
  if (!cfg) return true;                       // spento: si passa, vedi sopra
  if (!gettone) { logger.info('contatto rifiutato: nessun gettone'); return false; }
  var corpo = 'secret=' + encodeURIComponent(cfg.segreto) + '&response=' + encodeURIComponent(gettone);
  if (ip) corpo += '&remoteip=' + encodeURIComponent(ip);
  var r;
  try {
    r = nk.httpRequest(RECAPTCHA_URL, 'post',
      { 'Content-Type': 'application/x-www-form-urlencoded' }, corpo, 10000);
  } catch (e) {
    // Google non risponde. NON si blocca il messaggio: un guasto loro non deve
    // diventare un silenzio nostro, e il freno per indirizzo c'e' comunque.
    logger.warn('recaptcha irraggiungibile, il messaggio passa lo stesso: %s', String(e));
    return true;
  }
  if (!(r.code >= 200 && r.code < 300)) {
    logger.warn('recaptcha ha risposto %d, il messaggio passa lo stesso', r.code);
    return true;
  }
  var d = {};
  try { d = JSON.parse(r.body); } catch (e) { d = {}; }
  if (!d.success) {
    logger.info('contatto rifiutato dal recaptcha: %s', JSON.stringify(d['error-codes'] || []));
    return false;
  }
  // Il punteggio c'e' solo nella v3. Nella v2 basta il success.
  if (typeof d.score === 'number' && d.score < RECAPTCHA_SOGLIA) {
    logger.info('contatto rifiutato dal recaptcha: punteggio %s', String(d.score));
    return false;
  }
  return true;
}

function rpcContatto(ctx, logger, nk, payload) {
  var d = {};
  try { d = payload ? JSON.parse(payload) : {}; } catch (e) { d = {}; }
  var email = _emailPulita(d.email);
  var testo = String(d.messaggio || '').slice(0, CONTATTO_MAX).trim();
  if (!email || email.indexOf('@') < 1) throw Error('scrivi un indirizzo email');
  if (testo.length < 10) throw Error('scrivi qualcosa di piu');

  // Prima di ogni altra cosa, e prima del freno: se non e' una persona, non c'e'
  // niente da frenare e niente da spedire.
  var ip = null;
  try { ip = ctx && ctx.clientIp ? String(ctx.clientIp) : null; } catch (e) { ip = null; }
  if (!_recaptchaVaBene(nk, logger, d.gettone, ip)) {
    // Non si dice "sei un programma": chi lo e' non legge, e a una persona
    // rifiutata per sbaglio serve sapere che c'e' un'altra strada.
    throw Error('non riesco a mandare l email, scrivi a support@hextalegame.com');
  }

  // Lo stesso freno del recupero, e per lo stesso motivo: ogni chiamata qui e'
  // una email vera.
  var chiave = 'contatto-' + email.slice(0, 100);
  var prima = null;
  try { prima = leggiSistema(nk, chiave); } catch (e) { prima = null; }
  var ora = Date.now();
  if (prima && prima.quando && (ora - prima.quando) < CONTATTO_ATTESA_S * 1000) {
    return JSON.stringify({ inviato: true, ripetuto: true });
  }

  var cfg = _postaConfig(nk);
  if (!cfg) { logger.warn('posta non configurata: il messaggio dal sito non parte'); throw Error('non riesco a mandare l email'); }
  var corpo = {
    a: SEGN_DESTINATARIO,
    oggetto: '[Hextale] Message from the website - ' + email,
    testo: 'From: ' + email + '\n\n' + testo,
    html: '<div style="background:#141B1C;padding:26px;font-family:Georgia,serif">' +
          '<div style="max-width:640px;margin:0 auto;background:#333A3A;border-radius:14px;padding:26px;color:#EDE0C6">' +
          '<div style="font:bold 22px/1.2 Georgia,serif;margin-bottom:14px">Message from the website</div>' +
          '<div style="color:#8a9a9c;font-size:14px;margin-bottom:18px">From: <span style="color:#EDE0C6">' + _html(email) + '</span></div>' +
          '<div style="height:1px;background:#464C4C;margin:0 0 18px"></div>' +
          '<div style="font:16px/1.5 Georgia,serif;white-space:pre-wrap">' + _html(testo) + '</div>' +
          '</div></div>'
  };
  try {
    var intestazioni = { 'Content-Type': 'application/json' };
    if (cfg.chiave) intestazioni['X-Hextale-Chiave'] = cfg.chiave;
    var r = nk.httpRequest(POSTA_URL, 'post', intestazioni, JSON.stringify(corpo), 25000);
    if (!(r.code >= 200 && r.code < 300)) {
      logger.warn('la posta ha risposto %d al messaggio dal sito', r.code);
      throw Error('non riesco a mandare l email');
    }
  } catch (e) {
    logger.warn('il messaggio dal sito non e partito: %s', String(e));
    throw Error('non riesco a mandare l email');
  }
  scriviSistema(nk, chiave, { quando: ora });
  logger.info('messaggio dal sito, da %s', email);
  return JSON.stringify({ inviato: true });
}

function rpcRecuperoChiedi(ctx, logger, nk, payload) {
  var d = {};
  try { d = payload ? JSON.parse(payload) : {}; } catch (e) { d = {}; }
  var email = _emailPulita(d.email);
  if (!email || email.indexOf('@') < 0) throw Error('scrivi un indirizzo email');

  // ── SI RISPONDE SEMPRE DI SI' ────────────────────────────────────────────
  // Anche se quell'indirizzo non e' di nessuno. Rispondere "questa email non
  // esiste" trasformerebbe questa porta in un elenco: chiunque potrebbe
  // provare mille indirizzi e sapere quali sono iscritti. Chi ha davvero un
  // account riceve il codice, chi non ce l'ha non riceve niente e legge la
  // stessa frase.
  var chi = _chiHaLEmail(nk, logger, email);
  if (!chi) {
    logger.info('recupero chiesto per un indirizzo che non e di nessuno');
    return JSON.stringify({ inviato: true });
  }

  var chiave = _chiaveRecupero(email);
  var prima = null;
  try { prima = leggiSistema(nk, chiave); } catch (e) { prima = null; }
  var ora = Date.now();
  if (prima && prima.inviato && (ora - prima.inviato) < RECUPERO_ATTESA_S * 1000) {
    return JSON.stringify({ inviato: true, aspetta: Math.ceil((RECUPERO_ATTESA_S * 1000 - (ora - prima.inviato)) / 1000) });
  }

  var codice = _codiceASeiCifre(nk);
  var nome = _nomeDallEmail(email);
  var andata = _spedisciCodice(nk, logger, email, nome, codice, {
    oggetto: 'Your Hextale password reset code: ' + codice,
    titolo: 'Password reset',
    riga1: 'Hey ' + _html(nome) + ',',
    riga2: 'Here&rsquo;s the 6 digit code to choose a new password:',
    nota: 'The code expires in ' + VERIFICA_RECUPERO_ORE + ' hour. ' +
          'If you did not ask to reset your password, you can ignore this message ' +
          'and nothing will change.',
    testo1: 'Hey ' + nome + ',',
    testo2: 'Here is the 6 digit code to choose a new password:',
    testo3: 'Type it in the game to set your new password.',
    testo4: 'The code expires in ' + VERIFICA_RECUPERO_ORE + ' hour.',
    testo5: 'If you did not ask to reset your password, you can ignore this message and nothing will change.'
  });
  if (!andata) throw Error('non riesco a mandare l email: riprova fra poco');

  scriviSistema(nk, chiave, {
    chi: chi, codice: codice, quando: ora, inviato: ora, tentativi: 0
  });
  logger.info('codice di recupero spedito a %s', chi);
  return JSON.stringify({ inviato: true, aspetta: RECUPERO_ATTESA_S });
}

function rpcRecuperoCambia(ctx, logger, nk, payload) {
  var d = {};
  try { d = payload ? JSON.parse(payload) : {}; } catch (e) { d = {}; }
  var email = _emailPulita(d.email);
  var dato = String(d.codice || '').replace(/[^0-9]/g, '');
  var nuova = String(d.password || '');

  // La password si controlla PRIMA di toccare qualunque cosa: piu' sotto il
  // cambio passa da uno stacco e un riattacco, e l'unico modo di non trovarsi
  // a meta' e' non cominciare se non si puo' finire.
  if (nuova.length < 8) throw Error('la password deve essere di almeno 8 caratteri');
  if (!email) throw Error('scrivi un indirizzo email');

  var chiave = _chiaveRecupero(email);
  var v = null;
  try { v = leggiSistema(nk, chiave); } catch (e) { v = null; }
  // Nessuna richiesta in corso: non si dice "questa email non ha chiesto
  // niente" — si dice che il codice non va bene, che e' vero e non racconta
  // niente a chi sta tirando a indovinare.
  if (!v || !v.codice) throw Error('codice sbagliato o scaduto');
  if (v.quando && (Date.now() - v.quando) > VERIFICA_RECUPERO_ORE * 3600 * 1000)
    throw Error('questo codice e scaduto: chiedine uno nuovo');
  if ((v.tentativi || 0) >= RECUPERO_TENTATIVI)
    throw Error('troppi tentativi: chiedi un codice nuovo');
  if (dato.length !== 6) throw Error('servono sei cifre');
  if (dato !== String(v.codice)) {
    v.tentativi = (v.tentativi || 0) + 1;
    scriviSistema(nk, chiave, v);
    var restano = RECUPERO_TENTATIVI - v.tentativi;
    throw Error(restano > 0 ? ('codice sbagliato: ti restano ' + restano + ' tentativi')
                            : 'codice sbagliato: chiedi un codice nuovo');
  }

  // ── IL CAMBIO ────────────────────────────────────────────────────────────
  // Il runtime non ha una funzione "cambia la password". La strada che sembra
  // ovvia — staccare l'email e riattaccarla con quella nuova — NON funziona, ed
  // e' un bene che non funzioni: Nakama rifiuta di staccare l'ultima identita'
  // di un account ("Cannot unlink last account identifier"), e un account con
  // la sola email e' quasi ogni account. Provato sul server, risponde
  // PermissionDenied.
  //
  // Si scrive quindi dove la password sta davvero. La riga qui sotto e' una
  // sola istruzione e non lascia nessun istante in cui l'account e' a meta',
  // che e' il difetto vero dell'altra strada: li' fra lo stacco e il
  // riattacco esisteva un momento in cui un giocatore non aveva piu' modo di
  // entrare, e bastava un errore in mezzo perche' quel momento non finisse.
  //
  // `crypt` con `gen_salt('bf', 10)` produce un bcrypt $2a$10, che e'
  // esattamente quello che Nakama scrive e legge; la colonna e' `bytea`, per
  // questo il testo va convertito. Il costo 10 non e' un dettaglio: il
  // predefinito di gen_salt e' 6, che sarebbe una password piu' debole di
  // quelle scritte da Nakama stessa.
  // La password viaggia come PARAMETRO e non dentro alla stringa: cosi' non
  // esiste nessun modo di scrivere una password che diventi SQL.
  try {
    nk.sqlExec(
      "UPDATE users SET password = convert_to(crypt($2, gen_salt('bf', 10)), 'UTF8'), update_time = now() WHERE id = $1::uuid",
      [v.chi, nuova]);
  } catch (e) {
    logger.error('recupero: non riesco a scrivere la password di %s: %s', v.chi, String(e));
    throw Error('non riesco a cambiare la password: scrivici');
  }
  // E si prova. Non e' una cerimonia: e' l'unico modo di sapere che la password
  // scritta e' davvero quella con cui si entra, invece di dirlo al giocatore e
  // scoprirlo insieme a lui la volta dopo.
  var prova = null;
  try { prova = nk.authenticateEmail(email, nuova, '', false); } catch (e) { prova = null; }
  if (!prova || prova.userId !== v.chi) {
    logger.error('RECUPERO SOSPETTO: %s dice di avere la password nuova ma non entra', v.chi);
    throw Error('non riesco a cambiare la password: scrivici');
  }

  // Fatto: il codice si butta. Un codice speso che resta scritto e' un codice
  // che qualcuno potrebbe rispendere.
  try { nk.storageDelete([{ collection: COLL_SISTEMA, key: chiave, userId: '00000000-0000-0000-0000-000000000000' }]); }
  catch (e) { logger.warn('codice di recupero non cancellato: %s', String(e)); }
  logger.info('password cambiata per %s', v.chi);
  return JSON.stringify({ ok: true });
}

// Si scrive una volta, da un admin, e non compare mai in questo file:
//   {"chiave":"<la stessa che sta nell'ambiente del servizio di inoltro>"}
// Due strade, come per l'importazione del catalogo:
//   - dal gioco, da un admin;
//   - da fuori con la chiave http del runtime, che e' come si configura una
//     macchina: senza sessione, senza account, da una riga di comando.
// La seconda esiste perche' questa chiamata porta una parola d'ordine, e una
// parola d'ordine si sposta da un file all'altro sulla stessa macchina — non
// passa per le mani di nessuno.
// Il segreto del reCAPTCHA, scritto una volta da chi lo conosce. Stessa forma
// della configurazione della posta, e per la stessa ragione: la parola d'ordine
// si sposta da chi ce l'ha alla memoria del server senza passare per un file di
// questo deposito, che e' pubblico.
//
//   curl -s -X POST "https://api.hextalegame.com/v2/rpc/hx_recaptcha_config?unwrap&http_key=..." \
//        -H "Content-Type: application/json" \
//        -d '{"attiva":true,"segreto":"<il segreto di Google>"}'
//
// Per spegnerlo: {"attiva":false}.
function rpcRecaptchaConfig(ctx, logger, nk, payload) {
  if (ctx.userId) {
    var possesso = assicuraPossesso(ctx, nk, logger, ctx.userId, ctx.username);
    if (!possesso.admin) throw Error('non sei un admin');
  }
  var d = {};
  try { d = payload ? JSON.parse(payload) : {}; } catch (e) { d = {}; }
  var attiva = !!d.attiva;
  var segreto = String(d.segreto || '');
  if (attiva && !segreto) throw Error('serve il segreto');
  scriviSistema(nk, KEY_RECAPTCHA, { attiva: attiva, segreto: segreto });
  // Il segreto non si riscrive nella risposta ne' nel registro: si dice solo
  // che c'e'.
  logger.info('recaptcha %s', attiva ? 'acceso' : 'spento');
  return JSON.stringify({ attiva: attiva, segreto: segreto ? 'impostato' : 'nessuno' });
}

function rpcPostaConfig(ctx, logger, nk, payload) {
  if (ctx.userId) {
    var possesso = assicuraPossesso(ctx, nk, logger, ctx.userId, ctx.username);
    if (!possesso.admin) throw Error('non sei un admin');
  }
  var d = {};
  try { d = payload ? JSON.parse(payload) : {}; } catch (e) { d = {}; }
  // Accendere la posta e' un fatto solo: {"attiva":true}. La chiave si aggiunge
  // se la si e' messa anche nel servizio di inoltro, e chi la scrive e' chi la
  // conosce — non passa da nessun'altra parte.
  scriviSistema(nk, KEY_POSTA, {
    attiva: d.attiva === false ? false : true,
    chiave: String(d.chiave || '')
  });
  logger.info('posta configurata da %s', ctx.userId);
  // La chiave non torna indietro: chi l'ha scritta ce l'ha gia', e chiunque
  // altro non deve poterla rileggere da qui.
  return JSON.stringify({ fatto: true });
}

function rpcSegnalazione(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var dentro = {};
  try { dentro = payload ? JSON.parse(payload) : {}; } catch (e) { dentro = {}; }

  var categoria = String(dentro.categoria || '');
  if (!_inElenco(SEGN_CATEGORIE, categoria)) throw Error('categoria non valida');
  var frequenza = String(dentro.frequenza || '');
  if (!_inElenco(SEGN_FREQUENZE, frequenza)) throw Error('frequenza non valida');
  var cosa = _testoPulito(dentro.cosa);
  if (!cosa) throw Error('serve una descrizione');

  var foto = String(dentro.schermata || '');
  var conFoto = foto.length > 0 && foto.length <= SEGN_FOTO_MAX;
  if (foto.length > SEGN_FOTO_MAX) {
    logger.info('segnalazione di %s: figura da %d byte, troppo grande, si salva senza', ctx.userId, foto.length);
  }

  var quando = Date.now();
  var chiave = 'segn-' + quando + '-' + Math.floor(Math.random() * 1e6);
  // Il numero si prende PRIMA di scrivere: se la scrittura fallisce si e'
  // bruciato un numero, e un buco in una numerazione non fa male a nessuno.
  // Al contrario — prenderlo dopo vorrebbe dire che due segnalazioni scritte
  // nello stesso istante possono ricevere lo stesso.
  var numero = 1;
  try {
    var conto = leggiSistema(nk, KEY_SEGN_CONTO);
    numero = ((conto && typeof conto.ultimo === 'number') ? conto.ultimo : 0) + 1;
    scriviSistema(nk, KEY_SEGN_CONTO, { ultimo: numero });
  } catch (eN) { logger.warn('numero della segnalazione non assegnato: %s', String(eN)); }
  var segnalazione = {
    numero: numero,
    quando: quando,
    chi: ctx.userId,
    nome: ctx.username || '',
    categoria: categoria,
    frequenza: frequenza,
    cosa: cosa,
    atteso: _testoPulito(dentro.atteso),
    versione: _testoPulito(dentro.versione).slice(0, 20),
    schermo: _testoPulito(dentro.schermo).slice(0, 40),
    agente: _testoPulito(dentro.agente).slice(0, 300),
    conFoto: conFoto
  };
  // La figura in un oggetto SUO. Cosi' chi legge l'elenco delle segnalazioni
  // si porta dietro solo il testo — e un elenco che pesa un megabyte a riga
  // non lo apre nessuno.
  nk.storageWrite([{
    collection: COLL_SEGNALAZIONI, key: chiave,
    userId: '00000000-0000-0000-0000-000000000000',
    value: segnalazione,
    permissionRead: 0, permissionWrite: 0
  }]);
  if (conFoto) {
    try {
      nk.storageWrite([{
        collection: COLL_SEGNALAZIONI, key: chiave + '-foto',
        userId: '00000000-0000-0000-0000-000000000000',
        value: { dati: foto },
        permissionRead: 0, permissionWrite: 0
      }]);
    } catch (e) {
      // Il racconto e' gia' salvato: se la figura non entra, si perde la
      // figura e non la segnalazione.
      logger.warn('figura della segnalazione %s non scritta: %s', chiave, String(e));
    }
  }
  logger.info('segnalazione da %s (%s): %s', ctx.userId, categoria, chiave);
  // E parte per posta. DOPO il salvataggio, e senza poter far fallire niente:
  // la segnalazione e' gia' al sicuro, e il giocatore ha gia' fatto la sua
  // parte. Se la posta e' giu', a saperlo e' il registro del server.
  var spedita = _spedisciSegnalazione(nk, logger, segnalazione, chiave, conFoto ? foto : '');
  return JSON.stringify({ ricevuta: true, spedita: spedita, numero: numero });
}

// ══════════════════════════════════════════════════════════════════════════
// v0.79.70 — SEGNALARE UN GIOCATORE
// ══════════════════════════════════════════════════════════════════════════
// Somiglia alla segnalazione di un difetto e non lo e': qui si parla di una
// PERSONA, e le due differenze che contano sono tutte e due di fiducia.
//
// CHI SEGNALA lo dice ctx.userId, e non e' negoziabile: una segnalazione
// anonima non si puo' valutare, e una firmata da chi vuole si puo' usare per
// far cadere la colpa su un altro.
//
// CHI E' SEGNALATO NON LO DICE IL CLIENT. Il client manda l'identificativo
// del TAVOLO; a dire chi ci stava seduto e' il registro scritto dal server
// quando la partita e' cominciata (vedi COLL_PARTITE). E' l'unico punto
// delicato di tutta questa strada: se il nome dell'accusato arrivasse dal
// client, chiunque potrebbe segnalare chiunque senza averlo mai incontrato.
// Senza partita — o con una che il registro non conosce — la segnalazione si
// prende lo stesso, ma senza un nome addosso: e' una lamentela che qualcuno
// leggera', non un'accusa a una persona, e nell'email si vede la differenza.
function _altroGiocatore(nk, logger, matchId, chi) {
  if (!matchId) return '';
  try {
    var r = nk.storageRead([{ collection: COLL_PARTITE, key: matchId,
      userId: '00000000-0000-0000-0000-000000000000' }]);
    var v = (r && r.length && r[0].value) ? r[0].value : null;
    var g = (v && v.giocatori) || [];
    if (g.length !== 2) return '';
    // E chi segnala dev'essere uno dei due. Non e' un dettaglio: senza questo
    // basterebbe conoscere l'identificativo di un tavolo altrui per
    // segnalarne un giocatore.
    if (g[0] === chi) return g[1];
    if (g[1] === chi) return g[0];
    logger.warn('report: %s non giocava nella partita %s', chi, matchId);
    return '';
  } catch (e) { logger.warn('report: registro della partita %s illeggibile: %s', matchId, String(e)); return ''; }
}
function rpcReport(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var dentro = {};
  try { dentro = payload ? JSON.parse(payload) : {}; } catch (e) { dentro = {}; }

  var motivo = String(dentro.motivo || '');
  if (!_inElenco(REPORT_MOTIVI, motivo)) throw Error('motivo non valido');
  var testo = _testoPulito(dentro.testo);
  if (!testo) throw Error('serve una descrizione');

  var matchId = _testoPulito(dentro.partita).slice(0, 80);
  var accusato = _altroGiocatore(nk, logger, matchId, ctx.userId);
  var accusatoNome = '';
  if (accusato) {
    // Il nome vero, chiesto al server. Quello che il client ha visto puo'
    // essere cambiato nel frattempo, e comunque non e' lui a doverlo dire.
    try {
      var conti = nk.usersGetId([accusato]);
      if (conti && conti.length) accusatoNome = conti[0].username || '';
    } catch (eU) { logger.warn('report: nome di %s non letto: %s', accusato, String(eU)); }
  }

  var quando = Date.now();
  var chiave = 'rep-' + quando + '-' + Math.floor(Math.random() * 1e6);
  var numero = 1;
  try {
    var conto = leggiSistema(nk, KEY_REPORT_CONTO);
    numero = ((conto && typeof conto.ultimo === 'number') ? conto.ultimo : 0) + 1;
    scriviSistema(nk, KEY_REPORT_CONTO, { ultimo: numero });
  } catch (eN) { logger.warn('numero del report non assegnato: %s', String(eN)); }

  var report = {
    numero: numero,
    quando: quando,
    chi: ctx.userId,
    nome: ctx.username || '',
    accusato: accusato,
    accusatoNome: accusatoNome,
    partita: matchId,
    motivo: motivo,
    testo: testo,
    versione: _testoPulito(dentro.versione).slice(0, 20)
  };
  nk.storageWrite([{
    collection: COLL_REPORT, key: chiave,
    userId: '00000000-0000-0000-0000-000000000000',
    value: report,
    permissionRead: 0, permissionWrite: 0
  }]);
  logger.info('report da %s su %s (%s): %s', ctx.userId, accusato || '(ignoto)', motivo, chiave);
  var spedita = _spedisciReport(nk, logger, report, chiave);
  return JSON.stringify({ ricevuta: true, spedita: spedita, numero: numero });
}

// L'email. Stesso vestito della segnalazione di un difetto — stessa busta,
// stesso marchio, stesso numero grosso in cima — perche' chi legge quella
// casella non deve imparare due modi di leggere.
function _reportRighe(s) {
  return [
    ['Reason', _etichetta(s.motivo)],
    ['Reported', (s.accusato ? ((s.accusatoNome || '(no name)') + '  [' + s.accusato + ']')
                             : 'NOT IDENTIFIED - no match on record')],
    ['Reported by', (s.nome || '(no name)') + '  [' + s.chi + ']'],
    ['Match', s.partita || '(none)'],
    ['Version', s.versione || '?']
  ];
}
function _spedisciReport(nk, logger, s, chiave) {
  var cfg = _postaConfig(nk);
  if (!cfg) { logger.info('posta non configurata: il report %s resta solo sul server', chiave); return false; }
  var righe = _reportRighe(s);
  var blocchi = [['What happened', s.testo]];
  var piede = 'On the server: ' + COLL_REPORT + '/' + chiave;
  var corpo = {
    a: SEGN_DESTINATARIO,
    oggetto: '[Hextale] Player report n. ' + s.numero + ' - ' + _etichetta(s.motivo),
    testo: _postaTestoGenerico('Player report n. ' + s.numero, righe, blocchi, [piede]),
    html: _postaHtmlGenerico('Player report n&deg; ' + s.numero, righe, blocchi, _html(piede)),
    allegato: ''
  };
  return _spedisci(nk, logger, cfg, corpo, chiave);
}

// ── v0.79.8 — AZZERARE L'ATTESA DELLA BUSTINA, DAL MENU DI DEBUG ──────────
// Il pulsante c'era gia' e non funzionava piu': cancellava una chiave di
// localStorage, e dalla v0.77.90 l'attesa non sta piu' li' — la tiene il
// server (possesso.bustinaProssima), che e' il motivo per cui era stata
// spostata: nel browser bastava svuotare una chiave per avere una bustina
// subito. Da allora il pulsante svuotava una chiave che non leggeva piu'
// nessuno e non diceva niente a nessuno.
//
// Adesso lo fa il server, ed e' RISERVATO AGLI ADMIN. Non e' una precauzione
// di forma: senza quel controllo questa e' esattamente la strada che la
// v0.77.90 aveva chiuso — chiunque potrebbe chiamarla e avere una bustina ogni
// volta che vuole. La finestra di debug e' gia' chiusa ai non-admin, ma una
// finestra si salta; una domanda al server no.
function rpcBustinaAzzera(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var possesso = assicuraPossesso(ctx, nk, logger, ctx.userId, ctx.username);
  if (!possesso.admin) throw Error('non sei un admin');
  possesso.bustinaProssima = 0;
  scriviPossesso(nk, ctx.userId, possesso);
  logger.info('attesa bustina azzerata da %s', ctx.userId);
  return JSON.stringify({ bustinaProssima: 0 });
}

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

  // v0.79.13 — il terzo argomento e' il NOME UTENTE, e vuole una stringa: con
  // `null` il runtime alza "TypeError: expects string" e la cancellazione
  // falliva sempre. Non si vedeva perche' l'unica strada per arrivarci
  // passava dalla finestra, e la finestra si prova solo cancellando un account
  // vero. E' saltata fuori alla prima prova fatta davvero, dal server.
  // Con create=false quel nome non serve a cercare nessuno — conta che sia una
  // stringa — e il piu' onesto da passare e' il proprio.
  var chi = nk.authenticateEmail(email, password, ctx.username || '', false);
  if (!chi || chi.userId !== ctx.userId) throw Error('password sbagliata');

  // v0.79.34 — e KEY_VERIFICA. Era rimasta fuori quando la verifica e' nata
  // (v0.79.31): cancellando un account restava indietro il suo segno, e chi si
  // fosse riscritto con la stessa email avrebbe trovato un oggetto vecchio che
  // parlava di un account che non esiste piu'.
  var chiavi = [KEY_POSSESSO, KEY_MAZZI, KEY_STAGIONE, KEY_BUSTINA, KEY_VERIFICA, 'stato'];
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

  // ── v0.79.78 — LE QUEST DEL GIORNO SI GENERANO QUI ──────────────────────
  // Alla v0.79.75 questa riga non c'era, e il difetto era quello di un
  // cameriere che porta il conto senza aver portato da mangiare: due righe
  // piu' giu' il profilo RACCONTAVA le quest (questPerIlClient) ma nessuno le
  // aveva mai CREATE. Chi non aveva ancora finito una partita — cioe' chiunque
  // aprisse il menu — riceveva una lista vuota e vedeva il riquadro vuoto.
  // Le altre due porte (hx_quest e hx_quest_riscuoti) la chiamavano, ma le
  // chiama solo chi ha gia' qualcosa da raccontare: a fine partita, o
  // premendo un pulsante che senza quest non compare. Il giro si chiudeva su
  // se stesso.
  //
  // Questa e' la porta da cui passa CHIUNQUE apra il gioco, ed e' per questo
  // che le quest vanno generate qui: il primo che ne ha bisogno e' chi guarda
  // il menu, non chi finisce una partita.
  try {
    if (assicuraQuestDelGiorno(logger, possesso, ctx.userId)) {
      // Si scrive solo se e' cambiato qualcosa: e' vero il primo giorno e a
      // ogni mezzanotte, non a ogni apertura del gioco.
      scriviPossesso(nk, ctx.userId, possesso);
    }
  } catch (eq) { logger.warn('quest del giorno non generate per %s: %s', ctx.userId, String(eq)); }

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
    // v0.79.36 — e quelli comprati. Il daily non viaggia come numero: si
    // ricava da bustinaProssima, che c'e' gia' due righe piu' su.
    bustineTesoro: possesso.bustineTesoro || 0,
    prezzoPacchetto: PACCHETTO_PREZZO_INK,
    // v0.79.82 — quali tutorial sono gia' stati visti. Viaggia col profilo per
    // la stessa ragione delle quest, e per una in piu': il tutorial d'apertura
    // si deve decidere PRIMA che si veda qualcosa, e una domanda in piu' in quel
    // momento sarebbe un momento in piu' di schermo fermo.
    tutorial: possesso.tutorial || {},
    // v0.79.75 — le cinque quest di oggi. Viaggiano col profilo perche' e' la
    // stessa risposta che porta carte, valute e preferenze: una domanda in meno
    // all'avvio.
    // A generarle e' la riga qui sopra: questo campo le racconta soltanto, e
    // alla v0.79.75 raccontava una lista che nessuno aveva creato.
    quest: questPerIlClient(possesso),
    // v0.78.16 — quali carte non sono ancora state guardate in Collezione.
    nuove: _nuoveDi(possesso, _visibiliDi(catalogo, admin)),
    // v0.79.7 — quante copie di ciascuna carta posseduta. Vedi _copieDi.
    copie: _copieDi(possesso, possedute),
    // v0.79.90 — le tabelle dei livelli delle carte: copie, inchiostro,
    // rimborso. Il client le mostra; a farle valere e' il server.
    livelliCarte: regoleLivelliCarte(),
    // v0.79.15 — e se l'accordo del playtest e' stato accettato, in questa
    // versione. Viaggia con tutto il resto: e' una domanda in meno all'avvio.
    accordo: {
      accettato: _accordoInRegola(nk, ctx.userId),
      versione: ACCORDO_VERSIONE
    },
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
  var addosso = (gia && gia.length && gia[0].value && gia[0].value.mazzi) || [];
  // ── v0.79.22 — SI RIFA' SOLO SOPRA A UN ALTRO STARTER ──────────────────
  // Se il giocatore ha gia' dei mazzi non si tocca niente: sarebbe il suo
  // lavoro, cancellato. L'eccezione e' il mazzo del SORTEGGIO — uno solo, con
  // l'id 'starter-N' — perche' e' esattamente quello che la scelta della
  // lettera viene a sostituire, e a quel punto il giocatore non ha ancora
  // avuto modo di costruire niente.
  if (addosso.length) {
    var soloIlSorteggio = (addosso.length === 1)
      && String((addosso[0] && addosso[0].id) || '').indexOf('starter-') === 0;
    if (!soloIlSorteggio) return;
  }

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
  // ── v0.79.31 — UN ACCOUNT NUOVO NASCE NON VERIFICATO ────────────────────
  // Il segno si scrive QUI e non quando il client chiede il codice, ed e' la
  // differenza fra una regola e una cortesia: fra la creazione dell'account e
  // la richiesta del codice c'e' un giro di rete, e un client che sparisce in
  // mezzo — la finestra chiusa, la linea caduta — lascerebbe un account senza
  // nessun oggetto scritto, cioe' verificato per definizione (vedi
  // rpcVerificaStato). Nascendo il segno insieme all'account, quella finestra
  // non esiste.
  // `data.created` e' vero solo la prima volta: agli accessi successivi qui
  // non succede niente.
  try {
    if (data && data.created) {
      var conto = nk.accountGetId(ctx.userId);
      // Senza email non c'e' niente da verificare — e' il caso di Google, che
      // l'indirizzo l'ha gia' confermato per conto suo, e dei device id.
      if (conto && conto.email && !leggiVerifica(nk, ctx.userId)) {
        scriviVerifica(nk, ctx.userId, { verificato: false, nato: Date.now() });
      }
    }
  } catch (e) { logger.error('segno di verifica non scritto: %s', String(e)); }
}

// ══════════════════════════════════════════════════════════════════════════
// v0.79.90 — I LIVELLI DELLE CARTE
// ══════════════════════════════════════════════════════════════════════════
// Le regole sono di Lorenzo (11/09/2026), e stanno tutte qui perche' sono una
// cosa sola vista da quattro parti:
//
//   LE COPIE. Per il livello 2 servono 2 copie in tutto, per il 3 ne servono
//     5, per il 4 ne servono 9: cioe' 2, poi altre 3, poi altre 4. Le carte del
//     mazzo starter valgono una copia ciascuna, come se fossero uscite da un
//     pacchetto.
//   L'INCHIOSTRO. Salire non e' mai automatico: lo chiede il giocatore dalla
//     Libreria, e costa inchiostro magico secondo rarita' e livello.
//   IL RIMBORSO. Una copia che non puo' piu' servire a niente torna indietro in
//     inchiostro: quanto costa tenere la seconda carta di quella rarita' allo
//     sbusto (COSTO_TENERE_PER_RARITA).
//   CHI C'ERA GIA'. Sale subito, senza pagare e senza animazione, al livello
//     che le copie gia' contate gli danno (vedi _migraLivelliCarte).
//
// Il client riceve queste tabelle col profilo (regoleLivelliCarte) e le
// MOSTRA; a farle valere e' il server, in hx_carta_livella e allo sbusto.
var LIVELLO_CARTA_MAX = 4;
// Copie TOTALI per stare a ogni livello. Il livello 1 e' la carta stessa.
var COPIE_PER_LIVELLO = { 1: 1, 2: 2, 3: 5, 4: 9 };
// Inchiostro per salire AL livello indicato, per rarita'.
var INCHIOSTRO_PER_LIVELLO = {
  common:   { 2: 50,  3: 150, 4: 400 },
  rare:     { 2: 100, 3: 300, 4: 800 },
  mythic:   { 2: 150, 3: 450, 4: 1200 },
  timeless: { 2: 200, 3: 600, 4: 1600 }
};
// Si alza quando la migrazione cambia: chi ha un numero piu' basso la ripassa.
var LIVELLI_CARTE_VERSIONE = 1;

function costoLivello(rarita, verso) {
  var t = INCHIOSTRO_PER_LIVELLO[String(rarita || '').toLowerCase()] || INCHIOSTRO_PER_LIVELLO.common;
  return typeof t[verso] === 'number' ? t[verso] : 0;
}
// Il livello piu' alto che un certo numero di copie permette.
function livelloDaCopie(n) {
  var l = 1;
  while (l < LIVELLO_CARTA_MAX && n >= COPIE_PER_LIVELLO[l + 1]) l++;
  return l;
}
function regoleLivelliCarte() {
  return {
    max: LIVELLO_CARTA_MAX,
    copie: COPIE_PER_LIVELLO,
    inchiostro: INCHIOSTRO_PER_LIVELLO,
    rimborso: COSTO_TENERE_PER_RARITA
  };
}
// Se una carta arriva da un mazzo starter che il giocatore possiede.
function _eDelloStarter(carta, possesso) {
  var sd = (carta && carta.starterDecks) || [];
  var mazzi = (possesso && possesso.mazzi) || [];
  for (var k = 0; k < sd.length; k++) if (mazzi.indexOf(sd[k]) !== -1) return true;
  return false;
}

// ── LA MIGRAZIONE, UNA VOLTA SOLA ─────────────────────────────────────────
// Due cose, nell'ordine.
//
// 1. LA COPIA DELLO STARTER CHE MANCAVA. Fino alla v0.79.89 lo sbusto contava
//    come gia' posseduta solo una carta gia' SBUSTATA: una carta del mazzo
//    starter uscita da un pacchetto partiva da zero e arrivava a una copia
//    invece che a due. Ogni carta starter sbustata almeno una volta e' quindi
//    indietro di esattamente una copia: sia quelle contate dopo la v0.79.7, sia
//    quelle sbustate prima, a cui una copia la dava gia' _copieDi.
// 2. IL LIVELLO CHE LE COPIE DANNO. Senza pagare: e' la regola 4 di Lorenzo.
//    Il livello non scende mai.
//
// Torna false se non ha potuto farlo (catalogo assente): il contrassegno
// allora non si scrive, e ci si riprova al prossimo avvio.
function _migraLivelliCarte(nk, logger, possesso) {
  if (possesso.admin) return true;
  var catalogo = null;
  try { catalogo = leggiSistema(nk, KEY_CATALOGO); } catch (e) { catalogo = null; }
  if (!catalogo || !catalogo.carte) return false;
  if (!possesso.carte) possesso.carte = {};
  if (!possesso.copie) possesso.copie = {};
  var saliti = [];
  for (var i = 0; i < catalogo.carte.length; i++) {
    var c = catalogo.carte[i];
    if (!c || !c.slug) continue;
    var starter = _eDelloStarter(c, possesso);
    var contate = possesso.copie[c.slug];
    if (starter && (possesso.carte[c.slug] || 0) > 0) {
      possesso.copie[c.slug] = ((typeof contate === 'number' && contate > 0) ? contate : 1) + 1;
    }
    var n = possesso.copie[c.slug];
    if (typeof n !== 'number' || n < 2) continue;
    var spetta = livelloDaCopie(n);
    var ha = Math.max(possesso.carte[c.slug] || 0, starter ? (possesso.livello || LIVELLO_NORMALE) : 0);
    if (spetta > ha) { possesso.carte[c.slug] = spetta; saliti.push(c.slug + ' ' + spetta); }
  }
  if (logger && saliti.length) logger.info('livelli dalle copie: %s', saliti.join(', '));
  return true;
}

// Cosa possiede un giocatore, dato il catalogo e il suo profilo. Un admin ha
// tutto al livello massimo; gli altri le carte dei mazzi starter che hanno.
// ══════════════════════════════════════════════════════════════════════════
// v0.79.7 — QUANTE COPIE SE NE HANNO
// ══════════════════════════════════════════════════════════════════════════
// Fino a ieri una carta si aveva o non si aveva: `possesso.carte[slug]` e' un
// LIVELLO, non un numero di esemplari, e sbustare un doppione non cambiava
// niente (LIVELLO_SBUSTATA e' 1, e il livello non scende mai). Il doppione
// spariva senza lasciare traccia.
// Adesso si contano, perche' la pagina dello sbusto lo dice in faccia: "3
// owned" sopra a una carta che si ha gia'. Un numero mostrato dev'essere un
// numero vero — e non esisteva.
//
// Alla v0.79.7 le copie erano solo un conto, tenuto in un posto solo perche' il
// giorno in cui fossero servite il numero ci fosse gia'. Quel giorno e' la
// v0.79.90: sono cio' con cui una carta sale di livello (vedi I LIVELLI DELLE
// CARTE, qui sopra).
//
// CHI C'ERA PRIMA parte da una copia per ogni carta che possiede. Non e' una
// stima: e' l'unica cosa vera che si puo' dire di una storia che non e' stata
// scritta. Meglio un numero onesto e basso che un numero inventato.
function _copieDi(possesso, sue) {
  var copie = (possesso && possesso.copie && typeof possesso.copie === 'object') ? possesso.copie : null;
  var fuori = {};
  for (var slug in sue) {
    if (!Object.prototype.hasOwnProperty.call(sue, slug)) continue;
    var n = copie ? copie[slug] : 0;
    fuori[slug] = (typeof n === 'number' && n > 0) ? n : 1;
  }
  return fuori;
}

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
  // Si torna anche il TIPO: chi riprende deve ritrovare lo stesso pacchetto che
  // aveva in mano, non uno qualunque.
  var aperta = leggiBustina(nk, ctx.userId);
  if (aperta && aperta.carte && aperta.carte.length === BUSTINA_CARTE) {
    return JSON.stringify({
      carte: aperta.carte, ripresa: true,
      prezzi: aperta.prezzi || {}, tipo: aperta.tipo || 'daily'
    });
  }

  // ── QUALE PACCHETTO ─────────────────────────────────────────────────────
  // Il tipo arriva dal client, quindi non ci si crede: si controlla che esista
  // e che il giocatore ne abbia davvero uno. Senza questo controllo, chiedere
  // 'treasure' senza averne comprato uno sarebbe un pacchetto gratis — e il
  // consumo, che avviene alla raccolta, toglierebbe da un contatore gia' a
  // zero, cioe' da niente.
  var richiesta = {};
  try { richiesta = payload ? JSON.parse(payload) : {}; } catch (e) { richiesta = {}; }
  var tipo = String(richiesta.tipo || 'daily');
  if (PACCHETTO_TIPI.indexOf(tipo) === -1) throw Error('tipo di pacchetto sconosciuto: ' + tipo);
  var addosso = pacchettiDi(possesso);
  if (!addosso[tipo]) throw Error('non hai un pacchetto di tipo ' + tipo);

  var sorteggiabili = _sorteggiabili(catalogo, admin);
  if (sorteggiabili.length < BUSTINA_CARTE) throw Error('non ci sono abbastanza carte sorteggiabili');

  // Tre pescate, ognuna escludendo cio' che e' gia' uscito: due carte uguali
  // nello stesso pacchetto sarebbero una delusione, non una rarita'.
  var slug = [];
  var prezzi = {};
  for (var n = 0; n < BUSTINA_CARTE; n++) {
    var c = _pesca(sorteggiabili, slug);
    if (!c) break;
    slug.push(c.slug);
    // Il prezzo di OGNI carta si fissa adesso e si scrive insieme al
    // pacchetto. Quale si paghera' lo decide chi gioca — e' la seconda che
    // sceglie — ma quanto costa ognuna e' deciso qui, una volta sola: cosi' il
    // numero scritto sul pulsante e quello addebitato sono lo STESSO dato, non
    // due conti che si spera coincidano.
    prezzi[c.slug] = costoTenereRarita(c.rarity);
  }
  if (slug.length !== BUSTINA_CARTE) throw Error('non ci sono abbastanza carte sorteggiabili');

  var bustina = {
    carte: slug,
    prezzi: prezzi,
    tipo: tipo,
    apertaIl: Math.floor(Date.now() / 1000)
  };
  scriviBustina(nk, ctx.userId, bustina);
  logger.info('pacchetto %s aperto per %s: %s', tipo, ctx.userId, slug.join(', '));
  return JSON.stringify({ carte: slug, ripresa: false, prezzi: prezzi, tipo: tipo });
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
  if (!bustina || !bustina.carte || !bustina.carte.length) throw Error('nessun pacchetto aperto');

  // Solo slug del pacchetto, senza ripetizioni: chiedere due volte la stessa
  // carta non deve poter valere per due. E non piu' di due in tutto: la terza
  // si scarta sempre, ed e' una regola del gioco — quindi la fa rispettare il
  // server, non il pulsante.
  var tieni = [];
  var chiesti = richiesta.tieni || [];
  for (var i = 0; i < chiesti.length; i++) {
    var s = String(chiesti[i]);
    if (bustina.carte.indexOf(s) === -1) throw Error('carta non uscita da questo pacchetto: ' + s);
    if (tieni.indexOf(s) === -1) tieni.push(s);
  }
  if (!tieni.length) throw Error('non hai scelto niente');
  if (tieni.length > BUSTINA_TENIBILI) throw Error('da un pacchetto si tengono al massimo ' + BUSTINA_TENIBILI + ' carte');

  var possesso = assicuraPossesso(ctx, nk, logger, ctx.userId, ctx.username);
  var valute = valuteDi(possesso);

  // ── v0.79.42 — SI PAGA LA MENO CARA DELLE DUE ─────────────────────────
  // Non piu' "il prezzo della seconda scelta". L'ordine dei clic non deve
  // essere una leva: la stessa coppia costerebbe 50 o 200 a seconda di quale
  // carta si tocca per prima, e chi lo scopre paga sempre 50 mentre chi non lo
  // scopre paga quattro volte tanto. La coppia vale quello che vale.
  // Il pagamento e il possesso finiscono nello stesso oggetto e in una sola
  // scrittura: cosi' non esiste l'istante in cui l'inchiostro e' gia' andato e
  // le carte non sono ancora arrivate.
  var costo = 0;
  if (tieni.length >= 2) {
    var listino = bustina.prezzi || {};
    for (var q = 0; q < tieni.length; q++) {
      var prezzoQ = (typeof listino[tieni[q]] === 'number') ? listino[tieni[q]] : 0;
      if (q === 0 || prezzoQ < costo) costo = prezzoQ;
    }
    if (valute.magicInk < costo) throw Error('inchiostro insufficiente');
    valute.magicInk -= costo;
  }

  // ── v0.79.90 — IL CATALOGO PRIMA DEL CONTO ────────────────────────────
  // Si leggeva dopo, solo per la risposta. Adesso servono due cose che solo
  // lui sa: se la carta si possedeva gia' DAL MAZZO STARTER (che vale una
  // copia, e che qui prima non si vedeva: si guardava solo cio' che era stato
  // sbustato), e di che rarita' e', per il rimborso.
  var catalogo = leggiSistema(nk, KEY_CATALOGO);
  var admin = !!possesso.admin;
  var carte = [];
  var perSlug = {};
  for (var k = 0; k < catalogo.carte.length; k++) {
    perSlug[catalogo.carte[k].slug] = catalogo.carte[k];
    if (catalogo.carte[k].soloAdmin && !admin) continue;
    carte.push(catalogo.carte[k]);
  }
  var primaDiQuesta = _possedute(carte, possesso, admin);

  if (!possesso.carte) possesso.carte = {};
  // v0.79.7 — e il conto delle copie sale. Sta QUI, nella stessa scrittura che
  // consegna le carte: contarle altrove vorrebbe dire un istante in cui la
  // carta e' arrivata e il conto no.
  if (!possesso.copie) possesso.copie = {};
  // v0.79.90 — una copia oltre le nove non puo' piu' servire a niente: il
  // livello 4 ne chiede nove in tutto. Invece di finire in un conto morto torna
  // in inchiostro, quanto costa tenere la seconda carta di quella rarita'.
  var copieMax = COPIE_PER_LIVELLO[LIVELLO_CARTA_MAX];
  var rimborso = 0;
  var rimborsate = [];
  for (var j = 0; j < tieni.length; j++) {
    var tenuta = tieni[j];
    // Chi ce l'aveva gia' senza che nessuno contasse vale una copia: e' lo
    // stesso ripiego di _copieDi, e i due devono dire la stessa cosa. "Ce
    // l'aveva" comprende il mazzo starter, che fino alla v0.79.89 qui mancava.
    var gia = possesso.copie[tenuta];
    if (typeof gia !== 'number' || gia < 1) gia = primaDiQuesta[tenuta] ? 1 : 0;
    if (gia >= copieMax) {
      rimborso += costoTenereRarita(perSlug[tenuta] && perSlug[tenuta].rarity);
      rimborsate.push(tenuta);
      possesso.copie[tenuta] = gia;
    } else {
      possesso.copie[tenuta] = gia + 1;
    }
    possesso.carte[tenuta] = Math.max(possesso.carte[tenuta] || 0, LIVELLO_SBUSTATA);
  }
  valute.magicInk += rimborso;
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
  // v0.79.36 — SI CONSUMA IL PACCHETTO CHE E' STATO APERTO, non "il primo che
  // c'e'". Prima la regola era una scala di priorita' scritta qui — se hai una
  // bustina vinta usa quella, altrimenti fai ripartire l'orologio — e andava
  // bene finche' il giocatore non sceglieva niente. Adesso sceglie, e la scelta
  // e' scritta nella bustina aperta: qui si esegue, non si decide.
  // Il tipo mancante e' una bustina aperta PRIMA di questa versione: si ricade
  // sulla vecchia regola, che per quei dati e' esattamente cio' che era stato
  // promesso.
  var tipoAperto = bustina.tipo;
  if (tipoAperto === 'treasure') possesso.bustineTesoro = Math.max(0, (possesso.bustineTesoro || 0) - 1);
  else if (tipoAperto === 'reward') possesso.bustineExtra = Math.max(0, (possesso.bustineExtra || 0) - 1);
  else if (tipoAperto === 'daily') possesso.bustinaProssima = Date.now() + BUSTINA_ATTESA_MS;
  else if ((possesso.bustineExtra || 0) > 0) possesso.bustineExtra -= 1;
  else possesso.bustinaProssima = Date.now() + BUSTINA_ATTESA_MS;
  scriviPossesso(nk, ctx.userId, possesso);
  cancellaBustina(nk, ctx.userId);

  logger.info('pacchetto raccolto da %s: %d carte, %d di inchiostro, %d rimborsati', ctx.userId, tieni.length, costo, rimborso);
  return JSON.stringify({
    tenute: tieni,
    speso: costo,
    valute: valute,
    bustinaProssima: possesso.bustinaProssima,
    bustineExtra: possesso.bustineExtra || 0,
    bustineTesoro: possesso.bustineTesoro || 0,
    // v0.78.16 — le carte appena prese sono nuove per definizione: si manda
    // l-elenco aggiornato subito, cosi- il pallino compare tornando al menu
    // senza aspettare la prossima lettura del profilo.
    nuove: _nuoveDi(possesso, _visibiliDi(catalogo, admin)),
    possedute: _possedute(carte, possesso, admin),
    // v0.79.7 — e quante se ne hanno adesso, questa compresa.
    copie: _copieDi(possesso, _possedute(carte, possesso, admin)),
    // v0.79.90 — l'inchiostro tornato per le copie oltre le nove, e da quali carte.
    rimborso: rimborso,
    rimborsate: rimborsate
  });
}

// ── v0.79.90 — RPC: una carta sale di un livello ─────────────────────────
// La chiede il pulsante "Level up for N" della Libreria. Il client dice
// soltanto QUALE carta: livello di partenza, copie e prezzo li ricava il
// server, perche' sono esattamente le tre cose che un client potrebbe voler
// raccontare diversamente.
// Un livello alla volta: da 1 a 3 sono due richieste, e due animazioni.
function rpcCartaLivella(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var richiesta = {};
  try { richiesta = payload ? JSON.parse(payload) : {}; } catch (e) { richiesta = {}; }
  var slug = String(richiesta.slug || '');
  if (!slug) throw Error('quale carta?');

  var catalogo = leggiSistema(nk, KEY_CATALOGO);
  if (!catalogo || !catalogo.carte) throw Error('catalogo non ancora importato');
  var possesso = assicuraPossesso(ctx, nk, logger, ctx.userId, ctx.username);
  var admin = !!possesso.admin;
  var carte = [];
  var carta = null;
  for (var i = 0; i < catalogo.carte.length; i++) {
    var c = catalogo.carte[i];
    if (c.soloAdmin && !admin) continue;
    carte.push(c);
    if (c.slug === slug) carta = c;
  }
  if (!carta) throw Error('carta sconosciuta: ' + slug);

  var possedute = _possedute(carte, possesso, admin);
  var da = possedute[slug] || 0;
  if (!da) throw Error('non possiedi questa carta');
  if (da >= LIVELLO_CARTA_MAX) throw Error('livello massimo gia\' raggiunto');
  var verso = da + 1;
  var copie = _copieDi(possesso, possedute)[slug] || 0;
  if (copie < COPIE_PER_LIVELLO[verso]) throw Error('copie insufficienti');
  var costo = costoLivello(carta.rarity, verso);
  var valute = valuteDi(possesso);
  if (valute.magicInk < costo) throw Error('inchiostro insufficiente');

  // Pagamento e livello nella stessa scrittura, come allo sbusto: non esiste
  // l'istante in cui l'inchiostro e' andato e la carta non e' ancora salita.
  valute.magicInk -= costo;
  possesso.valute = valute;
  if (!possesso.carte) possesso.carte = {};
  possesso.carte[slug] = verso;
  scriviPossesso(nk, ctx.userId, possesso);

  possedute = _possedute(carte, possesso, admin);
  logger.info('%s porta %s al livello %d per %d di inchiostro', ctx.userId, slug, verso, costo);
  return JSON.stringify({
    slug: slug,
    da: da,
    livello: verso,
    speso: costo,
    valute: valute,
    possedute: possedute,
    copie: _copieDi(possesso, possedute)
  });
}

// ── RPC di servizio: il menu di debug regala qualcosa ─────────────────────
// Solo per gli admin, e il controllo sta QUI: un pulsante nascosto nel client
// non e' un controllo, e' un pulsante nascosto. Le tre quantita' arrivano
// separate perche' i tre pulsanti sono tre — chi ne preme uno non deve
// ricevere anche il resto.
function rpcDebugRegala(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var possesso = assicuraPossesso(ctx, nk, logger, ctx.userId, ctx.username);
  if (!possesso.admin) throw Error('serve un account admin');
  var richiesta = {};
  try { richiesta = payload ? JSON.parse(payload) : {}; } catch (e) { richiesta = {}; }
  // Numeri veri e positivi, e con un tetto: un debug che accetta qualunque
  // numero e' un debug che, il giorno in cui la RPC finisce dove non deve,
  // scrive un saldo da mille miliardi.
  var quanto = function (v) {
    var n = Math.floor(Number(v) || 0);
    if (!isFinite(n) || n < 0) return 0;
    return Math.min(n, 10000);
  };
  var ink = quanto(richiesta.ink);
  var reward = quanto(richiesta.reward);
  var treasure = quanto(richiesta.treasure);
  var valute = valuteDi(possesso);
  if (ink) valute.magicInk += ink;
  possesso.valute = valute;
  if (reward) possesso.bustineExtra = (possesso.bustineExtra || 0) + reward;
  if (treasure) possesso.bustineTesoro = (possesso.bustineTesoro || 0) + treasure;
  scriviPossesso(nk, ctx.userId, possesso);
  logger.info('debug: a %s regalati %d ink, %d reward, %d treasure', ctx.userId, ink, reward, treasure);
  return JSON.stringify({
    valute: valute,
    bustineExtra: possesso.bustineExtra || 0,
    bustineTesoro: possesso.bustineTesoro || 0
  });
}

// ── RPC: compra un treasure pack ──────────────────────────────────────────
// Un pacchetto contro cento di inchiostro magico. Il saldo si legge e si
// scrive nella STESSA scrittura del contatore: cosi' non esiste l'istante in
// cui l'inchiostro e' gia' andato e il pacchetto non e' ancora arrivato.
// Non c'e' un tetto a quanti se ne possono comprare: il tetto e' il saldo.
function rpcBustinaCompra(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var possesso = assicuraPossesso(ctx, nk, logger, ctx.userId, ctx.username);
  var valute = valuteDi(possesso);
  if (valute.magicInk < PACCHETTO_PREZZO_INK) throw Error('inchiostro insufficiente');
  valute.magicInk -= PACCHETTO_PREZZO_INK;
  possesso.valute = valute;
  possesso.bustineTesoro = (possesso.bustineTesoro || 0) + 1;
  scriviPossesso(nk, ctx.userId, possesso);
  logger.info('treasure pack comprato da %s: -%d ink, ne ha %d', ctx.userId, PACCHETTO_PREZZO_INK, possesso.bustineTesoro);
  return JSON.stringify({
    valute: valute,
    bustineTesoro: possesso.bustineTesoro,
    prezzo: PACCHETTO_PREZZO_INK
  });
}

// ══════════════════════════════════════════════════════════════════════════
// v0.79.46 — I NOMI CHE NON SI POSSONO PRENDERE
// ══════════════════════════════════════════════════════════════════════════
// PERCHE' STA QUI E NON NEL CLIENT. Il nome si cambia con una PUT a
// /v2/account, che il client fa da solo: un controllo scritto di la' lo
// salterebbe chiunque aprisse gli strumenti del browser. L'unico posto in cui
// un divieto e' un divieto e' il gancio che Nakama chiama PRIMA di scrivere.
//
// L'ELENCO viene da github.com/censor-text/profanity-list (lista inglese,
// 2481 parole dopo averle ridotte a sole lettere e tolti i doppioni). Solo
// l'inglese, e non e' una dimenticanza: la lista ITALIANA contiene
// "assatanato", cioe' esattamente il nome che Lorenzo ha chiesto di lasciar
// passare. Aggiungerla vorrebbe dire vietare il suo esempio.
//
// COME SI CERCA, e perche' in due modi diversi.
// Cercare ogni parola OVUNQUE dentro al nome sarebbe la cosa facile e la cosa
// sbagliata: "Assatanato" contiene "ass", "Cassandra" pure, "Banal" contiene
// "anal", "peacock" contiene "cock". Un filtro cosi' non protegge nessuno e
// respinge tutti.
// Quindi:
//   1. PAROLA INTERA — l'elenco completo si confronta con le PAROLE del nome
//      (spezzato su tutto cio' che non e' una lettera) e col nome intero.
//      "big_ass" e' due parole e una e' "ass": no. "Assatanato" e' una parola
//      sola e non e' nell'elenco: passa.
//   2. OVUNQUE — solo un nocciolo di ventitre' parole scelte a mano fra quelle
//      dell'elenco: quelle che dentro a un'altra parola non ci finiscono per
//      caso. Serve a chi scrive tutto attaccato ("fuckyou", "adolfhitler").
//      Il prezzo noto e' il problema di Scunthorpe: un nome che contenga
//      "cunt" per caso viene respinto. E' un prezzo che si paga volentieri.
//
// LE PAROLE DEL GIOCO NON SI VIETANO MAI. Il catalogo dice come si chiamano le
// carte, e tre di quei nomi sono nell'elenco: Puss (in Boots), Babes (in the
// Wood), Nymph. Vietare a qualcuno di chiamarsi come una carta del gioco
// sarebbe assurdo, e scrivere quei tre a mano vorrebbe dire ricordarsi di
// aggiungere il quarto il giorno che arriva. Si ricavano dal catalogo, che e'
// gia' li'.
var PAROLACCE_TESTO =
  "abbo abeed abuse acrotomophilia aeolus africoon ahole alligatorbait amcik anal analannie " +
  "analprobe analsex andskota anilingus anus apeshit arabush arabushs areola areole argie armo " +
  "armos aroused arrse arschloch arse arsehole aryan asholes ass assbag assbagger assbandit " +
  "assbang assbanged assbanger assbangs assbite assblaster assclown asscock asscowboy " +
  "asscracker asses assface assfuck assfucker assfukka assgoblin asshat asshead asshole " +
  "assholes assholz asshopper asshore assjacker assjockey asskiss asskisser assklown asslick " +
  "asslicker asslover assman assmaster assmonkey assmunch assmuncher assnigger asspacker " +
  "asspirate asspuppies assrammer assranger assshit assshole asssucker asswad asswhole asswhore " +
  "asswipe asswipes autoerotic axwound ayir azazel azz azzhole babeland babes backdoor " +
  "backdoorman badfuck bagging ballbag balllicker balls ballsack bampot bangbro bangbros " +
  "bangbus banger banging bareback barelylegal barenaked barf barface barfface bassterd " +
  "bassterds bastard bastardo bastards bastardz basterds basterdz bastinado bawdy bazongas " +
  "bazooms bbw bch bdsm beaner beaners beaney beaneys beardedclam beastality beastial " +
  "beastiality beastility beatch beatoff beatyourmeat beeyotch bellend beotch bestial " +
  "bestiality biatch bich bicurious bigass bigbastard bigbreasts bigbutt bigtits bimbo bimbos " +
  "bint birdlock bitch bitchass bitched bitcher bitchers bitches bitchez bitchin bitching " +
  "bitchslap bitchtit bitchtits bitchy biteme bitties blackcock blackman blackout blacks " +
  "bloodclaat bloody blowjob blowjobs bluegum bluegums blumpkin boang boche boches bodily " +
  "boffing bogan bohunk boink boiolas bollick bollock bollocks bollok bollox bombers bombing " +
  "bomd bondage boned boner boners bong boob boobie boobs bookie boong boonga boongas boongs " +
  "boonie boonies booobs boooobs booooobs booooooobs bootee bootlip bootlips boozer boozy bosch " +
  "bosche bosches boschs bosomy bountybar breastjob breastlover breastman breasts brotherfucker " +
  "btch buceta buddhahead buddhaheads buffies bugger buggered buggery bukake bukkake bullcrap " +
  "bulldike bulldyke bullshit bullshits bullshitted bullturds bum bumblefuck bumfuck bung bunga " +
  "bungas bunghole burrhead burrheads busty butchbabes butchdike butchdyke butt buttbang " +
  "buttcheeks buttface buttfuck buttfucka buttfucker buttfuckers butthead butthole buttman " +
  "buttmuch buttmunch buttmuncher buttpirate buttplug buttstain buttwipe byatch cabron caca " +
  "cacker cahone cameljockey cameltoe camgirl camslut camwhore carpetmuncher carruth cawk cawks " +
  "cazzo cervix chav cheesehead cheeseheads cherrypopper chesticle chickslick chinaman chinamen " +
  "chinaswede chinaswedes chinc chincs chinga chingchong chingchongs chink chinks chinky choad " +
  "chode chodes chonkies chonky chonkys chraa chug chugs chuj chunger chungers chunkies chunkys " +
  "chute cialis cipa circlejerk clamdigger clamdiver clamps clansman clansmen clanswoman " +
  "clanswomen clit clitface clitfuck clitoris clitorus clits clitty clogwog clusterfuck cnts " +
  "cntz cnut cocain cocaine cock cockass cockbite cockblock cockblocker cockburger cockcowboy " +
  "cockface cockfight cockfucker cockhead cockholster cockjockey cockknob cockknocker " +
  "cockknoker cocklicker cocklover cockmaster cockmongler cockmongruel cockmonkey cockmunch " +
  "cockmuncher cocknob cocknose cocknugget cockqueen cockrider cocks cockshit cocksman " +
  "cocksmith cocksmoke cocksmoker cocksniffer cocksucer cocksuck cocksucked cocksucker " +
  "cocksucking cocksucks cocksuka cocksukka cocktease cockwaffle cocky cohee coital coitus cok " +
  "cokmuncher coksucka commie condom coochie coochy coolie coolies cooly coon coonass coonasses " +
  "coondog coons cooter coprolagnia coprophilia copulate corksucker cornhole cox crabs " +
  "crackcocain cracker crackpipe crackwhore crap crapola crapper crappy creampie crotch " +
  "crotchjockey crotchmonkey crotchrot cuck cum cumbubble cumdumpster cumfest cumguzzler cuming " +
  "cumjockey cumlickr cumm cummer cummin cumming cumquat cumqueen cums cumshot cumshots cumslut " +
  "cumstain cumsucker cumtart cunilingus cunillingus cunn cunnie cunnilingus cunntt cunny cunt " +
  "cuntass cunteyed cuntface cuntfuck cuntfucker cunthole cunthunter cuntlick cuntlicker " +
  "cuntlicking cuntrag cunts cuntslut cuntsucker cuntz currymuncher currymunchers cushi cushis " +
  "cyalis cyberfuc cyberfuck cyberfucked cyberfucker cyberfuckers cyberfucking cybersex " +
  "cyberslimer dago dagos dahmer damm dammit damn damnation damned damnit darkey darkeys darkie " +
  "darkies darky daterape datnigga daygo deapthroat deepaction deepthroat deepthroating " +
  "defecate deggo dego degos demon dendrophilia destroyyourpussy deth diaperdaddy diaperhead " +
  "diaperheads dick dickbag dickbeater dickbeaters dickbrain dickdipper dickface dickflipper " +
  "dickforbrains dickfuck dickfucker dickhead dickheads dickhole dickish dickjuice dickless " +
  "dicklick dicklicker dickman dickmilk dickmonger dickpic dickripper dicks dicksipper dickslap " +
  "dickslicker dicksucker dicksucking dicktickler dickwad dickweasel dickweed dickwhipper " +
  "dickwod dickzipper diddle dike dildo dildos dilf diligaf dillweed dimwit dingle " +
  "dingleberries dingleberry dink dinks dipship dipshit dipstick dirsa dix dixiedike dixiedyke " +
  "dlck doggie doggiestyle doggin dogging doggystyle dolcett domination dominatricks " +
  "dominatrics dominatrix dommes dong donkeypunch donkeyribber doochbag doodoo doofus dookie " +
  "doosh dothead dotheads doubledong doublepenetration douche douchebag douchebags douchewaffle " +
  "douchey dpaction dragqueen dragqween dripdick dryhump duche dudette dumass dumbass dumbasses " +
  "dumbbitch dumbfuck dumbshit dumshit dupa dvda dyefly dyke dykes dziwka earotics easyslut " +
  "eatadick eatballs eathairpie eatme eatmyass eatpussy ecchi ejackulate ejaculate ejaculated " +
  "ejaculates ejaculating ejaculatings ejaculation ejakulate ekrem ekto enculer enema " +
  "enlargement erect erection ero erotic erotism escort esqua essohbee eunuch evl excrement " +
  "exkwew extacy extasy facefucker fack faeces faen fag fagbag faget fagfucker fagg fagged " +
  "fagging faggit faggitt faggot faggotcock faggs fagit fagot fagots fags fagt fagtard fagz " +
  "faig faigs faigt fanculo fanny fannybandit fannyflaps fannyfucker fanyy fart farted farting " +
  "fartknocker farty fastfuck fatah fatass fatfuck fatfucker fatso fck fckcum fckd fcuk fcuker " +
  "fcuking fecal feces feck fecker feg felatio felch felcher felching fellate fellatio feltch " +
  "feltcher feltching femalesquirtin femalesquirting femdom fetish ficken figging fingerbang " +
  "fingerfood fingerfuck fingerfucked fingerfucker fingerfuckers fingerfucking fingerfucks " +
  "fingering fisted fister fistfuck fistfucked fistfucker fistfuckers fistfucking fistfuckings " +
  "fistfucks fisting fisty fitt flamer flange flasher flikker flipping flogthelog floo floozy " +
  "flydie flydye foad fok fondle foobar fook fooker footaction footfetish footfuck footfucker " +
  "footjob footlicker footstar foreskin forni fornicate fotze foursome fourtwenty freakfuck " +
  "freakyfucker freefuck freex frigg frigga frigger frotting fucck fuchah fuck fucka fuckable " +
  "fuckass fuckbag fuckbitch fuckbook fuckboy fuckbrain fuckbuddy fuckbutt fuckbutter fuckd " +
  "fucked fuckedup fucker fuckers fuckersucker fuckface fuckfest fuckfreak fuckfriend fuckhead " +
  "fuckheads fuckher fuckhole fuckin fuckina fucking fuckingbitch fuckings " +
  "fuckingshitmotherfucker fuckinnuts fuckinright fuckit fuckknob fuckme fuckmeat fuckmehard " +
  "fuckmonkey fuckn fucknugget fucknut fucknuts fucknutt fucknutz fuckoff fuckpig fuckpuppet " +
  "fuckr fucks fuckstick fucktard fucktards fucktart fucktoy fucktrophy fuckup fuckwad fuckwhit " +
  "fuckwhore fuckwit fuckwitt fuckyomama fuckyou fudgepacker fugly fuk fukah fuken fuker fukin " +
  "fuking fukk fukka fukkah fukken fukker fukkin fukking fuks fuktard fuktards fukwhit fukwit " +
  "funfuck fungus futanari futanary futkretzn fuuck fux fuxor fvck fvk fxck gae gai gangbang " +
  "gangbanged gangbanger gangbangs gangsta ganja gassyass gatorbait gay gayass gaybob gaybor " +
  "gayboy gaydo gayfuck gayfuckist gaygirl gaylord gaymuthafuckinwhore gays gaysex gaytard " +
  "gaywad gayz geezer geni genital genitals getiton gey gfy ghay ghey gigolo ginzo ginzos gipp " +
  "gippo gippos gipps givehead glans glazeddonut goatcx goatse gob godam godammit godamn " +
  "godamnit goddam goddamit goddamm goddammit goddamn goddamned goddamnes goddamnit " +
  "goddamnmuthafucker godsdamn gokkun goldenshower golliwog golliwogs gonad gonads gonorrehea " +
  "gonzagas gooch goodpoop gook gookeye gookeyes gookies gooks gooky gora goras goregasm " +
  "gotohell goy goyim greaseball greaseballs gringo groe groid groids grope grostulation gspot " +
  "gstring gtfo gub gubba gubbas gubs guido guiena guineas guizi gummer guro gwailo gwailos " +
  "gweilo gweilos gyopo gyopos gyp gyped gypo gypos gypp gypped gyppie gyppies gyppo gyppos " +
  "gyppy gyppys gypsys hadji hadjis hairyback hairybacks haji hajis hajji hajjis halfbreed " +
  "halfcaste hamas hamflap handjob haole haoles hapa hardcore hardcoresex hardon harem headfuck " +
  "hebe hebes heeb heebs hell hells helvete hentai heroin herp herpes herpy heshe hijacker " +
  "hijacking hillbillies hillbilly hindoo hiscock hitler hitlerism hitlerist hoar hoare hobag " +
  "hodgie hoe hoer hoes holestuffer homey homo homobangers homodumbshit homoerotic homoey " +
  "honger honkers honkey honkeys honkie honkies honky hooch hooker hookers hoor hoore hootch " +
  "hooter hooters hore hori horis hork horndawg horndog horney horniest horny horseshit hosejob " +
  "hoser hotcarl hotdamn hotpussy hotsex hottotrot howtokill howtomurdep huevon hugefat hui " +
  "hummer humped humper humpher humphim humpin humping hussy hustler hymen hymie hymies iblowu " +
  "ike ikes ikey ikeymo ikeymos ikwe illegal illegals inbred incest indon indons injun injuns " +
  "insest intercourse interracial intheass inthebuff israels jackass jackhole jackoff jackshit " +
  "jacktheripper jagoff jailbait jap japcrap japie japies japs jebus jerk jerkass jerked " +
  "jerkoff jerries jerry jewboy jewed jewess jiga jigaboo jigaboos jigarooni jigaroonis jigg " +
  "jigga jiggabo jiggaboo jiggabos jiggas jigger jiggerboo jiggers jiggs jiggy jigs jihad " +
  "jijjiboo jijjiboos jimfish jisim jism jiss jiz jizim jizin jizjuice jizm jizn jizz jizzd " +
  "jizzed jizzim jizzin jizzn jizzum jugg juggs jugs junglebunny junkie junky kacap kacapas " +
  "kacaps kaffer kaffir kaffre kafir kanake kanker katsap katsaps kawk khokhol khokhols kicking " +
  "kigger kike kikes kimchis kinbaku kink kinkster kinky kinkyjesus kissass kiunt kkk klan " +
  "klansman klansmen klanswoman klanswomen klootzak knob knobbing knobead knobed knobend " +
  "knobhead knobjocky knobjokey knobs knobz knockers knulle kock kondum kondums kooch kooches " +
  "koon kootch krap krappy kraut krauts kuffar kuk kuksuger kum kumbubble kumbullbe kumer " +
  "kummer kumming kumquat kums kunilingus kunnilingus kunt kunts kuntz kurac kurwa kushi kushis " +
  "kusi kwa kwif kyke kykes kyopo kyopos kyrpa labia lameass lapdance lardass leatherrestraint " +
  "lebos lech lemonparty leper lesbain lesbayn lesbian lesbin lesbo lesbos lez lezbe " +
  "lezbefriends lezbian lezbians lezbo lezbos lezz lezzian lezzie lezzies lezzo lezzy libido " +
  "licker licking lickme lilniglet limey limpdick limy lingerie lipshits lipshitz livesex lmfao " +
  "loadedgun loin loins lolita lovebone lovegoo lovegun lovejuice lovemaking lovemuscle " +
  "lovepistol loverocket lowlife lsd lubejob lubra lucifer luckycammeltoe lugan lugans lust " +
  "lusting lusty lynch mabuno mabunos macaca macacas mafugly magicwand mahbuno mahbunos " +
  "makemecome makemecum mamhoon mams manhater manpaste maricon marijuana masochist masokist " +
  "massa massterbait masstrbait masstrbate mastabate mastabater masterbaiter masterbat " +
  "masterbate masterbates masterbating masterbation masterbations masterblaster mastrabator " +
  "masturbat masturbate masturbating masturbation mattressprincess maumau maumaus mcfagget " +
  "meatbeatter meatrack menage merd mgger mggor mibun mick mickeyfinn mideast mierda milf minge " +
  "minger mockey mockie mocky mofo moky molest molestation molester molestor moneyshot mong " +
  "monkleigh moolie mooncricket mooncrickets mormon moron moskal moskals moslem mosshead motha " +
  "mothafuck mothafucka mothafuckas mothafuckaz mothafucked mothafucker mothafuckers " +
  "mothafuckin mothafucking mothafuckings mothafucks mothafuker mothafukkah mothafukker " +
  "motherfuck motherfucka motherfucked motherfucker motherfuckers motherfuckin motherfucking " +
  "motherfuckings motherfuckka motherfucks motherfukah motherfuker motherfukkah motherfukker " +
  "motherfvcker motherlovebone mothrfucker mouliewop moundofvenus mrhands mtherfucker mthrfuck " +
  "mthrfucker mthrfucking mtrfck mtrfuck mtrfucker muff muffdive muffdiver muffdiving " +
  "muffindiver mufflikcer muffpuff muie mulatto mulkku muncher mung munging munt munter muschi " +
  "mutha muthafecker muthafuckaz muthafucker muthafuckker muthafukah muthafuker muthafukkah " +
  "muthafukker muther mutherfucker mutherfucking muthrfucking mzungu mzungus nad nads naked " +
  "nambla nappy nastt nasty nastybitch nastyho nastyslut nastywhore nawashi nazi nazis nazism " +
  "necked necro needthedick negres negress negro negroes negroid negros neonazi nepesaurio nig " +
  "niga nigaboo nigar nigars nigas nigers nigette nigettes nigg nigga niggah niggahs niggar " +
  "niggaracci niggard niggarded niggarding niggardliness niggardlinesss niggardly niggards " +
  "niggars niggas niggaz nigger niggerhead niggerhole niggers niggle niggled niggles niggling " +
  "nigglings niggor niggress niggresses nigguh nigguhs niggur niggurs niglet nignog nigor " +
  "nigors nigr nigra nigras nigre nigres nigress nigs nigur niiger niigr nimphomania nimrod " +
  "ninny nip nipple nipplering nipples nips nittit nlgger nlggor nob nobhead nobjocky nobjokey " +
  "nofuckingway nog nookey nookie nooky noonan nooner nsfw nude nudger nudie nudies nudity " +
  "numbnuts nutbutter nutfucker nutsack nutten nymph nympho nymphomania octopussy omorashi " +
  "ontherag orafis orally orga orgasim orgasims orgasm orgasmic orgasms orgasum orgies orgy " +
  "oriface orifice orifiss orospu osama ovum ovums packi packie packy paddy paedophile paki " +
  "pakie pakis paky palesimian panooch pansies pansy panti pantie panties panty paska pastie " +
  "pasty pawn payo pcp pearlnecklace pecker peckerhead peckerwood pedo pedobear pedophile " +
  "pedophilia pedophiliac peeenus peeenusss peehole peenus peepee peepshow peepshpw pegging " +
  "peinus penas pendejo pendy penetrate penetration penial penile penis penisbanger penisbreath " +
  "penises penisfucker penisland penislick penislicker penispuffer penthouse penus penuus perse " +
  "perv perversion peyote phalli phallic phonesex phuc phuck phuk phuked phuker phuking phukked " +
  "phukker phukking phuks phungky phuq picaninny piccaninny picka pickaninnies pickaninny " +
  "pieceofshit piefke piefkes pierdol pigfucker piker pikey piky pillowbiter pillu pimmel pimp " +
  "pimped pimper pimpis pimpjuic pimpjuice pimpsimp pindick pinko pis pises pisin pising pisof " +
  "piss pissed pisser pissers pisses pissflap pissflaps pisshead pissin pissing pissoff pisspig " +
  "pistol pizda playboy playgirl pleasurechest pocha pochas pocho pochos pocketpool pohm pohms " +
  "polac polack polacks polak polesmoker pollock pollocks pommy ponyplay poo poof poon poonani " +
  "poonany poontang poontsee poop poopchute pooper pooperscooper pooping poorwhitetrash popimp " +
  "porchmonkey porn pornflick pornking porno pornography pornos pornprincess poundtown pplicker " +
  "premature preteen pric prick prickhead pricks prig pron prostitute pthc pube pubes pubic " +
  "pubiclice pubis pud pudboy pudd puddboy puke pula pule punani punanny punany punkass punky " +
  "punta puntang purinapricness pusies puss pusse pussee pussi pussie pussies pussy pussycat " +
  "pussydestroyer pussyeater pussyfart pussyfucker pussylicker pussylicking pussylips " +
  "pussylover pussypalace pussypounder pussys pusy puta puto puuke puuker qahbeh quashie queaf " +
  "queef queer queerbait queerhole queero queers queerz quickie quicky quiff quim qweers qweerz " +
  "qweir raghead ragheads rape raped raper raping rapist rautenberg rearend rearentry recktum " +
  "rectal rectum rectus redleg redlegs redlight redneck rednecks redskin redskins reefer " +
  "reestie reetard reich renob rentafuck rere retard retarded retards retardz reversecowgirl " +
  "rigger rimjaw rimjob rimming ritard rosebuds rosypalm rosypalmandherefivesisters roundeye " +
  "rtard rtards rumprammer ruski russki russkie rustytrombone sac sadis sadism sadist sadom " +
  "sambo sambos samckdaddy sanchez sandm sandnigger santorum sausagequeen scag scallywag scank " +
  "scantily scat schaffer scheiss schizo schlampe schlong schmuck schvartse schvartsen " +
  "schwartze schwartzen scissoring screw screwed screwing screwyou scroat scrog scrote scrotum " +
  "scrud seduce semen seppo seppos septics sex sexcam sexed sexfarm sexhound sexhouse sexi " +
  "sexing sexkitten sexo sexpot sexslave sextogo sextoy sextoys sexual sexuality sexually " +
  "sexwhore sexx sexxi sexxx sexxxi sexxxy sexxy sexy sexymoma sexyslim shag shagger shaggin " +
  "shagging shamedame sharmuta sharmute shat shav shavedbeaver shavedpussy shawtypimp sheeney " +
  "shemale shhit shibari shibary shinola shipal shit shitass shitbag shitbagger shitblimp " +
  "shitbrain shitbrains shitbreath shitcan shitcanned shitcunt shitdick shite shiteater " +
  "shiteating shited shitey shitface shitfaced shitfit shitforbrains shitfuck shitfucker " +
  "shitfull shithapens shithappens shithead shitheel shithole shithouse shiting shitings " +
  "shitlist shitload shitola shitoutofluck shitpot shits shitspitter shitstain shitt shitted " +
  "shitter shitters shittiest shitting shittings shitty shity shitz shiz shiznit shortfuck " +
  "shota shrimping shylock shylocks shyt shyte shytty shyty simp sissy sixsixsix sixtynine " +
  "sixtyniner skag skanck skank skankbitch skankee skankey skankfuck skanks skankwhore skanky " +
  "skankybitch skankywhore skeet skinflute skrib skribz skullfuck skum skumbag skurwysyn skwa " +
  "skwe slag slanteye slanty slapper sleezeball slideitin slimeball slimebucket slopehead " +
  "slopeheads sloper slopers slopes slopey slopeys slopies slopy slut slutbag slutbucket " +
  "slutdumper slutkiss sluts slutt slutting slutty slutwear slutwhore slutz smack " +
  "smackthemonkey smeg smegma smoker smut smutty snatch snatchpatch snigger sniggered " +
  "sniggering sniggers snowback snowballing snownigger snuff socksucker sodom sodomise sodomite " +
  "sodomize sodomy sonofabitch sonofbitch sooties sooty souse soused soyboy spac spade spades " +
  "spaghettibender spaghettinigger spank spankthemonkey spastic spearchucker spearchuckers " +
  "sperm spermacide spermbag spermhearder spermherder sphencter spic spick spicks spics " +
  "spierdalaj spig spigotty spik spiks spitter splittail splooge spludge spooge spook " +
  "spreadeagle spunk spunky sqeh squa squarehead squareheads squaw squinty squirting stagg " +
  "steamy stfu stiffy stoned stoner strapon strappado stringer stripclub stroke stroking " +
  "stuinties stupidfuck stupidfucker suck suckass suckdick sucked sucker sucking suckme " +
  "suckmyass suckmydick suckmytit suckoff sucks suicidegirl suicidegirls suka sultrywoman " +
  "sultrywomen sumofabiatch swallower swalow swastika swinger syphilis taboo tacohead tacoheads " +
  "taff tarbaby tard tastemy tawdry teabagging teat teets teez terd terror terrorist teste " +
  "testee testes testical testicle testicles testis thicklip thicklips thirdeye thirdleg " +
  "threesome threeway throating thumbzilla thundercunt timbernigger tinkle tit titbitnipply " +
  "titfuck titfucker titfuckin titi titjob titlicker titlover tits titt tittie tittiefucker " +
  "titties tittis titty tittyfuck tittyfucker tittys tittywank titwank tity toke tongethruster " +
  "tongueina tonguethrust tonguetramp toots topless tortur torture tosser towelhead " +
  "trailertrash tramp trannie tranny transsexual transvestite trashy tribadism triplex " +
  "trisexual trois trojan trots tubgirl tuckahoe tunneloflove turd turnon tush tushy twat " +
  "twathead twatlips twats twatty twatwaffle twink twinkie twobitwhore twunt twunter ukrop " +
  "unclefucker undressing unfuckable upskirt uptheass upthebutt urethraplay urophilia usama " +
  "ussys uzi vag vagiina vagina vajayjay vajina valium vgra viagra vibr vibrater vibrator vigra " +
  "virgin virginbreaker vittu vixen vjayjay vodka vomit vorarephilia voyeur voyeurweb voyuer " +
  "vullva vulva wab wad wang wank wanker wanking wankjob wanky waysted wazoo weenie weewee " +
  "weiner welcher wench wetb wetback wetbacks wetdream wetspot whacker whash whigger whiggers " +
  "whiskeydick whiskydick whit whitenigger whitepower whites whitetrash whitey whiteys whities " +
  "whoar whop whoralicious whore whorealicious whorebag whored whoreface whorefucker " +
  "whorehopper whorehouse whores whoring wichser wigga wiggas wigger wiggers willie willies " +
  "williewanker willy wog wogs woose wop words worldsex wtf wuss wuzzie xkwe xrated xtc xxx " +
  "xxxxxx yank yaoi yarpie yarpies yeasty yed yellowman yellowshowers yid yids yiffy yobbo " +
  "yourboobs yourpenis yourtits yury zabourah zigabo zigabos zipperhead zipperheads zoophile " +
  "zoophilia";
// Il nocciolo: si cerca OVUNQUE nel nome. Sono tutte parole che stanno anche
// nell'elenco grande — e' una scelta fra quelle, non un secondo elenco.
var PAROLACCE_NOCCIOLO = "fuck shit cunt nigger nigga faggot retard whore slut bitch wanker bastard pedophile rapist hitler nazi motherfucker cocksucker asshole dickhead jerkoff bukkake felching".split(' ');
// Le eccezioni a mano: il posto per il caso che il catalogo non copre. La
// lista viene da fuori e ha del rumore dentro — "bookie" e' un allibratore,
// "aeolus" e' il dio dei venti, e nessuno dei due ha mai offeso nessuno.
// v0.79.48 — aeolus rimesso in circolazione su richiesta di Lorenzo. Una riga
// qui, e quel nome torna disponibile: e' esattamente perche' questo elenco
// esiste. Si scrive in minuscolo e senza accenti, come esce da _nomeNormale.
var PAROLACCE_AMMESSE = ['aeolus'];

// Le cifre e i simboli che si usano al posto delle lettere. Non e' una difesa
// completa e non puo' esserlo: e' il minimo perche' "sh1t" non passi solo
// perche' ha un uno al posto della i.
var LEET = { '0':'o', '1':'i', '3':'e', '4':'a', '5':'s', '7':'t', '8':'b', '9':'g', '@':'a', '$':'s', '!':'i', '+':'t' };
function _nomeNormale(s) {
  var fuori = String(s || '').toLowerCase();
  var dentro = '';
  for (var i = 0; i < fuori.length; i++) {
    var c = fuori.charAt(i);
    dentro += (LEET[c] !== undefined) ? LEET[c] : c;
  }
  // Le accentate si riducono alla base: "Ä" deve valere "a", o basterebbe un
  // accento per passare.
  return dentro.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function _nomePezzi(s) {
  var p = _nomeNormale(s).split(/[^a-z]+/);
  var fuori = [];
  for (var i = 0; i < p.length; i++) if (p[i]) fuori.push(p[i]);
  return fuori;
}
// Solo lettere, e le ripetizioni schiacciate: "fuuuuck" diventa "fuck". Serve
// al nocciolo, non alle parole intere — schiacciando anche quelle, "asss"
// diventerebbe "as" e non "ass".
function _nomeSchiacciato(s) {
  return _nomeNormale(s).replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
}
var _parolacce = null;
function _elencoParolacce() {
  if (!_parolacce) {
    _parolacce = {};
    var a = PAROLACCE_TESTO.split(' ');
    for (var i = 0; i < a.length; i++) if (a[i]) _parolacce[a[i]] = 1;
  }
  return _parolacce;
}
// Le parole che compaiono nei nomi delle carte. Si ricalcolano quando il
// catalogo cambia versione: e' l'unico momento in cui possono cambiare.
var _paroleGioco = null;
var _paroleGiocoVersione = null;
function _paroleDelGioco(nk) {
  var catalogo = null;
  try { catalogo = leggiSistema(nk, KEY_CATALOGO); } catch (e) { catalogo = null; }
  if (!catalogo || !catalogo.carte) return _paroleGioco || {};
  if (_paroleGioco && _paroleGiocoVersione === catalogo.versione) return _paroleGioco;
  var fuori = {};
  for (var i = 0; i < catalogo.carte.length; i++) {
    var pezzi = _nomePezzi(catalogo.carte[i].name || '');
    for (var j = 0; j < pezzi.length; j++) fuori[pezzi[j]] = 1;
  }
  for (var k = 0; k < PAROLACCE_AMMESSE.length; k++) fuori[PAROLACCE_AMMESSE[k]] = 1;
  _paroleGioco = fuori;
  _paroleGiocoVersione = catalogo.versione;
  return fuori;
}
// Il gancio che Nakama chiama PRIMA di scrivere un cambio di profilo. Sta qui
// come funzione DICHIARATA e non scritta dentro alla registrazione, e non e'
// una preferenza di stile: Nakama non tiene il riferimento che gli si passa —
// ne estrae la CHIAVE, cioe' il nome con cui la funzione e' dichiarata nel
// modulo, e a runtime va a ripescarla da li'. Una funzione anonima non ha
// nessuna chiave, e il registro lo dice chiaro:
//   "js registerBeforeUpdateAccount function key could not be extracted"
// E' la stessa ragione per cui ogni RPC qui sotto passa un nome.
function primaDiCambiareProfilo(ctx, logger, nk, dati) {
  if (dati && dati.username) {
    var brutta = nomeSporco(nk, dati.username);
    if (brutta) {
      logger.info('nome rifiutato per %s: %s (per "%s")', ctx.userId, dati.username, brutta);
      throw Error('That player name is not allowed.');
    }
  }
  return dati;
}

// Torna la parola trovata, o stringa vuota se il nome va bene. Torna la parola
// e non un si/no perche' il registro deve poter dire QUALE: un filtro che
// respinge senza sapere dire perche' non si puo' correggere.
function nomeSporco(nk, nome) {
  var elenco = _elencoParolacce();
  var ammesse = _paroleDelGioco(nk);
  var pezzi = _nomePezzi(nome);
  var i;
  // 1. parola intera
  for (i = 0; i < pezzi.length; i++) {
    if (elenco[pezzi[i]] && !ammesse[pezzi[i]]) return pezzi[i];
  }
  var intero = _nomeNormale(nome).replace(/[^a-z]/g, '');
  if (elenco[intero] && !ammesse[intero]) return intero;
  // 2. il nocciolo, ovunque
  var schiacciato = _nomeSchiacciato(nome);
  for (i = 0; i < PAROLACCE_NOCCIOLO.length; i++) {
    var w = PAROLACCE_NOCCIOLO[i];
    if (ammesse[w]) continue;
    if (intero.indexOf(w) !== -1 || schiacciato.indexOf(w) !== -1) return w;
  }
  return '';
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
  // ── v0.79.20 — CHI ESCE PERDE ANCHE I PUNTI RANK ────────────────────────
  // Deciso da Lorenzo. Prima non li perdeva: la v0.78.11 diceva che il server
  // non sa distinguere un crash da un abbandono per ripicca, e che punire chi
  // ha perso la corrente sarebbe peggio del problema. Vero, ma il conto lo
  // pagava dall'altra parte: uscire era il modo gratis per non perdere un
  // gradino quando la partita stava andando male.
  // Adesso 'uscito' conta come una sconfitta a tutti gli effetti, tre di fila
  // comprese. Chi RESTA invece non guadagna punti: la sua vittoria e' vera —
  // prende l'esperienza e l'inchiostro di una vittoria — ma non l'ha giocata
  // fino in fondo, e il rank misura le partite giocate fino in fondo.
  var conclusa = (modo !== 'resta');
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
  // v0.79.75 — QUI C'ERA IL CONTO DELLE CINQUE PARTITE. Ogni partita conclusa
  // avanzava di uno verso una bustina, e alla quinta la bustina arrivava. Non
  // c'e' piu': quel premio adesso e' una quest, 'Win 3 PvP matches', e due
  // strade per la stessa bustina sono due conti che il giocatore deve tenere a
  // mente insieme.
  var ink = 0, valute = null, mosseQuest = [];
  if (premia) {
    try {
      var possesso = leggiPossesso(nk, userId);
      if (possesso) {
        ink = inkDiFine(modo, vinta);
        var v = valuteDi(possesso);
        v.magicInk += ink;
        possesso.valute = v;
        // ── LE QUEST DEL GIORNO ──────────────────────────────────────────
        // Partita e vittoria le conta il SERVER, qui, dove sa com'e' andata.
        // Non si chiedono al client per la stessa ragione per cui non gli si
        // chiede l'esperienza: e' l'unico punto in cui la verita' e' gia'
        // nostra. Le carte girate invece il server non le vede, e arrivano da
        // fuori (vedi rpcQuest).
        // Chi esce a meta' non avanza: e' lo stesso metro dell'inchiostro.
        try {
          assicuraQuestDelGiorno(logger, possesso, userId);
          if (conclusa) {
            mosseQuest = mosseQuest.concat(avanzaQuest(possesso, 'partita', 1, !controIA));
            if (vinta) mosseQuest = mosseQuest.concat(avanzaQuest(possesso, 'vittoria', 1, !controIA));
          }
        } catch (eq) { if (logger) logger.warn('quest non avanzate per %s: %s', userId, String(eq)); }
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
    // v0.79.75 — e cosa si e' mosso fra le quest del giorno. Il client se ne
    // serve per far salire i popup in basso a sinistra: gli arriva gia' detto
    // chi e' avanzato e chi, avanzando, ha finito.
    quest: mosseQuest,
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
// Il client batte ogni venti secondi (ONLINE_OGNI_MS): trenta e' un battito
// saltato piu' il margine. I due numeri vanno cambiati in coppia — una sedia
// piu' corta del battito la perderebbe chi sta ancora giocando.
//
// v0.79.11 — erano quarantacinque, col battito a trenta. Restare mezzo minuto
// fuori dal proprio account e' il momento in cui una persona smette di
// riprovare, e questa attesa e' un RIPIEGO: la strada normale e' che chi se ne
// va lo dica (rpcEsco), e adesso lo dice anche chi chiude la finestra senza
// passare dalla porta. Questi trenta secondi valgono solo per chi non ha
// potuto dire niente — un crollo, la corrente che va via, il telefono che
// chiude l'applicazione di forza.
var SEDIA_LIBERA_MS = 30 * 1000;

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
// v0.79.42 — "visibili" e' l'elenco degli slug che il giocatore puo' davvero
// incontrare in Collezione. Passarlo e' facoltativo, ma chi puo' passarlo deve
// farlo: senza, si torna a poter dichiarare nuova una carta che non esiste.
function _nuoveDi(possesso, visibili) {
  var avute = (possesso && possesso.carte) || {};
  var viste = _visteDi(possesso);
  var out = [];
  for (var slug in avute) {
    if (viste[slug]) continue;
    if (visibili && !visibili[slug]) continue;
    out.push(slug);
  }
  return out;
}
// Gli slug del catalogo, in un oggetto da interrogare. Le carte riservate non
// ci sono per chi non e' admin: non le vede in Collezione, quindi per lui non
// esistono e non possono essere nuove.
function _visibiliDi(catalogo, admin) {
  var out = {};
  if (!catalogo || !catalogo.carte) return null;
  for (var i = 0; i < catalogo.carte.length; i++) {
    var c = catalogo.carte[i];
    if (c.soloAdmin && !admin) continue;
    out[c.slug] = 1;
  }
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
    // v0.79.45 — si accetta anche una chiave che non compare fra le carte
    // possedute, purche' non sia gia' vista. Prima si rifiutava in silenzio, e
    // il client non poteva accorgersene: rimandava, il server taceva, e al
    // riavvio dopo quella carta tornava nuova. Segnare come vista una carta
    // che non si ha e' innocuo — al massimo si toglie da se' un pallino, che
    // e' esattamente cio' che questa RPC serve a fare.
    for (var i = 0; i < elenco.length && i < 500; i++) {
      var slug = String(elenco[i]);
      if (slug) viste[slug] = 1;
    }
  }
  possesso.viste = viste;
  scriviPossesso(nk, ctx.userId, possesso);
  var cat = leggiSistema(nk, KEY_CATALOGO);
  return JSON.stringify({ nuove: _nuoveDi(possesso, _visibiliDi(cat, !!possesso.admin)) });
}

// ══════════════════════════════════════════════════════════════════════════
// v0.79.75 — LE DUE PORTE DELLE QUEST
// ══════════════════════════════════════════════════════════════════════════
// hx_quest        le chiede, e con `eventi` racconta le carte girate.
// hx_quest_riscuoti  incassa: tutte quelle finite, o una sola.
//
// SU COSA CI SI FIDA, detto per esteso perche' non e' scontato. Le partite e
// le vittorie le conta il server dentro applicaEsito, dove sa com'e' andata.
// Le CARTE GIRATE no: succedono dentro alla partita, e il server della partita
// non le guarda. Arrivano quindi dal client, e un client puo' mentire.
// Si fa quel che si puo': un tetto per chiamata (nessuno gira quaranta carte
// in una partita da diciannove caselle), e i premi in gioco sono venticinque
// di inchiostro o una bustina. Non e' una difesa, e' un limite di danno — e
// scriverlo qui vale piu' che fingere che sia una difesa.
var QUEST_TETTO_PER_CHIAMATA = { flip: 40, flip_timeless: 10, flip_multiplo: 10 };
function rpcQuest(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var dentro = {};
  try { dentro = payload ? JSON.parse(payload) : {}; } catch (e) { dentro = {}; }
  var possesso = assicuraPossesso(ctx, nk, logger, ctx.userId, ctx.username);
  var daScrivere = assicuraQuestDelGiorno(logger, possesso, ctx.userId);
  var mosse = [];
  var eventi = dentro.eventi;
  if (eventi) {
    var pvp = !!dentro.pvp;
    for (var conta in QUEST_TETTO_PER_CHIAMATA) {
      var quanto = parseInt(eventi[conta], 10);
      if (!isFinite(quanto) || quanto <= 0) continue;
      quanto = Math.min(quanto, QUEST_TETTO_PER_CHIAMATA[conta]);
      var m = avanzaQuest(possesso, conta, quanto, pvp);
      if (m.length) { mosse = mosse.concat(m); daScrivere = true; }
    }
  }
  if (daScrivere) scriviPossesso(nk, ctx.userId, possesso);
  return JSON.stringify({ quest: questPerIlClient(possesso), mosse: mosse });
}
function rpcQuestRiscuoti(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve un accesso');
  var dentro = {};
  try { dentro = payload ? JSON.parse(payload) : {}; } catch (e) { dentro = {}; }
  var possesso = assicuraPossesso(ctx, nk, logger, ctx.userId, ctx.username);
  assicuraQuestDelGiorno(logger, possesso, ctx.userId);
  // `quale` e' un indice, o niente per dire "tutte quelle finite". Il conto
  // di CHI puo' essere riscosso lo rifa' il server: il client dice quale, non
  // se si puo'.
  var quale = (typeof dentro.quale === 'number') ? dentro.quale : -1;
  var lista = possesso.quest.lista;
  var presi = [];
  for (var i = 0; i < lista.length; i++) {
    if (quale >= 0 && i !== quale) continue;
    var voce = lista[i];
    var def = questDefinizione(voce.id);
    if (!def || voce.presa) continue;
    if ((voce.fatto || 0) < def.quanto) continue;
    var dato = _pagaQuest(possesso, def);
    voce.presa = true;
    presi.push({ id: def.id, premio: dato.premio, quanto: dato.quanto });
  }
  if (presi.length) {
    scriviPossesso(nk, ctx.userId, possesso);
    logger.info('quest riscosse da %s: %d', ctx.userId, presi.length);
  }
  return JSON.stringify({
    presi: presi,
    quest: questPerIlClient(possesso),
    valute: valuteDi(possesso),
    bustineExtra: possesso.bustineExtra || 0
  });
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
//   • IL TEMPO      — i secondi del turno li conta lui (TURNO_MS). Il client
//                     mostra un conto alla rovescia, ma la scadenza e' quella del
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
// v0.79.84 — server -> client, personale: l'altro non ha accettato (ha detto
// di no, o ha lasciato scadere i dieci secondi). Chi lo riceve torna in
// cerca da solo. E' un messaggio a se' e non un OP_FINE con un motivo: una
// partita che non e' mai cominciata non e' una partita finita, e chi la
// riceve non deve vedere una schermata di risultato.
var OP_NON_ACCETTATO = 13;

// v0.79.57 — quarantacinque secondi. Vedi TURN_SECS in play/index.html: sono
// lo stesso numero detto due volte, e il server e- quello che comanda. Se i due
// non combaciano, il client mostra un conto alla rovescia che non e- quello
// vero: la barra arriva a zero e il turno continua, oppure si tronca con la
// barra ancora a meta-.
var TURNO_MS = 45000;        // i quarantacinque secondi del turno
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
// ── v0.79.84 — I DIECI SECONDI PER DIRE DI SI' ──────────────────────────
// Trovato l'avversario, i due hanno dieci secondi per accettare. ACCETTARE
// VUOL DIRE ENTRARE: il client mostra lo splash e chiama match_join solo se
// si preme "Accept". Chi rifiuta semplicemente non entra — e lo dice, cosi'
// l'altro riparte subito invece di aspettare la scadenza (vedi rpcRifiuta).
//
// A CONTARLI E' QUI. Se li contasse ogni client per se', la latenza farebbe
// scadere il tempo a uno prima che all'altro, e il caso in cui accettano
// tutti e due sul filo diventerebbe una lotteria. La barra che si vede e' un
// disegno di questa scadenza, non la scadenza.
//
// Trenta secondi erano la vecchia rete di sicurezza per una partita in cui i
// due entravano da soli; adesso l'attesa e' una scelta di chi gioca, e dura
// quanto lo splash.
var PRONTI_MS = 10000;
var ATTESA_INGRESSO_MS = PRONTI_MS + 2000;  // due secondi di grazia per la rete

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
// ── v0.79.59 — CHI HA FRETTA PARTE IN MANO, ANCHE IN RETE ────────────────
// White Rabbit dice 'Starts the game in hand'. Il client lo sa fare da sempre
// (_inCimaChiHaFretta: le carte con rush_hour in cima al mazzo prima di
// pescare), ma in rete la mano la distribuisce il SERVER, qui sotto in
// _comincia — con un mescolamento e basta. Il Coniglio partiva in mano contro
// l'IA e quasi mai contro una persona, e nessuna delle due parti poteva
// accorgersene: il client riceve una mano gia' fatta.
// L'abilita' la dice il catalogo (cardAbility), che sta gia' nella memoria del
// server: si legge una volta per versione, come fanno le parole del gioco per
// il filtro dei nomi.
var _fretta = null;
var _frettaVersione = null;
function _idConFretta(nk) {
  var catalogo = null;
  try { catalogo = leggiSistema(nk, KEY_CATALOGO); } catch (e) { catalogo = null; }
  if (!catalogo || !catalogo.carte) return _fretta || {};
  if (_fretta && _frettaVersione === catalogo.versione) return _fretta;
  var fuori = {};
  for (var i = 0; i < catalogo.carte.length; i++) {
    var c = catalogo.carte[i];
    if (c && c.cardAbility === 'rush_hour') {
      if (c.id) fuori[String(c.id)] = true;
      if (c.slug) fuori[String(c.slug)] = true;
    }
  }
  _fretta = fuori;
  _frettaVersione = catalogo.versione;
  return fuori;
}
function _inCimaChiHaFretta(nk, carte) {
  var fretta = _idConFretta(nk);
  var prima = [], dopo = [];
  for (var i = 0; i < carte.length; i++) {
    (fretta[String(carte[i])] ? prima : dopo).push(carte[i]);
  }
  return prima.concat(dopo);
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
    // v0.79.59 — mescolato, e POI chi ha fretta in cima: e' la stessa regola
    // del client, e vale anche qui, che e' l'unico posto in cui in rete la
    // mano si decide davvero.
    var mescolato = _inCimaChiHaFretta(nk, _mescola(stato.mazzoIniziale[u].slice()));
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
  // v0.79.70 — e si segna chi giocava contro chi. Vedi COLL_PARTITE: e' cio'
  // che permette a una segnalazione di dire un nome invece di una lamentela.
  // Non fa fallire l'inizio della partita: se non si riesce a scrivere, si
  // perde la possibilita' di segnalare qualcuno in QUESTA partita — che e'
  // molto meno grave di non farla cominciare.
  try {
    if (stato.matchId) {
      nk.storageWrite([{
        collection: COLL_PARTITE, key: stato.matchId,
        userId: '00000000-0000-0000-0000-000000000000',
        value: { giocatori: stato.giocatori.slice(), quando: Date.now() },
        permissionRead: 0, permissionWrite: 0
      }]);
    }
  } catch (eP) { logger.warn('registro della partita non scritto: %s', String(eP)); }
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

// ── v0.79.90 — IL LIVELLO DI OGNI CARTA, PER CHI GIOCA CONTRO ─────────────
// Fino a ieri viaggiava un numero solo per giocatore (info.livello, quello del
// suo account), e il client lo applicava a tutte le sue carte. Adesso ogni
// carta ha il suo, e i due client devono vedere la stessa carta con gli stessi
// numeri: il livello lo dice il server, carta per carta, e solo per le carte
// del mazzo che scende in campo. Il resto della collezione non e' affare
// dell'avversario.
// Si calcola QUI e non in accoppiati: col mazzo casuale _mazzoDi ne compone uno
// nuovo a ogni chiamata, e il mazzo che conta e' quello scritto qui.
function _livelliPerLaPartita(nk, logger, stato) {
  var catalogo = leggiSistema(nk, KEY_CATALOGO);
  if (!catalogo || !catalogo.carte) return;
  for (var g = 0; g < stato.giocatori.length; g++) {
    var u = stato.giocatori[g];
    var pos = null;
    try { pos = leggiPossesso(nk, u); } catch (e) { pos = null; }
    if (!pos) continue;
    var admin = !!pos.admin;
    var carte = [];
    var perId = {};
    for (var i = 0; i < catalogo.carte.length; i++) {
      var c = catalogo.carte[i];
      perId[String(c.id)] = c;
      if (c.soloAdmin && !admin) continue;
      carte.push(c);
    }
    var possedute = _possedute(carte, pos, admin);
    var livelli = {};
    var mazzo = stato.mazzoIniziale[u] || [];
    for (var m = 0; m < mazzo.length; m++) {
      var carta = perId[String(mazzo[m])];
      if (carta) livelli[carta.slug] = possedute[carta.slug] || LIVELLO_NORMALE;
    }
    if (!stato.info[u]) stato.info[u] = {};
    stato.info[u].livelli = livelli;
  }
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
  try { _livelliPerLaPartita(nk, logger, stato); }
  catch (el) { logger.warn('livelli delle carte non calcolati: %s', String(el)); }
  // Un tick al secondo basta: qui non si anima niente, si guarda un orologio.
  return { state: stato, tickRate: 1, label: JSON.stringify({ gioco: 'hextale' }) };
}

function partitaJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  // Entra solo chi e' stato accoppiato. Un match id che gira non deve essere
  // un invito per chiunque lo intercetti.
  if (_indiceDi(state, presence.userId) === -1) return { state: state, accept: false, rejectMessage: 'non sei di questa partita' };
  // v0.79.32 — e la casella verificata. Qui non ci si arriva senza essere
  // passati dalla coda, che gia' controlla: questa e' la seconda mandata alla
  // stessa porta, e costa una riga. Le serrature che contano stanno sulla
  // porta, non sul cartello davanti.
  if (!_verificato(nk, presence.userId)) return { state: state, accept: false, rejectMessage: 'verifica la tua email prima di giocare in rete' };
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

// v0.79.18 — qui viveva _chiStavaVincendo, che leggeva dall'ultimo racconto
// concordato chi fosse avanti quando l'altro e' uscito. Serviva a decidere il
// premio di chi restava, e non serve piu': chi resta ha vinto, punto.

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
// ── v0.79.18 — CHI ABBANDONA PERDE. SEMPRE. ───────────────────────────────
// Deciso da Lorenzo, e non ammette casi: chi lascia la partita l'ha persa, chi
// resta l'ha vinta. Non importa chi fosse avanti.
//
// Prima non era cosi': nessuno dei due aveva vinto, e il premio di chi restava
// dipendeva da come stava andando. Il risultato si e' visto in partita — chi
// era avanti se n'e' andato, il server non ha dichiarato nessun vincitore, e la
// schermata di fine, non avendo altro da guardare, ha incoronato chi aveva piu'
// punti: cioe' PROPRIO CHI AVEVA MOLLATO. Da fuori: "ha abbandonato e ha vinto".
//
// Era anche una via d'uscita: perdi, esci, e ti porti via il pareggio.
//
// Il rank resta fermo per tutti e due (vedi applicaEsito): il server non sa
// distinguere un crash da un abbandono per ripicca, e togliere un gradino a chi
// ha perso la corrente sarebbe peggio del problema che risolve. E' l'unica
// parte della vecchia lettura che resta in piedi, ed e' una decisione a se'.
function _uscita(state, dispatcher, logger, nk, chiEUscito) {
  for (var i = 0; i < state.giocatori.length; i++) {
    var u = state.giocatori[i];
    var uscito = (u === chiEUscito);
    try {
      var esito = applicaEsito(nk, u, !uscito, false, false,
        state.turniGiocati[u], uscito ? 'uscito' : 'resta');
      esito.vinta = !uscito;
      esito.pari = false;
      esito.perAbbandono = true;
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
      // v0.79.18 — E SI DICE CHI HA VINTO. Qui mancava, ed e' tutto il guasto:
      // il client riceveva la notizia senza un vincitore e cadeva sull'unica
      // cosa che gli restava, il confronto fra i punti — incoronando chi era
      // avanti, cioe' spesso proprio chi se n'era andato.
      // La resa lo diceva gia' (vedi il suo _aTutti): le due porte adesso
      // parlano la stessa lingua.
      var haMollato = _indiceDi(state, u);
      var restaInPiedi = (haMollato === 0) ? 2 : 1;
      _aTutti(dispatcher, OP_FINE, { motivo: 'abbandono', chi: haMollato + 1,
                                     vincitore: restaInPiedi });
      logger.info('partita finita per abbandono di %s: vince il giocatore %d', u, restaInPiedi);
    }
  }
  return { state: state };
}

function partitaLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
  // Nessuno e' entrato entro il tempo: la partita non c'e' mai stata.
  if (!state.iniziata && Date.now() - state.natoIl > ATTESA_INGRESSO_MS) {
    // v0.79.84 — e chi c'era dentro ad aspettare se lo sente dire. Prima si
    // tornava null e basta: il tavolo spariva e chi aveva accettato restava a
    // guardare una finestra che non rispondeva piu'. Una porta che si chiude
    // in silenzio e' indistinguibile da una porta rotta.
    _nessunoHaAccettato(state, dispatcher, logger, 'tempo scaduto');
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
    // ── v0.79.59 — I VALORI CON CUI LA CARTA SCENDE ──────────────────────
    // Il client li manda perche' l'altro client non puo' saperli: cio' che e'
    // successo a una carta mentre stava in mano (un dono, un furto) lo sa solo
    // chi la teneva. Il server non li giudica — come non giudica nessun
    // effetto: le regole vivono nei client e l'ombra le confronta — ma li
    // ripulisce: sei lati, numeri interi fra 0 e 99, o niente.
    var valori = null;
    if (corpo.valori && typeof corpo.valori === 'object') {
      valori = {};
      var lati = ['NE', 'E', 'SE', 'SW', 'W', 'NW'];
      for (var vi = 0; vi < lati.length; vi++) {
        var vn = Number(corpo.valori[lati[vi]]);
        if (!isFinite(vn)) { valori = null; break; }
        valori[lati[vi]] = Math.max(0, Math.min(99, Math.floor(vn)));
      }
    }

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
      giocatore: idx + 1, carta: carta, q: q, r: r, valori: valori,
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

// v0.79.84 — CHI DICE DI NO NON E' DENTRO, E DEVE POTER PARLARE LO STESSO.
// Chi rifiuta non ha mai fatto match_join: non ha una presenza, non puo'
// mandare un messaggio alla partita. Bussa quindi da fuori, per RPC, e l'RPC
// usa matchSignal — che e' l'unica porta di servizio che un match ha verso
// chi non ci sta dentro.
// Senza questa strada l'altro imparerebbe la notizia solo alla scadenza:
// dieci secondi passati a fissare "Waiting for your opponent..." quando la
// risposta era gia' arrivata.
// v0.79.85 — L'AVVISO CHE ARRIVA ANCHE A CHI NON E' ANCORA ENTRATO.
// OP_NON_ACCETTATO passa dalla partita, e dalla partita lo sente solo chi ci e'
// dentro — cioe' chi ha gia' premuto Accept. L'altro caso, il piu' comune, e'
// che nessuno dei due abbia ancora premuto niente: A dice di no, e B resta
// davanti allo splash senza saperlo. Se poi B preme Accept, entra in un tavolo
// gia' chiuso e il server gli risponde con un errore.
// La notifica di Nakama arriva al socket del giocatore e non alla partita:
// raggiunge B dovunque sia. Si manda a tutti e due gli accoppiati tranne chi
// ha rifiutato; chi era gia' entrato la riceve due volte (anche da
// OP_NON_ACCETTATO) e il client la conta una volta sola.
// Il mittente e' null e non una stringa vuota: il runtime vuole un
// identificativo valido o niente, e con '' si ferma.
var CODICE_NON_ACCETTATO = 101;
function _avvisaGliAltri(nk, logger, state, chiRifiuta, matchId, scaduto) {
  for (var i = 0; i < state.giocatori.length; i++) {
    var u = state.giocatori[i];
    if (u === chiRifiuta) continue;
    try {
      // v0.79.87 — e dice a ciascuno se deve TORNARE IN CERCA. La regola di
      // Lorenzo: chi non ha premuto Accept in tempo non rientra, mai. Torna
      // quindi solo chi aveva accettato (e' dentro alla partita, ha una
      // presenza), oppure chi e' stato interrotto da un rifiuto esplicito
      // mentre aveva ancora tempo. Il caso che si rompeva: nessuno dei due
      // accetta, il primo a scadere avvisa l'altro, e l'altro — il cui
      // orologio segnava ancora qualche centesimo — tornava in coda.
      // Lo decide il server perche' la scadenza vera la conosce solo lui.
      var torna = !!state.presenze[u] || !scaduto;
      nk.notificationSend(u, 'partita-rifiutata', { matchId: matchId, torna: torna }, CODICE_NON_ACCETTATO, null, false);
    } catch (e) { if (logger) logger.warn('notifica di rifiuto non consegnata a %s: %s', u, String(e)); }
  }
}
function _nessunoHaAccettato(state, dispatcher, logger, perche) {
  var dentro = [];
  for (var i = 0; i < state.giocatori.length; i++) {
    var p = state.presenze[state.giocatori[i]];
    if (p) dentro.push(p);
  }
  if (dentro.length) {
    try {
      dispatcher.broadcastMessage(OP_NON_ACCETTATO, JSON.stringify({ perche: perche }), dentro, null);
    } catch (e) { if (logger) logger.warn('avviso non consegnato: %s', String(e)); }
  }
  if (logger) logger.info('partita non cominciata (%s): avvisati %d', perche, dentro.length);
}
function partitaSignal(ctx, logger, nk, dispatcher, tick, state, data) {
  var d = {};
  try { d = data ? JSON.parse(data) : {}; } catch (e) { d = {}; }
  if (d.rifiuta && !state.iniziata) {
    // Solo da uno dei due accoppiati: un segnale da chiunque altro non deve
    // poter buttare giu' un tavolo.
    if (_indiceDi(state, String(d.rifiuta)) !== -1) {
      state.rifiutata = true;
      _nessunoHaAccettato(state, dispatcher, logger, 'rifiutata');
      // v0.79.87 — il tempo e' finito se chi rifiuta lo dice (il suo orologio
      // e' arrivato a zero) o se lo dice il nostro. Vale il primo dei due: la
      // regola deve stare dalla parte di chi non ha accettato in tempo.
      var scaduto = !!d.perTempo || (Date.now() - state.natoIl >= PRONTI_MS);
      _avvisaGliAltri(nk, logger, state, String(d.rifiuta), (ctx && ctx.matchId) || '', scaduto);
      return null;   // il tavolo si chiude qui
    }
  }
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
  // ── v0.79.59 — I MAZZI SI CONTROLLANO QUI, NON DOPO ─────────────────────
  // matchInit li legge e, se uno dei due non e' valido, torna null: la partita
  // non nasce, Nakama manda ai due un accoppiamento SENZA match_id, e il
  // client fino a ieri ci giocava sopra una partita finta contro l'IA. Se il
  // mazzo non va, lo si dice subito nel registro e si rinuncia in modo pulito:
  // i client ricevono lo stesso 'senza partita', ma adesso lo dicono al
  // giocatore invece di fingere.
  for (var g = 0; g < giocatori.length; g++) {
    var mz = null;
    try { mz = _mazzoDi(nk, logger, giocatori[g]); } catch (em) { mz = null; }
    if (!mz) {
      logger.warn('accoppiamento rifiutato: %s non ha un mazzo valido', giocatori[g]);
      return '';
    }
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
  // ── v0.79.59 — 'A CASO' DIPENDE ANCHE DA CHI PESCA ────────────────────
  // La pescata usciva da seme|turno|quante: due carte con la stessa abilita'
  // nello stesso turno — il Genio e lo Specchio che l'ha copiato — pescavano
  // la STESSA carta, e la stessa carta si prendeva due volte lo stesso dono
  // sugli stessi lati. Adesso entra anche la fonte, tramite _occasione (che
  // gia' distingue le carte per casella e serve ai lati 'a caso'): due fonti,
  // due pescate. Resta ripetibile — e' tutto seme — quindi in rete i due
  // client continuano a pescare uguale.
  function scelti(lista, eff, scena, fonte) {
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
        var occ = fonte ? _occasione(fonte, scena) : String(scena.seme);
        return [lista[_semeDi(occ + '|' + String(scena.turno || 0) + '|' + lista.length) % lista.length]];
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
      var presi = scelti(possibili, eff, scena, fonte);
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
      var scelte = scelti(daCui, eff, scena, fonte);
      for (var s = 0; s < scelte.length; s++) {
        fuori.push({ azione: 'steal', cosa: eff.cosa, fonte: fonte, carta: scelte[s], quale: eff.quale, dove: eff.dove });
      }
      return;
    }
    if (az !== 'buff' && az !== 'debuff' && az !== 'set' && az !== 'steal') return;
    if (eff.cosa && eff.cosa !== 'power') return;      // un furto di potenza, e nient'altro
    if (!condizioneVera(cond, fonte, scena)) return;

    var lista = scelti(candidati(fonte, eff, scena), eff, scena, fonte);
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
        // ── v0.79.17 — E CHI L-HA FATTO ─────────────────────────────────
        // Da qui uscivano cambiamenti orfani: il bersaglio, i lati e il
        // numero, ma non chi lo stava facendo. Chi esegue (applicaCambiamenti,
        // nel gioco) non aveva quindi un nome da scrivere nel registro dei
        // modificatori, e il riquadro "Buffs/debuffs" mostrava un "+2 ALL"
        // senza nessuno accanto — per meta- del mazzo.
        // La fonte ce l-abbiamo qui da sempre: e- il primo argomento di questa
        // funzione. Va solo detta.
        fuori.push({ carta: bersaglio, lati: lati, valore: v, azione: 'set', fonte: fonte });
      } else {
        var d = (az === 'debuff' || az === 'steal') ? -q : q;
        if (!d) continue;
        fuori.push({ carta: bersaglio, lati: lati, delta: d, azione: az, fonte: fonte });
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
  initializer.registerRpc('hx_quest', rpcQuest);
  initializer.registerRpc('hx_quest_riscuoti', rpcQuestRiscuoti);
  initializer.registerRpc('hx_preferenze', rpcPreferenze);
  initializer.registerRpc('hx_avatar', rpcAvatar);
  initializer.registerRpc('hx_bustina_azzera', rpcBustinaAzzera);
  initializer.registerRpc('hx_segnalazione', rpcSegnalazione);
  initializer.registerRpc('hx_report', rpcReport);
  initializer.registerRpc('hx_accordo', rpcAccordo);
  initializer.registerRpc('hx_starter', rpcStarter);
  initializer.registerRpc('hx_tutorial', rpcTutorial);
  initializer.registerRpc('hx_rifiuta', rpcRifiuta);
  initializer.registerRpc('hx_posta_config', rpcPostaConfig);
  initializer.registerRpc('hx_verifica_stato', rpcVerificaStato);
  initializer.registerRpc('hx_verifica_invia', rpcVerificaInvia);
  initializer.registerRpc('hx_verifica_prova', rpcVerificaProva);
  // Le due che NON passano da una sessione: ci arriva Caddy con la chiave del
  // runtime, perche' chi ha perso la password una sessione non ce l'ha.
  initializer.registerRpc('hx_recupero_chiedi', rpcRecuperoChiedi);
  initializer.registerRpc('hx_recupero_cambia', rpcRecuperoCambia);
  initializer.registerRpc('hx_contatto', rpcContatto);
  initializer.registerRpc('hx_recaptcha_config', rpcRecaptchaConfig);
  // v0.79.50 — l'accesso con Google. La prima si chiama SENZA sessione, per
  // forza: e' un accesso. Ci arriva /google/entra, scritto per nome nel
  // Caddyfile, che aggiunge lui la chiave del runtime.
  initializer.registerRpc('hx_google_entra', rpcGoogleEntra);
  initializer.registerRpc('hx_google_config', rpcGoogleConfig);
  initializer.registerRpc('hx_elimina_account', rpcEliminaAccount);
  initializer.registerRpc('hx_giocatori', rpcGiocatoriOnline);
  initializer.registerRpc('hx_entro', rpcEntro);
  initializer.registerRpc('hx_esco', rpcEsco);
  initializer.registerRpc('hx_carte_viste', rpcCarteViste);
  initializer.registerRpc('hx_bustina_apri', rpcBustinaApri);
  initializer.registerRpc('hx_bustina_raccogli', rpcBustinaRaccogli);
  initializer.registerRpc('hx_bustina_compra', rpcBustinaCompra);
  initializer.registerRpc('hx_carta_livella', rpcCartaLivella);
  initializer.registerRpc('hx_debug_regala', rpcDebugRegala);
  // ── v0.79.46 — IL GANCIO SUL CAMBIO NOME ────────────────────────────────
  // Il nome lo cambia il client con una PUT a /v2/account: questo e' l'unico
  // punto in cui il server puo' dire di no, e vale per chiunque lo chiami.
  // Il try non e' pigrizia: se un domani il runtime cambiasse il nome di questo
  // gancio, senza di lui InitModule fallirebbe e il modulo NON SI CARICHEREBBE
  // — cioe' il gioco intero smetterebbe di funzionare per un filtro sui nomi.
  // Cosi' invece si perde il filtro e lo si legge nel registro, che e' il verso
  // giusto in cui sbagliare.
  // Si passa il NOME della funzione, non un blocco scritto qui: vedi
  // primaDiCambiareProfilo per il perche' — un anonimo non si registra e basta.
  // Il try resta: se un domani il runtime cambiasse il nome di questo gancio,
  // senza di lui InitModule fallirebbe e il modulo NON si caricherebbe, cioe'
  // il gioco intero fermo per un filtro sui nomi. Cosi' invece si perde il
  // filtro e lo si legge nel registro — che e' il verso giusto in cui
  // sbagliare, ed e' gia' servito una volta.
  try {
    initializer.registerBeforeUpdateAccount(primaDiCambiareProfilo);
    logger.info('filtro dei nomi attivo: %d parole', PAROLACCE_TESTO.split(' ').length);
  } catch (e) {
    logger.error('FILTRO DEI NOMI NON ATTIVO: %s', String(e));
  }
  // v0.77.53 — la partita in rete. registerMatch da' un nome al gestore;
  // registerMatchmakerMatched fa in modo che, accoppiati due giocatori, la
  // partita nasca da sola e il suo id arrivi ai due client dentro allo stesso
  // messaggio di accoppiamento che gia' ricevevano.
  initializer.registerMatch('hextale', partita);
  initializer.registerMatchmakerMatched(accoppiati);
  // v0.79.32 — la coda si chiede il permesso prima di accettare un biglietto.
  initializer.registerRtBefore('MatchmakerAdd', primaDiCercare);
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
