// ══════════════════════════════════════════════════════════════════════════
// IL PARSER DELLE ABILITA'
// ══════════════════════════════════════════════════════════════════════════
// Legge le 37 colonne del blocco abilita' del foglio e ne fa un oggetto.
// Gira UNA VOLTA SOLA, durante l'importazione: al gioco e al server arriva
// l'abilita' gia' strutturata e gia' verificata, e nessuno dei due deve
// interpretare del testo. E' la ragione per cui questo file puo' permettersi
// di essere severo — sbagliare qui costa un errore all'importazione, sbagliare
// piu' avanti costa una partita.
//
// RIFIUTA RUMOROSAMENTE. Una riga che non si capisce ferma l'importazione
// dicendo carta e colonna. Il gioco ha gia' pagato la lezione opposta: le
// abilita' bloccate dal livello non facevano niente in silenzio, e il guasto
// si scopriva giocando.

'use strict';

var VUOTO = '-';

// ── il vocabolario ───────────────────────────────────────────────────────
// Ogni colonna, i termini che accetta. Il minuscolo e' la regola; l'unica
// eccezione voluta e' Scope, che resta maiuscolo perche' e' la stessa
// notazione con cui le abilita' sono scritte sulle carte ("+2 ALL").
var VOCE = {
  'Is unique': ['No', 'Yes'],
  'Trigger': ['on_play', 'on_conquer', 'on_conquered', 'on_destroyed', 'on_drawn',
              'on_moved', 'while_in_hand', 'while_on_board', 'start_of_turn',
              'end_of_turn', 'always'],
  'Frequency': ['once_per_game', 'once_per_turn', 'every_time'],
  'Window': ['always', 'from_turn', 'until_turn', 'for_turns', 'next_only'],
  'If subject': ['self', 'target', 'attacker', 'defender', 'adjacent', 'board',
                 'hand', 'turn', 'position'],
  'If test': ['has_trait', 'is_character', 'on_edge', 'adjacent_to', 'count_at_least',
              'power_diff_at_least', 'power_is', 'free_sides_at_least',
              'did_not_conquer', 'chance'],
  'Rule': ['invincible', 'conquerable_only_if', 'not_conquerable_if', 'side_protected',
           'conquers_when', 'playable_on', 'attacks_with', 'immune'],
  'Rule target': ['self', 'adjacent', 'ally', 'opponent'],
  'Action': ['buff', 'debuff', 'set', 'rotate', 'shuffle', 'hide', 'swap', 'move',
             'destroy', 'summon', 'transform', 'copy', 'steal', 'draw', 'discard',
             'freeze', 'protect', 'flip', 'cancel'],
  'Who': ['self', 'ally', 'opponent', 'any', 'attacker', 'attacked'],
  'Where': ['adjacent', 'board', 'in_hand', 'edge', 'drawn', 'deck'],
  'What': ['card', 'side', 'power', 'trait', 'ability', 'position', 'tile'],
  'Which': ['all', 'single', 'random', 'selected', 'highest', 'lowest', 'free',
            'blocked', 'next', 'last'],
  'Scope': ['ALL', 'RAND', 'HIGHEST', 'LOWEST', 'ONE'],
  'Per': ['adjacent_trait', 'board_trait', 'hand_trait', 'free_side', 'power_diff'],
  'Duration': ['permanent', 'end_of_turn', 'n_turns', 'while_true'],
  'Link': ['and', 'or', 'instead', 'if']
};

// I tratti che una carta puo' avere. Un filtro su un tratto che non esiste e'
// un refuso, e un refuso qui vuol dire un'abilita' che non scatta mai.
var TRATTI = ['Artisan', 'Chaotic', 'Cruel', 'Explorer', 'Guardian', 'Magical',
              'Noble', 'Princess', 'Small', 'Sovereign', 'Trickster', 'Wild'];

