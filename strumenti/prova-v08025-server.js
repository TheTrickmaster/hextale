// SEGNALAZIONI E STATISTICHE (v0.80.25), LATO SERVER, SENZA NAKAMA.
//
//     node strumenti/prova-v08025-server.js
//
//   1. La meta del trascinamento viaggia con la scelta (op 10 -> op 11 `dest`):
//      la partita di OminoBianco del 14/09 si e' fermata perche' un tassello
//      spostato da Open Celery finiva in due caselle diverse sui due schermi.
//   2. matchSignal torna { state, data } anche quando un accoppiato rifiuta, e il
//      tavolo si chiude al giro dopo (prima: "matchSignal is expected to return
//      an object with 'state' property").
//   3. hx_giocatori conta anche chi sta giocando una partita (`gioca`).
//   4. La telemetria: hx_telemetria (sessione e registro di partita, ripuliti),
//      il riassunto di ogni partita in rete (finita, resa, abbandono, fermata),
//      i contatori di progressione.
//   5. Le statistiche: SHA-256 uguale a quello del browser, calcolaStatistiche
//      su dati inventati coi numeri fatti a mano, hx_stats con la password del
//      sito, il tetto ai tentativi e l'account della pagina fuori dai numeri.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

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
const copia = (x) => JSON.parse(JSON.stringify(x));

// ── lo storage finto ──────────────────────────────────────────────────────
let archivio = {};   // "utente|collezione|chiave" -> valore
const nk = {
  binaryToString: (x) => x,
  storageRead: (req) => req.map(r => archivio[r.userId + '|' + r.collection + '|' + r.key]).filter(Boolean).map(v => ({ value: copia(v) })),
  storageWrite: (req) => { req.forEach(r => { archivio[r.userId + '|' + r.collection + '|' + r.key] = copia(r.value); }); },
  storageDelete: () => {},
  storageList: (userId, coll, limit, cursor) => {
    const tutti = Object.keys(archivio).filter(k => { const p = k.split('|'); return p[1] === coll && (userId === '' || p[0] === userId); }).sort();
    const da = cursor ? Number(cursor) : 0;
    const pagina = tutti.slice(da, da + limit).map(k => { const p = k.split('|'); return { userId: p[0], collection: p[1], key: p.slice(2).join('|'), value: copia(archivio[k]) }; });
    return { objects: pagina, cursor: (da + limit < tutti.length) ? String(da + limit) : '' };
  },
  usersGetId: (ids) => ids.map(id => ({ userId: id, createTime: creati[id] ? Math.floor(creati[id] / 1000) : 0 }))
};
let creati = {};
const avvisi = [];
const logger = { info() {}, warn(f, a, b) { avvisi.push(String(f) + ' ' + String(a) + ' ' + String(b)); }, error() {}, debug() {} };
const mandati = [];
const dispatcher = { broadcastMessage: (op, dati, a) => mandati.push({ op: op, dati: JSON.parse(dati), a: a ? a.map(p => p.userId) : 'tutti' }), matchLabelUpdate() {} };
const stato = () => ({
  idPartita: 'M-prova', giocatori: ['u1', 'u2'], info: { u1: { rank: 2, livello: 3 }, u2: { rank: 5, livello: 4 } },
  presenze: { u1: { userId: 'u1' }, u2: { userId: 'u2' } },
  mazzoIniziale: { u1: ['final-uno', 'final-due'], u2: ['final-tre'] },
  mano: { u1: ['final-uno', 'final-uno', 'final-uno'], u2: ['final-uno', 'final-uno', 'final-uno'] }, mazzo: { u1: [], u2: [] },
  buchi: [], occupate: {}, turniGiocati: {}, turno: 0, numeroTurno: 1, scadenza: Date.now() + mondo.TURNO_MS - 4000,
  iniziata: true, finita: false, natoIl: Date.now() - 60000, inizioIl: Date.now() - 50000, rapporti: {}, ultimaGiocataDi: -1, concordato: null,
  ultimaGiocata: null, yeti: [], ombra: { pronta: false, carte: {}, celle: {} }
});
const manda = (st, chi, op, corpo) => {
  mandati.length = 0;
  const r = mondo.partitaLoop({}, logger, nk, dispatcher, 1, st, [{ sender: { userId: chi }, opCode: op, data: JSON.stringify(corpo) }]);
  return { r: r, mandati: mandati.slice() };
};
const di = (x, op) => x.mandati.filter(m => m.op === op);
archivio['00000000-0000-0000-0000-000000000000|sistema|catalogo'] = { carte: [{ id: 'final-uno', cardAbility: '', name: 'Uno' }] };

