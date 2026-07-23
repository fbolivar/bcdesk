//go:build windows

package main

import (
	"os/exec"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

func isWindows() bool { return true }

var (
	kernel32           = syscall.NewLazyDLL("kernel32.dll")
	procGetSystemTimes = kernel32.NewProc("GetSystemTimes")
	procGlobalMemory   = kernel32.NewProc("GlobalMemoryStatusEx")
	procGetDiskFree    = kernel32.NewProc("GetDiskFreeSpaceExW")
	procGetTickCount64 = kernel32.NewProc("GetTickCount64")
)

type filetime struct{ Low, High uint32 }

func (f filetime) uint64() uint64 { return uint64(f.High)<<32 | uint64(f.Low) }

func systemTimes() (idle, kernel, user uint64) {
	var i, k, u filetime
	procGetSystemTimes.Call(uintptr(unsafe.Pointer(&i)), uintptr(unsafe.Pointer(&k)), uintptr(unsafe.Pointer(&u)))
	return i.uint64(), k.uint64(), u.uint64()
}

// CPU%: dos muestras de GetSystemTimes. kernel incluye idle.
func cpuPct() float64 {
	i1, k1, u1 := systemTimes()
	time.Sleep(500 * time.Millisecond)
	i2, k2, u2 := systemTimes()
	idle := i2 - i1
	busy := (k2 - k1) + (u2 - u1) - idle
	total := busy + idle
	if total == 0 {
		return 0
	}
	return clampPct(float64(busy) / float64(total) * 100)
}

type memoryStatusEx struct {
	Length               uint32
	MemoryLoad           uint32
	TotalPhys            uint64
	AvailPhys            uint64
	TotalPageFile        uint64
	AvailPageFile        uint64
	TotalVirtual         uint64
	AvailVirtual         uint64
	AvailExtendedVirtual uint64
}

// RAM%: dwMemoryLoad ya viene como porcentaje usado.
func ramPct() float64 {
	var m memoryStatusEx
	m.Length = uint32(unsafe.Sizeof(m))
	procGlobalMemory.Call(uintptr(unsafe.Pointer(&m)))
	return clampPct(float64(m.MemoryLoad))
}

func diskFreePct() float64 {
	var freeAvail, total, totalFree uint64
	root, _ := syscall.UTF16PtrFromString(`C:\`)
	procGetDiskFree.Call(
		uintptr(unsafe.Pointer(root)),
		uintptr(unsafe.Pointer(&freeAvail)),
		uintptr(unsafe.Pointer(&total)),
		uintptr(unsafe.Pointer(&totalFree)),
	)
	if total == 0 {
		return 0
	}
	return clampPct(float64(freeAvail) / float64(total) * 100)
}

func uptimeSeconds() int64 {
	r, _, _ := procGetTickCount64.Call()
	return int64(uint64(r) / 1000)
}

func collectMetrics() Metrics {
	return Metrics{CPUPct: cpuPct(), RAMPct: ramPct(), DiskFreePct: diskFreePct(), UptimeSecond: uptimeSeconds()}
}

func collectInventory() Inventory {
	return Inventory{OSVersion: winOSVersion(), InstalledApps: winApps(), Hotfixes: winHotfixes()}
}

func winOSVersion() string {
	out, err := exec.Command("cmd", "/c", "ver").Output()
	if err != nil {
		return "Windows"
	}
	return strings.TrimSpace(string(out))
}

// Apps instaladas vía las claves Uninstall del registro (PowerShell, mejor esfuerzo).
func winApps() []App {
	ps := `Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*, HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\* | Where-Object DisplayName | ForEach-Object { "$($_.DisplayName)` + "`t" + `$($_.DisplayVersion)" }`
	out, err := exec.Command("powershell", "-NoProfile", "-Command", ps).Output()
	if err != nil {
		return []App{}
	}
	apps := []App{}
	for _, line := range strings.Split(string(out), "\n") {
		p := strings.SplitN(strings.TrimRight(line, "\r"), "\t", 2)
		if len(p) >= 1 && strings.TrimSpace(p[0]) != "" {
			ver := ""
			if len(p) == 2 {
				ver = strings.TrimSpace(p[1])
			}
			apps = append(apps, App{Name: strings.TrimSpace(p[0]), Version: ver})
		}
	}
	return apps
}

func winHotfixes() []string {
	out, err := exec.Command("powershell", "-NoProfile", "-Command",
		`Get-HotFix | ForEach-Object { $_.HotFixID }`).Output()
	if err != nil {
		return []string{}
	}
	hf := []string{}
	for _, line := range strings.Split(string(out), "\n") {
		s := strings.TrimSpace(line)
		if s != "" {
			hf = append(hf, s)
		}
	}
	return hf
}
