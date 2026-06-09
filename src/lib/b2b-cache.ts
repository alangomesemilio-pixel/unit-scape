import type { B2BSheetResult } from "./b2b-sheets.functions";

const KEY = "b2b_sheet_cache_v1";
export const B2B_CACHE_TTL_MS = 15 * 60_000;

export interface B2BCacheBlob {
  savedAt: number;
  data: B2BSheetResult;
}

export function loadB2BCache(): B2BCacheBlob | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as B2BCacheBlob;
  } catch {
    return null;
  }
}

export function saveB2BCache(data: B2BSheetResult) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* ignore quota */
  }
}

export function clearB2BCache() {
  if (typeof sessionStorage === "undefined") return;
  try { sessionStorage.removeItem(KEY); } catch { /* noop */ }
}

export function isFresh(blob: B2BCacheBlob | null): boolean {
  if (!blob) return false;
  return Date.now() - blob.savedAt < B2B_CACHE_TTL_MS;
}
