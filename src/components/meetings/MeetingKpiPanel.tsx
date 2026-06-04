import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { saveWeekSnapshot } from "@/lib/snapshots.functions";
import { shiftWeek, type Weekday } from "@/lib/meetings-data";
import { Target, Save, TrendingUp, TrendingDown, Minus } from "lucide-react";

type Direction = "up" | "down";

interface KpiSpec {
  kpi_id: string;
  nome: string;
  dono: string;
  unit: string;
  direction: Direction;
  defaultMeta: number;
  accent: string;
}

// Mapping each meeting day → its specific KPIs (per spec)
const MEETING_KPIS: Record<Weekday, { groupTitle: string; accent: string; kpis: KpiSpec[] }> = {
  mon: {
    groupTitle: "Reunião Executiva — Alan + Heads",
    accent: "var(--level-ceo, #ef4444)",
    kpis: [
      { kpi_id: "exec_receita_total", nome: "Receita Total", dono: "Alan", unit: "R$", direction: "up", defaultMeta: 500000, accent: "#ef4444" },
      { kpi_id: "exec_ebitda", nome: "EBITDA", dono: "Miller", unit: "R$", direction: "up", defaultMeta: 80000, accent: "#f97316" },
      { kpi_id: "exec_crescimento_mom", nome: "Crescimento MoM", dono: "Alan", unit: "%", direction: "up", defaultMeta: 15, accent: "#22c55e" },
      { kpi_id: "exec_okrs_prazo", nome: "OKRs no prazo", dono: "Heads", unit: "%", direction: "up", defaultMeta: 80, accent: "#a855f7" },
    ],
  },
  tue: {
    groupTitle: "Growth & Branding — Fernando + time",
    accent: "var(--level-head, #8b5cf6)",
    kpis: [
      { kpi_id: "growth_roas", nome: "ROAS", dono: "Fernando", unit: "x", direction: "up", defaultMeta: 3, accent: "#22c55e" },
      { kpi_id: "growth_cac", nome: "CAC", dono: "Fernando", unit: "R$", direction: "down", defaultMeta: 50, accent: "#ef4444" },
      { kpi_id: "growth_pedidos", nome: "Pedidos", dono: "Fernando", unit: "#", direction: "up", defaultMeta: 2500, accent: "#3b82f6" },
      { kpi_id: "growth_creators", nome: "Creators ativos", dono: "Vanessa", unit: "#", direction: "up", defaultMeta: 40, accent: "#ec4899" },
      { kpi_id: "growth_cvr", nome: "CVR", dono: "Fernando", unit: "%", direction: "up", defaultMeta: 2.5, accent: "#a855f7" },
    ],
  },
  wed: {
    groupTitle: "Operações & Supply — Miller + time",
    accent: "var(--level-coo, #06b6d4)",
    kpis: [
      { kpi_id: "ops_sla_entrega", nome: "SLA entrega", dono: "Miller", unit: "%", direction: "up", defaultMeta: 95, accent: "#22c55e" },
      { kpi_id: "ops_margem_bruta", nome: "Margem bruta", dono: "Miller", unit: "%", direction: "up", defaultMeta: 65, accent: "#3b82f6" },
      { kpi_id: "ops_ruptura", nome: "Ruptura estoque", dono: "Carol", unit: "%", direction: "down", defaultMeta: 3, accent: "#ef4444" },
      { kpi_id: "ops_cmv", nome: "CMV", dono: "Miller", unit: "%", direction: "down", defaultMeta: 35, accent: "#f97316" },
    ],
  },
  thu: {
    groupTitle: "B2B — Igor + Otávio",
    accent: "var(--level-intl, #eab308)",
    kpis: [
      { kpi_id: "b2b_receita", nome: "Receita B2B", dono: "Igor", unit: "R$", direction: "up", defaultMeta: 120000, accent: "#22c55e" },
      { kpi_id: "b2b_ticket", nome: "Ticket médio", dono: "Otávio", unit: "R$", direction: "up", defaultMeta: 8000, accent: "#3b82f6" },
      { kpi_id: "b2b_pipeline", nome: "Pipeline", dono: "Igor", unit: "R$", direction: "up", defaultMeta: 350000, accent: "#a855f7" },
      { kpi_id: "b2b_distribuidores", nome: "Distribuidores", dono: "Otávio", unit: "#", direction: "up", defaultMeta: 25, accent: "#ec4899" },
    ],
  },
  fri: {
    groupTitle: "CRM — Ian + Léo Maia",
    accent: "var(--soma-coral, #f472b6)",
    kpis: [
      { kpi_id: "crm_recompra", nome: "Recompra", dono: "Ian", unit: "%", direction: "up", defaultMeta: 25, accent: "#22c55e" },
      { kpi_id: "crm_ltv_cac", nome: "LTV/CAC", dono: "Léo Maia", unit: "x", direction: "up", defaultMeta: 3, accent: "#3b82f6" },
      { kpi_id: "crm_receita_wpp", nome: "Receita WPP", dono: "Ian", unit: "R$", direction: "up", defaultMeta: 40000, accent: "#a855f7" },
      { kpi_id: "crm_nps", nome: "NPS", dono: "Léo Maia", unit: "#", direction: "up", defaultMeta: 70, accent: "#ec4899" },
    ],
  },
};

