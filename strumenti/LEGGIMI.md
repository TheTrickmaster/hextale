# Guardare un difetto che si vede solo in movimento

Un'animazione che "sembra sbagliata" non si diagnostica a parole: si guarda
fotogramma per fotogramma. Questi due strumenti lo fanno partendo da una
registrazione dello schermo, e non serve installare niente — usano Electron,
che c'e' gia' per l'importazione delle carte.

    ELECTRON=desktop/node_modules/electron/dist/electron.exe

## provino.js — tanti fotogrammi in un'immagine sola

    $ELECTRON strumenti/provino.js <video> <uscita.png> <da> <a> <passo> [x y larg alt]

I tempi sono in secondi. Gli ultimi quattro ritagliano una finestra: un colpo
occupa una parte piccola dello schermo, e guardarlo a tutta pagina vuol dire
sprecare pixel su cose ferme.

    # dove succede qualcosa, a passi di un decimo
    $ELECTRON strumenti/provino.js reg.mp4 largo.png 3 5 0.1 600 150 900 750

    # e poi il dettaglio, un fotogramma ogni 20 millisecondi
    $ELECTRON strumenti/provino.js reg.mp4 colpo.png 5.2 5.8 0.02 690 150 400 300

## fotogrammi.js — i singoli fotogrammi, uno per file

    $ELECTRON strumenti/fotogrammi.js <video> <cartella> [da] [a] [passo]

Senza tempi stampa solo durata e dimensioni, per capire dove guardare.

## Cosa ha trovato, la prima volta

Il "doppio colpo" dell'attacco (v0.77.97). A parole sembrava un rimbalzo
ripetuto; a 20ms per fotogramma si e' visto che erano due LAMPI BIANCHI sulla
stessa carta a 110 millisecondi di distanza — la scia del colpo che arrivava
sul bersaglio prima del colpo. Nessuna quantita' di lettura del codice ci era
arrivata: il difetto stava nei numeri di tre animazioni messe insieme, e quei
tre numeri sono giusti ciascuno per conto suo.
