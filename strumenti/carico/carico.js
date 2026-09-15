// IL TEST DI CARICO (v0.80.30).
//
//   node strumenti/carico/carico.js --prova
//        4 giocatori per 3 minuti: il protocollo regge? (partite finite, nessun disaccordo)
//   node strumenti/carico/carico.js --passi 25,50,100,200,300,400,600,800 --durata 150 --pvp 0.7
//
// Lorenzo: "passiamo al test di carico effettivo ... fallo adesso sul server vero".
// Giocatori finti ma veri per il server: account custom hxcarico0000, ...; all'ingresso
// hx_avvio e hx_entro; il battito (20 s, 10 s mentre cercano); la telemetria (60 s).
// Una parte (--pvp) cerca partite e le gioca: matchmaker, match_join, giocate su
// caselle libere dopo un po' di pensiero, il puntatore sulla mano, qualche sticker,
// le impronte uguali dai due lati, fino alla fine; poi di nuovo in coda.
// Il matchmaker li accoppia solo fra loro (gioco: hxcarico): mai con un giocatore vero.
//
// Intanto via SSH si legge la macchina ogni ~5 s: CPU, carico, memoria libera,
// memoria e CPU di Nakama e Postgres. Ogni passo stampa giocatori, partite, latenze
// (p50/p95/p99) degli ingressi, delle RPC, del matchmaking e delle giocate, errori, e
// la macchina. Si ferma da solo se il server cede (vedi SOGLIE). Alla fine nessuno
// torna in coda, si lasciano finire le partite in corso, escono tutti e si chiama
// hx_carico 'pulisci': account, telemetria, partite e picco tornano com'erano.
// L'indirizzo del server non si stampa mai: arriva da HEXTALE_SRV.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');
const { spawn } = require('child_process');

const RADICE = path.resolve(__dirname, '..', '..');
const API = 'https://api.hextalegame.com';
const WS = 'wss://api.hextalegame.com/ws';
const CHIAVE_SERVER = '8db52c53b62e208eebb8cb59dfbf159c85855683';   // la stessa del gioco (NAKAMA.chiaveServer)
const BASIC = 'Basic ' + Buffer.from(CHIAVE_SERVER + ':').toString('base64');
const OP = { AVVIO: 1, GIOCA: 2, GIOCATA: 3, RIFIUTO: 5, FINE: 6, IMPRONTA: 7, DISACCORDO: 8, ESITO: 9, NON_ACCETTATO: 13, STICKER: 14, MANO_SOPRA: 19 };
const SOGLIE = { rpcP95Ms: 3000, giocataP95Ms: 3000, erroriPerc: 5, memoriaLiberaMinMB: 40 };
const INGRESSI = ['auth', 'rpc:hx_avvio', 'rpc:hx_entro', 'ws:apertura'];

