var FOIL_PROFILI = {
  "dark": {
    "saturate": 2,
    "hueRange": 180,
    "opacity": 0.6,
    "strength": 0.5,
    "blendRainbow": "overlay",
    "blendStars": "difference",
    "mask": false,
    "maskStars": true,
    "maskSlope": 0.45,
    "maskIntercept": 0.55,
    "starsFile": "foil-laminar-stars.png",
    "bandsMask": true,
    "bandsAngle": 45,
    "bandsTravel": 500,
    "starsSpeed": 10,
    "starsOpacity": 0.6,
    "laminarSotto": true
  },
  "light": {
    "saturate": 4,
    "hueRange": 180,
    "opacity": 0.7,
    "strength": 0.5,
    "blendRainbow": "overlay",
    "blendStars": "difference",
    "mask": true,
    "maskStars": false,
    "maskSlope": -0.1,
    "maskIntercept": 0.35,
    "starsFile": "foil-laminar-stars.png",
    "bandsMask": true,
    "bandsAngle": 45,
    "bandsTravel": 500,
    "starsSpeed": 10,
    "starsOpacity": 0.6,
    "laminarSotto": true
  }
};

var FOIL = FOIL_PROFILI.dark;

var FOIL_PROFILO_ATTIVO = "dark";

var CARD_DB_PARALLAX_PX = [-5,3,7,11];

var CARD_DB_GLOSS_SWEEP_X = 0.34;

var CARD_DB_GLOSS_SWEEP_Y = 0.15;

var CARD_DB_GLOSS_BAND = 0.13;

function foilUsaProfilo(fazione){
  const f = (fazione==='light') ? 'light' : 'dark';
  FOIL_PROFILO_ATTIVO = f;
  FOIL = FOIL_PROFILI[f];
  return FOIL;
}

