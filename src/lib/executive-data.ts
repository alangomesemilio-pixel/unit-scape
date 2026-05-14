// Executive cockpit data structures & defaults

export type Trend = "up" | "down" | "flat";
export type Status = "healthy" | "warning" | "critical";

export type Frequency = "Semanal" | "Mensal";

export interface ExecKpi {
  id: string;
  label: string;
  unit: string; // R$, %, x, #, dias
  target: number;
  current: number;
  previous: number;
  owner?: string;
  higherIsBetter?: boolean; // default true
  frequency?: Frequency; // cadência de leitura
  objective?: string; // objetivo estratégico
}

export interface ExecCore {
  id: string;
  title: string;
  owner: string;
  accent: string; // css var
  description: string;
  kpis: ExecKpi[];
}

export interface PdcaItem {
  id: string;
  problem: string;
  owner: string;
  plan: string;
  due: string;
  status: "todo" | "doing" | "done";
  kpi?: string;
}

export interface MeetingNote {
  victories: string[];
  bottlenecks: string[];
  priorities: string[];
  decisions: string[];
}

export interface WeekSnapshot {
  week: string; // ISO week key e.g. 2026-W19
  closedAt: string;
  values: Record<string, number>; // kpi_id -> current at close
}

export interface MonthSnapshot {
  month: string; // YYYY-MM
  closedAt: string;
  values: Record<string, number>;
}

export interface ExecState {
  cores: ExecCore[];
  general: ExecKpi[];
  brandRevenue: { name: string; current: number; previous: number; target: number }[];
  channelRevenue: { name: string; current: number; previous: number; target: number }[];
  pdca: PdcaItem[];
  meeting: MeetingNote;
  history?: WeekSnapshot[];
  monthHistory?: MonthSnapshot[];
  lastUpdated?: string;
}

export function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function isoWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const k = (
  id: string,
  label: string,
  unit: string,
  target: number,
  current: number,
  previous: number,
  owner?: string,
  higherIsBetter = true,
  frequency: Frequency = "Semanal",
  objective?: string
): ExecKpi => ({ id, label, unit, target, current, previous, owner, higherIsBetter, frequency, objective });

// IDs dos 16 KPIs estratégicos do CEO Dashboard (modelo holding)
export const STRATEGIC_KPI_IDS = [
  "rev_total",
  "lucro",
  "caixa",
  "margem_contrib",
  "g_mer",
  "g_cac",
  "c_ltv",
  "c_ltv_cac",
  "c_recompra",
  "c_recurring",
  "co_rev",
  "co_dist_ativos",
  "o_rup",
  "o_lt",
  "i_rev",
  "margem",
] as const;

