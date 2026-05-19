import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const KEY_RE = /^[a-zA-Z0-9_.-]{1,64}$/;

export const getSomaKv = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ key: z.string().regex(KEY_RE) }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("soma_kv")
      .select("value, updated_at")
      .eq("key", data.key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { value: row?.value ?? null, updatedAt: row?.updated_at ?? null };
  });

export const setSomaKv = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ key: z.string().regex(KEY_RE), value: z.any() }).parse(input)
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("soma_kv")
      .upsert({ key: data.key, value: data.value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
