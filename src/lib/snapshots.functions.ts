import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const valuesSchema = z.record(z.string().min(1).max(64), z.number().finite());

export const saveWeekSnapshot = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        week: z.string().regex(/^\d{4}-W\d{2}$/),
        values: valuesSchema,
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const rows = Object.entries(data.values).map(([kpi_id, value]) => ({
      week: data.week,
      kpi_id,
      value,
      closed_at: new Date().toISOString(),
    }));
    if (rows.length === 0) return { saved: 0 };
    const { error } = await supabaseAdmin
      .from("kpi_week_snapshots")
      .upsert(rows, { onConflict: "week,kpi_id" });
    if (error) throw new Error(error.message);
    return { saved: rows.length };
  });

export const saveMonthSnapshot = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        month: z.string().regex(/^\d{4}-\d{2}$/),
        values: valuesSchema,
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const rows = Object.entries(data.values).map(([kpi_id, value]) => ({
      month: data.month,
      kpi_id,
      value,
      closed_at: new Date().toISOString(),
    }));
    if (rows.length === 0) return { saved: 0 };
    const { error } = await supabaseAdmin
      .from("kpi_month_snapshots")
      .upsert(rows, { onConflict: "month,kpi_id" });
    if (error) throw new Error(error.message);
    return { saved: rows.length };
  });

export interface SnapshotRow {
  period: string;
  kpi_id: string;
  value: number;
  closed_at: string;
}

export const loadSnapshots = createServerFn({ method: "GET" }).handler(async () => {
  const [weeksRes, monthsRes] = await Promise.all([
    supabaseAdmin
      .from("kpi_week_snapshots")
      .select("week, kpi_id, value, closed_at")
      .order("week", { ascending: true })
      .limit(2000),
    supabaseAdmin
      .from("kpi_month_snapshots")
      .select("month, kpi_id, value, closed_at")
      .order("month", { ascending: true })
      .limit(1000),
  ]);
  if (weeksRes.error) throw new Error(weeksRes.error.message);
  if (monthsRes.error) throw new Error(monthsRes.error.message);

  const weeks: SnapshotRow[] = (weeksRes.data || []).map((r) => ({
    period: r.week as string,
    kpi_id: r.kpi_id as string,
    value: Number(r.value),
    closed_at: r.closed_at as string,
  }));
  const months: SnapshotRow[] = (monthsRes.data || []).map((r) => ({
    period: r.month as string,
    kpi_id: r.kpi_id as string,
    value: Number(r.value),
    closed_at: r.closed_at as string,
  }));
  return { weeks, months };
});
