'use client'

import { useEffect, useRef, useState } from 'react'

const IDS = [1042, 1043, 1051, 1067, 1072, 1088, 1094, 1101]

/** Panel de marca: línea de producción de soporte con tickets animados y KPIs en vivo. */
export function SupportFactory() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [resolved, setResolved] = useState(128)
  const [live, setLive] = useState(6)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const dx = () => track.clientWidth * 0.89
    const spawned: HTMLElement[] = []
    const timers: number[] = []

    const bump = () => setResolved(r => r + 1)

    const spawn = (i: number) => {
      const t = document.createElement('div')
      t.className = 'auth-ticket'
      t.style.setProperty('--dx', dx() + 'px')
      t.innerHTML = `<span class="tk">#</span>${IDS[i % IDS.length]}`
      t.addEventListener('animationiteration', bump)
      track.appendChild(t)
      spawned.push(t)
    }

    if (!reduce) {
      for (let i = 0; i < 5; i++) timers.push(window.setTimeout(() => spawn(i), i * 1400))
    } else {
      spawn(0)
    }

    const liveInt = reduce ? 0 : window.setInterval(() => {
      setLive(4 + Math.floor(Math.abs(Math.sin(Date.now() / 2500)) * 6))
    }, 1600)

    return () => {
      timers.forEach(clearTimeout)
      if (liveInt) clearInterval(liveInt)
      spawned.forEach(el => { el.removeEventListener('animationiteration', bump); el.remove() })
    }
  }, [])

  return (
    <section className="relative hidden lg:flex flex-col justify-between p-11 xl:p-14" style={{ zIndex: 2 }}>
      {/* Logo */}
      <div className="flex items-center gap-3">
        <svg width="36" height="36" viewBox="0 0 100 100" fill="none" aria-label="Fernando Bolívar Buitrago">
          <path d="M50 5 L88 27 L88 73 L50 95 L12 73 L12 27 Z" stroke="#FFFFFF" strokeWidth="6" strokeLinejoin="round" />
          <path d="M50 17 L78 33 L78 67 L50 83 L22 67 L22 33 Z" stroke="#00D4AA" strokeWidth="2.5" strokeLinejoin="round" />
          <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-inter)" fontWeight="800" fontSize="30" fill="#FFFFFF" letterSpacing="-1">FB</text>
        </svg>
        <span className="text-xl font-extrabold tracking-tight"><span className="text-white">Hex</span><span style={{ color: '#00D4AA' }}>Desk</span></span>
      </div>

      {/* Mensaje + fábrica */}
      <div>
        <span className="auth-pill"><span className="dot" />Mesa de ayuda · en vivo</span>
        <h1 className="auth-head">La fábrica<br />de <span className="g">soporte.</span></h1>
        <p className="auth-sub">Cada solicitud entra, se clasifica, se resuelve. Tickets, SLAs, chat y visitas técnicas — orquestados en tiempo real.</p>

        <div className="mt-7 mb-1.5">
          <div className="auth-track" ref={trackRef}>
            <div className="auth-rail" />
            <div className="auth-node" style={{ left: '9%' }}>
              <div className="ring"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v12H5.2L4 17.2z" /></svg></div>
              <div className="lbl">Entrante</div>
            </div>
            <div className="auth-node" style={{ left: '37%' }}>
              <div className="ring"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg></div>
              <div className="lbl">Triage</div>
            </div>
            <div className="auth-node" style={{ left: '64%' }}>
              <div className="ring"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" /></svg></div>
              <div className="lbl">En proceso</div>
            </div>
            <div className="auth-node done" style={{ left: '91%' }}>
              <div className="ring"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6L9 17l-5-5" /></svg></div>
              <div className="lbl">Resuelto</div>
            </div>
          </div>
        </div>

        <div className="flex gap-3.5 flex-wrap items-center mt-2">
          <div className="auth-kpi"><span className="n" style={{ fontVariantNumeric: 'tabular-nums' }}>{resolved}</span><span className="t">resueltos hoy</span></div>
          <div className="auth-kpi"><span className="n blue">99.2%</span><span className="t">SLA cumplido</span></div>
          <div className="auth-kpi"><span className="n">{live}</span><span className="t">en proceso</span></div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ color: '#5F779A', fontSize: 12 }}>
        Operado por <span style={{ color: '#AEBFD4', fontWeight: 600 }}>Fernando Bolívar Buitrago</span> · Consultor en Ciberseguridad
      </div>
    </section>
  )
}
