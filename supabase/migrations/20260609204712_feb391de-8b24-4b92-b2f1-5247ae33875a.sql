
-- ============ b2b_pipeline ============
CREATE TABLE public.b2b_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa TEXT NOT NULL,
  responsavel TEXT NOT NULL DEFAULT 'Otávio',
  valor_estimado NUMERIC(14,2) NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'prospeccao',
  proxima_acao TEXT,
  proxima_acao_data DATE,
  notas TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.b2b_pipeline TO anon, authenticated;
GRANT ALL ON public.b2b_pipeline TO service_role;
ALTER TABLE public.b2b_pipeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read b2b_pipeline"   ON public.b2b_pipeline FOR SELECT USING (true);
CREATE POLICY "anon insert b2b_pipeline" ON public.b2b_pipeline FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update b2b_pipeline" ON public.b2b_pipeline FOR UPDATE USING (true);
CREATE POLICY "anon delete b2b_pipeline" ON public.b2b_pipeline FOR DELETE USING (true);
CREATE TRIGGER trg_b2b_pipeline_updated_at BEFORE UPDATE ON public.b2b_pipeline
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ b2b_distributors ============
CREATE TABLE public.b2b_distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  sub_canal TEXT NOT NULL DEFAULT 'distribuidores',
  ultimo_pedido_data DATE,
  ticket_medio NUMERIC(14,2) NOT NULL DEFAULT 0,
  receita_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo',
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.b2b_distributors TO anon, authenticated;
GRANT ALL ON public.b2b_distributors TO service_role;
ALTER TABLE public.b2b_distributors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read b2b_distributors"   ON public.b2b_distributors FOR SELECT USING (true);
CREATE POLICY "anon insert b2b_distributors" ON public.b2b_distributors FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update b2b_distributors" ON public.b2b_distributors FOR UPDATE USING (true);
CREATE POLICY "anon delete b2b_distributors" ON public.b2b_distributors FOR DELETE USING (true);
CREATE TRIGGER trg_b2b_distributors_updated_at BEFORE UPDATE ON public.b2b_distributors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ b2b_orders ============
CREATE TABLE public.b2b_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_data DATE NOT NULL DEFAULT CURRENT_DATE,
  cliente TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'novo',
  responsavel TEXT NOT NULL DEFAULT 'Otávio',
  canal TEXT NOT NULL DEFAULT 'distribuidores',
  distribuidor_id UUID REFERENCES public.b2b_distributors(id) ON DELETE SET NULL,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.b2b_orders TO anon, authenticated;
GRANT ALL ON public.b2b_orders TO service_role;
ALTER TABLE public.b2b_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read b2b_orders"   ON public.b2b_orders FOR SELECT USING (true);
CREATE POLICY "anon insert b2b_orders" ON public.b2b_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update b2b_orders" ON public.b2b_orders FOR UPDATE USING (true);
CREATE POLICY "anon delete b2b_orders" ON public.b2b_orders FOR DELETE USING (true);
CREATE TRIGGER trg_b2b_orders_updated_at BEFORE UPDATE ON public.b2b_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_b2b_orders_data ON public.b2b_orders(pedido_data DESC);
CREATE INDEX idx_b2b_pipeline_stage ON public.b2b_pipeline(stage, ordem);
