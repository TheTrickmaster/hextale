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
  foilUsaProfilo(host.dataset ? host.dataset.foilVariant : 'dark');
  const tilt=host.querySelector('.card-db-foil-tilt');
  if(tilt){
    tilt.style.setProperty('--foil-rx', rx.toFixed(3));
    tilt.style.setProperty('--foil-ry', ry.toFixed(3));
    tilt.style.setProperty('--foil-mx', (px*100).toFixed(1));
    tilt.style.setProperty('--foil-my', (py*100).toFixed(1));
    const hue = ((rx*0.72 + ry*0.28) * FOIL.hueRange);
    tilt.style.setProperty('--foil-hue', hue.toFixed(1)+'deg');
  }
  if(host._holoGrads === undefined){
    const hSvg = host.querySelector('svg');
    const ga = hSvg && hSvg.querySelector('.card-holo-grad-a');
    const gb = hSvg && hSvg.querySelector('.card-holo-grad-b');
    host._holoGrads = (ga && gb) ? [ga, gb] : null;
  }
  if(host._holoGrads){
    const _texW = parseFloat(host._holoGrads[0].getAttribute('width'))||0;
    const _scala = _texW>0 ? (_texW/460) : 1;
    host._holoGrads[0].setAttribute('patternTransform',
      `translate(${(rx*34*_scala).toFixed(1)},${(ry*34*_scala).toFixed(1)})`);
    const vs=FOIL.starsSpeed*_scala;
    host._holoGrads[1].setAttribute('patternTransform',
      `translate(${(-rx*vs).toFixed(1)},${(-ry*vs).toFixed(1)})`);
  }
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
  host.querySelectorAll('.hex-art-parallax-layer[data-parallax-depth]').forEach(layer=>{
    const d = parseInt(layer.dataset.parallaxDepth,10)||0;
    const f = CARD_DB_PARALLAX_PX[Math.min(d, CARD_DB_PARALLAX_PX.length-1)];
    const sc = d===0 ? ' scale(1.06)' : '';
    layer.style.transform = `translate(${(rx*f).toFixed(2)}px,${(ry*f*0.7).toFixed(2)}px)`+sc;
  });
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
  host._holoBands = undefined;
  if(!host) return;
  host.removeAttribute('data-foil-active');
  const tilt=host.querySelector('.card-db-foil-tilt');
  if(tilt){ tilt.style.setProperty('--foil-rx','0'); tilt.style.setProperty('--foil-ry','0'); }
  host.querySelectorAll('.hex-art-parallax-layer[data-parallax-depth]').forEach(layer=>{
    layer.style.transform = layer.dataset.parallaxDepth==='0' ? 'scale(1.06)' : '';
  });
}
