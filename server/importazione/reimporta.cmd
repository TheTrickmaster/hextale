@echo off
rem Doppio clic per reimportare le carte dal foglio Google nel database.
rem Si ferma da solo se qualcosa non torna, e in quel caso non tocca il database.
pushd "%~dp0"
node reimporta.js
echo.
pause
popd
