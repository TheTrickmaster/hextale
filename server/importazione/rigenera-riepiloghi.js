// ══════════════════════════════════════════════════════════════════════════
// RIGENERA LA COLONNA "Complete script" DAL FOGLIO STESSO
// ══════════════════════════════════════════════════════════════════════════
//   node server/importazione/rigenera-riepiloghi.js
//
// Scarica il foglio, rilegge il blocco delle abilita' col parser vero, e
// riscrive la frase di riepilogo di ogni carta. Stampa quali cambiano.
//
// PERCHE' ESISTE. Quella colonna e' un SECONDO DEPOSITO della stessa verita':
// se la si scrive a mano, prima o poi dice una cosa mentre le colonne ne
// dicono un'altra — ed e' successo subito, appena Lorenzo ha corretto a mano
// due carte. La frase deve essere GENERATA, e allora diventa utile per quello
// che e': la prova che la riga e' stata capita come la si intendeva. Se la
// frase non torna, e' la riga a essere sbagliata, non la frase.
//
// Non scrive sul foglio (non si puo' da qui): produce un blocco da incollare
// nella colonna del riepilogo, piu' l'elenco di cosa cambia.

'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const P = require('./abilita-parser.js');

const QUI = __dirname;
const SHEET_ID = '17atpUlgmzHMZibOMDKEMyr9LxN8o0aK18Gg-Q1Ziko4';
const USCITA = path.join(QUI, '.lavoro', 'riepiloghi.txt');

function scarica(url) {
  return new Promise((ok, ko) => {
    https.get(url, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        return scarica(r.headers.location).then(ok, ko);
      }
      if (r.statusCode !== 200) return ko(new Error('HTTP ' + r.statusCode));
      let d = ''; r.setEncoding('utf8');
      r.on('data', c => d += c); r.on('end', () => ok(d));
    }).on('error', ko);
  });
}

function leggiCsv(s) {
  const righe = []; let c = [], v = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { v += '"'; i++; } else q = false; } else v += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { c.push(v); v = ''; }
    else if (ch === '\n') { c.push(v); righe.push(c); c = []; v = ''; }
    else if (ch !== '\r') v += ch;
  }
  if (v !== '' || c.length) { c.push(v); righe.push(c); }
  return righe;
}

// La frase. Dice le cose nell'ordine in cui si leggono: quando, a che
// condizione, cosa succede.
function frase(a, gia) {
  if (!a) return '-';
  if (a.unica) {
    // Il MOTIVO per cui un'abilita' e' scritta a mano vale piu' di qualunque
    // frase generata: e' l'unica cosa che dice a chi legge perche' quella
    // carta non entra nel vocabolario. Se c'e' gia', non si tocca.
    var vecchia = String(gia || '').trim();
    var generica = 'UNIQUE — scritta a mano nel codice';
    if (vecchia.indexOf('UNIQUE') === 0 && vecchia !== generica) return vecchia;
    return generica;
  }
  const q = v => v !== null && v !== undefined && v !== '' && v !== '-';
  const p = [];
  p.push(String(a.trigger).split('_').join(' '));
  if (a.frequenza && a.frequenza !== 'every_time') p.push(String(a.frequenza).split('_').join(' '));
  if (a.finestra && a.finestra.tipo && a.finestra.tipo !== 'always') {
    p.push(String(a.finestra.tipo).split('_').join(' ') + (q(a.finestra.valore) ? ' ' + a.finestra.valore : ''));
  }
  const cond = c => {
    if (!c) return '';
    let v = '';
    if (c.valore) {
      if (c.valore.tratti) v = c.valore.tratti.join(',');
      else if (c.valore.carta) v = c.valore.carta;
      else if (c.valore.parita) v = c.valore.parita;
      else if (typeof c.valore.numero === 'number') v = String(c.valore.numero);
    }
    return 'if ' + c.soggetto + ' ' + c.test + (v ? ' ' + v : '');
  };
  const regola = r => r ? ('RULE ' + r.nome + ' ' + r.bersaglio + (q(r.valore) ? ' ' + r.valore : '')) : '';
  const quanto = x => {
    if (!x) return '';
    if (typeof x.numero === 'number') return String(x.numero);
    if (typeof x.da === 'number') return x.da + '-' + x.a;
    if (x.carta) return x.carta;
    if (x.parola) return x.parola;
    return '';
  };
  const eff = e => {
    if (!e) return '';
    // v0.77.67 — chi indica il bersaglio sta in una colonna sua: se e' il
    // giocatore, la frase deve dirlo, altrimenti due righe diverse si
    // riassumerebbero uguali.
    const s = [e.azione];
    if (e.scelta) s.push('chosen');
    ['chi', 'dove', 'cosa', 'quale', 'ambito'].forEach(k => { if (q(e[k])) s.push(e[k]); });
    const n = quanto(e.quanto); if (n) s.push(n);
    if (q(e.per)) s.push('per ' + e.per);
    if (q(e.durata) && e.durata !== 'permanent') s.push(e.durata);
    return s.join(' ');
  };
  [cond(a.se), regola(a.regola), eff(a.effetto)].forEach(x => { if (x) p.push(x); });
  if (q(a.legame)) {
    p.push(a.legame);
    [cond(a.se2), regola(a.regola2), eff(a.effetto2)].forEach(x => { if (x) p.push(x); });
  }
  return p.filter(Boolean).join(', ');
}

