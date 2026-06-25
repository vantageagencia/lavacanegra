# Dashboard La Vaca Negra

Painel de reservas, ocupação e CRM do restaurante La Vaca Negra, integrado ao
agente de WhatsApp (Olivia) via n8n. Construído pela VANTAGE.

## Stack

- **Next.js 16** (App Router, `proxy.ts` no lugar de middleware) + React 19
- **Supabase** — banco, auth (email/senha) e realtime
- **Tailwind 4** + shadcn/ui
- **n8n** — webhook que cria reservas (mesmo fluxo da Olivia)
- Deploy na **Vercel** (região `gru1`)

## Rodando localmente

```bash
npm install
npm run dev      # http://localhost:3000
```

Precisa de um `.env.local` com:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...   # chave anon (client/login)
SUPABASE_SERVICE_ROLE_KEY=...              # service role (só server-side)
N8N_DASHBOARD_WEBHOOK_URL=...              # webhook do n8n que cria reserva
N8N_DASHBOARD_TOKEN=...                    # token enviado no header X-Dashboard-Token
```

## Estrutura

- `src/app/(app)/` — páginas autenticadas (Reservas, Mapa, Visão geral, Clientes, Gestão)
- `src/app/api/relatorios/[tipo]/` — geração de CSV/PDF (server-side)
- `src/lib/auth.ts` — `getUserRole`, `requireAdmin`, `assertAdmin`, `assertAuth`
- `src/lib/supabase/` — clients (browser, server, admin/service-role, proxy)

## Papéis (roles)

- **admin_geral / admin** — acesso total; só `admin_geral` cria/remove outros admins
- **user** (colaborador da porta) — vê só Reservas, em **modo porta** (cards touch
  com Chegou / Não veio / Cancelou) + a fila de **pendentes de marcação**

## Deploy

Deploy é **manual** via Vercel CLI (não há auto-deploy no push):

```bash
vercel deploy            # preview (URL de teste)
vercel deploy --prod     # produção (la-vaca-dashboard.vercel.app)
```

> As variáveis de ambiente estão cadastradas em Production, Preview e Development
> no projeto da Vercel.
