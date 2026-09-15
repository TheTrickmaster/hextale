// LA COLONNA "PER VALUE" (v0.80.27).
//
//     node strumenti/prova-per-value.js
//
// Lorenzo: "Ho aggiunto la colonna per value nello sheet. Aggiorna il file
// reimporta con la nuova colonna, implementa la nuova meccanica". Mowgli: "Gives
// +1 RAND to Small characters for each Explorer on the board". Qui:
//   1. il parser (quello che usa la reimportazione, via converti.js) chiede la
//      colonna "Per value" e la legge nell'effetto come { tratti };
//   2. "Per value 2" e' facoltativa: se il foglio non ce l'ha, si legge vuota;
//   3. una riga scritta male si ferma: Per value con un Per che non conta tratti,
//      o senza Per, o con un tratto che non esiste;
//   4. il motore conta il tratto di Per value (gli Explorer), non quello della
//      condizione (i Small); vuota, conta quello della condizione come prima;
//   5. il motore iniettato nel gioco e nel server e' quello nuovo;
//   6. il riassunto (Complete script) nomina il tratto contato.
const fs = require('fs');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const P = require(path.join(RADICE, 'server', 'importazione', 'abilita-parser.js'));
const M = require(path.join(RADICE, 'server', 'nakama', 'abilita-motore.js'));

let male = 0;
const dice = (ok, che, perche) => {
  if (!ok) male++;
  console.log((ok ? '  ok   ' : '  NO   ') + che);
  if (!ok && perche !== undefined) console.log('        ' + perche);
};

// ── 1. il parser ──────────────────────────────────────────────────────────
dice(P.COLONNE.indexOf('Per value') === P.COLONNE.indexOf('Per') + 1, 'COLONNE ha "Per value" subito dopo "Per"');
const intestazione = ['Name'].concat(P.COLONNE);
const riga = (valori) => intestazione.map(c => (c in valori ? valori[c] : '-'));
const MOWGLI = {
  Name: 'Mowgli', 'Is unique': 'No', Trigger: 'while_on_board', Frequency: 'every_time', Window: 'always',
  'If subject': 'target', 'If test': 'has_trait', 'If value': 'Small', 'Player selection': 'no',
  Action: 'buff', Who: 'ally', Where: 'board', What: 'power', Which: 'all', Scope: 'RAND', Amount: '1',
  Per: 'board_trait', 'Per value': 'Explorer', Duration: 'while_true', Link: '-'
};
const leggi = P.lettoreDi(intestazione);
const ab = P.abilitaDaRiga('Mowgli', leggi(riga(MOWGLI)));
dice(ab && ab.effetto && ab.effetto.per === 'board_trait' && ab.effetto.perValore && JSON.stringify(ab.effetto.perValore.tratti) === '["Explorer"]', 'Mowgli: per board_trait, perValore Explorer', JSON.stringify(ab && ab.effetto));
dice(ab && ab.se && JSON.stringify(ab.se.valore.tratti) === '["Small"]', 'e la condizione resta sui Small', JSON.stringify(ab && ab.se));
const snow = P.abilitaDaRiga('Snow White', leggi(riga(Object.assign({}, MOWGLI, { 'If subject': 'self', 'Per value': '-' }))));
dice(snow && snow.effetto.perValore === null, 'Per value vuota: niente perValore (si conta il tratto della condizione)');

// ── 2. Per value 2 facoltativa ───────────────────────────────────────────
let posto = null;
try { posto = P.posizioni(intestazione); } catch (e) { posto = e.message; }
dice(posto && typeof posto === 'object' && posto['Per value 2'] === undefined, 'senza "Per value 2" nel foglio non si ferma niente', typeof posto === 'string' ? posto : '');
const conDue = intestazione.concat(['Per value 2']);
const posto2 = P.posizioni(conDue);
dice(posto2['Per value 2'] === conDue.length - 1, 'e se c-e- la trova');
let senza = '';
try { P.posizioni(intestazione.filter(c => c !== 'Per value')); } catch (e) { senza = e.message; }
dice(/mancano le colonne: Per value/.test(senza), 'senza "Per value" il foglio si ferma, e lo dice', senza);

