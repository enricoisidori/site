@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 server.py --open
) else (
  python server.py --open
)
if errorlevel 1 (
  echo Serve Python 3 installato. Consulta LEGGIMI.txt.
  pause
)
