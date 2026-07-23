package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Cliente HTTP del agente. Toda la comunicación es SALIENTE (el agente nunca
// abre puertos entrantes). Añade el token en Authorization: Bearer.
type Client struct {
	cfg  *Config
	http *http.Client
	ver  string
}

func newClient(cfg *Config, version string) *Client {
	return &Client{
		cfg:  cfg,
		http: &http.Client{Timeout: 30 * time.Second},
		ver:  version,
	}
}

// doJSON hace una petición con reintentos + backoff exponencial. NUNCA propaga
// un error que mate el proceso: si el backend no responde, se reintenta; tras
// agotar los reintentos devuelve error y el llamador simplemente espera al
// siguiente ciclo. El agente sigue vivo.
func (c *Client) doJSON(method, path string, body any) (int, []byte, error) {
	var payload []byte
	if body != nil {
		var err error
		payload, err = json.Marshal(body)
		if err != nil {
			return 0, nil, err
		}
	}
	url := c.cfg.ServerURL + path

	backoff := 2 * time.Second
	var lastErr error
	for attempt := 0; attempt < 4; attempt++ {
		if attempt > 0 {
			time.Sleep(backoff)
			if backoff < 60*time.Second {
				backoff *= 2
			}
		}
		req, err := http.NewRequest(method, url, bytes.NewReader(payload))
		if err != nil {
			return 0, nil, err
		}
		req.Header.Set("Authorization", "Bearer "+c.cfg.Token)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "hexdesk-agent/"+c.ver)

		resp, err := c.http.Do(req)
		if err != nil {
			lastErr = err
			continue // error de red → reintentar
		}
		data, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		// 401/403 (token inválido o RMM apagado) no se reintenta: es definitivo
		// para este ciclo. 5xx sí se reintenta.
		if resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("HTTP %d", resp.StatusCode)
			continue
		}
		return resp.StatusCode, data, nil
	}
	return 0, nil, fmt.Errorf("sin respuesta tras reintentos: %w", lastErr)
}
