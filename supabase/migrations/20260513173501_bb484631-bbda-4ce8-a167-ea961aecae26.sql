create table if not exists public.kpi_week_snapshots (
  week text not null,
  kpi_id text not null,
  value numeric not null,
  closed_at timestamptz not null default now(),
  primary key (week, kpi_id)
);

create table if not exists public.kpi_month_snapshots (
  month text not null,
  kpi_id text not null,
  value numeric not null,
  closed_at timestamptz not null default now(),
  primary key (month, kpi_id)
);

create index if not exists kpi_week_snapshots_kpi_idx on public.kpi_week_snapshots (kpi_id, week);
create index if not exists kpi_month_snapshots_kpi_idx on public.kpi_month_snapshots (kpi_id, month);

alter table public.kpi_week_snapshots enable row level security;
alter table public.kpi_month_snapshots enable row level security;

-- Cockpit interno sem auth ainda: liberado pra anon. Quando auth for ativada, trocar por authenticated.
create policy "anon read week" on public.kpi_week_snapshots for select using (true);
create policy "anon write week" on public.kpi_week_snapshots for insert with check (true);
create policy "anon update week" on public.kpi_week_snapshots for update using (true);

create policy "anon read month" on public.kpi_month_snapshots for select using (true);
create policy "anon write month" on public.kpi_month_snapshots for insert with check (true);
create policy "anon update month" on public.kpi_month_snapshots for update using (true);