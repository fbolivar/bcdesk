//go:build linux

package main

import "os/exec"

// Borra temporales de /tmp con más de 1 día en modo MEJOR ESFUERZO: ignora los
// que no se puedan borrar y termina con éxito (cadena fija, sin entrada de
// usuario → sin riesgo de inyección).
func cmdCleanTemp() *exec.Cmd {
	return exec.Command("sh", "-c", "find /tmp -mindepth 1 -mtime +1 -delete 2>/dev/null; exit 0")
}

// Chequeo de disco de SOLO LECTURA.
func cmdDiskCheck() *exec.Cmd {
	return exec.Command("df", "-h")
}

// Reinicia un servicio de systemd. name ya viene validado (regex) desde runCommand.
func cmdRestartService(name string) *exec.Cmd {
	return exec.Command("systemctl", "restart", name)
}