// Le colonne del blocco, nell'ordine in cui stanno nel foglio.
var COLONNE = [
  'Is unique',
  'Trigger', 'Frequency', 'Window', 'Window value',
  'If subject', 'If test', 'If value',
  'Rule', 'Rule target', 'Rule value',
  'Action', 'Who', 'Where', 'What', 'Which', 'Scope', 'Amount', 'Per', 'Duration',
  'Link',
  'If subject 2', 'If test 2', 'If value 2',
  'Rule 2', 'Rule target 2', 'Rule value 2',
  'Action 2', 'Who 2', 'Where 2', 'What 2', 'Which 2', 'Scope 2', 'Amount 2', 'Per 2', 'Duration 2',
  'Complete script'
];

function _vuoto(v) {
  return v === undefined || v === null || String(v).trim() === '' || String(v).trim() === VUOTO;
}
function _pulito(v) { return String(v === undefined || v === null ? '' : v).trim(); }

// ── i controlli ──────────────────────────────────────────────────────────
function Guasto(carta, colonna, motivo) {
  var e = new Error('"' + carta + '", colonna "' + colonna + '": ' + motivo);
  e.carta = carta; e.colonna = colonna;
  return e;
}

// Un termine del vocabolario. `quale` e' il nome della lista, che per le
// colonne raddoppiate non ha il suffisso (Action 2 usa la lista di Action).
function _termine(carta, colonna, valore, quale, obbligatorio) {
  if (_vuoto(valore)) {
    if (obbligatorio) throw Guasto(carta, colonna, 'e\' obbligatoria e invece e\' vuota');
    return null;
  }
  var v = _pulito(valore);
  var lista = VOCE[quale];
  if (lista.indexOf(v) === -1) {
    // Il caso piu' probabile e' il maiuscolo/minuscolo sbagliato: si dice.
    var vicino = null, i;
    for (i = 0; i < lista.length; i++) {
      if (lista[i].toLowerCase() === v.toLowerCase()) { vicino = lista[i]; break; }
    }
    throw Guasto(carta, colonna, '"' + v + '" non e\' un termine ammesso'
      + (vicino ? ' — forse intendevi "' + vicino + '"?' : '. Ammessi: ' + lista.join(', ')));
  }
  return v;
}

// Un elenco di tratti separati da virgola.
function _tratti(carta, colonna, valore) {
  var pezzi = _pulito(valore).split(',');
  var out = [], i, t, j, vicino;
  for (i = 0; i < pezzi.length; i++) {
    t = pezzi[i].trim();
    if (!t) continue;
    if (TRATTI.indexOf(t) === -1) {
      vicino = null;
      for (j = 0; j < TRATTI.length; j++) if (TRATTI[j].toLowerCase() === t.toLowerCase()) vicino = TRATTI[j];
      throw Guasto(carta, colonna, '"' + t + '" non e\' un tratto del gioco'
        + (vicino ? ' — forse "' + vicino + '"?' : '. Tratti: ' + TRATTI.join(', ')));
    }
    out.push(t);
  }
  if (!out.length) throw Guasto(carta, colonna, 'nessun tratto leggibile in "' + _pulito(valore) + '"');
  return out;
}