// ── 1. la meta del trascinamento ─────────────────────────────────────────
let st = stato();
st.ultimaGiocataDi = 0;
let x = manda(st, 'u1', mondo.OP_SCELGO, { cella: '1,1', dest: '2,0' });
let sc = di(x, mondo.OP_SCELTA)[0];
dice(sc && sc.a === 'tutti' && sc.dati.cella === '1,1' && sc.dati.dest === '2,0' && sc.dati.di === 1, 'la scelta torna a tutti e due con la meta', JSON.stringify(x.mandati));
x = manda(st, 'u1', mondo.OP_SCELGO, { cella: '1,1', dest: 'dove capita' });
dice(di(x, mondo.OP_SCELTA)[0].dati.dest === null, 'una meta che non e- una casella non passa');
x = manda(st, 'u1', mondo.OP_SCELGO, { cella: '1,1' });
dice(di(x, mondo.OP_SCELTA)[0].dati.dest === null, 'e un client di prima (senza meta) manda null');

// ── 2. il rifiuto non rompe matchSignal ───────────────────────────────────
mondo._avvisaGliAltri = function () {};
st = stato(); st.iniziata = false;
const risposta = mondo.partitaSignal({ matchId: 'M-prova' }, logger, nk, dispatcher, 1, st, JSON.stringify({ rifiuta: 'u1' }));
dice(risposta && risposta.state === st && st.finita === true, 'matchSignal torna { state } e segna il tavolo come finito', JSON.stringify(risposta && Object.keys(risposta)));
dice(mondo.partitaLoop({}, logger, nk, dispatcher, 2, st, []) === null, 'e al giro dopo il loop lo chiude');
st = stato(); st.iniziata = false;
const estraneo = mondo.partitaSignal({}, logger, nk, dispatcher, 1, st, JSON.stringify({ rifiuta: 'chiunque' }));
dice(estraneo && estraneo.state === st && !st.finita, 'un rifiuto da chi non e- della partita non chiude niente');

// ── 3. chi e' in partita ──────────────────────────────────────────────────
const sistemaVero = { leggi: mondo.leggiSistema, scrivi: mondo.scriviSistema };
let presenze = {};
mondo.leggiSistema = (n, k) => (k === mondo.KEY_PRESENZE ? copia(presenze) : sistemaVero.leggi(n, k));
mondo.scriviSistema = (n, k, v) => { if (k === mondo.KEY_PRESENZE) presenze = copia(v); else sistemaVero.scrivi(n, k, v); };
const batte = (u, corpo) => JSON.parse(mondo.rpcGiocatoriOnline({ userId: u }, logger, nk, JSON.stringify(Object.assign({ sessione: 's-' + u }, corpo))));
batte('u1', { gioca: true });
batte('u2', { cerca: true });
let b = batte('u3', {});
dice(b.giocatori === 3 && b.cercano === 1 && b.inPartita === 1, 'tre online: uno in matchmaking, uno in partita', JSON.stringify(b));
b = batte('u1', { gioca: false });
dice(b.inPartita === 0 && b.giocatori === 3, 'finita la partita non si conta piu-');
mondo.leggiSistema = sistemaVero.leggi; mondo.scriviSistema = sistemaVero.scrivi;

