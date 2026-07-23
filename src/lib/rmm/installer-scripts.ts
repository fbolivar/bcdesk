/**
 * Generadores de los scripts de instalación del agente RMM. Son funciones PURAS
 * (testeables): reciben server_url, token, url del binario y hostname, y
 * devuelven el contenido del install.cmd (Windows) o install.sh (Linux).
 *
 * El binario NO va embebido: el script lo descarga del bucket público. Lo único
 * secreto es el token, que va en el config.yaml que el script escribe.
 *
 * En caso de fallo, ambos scripts imprimen la RUTA EXACTA del log a enviar
 * (para que alguien no técnico pueda mandarlo sin guía telefónica).
 */

export interface InstallerParams {
  serverUrl: string
  token: string
  binaryUrl: string
  hostname?: string | null
}

// ─── Windows: install.cmd (auto-eleva + PowerShell en -EncodedCommand) ──────────

/** Script PowerShell que hace la instalación completa (se codifica en base64). */
function windowsPowerShell(p: InstallerParams): string {
  const cfg = `"server_url: ""${p.serverUrl}""\`ntoken: ""${p.token}""\`n"`
  return [
    // NO se usa $ErrorActionPreference='Stop' global: en Windows PowerShell 5.1
    // eso hace que CUALQUIER escritura a stderr de un programa nativo (el agente
    // escribe sus mensajes de estado a stderr) aborte con excepcion. En su lugar,
    // cada cmdlet lleva -ErrorAction Stop y los comandos nativos se controlan por
    // $LASTEXITCODE.
    `New-Item -ItemType Directory -Force 'C:\\ProgramData\\HexDeskAgent' | Out-Null`,
    `Start-Transcript -Path 'C:\\ProgramData\\HexDeskAgent\\install-log.txt' -Force | Out-Null`,
    `try {`,
    `  Write-Host 'Instalando HexDesk RMM Agent...'`,
    `  New-Item -ItemType Directory -Force 'C:\\Program Files\\HexDeskAgent' | Out-Null`,
    `  $exe = 'C:\\Program Files\\HexDeskAgent\\hexdesk-agent.exe'`,
    // Reinstalación idempotente: si ya existe, detener + desinstalar el servicio
    // ANTES de descargar (un .exe en ejecución está bloqueado y no se puede sobrescribir).
    `  if (Test-Path $exe) {`,
    `    Write-Host 'Quitando instalacion previa...'`,
    `    Stop-Service HexDeskAgent -ErrorAction SilentlyContinue`,
    // 2>&1 fusiona stderr como TEXTO (no como error): el agente escribe sus
    // mensajes de estado a stderr y con ErrorActionPreference=Stop eso abortaba.
    `    & $exe --uninstall-service 2>&1 | Out-Null`,
    // Esperar a que el SCM elimine el servicio (borrado asíncrono) hasta ~15s.
    `    for ($i=0; $i -lt 15; $i++) { if (-not (Get-Service HexDeskAgent -ErrorAction SilentlyContinue)) { break }; Start-Sleep -Seconds 1 }`,
    `  }`,
    `  Write-Host 'Descargando agente...'`,
    `  Invoke-WebRequest -Uri '${p.binaryUrl}' -OutFile $exe -UseBasicParsing -ErrorAction Stop`,
    `  $cfg = ${cfg}`,
    // IMPORTANTE: escribir SIN BOM. Set-Content -Encoding utf8 en PowerShell 5.1
    // agrega un BOM que rompe el parseo del config en el agente (la 1ra clave
    // pasa a ser "\ufeffserver_url"). WriteAllText usa UTF-8 sin BOM.
    `  [System.IO.File]::WriteAllText('C:\\ProgramData\\HexDeskAgent\\config.yaml', $cfg)`,
    `  Write-Host 'Instalando servicio...'`,
    // Capturar salida (stdout+stderr) como texto y revisar el codigo de salida
    // explicitamente, en vez de que el stderr del agente dispare una excepcion.
    `  $out = & $exe --install-service --config 'C:\\ProgramData\\HexDeskAgent\\config.yaml' 2>&1`,
    `  if ($LASTEXITCODE -ne 0) { throw "install-service devolvio codigo $LASTEXITCODE : $out" }`,
    `  Start-Sleep -Seconds 3`,
    `  $svc = Get-Service HexDeskAgent -ErrorAction SilentlyContinue`,
    `  if ($svc -and $svc.Status -eq 'Running') { Write-Host ''; Write-Host 'LISTO: el servicio HexDeskAgent esta corriendo.' -ForegroundColor Green }`,
    `  else { throw "El servicio no quedo corriendo (estado: $($svc.Status))" }`,
    `} catch {`,
    `  Write-Host ''; Write-Host "ERROR: la instalacion fallo: $_" -ForegroundColor Red`,
    `  Write-Host 'Envia este archivo de log a tu proveedor de soporte:' -ForegroundColor Yellow`,
    `  Write-Host '   C:\\ProgramData\\HexDeskAgent\\install-log.txt' -ForegroundColor Yellow`,
    `} finally { Stop-Transcript | Out-Null; Write-Host ''; Read-Host 'Presiona Enter para cerrar' }`,
  ].join('\n')
}

