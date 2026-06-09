import { createServerFn } from "@tanstack/react-start";

const SPREADSHEET_ID = "1zfSJjuivQkNs0sU2lizJWmaOeBBzftIMwz0eF6WYhuc";
const SHEET_GID = 970696640;

export interface B2BRow {
  data: string;
  produto: string;
  sku: string;
  quantidade: number;
  valor_total: number;
  valor_venda_item: number;
  custo_unit: number;
  custo_total: number;
  ticket_medio_pago: number;
  frete: number;
  fulfillment: number;
  vendedor: string;
  cliente: string;
  telefone: string;
  cnpj: string;
  estado: string;
  cidade: string;
  endereco: string;
  midia_paga: number;
  imposto: number;
  ativacao: number;
  margem: number;
  margem_pct: number;
  lucro_liquido: number;
  cac: number;
}

export interface B2BSheetResult {
  rows: B2BRow[];
  fetchedAt: string;
  sheetTitle: string;
}

// ----------- Parsing helpers -----------
function parseNum(v: any): number {
  if (v == null || v === "") return 0;
  const s = String(v).trim()
    .replace(/R\$\s*/gi, "")
    .replace(/COP\s*/gi, "")
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/%/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(v: any): string {
  if (!v) return "";
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo}-${d}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

// CSV parser (handles quoted fields with commas and escaped quotes)
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === "\r") { /* skip */ }
      else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

// ----------- Server fn -----------
export const fetchB2BSheet = createServerFn({ method: "POST" })
  .handler(async (): Promise<B2BSheetResult> => {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      throw new Error(`Falha ao ler planilha (HTTP ${res.status}). Verifique se a planilha está com "Qualquer pessoa com o link" como Leitor.`);
    }
    const text = await res.text();
    // If Google returned an HTML login page, the sheet is not public
    if (text.trim().startsWith("<")) {
      throw new Error(`Planilha não é pública. Abra a planilha → Compartilhar → "Qualquer pessoa com o link" → Leitor.`);
    }

    const values = parseCSV(text);
    if (values.length < 2) {
      return { rows: [], fetchedAt: new Date().toISOString(), sheetTitle: "B2B" };
    }

    const rows: B2BRow[] = [];
    for (let i = 1; i < values.length; i++) {
      const r = values[i] || [];
      const dataRaw = r[0];
      const cliente = String(r[12] || "").trim();
      if (!dataRaw && !cliente) continue;

      const valor_total = parseNum(r[4]);
      const custo_total = parseNum(r[7]);
      const frete = parseNum(r[9]);
      const fulfillment = parseNum(r[10]);
      const imposto = parseNum(r[19]);
      const midia_paga = parseNum(r[18]);
      const ativacao = parseNum(r[20]);

      const margem = valor_total - custo_total - frete - fulfillment - imposto - midia_paga - ativacao;
      const margem_pct = valor_total > 0 ? (margem / valor_total) * 100 : 0;

      rows.push({
        data: parseDate(dataRaw),
        produto: String(r[1] || "").trim(),
        sku: String(r[2] || "").trim(),
        quantidade: parseNum(r[3]),
        valor_total,
        valor_venda_item: parseNum(r[5]),
        custo_unit: parseNum(r[6]),
        custo_total,
        ticket_medio_pago: parseNum(r[8]),
        frete,
        fulfillment,
        vendedor: String(r[11] || "").trim(),
        cliente,
        telefone: String(r[13] || "").trim(),
        cnpj: String(r[14] || "").trim(),
        estado: String(r[15] || "").trim(),
        cidade: String(r[16] || "").trim(),
        endereco: String(r[17] || "").trim(),
        midia_paga,
        imposto,
        ativacao,
        margem,
        margem_pct,
        lucro_liquido: margem,
        cac: midia_paga + ativacao,
      });
    }

    return { rows, fetchedAt: new Date().toISOString(), sheetTitle: "B2B" };
  });
