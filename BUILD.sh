#!/usr/bin/env bash
# CopyGuard Builder — Mac/Linux
# Produces CopyGuard.dmg (Mac) or CopyGuard.AppImage (Linux)
# Recipients need NOTHING installed to run it.

set -e
CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; RESET='\033[0m'
cd "$(dirname "$0")"

clear
echo ""
echo -e "${BOLD}  ⬡  CopyGuard Builder${RESET}"
echo    "  Produces a self-contained installer."
echo    "  Recipients need nothing installed to run it."
echo    "  ──────────────────────────────────────────────"
echo ""

# Node check
if ! command -v node &>/dev/null; then
    echo -e "  ${YELLOW}[!]${RESET} Node.js required to BUILD (not to run the app)."
    echo    "      Install from nodejs.org - LTS version."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "https://nodejs.org/en/download/"
    fi
    exit 1
fi

echo -e "  ${GREEN}✓${RESET} Node.js $(node --version)"
echo ""

echo -e "  ${CYAN}Installing build dependencies...${RESET}"
npm install --silent

echo ""

if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "  ${CYAN}Building Mac installer (.dmg)...${RESET}"
    echo    "  (Downloads ~150MB Electron binary first time)"
    echo ""
    npm run dist:mac
    OUTFILE=$(ls dist-build/*.dmg 2>/dev/null | head -1)
else
    echo -e "  ${CYAN}Building Linux installer (.AppImage)...${RESET}"
    npm run dist:linux
    OUTFILE=$(ls dist-build/*.AppImage 2>/dev/null | head -1)
fi

echo ""
if [ -n "$OUTFILE" ]; then
    echo -e "  ${GREEN}${BOLD}SUCCESS!${RESET}"
    echo    "  ──────────────────────────────────────────────"
    echo    "  Installer ready:"
    echo    "  $OUTFILE"
    echo ""
    echo    "  Share that file with anyone."
    echo    "  They double-click it — CopyGuard installs and runs."
    echo    "  No Node.js, no npm, nothing else required."
    echo    "  ──────────────────────────────────────────────"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open dist-build/
    fi
else
    echo -e "  ${YELLOW}Build may have failed — check output above.${RESET}"
fi
