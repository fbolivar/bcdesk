// Sube los binarios del agente al bucket público rmm-agent de Supabase Storage.
// Correr desde la raíz de la app:  node scripts/upload-agent-binaries.mjs
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const BUCKET = 'rmm-agent'

const create = await sb.storage.createBucket(BUCKET, { public: true })
console.log('createBucket:', create.error ? create.error.message : 'ok')

const files = [
  ['agent/dist/hexdesk-agent.exe', 'hexdesk-agent-0.1.1-windows-amd64.exe'],
  ['agent/dist/hexdesk-agent-linux-amd64', 'hexdesk-agent-0.1.1-linux-amd64'],
]
for (const [local, remote] of files) {
  const data = readFileSync(resolve(local))
  const up = await sb.storage.from(BUCKET).upload(remote, data, { contentType: 'application/octet-stream', upsert: true })
  console.log('upload', remote, ':', up.error ? up.error.message : `ok (${(data.length / 1048576).toFixed(1)} MB)`)
  console.log('   ', sb.storage.from(BUCKET).getPublicUrl(remote).data.publicUrl)
}
