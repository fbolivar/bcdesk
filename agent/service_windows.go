//go:build windows

package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

const serviceName = "HexDeskAgent"

// agentService implementa svc.Handler: el SCM lo arranca y detiene.
type agentService struct{ configPath string }

func (s *agentService) Execute(_ []string, r <-chan svc.ChangeRequest, changes chan<- svc.Status) (bool, uint32) {
	changes <- svc.Status{State: svc.StartPending}

	cfg, err := loadConfig(s.configPath)
	if err != nil {
		log.Printf("config: %v", err)
		return true, 1 // svcSpecificError → el SCM aplicará las acciones de recuperación
	}

	stop := make(chan struct{})
	go runAgent(cfg, stop)

	changes <- svc.Status{State: svc.Running, Accepts: svc.AcceptStop | svc.AcceptShutdown}
	for c := range r {
		switch c.Cmd {
		case svc.Interrogate:
			changes <- c.CurrentStatus
		case svc.Stop, svc.Shutdown:
			close(stop)
			changes <- svc.Status{State: svc.StopPending}
			return false, 0
		}
	}
	return false, 0
}

// runPlatform: bajo el SCM corre como servicio; en consola corre directo.
func runPlatform(configPath string) {
	isSvc, err := svc.IsWindowsService()
	if err != nil {
		log.Fatalf("no se pudo determinar el contexto de servicio: %v", err)
	}
	if isSvc {
		if err := svc.Run(serviceName, &agentService{configPath: configPath}); err != nil {
			log.Fatalf("servicio: %v", err)
		}
		return
	}
	// Ejecución interactiva (para pruebas manuales).
	cfg, err := loadConfig(configPath)
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	runAgent(cfg, make(chan struct{}))
}

func installService(configPath string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	exeAbs, _ := filepath.Abs(exe)
	cfgAbs, _ := filepath.Abs(configPath)

	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()

	if existing, err := m.OpenService(serviceName); err == nil {
		existing.Close()
		return fmt.Errorf("el servicio %q ya existe (desinstálalo primero con --uninstall-service)", serviceName)
	}

	// SERVICE_AUTO_START (arranca con Windows).
	svcObj, err := m.CreateService(serviceName, exeAbs, mgr.Config{
		StartType:   mgr.StartAutomatic,
		DisplayName: "HexDesk RMM Agent",
		Description: "Agente de monitoreo remoto de HexDesk.",
	}, "--config", cfgAbs)
	if err != nil {
		return err
	}
	defer svcObj.Close()

	// Recuperación ante crash: reintento a los 60s (x2) y luego cada 5 min.
	// La 3ª acción se repite para fallos posteriores. Contador se resetea a 24h.
	if err := svcObj.SetRecoveryActions([]mgr.RecoveryAction{
		{Type: mgr.ServiceRestart, Delay: 60 * time.Second},
		{Type: mgr.ServiceRestart, Delay: 60 * time.Second},
		{Type: mgr.ServiceRestart, Delay: 5 * time.Minute},
	}, 86400); err != nil {
		log.Printf("aviso: no se pudieron fijar las acciones de recuperación: %v", err)
	}

	return svcObj.Start()
}

func uninstallService() error {
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()

	svcObj, err := m.OpenService(serviceName)
	if err != nil {
		return fmt.Errorf("el servicio %q no está instalado", serviceName)
	}
	defer svcObj.Close()

	_, _ = svcObj.Control(svc.Stop) // mejor esfuerzo; puede que ya esté detenido
	return svcObj.Delete()
}
