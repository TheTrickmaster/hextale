// Il preload di prova-ricordami.js. Gira PRIMA degli script della pagina, ed
// e' l'unico modo di arrivare in tempo: dalla v0.79.49 il rientro parte dentro
// runPreload(), cioe' al DOMContentLoaded, e qualunque cosa iniettata dopo
// arriva a domanda gia' spedita.
//
// Non si sostituiscono le funzioni del gioco: si sostituisce `fetch`. Cosi' il
// banco prova la strada VERA — nakamaRinnovaSessione, nakamaSalvaSessione,
// accessoEntra, la sedia, l'accordo, apriMenuPrincipale — e non una catena di
// finte che potrebbero andare bene mentre quella vera e' rotta.
(function () {
  var vero = window.fetch;
  window.__banco = { rinnovi: 0, usato: null, chiamate: [] };

  // Primo giro: si parte puliti. Dal secondo in poi no, o si cancellerebbe il
  // ricordo appena seminato. sessionStorage sopravvive al reload, localStorage
  // pure — e' esattamente la differenza che serve qui.
  try {
    if (!sessionStorage.getItem('banco-giro')) {
      sessionStorage.setItem('banco-giro', '1');
      localStorage.removeItem('hextale.ricordami');
    }
  } catch (_) {}

  // ── Il testimone ────────────────────────────────────────────────────────
  // Entrando nel menu la schermata iniziale viene SMONTATA (le pagine sono
  // ermetiche): dopo, chiedere al logo se si e' acceso risponde "non c'e-", che
  // e' la risposta giusta per la ragione sbagliata. Quindi si guarda mentre
  // succede: un osservatore segna se quelle due classi sono mai comparse.
  window.__banco.acceso = {};
  document.addEventListener('DOMContentLoaded', function () {
    var occhio = new MutationObserver(function (mosse) {
      for (var i = 0; i < mosse.length; i++) {
        var el = mosse[i].target;
        if (el.id && el.classList && el.classList.contains('show')) {
          window.__banco.acceso[el.id] = true;
        }
      }
    });
    occhio.observe(document.documentElement, {
      subtree: true, attributes: true, attributeFilter: ['class']
    });
  });

  var risposte = {
    'hx_verifica_stato': { verificato: true },
    'hx_entro': { dentro: true },
    'hx_accordo': { accettato: true }
  };
  var json = function (o) {
    return new Response(JSON.stringify(o), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  };

  window.fetch = function (url, opz) {
    var u = String(url || '');
    window.__banco.chiamate.push(u);
    // L'ordine conta: l'indirizzo del rinnovo contiene anche "/v2/account".
    if (u.indexOf('/v2/account/session/refresh') !== -1) {
      window.__banco.rinnovi++;
      // Si tiene il PRIMO, non l'ultimo: il token finto non ha una scadenza
      // leggibile, quindi nakamaSessionePronta lo crede scaduto e ne chiede un
      // altro. E' un effetto della finzione, non del gioco — quello che conta
      // e' con che cosa e' partita.
      try { if (window.__banco.usato === null) window.__banco.usato = JSON.parse(opz.body).token; } catch (_) {}
      return Promise.resolve(json({ token: 'TOK-NUOVO', refresh_token: 'RT-NUOVO' }));
    }
    if (u.indexOf('/v2/rpc/') !== -1) {
      var nome = u.split('/v2/rpc/')[1].split('?')[0];
      // Le RPC che non interessano tornano un oggetto vuoto: chi le chiama sta
      // gia' dentro a un try, e rispondere "non lo so" e' piu' onesto che
      // inventarsi un contenuto.
      return Promise.resolve(json(risposte[nome] || {}));
    }
    if (u.indexOf('/v2/account') !== -1) {
      return Promise.resolve(json({
        user: { id: 'u-banco', username: 'Lorenzo' },
        email: 'lorenzo@hextale.test'
      }));
    }
    return vero.apply(this, arguments);
  };
})();
