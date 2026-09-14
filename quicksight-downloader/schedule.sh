#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# QuickSight Downloader - Schedule Setup (Every 3 Days)
# ═══════════════════════════════════════════════════════════════
#
# This script sets up a cron job to run the downloader every 3 days.
# Works on macOS and Linux.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON_PATH="$SCRIPT_DIR/venv/bin/python"
DOWNLOADER="$SCRIPT_DIR/quicksight_downloader.py"
LOG_FILE="$SCRIPT_DIR/downloads/cron.log"

# Verify setup
if [ ! -f "$PYTHON_PATH" ]; then
    echo "ERROR: Virtual environment not found. Run setup.sh first."
    exit 1
fi

echo "========================================="
echo " Schedule QuickSight Download"
echo "========================================="
echo ""
echo "Script directory: $SCRIPT_DIR"
echo "Schedule: Every 3 days at 8:00 AM"
echo ""

# Build the cron command
# Load .env if it exists, then run the script
CRON_CMD="cd $SCRIPT_DIR"
if [ -f "$SCRIPT_DIR/.env" ]; then
    CRON_CMD="$CRON_CMD && source .env"
fi
CRON_CMD="$CRON_CMD && $PYTHON_PATH $DOWNLOADER --headless >> $LOG_FILE 2>&1"

# Cron expression: run at 8 AM every 3rd day
# Note: */3 in the day-of-month field means every 3 days
CRON_SCHEDULE="0 8 */3 * *"
CRON_LINE="$CRON_SCHEDULE $CRON_CMD"

echo "Cron entry:"
echo "  $CRON_LINE"
echo ""

# Detect OS for scheduling method
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Detected macOS."
    echo ""
    echo "Choose scheduling method:"
    echo "  1) cron (simple, traditional)"
    echo "  2) launchd (macOS native, survives reboots better)"
    echo ""
    read -p "Select (1 or 2): " -n 1 -r
    echo ""

    if [[ $REPLY == "2" ]]; then
        # Create launchd plist
        PLIST_NAME="com.lastmile.quicksight-downloader"
        PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

        cat > "$PLIST_PATH" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>$CRON_CMD</string>
    </array>
    <key>StartInterval</key>
    <integer>259200</integer> <!-- 3 days in seconds -->
    <key>RunAtLoad</key>
    <false/>
    <key>StandardOutPath</key>
    <string>$LOG_FILE</string>
    <key>StandardErrorPath</key>
    <string>$LOG_FILE</string>
    <key>WorkingDirectory</key>
    <string>$SCRIPT_DIR</string>
</dict>
</plist>
PLIST

        launchctl load "$PLIST_PATH" 2>/dev/null || true
        echo "Launchd agent installed: $PLIST_PATH"
        echo ""
        echo "Commands:"
        echo "  Start:   launchctl load $PLIST_PATH"
        echo "  Stop:    launchctl unload $PLIST_PATH"
        echo "  Status:  launchctl list | grep quicksight"
        echo "  Remove:  launchctl unload $PLIST_PATH && rm $PLIST_PATH"
    else
        # Install cron job
        ( crontab -l 2>/dev/null | grep -v "quicksight_downloader"; echo "$CRON_LINE" ) | crontab -
        echo "Cron job installed!"
        echo ""
        echo "Commands:"
        echo "  View:    crontab -l"
        echo "  Remove:  crontab -l | grep -v quicksight_downloader | crontab -"
    fi
else
    # Linux: use cron
    ( crontab -l 2>/dev/null | grep -v "quicksight_downloader"; echo "$CRON_LINE" ) | crontab -
    echo "Cron job installed!"
    echo ""
    echo "Commands:"
    echo "  View:    crontab -l"
    echo "  Remove:  crontab -l | grep -v quicksight_downloader | crontab -"
fi

echo ""
echo "========================================="
echo " Schedule Active!"
echo "========================================="
echo "Next run: Every 3 days at 8:00 AM"
echo "Log file: $LOG_FILE"
echo ""
echo "To run immediately:"
echo "  source venv/bin/activate && source .env && python quicksight_downloader.py --headless"
echo ""
