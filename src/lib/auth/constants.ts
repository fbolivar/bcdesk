/** Constantes de auth sin dependencias de servidor (seguras para el bundle del navegador). */
export const SESSION_COOKIE = 'bcdesk_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 días

// Token de corta vida que SÍ es legible por JS (Realtime + queries del navegador).
// La sesión larga (SESSION_COOKIE) es httpOnly; este se rota en cada navegación.
export const REALTIME_COOKIE = 'bcdesk_rt'
export const REALTIME_TOKEN_MAX_AGE = 60 * 60 * 2 // 2 horas
