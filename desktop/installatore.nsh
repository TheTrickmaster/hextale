; HEXTALE — L'INSTALLATORE (app desktop 1.0.1)
;
; Lorenzo: "Prima di chiudere l'installer, chiedi se si vuole avviare subito il
; gioco". A installazione finita compare la domanda; con Si' si apre Hextale.
; Solo quando l'installatore lo apre una persona: gli aggiornamenti dell'app lo
; lanciano muto (/S, vedi main.js) e li' non si chiede niente.
; (package.json: runAfterFinish e' spento, se no il gioco partirebbe da solo.)

!macro customInstall
  ${ifNot} ${Silent}
    ${if} ${Cmd} `MessageBox MB_YESNO|MB_ICONQUESTION "Hextale has been installed.$\r$\n$\r$\nDo you want to start the game now?" IDYES`
      HideWindow
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" ""
    ${endIf}
  ${endIf}
!macroend