export function buildWindowsInstaller(p: InstallerParams): string {
  // UTF-16LE + base64 = lo que espera powershell -EncodedCommand. Elimina todo
  // problema de comillas/escapes al meter el PowerShell dentro del .cmd.
  const encoded = Buffer.from(windowsPowerShell(p), 'utf16le').toString('base64')
  return [
    `@echo off`,
    `REM Instalador del HexDesk RMM Agent. Doble clic para ejecutar.`,
    `net session >nul 2>&1`,
    `if %errorlevel% neq 0 (`,
    `  echo Solicitando permisos de administrador...`,
    `  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"`,
    `  exit /b`,
    `)`,
    `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
    ``,
  ].join('\r\n')
}

// ─── Linux: install.sh ──────────────────────────────────────────────────────────

const SYSTEMD_UNIT = `[Unit]
Description=HexDesk RMM Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/hexdesk-agent --config /etc/hexdesk-agent/config.yaml
Restart=on-failure
RestartSec=15
StartLimitIntervalSec=300
StartLimitBurst=5
User=root

[Install]
WantedBy=multi-user.target`

export function buildLinuxInstaller(p: InstallerParams): string {
  return `#!/usr/bin/env bash
set -euo pipefail
LOG=/var/log/hexdesk-agent-install.log
exec > >(tee -a "$LOG") 2>&1

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecuta con sudo:  sudo bash $0"
  exit 1
fi

fail() {
  echo ""
  echo "ERROR: la instalacion fallo."
  echo "Envia estos logs a tu proveedor de soporte:"
  echo "   $LOG"
  echo "   y la salida de:  journalctl -u hexdesk-agent --no-pager | tail -50"
  exit 1
}
trap fail ERR

echo "Instalando HexDesk RMM Agent..."
mkdir -p /etc/hexdesk-agent
cat > /etc/hexdesk-agent/config.yaml <<'CFG'
server_url: "${p.serverUrl}"
token: "${p.token}"
CFG

echo "Descargando agente..."
curl -fsSL "${p.binaryUrl}" -o /usr/local/bin/hexdesk-agent
chmod +x /usr/local/bin/hexdesk-agent

cat > /etc/systemd/system/hexdesk-agent.service <<'UNIT'
${SYSTEMD_UNIT}
UNIT

systemctl daemon-reload
systemctl enable hexdesk-agent
systemctl restart hexdesk-agent
sleep 3

if systemctl is-active --quiet hexdesk-agent; then
  echo ""
  echo "LISTO: el servicio hexdesk-agent esta corriendo."
else
  fail
fi
`
}

export function installerFilename(os: 'windows' | 'linux', hostname?: string | null): string {
  const safe = (hostname ?? 'equipo').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'equipo'
  return os === 'windows' ? `hexdesk-install-${safe}.cmd` : `hexdesk-install-${safe}.sh`
}
