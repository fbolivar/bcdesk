# SaaS Factory V4

Template production-ready para crear aplicaciones SaaS con desarrollo asistido por IA. Filosofia Agent-First: el usuario dice que quiere, el agente construye todo.

## Que incluye

- Next.js 16 (App Router) + TypeScript
- Supabase (Database + Auth + RLS)
- Tailwind CSS + shadcn/ui
- 19 Skills de Claude Code (V4 Skills 2.0)
- Playwright CLI para QA automatizado
- AI Templates (Vercel AI SDK v5 + OpenRouter)
- 5 Design Systems listos para usar
- Arquitectura Feature-First optimizada para IA
- Auto-Blindaje: el sistema aprende de cada error

## Quick Start

### 1. Instalar

```bash
npm install
```

### 2. Variables de Entorno

```bash
cp .env.example .env.local
# Editar con credenciales de Supabase
```

### 3. MCPs (Opcional)

```bash
cp .claude/example.mcp.json .mcp.json
# Editar con project ref de Supabase
```

### 4. Desarrollar

```bash
npm run dev
# Auto-detecta puerto disponible (3000-3006)
```

## Tech Stack

```yaml
Runtime: Node.js + TypeScript
Framework: Next.js 16 (App Router)
Database: PostgreSQL/Supabase
Styling: Tailwind CSS 3.4
Components: shadcn/ui
State: Zustand
Validation: Zod
AI Engine: Vercel AI SDK v5 + OpenRouter
Testing: Playwright CLI + MCP
Deploy: Vercel
```

## Arquitectura Feature-First

```
src/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Rutas auth
│   ├── (main)/              # Rutas principales
│   └── layout.tsx
│
├── features/                 # Organizadas por funcionalidad
│   └── [feature]/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       ├── types/
│       └── store/
│
└── shared/                   # Codigo reutilizable
    ├── components/
    ├── hooks/
    ├── lib/
    └── types/
```

## Skills (19 total)

### Para el usuario

| Skill | Que hace |
|-------|----------|
| `/new-app` | Entrevista de negocio → BUSINESS_LOGIC.md |
| `/landing` | Landing page de alta conversion |
| `/add-login` | Auth completo (Email + Google OAuth + profiles + RLS) |
| `/bucle-agentico` | Implementar features complejas por fases |
| `/sprint` | Tareas rapidas sin planificacion |
| `/prp` | Planificar features complejas antes de implementar |
| `/ai [template]` | Agregar IA: chat, RAG, vision, tools |
| `/qa` | QA automatizado con Playwright CLI |
| `/primer` | Inicializar contexto del proyecto |
| `/update-sf` | Actualizar a ultima version |
| `/eject-sf` | Remover SaaS Factory (destructivo) |
| `/skill-creator` | Crear nuevos skills |

### Automaticos (Claude los activa segun la tarea)

backend, frontend, supabase-admin, codebase-analyst, vercel-deployer, documentacion, calidad

## AI Templates

Bloques LEGO para construir features de IA con Vercel AI SDK v5 + OpenRouter:

| Template | Que hace |
|----------|----------|
| setup-base | Configuracion inicial |
| chat | Chat streaming con useChat |
| web-search | Busqueda con :online |
| historial | Persistencia en Supabase |
| vision | Analisis de imagenes |
| tools | Funciones/herramientas |
| rag | pgvector + embeddings |
| single-call | generateText() puntual |
| structured-outputs | generateObject() con Zod |
| generative-ui | LLM decide que componente renderizar |

## Design Systems

5 sistemas visuales listos en `.claude/design-systems/`:

- **Liquid Glass** - iOS-like, transparencias
- **Gradient Mesh** - Degradados fluidos
- **Neumorphism** - Soft UI, sombras suaves
- **Bento Grid** - Grids asimetricos
- **Neobrutalism** - Bold, bordes duros

## Comandos

```bash
npm run dev          # Desarrollo (auto-port 3000-3006)
npm run build        # Build produccion
npm run typecheck    # TypeScript check
npm run lint         # ESLint
```

## Deploy

```bash
# Vercel (recomendado)
npm install -g vercel
vercel
```

Variables en Vercel Dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Estructura .claude/

```
.claude/
├── skills/              # 19 Skills (V4 Skills 2.0)
├── PRPs/                # Product Requirements Proposals
│   │   └── references/  # AI Templates (11 bloques)
├── design-systems/      # 5 sistemas de diseno
├── hooks/               # Scripts en eventos
└── example.mcp.json     # Config de MCPs
```

---

## Módulo RMM (Remote Monitoring & Management) — Fase 1

Monitoreo de equipos de clientes integrado con el módulo de tickets. Un agente
ligero reporta métricas/inventario y ejecuta comandos de un catálogo cerrado;
las alertas se convierten en tickets con SLA.

### Modelo de distribución
El admin distribuye el agente manualmente. No hay auto-registro. Flujo:
1. Activar RMM para un cliente (toggle a nivel `organizations.rmm_enabled`).
2. Dar de alta un endpoint para ese cliente → genera un token (se muestra 1 vez).
3. Instalar el agente con ese token. El `endpoint↔organization` queda fijo.

### Esquema (migraciones `058`, `059`)
`endpoints`, `endpoint_metrics` (TTL 90 días vía pg_cron), `endpoint_inventory`,
`endpoint_commands`, `endpoint_alert_rules`, `endpoint_alert_state`,
`rmm_rate_limits` · columnas `organizations.rmm_enabled` y `tickets.source_endpoint_id`.

**Seguridad de esquema:** RLS en todas las tablas (un cliente solo ve su org);
triggers que hacen `organization_id` inmutable y bloquean el alta si el cliente
no tiene RMM activo; tokens hasheados (SHA-256); escrituras solo por service role.

### Autenticación del agente
El agente habla solo con `/api/rmm/*`. La API hashea su token, deriva el
`endpoint_id` del hash (el agente nunca lo envía) y acota la escritura a ese
endpoint. No usa RLS (no tiene JWT). Rate limiting por tabla (`rmm_rate_limits`).

### API
- Agente (token): `POST /api/rmm/heartbeat`, `POST /api/rmm/inventory`,
  `GET /api/rmm/commands/pending`, `POST /api/rmm/commands/result`.
- Admin (JWT admin): `POST /api/admin/organizations/:id/rmm-toggle`,
  `POST|GET /api/admin/organizations/:id/endpoints`,
  `POST /api/admin/endpoints/:id/disable`,
  `GET /api/admin/endpoints/:id/metrics`,
  `POST /api/admin/endpoints/:id/commands`.
- Cron (`CRON_SECRET`, cada 5 min): `/api/cron/rmm-alerts` — evalúa reglas
  (offline se calcula con `now() - last_seen_at`, no con métricas), crea tickets
  con cooldown anti-duplicado, y expira comandos pendientes de +24h.

### Catálogo de comandos (cerrado, sin ejecución libre)
`clean_temp`, `disk_check` (solo lectura), `restart_service` (service_name
validado). Definido en `src/lib/rmm/commands.ts`.

### Pendiente de Fase 1 (aún NO implementado)
Agente en Go (`/agent`) y la UI (toggle, lista/detalle de endpoints, gráficos).
El backend y el esquema se entregaron primero para revisión.

---

**SaaS Factory V4** | Agent-First. Todo es un Skill.
