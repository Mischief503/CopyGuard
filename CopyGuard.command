#!/usr/bin/env bash
cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules/electron" ]; then
    echo "First launch — installing CopyGuard (takes about 2 minutes)..."
    npm install --prefer-offline
    echo "Done! Launching..."
fi

npx electron . &
disown
