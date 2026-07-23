package main

import (
	"os/exec"
	"regexp"
	"strings"
)

// Command es un comando recibido del backend. El agente SOLO entiende el
// catálogo cerrado (clean_temp, disk_check, restart_service). Cualquier otro
// tipo se rechaza — no hay ejecución de texto libre.
type Command struct {
	ID      string         `json:"id"`
	Type    string         `json:"command_type"`
	Payload map[string]any `json:"payload"`
}

type CommandResult struct {
	Stdout   string `json:"stdout"`
	Stderr   string `json:"stderr"`
	ExitCode int    `json:"exit_code"`
}

var serviceNameRe = regexp.MustCompile(`^[A-Za-z0-9_.\- ]{1,64}$`)

// runCommand mapea el tipo a un comando FIJO por plataforma. El payload se
// valida; nunca se interpola texto arbitrario en un shell.
func runCommand(c Command) CommandResult {
	switch c.Type {
	case "clean_temp":
		return execCmd(cmdCleanTemp())
	case "disk_check":
		return execCmd(cmdDiskCheck())
	case "restart_service":
		name, _ := c.Payload["service_name"].(string)
		name = strings.TrimSpace(name)
		if !serviceNameRe.MatchString(name) {
			return CommandResult{Stderr: "service_name inválido", ExitCode: 1}
		}
		return execCmd(cmdRestartService(name))
	default:
		return CommandResult{Stderr: "comando no soportado: " + c.Type, ExitCode: 1}
	}
}

func execCmd(cmd *exec.Cmd) CommandResult {
	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	exit := 0
	if err := cmd.Run(); err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			exit = ee.ExitCode()
		} else {
			exit = 1
			stderr.WriteString(err.Error())
		}
	}
	return CommandResult{
		Stdout:   truncate(stdout.String(), 20000),
		Stderr:   truncate(stderr.String(), 20000),
		ExitCode: exit,
	}
}

func truncate(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}
