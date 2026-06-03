import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getSomaKv, setSomaKv } from "@/lib/soma-store.functions";
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
  Settings2,
  Heart,
  Briefcase,
  Calendar,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Zap,
  ChevronDown,
  ChevronUp,
  Trophy,
  Flag,
  Plus,
  Trash2,
  Save,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

// ============ TYPES ============
type ScenarioKey = "conservador" | "base" | "agressivo";

interface BasePremises {
  // Mês 1 (Junho) — inputs centrais
  ticket: number;
  pedidos: number;
  conversao: number; // %
  cac: number;
  roas: number;
  invest: number;
  // Receita por canal — mês 1
  receitaDTC: number;
  receitaB2B: number;
  receitaInfluenciadora: number;
  receitaWhatsApp: number;
  receitaTikTokShop: number;
  receitaAssinatura: number;
  receitaMarketplace: number;
  // Saúde
  margemBruta: number; // %
  cmv: number; // % (produto + frete)
  recompra: number; // %
  ltv: number;
  // Custos como % da receita — alimentam o forecast mensal
  opexPct: number;     // % despesas operacionais
  impostoPct: number;  // % impostos sobre receita
  pessoasPct: number;  // % custo com pessoas (time)
  // Crescimentos mensais (%) — MOTOR DO FORECAST
  crescMensal: number; // fallback / crescimento geral
  crescReceita: number;
  crescPedidos: number;
  crescCac: number;
  crescInvest: number;
  crescB2B: number;
  crescInfluenciadora: number;
  crescWhatsApp: number;
  crescAssinatura: number;
  crescOperacional: number;
  crescEquipe: number;
}

interface RealizedMonth {
  receita?: number;
  pedidos?: number;
  cac?: number;
  invest?: number;
  ticket?: number;
  ticketB2B?: number;
  lucro?: number;
  roas?: number;
  conversao?: number;
  cmv?: number;
  opex?: number;
  pessoas?: number;
  imposto?: number;
  ebitda?: number;
  margem?: number;
  recB2B?: number;
  recInfluenciadora?: number;
  recWhatsApp?: number;
  recTikTokShop?: number;
  recAssinatura?: number;
}


interface ChannelRealized {
  receita?: number;
  pedidos?: number;
  cac?: number;
  margem?: number;
  roas?: number;
}

// Premissas detalhadas de funil por canal (mês base = Jun)
interface ChannelPremise {
  visitas: number;       // sessões/leads no mês base
  ctc: number;           // % visita → carrinho
  cco: number;           // % carrinho → checkout
  cop: number;           // % checkout → pedido
  ticket: number;
  cac: number;
  invest: number;
  growthVisitas: number; // % m/m
  growthConv: number;    // pp uplift cumulativo na conv final por mês
}

// Sub-canais de B2B: cada fonte de captação tem leads, conv, ticket e crescimento próprios
interface B2BSubChannel {
  id: string;
  name: string;
  leads: number;          // leads/contatos/oportunidades no mês base
  convLeadPedido: number; // % lead → pedido fechado
  ticket: number;         // ticket médio do pedido B2B desse canal
  cac: number;            // custo médio por cliente fechado
  invest: number;         // investimento mensal nesse canal (ads, comissão, time)
  growthLeads: number;    // % crescimento m/m de leads
  growthConv: number;     // pp uplift cumulativo na conv por mês
}

// OKRs estratégicos · vinculam metas trimestrais/semestre ao forecast operacional
type KrSource =
  | "manual"
  | "receitaSemestre"
  | "ebitdaSemestre"
  | "pedidosSemestre"
  | "ticketMedio"
  | "ltvCac"
  | "recompra"
  | "roas"
  | "b2bRev"
  | "investSemestre";

interface KeyResult {
  id: string;
  title: string;
  owner: string;
  unit: "R$" | "%" | "x" | "#";
  baseline: number;
  target: number;
  source: KrSource;
  current?: number; // override manual
}

interface OkrObjective {
  id: string;
  title: string;
  why: string;
  owner: string;
  accent: string;
  krs: KeyResult[];
}

interface SomaState {
  premises: BasePremises;
  realized: Record<string, RealizedMonth>; // month label -> realized
  channelReal: Record<string, ChannelRealized>; // channel name -> realized
  channelPremises: Record<string, ChannelPremise>; // funil + forecast por canal
  b2bSubChannels: B2BSubChannel[]; // detalhamento robusto do B2B
  okrs: OkrObjective[];
  scenario: ScenarioKey;
  scenarioMults: Record<ScenarioKey, { rev: number; cac: number }>;
}

const MONTHS = ["Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const CHANNEL_KEYS: { key: keyof BasePremises; name: string }[] = [
  { key: "receitaDTC", name: "DTC" },
  { key: "receitaWhatsApp", name: "WhatsApp" },
  { key: "receitaInfluenciadora", name: "Influenciadora" },
  { key: "receitaTikTokShop", name: "TikTok Shop" },
  { key: "receitaB2B", name: "B2B" },
  { key: "receitaAssinatura", name: "Assinatura" },
  { key: "receitaMarketplace", name: "Marketplace" },
];

const DEFAULT_PREMISES: BasePremises = {
  ticket: 245,
  pedidos: 750,
  conversao: 2.3,
  cac: 65,
  roas: 3.8,
  invest: 48000,
  receitaDTC: 95000,
  receitaB2B: 55000,
  receitaInfluenciadora: 38000,
  receitaWhatsApp: 22000,
  receitaTikTokShop: 14000,
  receitaAssinatura: 12000,
  receitaMarketplace: 18000,
  margemBruta: 58,
  cmv: 38,
  recompra: 32,
  ltv: 720,
  opexPct: 14,
  impostoPct: 9,
  pessoasPct: 18,
  crescMensal: 18,
  crescReceita: 20,
  crescPedidos: 15,
  crescCac: 3,
  crescInvest: 12,
  crescB2B: 22,
  crescInfluenciadora: 25,
  crescWhatsApp: 18,
  crescAssinatura: 15,
  crescOperacional: 12,
  crescEquipe: 8,
};

const DEFAULT_CHANNEL_PREMISES: Record<string, ChannelPremise> = {
  DTC:            { visitas: 25000, ctc: 8,  cco: 45, cop: 55, ticket: 250,  cac: 65,  invest: 28000, growthVisitas: 14, growthConv: 0.10 },
  WhatsApp:       { visitas: 4500,  ctc: 18, cco: 60, cop: 65, ticket: 195,  cac: 38,  invest: 4000,  growthVisitas: 22, growthConv: 0.20 },
  Influenciadora: { visitas: 12000, ctc: 10, cco: 50, cop: 50, ticket: 230,  cac: 55,  invest: 8000,  growthVisitas: 28, growthConv: 0.15 },
  "TikTok Shop":  { visitas: 8000,  ctc: 9,  cco: 40, cop: 45, ticket: 180,  cac: 48,  invest: 4500,  growthVisitas: 25, growthConv: 0.12 },
  B2B:            { visitas: 1200,  ctc: 30, cco: 70, cop: 80, ticket: 2200, cac: 380, invest: 3500,  growthVisitas: 18, growthConv: 0.10 },
  Assinatura:     { visitas: 2200,  ctc: 12, cco: 55, cop: 70, ticket: 165,  cac: 42,  invest: 1500,  growthVisitas: 16, growthConv: 0.15 },
  Marketplace:    { visitas: 9000,  ctc: 7,  cco: 40, cop: 50, ticket: 210,  cac: 55,  invest: 0,     growthVisitas: 12, growthConv: 0.08 },
};

const DEFAULT_B2B_SUBS: B2BSubChannel[] = [
  { id: "funil-direto",   name: "Funil Direto (site)",      leads: 320, convLeadPedido: 18, ticket: 1800, cac: 220, invest: 1500, growthLeads: 18, growthConv: 0.20 },
  { id: "distribuidores", name: "Distribuidores",            leads: 90,  convLeadPedido: 38, ticket: 4500, cac: 580, invest: 800,  growthLeads: 14, growthConv: 0.15 },
  { id: "cadeias-pdv",    name: "Cadeias PDV (grandes redes)", leads: 35, convLeadPedido: 22, ticket: 9800, cac: 1200, invest: 600, growthLeads: 10, growthConv: 0.10 },
  { id: "key-accounts",   name: "Key Accounts / Corporate", leads: 18,  convLeadPedido: 28, ticket: 7200, cac: 950, invest: 600,  growthLeads: 12, growthConv: 0.15 },
];

const DEFAULT_OKRS: OkrObjective[] = [
  {
    id: "okr-receita",
    title: "Escalar Soma com saúde financeira",
    why: "Atingir R$ 3.5M no semestre mantendo EBITDA saudável e CAC sob controle.",
    owner: "Alan · CEO",
    accent: "#f28572",
    krs: [
      { id: "kr-rev",   title: "Receita semestre (Jun→Dez)", owner: "CEO",     unit: "R$", baseline: 0, target: 3500000, source: "receitaSemestre" },
      { id: "kr-ebit",  title: "EBITDA semestre",            owner: "CFO",     unit: "R$", baseline: 0, target: 700000,  source: "ebitdaSemestre" },
      { id: "kr-roas",  title: "ROAS médio",                 owner: "Growth",  unit: "x",  baseline: 3.5, target: 4.0,   source: "roas" },
      { id: "kr-inv",   title: "Investimento dentro do plano", owner: "CFO",   unit: "R$", baseline: 0, target: 480000,  source: "investSemestre" },
    ],
  },
  {
    id: "okr-retencao",
    title: "Construir base recorrente e fiel",
    why: "Cada cliente vale mais. Recompra, LTV e assinatura sustentam o crescimento.",
    owner: "CRM · Ian",
    accent: "#d6b4ff",
    krs: [
      { id: "kr-recompra", title: "Taxa de recompra",         owner: "CRM",   unit: "%",  baseline: 32, target: 38,    source: "recompra" },
      { id: "kr-ltvcac",   title: "LTV / CAC",                owner: "CRM",   unit: "x",  baseline: 5.0, target: 6.0,  source: "ltvCac" },
      { id: "kr-assin",    title: "Receita Assinatura semestre", owner: "CRM", unit: "R$", baseline: 0, target: 150000, source: "manual", current: 28000 },
      { id: "kr-nps",      title: "NPS",                      owner: "CX",    unit: "#",  baseline: 70, target: 78,    source: "manual", current: 72 },
    ],
  },
  {
    id: "okr-b2b",
    title: "Transformar B2B em motor previsível",
    why: "Pedidos grandes, recorrência por canal e ticket médio alto.",
    owner: "Comercial · Igor",
    accent: "#b78cff",
    krs: [
      { id: "kr-b2brev", title: "Receita B2B semestre",       owner: "Comercial", unit: "R$", baseline: 0, target: 700000, source: "b2bRev" },
      { id: "kr-b2bsub", title: "Sub-canais B2B ativos",      owner: "Comercial", unit: "#",  baseline: 2, target: 5,      source: "manual", current: 4 },
      { id: "kr-b2btk",  title: "Ticket médio B2B",           owner: "Comercial", unit: "R$", baseline: 2200, target: 3500, source: "manual", current: 2800 },
    ],
  },
  {
    id: "okr-growth",
    title: "Growth creator-led com previsibilidade",
    why: "Pedidos, ticket e receita por canais que sustentam aquisição.",
    owner: "Growth · Fernando",
    accent: "#ff9c8f",
    krs: [
      { id: "kr-ped",   title: "Pedidos semestre",            owner: "Growth", unit: "#",  baseline: 0, target: 12000, source: "pedidosSemestre" },
      { id: "kr-tk",    title: "Ticket médio",                owner: "Growth", unit: "R$", baseline: 245, target: 265,  source: "ticketMedio" },
      { id: "kr-infl",  title: "Receita Influenciadora semestre", owner: "Growth", unit: "R$", baseline: 0, target: 400000, source: "manual", current: 95000 },
    ],
  },
];

const DEFAULT_STATE: SomaState = {
  premises: DEFAULT_PREMISES,
  realized: {
    Jun: { receita: 248000, pedidos: 990, cac: 68, invest: 49000, ticket: 250, lucro: 42000 },
    Jul: { receita: 282000, pedidos: 1110, cac: 72, invest: 56000, ticket: 254, lucro: 47000 },
  },
  channelReal: {
    DTC: { receita: 96000, pedidos: 380, cac: 70, margem: 56, roas: 3.5 },
    WhatsApp: { receita: 24000, pedidos: 82, cac: 38, margem: 64, roas: 5.0 },
  },
  channelPremises: DEFAULT_CHANNEL_PREMISES,
  b2bSubChannels: DEFAULT_B2B_SUBS,
  okrs: DEFAULT_OKRS,
  scenario: "base",
  scenarioMults: {
    conservador: { rev: 0.85, cac: 1.15 },
    base: { rev: 1, cac: 1 },
    agressivo: { rev: 1.22, cac: 0.85 },
  },
};

const SCENARIO_MULT: Record<ScenarioKey, { rev: number; cac: number }> = {
  conservador: { rev: 0.85, cac: 1.15 },
  base: { rev: 1, cac: 1 },
  agressivo: { rev: 1.22, cac: 0.85 },
};

const STORAGE_KEY = "soma.forecast.v2";
const SNAPSHOT_KEY = "soma.forecast.snapshot.v1";
const ROADMAP_KEY = "soma.roadmap.plans.v1";

