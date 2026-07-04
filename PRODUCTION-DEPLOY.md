# BCDesk — Runbook de despliegue a producción

> Estado del código: **listo** (build ✅, typecheck ✅, RLS advisors 0 lints ✅, QA 3 perfiles ✅).
> Lo que falta es **operativo**. Sigue este runbook en orden.

---

## 0. Decisión previa: ¿BD nueva o reusar la actual?

La BD actual (`ozakhlzhbxhwfhchobbh`) está llena de **datos demo** (org "BC Security",
usuarios Simon/Pablo, tickets ~1000-1013, facturas ficticias). Además varias tablas se
crearon fuera de las migraciones, por lo que un script de limpieza sería incompleto.

**Recomendado: crear un proyecto Supabase NUEVO para producción** (separación dev/prod limpia).
La BD actual queda como **staging/dev**.

---

## 1. Crear proyecto de producción en Supabase

1. Dashboard > New project (región cercana a tus usuarios, ej. `us-east-1`).
2. Guarda la **DB password**.
3. Copia de *Project Settings > API*: `URL`, `anon key`, `service_role key`, `JWT secret`.

### Aplicar el esquema (migraciones 001–012)
Con un PAT del proyecto nuevo (Dashboard > Account > Tokens):
```bash
PAT=sbp_xxx; REF=<nuevo-ref>
for f in supabase/migrations/0*.sql; do
  echo "== $f =="
  python -c "import json,sys;print(json.dumps({'query':open(sys.argv[1],encoding='utf-8').read()}))" "$f" > /tmp/q.json
  curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
    -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" --data @/tmp/q.json
  echo
done
```
> ⚠️ `seed_admin.sql` NO se aplica automáticamente: úsalo solo para crear el admin real (edita email/nombre antes).

Al terminar: **revoca el PAT**.

---

## 2. Rotar secretos (CRÍTICO)

Durante el desarrollo se compartieron en texto plano el `SUPABASE_JWT_SECRET` y el
`SERVICE_ROLE_KEY`. Con auth propia, **quien tenga el JWT secret puede firmar tokens de admin**.

- Si creas proyecto nuevo (paso 1): sus claves ya son nuevas → **no reutilices** las del proyecto viejo. ✅
- Si REUSAS la BD actual: Dashboard > Project Settings > API > **JWT Settings > Roll JWT secret**.
  Esto regenera `anon` y `service_role`. Actualiza los 3 valores en Vercel y en `.env.local`.

> Recuerda: `SUPABASE_JWT_SECRET` (app) **debe coincidir** con el JWT secret del proyecto,
> porque PostgREST valida con él los tokens que firma la app.

---

## 3. Variables de entorno en Vercel

Ya está preparado `.env.production.local` (gitignored) con:
- ✅ VAPID keys + `CRON_SECRET` / `EMAIL_INBOUND_SECRET` / `WHATSAPP_VERIFY_TOKEN` **generados**.
- `<PENDIENTE>` para Supabase (paso 1/2), `ANTHROPIC_API_KEY`, `RESEND_*` y el dominio.

Completa los `<PENDIENTE>` y súbelas:
```bash
# opción CLI (requiere `vercel link` una vez):
vercel env pull            # ver actuales
# o importar todas a Production desde el archivo:
while IFS='=' read -r k v; do [[ $k =~ ^[A-Z] ]] && printf '%s' "$v" | vercel env add "$k" production; done < .env.production.local
```
> O manualmente: Vercel > Project > Settings > Environment Variables (scope **Production**).

Checklist mínimo requerido para arrancar:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `ANTHROPIC_API_KEY`,
`RESEND_API_KEY`, `RESEND_FROM`, VAPID (4).

---

## 4. Verificar emails (Resend)
- Verifica el **dominio** en Resend (registros DNS SPF/DKIM).
- Prueba real: reset de contraseña e invitación (dependen de Resend).

---

## 5. Backups y monitoreo
- Supabase: activar **PITR / backups diarios**.
- Añadir monitoreo de errores (Sentry) — hoy no hay. *(opcional para v1)*

---

## 6. Merge y deploy (ÚLTIMO)

Solo cuando 1–4 estén hechos (para que el primer deploy no arranque con config rota):
```bash
# revisar y mergear el PR
gh pr view 1 --web
gh pr merge 1 --squash --delete-branch   # o merge desde la UI
```
Vercel desplegará `main` automáticamente. Verifica el dominio + SSL.

---

## Checklist final
- [ ] Proyecto Supabase de prod creado + migraciones 001–012 aplicadas
- [ ] Admin real creado (seed_admin.sql editado)
- [ ] Secretos rotados (JWT/anon/service_role nuevos)
- [ ] Env vars en Vercel (Production) completas
- [ ] Dominio Resend verificado + email de prueba OK
- [ ] Backups/PITR activados
- [ ] PR #1 revisado y mergeado a `main`
- [ ] Deploy verificado (login, crear ticket, RLS por rol)
