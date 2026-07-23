# HexDesk RMM Agent

Agente ligero (Go, **binario único sin dependencias** — solo librería estándar)
que reporta métricas e inventario a HexDesk y ejecuta comandos de un catálogo
cerrado. Toda la comunicación es **saliente** (HTTPS POST/GET); no abre puertos.

- Heartbeat cada **5 min**: CPU%, RAM%, disco libre%, uptime.
- Inventario cada **24 h**: SO, apps instaladas, hotfixes.
- Polling de comandos cada **1 min**: `clean_temp`, `disk_check`, `restart_service`.
- Reintentos con backoff; el proceso nunca muere si el backend no responde.

## Compilar (cross-platform, un solo comando)

Requiere Go 1.21+. Desde `agent/`:

```bash
./build.sh          # genera dist/hexdesk-agent.exe (Windows) y dist/hexdesk-agent (Linux)
```

O manualmente:

```bash
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o dist/hexdesk-agent.exe .
GOOS=linux   GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o dist/hexdesk-agent .
```

## Instalar

En HexDesk: **ficha del cliente → Módulo RMM → Dar de alta endpoint**. Copia el
token (se muestra UNA vez).

### Linux (systemd)

```bash
sudo install -m 0755 dist/hexdesk-agent /usr/local/bin/hexdesk-agent
sudo mkdir -p /etc/hexdesk-agent
sudo cp config.example.yaml /etc/hexdesk-agent/config.yaml
sudo nano /etc/hexdesk-agent/config.yaml     # pega el token
sudo cp hexdesk-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hexdesk-agent
sudo systemctl status hexdesk-agent          # verifica que está corriendo
```

### Windows (Servicio real, auto-arranque + recuperación ante crash)

El propio binario se instala como **Windows Service** (implementa el SCM vía
`golang.org/x/sys/windows/svc`). En **PowerShell como Administrador**:

```powershell
New-Item -ItemType Directory -Force "C:\Program Files\HexDeskAgent" | Out-Null
Copy-Item .\dist\hexdesk-agent.exe "C:\Program Files\HexDeskAgent\"
New-Item -ItemType Directory -Force "C:\ProgramData\HexDeskAgent" | Out-Null
Copy-Item .\config.example.yaml "C:\ProgramData\HexDeskAgent\config.yaml"
notepad "C:\ProgramData\HexDeskAgent\config.yaml"   # pega el token y guarda

# Instala el servicio (SERVICE_AUTO_START) y lo arranca. También configura la
# recuperación ante fallo: reinicio a los 60s (x2) y luego cada 5 min.
& "C:\Program Files\HexDeskAgent\hexdesk-agent.exe" `
    --install-service --config "C:\ProgramData\HexDeskAgent\config.yaml"
```

Verificar / operar:

```powershell
Get-Service HexDeskAgent           # estado
sc.exe qc HexDeskAgent             # confirma START_TYPE = AUTO_START
sc.exe qfailure HexDeskAgent       # confirma las acciones de recuperación
Restart-Service HexDeskAgent       # reiniciar manualmente
```

Desinstalar:

```powershell
& "C:\Program Files\HexDeskAgent\hexdesk-agent.exe" --uninstall-service
```

## Verificar

En HexDesk, la lista de endpoints del cliente debe mostrar el equipo como
**online** en pocos minutos, con CPU/RAM/disco.

## Pendiente (Fase 2)

- **Firma de código (Windows):** el `install.cmd` y el `.exe` se descargan sin
  firmar, así que **SmartScreen puede advertir** ("este archivo podría dañar tu
  equipo"). Es manejable (Más info → Ejecutar de todos modos), pero para
  eliminarlo hace falta un certificado de firma de código (~USD 200/año) y
  firmar el binario + el instalador. Anotado para Fase 2.

## Seguridad

- El token vive solo en el `config.yaml` (permisos restringidos recomendados).
- Sin ejecución de texto libre: el agente solo entiende el catálogo cerrado.
- Si se da de baja el endpoint en HexDesk, el token queda invalidado al instante
  (el agente empieza a recibir 401 y deja de reportar).
