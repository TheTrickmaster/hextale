// I LIVELLI DELLE CARTE, PROVATI SENZA NAKAMA.
//
//     node strumenti/prova-livelli-server.js
//     node strumenti/prova-livelli-server.js /percorso/index.js   (la copia schierata)
//
// Le regole sono di Lorenzo (11/09/2026) e sono tutte numeri: 2, 5 e 9 copie in
// tutto per i livelli 2, 3 e 4; un prezzo in inchiostro per rarita' e livello;
// le carte starter valgono una copia; una copia oltre le nove torna in
// inchiostro; chi c'era gia' sale gratis al livello che le copie gli danno.
// Nessuna di queste cose da' un errore quando e' sbagliata: si prende un
// livello in piu' o in meno, o si paga il prezzo di un'altra rarita', e nessuno
// se ne accorge. Quindi si provano qui, con un magazzino finto in memoria.
const fs = require('fs');
const vm = require('vm');

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
const copia = o => JSON.parse(JSON.stringify(o));

// ── IL MONDO FINTO ────────────────────────────────────────────────────────
// Un catalogo di cinque carte: due del mazzo starter 1, una dello starter 2,
// una di nessuno, una riservata agli admin.
const CATALOGO = { versione: 1, carte: [
  { id: 'final-a', slug: 'a', name: 'A', rarity: 'common',   starterDecks: [1] },
  { id: 'final-b', slug: 'b', name: 'B', rarity: 'rare',     starterDecks: [1] },
  { id: 'final-c', slug: 'c', name: 'C', rarity: 'mythic',   starterDecks: [2] },
  { id: 'final-d', slug: 'd', name: 'D', rarity: 'timeless', starterDecks: [] },
  { id: 'final-x', slug: 'x', name: 'X', rarity: 'rare',     starterDecks: [], soloAdmin: true }
] };
const magazzino = { possesso: {}, bustina: {} };
ctx.leggiSistema = () => copia(CATALOGO);
ctx.leggiPossesso = (nk, u) => magazzino.possesso[u] ? copia(magazzino.possesso[u]) : null;
ctx.scriviPossesso = (nk, u, v) => { magazzino.possesso[u] = copia(v); };
ctx.leggiBustina = (nk, u) => magazzino.bustina[u] ? copia(magazzino.bustina[u]) : null;
ctx.cancellaBustina = (nk, u) => { delete magazzino.bustina[u]; };
ctx.eAdmin = () => false;
const logger = { info() {}, warn() {}, error() {}, debug() {} };
const nk = {};
const chi = u => ({ userId: u, username: u });
const sbaglia = (fn) => { try { fn(); return ''; } catch (e) { return String(e.message || e); } };

// ── 1. LE TABELLE ─────────────────────────────────────────────────────────
const soglie = [1, 2, 4, 5, 8, 9, 30].map(n => n + '->' + ctx.livelloDaCopie(n)).join(' ');
dice(soglie === '1->1 2->2 4->2 5->3 8->3 9->4 30->4',
  'le copie danno il livello: 2 per il 2, 5 per il 3, 9 per il 4', soglie);
const totali = ['common', 'rare', 'mythic', 'timeless'].map(r =>
  r + ' ' + [2, 3, 4].map(l => ctx.costoLivello(r, l)).join('+') + '=' +
  [2, 3, 4].reduce((s, l) => s + ctx.costoLivello(r, l), 0));
dice(totali.join(', ') === 'common 50+150+400=600, rare 100+300+800=1200, mythic 150+450+1200=1800, timeless 200+600+1600=2400',
  'e l-inchiostro e- quello della tabella di Lorenzo', totali.join(', '));
const regole = ctx.regoleLivelliCarte();
dice(regole.max === 4 && regole.copie[4] === 9 && regole.inchiostro.rare[3] === 300 && regole.rimborso.rare === 200,
  'e il client le riceve tutte e tre, rimborso compreso', JSON.stringify(regole));
