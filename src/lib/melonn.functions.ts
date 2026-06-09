import { createServerFn } from "@tanstack/react-start";

/**
 * Integração com a API REST da Melonn (Orbita).
 *
 * Base URL oficial: https://api.orbita.melonn.com
 * Autenticação: header `x-api-key: <MELONN_API_KEY>`
 * Rate limit: 1 req/s — usamos throttle global de 1100ms.
 *
 * Endpoints suportados:
 *   - /sell-orders?limit=200   → pedidos
 *   - /stock                   → inventário
 *   - /seller-products         → catálogo de produtos (usado p/ enriquecer nomes do stock)
 */

export type MelonnOrderStatus =
  | "picking"
  | "shipped"
  | "delivered"
  | "returned"
  | "cancelled";

export interface MelonnOrder {
  id: string;
  number: string;
  customer: string;
  status: MelonnOrderStatus;
  carrier: string | null;
  estimated_delivery: string | null;
  tracking_code: string | null;
}

export interface MelonnInventoryItem {
  product: string;
  sku: string;
  available: number;
  reserved: number;
  total: number;
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
  metricsPath: string; // mantido p/ compat — agora aponta p/ /seller-products
}

const STATUS_LABELS: Record<MelonnOrderStatus, string> = {
  picking: "Em separação",
  shipped: "Despachado / Em trânsito",
  delivered: "Entregue",
  returned: "Devolvido",
  cancelled: "Cancelado",
};

export const MELONN_STATUSES: MelonnOrderStatus[] = [
  "picking",
  "shipped",
  "delivered",
  "returned",
  "cancelled",
];

export function melonnStatusLabel(s: MelonnOrderStatus) {
  return STATUS_LABELS[s] ?? s;
}

const DEFAULTS: MelonnConfig = {
  baseUrl: "https://api.orbita.melonn.com",
  ordersPath: "/sell-orders?limit=200",
  inventoryPath: "/stock",
  metricsPath: "/seller-products",
};