// ── 3. righe scritte male ────────────────────────────────────────────────
const sbaglia = (valori) => { try { P.abilitaDaRiga('Prova', leggi(riga(Object.assign({}, MOWGLI, valori)))); return ''; } catch (e) { return e.message; } };
dice(/non conta un tratto/.test(sbaglia({ Per: 'free_side' })), 'Per value con un Per che non conta tratti: si ferma', sbaglia({ Per: 'free_side' }));
dice(/nessun "Per"/.test(sbaglia({ Per: '-' })), 'Per value senza Per: si ferma', sbaglia({ Per: '-' }));
dice(sbaglia({ 'Per value': 'Explorers' }) !== '', 'un tratto che non esiste: si ferma', sbaglia({ 'Per value': 'Explorers' }));
dice(/nessuna azione/.test(sbaglia({ Action: '-', Who: '-', Where: '-', What: '-', Which: '-', Scope: '-', Amount: '-', Per: '-', Duration: '-' })), 'Per value su una riga senza azione: si ferma');

// ── 4. il motore conta il tratto giusto ──────────────────────────────────
const carta = (nome, tratti) => ({ id: nome, name: nome, traitNames: tratti });
const mowgli = carta('mowgli', ['Explorer']);
const inCampo = [mowgli, carta('a', ['Explorer']), carta('b', ['Explorer', 'Wild']), carta('c', ['Small']), carta('d', ['Small']), carta('e', ['Small']), carta('f', ['Noble'])];
const scena = { inCampo: inCampo };
dice(M.quantita(mowgli, ab.effetto, ab.se, scena) === 2, 'Mowgli con due altri Explorer e tre Small: +2 (conta gli Explorer, non se stesso)', M.quantita(mowgli, ab.effetto, ab.se, scena));
dice(M.quantita(mowgli, snow.effetto, snow.se, scena) === 3, 'senza Per value si contano i Small della condizione, come prima', M.quantita(mowgli, snow.effetto, snow.se, scena));
const vicini = P.abilitaDaRiga('Prova', leggi(riga(Object.assign({}, MOWGLI, { Per: 'adjacent_trait' }))));
dice(M.quantita(mowgli, vicini.effetto, vicini.se, { vicini: () => [inCampo[1], inCampo[3]] }) === 1, 'anche con adjacent_trait', M.quantita(mowgli, vicini.effetto, vicini.se, { vicini: () => [inCampo[1], inCampo[3]] }));
dice(M.condizioneVera(ab.se, mowgli, { bersaglio: inCampo[3] }) && !M.condizioneVera(ab.se, mowgli, { bersaglio: inCampo[1] }), 'e il buff va solo ai Small (la condizione sul bersaglio)');