const monthFromWeek = (weekKey: string): string => {
  // weekKey like 2026-W23 → approximate month by week's Monday
  const [yStr, wStr] = weekKey.split("-W");
  const y = Number(yStr);
  const w = Number(wStr);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const mon = new Date(week1Mon);
  mon.setUTCDate(week1Mon.getUTCDate() + (w - 1) * 7);
  return `${mon.getUTCFullYear()}-${String(mon.getUTCMonth() + 1).padStart(2, "0")}`;
};

function fmt(v: number, unit: string) {
  if (!Number.isFinite(v)) return "—";
  if (unit === "R$") {
    if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
    return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
  }
  if (unit === "%") return `${v.toFixed(1)}%`;
  if (unit === "x") return `${v.toFixed(2)}x`;
  return v.toLocaleString("pt-BR");
}

function pctAtingido(realizado: number, meta: number, direction: Direction) {
  if (!meta) return 0;
  if (direction === "down") {
    if (realizado === 0) return 100;
    return Math.max(0, Math.min(200, (meta / realizado) * 100));
  }
  return Math.max(0, (realizado / meta) * 100);
}

function statusColor(pct: number) {
  if (pct >= 100) return "#a855f7";
  if (pct >= 86) return "#22c55e";
  if (pct >= 60) return "#eab308";
  return "#ef4444";
}

interface Row {
  realizado: number;
  meta: number;
}

interface HistoryPoint {
  week: string;
  value: number | null;
}

