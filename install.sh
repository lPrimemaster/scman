#!/usr/bin/env bash
# Builds and installs the frontend and backend on the server (run as root).
# The database, uploads/ and .env live in /srv/sc1925_backend and are never overwritten.
set -euo pipefail

FRONTEND_DIR=/var/www/sc1925
BACKEND_DIR=/srv/sc1925_backend

# Frontend
yarn install --frozen-lockfile
yarn build
mkdir -p "$FRONTEND_DIR"
cp -r dist/* "$FRONTEND_DIR"

# Backend
pushd backend
yarn install --frozen-lockfile --production
mkdir -p "$BACKEND_DIR"

# Back up the database before replacing the code
if [ -f "$BACKEND_DIR/database.db" ]; then
	cp "$BACKEND_DIR/database.db" "$BACKEND_DIR/database.db.bak-$(date +%Y%m%d%H%M%S)"
fi

rm -rf "$BACKEND_DIR/src"
cp -r node_modules/ index.js src/ scripts/ package.json "$BACKEND_DIR"

# Firebase service account for push notifications (optional)
if [ -f serviceAccountKey.json ]; then
	cp serviceAccountKey.json "$BACKEND_DIR"
fi
popd

chown -R www-data:www-data "$BACKEND_DIR"

# TODO: (César) Also install the systemd service here so environment variables are set in one place.

echo Done!
