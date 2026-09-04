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
    // ── v0.77.67 — LA MONETA LA TIRA IL SERVER ─────────────────────────────
    // Prima questo rispondeva sempre "si", e il caso lo tirava chi eseguiva —
    // con Math.random, cioe' due volte e in modo diverso sui due client: uno
    // vedeva la conquista annullata e l'altro no.
    // Adesso il numero esce dal SEME della partita, che e' l'id assegnato dal
    // server: la moneta la tira lui una volta sola, e i due client leggono lo
    // stesso risultato senza doverselo chiedere a vicenda. Fuori da una
    // partita in rete (contro l'IA) il seme e' quello locale, e va bene lo
    // stesso: li' non c'e' nessuno con cui essere d'accordo.
    if (cond.test === 'chance') {
      var soglia = (v && typeof v.numero === 'number') ? v.numero : 50;
      var chiave = String((chi && (chi.id || chi.name)) || '?') + '|'
        + String((scena && scena.seme) || '') + '|' + String((scena && scena.turno) || 0)
        + '|' + String(cond.soggetto || '');
      return (_semeDi(chiave) % 100) < soglia;
    }
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
  // ── v0.77.91 — L'UNITA' DI UNA CARTA E' IL GRUPPO, NON IL LATO ──────────
  // Una carta di Hextale non ha sei numeri: ha dei GRUPPI di lati, e ogni
  // gruppo porta un numero solo (vedi gruppiDiCarta nel client, e il commento
  // sopra di lei: "chi disegna o ragiona su una carta deve chiamare
  // gruppiDiCarta"). Questa funzione era l'unico posto del gioco che quella
  // regola non la rispettava: per RAND pescava un LATO fra sei, e per
  // HIGHEST/LOWEST ne restituiva uno solo.
  //
  // COSA SUCCEDEVA. Il Genio dice "buff ally in_hand power all RAND 3", e il
  // motore faceva la cosa giusta su chi colpire — tutte le carte in mano — ma
  // poi metteva il +3 su MEZZO gruppo. Il numero che si vede e' quello del
  // primo lato del gruppo, quindi se il lato pescato non era il primo il bonus
  // spariva dalla vista: da fuori sembrava che il Genio buffasse due o tre
  // carte a caso invece di tutte. E non era solo un difetto di disegno — il
  // lato gonfiato combatteva davvero con tre punti in piu', invisibili.
  //
  // Adesso il sorteggio e' fra i GRUPPI, e si colpisce il gruppo intero.
  // ATTENZIONE, E' ANCHE UNA QUESTIONE DI FORZA: un gruppo puo' valere due o
  // tre lati, quindi RAND adesso da' piu' di prima. E' la conseguenza di
  // rispettare il modello della carta, non una scelta di bilanciamento — se il
  // Genio cosi' diventa troppo generoso, il numero si abbassa nel foglio.
  function _gruppiDi(valori, carta) {
    // Se la carta dichiara i propri gruppi, sono quelli e non si discute:
    // due gruppi possono mostrare lo stesso numero e restare distinti.
    var g = carta && carta.groupSides, i;
    if (g && g.length) {
      var copia = [];
      for (i = 0; i < g.length; i++) copia.push(g[i].slice());
      return copia;
    }
    // Senza, si ricavano come fa getGroups nel client: fasce contigue di lati
    // con lo stesso numero, e la fascia finale che si ricongiunge alla prima.
    var out = [], j = 0;
    while (j < SEI_LATI.length) {
      var v = valori[SEI_LATI[j]], k = j;
      while (k < SEI_LATI.length && valori[SEI_LATI[k]] === v) k++;
      out.push(SEI_LATI.slice(j, k));
      j = k;
    }
    if (out.length > 1 && valori[out[out.length - 1][0]] === valori[out[0][0]]) {
      var ultimo = out.pop();
      out[0] = ultimo.concat(out[0]);
    }
    return out;
  }
  function latiColpiti(ambito, valori, carta, seme) {
    if (ambito === 'ALL' || !ambito) return SEI_LATI.slice();
    var gruppi = _gruppiDi(valori || {}, carta), i;
    if (!gruppi.length) return [];
    if (ambito === 'HIGHEST' || ambito === 'LOWEST') {
      var cerca = estremo(valori, ambito === 'HIGHEST');
      // Il primo gruppo che porta quel numero, tutto intero.
      for (i = 0; i < gruppi.length; i++) {
        if ((valori[gruppi[i][0]] || 0) === cerca) return gruppi[i].slice();
      }
      return [];
    }
    if (ambito === 'RAND' || ambito === 'ONE') {
      var chiave = String((carta && (carta.id || carta.name)) || '?') + '|' + String(seme || '');
      return gruppi[_semeDi(chiave) % gruppi.length].slice();
    }
    return SEI_LATI.slice();
  }

  function _stessoPadrone(a, b) {
    return a && b && a.owner !== undefined && b.owner !== undefined && a.owner === b.owner;
  }

  // ── v0.78.18 — DUE CARTE SONO LA STESSA SE HANNO LO STESSO ID ────────────
  // Qui si confrontava per IDENTITA', e va bene finche' gli oggetti sono quelli
  // veri. Ma il gioco fa delle COPIE delle carte — l'anteprima clona il campo,
  // la scheda a schermo intero ricostruisce la carta, la conquista ne passa una
  // con l'owner cambiato — e a una copia il confronto rispondeva "sono due
  // carte diverse".
  // La conseguenza era che una carta si buffava DA SOLA: Little John, appena
  // calato e senza nessuno intorno, si vedeva scritto "+1 ALL from Little
  // John", perche' la copia di se stesso non risultava se stesso e passava per
  // un alleato qualsiasi.
  // Un id e' unico dentro a una partita: e' la stessa carta anche quando non e'
  // lo stesso oggetto.
  function stessaCarta(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    return !!a.id && a.id === b.id;
  }
  // L'effetto della FONTE colpisce il BERSAGLIO?
  function colpisce(fonte, eff, bersaglio, scena) {
    var chi = eff.chi, dove = eff.dove;
    if (chi === 'self') return stessaCarta(bersaglio, fonte);
    if (!bersaglio) return false;
    if (chi === 'ally' && !_stessoPadrone(fonte, bersaglio)) return false;
    if (chi === 'opponent' && _stessoPadrone(fonte, bersaglio)) return false;
    // "any" non guarda il padrone.
    if (dove === 'adjacent') {
      var vic = (scena.vicini && scena.vicini(fonte)) || [];
      for (var i = 0; i < vic.length; i++) if (stessaCarta(vic[i], bersaglio)) return true;
      return false;
    }
    // ── v0.78.15 — "board" E' UN LUOGO, NON "CHIUNQUE" ────────────────────
    // Qui bastava che il bersaglio non fosse la fonte, e non si guardava
    // affatto DOVE si trovasse. Little John dice "buff ally board power": in
    // campo. Le carte in MANO venivano buffate lo stesso, perche' anche loro
    // non sono la fonte — il foglio diceva una cosa e il motore ne faceva
    // un'altra, senza che nessuna delle due parti potesse accorgersene.
    // Adesso il bersaglio deve essere in campo davvero.
    // Se la scena non sa dire chi c'e' in campo si torna al comportamento di
    // prima: meglio un effetto in piu' che spegnere ogni sinergia del gioco
    // per una scena costruita male.
    if (dove === 'board') {
      // ── v0.78.16 — SI CHIEDE "DOVE SEI", NON "SEI NELL'ELENCO" ───────────
      // La v0.78.15 guardava `scena.inCampo`, e sembrava la stessa domanda.
      // Non lo e': chi COSTRUISCE una scena puo' mettere in `inCampo' solo la
      // carta che sta esaminando — lo fa il riquadro dei buff, che per sapere
      // quanto dia OGNI singola fonte ne mette in campo una alla volta (vedi
      // _modificatoriDalMotore). In quella scena il bersaglio non c'e', e la
      // v0.78.15 rispondeva "non e' in campo": il riquadro ha smesso di dire
      // CHI stesse buffando, e restava il numero da solo.
      // `cellaDi` risponde alla domanda giusta — su quale casella sta questa
      // carta — e non dipende da chi il chiamante abbia messo nell'elenco dei
      // contributori. Le due cose erano confuse, ed erano due.
      if (scena && typeof scena.cellaDi === 'function') {
        if (!scena.cellaDi(bersaglio)) return false;
      } else if (scena && scena.inCampo && scena.inCampo.length !== undefined) {
        var dentro = false, k;
        for (k = 0; k < scena.inCampo.length; k++) if (scena.inCampo[k] === bersaglio) { dentro = true; break; }
        if (!dentro) return false;
      }
      return !stessaCarta(bersaglio, fonte) || chi === 'self';
    }
    if (!dove) return !stessaCarta(bersaglio, fonte) || chi === 'self';
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

  // ── LA FINESTRA TEMPORALE ───────────────────────────────────────────────
  // "dal turno 4" (Strigoi), "solo nei primi due" (Captain Hook).
  //
  // SE IL TURNO NON SI SA, LA FINESTRA E' CHIUSA. E' la scelta scomoda ed e'
  // voluta: chi dimentica di passare il turno vede l'abilita' non fare niente
  // — un guasto che si nota — invece di vedere una carta silenziosamente piu'
  // forte del dovuto. Questo gioco ha gia' pagato caro il guasto silenzioso.
  function finestraAperta(a, scena) {
    var f = a && a.finestra;
    if (!f || !f.tipo || f.tipo === 'always') return true;
    var t = scena ? scena.turno : undefined;
    if (f.tipo === 'from_turn') return (typeof t === 'number') && t >= f.valore;
    if (f.tipo === 'until_turn') return (typeof t === 'number') && t <= f.valore;
    // for_turns e next_only riguardano effetti che scattano una volta, non le
    // sinergie continue: qui non hanno niente da chiudere.
    return true;
  }

  // ── QUANTE VOLTE (dalla v0.77.63) ────────────────────────────────────────
  // 'Frequency' diceva una cosa che nessuno leggeva: il motore faceva scattare
  // l'abilita' a ogni evento buono, e "once_per_game" restava una promessa
  // scritta sul foglio e mai mantenuta. Adesso la conta la tiene il motore, in
  // un campo privato della carta, e NON il chiamante: due chiamanti — client e
  // server — che devono ricordarsi di segnare sono due occasioni di
  // dimenticare, e la dimenticanza sarebbe silenziosa proprio dove costa di
  // piu' (una carta che ripete un colpo unico per tutta la partita).
  //
  // La memoria sta sulla CARTA e non sull'abilita' perche' "una volta per
  // partita" vale per quell'esemplare li': due copie della stessa carta hanno
  // ciascuna il suo colpo.
  function scattoConsentito(fonte, evento, scena) {
    var a = abilitaDi(fonte);
    if (!fonte || !a) return true;
    var f = a.frequenza || 'every_time';
    if (f === 'every_time') return true;
    var m = fonte._scatti && fonte._scatti[evento];
    if (!m) return true;
    if (f === 'once_per_game') return false;
    if (f === 'once_per_turn') {
      var t = scena ? scena.turno : undefined;
      // Turno ignoto: si tiene chiusa, come per la finestra temporale. Meglio
      // un'abilita' che non parte — e si nota — di una che si ripete di
      // nascosto.
      return (typeof t === 'number') && m.turno !== t;
    }
    return true;
  }

  function segnaScatto(fonte, evento, scena) {
    if (!fonte) return;
    if (!fonte._scatti) fonte._scatti = {};
    var p = fonte._scatti[evento] || { volte: 0, turno: null };
    p.volte++;
    if (scena && typeof scena.turno === 'number') p.turno = scena.turno;
    fonte._scatti[evento] = p;
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
      if (!finestraAperta(a, scena)) continue;
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

  // ══════════════════════════════════════════════════════════════════════
  // GLI EFFETTI CHE SCATTANO
  // ══════════════════════════════════════════════════════════════════════
  // Una sinergia si RICALCOLA; un effetto a scatto SUCCEDE, una volta, e
  // lascia il segno. Due modelli diversi, e vanno tenuti separati: chi li
  // confonde finisce per riapplicare un furto a ogni ridisegno.
  //
  // QUESTA FUNZIONE NON CAMBIA NIENTE. Torna un ELENCO DI CAMBIAMENTI, e chi
  // la chiama decide cosa farne: il gioco li applica passando da modificaValori
  // (che si porta dietro il lampo verde o rosso e le animazioni), il server li
  // applica al proprio stato senza mostrare niente. La decisione e' una sola e
  // vale per tutti e due — che e' l'unico modo perche' i due tabelloni
  // restino d'accordo.
  //
  // Ogni cambiamento e': { carta, lati:[...], delta:n }  oppure
  //                      { carta, lati:[...], valore:n } per un "set".

  // Chi puo' essere colpito da un effetto a scatto, dato il bersaglio scritto.
  function candidati(fonte, eff, scena) {
    scena = scena || {};
    var chi = eff.chi, dove = eff.dove, out = [], i;

    // I bersagli del momento non si cercano: sono chi sta agendo adesso.
    if (chi === 'self') return [fonte];
    if (chi === 'attacker') return scena.attaccante ? [scena.attaccante] : [];
    if (chi === 'attacked') return scena.attaccato ? [scena.attaccato] : [];

    var pesca = [];
    if (dove === 'adjacent') pesca = (scena.vicini && scena.vicini(fonte)) || [];
    else if (dove === 'in_hand') {
      // Tutte e due le mani, e poi il filtro ally/opponent qui sotto sceglie.
      // Prima si guardava solo la mano di chi agisce: bastava per un dono ai
      // propri (Il Genio), ma un effetto rivolto all'avversario IN MANO non
      // trovava mai nessuno e non faceva niente in silenzio.
      pesca = scena.inMano || (scena.manoDi && scena.manoDi(fonte)) || [];
    }
    else if (dove === 'drawn') return scena.pescata ? [scena.pescata] : [];
    else pesca = scena.inCampo || [];

    for (i = 0; i < pesca.length; i++) {
      var c = pesca[i];
      if (c === fonte && chi !== 'any') continue;
      if (chi === 'ally' && !_stessoPadrone(fonte, c)) continue;
      if (chi === 'opponent' && _stessoPadrone(fonte, c)) continue;
      out.push(c);
    }
    return out;
  }

  // Fra i candidati, quali si prendono davvero.
  function scelti(lista, eff, scena) {
    var q = eff.quale;
    if (!lista.length) return [];
    if (!q || q === 'all') return lista;
    if (q === 'single') {
      // Uno solo, e non importa quale. Se chi chiama ha gia' una scelta in
      // mano (il giocatore ha indicato) si usa quella; senza, il primo.
      if (scena && scena.scelta && lista.indexOf(scena.scelta) !== -1) return [scena.scelta];
      return [lista[0]];
    }
    if (q === 'random') {
      // Ripetibile. In rete i due client devono pescare la STESSA carta, o si
      // troverebbero d'accordo solo per caso: il numero esce dal seme della
      // partita, come il lato "a caso" di RAND. Math.random resta l'ultima
      // spiaggia, per chi chiama senza seme.
      if (scena && scena.seme) {
        return [lista[_semeDi(String(scena.seme) + '|' + String(scena.turno || 0) + '|' + lista.length) % lista.length]];
      }
      var i = Math.floor((scena && typeof scena.sorte === 'number' ? scena.sorte : Math.random()) * lista.length);
      return [lista[Math.min(i, lista.length - 1)]];
    }
    if (q === 'highest' || q === 'lowest') {
      var meglio = lista[0], j;
      for (j = 1; j < lista.length; j++) {
        var a = estremo((lista[j].valoriBase || lista[j].values) || {}, true);
        var b = estremo((meglio.valoriBase || meglio.values) || {}, true);
        if (q === 'highest' ? a > b : a < b) meglio = lista[j];
      }
      return [meglio];
    }
    return lista;
  }

  // Un effetto a scatto, tradotto in cambiamenti.
  // Le azioni che il motore DESCRIVE invece di calcolare. Stanno in un elenco
  // e non sparse in una catena di if perche' chi aggiunge un'azione al
  // vocabolario deve trovarne una sola, di lista.
  // `buff`, `debuff` e `set` non ci sono: quelli il motore li calcola per
  // intero, perche' il risultato e' un numero e un numero non ha bisogno di
  // nessuno che lo interpreti.
  var AZIONI_DESCRITTE = {
    freeze: true, rotate: true, shuffle: true, hide: true, protect: true,
    flip: true, cancel: true, destroy: true, move: true, swap: true,
    transform: true, summon: true, copy: true, draw: true, discard: true
  };

  function _cambiamentiDi(fonte, eff, cond, scena, fuori, finestra) {
    if (!eff) return;
    var az = eff.azione;

    // ── v0.77.66 — QUEL CHE NON E' UN NUMERO ───────────────────────────────
    // Congelare, ruotare, mescolare, trasformare, spostare, distruggere,
    // rubare: nessuna di queste cambia un valore, e per questo il motore le
    // ignorava. Ma la parte che il motore fa bene e' sempre la stessa — SE
    // scatta, su CHI, e QUANTO — ed e' indipendente dal fatto che il risultato
    // sia un numero o una carta che sparisce.
    //
    // Quindi da qui esce un cambiamento DESCRITTO, e chi chiama lo esegue col
    // codice che ha gia': animazioni, suoni e mirino restano dove sono. Il
    // motore decide CHI, il client fa COME. E' lo stesso patto di Alice.
    //
    // QUANDO IL FOGLIO DICE `Player selection = yes` non si sceglie: si
    // consegna l'elenco dei candidati e si lascia che sia il giocatore a
    // indicare. Prendere il primo della lista vorrebbe dire giocare al posto
    // suo.
    // (Prima questo si scriveva "selected" nella colonna Which, che pero' e'
    // un filtro: cosi' non si poteva dire "un tassello BLOCCATO, e lo sceglie
    // il giocatore" — le due cose litigavano per la stessa cella.)
    if (AZIONI_DESCRITTE[az]) {
      if (!condizioneVera(cond, fonte, scena)) return;
      // Un TASSELLO non e' una carta: chi lo cerca sono le caselle, e quelle
      // il motore non le ha. Per queste (e per l'evocazione, che di bersagli
      // non ne ha affatto) esce solo la descrizione, e le caselle le trova chi
      // esegue — che il tabellone ce l'ha davanti.
      var senzaBersagli = (eff.cosa === 'tile' || az === 'summon');
      var possibili = senzaBersagli ? [] : candidati(fonte, eff, scena);
      if (!possibili.length && !senzaBersagli) return;
      var pezzo = {
        azione: az,
        cosa: eff.cosa || null,
        fonte: fonte,
        quanto: eff.quanto || null,
        ambito: eff.ambito || null,
        dove: eff.dove || null,
        quale: eff.quale || null,
        scelta: !!eff.scelta
      };
      // Per quanto dura lo dice la FINESTRA (`for_turns 2`), non la durata:
      // e' li' che il foglio scrive "per due turni".
      if (finestra && finestra.tipo === 'for_turns' && typeof finestra.valore === 'number') pezzo.turni = finestra.valore;
      if (eff.scelta) {
        pezzo.candidati = possibili;                 // chiedilo al giocatore
        fuori.push(pezzo);
        return;
      }
      var presi = scelti(possibili, eff, scena);
      for (var k = 0; k < presi.length; k++) {
        var uno = {}; for (var kk in pezzo) uno[kk] = pezzo[kk];
        uno.carta = presi[k];
        if (az === 'protect' || az === 'swap' || az === 'shuffle' || az === 'rotate') {
          uno.lati = latiColpiti(eff.ambito, (presi[k].valoriBase || presi[k].values) || {}, presi[k], _occasione(fonte, scena));
        }
        fuori.push(uno);
      }
      if (senzaBersagli && !presi.length) fuori.push(pezzo);
      return;
    }

    if (az === 'steal' && eff.cosa && eff.cosa !== 'power') {
      // Rubare un tratto o un'abilita' non e' una sottrazione: e' un travaso.
      // Passa dalla stessa porta delle altre azioni descritte.
      if (!condizioneVera(cond, fonte, scena)) return;
      var daCui = candidati(fonte, eff, scena);
      if (!daCui.length) return;
      if (eff.scelta) {
        fuori.push({ azione: 'steal', cosa: eff.cosa, fonte: fonte, candidati: daCui, quale: eff.quale, dove: eff.dove });
        return;
      }
      var scelte = scelti(daCui, eff, scena);
      for (var s = 0; s < scelte.length; s++) {
        fuori.push({ azione: 'steal', cosa: eff.cosa, fonte: fonte, carta: scelte[s], quale: eff.quale, dove: eff.dove });
      }
      return;
    }
    if (az !== 'buff' && az !== 'debuff' && az !== 'set' && az !== 'steal') return;
    if (eff.cosa && eff.cosa !== 'power') return;      // un furto di potenza, e nient'altro
    if (!condizioneVera(cond, fonte, scena)) return;

    var lista = scelti(candidati(fonte, eff, scena), eff, scena);
    var q = quantita(fonte, eff, cond, scena);
    var i, j, bersaglio, lati;
    for (i = 0; i < lista.length; i++) {
      bersaglio = lista[i];
      lati = latiColpiti(eff.ambito, (bersaglio.valoriBase || bersaglio.values) || {}, bersaglio, _occasione(fonte, scena));
      if (az === 'set') {
        // "diventa un valore fra 1 e 3": il numero si tira QUI e vale per
        // tutti i lati colpiti, cosi' la carta non esce a scacchiera.
        var v = q;
        if (eff.quanto && typeof eff.quanto.da === 'number') {
          var r = (scena && typeof scena.sorte === 'number') ? scena.sorte : Math.random();
          v = eff.quanto.da + Math.floor(r * (eff.quanto.a - eff.quanto.da + 1));
        }
        // ── v0.79.17 — E CHI L-HA FATTO ─────────────────────────────────
        // Da qui uscivano cambiamenti orfani: il bersaglio, i lati e il
        // numero, ma non chi lo stava facendo. Chi esegue (applicaCambiamenti,
        // nel gioco) non aveva quindi un nome da scrivere nel registro dei
        // modificatori, e il riquadro "Buffs/debuffs" mostrava un "+2 ALL"
        // senza nessuno accanto — per meta- del mazzo.
        // La fonte ce l-abbiamo qui da sempre: e- il primo argomento di questa
        // funzione. Va solo detta.
        fuori.push({ carta: bersaglio, lati: lati, valore: v, azione: 'set', fonte: fonte });
      } else {
        var d = (az === 'debuff' || az === 'steal') ? -q : q;
        if (!d) continue;
        fuori.push({ carta: bersaglio, lati: lati, delta: d, azione: az, fonte: fonte });
      }
    }
  }

  // ── v0.77.93 — DUE GENI NON SONO LA STESSA OCCASIONE ────────────────────
  // Il lato "a caso" esce da un numero ricavato dal seme, e il seme conteneva
  // due cose sole: la partita e la carta BERSAGLIO. Mancava chi stava agendo.
  // Il risultato: giocato il primo Genio, il secondo regalava il bonus allo
  // STESSO gruppo di ogni carta in mano, e cosi' il terzo, e il quarto — la
  // scelta era casuale una volta sola, all'inizio della partita, e poi si
  // ripeteva identica per sempre.
  //
  // Serviva quindi un pezzo di seme che cambi a ogni giocata, e che i due
  // client e il server calcolino IDENTICO — se divergesse, i due tabelloni si
  // troverebbero d'accordo solo per caso. La casella su cui la carta agisce ha
  // tutte e due le proprieta': ogni Genio ne occupa una diversa, e su quale sia
  // sono tutti d'accordo perche' l'ha decisa il server. Il turno fa da ripiego
  // per chi agisce dalla mano, dove una casella non c'e'.
  //
  // NON si tocca il seme delle abilita' CONTINUE (_unEffetto): quelle devono
  // restare ferme sullo stesso gruppo finche' durano, o il bonus salterebbe da
  // un lato all'altro a ogni ridisegno. Li' l'occasione non esiste: c'e' uno
  // stato che dura.
  function _occasione(fonte, scena) {
    var dove = (scena && scena.cellaDi) ? scena.cellaDi(fonte) : null;
    if (!dove) dove = 't' + String((scena && scena.turno) || 0);
    return String((scena && scena.seme) || '') + '|' + String(dove);
  }

  // I cambiamenti che l'abilita' di questa carta produce a un dato evento.
  // `evento` e' un trigger: 'on_play', 'on_conquer', 'on_conquered', ...
  function cambiamentiAllEvento(fonte, evento, scena) {
    var a = abilitaDi(fonte);
    var fuori = [];
    if (!a || a.trigger !== evento) return fuori;
    if (!finestraAperta(a, scena)) return fuori;
    if (!scattoConsentito(fonte, evento, scena)) return fuori;
    scena = scena || {};

    // Un effetto continuo non scatta: lo calcola deltaContinuo, e farlo anche
    // qui vorrebbe dire applicarlo due volte.
    if (a.effetto && a.effetto.durata !== 'while_true') _cambiamentiDi(fonte, a.effetto, a.se, scena, fuori, a.finestra);

    if (a.legame === 'and') {
      if (a.effetto2 && a.effetto2.durata !== 'while_true') _cambiamentiDi(fonte, a.effetto2, a.se2, scena, fuori, a.finestra);
    } else if (a.legame === 'instead') {
      // Il secondo prende il posto del primo quando la sua condizione vale.
      if (a.effetto2 && condizioneVera(a.se2, fonte, scena)) {
        fuori.length = 0;
        if (a.effetto2.durata !== 'while_true') _cambiamentiDi(fonte, a.effetto2, a.se2, scena, fuori, a.finestra);
      }
    } else if (a.legame === 'or') {
      // Una delle due, a sorte.
      var testa = (scena && typeof scena.sorte === 'number' ? scena.sorte : Math.random()) < 0.5;
      if (!testa && a.effetto2) { fuori.length = 0; _cambiamentiDi(fonte, a.effetto2, a.se2, scena, fuori, a.finestra); }
    }
    // Si segna solo se l'abilita' ha davvero prodotto qualcosa: se la
    // condizione era falsa e non e' uscito niente, il colpo unico non e' stato
    // speso e resta da spendere.
    if (fuori.length) segnaScatto(fonte, evento, scena);
    return fuori;
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
    // v0.78.5 — l'elenco delle azioni che il motore sa mettere in scena. Lo
    // chiede chi deve decidere se un'abilita' e' "programmata" o va marcata
    // NO_SCRIPT: quella domanda si fa qui e non con una lista ricopiata
    // altrove, che il giorno dopo sarebbe gia' diversa.
    AZIONI_DESCRITTE: AZIONI_DESCRITTE,
    latiColpiti: latiColpiti,
    colpisce: colpisce,
    quantita: quantita,
    finestraAperta: finestraAperta,
    candidati: candidati,
    scelti: scelti,
    scattoConsentito: scattoConsentito,
    segnaScatto: segnaScatto,
    cambiamentiAllEvento: cambiamentiAllEvento,
    deltaContinuo: deltaContinuo,
    valoriEffettivi: valoriEffettivi
  };

  return MOTORE;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ABILITA_MOTORE;
