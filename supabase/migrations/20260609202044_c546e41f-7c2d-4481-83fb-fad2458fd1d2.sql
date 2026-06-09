CREATE TABLE public.melonn_order_deliveries (
  order_id TEXT PRIMARY KEY,
  delivered_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.melonn_order_deliveries TO service_role;
ALTER TABLE public.melonn_order_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.melonn_order_deliveries FOR ALL USING (false) WITH CHECK (false);