// ── le opzioni ─────────────────────────────────────────────────────────────
const arg = (nome, def) => { const i = process.argv.indexOf('--' + nome); return i < 0 ? def : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const PROVA = !!arg('prova', false);
const PASSI = PROVA ? [4] : String(arg('passi', '25,50,100,200,300,400,600,800')).split(',').map(Number).filter(n => n > 0);
const DURATA_MS = (PROVA ? 180 : Number(arg('durata', 150))) * 1000;
const PVP = PROVA ? 1 : Number(arg('pvp', 0.7));
const FORZA = !!arg('forza', false);
const SENZA_PULIZIA = !!arg('senza-pulizia', false);

// le caselle del tabellone, dal codice del server stesso
const mondo = { console, Date, Math, JSON, parseInt, parseFloat, isFinite, String, Object, Array, Error, Number, RegExp };
mondo.global = mondo;
vm.createContext(mondo);
new vm.Script(fs.readFileSync(path.join(RADICE, 'server', 'nakama', 'index.js'), 'utf8')).runInContext(mondo);
const CASELLE = mondo._caselle();

// ── le misure ──────────────────────────────────────────────────────────────
// M si azzera a ingressi finiti (si misura il regime); gli ingressi del passo
// (accessi, hx_avvio, socket) stanno in PASSO, che si azzera solo a inizio passo.
let M = null, PASSO = {}, CHIUSURA = false;
const nuoveMisure = () => ({ da: Date.now(), lat: {}, err: {}, richieste: 0, errori: 0, partiteFinite: 0, fini: {}, disaccordi: 0, rifiuti: {}, nonAccettate: 0,
  matchmakingMs: [], avvioMs: [], giocataMs: [], macchina: [] });
const segnaLat = (nome, ms) => { (M.lat[nome] = M.lat[nome] || []).push(ms); (PASSO[nome] = PASSO[nome] || []).push(ms); };
const segnaErr = (nome) => { M.err[nome] = (M.err[nome] || 0) + 1; M.errori++; };
const perc = (a, p) => { if (!a || !a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };
const tripla = (a) => a && a.length ? `${Math.round(perc(a, 50))}/${Math.round(perc(a, 95))}/${Math.round(perc(a, 99))}` : '-';
const aspetta = (ms) => new Promise(r => setTimeout(r, ms));
const caso = (a, b) => a + Math.random() * (b - a);

async function chiedi(nome, percorso, intestazioni, corpo) {
  const t0 = Date.now();
  M.richieste++;
  let r;
  try {
    r = await fetch(API + percorso, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, intestazioni), body: JSON.stringify(corpo || {}), signal: AbortSignal.timeout(20000) });
  } catch (e) { segnaErr(nome + ':rete'); throw e; }
  const testo = await r.text();
  segnaLat(nome, Date.now() - t0);
  if (!r.ok) { segnaErr(nome + ':' + r.status); const e = new Error(nome + ' ' + r.status + ' ' + testo.slice(0, 120)); e.status = r.status; throw e; }
  try { return JSON.parse(testo); } catch (_) { return {}; }
}
const uidDaToken = (t) => { try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).uid; } catch (_) { return ''; } };

