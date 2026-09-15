// I GIOCATORI IN /stats/, SUL SERVER, SENZA NAKAMA (v0.80.29).
//
//     node strumenti/prova-v08029-server.js
//     node strumenti/prova-v08029-server.js /percorso/index.js   (la copia schierata)
//
// Lorenzo: "Aggiungi alle stats queste statistiche: Giocatori online, Picco
// massimo giocatori online, giocatori totali unici che sono entrati in game e
// hanno fatto almeno una partita", e "un pulsante nella pagina stats che mi fa
// vedere quanti giocatori sono in partita con tutti i vari username". Qui:
//   1. il battito risponde come prima e scrive il picco quando sale, mai quando scende;
//   2. _contaPresenze: l'account escluso non si conta ma la presenza resta viva;
//   3. calcolaStatistiche: online adesso, picco (dalle sessioni se piu' alto di
//      quello salvato, col suo momento), unici (partite in rete, registri,
//      profili di stagione con partite), senza l'account della pagina;
//   4. hx_stats porta i giocatori letti dallo storage;
//   5. hx_stats_live: password, username in ordine alfabetico dei soli giocatori
//      in partita, niente account della pagina; tetto ai tentativi condiviso con hx_stats;
//   6. hx_stats_live e' registrata.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const DOVE = process.argv[2] || path.join(__dirname, '..', 'server', 'nakama', 'index.js');
console.log('provo ' + DOVE + String.fromCharCode(10));
let adesso = Date.UTC(2026, 8, 16, 12, 0, 0);
const DataFinta = function () { return arguments.length ? new (Function.prototype.bind.apply(Date, [null].concat([].slice.call(arguments))))() : new Date(adesso); };
DataFinta.now = () => adesso;
DataFinta.UTC = Date.UTC;
DataFinta.parse = Date.parse;
const mondo = { console, Date: DataFinta, Math, JSON, parseInt, parseFloat, isFinite, String, Object, Array, Error, Number, RegExp };
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
const impronta = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');

// ── lo storage finto ──────────────────────────────────────────────────────
let archivio = {};   // "utente|collezione|chiave" -> valore
const NOMI = { u1: 'zed', u2: 'Bob', u3: 'alice', u4: 'Carla', stats: 'hxstats' };
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
  usersGetId: (ids) => ids.filter(id => NOMI[id]).map(id => ({ userId: id, username: NOMI[id], createTime: 0 }))
};
const logger = { info() {}, warn() {}, error() {}, debug() {} };
const SIS = '00000000-0000-0000-0000-000000000000|sistema|';
const TELE = '00000000-0000-0000-0000-000000000000|telemetria|';
const batte = (u, corpo) => JSON.parse(mondo.rpcGiocatoriOnline({ userId: u }, logger, nk, JSON.stringify(Object.assign({ sessione: 's-' + u }, corpo || {}))));

// ── 1. il battito e il picco ──────────────────────────────────────────────
// v0.80.30 — il picco sta nel conto delle presenze (sistema/conto-presenze)
const conto = () => archivio[SIS + mondo.KEY_CONTO_PRESENZE] || {};
batte('u1', { gioca: true });
batte('u2', { cerca: true });
let b = batte('u3', {});
dice(b.giocatori === 3 && b.cercano === 1 && b.inPartita === 1 && 'riavvio' in b, 'il battito risponde come prima: tre online, uno cerca, uno gioca', JSON.stringify(b));
dice(conto().picco === 3 && conto().piccoIl === adesso, 'il picco si scrive col suo momento', JSON.stringify(conto()));
const primoPicco = adesso;
adesso += 1000;
batte('u4', { gioca: true });
dice(conto().picco === 4 && conto().piccoIl === adesso, 'arriva il quarto: il picco sale', JSON.stringify(conto()));
const quandoQuattro = adesso;
adesso += mondo.PRESENZA_VIVA_MS + 1000;
b = batte('u1', { gioca: true });
dice(b.giocatori === 1 && conto().picco === 4 && conto().piccoIl === quandoQuattro, 'se ne vanno: online uno, il picco resta quattro (e il suo momento)', JSON.stringify([b, conto()]));
dice(primoPicco < quandoQuattro, '(ordine dei momenti)');

// ── 2. _contaPresenze ─────────────────────────────────────────────────────
const vive = { a: { q: adesso - 1000, s: 'x', g: 1 }, stats: { q: adesso - 1000, s: 'y', g: 1 }, vecchio: { q: adesso - mondo.PRESENZA_VIVA_MS - 5, s: 'z' }, c: { q: adesso - mondo.RICERCA_VIVA_MS - 5, s: 'w', c: 1 } };
const cp = mondo._contaPresenze(vive, adesso, ['stats']);
dice(cp.quanti === 2 && cp.inPartita === 1 && cp.cercano === 0 && cp.chiGioca.join() === 'a' && 'stats' in cp.vivi && !('vecchio' in cp.vivi), 'escluso non contato ma vivo; scaduti fuori; ricerca vecchia non conta', JSON.stringify(cp));

