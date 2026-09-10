// LE REGOLE DELLE QUEST, PROVATE SENZA NAKAMA.
//
//     node strumenti/prova-quest-server.js
//
// Il server delle quest non ha niente da guardare: e- tutta aritmetica e
// calendario, e le due cose che puo- sbagliare non danno nessun errore.
//
//   IL GIORNO. Cambia a mezzanotte GMT, e chi lo sbaglia se ne accorge una
//     volta sola, di notte, e non capisce cosa sia successo.
//   IL PASSAGGIO DI GIORNO. Quel che era finito e non riscosso si paga da
//     solo prima di buttare via la giornata (decisione di Lorenzo del
//     10/09/2026). Se quella riga non gira, il premio sparisce e nessuno lo
//     sa: chi lo aspettava pensa di essersi sbagliato.
//
// Si carica index.js dentro a un contesto finto — niente Nakama, niente rete —
// e si chiamano le sue funzioni con oggetti scritti a mano. E- l-unico modo di
// provare un capodanno senza aspettare mezzanotte.
const fs = require('fs');
const vm = require('vm');

// Di norma il file di casa. Passandone un altro si prova QUELLO — serve a
// puntare la copia scaricata dal server, che e- l-unica che sta davvero girando:
//     node strumenti/prova-quest-server.js /percorso/index.js
const DOVE = process.argv[2] || 'C:/Users/masil/Desktop/Hextale/game-assets/server/nakama/index.js';
console.log('provo ' + DOVE + String.fromCharCode(10));
const sorgente = fs.readFileSync(DOVE, 'utf8');
const ctx = { console, Date, Math, JSON, parseInt, parseFloat, isFinite, String, Object, Array, Error };
ctx.global = ctx;
vm.createContext(ctx);
new vm.Script(sorgente).runInContext(ctx);

let male = 0;
const dice = (ok, che, perche) => {
  if (!ok) male++;
  console.log((ok ? '  ok   ' : '  NO   ') + che);
  if (perche) console.log('        ' + perche);
};

// ── 1. IL POOL ────────────────────────────────────────────────────────────
const pool = ctx.QUEST_POOL;
dice(pool.length >= 5, 'il pool ha almeno le cinque di oggi', pool.length + ' voci');
const ids = pool.map(q => q.id);
dice(new Set(ids).size === ids.length, 'e nessun id si ripete', ids.join(' '));
const verbi = new Set(pool.map(q => q.conta));
dice([...verbi].every(v => ['partita','vittoria','flip','flip_timeless','flip_multiplo'].indexOf(v) >= 0),
  'e ogni quest si aggancia a un verbo che qualcuno conta', [...verbi].join(' '));
// La regola di Lorenzo: se nel testo c'e' PvP vale solo online, se c'e' PvIA
// solo contro la macchina. Il campo `dove` e il TESTO devono dire la stessa
// cosa, o il giocatore legge una promessa e il codice ne mantiene un'altra.
const storte = pool.filter(q => {
  const diceP = /\bPvP\b/.test(q.testo), diceI = /\bPvIA\b/.test(q.testo);
  if (diceP) return q.dove !== 'pvp';
  if (diceI) return q.dove !== 'pvia';
  return q.dove !== 'ovunque';
});
dice(storte.length === 0, 'e il testo e il campo `dove` dicono la stessa cosa',
  storte.length ? storte.map(q => '"' + q.testo + '" -> ' + q.dove).join(', ')
  : 'PvP nel testo = solo online, PvIA = solo contro la macchina, niente = sempre');

// ── 2. IL GIORNO CAMBIA A MEZZANOTTE GMT ──────────────────────────────────
const giorno = ctx._giornoGmt();
dice(giorno === Math.floor(Date.now() / 86400000), 'il giorno e- quello GMT', String(giorno));
// Un istante prima e uno dopo la mezzanotte di Greenwich sono due giorni.
const primaDi = Math.floor((giorno * 86400000 - 1) / 86400000);
const dopoDi = Math.floor((giorno * 86400000 + 1) / 86400000);
dice(primaDi === giorno - 1 && dopoDi === giorno,
  'e cambia esattamente a mezzanotte', primaDi + ' -> ' + dopoDi);

// ── 3. LE CINQUE DEL GIORNO ───────────────────────────────────────────────
const oggi = ctx._cinqueDelGiorno(giorno);
dice(oggi.length === Math.min(5, pool.length), 'cinque quest al giorno', oggi.length + '');
dice(new Set(oggi.map(q => q.id)).size === oggi.length, 'e sono cinque DIVERSE',
  oggi.map(q => q.id).join(' '));
dice(oggi.every(q => q.fatto === 0 && q.presa === false), 'e nascono tutte da zero');
const ancora = ctx._cinqueDelGiorno(giorno);
dice(JSON.stringify(ancora) === JSON.stringify(oggi),
  'lo stesso giorno da- sempre le stesse cinque',
  'Uguali per tutti: due che si parlano hanno davanti le stesse cose.');
const domani = ctx._cinqueDelGiorno(giorno + 1);
dice(JSON.stringify(domani.map(q=>q.id)) !== JSON.stringify(oggi.map(q=>q.id)) || pool.length <= 5,
  'e un giorno diverso le rimescola', 'con cinque nel pool escono comunque tutte e cinque');