// Il valore di una condizione dipende dal test: un tratto, un id, un numero,
// una parita', una percentuale. Controllarlo QUI e' il motivo per cui il resto
// del gioco non dovra' mai chiedersi cosa contiene.
function _valoreCondizione(carta, colonna, test, valore) {
  if (test === null) {
    if (!_vuoto(valore)) throw Guasto(carta, colonna, 'c\'e\' un valore ma non c\'e\' nessun test che lo usi');
    return null;
  }
  var senzaValore = ['on_edge', 'did_not_conquer'];
  if (senzaValore.indexOf(test) !== -1) {
    if (!_vuoto(valore)) throw Guasto(carta, colonna, 'il test "' + test + '" non vuole un valore (lascia "-")');
    return null;
  }
  if (_vuoto(valore)) throw Guasto(carta, colonna, 'il test "' + test + '" vuole un valore e non ce n\'e\'');
  var v = _pulito(valore);
  if (test === 'has_trait') return { tratti: _tratti(carta, colonna, v) };
  if (test === 'is_character') {
    if (!/^#\d+$/.test(v)) throw Guasto(carta, colonna, '"' + v + '" non e\' un id di carta (atteso #000)');
    return { carta: v };
  }
  if (test === 'power_is') {
    if (v !== 'odd' && v !== 'even') throw Guasto(carta, colonna, '"' + v + '" non e\' una parita\' (odd o even)');
    return { parita: v };
  }
  var n = Number(v);
  if (!isFinite(n)) throw Guasto(carta, colonna, '"' + v + '" doveva essere un numero');
  if (test === 'chance' && (n <= 0 || n > 100)) throw Guasto(carta, colonna, 'una percentuale sta fra 1 e 100, non ' + n);
  return { numero: n };
}

// Quanto: un numero, un intervallo, un id di carta, o una parola convenuta.
var PAROLE_QUANTO = ['DIFF', 'owner', 'LOWEST', 'Princess'];
function _quanto(carta, colonna, valore) {
  if (_vuoto(valore)) return null;
  var v = _pulito(valore);
  if (PAROLE_QUANTO.indexOf(v) !== -1) return { parola: v };
  if (/^#\d+$/.test(v)) return { carta: v };
  var m = v.match(/^(\d+)-(\d+)$/);
  if (m) {
    var a = Number(m[1]), b = Number(m[2]);
    if (a > b) throw Guasto(carta, colonna, 'intervallo alla rovescia: ' + v);
    return { da: a, a: b };
  }
  var n = Number(v);
  if (!isFinite(n)) throw Guasto(carta, colonna, '"' + v + '" non e\' un numero, un intervallo (1-3), un id (#143) o una parola nota (' + PAROLE_QUANTO.join(', ') + ')');
  return { numero: n };
}

// ── un effetto ───────────────────────────────────────────────────────────
function _effetto(carta, g, suff) {
  var s = suff ? ' ' + suff : '';
  var azione = _termine(carta, 'Action' + s, g('Action' + s), 'Action', false);
  if (!azione) {
    // Nessuna azione: le altre colonne devono tacere, altrimenti c'e' un
    // effetto scritto a meta' che nessuno eseguirebbe.
    var sporche = [];
    ['Who', 'Where', 'What', 'Which', 'Scope', 'Amount', 'Per'].forEach(function (c) {
      if (!_vuoto(g(c + s))) sporche.push(c + s);
    });
    if (sporche.length) throw Guasto(carta, sporche[0], 'c\'e\' un bersaglio ma non c\'e\' nessuna azione' + (suff ? ' (Action ' + suff + ')' : ' (Action)') + ' che lo usi');
    return null;
  }
  return {
    azione: azione,
    chi: _termine(carta, 'Who' + s, g('Who' + s), 'Who', false),
    dove: _termine(carta, 'Where' + s, g('Where' + s), 'Where', false),
    cosa: _termine(carta, 'What' + s, g('What' + s), 'What', false),
    quale: _termine(carta, 'Which' + s, g('Which' + s), 'Which', false),
    ambito: _termine(carta, 'Scope' + s, g('Scope' + s), 'Scope', false),
    quanto: _quanto(carta, 'Amount' + s, g('Amount' + s)),
    per: _termine(carta, 'Per' + s, g('Per' + s), 'Per', false),
    durata: _termine(carta, 'Duration' + s, g('Duration' + s), 'Duration', false) || 'permanent'
  };
}

// ── una condizione ───────────────────────────────────────────────────────
function _condizione(carta, g, suff) {
  var s = suff ? ' ' + suff : '';
  var sogg = _termine(carta, 'If subject' + s, g('If subject' + s), 'If subject', false);
  var test = _termine(carta, 'If test' + s, g('If test' + s), 'If test', false);
  if (!sogg && !test && _vuoto(g('If value' + s))) return null;
  if (!sogg) throw Guasto(carta, 'If subject' + s, 'c\'e\' un test ma non si sa di CHI parla');
  if (!test) throw Guasto(carta, 'If test' + s, 'c\'e\' un soggetto ma non si sa cosa controllare');
  return { soggetto: sogg, test: test, valore: _valoreCondizione(carta, 'If value' + s, test, g('If value' + s)) };
}

// ── una regola ───────────────────────────────────────────────────────────
function _regola(carta, g, suff) {
  var s = suff ? ' ' + suff : '';
  var nome = _termine(carta, 'Rule' + s, g('Rule' + s), 'Rule', false);
  if (!nome) {
    if (!_vuoto(g('Rule target' + s)) || !_vuoto(g('Rule value' + s)))
      throw Guasto(carta, 'Rule target' + s, 'c\'e\' un bersaglio ma non c\'e\' nessuna regola');
    return null;
  }
  return {
    nome: nome,
    bersaglio: _termine(carta, 'Rule target' + s, g('Rule target' + s), 'Rule target', true),
    valore: _vuoto(g('Rule value' + s)) ? null : _pulito(g('Rule value' + s))
  };
}

// ══════════════════════════════════════════════════════════════════════════
// Da una riga del foglio a un'abilita'. `leggi(colonna)` da' il valore grezzo.
// Torna null se la carta non ha un'abilita'.
// ══════════════════════════════════════════════════════════════════════════
function abilitaDaRiga(nomeCarta, leggi) {
  var g = function (c) { return leggi(c); };
  var unica = _termine(nomeCarta, 'Is unique', g('Is unique'), 'Is unique', false);

  if (unica === 'Yes') {
    // Scritta a mano: si tiene solo l'aggancio, se c'e'.
    return {
      unica: true,
      trigger: _termine(nomeCarta, 'Trigger', g('Trigger'), 'Trigger', false),
      riepilogo: _pulito(g('Complete script'))
    };
  }

  var trigger = _termine(nomeCarta, 'Trigger', g('Trigger'), 'Trigger', false);
  if (!trigger) return null;                       // nessuna abilita' su questa riga

  var finestra = _termine(nomeCarta, 'Window', g('Window'), 'Window', false) || 'always';
  var valoreFinestra = null;
  var vuoleNumero = ['from_turn', 'until_turn', 'for_turns'];
  if (vuoleNumero.indexOf(finestra) !== -1) {
    if (_vuoto(g('Window value'))) throw Guasto(nomeCarta, 'Window value', 'la finestra "' + finestra + '" vuole un numero di turni');
    var nf = Number(_pulito(g('Window value')));
    if (!isFinite(nf) || nf < 1) throw Guasto(nomeCarta, 'Window value', '"' + _pulito(g('Window value')) + '" non e\' un numero di turni');
    valoreFinestra = nf;
  } else if (!_vuoto(g('Window value'))) {
    throw Guasto(nomeCarta, 'Window value', 'la finestra "' + finestra + '" non vuole un numero (lascia "-")');
  }

  var eff1 = _effetto(nomeCarta, g, '');
  var reg1 = _regola(nomeCarta, g, '');
  if (!eff1 && !reg1) throw Guasto(nomeCarta, 'Action', 'c\'e\' un trigger ma l\'abilita\' non fa niente: manca un\'azione o una regola');

  var legame = _termine(nomeCarta, 'Link', g('Link'), 'Link', false);
  var eff2 = _effetto(nomeCarta, g, '2');
  var reg2 = _regola(nomeCarta, g, '2');
  var cond2 = _condizione(nomeCarta, g, '2');
  if (!legame && (eff2 || reg2 || cond2))
    throw Guasto(nomeCarta, 'Link', 'c\'e\' un secondo effetto ma non si sa come si lega al primo (and, or, instead, if)');
  if (legame && !eff2 && !reg2)
    throw Guasto(nomeCarta, 'Link', 'c\'e\' un legame "' + legame + '" ma non c\'e\' nessun secondo effetto');

  return {
    unica: false,
    trigger: trigger,
    frequenza: _termine(nomeCarta, 'Frequency', g('Frequency'), 'Frequency', false) || 'every_time',
    finestra: { tipo: finestra, valore: valoreFinestra },
    se: _condizione(nomeCarta, g, ''),
    regola: reg1,
    effetto: eff1,
    legame: legame,
    se2: cond2,
    regola2: reg2,
    effetto2: eff2,
    riepilogo: _pulito(g('Complete script'))
  };
}

module.exports = { abilitaDaRiga: abilitaDaRiga, COLONNE: COLONNE, VOCE: VOCE, TRATTI: TRATTI, VUOTO: VUOTO };
