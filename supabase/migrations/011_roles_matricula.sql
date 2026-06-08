-- ============================================================
-- 011_roles_matricula.sql
-- Adiciona sistema de roles (gestor/cliente) e matricula no imovel
-- ============================================================

-- -------------------------------------------------------
-- 1. Tabela de perfis (roles)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'cliente' CHECK (role IN ('gestor', 'cliente')),
  nome_completo TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Usuário lê apenas seu próprio perfil
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Usuário pode atualizar apenas nome_completo — role é imutável pelo cliente
-- (somente service_role pode mudar o role)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid())
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.handle_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_profile_updated_at();

-- Trigger para criar perfil automaticamente após signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, role, nome_completo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'cliente'),
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', '')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -------------------------------------------------------
-- 2. Renomear nome -> matricula em imoveis
-- -------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'imoveis'
      AND column_name  = 'nome'
  ) THEN
    ALTER TABLE public.imoveis RENAME COLUMN nome TO matricula;
  END IF;
END $$;

-- Garantir que matricula não seja nula
ALTER TABLE public.imoveis ALTER COLUMN matricula SET DEFAULT '';

-- -------------------------------------------------------
-- 3. Adicionar cliente_id em imoveis
-- -------------------------------------------------------
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS imoveis_cliente_id_idx ON public.imoveis(cliente_id);

-- -------------------------------------------------------
-- 4. Atualizar RLS de imoveis
--    Gestor: acesso total via user_id
--    Cliente: somente leitura via cliente_id
-- -------------------------------------------------------
DROP POLICY IF EXISTS "imoveis_select_own" ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_insert_own" ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_update_own" ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_delete_own" ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_select"     ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_insert"     ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_update"     ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_delete"     ON public.imoveis;

CREATE POLICY "imoveis_select" ON public.imoveis
  FOR SELECT USING (
    auth.uid() = user_id        -- gestor vê todos os seus imóveis
    OR auth.uid() = cliente_id  -- cliente vê apenas o imóvel vinculado a ele
  );

CREATE POLICY "imoveis_insert" ON public.imoveis
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "imoveis_update" ON public.imoveis
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "imoveis_delete" ON public.imoveis
  FOR DELETE USING (auth.uid() = user_id);

-- -------------------------------------------------------
-- 5. Atualizar RLS de reservas
--    Cliente pode ler reservas do imóvel dele
-- -------------------------------------------------------
DROP POLICY IF EXISTS "reservas_select_own" ON public.reservas;
DROP POLICY IF EXISTS "reservas_insert_own" ON public.reservas;
DROP POLICY IF EXISTS "reservas_update_own" ON public.reservas;
DROP POLICY IF EXISTS "reservas_delete_own" ON public.reservas;
DROP POLICY IF EXISTS "reservas_select"     ON public.reservas;
DROP POLICY IF EXISTS "reservas_insert"     ON public.reservas;
DROP POLICY IF EXISTS "reservas_update"     ON public.reservas;
DROP POLICY IF EXISTS "reservas_delete"     ON public.reservas;

CREATE POLICY "reservas_select" ON public.reservas
  FOR SELECT USING (
    auth.uid() = user_id
    OR imovel_id IN (
      SELECT id FROM public.imoveis WHERE cliente_id = auth.uid()
    )
  );

CREATE POLICY "reservas_insert" ON public.reservas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reservas_update" ON public.reservas
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "reservas_delete" ON public.reservas
  FOR DELETE USING (auth.uid() = user_id);

-- -------------------------------------------------------
-- 6. Criar perfis para usuários existentes (sem perfil)
-- -------------------------------------------------------
INSERT INTO public.profiles (user_id, role, nome_completo)
SELECT id, 'gestor', COALESCE(raw_user_meta_data->>'nome_completo', email)
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles);
