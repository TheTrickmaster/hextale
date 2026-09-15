// Il ponte fra il guscio e il gioco.
//
// Due cose, e nient'altro:
//   - "stai girando dentro all'applicazione" (versioneGuscio, piattaforma);
//   - accediConGoogle (1.0.2): Google rifiuta l'accesso dentro alle app, quindi
//     il gioco chiede al guscio di farlo nel browser vero. Restituisce
//     { code } oppure { errore } (vedi desktop/main.js, accessoGoogle).
//
// Non si espone nient'altro. Ogni funzione messa qui dentro diventa
// raggiungibile da tutto cio' che la pagina carica, per sempre: si aggiunge
// quando serve davvero, non "per comodita' futura".
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hextaleDesktop', {
  versioneGuscio: process.versions.electron,
  piattaforma: process.platform,
  accediConGoogle: () => ipcRenderer.invoke('hextale:google'),
});
