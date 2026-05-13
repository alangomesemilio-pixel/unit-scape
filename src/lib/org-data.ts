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

// Layout: columns spaced 280px, rows 220px
const COL = 280;
const ROW = 220;

export const initialNodes: Node<OrgNodeData>[] = [
  mk("grax", 4 * COL, 0 * ROW, {
    name: "GRAx Group",
    role: "Holding",
    level: "ceo",
    responsibilities: ["Visão", "Governança", "Direção estratégica"],
    kpis: ["Crescimento consolidado", "Valuation", "Margem global"],
  }),

  // Nível 1 — sócios
  mk("alan", 2 * COL, 1 * ROW, {
    name: "Alan",
    role: "CEO",
    area: "Estratégia & Growth",
    level: "ceo",
    responsibilities: [
      "Estratégia",
      "Growth",
      "Branding",
      "Expansão",
      "Cultura",
      "Direção da empresa",
      "Integração executiva",
    ],
    kpis: [
      "Crescimento de receita",
      "Market share",
      "NPS de cultura",
      "Valuation",
    ],
  }),
  mk("miller", 4 * COL, 1 * ROW, {
    name: "Miller",
    role: "COO",
    area: "Operações",
    level: "coo",
    responsibilities: [
      "Operações",
      "Supply chain",
      "PCP",
      "Compras",
      "Logística",
      "Financeiro",
      "Administrativo",
      "Eficiência operacional",
    ],
    kpis: [
      "OTIF",
      "Custo unitário",
      "Giro de estoque",
      "Margem operacional",
      "Lead time",
    ],
  }),
  mk("jack", 6 * COL, 1 * ROW, {
    name: "Jack",
    role: "Diretor Internacional",
    area: "Expansão Global",
    level: "intl",
    responsibilities: [
      "Expansão global",
      "Pimenta Rosa internacional",
      "Distribuição global",
      "Novos países",
      "Operação internacional",
    ],
    kpis: [
      "Receita internacional",
      "Países ativos",
      "Distribuidores ativos",
      "Sell-out global",
    ],
  }),

  // Nível 2 — heads sob Alan
  mk("igor", 1 * COL, 2 * ROW, {
    name: "Igor",
    role: "Diretor de Expansão",
    area: "Comercial",
    level: "head",
    reportsTo: "Alan",
    responsibilities: ["Expansão comercial", "Distribuidores", "Parceiros"],
    kpis: ["Receita comercial", "Novos contratos", "Sell-in", "Cobertura"],
  }),
  mk("fernando", 2 * COL, 2 * ROW, {
    name: "Fernando",
    role: "Head Growth & Branding",
    area: "Marketing / Branding",
    level: "head",
    reportsTo: "Alan",
    responsibilities: ["Performance", "Branding", "Conteúdo", "Influência"],
    kpis: ["CAC", "ROAS", "Brand lift", "Engajamento"],
  }),
  mk("ian", 3 * COL, 2 * ROW, {
    name: "Ian",
    role: "Head CRM & CX",
    area: "Retenção / Pós-venda",
    level: "head",
    reportsTo: "Alan",
    responsibilities: ["CRM", "Retenção", "Pós-venda", "Fidelização"],
    kpis: ["LTV", "Recompra", "Churn", "CSAT", "NPS"],
  }),

  // Nível 3 — Miller
  mk("carol", 4 * COL, 2 * ROW, {
    name: "Carol",
    role: "PCP & Produção",
    level: "team",
    reportsTo: "Miller",
    responsibilities: [
      "Controle de produção",
      "Cronograma",
      "Estoque",
      "Fábrica",
    ],
    kpis: ["Aderência ao plano", "OEE", "Acuracidade de estoque", "Refugo"],
  }),
  mk("rafael", 5 * COL, 2 * ROW, {
    name: "Rafael",
    role: "Compras",
    level: "team",
    reportsTo: "Miller",
    responsibilities: ["Compras", "Fornecedores", "Negociação"],
    kpis: ["Saving", "Lead time de compras", "OTD fornecedor"],
  }),
  mk("junior", 6 * COL, 2 * ROW, {
    name: "Júnior",
    role: "Logística",
    level: "team",
    reportsTo: "Miller",
    responsibilities: ["Logística", "Auxiliares operacionais", "Expedição"],
    kpis: ["OTIF", "Custo de frete / pedido", "Avarias"],
  }),
  mk("icaro", 5 * COL, 3 * ROW, {
    name: "Ícaro",
    role: "Financeiro",
    level: "team",
    reportsTo: "Miller",
    responsibilities: ["Financeiro", "Fluxo de caixa", "Contas"],
    kpis: ["Caixa", "DSO", "DPO", "Margem líquida"],
  }),
  mk("fernanda", 6 * COL, 3 * ROW, {
    name: "Fernanda",
    role: "Administrativo",
    level: "team",
    reportsTo: "Miller",
    responsibilities: ["Administrativo", "Rotinas internas", "Documentação"],
    kpis: ["SLA administrativo", "Conformidade documental"],
  }),

  // Growth núcleo
  mk("luis", 0 * COL, 3 * ROW, {
    name: "Luís",
    role: "Performance",
    area: "Tráfego Pago",
    level: "team",
    reportsTo: "Fernando",
    responsibilities: ["Tráfego pago", "Mídia", "Otimização"],
    kpis: ["ROAS", "CPA", "CTR", "Conversão"],
  }),
  mk("anajulia", 1 * COL, 3 * ROW, {
    name: "Ana Júlia",
    role: "Diretora Criativa",
    area: "Branding & Conteúdo",
    level: "team",
    reportsTo: "Fernando",
    responsibilities: ["Branding", "Direção criativa", "Conteúdo"],
    kpis: ["Brand lift", "Engajamento", "Output criativo"],
  }),
  mk("vanessa", 2 * COL, 3 * ROW, {
    name: "Vanessa",
    role: "Head Influencers",
    area: "Influência & Creators",
    level: "team",
    reportsTo: "Fernando",
    responsibilities: ["Influência", "Creators", "Parcerias"],
    kpis: ["Creators ativos", "EMV", "Conversão de influência"],
  }),
  mk("designers", 0 * COL, 4 * ROW, {
    name: "Designers & Copy",
    role: "Time Criativo",
    level: "team",
    reportsTo: "Ana Júlia",
    responsibilities: ["Design", "Copywriting", "Produção criativa"],
    kpis: ["Output criativo", "SLA de entregas", "Quality score"],
  }),
  mk("lucia", 1 * COL, 4 * ROW, {
    name: "Lúcia",
    role: "Community",
    level: "team",
    reportsTo: "Ana Júlia",
    responsibilities: ["Comunidade", "Redes sociais", "Engajamento"],
    kpis: ["Engajamento", "Crescimento de seguidores", "Tempo de resposta"],
  }),
  mk("lauro", 2 * COL, 4 * ROW, {
    name: "Lauro",
    role: "Captação de Creators",
    level: "team",
    reportsTo: "Vanessa",
    responsibilities: ["Captação de creators", "Onboarding"],
    kpis: ["Novos creators / mês", "Taxa de ativação"],
  }),
  mk("breno", 3 * COL, 4 * ROW, {
    name: "Breno",
    role: "UGC",
    level: "team",
    reportsTo: "Vanessa",
    responsibilities: ["UGC", "Produção de conteúdo de creators"],
    kpis: ["Volume de UGC", "Performance de UGC", "CPM UGC"],
  }),

  // Comercial — Igor
  mk("otavio", -1 * COL, 3 * ROW, {
    name: "Otávio",
    role: "Comercial",
    level: "team",
    reportsTo: "Igor",
    responsibilities: ["Vendas", "Atendimento B2B"],
    kpis: ["Receita", "Ticket médio", "Conversão", "Pipeline"],
  }),
  mk("distrib", -1 * COL, 4 * ROW, {
    name: "Distribuidores B2B",
    role: "Canal",
    level: "team",
    reportsTo: "Igor",
    responsibilities: ["Distribuição B2B", "Cobertura regional"],
    kpis: ["Sell-in", "Sell-out", "Cobertura de PDV"],
  }),
  mk("parceiros", 0 * COL, 5 * ROW, {
    name: "Parceiros / Canais",
    role: "Canal",
    level: "team",
    reportsTo: "Igor",
    responsibilities: ["Parcerias estratégicas", "Canais"],
    kpis: ["Receita de canais", "Novos parceiros"],
  }),

  // CRM — Ian
  mk("crm", 3 * COL, 3 * ROW, {
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

  // Internacional — Jack
  mk("pimenta", 5 * COL, 4 * ROW, {
    name: "Pimenta Rosa Internacional",
    role: "Marca Global",
    level: "team",
    reportsTo: "Jack",
    responsibilities: ["Marca global", "GTM internacional"],
    kpis: ["Receita global", "Distribuição global", "Awareness"],
  }),
  mk("distrglobal", 6 * COL, 4 * ROW, {
    name: "Distribuição Global",
    role: "Operação Internacional",
    level: "team",
    reportsTo: "Jack",
    responsibilities: ["Distribuição global", "Logística internacional"],
    kpis: ["OTIF internacional", "Custo logístico", "Cobertura por país"],
  }),
  mk("paises", 7 * COL, 4 * ROW, {
    name: "Novos Países",
    role: "Expansão",
    level: "team",
    reportsTo: "Jack",
    responsibilities: ["Abertura de países", "Parceiros locais"],
    kpis: ["Países ativos", "Time-to-market", "Receita por país"],
  }),
];

const e = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  type: "smoothstep",
  animated: false,
});

export const initialEdges: Edge[] = [
  e("grax", "alan"),
  e("grax", "miller"),
  e("grax", "jack"),

  e("alan", "igor"),
  e("alan", "fernando"),
  e("alan", "ian"),

  e("miller", "carol"),
  e("miller", "rafael"),
  e("miller", "junior"),
  e("miller", "icaro"),
  e("miller", "fernanda"),

  e("fernando", "luis"),
  e("fernando", "anajulia"),
  e("fernando", "vanessa"),
  e("anajulia", "designers"),
  e("anajulia", "lucia"),
  e("vanessa", "lauro"),
  e("vanessa", "breno"),

  e("igor", "otavio"),
  e("igor", "distrib"),
  e("igor", "parceiros"),

  e("ian", "crm"),
  e("ian", "retencao"),
  e("ian", "julian"),

  e("jack", "pimenta"),
  e("jack", "distrglobal"),
  e("jack", "paises"),
];
