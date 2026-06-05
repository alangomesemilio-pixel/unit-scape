CREATE TABLE public.reports_heads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  head_id text NOT NULL,
  semana text NOT NULL,
  mes text NOT NULL,
  kpis jsonb NOT NULL DEFAULT '{}'::jsonb,
  vitorias text DEFAULT '',
  gargalos text DEFAULT '',
  proxima_acao text DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reports_heads_head_semana ON public.reports_heads(head_id, semana);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports_heads TO anon, authenticated;
GRANT ALL ON public.reports_heads TO service_role;
ALTER TABLE public.reports_heads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read reports" ON public.reports_heads FOR SELECT TO public USING (true);
CREATE POLICY "anon insert reports" ON public.reports_heads FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "anon update reports" ON public.reports_heads FOR UPDATE TO public USING (true);