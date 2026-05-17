import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

export interface SheetKpiRow {
  kpi_id: string;
  current?: number;
  previous?: number;
  target?: number;
  owner?: string;
}

const REQUIRED_COLUMNS = [
  "kpi_id",
  "label",
  "nucleo",
  "atual",
  "anterior",
  "meta",
  "unidade",
  "responsavel",
] as const;

function normalizeHeaderCell(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function findHeaderRow(values: string[][]) {
  const maxScanRows = Math.min(values.length, 10);
  for (let r = 0; r < maxScanRows; r++) {
    const header = (values[r] || []).map(normalizeHeaderCell);
    if (REQUIRED_COLUMNS.every((column) => header.includes(column))) {
      return { rowIndex: r, header };
    }
  }
  return null;
}

// Cache em memória para evitar 429 (quota: 60 reads/min por usuário)
const CACHE_TTL_MS = 60_000;
const sheetCache = new Map<string, { at: number; body: any }>();

async function fetchWithRetry(url: string, headers: Record<string, string>, attempts = 4) {
  let lastBody: any = null;
  let lastStatus = 0;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { headers });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { res, body };
    lastBody = body;
    lastStatus = res.status;
    if (res.status !== 429 && res.status < 500) {
      return { res, body };
    }
    // backoff exponencial: 800ms, 1.6s, 3.2s
    await new Promise((r) => setTimeout(r, 800 * Math.pow(2, i)));
  }
  return { res: { ok: false, status: lastStatus } as Response, body: lastBody };
}

export const fetchSheetKpis = createServerFn({ method: "POST" })
  .inputValidator((input: { spreadsheetId: string; range?: string }) => {
    if (!input?.spreadsheetId || typeof input.spreadsheetId !== "string") {
      throw new Error("spreadsheetId é obrigatório");
    }
    return { spreadsheetId: input.spreadsheetId, range: input.range || "KPIs!A1:H500" };
  })
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
    if (!GOOGLE_SHEETS_API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY não configurada");

    const cacheKey = `${data.spreadsheetId}::${data.range}`;
    const cached = sheetCache.get(cacheKey);
    const now = Date.now();
    const url = `${GATEWAY_URL}/spreadsheets/${data.spreadsheetId}/values/${data.range}`;

    let body: any;
    if (cached && now - cached.at < CACHE_TTL_MS) {
      body = cached.body;
    } else {
      const { res, body: respBody } = await fetchWithRetry(url, {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
      });
      if (!res.ok) {
        // se temos cache antigo, usa para não derrubar a UI
        if (cached) {
          body = cached.body;
        } else {
          const msg = respBody?.error?.message || JSON.stringify(respBody);
          if (res.status === 429) {
            throw new Error(
              `Limite de leituras do Google Sheets atingido (60/min). Aguarde ~1 minuto e tente novamente.`
            );
          }
          throw new Error(`Falha ao ler planilha [${res.status}]: ${msg}`);
        }
      } else {
        body = respBody;
        sheetCache.set(cacheKey, { at: now, body });
      }
    }

    const values: string[][] = body.values || [];
    if (values.length < 2) return { rows: [] as SheetKpiRow[], count: 0 };

    const headerMatch = findHeaderRow(values);
    if (!headerMatch) {
      throw new Error(
        "Cabeçalho inválido. A planilha precisa conter as colunas: kpi_id, label, nucleo, atual, anterior, meta, unidade, responsavel"
      );
    }

    const { rowIndex: headerRowIndex, header } = headerMatch;
    const idx = (name: string) => header.indexOf(name);
    const iId = idx("kpi_id");
    const iCur = idx("atual");
    const iPrev = idx("anterior");
    const iTgt = idx("meta");
    const iOwn = idx("responsavel");

    const num = (v?: string) => {
      if (v == null || v === "") return undefined;
      const cleaned = String(v)
        .trim()
        .replace(/R\$\s*/gi, "")
        .replace(/\s/g, "")
        .replace(/%/g, "")
        .replace(/\./g, "")
        .replace(/,/g, ".")
        .replace(/[()]/g, (token) => (token === "(" ? "-" : ""));
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : undefined;
    };

    const rows: SheetKpiRow[] = [];
    for (let r = headerRowIndex + 1; r < values.length; r++) {
      const row = values[r];
      const id = (row[iId] || "").trim();
      if (!id) continue;
      rows.push({
        kpi_id: id,
        current: iCur >= 0 ? num(row[iCur]) : undefined,
        previous: iPrev >= 0 ? num(row[iPrev]) : undefined,
        target: iTgt >= 0 ? num(row[iTgt]) : undefined,
        owner: iOwn >= 0 ? (row[iOwn] || "").trim() || undefined : undefined,
      });
    }
    return { rows, count: rows.length };
  });
