'use client'

import { useEffect, useRef } from 'react'

/** Fondo animado del mundo auth: red de partículas (canvas) + orbes + malla. */
export function AuthBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

    let w = 0, h = 0, dpr = 1, raf = 0
    type P = { x: number; y: number; r: number; vx: number; vy: number; col: string; a: number }
    let parts: P[] = []

    const init = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = c.width = window.innerWidth * dpr
      h = c.height = window.innerHeight * dpr
      c.style.width = window.innerWidth + 'px'
      c.style.height = window.innerHeight + 'px'
      const n = Math.min(90, Math.floor(window.innerWidth / 16))
      parts = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: (Math.random() * 1.4 + 0.3) * dpr,
        vx: (Math.random() - 0.5) * 0.12 * dpr, vy: (Math.random() - 0.5) * 0.12 * dpr,
        col: Math.random() < 0.5 ? '23,137,252' : '0,212,170', a: Math.random() * 0.5 + 0.2,
      }))
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0; if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fillStyle = `rgba(${p.col},${p.a})`; ctx.fill()
      }
      const max = (120 * dpr) * (120 * dpr)
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i], b = parts[j], dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy
        if (d < max) {
          ctx.strokeStyle = `rgba(79,169,253,${0.12 * (1 - d / max)})`
          ctx.lineWidth = dpr * 0.6
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
        }
      }
      raf = requestAnimationFrame(draw)
    }

    init()
    if (!reduce) draw()
    window.addEventListener('resize', init)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', init) }
  }, [])

  return (
    <>
      <canvas ref={ref} className="auth-canvas" aria-hidden />
      <div className="auth-orb a" aria-hidden />
      <div className="auth-orb b" aria-hidden />
      <div className="auth-orb c" aria-hidden />
      <div className="auth-grid" aria-hidden />
    </>
  )
}
