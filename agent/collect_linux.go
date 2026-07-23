//go:build linux

package main

import (
	"os"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
	"time"
)

func isWindows() bool { return false }

// CPU%: dos lecturas de /proc/stat separadas por 500ms.
func cpuPct() float64 {
	idle1, total1 := readProcStat()
	time.Sleep(500 * time.Millisecond)
	idle2, total2 := readProcStat()
	dt := total2 - total1
	if dt <= 0 {
		return 0
	}
	di := idle2 - idle1
	return clampPct((1 - float64(di)/float64(dt)) * 100)
}

func readProcStat() (idle, total uint64) {
	b, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0, 0
	}
	for _, line := range strings.Split(string(b), "\n") {
		if strings.HasPrefix(line, "cpu ") {
			fields := strings.Fields(line)[1:]
			for i, f := range fields {
				v, _ := strconv.ParseUint(f, 10, 64)
				total += v
				if i == 3 { // idle
					idle = v
				}
			}
			return
		}
	}
	return
}

func ramPct() float64 {
	b, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0
	}
	var memTotal, memAvail float64
	for _, line := range strings.Split(string(b), "\n") {
		f := strings.Fields(line)
		if len(f) < 2 {
			continue
		}
		v, _ := strconv.ParseFloat(f[1], 64)
		switch f[0] {
		case "MemTotal:":
			memTotal = v
		case "MemAvailable:":
			memAvail = v
		}
	}
	if memTotal == 0 {
		return 0
	}
	return clampPct((1 - memAvail/memTotal) * 100)
}

func diskFreePct() float64 {
	var st syscall.Statfs_t
	if err := syscall.Statfs("/", &st); err != nil {
		return 0
	}
	total := float64(st.Blocks) * float64(st.Bsize)
	free := float64(st.Bavail) * float64(st.Bsize)
	if total == 0 {
		return 0
	}
	return clampPct(free / total * 100)
}

func uptimeSeconds() int64 {
	b, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	f := strings.Fields(string(b))
	if len(f) == 0 {
		return 0
	}
	v, _ := strconv.ParseFloat(f[0], 64)
	return int64(v)
}

func collectMetrics() Metrics {
	return Metrics{CPUPct: cpuPct(), RAMPct: ramPct(), DiskFreePct: diskFreePct(), UptimeSecond: uptimeSeconds()}
}

func collectInventory() Inventory {
	inv := Inventory{OSVersion: linuxOSVersion(), InstalledApps: linuxApps(), Hotfixes: []string{}}
	return inv
}

func linuxOSVersion() string {
	b, err := os.ReadFile("/etc/os-release")
	if err != nil {
		return "Linux"
	}
	for _, line := range strings.Split(string(b), "\n") {
		if strings.HasPrefix(line, "PRETTY_NAME=") {
			return strings.Trim(strings.TrimPrefix(line, "PRETTY_NAME="), `"`)
		}
	}
	return "Linux"
}

// Mejor esfuerzo: dpkg o rpm. Si no hay ninguno, lista vacía.
func linuxApps() []App {
	apps := []App{}
	if out, err := exec.Command("dpkg-query", "-W", "-f=${Package}\t${Version}\n").Output(); err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			p := strings.Split(line, "\t")
			if len(p) == 2 && p[0] != "" {
				apps = append(apps, App{Name: p[0], Version: p[1]})
			}
		}
		return apps
	}
	if out, err := exec.Command("rpm", "-qa", "--qf", "%{NAME}\t%{VERSION}\n").Output(); err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			p := strings.Split(line, "\t")
			if len(p) == 2 && p[0] != "" {
				apps = append(apps, App{Name: p[0], Version: p[1]})
			}
		}
	}
	return apps
}
