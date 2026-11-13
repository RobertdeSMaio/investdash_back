-- InvestDash — migração para o deploy de 2026-11-13
--
-- RODE ANTES do deploy do backend (e pode rodar de novo depois: é idempotente).
--
-- O código passou a usar email_tokens.used_at e refresh_tokens.revoked_at
-- (como em schema.sql). Bancos criados por versões antigas podem ter apenas as
-- colunas booleanas "used"/"revoked"; nesse caso os valores são copiados para
-- as novas colunas, para que tokens já usados/revogados continuem inválidos.
-- As colunas antigas são mantidas (o código anterior continua funcionando
-- durante a janela de deploy).

BEGIN;

ALTER TABLE email_tokens   ADD COLUMN IF NOT EXISTS used_at    TIMESTAMPTZ;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE users          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'email_tokens' AND column_name = 'used'
  ) THEN
    EXECUTE 'UPDATE email_tokens SET used_at = NOW()
             WHERE used = TRUE AND used_at IS NULL';
    EXECUTE 'ALTER TABLE email_tokens ALTER COLUMN used SET DEFAULT FALSE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'refresh_tokens' AND column_name = 'revoked'
  ) THEN
    EXECUTE 'UPDATE refresh_tokens SET revoked_at = NOW()
             WHERE revoked = TRUE AND revoked_at IS NULL';
    EXECUTE 'ALTER TABLE refresh_tokens ALTER COLUMN revoked SET DEFAULT FALSE';
  END IF;
END $$;

-- Consultas frequentes: revogação por usuário e limpeza por expiração.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_tokens_user   ON email_tokens (user_id, type) WHERE used_at IS NULL;

COMMIT;

-- Verificação (deve listar used_at e revoked_at):
-- SELECT table_name, column_name FROM information_schema.columns
-- WHERE table_name IN ('email_tokens','refresh_tokens') ORDER BY 1, 2;
