// Cache em sessionStorage para Melonn (pedidos + estoque + transportadoras).
// Evita refazer a busca completa toda vez que o usuário abre o módulo.

import type { MelonnOrder, MelonnInventoryItem, MelonnCourier } from "@/lib/melonn.functions";

const ORDERS_KEY = "melonn_orders_cache_v2";
const INVENTORY_KEY = "melonn_inventory_cache_v1";
const COURIERS_KEY = "melonn_couriers_cache_v1";

export const ORDERS_TTL_MS = 5 * 60 * 1000;    // 5 min
export const INVENTORY_TTL_MS = 10 * 60 * 1000; // 10 min
export const COURIERS_TTL_MS = 30 * 60 * 1000; // 30 min

export interface OrdersCacheBlob {
  data: MelonnOrder[];
  fetched_at: string;
  timestamp: number;
}
export interface CouriersCacheBlob {
  data: MelonnCourier[];
  fetched_at: string;
  timestamp: number;
}
export interface InventoryCacheBlob {
  data: MelonnInventoryItem[];
  fetched_at: string;
  timestamp: number;
}

function safeGet(key: string): any | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function safeSet(key: string, value: unknown) {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / privacy mode — ignora */
  }
}

// -------- ORDERS --------
export function loadOrdersCache(): OrdersCacheBlob | null {
  const blob = safeGet(ORDERS_KEY) as OrdersCacheBlob | null;
  if (!blob || !Array.isArray(blob.data)) return null;
  return blob;
}
export function saveOrdersCache(data: MelonnOrder[], fetched_at: string) {
  safeSet(ORDERS_KEY, { data, fetched_at, timestamp: Date.now() } satisfies OrdersCacheBlob);
}
export function clearOrdersCache() {
  try { window.sessionStorage.removeItem(ORDERS_KEY); } catch { /* */ }
}
export function ordersCacheAgeMs(blob: OrdersCacheBlob | null): number | null {
  return blob ? Date.now() - blob.timestamp : null;
}

// Mescla pedidos: novos sobrescrevem antigos pelo id, mantém histórico.
// Retorna { merged, newCount, updatedCount }.
export function mergeOrders(existing: MelonnOrder[], incoming: MelonnOrder[]) {
  const map = new Map<string, MelonnOrder>();
  for (const o of existing) map.set(o.id, o);
  let newCount = 0;
  let updatedCount = 0;
  for (const o of incoming) {
    const prev = map.get(o.id);
    if (!prev) {
      newCount++;
      map.set(o.id, o);
    } else {
      // Comparação superficial por status + last_status_update.
      const changed =
        prev.status !== o.status ||
        prev.status_code !== o.status_code ||
        prev.last_status_update !== o.last_status_update;
      if (changed) updatedCount++;
      map.set(o.id, o);
    }
  }
  // Ordena por creation_date desc (estável).
  const merged = Array.from(map.values()).sort((a, b) => {
    const ta = a.creation_date ? new Date(a.creation_date).getTime() : 0;
    const tb = b.creation_date ? new Date(b.creation_date).getTime() : 0;
    return tb - ta;
  });
  return { merged, newCount, updatedCount };
}

// -------- INVENTORY --------
export function loadInventoryCache(): InventoryCacheBlob | null {
  const blob = safeGet(INVENTORY_KEY) as InventoryCacheBlob | null;
  if (!blob || !Array.isArray(blob.data)) return null;
  return blob;
}
export function saveInventoryCache(data: MelonnInventoryItem[], fetched_at: string) {
  safeSet(INVENTORY_KEY, { data, fetched_at, timestamp: Date.now() } satisfies InventoryCacheBlob);
}
export function clearInventoryCache() {
  try { window.sessionStorage.removeItem(INVENTORY_KEY); } catch { /* */ }
}
export function inventoryCacheAgeMs(blob: InventoryCacheBlob | null): number | null {
  return blob ? Date.now() - blob.timestamp : null;
}

// -------- COURIERS --------
export function loadCouriersCache(): CouriersCacheBlob | null {
  const blob = safeGet(COURIERS_KEY) as CouriersCacheBlob | null;
  if (!blob || !Array.isArray(blob.data)) return null;
  return blob;
}
export function saveCouriersCache(data: MelonnCourier[], fetched_at: string) {
  safeSet(COURIERS_KEY, { data, fetched_at, timestamp: Date.now() } satisfies CouriersCacheBlob);
}
export function clearCouriersCache() {
  try { window.sessionStorage.removeItem(COURIERS_KEY); } catch { /* */ }
}

export function isExpired(timestamp: number, ttl: number): boolean {
  return Date.now() - timestamp >= ttl;
}

export function fmtAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  return `${h}h atrás`;
}

