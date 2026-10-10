#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Serve Python 3: installalo da https://www.python.org/downloads/ e riapri questo file."
  read -r "?Premi Invio per chiudere."
  exit 1
fi
exec python3 server.py --open