// ── 4. la telemetria ──────────────────────────────────────────────────────
const TELE = (chiave) => archivio['00000000-0000-0000-0000-000000000000|telemetria|' + chiave];
let t0 = Date.now();
mondo.rpcTelemetria({ userId: 'u1' }, logger, nk, JSON.stringify({ sessione: 'sess-1', dalMs: 30000, piattaforma: 'electron', caricamentoMs: 2500,
  pagine: { mainmenu: 20000, game: 5000, '<script>': 99 }, errori: 3, erroriTesti: ['boom', 'x'.repeat(500)], erroriRete: 2, partite: 0 }));
let s1 = TELE('s:u1:sess-1');
dice(s1 && s1.piattaforma === 'electron' && s1.caricamentoMs === 2500 && s1.errori === 3 && s1.erroriRete === 2 && Math.abs(s1.inizio - (t0 - 30000)) < 1000, 'la sessione si scrive, con l-inizio ricavato da quanto e- aperta', JSON.stringify(s1));
dice(s1.pagine.mainmenu === 20000 && s1.pagine.game === 5000 && s1.pagine.script === 99 && s1.erroriTesti[1].length === 160, 'pagine e testi ripuliti (nomi solo lettere, testi corti)', JSON.stringify(s1.pagine));
const inizio1 = s1.inizio;
mondo.rpcTelemetria({ userId: 'u1' }, logger, nk, JSON.stringify({ sessione: 'sess-1', dalMs: 999999, piattaforma: 'browser', caricamentoMs: 0, pagine: {}, errori: 4, erroriRete: 2 }));
s1 = TELE('s:u1:sess-1');
dice(s1.inizio === inizio1 && s1.caricamentoMs === 2500 && s1.errori === 4 && s1.fine >= inizio1, 'la stessa sessione si aggiorna: inizio e caricamento restano quelli di prima');
let niente = false;
try { mondo.rpcTelemetria({}, logger, nk, '{}'); } catch (e) { niente = true; }
dice(niente, 'senza accesso non si scrive niente');
mondo.rpcTelemetria({ userId: 'u2' }, logger, nk, JSON.stringify({ partita: { pvp: false, io: 1, durataMs: 60000, vincitore: 1,
  mazzi: { 1: ['final-uno', 'NON VA', 'final-due'], 2: ['final-tre'] }, pescate: { 1: { 'final-uno': 2, 'x y': 5 } },
  mosse: [[1, 1, 'final-uno', '0,0', 3000], [2, 2, 'final-tre', 'fuori', 100], [3, 1, 'final-due', '-1,1', 99999999]],
  conquiste: [[1, 'final-uno', 'final-tre'], [2, 'NO', 'final-uno']], punti: [[1, 10, 0], [2, 10, 12]] } }));
const bot = Object.keys(archivio).filter(k => k.indexOf('|telemetria|b:u2:') > 0).map(k => archivio[k])[0];
dice(bot && bot.u === 'u2' && !bot.pvp && bot.vincitore === 1 && bot.durataMs === 60000, 'il registro contro il bot si scrive (b:utente:ms)', JSON.stringify(bot));
dice(bot && bot.mazzi[1].join() === 'final-uno,final-due' && bot.pescate[1]['final-uno'] === 2 && !bot.pescate[1]['x y'], 'carte che non hanno il formato giusto non entrano');
dice(bot && bot.mosse.length === 2 && bot.mosse[1][4] === 600000 && bot.conquiste.length === 1 && bot.punti.length === 2, 'mosse su caselle inesistenti fuori, tempi col tetto', JSON.stringify(bot && bot.mosse));
mondo.rpcTelemetria({ userId: 'u1' }, logger, nk, JSON.stringify({ partita: { pvp: true, id: '', io: 1 } }));
dice(!Object.keys(archivio).some(k => k.indexOf('|telemetria|p:') > 0), 'un registro di partita in rete senza id non si scrive');
mondo.rpcTelemetria({ userId: 'u1' }, logger, nk, JSON.stringify({ partita: { pvp: true, id: 'M-prova', io: 1, pescate: { 1: { 'final-uno': 1 } }, punti: [[1, 5, 0]] } }));
dice(!!TELE('p:M-prova:u1'), 'quello con l-id si (p:partita:utente)');

