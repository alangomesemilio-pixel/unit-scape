import type { ExecKpi, ExecState } from "./executive-data";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri";

// Each meeting is bound to a Cockpit core (or "general" for company-wide view)
export const MEETING_TO_CORE: Record<Weekday, "general" | "growth" | "crm" | "comercial" | "ops" | "intl"> = {
  mon: "general",
  tue: "growth",
  wed: "ops",
  thu: "comercial",
  fri: "general",
};

// Source of truth: pull KPIs from the Cockpit Executive state.
// This guarantees meetings & cockpit share the same indicators.
export function getMeetingKpis(id: Weekday, exec: ExecState): ExecKpi[] {
  if (id === "mon") {
    // Executive: company KPIs + headline of each core
    return [
      ...exec.general,
      ...exec.cores.flatMap((c) => c.kpis.slice(0, 3)),
    ];
  }
  if (id === "fri") {
    // PDCA: company-level
    return exec.general;
  }
  const coreId = MEETING_TO_CORE[id];
  return exec.cores.find((c) => c.id === coreId)?.kpis ?? [];
}

// Group cockpit KPIs for display in the meeting panel
export function groupKpisByCore(id: Weekday, exec: ExecState): Record<string, ExecKpi[]> {
  if (id === "mon") {
    const out: Record<string, ExecKpi[]> = { Companhia: exec.general };
    exec.cores.forEach((c) => (out[c.title] = c.kpis.slice(0, 3)));
    return out;
  }
  if (id === "fri") return { Companhia: exec.general };
  const core = exec.cores.find((c) => c.id === MEETING_TO_CORE[id]);
  return core ? { [core.title]: core.kpis } : {};
}

// Convert ISO week key (e.g. "2026-W19") to its Mon..Fri date range
export function weekRange(weekKey: string): { start: Date; end: Date } {
  const [yStr, wStr] = weekKey.split("-W");
  const y = Number(yStr);
  const w = Number(wStr);
  // ISO week: week 1 contains Jan 4
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const start = new Date(week1Mon);
  start.setUTCDate(week1Mon.getUTCDate() + (w - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 4); // Fri
  return { start, end };
}

export function formatWeekRange(weekKey: string): string {
  const { start, end } = weekRange(weekKey);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).replace(".", "");
  return `${fmt(start)} – ${fmt(end)}`;
}

export interface KpiDef {
  id: string;
  label: string;
  unit?: string;
  group: string;
}

export interface MeetingDef {
  id: Weekday;
  day: string;
  title: string;
  objective: string;
  duration: string;
  participants: string[];
  expectedResult: string[];
  kpis: KpiDef[];
  accent: string; // css var
}