// Paths antigos que devem ser migrados automaticamente p/ os defaults novos
const LEGACY_PATHS = new Set([
  "/orders",
  "/orders?limit=200",
  "/inventory",
  "/metrics/operational",
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
    const metricsPath = LEGACY_PATHS.has(v.metricsPath) ? DEFAULTS.metricsPath : v.metricsPath || fallback.metricsPath;

    return { baseUrl, ordersPath, inventoryPath, metricsPath };
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
      return {
        ok: false,
        status: res.status,
        error: `Melonn ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* não-JSON */ }
    return { ok: true, data, status: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Falha ao conectar com Melonn" };
  }
}

function mapStatus(raw: string): MelonnOrderStatus {
  const s = String(raw || "").toUpperCase();
  // Status oficiais Melonn: PENDING, PICKING, PACKED, SHIPPED, IN_TRANSIT, DELIVERED, RETURNED, CANCELLED
  if (s.includes("PICK") || s.includes("PACK") || s === "PENDING" || s.includes("PROCESS")) return "picking";
  if (s.includes("SHIP") || s.includes("TRANSIT") || s.includes("DESPACH")) return "shipped";
  if (s.includes("DELIVER") || s.includes("ENTREG")) return "delivered";
  if (s.includes("RETURN") || s.includes("DEVOLV")) return "returned";
  if (s.includes("CANCEL")) return "cancelled";
  return "picking";
}

export const getMelonnConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ config: MelonnConfig; defaults: MelonnConfig; hasApiKey: boolean }> => {
    const config = await loadConfig();
    return { config, defaults: DEFAULTS, hasApiKey: !!process.env.MELONN_API_KEY };
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
      metricsPath: data.metricsPath ?? current.metricsPath,
    };
    await supabaseAdmin
      .from("soma_kv")
      .upsert({ key: "melonn_config", value: merged as any }, { onConflict: "key" });
    return { ok: true, config: merged };
  });

export const testMelonnEndpoint = createServerFn({ method: "POST" })
  .inputValidator((d: { endpoint: "orders" | "inventory" | "metrics" }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; status?: number; error?: string; sample?: string }> => {
    const cfg = await loadConfig();
    const path =
      data.endpoint === "orders"
        ? cfg.ordersPath
        : data.endpoint === "inventory"
          ? cfg.inventoryPath
          : cfg.metricsPath;
    const res = await melonnFetch(path, cfg);
    if (!res.ok) return { ok: false, status: res.status, error: res.error };
    const sample = JSON.stringify(res.data).slice(0, 300);
    return { ok: true, status: res.status, sample };
  });

export const getMelonnOrders = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ orders: MelonnOrder[]; error?: string }> => {
    const cfg = await loadConfig();
    const result = await melonnFetch(cfg.ordersPath, cfg);
    if (!result.ok) return { orders: [], error: result.error };

    // /sell-orders pode retornar { data: [...] }, { items: [...] }, { sell_orders: [...] } ou array direto
    const raw: any[] = Array.isArray(result.data)
      ? result.data
      : result.data?.data ?? result.data?.items ?? result.data?.sell_orders ?? result.data?.orders ?? [];

    const orders: MelonnOrder[] = raw.map((o: any, idx: number) => {
      const customerObj = o.customer ?? o.buyer ?? o.recipient ?? {};
      const shipping = o.shipping ?? o.shipment ?? {};
      const customer =
        customerObj.name ??
        customerObj.full_name ??
        [customerObj.first_name, customerObj.last_name].filter(Boolean).join(" ").trim() ??
        o.customer_name ??
        "—";

      return {
        id: String(o.id ?? o.uuid ?? o.sell_order_id ?? o.order_id ?? idx),
        number: String(
          o.sell_order_number ?? o.order_number ?? o.number ?? o.reference ?? o.external_id ?? o.id ?? idx,
        ),
        customer: customer || "—",
        status: mapStatus(o.status ?? o.state ?? o.fulfillment_status ?? o.shipping_status),
        carrier:
          shipping.carrier_name ??
          shipping.carrier ??
          o.carrier?.name ??
          o.carrier ??
          o.shipping_carrier ??
          null,
        estimated_delivery:
          shipping.estimated_delivery_date ??
          shipping.eta ??
          o.estimated_delivery ??
          o.expected_delivery_date ??
          null,
        tracking_code:
          shipping.tracking_number ??
          shipping.tracking_code ??
          o.tracking_code ??
          o.tracking_number ??
          null,
      };
    });

    return { orders };
  },
);

export const getMelonnInventory = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ items: MelonnInventoryItem[]; error?: string }> => {
    const cfg = await loadConfig();
    const result = await melonnFetch(cfg.inventoryPath, cfg);
    if (!result.ok) return { items: [], error: result.error };

    // /stock pode retornar { data: [...] }, { stock: [...] }, { items: [...] } ou array direto
    const raw: any[] = Array.isArray(result.data)
      ? result.data
      : result.data?.data ?? result.data?.stock ?? result.data?.items ?? result.data?.inventory ?? [];

    const items: MelonnInventoryItem[] = raw.map((i: any) => {
      const available = Number(i.available ?? i.available_quantity ?? i.quantity_available ?? i.stock ?? 0);
      const reserved = Number(i.reserved ?? i.reserved_quantity ?? i.quantity_reserved ?? 0);
      const total = Number(i.total ?? i.total_quantity ?? i.quantity_total ?? available + reserved);
      return {
        product: String(i.product_name ?? i.product?.name ?? i.name ?? i.title ?? "—"),
        sku: String(i.sku ?? i.product_sku ?? i.product?.sku ?? "—"),
        available,
        reserved,
        total,
      };
    });

    return { items };
  },
);

/**
 * Métricas operacionais derivadas localmente dos pedidos.
 * O Melonn não expõe um endpoint dedicado de métricas;
 * calculamos taxa de devolução, SLA aproximado e contagens
 * a partir do retorno de /sell-orders.
 */
export const getMelonnMetrics = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ metrics: MelonnMetrics | null; error?: string }> => {
    const cfg = await loadConfig();
    const result = await melonnFetch(cfg.ordersPath, cfg);
    if (!result.ok) return { metrics: null, error: result.error };

    const raw: any[] = Array.isArray(result.data)
      ? result.data
      : result.data?.data ?? result.data?.items ?? result.data?.sell_orders ?? result.data?.orders ?? [];

    const total = raw.length || 0;
    let returned = 0;
    let onTime = 0;
    let delivered = 0;
    for (const o of raw) {
      const st = mapStatus(o.status ?? o.state ?? o.fulfillment_status ?? o.shipping_status);
      if (st === "returned") returned++;
      if (st === "delivered") {
        delivered++;
        const eta = o.shipping?.estimated_delivery_date ?? o.estimated_delivery;
        const delivered_at = o.delivered_at ?? o.shipping?.delivered_at;
        if (eta && delivered_at && new Date(delivered_at) <= new Date(eta)) onTime++;
      }
    }

    const metrics: MelonnMetrics = {
      delivery_sla_pct: delivered > 0 ? Math.round((onTime / delivered) * 100) : 0,
      avg_picking_minutes: 0,
      return_rate_pct: total > 0 ? Math.round((returned / total) * 1000) / 10 : 0,
      cost_per_order: 0,
    };
    return { metrics };
  },
);