// il riassunto delle partite in rete
mondo.applicaEsito = () => ({});
st = stato();
let prima = Date.now();
manda(st, 'u1', mondo.OP_GIOCA, { carta: 'final-uno', q: 0, r: 0 });
dice(st.teleMosse && st.teleMosse.length === 1 && st.teleMosse[0][1] === 1 && st.teleMosse[0][2] === 'final-uno' && st.teleMosse[0][3] === '0,0'
  && st.teleMosse[0][4] >= 3900 && st.teleMosse[0][4] < 6000, 'la giocata si segna col tempo che il turno ci ha messo (~4s)', JSON.stringify(st.teleMosse));
mondo._chiudiPartita(st, dispatcher, logger, nk, { hp: { 1: 20, 2: 10 }, punteggio: {} });
let mr = TELE('m:M-prova');
dice(mr && mr.modo === 'finita' && mr.vincitore === 1 && mr.giocatori[0].rank === 2 && mr.giocatori[1].mazzo.join() === 'final-tre' && mr.mosse.length === 1 && mr.durataMs >= 50000, 'finita: riassunto con esito, ranghi, mazzi e giocate', JSON.stringify(mr));
delete archivio['00000000-0000-0000-0000-000000000000|telemetria|m:M-prova'];
st = stato();
st.concordato = { hp: { 1: 12, 2: 7 } };   // a zero a zero una resa e' un pareggio: qui si sta giocando davvero
manda(st, 'u2', mondo.OP_MI_ARRENDO, {});
mr = TELE('m:M-prova');
dice(mr && mr.modo === 'resa' && mr.vincitore === 1, 'resa: vince l-altro', JSON.stringify(mr && { modo: mr.modo, v: mr.vincitore }));
delete archivio['00000000-0000-0000-0000-000000000000|telemetria|m:M-prova'];
st = stato();
mondo._uscita(st, dispatcher, logger, nk, 'u1');
mr = TELE('m:M-prova');
dice(mr && mr.modo === 'abbandono' && mr.vincitore === 2, 'abbandono: vince chi resta');
delete archivio['00000000-0000-0000-0000-000000000000|telemetria|m:M-prova'];
st = stato();
manda(st, 'u1', mondo.OP_IMPRONTA, { turno: 3, impronta: 'a', finita: false });
manda(st, 'u2', mondo.OP_IMPRONTA, { turno: 3, impronta: 'b', finita: false });
mr = TELE('m:M-prova');
dice(mr && mr.modo === 'fermata' && mr.vincitore === 0, 'tabelloni diversi: fermata, senza vincitore');
mondo._chiudiPartita(st, dispatcher, logger, nk, { hp: { 1: 1, 2: 2 } });
dice(TELE('m:M-prova').modo === 'fermata', 'e il riassunto si scrive una volta sola');

// i contatori di progressione
let pos = { valute: { magicInk: 500 } };
mondo.assicuraPossesso = () => pos;
mondo.scriviPossesso = (n, u, v) => { pos = v; };
mondo.rpcBustinaCompra({ userId: 'u1' }, logger, nk, '{}');
dice(pos.stat && pos.stat.bustineOttenute === 1, 'comprare un pacchetto conta una bustina ottenuta');
const p2 = { quest: null };
mondo.assicuraQuestDelGiorno(null, p2, 'u1');
dice(p2.stat && p2.stat.questAssegnate === 5, 'le cinque quest del giorno contano come assegnate');
p2.quest.lista.forEach(v => { v.fatto = 0; });
const flip20 = p2.quest.lista.filter(v => v.id === 'flip20')[0];
mondo.avanzaQuest(p2, 'flip', 19, false);
dice(!p2.stat.questCompletate, 'a 19 su 20 non e- completata');
mondo.avanzaQuest(p2, 'flip', 5, false);
mondo.avanzaQuest(p2, 'flip', 5, false);
dice(flip20.fatto === 20 && p2.stat.questCompletate === 1, 'completata si conta una volta sola');
const pq = { valute: { magicInk: 0 } };
mondo._pagaQuest(pq, { premio: 'pack' });
dice(pq.stat && pq.stat.bustineOttenute === 1, 'una bustina premio conta come ottenuta');
const sorgente = fs.readFileSync(DOVE, 'utf8');
dice(/_statConta\(possesso, 'bustineAperte', 1\)/.test(sorgente) && /_statConta\(possesso, 'carteOttenute', tieni\.length - rimborsate\.length\)/.test(sorgente)
  && /_statConta\(possesso, 'livellamenti', 1\)/.test(sorgente), 'aprire un pacchetto, tenere carte e salire di livello contano (nel sorgente)');