export const MEETINGS: MeetingDef[] = [
  {
    id: "mon",
    day: "Segunda-feira",
    title: "Reunião Executiva",
    objective:
      "Alinhamento estratégico da semana — prioridades, gargalos, metas, decisões críticas e foco da companhia.",
    duration: "60 a 90 min",
    participants: ["Alan", "Miller", "Jack", "Fernando", "Igor", "Ian"],
    expectedResult: [
      "Semana alinhada",
      "Prioridades claras",
      "Gargalos identificados",
      "Responsáveis definidos",
    ],
    accent: "var(--level-ceo)",
    kpis: [
      { id: "rev_total", label: "Receita total", unit: "R$", group: "Empresa" },
      { id: "lucro", label: "Lucro líquido", unit: "R$", group: "Empresa" },
      { id: "caixa", label: "Caixa", unit: "R$", group: "Empresa" },
      { id: "margem", label: "Margem", unit: "%", group: "Empresa" },
      { id: "cresc_sem", label: "Crescimento semanal", unit: "%", group: "Empresa" },
      { id: "roas", label: "ROAS", unit: "x", group: "Marketing" },
      { id: "cac", label: "CAC", unit: "R$", group: "Marketing" },
      { id: "rev_canal", label: "Receita por canal", unit: "R$", group: "Marketing" },
      { id: "rev_marca", label: "Receita por marca", unit: "R$", group: "Marketing" },
      { id: "ruptura", label: "Ruptura", unit: "%", group: "Operações" },
      { id: "leadtime", label: "Lead time", unit: "dias", group: "Operações" },
      { id: "atrasos_prod", label: "Atrasos produção", unit: "#", group: "Operações" },
      { id: "sla_log", label: "SLA logística", unit: "%", group: "Operações" },
      { id: "recompra", label: "Recompra", unit: "%", group: "CRM" },
      { id: "ltv", label: "LTV", unit: "R$", group: "CRM" },
      { id: "rev_crm", label: "Receita CRM", unit: "R$", group: "CRM" },
      { id: "retencao", label: "Taxa de retenção", unit: "%", group: "CRM" },
      { id: "rev_b2b", label: "Receita B2B", unit: "R$", group: "Comercial" },
      { id: "novos_dist", label: "Novos distribuidores", unit: "#", group: "Comercial" },
      { id: "sellin", label: "Sell-in", unit: "R$", group: "Comercial" },
      { id: "rev_intl", label: "Receita internacional", unit: "R$", group: "Internacional" },
      { id: "paises", label: "Países ativos", unit: "#", group: "Internacional" },
      { id: "cresc_intl", label: "Crescimento internacional", unit: "%", group: "Internacional" },
    ],
  },
  {
    id: "tue",
    day: "Terça-feira",
    title: "Growth & Branding",
    objective:
      "Acompanhar crescimento das marcas — campanhas, criativos, creators, branding, conteúdo e aquisição.",
    duration: "60 min",
    participants: ["Alan", "Fernando", "Luís", "Ana Júlia", "Vanessa", "Lauro", "Breno", "Lúcia", "Designers"],
    expectedResult: [
      "Decisão rápida de campanhas",
      "Ajustes criativos",
      "Escala de creators",
      "Priorização de conteúdo",
    ],
    accent: "var(--level-head)",
    kpis: [
      { id: "p_roas", label: "ROAS", unit: "x", group: "Performance" },
      { id: "p_cac", label: "CAC", unit: "R$", group: "Performance" },
      { id: "p_cpa", label: "CPA", unit: "R$", group: "Performance" },
      { id: "p_rev_camp", label: "Receita por campanha", unit: "R$", group: "Performance" },
      { id: "p_ctr", label: "CTR", unit: "%", group: "Performance" },
      { id: "p_cpm", label: "CPM", unit: "R$", group: "Performance" },
      { id: "b_eng", label: "Engajamento", unit: "%", group: "Branding" },
      { id: "b_social", label: "Crescimento social", unit: "%", group: "Branding" },
      { id: "b_vol", label: "Volume de conteúdo", unit: "#", group: "Branding" },
      { id: "b_org", label: "Performance orgânica", unit: "%", group: "Branding" },
      { id: "i_roas", label: "ROAS creators", unit: "x", group: "Influência" },
      { id: "i_ugc", label: "UGC gerado", unit: "#", group: "Influência" },
      { id: "i_novos", label: "Novos creators", unit: "#", group: "Influência" },
      { id: "i_conv", label: "Conversão creator", unit: "%", group: "Influência" },
      { id: "i_cpa", label: "CPA creator", unit: "R$", group: "Influência" },
      { id: "e_conv", label: "Conversão site", unit: "%", group: "E-commerce" },
      { id: "e_ticket", label: "Ticket médio", unit: "R$", group: "E-commerce" },
      { id: "e_check", label: "Checkout rate", unit: "%", group: "E-commerce" },
    ],
  },
  {
    id: "wed",
    day: "Quarta-feira",
    title: "Operações & Supply",
    objective:
      "Garantir previsibilidade operacional — produção, estoque, logística, compras e financeiro operacional.",
    duration: "60 min",
    participants: ["Miller", "Carol", "Rafael", "Júnior", "Ícaro", "Fernanda"],
    expectedResult: [
      "Operação previsível",
      "Sem ruptura",
      "Produção alinhada",
      "Gargalos antecipados",
    ],
    accent: "var(--level-coo)",
    kpis: [
      { id: "pcp_andam", label: "Produções em andamento", unit: "#", group: "PCP" },
      { id: "pcp_atr", label: "Atrasos", unit: "#", group: "PCP" },
      { id: "pcp_lt", label: "Lead time", unit: "dias", group: "PCP" },
      { id: "pcp_cap", label: "Capacidade produtiva", unit: "%", group: "PCP" },
      { id: "pcp_fc", label: "Forecast", unit: "un", group: "PCP" },
      { id: "c_status", label: "Status fornecedores", unit: "%", group: "Compras" },
      { id: "c_save", label: "Savings", unit: "R$", group: "Compras" },
      { id: "c_cost", label: "Custos", unit: "R$", group: "Compras" },
      { id: "c_sla", label: "SLA fornecedor", unit: "%", group: "Compras" },
      { id: "l_sla", label: "SLA entrega", unit: "%", group: "Logística" },
      { id: "l_atr", label: "Atrasos", unit: "#", group: "Logística" },
      { id: "l_err", label: "Erro operacional", unit: "%", group: "Logística" },
      { id: "l_exp", label: "Expedições", unit: "#", group: "Logística" },
      { id: "f_caixa", label: "Fluxo de caixa", unit: "R$", group: "Financeiro" },
      { id: "f_pagar", label: "Contas a pagar", unit: "R$", group: "Financeiro" },
      { id: "f_marg", label: "Margem operacional", unit: "%", group: "Financeiro" },
      { id: "f_nec", label: "Necessidade de compra", unit: "R$", group: "Financeiro" },
    ],
  },
  {
    id: "thu",
    day: "Quinta-feira",
    title: "Comercial & Expansão",
    objective: "Acompanhar expansão B2B e crescimento de canais.",
    duration: "60 min",
    participants: ["Alan", "Igor", "Otávio", "Ian"],
    expectedResult: [
      "Expansão organizada",
      "Crescimento previsível",
      "Pipeline saudável",
      "Clareza comercial",
    ],
    accent: "var(--level-intl)",
    kpis: [
      { id: "co_rev", label: "Receita B2B", unit: "R$", group: "Comercial" },
      { id: "co_sellin", label: "Sell-in", unit: "R$", group: "Comercial" },
      { id: "co_dist", label: "Novos distribuidores", unit: "#", group: "Comercial" },
      { id: "co_fech", label: "Taxa de fechamento", unit: "%", group: "Comercial" },
      { id: "co_tk", label: "Ticket médio", unit: "R$", group: "Comercial" },
      { id: "co_canal", label: "Receita por canal", unit: "R$", group: "Comercial" },
      { id: "ex_reg", label: "Novas regiões", unit: "#", group: "Expansão" },
      { id: "ex_parc", label: "Parceiros ativos", unit: "#", group: "Expansão" },
      { id: "ex_rep", label: "Representantes", unit: "#", group: "Expansão" },
      { id: "ex_pipe", label: "Pipeline comercial", unit: "R$", group: "Expansão" },
      { id: "cr_recompra", label: "Recompra B2B", unit: "%", group: "CRM B2B" },
      { id: "cr_ret", label: "Retenção parceiros", unit: "%", group: "CRM B2B" },
      { id: "cr_ltv", label: "Lifetime distribuidores", unit: "R$", group: "CRM B2B" },
    ],
  },
  {
    id: "fri",
    day: "Sexta-feira",
    title: "Indicadores & PDCA",
    objective:
      "Fechar a semana com visão de gestão — o que funcionou, o que falhou, gargalos, planos de ação e prioridades da próxima semana.",
    duration: "90 min",
    participants: ["Alan", "Miller", "Heads"],
    expectedResult: [
      "Cultura de gestão",
      "Cultura de melhoria contínua",
      "Responsabilidade clara",
      "Execução alinhada",
    ],
    accent: "var(--level-head)",
    kpis: [
      { id: "co_rev2", label: "Receita", unit: "R$", group: "Companhia" },
      { id: "co_lucro", label: "Lucro", unit: "R$", group: "Companhia" },
      { id: "co_cresc", label: "Crescimento", unit: "%", group: "Companhia" },
      { id: "co_meta", label: "Meta semanal", unit: "%", group: "Companhia" },
      { id: "g_cac", label: "CAC", unit: "R$", group: "Growth" },
      { id: "g_roas", label: "ROAS", unit: "x", group: "Growth" },
      { id: "g_rev", label: "Receita", unit: "R$", group: "Growth" },
      { id: "cr_ltv2", label: "LTV", unit: "R$", group: "CRM" },
      { id: "cr_ret2", label: "Retenção", unit: "%", group: "CRM" },
      { id: "cr_rec", label: "Recompra", unit: "%", group: "CRM" },
      { id: "op_sla", label: "SLA", unit: "%", group: "Operações" },
      { id: "op_rup", label: "Ruptura", unit: "%", group: "Operações" },
      { id: "op_atr", label: "Atrasos", unit: "#", group: "Operações" },
      { id: "cm_b2b", label: "Receita B2B", unit: "R$", group: "Comercial" },
      { id: "cm_ex", label: "Expansão", unit: "%", group: "Comercial" },
    ],
  },
];

