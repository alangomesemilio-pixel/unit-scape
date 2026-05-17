import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import {
  Sparkles,
  TrendingUp,
  Target,
  Users,
  Repeat,
  DollarSign,
  Download,
  RotateCcw,
  Plus,
  Settings2,
  Heart,
  Briefcase,
  Calendar,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

// ============ TYPES ============
type ScenarioKey = "conservador" | "base" | "agressivo";

interface MonthRow {
  month: string;
  receitaProj: number;
  receitaReal: number;
  cac: number;
  ticket: number;
  pedidos: number;
  conversao: number;
  roas: number;
  invest: number;
  lucro: number;
}

interface ChannelRow {
  name: string;
  receita: number;
  pedidos: number;
  cac: number;
  margem: number;
  ticket: number;
  roas: number;
  crescimento: number;
}

interface UnitEcon {
  cac: number;
  ltv: number;
  payback: number;
  margemBruta: number;
  margemContrib: number;
  ebitda: number;
  cmv: number;
  recompra: number;
  churn: number;
  recorrente: number;
  // metas
  metaLtvCac: number;
  metaMargemBruta: number;
  metaPayback: number;
  metaRecompra: number;
}

interface CreatorPanel {
  views: number;
  alcance: number;
  postsMes: number;
  ctr: number; // %
  trafego: number;
  conversao: number; // %
  pedidos: number;
  receita: number;
  midiaPagaReceita: number;
}

interface B2BPanel {
  leads: number;
  reunioes: number;
  conversao: number; // %
  novosParceiros: number;
  ticket: number;
  recorrencia: number; // %
  recompra: number; // %
  sellIn: number;
  sellOut: number;
}

interface CohortRow {
  cohort: string;
  m0: number;
  m1: number;
  m2: number;
  m3: number;
  m4: number;
  m5: number;
}

interface Premises {
  cacEsperado: number;
  crescimentoMensal: number; // %
  conversao: number; // %
  ticket: number;
  margem: number; // %
  retencao: number; // %
  investMidia: number;
  organico: number; // %
  metaB2B: number;
  recompra: number; // %
  cpm: number;
  ctr: number; // %
  roasAlvo: number;
}

interface SomaState {
  months: MonthRow[];
  channels: ChannelRow[];
  unit: UnitEcon;
  creator: CreatorPanel;
  b2b: B2BPanel;
  cohort: CohortRow[];
  premises: Premises;
  scenario: ScenarioKey;
}

const MONTHS = ["Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const DEFAULT_STATE: SomaState = {
  scenario: "base",
  months: MONTHS.map((m, i) => {
    const base = 180000 + i * 65000;
    return {
      month: m,
      receitaProj: base,
      receitaReal: i < 2 ? base * (0.92 + i * 0.04) : 0,
      cac: 78 - i * 2,
      ticket: 245 + i * 6,
      pedidos: Math.round(base / (245 + i * 6)),
      conversao: 2.1 + i * 0.1,
      roas: 3.2 + i * 0.15,
      invest: 55000 + i * 12000,
      lucro: base * (0.18 + i * 0.01),
    };
  }),
  channels: [
    { name: "E-commerce DTC", receita: 420000, pedidos: 1680, cac: 72, margem: 58, ticket: 250, roas: 3.6, crescimento: 12.4 },
    { name: "WhatsApp", receita: 180000, pedidos: 620, cac: 38, margem: 64, ticket: 290, roas: 5.1, crescimento: 22.8 },
    { name: "TikTok Shop", receita: 95000, pedidos: 410, cac: 65, margem: 52, ticket: 232, roas: 3.1, crescimento: 18.5 },
    { name: "Influenciadora", receita: 240000, pedidos: 980, cac: 28, margem: 61, ticket: 245, roas: 7.2, crescimento: 31.5 },
    { name: "B2B Distribuidores", receita: 320000, pedidos: 48, cac: 850, margem: 42, ticket: 6700, roas: 2.8, crescimento: 14.2 },
    { name: "Clínicas", receita: 145000, pedidos: 32, cac: 620, margem: 48, ticket: 4530, roas: 3.4, crescimento: 9.8 },
    { name: "Assinatura", receita: 88000, pedidos: 360, cac: 95, margem: 66, ticket: 245, roas: 4.2, crescimento: 27.4 },
    { name: "Marketplace", receita: 72000, pedidos: 295, cac: 88, margem: 38, ticket: 244, roas: 2.6, crescimento: 6.1 },
  ],
  unit: {
    cac: 68,
    ltv: 720,
    payback: 2.8,
    margemBruta: 58,
    margemContrib: 42,
    ebitda: 18,
    cmv: 32,
    recompra: 34,
    churn: 12,
    recorrente: 28,
    metaLtvCac: 6,
    metaMargemBruta: 60,
    metaPayback: 3,
    metaRecompra: 35,
  },
  creator: {
    views: 4800000,
    alcance: 1850000,
    postsMes: 18,
    ctr: 3.2,
    trafego: 156000,
    conversao: 2.8,
    pedidos: 4368,
    receita: 1070000,
    midiaPagaReceita: 780000,
  },
  b2b: {
    leads: 240,
    reunioes: 86,
    conversao: 28,
    novosParceiros: 12,
    ticket: 14800,
    recorrencia: 62,
    recompra: 48,
    sellIn: 410000,
    sellOut: 285000,
  },
  cohort: [
    { cohort: "Jun", m0: 100, m1: 38, m2: 28, m3: 22, m4: 18, m5: 15 },
    { cohort: "Jul", m0: 100, m1: 42, m2: 31, m3: 24, m4: 19, m5: 0 },
    { cohort: "Ago", m0: 100, m1: 45, m2: 33, m3: 26, m4: 0, m5: 0 },
    { cohort: "Set", m0: 100, m1: 47, m2: 35, m3: 0, m4: 0, m5: 0 },
    { cohort: "Out", m0: 100, m1: 49, m2: 0, m3: 0, m4: 0, m5: 0 },
    { cohort: "Nov", m0: 100, m1: 0, m2: 0, m3: 0, m4: 0, m5: 0 },
  ],
  premises: {
    cacEsperado: 65,
    crescimentoMensal: 12,
    conversao: 2.5,
    ticket: 255,
    margem: 58,
    retencao: 68,
    investMidia: 80000,
    organico: 18,
    metaB2B: 450000,
    recompra: 35,
    cpm: 28,
    ctr: 2.8,
    roasAlvo: 3.8,
  },
};

const SCENARIO_MULT: Record<ScenarioKey, { rev: number; cac: number; conv: number; ret: number; roas: number }> = {
  conservador: { rev: 0.85, cac: 1.18, conv: 0.85, ret: 0.9, roas: 0.85 },
  base: { rev: 1, cac: 1, conv: 1, ret: 1, roas: 1 },
  agressivo: { rev: 1.22, cac: 0.82, conv: 1.18, ret: 1.12, roas: 1.2 },
};

const STORAGE_KEY = "soma.forecast.v1";

const SOMA_PALETTE = {
  rose: "#d4a5a0",
  roseDeep: "#b8857f",
  sand: "#e8dccc",
  cream: "#f5ede2",
  ink: "#2a2420",
  gold: "#c9a572",
  sage: "#9ab397",
  blush: "#efd5d0",
};

const PIE_COLORS = ["#d4a5a0", "#c9a572", "#9ab397", "#b8857f", "#e8dccc", "#efd5d0", "#8a7570", "#a89890"];

// ============ HELPERS ============
const brl = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
};
const pct = (n: number) => `${n.toFixed(1)}%`;

