// TRE COSE DI LORENZO (v0.80.24), LATO SERVER, SENZA NAKAMA.
//
//     node strumenti/prova-v08024-server.js
//
//   1. Vladimiro: "non progredisce il contatore delle partite giocate in PvP
//      nelle Daily". applicaEsito usava `logger` senza riceverlo: il blocco
//      delle quest lanciava un ReferenceError, e a ogni partita fra persone ne'
//      le quest ne' l'inchiostro venivano scritti. Qui si fa girare SENZA
//      nessun logger globale (come su Nakama) e si guarda che il possesso sia
//      scritto, con la partita, la vittoria e l'inchiostro.
//   2. "Flip a Timeless card" diventa "Flip a Mythic card": il pool, il verbo
//      (flip_mythic, e flip_timeless non conta piu'), e la quest di oggi
//      rinominata al volo con quel che aveva fatto.
//   3. La carta sotto al puntatore (op 19 -> op 20): solo all'altro, solo una
//      carta della propria mano, null sempre, un tetto al secondo.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DOVE = process.argv[2] || path.join(__dirname, '..', 'server', 'nakama', 'index.js');
console.log('provo ' + DOVE + String.fromCharCode(10));
const mondo = { console, Date, Math, JSON, parseInt, parseFloat, isFinite, String, Object, Array, Error, Number, RegExp };
mondo.global = mondo;
vm.createContext(mondo);
new vm.Script(fs.readFileSync(DOVE, 'utf8')).runInContext(mondo);

let male = 0;
const dice = (ok, che, perche) => {
  if (!ok) male++;
  console.log((ok ? '  ok   ' : '  NO   ') + che);
  if (!ok && perche !== undefined) console.log('        ' + perche);
};

// ── 1. l'esito di una partita fra persone ──────────────────────────────────
dice(typeof mondo.logger === 'undefined', 'nessun logger globale (come su Nakama)');
let scritto = null, stagione = null;
const possessoDi = () => ({ valute: { magicInk: 100 }, quest: { giorno: mondo._giornoGmt(), lista: [
  { id: 'play5pvp', fatto: 1, presa: false }, { id: 'win3pvp', fatto: 0, presa: false }, { id: 'flip20', fatto: 0, presa: false }] } });
mondo.leggiStagione = () => ({ profilo: { livello: 1, xp: 0, rank: 0, puntiRank: 0, sconfitteDiFila: 0, partite: 0 } });
mondo.scriviStagione = (nk, u, p) => { stagione = p; };
mondo.leggiPossesso = () => possessoDi();
mondo.scriviPossesso = (nk, u, v) => { scritto = v; };
let e = mondo.applicaEsito({}, 'u1', true, false, false, 5, 'finita');
const voce = (id) => scritto && scritto.quest.lista.filter(v => v.id === id)[0];
dice(!!scritto, 'senza logger il possesso si scrive lo stesso');
dice(voce('play5pvp') && voce('play5pvp').fatto === 2, 'Play 5 PvP matches sale da 1 a 2', JSON.stringify(scritto && scritto.quest.lista));
dice(voce('win3pvp') && voce('win3pvp').fatto === 1, 'e vincendo sale anche Win 3 PvP matches');
dice(scritto && scritto.valute.magicInk > 100, 'e l-inchiostro della partita arriva', scritto && scritto.valute.magicInk);
dice(e && Array.isArray(e.quest) ? e.quest.length === 2 : true, 'l-esito racconta le due quest mosse', JSON.stringify(e && e.quest));
scritto = null;
mondo.applicaEsito({}, 'u1', false, false, true, 5, 'finita');
dice(!scritto, 'contro il bot resta com-era: niente premi e niente quest PvP');
scritto = null;
const errori = [];
mondo.leggiPossesso = () => { throw new Error('storage giu-'); };
mondo.applicaEsito({}, 'u1', true, false, false, 5, 'finita', { info() {}, warn() {}, error(f, a, b) { errori.push(String(b)); }, debug() {} });
dice(errori.some(x => /storage giu/.test(x)), 'se i premi non si scrivono il registro lo dice (non piu- in silenzio)', errori.join(' | '));
mondo.leggiPossesso = () => possessoDi();
const sorgente = fs.readFileSync(DOVE, 'utf8');
const chiamate = (sorgente.match(/[^\w]applicaEsito\((?!nk, userId, vinta)[\s\S]*?\);/g) || []).map(c => c.replace(/\s+/g, ' '));
dice(chiamate.length === 4 && chiamate.every(c => /, logger\)\)?;$/.test(c)), 'tutte e quattro le chiamate passano il logger', chiamate.join(' || '));

