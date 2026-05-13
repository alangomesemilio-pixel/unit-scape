import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";
const SPREADSHEET_ID = "1R_ntSmcytLJsEpeBEBGotSJWXO98WEL_iuedBg0GwS8";

export const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export interface DreRow {
  label: string;
  kind: "header" | "section" | "item" | "total";
  values: (number | null)[]; // 12 months
  total: number | null;
}

export interface ForecastDre {
  fetchedAt: string;
  realizado: DreRow[];
  projetado: DreRow[];
}

function parseBrNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s || s === "-" || s.startsWith("#")) return null;
  // Strip R$, %, spaces, and BR thousand separators
  const cleaned = s
    .replace(/R\$\s*/g, "")
    .replace(/\s/g, "")
    .replace(/%/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[()]/g, (m) => (m === "(" ? "-" : ""));
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function classify(label: string): DreRow["kind"] {
  const t = label.trim();
  if (!t) return "item";
  if (/^\(\+\)|^\(-\)/i.test(t)) return "section";
  if (/^\(=\)/i.test(t) || /lucro|margem/i.test(t)) return "total";
  return "item";
}

function parseSheet(values: string[][]): DreRow[] {
  // Layout: col C (idx 2) = label; months at cols D, F, H, J, L, N, P, R, T, V, X, Z
  const monthCols = [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25];
  const totalCol = 27;
  const rows: DreRow[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i] ?? [];
    const label = (row[2] ?? "").trim();
    if (!label) continue;
    const monthly = monthCols.map((c) => parseBrNumber(row[c]));
    const total = parseBrNumber(row[totalCol]);
    // Skip rows with no numbers at all
    if (!monthly.some((v) => v !== null) && total === null) continue;
    rows.push({ label, kind: classify(label), values: monthly, total });
  }
  return rows;
}

async function readRange(range: string): Promise<string[][]> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
  const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
  if (!GOOGLE_SHEETS_API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY não configurada");

  const url = `${GATEWAY_URL}/spreadsheets/${SPREADSHEET_ID}/values/${range}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
    },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      `Falha ao ler planilha [${res.status}]: ${body?.error?.message || JSON.stringify(body)}`,
    );
  }
  return (body.values || []) as string[][];
}

export const fetchForecastDre = createServerFn({ method: "GET" }).handler(async () => {
  const realizadoRange = encodeURIComponent("' Forec. Geral Realizado'!A1:AC185");
  const projetadoRange = encodeURIComponent("'Forec. Geral Projetado'!A1:AC185");
  const [realizadoVals, projetadoVals] = await Promise.all([
    readRange(realizadoRange),
    readRange(projetadoRange),
  ]);
  const out: ForecastDre = {
    fetchedAt: new Date().toISOString(),
    realizado: parseSheet(realizadoVals),
    projetado: parseSheet(projetadoVals),
  };
  return out;
});

export const analyzeForecastWithAi = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        summary: z.string().min(1).max(20000),
        question: z.string().min(1).max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const prompt = `Analise o forecast vs realizado da GRAx Group abaixo.
Responda em Markdown, conciso, com:
1. **Diagnóstico geral** (estamos acima/abaixo da projeção e por quanto)
2. **Top 3 desvios** (linha, mês, R$ e %)
3. **Mix de operações** — qual está puxando ou drenando o grupo
4. **Riscos** para os próximos meses
5. **Plano de ação** (3 a 5 bullets curtos e accountable)

${data.question ? `Pergunta específica do CEO: ${data.question}\n` : ""}
DADOS:
${data.summary}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content:
              "Você é a IA Executiva da GRAx Group. Analise DRE/forecast como um CFO sênior, em português, conciso e accountable.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429)
        throw new Error("Limite de requisições atingido. Tente novamente em alguns segundos.");
      if (res.status === 402)
        throw new Error("Créditos da Lovable AI esgotados.");
      throw new Error(`AI gateway error ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { reply: json.choices?.[0]?.message?.content ?? "(resposta vazia)" };
  });
