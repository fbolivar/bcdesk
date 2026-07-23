package main

func clampPct(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 100 {
		return 100
	}
	// redondear a 2 decimales
	return float64(int(v*100+0.5)) / 100
}
