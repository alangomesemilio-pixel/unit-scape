import { createServerFn } from "@tanstack/react-start";

/**
 * Integração com a API REST da Melonn (Orbita).
 *
 * Base URL: https://api.orbita.melonn.com
 * Auth: header `x-api-key: <MELONN_API_KEY>`
 * Rate limit: 1 req/s — throttle global de 1100ms.
 *
 * Endpoints:
 *   - GET /sell-orders?page=0&per_page=50&initial_creation_date=<ISO>
 *   - GET /stock?warehouse_code=<code>
 *   - GET /courier-companies?warehouse_code=<code>
 */

export type MelonnOrderStatus =
  | "picking"        // 1,2,9,10,12
  | "processing"     // 3,4,22,25,27,28
  | "ready"          // 5,24,26
  | "in_transit"     // 6,7,19
  | "delivered"      // 8
  | "cancelled"      // 15,17,18
  | "on_hold";       // 13,20,21

const STATUS_CODE_MAP: Record<number, MelonnOrderStatus> = {
  1: "picking", 2: "picking", 9: "picking", 10: "picking", 12: "picking",
  3: "processing", 4: "processing", 22: "processing", 25: "processing", 27: "processing", 28: "processing",
  5: "ready", 24: "ready", 26: "ready",
  6: "in_transit", 7: "in_transit", 19: "in_transit",
  8: "delivered",
  15: "cancelled", 17: "cancelled", 18: "cancelled",
  13: "on_hold", 20: "on_hold", 21: "on_hold",
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

export interface MelonnOrder {
  id: string;
  number: string;              // external_order_number
  internal_number: string | null; // internal_order_number (tracking Melonn)
  customer: string;
  status: MelonnOrderStatus;
  status_code: number | null;
  status_name: string | null;
  carrier: string | null;
  warehouse: string | null;
  creation_date: string | null;
  is_b2b: boolean;
  tracking_link: string | null;
}

export interface MelonnInventoryItem {
  product: string;
  sku: string;
  available: number;
  reserved: number;
  total: number;
  warehouse: string;
}

export interface MelonnMetrics {
  delivery_sla_pct: number;
  avg_picking_minutes: number;
  return_rate_pct: number;
  cost_per_order: number;
}

export interface MelonnConfig {
  baseUrl: string;
  ordersPath: string;
  inventoryPath: string;
  couriersPath: string;
  warehouseCodes: string[]; // bodegas ativas
}

const DEFAULTS: MelonnConfig = {
  baseUrl: "https://api.orbita.melonn.com",
  ordersPath: "/sell-orders",
  inventoryPath: "/stock",
  couriersPath: "/courier-companies",
  warehouseCodes: ["MED-3", "BOG-2"],
};

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
      .from("soma_kv")
      .select("value")
      .eq("key", "melonn_config")
      .maybeSingle();
    const v: any = data?.value ?? {};
    let baseUrl = (v.baseUrl || fallback.baseUrl).replace(/\/$/, "");
    if (/api\.melonn\.com/i.test(baseUrl)) baseUrl = DEFAULTS.baseUrl;

    const ordersPath = LEGACY_PATHS.has(v.ordersPath) ? DEFAULTS.ordersPath : v.ordersPath || fallback.ordersPath;
    const inventoryPath = LEGACY_PATHS.has(v.inventoryPath) ? DEFAULTS.inventoryPath : v.inventoryPath || fallback.inventoryPath;
    const couriersPath = LEGACY_PATHS.has(v.couriersPath) ? DEFAULTS.couriersPath : v.couriersPath || fallback.couriersPath;
    const warehouseCodes = Array.isArray(v.warehouseCodes) && v.warehouseCodes.length
      ? v.warehouseCodes
      : fallback.warehouseCodes;

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

  await rateLimit();
  try {
    const res = await fetch(url, {
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      return { ok: false, status: res.status, error: `Melonn ${res.status}: ${text.slice(0, 200)}` };
    }
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* */ }
    return { ok: true, data, status: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Falha ao conectar com Melonn" };
  }
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

function buildOrdersPath(basePath: string): string {
  // initial_creation_date = 30 dias atrás em ISO 8601
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sep = basePath.includes("?") ? "&" : "?";
  return `${basePath}${sep}page=0&per_page=50&initial_creation_date=${since}`;
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
    await supabaseAdmin
      .from("soma_kv")
      .upsert({ key: "melonn_config", value: merged as any }, { onConflict: "key" });
    return { ok: true, config: merged };
  });

export const testMelonnEndpoint = createServerFn({ method: "POST" })
  .inputValidator((d: { endpoint: "orders" | "inventory" | "couriers" }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; status?: number; error?: string; sample?: string }> => {
    const cfg = await loadConfig();
    const wh = cfg.warehouseCodes[0] ?? "MED-3";
    const path =
      data.endpoint === "orders"
        ? buildOrdersPath(cfg.ordersPath)
        : data.endpoint === "inventory"
          ? `${cfg.inventoryPath}?warehouse_code=${wh}`
          : `${cfg.couriersPath}?warehouse_code=${wh}`;
    const res = await melonnFetch(path, cfg);
    if (!res.ok) return { ok: false, status: res.status, error: res.error };
    const sample = JSON.stringify(res.data).slice(0, 300);
    return { ok: true, status: res.status, sample };
  });

function extractList(data: any, ...keys: string[]): any[] {
  if (Array.isArray(data)) return data;
  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export const getMelonnOrders = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ orders: MelonnOrder[]; error?: string }> => {
    const cfg = await loadConfig();
    const result = await melonnFetch(buildOrdersPath(cfg.ordersPath), cfg);
    if (!result.ok) return { orders: [], error: result.error };

    const raw = extractList(result.data, "sell_orders", "orders");
    const orders: MelonnOrder[] = raw.map((o: any, idx: number) => {
      const state = o.sell_order_state ?? {};
      const code = typeof state.code === "number" ? state.code : Number(state.code) || null;
      const customerObj = o.customer ?? o.buyer ?? o.recipient ?? {};
      const customer =
        customerObj.name ??
        customerObj.full_name ??
        [customerObj.first_name, customerObj.last_name].filter(Boolean).join(" ").trim() ??
        o.customer_name ??
        "—";
      return {
        id: String(o.id ?? idx),
        number: String(o.external_order_number ?? o.id ?? idx),
        internal_number: o.internal_order_number ?? null,
        customer: customer || "—",
        status: mapStatusFromCode(code, state.name),
        status_code: code,
        status_name: state.name ?? null,
        carrier: o.shipping_method?.name ?? null,
        warehouse: o.warehouse?.name ?? o.warehouse?.code ?? null,
        creation_date: o.creation_date ?? null,
        is_b2b: !!o.is_b2b,
        tracking_link: o.melonn_tracking_link ?? null,
      };
    });

    return { orders };
  },
);

