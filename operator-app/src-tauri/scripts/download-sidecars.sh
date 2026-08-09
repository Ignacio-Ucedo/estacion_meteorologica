#!/usr/bin/env bash
# Descarga esptool standalone y lo ubica como sidecar para Tauri.
# Ejecutar desde operator-app/src-tauri/ antes de `cargo tauri build`.
#
# Uso: ./scripts/download-sidecars.sh
#
# Los binarios van a binaries/ con el triple de la plataforma actual.
# Tauri los bundlea automáticamente si existen en esa ruta.

set -euo pipefail

ESPTOOL_VERSION="4.8.1"
BINARIES_DIR="$(dirname "$0")/../binaries"
mkdir -p "$BINARIES_DIR"

detect_target() {
  local os arch
  os=$(uname -s)
  arch=$(uname -m)

  case "$os" in
    Linux)
      case "$arch" in
        x86_64)  echo "x86_64-unknown-linux-gnu" ;;
        aarch64) echo "aarch64-unknown-linux-gnu" ;;
        *)        echo "unsupported_arch_$arch" ;;
      esac ;;
    Darwin)
      case "$arch" in
        x86_64)  echo "x86_64-apple-darwin" ;;
        arm64)   echo "aarch64-apple-darwin" ;;
        *)        echo "unsupported_arch_$arch" ;;
      esac ;;
    MINGW*|MSYS*|CYGWIN*)
      echo "x86_64-pc-windows-msvc" ;;
    *)
      echo "unsupported_os_$os" ;;
  esac
}

TARGET=$(detect_target)
DEST="$BINARIES_DIR/esptool-$TARGET"

if [[ "$TARGET" == unsupported* ]]; then
  echo "ERROR: Plataforma no soportada ($TARGET). Descargá esptool manualmente."
  exit 1
fi

if [[ -f "$DEST" ]]; then
  echo "esptool-$TARGET ya existe, saltando descarga."
  exit 0
fi

BASE_URL="https://github.com/espressif/esptool/releases/download/v${ESPTOOL_VERSION}"

case "$TARGET" in
  *linux*)
    ASSET="esptool-v${ESPTOOL_VERSION}-linux-amd64.zip"
    BINARY_IN_ZIP="esptool-v${ESPTOOL_VERSION}-linux-amd64/esptool"
    ;;
  *apple*)
    ASSET="esptool-v${ESPTOOL_VERSION}-macos-arm64.zip"
    BINARY_IN_ZIP="esptool-v${ESPTOOL_VERSION}-macos-arm64/esptool"
    if [[ "$TARGET" == x86_64* ]]; then
      ASSET="esptool-v${ESPTOOL_VERSION}-macos-amd64.zip"
      BINARY_IN_ZIP="esptool-v${ESPTOOL_VERSION}-macos-amd64/esptool"
    fi
    ;;
  *windows*)
    ASSET="esptool-v${ESPTOOL_VERSION}-win64.zip"
    BINARY_IN_ZIP="esptool-v${ESPTOOL_VERSION}-win64/esptool.exe"
    DEST="${DEST}.exe"
    ;;
esac

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "Descargando esptool v${ESPTOOL_VERSION} para $TARGET..."
curl -fsSL "${BASE_URL}/${ASSET}" -o "$TMPDIR/esptool.zip"

echo "Extrayendo..."
unzip -q "$TMPDIR/esptool.zip" "$BINARY_IN_ZIP" -d "$TMPDIR"

cp "$TMPDIR/$BINARY_IN_ZIP" "$DEST"
chmod +x "$DEST"

echo "esptool guardado en: $DEST"