function cardFoilApply(host, rx, ry, px, py){
  // v0.72.46: i due profili sono indipendenti, quindi anche il MOVIMENTO deve
  // leggere quello giusto (hueRange, bandsAngle, bandsTravel). La fazione la
  // dice il dataset gia' scritto da chi ha costruito il wrapper.
  foilUsaProfilo(host.dataset ? host.dataset.foilVariant : 'dark');
  const tilt=host.querySelector('.card-db-foil-tilt');
  if(tilt){
    tilt.style.setProperty('--foil-rx', rx.toFixed(3));
    tilt.style.setProperty('--foil-ry', ry.toFixed(3));
    // --foil-mx/my vivono sul CONTENITORE, non sui singoli layer: le custom
    // property si ereditano, quindi il glare le legge da qui. Un solo
    // elemento da scrivere per frame.
    tilt.style.setProperty('--foil-mx', (px*100).toFixed(1));
    tilt.style.setProperty('--foil-my', (py*100).toFixed(1));
    // v0.72.42 — ROTAZIONE DI TINTA GUIDATA DALL'ANGOLO.
    // E' questo il numero che trasforma "texture che scorre" in "colore che
    // cambia": la lamina ruota la propria tinta a seconda di come inclini,
    // esattamente come fa la diffrazione su una carta vera. La diagonale
    // (rx+ry) e' la scelta naturale perche' una lamina spazzolata ha
    // scanalature orientate: inclinando lungo la spazzolatura il colore
    // cambia molto, di traverso quasi niente.
    // CARD_HOLO_HUE_RANGE e' l'escursione a inclinazione massima: 180 gradi
    // e' mezzo giro di ruota cromatica, abbastanza da passare per famiglie di
    // colore diverse senza tornare al punto di partenza.
    const hue = ((rx*0.72 + ry*0.28) * FOIL.hueRange);
    tilt.style.setProperty('--foil-hue', hue.toFixed(1)+'deg');
  }
  // v0.72.15 — lamina: ora vive dentro l'SVG (vedi drawHexCard), quindi non
  // si anima più via background-position ma traslando il gradientTransform
  // delle due trame. Riferimenti risolti una volta sola e messi in cache
  // sullo slot: cercarli a ogni frame sarebbero due querySelector per
  // pointermove. Le due scorrono in VERSO OPPOSTO e a velocità diverse — è
  // quello a dare la parallasse ottica della lamina vera.
  if(host._holoGrads === undefined){
    const hSvg = host.querySelector('svg');
    const ga = hSvg && hSvg.querySelector('.card-holo-grad-a');
    const gb = hSvg && hSvg.querySelector('.card-holo-grad-b');
    host._holoGrads = (ga && gb) ? [ga, gb] : null;
  }
  if(host._holoGrads){
    // v0.72.48 — anche lo SCORRIMENTO segue la dimensione della carta.
    // I valori sono tarati sulla carta autorale (R circa 87.6); su una carta
    // ricostruita piu' grande, lasciarli invariati farebbe sembrare le trame
    // molto piu' lente, perche' percorrerebbero una frazione minore della
    // superficie. Il fattore si ricava dal raggio reale del primo pattern,
    // che e' gia' proporzionale a R (vedi CARD_HOLO_TEX_R_FACTOR).
    const _texW = parseFloat(host._holoGrads[0].getAttribute('width'))||0;
    const _scala = _texW>0 ? (_texW/460) : 1; // 460 = piastrella alla carta autorale
    // v0.72.25 FIX ("non si vedono piu' muovere le texture del foil"): quando
    // le due trame sono passate da <linearGradient> a <pattern> (v0.72.22/23)
    // questi due write erano rimasti su gradientTransform, che un <pattern>
    // semplicemente IGNORA — nessun errore, nessun avviso, solo trame
    // immobili. L'attributo giusto e' patternTransform.
    host._holoGrads[0].setAttribute('patternTransform',
      `translate(${(rx*34*_scala).toFixed(1)},${(ry*34*_scala).toFixed(1)})`);
    // v0.72.52: l'interruttore "Laminar ferma (no tilt)" e' stato tolto perche'
    // ridondante — lo stesso risultato si ottiene portando a 0 il cursore
    // "Laminar: velocita'", che e' gia' nel pannello.
    const vs=FOIL.starsSpeed*_scala;
    host._holoGrads[1].setAttribute('patternTransform',
      `translate(${(-rx*vs).toFixed(1)},${(-ry*vs).toFixed(1)})`);
  }
  // v0.72.46 — bande sulle laminar stars: scorrono NELLA DIREZIONE in cui si
  // inclina la carta. L'ordine delle due operazioni conta: prima si trasla
  // lungo (rx,ry) nel sistema di riferimento della CARTA, poi si ruota.
  // Invertendole la traslazione verrebbe ruotata anche lei e le bande
  // scorrerebbero di traverso rispetto al movimento del mouse.
  if(host._holoBands === undefined){
    const hSvg = host.querySelector('svg');
    host._holoBands = hSvg ? hSvg.querySelector('.card-holo-bands') : null;
  }
  if(host._holoBands){
    const g = host._holoBands;
    const bcx = parseFloat(g.dataset.cx)||0, bcy = parseFloat(g.dataset.cy)||0;
    const t = FOIL.bandsTravel;
    g.setAttribute('transform',
      `rotate(${FOIL.bandsAngle},${bcx},${bcy}) translate(${(rx*t).toFixed(1)},${(ry*t).toFixed(1)})`);
  }
  // v0.72.11 — parallax: ogni livello d'arte trasla col proprio fattore
  // (vedi CARD_DB_PARALLAX_PX). La componente verticale è smorzata (0.7):
  // l'esagono è più largo che alto, e a parità di px lo scarto verticale
  // si nota — e stona — prima di quello orizzontale. Il bg ritrova qui il
  // suo scale(1.06) di riposo, che una transform inline sovrascriverebbe.
  host.querySelectorAll('.hex-art-parallax-layer[data-parallax-depth]').forEach(layer=>{
    const d = parseInt(layer.dataset.parallaxDepth,10)||0;
    const f = CARD_DB_PARALLAX_PX[Math.min(d, CARD_DB_PARALLAX_PX.length-1)];
    const sc = d===0 ? ' scale(1.06)' : '';
    layer.style.transform = `translate(${(rx*f).toFixed(2)}px,${(ry*f*0.7).toFixed(2)}px)`+sc;
  });
  // v0.72.14 — lucentezza per materiale: fa scorrere la banda di luce sul
  // livello speculare. Si muovono gli OFFSET degli stop, non la geometria
  // del gradiente: è l'unica cosa che cambia per frame, e il gradiente
  // resta ancorato alla diagonale della carta. Il centro insegue puntatore
  // e inclinazione combinati (rx e ry), così il riflesso attraversa il
  // metallo nella direzione da cui "arriva" la luce.
  if(host._glossStops){
    const c = 0.5 + (rx*CARD_DB_GLOSS_SWEEP_X + ry*CARD_DB_GLOSS_SWEEP_Y);
    const w = CARD_DB_GLOSS_BAND;
    const cl = v=>Math.max(0, Math.min(1, v));
    host._glossStops[0].setAttribute('offset', cl(c-w).toFixed(4));
    host._glossStops[1].setAttribute('offset', cl(c).toFixed(4));
    host._glossStops[2].setAttribute('offset', cl(c+w).toFixed(4));
  }
}

function cardFoilReset(host){
  // v0.72.46: la cache del gruppo bande vive sullo slot; ricostruendo la
  // carta il nodo cambia, quindi va dimenticata insieme al resto.
  host._holoBands = undefined;
  if(!host) return;
  host.removeAttribute('data-foil-active');
  const tilt=host.querySelector('.card-db-foil-tilt');
  if(tilt){ tilt.style.setProperty('--foil-rx','0'); tilt.style.setProperty('--foil-ry','0'); }
  host.querySelectorAll('.hex-art-parallax-layer[data-parallax-depth]').forEach(layer=>{
    layer.style.transform = layer.dataset.parallaxDepth==='0' ? 'scale(1.06)' : '';
  });
}