export const defaultExecState: ExecState = {
  general: [
    k("rev_total", "Receita consolidada", "R$", 1200000, 1085000, 980000, "Alan", true, "Semanal", "Crescimento da holding"),
    k("lucro", "Lucro líquido", "R$", 280000, 251000, 220000, "Alan", true, "Semanal", "Eficiência operacional"),
    k("margem", "Margem", "%", 25, 23.1, 22.4, "Alan", true, "Semanal", "Sustentabilidade da operação"),
    k("margem_contrib", "Margem de contribuição", "%", 45, 42.3, 40.8, "Alan", true, "Mensal", "Saúde unitária"),
    k("caixa", "Caixa", "R$", 2000000, 1850000, 1720000, "Ícaro", true, "Semanal", "Capacidade de expansão"),
    k("cresc_sem", "Crescimento semanal", "%", 8, 10.7, 6.2, "Alan", true, "Semanal", "Velocidade de crescimento"),
    k("cresc_mes", "Crescimento mensal", "%", 15, 18.4, 12.1, "Alan", true, "Mensal", "Tendência de crescimento"),
  ],
  brandRevenue: [
    { name: "Pimenta Rosa", current: 540000, previous: 480000, target: 600000 },
    { name: "GRAx House", current: 320000, previous: 295000, target: 340000 },
    { name: "Outros", current: 225000, previous: 205000, target: 260000 },
  ],
  channelRevenue: [
    { name: "D2C / E-commerce", current: 480000, previous: 430000, target: 520000 },
    { name: "B2B / Distribuidores", current: 360000, previous: 325000, target: 400000 },
    { name: "Marketplaces", current: 145000, previous: 130000, target: 160000 },
    { name: "Internacional", current: 100000, previous: 95000, target: 120000 },
  ],
  cores: [
    {
      id: "growth",
      title: "Growth & Branding",
      owner: "Fernando",
      accent: "var(--level-head)",
      description: "Aquisição, performance, branding, conteúdo e influência.",
      kpis: [
        k("g_mer", "MER (Marketing Efficiency Ratio)", "x", 4.0, 4.2, 3.6, "Fernando", true, "Semanal", "Eficiência global de marketing"),
        k("g_roas", "ROAS", "x", 3.5, 3.8, 3.2, "Luís", true, "Semanal", "Eficiência de mídia"),
        k("g_cac", "CAC consolidado", "R$", 65, 58, 72, "Luís", false, "Semanal", "Eficiência de aquisição"),
        k("g_cpa", "CPA", "R$", 45, 41, 49, "Luís", false, "Semanal", "Eficiência de conversão"),
        k("g_rev_camp", "Receita por campanha", "R$", 80000, 92000, 71000, "Luís", true, "Semanal"),
        k("g_rev_canal", "Receita por canal", "R$", 220000, 210000, 195000, "Fernando", true, "Semanal"),
        k("g_conv", "Conversão site", "%", 2.5, 2.3, 2.1, "Luís", true, "Semanal"),
        k("g_ctr", "CTR", "%", 1.8, 2.1, 1.6, "Luís", true, "Semanal", "Qualidade de criativos"),
        k("g_cpm", "CPM", "R$", 28, 25, 31, "Luís", false, "Semanal"),
        k("g_tk", "Ticket médio", "R$", 220, 235, 210, "Fernando", true, "Semanal"),
        k("g_creators", "Receita creators", "R$", 90000, 78000, 65000, "Vanessa", true, "Semanal"),
        k("g_org", "Receita orgânica", "R$", 60000, 67000, 54000, "Ana Júlia", true, "Semanal"),
        k("g_social", "Crescimento social", "%", 6, 7.4, 4.8, "Lúcia", true, "Semanal"),
      ],
    },
    {
      id: "crm",
      title: "CRM & Customer Experience",
      owner: "Ian",
      accent: "var(--level-team)",
      description: "Retenção, recompra, jornadas e suporte.",
      kpis: [
        k("c_ltv", "LTV", "R$", 850, 910, 820, "Ian", true, "Mensal", "Rentabilidade do cliente"),
        k("c_ltv_cac", "LTV / CAC", "x", 6.0, 6.7, 5.4, "Fernando", true, "Mensal", "Escalabilidade saudável"),
        k("c_recompra", "Taxa de recompra", "%", 28, 31, 26, "Ian", true, "Semanal", "Retenção da base"),
        k("c_recurring", "% Receita recorrente", "%", 35, 32, 28, "Ian", true, "Mensal", "Força da base recorrente"),
        k("c_ret", "Taxa de retenção", "%", 70, 72, 68, "Ian", true, "Mensal"),
        k("c_rev_crm", "Receita CRM", "R$", 180000, 195000, 160000, "Ian", true, "Semanal", "Monetização da base"),
        k("c_wpp", "Receita WhatsApp", "R$", 90000, 84000, 76000, "Ian", true, "Semanal"),
        k("c_carr", "Recuperação de carrinho", "%", 18, 16, 15, "Ian", true, "Semanal"),
        k("c_nps", "NPS", "#", 70, 74, 68, "Julian", true, "Mensal", "Experiência do cliente"),
        k("c_resp", "Tempo resposta suporte", "min", 10, 12, 14, "Julian", false, "Semanal"),
        k("c_resol", "Taxa resolução suporte", "%", 90, 88, 85, "Julian", true, "Semanal"),
      ],
    },
    {
      id: "comercial",
      title: "Comercial & Expansão",
      owner: "Igor",
      accent: "var(--level-intl)",
      description: "Crescimento B2B, distribuidores e expansão regional.",
      kpis: [
        k("co_rev", "Receita B2B", "R$", 360000, 340000, 305000, "Igor", true, "Semanal", "Expansão comercial"),
        k("co_dist_ativos", "Distribuidores ativos", "#", 30, 26, 24, "Igor", true, "Mensal", "Escala comercial"),
        k("co_sellin", "Sell-in", "R$", 250000, 235000, 215000, "Igor", true, "Semanal", "Volume de canal"),
        k("co_dist", "Novos distribuidores", "#", 8, 6, 4, "Igor", true, "Mensal"),
        k("co_tk", "Ticket médio B2B", "R$", 12000, 11500, 10800, "Otávio", true, "Semanal"),
        k("co_pipe", "Pipeline comercial", "R$", 800000, 920000, 740000, "Otávio", true, "Semanal", "Previsibilidade comercial"),
        k("co_fech", "Taxa de fechamento", "%", 25, 22, 20, "Otávio", true, "Semanal"),
        k("co_reg", "Expansão regional", "#", 5, 4, 3, "Igor", true, "Mensal"),
        k("co_per_dist", "Receita por distribuidor", "R$", 28000, 26500, 24000, "Igor", true, "Mensal", "Eficiência de canal"),
      ],
    },
    {
      id: "ops",
      title: "Operações & Supply",
      owner: "Miller",
      accent: "var(--level-coo)",
      description: "Produção, supply, logística e financeiro operacional.",
      kpis: [
        k("o_rup", "Ruptura de estoque", "%", 2, 3.5, 4.2, "Rafael", false, "Semanal", "Evitar perda de vendas"),
        k("o_lt", "Lead time", "dias", 14, 16, 18, "Carol", false, "Semanal", "Velocidade operacional"),
        k("o_sla", "SLA logística", "%", 95, 92, 90, "Júnior", true, "Semanal", "Qualidade de entrega"),
        k("o_giro", "Giro de estoque", "x", 6, 5.2, 4.8, "Rafael", true, "Mensal", "Eficiência de estoque"),
        k("o_prod", "Produções em andamento", "#", 12, 10, 9, "Carol", true, "Semanal"),
        k("o_atr", "Atrasos", "#", 3, 5, 7, "Júnior", false, "Semanal"),
        k("o_err", "Erro operacional", "%", 1, 1.8, 2.4, "Júnior", false, "Semanal"),
        k("o_forn", "Status fornecedores", "%", 95, 93, 90, "Rafael", true, "Semanal"),
        k("o_comp", "Compras pendentes", "#", 5, 8, 10, "Rafael", false, "Semanal"),
        k("o_caixa", "Fluxo caixa operacional", "R$", 450000, 420000, 390000, "Ícaro", true, "Semanal"),
      ],
    },
    {
      id: "intl",
      title: "Internacional",
      owner: "Jack",
      accent: "var(--level-ceo)",
      description: "Expansão global Pimenta Rosa.",
      kpis: [
        k("i_rev", "Receita internacional", "R$", 120000, 100000, 95000, "Jack"),
        k("i_cresc", "Crescimento internacional", "%", 12, 5.3, 8.1, "Jack"),
        k("i_paises", "Países ativos", "#", 8, 6, 5, "Jack"),
        k("i_dist", "Distribuidores globais", "#", 20, 17, 15, "Jack"),
        k("i_cac", "CAC internacional", "R$", 90, 110, 105, "Jack", false),
        k("i_per_pais", "Receita por país", "R$", 18000, 16500, 15800, "Jack"),
        k("i_exp", "Expansão global (novos)", "#", 2, 1, 1, "Jack"),
      ],
    },
  ],
  pdca: [
    {
      id: "p1",
      problem: "Ruptura de estoque acima da meta (3.5% vs 2%)",
      owner: "Rafael",
      plan: "Revisar forecast com PCP e antecipar PO dos SKUs A.",
      due: "Sex",
      status: "doing",
      kpi: "Ruptura estoque",
    },
    {
      id: "p2",
      problem: "Crescimento internacional desacelerou (5.3% vs meta 12%)",
      owner: "Jack",
      plan: "Reativar 2 distribuidores LATAM e revisar pricing UE.",
      due: "Próx. semana",
      status: "todo",
      kpi: "Crescimento internacional",
    },
    {
      id: "p3",
      problem: "Taxa de fechamento B2B abaixo da meta (22% vs 25%)",
      owner: "Otávio",
      plan: "Treinamento de pitch e revisão de proposta comercial.",
      due: "Qua",
      status: "doing",
      kpi: "Taxa fechamento",
    },
  ],
  meeting: {
    victories: [
      "ROAS 3.8x — acima da meta",
      "Receita CRM cresceu 22% s/s",
      "Pipeline comercial em R$ 920k",
    ],
    bottlenecks: [
      "Ruptura de estoque",
      "SLA logística abaixo da meta",
      "Crescimento internacional desacelerando",
    ],
    priorities: [
      "Resolver ruptura SKUs A",
      "Reativar distribuidores LATAM",
      "Escalar campanha vencedora de creators",
    ],
    decisions: [
      "Aprovar +20% budget Performance",
      "Aprovar contratação de Buyer Sr.",
    ],
  },
};

// Computations
export function variation(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function statusOf(kpi: ExecKpi): Status {
  const hib = kpi.higherIsBetter !== false;
  if (!kpi.target) return "healthy";
  const ratio = kpi.current / kpi.target;
  if (hib) {
    if (ratio >= 1) return "healthy";
    if (ratio >= 0.85) return "warning";
    return "critical";
  } else {
    if (ratio <= 1) return "healthy";
    if (ratio <= 1.2) return "warning";
    return "critical";
  }
}

export function trendOf(kpi: ExecKpi): Trend {
  const v = variation(kpi.current, kpi.previous);
  if (Math.abs(v) < 0.5) return "flat";
  return v > 0 ? "up" : "down";
}

export function formatValue(v: number, unit: string) {
  if (unit === "R$") {
    if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
    if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
    return `R$ ${v.toFixed(0)}`;
  }
  if (unit === "%") return `${v.toFixed(1)}%`;
  if (unit === "x") return `${v.toFixed(2)}x`;
  return `${v.toLocaleString("pt-BR")}${unit ? ` ${unit}` : ""}`;
}

export const EXEC_STORAGE_KEY = "grax.exec.v1";
