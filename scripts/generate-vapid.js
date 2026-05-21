#!/usr/bin/env node
// Genera VAPID keys para push notifications
// Uso: node scripts/generate-vapid.js
// Copia el output a tu .env.local

const webpush = require('web-push')
const keys = webpush.generateVAPIDKeys()

console.log('\n=== VAPID Keys generadas ===\n')
console.log('Copia estas líneas en tu .env.local:\n')
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + keys.publicKey)
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey)
console.log('VAPID_EMAIL=mailto:support@bcfabric.co')
console.log('\n============================\n')
console.log('IMPORTANTE: Nunca compartas VAPID_PRIVATE_KEY ni la subas al repositorio.\n')