(async () => {
  const url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/export?format=csv&gid=0';
  const R = leggiCsv(await scarica(url));
  const H = R[0];
  const inizio = H.indexOf('Is unique');
  if (inizio < 0) { console.error('nel foglio non c\'e\' la colonna "Is unique".'); process.exit(1); }
  const posto = P.posizioni(H);   // per nome, non per posizione (v0.77.67)
  const colonnaRiepilogo = posto['Complete script'];

  let primo = -1, ultimo = -1;
  for (let i = 1; i < R.length; i++) if ((R[i][5] || '').trim()) { if (primo < 0) primo = i; ultimo = i; }

  const fuori = [];
  const cambiate = [];
  const guasti = [];
  for (let i = primo; i <= ultimo; i++) {
    const r = R[i];
    const nome = (r[5] || '').trim() || '(senza nome)';
    let a = null;
    try {
      a = P.abilitaDaRiga(nome, c => { const j = posto[c]; return j === undefined ? '' : (r[j] || ''); });
    } catch (e) { guasti.push('riga ' + (i + 1) + ' — ' + e.message); fuori.push((r[colonnaRiepilogo] || '')); continue; }
    const vecchia = (r[colonnaRiepilogo] || '').trim();
    const nuova = a ? frase(a, vecchia) : '-';
    if (nuova !== vecchia) cambiate.push({ riga: i + 1, nome, vecchia, nuova });
    fuori.push(nuova);
  }

  if (guasti.length) {
    console.log('ATTENZIONE: ' + guasti.length + ' righe non si leggono, e il loro riepilogo resta com\'era.');
    guasti.forEach(g => console.log('  - ' + g));
  }
  console.log('riepiloghi rigenerati: ' + fuori.length + ' | diversi da quelli nel foglio: ' + cambiate.length);
  cambiate.forEach(c => {
    console.log('\n  riga ' + c.riga + ' — ' + c.nome);
    console.log('    era:  ' + (c.vecchia || '(vuoto)'));
    console.log('    ora:  ' + c.nuova);
  });

  try { fs.mkdirSync(path.dirname(USCITA), { recursive: true }); } catch (_) { }
  fs.writeFileSync(USCITA, fuori.join('\n') + '\n', 'utf8');
  const L = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  console.log('\nscritto: ' + USCITA);
  console.log('da incollare nella colonna ' + L(colonnaRiepilogo) + ', dalla riga ' + (primo + 1) + ' alla ' + (ultimo + 1) + '.');
})().catch(e => { console.error('ERRORE: ' + (e && e.message || e)); process.exit(1); });
