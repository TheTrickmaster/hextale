// ══════════════════════════════════════════════════════════════════════════
// IL MOTORE DELLE ABILITA' — scritto una volta, eseguito in due posti
// ══════════════════════════════════════════════════════════════════════════
// Legge l'abilita' STRUTTURATA che il parser ha messo nel catalogo
// (vedi server/importazione/abilita-parser.js) e risponde alle domande che il
// gioco fa: questa carta si puo' conquistare? con che valore attacca? questo
// lato e' protetto?
//
// PERCHE' UN FILE SOLO. Le stesse regole devono dare la stessa risposta sul
// computer di chi gioca e sul server, altrimenti i due vedono due partite
// diverse — ed e' esattamente cio' che l'impronta della v0.77.55 sorprende e
// punisce fermando la partita. Due copie dello stesso codice divergono: questa
// viene INIETTATA in tutti e due (vedi inietta-motore.js), e chi la modifica
// la modifica per entrambi.
//
// PERCHE' ES5. Il runtime JavaScript di Nakama e' goja: niente `let`, niente
// funzioni a freccia, niente destrutturazione. Il prezzo e' qualche `var` di
// troppo; il guadagno e' che lo stesso file gira in tutti e due i posti senza
// una compilazione in mezzo.

// Un `var` al posto di un assegnamento al globale: cosi' lo stesso testo vale
// come variabile di modulo dentro a index.js (goja), come globale dentro allo
// script del gioco, e come esportazione sotto Node. Tre posti, un involucro.
var ABILITA_MOTORE = (function () {
  'use strict';

  var SEI_LATI = ['NW', 'NE', 'E', 'SE', 'SW', 'W'];

  // L'abilita' di una carta, se ce l'ha e se e' sbloccata dal livello.
  // Il livello di sblocco e' la stessa regola di prima: sotto quel livello
  // l'abilita' si vede sulla carta ma non agisce.
  function abilitaDi(carta) {
    if (!carta) return null;
    if (carta.abilityLocked) return null;
    var a = carta.abilita;
    if (!a || a.unica) return null;
    return a;
  }

  // La regola di una carta, per nome. Torna l'oggetto regola o null.
  // Guarda tutti e due i posti: una carta puo' avere una regola e un effetto,
  // o due regole.
  function regolaDi(carta, nome) {
    var a = abilitaDi(carta);
    if (!a) return null;
    if (a.regola && a.regola.nome === nome) return a.regola;
    if (a.regola2 && a.regola2.nome === nome) return a.regola2;
    return null;
  }

  function haTratto(carta, elenco) {
    if (!carta || !elenco || !elenco.length) return false;
    var suoi = carta.traitNames || carta.traits || [];
    var i, j;
    for (i = 0; i < elenco.length; i++) {
      for (j = 0; j < suoi.length; j++) {
        if (String(suoi[j]).toLowerCase() === String(elenco[i]).toLowerCase()) return true;
      }
    }
    return false;
  }

  // Il valore piu' alto e piu' basso fra i sei lati.
  function estremo(valori, alto) {
    var v = null, i, x;
    for (i = 0; i < SEI_LATI.length; i++) {
      x = (valori && valori[SEI_LATI[i]]) || 0;
      if (v === null) v = x;
      else if (alto ? x > v : x < v) v = x;
    }
    return v === null ? 0 : v;
  }

  // ── LA CONDIZIONE ───────────────────────────────────────────────────────
  // `scena` porta chi sono i protagonisti del momento: attaccante, difensore,
  // e il tabellone. Una condizione che parla di qualcuno che in quel momento
  // non c'e' e' falsa, non un errore: "se chi attacca e' nobile" non vale
  // niente quando nessuno sta attaccando.
  function condizioneVera(cond, carta, scena) {
    if (!cond) return true;
    scena = scena || {};
    var sog = cond.soggetto, chi = null;
    if (sog === 'self') chi = carta;
    else if (sog === 'attacker') chi = scena.attaccante;
    else if (sog === 'defender') chi = scena.difensore;
    else if (sog === 'target') chi = scena.bersaglio;
    else if (sog === 'adjacent') chi = null;      // si guarda l'elenco, sotto
    var v = cond.valore || {};

    if (cond.test === 'has_trait') {
      if (sog === 'adjacent') {
        var vic = scena.adiacenti || [];
        for (var i = 0; i < vic.length; i++) if (haTratto(vic[i], v.tratti)) return true;
        return false;
      }
      if (sog === 'board') {
        var tut = scena.inCampo || [];
        for (var j = 0; j < tut.length; j++) if (haTratto(tut[j], v.tratti)) return true;
        return false;
      }
      return haTratto(chi, v.tratti);
    }
    if (cond.test === 'is_character') {
      if (!chi) return false;
      return String(chi.numeroFoglio || chi.idFoglio || '') === String(v.carta);
    }
    if (cond.test === 'power_is') {
      if (!chi) return false;
      var p = scena.valoreAttacco;
      if (typeof p !== 'number') return false;
      var dispari = (p % 2) !== 0;
      return v.parita === 'odd' ? dispari : !dispari;
    }
    if (cond.test === 'power_diff_at_least') {
      if (typeof scena.differenza !== 'number') return false;
      return scena.differenza >= v.numero;
    }
    if (cond.test === 'on_edge') return !!scena.sulBordo;
    if (cond.test === 'did_not_conquer') return scena.haConquistato === false;
    if (cond.test === 'chance') return true;      // il caso si tira quando serve, non qui
    if (cond.test === 'free_sides_at_least') {
      return (scena.latiLiberi || 0) >= v.numero;
    }
    if (cond.test === 'count_at_least') {
      return (scena.quanti || 0) >= v.numero;
    }
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LE DOMANDE CHE IL GIOCO FA
  // ══════════════════════════════════════════════════════════════════════════

  // Non si tocca in nessun modo: ne' conquistata, ne' spostata, ne' distrutta.
  function intoccabile(carta) {
    return !!regolaDi(carta, 'invincible');
  }

  // Quel lato non cade, qualunque numero gli si punti contro.
  function latoProtetto(carta, lato, valori) {
    var r = regolaDi(carta, 'side_protected');
    if (!r) return false;
    var v = String(r.valore || '').toLowerCase();
    var vals = valori || carta.values || {};
    if (v === 'highest') return (vals[lato] || 0) === estremo(vals, true);
    if (v === 'lowest') return (vals[lato] || 0) === estremo(vals, false);
    return false;
  }

  // Chi puo' conquistare questa carta. La condizione parla dell'ATTACCANTE, ed
  // e' l'unica regola che guarda chi agisce invece di chi subisce.
  function conquistabileDa(difensore, attaccante, scena) {
    var solo = regolaDi(difensore, 'conquerable_only_if');
    if (solo) {
      var a = abilitaDi(difensore);
      var cond = (a.regola && a.regola.nome === 'conquerable_only_if') ? a.se : a.se2;
      if (!condizioneVera(cond, difensore, _conScena(scena, attaccante, difensore))) return false;
    }
    var mai = regolaDi(difensore, 'not_conquerable_if');
    if (mai) {
      var a2 = abilitaDi(difensore);
      var cond2 = (a2.regola && a2.regola.nome === 'not_conquerable_if') ? a2.se : a2.se2;
      if (condizioneVera(cond2, difensore, _conScena(scena, attaccante, difensore))) return false;
    }
    return true;
  }

  function _conScena(scena, attaccante, difensore) {
    var s = {};
    for (var k in (scena || {})) if (Object.prototype.hasOwnProperty.call(scena, k)) s[k] = scena[k];
    s.attaccante = attaccante;
    s.difensore = difensore;
    return s;
  }

  // Con che valore attacca: il lato che tocca, o il piu' alto se una regola lo
  // dice (Merlin).
  function valoreDiAttacco(carta, valori, lato) {
    var r = regolaDi(carta, 'attacks_with');
    var vals = valori || carta.values || {};
    if (r) {
      var v = String(r.valore || '').toLowerCase();
      if (v === 'highest') return estremo(vals, true);
      if (v === 'lowest') return estremo(vals, false);
    }
    return vals[lato] || 0;
  }

  // Vince il confronto? Di norma serve un valore piu' alto; una regola puo'
  // accontentarsi del pari (Shere Khan).
  function vince(attaccante, valoreAttacco, valoreDifesa) {
    var r = regolaDi(attaccante, 'conquers_when');
    if (r && String(r.valore || '').toLowerCase() === 'equal_or_higher') {
      return valoreAttacco >= valoreDifesa;
    }
    return valoreAttacco > valoreDifesa;
  }

  // Si puo' calare su una casella bloccata? (Peter Pan)
  function giocabileSuBloccata(carta) {
    var r = regolaDi(carta, 'playable_on');
    return !!(r && String(r.valore || '').toLowerCase() === 'blocked');
  }

  // Le carte adiacenti a chi ha questa regola non subiscono effetti. (Bagheera)
  function rendeImmuniIVicini(carta) {
    var r = regolaDi(carta, 'immune');
    return !!(r && r.bersaglio === 'adjacent');
  }

  var MOTORE = {
    SEI_LATI: SEI_LATI,
    abilitaDi: abilitaDi,
    regolaDi: regolaDi,
    haTratto: haTratto,
    estremo: estremo,
    condizioneVera: condizioneVera,
    intoccabile: intoccabile,
    latoProtetto: latoProtetto,
    conquistabileDa: conquistabileDa,
    valoreDiAttacco: valoreDiAttacco,
    vince: vince,
    giocabileSuBloccata: giocabileSuBloccata,
    rendeImmuniIVicini: rendeImmuniIVicini
  };

  return MOTORE;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ABILITA_MOTORE;
