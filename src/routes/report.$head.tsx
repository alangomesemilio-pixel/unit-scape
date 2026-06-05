import { createFileRoute, notFound, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HEADS, getHead, getMonthKey, getWeekKey, kpiStatus, statusColor } from "@/lib/heads-config";
import { toast, Toaster } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/report/$head")({
  component: ReportForm,
  beforeLoad: ({ params }) => {
    if (!getHead(params.head)) throw notFound();
  },
  head: ({ params }) => {
    const h = getHead(params.head);
    return {
      meta: [
        { title: `${h?.title ?? "Report"} — GRAx Group` },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold mb-2">Head não encontrado</h1>
        <p className="text-muted-foreground">Confira o link recebido.</p>
      </div>
    </div>
  ),
});

function ReportForm() {
  const { head: slug } = useParams({ from: "/report/$head" });
  const head = getHead(slug)!;
  const weekKey = useMemo(() => getWeekKey(), []);
  const monthKey = useMemo(() => getMonthKey(), []);
  const today = useMemo(
    () => new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }),
    []
  );

  const [values, setValues] = useState<Record<string, string>>({});
  const [vitorias, setVitorias] = useState("");
  const [gargalos, setGargalos] = useState("");
  const [proximaAcao, setProximaAcao] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // pre-fill if there's an existing report this week
    (async () => {
      const { data } = await supabase
        .from("reports_heads")
        .select("*")
        .eq("head_id", slug)
        .eq("semana", weekKey)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        const kpis = (data.kpis as Record<string, number>) ?? {};
        const v: Record<string, string> = {};
        Object.entries(kpis).forEach(([k, val]) => (v[k] = String(val)));
        setValues(v);
        setVitorias(data.vitorias ?? "");
        setGargalos(data.gargalos ?? "");
        setProximaAcao(data.proxima_acao ?? "");
      }
    })();
  }, [slug, weekKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const kpis: Record<string, number> = {};
      head.kpis.forEach((k) => {
        const raw = values[k.id];
        const n = parseFloat(String(raw).replace(",", "."));
        if (!isNaN(n)) kpis[k.id] = n;
      });

      const { error } = await supabase.from("reports_heads").insert({
        head_id: slug,
        semana: weekKey,
        mes: monthKey,
        kpis,
        vitorias,
        gargalos,
        proxima_acao: proximaAcao,
      });
      if (error) throw error;

      // Atualiza kpis_executivos para os mapeados
      const updates = head.kpis
        .filter((k) => k.execKpiId && kpis[k.id] != null)
        .map((k) =>
          supabase
            .from("kpis_executivos")
            .upsert(
              {
                kpi_id: k.execKpiId!,
                mes: monthKey,
                nome: k.label,
                unit: k.unit === "h" ? "h" : k.unit,
                realizado: kpis[k.id],
                meta: k.target ?? 0,
                direction: k.dir ?? "up",
                dono: head.name,
              },
              { onConflict: "kpi_id,mes" }
            )
        );
      await Promise.all(updates);

      setDone(true);
      toast.success("Relatório enviado! ✅ Dashboard atualizado.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar. Tenta de novo.");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md text-center space-y-4">
          <CheckCircle2 className="size-16 mx-auto text-green-500" />
          <h1 className="text-2xl font-bold">Relatório enviado!</h1>
          <p className="text-muted-foreground">Dashboard atualizado com sucesso.</p>
          <button
            onClick={() => {
              setDone(false);
              setValues({});
              setVitorias("");
              setGargalos("");
              setProximaAcao("");
            }}
            className="text-sm text-primary underline"
          >
            Enviar outro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster theme="dark" position="top-center" />
      <header className="sticky top-0 z-10 bg-card/80 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div
            className="size-10 rounded-lg flex items-center justify-center text-white font-bold shadow"
            style={{ background: head.accent }}
          >
            G
          </div>
          <div className="leading-tight min-w-0">
            <div className="font-bold truncate">{head.title}</div>
            <div className="text-xs text-muted-foreground">
              {today} · {weekKey} · {head.name} — {head.area}
            </div>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            KPIs da semana
          </h2>
          {head.kpis.map((k) => {
            const raw = values[k.id] ?? "";
            const num = parseFloat(String(raw).replace(",", "."));
            const status = !isNaN(num) ? kpiStatus(num, k.target, k.dir) : "none";
            return (
              <div key={k.id} className="rounded-lg border border-border bg-card p-3">
                <label className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-sm font-medium">{k.label}</span>
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{ background: statusColor(status) }}
                    aria-label={status}
                  />
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8">{k.unit}</span>
                  <input
                    inputMode="decimal"
                    value={raw}
                    onChange={(e) => setValues({ ...values, [k.id]: e.target.value })}
                    placeholder="0"
                    className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {k.target != null && (
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      meta {k.target}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        <section className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1.5">🏆 Principal vitória da semana</label>
            <textarea
              value={vitorias}
              onChange={(e) => setVitorias(e.target.value)}
              rows={3}
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm"
              placeholder="O que rolou de melhor essa semana?"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">🚧 Principal gargalo da semana</label>
            <textarea
              value={gargalos}
              onChange={(e) => setGargalos(e.target.value)}
              rows={3}
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm"
              placeholder="Qual o principal bloqueio?"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">🎯 Próxima ação prioritária</label>
            <textarea
              value={proximaAcao}
              onChange={(e) => setProximaAcao(e.target.value)}
              rows={2}
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm"
              placeholder="O que será feito nos próximos dias?"
            />
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-lg font-semibold text-white shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: head.accent }}
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          Enviar relatório
        </button>

        <div className="text-center text-[11px] text-muted-foreground pt-2">
          GRAx Group · Cockpit Executivo
        </div>
      </form>

      <div className="hidden">
        {HEADS.map((h) => (
          <a key={h.slug} href={`/report/${h.slug}`}>{h.name}</a>
        ))}
      </div>
    </div>
  );
}