// ── un giocatore ───────────────────────────────────────────────────────────
class Giocatore {
  constructor(n, pvp) {
    this.n = n; this.pvp = pvp;
    this.nome = 'hxcarico' + String(n).padStart(4, '0');
    this.sessione = 'carico-' + n + '-' + Math.random().toString(36).slice(2, 10);
    this.vivo = false; this.cercando = false; this.p = null; this.timer = new Set();
    this.partite = 0; this.nato = Date.now();
  }
  dopo(ms, f) { const t = setTimeout(() => { this.timer.delete(t); if (this.vivo) f(); }, ms); this.timer.add(t); }
  async accedi() {
    const r = await chiedi('auth', '/v2/account/authenticate/custom?create=true&username=' + this.nome, { Authorization: BASIC }, { id: 'hextale-carico-' + String(this.n).padStart(4, '0') });
    this.token = r.token; this.uid = uidDaToken(r.token);
  }
  async rpc(nome, corpo) {
    try { return await chiedi('rpc:' + nome, '/v2/rpc/' + nome + '?unwrap', { Authorization: 'Bearer ' + this.token }, corpo); }
    catch (e) {
      if (e.status === 401 && this.vivo) { await this.accedi(); return chiedi('rpc:' + nome, '/v2/rpc/' + nome + '?unwrap', { Authorization: 'Bearer ' + this.token }, corpo); }
      throw e;
    }
  }
  async entra() {
    await this.accedi();
    await this.rpc('hx_avvio', {});
    await this.rpc('hx_entro', { sessione: this.sessione });
    this.vivo = true;
    this.batti();
    this.dopo(caso(5000, 60000), () => this.telemetria());
    if (this.pvp) { await this.apriSocket(); this.dopo(caso(500, 4000), () => this.cerca()); }
  }
  batti() {
    this.rpc('hx_giocatori', { sessione: this.sessione, cerca: this.cercando, gioca: !!this.p }).catch(() => {});
    clearTimeout(this.tBatti);
    this.tBatti = setTimeout(() => { if (this.vivo) this.batti(); }, this.cercando ? 10000 : 20000);
  }
  telemetria() {
    this.rpc('hx_telemetria', { sessione: this.sessione, dalMs: Date.now() - this.nato, piattaforma: 'carico', caricamentoMs: 0,
      pagine: { mainmenu: Date.now() - this.nato }, errori: 0, erroriTesti: [], erroriRete: 0, partite: this.partite, partita: null }).catch(() => {});
    this.dopo(60000, () => this.telemetria());
  }
  apriSocket() {
    return new Promise((ok, ko) => {
      const t0 = Date.now();
      const s = new WebSocket(WS + '?token=' + encodeURIComponent(this.token) + '&format=json&status=false');
      this.ws = s;
      s.onopen = () => { segnaLat('ws:apertura', Date.now() - t0); ok(); };
      s.onerror = () => { segnaErr('ws:errore'); ko(new Error('socket')); };
      s.onclose = () => { if (this.vivo) { segnaErr('ws:chiuso'); this.p = null; this.cercando = false; this.dopo(3000, () => this.apriSocket().then(() => this.cerca()).catch(() => {})); } };
      s.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (_) { return; } this.messaggio(m); };
    });
  }
  manda(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  mandaOp(op, dati) { if (this.p) this.manda({ cid: 'd' + Date.now().toString(36), match_data_send: { match_id: this.p.matchId, op_code: op, data: Buffer.from(JSON.stringify(dati)).toString('base64') } }); }
  cerca() {
    if (!this.vivo || !this.pvp || this.p || CHIUSURA) { this.cercando = false; return; }
    this.cercando = true; this.tCerca = Date.now(); this.matchId = null;
    const io = String(this.uid).replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
    this.manda({ cid: 'mm' + Date.now().toString(36), matchmaker_add: { min_count: 2, max_count: 2,
      query: '+properties.gioco:hxcarico -properties.utente:' + io,
      string_properties: { gioco: 'hxcarico', mazzo: '', nome: this.nome, avatar: '', utente: io },
      numeric_properties: { rank: 0, capacita: 0, livello: 10 } } });
    this.batti();
  }
  messaggio(m) {
    if (m.ping) return this.manda({ cid: m.cid, pong: {} });
    if (m.error) { segnaErr('ws:' + String(m.error.message || m.error.code).slice(0, 40)); if (this.cercando && !this.p) this.dopo(3000, () => { this.cercando = false; this.cerca(); }); return; }
    if (m.notifications) { M.nonAccettate++; if (!this.p) { this.cercando = false; this.dopo(1000, () => this.cerca()); } return; }
    if (m.matchmaker_matched) {
      if (CHIUSURA) { this.cercando = false; return; }   // a fine test non si comincia niente di nuovo
      if (!m.matchmaker_matched.match_id) { segnaErr('mm:senza-partita'); this.dopo(2000, () => { this.cercando = false; this.cerca(); }); return; }
      M.matchmakingMs.push(Date.now() - this.tCerca);
      this.matchId = m.matchmaker_matched.match_id;
      this.dopo(caso(800, 2500), () => { this.tJoin = Date.now(); this.manda({ cid: 'j' + Date.now().toString(36), match_join: { match_id: this.matchId } }); });
      return;
    }
    if (m.match_data) this.partita(Number(m.match_data.op_code), (() => { try { return JSON.parse(Buffer.from(m.match_data.data || '', 'base64').toString()); } catch (_) { return {}; } })());
  }
  partita(op, d) {
    if (op === OP.AVVIO && d.tu) {
      M.avvioMs.push(Date.now() - (this.tJoin || Date.now()));
      this.cercando = false;
      this.p = { matchId: this.matchId, io: d.tu, mano: d.mano || [], buchi: new Set(d.buchi || []), turno: d.turno, occupate: {}, pubblico: d.pubblico || {}, sticker: Math.random() < 0.3 };
      this.batti();
      if (this.p.turno === this.p.io) this.pensa();
      return;
    }
    if (!this.p) return;
    if (op === OP.AVVIO && d.mano) { this.p.mano = d.mano; return; }
    if (op === OP.GIOCATA) {
      const k = d.q + ',' + d.r;
      this.p.occupate[k] = { carta: d.forma || d.carta, di: d.giocatore };
      if (d.giocatore === this.p.io) {
        const i = this.p.mano.indexOf(d.carta); if (i >= 0) this.p.mano.splice(i, 1);
        if (this.p.inViaggio && this.p.inViaggio.k === k) { M.giocataMs.push(Date.now() - this.p.inViaggio.t); this.p.inViaggio = null; }
      }
      this.p.turno = d.turno; this.p.pubblico = d.pubblico || this.p.pubblico;
      const libere = CASELLE.filter(c => !this.p.buchi.has(c) && !this.p.occupate[c]).length;
      const finita = libere === 0 || !!(this.p.pubblico[d.turno] && this.p.pubblico[d.turno].carteInMano === 0);
      const numeroTurno = d.numeroTurno;
      this.dopo(caso(300, 900), () => this.impronta(numeroTurno, finita));
      if (!finita && d.turno === this.p.io) this.pensa();
      return;
    }
    if (op === OP.RIFIUTO) { const r = String(d.perche || '?'); M.rifiuti[r] = (M.rifiuti[r] || 0) + 1; if (this.p.turno === this.p.io) this.dopo(500, () => this.gioca()); return; }
    // la fine arriva a tutti e due: la si conta una volta sola, dal giocatore 1
    if (op === OP.FINE) { if (this.p.io === 1) { M.partiteFinite++; M.fini[d.motivo || '?'] = (M.fini[d.motivo || '?'] || 0) + 1; } return this.finisci(); }
    if (op === OP.DISACCORDO) { if (this.p.io === 1) M.disaccordi++; return this.finisci(); }
    if (op === OP.NON_ACCETTATO) { M.nonAccettate++; this.p = null; this.dopo(1000, () => this.cerca()); }
  }
  impronta(turno, finita) {
    if (!this.p) return;
    const oc = this.p.occupate, chiavi = Object.keys(oc).sort();
    const punti = { 1: 0, 2: 0 };
    chiavi.forEach(k => { punti[oc[k].di]++; });
    this.mandaOp(OP.IMPRONTA, { turno: turno, impronta: chiavi.map(k => k + ':' + oc[k].carta + ':' + oc[k].di).join('|'),
      punteggio: punti, hp: punti, finita: finita, buchi: Array.from(this.p.buchi).sort(), valori: '' });
  }
  pensa() {
    const p = this.p;
    // il puntatore passa sulle carte mentre si pensa, come fa un giocatore
    for (let i = 0; i < 3; i++) this.dopo(caso(200, 2000), () => { if (this.p === p && p.mano.length) this.mandaOp(OP.MANO_SOPRA, { indice: Math.floor(Math.random() * p.mano.length) }); });
    if (p.sticker) { p.sticker = false; this.dopo(caso(500, 1500), () => this.mandaOp(OP.STICKER, { sticker: 'merlin-perfect' })); }
    this.dopo(caso(1500, 4000), () => this.gioca());
  }
  gioca() {
    const p = this.p;
    if (!p || p.turno !== p.io || !p.mano.length) return;
    const libere = CASELLE.filter(c => !p.buchi.has(c) && !p.occupate[c]);
    if (!libere.length) return;
    const k = libere[Math.floor(Math.random() * libere.length)], [q, r] = k.split(',').map(Number);
    const carta = p.mano[Math.floor(Math.random() * p.mano.length)];
    this.mandaOp(OP.MANO_SOPRA, { indice: null });
    p.inViaggio = { k: k, t: Date.now() };
    this.mandaOp(OP.GIOCA, { carta: carta, q: q, r: r });
  }
  finisci() {
    if (this.p) this.manda({ cid: 'l' + Date.now().toString(36), match_leave: { match_id: this.p.matchId } });
    this.p = null; this.partite++;
    this.batti();
    this.dopo(caso(3000, 8000), () => this.cerca());
  }
  async esci() {
    const eraVivo = this.vivo;
    this.vivo = false;
    this.timer.forEach(t => clearTimeout(t)); this.timer.clear(); clearTimeout(this.tBatti);
    if (this.p) this.manda({ cid: 'l', match_leave: { match_id: this.p.matchId } });
    try { if (this.ws) this.ws.close(); } catch (_) { }
    if (eraVivo) await this.rpc('hx_esco', { sessione: this.sessione }).catch(() => {});
  }
}

