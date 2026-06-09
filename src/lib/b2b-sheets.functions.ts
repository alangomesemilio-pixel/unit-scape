import { createServerFn } from "@tanstack/react-start";

const SPREADSHEET_ID = "1zfSJjuivQkNs0sU2lizJWmaOeBBzftIMwz0eF6WYhuc";
const SHEET_GID = 970696640;

export interface B2BRow {
  data: string;            // ISO date
  produto: string;
  sku: string;
  quantidade: number;
  valor_total: number;     // E
  valor_venda_item: number;// F
  custo_unit: number;      // G
  custo_total: number;     // H
  ticket_medio_pago: number;// I
  frete: number;           // J
  fulfillment: number;     // K
  vendedor: string;        // L
  cliente: string;         // M
  telefone: string;        // N
  cnpj: string;            // O
  estado: string;          // P
  cidade: string;          // Q
  endereco: string;        // R
  midia_paga: number;      // S
  imposto: number;         // T
  ativacao: number;        // U
  // derived
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

// ----------- JWT signing via WebCrypto (Worker compatible) -----------

function base64UrlEncode(input: ArrayBuffer | string): string {
  let str: string;
  if (typeof input === "string") {
    str = btoa(unescape(encodeURIComponent(input)));
  } else {
    const bytes = new Uint8Array(input);
    let bin = "";
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    str = btoa(bin);
  }
  return str.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(cleaned);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

async function getGoogleAccessToken(scopes: string[]): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurada nas variáveis de ambiente");
  let creds: { client_email: string; private_key: string; token_uri?: string };
  try {
    creds = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON inválido (JSON malformado)");
  }
  if (!creds.client_email || !creds.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON faltando client_email ou private_key");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: creds.client_email,
    scope: scopes.join(" "),
    aud: creds.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claim))}`;

  const pkBuffer = pemToArrayBuffer(creds.private_key.replace(/\\n/g, "\n"));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pkBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${base64UrlEncode(sigBuf)}`;

  const tokenRes = await fetch(claim.aud, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });
  const tokenBody = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenBody.access_token) {
    throw new Error(`Falha ao obter token Google: ${tokenBody.error_description || tokenBody.error || tokenRes.status}`);
  }
  return tokenBody.access_token as string;
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
    .replace(/\.(?=\d{3}(\D|$))/g, "") // thousand sep
    .replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(v: any): string {
  if (!v) return "";
  const s = String(v).trim();
  // DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo}-${d}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

// ----------- Server fn -----------

export const fetchB2BSheet = createServerFn({ method: "POST" })
  .handler(async (): Promise<B2BSheetResult> => {
    const token = await getGoogleAccessToken([
      "https://www.googleapis.com/auth/spreadsheets.readonly",
    ]);

    // 1) Get sheet metadata to map gid -> title
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const meta = await metaRes.json();
    if (!metaRes.ok) {
      throw new Error(`Erro ao ler metadata da planilha: ${meta?.error?.message || metaRes.status}`);
    }
    const sheet = (meta.sheets || []).find((s: any) => s.properties?.sheetId === SHEET_GID);
    if (!sheet) throw new Error(`Aba com gid=${SHEET_GID} não encontrada`);
    const title: string = sheet.properties.title;

    // 2) Fetch values A:U
    const range = `${title}!A:U`;
    const valRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const val = await valRes.json();
    if (!valRes.ok) {
      throw new Error(`Erro ao ler valores: ${val?.error?.message || valRes.status}`);
    }
    const values: any[][] = val.values || [];
    if (values.length < 2) {
      return { rows: [], fetchedAt: new Date().toISOString(), sheetTitle: title };
    }

    // Skip header row (row 0). Map remaining rows.
    const rows: B2BRow[] = [];
    for (let i = 1; i < values.length; i++) {
      const r = values[i] || [];
      const dataRaw = r[0];
      const cliente = String(r[12] || "").trim();
      // skip empty rows
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

    return { rows, fetchedAt: new Date().toISOString(), sheetTitle: title };
  });