// ── 3. calcolaStatistiche ─────────────────────────────────────────────────
const T = Date.UTC(2026, 8, 12, 10, 0, 0), M = 60000;
const sessione = (u, s, da, a) => ({ u: u, s: s, inizio: T + da * M, fine: T + a * M, piattaforma: 'browser', caricamentoMs: 0, pagine: {}, errori: 0, erroriTesti: [], erroriRete: 0 });
const ora = T + 3 * 86400000;
const dati = {
  sessioni: [sessione('u1', 'a', 0, 60), sessione('u2', 'b', 10, 30), sessione('u3', 'c', 20, 25), sessione('u4', 'd', 60, 70),
             sessione('stats', 'z', 15, 40), sessione('u5', 'e', 30, 20)],
  partiteServer: [{ pvp: true, id: 'M1', inizio: T, fine: T + 5 * M, durataMs: 5 * M, modo: 'finita', vincitore: 1,
    giocatori: [{ u: 'u1', rank: 2, mazzo: ['final-a'] }, { u: 'u2', rank: 5, mazzo: ['final-b'] }], mosse: [] }],
  logPartite: [
    { pvp: false, id: '', u: 'u3', io: 1, inizio: T, fine: T + M, durataMs: M, vincitore: 1, mazzi: { 1: ['final-a'], 2: ['final-b'] }, pescate: { 1: {}, 2: {} }, mosse: [], conquiste: [], punti: [] },
    { pvp: false, id: '', u: 'stats', io: 1, inizio: T, fine: T + M, durataMs: M, vincitore: 1, mazzi: { 1: ['final-a'], 2: ['final-b'] }, pescate: { 1: {}, 2: {} }, mosse: [], conquiste: [], punti: [] }
  ],
  possessi: [],
  stagioni: [{ u: 'u7', v: { stagione: 'VECCHIA', partite: 3 } }, { u: 'u8', v: { stagione: 'S', partite: 0 } }, { u: 'u1', v: { stagione: 'S', partite: 9 } }],
  stagioneCorrente: 'S', creati: {},
  catalogo: [{ id: 'final-a', name: 'A' }, { id: 'final-b', name: 'B' }],
  presenze: { u5: { q: ora - 1000, s: 'p', g: 1 }, u6: { q: ora - 1000, s: 'q', c: 1 }, stats: { q: ora - 1000, s: 'r', g: 1 } },
  piccoOnline: { n: 2, quando: T - 86400000 },
  esclusi: ['stats']
};
let S = copia(mondo.calcolaStatistiche(copia(dati), ora));
let g = S.giocatori;
dice(g && g.online === 2 && g.inPartita === 1 && g.cercano === 1, 'online adesso: due (l-account della pagina no), uno in partita, uno in matchmaking', JSON.stringify(g));
dice(g.picco === 3 && g.piccoIl === T + 20 * M, 'picco: tre insieme dalle sessioni (u1, u2, u3 alle 10:20), piu- alto dei due salvati', JSON.stringify(g));
dice(g.unici === 4, 'unici: u1 e u2 (in rete), u3 (contro il bot), u7 (profilo con partite); non u8, non la pagina', g.unici);
const d2 = copia(dati); d2.piccoOnline = { n: 9, quando: T - 5 };
S = copia(mondo.calcolaStatistiche(d2, ora));
dice(S.giocatori.picco === 9 && S.giocatori.piccoIl === T - 5, 'un picco salvato piu- alto vince sulle sessioni');
const d3 = copia(dati); d3.piccoOnline = null; d3.sessioni = []; d3.presenze = { a: { q: ora, s: '1' }, b: { q: ora, s: '2' }, c: { q: ora, s: '3' } };
S = copia(mondo.calcolaStatistiche(d3, ora));
dice(S.giocatori.picco === 3 && S.giocatori.piccoIl === ora, 'e se adesso sono di piu-, il picco e- adesso', JSON.stringify(S.giocatori));
const V = copia(mondo.calcolaStatistiche({}, ora)).giocatori;
dice(V.online === 0 && V.picco === 0 && V.piccoIl === null && V.unici === 0, 'senza dati: zeri, e nessun momento del picco', JSON.stringify(V));