// ── la macchina, via SSH ───────────────────────────────────────────────────
const SSH = ['-i', path.join(os.homedir(), '.ssh', 'hextale'), '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes'];
function ssh(script) {
  return new Promise((ok) => {
    const p = spawn('ssh', SSH.concat([process.env.HEXTALE_SRV, 'sh -s']), { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', () => {});
    p.on('close', () => ok(out));
    p.stdin.end(script);
  });
}
const rpcServer = (nome, dati) => ssh(`cd /opt/nakama && docker compose exec -T caddy sh -c 'wget -qO- --header="Content-Type: application/json" --post-data="$1" "http://nakama:7350/v2/rpc/${nome}?unwrap&http_key=$NAKAMA_HTTP_KEY" || echo ERRORE' _ '${JSON.stringify(dati)}'\n`);
let sorvegliante = null;
function sorveglia() {
  const script = `cd /opt/nakama
while true; do
  echo "T $(date +%s) $(cut -d' ' -f1 /proc/loadavg) $(awk '/MemAvailable/{print $2}' /proc/meminfo) $(head -1 /proc/stat | cut -d' ' -f2-)"
  docker stats --no-stream --format 'C {{.Name}} {{.CPUPerc}} {{.MemUsage}}' nakama nakama-postgres
  sleep 3
done
`;
  const p = spawn('ssh', SSH.concat([process.env.HEXTALE_SRV, 'sh -s']), { stdio: ['pipe', 'pipe', 'pipe'] });
  let resto = '', prima = null, campione = null;
  p.stdout.on('data', d => {
    resto += d; const righe = resto.split('\n'); resto = righe.pop();
    for (const r of righe) {
      const x = r.trim().split(/\s+/);
      if (x[0] === 'T') {
        const cpu = x.slice(4).map(Number), tot = cpu.reduce((a, b) => a + b, 0), fermo = (cpu[3] || 0) + (cpu[4] || 0);
        const occupata = prima ? 100 * (1 - (fermo - prima.fermo) / Math.max(1, tot - prima.tot)) : null;
        prima = { tot, fermo };
        campione = { t: Number(x[1]) * 1000, load1: Number(x[2]), liberaMB: Number(x[3]) / 1024, cpu: occupata };
        if (M) M.macchina.push(campione);
      } else if (x[0] === 'C' && campione) {
        const mem = parseFloat(x[3]) * (/GiB/.test(x[3]) ? 1024 : 1);
        campione[x[1] === 'nakama' ? 'nakama' : 'postgres'] = { cpu: parseFloat(x[2]), memMB: mem };
      }
    }
  });
  p.stdin.end(script);
  sorvegliante = p;
}

// ── il resoconto di un passo ───────────────────────────────────────────────
function resoconto(giocatori) {
  const vivi = giocatori.filter(g => g.vivo), inPartita = vivi.filter(g => g.p).length, inCoda = vivi.filter(g => g.cercando).length;
  const min = (Date.now() - M.da) / 60000;
  const mac = M.macchina.filter(c => c.cpu !== null);
  const media = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const cpu = mac.map(c => c.cpu), nak = mac.map(c => c.nakama && c.nakama.memMB).filter(Boolean), pg = mac.map(c => c.postgres && c.postgres.memMB).filter(Boolean);
  const stat = (a) => a && a.length ? { n: a.length, p50: perc(a, 50), p95: perc(a, 95), p99: perc(a, 99) } : null;
  const r = {
    giocatori: vivi.length, inPartita, inCoda, minuti: +min.toFixed(2),
    partiteAlMinuto: +(M.partiteFinite / Math.max(min, 0.01)).toFixed(1), partiteFinite: M.partiteFinite, fini: M.fini, disaccordi: M.disaccordi, rifiuti: M.rifiuti, nonAccettate: M.nonAccettate,
    ingressi: Object.fromEntries(INGRESSI.map(k => [k, stat(PASSO[k])])),
    lat: Object.fromEntries(Object.entries(M.lat).map(([k, a]) => [k, stat(a)])),
    matchmakingMs: tripla(M.matchmakingMs), avvioMs: tripla(M.avvioMs), giocataMs: tripla(M.giocataMs), giocataP95: perc(M.giocataMs, 95),
    richieste: M.richieste, errori: M.err, erroriPerc: +(100 * M.errori / Math.max(1, M.richieste)).toFixed(2),
    macchina: { campioni: mac.length, cpuMedia: media(cpu) && +media(cpu).toFixed(0), cpuMax: cpu.length ? +Math.max(...cpu).toFixed(0) : null,
      load1Max: mac.length ? Math.max(...mac.map(c => c.load1)) : null, liberaMinMB: mac.length ? +Math.min(...mac.map(c => c.liberaMB)).toFixed(0) : null,
      nakamaMaxMB: nak.length ? +Math.max(...nak).toFixed(0) : null, postgresMaxMB: pg.length ? +Math.max(...pg).toFixed(0) : null,
      nakamaCpuMedia: (() => { const v = media(mac.map(c => c.nakama && c.nakama.cpu).filter(x => x !== undefined)); return v === null ? null : +v.toFixed(0); })(),
      postgresCpuMedia: (() => { const v = media(mac.map(c => c.postgres && c.postgres.cpu).filter(x => x !== undefined)); return v === null ? null : +v.toFixed(0); })() }
  };
  const l = (o) => o ? `${o.p50}/${o.p95}/${o.p99}` : '-';
  console.log(`\n── ${r.giocatori} giocatori (in partita ${inPartita}, in coda ${inCoda}) — ${r.minuti} min a regime`);
  console.log(`   ingressi ms p50/p95/p99 — accesso ${l(r.ingressi['auth'])} | hx_avvio ${l(r.ingressi['rpc:hx_avvio'])} | hx_entro ${l(r.ingressi['rpc:hx_entro'])} | socket ${l(r.ingressi['ws:apertura'])}`);
  console.log(`   a regime ms p50/p95/p99 — battito ${l(r.lat['rpc:hx_giocatori'])} | telemetria ${l(r.lat['rpc:hx_telemetria'])}`);
  console.log(`   partite finite ${r.partiteFinite} (${r.partiteAlMinuto}/min) ${JSON.stringify(r.fini)} | disaccordi ${r.disaccordi} | rifiuti ${JSON.stringify(r.rifiuti)} | non accettate ${r.nonAccettate}`);
  console.log(`   matchmaking ${r.matchmakingMs} | ingresso→avvio ${r.avvioMs} | giocata→eco ${r.giocataMs}`);
  console.log(`   richieste ${r.richieste}, errori ${r.erroriPerc}% ${JSON.stringify(r.errori)}`);
  console.log(`   macchina: CPU media ${r.macchina.cpuMedia}% max ${r.macchina.cpuMax}% (Nakama ${r.macchina.nakamaCpuMedia}%, Postgres ${r.macchina.postgresCpuMedia}%) | load1 max ${r.macchina.load1Max} | RAM libera min ${r.macchina.liberaMinMB} MB | Nakama max ${r.macchina.nakamaMaxMB} MB | Postgres max ${r.macchina.postgresMaxMB} MB`);
  return r;
}
function cede(r) {
  const rpcP95 = Math.max(0, ...['rpc:hx_giocatori', 'rpc:hx_telemetria'].map(k => (r.lat[k] && r.lat[k].p95) || 0));
  const motivi = [];
  if (rpcP95 > SOGLIE.rpcP95Ms) motivi.push('RPC p95 ' + rpcP95 + ' ms');
  if (r.giocataP95 && r.giocataP95 > SOGLIE.giocataP95Ms) motivi.push('giocata p95 ' + r.giocataP95 + ' ms');
  if (r.erroriPerc > SOGLIE.erroriPerc) motivi.push('errori ' + r.erroriPerc + '%');
  if (r.macchina.liberaMinMB !== null && r.macchina.liberaMinMB < SOGLIE.memoriaLiberaMinMB) motivi.push('RAM libera ' + r.macchina.liberaMinMB + ' MB');
  return motivi;
}

// ── il test ────────────────────────────────────────────────────────────────
(async () => {
  if (!process.env.HEXTALE_SRV) { console.log('manca HEXTALE_SRV'); process.exit(1); }
  M = nuoveMisure();
  const online = (await rpcServer('hx_giocatori', {})).match(/"giocatori":\s*(\d+)/);
  console.log('giocatori veri online adesso: ' + (online ? online[1] : 'non so dirlo'));
  if (online && Number(online[1]) > 0 && !FORZA) { console.log('FERMO: ci sono giocatori veri online (--forza per andare avanti lo stesso)'); process.exit(2); }
  console.log('hx_carico inizia: ' + (await rpcServer('hx_carico', { azione: 'inizia' })).trim());
  sorveglia();
  const giocatori = [], esiti = [];
  let fermato = null, finito = false;
  const chiudi = async (perche) => {
    if (finito) return; finito = true;
    CHIUSURA = true;
    console.log('\n' + perche + ': nessuno torna in coda, si finiscono le partite in corso...');
    const t0 = Date.now();
    while (giocatori.some(g => g.vivo && g.p) && Date.now() - t0 < 120000) await aspetta(2000);
    console.log('   partite ancora aperte: ' + giocatori.filter(g => g.vivo && g.p).length + ' — escono tutti');
    for (let i = 0; i < giocatori.length; i += 25) { await Promise.all(giocatori.slice(i, i + 25).map(g => g.esci())); }
    await aspetta(10000);
    if (sorvegliante) sorvegliante.kill();
    if (!SENZA_PULIZIA) console.log('hx_carico pulisci: ' + (await rpcServer('hx_carico', { azione: 'pulisci', quanti: giocatori.length })).trim());
    const dir = path.join(__dirname, 'esiti'); fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, new Date().toISOString().replace(/[:.]/g, '-') + (PROVA ? '-prova' : '') + '.json');
    fs.writeFileSync(file, JSON.stringify({ passi: PASSI, durataMs: DURATA_MS, pvp: PVP, fermato, esiti }, null, 2));
    console.log('scritto ' + path.relative(RADICE, file));
    process.exit(0);
  };
  process.on('SIGINT', () => chiudi('interrotto'));
  for (const obiettivo of PASSI) {
    M = nuoveMisure(); PASSO = {};
    const nuovi = obiettivo - giocatori.length, rampa = Math.min(30000, DURATA_MS / 3);
    console.log(`\n>> passo ${obiettivo}: entrano ${nuovi} giocatori in ${Math.round(rampa / 1000)} s`);
    for (let i = 0; i < nuovi; i++) {
      const g = new Giocatore(giocatori.length, PVP >= 1 || Math.random() < PVP);
      giocatori.push(g);
      setTimeout(() => { g.entra().catch(() => { segnaErr('ingresso'); }); }, caso(0, rampa));
    }
    await aspetta(rampa + 5000);
    M = nuoveMisure();   // da qui si misura il regime
    await aspetta(Math.max(10000, DURATA_MS - rampa - 5000));
    const r = resoconto(giocatori);
    r.obiettivo = obiettivo;
    esiti.push(r);
    const motivi = cede(r);
    if (motivi.length) { fermato = { passo: obiettivo, motivi }; console.log('\n!! il server cede: ' + motivi.join(', ')); break; }
  }
  await chiudi(fermato ? 'fermato' : 'passi finiti');
})();
