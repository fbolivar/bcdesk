import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = {}
for (const line of fs.readFileSync('./.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Quitar la allowlist de MIME del bucket (la barrera real es validateUpload en la app).
// Mantener bucket privado + límite de 10 MB.
const { data, error } = await admin.storage.updateBucket('ticket-attachments', {
  public: false,
  fileSizeLimit: 10 * 1024 * 1024,
  allowedMimeTypes: null,
})
console.log('UPDATE:', error ? `FAIL ${error.message}` : 'OK', JSON.stringify(data))

const { data: after } = await admin.storage.getBucket('ticket-attachments')
console.log('AFTER allowed_mime_types:', JSON.stringify(after.allowed_mime_types), '| size_limit:', after.file_size_limit, '| public:', after.public)