// ── 4. hx_stats dallo storage ─────────────────────────────────────────────
archivio = {};
archivio[SIS + 'catalogo'] = { carte: dati.catalogo };
dati.sessioni.forEach(s => { archivio[TELE + 's:' + s.u + ':' + s.s] = s; });
archivio[TELE + 'm:M1'] = dati.partiteServer[0];
archivio[TELE + 'b:u3:1'] = dati.logPartite[0];
archivio[TELE + 'b:stats:1'] = dati.logPartite[1];
archivio['u7|profilo|stagione'] = { stagione: 'VECCHIA', partite: 3 };
// v0.80.30 — le presenze sono un record per giocatore; senza conto delle presenze
// il picco si legge ancora da sistema/picco-online (quello della v0.80.29)
const presenzeProva = { u1: { q: adesso - 1000, s: 's1', g: 1 }, u2: { q: adesso - 2000, s: 's2', g: 1 }, u3: { q: adesso - 3000, s: 's3' },
  u4: { q: adesso - 1000, s: 's4', g: 1 }, fantasma: { q: adesso - 1000, s: 's5', g: 1 }, stats: { q: adesso - 1000, s: 's6', g: 1 },
  vecchio: { q: adesso - mondo.PRESENZA_VIVA_MS - 1000, s: 's7', g: 1 } };
Object.keys(presenzeProva).forEach(u => { archivio[u + '|' + mondo.COLL_PRESENZA + '|' + mondo.KEY_BATTITO] = presenzeProva[u]; });
archivio[SIS + 'picco-online'] = { n: 7, quando: adesso - 5000 };
const vera = mondo.STATS_IMPRONTA;
mondo.STATS_IMPRONTA = impronta(mondo.STATS_SALE + 'prova');
S = JSON.parse(mondo.rpcStats({ userId: 'stats' }, logger, nk, JSON.stringify({ parola: 'prova' })));
dice(S.giocatori.online === 5 && S.giocatori.inPartita === 4 && S.giocatori.picco === 7 && S.giocatori.unici === 4, 'hx_stats legge presenze, picco e partite dallo storage', JSON.stringify(S.giocatori));

// ── 5. hx_stats_live ──────────────────────────────────────────────────────
let msg = '';
try { mondo.rpcStatsLive({ userId: 'stats' }, logger, nk, JSON.stringify({ parola: 'sbagliata' })); } catch (e) { msg = e.message; }
dice(msg === 'That is not the password.' && archivio[SIS + 'stats-tentativi'].n === 1, 'password sbagliata: rifiutata e contata', msg);
const L = JSON.parse(mondo.rpcStatsLive({ userId: 'stats' }, logger, nk, JSON.stringify({ parola: 'prova' })));
dice(L.inPartita === 4 && L.online === 5 && L.cercano === 0 && typeof L.generatoIl === 'number', 'quanti in partita e online (la pagina non conta, chi e- scaduto nemmeno)', JSON.stringify(L));
dice(JSON.stringify(L.nomi) === JSON.stringify(['Bob', 'Carla', 'zed']), 'gli username dei soli giocatori in partita, in ordine alfabetico (maiuscole ignorate); chi non ha un account resta contato senza nome', JSON.stringify(L.nomi));
for (let i = 0; i < 12; i++) { try { mondo.rpcStatsLive({ userId: 'stats' }, logger, nk, JSON.stringify({ parola: 'no' + i })); } catch (e) { msg = e.message; } }
let bloccata = '';
try { mondo.rpcStats({ userId: 'stats' }, logger, nk, JSON.stringify({ parola: 'prova' })); } catch (e) { bloccata = e.message; }
dice(/Too many wrong passwords/.test(bloccata), 'i tentativi sbagliati su hx_stats_live chiudono anche hx_stats (un tetto solo)', bloccata);
let senza = false;
try { mondo.rpcStatsLive({}, logger, nk, JSON.stringify({ parola: 'prova' })); } catch (e) { senza = true; }
dice(senza, 'senza sessione non risponde');
mondo.STATS_IMPRONTA = vera;

// ── 6. registrata ─────────────────────────────────────────────────────────
const registrate = {};
try {
  mondo.InitModule({ env: {} }, logger, nk, new Proxy({}, { get: (tt, nome) => (...args) => { if (nome === 'registerRpc') registrate[args[0]] = args[1]; } }));
} catch (e) { }
dice(registrate.hx_stats_live === mondo.rpcStatsLive && registrate.hx_stats === mondo.rpcStats, 'hx_stats_live e- registrata');

console.log(String.fromCharCode(10) + (male ? male + ' NO' : 'tutto a posto'));
process.exit(male ? 1 : 0);
