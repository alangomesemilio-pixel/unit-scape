import { createServerFn } from "@tanstack/react-start";

/**
 * Integração com a API REST da Melonn.
 *
 * Configuração dinâmica via tabela `soma_kv` (key = "melonn_config"):
 *   { baseUrl, ordersPath, inventoryPath, metricsPath }
 *
 * Fallbacks:
 *   - baseUrl       = MELONN_API_BASE_URL ou https://api.melonn.com/v1
 *   - ordersPath    = /orders?limit=200
 *   - inventoryPath = /inventory
 *   - metricsPath   = /metrics/operational
 *
 * Autenticação: header `Authorization: Bearer <MELONN_API_KEY>`.
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
  metricsPath: string;
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
  baseUrl: "https://api.melonn.com/v1",
  ordersPath: "/orders?limit=200",
  inventoryPath: "/inventory",
  metricsPath: "/metrics/operational",
};

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
    return {
      baseUrl: (v.baseUrl || fallback.baseUrl).replace(/\/$/, ""),
      ordersPath: v.ordersPath || fallback.ordersPath,
      inventoryPath: v.inventoryPath || fallback.inventoryPath,
      metricsPath: v.metricsPath || fallback.metricsPath,
    };
  } catch {
    return fallback;
  }
}

async function melonnFetch(
  path: string,
  cfg: MelonnConfig,
): Promise<{ ok: true; data: any; status: number } | { ok: false; error: string; status?: number }> {
  const rawKey = process.env.MELONN_API_KEY;
  if (!rawKey) return { ok: false, error: "MELONN_API_KEY não configurada" };
  // Sanitiza: remove espaços, quebras de linha e prefixo "Bearer " duplicado
  const apiKey = rawKey.trim().replace(/^Bearer\s+/i, "").trim();
  const url = `${cfg.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const attempt = async (headers: Record<string, string>) => {
    const res = await fetch(url, { headers });
    const text = await res.text().catch(() => "");
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* não-JSON */ }
    return { res, text, data };
  };

  try {
    // 1) Formato padrão: Bearer token
    const a = await attempt({
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    });
    if (a.res.ok) return { ok: true, data: a.data, status: a.res.status };

    // 2) Fallback: x-api-key (algumas instâncias Melonn usam API Gateway com API Key)
    if (a.res.status === 401 || a.res.status === 403) {
      const b = await attempt({
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      });
      if (b.res.ok) return { ok: true, data: b.data, status: b.res.status };
      return {
        ok: false,
        status: b.res.status,
        error: `Melonn ${b.res.status} (Bearer e x-api-key falharam): ${b.text.slice(0, 200)}`,
      };
    }

    return {
      ok: false,
      status: a.res.status,
      error: `Melonn ${a.res.status}: ${a.text.slice(0, 200)}`,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Falha ao conectar com Melonn" };
  }
}

function mapStatus(raw: string): MelonnOrderStatus {
  const s = String(raw || "").toLowerCase();
  if (s.includes("pick") || s.includes("separ") || s.includes("processing")) return "picking";
  if (s.includes("ship") || s.includes("transit") || s.includes("despach") || s.includes("trans")) return "shipped";
  if (s.includes("deliver") || s.includes("entreg")) return "delivered";
  if (s.includes("return") || s.includes("devolv")) return "returned";
  if (s.includes("cancel")) return "cancelled";
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
    if (!res.ok) return { ok: false, error: res.error };
    const sample = JSON.stringify(res.data).slice(0, 300);
    return { ok: true, sample };
  });

export const getMelonnOrders = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ orders: MelonnOrder[]; error?: string }> => {
    const cfg = await loadConfig();
    const result = await melonnFetch(cfg.ordersPath, cfg);
    if (!result.ok) return { orders: [], error: result.error };

    const raw: any[] = Array.isArray(result.data)
      ? result.data
      : result.data?.orders ?? result.data?.data ?? [];

    const orders: MelonnOrder[] = raw.map((o: any, idx: number) => ({
      id: String(o.id ?? o.uuid ?? o.order_id ?? idx),
      number: String(o.number ?? o.order_number ?? o.reference ?? o.id ?? idx),
      customer:
        o.customer?.name ??
        o.customer_name ??
        [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" ") ??
        "—",
      status: mapStatus(o.status ?? o.state ?? o.fulfillment_status),
      carrier: o.carrier?.name ?? o.carrier ?? o.shipping?.carrier ?? null,
      estimated_delivery:
        o.estimated_delivery ?? o.expected_delivery_date ?? o.shipping?.eta ?? null,
      tracking_code:
        o.tracking_code ?? o.tracking_number ?? o.shipping?.tracking_number ?? null,
    }));

    return { orders };
  },
);

export const getMelonnInventory = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ items: MelonnInventoryItem[]; error?: string }> => {
    const cfg = await loadConfig();
    const result = await melonnFetch(cfg.inventoryPath, cfg);
    if (!result.ok) return { items: [], error: result.error };

    const raw: any[] = Array.isArray(result.data)
      ? result.data
      : result.data?.inventory ?? result.data?.items ?? result.data?.data ?? [];

    const items: MelonnInventoryItem[] = raw.map((i: any) => {
      const available = Number(i.available ?? i.available_quantity ?? i.stock ?? 0);
      const reserved = Number(i.reserved ?? i.reserved_quantity ?? 0);
      const total = Number(i.total ?? i.total_quantity ?? available + reserved);
      return {
        product: String(i.product ?? i.product_name ?? i.name ?? "—"),
        sku: String(i.sku ?? i.product_sku ?? "—"),
        available,
        reserved,
        total,
      };
    });

    return { items };
  },
);

export const getMelonnMetrics = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ metrics: MelonnMetrics | null; error?: string }> => {
    const cfg = await loadConfig();
    const result = await melonnFetch(cfg.metricsPath, cfg);
    if (!result.ok) return { metrics: null, error: result.error };

    const d = result.data ?? {};
    const metrics: MelonnMetrics = {
      delivery_sla_pct: Number(d.delivery_sla_pct ?? d.on_time_rate ?? 0),
      avg_picking_minutes: Number(d.avg_picking_minutes ?? d.average_picking_time_minutes ?? 0),
      return_rate_pct: Number(d.return_rate_pct ?? d.return_rate ?? 0),
      cost_per_order: Number(d.cost_per_order ?? d.logistics_cost_per_order ?? 0),
    };
    return { metrics };
  },
);
