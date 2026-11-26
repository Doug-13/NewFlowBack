-- Fase 1B - executar manualmente no Neon, ANTES de iniciar o backend atualizado.
-- Idempotente apenas se nao houver tabela preexistente com schema diferente.
CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  account_id varchar(100) NOT NULL,
  token_hash varchar(64) NOT NULL UNIQUE,
  expires_at timestamptz(6) NOT NULL,
  revoked_at timestamptz(6),
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_account ON public.auth_sessions (user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiration ON public.auth_sessions (expires_at);
-- Nenhuma exclusao de dados ou alteracao de tabelas existentes.
