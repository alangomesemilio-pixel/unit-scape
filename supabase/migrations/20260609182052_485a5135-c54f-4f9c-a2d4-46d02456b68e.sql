CREATE TABLE public.packaging_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material text NOT NULL,
  quantidade_atual numeric NOT NULL DEFAULT 0,
  minimo numeric NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'un',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.packaging_materials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packaging_materials TO authenticated;
GRANT ALL ON public.packaging_materials TO service_role;

ALTER TABLE public.packaging_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon read packaging" ON public.packaging_materials FOR SELECT TO public USING (true);
CREATE POLICY "anon insert packaging" ON public.packaging_materials FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "anon update packaging" ON public.packaging_materials FOR UPDATE TO public USING (true);
CREATE POLICY "anon delete packaging" ON public.packaging_materials FOR DELETE TO public USING (true);

CREATE TRIGGER update_packaging_materials_updated_at
  BEFORE UPDATE ON public.packaging_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.packaging_materials (material, quantidade_atual, minimo, unidade, ordem) VALUES
  ('Caixas P', 0, 200, 'un', 1),
  ('Caixas M', 0, 200, 'un', 2),
  ('Caixas G', 0, 150, 'un', 3),
  ('Fita adesiva', 0, 20, 'rolos', 4),
  ('Papel de seda', 0, 500, 'folhas', 5),
  ('Etiquetas', 0, 1000, 'un', 6),
  ('Sacolas', 0, 300, 'un', 7);