import { describe, it, expect } from 'vitest'
import { buildWindowsInstaller, buildLinuxInstaller, installerFilename } from './installer-scripts'

const P = {
  serverUrl: 'https://hexdesk.fernandobolivar.app',
  token: 'abc123def456token',
  binaryUrl: 'https://proj.supabase.co/storage/v1/object/public/rmm-agent/hexdesk-agent-0.1.1-windows-amd64.exe',
  hostname: 'PC-CONTABILIDAD',
}

describe('buildWindowsInstaller (.cmd)', () => {
  const cmd = buildWindowsInstaller(P)

  it('es un .cmd con auto-elevación y PowerShell en -EncodedCommand', () => {
    expect(cmd).toContain('@echo off')
    expect(cmd).toContain('net session')          // chequeo de admin
    expect(cmd).toContain('-Verb RunAs')           // auto-elevación (UAC)
    expect(cmd).toContain('-EncodedCommand ')
  })

  it('el PowerShell embebido (base64 UTF-16LE) tiene token, server_url, binario, servicio y ruta de log', () => {
    const b64 = cmd.split('-EncodedCommand ')[1].trim().split(/\s/)[0]
    const ps = Buffer.from(b64, 'base64').toString('utf16le')
    expect(ps).toContain(P.token)
    expect(ps).toContain(P.serverUrl)
    expect(ps).toContain(P.binaryUrl)
    expect(ps).toContain('--install-service')
    expect(ps).toContain('--uninstall-service') // reinstalación idempotente
    expect(ps).toContain('Get-Service HexDeskAgent')
    // Ajuste solicitado: en caso de fallo imprime la ruta EXACTA del log.
    expect(ps).toContain('C:\\ProgramData\\HexDeskAgent\\install-log.txt')
    // El config debe escribirse SIN BOM (WriteAllText), no con Set-Content -Encoding utf8
    // que en PS 5.1 agrega BOM y rompe el parseo del agente.
    expect(ps).toContain('WriteAllText')
    expect(ps).not.toContain('$ErrorActionPreference')
  })
})

describe('buildLinuxInstaller (.sh)', () => {
  const sh = buildLinuxInstaller({ ...P, binaryUrl: 'https://x/agent-linux' })

  it('escribe el config con el token, descarga el binario e instala systemd', () => {
    expect(sh).toContain('#!/usr/bin/env bash')
    expect(sh).toContain('id -u')                              // requiere root
    expect(sh).toContain(`server_url: "${P.serverUrl}"`)
    expect(sh).toContain(`token: "${P.token}"`)
    expect(sh).toContain('curl -fsSL "https://x/agent-linux"')
    expect(sh).toContain('systemctl enable hexdesk-agent')
    expect(sh).toContain('systemctl restart hexdesk-agent') // reinstalación idempotente
  })

  it('en fallo apunta a los logs exactos a enviar', () => {
    expect(sh).toContain('/var/log/hexdesk-agent-install.log')
    expect(sh).toContain('journalctl -u hexdesk-agent')
  })
})

describe('instalador genérico (enroll: true)', () => {
  it('Windows escribe enroll_token en vez de token', () => {
    const cmd = buildWindowsInstaller({ ...P, enroll: true })
    const b64 = cmd.split('-EncodedCommand ')[1].trim().split(/\s/)[0]
    const ps = Buffer.from(b64, 'base64').toString('utf16le')
    expect(ps).toContain('enroll_token: ""abc123def456token""')
    expect(ps).not.toMatch(/[^_]token: ""abc123/) // no escribe la clave `token:` suelta
  })

  it('Linux escribe enroll_token en vez de token', () => {
    const sh = buildLinuxInstaller({ ...P, binaryUrl: 'https://x/agent-linux', enroll: true })
    expect(sh).toContain(`enroll_token: "${P.token}"`)
    expect(sh).not.toContain(`\ntoken: "${P.token}"`)
  })
})

describe('installerFilename', () => {
  it('extensión por SO y sanitiza el hostname', () => {
    expect(installerFilename('windows', 'PC-01')).toBe('hexdesk-install-PC-01.cmd')
    expect(installerFilename('linux', 'srv prod!')).toBe('hexdesk-install-srvprod.sh')
    expect(installerFilename('windows', null)).toBe('hexdesk-install-equipo.cmd')
  })
})
