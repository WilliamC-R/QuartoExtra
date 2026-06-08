# Guia de Deploy — Gestão de Aluguel

Este documento orienta a configuração completa do projeto em **Supabase** (banco de dados e autenticação) e **Railway** (hospedagem da aplicação Next.js).

---

## Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Supabase — Banco de Dados](#2-supabase--banco-de-dados)
3. [Supabase — Autenticação](#3-supabase--autenticação)
4. [Railway — Deploy da Aplicação](#4-railway--deploy-da-aplicação)
5. [Variáveis de Ambiente](#5-variáveis-de-ambiente)
6. [Primeiro Acesso — Conta do Gestor](#6-primeiro-acesso--conta-do-gestor)
7. [Criação de Contas de Clientes](#7-criação-de-contas-de-clientes)
8. [Integração Gmail (opcional)](#8-integração-gmail-opcional)
9. [Atualização do Sistema (re-deploy)](#9-atualização-do-sistema-re-deploy)
10. [Solução de Problemas](#10-solução-de-problemas)

---

## 1. Pré-requisitos

| Ferramenta | Versão mínima | Onde obter |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Git | qualquer | [git-scm.com](https://git-scm.com) |
| Conta Supabase | — | [supabase.com](https://supabase.com) (plano free suficiente) |
| Conta Railway | — | [railway.app](https://railway.app) |

---

## 2. Supabase — Banco de Dados

### 2.1 Criar o projeto

1. Acesse [supabase.com](https://supabase.com) → **New project**
2. Escolha um nome, senha forte para o banco e a região mais próxima (ex.: `South America (São Paulo)`)
3. Aguarde o projeto inicializar (~2 minutos)

### 2.2 Executar as migrations

Abra o **SQL Editor** (`Dashboard → SQL Editor → New query`) e execute os arquivos abaixo **em ordem**, um por vez. Copie o conteúdo de cada arquivo e clique em **Run**.

> **Atenção:** existem dois arquivos `008_*`. Execute **apenas o `008_campos_fiscais.sql`** — ele já inclui todos os campos do `008_iptu_anual.sql`.

| Ordem | Arquivo | O que faz |
|---|---|---|
| 1 | `supabase/migrations/001_initial.sql` | Cria tabelas `imoveis` e `reservas` com RLS |
| 2 | `supabase/migrations/002_modalidade_aluguel.sql` | Campo `modalidade_aluguel` |
| 3 | `supabase/migrations/003_custos_imovel.sql` | Campos de custos fixos |
| 4 | `supabase/migrations/004_valor_mapa.sql` | Campo `valor_imovel` |
| 5 | `supabase/migrations/005_garagens.sql` | Tabela `garagens` |
| 6 | `supabase/migrations/006_garagem_por_reserva.sql` | Vínculo garagem ↔ reserva |
| 7 | `supabase/migrations/007_reservas_unique_constraint.sql` | Constraint de deduplicação |
| 8 | `supabase/migrations/008_campos_fiscais.sql` | IPTU, ITBI, repasse fiscal |
| 9 | `supabase/migrations/009_custos_reserva.sql` | Custos variáveis por reserva |
| 10 | `supabase/migrations/010_gmail_tokens.sql` | Tokens OAuth Gmail |
| 11 | `supabase/migrations/011_roles_matricula.sql` | **Roles, matrícula, contas de clientes** |

Após cada execução bem-sucedida você verá `Success. No rows returned` ou similar. Se aparecer erro de coluna já existente (`already exists`), pode ignorar e continuar.

### 2.3 Verificar as tabelas

Em **Table Editor**, confirme que existem as tabelas:

- `imoveis` — com o campo `matricula` (não mais `nome`) e `cliente_id`
- `reservas`
- `garagens`
- `gmail_tokens`
- `profiles` — com campos `user_id`, `role`, `nome_completo`

### 2.4 Coletar as chaves de API

Acesse **Settings → API** e copie:

| Campo | Onde está | Uso |
|---|---|---|
| **Project URL** | URL do projeto | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon public** | Chaves de API | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role** | Chaves de API (clique em "Reveal") | `SUPABASE_SERVICE_ROLE_KEY` |

> **Segurança:** a `service_role` ignora RLS e tem acesso total ao banco. Use-a **somente** no servidor (nunca no frontend). No Railway, ela fica como variável de ambiente privada.

---

## 3. Supabase — Autenticação

### 3.1 Configurar URLs permitidas

Acesse **Authentication → URL Configuration**:

| Campo | Valor |
|---|---|
| **Site URL** | URL de produção no Railway (ex.: `https://seu-app.up.railway.app`) |
| **Redirect URLs** | Mesma URL + `/api/gmail/callback` (ex.: `https://seu-app.up.railway.app/api/gmail/callback`) |

Durante desenvolvimento local, adicione também `http://localhost:3000` e `http://localhost:3000/api/gmail/callback`.

### 3.2 Desabilitar signups públicos (recomendado)

Para que apenas o gestor possa criar contas (os clientes são criados via painel `/contas`):

1. **Authentication → Providers → Email**
2. Desabilite **"Enable Email Signup"**

> Isso garante que ninguém crie conta sozinho. O gestor cria as contas dos clientes pelo painel.

### 3.3 Configuração de email (opcional)

Por padrão o Supabase usa o servidor de email deles com limite de 2 emails/hora no plano free. Para produção, configure um provedor externo em **Authentication → SMTP Settings** (ex.: Resend, SendGrid).

---

## 4. Railway — Deploy da Aplicação

### 4.1 Criar o projeto no Railway

1. Acesse [railway.app](https://railway.app) → **New Project**
2. Escolha **Deploy from GitHub repo**
3. Autorize o Railway a acessar seu GitHub e selecione o repositório
4. O Railway detecta automaticamente que é um projeto Next.js

### 4.2 Configurar o serviço

Em **Settings** do serviço:

| Campo | Valor |
|---|---|
| **Build Command** | `npm run build` |
| **Start Command** | `npm run start` |
| **Watch Paths** | (deixar padrão) |

### 4.3 Adicionar as variáveis de ambiente

Em **Variables**, adicione **todas** as variáveis abaixo:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...sua_anon_key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...sua_service_role_key...
NEXT_PUBLIC_APP_URL=https://seu-app.up.railway.app
GOOGLE_CLIENT_ID=seu_client_id (apenas se usar Gmail)
GOOGLE_CLIENT_SECRET=seu_client_secret (apenas se usar Gmail)
```

> **Como obter a URL do Railway:** após o primeiro deploy, acesse **Settings → Networking → Public Domain** e clique em **Generate Domain** se não houver uma.

### 4.4 Fazer o deploy

Após configurar as variáveis:

1. Clique em **Deploy** (ou faça um `git push` — o Railway faz deploy automático)
2. Acompanhe os logs em **Deployments → View Logs**
3. O build leva ~2-3 minutos
4. Quando aparecer `✓ Ready`, o app está no ar

### 4.5 Domínio customizado (opcional)

Em **Settings → Networking → Custom Domain**, adicione seu domínio e configure o CNAME no seu DNS conforme instruções do Railway.

---

## 5. Variáveis de Ambiente

Resumo completo de todas as variáveis necessárias:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Sim** | URL base do projeto Supabase (sem `/rest/v1/` no final) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Sim** | Chave pública anônima do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sim** | Chave de serviço (admin). Usada para criar/remover contas de clientes |
| `NEXT_PUBLIC_APP_URL` | **Sim** | URL pública do app (ex.: `https://seu-app.up.railway.app`) |
| `GOOGLE_CLIENT_ID` | Opcional | Client ID do OAuth Google (integração Gmail) |
| `GOOGLE_CLIENT_SECRET` | Opcional | Client Secret do OAuth Google (integração Gmail) |

Para desenvolvimento local, copie e preencha:

```bash
cp .env.local.example .env.local
```

---

## 6. Primeiro Acesso — Conta do Gestor

Após o deploy:

1. Acesse o app no navegador
2. Clique em **Criar conta** (ou vá em `/signup`)
3. Registre seu email e senha
4. **Importante:** o primeiro usuário criado recebe `role = gestor` automaticamente pela migration `011` (que insere todos os usuários existentes como gestores)

Se precisar promover um usuário existente para gestor manualmente, execute no SQL Editor do Supabase:

```sql
UPDATE public.profiles
SET role = 'gestor'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'seu-email@dominio.com'
);
```

Após login, você terá acesso a todas as abas: Dashboard, Imóveis, Reservas, Relatórios, Garagens, Mapa, Importar, Integrações e **Contas**.

---

## 7. Criação de Contas de Clientes

Cada proprietário de imóvel (investidor) recebe uma conta com acesso limitado à página **Meu Imóvel**.

### Passo a passo

1. Faça login como **gestor**
2. Acesse a aba **Contas** no menu lateral
3. Clique em **Nova conta**
4. Preencha:
   - **Nome completo** do proprietário
   - **Email** que ele usará para login
   - **Senha inicial** (informe ao cliente — ele pode trocar depois)
   - **Imóvel vinculado** — selecione a matrícula do imóvel do cliente
5. Clique em **Criar conta**

O cliente agora pode acessar o app com o email e senha fornecidos. Ele verá apenas:
- Dados do seu imóvel (matrícula, localização, status)
- KPIs de ocupação e receita
- Histórico de reservas

### Regras de acesso

| Ação | Gestor | Cliente |
|---|---|---|
| Dashboard geral | ✅ | ❌ |
| Cadastrar/editar imóveis | ✅ | ❌ |
| Lançar/editar reservas | ✅ | ❌ |
| Ver dados do próprio imóvel | ✅ | ✅ (somente leitura) |
| Ver reservas do próprio imóvel | ✅ | ✅ (somente leitura) |
| Criar contas de clientes | ✅ | ❌ |

---

## 8. Integração Gmail (opcional)

A integração importa reservas automaticamente de emails do Airbnb e Booking.com.

### 8.1 Criar credenciais no Google Cloud

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto (ou use um existente)
3. Ative a **Gmail API**: APIs & Services → Library → procure "Gmail API" → Enable
4. Crie credenciais OAuth 2.0:
   - APIs & Services → Credentials → **Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: `https://seu-app.up.railway.app/api/gmail/callback`
   - Para local: adicione também `http://localhost:3000/api/gmail/callback`
5. Copie o **Client ID** e **Client Secret**

### 8.2 Configurar no Railway

Adicione às variáveis de ambiente:

```
GOOGLE_CLIENT_ID=seu_client_id_aqui
GOOGLE_CLIENT_SECRET=seu_client_secret_aqui
```

### 8.3 Conectar no app

1. Faça login como **gestor**
2. Acesse **Integrações** no menu
3. Clique em **Conectar com Google** e autorize o acesso
4. Use **Sincronizar agora** para importar reservas dos últimos emails

> O parser identifica reservas do Airbnb e Booking.com pelo remetente do email. O imóvel é vinculado automaticamente se o nome do imóvel aparecer no corpo do email. Emails sem correspondência ficam registrados como `noMatch` no resultado do sync.

---

## 9. Atualização do Sistema (re-deploy)

### Aplicar uma nova migration

1. Abra o **SQL Editor** no Supabase
2. Cole o conteúdo do novo arquivo de migration
3. Execute

### Fazer deploy de nova versão do código

Se o repositório estiver conectado ao Railway com auto-deploy:

```bash
git push origin main
```

O Railway detecta o push e faz o deploy automaticamente. Acompanhe em **Deployments**.

Para forçar um redeploy manual: Railway → seu serviço → **Redeploy**.

---

## 10. Solução de Problemas

### App abre tela em branco ou dá erro 500

- Verifique se **todas as variáveis de ambiente** estão preenchidas no Railway
- Confira nos logs (`Deployments → View Logs`) qual erro aparece
- As variáveis `NEXT_PUBLIC_*` são embutidas no build — após alterá-las, faça **Redeploy**

### "Configuração de servidor incompleta" ao criar cliente

- A variável `SUPABASE_SERVICE_ROLE_KEY` não está configurada ou está incorreta
- Verifique em Supabase → Settings → API → `service_role` (clique em "Reveal")

### Login redireciona em loop

- Confira se a migration `011_roles_matricula.sql` foi executada (tabela `profiles` precisa existir)
- Verifique se o usuário tem registro na tabela `profiles`:
  ```sql
  SELECT * FROM public.profiles WHERE user_id = auth.uid();
  ```

### "Invalid Redirect URI" no Gmail OAuth

- A `NEXT_PUBLIC_APP_URL` no Railway não bate com o URI cadastrado no Google Cloud Console
- O URI deve ser exatamente: `{NEXT_PUBLIC_APP_URL}/api/gmail/callback`

### Imóvel não aparece para o cliente

- O imóvel precisa ter o campo `cliente_id` preenchido com o `user_id` do cliente
- No painel **Contas**, edite o cliente e vincule o imóvel, ou execute no SQL Editor:
  ```sql
  UPDATE public.imoveis
  SET cliente_id = (SELECT id FROM auth.users WHERE email = 'cliente@email.com')
  WHERE matricula = 'SUA_MATRICULA';
  ```

### Signup público ainda funcionando após desabilitar

- Limpe o cache do navegador ou abra uma aba anônima
- Aguarde ~1 minuto após salvar a configuração no Supabase

---

## Estrutura do projeto

```
app/
  (app)/          # Rotas autenticadas
    dashboard/    # Visão geral do gestor
    imoveis/      # CRUD de imóveis (gestor)
    reservas/     # CRUD de reservas (gestor)
    garagens/     # Gestão de vagas (gestor)
    mapa/         # Hierarquia geográfica (gestor)
    relatorios/   # Análise por período, CSV, PDF (gestor)
    importar/     # Upload CSV e migração (gestor)
    integracoes/  # Conexão Gmail (gestor)
    contas/       # Gestão de clientes (gestor)
    meu-imovel/   # Portal do proprietário (cliente)
  (auth)/
    login/
    signup/
  api/
    gmail/        # OAuth e sync de emails
    accounts/     # Criar/listar/remover clientes

components/       # Componentes de UI por domínio
lib/              # Lógica de negócio, métricas, tipos
supabase/
  migrations/     # 11 migrations SQL em ordem
styles/           # CSS global
```
