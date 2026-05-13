import type { Node, Edge } from "reactflow";

export type Level = "ceo" | "coo" | "intl" | "head" | "team";

export interface OrgNodeData {
  name: string;
  role: string;
  area?: string;
  level: Level;
  responsibilities: string[];
  kpis: string[];
  reportsTo?: string;
}

const mk = (
  id: string,
  x: number,
  y: number,
  data: OrgNodeData
): Node<OrgNodeData> => ({
  id,
  position: { x, y },
  data,
  type: "org",
});

const COL = 280;
const ROW = 220;

export const initialNodes: Node<OrgNodeData>[] = [
  mk("grax", 4 * COL, 0 * ROW, {
    name: "GRAx Group",
    role: "Holding",
    level: "ceo",
    responsibilities: [
      "Visão e direção estratégica",
      "Governança",
      "Estrutura matricial",
      "Crescimento sustentável",
    ],
    kpis: ["Crescimento consolidado", "Valuation", "Margem global", "LTV consolidado"],
  }),

  // Nível 1 — sócios / direção
  mk("alan", 2 * COL, 1 * ROW, {
    name: "Alan",
    role: "CEO — Direção Estratégica & Growth Vision",
    area: "Estratégia & Growth Vision",
    level: "ceo",
    responsibilities: [
      "Direção da holding",
      "Visão estratégica e expansão",
      "Branding macro",
      "Alocação de recursos",
      "Liderança executiva",
      "Governança",
    ],
    kpis: [
      "Crescimento de receita",
      "Market share",
      "Valuation",
      "NPS de cultura",
    ],
  }),
  mk("miller", 4 * COL, 1 * ROW, {
    name: "Miller",
    role: "COO — Operações & Administrativo",
    area: "Operações",
    level: "coo",
    responsibilities: [
      "Operações e supply",
      "Produção, compras, logística",
      "Financeiro operacional",
      "Administrativo",
      "Eficiência operacional",
    ],
    kpis: [
      "SLA",
      "Lead time",
      "Ruptura",
      "Custos",
      "Margem operacional",
      "Eficiência logística",
    ],
  }),
  mk("jack", 6 * COL, 1 * ROW, {
    name: "Jack",
    role: "Head Internacional",
    area: "Expansão Global (matricial c/ Growth)",
    level: "intl",
    responsibilities: [
      "Expansão internacional",
      "Crescimento global da Pimenta Rosa",
      "Distribuidores internacionais",
      "Operação internacional",
      "Define prioridades internacionais (executadas pelo Growth)",
    ],
    kpis: [
      "Receita internacional",
      "Países ativos",
      "Distribuidores ativos",
      "Sell-out global",
    ],
  }),

  // Nível 2 — heads sob Alan
  mk("fernando", 2 * COL, 2 * ROW, {
    name: "Fernando",
    role: "Head of Growth — Full Funnel",
    area: "Growth (Aquisição + Retenção + Internacional)",
    level: "head",
    reportsTo: "Alan",
    responsibilities: [
      "Liderança do Growth Full Funnel da holding",
      "Aquisição, creators, branding, tráfego",
      "CRM e retenção (via Ian)",
      "Monetização da base e LTV",
      "Growth internacional (matricial c/ Jack)",
    ],
    kpis: [
      "CAC",
      "ROAS",
      "LTV",
      "Receita full funnel",
      "Payback",
      "Crescimento da base",
    ],
  }),
  mk("igor", 4 * COL, 2 * ROW, {
    name: "Igor",
    role: "Head Comercial & Expansão B2B",
    area: "Comercial B2B",
    level: "head",
    reportsTo: "Alan",
    responsibilities: [
      "Expansão comercial e B2B",
      "Distribuidores e canais",
      "Sell-in e expansão regional",
    ],
    kpis: [
      "Receita B2B",
      "Sell-in",
      "Distribuidores ativos",
      "Pipeline",
      "Expansão regional",
      "Ticket médio B2B",
    ],
  }),

  // Núcleo Growth — Acquisition (sob Fernando)
  mk("luis", -1 * COL, 3 * ROW, {
    name: "Luís",
    role: "Performance",
    area: "Acquisition",
    level: "team",
    reportsTo: "Fernando",
    responsibilities: ["Tráfego pago", "Mídia", "Otimização"],
    kpis: ["ROAS", "CPA", "CTR", "CPM", "Conversão"],
  }),
  mk("anajulia", 0 * COL, 3 * ROW, {
    name: "Ana Júlia",
    role: "Diretora Criativa & Brand Manager",
    area: "Acquisition / Branding & Criação",
    level: "head",
    reportsTo: "Fernando",
    responsibilities: [
      "Direção criativa de toda a holding",
      "Branding e guardiã da identidade visual",
      "Gestão do time de Designers, Copywriters e Social Media",
      "Curadoria de conteúdo e padrão estético",
      "Briefings criativos para campanhas e creators",
    ],
    kpis: [
      "Brand lift",
      "Output criativo (peças/semana)",
      "Engajamento social",
      "Aderência ao brand book",
      "SLA de entregas criativas",
    ],
  }),
  mk("vanessa", 1 * COL, 3 * ROW, {
    name: "Vanessa",
    role: "Head Influencers",
    area: "Acquisition / Creators",
    level: "team",
    reportsTo: "Fernando",
    responsibilities: ["Influência", "Creators", "Parcerias"],
    kpis: ["Creators ativos", "Creators revenue", "EMV", "Conversão de influência"],
  }),
  mk("rafaelweb", 2 * COL, 3 * ROW, {
    name: "Rafael",
    role: "Head Produção & Web Performance",
    area: "Growth — Web, Site & CRO",
    level: "head",
    reportsTo: "Fernando",
    responsibilities: [
      "Construção e manutenção de sites e landing pages",
      "CRO — testes A/B, otimização de funil e checkout",
      "Performance técnica do site (velocidade, Core Web Vitals)",
      "Stack web e integrações de tracking",
      "SLA de novas LPs para campanhas",
    ],
    kpis: [
      "CVR do site",
      "CVR de LPs de campanha",
      "Page speed / Core Web Vitals",
      "Uptime",
      "Lead time de novas LPs",
      "Receita influenciada pelo site",
    ],
  }),
  mk("webdev", 1.5 * COL, 5 * ROW, {
    name: "Web Dev & Design",
    role: "Construção de Sites & LPs",
    level: "team",
    reportsTo: "Rafael",
    responsibilities: ["Desenvolvimento web", "Web design", "Manutenção da stack"],
    kpis: ["Lead time de LPs", "Bugs em produção", "Uptime"],
  }),
  mk("cro", 2.5 * COL, 5 * ROW, {
    name: "CRO",
    role: "Otimização de Conversão",
    level: "team",
    reportsTo: "Rafael",
    responsibilities: ["Testes A/B", "Análise de funil", "Otimização de checkout"],
    kpis: ["CVR", "Lift por teste", "Velocidade de experimentação"],
  }),
  mk("designers", -1 * COL, 4 * ROW, {
    name: "Designers & Copy",
    role: "Time Criativo",
    level: "team",
    reportsTo: "Ana Júlia",
    responsibilities: ["Design", "Copywriting", "Produção criativa de campanhas"],
    kpis: ["Output criativo", "SLA de entregas", "Quality score"],
  }),
  mk("socialmedia", 0 * COL, 4 * ROW, {
    name: "Social Media & Community",
    role: "Conteúdo Social + Comunidade",
    level: "team",
    reportsTo: "Ana Júlia",
    responsibilities: [
      "Gestão de redes sociais",
      "Calendário editorial",
      "Comunidade e engajamento",
      "Resposta e moderação",
    ],
    kpis: ["Engajamento", "Crescimento social", "Tempo de resposta", "Share of voice"],
  }),
  mk("lauro", 1 * COL, 4 * ROW, {
    name: "Lauro",
    role: "Captação de Creators",
    level: "team",
    reportsTo: "Vanessa",
    responsibilities: ["Captação de creators", "Onboarding"],
    kpis: ["Novos creators / mês", "Taxa de ativação"],
  }),
  mk("breno", 2 * COL, 4 * ROW, {
    name: "Breno",
    role: "UGC",
    level: "team",
    reportsTo: "Vanessa",
    responsibilities: ["UGC", "Produção de conteúdo de creators"],
    kpis: ["Volume de UGC", "Performance de UGC", "CPM UGC"],
  }),

  // Núcleo Growth — Retention & CRM (Ian agora reporta a Fernando)
  mk("ian", 3 * COL, 3 * ROW, {
    name: "Ian",
    role: "Head CRM & Retention",
    area: "Growth — Retenção & Monetização da Base",
    level: "head",
    reportsTo: "Fernando",
    responsibilities: [
      "Retenção e monetização da base",
      "CRM e WhatsApp",
      "Recompra e customer experience",
      "Suporte e recuperação",
      "Crescimento de LTV",
    ],
    kpis: [
      "LTV",
      "Recompra",
      "Retenção",
      "Receita CRM",
      "Recuperação de carrinho",
      "NPS",
      "Receita WhatsApp",
      "Taxa de resolução suporte",
    ],
  }),
  mk("crm", 3 * COL, 4 * ROW, {
    name: "CRM / Automação",
    role: "Automação WhatsApp",
    level: "team",
    reportsTo: "Ian",
    responsibilities: ["Automação", "WhatsApp", "Jornadas"],
    kpis: ["Open rate", "Conversão de jornada", "Receita CRM"],
  }),
  mk("retencao", 4 * COL, 4 * ROW, {
    name: "Retenção",
    role: "Recompra & Fidelização",
    level: "team",
    reportsTo: "Ian",
    responsibilities: ["Recompra", "Fidelização"],
    kpis: ["Recompra", "LTV", "Churn"],
  }),
  mk("julian", 3 * COL, 5 * ROW, {
    name: "Julian",
    role: "Suporte / Pós-venda",
    level: "team",
    reportsTo: "Ian",
    responsibilities: ["Suporte", "Pós-venda", "Atendimento"],
    kpis: ["CSAT", "Tempo de resposta", "Resolução no 1º contato"],
  }),

  // Comercial B2B — Igor
  mk("otavio", 4 * COL, 3 * ROW, {
    name: "Otávio",
    role: "Comercial",
    level: "team",
    reportsTo: "Igor",
    responsibilities: ["Vendas", "Atendimento B2B"],
    kpis: ["Receita", "Ticket médio", "Conversão", "Pipeline"],
  }),
  mk("distrib", 5 * COL, 3 * ROW, {
    name: "Distribuidores B2B",
    role: "Canal",
    level: "team",
    reportsTo: "Igor",
    responsibilities: ["Distribuição B2B", "Cobertura regional"],
    kpis: ["Sell-in", "Sell-out", "Cobertura de PDV"],
  }),

  // Operações — Miller
  mk("carol", 5 * COL, 2 * ROW, {
    name: "Carol",
    role: "PCP & Produção",
    level: "team",
    reportsTo: "Miller",
    responsibilities: ["Controle de produção", "Cronograma", "Estoque", "Fábrica"],
    kpis: ["Aderência ao plano", "OEE", "Acuracidade de estoque", "Refugo"],
  }),
  mk("rafael", 6 * COL, 2 * ROW, {
    name: "Rafael",
    role: "Compras",
    level: "team",
    reportsTo: "Miller",
    responsibilities: ["Compras", "Fornecedores", "Negociação"],
    kpis: ["Saving", "Lead time de compras", "OTD fornecedor"],
  }),
  mk("junior", 7 * COL, 2 * ROW, {
    name: "Júnior",
    role: "Logística",
    level: "team",
    reportsTo: "Miller",
    responsibilities: ["Logística", "Auxiliares operacionais", "Expedição"],
    kpis: ["OTIF", "Custo de frete / pedido", "Avarias"],
  }),
  mk("icaro", 6 * COL, 3 * ROW, {
    name: "Ícaro",
    role: "Financeiro",
    level: "team",
    reportsTo: "Miller",
    responsibilities: ["Financeiro", "Fluxo de caixa", "Contas"],
    kpis: ["Caixa", "DSO", "DPO", "Margem líquida"],
  }),
  mk("fernanda", 7 * COL, 3 * ROW, {
    name: "Fernanda",
    role: "Administrativo",
    level: "team",
    reportsTo: "Miller",
    responsibilities: ["Administrativo", "Rotinas internas", "Documentação"],
    kpis: ["SLA administrativo", "Conformidade documental"],
  }),

  // Internacional — Jack (matricial c/ Growth)
  mk("pimenta", 6 * COL, 4 * ROW, {
    name: "Pimenta Rosa Internacional",
    role: "Marca Global",
    level: "team",
    reportsTo: "Jack",
    responsibilities: ["Marca global", "GTM internacional"],
    kpis: ["Receita global", "Distribuição global", "Awareness"],
  }),
  mk("distrglobal", 7 * COL, 4 * ROW, {
    name: "Distribuição Global",
    role: "Operação Internacional",
    level: "team",
    reportsTo: "Jack",
    responsibilities: ["Distribuição global", "Logística internacional"],
    kpis: ["OTIF internacional", "Custo logístico", "Cobertura por país"],
  }),
  mk("paises", 8 * COL, 4 * ROW, {
    name: "Novos Países",
    role: "Expansão",
    level: "team",
    reportsTo: "Jack",
    responsibilities: ["Abertura de países", "Parceiros locais"],
    kpis: ["Países ativos", "Time-to-market", "Receita por país"],
  }),
];

