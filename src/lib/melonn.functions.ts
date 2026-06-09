import { createServerFn } from "@tanstack/react-start";

/**
 * Integração com a API REST da Melonn.
 *
 * Base URL padrão: https://api.melonn.com/v1
 * Override via MELONN_API_BASE_URL caso a conta use um host diferente.
 * Autenticação: header `Authorization: Bearer <MELONN_API_KEY>`.
 *
 * Endpoints assumidos (ajustar conforme o contrato real da conta):
 *  - GET /orders?status=...     → lista de pedidos
 *  - GET /inventory             → estoque por SKU
 *  - GET /metrics/operational   → métricas operacionais agregadas
 *
 * Se o endpoint retornar 404/erro, devolvemos um payload vazio com `error`
 * para que a UI mostre estado vazio em vez de quebrar.
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

function getConfig() {
  const apiKey = process.env.MELONN_API_KEY;
  const baseUrl =
    process.env.MELONN_API_BASE_URL?.replace(/\/$/, "") ||
    "https://api.melonn.com/v1";
  return { apiKey, baseUrl };
}

async function melonnFetch(path: string): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  const { apiKey, baseUrl } = getConfig();
  if (!apiKey) {
    return { ok: false, error: "MELONN_API_KEY não configurada" };
  }
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Melonn ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = await res.json();
    return { ok: true, data };
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

export const getMelonnOrders = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ orders: MelonnOrder[]; error?: string }> => {
    const result = await melonnFetch("/orders?limit=200");
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
    const result = await melonnFetch("/inventory");
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
    const result = await melonnFetch("/metrics/operational");
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
