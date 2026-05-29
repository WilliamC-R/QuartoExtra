-- Tokens OAuth2 do Gmail por usuário
CREATE TABLE IF NOT EXISTS gmail_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token   TEXT NOT NULL,
  refresh_token  TEXT,
  token_expires_at TIMESTAMPTZ,
  last_sync_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own gmail tokens"
  ON gmail_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Rastrear qual email originou cada reserva (evita duplicatas)
ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;

CREATE INDEX IF NOT EXISTS reservas_gmail_msg_idx
  ON reservas (user_id, gmail_message_id)
  WHERE gmail_message_id IS NOT NULL;
