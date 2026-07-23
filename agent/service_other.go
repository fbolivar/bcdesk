//go:build !windows

package main

import (
	"fmt"
	"log"
)

// En Linux/otros el proceso corre directo; la supervisión la hace systemd
// (ver hexdesk-agent.service). Las flags --install-service/--uninstall-service
// solo aplican en Windows.

func runPlatform(configPath string) {
	cfg, err := loadConfig(configPath)
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	runAgent(cfg, make(chan struct{}))
}

func installService(string) error {
	return fmt.Errorf("--install-service solo aplica en Windows; en Linux usa systemd (hexdesk-agent.service)")
}

func uninstallService() error {
	return fmt.Errorf("--uninstall-service solo aplica en Windows; en Linux usa systemd")
}
