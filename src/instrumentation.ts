/**
 * Fija la zona horaria del runtime de servidor a America/Bogota (UTC-5).
 * Vercel reserva la env var `TZ`, así que se establece aquí al arrancar el server.
 * Efecto: date-fns `format()`, `toLocaleString('es-CO')` y `new Date()` renderizan
 * en horario de Colombia. Los instantes se siguen guardando en UTC (timestamptz).
 */
export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    process.env.TZ = 'America/Bogota'
  }
}
