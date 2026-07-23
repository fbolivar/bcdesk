//go:build windows

package main

import "os/exec"

// Limpia %TEMP% en modo MEJOR ESFUERZO: ignora los archivos en uso (siempre
// hay algunos bloqueados) y termina con éxito. Antes usaba `del`, que devolvía
// exit 1 por cualquier archivo bloqueado y hacía que el comando saliera "failed"
// aunque la limpieza fuera normal.
func cmdCleanTemp() *exec.Cmd {
	return exec.Command("powershell", "-NoProfile", "-Command",
		`Get-ChildItem $env:TEMP -Recurse -Force -ErrorAction SilentlyContinue | `+
			`Remove-Item -Recurse -Force -ErrorAction SilentlyContinue; exit 0`)
}

// Chequeo de disco de SOLO LECTURA (/scan no bloquea el volumen).
func cmdDiskCheck() *exec.Cmd {
	return exec.Command("cmd", "/c", "chkdsk C: /scan")
}

// Reinicia un servicio de Windows. name ya viene validado (regex) desde runCommand.
func cmdRestartService(name string) *exec.Cmd {
	// net stop/start es más simple y reinicia dependencias con /y.
	return exec.Command("cmd", "/c", "net stop \""+name+"\" /y & net start \""+name+"\"")
}
