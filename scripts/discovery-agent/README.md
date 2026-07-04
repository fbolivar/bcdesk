# Agente de descubrimiento CMDB — BCDesk

Estos agentes reportan el hardware/software de un equipo a BCDesk para poblar la
CMDB automáticamente. Se autentican con un **token de descubrimiento** (uno por
organización) y hacen `POST` a `/api/v1/inventory`.

El activo se **crea o actualiza** (match por serial o por hostname dentro de la
organización), marcándolo con `source = discovery` y `last_seen_at`.

## 1. Genera un token
En BCDesk: **Configuración → Descubrimiento → Nuevo token**. Copia el token.

## 2. Ejecuta el agente en el equipo

### Windows (PowerShell)
```powershell
.\discovery-agent.ps1 -ApiUrl "https://tu-dominio.com" -Token "TU_TOKEN"
```
Inventario recurrente (Tarea Programada diaria):
```powershell
$a = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-File C:\ruta\discovery-agent.ps1 -ApiUrl https://tu-dominio.com -Token TU_TOKEN"
$t = New-ScheduledTaskTrigger -Daily -At 9am
Register-ScheduledTask -TaskName "BCDesk CMDB" -Action $a -Trigger $t -RunLevel Highest
```

### Linux (Bash)
```bash
chmod +x discovery-agent.sh
./discovery-agent.sh "https://tu-dominio.com" "TU_TOKEN"
```
Inventario recurrente (cron diario a las 9am):
```
0 9 * * * /ruta/discovery-agent.sh "https://tu-dominio.com" "TU_TOKEN" >/dev/null 2>&1
```
> Serial/fabricante requieren `sudo dmidecode`. Requiere `curl` y `python3`.

## 3. Verifica
Los equipos aparecerán en **CMDB → Inventario** con la etiqueta de descubrimiento.

## Payload (referencia)
```json
{
  "hostname": "PC-001",           // requerido
  "serial_number": "ABC123",
  "asset_type": "hardware",
  "manufacturer": "Dell",
  "model": "OptiPlex 7090",
  "os": "Windows 11 Pro",
  "cpu": "Intel Core i7-11700",
  "ram_gb": 16,
  "mac": "AA:BB:CC:DD:EE:FF",
  "ip": "192.168.1.20",
  "software": ["Google Chrome", "Office 365"]
}
```
Header de autenticación: `x-api-key: TU_TOKEN`.
