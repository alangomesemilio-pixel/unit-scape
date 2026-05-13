import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const changeSchema = z.object({
  kpi_id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  previous: z.number().nullable(),
  next: z.number().finite(),
});

export type AuditChange = z.infer<typeof changeSchema>;

export const logWeekClose = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        week: z.string().regex(/^\d{4}-W\d{2}$/),
        actor: z.string().min(1).max(80),
        changes: z.array(changeSchema).max(500),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("kpi_close_audit").insert({
      week: data.week,
      actor: data.actor.trim(),
      kpi_count: data.changes.length,
      changes: data.changes,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface AuditEntry {
  id: string;
  week: string;
  actor: string;
  closed_at: string;
  kpi_count: number;
  changes: AuditChange[];
}

export const loadAuditLog = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("kpi_close_audit")
    .select("id, week, actor, closed_at, kpi_count, changes")
    .order("closed_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const entries: AuditEntry[] = (data || []).map((r) => ({
    id: r.id as string,
    week: r.week as string,
    actor: r.actor as string,
    closed_at: r.closed_at as string,
    kpi_count: Number(r.kpi_count),
    changes: (r.changes as AuditChange[]) ?? [],
  }));
  return { entries };
});
