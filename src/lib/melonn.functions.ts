import { createServerFn } from "@tanstack/react-start";

/**
 * Integração com a API REST da Melonn (Orbita).
 *
 * Base URL: https://api.orbita.melonn.com
 * Auth: header `x-api-key: <MELONN_API_KEY>`
 * Rate limit: 1 req/s — throttle global de 1100ms.
 *
 * Endpoints:
 *   - GET /sell-orders?page=0&per_page=100&initial_creation_date=<ISO>
 *   - GET /stock?warehouse_code=<code>
 *   - GET /courier-companies?warehouse_code=<code>
 */

export type MelonnOrderStatus =
  | "picking"        // 1,2,9,10,12,26
  | "processing"     // 3,4,22,25,27,28
  | "ready"          // 5,24
  | "in_transit"     // 6,7,19
  | "delivered"      // 8
  | "cancelled"      // 15,17,18
  | "on_hold";       // 13,20,21,29,30,31

const STATUS_CODE_MAP: Record<number, MelonnOrderStatus> = {
  1: "picking", 2: "picking", 9: "picking", 10: "picking", 12: "picking", 26: "picking",
  3: "processing", 4: "processing", 22: "processing", 25: "processing", 27: "processing", 28: "processing",
  5: "ready", 24: "ready",
  6: "in_transit", 7: "in_transit", 19: "in_transit",
  8: "delivered",
  15: "cancelled", 17: "cancelled", 18: "cancelled",
  13: "on_hold", 20: "on_hold", 21: "on_hold", 29: "on_hold", 30: "on_hold", 31: "on_hold",
};

const STATUS_LABELS: Record<MelonnOrderStatus, string> = {
  picking: "Em separação",
  processing: "Em processamento",
  ready: "Pronto para envio",
  in_transit: "Em trânsito",
  delivered: "Entregue",
  cancelled: "Cancelado",
  on_hold: "Em espera",
};

export const MELONN_STATUSES: MelonnOrderStatus[] = [
  "picking", "processing", "ready", "in_transit", "delivered", "on_hold", "cancelled",
];

export function melonnStatusLabel(s: MelonnOrderStatus) {
  return STATUS_LABELS[s] ?? s;
}

export const MELONN_WAREHOUSES = [
  { code: "BAQ-1", name: "Barranquilla" },
  { code: "BOG-2", name: "Bogotá" },
  { code: "CAL-2", name: "Cali" },
  { code: "MED-2", name: "Medellín Sabaneta" },
  { code: "MED-3", name: "Medellín Itagüi" },
  { code: "SAS-1", name: "SAS FP MED" },
  { code: "SAS-2", name: "SAS Armatura" },
] as const;

export interface MelonnOrderItem {
  sku: string | null;
  product: string;
  quantity: number;
}

export interface MelonnOrder {
  id: string;
  number: string;
  internal_number: string | null;
  customer: string;
  status: MelonnOrderStatus;
  status_code: number | null;
  status_name: string | null;
  carrier: string | null;
  carrier_code: string | null;
  warehouse: string | null;
  warehouse_code: string | null;
  creation_date: string | null;
  delivered_at: string | null;
  last_status_update: string | null;
  is_b2b: boolean;
  tracking_link: string | null;
  destination_city: string | null;
  items: MelonnOrderItem[];
  item_count: number;
}

export interface MelonnInventoryItem {
  product: string;
  variant: string | null;
  sku: string;
  internal_code: string | null;
  available: number;
  in_transit: number;
  allocated: number;
  reserved: number;
  expected: number;
  total: number;
  warehouse: string;
}


export interface MelonnCourier {
  code: string;
  name: string;
  warehouse: string;
}

export interface MelonnConfig {
  baseUrl: string;
  ordersPath: string;
  inventoryPath: string;
  couriersPath: string;
  warehouseCodes: string[];
}

const DEFAULTS: MelonnConfig = {
  baseUrl: "https://api.orbita.melonn.com",
  ordersPath: "/sell-orders",
  inventoryPath: "/stock",
  couriersPath: "/courier-companies",
  warehouseCodes: ["MED-2", "MED-3", "BOG-2", "BAQ-1", "CAL-2"],
};