function loadState(): SomaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_STATE;
}

// ============ ATOMIC EDITABLE ============
function EditNum({
  value,
  onChange,
  prefix,
  suffix,
  className = "",
  step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  className?: string;
  step?: number;
}) {
  return (
    <div className={`group inline-flex items-center gap-1 ${className}`}>
      {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="bg-transparent border-b border-transparent group-hover:border-[#d4a5a0]/40 focus:border-[#d4a5a0] focus:outline-none w-full text-right tabular-nums transition-colors"
      />
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

// ============ MAIN ============
export function SomaForecasting() {
  const [state, setState] = useState<SomaState>(() => DEFAULT_STATE);
  const [showPremises, setShowPremises] = useState(false);

  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const mult = SCENARIO_MULT[state.scenario];

  // Derived KPIs
  const totals = useMemo(() => {
    const proj = state.months.reduce((a, m) => a + m.receitaProj * mult.rev, 0);
    const real = state.months.reduce((a, m) => a + m.receitaReal, 0);
    const ebitda = state.months.reduce((a, m) => a + m.lucro * mult.rev, 0);
    const pedidos = state.months.reduce((a, m) => a + m.pedidos, 0);
    const ating = proj ? (real / proj) * 100 : 0;
    return { proj, real, ebitda, pedidos, ating };
  }, [state.months, mult]);

  const lastReal = state.months.filter((m) => m.receitaReal > 0).slice(-1)[0];
  const prevReal = state.months.filter((m) => m.receitaReal > 0).slice(-2, -1)[0];
  const growth = lastReal && prevReal ? ((lastReal.receitaReal - prevReal.receitaReal) / prevReal.receitaReal) * 100 : 0;

  const totalChannelRev = state.channels.reduce((a, c) => a + c.receita, 0);

  const updateMonth = (i: number, patch: Partial<MonthRow>) => {
    setState((s) => ({ ...s, months: s.months.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) }));
  };
  const updateChannel = (i: number, patch: Partial<ChannelRow>) => {
    setState((s) => ({ ...s, channels: s.channels.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));
  };

  const reset = () => {
    if (confirm("Resetar todos os dados do forecast Soma?")) {
      setState(DEFAULT_STATE);
      toast.success("Forecast Soma resetado");
    }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `soma-forecast-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Forecast exportado");
  };

  return (
    <div
      className="h-full overflow-y-auto"
      style={{
        background:
          "linear-gradient(180deg, oklch(0.22 0.015 30) 0%, oklch(0.18 0.015 30) 100%)",
      }}
    >
      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* HEADER */}
        <Header
          scenario={state.scenario}
          onScenario={(s) => setState((p) => ({ ...p, scenario: s }))}
          onEdit={() => setShowPremises((v) => !v)}
          onExport={exportJSON}
          onReset={reset}
        />

        {/* BLOCO 1 — VISÃO EXECUTIVA */}
        <Section title="Visão Executiva" subtitle="Os indicadores que importam pro conselho">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <ExecCard
              label="Receita Projetada"
              value={brl(totals.proj)}
              delta={state.scenario !== "base" ? `${mult.rev > 1 ? "+" : ""}${((mult.rev - 1) * 100).toFixed(0)}% cenário` : "Cenário base"}
              icon={Target}
              trend="up"
              series={state.months.map((m) => ({ v: m.receitaProj * mult.rev }))}
            />
            <ExecCard
              label="Receita Real"
              value={brl(totals.real)}
              delta={`${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% s/m`}
              icon={TrendingUp}
              trend={growth >= 0 ? "up" : "down"}
              series={state.months.map((m) => ({ v: m.receitaReal }))}
            />
            <ExecCard
              label="% Forecast Atingido"
              value={pct(totals.ating)}
              delta={totals.ating >= 95 ? "No alvo" : totals.ating >= 80 ? "Atenção" : "Crítico"}
              icon={Activity}
              trend={totals.ating >= 95 ? "up" : "down"}
              series={state.months.map((m) => ({ v: m.receitaProj > 0 ? (m.receitaReal / m.receitaProj) * 100 : 0 }))}
            />
            <ExecCard
              label="EBITDA Projetado"
              value={brl(totals.ebitda)}
              delta={`${((totals.ebitda / totals.proj) * 100).toFixed(1)}% margem`}
              icon={DollarSign}
              trend="up"
              series={state.months.map((m) => ({ v: m.lucro * mult.rev }))}
            />
            <ExecCard
              label="Clientes Novos"
              value={totals.pedidos.toLocaleString("pt-BR")}
              delta="6 meses"
              icon={Users}
              trend="up"
              series={state.months.map((m) => ({ v: m.pedidos }))}
            />
            <ExecCard
              label="Receita Recorrente"
              value={pct(state.unit.recorrente)}
              delta={`${state.unit.recorrente >= 30 ? "Saudável" : "Em construção"}`}
              icon={Repeat}
              trend="up"
              series={state.months.map((m, i) => ({ v: state.unit.recorrente * (0.8 + i * 0.06) }))}
            />
          </div>
        </Section>

        {/* BLOCO 2 — FORECAST MENSAL */}
        <Section title="Forecast Mensal" subtitle="Junho → Dezembro · todos os campos editáveis">
          <Panel>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-[#d4a5a0]/15">
                    <th className="py-2 px-2">Mês</th>
                    <th className="py-2 px-2 text-right">Proj.</th>
                    <th className="py-2 px-2 text-right">Real</th>
                    <th className="py-2 px-2 text-right">CAC</th>
                    <th className="py-2 px-2 text-right">Ticket</th>
                    <th className="py-2 px-2 text-right">Pedidos</th>
                    <th className="py-2 px-2 text-right">Conv.%</th>
                    <th className="py-2 px-2 text-right">ROAS</th>
                    <th className="py-2 px-2 text-right">Invest.</th>
                    <th className="py-2 px-2 text-right">Lucro</th>
                    <th className="py-2 px-2 text-right">% Ating.</th>
                  </tr>
                </thead>
                <tbody>
                  {state.months.map((m, i) => {
                    const ating = m.receitaProj ? (m.receitaReal / m.receitaProj) * 100 : 0;
                    return (
                      <tr key={m.month} className="border-b border-[#d4a5a0]/10 hover:bg-[#d4a5a0]/5 transition-colors">
                        <td className="py-2 px-2 font-medium" style={{ color: SOMA_PALETTE.rose }}>{m.month}</td>
                        <td className="py-2 px-2"><EditNum value={m.receitaProj} onChange={(v) => updateMonth(i, { receitaProj: v })} prefix="R$" /></td>
                        <td className="py-2 px-2"><EditNum value={m.receitaReal} onChange={(v) => updateMonth(i, { receitaReal: v })} prefix="R$" /></td>
                        <td className="py-2 px-2"><EditNum value={m.cac} onChange={(v) => updateMonth(i, { cac: v })} prefix="R$" /></td>
                        <td className="py-2 px-2"><EditNum value={m.ticket} onChange={(v) => updateMonth(i, { ticket: v })} prefix="R$" /></td>
                        <td className="py-2 px-2"><EditNum value={m.pedidos} onChange={(v) => updateMonth(i, { pedidos: v })} /></td>
                        <td className="py-2 px-2"><EditNum value={m.conversao} onChange={(v) => updateMonth(i, { conversao: v })} suffix="%" step={0.1} /></td>
                        <td className="py-2 px-2"><EditNum value={m.roas} onChange={(v) => updateMonth(i, { roas: v })} suffix="x" step={0.1} /></td>
                        <td className="py-2 px-2"><EditNum value={m.invest} onChange={(v) => updateMonth(i, { invest: v })} prefix="R$" /></td>
                        <td className="py-2 px-2"><EditNum value={m.lucro} onChange={(v) => updateMonth(i, { lucro: v })} prefix="R$" /></td>
                        <td className="py-2 px-2 text-right font-semibold tabular-nums" style={{ color: ating >= 95 ? SOMA_PALETTE.sage : ating >= 80 ? SOMA_PALETTE.gold : "#d97a7a" }}>
                          {ating.toFixed(0)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <Panel title="Forecast vs Real">
              <div className="h-64">
                <ResponsiveContainer>
                  <LineChart data={state.months}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d4a5a0" strokeOpacity={0.15} />
                    <XAxis dataKey="month" stroke="#a89890" fontSize={11} />
                    <YAxis stroke="#a89890" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: "#2a2420", border: `1px solid ${SOMA_PALETTE.rose}40`, borderRadius: 8 }} formatter={(v: number) => brl(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="receitaProj" name="Projetado" stroke={SOMA_PALETTE.gold} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="receitaReal" name="Real" stroke={SOMA_PALETTE.rose} strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Crescimento Acumulado">
              <div className="h-64">
                <ResponsiveContainer>
                  <AreaChart data={state.months.reduce<{ month: string; acc: number }[]>((arr, m, i) => {
                    const prev = arr[i - 1]?.acc ?? 0;
                    arr.push({ month: m.month, acc: prev + m.receitaReal });
                    return arr;
                  }, [])}>
                    <defs>
                      <linearGradient id="acc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SOMA_PALETTE.rose} stopOpacity={0.6} />
                        <stop offset="100%" stopColor={SOMA_PALETTE.rose} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d4a5a0" strokeOpacity={0.15} />
                    <XAxis dataKey="month" stroke="#a89890" fontSize={11} />
                    <YAxis stroke="#a89890" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: "#2a2420", border: `1px solid ${SOMA_PALETTE.rose}40`, borderRadius: 8 }} formatter={(v: number) => brl(v)} />
                    <Area type="monotone" dataKey="acc" stroke={SOMA_PALETTE.rose} fill="url(#acc)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
        </Section>

        {/* BLOCO 3 — CANAIS */}
        <Section title="Forecast por Canal" subtitle="Receita, eficiência e crescimento por canal">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Panel>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-[#d4a5a0]/15">
                        <th className="py-2 px-2">Canal</th>
                        <th className="py-2 px-2 text-right">Receita</th>
                        <th className="py-2 px-2 text-right">Share</th>
                        <th className="py-2 px-2 text-right">Pedidos</th>
                        <th className="py-2 px-2 text-right">CAC</th>
                        <th className="py-2 px-2 text-right">Ticket</th>
                        <th className="py-2 px-2 text-right">Margem%</th>
                        <th className="py-2 px-2 text-right">ROAS</th>
                        <th className="py-2 px-2 text-right">Cresc.%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.channels.map((c, i) => {
                        const share = totalChannelRev ? (c.receita / totalChannelRev) * 100 : 0;
                        return (
                          <tr key={c.name} className="border-b border-[#d4a5a0]/10 hover:bg-[#d4a5a0]/5">
                            <td className="py-2 px-2 font-medium" style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>{c.name}</td>
                            <td className="py-2 px-2"><EditNum value={c.receita} onChange={(v) => updateChannel(i, { receita: v })} prefix="R$" /></td>
                            <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{share.toFixed(1)}%</td>
                            <td className="py-2 px-2"><EditNum value={c.pedidos} onChange={(v) => updateChannel(i, { pedidos: v })} /></td>
                            <td className="py-2 px-2"><EditNum value={c.cac} onChange={(v) => updateChannel(i, { cac: v })} prefix="R$" /></td>
                            <td className="py-2 px-2"><EditNum value={c.ticket} onChange={(v) => updateChannel(i, { ticket: v })} prefix="R$" /></td>
                            <td className="py-2 px-2"><EditNum value={c.margem} onChange={(v) => updateChannel(i, { margem: v })} suffix="%" /></td>
                            <td className="py-2 px-2"><EditNum value={c.roas} onChange={(v) => updateChannel(i, { roas: v })} suffix="x" step={0.1} /></td>
                            <td className="py-2 px-2"><EditNum value={c.crescimento} onChange={(v) => updateChannel(i, { crescimento: v })} suffix="%" step={0.1} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
            <Panel title="Share de Receita">
              <div className="h-72">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={state.channels} dataKey="receita" nameKey="name" outerRadius={90} innerRadius={50} paddingAngle={2}>
                      {state.channels.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#2a2420", border: `1px solid ${SOMA_PALETTE.rose}40`, borderRadius: 8 }} formatter={(v: number) => brl(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
          <Panel title="Crescimento por Canal" className="mt-4">
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={state.channels}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d4a5a0" strokeOpacity={0.15} />
                  <XAxis dataKey="name" stroke="#a89890" fontSize={10} angle={-15} textAnchor="end" height={60} />
                  <YAxis stroke="#a89890" fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ background: "#2a2420", border: `1px solid ${SOMA_PALETTE.rose}40`, borderRadius: 8 }} formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Bar dataKey="crescimento" radius={[6, 6, 0, 0]}>
                    {state.channels.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </Section>

        {/* BLOCO 4 — UNIT ECONOMICS */}
        <Section title="Unit Economics" subtitle="A saúde unitária da operação">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <UnitCard label="CAC" value={state.unit.cac} unit="R$" inverted onChange={(v) => setState((s) => ({ ...s, unit: { ...s.unit, cac: v } }))} healthy={state.unit.cac < 80} />
            <UnitCard label="LTV" value={state.unit.ltv} unit="R$" onChange={(v) => setState((s) => ({ ...s, unit: { ...s.unit, ltv: v } }))} healthy={state.unit.ltv > 600} />
            <UnitCard label="LTV / CAC" value={state.unit.ltv / Math.max(state.unit.cac, 1)} unit="x" computed meta={state.unit.metaLtvCac} healthy={state.unit.ltv / Math.max(state.unit.cac, 1) >= state.unit.metaLtvCac} />
            <UnitCard label="Payback" value={state.unit.payback} unit="m" inverted onChange={(v) => setState((s) => ({ ...s, unit: { ...s.unit, payback: v } }))} meta={state.unit.metaPayback} healthy={state.unit.payback <= state.unit.metaPayback} />
            <UnitCard label="Margem Bruta" value={state.unit.margemBruta} unit="%" onChange={(v) => setState((s) => ({ ...s, unit: { ...s.unit, margemBruta: v } }))} meta={state.unit.metaMargemBruta} healthy={state.unit.margemBruta >= state.unit.metaMargemBruta} />
            <UnitCard label="Margem Contrib." value={state.unit.margemContrib} unit="%" onChange={(v) => setState((s) => ({ ...s, unit: { ...s.unit, margemContrib: v } }))} healthy={state.unit.margemContrib >= 40} />
            <UnitCard label="EBITDA" value={state.unit.ebitda} unit="%" onChange={(v) => setState((s) => ({ ...s, unit: { ...s.unit, ebitda: v } }))} healthy={state.unit.ebitda >= 15} />
            <UnitCard label="CMV" value={state.unit.cmv} unit="%" inverted onChange={(v) => setState((s) => ({ ...s, unit: { ...s.unit, cmv: v } }))} healthy={state.unit.cmv <= 35} />
            <UnitCard label="Recompra" value={state.unit.recompra} unit="%" onChange={(v) => setState((s) => ({ ...s, unit: { ...s.unit, recompra: v } }))} meta={state.unit.metaRecompra} healthy={state.unit.recompra >= state.unit.metaRecompra} />
            <UnitCard label="Churn" value={state.unit.churn} unit="%" inverted onChange={(v) => setState((s) => ({ ...s, unit: { ...s.unit, churn: v } }))} healthy={state.unit.churn <= 15} />
            <UnitCard label="Recorrente" value={state.unit.recorrente} unit="%" onChange={(v) => setState((s) => ({ ...s, unit: { ...s.unit, recorrente: v } }))} healthy={state.unit.recorrente >= 25} />
          </div>
        </Section>

        {/* BLOCO 5 — CREATOR */}
        <Section title="Performance da Influenciadora" subtitle="Creator sócia · views → cliques → conversão → receita" icon={Heart}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel title="Inputs da Creator" className="lg:col-span-1">
              <div className="space-y-3">
                {([
                  ["views", "Views mensais", ""],
                  ["alcance", "Alcance", ""],
                  ["postsMes", "Posts/mês", ""],
                  ["ctr", "CTR", "%"],
                  ["trafego", "Tráfego gerado", ""],
                  ["conversao", "Conversão", "%"],
                  ["pedidos", "Pedidos", ""],
                  ["receita", "Receita gerada", "R$"],
                  ["midiaPagaReceita", "Receita mídia paga", "R$"],
                ] as const).map(([key, label, suf]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <EditNum
                      value={(state.creator as any)[key]}
                      onChange={(v) => setState((s) => ({ ...s, creator: { ...s.creator, [key]: v } }))}
                      prefix={suf === "R$" ? "R$" : undefined}
                      suffix={suf === "%" ? "%" : undefined}
                      className="w-32"
                    />
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Funil de Conversão" className="lg:col-span-2">
              <div className="space-y-3">
                <FunnelStep label="Views" value={state.creator.views} max={state.creator.views} color={SOMA_PALETTE.blush} />
                <FunnelStep label="Alcance" value={state.creator.alcance} max={state.creator.views} color={SOMA_PALETTE.rose} />
                <FunnelStep label="Tráfego" value={state.creator.trafego} max={state.creator.views} color={SOMA_PALETTE.gold} />
                <FunnelStep label="Pedidos" value={state.creator.pedidos} max={state.creator.views} color={SOMA_PALETTE.roseDeep} />
              </div>
              <div className="mt-6 pt-4 border-t border-[#d4a5a0]/15 grid grid-cols-3 gap-4 text-center">
                <Stat label="Receita Creator" value={brl(state.creator.receita)} color={SOMA_PALETTE.rose} />
                <Stat label="Mídia Paga" value={brl(state.creator.midiaPagaReceita)} color={SOMA_PALETTE.gold} />
                <Stat label="Creator/Mídia" value={`${(state.creator.receita / Math.max(state.creator.midiaPagaReceita, 1)).toFixed(2)}x`} color={SOMA_PALETTE.sage} />
              </div>
            </Panel>
          </div>
        </Section>

        {/* BLOCO 6 — B2B */}
        <Section title="Pipeline B2B" subtitle="Distribuidores · Clínicas · Atacado" icon={Briefcase}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel title="Inputs B2B">
              <div className="space-y-3">
                {([
                  ["leads", "Leads B2B", ""],
                  ["reunioes", "Reuniões", ""],
                  ["conversao", "Conversão", "%"],
                  ["novosParceiros", "Novos parceiros", ""],
                  ["ticket", "Ticket atacado", "R$"],
                  ["recorrencia", "Recorrência", "%"],
                  ["recompra", "Recompra", "%"],
                  ["sellIn", "Sell-in", "R$"],
                  ["sellOut", "Sell-out", "R$"],
                ] as const).map(([key, label, suf]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <EditNum
                      value={(state.b2b as any)[key]}
                      onChange={(v) => setState((s) => ({ ...s, b2b: { ...s.b2b, [key]: v } }))}
                      prefix={suf === "R$" ? "R$" : undefined}
                      suffix={suf === "%" ? "%" : undefined}
                      className="w-32"
                    />
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Funil Comercial" className="lg:col-span-2">
              <div className="space-y-3">
                <FunnelStep label="Leads" value={state.b2b.leads} max={state.b2b.leads} color={SOMA_PALETTE.blush} />
                <FunnelStep label="Reuniões" value={state.b2b.reunioes} max={state.b2b.leads} color={SOMA_PALETTE.rose} />
                <FunnelStep label="Novos Parceiros" value={state.b2b.novosParceiros} max={state.b2b.leads} color={SOMA_PALETTE.roseDeep} />
              </div>
              <div className="mt-6 pt-4 border-t border-[#d4a5a0]/15 grid grid-cols-3 gap-4 text-center">
                <Stat label="Sell-in" value={brl(state.b2b.sellIn)} color={SOMA_PALETTE.gold} />
                <Stat label="Sell-out" value={brl(state.b2b.sellOut)} color={SOMA_PALETTE.rose} />
                <Stat label="Sell-through" value={`${((state.b2b.sellOut / Math.max(state.b2b.sellIn, 1)) * 100).toFixed(0)}%`} color={SOMA_PALETTE.sage} />
              </div>
            </Panel>
          </div>
        </Section>

        {/* BLOCO 7 — COHORT */}
        <Section title="Retenção & Cohort" subtitle="Coorte de aquisição × recompra mensal">
          <Panel>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-[#d4a5a0]/15">
                    <th className="py-2 px-2">Cohort</th>
                    {["M0", "M+1", "M+2", "M+3", "M+4", "M+5"].map((h) => (
                      <th key={h} className="py-2 px-2 text-center">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.cohort.map((row, ri) => (
                    <tr key={row.cohort} className="border-b border-[#d4a5a0]/10">
                      <td className="py-2 px-2 font-medium" style={{ color: SOMA_PALETTE.rose }}>{row.cohort}</td>
                      {(["m0", "m1", "m2", "m3", "m4", "m5"] as const).map((k) => {
                        const v = row[k];
                        const intensity = Math.min(v / 100, 1);
                        return (
                          <td key={k} className="p-1">
                            <div
                              className="rounded-md text-center py-2 text-xs font-medium tabular-nums transition-colors"
                              style={{
                                background: v > 0 ? `rgba(212, 165, 160, ${0.1 + intensity * 0.6})` : "rgba(212, 165, 160, 0.03)",
                                color: v > 0 ? "#fff" : "#666",
                              }}
                            >
                              <input
                                type="number"
                                value={v}
                                onChange={(e) => {
                                  const nv = parseFloat(e.target.value) || 0;
                                  setState((s) => ({
                                    ...s,
                                    cohort: s.cohort.map((c, i) => (i === ri ? { ...c, [k]: nv } : c)),
                                  }));
                                }}
                                className="bg-transparent w-full text-center focus:outline-none"
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </Section>

        {/* BLOCO 10 — ROADMAP */}
        <Section title="Roadmap Estratégico" subtitle="6 meses de execução" icon={Calendar}>
          <Panel>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
              {[
                { m: "Junho", t: "Lançamento", icon: Flame },
                { m: "Julho", t: "Escala creators", icon: Heart },
                { m: "Agosto", t: "Expansão Meta/TikTok", icon: TrendingUp },
                { m: "Setembro", t: "B2B forte", icon: Briefcase },
                { m: "Outubro", t: "Assinatura", icon: Repeat },
                { m: "Novembro", t: "Black Friday", icon: Sparkles },
                { m: "Dezembro", t: "Expansão SKUs", icon: Plus },
              ].map(({ m, t, icon: Icon }, i) => (
                <div
                  key={m}
                  className="relative rounded-xl p-4 border transition-all hover:scale-[1.02]"
                  style={{
                    borderColor: `${SOMA_PALETTE.rose}30`,
                    background: `linear-gradient(135deg, ${SOMA_PALETTE.rose}10, ${SOMA_PALETTE.gold}05)`,
                  }}
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Mês {i + 1}</div>
                  <Icon className="size-5 mb-2" style={{ color: SOMA_PALETTE.rose }} />
                  <div className="font-semibold text-sm" style={{ color: SOMA_PALETTE.cream }}>{m}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t}</div>
                </div>
              ))}
            </div>
          </Panel>
        </Section>

        <div className="text-center text-xs text-muted-foreground pt-4 pb-8">
          SOMA · Creator-led Wellness Brand · Forecasting Estratégico
        </div>
      </div>

      {/* PREMISSAS DRAWER */}
      {showPremises && (
        <PremisesDrawer
          premises={state.premises}
          onChange={(p) => setState((s) => ({ ...s, premises: p }))}
          onClose={() => setShowPremises(false)}
        />
      )}
    </div>
  );
}

// ============ SUBCOMPONENTS ============
function Header({
  scenario,
  onScenario,
  onEdit,
  onExport,
  onReset,
}: {
  scenario: ScenarioKey;
  onScenario: (s: ScenarioKey) => void;
  onEdit: () => void;
  onExport: () => void;
  onReset: () => void;
}) {
  return (
    <div
      className="rounded-2xl p-6 border"
      style={{
        background: `linear-gradient(135deg, ${SOMA_PALETTE.ink} 0%, oklch(0.25 0.02 30) 100%)`,
        borderColor: `${SOMA_PALETTE.rose}25`,
      }}
    >
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div
              className="size-12 rounded-2xl flex items-center justify-center text-2xl font-light tracking-widest"
              style={{ background: `linear-gradient(135deg, ${SOMA_PALETTE.rose}, ${SOMA_PALETTE.gold})`, color: SOMA_PALETTE.ink }}
            >
              S
            </div>
            <div>
              <h1 className="text-3xl font-light tracking-wide" style={{ color: SOMA_PALETTE.cream, fontFamily: "Georgia, serif" }}>
                SOMA
              </h1>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mt-1">
                Forecasting Estratégico · Creator-led Wellness Brand
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={scenario} onValueChange={(v) => onScenario(v as ScenarioKey)}>
            <SelectTrigger className="w-44 bg-transparent border-[#d4a5a0]/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conservador">🛡️ Conservador</SelectItem>
              <SelectItem value="base">⚖️ Base</SelectItem>
              <SelectItem value="agressivo">🚀 Agressivo</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={onEdit} className="border-[#d4a5a0]/30">
            <Settings2 className="size-4 mr-1" /> Premissas
          </Button>
          <Button variant="outline" size="sm" onClick={onExport} className="border-[#d4a5a0]/30">
            <Download className="size-4 mr-1" /> Exportar
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  icon?: typeof Sparkles;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between border-b border-[#d4a5a0]/15 pb-2">
        <div className="flex items-center gap-3">
          {Icon && <Icon className="size-5" style={{ color: SOMA_PALETTE.rose }} />}
          <div>
            <h2 className="text-lg font-medium tracking-wide" style={{ color: SOMA_PALETTE.cream }}>{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function Panel({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border p-4 ${className}`}
      style={{
        background: "oklch(0.24 0.015 30 / 0.6)",
        borderColor: `${SOMA_PALETTE.rose}20`,
        backdropFilter: "blur(8px)",
      }}
    >
      {title && (
        <h3 className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3" style={{ color: SOMA_PALETTE.sand }}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function ExecCard({
  label,
  value,
  delta,
  icon: Icon,
  trend,
  series,
}: {
  label: string;
  value: string;
  delta: string;
  icon: typeof Sparkles;
  trend: "up" | "down";
  series: { v: number }[];
}) {
  return (
    <div
      className="rounded-xl border p-4 relative overflow-hidden group transition-all hover:border-[#d4a5a0]/40"
      style={{
        background: "oklch(0.24 0.015 30 / 0.7)",
        borderColor: `${SOMA_PALETTE.rose}20`,
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
        <Icon className="size-4" style={{ color: SOMA_PALETTE.rose, opacity: 0.7 }} />
      </div>
      <div className="text-2xl font-light tabular-nums mb-1" style={{ color: SOMA_PALETTE.cream }}>
        {value}
      </div>
      <div className="text-[11px]" style={{ color: trend === "up" ? SOMA_PALETTE.sage : "#d97a7a" }}>
        {delta}
      </div>
      <div className="h-10 mt-2 -mx-2 -mb-2 opacity-60">
        <ResponsiveContainer>
          <LineChart data={series}>
            <Line type="monotone" dataKey="v" stroke={SOMA_PALETTE.rose} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function UnitCard({
  label,
  value,
  unit,
  onChange,
  computed,
  meta,
  healthy,
  inverted,
}: {
  label: string;
  value: number;
  unit: string;
  onChange?: (n: number) => void;
  computed?: boolean;
  meta?: number;
  healthy: boolean;
  inverted?: boolean;
}) {
  const color = healthy ? SOMA_PALETTE.sage : value === 0 ? "#888" : "#d97a7a";
  const fmt = unit === "R$" ? brl(value) : unit === "%" ? `${value.toFixed(1)}%` : unit === "x" ? `${value.toFixed(2)}x` : `${value.toFixed(1)}${unit}`;
  return (
    <div
      className="rounded-xl border p-3"
      style={{
        background: "oklch(0.24 0.015 30 / 0.6)",
        borderColor: healthy ? `${SOMA_PALETTE.sage}40` : `#d97a7a40`,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        {healthy ? <CheckCircle2 className="size-3" style={{ color: SOMA_PALETTE.sage }} /> : <AlertTriangle className="size-3" style={{ color: "#d97a7a" }} />}
      </div>
      {computed || !onChange ? (
        <div className="text-xl font-light tabular-nums" style={{ color }}>{fmt}</div>
      ) : (
        <div className="text-xl font-light tabular-nums" style={{ color }}>
          <EditNum value={value} onChange={onChange} suffix={unit === "R$" ? undefined : unit} prefix={unit === "R$" ? "R$" : undefined} step={unit === "%" ? 0.1 : 1} />
        </div>
      )}
      {meta !== undefined && (
        <div className="text-[10px] text-muted-foreground mt-1">
          Meta: {unit === "x" ? `${meta.toFixed(1)}x` : unit === "%" ? `${meta}%` : `${meta}${unit}`}
        </div>
      )}
    </div>
  );
}

function FunnelStep({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const width = max ? Math.max((value / max) * 100, 4) : 4;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium" style={{ color: SOMA_PALETTE.cream }}>
          {value.toLocaleString("pt-BR")}
        </span>
      </div>
      <div className="h-7 rounded-md overflow-hidden" style={{ background: `${color}15` }}>
        <div
          className="h-full rounded-md transition-all flex items-center justify-end pr-2 text-[10px] font-medium"
          style={{ width: `${width}%`, background: `linear-gradient(90deg, ${color}80, ${color})`, color: SOMA_PALETTE.ink }}
        >
          {width > 15 && `${width.toFixed(0)}%`}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-lg font-light tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}

function PremisesDrawer({
  premises,
  onChange,
  onClose,
}: {
  premises: Premises;
  onChange: (p: Premises) => void;
  onClose: () => void;
}) {
  const fields: { key: keyof Premises; label: string; suffix?: string; prefix?: string }[] = [
    { key: "cacEsperado", label: "CAC esperado", prefix: "R$" },
    { key: "crescimentoMensal", label: "Crescimento mensal", suffix: "%" },
    { key: "conversao", label: "Conversão", suffix: "%" },
    { key: "ticket", label: "Ticket médio", prefix: "R$" },
    { key: "margem", label: "Margem", suffix: "%" },
    { key: "retencao", label: "Retenção", suffix: "%" },
    { key: "investMidia", label: "Investimento mídia", prefix: "R$" },
    { key: "organico", label: "Crescimento orgânico", suffix: "%" },
    { key: "metaB2B", label: "Meta B2B", prefix: "R$" },
    { key: "recompra", label: "Taxa recompra", suffix: "%" },
    { key: "cpm", label: "CPM", prefix: "R$" },
    { key: "ctr", label: "CTR", suffix: "%" },
    { key: "roasAlvo", label: "ROAS alvo", suffix: "x" },
  ];
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="w-[420px] h-full overflow-y-auto p-6 border-l shadow-2xl"
        style={{
          background: "oklch(0.2 0.015 30)",
          borderColor: `${SOMA_PALETTE.rose}30`,
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-light" style={{ color: SOMA_PALETTE.cream }}>Premissas Editáveis</h3>
            <p className="text-xs text-muted-foreground">Alterações refletem em todo dashboard</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.key}>
              <Label className="text-xs text-muted-foreground">{f.label}</Label>
              <div className="mt-1 flex items-center gap-2 border-b border-[#d4a5a0]/20 pb-1">
                {f.prefix && <span className="text-xs text-muted-foreground">{f.prefix}</span>}
                <input
                  type="number"
                  value={premises[f.key]}
                  step={f.suffix === "%" ? 0.1 : 1}
                  onChange={(e) => onChange({ ...premises, [f.key]: parseFloat(e.target.value) || 0 })}
                  className="flex-1 bg-transparent focus:outline-none tabular-nums text-right"
                  style={{ color: SOMA_PALETTE.cream }}
                />
                {f.suffix && <span className="text-xs text-muted-foreground">{f.suffix}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
