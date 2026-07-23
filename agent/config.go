package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// Config del agente. Se lee de un archivo local (config.yaml). El token NUNCA
// va embebido en el binario: siempre sale de este archivo.
type Config struct {
	ServerURL string // ej. https://hexdesk.fernandobolivar.app
	Token     string // token del endpoint (mostrado una sola vez al dar de alta)
}

// Rutas por defecto del config según SO (se pueden sobreescribir con --config).
func defaultConfigPath() string {
	if isWindows() {
		return `C:\ProgramData\HexDeskAgent\config.yaml`
	}
	return "/etc/hexdesk-agent/config.yaml"
}

// Parser YAML mínimo (solo `clave: valor`, con comillas opcionales). Evita
// depender de una librería de YAML para mantener el binario sin dependencias.
func loadConfig(path string) (*Config, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("no se pudo abrir el config %s: %w", path, err)
	}
	defer f.Close()

	cfg := &Config{}
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.Index(line, ":")
		if idx < 0 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		val := strings.TrimSpace(line[idx+1:])
		val = strings.Trim(val, `"'`)
		switch key {
		case "server_url":
			cfg.ServerURL = strings.TrimRight(val, "/")
		case "token":
			cfg.Token = val
		}
	}
	if err := sc.Err(); err != nil {
		return nil, err
	}
	if cfg.ServerURL == "" || cfg.Token == "" {
		return nil, fmt.Errorf("config incompleto: server_url y token son obligatorios")
	}
	return cfg, nil
}
