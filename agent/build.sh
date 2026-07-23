#!/usr/bin/env bash
# Compila el agente para Windows y Linux (amd64) en dist/, desde un solo comando.
# Binarios estáticos, sin dependencias externas (solo stdlib de Go).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist

echo "→ Windows (amd64)"
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o dist/hexdesk-agent.exe .

echo "→ Linux (amd64)"
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o dist/hexdesk-agent .

echo "Listo. Binarios en dist/:"
ls -lh dist/
