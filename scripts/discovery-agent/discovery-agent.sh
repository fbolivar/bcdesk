#!/usr/bin/env bash
# BCDesk — Agente de descubrimiento CMDB (Linux)
# Reporta el hardware/software de este equipo a BCDesk.
#
# Uso:
#   ./discovery-agent.sh "https://tu-dominio.com" "TOKEN_DE_DESCUBRIMIENTO"
#
# Para inventario recurrente: agrega una entrada de cron (p. ej. diaria).
# Requiere: curl y python3 (para construir el JSON de forma segura).
# Algunos datos (serial/fabricante) requieren sudo/dmidecode.

set -euo pipefail

API_URL="${1:?Uso: discovery-agent.sh <API_URL> <TOKEN>}"
TOKEN="${2:?Falta TOKEN}"

get() { "$@" 2>/dev/null || true; }

HOST="$(hostname)"
SERIAL="$(get sudo dmidecode -s system-serial-number | tr -d '\n')"
MANU="$(get sudo dmidecode -s system-manufacturer | tr -d '\n')"
MODEL="$(get sudo dmidecode -s system-product-name | tr -d '\n')"
OS="$( . /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-$(uname -sr)}" )"
CPU="$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2- | sed 's/^ *//' || true)"
RAM_GB="$(awk '/MemTotal/ {printf "%.1f", $2/1024/1024}' /proc/meminfo || echo 0)"
MAC="$(ip -o link 2>/dev/null | awk '/link\/ether/ {print $(NF-2); exit}' || true)"
IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"

if command -v dpkg >/dev/null 2>&1; then
  SOFTWARE="$(dpkg-query -W -f='${Package}\n' 2>/dev/null | head -100)"
elif command -v rpm >/dev/null 2>&1; then
  SOFTWARE="$(rpm -qa --qf '%{NAME}\n' 2>/dev/null | head -100)"
else
  SOFTWARE=""
fi

# Construye el JSON de forma segura con python3 (escapa comillas, etc.)
BODY="$(HOST="$HOST" SERIAL="$SERIAL" MANU="$MANU" MODEL="$MODEL" OS="$OS" CPU="$CPU" \
        RAM_GB="$RAM_GB" MAC="$MAC" IP="$IP" SOFTWARE="$SOFTWARE" python3 - <<'PY'
import os, json
sw = [l.strip() for l in os.environ.get("SOFTWARE","").splitlines() if l.strip()]
try: ram = float(os.environ.get("RAM_GB") or 0)
except ValueError: ram = 0
print(json.dumps({
  "hostname": os.environ.get("HOST",""),
  "serial_number": os.environ.get("SERIAL") or None,
  "asset_type": "hardware",
  "manufacturer": os.environ.get("MANU") or None,
  "model": os.environ.get("MODEL") or None,
  "os": os.environ.get("OS") or None,
  "cpu": os.environ.get("CPU") or None,
  "ram_gb": ram,
  "mac": os.environ.get("MAC") or None,
  "ip": os.environ.get("IP") or None,
  "software": sw,
}))
PY
)"

curl -s -X POST "$API_URL/api/v1/inventory" \
  -H "x-api-key: $TOKEN" -H "Content-Type: application/json" \
  -d "$BODY"
echo