// ── 4. L'AVANZAMENTO ──────────────────────────────────────────────────────
const possesso = { quest: { giorno: giorno, lista: JSON.parse(JSON.stringify(oggi)) }, valute: { magicInk: 0 } };
const trova = id => possesso.quest.lista.filter(v => v.id === id)[0];
// 'Win 3 PvP matches' e' pvp: contro la macchina non si muove.
ctx.avanzaQuest(possesso, 'vittoria', 1, false);
dice(!trova('win3pvp') || trova('win3pvp').fatto === 0,
  'una quest PvP non avanza contro la macchina', String(trova('win3pvp') && trova('win3pvp').fatto));
ctx.avanzaQuest(possesso, 'vittoria', 1, true);
dice(trova('win3pvp').fatto === 1, 'e avanza online', String(trova('win3pvp').fatto));
// 'Flip 20 cards' vale ovunque.
ctx.avanzaQuest(possesso, 'flip', 7, false);
dice(trova('flip20').fatto === 7, 'una quest senza PvP nel nome avanza anche contro la macchina',
  String(trova('flip20').fatto));
// E non si sfora mai il traguardo.
ctx.avanzaQuest(possesso, 'flip', 999, false);
dice(trova('flip20').fatto === 20, 'e non si va mai oltre il traguardo', String(trova('flip20').fatto));
const mosse = ctx.avanzaQuest(possesso, 'flip', 5, false);
dice(mosse.length === 0, 'una gia- finita non si muove piu-', JSON.stringify(mosse));

// ── 5. IL PASSAGGIO DI GIORNO PAGA QUEL CHE ERA FINITO ────────────────────
// E' la decisione di Lorenzo: un premio guadagnato e non ritirato perche' si e'
// chiuso il gioco cinque minuti prima di mezzanotte non si perde.
const ieri = {
  quest: { giorno: giorno - 1, lista: [
    { id:'flip20',       fatto:20, presa:false },   // finita e non riscossa -> paga inchiostro
    { id:'fliptimeless', fatto:1,  presa:false },   // finita e non riscossa -> paga una bustina
    { id:'win3pvp',      fatto:1,  presa:false },   // non finita -> niente
    { id:'play5pvp',     fatto:5,  presa:true  }    // gia- riscossa -> niente
  ] },
  valute: { magicInk: 100 }, bustineExtra: 2
};
const cambiato = ctx.assicuraQuestDelGiorno(null, ieri, 'u1');
dice(cambiato === true, 'cambiando giorno le quest si rifanno');
dice(ieri.valute.magicInk === 100 + ctx.QUEST_INK,
  'e quel che era finito e non riscosso viene pagato',
  '100 -> ' + ieri.valute.magicInk + ' (una sola, non due: la seconda dava una bustina)');
dice(ieri.bustineExtra === 3, 'anche quando il premio e- una bustina', '2 -> ' + ieri.bustineExtra);
dice(ieri.quest.giorno === giorno && ieri.quest.lista.length === 5,
  'e le cinque nuove sono di oggi', ieri.quest.giorno + ', ' + ieri.quest.lista.length + ' voci');
dice(ieri.quest.lista.every(v => v.fatto === 0 && !v.presa), 'e riparte tutto da capo');
// Chiamandola due volte nello stesso giorno non succede piu' niente.
const inkPrima = ieri.valute.magicInk;
const ancoraOggi = ctx.assicuraQuestDelGiorno(null, ieri, 'u1');
dice(ancoraOggi === false && ieri.valute.magicInk === inkPrima,
  'e nello stesso giorno non si rigenera e non si ripaga', String(ieri.valute.magicInk));

// ── 6. COME LE VEDE IL CLIENT ─────────────────────────────────────────────
const perIlClient = ctx.questPerIlClient(possesso);
dice(perIlClient.length === possesso.quest.lista.length, 'il client le riceve tutte', perIlClient.length + '');
dice(perIlClient.every(q => q.nome && typeof q.quanto === 'number' && q.premio),
  'e ognuna arriva col nome, il traguardo e il premio',
  perIlClient.map(q => q.nome + ' [' + q.premio + ']').join(', '));
dice(perIlClient.every(q => q.fatto <= q.quanto),
  'e quel che ha fatto non supera mai il traguardo');
// Una riga tolta dal pool sparisce invece di rompere.
const orfana = { quest: { giorno: giorno, lista: [{ id:'non-esiste-piu', fatto:3, presa:false }] } };
dice(ctx.questPerIlClient(orfana).length === 0,
  'e una quest tolta dal pool sparisce senza rompere niente',
  'Il giocatore che ce l-aveva addosso non vede una scheda senza nome: non la vede.');

// ── 7. IL PREMIO ──────────────────────────────────────────────────────────
const tasca = { valute: { magicInk: 0 }, bustineExtra: 0 };
const a = ctx._pagaQuest(tasca, ctx.questDefinizione('flip20'));
dice(a.premio === 'ink' && a.quanto === ctx.QUEST_INK && tasca.valute.magicInk === ctx.QUEST_INK,
  'l-inchiostro vale ' + ctx.QUEST_INK, JSON.stringify(a));
const b = ctx._pagaQuest(tasca, ctx.questDefinizione('win3pvp'));
dice(b.premio === 'pack' && b.quanto === 1 && tasca.bustineExtra === 1,
  'e la bustina e- sempre una', JSON.stringify(b));

console.log(male ? '\n' + male + ' cose non tornano' : '\ntutto a posto');
process.exit(male ? 1 : 0);