// ── 2. Flip a Mythic card ─────────────────────────────────────────────────
const mitica = mondo.questDefinizione('flipmythic');
dice(mitica && mitica.testo === 'Flip a Mythic card' && mitica.conta === 'flip_mythic' && mitica.quanto === 1 && mitica.premio === 'pack', 'nel pool c-e- Flip a Mythic card (flip_mythic, una, una bustina)', JSON.stringify(mitica));
dice(!mondo.questDefinizione('fliptimeless') && !mondo.QUEST_POOL.some(q => /timeless/i.test(q.id + q.testo + q.conta)), 'e la Timeless non c-e- piu-');
dice(mondo.QUEST_TETTO_PER_CHIAMATA.flip_mythic > 0 && !('flip_timeless' in mondo.QUEST_TETTO_PER_CHIAMATA), 'il server accetta flip_mythic dal client, non piu- flip_timeless');
let pos = { quest: { giorno: mondo._giornoGmt(), lista: [{ id: 'flip20', fatto: 5, presa: false }, { id: 'fliptimeless', fatto: 1, presa: true }] } };
const cambiato = mondo.assicuraQuestDelGiorno(null, pos, 'u1');
dice(cambiato === true && pos.quest.lista[1].id === 'flipmythic' && pos.quest.lista[1].fatto === 1 && pos.quest.lista[1].presa === true && pos.quest.lista[0].fatto === 5, 'la quest di oggi si rinomina con quel che aveva fatto, e va riscritta', JSON.stringify(pos.quest.lista));
dice(mondo.assicuraQuestDelGiorno(null, pos, 'u1') === false, 'una seconda volta non c-e- piu- niente da cambiare');
const perClient = mondo.questPerIlClient(pos);
dice(perClient.length === 2 && perClient[1].nome === 'Flip a Mythic card', 'e il client la vede come Mythic', JSON.stringify(perClient));
pos = { quest: { giorno: mondo._giornoGmt() - 1, lista: [{ id: 'fliptimeless', fatto: 1, presa: false }] }, bustineExtra: 0 };
mondo.assicuraQuestDelGiorno(null, pos, 'u1');
dice(pos.bustineExtra === 1 && pos.quest.giorno === mondo._giornoGmt(), 'una Timeless di ieri finita e non riscossa si paga lo stesso (rinominata prima)', 'bustine ' + pos.bustineExtra);
let pos2 = { quest: { giorno: mondo._giornoGmt(), lista: [{ id: 'flipmythic', fatto: 0, presa: false }] } };
let mosse = mondo.avanzaQuest(pos2, 'flip_mythic', 1, false);
dice(mosse.length === 1 && mosse[0].finita && pos2.quest.lista[0].fatto === 1, 'una Mythic girata (anche contro il bot) la finisce');
pos2 = { quest: { giorno: mondo._giornoGmt(), lista: [{ id: 'flipmythic', fatto: 0, presa: false }] } };
mosse = mondo.avanzaQuest(pos2, 'flip_timeless', 1, false);
dice(mosse.length === 0 && pos2.quest.lista[0].fatto === 0, 'una Timeless no');
dice(mondo._cinqueDelGiorno(mondo._giornoGmt()).length === 5 && mondo._cinqueDelGiorno(mondo._giornoGmt()).some(v => v.id === 'flipmythic'), 'le cinque del giorno la contengono');

// ── 3. la carta sotto al puntatore ────────────────────────────────────────
const mandati = [];
const dispatcher = { broadcastMessage: (op, dati, a) => mandati.push({ op: op, dati: JSON.parse(dati), a: a ? a.map(p => p.userId) : 'tutti' }), matchLabelUpdate() {} };
const logger = { info() {}, warn() {}, error() {}, debug() {} };
const stato = () => ({
  giocatori: ['u1', 'u2'], info: {}, presenze: { u1: { userId: 'u1' }, u2: { userId: 'u2' } },
  mazzoIniziale: {}, mano: { u1: ['final-a', 'final-b'], u2: ['final-c'] }, mazzo: { u1: [], u2: [] },
  buchi: [], occupate: {}, turniGiocati: {}, turno: 0, numeroTurno: 1, scadenza: Date.now() + 3600000,
  iniziata: true, finita: false, natoIl: Date.now(), rapporti: {}, ultimaGiocataDi: -1, concordato: null,
  ultimaGiocata: null, yeti: [], ombra: { pronta: false, carte: {}, celle: {} }
});
const manda = (st, chi, corpo) => {
  mandati.length = 0;
  mondo.partitaLoop({}, logger, { binaryToString: (x) => x }, dispatcher, 1, st, [{ sender: { userId: chi }, opCode: mondo.OP_MANO_SOPRA, data: JSON.stringify(corpo) }]);
  return mandati.slice();
};
dice(mondo.OP_MANO_SOPRA === 19 && mondo.OP_MANO_SOPRA_ALTRO === 20, 'i codici sono 19 e 20');
let st = stato();
let r = manda(st, 'u1', { indice: 1 });
dice(r.length === 1 && r[0].op === 20 && r[0].a.join() === 'u2' && r[0].dati.di === 1 && r[0].dati.indice === 1 && r[0].dati.quante === 2 && !('carta' in r[0].dati), 'v0.80.25: all-altro va solo il posto nella mano e quante carte ci sono (mai la carta)', JSON.stringify(r));
r = manda(st, 'u2', { indice: 0 });
dice(r.length === 1 && r[0].a.join() === 'u1' && r[0].dati.di === 2, 'e dall-altra parte al primo');
r = manda(st, 'u1', { indice: 2 });
dice(r.length === 0 && manda(st, 'u1', { indice: -1 }).length === 0, 'un posto fuori dalla mano non passa');
r = manda(st, 'u1', { indice: null });
dice(r.length === 1 && r[0].dati.indice === null && r[0].dati.quante === 2, 'null (la carta torna giu-) passa, con quante carte ci sono');
st = stato();
let passati = 0;
for (let i = 0; i < 30; i++) passati += manda(st, 'u1', { indice: 0 }).length;
dice(passati === mondo.MANO_SOPRA_MAX, 'oltre il tetto al secondo si scarta', passati);
dice(manda(st, 'u1', { indice: null }).length === 1, 'ma il null passa anche oltre il tetto');
st = stato(); st.finita = true;
dice(manda(st, 'u1', { indice: 0 }).length === 0, 'a partita finita niente');
st = stato(); st.iniziata = false;
dice(manda(st, 'u1', { indice: 0 }).length === 0, 'e prima che cominci neanche');
st = stato();
dice(manda(st, 'estraneo', { indice: 0 }).length === 0, 'chi non e- della partita non manda niente');

