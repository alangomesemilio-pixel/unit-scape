CREATE TABLE public.kpis_executivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id text NOT NULL,
  mes text NOT NULL,
  nome text NOT NULL,
  dono text,
  meta numeric NOT NULL DEFAULT 0,
  realizado numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'R$',
  direction text NOT NULL DEFAULT 'up',
  icon text,
  accent text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kpi_id, mes)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpis_executivos TO anon, authenticated;
GRANT ALL ON public.kpis_executivos TO service_role;

ALTER TABLE public.kpis_executivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon read kpis" ON public.kpis_executivos FOR SELECT TO public USING (true);
CREATE POLICY "anon insert kpis" ON public.kpis_executivos FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "anon update kpis" ON public.kpis_executivos FOR UPDATE TO public USING (true);
CREATE POLICY "anon delete kpis" ON public.kpis_executivos FOR DELETE TO public USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_kpis_executivos_updated
BEFORE UPDATE ON public.kpis_executivos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.kpis_executivos (kpi_id, mes, nome, dono, meta, realizado, unit, direction, icon, accent, ordem) VALUES
  ('receita', to_char(now(),'YYYY-MM'), 'Receita Total', 'Alan', 500000, 0, 'R$', 'up', 'DollarSign', '#f28572', 1),
  ('ebitda', to_char(now(),'YYYY-MM'), 'EBITDA', 'Miller', 100000, 0, 'R$', 'up', 'TrendingUp', '#9ad7c5', 2),
  ('roas', to_char(now(),'YYYY-MM'), 'ROAS', 'Fernando', 4, 0, 'x', 'up', 'Target', '#b78cff', 3),
  ('cac', to_char(now(),'YYYY-MM'), 'CAC', 'Luís', 65, 0, 'R$', 'down', 'Users', '#ff9c8f', 4),
  ('recompra', to_char(now(),'YYYY-MM'), 'Taxa Recompra', 'Ian', 38, 0, '%', 'up', 'Repeat', '#d6b4ff', 5),
  ('pipeline_b2b', to_char(now(),'YYYY-MM'), 'Pipeline B2B', 'Igor', 200000, 0, 'R$', 'up', 'Briefcase', '#b78cff', 6),
  ('nps', to_char(now(),'YYYY-MM'), 'NPS', 'Julian', 78, 0, '#', 'up', 'Heart', '#d6b4ff', 7),
  ('creators', to_char(now(),'YYYY-MM'), 'Creators Ativos', 'Vanessa', 30, 0, '#', 'up', 'Sparkles', '#ff9c8f', 8);