//go:build windows

package main

import "os/exec"

// Limpia %TEMP% (mejor esfuerzo; ignora archivos en uso).
func cmdCleanTemp() *exec.Cmd {
	return exec.Command("cmd", "/c", `del /q /f /s "%TEMP%\*"`)
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
