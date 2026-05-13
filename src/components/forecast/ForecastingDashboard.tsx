import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  fetchForecastDre,
  analyzeForecastWithAi,
  MONTH_LABELS,
  type DreRow,
  type ForecastDre,
} from "@/lib/forecast.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  FileSpreadsheet,
  Target,
  Activity,
  DollarSign,
  Percent,
  Search,
  ListTree,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
  Cell,
  Area,
} from "recharts";
import { toast } from "sonner";

const KEY_LINES = [
  "(+) Receita Bruta",
  "(=) Receita Líquida",
  "(-) Despesas Variáveis",
  "(-) Despesas Operacionais (OPEX)",
  "(=) LUCRO OPERACIONAL",
];

const OP_LABELS = [
  "Rosa Latina",
  "Dropshiping CO",
  "Dropshiping Global",
  "Nova Glow",
  "Pimenta Rosa",
  "Cashback",
];

// Vibrant, high-contrast palette tuned for a dark navy background.
// Used for per-operation bars, lines, and chips so each operation has a
// distinct color the eye can lock onto.
const OP_PALETTE = [
  "#F5B82E", // amber  - Rosa Latina
  "#22D3EE", // cyan   - Drop CO
  "#A78BFA", // violet - Drop Global
  "#F472B6", // pink   - Nova Glow
  "#34D399", // green  - Pimenta Rosa
  "#60A5FA", // blue   - Cashback
  "#FB923C", // orange - fallback
  "#E879F9", // fuchsia - fallback
];

const COLOR_REAL = "#F5B82E"; // realizado = amber/gold (matches --primary)
const COLOR_PROJ = "#94A3B8"; // projetado = slate
const COLOR_LUCRO = "#34D399"; // lucro    = green
const COLOR_OPEX = "#F87171"; // opex     = red
const COLOR_GRID = "rgba(148, 163, 184, 0.15)";
const COLOR_AXIS = "#94A3B8";

const fmtBRL = (n: number | null | undefined) =>
  n == null
    ? "—"
    : n.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      });

const fmtBRLShort = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `R$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `R$${(n / 1_000).toFixed(0)}k`;
  return `R$${n.toFixed(0)}`;
};

const fmtPct = (n: number | null) =>
  n == null || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(1)}%`;

function findRow(rows: DreRow[], label: string): DreRow | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const target = norm(label);
  return rows.find((r) => norm(r.label) === target);
}

function findOpRows(rows: DreRow[]): DreRow[] {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return OP_LABELS.flatMap((op) => {
    const t = norm(op);
    const found = rows.find((r) => norm(r.label).startsWith(t));
    return found ? [found] : [];
  });
}

function sum(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0);
}

