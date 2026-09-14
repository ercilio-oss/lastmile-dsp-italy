#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Lighthouse Downloader — programación diaria en macOS (launchd)
# ═══════════════════════════════════════════════════════════════
# Instala un LaunchAgent que ejecuta lighthouse_downloader.py todos los
# días a las 07:30 (los datos de Amazon se refrescan a las 07:00, T-2D).
#
#   ./schedule_daily.sh            # instala / actualiza el job
#   ./schedule_daily.sh --remove   # lo desinstala
#   ./schedule_daily.sh --run-now  # lo lanza inmediatamente (prueba)
#
# Las credenciales se leen de .env (QS_USERNAME / QS_PASSWORD) en esta carpeta.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LABEL="com.otl.lighthouse-downloader"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PYTHON="$SCRIPT_DIR/venv/bin/python"
LOG_DIR="$SCRIPT_DIR/logs"; mkdir -p "$LOG_DIR"
HOUR=${HOUR:-7}; MINUTE=${MINUTE:-30}
ARGS=${ARGS:---headless --weeks 12 --merge --commit}   # añade --push para desplegar en Netlify automáticamente

if [ "$1" == "--remove" ]; then
  launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"; echo "Job $LABEL eliminado"; exit 0
fi
if [ "$1" == "--run-now" ]; then
  launchctl kickstart -k "gui/$(id -u)/$LABEL"; echo "Lanzado; log en $LOG_DIR/downloader.log"; exit 0
fi

[ -x "$PYTHON" ] || { echo "ERROR: falta venv. Ejecuta setup.sh primero (pip install playwright && playwright install chromium)"; exit 1; }

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string><string>-lc</string>
    <string>cd "$SCRIPT_DIR" &amp;&amp; set -a &amp;&amp; [ -f .env ] &amp;&amp; . ./.env; set +a; "$PYTHON" lighthouse_downloader.py $ARGS</string>
  </array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>$HOUR</integer><key>Minute</key><integer>$MINUTE</integer></dict>
  <key>StandardOutPath</key><string>$LOG_DIR/downloader.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/downloader.err.log</string>
  <key>RunAtLoad</key><false/>
</dict></plist>
EOF
launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Instalado $LABEL → todos los días a las $(printf '%02d:%02d' $HOUR $MINUTE)"
echo "Args: $ARGS"
echo "Log:  $LOG_DIR/downloader.log"