const avvio = sorgente.slice(sorgente.indexOf('function rpcAvvio('));
dice(avvio.slice(0, avvio.indexOf('\n}\n')).indexOf('livelliCarte: regoleLivelliCarte()') >= 0,
  'e le riceve col profilo, all-avvio');

// ── 2. LO SBUSTO CONTA LE COPIE GIUSTE ────────────────────────────────────
magazzino.possesso.u1 = {
  admin: false, mazzi: [1], livello: 1, livelliCarte: 1,
  valute: { magicInk: 1000, fairyDust: 0 }, carte: {}, copie: {}, viste: {}, avatar: 'x'
};
// a e' dello starter e non e' mai stata sbustata; d e' nuova.
magazzino.bustina.u1 = { carte: ['a', 'd', 'c'], prezzi: { a: 50, d: 1000, c: 500 }, tipo: 'daily' };
let r = JSON.parse(ctx.rpcBustinaRaccogli(chi('u1'), logger, nk, JSON.stringify({ tieni: ['a', 'd'] })));
let p = magazzino.possesso.u1;
dice(p.copie.a === 2, 'una carta del mazzo starter pescata vale la SECONDA copia',
  'copie di a: ' + p.copie.a + ' (fino alla v0.79.89 era 1: lo starter non contava)');
dice(p.copie.d === 1, 'e una carta nuova la prima', 'copie di d: ' + p.copie.d);
dice(r.speso === 50 && p.valute.magicInk === 950, 'tenerne due costa ancora la meno cara', 'speso ' + r.speso);
// v0.79.92 — "New" solo alla prima copia: a era gia' nella Libreria (starter).
dice(r.nuove.indexOf('a') < 0, 'una carta del mazzo starter uscita da un pacchetto NON e- nuova',
  'nuove: ' + JSON.stringify(r.nuove) + ' (fino alla v0.79.91 lo era: nessuno l-aveva mai segnata vista)');
dice(r.nuove.indexOf('d') >= 0, 'una carta mai avuta si');
dice(r.copie.a === 2 && r.possedute.a === 1,
  'la risposta porta le copie, e il livello NON sale da solo', 'a: ' + r.copie.a + ' copie, livello ' + r.possedute.a);

// Nove copie di d: la decima torna in inchiostro.
magazzino.possesso.u1.copie.d = 9;
magazzino.possesso.u1.carte.d = 4;
magazzino.bustina.u1 = { carte: ['d', 'b', 'c'], prezzi: { d: 1000, b: 200, c: 500 }, tipo: 'daily' };
const inkPrima = magazzino.possesso.u1.valute.magicInk;
r = JSON.parse(ctx.rpcBustinaRaccogli(chi('u1'), logger, nk, JSON.stringify({ tieni: ['d'] })));
p = magazzino.possesso.u1;
dice(r.rimborso === 1000 && r.rimborsate.join() === 'd' && p.valute.magicInk === inkPrima + 1000,
  'una copia oltre le nove torna in inchiostro, quanto costa tenere la seconda carta di quella rarita-',
  'timeless: +' + r.rimborso + ', saldo ' + inkPrima + ' -> ' + p.valute.magicInk);
dice(p.copie.d === 9, 'e il conto resta a nove', String(p.copie.d));
magazzino.bustina.u1 = { carte: ['b', 'c', 'd'], prezzi: { b: 200, c: 500, d: 1000 }, tipo: 'daily' };
r = JSON.parse(ctx.rpcBustinaRaccogli(chi('u1'), logger, nk, JSON.stringify({ tieni: ['b'] })));
dice(r.rimborso === 0 && r.rimborsate.length === 0, 'e una copia che serve non rimborsa niente', JSON.stringify(r.rimborsate));

