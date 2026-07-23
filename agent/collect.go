package main

// Métricas e inventario recolectados por el agente. La implementación concreta
// vive en collect_linux.go / collect_windows.go (build tags por SO).

type Metrics struct {
	CPUPct       float64 `json:"cpu_pct"`
	RAMPct       float64 `json:"ram_pct"`
	DiskFreePct  float64 `json:"disk_free_pct"`
	UptimeSecond int64   `json:"uptime_seconds"`
}

type Inventory struct {
	OSVersion     string   `json:"os_version"`
	InstalledApps []App    `json:"installed_apps"`
	Hotfixes      []string `json:"hotfixes"`
}

type App struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}
