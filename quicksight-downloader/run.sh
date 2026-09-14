#!/bin/bash
# Quick-run script — activates venv, loads creds, runs downloader
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
source venv/bin/activate
[ -f .env ] && source .env
python quicksight_downloader.py "$@"
