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

  // ══════════════════════════════════════════════════════════════════════
  // GLI EFFETTI CONTINUI
  // ══════════════════════════════════════════════════════════════════════
  // Le sinergie: "+1 ALL per ogni Small in campo", "+2 ALL ai Wild adiacenti".
  // Non si APPLICANO e basta: si RICALCOLANO dallo stato del tabellone ogni
  // volta che il tabellone cambia.
  //
  // PERCHE' RICALCOLARE invece di sommare e sottrarre. Il sistema vecchio
  // teneva un'istantanea dei valori per ogni sinergia (hoorayBaseValues,
  // mischiefBaseValues, nightmareBaseValues, balooBaseValues) e ogni funzione
  // che toccasse un valore doveva ricordarsi di spostare TUTTE le istantanee,
  // o quella sinergia avrebbe riportato la carta indietro al ridisegno dopo.
  // Bastava aggiungere una sinergia e dimenticare una riga. Qui non c'e'
  // niente da ricordare: si parte dai valori base e si risomma tutto.

  // Quali lati tocca un effetto, dato il suo ambito.
  // RAND merita una parola: un lato "a caso" che cambia a ogni ricalcolo
  // sfarfallerebbe, e in rete i due giocatori vedrebbero lati diversi. Si
  // sceglie quindi in modo RIPETIBILE, dal nome della carta e da un seme che
  // vale per tutta la partita: casuale da fuori, identico sui due schermi.
  function _semeDi(testo) {
    var h = 2166136261, i;
    for (i = 0; i < testo.length; i++) { h ^= testo.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h;
  }
  function latiColpiti(ambito, valori, carta, seme) {
    if (ambito === 'ALL' || !ambito) return SEI_LATI.slice();
    if (ambito === 'HIGHEST' || ambito === 'LOWEST') {
      var cerca = estremo(valori, ambito === 'HIGHEST');
      var out = [], i;
      for (i = 0; i < SEI_LATI.length; i++) if ((valori[SEI_LATI[i]] || 0) === cerca) out.push(SEI_LATI[i]);
      return out.length ? [out[0]] : [];
    }
    if (ambito === 'RAND' || ambito === 'ONE') {
      var chiave = String((carta && (carta.id || carta.name)) || '?') + '|' + String(seme || '');
      return [SEI_LATI[_semeDi(chiave) % SEI_LATI.length]];
    }
    return SEI_LATI.slice();
  }

  function _stessoPadrone(a, b) {
    return a && b && a.owner !== undefined && b.owner !== undefined && a.owner === b.owner;
  }

  // L'effetto della FONTE colpisce il BERSAGLIO?
  function colpisce(fonte, eff, bersaglio, scena) {
    var chi = eff.chi, dove = eff.dove;
    if (chi === 'self') return bersaglio === fonte;
    if (!bersaglio) return false;
    if (chi === 'ally' && !_stessoPadrone(fonte, bersaglio)) return false;
    if (chi === 'opponent' && _stessoPadrone(fonte, bersaglio)) return false;
    // "any" non guarda il padrone.
    if (dove === 'adjacent') {
      var vic = (scena.vicini && scena.vicini(fonte)) || [];
      for (var i = 0; i < vic.length; i++) if (vic[i] === bersaglio) return true;
      return false;
    }
    if (dove === 'board' || !dove) return bersaglio !== fonte || chi === 'self';
    return false;
  }

  // Quanto vale l'effetto: il numero scritto, moltiplicato per il conteggio
  // quando la colonna Per dice di scalare.
  function quantita(fonte, eff, cond, scena) {
    var base = 0;
    if (eff.quanto && typeof eff.quanto.numero === 'number') base = eff.quanto.numero;
    else if (eff.quanto && typeof eff.quanto.da === 'number') base = eff.quanto.da;
    if (!eff.per) return base;

    var tratti = (cond && cond.valore && cond.valore.tratti) || [];
    var quanti = 0, i;
    if (eff.per === 'board_trait') {
      var tutte = scena.inCampo || [];
      for (i = 0; i < tutte.length; i++) {
        if (tutte[i] === fonte) continue;              // "ogni ALTRO": mai se stessa
        if (haTratto(tutte[i], tratti)) quanti++;
      }
    } else if (eff.per === 'adjacent_trait') {
      var vic = (scena.vicini && scena.vicini(fonte)) || [];
      for (i = 0; i < vic.length; i++) if (haTratto(vic[i], tratti)) quanti++;
    } else if (eff.per === 'hand_trait') {
      var mano = scena.inMano || [];
      for (i = 0; i < mano.length; i++) if (haTratto(mano[i], tratti)) quanti++;
    } else if (eff.per === 'free_side') {
      quanti = (scena.latiLiberi && scena.latiLiberi(fonte)) || 0;
    } else if (eff.per === 'power_diff') {
      quanti = (typeof scena.differenza === 'number') ? scena.differenza : 0;
    }
    return base * quanti;
  }

  // Lo scarto totale che le sinergie in campo fanno su UNA carta.
  // Torna un oggetto lato -> numero (anche negativo).
  function deltaContinuo(bersaglio, scena) {
    scena = scena || {};
    var d = {}, i;
    for (i = 0; i < SEI_LATI.length; i++) d[SEI_LATI[i]] = 0;
    var fonti = scena.inCampo || [];
    for (i = 0; i < fonti.length; i++) {
      var fonte = fonti[i];
      var a = abilitaDi(fonte);
      if (!a || a.trigger !== 'while_on_board') continue;
      _unEffetto(fonte, a.effetto, a.se, bersaglio, scena, d);
      if (a.legame === 'and' || a.legame === 'instead') {
        // "instead" e' un'eccezione: se la seconda condizione vale, la prima
        // non si applica a QUEL bersaglio. Si guarda percio' la seconda prima.
        var vale2 = a.effetto2 && condizioneVera(a.se2, fonte, _scenaPer(fonte, bersaglio, scena));
        if (a.legame === 'instead' && vale2) {
          // si toglie quel che ha messo la prima e si mette la seconda
          _unEffetto(fonte, a.effetto, a.se, bersaglio, scena, d, -1);
        }
        _unEffetto(fonte, a.effetto2, a.se2, bersaglio, scena, d);
      }
    }
    return d;
  }

  function _scenaPer(fonte, bersaglio, scena) {
    var s = {};
    for (var k in scena) if (Object.prototype.hasOwnProperty.call(scena, k)) s[k] = scena[k];
    s.bersaglio = bersaglio;
    s.adiacenti = (scena.vicini && scena.vicini(fonte)) || [];
    return s;
  }

  function _unEffetto(fonte, eff, cond, bersaglio, scena, d, segno) {
    if (!eff) return;
    if (eff.durata !== 'while_true') return;
    if (eff.azione !== 'buff' && eff.azione !== 'debuff') return;
    if (eff.cosa && eff.cosa !== 'power') return;
    if (!colpisce(fonte, eff, bersaglio, scena)) return;
    if (!condizioneVera(cond, fonte, _scenaPer(fonte, bersaglio, scena))) return;
    var q = quantita(fonte, eff, cond, scena);
    if (!q) return;
    if (eff.azione === 'debuff') q = -q;
    if (segno === -1) q = -q;
    var lati = latiColpiti(eff.ambito, bersaglio.values || {}, bersaglio, scena.seme);
    for (var i = 0; i < lati.length; i++) d[lati[i]] += q;
  }

  // I valori di una carta con le sinergie gia' dentro.
  function valoriEffettivi(carta, scena) {
    // La base sono i valori al netto delle sinergie: valoriBase se la carta
    // ce l'ha (la muovono gli effetti permanenti), altrimenti quelli correnti.
    var base = (carta && (carta.valoriBase || carta.values)) || {};
    var d = deltaContinuo(carta, scena);
    var out = {}, i, l;
    for (i = 0; i < SEI_LATI.length; i++) {
      l = SEI_LATI[i];
      out[l] = Math.max(0, (base[l] || 0) + (d[l] || 0));
    }
    return out;
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
    rendeImmuniIVicini: rendeImmuniIVicini,
    latiColpiti: latiColpiti,
    colpisce: colpisce,
    quantita: quantita,
    deltaContinuo: deltaContinuo,
    valoriEffettivi: valoriEffettivi
  };

  return MOTORE;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ABILITA_MOTORE;
