// Il ponte fra il guscio e il gioco.
//
// Passa UNA sola informazione: "stai girando dentro all'applicazione". Oggi il
// gioco non ne ha bisogno (anche il controllo della versione funziona uguale:
// vedi desktop/main.js), ma e' il modo giusto di saperlo se un giorno servira'.
//
// Non si espone nient'altro. Ogni funzione messa qui dentro diventa
// raggiungibile da tutto cio' che la pagina carica, per sempre: si aggiunge
// quando serve davvero, non "per comodita' futura".
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('hextaleDesktop', {
  versioneGuscio: process.versions.electron,
  piattaforma: process.platform,
});