export function MeetingKpiPanel({ day, weekKey }: { day: Weekday; weekKey: string }) {
  const config = MEETING_KPIS[day];
  const mes = useMemo(() => monthFromWeek(weekKey), [weekKey]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [history, setHistory] = useState<Record<string, HistoryPoint[]>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const callSaveSnapshot = useServerFn(saveWeekSnapshot);

  // Last 4 weeks (including current)
  const last4Weeks = useMemo(() => {
    const out: string[] = [];
    let cur = weekKey;
    for (let i = 0; i < 4; i++) {
      out.unshift(cur);
      cur = shiftWeek(cur, -1);
    }
    return out;
  }, [weekKey]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoaded(false);
      const ids = config.kpis.map((k) => k.kpi_id);

      // Load current month rows
      const { data: kpiRows } = await supabase
        .from("kpis_executivos")
        .select("kpi_id, realizado, meta")
        .in("kpi_id", ids)
        .eq("mes", mes);

      const map: Record<string, Row> = {};
      config.kpis.forEach((spec) => {
        const found = kpiRows?.find((r) => r.kpi_id === spec.kpi_id);
        map[spec.kpi_id] = {
          realizado: Number(found?.realizado ?? 0),
          meta: Number(found?.meta ?? spec.defaultMeta),
        };
      });

      // Load last 4 weeks of history
      const { data: snaps } = await supabase
        .from("kpi_week_snapshots")
        .select("kpi_id, week, value")
        .in("kpi_id", ids)
        .in("week", last4Weeks);

      const hist: Record<string, HistoryPoint[]> = {};
      config.kpis.forEach((spec) => {
        hist[spec.kpi_id] = last4Weeks.map((w) => {
          const found = snaps?.find((s) => s.kpi_id === spec.kpi_id && s.week === w);
          return { week: w, value: found ? Number(found.value) : null };
        });
      });

      if (!alive) return;
      setRows(map);
      setHistory(hist);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [day, mes, weekKey]);

  const update = (kpi_id: string, patch: Partial<Row>) => {
    setRows((prev) => ({ ...prev, [kpi_id]: { ...prev[kpi_id], ...patch } }));
  };

  const saveKpi = async (spec: KpiSpec) => {
    const row = rows[spec.kpi_id];
    if (!row) return;
    setSaving(spec.kpi_id);
    try {
      // Upsert into kpis_executivos (current month)
      const { error: upErr } = await supabase
        .from("kpis_executivos")
        .upsert(
          {
            kpi_id: spec.kpi_id,
            mes,
            nome: spec.nome,
            dono: spec.dono,
            unit: spec.unit,
            direction: spec.direction,
            realizado: row.realizado,
            meta: row.meta,
            accent: spec.accent,
            ordem: 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "kpi_id,mes" }
        );
      if (upErr) throw new Error(upErr.message);

      // Snapshot for week history
      await callSaveSnapshot({ data: { week: weekKey, values: { [spec.kpi_id]: row.realizado } } });

      // Refresh local history for this kpi
      setHistory((prev) => ({
        ...prev,
        [spec.kpi_id]: prev[spec.kpi_id].map((p) =>
          p.week === weekKey ? { ...p, value: row.realizado } : p
        ),
      }));

      toast.success(`${spec.nome} salvo · semana ${weekKey}`);
    } catch (e) {
      toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(null);
    }
  };

  const saveAll = async () => {
    for (const spec of config.kpis) await saveKpi(spec);
  };

  return (
    <div
      className="rounded-xl border border-border bg-card/60 backdrop-blur p-5"
      style={{
        background: `linear-gradient(135deg, color-mix(in oklch, ${config.accent} 8%, var(--card)), var(--card))`,
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Target className="size-4" style={{ color: config.accent }} />
          <h3 className="text-sm font-bold uppercase tracking-wider">
            {config.groupTitle}
          </h3>
          <span className="text-[10px] text-muted-foreground">· mês {mes}</span>
        </div>
        <Button size="sm" onClick={saveAll} disabled={!loaded || !!saving} style={{ background: config.accent, color: "white" }}>
          <Save className="size-3.5 mr-1" /> Salvar todos
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {config.kpis.map((spec) => {
          const row = rows[spec.kpi_id] ?? { realizado: 0, meta: spec.defaultMeta };
          const pct = pctAtingido(row.realizado, row.meta, spec.direction);
          const color = statusColor(pct);
          const hist = history[spec.kpi_id] ?? [];
          const prev = hist[hist.length - 2]?.value;
          const cur = hist[hist.length - 1]?.value ?? row.realizado;
          const trend =
            prev == null || cur == null
              ? "flat"
              : cur > prev
                ? spec.direction === "up"
                  ? "up-good"
                  : "up-bad"
                : cur < prev
                  ? spec.direction === "up"
                    ? "down-bad"
                    : "down-good"
                  : "flat";

          return (
            <div
              key={spec.kpi_id}
              className="rounded-lg border bg-card/80 p-3 flex flex-col gap-2"
              style={{ borderColor: `${color}40` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{spec.nome}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {spec.dono} · {spec.direction === "up" ? "↑ melhor" : "↓ melhor"}
                  </div>
                </div>
                <div
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
                  style={{ background: `${color}20`, color }}
                >
                  {trend === "up-good" || trend === "down-good" ? (
                    <TrendingUp className="size-3" />
                  ) : trend === "up-bad" || trend === "down-bad" ? (
                    <TrendingDown className="size-3" />
                  ) : (
                    <Minus className="size-3" />
                  )}
                  {pct.toFixed(0)}%
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Realizado</label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={Number.isFinite(row.realizado) ? row.realizado : 0}
                    onChange={(e) => update(spec.kpi_id, { realizado: parseFloat(e.target.value) || 0 })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Meta</label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={Number.isFinite(row.meta) ? row.meta : 0}
                    onChange={(e) => update(spec.kpi_id, { meta: parseFloat(e.target.value) || 0 })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* 4-week history */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Últimas 4 semanas
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {hist.map((p) => {
                    const isCurrent = p.week === weekKey;
                    return (
                      <div
                        key={p.week}
                        className={`rounded text-center py-1 px-0.5 border ${
                          isCurrent ? "border-primary/50 bg-primary/5" : "border-border bg-secondary/30"
                        }`}
                      >
                        <div className="text-[9px] text-muted-foreground font-mono">
                          {p.week.split("-W")[1] ? `W${p.week.split("-W")[1]}` : p.week}
                        </div>
                        <div className="text-[10px] font-semibold truncate">
                          {p.value == null ? "—" : fmt(p.value, spec.unit)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => saveKpi(spec)}
                disabled={saving === spec.kpi_id}
              >
                <Save className="size-3 mr-1" />
                {saving === spec.kpi_id ? "Salvando..." : "Salvar este KPI"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