// ── 5. le statistiche ─────────────────────────────────────────────────────
const bytes = (s) => crypto.createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
const campioni = ['', 'abc', 'hextale-cancello-v1:parola', 'ù è ñ 日本 🃏', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), 'w'.repeat(1000)];
dice(campioni.every(s => mondo._sha256Hex(s) === bytes(s)), 'SHA-256 uguale a quello di node (UTF-8, bordi dei blocchi)', campioni.filter(s => mondo._sha256Hex(s) !== bytes(s)).map(s => s.slice(0, 10)).join(' | '));
const cancello = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
dice(cancello.indexOf("var CANCELLO_SALE = '" + mondo.STATS_SALE + "'") >= 0 && cancello.indexOf("var CANCELLO_IMPRONTA = '" + mondo.STATS_IMPRONTA + "'") >= 0, 'sale e impronta sono quelle del cancello del sito');
const pagina = fs.readFileSync(path.join(__dirname, '..', 'stats', 'index.html'), 'utf8');
dice(pagina.indexOf("var STATS_SALE = '" + mondo.STATS_SALE + "'") >= 0 && pagina.indexOf("var STATS_IMPRONTA = '" + mondo.STATS_IMPRONTA + "'") >= 0, 'e anche quelle della pagina /stats/');

const T0 = Date.UTC(2026, 8, 10, 8, 0, 0), G = 86400000;
const dati = {
  sessioni: [
    { u: 'u1', s: 'a', inizio: T0, fine: T0 + 600000, piattaforma: 'browser', caricamentoMs: 3000, pagine: { mainmenu: 60000, game: 300000 }, errori: 2, erroriTesti: ['boom'], erroriRete: 1 },
    { u: 'u2', s: 'b', inizio: T0 + 1000, fine: T0 + 1000 + 1200000, piattaforma: 'electron', caricamentoMs: 5000, pagine: { mainmenu: 120000 }, errori: 0, erroriTesti: [], erroriRete: 0 },
    { u: 'u1', s: 'c', inizio: T0 + G, fine: T0 + G + 300000, piattaforma: 'browser', caricamentoMs: 0, pagine: { mainmenu: 30000 }, errori: 0, erroriTesti: [], erroriRete: 0 },
    { u: 'stats', s: 'z', inizio: T0 - 5 * G, fine: T0, piattaforma: 'browser', caricamentoMs: 1, pagine: {}, errori: 99, erroriTesti: ['no'], erroriRete: 99 }
  ],
  partiteServer: [{ pvp: true, id: 'M1', inizio: T0 + 10000, fine: T0 + 310000, durataMs: 300000, modo: 'finita', vincitore: 1,
    giocatori: [{ u: 'u1', rank: 2, mazzo: ['final-a', 'final-b'] }, { u: 'u2', rank: 5, mazzo: ['final-b', 'final-c'] }],
    mosse: [[1, 1, 'final-a', '0,0', 4000], [2, 2, 'final-c', '1,0', 6000], [3, 1, 'final-b', '-1,0', 2000]] }],
  logPartite: [
    { pvp: true, id: 'M1', u: 'u1', io: 1, pescate: { 1: { 'final-a': 1, 'final-b': 1 } }, conquiste: [[1, 'final-a', 'final-c']], punti: [[1, 10, 0], [2, 10, 20], [3, 30, 20]] },
    { pvp: false, id: '', u: 'u2', io: 1, fine: T0 + 400000, inizio: T0 + 340000, durataMs: 60000, vincitore: 2, mazzi: { 1: ['final-c', 'final-d'], 2: ['final-a'] },
      pescate: { 1: { 'final-c': 2 }, 2: {} }, mosse: [[1, 1, 'final-c', '0,0', 8000], [2, 2, 'final-a', '1,0', 1000]], conquiste: [[2, 'final-a', 'final-c']], punti: [[1, 5, 0], [2, 5, 9]] }
  ],
  possessi: [
    { u: 'u1', v: { stat: { bustineOttenute: 3, bustineAperte: 2, carteOttenute: 4, livellamenti: 1, questAssegnate: 5, questCompletate: 2 } } },
    { u: 'u2', v: { stat: { bustineOttenute: 1, bustineAperte: 0, carteOttenute: 0, livellamenti: 0, questAssegnate: 5, questCompletate: 3 } } },
    { u: 'u3', v: {} }, { u: 'stats', v: { stat: { bustineOttenute: 100 } } }
  ],
  stagioni: [{ u: 'u1', v: { stagione: 'S', livello: 4, rank: 2 } }, { u: 'u2', v: { stagione: 'S', livello: 6, rank: 5 } }, { u: 'u9', v: { stagione: 'VECCHIA', livello: 50, rank: 11 } }],
  stagioneCorrente: 'S',
  creati: { u1: T0 - 1000, u2: T0 - 10 * G },
  catalogo: [{ id: 'final-a', name: 'A' }, { id: 'final-b', name: 'B' }, { id: 'final-c', name: 'C' }, { id: 'final-d', name: 'D' }, { id: 'final-x', name: 'X', soloAdmin: true }],
  esclusi: ['stats']
};
const S = copia(mondo.calcolaStatistiche(copia(dati), T0 + 3 * G + 1000));
const t = S.tecniche, gd = S.design, sg = S.strategia, cc = S.carte, tb = S.tabellone, pr = S.progressione;
dice(S.dal === T0, 'dal: la prima cosa registrata (l-account della pagina escluso)', S.dal);
dice(t.sessioni === 3 && t.durataMediaSessioneMs === 700000 && t.erroriJs === 2 && t.erroriRete === 1 && t.caricamentoMedioMs === 4000, 'tecniche: sessioni, durata, errori, caricamento', JSON.stringify(t));
dice(t.utentiBrowser === 1 && t.utentiElectron === 1 && t.erroriPiuFrequenti.length === 1 && t.erroriPiuFrequenti[0].id === 'boom', 'utenti per piattaforma ed errori piu- frequenti');
dice(gd.partiteTotali === 2 && gd.partitePvp === 1 && gd.partiteBot === 1 && gd.partitePerGiornoGiocatore === 1 && gd.durataMediaPartitaMs === 180000 && gd.tempoMedioTurnoMs === 5000, 'design: partite, al giorno, durata, tempo del turno (del bot solo l-umano)', JSON.stringify(gd));
dice(JSON.stringify(gd.mazzi) === JSON.stringify([{ id: 'final-b', perc: 66.7 }, { id: 'final-c', perc: 66.7 }, { id: 'final-a', perc: 33.3 }, { id: 'final-d', perc: 33.3 }]) && gd.mazziContati === 3, 'composizione dei mazzi (del bot solo quello umano)', JSON.stringify(gd.mazzi));
dice(gd.winRateRankBasso === 100 && gd.winRateRankAlto === 0 && gd.partiteConRankDiversi === 1, 'win rate per rank');
dice(gd.tempoPerPaginaMs.mainmenu === 70000 && gd.tempoPerPaginaMs.game === 100000, 'tempo medio per pagina', JSON.stringify(gd.tempoPerPaginaMs));
dice(JSON.stringify(sg.piuUsate) === JSON.stringify([{ id: 'final-c', n: 2 }, { id: 'final-a', n: 1 }, { id: 'final-b', n: 1 }]), 'le piu- usate', JSON.stringify(sg.piuUsate));
dice(JSON.stringify(sg.menoUsate.map(r => r.id + ':' + r.n)) === JSON.stringify(['final-d:0', 'final-a:1', 'final-b:1', 'final-c:2']), 'le meno usate (anche mai giocate, le carte da admin no)', JSON.stringify(sg.menoUsate));
dice(JSON.stringify(sg.nelleVincenti) === JSON.stringify([{ id: 'final-a', n: 1 }, { id: 'final-b', n: 1 }]), 'nei mazzi vincenti');
dice(JSON.stringify(sg.aperture) === JSON.stringify([{ id: 'final-c', n: 2 }, { id: 'final-a', n: 1 }]), 'le aperture', JSON.stringify(sg.aperture));
dice(sg.primeMosse.length === 2 && sg.primeMosse[0].id === 'final-a' && sg.primeMosse[0].cella === '0,0' && sg.combinazioni.length === 1 && sg.combinazioni[0].a === 'final-a' && sg.combinazioni[0].b === 'final-b', 'prime mosse e combinazioni', JSON.stringify([sg.primeMosse, sg.combinazioni]));
dice(cc['final-a'].mazziPerc === 33.3 && cc['final-a'].pescataPerc === 100 && cc['final-a'].giocataPerc === 100 && cc['final-a'].winRateGiocata === 100
  && cc['final-a'].turnoMedio === 1 && cc['final-a'].cellaPreferita === '0,0' && cc['final-a'].conquistePerGiocata === 1 && cc['final-a'].conquistataPerGiocata === 0, 'la scheda di A', JSON.stringify(cc['final-a']));
