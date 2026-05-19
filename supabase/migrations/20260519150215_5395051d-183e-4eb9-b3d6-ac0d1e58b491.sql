CREATE TABLE public.soma_kv (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.soma_kv ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read soma_kv" ON public.soma_kv FOR SELECT USING (true);