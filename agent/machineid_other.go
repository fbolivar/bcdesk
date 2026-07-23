//go:build !windows

package main

import (
	"os"
	"strings"
)

// machineID: /etc/machine-id (systemd) o el fallback histórico de D-Bus.
// Identificador estable del equipo. Fallback al hostname si no existe.
func machineID() string {
	for _, p := range []string{"/etc/machine-id", "/var/lib/dbus/machine-id"} {
		if b, err := os.ReadFile(p); err == nil {
			if id := strings.TrimSpace(string(b)); id != "" {
				return "linux-" + id
			}
		}
	}
	return hostnameID()
}