// Old default sets that should be auto-upgraded to the new 5-warehouse default.
const LEGACY_WAREHOUSE_DEFAULTS: string[][] = [
  ["MED-3", "BOG-2"],
  ["BOG-2", "MED-3"],
];

const LEGACY_PATHS = new Set([
  "/orders", "/orders?limit=200", "/inventory", "/metrics/operational",
  "/sell-orders?limit=200", "/seller-products",
]);

async function loadConfig(): Promise<MelonnConfig> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const envBase = process.env.MELONN_API_BASE_URL?.replace(/\/$/, "");
  const fallback: MelonnConfig = { ...DEFAULTS, baseUrl: envBase || DEFAULTS.baseUrl };
  try {
    const { data } = await supabaseAdmin
      .from("soma_kv").select("value").eq("key", "melonn_config").maybeSingle();
    const v: any = data?.value ?? {};
    let baseUrl = (v.baseUrl || fallback.baseUrl).replace(/\/$/, "");
    if (/api\.melonn\.com/i.test(baseUrl)) baseUrl = DEFAULTS.baseUrl;
    const ordersPath = LEGACY_PATHS.has(v.ordersPath) ? DEFAULTS.ordersPath : v.ordersPath || fallback.ordersPath;
    const inventoryPath = LEGACY_PATHS.has(v.inventoryPath) ? DEFAULTS.inventoryPath : v.inventoryPath || fallback.inventoryPath;
    const couriersPath = LEGACY_PATHS.has(v.couriersPath) ? DEFAULTS.couriersPath : v.couriersPath || fallback.couriersPath;
    let warehouseCodes = Array.isArray(v.warehouseCodes) && v.warehouseCodes.length ? v.warehouseCodes : fallback.warehouseCodes;
    // Migrate stale 2-warehouse default to the new 5-warehouse default.
    if (LEGACY_WAREHOUSE_DEFAULTS.some((d) => d.length === warehouseCodes.length && d.every((c) => warehouseCodes.includes(c)))) {
      warehouseCodes = fallback.warehouseCodes;
    }
    return { baseUrl, ordersPath, inventoryPath, couriersPath, warehouseCodes };
  } catch {
    return fallback;
  }
}