export const getMelonnInventory = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ items: MelonnInventoryItem[]; error?: string }> => {
    const cfg = await loadConfig();
    const codes = cfg.warehouseCodes.length ? cfg.warehouseCodes : DEFAULTS.warehouseCodes;
    const all: MelonnInventoryItem[] = [];
    const errors: string[] = [];

    for (const wh of codes) {
      const result = await melonnFetch(`${cfg.inventoryPath}?warehouse_code=${encodeURIComponent(wh)}`, cfg);
      if (!result.ok) { errors.push(`${wh}: ${result.error}`); continue; }
      const raw = extractList(result.data, "stock", "inventory");
      for (const i of raw) {
        const available = Number(i.available ?? i.available_quantity ?? i.quantity_available ?? i.stock ?? 0);
        const reserved = Number(i.reserved ?? i.reserved_quantity ?? i.quantity_reserved ?? 0);
        const total = Number(i.total ?? i.total_quantity ?? i.quantity_total ?? available + reserved);
        all.push({
          product: String(i.product_name ?? i.product?.name ?? i.name ?? i.title ?? "—"),
          sku: String(i.sku ?? i.product_sku ?? i.product?.sku ?? "—"),
          available, reserved, total,
          warehouse: wh,
        });
      }
    }

    return { items: all, error: errors.length ? errors.join(" · ") : undefined };
  },
);

/**
 * Métricas derivadas dos pedidos (Melonn não expõe endpoint dedicado).
 */
export const getMelonnMetrics = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ metrics: MelonnMetrics | null; error?: string }> => {
    const cfg = await loadConfig();
    const result = await melonnFetch(buildOrdersPath(cfg.ordersPath), cfg);
    if (!result.ok) return { metrics: null, error: result.error };

    const raw = extractList(result.data, "sell_orders", "orders");
    const total = raw.length;
    let returned = 0, delivered = 0;
    for (const o of raw) {
      const code = Number(o.sell_order_state?.code) || null;
      const st = mapStatusFromCode(code, o.sell_order_state?.name);
      if (st === "delivered") delivered++;
      // Códigos de devolução não estão no mapping; usa nome
      if (/RETURN|DEVOL/i.test(o.sell_order_state?.name ?? "")) returned++;
    }

    const metrics: MelonnMetrics = {
      delivery_sla_pct: total > 0 ? Math.round((delivered / total) * 1000) / 10 : 0,
      avg_picking_minutes: 0,
      return_rate_pct: total > 0 ? Math.round((returned / total) * 1000) / 10 : 0,
      cost_per_order: 0,
    };
    return { metrics };
  },
);
