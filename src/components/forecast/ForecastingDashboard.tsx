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
} from "lucide-react";
import {
  LineChart,
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

const fmtBRL = (n: number | null) =>
  n == null
    ? "—"
    : n.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      });

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
    const real = findRow(data.realizado, "(+) Receita Bruta");
    const proj = findRow(data.projetado, "(+) Receita Bruta");
    const lucro = findRow(data.realizado, "(=) LUCRO OPERACIONAL");
    return { real, proj, lucro };
  }, [data]);

  // Determine current "active" month (last month with realizado data)
  const activeMonth = useMemo(() => {
    if (!summary?.real) return -1;
    let last = -1;
    for (let i = 0; i < 12; i++) {
      if (summary.real.values[i] != null && summary.real.values[i] !== 0) last = i;
    }
    return last;
  }, [summary]);

  const trendChartData = useMemo(() => {
    if (!summary?.real || !summary?.proj) return [];
    return MONTH_LABELS.map((m, i) => ({
      mes: m,
      Realizado: summary.real!.values[i] ?? null,
      Projetado: summary.proj!.values[i] ?? null,
    }));
  }, [summary]);

  const opMix = useMemo(() => {
    if (!data || activeMonth < 0) return [];
    const ops = findOpRows(data.realizado);
    return ops
      .map((r) => ({ name: r.label.trim(), value: r.values[activeMonth] ?? 0 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [data, activeMonth]);

  const totalMix = opMix.reduce((acc, o) => acc + o.value, 0);

  const handleAi = async () => {
    if (!data) return;
    setAiLoading(true);
    setAiReply(null);
    try {
      const lines: string[] = [];
      lines.push(`Mês mais recente com dado: ${activeMonth >= 0 ? MONTH_LABELS[activeMonth] : "n/a"}`);
      for (const key of KEY_LINES) {
        const r = findRow(data.realizado, key);
        const p = findRow(data.projetado, key);
        if (!r) continue;
        lines.push(`\n## ${key}`);
        lines.push(`Realizado: ${r.values.map((v, i) => `${MONTH_LABELS[i]}=${v ?? "-"}`).join(" | ")}`);
        if (p) lines.push(`Projetado: ${p.values.map((v, i) => `${MONTH_LABELS[i]}=${v ?? "-"}`).join(" | ")}`);
      }
      lines.push(`\n## Mix de operações (${activeMonth >= 0 ? MONTH_LABELS[activeMonth] : "n/a"})`);
      for (const o of opMix) {
        const pct = totalMix > 0 ? ((o.value / totalMix) * 100).toFixed(1) : "0";
        lines.push(`- ${o.name}: ${fmtBRL(o.value)} (${pct}%)`);
      }
      const r = await aiFn({ data: { summary: lines.join("\n") } });
      setAiReply(r.reply);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na análise");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-[1400px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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
                <div className="font-semibold text-destructive">Não foi possível carregar</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {q.error instanceof Error ? q.error.message : String(q.error)}
                </div>
              </div>
            </div>
          </Card>
        )}

        {data && summary?.real && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <KpiCard
                label="Receita Bruta — Acumulado"
                realized={summary.real.total ?? sum(summary.real.values)}
                projected={summary.proj?.total ?? sum(summary.proj?.values ?? [])}
              />
              <KpiCard
                label={`Receita — ${activeMonth >= 0 ? MONTH_LABELS[activeMonth] : "—"}`}
                realized={activeMonth >= 0 ? summary.real.values[activeMonth] : null}
                projected={activeMonth >= 0 ? summary.proj?.values[activeMonth] ?? null : null}
              />
              <KpiCard
                label="Lucro Operacional — Acumulado"
                realized={summary.lucro?.total ?? sum(summary.lucro?.values ?? [])}
                projected={null}
                neutralIfNoProj
              />
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">Operações ativas no mês</div>
                <div className="text-3xl font-bold mt-1">{opMix.length}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {opMix
                    .slice(0, 3)
                    .map((o) => o.name)
                    .join(" · ") || "—"}
                </div>
              </Card>
            </div>

            {/* Trend chart */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="size-5 text-primary" />
                Tendência — Receita Bruta (Realizado vs Projetado)
              </h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(v: number) => fmtBRL(v)}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="Realizado"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Projetado"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Mix por operação */}
            {opMix.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-1">
                  Mix de receita por operação · {MONTH_LABELS[activeMonth]}
                </h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Quem está puxando ou drenando o grupo neste mês
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={opMix} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          type="number"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          width={120}
                        />
                        <Tooltip
                          formatter={(v: number) => fmtBRL(v)}
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {opMix.map((_, i) => (
                            <Cell key={i} fill="hsl(var(--primary))" fillOpacity={1 - i * 0.12} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {opMix.map((o) => {
                      const pct = totalMix > 0 ? (o.value / totalMix) * 100 : 0;
                      return (
                        <div
                          key={o.name}
                          className="flex items-center justify-between p-3 rounded-md bg-secondary/40"
                        >
                          <div>
                            <div className="font-medium text-sm">{o.name}</div>
                            <div className="text-xs text-muted-foreground">{fmtBRL(o.value)}</div>
                          </div>
                          <Badge variant="secondary" className="font-mono">
                            {pct.toFixed(1)}%
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}

            {/* Gap table */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">
                Gap Realizado vs Projetado — linhas-chave da DRE
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Linha</th>
                      {MONTH_LABELS.map((m, i) => (
                        <th
                          key={m}
                          className={`py-2 px-2 font-medium text-right ${
                            i === activeMonth ? "text-primary" : ""
                          }`}
                        >
                          {m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {KEY_LINES.map((label) => {
                      const r = findRow(data.realizado, label);
                      const p = findRow(data.projetado, label);
                      if (!r) return null;
                      return (
                        <GapRow key={label} label={label} realRow={r} projRow={p} active={activeMonth} />
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-muted-foreground mt-3 flex gap-4">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-emerald-500" /> ≥ 100% da projeção
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-amber-500" /> 80–99%
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-red-500" /> &lt; 80%
                </span>
              </div>
            </Card>

            {/* AI reply */}
            {aiReply && (
              <Card className="p-6 border-primary/30 bg-primary/5">
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  Análise da IA Executiva
                </h2>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
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

function sum(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0);
}

function KpiCard({
  label,
  realized,
  projected,
  neutralIfNoProj,
}: {
  label: string;
  realized: number | null;
  projected: number | null;
  neutralIfNoProj?: boolean;
}) {
  const gap =
    realized != null && projected != null && projected !== 0
      ? (realized - projected) / Math.abs(projected)
      : null;
  const positive = gap != null && gap >= 0;
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{fmtBRL(realized)}</div>
      {projected != null && (
        <div className="text-xs text-muted-foreground mt-1">
          Projetado: {fmtBRL(projected)}
        </div>
      )}
      {gap != null ? (
        <div
          className={`text-xs mt-2 flex items-center gap-1 font-medium ${
            positive ? "text-emerald-500" : "text-red-500"
          }`}
        >
          {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          {positive ? "+" : ""}
          {fmtPct(gap)} vs projeção
        </div>
      ) : neutralIfNoProj ? (
        <div className="text-xs mt-2 text-muted-foreground">sem projeção comparável</div>
      ) : null}
    </Card>
  );
}

function GapRow({
  label,
  realRow,
  projRow,
  active,
}: {
  label: string;
  realRow: DreRow;
  projRow: DreRow | undefined;
  active: number;
}) {
  return (
    <>
      <tr className="border-t border-border/60 bg-secondary/30">
        <td className="py-2 pr-4 font-semibold" colSpan={13}>
          {label}
        </td>
      </tr>
      <tr className="border-t border-border/30">
        <td className="py-1.5 pr-4 text-muted-foreground text-xs">Realizado</td>
        {realRow.values.map((v, i) => (
          <td
            key={i}
            className={`py-1.5 px-2 text-right font-mono text-xs ${
              i === active ? "text-primary font-semibold" : ""
            }`}
          >
            {v == null ? "—" : fmtBRL(v)}
          </td>
        ))}
      </tr>
      <tr className="border-t border-border/30">
        <td className="py-1.5 pr-4 text-muted-foreground text-xs">Projetado</td>
        {(projRow?.values ?? Array(12).fill(null)).map((v, i) => (
          <td key={i} className="py-1.5 px-2 text-right font-mono text-xs text-muted-foreground">
            {v == null ? "—" : fmtBRL(v)}
          </td>
        ))}
      </tr>
      <tr className="border-t border-border/30">
        <td className="py-1.5 pr-4 text-muted-foreground text-xs">% atingido</td>
        {realRow.values.map((rv, i) => {
          const pv = projRow?.values[i];
          if (rv == null || pv == null || pv === 0) {
            return (
              <td key={i} className="py-1.5 px-2 text-right text-xs text-muted-foreground">
                —
              </td>
            );
          }
          const pct = rv / pv;
          const color =
            pct >= 1
              ? "text-emerald-500"
              : pct >= 0.8
                ? "text-amber-500"
                : "text-red-500";
          return (
            <td key={i} className={`py-1.5 px-2 text-right font-mono text-xs font-semibold ${color}`}>
              {(pct * 100).toFixed(0)}%
            </td>
          );
        })}
      </tr>
    </>
  );
}
