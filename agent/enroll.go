package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"runtime"
	"time"
)

// ensureToken garantiza que cfg.Token esté presente antes de arrancar los ciclos.
// Si el config solo trae enroll_token (instalador GENÉRICO), el agente se
// auto-registra contra /api/rmm/enroll, guarda su token individual en el config
// y continúa. Bloquea con reintentos hasta lograrlo: sin token no hay heartbeat.
func ensureToken(cfg *Config) {
	if cfg.Token != "" {
		return
	}
	backoff := 5 * time.Second
	for {
		tok, err := enroll(cfg)
		if err == nil && tok != "" {
			cfg.Token = tok
			cfg.EnrollToken = ""
			if serr := saveConfig(cfg); serr != nil {
				// Aun sin persistir seguimos con el token en memoria; se reintenta
				// el guardado al próximo arranque si vuelve a hacer falta enrolar.
				log.Printf("enroll: no se pudo guardar el token en el config: %v", serr)
			}
			log.Printf("enroll: equipo registrado correctamente")
			return
		}
		log.Printf("enroll: reintentando en %s (%v)", backoff, err)
		time.Sleep(backoff)
		if backoff < 5*time.Minute {
			backoff *= 2
		}
	}
}

func enroll(cfg *Config) (string, error) {
	host, _ := os.Hostname()
	body, _ := json.Marshal(map[string]any{
		"hostname":   host,
		"os":         runtime.GOOS, // "windows" | "linux"
		"machine_id": machineID(),
	})

	req, err := http.NewRequest("POST", cfg.ServerURL+"/api/rmm/enroll", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.EnrollToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "hexdesk-agent/"+agentVersion)

	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		return "", fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(data))
	}

	var out struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return "", err
	}
	if out.Token == "" {
		return "", fmt.Errorf("respuesta sin token")
	}
	return out.Token, nil
}

// hostnameID: fallback de machine_id cuando no hay identificador de hardware.
// Estable por nombre de equipo (mejor que vacío, que crearía duplicados).
func hostnameID() string {
	h, err := os.Hostname()
	if err != nil || h == "" {
		return ""
	}
	return "host-" + h
}
