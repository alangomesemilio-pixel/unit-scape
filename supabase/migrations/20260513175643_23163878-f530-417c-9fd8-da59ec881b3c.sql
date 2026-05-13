-- Audit log for week closures
CREATE TABLE public.kpi_close_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week text NOT NULL,
  actor text NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  kpi_count integer NOT NULL DEFAULT 0,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX idx_kpi_close_audit_week ON public.kpi_close_audit (week);
CREATE INDEX idx_kpi_close_audit_closed_at ON public.kpi_close_audit (closed_at DESC);

ALTER TABLE public.kpi_close_audit ENABLE ROW LEVEL SECURITY;

-- Public read so the cockpit/governança panel can show the log without auth.
-- Writes happen exclusively via the server function with the service role key.
CREATE POLICY "anon read audit"
ON public.kpi_close_audit
FOR SELECT
TO public
USING (true);