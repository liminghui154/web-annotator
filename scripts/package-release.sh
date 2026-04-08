#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION="${1:-$(node -p "require('./manifest.json').version")}"
DIST_DIR="$ROOT_DIR/dist"
PACKAGE_BASENAME="cat-paw-annotator-v${VERSION}"
STAGE_DIR="$DIST_DIR/$PACKAGE_BASENAME"
ZIP_FILE="$DIST_DIR/$PACKAGE_BASENAME.zip"

rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/styles" "$STAGE_DIR/icons"

cp manifest.json background.js content.js sidebar.html sidebar.js popup.html popup.js README.md "$STAGE_DIR/"
cp styles/annotation.css "$STAGE_DIR/styles/"
cp icons/icon16.png icons/icon48.png icons/icon128.png icons/icon.svg "$STAGE_DIR/icons/"

rm -f "$ZIP_FILE"
(
  cd "$DIST_DIR"
  zip -qr "$(basename "$ZIP_FILE")" "$(basename "$STAGE_DIR")"
)

echo "$ZIP_FILE"