const e = (source: string, target: string, dashed = false): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  type: "smoothstep",
  animated: dashed,
  style: dashed ? { strokeDasharray: "6 4", opacity: 0.7 } : undefined,
  label: dashed ? "matricial" : undefined,
});

export const initialEdges: Edge[] = [
  e("grax", "alan"),
  e("grax", "miller"),
  e("grax", "jack"),

  // Sob Alan
  e("alan", "fernando"),
  e("alan", "igor"),

  // Growth Full Funnel sob Fernando
  e("fernando", "luis"),
  e("fernando", "anajulia"),
  e("fernando", "vanessa"),
  e("fernando", "ian"),
  e("anajulia", "designers"),
  e("anajulia", "lucia"),
  e("vanessa", "lauro"),
  e("vanessa", "breno"),

  // CRM / Retention sob Ian
  e("ian", "crm"),
  e("ian", "retencao"),
  e("ian", "julian"),

  // Comercial B2B sob Igor
  e("igor", "otavio"),
  e("igor", "distrib"),

  // Operações sob Miller
  e("miller", "carol"),
  e("miller", "rafael"),
  e("miller", "junior"),
  e("miller", "icaro"),
  e("miller", "fernanda"),

  // Internacional sob Jack
  e("jack", "pimenta"),
  e("jack", "distrglobal"),
  e("jack", "paises"),

  // Matricial: Jack <-> Fernando (Growth executa internacional)
  e("jack", "fernando", true),
];