// ── 4. il riavvio annunciato ──────────────────────────────────────────────
let sistema = {};
mondo.leggiSistema = (n, k) => (k in sistema ? JSON.parse(JSON.stringify(sistema[k])) : null);
mondo.scriviSistema = (n, k, v) => { sistema[k] = JSON.parse(JSON.stringify(v)); };
const battito = () => JSON.parse(mondo.rpcGiocatoriOnline({ userId: 'u1' }, logger, {}, JSON.stringify({ sessione: 's1' })));
let rifiutato = false;
try { mondo.rpcRiavvioAnnuncia({ userId: 'u1' }, logger, {}, '{}'); } catch (err) { rifiutato = /client/.test(err.message); }
dice(rifiutato && !sistema[mondo.KEY_RIAVVIO], 'un client non puo- annunciare un riavvio');
dice(battito().riavvio === null, 'senza annuncio il battito porta riavvio: null');
let an = JSON.parse(mondo.rpcRiavvioAnnuncia({}, logger, {}, '{}'));
dice(an.alle - an.ora === 5 * 60 * 1000 && sistema[mondo.KEY_RIAVVIO].alle === an.alle, 'dal server (chiave del runtime): fra cinque minuti, scritto', JSON.stringify(an));
let bt = battito();
dice(bt.riavvio && bt.riavvio.alle === an.alle && Math.abs(bt.riavvio.ora - Date.now()) < 1000 && bt.giocatori === 1, 'il battito lo porta, con l-ora del server', JSON.stringify(bt));
an = JSON.parse(mondo.rpcRiavvioAnnuncia({}, logger, {}, JSON.stringify({ fraMs: 5000 })));
dice(an.alle - an.ora === 60 * 1000, 'meno di un minuto di preavviso non si puo-');
sistema[mondo.KEY_RIAVVIO] = { alle: Date.now() - 11 * 60 * 1000 };
dice(battito().riavvio === null, 'un annuncio passato da oltre dieci minuti (schieramento fermato) non vale piu-');
mondo.rpcRiavvioAnnuncia({}, logger, {}, '{}');
mondo.rpcRiavvioAnnuncia({}, logger, {}, JSON.stringify({ annulla: true }));
dice(battito().riavvio === null, 'annullato: il battito non lo porta piu-');
mondo.rpcRiavvioAnnuncia({}, logger, {}, '{}');
const registrate = {};
let initErrore = null;
try {
  mondo.InitModule({ env: {} }, logger, { binaryToString: (x) => x, storageRead: () => [], storageWrite: () => {} },
    new Proxy({}, { get: (t, nome) => (...args) => { if (nome === 'registerRpc') registrate[args[0]] = args[1]; } }));
} catch (err) { initErrore = err.message; }
dice(registrate.hx_riavvio_annuncia === mondo.rpcRiavvioAnnuncia && registrate.hx_giocatori === mondo.rpcGiocatoriOnline, 'hx_riavvio_annuncia e- registrata', initErrore || Object.keys(registrate).length + ' rpc');
dice(battito().riavvio === null, 'ripartito il server (InitModule), l-annuncio e- cancellato');
const script = fs.readFileSync(path.join(path.dirname(DOVE), 'schiera.sh'), 'utf8');
dice(/hx_riavvio_annuncia/.test(script) && /FERMO: l'annuncio non e' partito/.test(script) && /sleep 60/.test(script), 'schiera.sh annuncia, aspetta, e senza annuncio si ferma');

console.log(String.fromCharCode(10) + (male ? male + ' NO' : 'tutto a posto'));
process.exit(male ? 1 : 0);
