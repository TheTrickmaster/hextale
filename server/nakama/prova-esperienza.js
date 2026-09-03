// BANCO DI PROVA — QUANTO VALE UNA PARTITA
//
// Le regole, dette da Lorenzo:
//   - 2 punti per ogni turno giocato, sempre e comunque;
//   - + 50 se la partita si conclude in vittoria;
//   - + 20 se si conclude in sconfitta;
//   - + 20 a chi si arrende: arrendersi e' CONCLUDERE, e' una sconfitta scelta;
//   - + 0 a chi si disconnette, crasha, o esce per qualunque altra ragione che
//     non sia la sconfitta: la sua partita non si e' conclusa in nessun modo.
//     I turni giocati restano suoi, perche' quelli li ha giocati;
//   - a chi RESTA dopo che l'altro e' uscito: + 50 se stava vincendo, + 35 se
//     stava perdendo.
//
//     node server/nakama/prova-esperienza.js
//
// Questo banco non ricopia la tabella: CARICA quella vera dal modulo del
// server e la interroga. Una copia sarebbe una seconda verita' da tenere
// allineata, e prima o poi una delle due resterebbe indietro — che e' proprio
// il difetto che i banchi esistono per impedire.
const fs = require('fs');
const path = require('path');

const F = path.join(__dirname, 'index.js');
const src = fs.readFileSync(F, 'utf8');
let M;
try {
  M = new Function(src + '; return { xpDiFine: xpDiFine, turniPuliti: turniPuliti, ' +
    'inkDiFine: inkDiFine, PARTITE_PER_BUSTINA: PARTITE_PER_BUSTINA, ' +
    'XP_PER_TURNO: XP_PER_TURNO, XP_VITTORIA: XP_VITTORIA, XP_SCONFITTA: XP_SCONFITTA };')();
} catch (e) {
  console.log('non riesco a caricare il modulo del server: ' + e.message);
  process.exit(1);
}

let ko = 0;
function conta(nome, avuto, atteso) {
  const buono = avuto === atteso;
  if (!buono) ko++;
  console.log('  ' + (buono ? 'ok    ' : 'ROTTA ') + nome.padEnd(46)
    + String(avuto).padStart(4) + (buono ? '' : '   (atteso ' + atteso + ')'));
}

// Quanto prende un giocatore, per intero: i turni piu' il premio di fine.
function xp(turni, modo, vinta) {
  return M.XP_PER_TURNO * M.turniPuliti(turni) + M.xpDiFine(modo, !!vinta);
}

console.log('IL PREMIO DI FINE PARTITA\n');
conta('vittoria', M.xpDiFine('finita', true), 50);
conta('sconfitta', M.xpDiFine('finita', false), 20);
conta('resa (una sconfitta scelta)', M.xpDiFine('resa', false), 20);
conta('disconnesso, crashato, uscito', M.xpDiFine('uscito', false), 0);
conta('resta in partita, stava vincendo', M.xpDiFine('resta', true), 50);
conta('resta in partita, stava perdendo', M.xpDiFine('resta', false), 35);

console.log('\nI TURNI, CHE NESSUNO PUO- PERDERE\n');
conta('due punti per turno', M.XP_PER_TURNO, 2);
conta('nove turni e una vittoria', xp(9, 'finita', true), 68);
conta('nove turni e una sconfitta', xp(9, 'finita', false), 38);
conta('nove turni e una resa', xp(9, 'resa', false), 38);
conta('nove turni e una disconnessione', xp(9, 'uscito', false), 18);
conta('nove turni, resta, vincendo', xp(9, 'resta', true), 68);
conta('nove turni, resta, perdendo', xp(9, 'resta', false), 53);
conta('zero turni e una disconnessione', xp(0, 'uscito', false), 0);

console.log('\nE UN NUMERO DI TURNI NON SI PUO- DICHIARARE A PIACERE\n');
conta('un numero assurdo si taglia al tabellone', M.turniPuliti(9999), 19);
conta('un numero negativo vale zero', M.turniPuliti(-5), 0);
conta('niente vale zero', M.turniPuliti(undefined), 0);
conta('un testo vale zero', M.turniPuliti('molti'), 0);
conta('un decimale si arrotonda in giu-', M.turniPuliti(7.9), 7);

