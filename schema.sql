-- InvestDash - Schema completo
-- Execute no Neon ou qualquer PostgreSQL

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Usuários
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(100) NOT NULL,
  email            VARCHAR(255) UNIQUE NOT NULL,
  password         TEXT NOT NULL,
  email_confirmed  BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Tokens de email (confirmação + reset de senha)
CREATE TABLE IF NOT EXISTS email_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  type        VARCHAR(20) NOT NULL CHECK (type IN ('confirm', 'reset')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Carteira de ativos
CREATE TABLE IF NOT EXISTS portfolio (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticker        VARCHAR(20) NOT NULL,
  name          VARCHAR(150) NOT NULL,
  type          VARCHAR(20) NOT NULL CHECK (type IN ('acao','fii','etf','stock','renda_fixa')),
  quantity      NUMERIC(18,6) NOT NULL,
  avg_price     NUMERIC(18,6) NOT NULL,
  contributions NUMERIC(18,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, ticker)
);

-- Simulações (Juros Simples + Compostos)
CREATE TABLE IF NOT EXISTS simulations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                    VARCHAR(100) NOT NULL,
  type                    VARCHAR(10) NOT NULL CHECK (type IN ('simples','composta')),
  principal               NUMERIC(18,2) NOT NULL,
  rate                    NUMERIC(10,4) NOT NULL,
  period                  INTEGER NOT NULL,
  period_unit             VARCHAR(10) NOT NULL DEFAULT 'mensal' CHECK (period_unit IN ('mensal','anual')),
  contribution            NUMERIC(18,2) DEFAULT 0,
  contribution_frequency  VARCHAR(10) DEFAULT 'mensal' CHECK (contribution_frequency IN ('mensal','anual')),
  final_amount            NUMERIC(18,2) NOT NULL,
  total_invested          NUMERIC(18,2) NOT NULL,
  profit                  NUMERIC(18,2) NOT NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Migração: caso já tenha a tabela investments antiga
-- ALTER TABLE investments RENAME TO simulations_old;
-- Ou para adicionar colunas novas em simulations existente:
-- ALTER TABLE simulations ADD COLUMN IF NOT EXISTS period_unit VARCHAR(10) DEFAULT 'mensal';
-- ALTER TABLE simulations ADD COLUMN IF NOT EXISTS contribution NUMERIC(18,2) DEFAULT 0;
-- ALTER TABLE simulations ADD COLUMN IF NOT EXISTS contribution_frequency VARCHAR(10) DEFAULT 'mensal';
-- ALTER TABLE simulations ADD COLUMN IF NOT EXISTS total_invested NUMERIC(18,2);
-- UPDATE simulations SET total_invested = principal WHERE total_invested IS NULL;
