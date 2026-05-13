import { defaultExecState, formatValue, statusOf, variation, type ExecState, EXEC_STORAGE_KEY } from "./executive-data";
import { initialNodes } from "./org-data";

function loadExecState(): ExecState {
  if (typeof window === "undefined") return defaultExecState;
  try {
    const raw = window.localStorage.getItem(EXEC_STORAGE_KEY);
    if (!raw) return defaultExecState;
    return { ...defaultExecState, ...JSON.parse(raw) };
  } catch {
    return defaultExecState;
  }
}

export function buildAiContext() {
  const state = loadExecState();

  const kpiLine = (k: { label: string; unit: string; target: number; current: number; previous: number; owner?: string; higherIsBetter?: boolean }) => {
    const v = variation(k.current, k.previous);
    const st = statusOf(k as Parameters<typeof statusOf>[0]);
    const dir = v > 0 ? "▲" : v < 0 ? "▼" : "→";
    return `- ${k.label}${k.owner ? ` (${k.owner})` : ""}: meta ${formatValue(k.target, k.unit)} | atual ${formatValue(k.current, k.unit)} | anterior ${formatValue(k.previous, k.unit)} | ${dir} ${v.toFixed(1)}% | status: ${st}`;
  };

  const cockpitLines: string[] = [];
  cockpitLines.push("**Indicadores Gerais:**");
  state.general.forEach((k) => cockpitLines.push(kpiLine(k)));

  state.cores.forEach((c) => {
    cockpitLines.push(`\n**Núcleo ${c.title}** (owner: ${c.owner}) — ${c.description}`);
    c.kpis.forEach((k) => cockpitLines.push(kpiLine(k)));
  });

  cockpitLines.push("\n**Receita por marca:**");
  state.brandRevenue.forEach((b) =>
    cockpitLines.push(`- ${b.name}: meta R$${b.target.toLocaleString("pt-BR")} | atual R$${b.current.toLocaleString("pt-BR")} | anterior R$${b.previous.toLocaleString("pt-BR")}`)
  );
  cockpitLines.push("\n**Receita por canal:**");
  state.channelRevenue.forEach((b) =>
    cockpitLines.push(`- ${b.name}: meta R$${b.target.toLocaleString("pt-BR")} | atual R$${b.current.toLocaleString("pt-BR")}`)
  );

  cockpitLines.push("\n**PDCA aberto:**");
  state.pdca.forEach((p) =>
    cockpitLines.push(`- [${p.status}] (${p.owner}, due ${p.due}) ${p.problem} → ${p.plan}${p.kpi ? ` [KPI: ${p.kpi}]` : ""}`)
  );

  cockpitLines.push("\n**Última reunião — vitórias:** " + state.meeting.victories.join("; "));
  cockpitLines.push("**Gargalos:** " + state.meeting.bottlenecks.join("; "));
  cockpitLines.push("**Prioridades:** " + state.meeting.priorities.join("; "));
  cockpitLines.push("**Decisões:** " + state.meeting.decisions.join("; "));

  // Load org from localStorage if user customized it, fallback to initial
  let orgNodes = initialNodes as typeof initialNodes;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("grax-org-v1");
      if (raw) {
        const parsed = JSON.parse(raw) as { nodes?: typeof initialNodes };
        if (parsed?.nodes && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
          orgNodes = parsed.nodes;
        }
      }
    } catch {
      // ignore
    }
  }
  const orgLines = orgNodes.map((n) => {
    const d = n.data;
    return `- ${d.name} — ${d.role}${d.area ? ` (${d.area})` : ""}${d.reportsTo ? ` | reporta a ${d.reportsTo}` : ""} | KPIs: ${d.kpis.join(", ")}`;
  });

  const meetings = [
    "Segunda — Reunião Geral + Cores (Alan): visão consolidada, prioridades da semana",
    "Terça — Growth (Fernando): performance, branding, creators",
    "Quarta — Operações (Miller): supply, PCP, logística, financeiro",
    "Quinta — Comercial (Igor): B2B, distribuidores, expansão",
    "Sexta — Geral / Fechamento (Alan): consolidação semanal e fechamento",
  ];

  return {
    cockpit: cockpitLines.join("\n"),
    org: orgLines.join("\n"),
    meetings: meetings.join("\n"),
  };
}