// ── 4b. Tin Woodman: Per adjacent_card e Scope per lati ──────────────────
// Lorenzo: "sul valore zero prende +2 per ogni carta adiacente alleata o
// nemica ... su Scope ho messo i lati da cambiare (SE-SW)".
dice(P.VOCE.Per.indexOf('adjacent_card') >= 0, 'Per ammette adjacent_card');
const TIN = {
  Name: 'Tin Woodman', 'Is unique': 'No', Trigger: 'on_play', Frequency: 'every_time', Window: 'always',
  'Player selection': 'no', Action: 'buff', Who: 'self', What: 'power', Scope: 'SE-SW', Amount: '2', Per: 'adjacent_card', Link: '-'
};
const tin = P.abilitaDaRiga('Tin Woodman', leggi(riga(TIN)));
dice(tin && tin.effetto.ambito === 'SE-SW' && tin.effetto.per === 'adjacent_card' && tin.effetto.perValore === null, 'Tin Woodman: ambito SE-SW, per adjacent_card', JSON.stringify(tin && tin.effetto));
dice(P.abilitaDaRiga('Prova', leggi(riga(Object.assign({}, TIN, { Scope: 'E' })))).effetto.ambito === 'E', 'un lato solo si scrive col suo nome');
dice(P.abilitaDaRiga('Prova', leggi(riga(Object.assign({}, TIN, { Scope: 'RAND' })))).effetto.ambito === 'RAND', 'e le parole di prima restano');
const tinMale = (valori) => { try { P.abilitaDaRiga('Prova', leggi(riga(Object.assign({}, TIN, valori)))); return ''; } catch (e) { return e.message; } };
dice(/forse "SE"/.test(tinMale({ Scope: 'se-SW' })), 'un lato in minuscolo: si ferma e suggerisce', tinMale({ Scope: 'se-SW' }));
dice(/non e' un lato/.test(tinMale({ Scope: 'SE-S' })), 'un lato che non esiste: si ferma', tinMale({ Scope: 'SE-S' }));
dice(/due volte/.test(tinMale({ Scope: 'SE-SE' })), 'un lato ripetuto: si ferma', tinMale({ Scope: 'SE-SE' }));
dice(/forse intendevi "RAND"/.test(tinMale({ Scope: 'rand' })), 'e una parola in minuscolo si ferma come prima', tinMale({ Scope: 'rand' }));
dice(/non conta un tratto/.test(tinMale({ 'Per value': 'Explorer' })), 'Per value con adjacent_card: si ferma (non conta tratti)', tinMale({ 'Per value': 'Explorer' }));
const valoriTin = { NW: 5, NE: 6, E: 7, SE: 0, SW: 0, W: 9 };
dice(JSON.stringify(M.latiColpiti('SE-SW', valoriTin, { id: 't' }, 's')) === '["SE","SW"]', 'il motore tocca SE e SW, e nient-altro', JSON.stringify(M.latiColpiti('SE-SW', valoriTin, { id: 't' }, 's')));
dice(M.latiColpiti('ALL', valoriTin, { id: 't' }, 's').length === 6 && M.latiColpiti('HIGHEST', valoriTin, { id: 't' }, 's').join() === 'W', 'ALL e HIGHEST come prima');
const amico = { id: 'a', owner: 0 }, nemico = { id: 'b', owner: 1 }, altro = { id: 'c', owner: 1 };
const cartaTin = { id: 'tin', owner: 0, name: 'Tin Woodman', abilita: tin, values: valoriTin };
dice(M.quantita(cartaTin, tin.effetto, null, { vicini: () => [amico, nemico, altro] }) === 6, 'tre carte accanto (una alleata, due nemiche): +6', M.quantita(cartaTin, tin.effetto, null, { vicini: () => [amico, nemico, altro] }));
dice(M.quantita(cartaTin, tin.effetto, null, { vicini: () => [] }) === 0, 'nessuna carta accanto: +0');
const scattoTin = M.cambiamentiAllEvento(cartaTin, 'on_play', { vicini: () => [amico, nemico], inCampo: [cartaTin, amico, nemico], cellaDi: () => '0,0' });
const pezzoTin = scattoTin.find(x => x && x.lati);
dice(pezzoTin && JSON.stringify(pezzoTin.lati) === '["SE","SW"]' && /(^|[^0-9])4([^0-9]|$)/.test(JSON.stringify(pezzoTin, (k, v) => (k === 'fonte' || k === 'carta') ? undefined : v)), 'giocato con due carte accanto: +4 su SE e SW', JSON.stringify(scattoTin, (k, v) => (k === 'fonte' || k === 'carta' || k === 'abilita') ? undefined : v));

// ── 5. il motore iniettato ────────────────────────────────────────────────
const gioco = fs.readFileSync(path.join(RADICE, 'play', 'index.html'), 'utf8');
const modulo = fs.readFileSync(path.join(RADICE, 'server', 'nakama', 'index.js'), 'utf8');
dice(gioco.indexOf('eff.perValore && eff.perValore.tratti') >= 0 && modulo.indexOf('eff.perValore && eff.perValore.tratti') >= 0, 'il motore nel gioco e nel server e- quello nuovo (inietta-motore.js)');
dice(gioco.indexOf("eff.per === 'adjacent_card'") >= 0 && modulo.indexOf("eff.per === 'adjacent_card'") >= 0 && gioco.indexOf('function latiNominati') >= 0 && modulo.indexOf('function latiNominati') >= 0, 'e sa di adjacent_card e dei lati per nome');

// ── 6. il riassunto ──────────────────────────────────────────────────────
const riepiloghi = fs.readFileSync(path.join(RADICE, 'server', 'importazione', 'rigenera-riepiloghi.js'), 'utf8');
dice(/e\.perValore\.tratti\.join/.test(riepiloghi), 'il riassunto nomina il tratto contato');
const vocabolario = fs.readFileSync(path.join(RADICE, 'server', 'importazione', 'vocabolario-abilita.md'), 'utf8');
dice(/\*\*`Per value`\*\*/.test(vocabolario), 'e il vocabolario la documenta');

console.log(String.fromCharCode(10) + (male ? male + ' NO' : 'tutto a posto'));
process.exit(male ? 1 : 0);
