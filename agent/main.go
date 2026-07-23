package main

import (
	"encoding/json"
	"flag"
	"log"
	"os"
	"time"
)

const agentVersion = "0.1.1"

func main() {
	configPath := flag.String("config", defaultConfigPath(), "ruta del archivo de config")
	install := flag.Bool("install-service", false, "instala el agente como servicio de Windows (auto-arranque + reinicio ante fallo)")
	uninstall := flag.Bool("uninstall-service", false, "desinstala el servicio de Windows")
	flag.Parse()

	if *install {
		if err := installService(*configPath); err != nil {
			log.Fatalf("instalar servicio: %v", err)
		}
		log.Println("Servicio instalado y arrancado.")
		return
	}
	if *uninstall {
		if err := uninstallService(); err != nil {
			log.Fatalf("desinstalar servicio: %v", err)
		}
		log.Println("Servicio desinstalado.")
		return
	}

	// runPlatform decide: en Windows corre bajo el SCM si lo lanzó el servicio,
	// o en consola si se ejecuta a mano. En Linux/otros corre directo.
	runPlatform(*configPath)
}

// runAgent arranca los ciclos y BLOQUEA hasta que se cierra `stop`.
// Ninguna tarea mata el proceso: errores se registran y se reintenta.
func runAgent(cfg *Config, stop <-chan struct{}) {
	client := newClient(cfg, agentVersion)
	host, _ := os.Hostname()
	log.Printf("HexDesk Agent %s iniciando (server=%s, host=%s)", agentVersion, cfg.ServerURL, host)

	go loop(5*time.Minute, true, stop, func() { sendHeartbeat(client, host) }) // métricas
	go loop(24*time.Hour, true, stop, func() { sendInventory(client) })         // inventario
	go loop(1*time.Minute, false, stop, func() { pollCommands(client) })        // comandos

	<-stop
}

func loop(interval time.Duration, runNow bool, stop <-chan struct{}, fn func()) {
	if runNow {
		safe(fn)
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-t.C:
			safe(fn)
		case <-stop:
			return
		}
	}
}

// safe evita que un panic en una tarea tumbe el proceso.
func safe(fn func()) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("recuperado de panic: %v", r)
		}
	}()
	fn()
}

func sendHeartbeat(c *Client, host string) {
	body := map[string]any{
		"hostname":      host,
		"agent_version": agentVersion,
		"metrics":       collectMetrics(),
	}
	code, _, err := c.doJSON("POST", "/api/rmm/heartbeat", body)
	if err != nil {
		log.Printf("heartbeat: %v", err)
		return
	}
	if code != 200 {
		log.Printf("heartbeat HTTP %d", code)
	}
}

func sendInventory(c *Client) {
	code, _, err := c.doJSON("POST", "/api/rmm/inventory", collectInventory())
	if err != nil {
		log.Printf("inventory: %v", err)
		return
	}
	if code != 200 {
		log.Printf("inventory HTTP %d", code)
	}
}

func pollCommands(c *Client) {
	code, data, err := c.doJSON("GET", "/api/rmm/commands/pending", nil)
	if err != nil || code != 200 {
		return
	}
	var resp struct {
		Commands []Command `json:"commands"`
	}
	if json.Unmarshal(data, &resp) != nil {
		return
	}
	for _, cmd := range resp.Commands {
		res := runCommand(cmd)
		status := "done"
		if res.ExitCode != 0 {
			status = "failed"
		}
		c.doJSON("POST", "/api/rmm/commands/result", map[string]any{
			"command_id": cmd.ID,
			"status":     status,
			"result":     res,
		})
	}
}
