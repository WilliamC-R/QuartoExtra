# Controle de Vacância

Sistema de controle de vacância para imóveis de aluguel (Airbnb, Booking, direto), com Next.js 15 e Supabase.

## Funcionalidades

- **Dashboard** — KPIs, ranking de ocupação, gráfico de tendência, alertas
- **Imóveis** — cadastro, edição e exclusão
- **Reservas** — histórico, filtros e cadastro manual
- **Relatórios** — análise por período, gráficos e exportação CSV
- **Importar** — upload CSV e migração do protótipo HTML (localStorage)

## Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com)

## Configuração

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. No **SQL Editor**, execute **todas** as migrations em ordem:
   - `supabase/migrations/001_initial.sql`
   - `supabase/migrations/002_garagens.sql`
   - `supabase/migrations/003_reservas_garagem.sql`
   - `supabase/migrations/004_imoveis_campos.sql`
   - `supabase/migrations/005_reservas_custos.sql`
   - `supabase/migrations/006_garagens_refactor.sql`
   - `supabase/migrations/007_imoveis_grupos.sql`
   - `supabase/migrations/008_campos_fiscais.sql`
   - `supabase/migrations/009_gmail_tokens.sql`
   - `supabase/migrations/010_reservas_gmail.sql`
3. Em **Settings → API**, copie a **Project URL** e a **anon public key**

### 2. Variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Preencha `.env.local` com suas credenciais:

| Variável | Obrigatória | Onde obter |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim (gestão de contas) | Supabase → Settings → API → service_role |
| `NEXT_PUBLIC_APP_URL` | Sim (Gmail) | URL do app (ex.: `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Integração Gmail | [Google Cloud Console](https://console.cloud.google.com) |
| `GOOGLE_CLIENT_SECRET` | Integração Gmail | [Google Cloud Console](https://console.cloud.google.com) |

> **Nunca** commite o arquivo `.env.local`. Ele já está no `.gitignore`.

### 3. Instalar e rodar

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000), crie uma conta e comece a usar.

## Migrar dados do HTML antigo

Se você usou `vacancy_control_system.html` no mesmo navegador:

1. Faça login no app Next.js
2. Vá em **Importar**
3. Clique em **Migrar dados do localStorage**

## Deploy

### Vercel

1. Conecte o repositório na [Vercel](https://vercel.com)
2. Adicione as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy

### Supabase Auth

Em **Authentication → URL Configuration**, adicione a URL de produção (ex.: `https://seu-app.vercel.app`) em **Site URL** e **Redirect URLs**.

## Estrutura

```
app/              # Rotas Next.js (App Router)
components/       # UI e views
lib/              # Supabase, métricas, tipos
styles/           # CSS global (visual do protótipo)
supabase/         # Migrações SQL
```

## Protótipo original

O arquivo [`vacancy_control_system.html`](vacancy_control_system.html) permanece como referência do protótipo com `localStorage`.