// v0.79.91 — vendere una carta non fa pagare l'altra: resta una delle due
// scelte del pacchetto, ma non entra nella coppia che si paga.
magazzino.possesso.u1.valute.magicInk = 1000;
magazzino.bustina.u1 = { carte: ['d', 'a', 'c'], prezzi: { d: 1000, a: 50, c: 500 }, tipo: 'daily' };
const copieAPrima = magazzino.possesso.u1.copie.a;
r = JSON.parse(ctx.rpcBustinaRaccogli(chi('u1'), logger, nk, JSON.stringify({ tieni: ['d', 'a'] })));
p = magazzino.possesso.u1;
dice(r.speso === 0 && r.rimborso === 1000 && p.valute.magicInk === 2000,
  'vendendone una e tenendone un-altra non si paga niente, e la venduta rende', 'speso ' + r.speso + ', rimborso ' + r.rimborso + ', saldo 1000 -> ' + p.valute.magicInk);
dice(p.copie.a === copieAPrima + 1 && p.copie.d === 9, 'e l-altra prende la sua copia', 'a: ' + copieAPrima + ' -> ' + p.copie.a);
magazzino.bustina.u1 = { carte: ['d', 'a', 'c'], prezzi: { d: 1000, a: 50, c: 500 }, tipo: 'daily' };
dice(/al massimo 2/.test(sbaglia(() => ctx.rpcBustinaRaccogli(chi('u1'), logger, nk, JSON.stringify({ tieni: ['d', 'a', 'c'] })))),
  'ma la venduta resta una delle due scelte: la terza non si prende');

// ── 3. SALIRE DI LIVELLO ──────────────────────────────────────────────────
// b adesso ha 2 copie (starter + questa): puo' andare al 2, non al 3.
p = magazzino.possesso.u1;
dice(p.copie.b === 2, 'b ha due copie', String(p.copie.b));
const livella = (u, slug) => JSON.parse(ctx.rpcCartaLivella(chi(u), logger, nk, JSON.stringify({ slug })));
magazzino.possesso.u1.valute.magicInk = 99;
dice(/inchiostro insufficiente/.test(sbaglia(() => livella('u1', 'b'))),
  'senza inchiostro non si sale', '99 contro 100 per una rare al livello 2');
dice(magazzino.possesso.u1.valute.magicInk === 99, 'e non si paga niente');
magazzino.possesso.u1.valute.magicInk = 1000;
r = livella('u1', 'b');
dice(r.da === 1 && r.livello === 2 && r.speso === 100 && magazzino.possesso.u1.valute.magicInk === 900,
  'con due copie e cento di inchiostro una rare sale al 2', JSON.stringify({ da: r.da, livello: r.livello, speso: r.speso }));
dice(r.possedute.b === 2, 'anche se e- una carta dello starter', 'possedute.b = ' + r.possedute.b);
dice(/copie insufficienti/.test(sbaglia(() => livella('u1', 'b'))),
  'e al 3 no: servono cinque copie', 'ne ha ' + magazzino.possesso.u1.copie.b);
magazzino.possesso.u1.copie.b = 9;
magazzino.possesso.u1.valute.magicInk = 5000;
r = livella('u1', 'b');
dice(r.livello === 3 && r.speso === 300, 'un livello per volta: prima il 3', JSON.stringify({ livello: r.livello, speso: r.speso }));
r = livella('u1', 'b');
dice(r.livello === 4 && r.speso === 800, 'poi il 4', JSON.stringify({ livello: r.livello, speso: r.speso }));
dice(/livello massimo/.test(sbaglia(() => livella('u1', 'b'))), 'e oltre il 4 non si va');
dice(/non possiedi/.test(sbaglia(() => livella('u1', 'c'))), 'una carta che non si possiede non sale');
dice(/sconosciuta/.test(sbaglia(() => livella('u1', 'x'))), 'e una carta da admin non esiste per chi admin non e-');
dice(/quale carta/.test(sbaglia(() => ctx.rpcCartaLivella(chi('u1'), logger, nk, '{}'))), 'e senza dire quale non succede niente');

