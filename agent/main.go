package main

import (
	"encoding/json"
	"flag"
	"log"
	"os"
	"time"
)

const agentVersion = "0.1.0"

func main() {
	configPath := flag.String("config", defaultConfigPath(), "ruta del archivo de config")
	flag.Parse()

	cfg, err := loadConfig(*configPath)
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	client := newClient(cfg, agentVersion)
	host, _ := os.Hostname()

	log.Printf("HexDesk Agent %s iniciando (server=%s, host=%s)", agentVersion, cfg.ServerURL, host)

	// Cada tarea en su propia goroutine. Ninguna mata el proceso: los errores se
	// registran y se reintenta en el siguiente ciclo (el doJSON ya trae backoff).
	go loop(5*time.Minute, true, func() { sendHeartbeat(client, host) })   // métricas
	go loop(24*time.Hour, true, func() { sendInventory(client) })          // inventario
	go loop(1*time.Minute, false, func() { pollCommands(client) })         // comandos

	select {} // los loops corren en goroutines; bloquear el hilo principal.
}

func loop(interval time.Duration, runNow bool, fn func()) {
	if runNow {
		safe(fn)
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	for range t.C {
		safe(fn)
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