// Persistence types
export interface KpiEntry {
  value: string;
  target: string;
}

export interface ActionItem {
  id: string;
  text: string;
  owner: string;
  due: string;
  status: "todo" | "doing" | "done";
}

export interface PdcaItem {
  id: string;
  topic: string; // KPI ou tema discutido
  kpiId?: string; // opcional, vínculo a um KPI
  owner: string;
  plan: string;
  doText: string;
  check: string;
  act: string;
  createdAt: string;
}

export interface MeetingState {
  attendance: Record<string, boolean>;
  kpis: Record<string, KpiEntry>;
  notes: string;
  actions: ActionItem[];
  pdca?: { plan: string; doText: string; check: string; act: string };
  pdcaItems?: PdcaItem[];
  done?: boolean;
  lastUpdated?: string;
}

export type WeekState = Record<Weekday, MeetingState>;

export function emptyMeetingState(): MeetingState {
  return {
    attendance: {},
    kpis: {},
    notes: "",
    actions: [],
    pdca: { plan: "", doText: "", check: "", act: "" },
    done: false,
  };
}

export function emptyWeekState(): WeekState {
  return {
    mon: emptyMeetingState(),
    tue: emptyMeetingState(),
    wed: emptyMeetingState(),
    thu: emptyMeetingState(),
    fri: emptyMeetingState(),
  };
}

// ISO week key e.g. 2026-W19
export function getWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function shiftWeek(weekKey: string, delta: number): string {
  const [yStr, wStr] = weekKey.split("-W");
  const y = Number(yStr);
  const w = Number(wStr);
  // approximate: convert to date, add 7*delta days, recompute
  const simple = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
  simple.setUTCDate(simple.getUTCDate() + delta * 7);
  return getWeekKey(simple);
}