// ── 4. CHI C'ERA GIA' ─────────────────────────────────────────────────────
magazzino.possesso.u2 = {
  admin: false, mazzi: [1], livello: 1,
  valute: { magicInk: 10, fairyDust: 0 }, viste: {}, avatar: 'x',
  // a: starter, sbustata una volta dopo la v0.79.7 -> copie 1, ne ha 2.
  // b: starter, sbustata prima della v0.79.7 -> nessun conto, ne ha 2.
  // c: non starter, cinque copie -> livello 3.
  // d: non starter, una copia -> resta al 1.
  carte: { a: 1, b: 1, c: 1, d: 1 },
  copie: { a: 1, c: 5, d: 1 }
};
p = ctx.assicuraPossesso(chi('u2'), nk, logger, 'u2', 'u2');
dice(p.copie.a === 2 && p.copie.b === 2, 'alle carte starter sbustate torna la copia che mancava',
  'a: ' + p.copie.a + ', b: ' + p.copie.b);
dice(p.carte.a === 2 && p.carte.b === 2 && p.carte.c === 3 && p.carte.d === 1,
  'e ognuna sale al livello che le copie le danno', JSON.stringify(p.carte));
dice(p.valute.magicInk === 10, 'senza pagare', String(p.valute.magicInk));
dice(magazzino.possesso.u2.livelliCarte === 1, 'e la migrazione si segna', String(magazzino.possesso.u2.livelliCarte));
p = ctx.assicuraPossesso(chi('u2'), nk, logger, 'u2', 'u2');
dice(p.copie.a === 2 && p.copie.b === 2, 'una volta sola: al secondo avvio la copia non si ridà', 'a: ' + p.copie.a);
// Un livello gia' piu' alto non scende.
magazzino.possesso.u3 = { admin: false, mazzi: [1], livello: 1, valute: { magicInk: 0, fairyDust: 0 },
  viste: {}, avatar: 'x', carte: { d: 4 }, copie: { d: 2 } };
p = ctx.assicuraPossesso(chi('u3'), nk, logger, 'u3', 'u3');
dice(p.carte.d === 4, 'e un livello gia- piu- alto di quello delle copie non scende', String(p.carte.d));
// Senza catalogo non si segna: ci si riprova.
const catalogoVero = ctx.leggiSistema;
ctx.leggiSistema = () => null;
magazzino.possesso.u4 = { admin: false, mazzi: [1], livello: 1, valute: { magicInk: 0, fairyDust: 0 },
  viste: {}, avatar: 'x', carte: { c: 1 }, copie: { c: 5 } };
ctx.assicuraPossesso(chi('u4'), nk, logger, 'u4', 'u4');
dice(!magazzino.possesso.u4 || !magazzino.possesso.u4.livelliCarte,
  'senza catalogo la migrazione non si segna come fatta', 'Al prossimo avvio ci si riprova.');
ctx.leggiSistema = catalogoVero;

// ── 4b. "NEW" SOLO ALLA PRIMA COPIA ───────────────────────────────────────
// Una gia' sbustata e non ancora guardata resta nuova anche con un'altra copia:
// la sua prima copia e' ancora da vedere.
magazzino.possesso.u6 = { admin: false, mazzi: [1], livello: 1, livelliCarte: 1, novitaVersione: 1,
  valute: { magicInk: 0, fairyDust: 0 }, avatar: 'x', carte: { d: 1 }, copie: { d: 1 }, viste: {} };