console.log('\nL-INCHIOSTRO MAGICO\n');
conta('vittoria', M.inkDiFine('finita', true), 10);
conta('sconfitta', M.inkDiFine('finita', false), 5);
conta('resa (ha concluso, perdendo)', M.inkDiFine('resa', false), 5);
conta('disconnesso, crashato, uscito', M.inkDiFine('uscito', false), 0);
conta('resta, stava vincendo', M.inkDiFine('resta', true), 10);
conta('resta, stava perdendo', M.inkDiFine('resta', false), 5);

// Un PAREGGIO non e' una vittoria e non e' nemmeno una cosa a se': vale come
// una sconfitta, ed e' cosi' che arriva fin qui — su un pareggio nessuno dei
// due giocatori ha `vinta`, quindi tutti e due prendono i premi della
// sconfitta. Il banco lo scrive perche' e' una REGOLA, e non una conseguenza
// casuale di come e' fatto il codice: chi un domani desse al pareggio un premio
// suo deve accorgersi di stare cambiando una regola.
console.log('\nIL PAREGGIO\n');
conta('esperienza, come una sconfitta', M.xpDiFine('finita', false), 20);
conta('inchiostro, come una sconfitta', M.inkDiFine('finita', false), 5);
conta('nove turni e un pareggio', xp(9, 'finita', false), 38);

console.log('\nLA BUSTINA\n');
conta('una ogni cinque partite', M.PARTITE_PER_BUSTINA, 5);

// ── v0.78.12 — CONTRO L'IA NON SI GUADAGNA NIENTE. MAI. ──────────────────
// Non e' una sfumatura: e' la regola che tiene in piedi il rank e il livello.
// Se un domani qualcuno togliesse la guardia `premia`, si tornerebbe a poter
// salire di livello battendo il computer in fila — cioe' a misurare la voglia
// di premere un pulsante invece di quanto si gioca.
console.log('\nE CONTRO L-IA NON SI GUADAGNA NIENTE\n');
const guardie = [
  { nome: 'esperienza, inchiostro e bustina si danno solo se `premia`',
    prova: /var premia = !controIA;/ },
  { nome: 'i turni e il premio di fine passano da `premia`',
    prova: /var xpTurni = premia \? \(XP_PER_TURNO \* turni\) : 0;/ },
  { nome: 'il rank pure',
    prova: /if \(premia && !pari && conclusa\) \{/ },
  { nome: 'e l-inchiostro e la bustina non si scrivono nemmeno',
    prova: /if \(premia\) \{[\s\S]{0,200}?leggiPossesso/ },
];
for (const g of guardie) {
  const buono = g.prova.test(src);
  if (!buono) ko++;
  console.log('  ' + (buono ? 'ok    ' : 'ROTTA ') + g.nome);
}

// E le tre strade che scrivono l'esito devono passare il modo e i turni.
console.log('\nCHI SCRIVE L-ESITO LO DICE COM-E- FINITA\n');
const strade = [
  { nome: 'la fine normale', prova: /applicaEsito\(nk, u, suo, pari, false, state\.turniGiocati\[u\], 'finita'\)/ },
  { nome: 'la resa', prova: /suo \? 'finita' : 'resa'/ },
  { nome: 'l-abbandono', prova: /uscito \? 'uscito' : 'resta'/ },
  { nome: 'la partita contro l-IA', prova: /dati\.turni, 'finita'/ },
  { nome: 'e i turni li conta il server, non il client', prova: /state\.turniGiocati\[chi\] = \(state\.turniGiocati\[chi\] \|\| 0\) \+ 1/ },
];
for (const s of strade) {
  const buono = s.prova.test(src);
  if (!buono) ko++;
  console.log('  ' + (buono ? 'ok    ' : 'ROTTA ') + s.nome);
}

console.log('\n' + (ko ? 'FALLITO: ' + ko : 'OK: una partita vale il tempo speso piu- come e- finita'));
process.exit(ko ? 1 : 0);
