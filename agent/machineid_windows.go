//go:build windows

package main

import "golang.org/x/sys/windows/registry"

// machineID: MachineGuid del registro, identificador estable que Windows genera
// en la instalación del SO. Sobrevive a reinstalar el agente y a renombrar el
// equipo. Fallback al hostname si no se puede leer.
func machineID() string {
	k, err := registry.OpenKey(
		registry.LOCAL_MACHINE,
		`SOFTWARE\Microsoft\Cryptography`,
		registry.QUERY_VALUE|registry.WOW64_64KEY,
	)
	if err == nil {
		defer k.Close()
		if guid, _, gerr := k.GetStringValue("MachineGuid"); gerr == nil && guid != "" {
			return "win-" + guid
		}
	}
	return hostnameID()
}