magazzino.bustina.u6 = { carte: ['d', 'b', 'c'], prezzi: { d: 1000, b: 200, c: 500 }, tipo: 'daily' };
r = JSON.parse(ctx.rpcBustinaRaccogli(chi('u6'), logger, nk, JSON.stringify({ tieni: ['d'] })));
dice(r.nuove.indexOf('d') >= 0, 'una carta sbustata e non ancora guardata resta nuova con la seconda copia', JSON.stringify(r.nuove));
// Guardata, un'altra copia non la riaccende.
magazzino.possesso.u6.viste = { d: 1 };
magazzino.bustina.u6 = { carte: ['d', 'b', 'c'], prezzi: { d: 1000, b: 200, c: 500 }, tipo: 'daily' };
r = JSON.parse(ctx.rpcBustinaRaccogli(chi('u6'), logger, nk, JSON.stringify({ tieni: ['d'] })));
dice(r.nuove.indexOf('d') < 0, 'e una gia- guardata non torna nuova', JSON.stringify(r.nuove));
// Chi c'era gia': le carte starter accese a torto si spengono, le altre no.
magazzino.possesso.u5 = { admin: false, mazzi: [1], livello: 1, livelliCarte: 1,
  valute: { magicInk: 0, fairyDust: 0 }, avatar: 'x',
  carte: { a: 1, b: 1, d: 1 }, copie: { a: 2, b: 2, d: 1 }, viste: { b: 1 } };
p = ctx.assicuraPossesso(chi('u5'), nk, logger, 'u5', 'u5');
dice(p.viste.a === 1 && !p.viste.d && JSON.stringify(ctx._nuoveDi(p, null)) === '["d"]',
  'chi c-era gia-: la carta starter accesa a torto si spegne, quella davvero nuova resta', 'nuove: ' + JSON.stringify(ctx._nuoveDi(p, null)));
dice(magazzino.possesso.u5.novitaVersione === 1, 'una volta sola');
// Un admin ha tutte le carte: per lui nessuna sbustata e- una prima copia.
ctx.eAdmin = () => true;
magazzino.possesso.u7 = { admin: true, mazzi: [1], livello: 4, semeAdmin: 999, livelliCarte: 1,
  valute: { magicInk: 0, fairyDust: 0 }, avatar: 'x', carte: { d: 1 }, copie: {}, viste: {} };
p = ctx.assicuraPossesso(chi('u7'), nk, logger, 'u7', 'u7');
dice(p.viste.d === 1, 'e per un admin, che le ha tutte, si spengono tutte');
ctx.eAdmin = () => false;

// ── 5. IN PARTITA, CARTA PER CARTA ────────────────────────────────────────
const stato = {
  giocatori: ['u1', 'u2'],
  info: { u1: { nome: 'uno' }, u2: { nome: 'due' } },
  mazzoIniziale: { u1: ['final-a', 'final-b', 'final-d'], u2: ['final-a', 'final-c'] }
};
ctx._livelliPerLaPartita(nk, logger, stato);
dice(JSON.stringify(stato.info.u1.livelli) === JSON.stringify({ a: 1, b: 4, d: 4 }),
  'ogni giocatore porta il livello di ogni carta del suo mazzo', JSON.stringify(stato.info.u1.livelli));
dice(JSON.stringify(stato.info.u2.livelli) === JSON.stringify({ a: 2, c: 3 }),
  'e solo di quelle', JSON.stringify(stato.info.u2.livelli));
dice(stato.info.u1.nome === 'uno', 'e il resto delle informazioni resta com-era');
const init = sorgente.slice(sorgente.indexOf('function partitaInit('));
dice(init.slice(0, init.indexOf('\n}\n')).indexOf('_livelliPerLaPartita(nk, logger, stato)') >= 0,
  'e la partita li calcola quando nasce, col mazzo che scende in campo');

// ── 6. LA PORTA ───────────────────────────────────────────────────────────
dice(/registerRpc\('hx_carta_livella', rpcCartaLivella\)/.test(sorgente), 'hx_carta_livella e- registrata');

console.log(male ? String.fromCharCode(10) + male + ' cose non tornano' : String.fromCharCode(10) + 'tutto a posto');
process.exit(male ? 1 : 0);
