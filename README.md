# InvestDash — Backend

API Next.js com banco de dados Neon (PostgreSQL).

## Setup

```bash
npm install
cp .env.example .env.local
# preencha as variáveis no .env.local
npm run dev
```

## Schema SQL (execute no Neon)

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  email_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE email_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('confirm', 'reset')),
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('simples', 'composta')),
  principal NUMERIC(15,2) NOT NULL,
  rate NUMERIC(10,4) NOT NULL,
  period INTEGER NOT NULL,
  final_amount NUMERIC(15,2) NOT NULL,
  profit NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Rotas

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/auth/register | Cadastro |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| POST | /api/auth/refresh | Renovar token |
| GET | /api/auth/confirm-email | Confirmar e-mail |
| POST | /api/auth/forgot-password | Solicitar reset de senha |
| POST | /api/auth/reset-password | Redefinir senha |
| POST | /api/auth/resend-confirmation | Reenviar e-mail de confirmação |
| GET | /api/profile | Buscar perfil |
| PUT | /api/profile | Atualizar nome |
| PUT | /api/profile/change-password | Alterar senha |
| GET | /api/investments | Listar investimentos |
| POST | /api/investments | Criar investimento |
| DELETE | /api/investments/:id | Remover investimento |