// ============ ROADMAP / CALENDÁRIO COMERCIAL BR ============
interface CalendarDate {
  date: string; // dd/mm
  label: string;
  type: "data" | "campanha" | "sazonal";
}
interface MonthPlan {
  tema: string;
  objetivo: string;
  ideias: string;
  campanhas: string;
  kpi: string;
  observacoes: string;
  datasSelecionadas: string[]; // labels das datas escolhidas
}
const EMPTY_PLAN: MonthPlan = {
  tema: "",
  objetivo: "",
  ideias: "",
  campanhas: "",
  kpi: "",
  observacoes: "",
  datasSelecionadas: [],
};
const ROADMAP_MONTHS: { m: string; t: string; suggestedDates: CalendarDate[] }[] = [
  {
    m: "Junho",
    t: "Mês base",
    suggestedDates: [
      { date: "12/06", label: "Dia dos Namorados", type: "data" },
      { date: "13/06", label: "Santo Antônio (casamenteiro)", type: "data" },
      { date: "24/06", label: "São João / Festas Juninas", type: "sazonal" },
      { date: "21/06", label: "Início do Inverno", type: "sazonal" },
    ],
  },
  {
    m: "Julho",
    t: "Escala creators",
    suggestedDates: [
      { date: "01-31/07", label: "Férias Escolares (alto consumo digital)", type: "sazonal" },
      { date: "20/07", label: "Dia do Amigo", type: "data" },
      { date: "25/07", label: "Dia da Mulher Negra Latino-Americana", type: "data" },
      { date: "26/07", label: "Dia dos Avós", type: "data" },
      { date: "Meio do mês", label: "Christmas in July (campanha global)", type: "campanha" },
    ],
  },
  {
    m: "Agosto",
    t: "Expansão Meta/TikTok",
    suggestedDates: [
      { date: "2º dom", label: "Dia dos Pais", type: "data" },
      { date: "11/08", label: "Dia do Estudante", type: "data" },
      { date: "15/08", label: "Aniversário da marca / Friendship Week", type: "campanha" },
      { date: "27/08", label: "Dia do Psicólogo (wellness/saúde mental)", type: "data" },
    ],
  },
  {
    m: "Setembro",
    t: "B2B forte",
    suggestedDates: [
      { date: "07/09", label: "Independência do Brasil", type: "data" },
      { date: "10/09", label: "Setembro Amarelo (saúde mental)", type: "sazonal" },
      { date: "15/09", label: "Dia do Cliente", type: "campanha" },
      { date: "21/09", label: "Dia da Árvore (sustentabilidade)", type: "data" },
      { date: "23/09", label: "Início da Primavera (renovação)", type: "sazonal" },
    ],
  },
  {
    m: "Outubro",
    t: "Assinatura",
    suggestedDates: [
      { date: "01-31/10", label: "Outubro Rosa (câncer de mama)", type: "sazonal" },
      { date: "12/10", label: "Dia das Crianças / N.Sra. Aparecida", type: "data" },
      { date: "15/10", label: "Dia do Professor", type: "data" },
      { date: "31/10", label: "Halloween (promo temática)", type: "campanha" },
      { date: "Meio do mês", label: "Pré-Black Friday (warm-up base)", type: "campanha" },
    ],
  },
  {
    m: "Novembro",
    t: "Black Friday",
    suggestedDates: [
      { date: "01-30/11", label: "Novembro Azul (saúde do homem)", type: "sazonal" },
      { date: "15/11", label: "Proclamação da República", type: "data" },
      { date: "20/11", label: "Consciência Negra", type: "data" },
      { date: "28/11", label: "Black Friday (última sexta)", type: "campanha" },
      { date: "01/12", label: "Cyber Monday", type: "campanha" },
    ],
  },
  {
    m: "Dezembro",
    t: "Expansão SKUs",
    suggestedDates: [
      { date: "Mês todo", label: "13º salário (poder de compra alto)", type: "sazonal" },
      { date: "01-24/12", label: "Calendário do Advento / contagem regressiva", type: "campanha" },
      { date: "15/12", label: "Última semana logística viável (Natal)", type: "sazonal" },
      { date: "25/12", label: "Natal", type: "data" },
      { date: "21/12", label: "Início do Verão", type: "sazonal" },
      { date: "31/12", label: "Réveillon / metas Ano Novo (wellness)", type: "campanha" },
    ],
  },
];


const SOMA_PALETTE = {
  rose: "#f28572",
  roseDeep: "#e56b78",
  sand: "#d6b4ff",
  cream: "#f7f1e8",
  ink: "#1b1426",
  gold: "#b78cff",
  sage: "#87d4b0",
  blush: "#f1d6ff",
  alert: "#ff8b94",
  warn: "#ffb36b",
};
const PIE_COLORS = ["#f28572", "#b78cff", "#87d4b0", "#e56b78", "#d6b4ff", "#f1d6ff", "#7b5ea7", "#8f7bc4"];

// ============ HELPERS ============
const brl = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
};
const pct = (n: number) => `${n.toFixed(1)}%`;

function loadState(): SomaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_STATE,
        ...parsed,
        premises: { ...DEFAULT_PREMISES, ...(parsed.premises || {}) },
        realized: parsed.realized || {},
        channelReal: parsed.channelReal || {},
        channelPremises: { ...DEFAULT_CHANNEL_PREMISES, ...(parsed.channelPremises || {}) },
        b2bSubChannels: Array.isArray(parsed.b2bSubChannels) && parsed.b2bSubChannels.length > 0 ? parsed.b2bSubChannels : DEFAULT_B2B_SUBS,
        okrs: Array.isArray(parsed.okrs) && parsed.okrs.length > 0 ? parsed.okrs : DEFAULT_OKRS,
        scenarioMults: { ...DEFAULT_STATE.scenarioMults, ...(parsed.scenarioMults || {}) },
      };
    }
  } catch {}
  return DEFAULT_STATE;
}

// status semafórico baseado em % atingimento
function statusOf(real: number | undefined, proj: number, inverted = false): "green" | "yellow" | "red" | "gray" {
  if (!real || !proj) return "gray";
  const ratio = real / proj;
  if (inverted) {
    if (ratio <= 1.05) return "green";
    if (ratio <= 1.2) return "yellow";
    return "red";
  }
  if (ratio >= 0.95) return "green";
  if (ratio >= 0.8) return "yellow";
  return "red";
}
const STATUS_COLOR: Record<string, string> = {
  green: SOMA_PALETTE.sage,
  yellow: SOMA_PALETTE.warn,
  red: SOMA_PALETTE.alert,
  gray: "#6b6560",
};

// ============ PROJECTION ENGINE ============
interface ProjMonth {
  month: string;
  idx: number;
  invest: number;
  cac: number;
  ticket: number;
  pedidos: number;
  receita: number;
  roas: number;
  lucro: number;
  ebitda: number;
  conversao: number;
  margem: number;
  // custos detalhados
  cmvCost: number;
  opexCost: number;
  impostoCost: number;
  pessoasCost: number;
  // canais
  canais: Record<string, number>;
  receitaB2B: number;
  receitaInfluenciadora: number;
  receitaWhatsApp: number;
  receitaTikTokShop: number;
  receitaAssinatura: number;
}

function project(p: BasePremises, mult: { rev: number; cac: number }): ProjMonth[] {
  const gPed = p.crescPedidos / 100;
  const gCac = p.crescCac / 100;
  const gInv = p.crescInvest / 100;
  const gRev = p.crescReceita / 100;
  const gB2B = p.crescB2B / 100;
  const gInf = p.crescInfluenciadora / 100;
  const gWpp = p.crescWhatsApp / 100;
  const gAss = p.crescAssinatura / 100;

  return MONTHS.map((m, i) => {
    // i=0 → Junho (mês base, sem crescimento aplicado)
    const fPed = Math.pow(1 + gPed, i);
    const fCac = Math.pow(1 + gCac, i) * mult.cac;
    const fInv = Math.pow(1 + gInv, i);
    const fRev = Math.pow(1 + gRev, i) * mult.rev;
    const fB2B = Math.pow(1 + gB2B, i);
    const fInf = Math.pow(1 + gInf, i);
    const fWpp = Math.pow(1 + gWpp, i);
    const fAss = Math.pow(1 + gAss, i);

    const invest = p.invest * fInv;
    const cac = p.cac * fCac;
    const ticket = p.ticket * (1 + i * 0.005);
    // Pedidos: crescimento + cenário (ticket fixo → pedidos absorvem Δreceita)
    const pedidos = p.pedidos * fPed * mult.rev;
    // Receita = pedidos × ticket (fórmula central)
    const receita = pedidos * ticket;
    const roas = invest > 0 ? receita / invest : 0;
    const margem = p.margemBruta;
    const cmvCost = receita * (p.cmv / 100);
    const opexCost = receita * (p.opexPct / 100);
    const impostoCost = receita * (p.impostoPct / 100);
    const pessoasCost = receita * (p.pessoasPct / 100);
    const ebitda = receita - cmvCost - opexCost - pessoasCost;
    const lucro = ebitda - impostoCost;

    const canalGrowth: Record<string, number> = {
      DTC: fRev,
      WhatsApp: fWpp,
      Influenciadora: fInf,
      "TikTok Shop": fRev,
      B2B: fB2B,
      Assinatura: fAss,
      Marketplace: fRev,
    };
    const canais: Record<string, number> = {};
    CHANNEL_KEYS.forEach(({ key, name }) => {
      const base = p[key] as number;
      canais[name] = base * (canalGrowth[name] ?? fRev);
    });

    return {
      month: m,
      idx: i,
      invest,
      cac,
      ticket,
      pedidos,
      receita,
      roas,
      lucro,
      ebitda,
      conversao: p.conversao * (1 + i * 0.01),
      margem,
      cmvCost,
      opexCost,
      impostoCost,
      pessoasCost,
      canais,
      receitaB2B: p.receitaB2B * fB2B,
      receitaInfluenciadora: p.receitaInfluenciadora * fInf,
      receitaWhatsApp: p.receitaWhatsApp * fWpp,
      receitaTikTokShop: p.receitaTikTokShop * fRev,
      receitaAssinatura: p.receitaAssinatura * fAss,
    };
  });
}

// ============ CHANNEL FUNNEL PROJECTION ============
export interface ChannelMonth {
  month: string;
  idx: number;
  visitas: number;
  carrinhos: number;
  checkouts: number;
  pedidos: number;
  receita: number;
  ticket: number;
  cac: number;
  invest: number;
  roas: number;
  convFinal: number; // %
}

function projectChannel(cp: ChannelPremise, mult: { rev: number; cac: number }): ChannelMonth[] {
  const gVis = cp.growthVisitas / 100;
  return MONTHS.map((m, i) => {
    const visitas = cp.visitas * Math.pow(1 + gVis, i);
    const carrinhos = visitas * (cp.ctc / 100);
    const checkouts = carrinhos * (cp.cco / 100);
    // pequeno uplift de conv final (cop) ao longo do tempo via growthConv (pp)
    const cop = Math.min(95, cp.cop + cp.growthConv * i);
    const pedidos = checkouts * (cop / 100) * mult.rev;
    const ticket = cp.ticket * (1 + i * 0.004);
    const receita = pedidos * ticket;
    const cac = cp.cac * mult.cac;
    const invest = cp.invest * Math.pow(1 + gVis * 0.7, i);
    const roas = invest > 0 ? receita / invest : 0;
    const convFinal = visitas > 0 ? (pedidos / visitas) * 100 : 0;
    return { month: m, idx: i, visitas, carrinhos, checkouts, pedidos, receita, ticket, cac, invest, roas, convFinal };
  });
}