export function ForecastingDashboard() {
  const fetchFn = useServerFn(fetchForecastDre);
  const aiFn = useServerFn(analyzeForecastWithAi);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReply, setAiReply] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["forecast-dre"],
    queryFn: () => fetchFn(),
    staleTime: 60_000,
  });

  const data = q.data as ForecastDre | undefined;

  const summary = useMemo(() => {
    if (!data) return null;
    return {
      receitaBruta: findRow(data.realizado, "(+) Receita Bruta"),
      receitaBrutaProj: findRow(data.projetado, "(+) Receita Bruta"),
      receitaLiq: findRow(data.realizado, "(=) Receita Líquida"),
      receitaLiqProj: findRow(data.projetado, "(=) Receita Líquida"),
      despVar: findRow(data.realizado, "(-) Despesas Variáveis"),
      despVarProj: findRow(data.projetado, "(-) Despesas Variáveis"),
      opex: findRow(data.realizado, "(-) Despesas Operacionais (OPEX)"),
      opexProj: findRow(data.projetado, "(-) Despesas Operacionais (OPEX)"),
      lucro: findRow(data.realizado, "(=) LUCRO OPERACIONAL"),
      lucroProj: findRow(data.projetado, "(=) LUCRO OPERACIONAL"),
    };
  }, [data]);

  const activeMonth = useMemo(() => {
    if (!summary?.receitaBruta) return -1;
    let last = -1;
    for (let i = 0; i < 12; i++) {
      const v = summary.receitaBruta.values[i];
      if (v != null && v !== 0) last = i;
    }
    return last;
  }, [summary]);

  const trendChartData = useMemo(() => {
    if (!summary?.receitaBruta) return [];
    return MONTH_LABELS.map((m, i) => ({
      mes: m,
      Realizado: summary.receitaBruta!.values[i] ?? null,
      Projetado: summary.receitaBrutaProj?.values[i] ?? null,
      Lucro: summary.lucro?.values[i] ?? null,
      OPEX:
        summary.opex?.values[i] != null
          ? Math.abs(summary.opex.values[i] as number)
          : null,
    }));
  }, [summary]);

  const opMix = useMemo(() => {
    if (!data || activeMonth < 0) return [];
    const ops = findOpRows(data.realizado);
    return ops
      .map((r, idx) => ({
        name: r.label.trim(),
        value: r.values[activeMonth] ?? 0,
        ytd: sum(r.values) ?? 0,
        color: OP_PALETTE[idx % OP_PALETTE.length],
      }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [data, activeMonth]);

  const totalMix = opMix.reduce((acc, o) => acc + o.value, 0);

  // Top desvios — biggest gaps (R$) in the active month across key lines
  const topDesvios = useMemo(() => {
    if (!data || activeMonth < 0) return [];
    const out: Array<{
      label: string;
      real: number;
      proj: number;
      gap: number;
      pct: number;
    }> = [];
    for (const key of KEY_LINES) {
      const r = findRow(data.realizado, key);
      const p = findRow(data.projetado, key);
      const rv = r?.values[activeMonth];
      const pv = p?.values[activeMonth];
      if (rv == null || pv == null || pv === 0) continue;
      const gap = rv - pv;
      out.push({ label: key, real: rv, proj: pv, gap, pct: rv / pv });
    }
    return out.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 5);
  }, [data, activeMonth]);

  const handleAi = async () => {
    if (!data) return;
    setAiLoading(true);
    setAiReply(null);
    try {
      const lines: string[] = [];
      lines.push(
        `Mês mais recente com dado: ${activeMonth >= 0 ? MONTH_LABELS[activeMonth] : "n/a"}`,
      );
      for (const key of KEY_LINES) {
        const r = findRow(data.realizado, key);
        const p = findRow(data.projetado, key);
        if (!r) continue;
        lines.push(`\n## ${key}`);
        lines.push(
          `Realizado: ${r.values.map((v, i) => `${MONTH_LABELS[i]}=${v ?? "-"}`).join(" | ")}`,
        );
        if (p)
          lines.push(
            `Projetado: ${p.values.map((v, i) => `${MONTH_LABELS[i]}=${v ?? "-"}`).join(" | ")}`,
          );
      }
      lines.push(
        `\n## Mix de operações (${activeMonth >= 0 ? MONTH_LABELS[activeMonth] : "n/a"})`,
      );
      for (const o of opMix) {
        const pct = totalMix > 0 ? ((o.value / totalMix) * 100).toFixed(1) : "0";
        lines.push(`- ${o.name}: ${fmtBRL(o.value)} (${pct}%) | YTD ${fmtBRL(o.ytd)}`);
      }
      const r = await aiFn({ data: { summary: lines.join("\n") } });
      setAiReply(r.reply);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na análise");
    } finally {
      setAiLoading(false);
    }
  };

  // YTD helpers for KPI cards
  const ytdReal = (row?: DreRow) => row?.total ?? sum(row?.values ?? []);
  const margemOp =
    summary?.lucro && summary?.receitaLiq
      ? (() => {
          const l = ytdReal(summary.lucro);
          const r = ytdReal(summary.receitaLiq);
          return l != null && r != null && r !== 0 ? l / r : null;
        })()
      : null;

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-[1500px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="size-6 text-primary" />
              Forecasting · DRE Consolidada do Grupo
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Realizado vs Projetado mês a mês — fonte: planilha Forec. Geral
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => q.refetch()}
              disabled={q.isFetching}
            >
              <RefreshCw className={`size-4 mr-2 ${q.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={handleAi} disabled={aiLoading || !data}>
              <Sparkles className="size-4 mr-2" />
              {aiLoading ? "Analisando..." : "Analisar com IA"}
            </Button>
          </div>
        </div>

        {q.isLoading && (
          <Card className="p-12 text-center text-muted-foreground">
            Carregando DRE da planilha...
          </Card>
        )}

        {q.error && (
          <Card className="p-6 border-destructive/50 bg-destructive/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-destructive">
                  Não foi possível carregar
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {q.error instanceof Error ? q.error.message : String(q.error)}
                </div>
              </div>
            </div>
          </Card>
        )}

        {data && summary?.receitaBruta && (
          <>
            {/* KPI cards — 6 cards, more financial richness */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard
                icon={<DollarSign className="size-4" />}
                label="Receita Bruta YTD"
                realized={ytdReal(summary.receitaBruta)}
                projected={ytdReal(summary.receitaBrutaProj)}
                accent={COLOR_REAL}
              />
              <KpiCard
                icon={<Activity className="size-4" />}
                label="Receita Líquida YTD"
                realized={ytdReal(summary.receitaLiq)}
                projected={ytdReal(summary.receitaLiqProj)}
                accent="#22D3EE"
              />
              <KpiCard
                icon={<TrendingDown className="size-4" />}
                label="OPEX YTD"
                realized={ytdReal(summary.opex)}
                projected={ytdReal(summary.opexProj)}
                accent={COLOR_OPEX}
                invertGap
              />
              <KpiCard
                icon={<Target className="size-4" />}
                label="Lucro Operacional YTD"
                realized={ytdReal(summary.lucro)}
                projected={ytdReal(summary.lucroProj)}
                accent={COLOR_LUCRO}
              />
              <KpiCard
                icon={<Percent className="size-4" />}
                label="Margem Operacional"
                realized={margemOp}
                projected={null}
                isPct
                accent={COLOR_LUCRO}
                neutralIfNoProj
              />
              <Card className="p-4 border-border/60">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Activity className="size-3.5" /> Mês ativo
                </div>
                <div className="text-xl font-bold mt-1.5">
                  {activeMonth >= 0 ? MONTH_LABELS[activeMonth] : "—"}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {opMix.length} operações ativas
                </div>
              </Card>
            </div>

            {/* Trend chart — Receita + Lucro */}
            <Card className="p-6 border-border/60">
              <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="size-5" style={{ color: COLOR_REAL }} />
                    Tendência mensal — Receita, Lucro e OPEX
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Realizado (linha cheia) vs Projetado (tracejado) · OPEX como área
                  </p>
                </div>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={trendChartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="opexFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLOR_OPEX} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={COLOR_OPEX} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRID} />
                    <XAxis
                      dataKey="mes"
                      stroke={COLOR_AXIS}
                      fontSize={12}
                      tick={{ fill: COLOR_AXIS }}
                    />
                    <YAxis
                      stroke={COLOR_AXIS}
                      fontSize={11}
                      tick={{ fill: COLOR_AXIS }}
                      tickFormatter={(v) => fmtBRLShort(Number(v))}
                    />
                    <Tooltip
                      formatter={(v: number | string) => fmtBRL(Number(v))}
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 10,
                        color: "var(--color-foreground)",
                      }}
                      labelStyle={{ color: "var(--color-foreground)", fontWeight: 600 }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: 8 }}
                      iconType="circle"
                    />
                    <Area
                      type="monotone"
                      dataKey="OPEX"
                      stroke={COLOR_OPEX}
                      strokeWidth={1.5}
                      fill="url(#opexFill)"
                    />
                    <Line
                      type="monotone"
                      dataKey="Realizado"
                      stroke={COLOR_REAL}
                      strokeWidth={3}
                      dot={{ r: 4, fill: COLOR_REAL, strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Projetado"
                      stroke={COLOR_PROJ}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={{ r: 3, fill: COLOR_PROJ, strokeWidth: 0 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Lucro"
                      stroke={COLOR_LUCRO}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: COLOR_LUCRO, strokeWidth: 0 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Top desvios + Mix por operação */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top desvios do mês */}
              <Card className="p-6 border-border/60">
                <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                  <AlertTriangle className="size-5" style={{ color: COLOR_OPEX }} />
                  Top desvios · {activeMonth >= 0 ? MONTH_LABELS[activeMonth] : "—"}
                </h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Linhas com maior diferença Realizado − Projetado (R$)
                </p>
                {topDesvios.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-6 text-center">
                    Sem desvios para o mês selecionado.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {topDesvios.map((d) => {
                      const positive = d.gap >= 0;
                      const isCost = d.label.includes("(-)");
                      const goodDirection = isCost ? !positive : positive;
                      return (
                        <div
                          key={d.label}
                          className="p-3 rounded-lg border border-border/60 bg-card"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-sm truncate">
                              {d.label}
                            </div>
                            <Badge
                              className="font-mono shrink-0"
                              style={{
                                background: goodDirection
                                  ? "rgba(52, 211, 153, 0.18)"
                                  : "rgba(248, 113, 113, 0.18)",
                                color: goodDirection ? COLOR_LUCRO : COLOR_OPEX,
                                border: `1px solid ${
                                  goodDirection ? COLOR_LUCRO : COLOR_OPEX
                                }40`,
                              }}
                            >
                              {positive ? "+" : ""}
                              {fmtBRL(d.gap)}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5">
                            <span>
                              Real {fmtBRL(d.real)} · Proj {fmtBRL(d.proj)}
                            </span>
                            <span className="font-mono font-semibold">
                              {(d.pct * 100).toFixed(0)}% atingido
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Mix por operação */}
              {opMix.length > 0 && (
                <Card className="p-6 border-border/60">
                  <h2 className="text-lg font-semibold mb-1">
                    Mix de receita por operação
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    {MONTH_LABELS[activeMonth]} · total {fmtBRL(totalMix)}
                  </p>
                  <div className="h-56 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={opMix}
                        layout="vertical"
                        margin={{ left: 8, right: 24, top: 4, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={COLOR_GRID}
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          stroke={COLOR_AXIS}
                          fontSize={11}
                          tick={{ fill: COLOR_AXIS }}
                          tickFormatter={(v) => fmtBRLShort(Number(v))}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          stroke={COLOR_AXIS}
                          fontSize={12}
                          tick={{ fill: "#E2E8F0", fontWeight: 600 }}
                          width={130}
                        />
                        <Tooltip
                          formatter={(v: number | string) => fmtBRL(Number(v))}
                          contentStyle={{
                            background: "var(--color-card)",
                            border: "1px solid var(--color-border)",
                            borderRadius: 10,
                          }}
                          labelStyle={{ color: "var(--color-foreground)", fontWeight: 600 }}
                          cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                          {opMix.map((o, i) => (
                            <Cell key={i} fill={o.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5">
                    {opMix.map((o) => {
                      const pct = totalMix > 0 ? (o.value / totalMix) * 100 : 0;
                      return (
                        <div
                          key={o.name}
                          className="flex items-center justify-between p-2.5 rounded-md bg-card border border-border/60"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="size-3 rounded-sm shrink-0"
                              style={{ background: o.color }}
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-sm text-foreground truncate">
                                {o.name}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {fmtBRL(o.value)} · YTD {fmtBRL(o.ytd)}
                              </div>
                            </div>
                          </div>
                          <Badge
                            className="font-mono shrink-0 ml-2"
                            style={{
                              background: `${o.color}22`,
                              color: o.color,
                              border: `1px solid ${o.color}55`,
                            }}
                          >
                            {pct.toFixed(1)}%
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>

            {/* Gap table — high contrast, sticky first column */}
            <Card className="p-6 border-border/60">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-lg font-semibold">
                  Gap Realizado vs Projetado — linhas-chave da DRE
                </h2>
                <div className="text-xs text-muted-foreground flex gap-3">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: COLOR_LUCRO }}
                    />
                    ≥ 100%
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: "#FBBF24" }}
                    />
                    80–99%
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: COLOR_OPEX }}
                    />
                    &lt; 80%
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-secondary/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-2.5 pl-4 pr-3 font-semibold sticky left-0 bg-secondary/90 backdrop-blur z-10 min-w-[200px]">
                        Linha
                      </th>
                      {MONTH_LABELS.map((m, i) => (
                        <th
                          key={m}
                          className={`py-2.5 px-2 font-semibold text-right ${
                            i === activeMonth
                              ? "text-primary bg-primary/10"
                              : ""
                          }`}
                        >
                          {m}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 font-semibold text-right border-l border-border/60">
                        YTD
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {KEY_LINES.map((label, idx) => {
                      const r = findRow(data.realizado, label);
                      const p = findRow(data.projetado, label);
                      if (!r) return null;
                      return (
                        <GapRow
                          key={label}
                          label={label}
                          realRow={r}
                          projRow={p}
                          active={activeMonth}
                          zebra={idx % 2 === 1}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* AI reply */}
            {aiReply && (
              <Card className="p-6 border-primary/40 bg-primary/5">
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  Análise da IA Executiva
                </h2>
                <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">
                  {aiReply}
                </div>
              </Card>
            )}

            <div className="text-xs text-muted-foreground text-center pt-2">
              Última leitura: {new Date(data.fetchedAt).toLocaleString("pt-BR")}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  realized,
  projected,
  neutralIfNoProj,
  invertGap,
  isPct,
  icon,
  accent,
}: {
  label: string;
  realized: number | null;
  projected: number | null;
  neutralIfNoProj?: boolean;
  invertGap?: boolean;
  isPct?: boolean;
  icon?: React.ReactNode;
  accent?: string;
}) {
  const gap =
    realized != null && projected != null && projected !== 0
      ? (realized - projected) / Math.abs(projected)
      : null;
  const rawPositive = gap != null && gap >= 0;
  const positive = invertGap ? !rawPositive : rawPositive;
  const fmt = isPct ? fmtPct : fmtBRL;
  return (
    <Card className="p-4 border-border/60 relative overflow-hidden">
      {accent && (
        <span
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: accent }}
        />
      )}
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold mt-1.5 tabular-nums text-foreground">
        {fmt(realized)}
      </div>
      {projected != null && !isPct && (
        <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
          Projetado: {fmtBRL(projected)}
        </div>
      )}
      {gap != null ? (
        <div
          className="text-xs mt-2 flex items-center gap-1 font-semibold"
          style={{ color: positive ? COLOR_LUCRO : COLOR_OPEX }}
        >
          {positive ? (
            <TrendingUp className="size-3.5" />
          ) : (
            <TrendingDown className="size-3.5" />
          )}
          {rawPositive ? "+" : ""}
          {fmtPct(gap)}
          <span className="text-muted-foreground font-normal">vs proj</span>
        </div>
      ) : neutralIfNoProj ? (
        <div className="text-[11px] mt-2 text-muted-foreground">
          sem projeção comparável
        </div>
      ) : null}
    </Card>
  );
}

function GapRow({
  label,
  realRow,
  projRow,
  active,
  zebra,
}: {
  label: string;
  realRow: DreRow;
  projRow: DreRow | undefined;
  active: number;
  zebra?: boolean;
}) {
  const realYtd = realRow.total ?? sum(realRow.values);
  const projYtd = projRow ? (projRow.total ?? sum(projRow.values)) : null;
  const ytdPct =
    realYtd != null && projYtd != null && projYtd !== 0
      ? realYtd / projYtd
      : null;
  const bgBase = zebra ? "bg-card/40" : "bg-transparent";
  return (
    <>
      <tr className="border-t border-border/60 bg-secondary/40">
        <td
          className="py-2 pl-4 pr-3 font-bold text-sm sticky left-0 bg-secondary/90 backdrop-blur z-10"
          colSpan={1}
        >
          {label}
        </td>
        <td colSpan={13} />
      </tr>
      <tr className={`border-t border-border/30 ${bgBase}`}>
        <td className="py-1.5 pl-4 pr-3 text-muted-foreground text-xs sticky left-0 bg-card/95 backdrop-blur z-10">
          Realizado
        </td>
        {realRow.values.map((v, i) => (
          <td
            key={i}
            className={`py-1.5 px-2 text-right font-mono text-xs tabular-nums ${
              i === active
                ? "text-primary font-bold bg-primary/5"
                : "text-foreground"
            }`}
          >
            {v == null ? "—" : fmtBRL(v)}
          </td>
        ))}
        <td className="py-1.5 px-3 text-right font-mono text-xs font-bold tabular-nums text-foreground border-l border-border/60">
          {fmtBRL(realYtd)}
        </td>
      </tr>
      <tr className={`border-t border-border/30 ${bgBase}`}>
        <td className="py-1.5 pl-4 pr-3 text-muted-foreground text-xs sticky left-0 bg-card/95 backdrop-blur z-10">
          Projetado
        </td>
        {(projRow?.values ?? Array(12).fill(null)).map((v, i) => (
          <td
            key={i}
            className={`py-1.5 px-2 text-right font-mono text-xs tabular-nums text-muted-foreground ${
              i === active ? "bg-primary/5" : ""
            }`}
          >
            {v == null ? "—" : fmtBRL(v)}
          </td>
        ))}
        <td className="py-1.5 px-3 text-right font-mono text-xs tabular-nums text-muted-foreground border-l border-border/60">
          {fmtBRL(projYtd)}
        </td>
      </tr>
      <tr className={`border-t border-border/30 ${bgBase}`}>
        <td className="py-1.5 pl-4 pr-3 text-muted-foreground text-xs sticky left-0 bg-card/95 backdrop-blur z-10">
          % atingido
        </td>
        {realRow.values.map((rv, i) => {
          const pv = projRow?.values[i];
          if (rv == null || pv == null || pv === 0) {
            return (
              <td
                key={i}
                className={`py-1.5 px-2 text-right text-xs text-muted-foreground ${
                  i === active ? "bg-primary/5" : ""
                }`}
              >
                —
              </td>
            );
          }
          const pct = rv / pv;
          const color =
            pct >= 1 ? COLOR_LUCRO : pct >= 0.8 ? "#FBBF24" : COLOR_OPEX;
          return (
            <td
              key={i}
              className={`py-1.5 px-2 text-right font-mono text-xs font-bold tabular-nums ${
                i === active ? "bg-primary/5" : ""
              }`}
              style={{ color }}
            >
              {(pct * 100).toFixed(0)}%
            </td>
          );
        })}
        <td
          className="py-1.5 px-3 text-right font-mono text-xs font-bold tabular-nums border-l border-border/60"
          style={{
            color:
              ytdPct == null
                ? "var(--color-muted-foreground)"
                : ytdPct >= 1
                  ? COLOR_LUCRO
                  : ytdPct >= 0.8
                    ? "#FBBF24"
                    : COLOR_OPEX,
          }}
        >
          {ytdPct == null ? "—" : `${(ytdPct * 100).toFixed(0)}%`}
        </td>
      </tr>
    </>
  );
}