// ---------- Rate limit (1 req/s) ----------
let lastCallAt = 0;
const MIN_INTERVAL_MS = 1100;
async function rateLimit() {
  const now = Date.now();
  const wait = lastCallAt + MIN_INTERVAL_MS - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

async function melonnFetch(
  path: string,
  cfg: MelonnConfig,
): Promise<{ ok: true; data: any; status: number } | { ok: false; error: string; status?: number }> {
  const rawKey = process.env.MELONN_API_KEY;
  if (!rawKey) return { ok: false, error: "MELONN_API_KEY não configurada" };
  const apiKey = rawKey.trim().replace(/^Bearer\s+/i, "").trim();
  const url = `${cfg.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    await rateLimit();
    try {
      const res = await fetch(url, {
        headers: { "x-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      });
      const text = await res.text().catch(() => "");
      if (res.status === 429 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      if (!res.ok) return { ok: false, status: res.status, error: `Melonn ${res.status}: ${text.slice(0, 200)}` };
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { /* */ }
      return { ok: true, data, status: res.status };
    } catch (e: any) {
      if (attempt === 0) continue;
      return { ok: false, error: e?.message ?? "Falha ao conectar com Melonn" };
    }
  }
  return { ok: false, error: "Falha ao conectar com Melonn" };
}


function mapStatusFromCode(code: number | null | undefined, name?: string): MelonnOrderStatus {
  if (typeof code === "number" && STATUS_CODE_MAP[code]) return STATUS_CODE_MAP[code];
  const s = String(name || "").toUpperCase();
  if (s.includes("PICK") || s.includes("PACK")) return "picking";
  if (s.includes("PROCESS")) return "processing";
  if (s.includes("READY") || s.includes("LISTO")) return "ready";
  if (s.includes("TRANSIT") || s.includes("SHIP")) return "in_transit";
  if (s.includes("DELIVER") || s.includes("ENTREG")) return "delivered";
  if (s.includes("CANCEL")) return "cancelled";
  if (s.includes("HOLD") || s.includes("ESPERA")) return "on_hold";
  return "processing";
}

function buildOrdersPath(basePath: string, opts: { daysBack?: number | null; page?: number; perPage?: number } = {}): string {
  const { daysBack = 365, page = 0, perPage = 100 } = opts;
  const sep = basePath.includes("?") ? "&" : "?";
  let path = `${basePath}${sep}page=${page}&per_page=${perPage}`;
  if (daysBack != null) {
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    path += `&initial_creation_date=${since}`;
  }
  return path;
}


function mapRawOrder(o: any, idx: number): MelonnOrder {
  const state = o.sell_order_state ?? {};
  const code = typeof state.code === "number" ? state.code : Number(state.code) || null;
  const cust = o.customer ?? o.buyer ?? o.recipient ?? {};
  const customer = cust.name ?? cust.full_name ?? [cust.first_name, cust.last_name].filter(Boolean).join(" ").trim() ?? o.customer_name ?? "—";
  const status = mapStatusFromCode(code, state.name);
  const delivered_at =
    status === "delivered"
      ? o.delivery_date ?? o.delivered_at ?? o.shipping?.delivered_at ?? o.last_state_update ?? null
      : null;
  const rawItems: any[] =
    (Array.isArray(o.sell_order_lines) && o.sell_order_lines) ||
    (Array.isArray(o.lines) && o.lines) ||
    (Array.isArray(o.items) && o.items) ||
    (Array.isArray(o.products) && o.products) ||
    [];
  const items: MelonnOrderItem[] = rawItems.map((li: any) => ({
    sku: li.sku ?? li.product_sku ?? li.product?.sku ?? null,
    product: String(
      li.product_name ?? li.product?.name ?? li.name ?? li.title ?? li.description ?? "—",
    ),
    quantity: Number(li.quantity ?? li.qty ?? li.units ?? 1) || 0,
  }));
  const item_count = items.reduce((s, x) => s + x.quantity, 0);
  return {
    id: String(o.id ?? idx),
    number: String(o.external_order_number ?? o.id ?? idx),
    internal_number: o.internal_order_number ?? null,
    customer: customer || "—",
    status,
    status_code: code,
    status_name: state.name ?? null,
    carrier: o.shipping_method?.name ?? o.courier_company?.name ?? null,
    carrier_code: o.shipping_method?.code ?? o.courier_company?.code ?? null,
    warehouse: o.warehouse?.name ?? null,
    warehouse_code: o.warehouse?.code ?? null,
    creation_date: o.creation_date ?? null,
    delivered_at,
    last_status_update: o.last_state_update ?? o.last_status_update ?? null,
    is_b2b: !!o.is_b2b,
    tracking_link: o.melonn_tracking_link ?? null,
    destination_city: o.shipping_address?.city ?? cust.city ?? null,
    items,
    item_count,
  };
}


function extractList(data: any, ...keys: string[]): any[] {
  if (Array.isArray(data)) return data;
  for (const k of keys) if (Array.isArray(data?.[k])) return data[k];
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export const getMelonnConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ config: MelonnConfig; defaults: MelonnConfig; hasApiKey: boolean; warehouses: typeof MELONN_WAREHOUSES }> => {
    const config = await loadConfig();
    return { config, defaults: DEFAULTS, hasApiKey: !!process.env.MELONN_API_KEY, warehouses: MELONN_WAREHOUSES };
  },
);

export const saveMelonnConfig = createServerFn({ method: "POST" })
  .inputValidator((d: Partial<MelonnConfig>) => d)
  .handler(async ({ data }): Promise<{ ok: true; config: MelonnConfig }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const current = await loadConfig();
    const merged: MelonnConfig = {
      baseUrl: (data.baseUrl ?? current.baseUrl).replace(/\/$/, ""),
      ordersPath: data.ordersPath ?? current.ordersPath,
      inventoryPath: data.inventoryPath ?? current.inventoryPath,
      couriersPath: data.couriersPath ?? current.couriersPath,
      warehouseCodes: data.warehouseCodes ?? current.warehouseCodes,
    };
    await supabaseAdmin.from("soma_kv").upsert({ key: "melonn_config", value: merged as any }, { onConflict: "key" });
    return { ok: true, config: merged };
  });

export const testMelonnEndpoint = createServerFn({ method: "POST" })
  .inputValidator((d: { endpoint: "orders" | "inventory" | "couriers" }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; status?: number; error?: string; sample?: string }> => {
    const cfg = await loadConfig();
    const wh = cfg.warehouseCodes[0] ?? "MED-3";
    const path =
      data.endpoint === "orders" ? buildOrdersPath(cfg.ordersPath)
      : data.endpoint === "inventory" ? `${cfg.inventoryPath}?warehouse_code=${wh}`
      : `${cfg.couriersPath}?warehouse_code=${wh}`;
    const res = await melonnFetch(path, cfg);
    if (!res.ok) return { ok: false, status: res.status, error: res.error };
    return { ok: true, status: res.status, sample: JSON.stringify(res.data).slice(0, 300) };
  });

export const getMelonnOrdersPage = createServerFn({ method: "POST" })
  .inputValidator((d: { page?: number; daysBack?: number | null; perPage?: number }) => d)
  .handler(async ({ data }): Promise<{
    orders: MelonnOrder[];
    page: number;
    per_page: number;
    total_count: number;
    has_more: boolean;
    fetched_at: string;
    error?: string;
  }> => {
    const cfg = await loadConfig();
    const page = data.page ?? 0;
    const perPage = data.perPage ?? 100;
    // Padrão: sem filtro de data (traz histórico completo). Passe daysBack=N para limitar.
    const daysBack = data.daysBack === undefined ? null : data.daysBack;
    const result = await melonnFetch(buildOrdersPath(cfg.ordersPath, { daysBack, page, perPage }), cfg);
    const fetched_at = new Date().toISOString();
    if (!result.ok) return { orders: [], page, per_page: perPage, total_count: 0, has_more: false, fetched_at, error: result.error };
    const raw = extractList(result.data, "sell_orders", "orders");
    const orders = raw.map((o, i) => mapRawOrder(o, page * perPage + i));
    const total_count = Number(
      result.data?.meta_data?.total_count ??
      result.data?.meta?.total_count ??
      result.data?.total_count ??
      result.data?.total ??
      orders.length,
    );
    if (page === 0) {
      console.log("[Melonn] /sell-orders page=0 → total_count:", total_count, "| data.length:", orders.length, "| daysBack:", daysBack);
    }
    // Critério de parada robusto: pára quando a página vier com menos itens que perPage.
    const has_more = orders.length >= perPage;
    return { orders, page, per_page: perPage, total_count, has_more, fetched_at };
  });


// --- Detalhe de um pedido (para extrair data real de entrega via eventos) ---
function extractDeliveredAt(detail: any): string | null {
  if (!detail) return null;
  // Campos diretos comuns
  const direct =
    detail.delivery_date ?? detail.delivered_at ?? detail.shipping?.delivered_at ?? null;
  if (direct) return String(direct);
  // Histórico de eventos (procura status code 8 = delivered ou nome contendo "deliver/entreg")
  const events: any[] =
    (Array.isArray(detail.sell_order_events) && detail.sell_order_events) ||
    (Array.isArray(detail.events) && detail.events) ||
    (Array.isArray(detail.state_history) && detail.state_history) ||
    (Array.isArray(detail.history) && detail.history) ||
    [];
  let best: string | null = null;
  for (const ev of events) {
    const code = ev.code ?? ev.state?.code ?? ev.sell_order_state?.code;
    const name = String(ev.name ?? ev.state?.name ?? ev.sell_order_state?.name ?? "").toUpperCase();
    const ts = ev.date ?? ev.created_at ?? ev.timestamp ?? ev.occurred_at ?? null;
    const isDelivered = Number(code) === 8 || name.includes("DELIVER") || name.includes("ENTREG");
    if (isDelivered && ts) best = String(ts);
  }
  return best ?? detail.last_state_update ?? null;
}

export const getMelonnOrderDelivery = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }): Promise<{ id: string; delivered_at: string | null; error?: string }> => {
    const cfg = await loadConfig();
    const result = await melonnFetch(`${cfg.ordersPath}/${encodeURIComponent(data.id)}`, cfg);
    if (!result.ok) return { id: data.id, delivered_at: null, error: result.error };
    const detail = result.data?.sell_order ?? result.data?.data ?? result.data;
    return { id: data.id, delivered_at: extractDeliveredAt(detail) };
  });



export const getMelonnOrders = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ orders: MelonnOrder[]; fetched_at: string; total_count?: number; error?: string }> => {
    const cfg = await loadConfig();
    const result = await melonnFetch(buildOrdersPath(cfg.ordersPath, { daysBack: 60 }), cfg);
    const fetched_at = new Date().toISOString();
    if (!result.ok) return { orders: [], fetched_at, error: result.error };
    const raw = extractList(result.data, "sell_orders", "orders");
    const orders = raw.map(mapRawOrder);
    const total_count = Number(result.data?.meta_data?.total_count ?? orders.length);
    return { orders, fetched_at, total_count };
  },
);


export const getMelonnInventory = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ items: MelonnInventoryItem[]; fetched_at: string; error?: string }> => {
    const cfg = await loadConfig();
    const codes = cfg.warehouseCodes.length ? cfg.warehouseCodes : DEFAULTS.warehouseCodes;
    const all: MelonnInventoryItem[] = [];
    const errors: string[] = [];
    for (const wh of codes) {
      const result = await melonnFetch(`${cfg.inventoryPath}?warehouse_code=${encodeURIComponent(wh)}`, cfg);
      if (!result.ok) { errors.push(`${wh}: ${result.error}`); continue; }
      const raw = extractList(result.data, "stock", "inventory", "products");
      for (const i of raw) {
        const available = Number(i.available_quantity ?? i.available ?? i.quantity_available ?? i.stock ?? 0);
        const reserved = Number(i.reserved_quantity ?? i.reserved ?? i.quantity_reserved ?? 0);
        const in_transit = Number(i.in_transit_quantity ?? i.in_transit ?? 0);
        const allocated = Number(i.allocated_quantity ?? i.allocated ?? 0);
        const expected = Number(i.expected_quantity ?? i.expected ?? 0);
        const total = Number(i.total_quantity ?? i.total ?? available + reserved + allocated);
        all.push({
          product: String(i.product_name ?? i.product?.name ?? i.name ?? i.title ?? "—"),
          variant: i.variant ?? i.variant_name ?? i.product_variant ?? null,
          sku: String(i.sku ?? i.product_sku ?? i.product?.sku ?? "—"),
          internal_code: i.internal_code ?? i.internal_sku ?? null,
          available, in_transit, allocated, reserved, expected, total, warehouse: wh,
        });
      }
    }
    return { items: all, fetched_at: new Date().toISOString(), error: errors.length ? errors.join(" · ") : undefined };
  },
);


export const getMelonnCouriers = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ couriers: MelonnCourier[]; fetched_at: string; error?: string }> => {
    const cfg = await loadConfig();
    const codes = cfg.warehouseCodes.length ? cfg.warehouseCodes : DEFAULTS.warehouseCodes;
    const all: MelonnCourier[] = [];
    const errors: string[] = [];
    for (const wh of codes) {
      const result = await melonnFetch(`${cfg.couriersPath}?warehouse_code=${encodeURIComponent(wh)}`, cfg);
      if (!result.ok) { errors.push(`${wh}: ${result.error}`); continue; }
      const raw = extractList(result.data, "couriers", "courier_companies", "shipping_methods");
      for (const c of raw) {
        all.push({
          code: String(c.code ?? c.id ?? "—"),
          name: String(c.name ?? c.label ?? "—"),
          warehouse: wh,
        });
      }
    }
    return { couriers: all, fetched_at: new Date().toISOString(), error: errors.length ? errors.join(" · ") : undefined };
  },
);
