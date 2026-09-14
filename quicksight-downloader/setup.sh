#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# QuickSight Downloader - Setup Script
# ═══════════════════════════════════════════════════════════════

set -e

echo "========================================="
echo " QuickSight Downloader Setup"
echo "========================================="

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is required. Install from https://www.python.org"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1)
echo "Found: $PYTHON_VERSION"

# Create virtual environment
echo ""
echo "Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install playwright openpyxl

# Install browser
echo ""
echo "Installing Chromium browser..."
playwright install chromium

# Create downloads directory
mkdir -p downloads

# Setup credentials
echo ""
echo "========================================="
echo " CREDENTIAL SETUP"
echo "========================================="
echo ""
echo "For security, we recommend using environment variables:"
echo ""
echo "  Option 1 (recommended): Set environment variables"
echo "    export QS_USERNAME='lastmileQS@lastmile2you.com'"
echo "    export QS_PASSWORD='your-password-here'"
echo ""
echo "  Option 2: Edit config.json directly (less secure)"
echo "    Edit the 'username' and 'password' fields"
echo ""

# Offer to set up a .env file
read -p "Would you like to create a .env file for credentials? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter QuickSight username: " qs_user
    read -sp "Enter QuickSight password: " qs_pass
    echo ""

    cat > .env << EOF
QS_USERNAME=$qs_user
QS_PASSWORD=$qs_pass
EOF

    echo "Created .env file"
    echo "IMPORTANT: Add .env to .gitignore!"

    # Add to gitignore
    echo ".env" >> .gitignore 2>/dev/null || true
fi

echo ""
echo "========================================="
echo " Setup Complete!"
echo "========================================="
echo ""
echo "To run manually:"
echo "  source venv/bin/activate"
echo "  source .env  # if you created one"
echo "  python quicksight_downloader.py"
echo ""
echo "To run headless (no browser window):"
echo "  python quicksight_downloader.py --headless"
echo ""
echo "To set up automatic scheduling (every 3 days):"
echo "  ./schedule.sh"
echo ""