function EditNum({
  value,
  onChange,
  prefix,
  suffix,
  className = "",
  step = 1,
  placeholder,
}: {
  value: number | undefined;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  className?: string;
  step?: number;
  placeholder?: string;
}) {
  return (
    <div className={`group inline-flex items-center gap-1 ${className}`}>
      {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
      <input
        type="number"
        value={value === undefined || value === 0 ? "" : value}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="bg-transparent border-b border-transparent group-hover:border-[#f28572]/40 focus:border-[#f28572] focus:outline-none w-full text-right tabular-nums transition-colors placeholder:text-muted-foreground/40"
      />
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

// ============ MAIN ============
export function SomaForecasting() {
  const [state, setState] = useState<SomaState>(() => DEFAULT_STATE);
  const [premisesOpen, setPremisesOpen] = useState(true);
  const [channelMonthIdx, setChannelMonthIdx] = useState(0);
  const [channelExpanded, setChannelExpanded] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [roadmapPlans, setRoadmapPlans] = useState<Record<string, MonthPlan>>({});
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  const fetchKv = useServerFn(getSomaKv);
  const writeKv = useServerFn(setSomaKv);
  const hydratedRef = useRef(false);

  // Hydrate from shared server store (falls back to localStorage)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Local fallback first (instant paint)
      const local = loadState();
      if (!cancelled) setState(local);
      try {
        const snapLocal = localStorage.getItem(SNAPSHOT_KEY);
        if (snapLocal) {
          const parsed = JSON.parse(snapLocal);
          if (parsed?.savedAt && !cancelled) setSavedAt(parsed.savedAt);
        }
        const roadLocal = localStorage.getItem(ROADMAP_KEY);
        if (roadLocal && !cancelled) setRoadmapPlans(JSON.parse(roadLocal));
      } catch {}

      try {
        const [stateRow, snapRow, roadRow] = await Promise.all([
          fetchKv({ data: { key: "forecast.state" } }),
          fetchKv({ data: { key: "forecast.snapshot" } }),
          fetchKv({ data: { key: "roadmap.plans" } }),
        ]);
        if (cancelled) return;
        if (stateRow?.value) {
          const parsed = stateRow.value as Partial<SomaState>;
          setState({
            ...DEFAULT_STATE,
            ...parsed,
            premises: { ...DEFAULT_PREMISES, ...(parsed.premises || {}) },
            realized: parsed.realized || {},
            channelReal: parsed.channelReal || {},
            channelPremises: { ...DEFAULT_CHANNEL_PREMISES, ...(parsed.channelPremises || {}) },
            b2bSubChannels: Array.isArray(parsed.b2bSubChannels) && parsed.b2bSubChannels.length > 0 ? parsed.b2bSubChannels : DEFAULT_B2B_SUBS,
            okrs: Array.isArray(parsed.okrs) && parsed.okrs.length > 0 ? parsed.okrs : DEFAULT_OKRS,
            scenarioMults: { ...DEFAULT_STATE.scenarioMults, ...(parsed.scenarioMults || {}) },
          } as SomaState);
        }
        if (snapRow?.value && (snapRow.value as any).savedAt) {
          setSavedAt((snapRow.value as any).savedAt);
        }
        if (roadRow?.value && typeof roadRow.value === "object") {
          setRoadmapPlans(roadRow.value as unknown as Record<string, MonthPlan>);
        }
      } catch (e) {
        console.warn("[soma] hydrate from server failed", e);
      } finally {
        hydratedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchKv]);

  // Persist roadmap (local cache + shared server, debounced)
  useEffect(() => {
    try {
      localStorage.setItem(ROADMAP_KEY, JSON.stringify(roadmapPlans));
    } catch {}
    if (!hydratedRef.current) return;
    const t = setTimeout(() => {
      writeKv({ data: { key: "roadmap.plans", value: roadmapPlans } }).catch((e) =>
        console.warn("[soma] save roadmap failed", e)
      );
    }, 800);
    return () => clearTimeout(t);
  }, [roadmapPlans, writeKv]);

  // Persist state (local cache + shared server, debounced)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
    if (!hydratedRef.current) return;
    const t = setTimeout(() => {
      writeKv({ data: { key: "forecast.state", value: state } }).catch((e) =>
        console.warn("[soma] save state failed", e)
      );
    }, 1000);
    return () => clearTimeout(t);
  }, [state, writeKv]);

  const mult = state.scenarioMults[state.scenario];

  // Projeção dos sub-canais B2B (por lead, não por visita)
  const b2bSubProjections = useMemo(() => {
    const out: Record<string, ChannelMonth[]> = {};
    state.b2bSubChannels.forEach((sub) => {
      const gL = sub.growthLeads / 100;
      out[sub.id] = MONTHS.map((m, i) => {
        const visitas = sub.leads * Math.pow(1 + gL, i); // "visitas" = leads
        const conv = Math.min(95, sub.convLeadPedido + sub.growthConv * i);
        const pedidos = visitas * (conv / 100) * mult.rev;
        const ticket = sub.ticket * (1 + i * 0.004);
        const receita = pedidos * ticket;
        const cac = sub.cac * mult.cac;
        const invest = sub.invest * Math.pow(1 + gL * 0.7, i);
        const roas = invest > 0 ? receita / invest : 0;
        return { month: m, idx: i, visitas, carrinhos: visitas, checkouts: visitas, pedidos, receita, ticket, cac, invest, roas, convFinal: conv };
      });
    });
    return out;
  }, [state.b2bSubChannels, mult]);

  // Projeção por canal (funil) — fonte da verdade do macro
  const channelProjections = useMemo(() => {
    const out: Record<string, ChannelMonth[]> = {};
    CHANNEL_KEYS.forEach(({ name }) => {
      const cp = state.channelPremises[name] || DEFAULT_CHANNEL_PREMISES[name];
      out[name] = projectChannel(cp, mult);
    });
    // Override B2B: soma dos sub-canais (leads-based)
    const subs = Object.values(b2bSubProjections);
    if (subs.length > 0) {
      out["B2B"] = MONTHS.map((m, i) => {
        let leads = 0, pedidos = 0, receita = 0, invest = 0, cacW = 0;
        subs.forEach((arr) => {
          const cm = arr[i];
          if (!cm) return;
          leads += cm.visitas;
          pedidos += cm.pedidos;
          receita += cm.receita;
          invest += cm.invest;
          cacW += cm.cac * cm.pedidos;
        });
        const ticket = pedidos > 0 ? receita / pedidos : 0;
        const cac = pedidos > 0 ? cacW / pedidos : 0;
        const roas = invest > 0 ? receita / invest : 0;
        const convFinal = leads > 0 ? (pedidos / leads) * 100 : 0;
        return { month: m, idx: i, visitas: leads, carrinhos: leads, checkouts: leads, pedidos, receita, ticket, cac, invest, roas, convFinal };
      });
    }
    return out;
  }, [state.channelPremises, mult, b2bSubProjections]);


  // Macro = soma dos canais (reflete edições nos canais como no forecast do mês)
  const projection = useMemo(() => {
    const base = project(state.premises, mult);
    return base.map((m, i) => {
      let sumRec = 0, sumPed = 0, sumInv = 0, sumCacWeighted = 0;
      const canais: Record<string, number> = {};
      CHANNEL_KEYS.forEach(({ name }) => {
        const cm = channelProjections[name]?.[i];
        if (!cm) return;
        sumRec += cm.receita;
        sumPed += cm.pedidos;
        sumInv += cm.invest;
        sumCacWeighted += cm.cac * cm.pedidos;
        canais[name] = cm.receita;
      });
      if (sumRec === 0 && sumPed === 0) return m; // fallback se canais vazios
      const ticket = sumPed > 0 ? sumRec / sumPed : m.ticket;
      const cac = sumPed > 0 ? sumCacWeighted / sumPed : m.cac;
      const roas = sumInv > 0 ? sumRec / sumInv : 0;
      const cmvCost = sumRec * (state.premises.cmv / 100);
      const opexCost = sumRec * (state.premises.opexPct / 100);
      const impostoCost = sumRec * (state.premises.impostoPct / 100);
      const pessoasCost = sumRec * (state.premises.pessoasPct / 100);
      const ebitda = sumRec - cmvCost - opexCost - pessoasCost;
      const lucro = ebitda - impostoCost;
      return {
        ...m,
        receita: sumRec,
        pedidos: sumPed,
        invest: sumInv,
        ticket,
        cac,
        roas,
        cmvCost,
        opexCost,
        impostoCost,
        pessoasCost,
        lucro,
        ebitda,
        canais,
        receitaB2B: channelProjections["B2B"]?.[i]?.receita ?? m.receitaB2B,
        receitaInfluenciadora: channelProjections["Influenciadora"]?.[i]?.receita ?? m.receitaInfluenciadora,
        receitaWhatsApp: channelProjections["WhatsApp"]?.[i]?.receita ?? m.receitaWhatsApp,
        receitaTikTokShop: channelProjections["TikTok Shop"]?.[i]?.receita ?? m.receitaTikTokShop,
        receitaAssinatura: channelProjections["Assinatura"]?.[i]?.receita ?? m.receitaAssinatura,
      };
    });
  }, [state.premises, mult, channelProjections]);

  // Totais
  const totals = useMemo(() => {
    const proj = projection.reduce((a, m) => a + m.receita, 0);
    const real = Object.values(state.realized).reduce((a, r) => a + (r.receita || 0), 0);
    const ebitda = projection.reduce((a, m) => a + m.ebitda, 0);
    const pedidos = projection.reduce((a, m) => a + m.pedidos, 0);
    const investTotal = projection.reduce((a, m) => a + m.invest, 0);
    const ating = proj ? (real / proj) * 100 : 0;
    return { proj, real, ebitda, pedidos, ating, investTotal };
  }, [projection, state.realized]);

  // OKR live values (current = realizado; pace = projetado)
  const okrLive = useMemo(() => {
    const realReceita = totals.real;
    const realPedidos = Object.values(state.realized).reduce((a, r) => a + (r.pedidos || 0), 0);
    const realLucro = Object.values(state.realized).reduce((a, r) => a + (r.lucro || 0), 0);
    const realInvest = Object.values(state.realized).reduce((a, r) => a + (r.invest || 0), 0);
    const ticketReal = realPedidos > 0 ? realReceita / realPedidos : 0;
    const roasReal = realInvest > 0 ? realReceita / realInvest : 0;
    const b2bRealMonths = MONTHS.map((_, i) => channelProjections["B2B"]?.[i]?.receita || 0);
    const realFilledMonths = MONTHS.filter((m) => state.realized[m]?.receita).length;
    const b2bRealApprox = b2bRealMonths.slice(0, realFilledMonths).reduce((a, b) => a + b, 0);
    const b2bProj = b2bRealMonths.reduce((a, b) => a + b, 0);
    const ltvCac = state.premises.ltv / Math.max(state.premises.cac, 1);
    return {
      receitaSemestre:  { current: realReceita,         pace: totals.proj },
      ebitdaSemestre:   { current: realLucro,           pace: totals.ebitda },
      pedidosSemestre:  { current: realPedidos,         pace: totals.pedidos },
      ticketMedio:      { current: ticketReal,          pace: state.premises.ticket },
      roas:             { current: roasReal,            pace: state.premises.roas },
      ltvCac:           { current: ltvCac,              pace: ltvCac },
      recompra:         { current: state.premises.recompra, pace: state.premises.recompra },
      b2bRev:           { current: b2bRealApprox,       pace: b2bProj },
      investSemestre:   { current: realInvest,          pace: totals.investTotal },
    } as const;
  }, [totals, state.realized, state.premises, channelProjections]);

  const krValues = (kr: KeyResult) => {
    if (kr.source === "manual") {
      const current = kr.current ?? 0;
      return { current, pace: current };
    }
    const live = okrLive[kr.source as keyof typeof okrLive];
    if (live) return live;
    // Fonte desconhecida (ex.: KR de margem importado) → trata como manual
    const current = kr.current ?? kr.baseline ?? 0;
    return { current, pace: current };
  };

  const okrProgress = (objs: OkrObjective[]) => {
    // média simples ponderada (cap em 100% por KR para evitar distorção)
    let totalP = 0;
    let totalK = 0;
    objs.forEach((o) => {
      o.krs.forEach((k) => {
        const { current } = krValues(k);
        const denom = k.target - k.baseline;
        const num = current - k.baseline;
        const p = denom > 0 ? (num / denom) * 100 : 0;
        totalP += Math.max(0, Math.min(100, p));
        totalK += 1;
      });
    });
    return totalK > 0 ? totalP / totalK : 0;
  };

  // Crescimento médio realizado
  const realGrowth = useMemo(() => {
    const reals = MONTHS.map((m) => state.realized[m]?.receita || 0).filter((v) => v > 0);
    if (reals.length < 2) return null;
    const rates: number[] = [];
    for (let i = 1; i < reals.length; i++) {
      rates.push((reals[i] - reals[i - 1]) / reals[i - 1]);
    }
    return (rates.reduce((a, b) => a + b, 0) / rates.length) * 100;
  }, [state.realized]);

  // Setters
  const setPremise = <K extends keyof BasePremises>(k: K, v: BasePremises[K]) =>
    setState((s) => ({ ...s, premises: { ...s.premises, [k]: v } }));

  const setRealized = (month: string, patch: RealizedMonth) =>
    setState((s) => ({ ...s, realized: { ...s.realized, [month]: { ...s.realized[month], ...patch } } }));

  const setChannelReal = (name: string, patch: ChannelRealized) =>
    setState((s) => ({ ...s, channelReal: { ...s.channelReal, [name]: { ...s.channelReal[name], ...patch } } }));

  const setChannelPremise = (name: string, patch: Partial<ChannelPremise>) =>
    setState((s) => ({
      ...s,
      channelPremises: {
        ...s.channelPremises,
        [name]: { ...(s.channelPremises[name] || DEFAULT_CHANNEL_PREMISES[name]), ...patch },
      },
    }));

  const setB2BSub = (id: string, patch: Partial<B2BSubChannel>) =>
    setState((s) => ({
      ...s,
      b2bSubChannels: s.b2bSubChannels.map((sub) => (sub.id === id ? { ...sub, ...patch } : sub)),
    }));
  const addB2BSub = () =>
    setState((s) => ({
      ...s,
      b2bSubChannels: [
        ...s.b2bSubChannels,
        { id: `sub-${Date.now()}`, name: "Novo canal B2B", leads: 50, convLeadPedido: 20, ticket: 2500, cac: 400, invest: 500, growthLeads: 12, growthConv: 0.10 },
      ],
    }));
  const removeB2BSub = (id: string) =>
    setState((s) => ({ ...s, b2bSubChannels: s.b2bSubChannels.filter((sub) => sub.id !== id) }));

  // ===== OKR setters =====
  const setKr = (objId: string, krId: string, patch: Partial<KeyResult>) =>
    setState((s) => ({
      ...s,
      okrs: s.okrs.map((o) =>
        o.id !== objId ? o : { ...o, krs: o.krs.map((k) => (k.id === krId ? { ...k, ...patch } : k)) },
      ),
    }));
  const addKr = (objId: string) =>
    setState((s) => ({
      ...s,
      okrs: s.okrs.map((o) =>
        o.id !== objId
          ? o
          : {
              ...o,
              krs: [
                ...o.krs,
                { id: `kr-${Date.now()}`, title: "Novo Key Result", owner: o.owner.split(" ")[0], unit: "R$", baseline: 0, target: 100000, source: "manual", current: 0 },
              ],
            },
      ),
    }));
  const removeKr = (objId: string, krId: string) =>
    setState((s) => ({
      ...s,
      okrs: s.okrs.map((o) => (o.id !== objId ? o : { ...o, krs: o.krs.filter((k) => k.id !== krId) })),
    }));
  const addObjective = () =>
    setState((s) => ({
      ...s,
      okrs: [
        ...s.okrs,
        {
          id: `obj-${Date.now()}`,
          title: "Novo Objetivo",
          why: "Descreva o porquê estratégico.",
          owner: "Time Soma",
          accent: SOMA_PALETTE.sage,
          krs: [],
        },
      ],
    }));
  const removeObjective = (id: string) =>
    setState((s) => ({ ...s, okrs: s.okrs.filter((o) => o.id !== id) }));
  const setObjective = (id: string, patch: Partial<OkrObjective>) =>
    setState((s) => ({ ...s, okrs: s.okrs.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));

  // Recalibrar forecast: usa última performance real para reescrever premissas
  const recalibrate = () => {
    const filled = MONTHS.map((m) => ({ m, r: state.realized[m] })).filter((x) => x.r?.receita);
    if (filled.length < 1) {
      toast.error("Adicione pelo menos um mês realizado para recalibrar");
      return;
    }
    const last = filled[filled.length - 1].r!;
    const prev = filled.length >= 2 ? filled[filled.length - 2].r : null;
    const newGrowth = prev?.receita && last.receita
      ? ((last.receita - prev.receita) / prev.receita) * 100
      : state.premises.crescMensal;
    const newCacGrowth = prev?.cac && last.cac ? ((last.cac - prev.cac) / prev.cac) * 100 : state.premises.crescCac;

    setState((s) => ({
      ...s,
      premises: {
        ...s.premises,
        cac: last.cac ?? s.premises.cac,
        ticket: last.ticket ?? s.premises.ticket,
        invest: last.invest ?? s.premises.invest,
        pedidos: last.pedidos ?? s.premises.pedidos,
        crescMensal: Number(newGrowth.toFixed(1)),
        crescCac: Number(newCacGrowth.toFixed(1)),
      },
    }));
    toast.success(`Forecast recalibrado · crescimento real ${newGrowth.toFixed(1)}%`);
  };

  const reset = () => {
    if (confirm("Resetar todos os dados do forecast Soma?")) {
      setState(DEFAULT_STATE);
      toast.success("Forecast Soma resetado");
    }
  };

  const exportJSON = () => {
    const today = new Date().toISOString().slice(0, 10);
    const stamp = new Date().toISOString();

    // 1) JSON completo: inputs + tudo que está na tela (projeção, canais, totais, OKR)
    const fullPayload = {
      exportedAt: stamp,
      inputs: state,
      computed: {
        projection,
        totals,
        channelProjections,
        b2bSubProjections,
        okrLive,
        realGrowth,
      },
    };
    const jsonBlob = new Blob([JSON.stringify(fullPayload, null, 2)], { type: "application/json" });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const aJson = document.createElement("a");
    aJson.href = jsonUrl;
    aJson.download = `soma-forecast-${today}.json`;
    aJson.click();
    URL.revokeObjectURL(jsonUrl);

    // 2) CSV da tela principal (mês a mês, projetado vs realizado)
    const headers = [
      "Mês","Receita Projetada","Receita Realizada","Atingimento %",
      "Pedidos Projetados","Pedidos Realizados","Ticket Projetado","CAC Projetado",
      "Investimento","ROAS","Conversão %","CMV","OPEX","Imposto","Time/Pessoas",
      "EBITDA","Lucro",
      ...CHANNEL_KEYS.map((c) => `Receita ${c.name}`),
    ];
    const fmt = (n: number | undefined) =>
      n === undefined || n === null || !Number.isFinite(n) ? "" : String(Number(n).toFixed(2)).replace(".", ",");
    const rows = projection.map((p) => {
      const r = state.realized[p.month] ?? {};
      const ating = p.receita > 0 ? ((r.receita || 0) / p.receita) * 100 : 0;
      return [
        p.month,
        fmt(p.receita), fmt(r.receita), fmt(ating),
        fmt(p.pedidos), fmt(r.pedidos), fmt(p.ticket), fmt(p.cac),
        fmt(p.invest), fmt(p.roas), fmt(p.conversao),
        fmt(p.cmvCost), fmt(p.opexCost), fmt(p.impostoCost), fmt(p.pessoasCost),
        fmt(p.ebitda), fmt(p.lucro),
        ...CHANNEL_KEYS.map((c) => fmt(p.canais?.[c.name])),
      ];
    });
    const totalRow = [
      "TOTAL",
      fmt(totals.proj), fmt(totals.real), fmt(totals.ating),
      fmt(totals.pedidos), "",
      "", "",
      fmt(totals.investTotal), "", "",
      fmt(projection.reduce((a, p) => a + p.cmvCost, 0)),
      fmt(projection.reduce((a, p) => a + p.opexCost, 0)),
      fmt(projection.reduce((a, p) => a + p.impostoCost, 0)),
      fmt(projection.reduce((a, p) => a + p.pessoasCost, 0)),
      fmt(totals.ebitda),
      fmt(projection.reduce((a, p) => a + p.lucro, 0)),
      ...CHANNEL_KEYS.map((c) => fmt(projection.reduce((a, p) => a + (p.canais?.[c.name] || 0), 0))),
    ];
    const csv = [headers, ...rows, totalRow]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const csvBlob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const csvUrl = URL.createObjectURL(csvBlob);
    const aCsv = document.createElement("a");
    aCsv.href = csvUrl;
    aCsv.download = `soma-forecast-${today}.csv`;
    aCsv.click();
    URL.revokeObjectURL(csvUrl);

    toast.success("Forecast exportado (JSON + CSV com dados da tela)");
  };

  // ============ IMPORTAR ARQUIVO ============
  // Aceita:
  //  - JSON exportado (com chave `inputs` = SomaState completo) → restaura o cenário inteiro
  //  - JSON cru do SomaState (premises/realized/...) → restaura
  //  - CSV mês a mês com colunas como o export (usa "Receita Realizada", "Pedidos Realizados", etc.)
  const importFile = async (file: File) => {
    const text = await file.text();
    const isJson = file.name.toLowerCase().endsWith(".json") || text.trim().startsWith("{");

    const monthAliases: Record<string, string> = {
      jun: "Jun", junho: "Jun",
      jul: "Jul", julho: "Jul",
      ago: "Ago", agosto: "Ago",
      set: "Set", setembro: "Set",
      out: "Out", outubro: "Out",
      nov: "Nov", novembro: "Nov",
      dez: "Dez", dezembro: "Dez",
    };
    const normMonth = (s: string) => {
      const k = s.trim().toLowerCase().replace(/\./g, "").slice(0, 8);
      return monthAliases[k] ?? monthAliases[k.slice(0, 3)] ?? null;
    };
    const parseNum = (v: string) => {
      if (v === undefined || v === null || v === "") return undefined;
      const cleaned = String(v).replace(/[R$\s"]/g, "").replace(/\./g, "").replace(",", ".");
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : undefined;
    };

    try {
      if (isJson) {
        const parsed = JSON.parse(text);
        const candidate = parsed?.inputs ?? parsed?.state ?? parsed;
        if (!candidate?.premises) throw new Error("JSON sem `premises` válido");
        const merged: SomaState = {
          ...DEFAULT_STATE,
          ...candidate,
          premises: { ...DEFAULT_PREMISES, ...(candidate.premises || {}) },
          realized: candidate.realized || {},
          channelReal: candidate.channelReal || {},
          channelPremises: { ...DEFAULT_CHANNEL_PREMISES, ...(candidate.channelPremises || {}) },
          b2bSubChannels: Array.isArray(candidate.b2bSubChannels) && candidate.b2bSubChannels.length > 0 ? candidate.b2bSubChannels : DEFAULT_B2B_SUBS,
          okrs: Array.isArray(candidate.okrs) && candidate.okrs.length > 0 ? candidate.okrs : DEFAULT_OKRS,
          scenarioMults: { ...DEFAULT_STATE.scenarioMults, ...(candidate.scenarioMults || {}) },
        };
        setState(merged);
        toast.success("Cenário importado do JSON");
        return;
      }

      // CSV — detecta separador
      const sep = text.includes(";") ? ";" : ",";
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) throw new Error("CSV vazio");
      const splitRow = (l: string) =>
        l.split(sep).map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
      const headers = splitRow(lines[0]).map((h) => h.toLowerCase());
      const col = (...names: string[]) => {
        for (const n of names) {
          const idx = headers.findIndex((h) => h.includes(n));
          if (idx >= 0) return idx;
        }
        return -1;
      };
      const idxMes = col("mês", "mes", "month");
      const idxRec = col("receita realizada", "receita real");
      const idxPed = col("pedidos realizados", "pedidos real");
      const idxCac = col("cac realizado", "cac real");
      const idxInv = col("investimento realizado", "invest realizado");
      const idxTk  = col("ticket realizado", "ticket real");
      const idxLuc = col("lucro realizado", "lucro real");
      if (idxMes < 0) throw new Error("CSV sem coluna de Mês");

      const newRealized: Record<string, RealizedMonth> = { ...state.realized };
      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        const row = splitRow(lines[i]);
        const mLabel = normMonth(row[idxMes] || "");
        if (!mLabel) continue;
        const r: RealizedMonth = { ...(newRealized[mLabel] || {}) };
        if (idxRec >= 0) r.receita = parseNum(row[idxRec]) ?? r.receita;
        if (idxPed >= 0) r.pedidos = parseNum(row[idxPed]) ?? r.pedidos;
        if (idxCac >= 0) r.cac = parseNum(row[idxCac]) ?? r.cac;
        if (idxInv >= 0) r.invest = parseNum(row[idxInv]) ?? r.invest;
        if (idxTk  >= 0) r.ticket = parseNum(row[idxTk])  ?? r.ticket;
        if (idxLuc >= 0) r.lucro  = parseNum(row[idxLuc]) ?? r.lucro;
        newRealized[mLabel] = r;
        count++;
      }
      if (count === 0) throw new Error("Nenhuma linha de mês reconhecida");
      setState((p) => ({ ...p, realized: newRealized }));
      toast.success(`Realizado importado · ${count} mês(es) atualizados`);
    } catch (e: any) {
      console.error(e);
      toast.error(`Falha ao importar: ${e?.message ?? "arquivo inválido"}`);
    }
  };

  const saveSnapshot = async () => {
    try {
      const ts = new Date().toISOString();
      const payload = { savedAt: ts, state };
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
      setSavedAt(ts);
      await Promise.all([
        writeKv({ data: { key: "forecast.snapshot", value: payload } }),
        writeKv({ data: { key: "forecast.state", value: state } }),
      ]);
      const hhmm = new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      toast.success(`Cenário salvo e compartilhado · ${hhmm}`);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível salvar o cenário no servidor");
    }
  };

  const restoreSnapshot = async () => {
    try {
      const remote = await fetchKv({ data: { key: "forecast.snapshot" } });
      const parsed: any = remote?.value ?? (() => {
        const raw = localStorage.getItem(SNAPSHOT_KEY);
        return raw ? JSON.parse(raw) : null;
      })();
      if (!parsed?.state) {
        toast.error("Nenhum cenário salvo encontrado");
        return;
      }
      setState(parsed.state);
      if (parsed.savedAt) setSavedAt(parsed.savedAt);
      toast.success("Último cenário salvo restaurado");
    } catch {
      toast.error("Falha ao restaurar cenário");
    }
  };

  // Dados gráficos
  const chartData = projection.map((p) => ({
    month: p.month,
    Projetado: Math.round(p.receita),
    Realizado: Math.round(state.realized[p.month]?.receita || 0),
    Pedidos: Math.round(p.pedidos),
    PedidosReal: Math.round(state.realized[p.month]?.pedidos || 0),
    CAC: Math.round(p.cac),
    CACReal: Math.round(state.realized[p.month]?.cac || 0),
    Lucro: Math.round(p.lucro),
  }));

  const acc = projection.reduce<{ month: string; Proj: number; Real: number }[]>((arr, p, i) => {
    const prev = arr[i - 1] || { Proj: 0, Real: 0 };
    arr.push({
      month: p.month,
      Proj: prev.Proj + p.receita,
      Real: prev.Real + (state.realized[p.month]?.receita || 0),
    });
    return arr;
  }, []);

  const canalShare = CHANNEL_KEYS.map(({ name }) => ({
    name,
    value: projection.reduce((a, m) => a + (m.canais[name] || 0), 0),
  }));
  const canalTotal = canalShare.reduce((a, c) => a + c.value, 0);

  // (channelProjections já calculado acima — fonte de verdade do macro)


  // Macro mensal: soma de canais vs macro principal (para reconciliar)
  const macroVsChannels = projection.map((m, i) => {
    const sumRec = CHANNEL_KEYS.reduce((a, { name }) => a + (channelProjections[name]?.[i]?.receita || 0), 0);
    const sumPed = CHANNEL_KEYS.reduce((a, { name }) => a + (channelProjections[name]?.[i]?.pedidos || 0), 0);
    return {
      month: m.month,
      MacroReceita: Math.round(m.receita),
      SomaCanais: Math.round(sumRec),
      MacroPedidos: Math.round(m.pedidos),
      PedidosCanais: Math.round(sumPed),
    };
  });

  return (
    <div
      className="h-full overflow-y-auto"
      style={{
        background: "linear-gradient(180deg, oklch(0.21 0.022 302) 0%, oklch(0.17 0.018 296) 100%)",
      }}
    >
      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* HEADER */}
        <Header
          scenario={state.scenario}
          onScenario={(s) => setState((p) => ({ ...p, scenario: s }))}
          scenarioMults={state.scenarioMults}
          onScenarioMults={(m) => setState((p) => ({ ...p, scenarioMults: m }))}
          onRecalibrate={recalibrate}
          onExport={exportJSON}
          onImport={importFile}
          onReset={reset}
          onSave={saveSnapshot}
          onRestore={restoreSnapshot}
          savedAt={savedAt}
        />

        {/* VISÃO CEO */}
        <Section title="Visão CEO" subtitle="O painel executivo · receita, atingimento, EBITDA, eficiência">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <ExecCard
              label="Receita Projetada"
              value={brl(totals.proj)}
              delta={state.scenario !== "base" ? `cenário ${state.scenario}` : "6 meses (Jun→Dez)"}
              icon={Target}
              trend="up"
              series={projection.map((m) => ({ v: m.receita }))}
            />
            <ExecCard
              label="Receita Realizada"
              value={brl(totals.real)}
              delta={realGrowth !== null ? `${realGrowth >= 0 ? "+" : ""}${realGrowth.toFixed(1)}% médio m/m` : "Sem dados ainda"}
              icon={TrendingUp}
              trend={realGrowth !== null && realGrowth >= 0 ? "up" : "down"}
              series={projection.map((m) => ({ v: state.realized[m.month]?.receita || 0 }))}
            />
            <ExecCard
              label="% Atingimento Total"
              value={pct(totals.ating)}
              delta={totals.ating >= 95 ? "No alvo" : totals.ating >= 80 ? "Atenção" : totals.ating > 0 ? "Crítico" : "—"}
              icon={Activity}
              trend={totals.ating >= 95 ? "up" : "down"}
              series={projection.map((m) => ({ v: m.receita > 0 ? ((state.realized[m.month]?.receita || 0) / m.receita) * 100 : 0 }))}
            />
            <ExecCard
              label="EBITDA Acumulado"
              value={brl(totals.ebitda)}
              delta={`${((totals.ebitda / Math.max(totals.proj, 1)) * 100).toFixed(1)}% margem`}
              icon={DollarSign}
              trend="up"
              series={projection.map((m) => ({ v: m.ebitda }))}
            />
            <ExecCard
              label="MER · Eficiência de Mídia"
              value={`${(totals.proj / Math.max(totals.investTotal, 1)).toFixed(2)}x`}
              delta={`R$ ${(totals.investTotal / 1000).toFixed(0)}k invest. · ${brl(totals.investTotal / 7)}/mês`}
              icon={Flame}
              trend={totals.proj / Math.max(totals.investTotal, 1) >= 3 ? "up" : "down"}
              series={projection.map((m) => ({ v: m.invest > 0 ? m.receita / m.invest : 0 }))}
            />
            <ExecCard
              label="Meta Anual Projetada"
              value={brl(totals.proj * 1.85)}
              delta="extrapolação 12m"
              icon={Zap}
              trend="up"
              series={projection.map((m) => ({ v: m.receita * 1.1 }))}
            />
          </div>
        </Section>

        {/* OKRs movidos para a aba "OKRs & PDCA" — mantém o forecasting enxuto */}
        <Section
          title="OKRs Estratégicos · Soma"
          subtitle="Painel completo de objetivos e Key Results agora vive na aba OKRs & PDCA"
          icon={Trophy}
        >
          <Panel>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Trophy className="size-4" style={{ color: SOMA_PALETTE.rose }} />
              <span>
                Para organizar a operação, os <strong style={{ color: SOMA_PALETTE.cream }}>OKRs Estratégicos · Soma</strong> foram movidos para a aba <strong style={{ color: SOMA_PALETTE.rose }}>OKRs &amp; PDCA</strong>. Os dados continuam sincronizados no cenário compartilhado.
              </span>
            </div>
          </Panel>
        </Section>


        <Section
          title="Premissas Iniciais — Mês Base (Junho)"
          subtitle="Alimente o Mês 1 · o sistema projeta automaticamente Jun → Dez"
        >
          <Panel>
            <button
              onClick={() => setPremisesOpen((v) => !v)}
              className="flex items-center justify-between w-full text-left mb-3"
            >
              <span className="text-xs uppercase tracking-[0.15em]" style={{ color: SOMA_PALETTE.sand }}>
                {premisesOpen ? "Recolher inputs" : "Expandir inputs do mês base"}
              </span>
              {premisesOpen ? (
                <ChevronUp className="size-4" style={{ color: SOMA_PALETTE.rose }} />
              ) : (
                <ChevronDown className="size-4" style={{ color: SOMA_PALETTE.rose }} />
              )}
            </button>

            {premisesOpen && (
              <div className="space-y-5">
                <PremisesGroup title="Saúde & Retenção">
                  <PremiseField label="Margem Bruta" suffix="%" step={0.5} value={state.premises.margemBruta} onChange={(v) => setPremise("margemBruta", v)} />
                  <PremiseField label="Taxa de recompra" suffix="%" step={0.5} value={state.premises.recompra} onChange={(v) => setPremise("recompra", v)} />
                  <PremiseField label="LTV" prefix="R$" value={state.premises.ltv} onChange={(v) => setPremise("ltv", v)} />
                </PremisesGroup>

                <PremisesGroup title="Custos & Despesas (% da receita)">
                  <PremiseField label="CMV (produto + frete)" suffix="%" step={0.5} value={state.premises.cmv} onChange={(v) => setPremise("cmv", v)} />
                  <PremiseField label="OPEX" suffix="%" step={0.5} value={state.premises.opexPct} onChange={(v) => setPremise("opexPct", v)} />
                  <PremiseField label="Imposto" suffix="%" step={0.5} value={state.premises.impostoPct} onChange={(v) => setPremise("impostoPct", v)} />
                  <PremiseField label="Custo c/ Pessoas (Time)" suffix="%" step={0.5} value={state.premises.pessoasPct} onChange={(v) => setPremise("pessoasPct", v)} />
                </PremisesGroup>

                <div className="text-[11px] text-muted-foreground italic border-t border-[#f28572]/15 pt-3">
                  Premissas de canal (ticket, pedidos, CAC, invest, funil) são editadas em <span style={{ color: SOMA_PALETTE.rose }}>"Desdobramento por Canal"</span> abaixo · Custos % cruzam a receita projetada para detalhar CMV, OPEX, Imposto e Time no forecast mensal · LTV/CAC = {(state.premises.ltv / Math.max(state.premises.cac, 1)).toFixed(1)}x
                </div>

              </div>
            )}
          </Panel>
        </Section>

        {/* MOTOR DO FORECAST */}
        <Section
          title="Motor do Forecast"
          subtitle="% de crescimento mensal aplicado em cada variável · alimenta automaticamente Jul → Dez"
        >
          <Panel>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <GrowthDial label="Receita geral" value={state.premises.crescReceita} onChange={(v) => setPremise("crescReceita", v)} accent={SOMA_PALETTE.gold} />
              <GrowthDial label="Pedidos" value={state.premises.crescPedidos} onChange={(v) => setPremise("crescPedidos", v)} accent={SOMA_PALETTE.rose} />
              <GrowthDial label="CAC" value={state.premises.crescCac} onChange={(v) => setPremise("crescCac", v)} accent={SOMA_PALETTE.alert} invertedGood />
              <GrowthDial label="Investimento" value={state.premises.crescInvest} onChange={(v) => setPremise("crescInvest", v)} accent={SOMA_PALETTE.warn} />
              <GrowthDial label="B2B" value={state.premises.crescB2B} onChange={(v) => setPremise("crescB2B", v)} accent={SOMA_PALETTE.sage} />
              <GrowthDial label="Influenciadora" value={state.premises.crescInfluenciadora} onChange={(v) => setPremise("crescInfluenciadora", v)} accent={SOMA_PALETTE.roseDeep} />
              <GrowthDial label="WhatsApp" value={state.premises.crescWhatsApp} onChange={(v) => setPremise("crescWhatsApp", v)} accent={SOMA_PALETTE.blush} />
              <GrowthDial label="Assinatura" value={state.premises.crescAssinatura} onChange={(v) => setPremise("crescAssinatura", v)} accent={SOMA_PALETTE.gold} />
              <GrowthDial label="Operacional" value={state.premises.crescOperacional} onChange={(v) => setPremise("crescOperacional", v)} accent={SOMA_PALETTE.sand} />
              <GrowthDial label="Equipe" value={state.premises.crescEquipe} onChange={(v) => setPremise("crescEquipe", v)} accent={SOMA_PALETTE.cream} />
            </div>
            <div className="text-[11px] text-muted-foreground italic border-t border-[#f28572]/15 pt-3 mt-4">
              Cada % é aplicado de forma composta sobre a base de Junho: <code className="text-[#f28572]">Var<sub>mês</sub> = Var<sub>jun</sub> × (1 + g)<sup>n</sup></code>. Altere qualquer valor → todo o forecast recalcula em tempo real.
            </div>
          </Panel>
        </Section>

        {/* PROJEÇÃO MENSAL + REALIZADO */}
        <Section title="Forecast Mensal · Projetado vs Realizado" subtitle="Jun → Dez · células 'Real' editáveis · alertas semafóricos">
          <Panel>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-[#f28572]/15">
                    <th className="py-2 px-2 sticky left-0 bg-[#1b1426]/60 backdrop-blur z-10">Métrica</th>
                    {MONTHS.map((m) => (
                      <th key={m} className="py-2 px-3 text-right min-w-[120px]">{m}</th>
                    ))}
                    <th className="py-2 px-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/* ===================== BLOCO PROJETADO (TOPO) ===================== */}
                  <Separator label="📊 Projetado" />

                  <MetricRow label="Receita Projetada" data={projection.map((p) => brl(p.receita))} total={brl(totals.proj)} highlight />
                  <MetricRow label="Pedidos Projetados" data={projection.map((p) => Math.round(p.pedidos).toLocaleString("pt-BR"))} total={Math.round(totals.pedidos).toLocaleString("pt-BR")} />
                  {(() => {
                    const b2bSeries = channelProjections["B2B"] || [];
                    const ticketB2B = MONTHS.map((_, i) => {
                      const c = b2bSeries[i];
                      return c && c.pedidos > 0 ? c.receita / c.pedidos : 0;
                    });
                    const ticketNonB2B = MONTHS.map((_, i) => {
                      let rec = 0, ped = 0;
                      CHANNEL_KEYS.forEach(({ name }) => {
                        if (name === "B2B") return;
                        const c = channelProjections[name]?.[i];
                        if (c) { rec += c.receita; ped += c.pedidos; }
                      });
                      return ped > 0 ? rec / ped : 0;
                    });
                    return (
                      <>
                        <MetricRow label="Ticket Médio (ex-B2B)" data={ticketNonB2B.map((v) => brl(v))} />
                        <MetricRow label="Ticket Médio B2B" data={ticketB2B.map((v) => brl(v))} />
                      </>
                    );
                  })()}
                  <MetricRow label="CAC Projetado" data={projection.map((p) => brl(p.cac))} inverted />
                  <MetricRow label="Investimento" data={projection.map((p) => brl(p.invest))} />
                  <MetricRow label="ROAS" data={projection.map((p) => `${p.roas.toFixed(2)}x`)} />
                  <MetricRow label="Conversão" data={projection.map((p) => `${p.conversao.toFixed(1)}%`)} />

                  <Separator label="Custos & Despesas (Projetado)" />
                  <MetricRow label={`CMV (${state.premises.cmv.toFixed(1)}%)`} data={projection.map((p) => brl(p.cmvCost))} inverted total={brl(projection.reduce((a, p) => a + p.cmvCost, 0))} />
                  <MetricRow label={`OPEX (${state.premises.opexPct.toFixed(1)}%)`} data={projection.map((p) => brl(p.opexCost))} inverted total={brl(projection.reduce((a, p) => a + p.opexCost, 0))} />
                  <MetricRow label={`Time / Pessoas (${state.premises.pessoasPct.toFixed(1)}%)`} data={projection.map((p) => brl(p.pessoasCost))} inverted total={brl(projection.reduce((a, p) => a + p.pessoasCost, 0))} />
                  <MetricRow label={`Imposto (${state.premises.impostoPct.toFixed(1)}%)`} data={projection.map((p) => brl(p.impostoCost))} inverted total={brl(projection.reduce((a, p) => a + p.impostoCost, 0))} />

                  <Separator label="Resultado (Projetado)" />
                  <MetricRow label="EBITDA" data={projection.map((p) => brl(p.ebitda))} total={brl(projection.reduce((a, p) => a + p.ebitda, 0))} />
                  <MetricRow label="Lucro Líquido" data={projection.map((p) => brl(p.lucro))} total={brl(projection.reduce((a, p) => a + p.lucro, 0))} highlight />
                  <MetricRow label="Margem Líquida" data={projection.map((p) => p.receita ? `${((p.lucro / p.receita) * 100).toFixed(1)}%` : "—")} />

                  <Separator label="Canais (Projetado)" />
                  <MetricRow
                    label="Receita B2B (Total)"
                    data={projection.map((p) => brl(p.receitaB2B))}
                    total={brl(projection.reduce((a, p) => a + p.receitaB2B, 0))}
                    highlight
                  />
                  {state.b2bSubChannels.map((sub) => {
                    const series = b2bSubProjections[sub.id] || [];
                    return (
                      <MetricRow
                        key={sub.id}
                        label={`↳ ${sub.name}`}
                        data={MONTHS.map((_, i) => brl(series[i]?.receita || 0))}
                        total={brl(series.reduce((a, c) => a + (c?.receita || 0), 0))}
                      />
                    );
                  })}
                  <MetricRow label="Receita Influenciadora" data={projection.map((p) => brl(p.receitaInfluenciadora))} />
                  <MetricRow label="Receita WhatsApp" data={projection.map((p) => brl(p.receitaWhatsApp))} />
                  <MetricRow label="Receita TikTok Shop" data={projection.map((p) => brl(p.receitaTikTokShop))} />
                  <MetricRow label="Receita Assinatura" data={projection.map((p) => brl(p.receitaAssinatura))} />

                  {/* ===================== BLOCO REALIZADO (BASE) ===================== */}
                  <Separator label="✅ Realizado (editável)" />

                  {/* Receita Realizada */}
                  <tr className="border-b border-[#f28572]/10 bg-[#f28572]/5">
                    <td className="py-2 px-2 font-medium sticky left-0 bg-[#1b1426]/80 z-10" style={{ color: SOMA_PALETTE.rose }}>
                      Receita Realizada
                    </td>
                    {MONTHS.map((m) => {
                      const proj = projection.find((p) => p.month === m)!.receita;
                      const r = state.realized[m]?.receita;
                      const s = statusOf(r, proj);
                      return (
                        <td key={m} className="py-2 px-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="size-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                            <EditNum value={r} onChange={(v) => setRealized(m, { receita: v })} prefix="R$" />
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-2 px-2 text-right tabular-nums font-medium" style={{ color: SOMA_PALETTE.cream }}>{brl(totals.real)}</td>
                  </tr>
                  {/* % Atingimento */}
                  <tr className="border-b border-[#f28572]/10">
                    <td className="py-2 px-2 sticky left-0 bg-[#1b1426]/60 z-10 text-muted-foreground">% Atingimento</td>
                    {projection.map((p) => {
                      const r = state.realized[p.month]?.receita || 0;
                      const a = p.receita ? (r / p.receita) * 100 : 0;
                      const s = statusOf(r, p.receita);
                      return (
                        <td key={p.month} className="py-2 px-3 text-right tabular-nums font-semibold" style={{ color: STATUS_COLOR[s] }}>
                          {r ? `${a.toFixed(0)}%` : "—"}
                        </td>
                      );
                    })}
                    <td className="py-2 px-2 text-right font-semibold tabular-nums" style={{ color: STATUS_COLOR[statusOf(totals.real, totals.proj)] }}>
                      {totals.ating > 0 ? `${totals.ating.toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                  {/* Diferença */}
                  <tr className="border-b border-[#f28572]/10">
                    <td className="py-2 px-2 sticky left-0 bg-[#1b1426]/60 z-10 text-muted-foreground">Δ (Real − Proj)</td>
                    {projection.map((p) => {
                      const r = state.realized[p.month]?.receita || 0;
                      const d = r ? r - p.receita : 0;
                      return (
                        <td key={p.month} className="py-2 px-3 text-right tabular-nums text-xs" style={{ color: d >= 0 ? SOMA_PALETTE.sage : SOMA_PALETTE.alert }}>
                          {r ? `${d >= 0 ? "+" : ""}${brl(d)}` : "—"}
                        </td>
                      );
                    })}
                    <td className="py-2 px-2 text-right tabular-nums text-xs" style={{ color: totals.real - totals.proj >= 0 ? SOMA_PALETTE.sage : SOMA_PALETTE.alert }}>
                      {totals.real ? `${totals.real - totals.proj >= 0 ? "+" : ""}${brl(totals.real - totals.proj)}` : "—"}
                    </td>
                  </tr>

                  <RealizedRow
                    label="Pedidos Realizados"
                    months={MONTHS}
                    projection={projection.map((p) => p.pedidos)}
                    realized={MONTHS.map((m) => state.realized[m]?.pedidos)}
                    onEdit={(m, v) => setRealized(m, { pedidos: v })}
                  />
                  {(() => {
                    const b2bSeries = channelProjections["B2B"] || [];
                    const ticketB2BProj = MONTHS.map((_, i) => {
                      const c = b2bSeries[i];
                      return c && c.pedidos > 0 ? c.receita / c.pedidos : 0;
                    });
                    const ticketNonB2BProj = MONTHS.map((_, i) => {
                      let rec = 0, ped = 0;
                      CHANNEL_KEYS.forEach(({ name }) => {
                        if (name === "B2B") return;
                        const c = channelProjections[name]?.[i];
                        if (c) { rec += c.receita; ped += c.pedidos; }
                      });
                      return ped > 0 ? rec / ped : 0;
                    });
                    return (
                      <>
                        <RealizedRow
                          label="Ticket Médio Realizado (ex-B2B)"
                          months={MONTHS}
                          projection={ticketNonB2BProj}
                          realized={MONTHS.map((m) => state.realized[m]?.ticket)}
                          onEdit={(m, v) => setRealized(m, { ticket: v })}
                          prefix="R$"
                        />
                        <RealizedRow
                          label="Ticket Médio B2B Realizado"
                          months={MONTHS}
                          projection={ticketB2BProj}
                          realized={MONTHS.map((m) => state.realized[m]?.ticketB2B)}
                          onEdit={(m, v) => setRealized(m, { ticketB2B: v })}
                          prefix="R$"
                        />
                      </>
                    );
                  })()}
                  <RealizedRow
                    label="CAC Realizado"
                    months={MONTHS}
                    projection={projection.map((p) => p.cac)}
                    realized={MONTHS.map((m) => state.realized[m]?.cac)}
                    onEdit={(m, v) => setRealized(m, { cac: v })}
                    inverted
                    prefix="R$"
                  />
                  <RealizedRow
                    label="Invest. Real"
                    months={MONTHS}
                    projection={projection.map((p) => p.invest)}
                    realized={MONTHS.map((m) => state.realized[m]?.invest)}
                    onEdit={(m, v) => setRealized(m, { invest: v })}
                    prefix="R$"
                  />
                  <RealizedRow
                    label="ROAS Realizado"
                    months={MONTHS}
                    projection={projection.map((p) => p.roas)}
                    realized={MONTHS.map((m) => state.realized[m]?.roas)}
                    onEdit={(m, v) => setRealized(m, { roas: v })}
                  />
                  <RealizedRow
                    label="Conversão Realizada"
                    months={MONTHS}
                    projection={projection.map((p) => p.conversao)}
                    realized={MONTHS.map((m) => state.realized[m]?.conversao)}
                    onEdit={(m, v) => setRealized(m, { conversao: v })}
                  />

                  <Separator label="Custos & Despesas (Realizado)" />
                  <RealizedRow
                    label="CMV Real"
                    months={MONTHS}
                    projection={projection.map((p) => p.cmvCost)}
                    realized={MONTHS.map((m) => state.realized[m]?.cmv)}
                    onEdit={(m, v) => setRealized(m, { cmv: v })}
                    inverted
                    prefix="R$"
                  />
                  <RealizedRow
                    label="OPEX Real"
                    months={MONTHS}
                    projection={projection.map((p) => p.opexCost)}
                    realized={MONTHS.map((m) => state.realized[m]?.opex)}
                    onEdit={(m, v) => setRealized(m, { opex: v })}
                    inverted
                    prefix="R$"
                  />
                  <RealizedRow
                    label="Time / Pessoas Real"
                    months={MONTHS}
                    projection={projection.map((p) => p.pessoasCost)}
                    realized={MONTHS.map((m) => state.realized[m]?.pessoas)}
                    onEdit={(m, v) => setRealized(m, { pessoas: v })}
                    inverted
                    prefix="R$"
                  />
                  <RealizedRow
                    label="Imposto Real"
                    months={MONTHS}
                    projection={projection.map((p) => p.impostoCost)}
                    realized={MONTHS.map((m) => state.realized[m]?.imposto)}
                    onEdit={(m, v) => setRealized(m, { imposto: v })}
                    inverted
                    prefix="R$"
                  />

                  <Separator label="Resultado (Realizado)" />
                  <RealizedRow
                    label="EBITDA Real"
                    months={MONTHS}
                    projection={projection.map((p) => p.ebitda)}
                    realized={MONTHS.map((m) => state.realized[m]?.ebitda)}
                    onEdit={(m, v) => setRealized(m, { ebitda: v })}
                    prefix="R$"
                  />
                  <RealizedRow
                    label="Lucro Líquido Real"
                    months={MONTHS}
                    projection={projection.map((p) => p.lucro)}
                    realized={MONTHS.map((m) => state.realized[m]?.lucro)}
                    onEdit={(m, v) => setRealized(m, { lucro: v })}
                    prefix="R$"
                  />
                  <RealizedRow
                    label="Margem Líquida Real"
                    months={MONTHS}
                    projection={projection.map((p) => p.receita ? (p.lucro / p.receita) * 100 : 0)}
                    realized={MONTHS.map((m) => state.realized[m]?.margem)}
                    onEdit={(m, v) => setRealized(m, { margem: v })}
                  />

                  <Separator label="Canais (Realizado)" />
                  <RealizedRow
                    label="Receita B2B Real"
                    months={MONTHS}
                    projection={projection.map((p) => p.receitaB2B)}
                    realized={MONTHS.map((m) => state.realized[m]?.recB2B)}
                    onEdit={(m, v) => setRealized(m, { recB2B: v })}
                    prefix="R$"
                  />
                  <RealizedRow
                    label="Receita Influenciadora Real"
                    months={MONTHS}
                    projection={projection.map((p) => p.receitaInfluenciadora)}
                    realized={MONTHS.map((m) => state.realized[m]?.recInfluenciadora)}
                    onEdit={(m, v) => setRealized(m, { recInfluenciadora: v })}
                    prefix="R$"
                  />
                  <RealizedRow
                    label="Receita WhatsApp Real"
                    months={MONTHS}
                    projection={projection.map((p) => p.receitaWhatsApp)}
                    realized={MONTHS.map((m) => state.realized[m]?.recWhatsApp)}
                    onEdit={(m, v) => setRealized(m, { recWhatsApp: v })}
                    prefix="R$"
                  />
                  <RealizedRow
                    label="Receita TikTok Shop Real"
                    months={MONTHS}
                    projection={projection.map((p) => p.receitaTikTokShop)}
                    realized={MONTHS.map((m) => state.realized[m]?.recTikTokShop)}
                    onEdit={(m, v) => setRealized(m, { recTikTokShop: v })}
                    prefix="R$"
                  />
                  <RealizedRow
                    label="Receita Assinatura Real"
                    months={MONTHS}
                    projection={projection.map((p) => p.receitaAssinatura)}
                    realized={MONTHS.map((m) => state.realized[m]?.recAssinatura)}
                    onEdit={(m, v) => setRealized(m, { recAssinatura: v })}
                    prefix="R$"
                  />

                </tbody>

              </table>
            </div>

            {/* Legenda */}
            <div className="flex items-center gap-4 mt-4 text-[11px] text-muted-foreground border-t border-[#f28572]/15 pt-3">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: SOMA_PALETTE.sage }} /> ≥ 95% da meta</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: SOMA_PALETTE.warn }} /> 80-94%</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: SOMA_PALETTE.alert }} /> &lt; 80% ou CAC acima</span>
            </div>
          </Panel>
        </Section>

        {/* GRÁFICOS COMPARATIVOS */}
        <Section title="Comparação Visual" subtitle="Projetado vs Realizado em série temporal">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Receita · Projetada vs Real">
              <div className="space-y-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: SOMA_PALETTE.gold }}>
                    Projetado
                  </div>
                  <div className="h-28">
                    <ResponsiveContainer>
                      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f28572" strokeOpacity={0.15} />
                        <XAxis dataKey="month" stroke="#8f7bc4" fontSize={11} />
                        <YAxis stroke="#8f7bc4" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ background: "#1b1426", border: `1px solid ${SOMA_PALETTE.rose}40`, borderRadius: 8 }} formatter={(v: number) => brl(v)} />
                        <Bar dataKey="Projetado" fill={SOMA_PALETTE.gold} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: SOMA_PALETTE.rose }}>
                    Realizado
                  </div>
                  <div className="h-28">
                    <ResponsiveContainer>
                      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f28572" strokeOpacity={0.15} />
                        <XAxis dataKey="month" stroke="#8f7bc4" fontSize={11} />
                        <YAxis stroke="#8f7bc4" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ background: "#1b1426", border: `1px solid ${SOMA_PALETTE.rose}40`, borderRadius: 8 }} formatter={(v: number) => brl(v)} />
                        <Bar dataKey="Realizado" fill={SOMA_PALETTE.rose} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </Panel>
            <Panel title="Crescimento Acumulado">
              <div className="h-64">
                <ResponsiveContainer>
                  <AreaChart data={acc}>
                    <defs>
                      <linearGradient id="accProj" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SOMA_PALETTE.gold} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={SOMA_PALETTE.gold} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="accReal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SOMA_PALETTE.rose} stopOpacity={0.6} />
                        <stop offset="100%" stopColor={SOMA_PALETTE.rose} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f28572" strokeOpacity={0.15} />
                    <XAxis dataKey="month" stroke="#8f7bc4" fontSize={11} />
                    <YAxis stroke="#8f7bc4" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: "#1b1426", border: `1px solid ${SOMA_PALETTE.rose}40`, borderRadius: 8 }} formatter={(v: number) => brl(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="Proj" name="Proj. acum." stroke={SOMA_PALETTE.gold} fill="url(#accProj)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Real" name="Real acum." stroke={SOMA_PALETTE.rose} fill="url(#accReal)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Pedidos · Projetado vs Real">
              <div className="h-64">
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f28572" strokeOpacity={0.15} />
                    <XAxis dataKey="month" stroke="#8f7bc4" fontSize={11} />
                    <YAxis stroke="#8f7bc4" fontSize={11} />
                    <Tooltip contentStyle={{ background: "#1b1426", border: `1px solid ${SOMA_PALETTE.rose}40`, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="Pedidos" stroke={SOMA_PALETTE.gold} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="PedidosReal" name="Real" stroke={SOMA_PALETTE.rose} strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="CAC · Evolução">
              <div className="h-64">
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f28572" strokeOpacity={0.15} />
                    <XAxis dataKey="month" stroke="#8f7bc4" fontSize={11} />
                    <YAxis stroke="#8f7bc4" fontSize={11} />
                    <Tooltip contentStyle={{ background: "#1b1426", border: `1px solid ${SOMA_PALETTE.rose}40`, borderRadius: 8 }} formatter={(v: number) => brl(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="CAC" stroke={SOMA_PALETTE.gold} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="CACReal" name="CAC real" stroke={SOMA_PALETTE.alert} strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
        </Section>

        {/* FORECAST POR CANAL */}
        <Section title="Forecast por Canal" subtitle="Projeção 6 meses + realizado por canal">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Panel>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-[#f28572]/15">
                        <th className="py-2 px-2">Canal</th>
                        <th className="py-2 px-2 text-right">Receita Proj. 6m</th>
                        <th className="py-2 px-2 text-right">Share</th>
                        <th className="py-2 px-2 text-right">Receita Real</th>
                        <th className="py-2 px-2 text-right">Pedidos Real</th>
                        <th className="py-2 px-2 text-right">CAC Real</th>
                        <th className="py-2 px-2 text-right">ROAS Real</th>
                        <th className="py-2 px-2 text-right">Atingimento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CHANNEL_KEYS.map(({ name }, i) => {
                        const proj = projection.reduce((a, m) => a + (m.canais[name] || 0), 0);
                        const real = state.channelReal[name] || {};
                        const share = canalTotal ? (proj / canalTotal) * 100 : 0;
                        const a = real.receita ? (real.receita / proj) * 100 : 0;
                        const s = statusOf(real.receita, proj);
                        return (
                          <tr key={name} className="border-b border-[#f28572]/10 hover:bg-[#f28572]/5">
                            <td className="py-2 px-2 font-medium" style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>{name}</td>
                            <td className="py-2 px-2 text-right tabular-nums" style={{ color: SOMA_PALETTE.cream }}>{brl(proj)}</td>
                            <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{share.toFixed(1)}%</td>
                            <td className="py-2 px-2"><EditNum value={real.receita} onChange={(v) => setChannelReal(name, { receita: v })} prefix="R$" /></td>
                            <td className="py-2 px-2"><EditNum value={real.pedidos} onChange={(v) => setChannelReal(name, { pedidos: v })} /></td>
                            <td className="py-2 px-2"><EditNum value={real.cac} onChange={(v) => setChannelReal(name, { cac: v })} prefix="R$" /></td>
                            <td className="py-2 px-2"><EditNum value={real.roas} onChange={(v) => setChannelReal(name, { roas: v })} suffix="x" step={0.1} /></td>
                            <td className="py-2 px-2 text-right tabular-nums font-semibold flex items-center justify-end gap-1.5">
                              <span className="size-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                              <span style={{ color: STATUS_COLOR[s] }}>{real.receita ? `${a.toFixed(0)}%` : "—"}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
            <Panel title="Share Projetado por Canal">
              <div className="h-72">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={canalShare} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50} paddingAngle={2}>
                      {canalShare.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1b1426", border: `1px solid ${SOMA_PALETTE.rose}40`, borderRadius: 8 }} formatter={(v: number) => brl(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
        </Section>

        {/* DESDOBRAMENTO POR CANAL — MACRO + FUNIL POR FONTE */}
        <Section
          title="Desdobramento por Canal — Funil & Pedidos"
          subtitle="Macro do mês × soma dos canais · funil completo por fonte (visitas → pedidos)"
          icon={Activity}
        >
          <Panel>
            <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Mês de análise</div>
                <Select value={String(channelMonthIdx)} onValueChange={(v) => setChannelMonthIdx(Number(v))}>
                  <SelectTrigger className="w-40 bg-transparent border-[#f28572]/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i)}>
                        {m} {i === 0 ? "(base)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(() => {
                const macro = projection[channelMonthIdx];
                const sumRec = CHANNEL_KEYS.reduce((a, { name }) => a + (channelProjections[name]?.[channelMonthIdx]?.receita || 0), 0);
                const sumPed = CHANNEL_KEYS.reduce((a, { name }) => a + (channelProjections[name]?.[channelMonthIdx]?.pedidos || 0), 0);
                const sumInv = CHANNEL_KEYS.reduce((a, { name }) => a + (channelProjections[name]?.[channelMonthIdx]?.invest || 0), 0);
                const gap = macro.receita ? ((sumRec - macro.receita) / macro.receita) * 100 : 0;
                return (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-1">
                    <MacroPill label="Macro Receita" value={brl(macro.receita)} accent={SOMA_PALETTE.rose} />
                    <MacroPill label="Σ Canais Receita" value={brl(sumRec)} accent={SOMA_PALETTE.gold} hint={`${gap >= 0 ? "+" : ""}${gap.toFixed(1)}% vs macro`} />
                    <MacroPill label="Macro Pedidos" value={Math.round(macro.pedidos).toLocaleString("pt-BR")} accent={SOMA_PALETTE.sage} />
                    <MacroPill label="Σ Canais Pedidos" value={Math.round(sumPed).toLocaleString("pt-BR")} accent={SOMA_PALETTE.blush} />
                    <MacroPill label="Investimento" value={brl(sumInv)} accent={SOMA_PALETTE.roseDeep} />
                  </div>
                );
              })()}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-[#f28572]/15">
                    <th className="py-2 px-2">Canal</th>
                    <th className="py-2 px-2 text-right">Visitas</th>
                    <th className="py-2 px-2 text-right">→ Carrinho</th>
                    <th className="py-2 px-2 text-right">→ Checkout</th>
                    <th className="py-2 px-2 text-right">→ Pedidos</th>
                    <th className="py-2 px-2 text-right">Conv. Final</th>
                    <th className="py-2 px-2 text-right">Ticket</th>
                    <th className="py-2 px-2 text-right">Receita</th>
                    <th className="py-2 px-2 text-right">CAC</th>
                    <th className="py-2 px-2 text-right">Invest.</th>
                    <th className="py-2 px-2 text-right">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {CHANNEL_KEYS.map(({ name }, idx) => {
                    const cm = channelProjections[name]?.[channelMonthIdx];
                    if (!cm) return null;
                    const color = PIE_COLORS[idx % PIE_COLORS.length];
                    return (
                      <tr key={name} className="border-b border-[#f28572]/10 hover:bg-[#f28572]/5">
                        <td className="py-2 px-2 font-medium" style={{ color }}>{name}</td>
                        <td className="py-2 px-2 text-right tabular-nums" style={{ color: SOMA_PALETTE.cream }}>{Math.round(cm.visitas).toLocaleString("pt-BR")}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{Math.round(cm.carrinhos).toLocaleString("pt-BR")}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{Math.round(cm.checkouts).toLocaleString("pt-BR")}</td>
                        <td className="py-2 px-2 text-right tabular-nums font-semibold" style={{ color: SOMA_PALETTE.sage }}>{Math.round(cm.pedidos).toLocaleString("pt-BR")}</td>
                        <td className="py-2 px-2 text-right tabular-nums" style={{ color: SOMA_PALETTE.gold }}>{cm.convFinal.toFixed(2)}%</td>
                        <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{brl(cm.ticket)}</td>
                        <td className="py-2 px-2 text-right tabular-nums font-semibold" style={{ color: SOMA_PALETTE.cream }}>{brl(cm.receita)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{brl(cm.cac)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{brl(cm.invest)}</td>
                        <td className="py-2 px-2 text-right tabular-nums" style={{ color: cm.roas >= 3 ? SOMA_PALETTE.sage : SOMA_PALETTE.warn }}>{cm.roas.toFixed(2)}x</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-[#f28572]/10 font-semibold">
                    <td className="py-2 px-2 text-[11px] uppercase tracking-wider" style={{ color: SOMA_PALETTE.rose }}>Total Canais</td>
                    {(() => {
                      const sums = CHANNEL_KEYS.reduce((acc, { name }) => {
                        const cm = channelProjections[name]?.[channelMonthIdx];
                        if (cm) { acc.v += cm.visitas; acc.car += cm.carrinhos; acc.ch += cm.checkouts; acc.p += cm.pedidos; acc.r += cm.receita; acc.i += cm.invest; }
                        return acc;
                      }, { v: 0, car: 0, ch: 0, p: 0, r: 0, i: 0 });
                      const convT = sums.v ? (sums.p / sums.v) * 100 : 0;
                      const roasT = sums.i ? sums.r / sums.i : 0;
                      return (
                        <>
                          <td className="py-2 px-2 text-right tabular-nums">{Math.round(sums.v).toLocaleString("pt-BR")}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{Math.round(sums.car).toLocaleString("pt-BR")}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{Math.round(sums.ch).toLocaleString("pt-BR")}</td>
                          <td className="py-2 px-2 text-right tabular-nums" style={{ color: SOMA_PALETTE.sage }}>{Math.round(sums.p).toLocaleString("pt-BR")}</td>
                          <td className="py-2 px-2 text-right tabular-nums" style={{ color: SOMA_PALETTE.gold }}>{convT.toFixed(2)}%</td>
                          <td className="py-2 px-2 text-right tabular-nums">—</td>
                          <td className="py-2 px-2 text-right tabular-nums" style={{ color: SOMA_PALETTE.cream }}>{brl(sums.r)}</td>
                          <td className="py-2 px-2 text-right tabular-nums">—</td>
                          <td className="py-2 px-2 text-right tabular-nums">{brl(sums.i)}</td>
                          <td className="py-2 px-2 text-right tabular-nums" style={{ color: roasT >= 3 ? SOMA_PALETTE.sage : SOMA_PALETTE.warn }}>{roasT.toFixed(2)}x</td>
                        </>
                      );
                    })()}
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <Panel title="Macro Receita vs Σ Canais (6 meses)">
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={macroVsChannels}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f2857220" />
                    <XAxis dataKey="month" stroke={SOMA_PALETTE.cream} fontSize={11} />
                    <YAxis stroke={SOMA_PALETTE.cream} fontSize={11} tickFormatter={(v) => brl(v)} />
                    <Tooltip contentStyle={{ background: "#1b1426", border: `1px solid ${SOMA_PALETTE.rose}40`, borderRadius: 8 }} formatter={(v: number) => brl(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="MacroReceita" fill={SOMA_PALETTE.rose} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="SomaCanais" fill={SOMA_PALETTE.gold} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Pedidos por Canal · evolução 6 meses">
              <div className="h-64">
                <ResponsiveContainer>
                  <LineChart data={MONTHS.map((m, i) => { const row: Record<string, number | string> = { month: m }; CHANNEL_KEYS.forEach(({ name }) => { row[name] = Math.round(channelProjections[name]?.[i]?.pedidos || 0); }); return row; })}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f2857220" />
                    <XAxis dataKey="month" stroke={SOMA_PALETTE.cream} fontSize={11} />
                    <YAxis stroke={SOMA_PALETTE.cream} fontSize={11} />
                    <Tooltip contentStyle={{ background: "#1b1426", border: `1px solid ${SOMA_PALETTE.rose}40`, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {CHANNEL_KEYS.map(({ name }, i) => (
                      <Line key={name} type="monotone" dataKey={name} stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {CHANNEL_KEYS.map(({ name }, idx) => {
              const cp = state.channelPremises[name] || DEFAULT_CHANNEL_PREMISES[name];
              const series = channelProjections[name] || [];
              const expanded = channelExpanded === name;
              const color = PIE_COLORS[idx % PIE_COLORS.length];
              return (
                <Panel key={name}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: color }} />
                      <h4 className="font-semibold" style={{ color: SOMA_PALETTE.cream }}>{name}</h4>
                    </div>
                    <button onClick={() => setChannelExpanded(expanded ? null : name)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                      {expanded ? "Recolher" : "Editar premissas"}
                    </button>
                  </div>

                  {expanded && name !== "B2B" && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3 p-3 rounded-md bg-[#f28572]/5 border border-[#f28572]/15">
                      <PremiseInline label="Visitas (Jun)" value={cp.visitas} onChange={(v) => setChannelPremise(name, { visitas: v })} />
                      <PremiseInline label="Ticket" value={cp.ticket} onChange={(v) => setChannelPremise(name, { ticket: v })} prefix="R$" />
                      <PremiseInline label="CAC" value={cp.cac} onChange={(v) => setChannelPremise(name, { cac: v })} prefix="R$" />
                      <PremiseInline label="Investimento" value={cp.invest} onChange={(v) => setChannelPremise(name, { invest: v })} prefix="R$" />
                      <PremiseInline label="Visita → Carrinho" value={cp.ctc} onChange={(v) => setChannelPremise(name, { ctc: v })} suffix="%" step={0.5} />
                      <PremiseInline label="Carrinho → Checkout" value={cp.cco} onChange={(v) => setChannelPremise(name, { cco: v })} suffix="%" step={0.5} />
                      <PremiseInline label="Checkout → Pedido" value={cp.cop} onChange={(v) => setChannelPremise(name, { cop: v })} suffix="%" step={0.5} />
                      <PremiseInline label="Cresc. Visitas m/m" value={cp.growthVisitas} onChange={(v) => setChannelPremise(name, { growthVisitas: v })} suffix="%" step={0.5} />
                      <PremiseInline label="Uplift Conv. (pp/mês)" value={cp.growthConv} onChange={(v) => setChannelPremise(name, { growthConv: v })} suffix="pp" step={0.05} />
                    </div>
                  )}

                  {expanded && name === "B2B" && (
                    <div className="mb-3 p-3 rounded-md bg-[#f28572]/5 border border-[#f28572]/15 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Sub-canais B2B · medidos por leads & pedidos</div>
                        <button onClick={addB2BSub} className="text-[11px] px-2 py-0.5 rounded border border-[#f28572]/30 text-foreground hover:bg-[#f28572]/10">+ Adicionar canal</button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-[#f28572]/15">
                              <th className="py-1.5 px-1">Canal</th>
                              <th className="py-1.5 px-1 text-right">Leads/mês</th>
                              <th className="py-1.5 px-1 text-right">Conv L→P</th>
                              <th className="py-1.5 px-1 text-right">Ticket</th>
                              <th className="py-1.5 px-1 text-right">CAC</th>
                              <th className="py-1.5 px-1 text-right">Invest.</th>
                              <th className="py-1.5 px-1 text-right">Cresc.Leads</th>
                              <th className="py-1.5 px-1 text-right">Uplift</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {state.b2bSubChannels.map((sub) => (
                              <tr key={sub.id} className="border-b border-[#f28572]/5">
                                <td className="py-1 px-1">
                                  <input
                                    value={sub.name}
                                    onChange={(e) => setB2BSub(sub.id, { name: e.target.value })}
                                    className="bg-transparent border-b border-transparent hover:border-[#f28572]/40 focus:border-[#f28572] focus:outline-none w-full text-xs"
                                    style={{ color: SOMA_PALETTE.cream }}
                                  />
                                </td>
                                <td className="py-1 px-1 text-right"><EditNum value={sub.leads} onChange={(v) => setB2BSub(sub.id, { leads: v })} /></td>
                                <td className="py-1 px-1 text-right"><EditNum value={sub.convLeadPedido} onChange={(v) => setB2BSub(sub.id, { convLeadPedido: v })} suffix="%" step={0.5} /></td>
                                <td className="py-1 px-1 text-right"><EditNum value={sub.ticket} onChange={(v) => setB2BSub(sub.id, { ticket: v })} prefix="R$" /></td>
                                <td className="py-1 px-1 text-right"><EditNum value={sub.cac} onChange={(v) => setB2BSub(sub.id, { cac: v })} prefix="R$" /></td>
                                <td className="py-1 px-1 text-right"><EditNum value={sub.invest} onChange={(v) => setB2BSub(sub.id, { invest: v })} prefix="R$" /></td>
                                <td className="py-1 px-1 text-right"><EditNum value={sub.growthLeads} onChange={(v) => setB2BSub(sub.id, { growthLeads: v })} suffix="%" step={0.5} /></td>
                                <td className="py-1 px-1 text-right"><EditNum value={sub.growthConv} onChange={(v) => setB2BSub(sub.id, { growthConv: v })} suffix="pp" step={0.05} /></td>
                                <td className="py-1 px-1 text-right">
                                  <button onClick={() => removeB2BSub(sub.id)} className="text-muted-foreground hover:text-[color:var(--soma-alert)]" title="Remover" style={{ color: SOMA_PALETTE.alert }}>×</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {name === "B2B" ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 mb-3">
                      {state.b2bSubChannels.map((sub, si) => {
                        const cm0 = b2bSubProjections[sub.id]?.[0];
                        if (!cm0) return null;
                        const subColor = PIE_COLORS[(idx + si + 1) % PIE_COLORS.length];
                        return (
                          <div key={sub.id} className="rounded-md p-2 border border-[#f28572]/15" style={{ background: `${subColor}12` }}>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate" title={sub.name}>{sub.name}</div>
                            <div className="text-sm font-semibold tabular-nums" style={{ color: SOMA_PALETTE.cream }}>{brl(cm0.receita)}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                              {Math.round(cm0.visitas).toLocaleString("pt-BR")} leads · {Math.round(cm0.pedidos).toLocaleString("pt-BR")} ped · {cm0.convFinal.toFixed(1)}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                  <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {(() => {
                      const m0 = series[0];
                      if (!m0) return null;
                      const stages = [
                        { label: "Visitas", v: m0.visitas, w: 100 },
                        { label: "Carrinho", v: m0.carrinhos, w: (m0.carrinhos / m0.visitas) * 100 },
                        { label: "Checkout", v: m0.checkouts, w: (m0.checkouts / m0.visitas) * 100 },
                        { label: "Pedidos", v: m0.pedidos, w: (m0.pedidos / m0.visitas) * 100 },
                      ];
                      return stages.map((s) => (
                        <div key={s.label} className="rounded-md p-2 border border-[#f28572]/15" style={{ background: `${color}10` }}>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                          <div className="text-sm font-semibold tabular-nums" style={{ color: SOMA_PALETTE.cream }}>{Math.round(s.v).toLocaleString("pt-BR")}</div>
                          <div className="mt-1 h-1 rounded-full bg-[#f28572]/10 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${s.w}%`, background: color }} />
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{s.w.toFixed(1)}%</div>
                        </div>
                      ));
                    })()}
                  </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-[#f28572]/15">
                          <th className="py-1.5 px-1">Mês</th>
                          <th className="py-1.5 px-1 text-right">Visitas</th>
                          <th className="py-1.5 px-1 text-right">Pedidos</th>
                          <th className="py-1.5 px-1 text-right">Receita</th>
                          <th className="py-1.5 px-1 text-right">ROAS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {series.map((cm) => (
                          <tr key={cm.month} className="border-b border-[#f28572]/5">
                            <td className="py-1.5 px-1 font-medium" style={{ color: cm.idx === 0 ? color : SOMA_PALETTE.cream }}>{cm.month}{cm.idx === 0 ? " ·base" : ""}</td>
                            <td className="py-1.5 px-1 text-right tabular-nums text-muted-foreground">{Math.round(cm.visitas).toLocaleString("pt-BR")}</td>
                            <td className="py-1.5 px-1 text-right tabular-nums" style={{ color: SOMA_PALETTE.sage }}>{Math.round(cm.pedidos).toLocaleString("pt-BR")}</td>
                            <td className="py-1.5 px-1 text-right tabular-nums font-semibold" style={{ color: SOMA_PALETTE.cream }}>{brl(cm.receita)}</td>
                            <td className="py-1.5 px-1 text-right tabular-nums" style={{ color: cm.roas >= 3 ? SOMA_PALETTE.sage : SOMA_PALETTE.warn }}>{cm.roas > 0 ? `${cm.roas.toFixed(2)}x` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              );
            })}
          </div>
        </Section>

        {/* UNIT ECONOMICS RESUMO */}
        <Section title="Saúde Unitária" subtitle="LTV/CAC, margem, recompra · derivado das premissas">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <HealthCard label="LTV / CAC" value={`${(state.premises.ltv / Math.max(state.premises.cac, 1)).toFixed(1)}x`} healthy={state.premises.ltv / state.premises.cac >= 5} meta="≥ 5x" />
            <HealthCard label="Margem Bruta" value={`${state.premises.margemBruta.toFixed(0)}%`} healthy={state.premises.margemBruta >= 55} meta="≥ 55%" />
            <HealthCard label="CMV" value={`${state.premises.cmv.toFixed(0)}%`} healthy={state.premises.cmv <= 35} inverted meta="≤ 35%" />
            <HealthCard label="Recompra" value={`${state.premises.recompra.toFixed(0)}%`} healthy={state.premises.recompra >= 30} meta="≥ 30%" />
            <HealthCard label="LTV" value={brl(state.premises.ltv)} healthy={state.premises.ltv >= 500} meta="≥ R$ 500" />
            <HealthCard label="ROAS" value={`${state.premises.roas.toFixed(2)}x`} healthy={state.premises.roas >= 3} meta="≥ 3x" />
          </div>
        </Section>

        {/* ROADMAP */}
        <Section title="Roadmap Estratégico" subtitle="Clique em um mês para planejar campanhas, ideias e aproveitar o calendário comercial" icon={Calendar}>
          <Panel>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
              {ROADMAP_MONTHS.map(({ m, t, suggestedDates }, i) => {
                const Icon = [Flame, Heart, TrendingUp, Briefcase, Repeat, Sparkles, Zap][i] || Calendar;
                const plan = roadmapPlans[m];
                const hasPlan = plan && (plan.tema || plan.objetivo || plan.ideias || plan.campanhas || (plan.datasSelecionadas?.length ?? 0) > 0);
                return (
                  <button
                    key={m}
                    onClick={() => setOpenMonth(m)}
                    className="text-left relative rounded-xl p-4 border transition-all hover:scale-[1.03] hover:shadow-lg cursor-pointer"
                    style={{
                      borderColor: hasPlan ? `${SOMA_PALETTE.sage}80` : `${SOMA_PALETTE.rose}30`,
                      background: hasPlan
                        ? `linear-gradient(135deg, ${SOMA_PALETTE.sage}18, ${SOMA_PALETTE.gold}08)`
                        : `linear-gradient(135deg, ${SOMA_PALETTE.rose}10, ${SOMA_PALETTE.gold}05)`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Mês {i + 1}</div>
                      {hasPlan && <CheckCircle2 className="size-3.5" style={{ color: SOMA_PALETTE.sage }} />}
                    </div>
                    <Icon className="size-5 mb-2" style={{ color: hasPlan ? SOMA_PALETTE.sage : SOMA_PALETTE.rose }} />
                    <div className="font-semibold text-sm" style={{ color: SOMA_PALETTE.cream }}>{m}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {plan?.tema || t}
                    </div>
                    <div className="text-[10px] mt-2 flex items-center gap-1" style={{ color: SOMA_PALETTE.gold }}>
                      <Calendar className="size-3" />
                      {suggestedDates.length} datas no calendário
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>
        </Section>

        <MonthPlanDialog
          openMonth={openMonth}
          onClose={() => setOpenMonth(null)}
          plans={roadmapPlans}
          onSave={(month, plan) => {
            setRoadmapPlans((prev) => ({ ...prev, [month]: plan }));
            toast.success(`Plano de ${month} salvo`, { description: "As ideias foram persistidas localmente." });
            setOpenMonth(null);
          }}
          onClear={(month) => {
            setRoadmapPlans((prev) => {
              const next = { ...prev };
              delete next[month];
              return next;
            });
            toast.success(`Plano de ${month} limpo`);
            setOpenMonth(null);
          }}
        />

        <div className="text-center text-xs text-muted-foreground pt-4 pb-8">
          SOMA · Creator-led Wellness Brand · Forecasting Estratégico
        </div>
      </div>
    </div>
  );
}

// ============ SUBCOMPONENTS ============
function Header({
  scenario,
  onScenario,
  scenarioMults,
  onScenarioMults,
  onRecalibrate,
  onExport,
  onImport,
  onReset,
  onSave,
  onRestore,
  savedAt,
}: {
  scenario: ScenarioKey;
  onScenario: (s: ScenarioKey) => void;
  scenarioMults: Record<ScenarioKey, { rev: number; cac: number }>;
  onScenarioMults: (m: Record<ScenarioKey, { rev: number; cac: number }>) => void;
  onRecalibrate: () => void;
  onExport: () => void;
  onImport: (file: File) => void | Promise<void>;
  onReset: () => void;
  onSave: () => void;
  onRestore: () => void;
  savedAt: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateMult = (key: ScenarioKey, field: "rev" | "cac", deltaPct: number) => {
    onScenarioMults({
      ...scenarioMults,
      [key]: { ...scenarioMults[key], [field]: 1 + deltaPct / 100 },
    });
  };
  const currentMult = scenarioMults[scenario];
  const revDelta = ((currentMult.rev - 1) * 100).toFixed(0);
  const cacDelta = ((currentMult.cac - 1) * 100).toFixed(0);

  return (
    <div
      className="rounded-2xl p-6 border"
      style={{
        background: `linear-gradient(135deg, ${SOMA_PALETTE.ink} 0%, oklch(0.25 0.02 30) 100%)`,
        borderColor: `${SOMA_PALETTE.rose}25`,
      }}
    >
      <div className="flex items-start justify-between flex-wrap gap-4">
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
              Forecasting Estratégico · Cenário ativo: receita {Number(revDelta) >= 0 ? "+" : ""}{revDelta}% · CAC {Number(cacDelta) >= 0 ? "+" : ""}{cacDelta}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={scenario} onValueChange={(v) => onScenario(v as ScenarioKey)}>
            <SelectTrigger className="w-44 bg-transparent border-[#f28572]/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conservador">🛡️ Conservador</SelectItem>
              <SelectItem value="base">⚖️ Base</SelectItem>
              <SelectItem value="agressivo">🚀 Agressivo</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="border-[#f28572]/30">
                <Settings2 className="size-4 mr-1" /> Cenários
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[380px]" align="end">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold">Calibrar cenários</p>
                  <p className="text-xs text-muted-foreground">
                    Defina o % de variação de receita e CAC sobre a base, aplicado a Jul → Dez.
                  </p>
                </div>
                <div className="grid grid-cols-[1fr_90px_90px] gap-2 items-center text-xs font-medium text-muted-foreground">
                  <span></span>
                  <span className="text-center">Receita Δ%</span>
                  <span className="text-center">CAC Δ%</span>
                </div>
                {(["conservador", "base", "agressivo"] as ScenarioKey[]).map((k) => {
                  const m = scenarioMults[k];
                  const rev = ((m.rev - 1) * 100).toFixed(0);
                  const cac = ((m.cac - 1) * 100).toFixed(0);
                  const labels: Record<ScenarioKey, string> = {
                    conservador: "🛡️ Conservador",
                    base: "⚖️ Base",
                    agressivo: "🚀 Agressivo",
                  };
                  return (
                    <div key={k} className="grid grid-cols-[1fr_90px_90px] gap-2 items-center">
                      <Label className="text-sm">{labels[k]}</Label>
                      <Input
                        type="number"
                        value={rev}
                        disabled={k === "base"}
                        onChange={(e) => updateMult(k, "rev", Number(e.target.value) || 0)}
                        className="h-8 text-xs text-center"
                      />
                      <Input
                        type="number"
                        value={cac}
                        disabled={k === "base"}
                        onChange={(e) => updateMult(k, "cac", Number(e.target.value) || 0)}
                        className="h-8 text-xs text-center"
                      />
                    </div>
                  );
                })}
                <p className="text-[10px] text-muted-foreground leading-relaxed pt-1 border-t">
                  Base sempre = 0%. Conservador costuma ser receita negativa + CAC positivo; agressivo o oposto.
                </p>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            size="sm"
            onClick={onRecalibrate}
            className="border-0"
            style={{ background: `linear-gradient(135deg, ${SOMA_PALETTE.rose}, ${SOMA_PALETTE.gold})`, color: SOMA_PALETTE.ink }}
          >
            <Zap className="size-4 mr-1" /> Recalibrar Forecast
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            className="border-0 font-semibold"
            style={{ background: SOMA_PALETTE.sage, color: SOMA_PALETTE.ink }}
            title={savedAt ? `Último salvamento: ${new Date(savedAt).toLocaleString("pt-BR")}` : "Salvar cenário atual"}
          >
            <Save className="size-4 mr-1" />
            {savedAt
              ? `Salvo · ${new Date(savedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
              : "Salvar Cenário"}
          </Button>
          {savedAt && (
            <Button variant="outline" size="sm" onClick={onRestore} className="border-[#f28572]/30" title="Restaurar último cenário salvo">
              <RotateCcw className="size-4 mr-1" /> Restaurar salvo
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onExport} className="border-[#f28572]/30">
            <Download className="size-4 mr-1" /> Exportar
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,application/json,text/csv"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await onImport(f);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="border-[#b78cff]/40"
            title="Importar JSON exportado ou CSV com realizado mensal"
          >
            <Upload className="size-4 mr-1" /> Importar
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset} title="Resetar tudo">
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
      <div className="flex items-end justify-between border-b border-[#f28572]/15 pb-2">
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
        <h3 className="text-xs uppercase tracking-[0.15em] mb-3" style={{ color: SOMA_PALETTE.sand }}>
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
      className="rounded-xl border p-4 relative overflow-hidden group transition-all hover:border-[#f28572]/40"
      style={{ background: "oklch(0.24 0.015 30 / 0.7)", borderColor: `${SOMA_PALETTE.rose}20` }}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
        <Icon className="size-4" style={{ color: SOMA_PALETTE.rose, opacity: 0.7 }} />
      </div>
      <div className="text-2xl font-light tabular-nums mb-1" style={{ color: SOMA_PALETTE.cream }}>{value}</div>
      <div className="text-[11px]" style={{ color: trend === "up" ? SOMA_PALETTE.sage : SOMA_PALETTE.alert }}>{delta}</div>
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

function PremisesGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] mb-2" style={{ color: SOMA_PALETTE.rose }}>{title}</div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">{children}</div>
    </div>
  );
}

function PremiseField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
}) {
  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: `${SOMA_PALETTE.rose}20`, background: "oklch(0.22 0.015 30 / 0.5)" }}>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="mt-1 flex items-center gap-1 border-b border-[#f28572]/20 pb-0.5">
        {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
        <input
          type="number"
          value={value}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="flex-1 bg-transparent focus:outline-none tabular-nums text-right text-sm"
          style={{ color: SOMA_PALETTE.cream }}
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function MetricRow({
  label,
  data,
  total,
  highlight,
  inverted,
}: {
  label: string;
  data: string[];
  total?: string;
  highlight?: boolean;
  inverted?: boolean;
}) {
  return (
    <tr className="border-b border-[#f28572]/10">
      <td
        className="py-2 px-2 sticky left-0 bg-[#1b1426]/60 z-10"
        style={{ color: highlight ? SOMA_PALETTE.cream : "var(--muted-foreground)", fontWeight: highlight ? 500 : 400 }}
      >
        {label}
      </td>
      {data.map((d, i) => (
        <td key={i} className="py-2 px-3 text-right tabular-nums text-sm" style={{ color: highlight ? SOMA_PALETTE.cream : SOMA_PALETTE.sand }}>
          {d}
        </td>
      ))}
      {total !== undefined && (
        <td className="py-2 px-2 text-right tabular-nums font-medium" style={{ color: highlight ? SOMA_PALETTE.gold : SOMA_PALETTE.cream }}>
          {total}
        </td>
      )}
      {total === undefined && <td />}
      {inverted && null}
    </tr>
  );
}

function RealizedRow({
  label,
  months,
  projection,
  realized,
  onEdit,
  inverted,
  prefix,
}: {
  label: string;
  months: string[];
  projection: number[];
  realized: (number | undefined)[];
  onEdit: (m: string, v: number) => void;
  inverted?: boolean;
  prefix?: string;
}) {
  return (
    <tr className="border-b border-[#f28572]/10 bg-[#f28572]/[0.03]">
      <td className="py-2 px-2 sticky left-0 bg-[#1b1426]/70 z-10 text-xs" style={{ color: SOMA_PALETTE.rose }}>{label}</td>
      {months.map((m, i) => {
        const s = statusOf(realized[i], projection[i], inverted);
        return (
          <td key={m} className="py-2 px-3">
            <div className="flex items-center justify-end gap-1.5">
              <span className="size-2 rounded-full shrink-0" style={{ background: STATUS_COLOR[s] }} />
              <EditNum value={realized[i]} onChange={(v) => onEdit(m, v)} prefix={prefix} />
            </div>
          </td>
        );
      })}
      <td />
    </tr>
  );
}

function Separator({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={9} className="py-1 px-2 text-[10px] uppercase tracking-[0.2em] sticky left-0 bg-[#1b1426]/80 z-10" style={{ color: SOMA_PALETTE.gold }}>
        — {label} —
      </td>
    </tr>
  );
}

function HealthCard({ label, value, healthy, meta, inverted }: { label: string; value: string; healthy: boolean; meta: string; inverted?: boolean }) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{
        background: "oklch(0.24 0.015 30 / 0.6)",
        borderColor: healthy ? `${SOMA_PALETTE.sage}40` : `${SOMA_PALETTE.alert}40`,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        {healthy ? (
          <CheckCircle2 className="size-3" style={{ color: SOMA_PALETTE.sage }} />
        ) : (
          <AlertTriangle className="size-3" style={{ color: SOMA_PALETTE.alert }} />
        )}
      </div>
      <div className="text-xl font-light tabular-nums" style={{ color: healthy ? SOMA_PALETTE.sage : SOMA_PALETTE.alert }}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-1">{meta}{inverted ? "" : ""}</div>
    </div>
  );
}

function GrowthDial({
  label,
  value,
  onChange,
  accent,
  invertedGood = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  accent: string;
  invertedGood?: boolean;
}) {
  // Para CAC: crescimento baixo é bom (invertedGood)
  const tone = invertedGood
    ? value <= 5
      ? SOMA_PALETTE.sage
      : value <= 12
        ? SOMA_PALETTE.warn
        : SOMA_PALETTE.alert
    : value >= 15
      ? SOMA_PALETTE.sage
      : value >= 5
        ? SOMA_PALETTE.warn
        : SOMA_PALETTE.alert;
  return (
    <div
      className="rounded-lg p-3 border transition-colors"
      style={{
        background: "linear-gradient(135deg, rgba(212,165,160,0.04), rgba(212,165,160,0.01))",
        borderColor: `${accent}30`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="size-1.5 rounded-full" style={{ background: accent }} />
      </div>
      <div className="flex items-baseline gap-1">
        <input
          type="number"
          step={0.5}
          value={value === 0 ? "" : value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="bg-transparent border-b border-[#f28572]/20 focus:border-[#f28572] focus:outline-none w-full text-2xl font-light tabular-nums text-right"
          style={{ color: tone }}
        />
        <span className="text-sm" style={{ color: tone }}>%</span>
      </div>
      <div className="mt-2 h-1 w-full rounded-full bg-[#f28572]/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(Math.abs(value) * 3, 100)}%`,
            background: `linear-gradient(90deg, ${accent}, ${accent}80)`,
          }}
        />
      </div>
    </div>
  );
}

function MacroPill({ label, value, accent, hint }: { label: string; value: string; accent: string; hint?: string }) {
  return (
    <div className="rounded-md px-3 py-2 border" style={{ borderColor: `${accent}40`, background: `${accent}10` }}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums" style={{ color: accent }}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function PremiseInline({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1 px-2 py-1 rounded border border-[#f28572]/20 bg-[#1b1426]/40">
        {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
        <input
          type="number"
          value={value === 0 ? "" : value}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="bg-transparent focus:outline-none w-full text-right tabular-nums text-xs"
          style={{ color: "#f5ede2" }}
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

// ============ MONTH PLAN DIALOG ============
function MonthPlanDialog({
  openMonth,
  onClose,
  plans,
  onSave,
  onClear,
}: {
  openMonth: string | null;
  onClose: () => void;
  plans: Record<string, MonthPlan>;
  onSave: (month: string, plan: MonthPlan) => void;
  onClear: (month: string) => void;
}) {
  const monthDef = ROADMAP_MONTHS.find((r) => r.m === openMonth);
  const [draft, setDraft] = useState<MonthPlan>(EMPTY_PLAN);

  useEffect(() => {
    if (openMonth) {
      setDraft(plans[openMonth] ?? { ...EMPTY_PLAN, tema: monthDef?.t ?? "" });
    }
  }, [openMonth, plans, monthDef]);

  if (!openMonth || !monthDef) return null;

  const toggleDate = (label: string) => {
    setDraft((d) => {
      const has = d.datasSelecionadas.includes(label);
      return {
        ...d,
        datasSelecionadas: has
          ? d.datasSelecionadas.filter((x) => x !== label)
          : [...d.datasSelecionadas, label],
      };
    });
  };

  const typeColor = (type: CalendarDate["type"]) => {
    if (type === "campanha") return SOMA_PALETTE.rose;
    if (type === "sazonal") return SOMA_PALETTE.gold;
    return SOMA_PALETTE.sage;
  };

  return (
    <Dialog open={!!openMonth} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        style={{ background: SOMA_PALETTE.ink, borderColor: `${SOMA_PALETTE.rose}40`, color: SOMA_PALETTE.cream }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl" style={{ color: SOMA_PALETTE.cream }}>
            <Calendar className="size-5" style={{ color: SOMA_PALETTE.rose }} />
            Planejamento de {openMonth}
          </DialogTitle>
          <DialogDescription>
            Estruture o foco, campanhas e ideias do mês. As datas sugeridas vêm do calendário comercial brasileiro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Datas sugeridas */}
          <div
            className="rounded-xl p-4 border"
            style={{ borderColor: `${SOMA_PALETTE.gold}30`, background: `${SOMA_PALETTE.gold}08` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="size-4" style={{ color: SOMA_PALETTE.gold }} />
              <h3 className="text-sm font-semibold" style={{ color: SOMA_PALETTE.cream }}>
                Datas do calendário comercial — {openMonth}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {monthDef.suggestedDates.map((d) => {
                const selected = draft.datasSelecionadas.includes(d.label);
                return (
                  <button
                    key={d.label}
                    onClick={() => toggleDate(d.label)}
                    className="flex items-start gap-2 text-left rounded-lg p-2.5 border transition-all hover:scale-[1.01]"
                    style={{
                      borderColor: selected ? typeColor(d.type) : `${SOMA_PALETTE.cream}15`,
                      background: selected ? `${typeColor(d.type)}20` : "transparent",
                    }}
                  >
                    <div
                      className="mt-0.5 size-4 rounded border flex items-center justify-center shrink-0"
                      style={{
                        borderColor: typeColor(d.type),
                        background: selected ? typeColor(d.type) : "transparent",
                      }}
                    >
                      {selected && <CheckCircle2 className="size-3" style={{ color: SOMA_PALETTE.ink }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono" style={{ color: typeColor(d.type) }}>
                        {d.date}
                      </div>
                      <div className="text-sm" style={{ color: SOMA_PALETTE.cream }}>
                        {d.label}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                        {d.type}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-muted-foreground mt-2">
              Clique para incluir/excluir do plano deste mês.
            </div>
          </div>

          {/* Campos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tema / Foco do mês</Label>
              <Input
                value={draft.tema}
                onChange={(e) => setDraft({ ...draft, tema: e.target.value })}
                placeholder="Ex: Aquisição via creators"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">KPI alvo</Label>
              <Input
                value={draft.kpi}
                onChange={(e) => setDraft({ ...draft, kpi: e.target.value })}
                placeholder="Ex: ROAS ≥ 3.5x · 1.500 pedidos"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Objetivo estratégico</Label>
            <Textarea
              value={draft.objetivo}
              onChange={(e) => setDraft({ ...draft, objetivo: e.target.value })}
              placeholder="O que precisa ser conquistado neste mês?"
              className="mt-1 min-h-[70px]"
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Campanhas planejadas</Label>
            <Textarea
              value={draft.campanhas}
              onChange={(e) => setDraft({ ...draft, campanhas: e.target.value })}
              placeholder="Liste campanhas: nome · canal · período · investimento"
              className="mt-1 min-h-[80px]"
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ideias / Hipóteses</Label>
            <Textarea
              value={draft.ideias}
              onChange={(e) => setDraft({ ...draft, ideias: e.target.value })}
              placeholder="Hipóteses criativas, testes, oportunidades sazonais..."
              className="mt-1 min-h-[80px]"
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Observações</Label>
            <Textarea
              value={draft.observacoes}
              onChange={(e) => setDraft({ ...draft, observacoes: e.target.value })}
              placeholder="Riscos, dependências, aprendizados anteriores..."
              className="mt-1 min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 pt-2">
          {plans[openMonth] && (
            <Button
              variant="ghost"
              onClick={() => onClear(openMonth)}
              className="text-xs"
              style={{ color: SOMA_PALETTE.alert }}
            >
              <Trash2 className="size-3.5 mr-1" /> Limpar plano
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => onSave(openMonth, draft)}
            style={{ background: SOMA_PALETTE.sage, color: SOMA_PALETTE.ink }}
          >
            <Save className="size-4 mr-1.5" /> Salvar plano de {openMonth}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
