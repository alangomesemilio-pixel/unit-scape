import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

export interface SheetKpiRow {
  kpi_id: string;
  current?: number;
  previous?: number;
  target?: number;
  owner?: string;
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

    const url = `${GATEWAY_URL}/spreadsheets/${data.spreadsheetId}/values/${data.range}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
      },
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(
        `Falha ao ler planilha [${res.status}]: ${body?.error?.message || JSON.stringify(body)}`
      );
    }

    const values: string[][] = body.values || [];
    if (values.length < 2) return { rows: [] as SheetKpiRow[], count: 0 };

    const header = values[0].map((h) => h.trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name);
    const iId = idx("kpi_id");
    const iCur = idx("atual");
    const iPrev = idx("anterior");
    const iTgt = idx("meta");
    const iOwn = idx("responsavel");

    if (iId < 0) {
      throw new Error(
        "Cabeçalho inválido. A primeira linha precisa conter as colunas: kpi_id, label, nucleo, atual, anterior, meta, unidade, responsavel"
      );
    }

    const num = (v?: string) => {
      if (v == null || v === "") return undefined;
      const n = Number(String(v).replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) ? n : undefined;
    };

    const rows: SheetKpiRow[] = [];
    for (let r = 1; r < values.length; r++) {
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