dice(cc['final-c'].mazziPerc === 66.7 && cc['final-c'].pescataPerc === 100 && cc['final-c'].giocataPerc === 100 && cc['final-c'].winRateGiocata === 0
  && cc['final-c'].turnoMedio === 1.5 && cc['final-c'].cellaPreferita === '0,0' && cc['final-c'].conquistataPerGiocata === 1 && cc['final-c'].nome === 'C', 'la scheda di C', JSON.stringify(cc['final-c']));
dice(cc['final-d'].giocate === 0 && cc['final-d'].winRateGiocata === null && !cc['final-x'], 'D mai giocata: numeri vuoti, non zeri inventati; X (admin) non c-e-');
dice(tb.rimontePerc === 100 && tb.rimonteMedie === 1.5 && tb.partiteConPunti === 2 && tb.celleIniziali[0].id === '0,0' && tb.celleIniziali[0].n === 2, 'tabellone: rimonte e caselle iniziali', JSON.stringify(tb));
dice(pr.nuoviGiocatori === 1 && pr.durataPrimaSessioneMs === 600000 && pr.partitePrimaSessione === 1 && pr.sessioniMediePerGiocatore === 1.5, 'prima sessione (solo chi e- nato dopo) e sessioni per giocatore', JSON.stringify(pr));
dice(pr.ritorno1 === 100 && pr.ritorno1Su === 1 && pr.ritorno3 === 0 && pr.ritorno3Su === 1 && pr.ritorno7 === null && pr.ritorno7Su === 0, 'ritorni a 1, 3 e 7 giorni');
dice(pr.livelloMedio === 5 && pr.rankMedio === 4 && pr.rankMedioNome === 'silver-1' && pr.profili === 2, 'livello e rank medi (solo la stagione corrente)');
dice(pr.bustineOttenuteMedie === 2 && pr.bustineAperteMedie === 1 && pr.carteOttenuteMedie === 2 && pr.livellamentiMedi === 0.5 && pr.questCompletatePerc === 50 && pr.giocatoriConContatori === 2, 'contatori di progressione', JSON.stringify(pr));
const V = mondo.calcolaStatistiche({}, Date.now());
dice(V.tecniche.sessioni === 0 && V.design.durataMediaPartitaMs === null && V.dal === null && V.progressione.questCompletatePerc === null, 'senza dati: zeri dove si conta, vuoti dove si fa una media');

