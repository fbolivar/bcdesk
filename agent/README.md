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

### Windows (Tarea Programada al inicio, como SYSTEM)

Un binario plano no puede registrarse como "Windows Service real" sin
dependencias, así que se usa el Programador de tareas (arranca al inicio, como
SYSTEM, con reinicio ante fallo). En **PowerShell como Administrador**:

```powershell
New-Item -ItemType Directory -Force "C:\Program Files\HexDeskAgent" | Out-Null
Copy-Item .\dist\hexdesk-agent.exe "C:\Program Files\HexDeskAgent\"
New-Item -ItemType Directory -Force "C:\ProgramData\HexDeskAgent" | Out-Null
Copy-Item .\config.example.yaml "C:\ProgramData\HexDeskAgent\config.yaml"
notepad "C:\ProgramData\HexDeskAgent\config.yaml"   # pega el token y guarda

# Tarea al inicio como SYSTEM, con reinicio ante fallo:
schtasks /Create /TN "HexDeskAgent" /RU SYSTEM /SC ONSTART /RL HIGHEST /F ^
  /TR "\"C:\Program Files\HexDeskAgent\hexdesk-agent.exe\" --config \"C:\ProgramData\HexDeskAgent\config.yaml\""
schtasks /Run /TN "HexDeskAgent"                    # arrancar ya, sin reiniciar
```

Para detener/quitar: `schtasks /End /TN HexDeskAgent` y `schtasks /Delete /TN HexDeskAgent /F`.

## Verificar

En HexDesk, la lista de endpoints del cliente debe mostrar el equipo como
**online** en pocos minutos, con CPU/RAM/disco.

## Seguridad

- El token vive solo en el `config.yaml` (permisos restringidos recomendados).
- Sin ejecución de texto libre: el agente solo entiende el catálogo cerrado.
- Si se da de baja el endpoint en HexDesk, el token queda invalidado al instante
  (el agente empieza a recibir 401 y deja de reportar).
