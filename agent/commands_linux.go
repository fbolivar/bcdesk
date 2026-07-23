//go:build linux

package main

import "os/exec"

// Borra archivos temporales de /tmp con más de 1 día (no toca lo reciente).
func cmdCleanTemp() *exec.Cmd {
	return exec.Command("find", "/tmp", "-mindepth", "1", "-mtime", "+1", "-delete")
}

// Chequeo de disco de SOLO LECTURA.
func cmdDiskCheck() *exec.Cmd {
	return exec.Command("df", "-h")
}

// Reinicia un servicio de systemd. name ya viene validado (regex) desde runCommand.
func cmdRestartService(name string) *exec.Cmd {
	return exec.Command("systemctl", "restart", name)
}