// hx_stats
archivio = {};
archivio['00000000-0000-0000-0000-000000000000|sistema|catalogo'] = { carte: dati.catalogo };
dati.sessioni.forEach(s => { archivio['00000000-0000-0000-0000-000000000000|telemetria|s:' + s.u + ':' + s.s] = s; });
archivio['00000000-0000-0000-0000-000000000000|telemetria|m:M1'] = dati.partiteServer[0];
archivio['00000000-0000-0000-0000-000000000000|telemetria|p:M1:u1'] = dati.logPartite[0];
archivio['00000000-0000-0000-0000-000000000000|telemetria|b:u2:1'] = dati.logPartite[1];
archivio['u1|profilo|carte'] = dati.possessi[0].v;
archivio['u2|profilo|carte'] = dati.possessi[1].v;
archivio['stats|profilo|carte'] = dati.possessi[3].v;
archivio['u1|profilo|stagione'] = { stagione: mondo.stagioneCorrente(), livello: 4, rank: 2 };
creati = dati.creati;
let msg = '';
try { mondo.rpcStats({ userId: 'stats' }, logger, nk, JSON.stringify({ parola: 'sbagliata' })); } catch (e) { msg = e.message; }
dice(msg === 'That is not the password.' && archivio['00000000-0000-0000-0000-000000000000|sistema|stats-tentativi'].n === 1, 'password sbagliata: rifiutata e contata', msg);
const vera = mondo.STATS_IMPRONTA;
mondo.STATS_IMPRONTA = bytes(mondo.STATS_SALE + 'prova');
const S2 = JSON.parse(mondo.rpcStats({ userId: 'stats' }, logger, nk, JSON.stringify({ parola: 'prova' })));
dice(S2.tecniche.sessioni === 3 && S2.tecniche.erroriJs === 2 && S2.design.partiteTotali === 2 && S2.progressione.giocatoriConContatori === 2, 'password giusta: le statistiche, lette dallo storage, senza l-account della pagina', JSON.stringify(S2.tecniche));
dice(S2.progressione.livelloMedio === 4 && S2.nomi['final-a'] === 'A' && S2.progressione.nuoviGiocatori === 1, 'profili, nomi delle carte e date degli account letti dal server');
for (let i = 0; i < 12; i++) { try { mondo.rpcStats({ userId: 'stats' }, logger, nk, JSON.stringify({ parola: 'no' + i })); } catch (e) { msg = e.message; } }
let bloccata = '';
try { mondo.rpcStats({ userId: 'stats' }, logger, nk, JSON.stringify({ parola: 'prova' })); } catch (e) { bloccata = e.message; }
dice(/Too many wrong passwords/.test(msg) && /Too many wrong passwords/.test(bloccata), 'dopo dieci tentativi sbagliati si ferma, anche con quella giusta', bloccata);
archivio['00000000-0000-0000-0000-000000000000|sistema|stats-tentativi'].da = Date.now() - mondo.STATS_FINESTRA_MS - 1000;
dice(JSON.parse(mondo.rpcStats({ userId: 'stats' }, logger, nk, JSON.stringify({ parola: 'prova' }))).tecniche.sessioni === 3, 'passata la finestra riapre');
let senza = false;
try { mondo.rpcStats({}, logger, nk, JSON.stringify({ parola: 'prova' })); } catch (e) { senza = true; }
dice(senza, 'senza sessione non risponde');
mondo.STATS_IMPRONTA = vera;
const registrate = {};
try {
  mondo.InitModule({ env: {} }, logger, nk, new Proxy({}, { get: (tt, nome) => (...args) => { if (nome === 'registerRpc') registrate[args[0]] = args[1]; } }));
} catch (e) { }
dice(registrate.hx_telemetria === mondo.rpcTelemetria && registrate.hx_stats === mondo.rpcStats, 'hx_telemetria e hx_stats sono registrate');

console.log(String.fromCharCode(10) + (male ? male + ' NO' : 'tutto a posto'));
process.exit(male ? 1 : 0);
