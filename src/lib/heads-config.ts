export type KpiUnit = "R$" | "%" | "x" | "#" | "h";
export type KpiDir = "up" | "down";

export interface HeadKpi {
  id: string;
  label: string;
  unit: KpiUnit;
  target?: number;
  dir?: KpiDir; // up = maior melhor
  // mapping para kpis_executivos
  execKpiId?: string;
}

export interface HeadConfig {
  slug: string;
  name: string;
  area: string;
  title: string;
  accent: string;
  kpis: HeadKpi[];
}

export const HEADS: HeadConfig[] = [
  {
    slug: "fernando",
    name: "Fernando",
    area: "Growth & Aquisição",
    title: "Weekly Growth Report",
    accent: "#7c3aed",
    kpis: [
      { id: "roas", label: "ROAS da semana", unit: "x", target: 3, dir: "up", execKpiId: "roas" },
      { id: "cac", label: "CAC da semana", unit: "R$", target: 80, dir: "down", execKpiId: "cac" },
      { id: "rec_influ", label: "Receita Influenciadora", unit: "R$", target: 150000, dir: "up" },
      { id: "rec_dtc", label: "Receita DTC", unit: "R$", target: 300000, dir: "up" },
      { id: "pedidos", label: "Pedidos realizados", unit: "#", target: 2000, dir: "up", execKpiId: "pedidos" },
      { id: "creators_rec", label: "Creators ativos gerando receita", unit: "#", target: 30, dir: "up" },
    ],
  },
  {
    slug: "ian",
    name: "Ian",
    area: "CRM & Retenção",
    title: "Weekly CRM Report",
    accent: "#ec4899",
    kpis: [
      { id: "recompra", label: "Taxa de recompra", unit: "%", target: 35, dir: "up", execKpiId: "recompra" },
      { id: "rec_wpp", label: "Receita WhatsApp", unit: "R$", target: 80000, dir: "up", execKpiId: "rec_wpp" },
      { id: "abertura_wpp", label: "Taxa de abertura WPP", unit: "%", target: 60, dir: "up" },
      { id: "nps", label: "NPS atual", unit: "#", target: 70, dir: "up", execKpiId: "nps" },
      { id: "assinantes", label: "Novos assinantes", unit: "#", target: 200, dir: "up" },
    ],
  },
  {
    slug: "igor",
    name: "Igor",
    area: "Comercial B2B",
    title: "Weekly B2B Report",
    accent: "#0ea5e9",
    kpis: [
      { id: "rec_b2b", label: "Receita B2B da semana", unit: "R$", target: 200000, dir: "up", execKpiId: "rec_b2b" },
      { id: "pipeline", label: "Pipeline ativo", unit: "R$", target: 800000, dir: "up", execKpiId: "pipeline" },
      { id: "novos_dist", label: "Novos distribuidores", unit: "#", target: 5, dir: "up", execKpiId: "novos_dist" },
      { id: "ticket_b2b", label: "Ticket médio", unit: "R$", target: 8000, dir: "up", execKpiId: "ticket_b2b" },
      { id: "propostas", label: "Propostas enviadas", unit: "#", target: 20, dir: "up" },
    ],
  },
  {
    slug: "miller",
    name: "Miller",
    area: "Operações",
    title: "Weekly Ops Report",
    accent: "#f97316",
    kpis: [
      { id: "sla", label: "SLA de entrega", unit: "%", target: 95, dir: "up", execKpiId: "sla_entrega" },
      { id: "margem", label: "Margem bruta realizada", unit: "%", target: 55, dir: "up", execKpiId: "margem_bruta" },
      { id: "ruptura", label: "Ruptura de estoque", unit: "%", target: 5, dir: "down", execKpiId: "ruptura" },
      { id: "cmv", label: "CMV realizado", unit: "%", target: 40, dir: "down", execKpiId: "cmv" },
      { id: "expedidos", label: "Pedidos expedidos", unit: "#", target: 2000, dir: "up" },
    ],
  },
  {
    slug: "vanessa",
    name: "Vanessa",
    area: "Influencers",
    title: "Weekly Influencer Report",
    accent: "#a855f7",
    kpis: [
      { id: "rec_infl", label: "Receita canal influenciadora", unit: "R$", target: 150000, dir: "up" },
      { id: "creators_ativos", label: "Creators ativos", unit: "#", target: 50, dir: "up", execKpiId: "creators_ativos" },
      { id: "creators_novos", label: "Novos creators onboardados", unit: "#", target: 8, dir: "up" },
      { id: "roas_infl", label: "ROAS canal influencer", unit: "x", target: 3, dir: "up" },
    ],
  },
  {
    slug: "ana-julia",
    name: "Ana Júlia",
    area: "Marca & Criativo",
    title: "Weekly Brand Report",
    accent: "#e11d48",
    kpis: [
      { id: "pecas", label: "Peças entregues na semana", unit: "#", target: 40, dir: "up" },
      { id: "sla_brief", label: "SLA briefing→entrega", unit: "h", target: 48, dir: "down" },
      { id: "engaj_ig", label: "Engajamento Instagram", unit: "%", target: 4, dir: "up" },
      { id: "aprov", label: "Aprovações sem revisão", unit: "%", target: 70, dir: "up" },
    ],
  },
  {
    slug: "jack",
    name: "Jack",
    area: "Internacional",
    title: "Weekly Internacional Report",
    accent: "#0d9488",
    kpis: [
      { id: "rec_intl", label: "Receita internacional", unit: "R$", target: 100000, dir: "up", execKpiId: "rec_intl" },
      { id: "paises", label: "Países ativos", unit: "#", target: 5, dir: "up", execKpiId: "paises" },
      { id: "dist_intl", label: "Novos distribuidores internacionais", unit: "#", target: 2, dir: "up" },
    ],
  },
];

export function getHead(slug: string) {
  return HEADS.find((h) => h.slug === slug);
}

export function kpiStatus(value: number, target: number | undefined, dir: KpiDir = "up"): "green" | "yellow" | "red" | "none" {
  if (!target || !isFinite(value)) return "none";
  const ratio = dir === "up" ? value / target : target / Math.max(value, 0.0001);
  if (ratio >= 0.95) return "green";
  if (ratio >= 0.7) return "yellow";
  return "red";
}

export function statusColor(s: "green" | "yellow" | "red" | "none") {
  return s === "green" ? "#22c55e" : s === "yellow" ? "#eab308" : s === "red" ? "#ef4444" : "#64748b";
}

// ISO week key
export function getWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function getMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
