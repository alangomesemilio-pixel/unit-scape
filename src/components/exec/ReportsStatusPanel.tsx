import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HEADS, getWeekKey } from "@/lib/heads-config";
import { Check, Clock, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

type Report = {
  id: string;
  head_id: string;
  semana: string;
  kpis: Record<string, number>;
  vitorias: string;
  gargalos: string;
  proxima_acao: string;
  criado_em: string;
};

export function ReportsStatusPanel() {
  const weekKey = getWeekKey();
  const [reports, setReports] = useState<Report[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("reports_heads")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(200);
      if (mounted && data) setReports(data as unknown as Report[]);
    };
    load();
    const ch = supabase
      .channel("reports_heads_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports_heads" }, load)
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);

  const reportsByHead = (slug: string) =>
    reports.filter((r) => r.head_id === slug).sort((a, b) => b.semana.localeCompare(a.semana));

  const lastWeeks = (() => {
    const arr: string[] = [];
    const d = new Date();
    for (let i = 0; i < 4; i++) {
      arr.push(getWeekKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i * 7)));
    }
    return arr;
  })();

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/report/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success(`Link de ${slug} copiado — cole no WhatsApp do head`);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wider">Status dos Reports — semana {weekKey}</h2>
        <span className="text-xs text-muted-foreground">{reports.filter((r) => r.semana === weekKey).length}/{HEADS.length} enviados</span>
      </div>
      <div className="space-y-2">
        {HEADS.map((h) => {
          const hr = reportsByHead(h.slug);
          const thisWeek = hr.find((r) => r.semana === weekKey);
          const last = hr[0];
          const isOpen = expanded === h.slug;
          return (
            <div key={h.slug} className="rounded-xl border border-border bg-background/40">
              <div className="flex items-center gap-3 p-3">
                <div
                  className="size-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: h.accent }}
                >
                  {h.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{h.name} — {h.area}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {thisWeek
                      ? `Enviado ${new Date(thisWeek.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                      : last
                      ? `Último envio: ${last.semana}`
                      : "Nunca enviou"}
                  </div>
                </div>
                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                  style={{
                    background: thisWeek ? "#22c55e20" : "#eab30820",
                    color: thisWeek ? "#22c55e" : "#eab308",
                  }}
                >
                  {thisWeek ? <Check className="size-3" /> : <Clock className="size-3" />}
                  {thisWeek ? "Enviado" : "Pendente"}
                </div>
                <button
                  onClick={() => copyLink(h.slug)}
                  className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border hover:bg-secondary"
                  title="Copiar link do formulário"
                >
                  <Copy className="size-3" /> {thisWeek ? "Link" : "Cobrar"}
                </button>
                <a
                  href={`/report/${h.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] px-2 py-1 rounded-md border border-border hover:bg-secondary"
                >
                  Abrir
                </a>
                <button
                  onClick={() => setExpanded(isOpen ? null : h.slug)}
                  className="p-1 rounded-md hover:bg-secondary"
                  aria-label="Expandir histórico"
                >
                  {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
              </div>
              {isOpen && (
                <div className="border-t border-border p-3 space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Últimas 4 semanas</div>
                  <div className="grid grid-cols-4 gap-2">
                    {lastWeeks.map((w) => {
                      const r = hr.find((x) => x.semana === w);
                      return (
                        <div
                          key={w}
                          className="rounded-lg p-2 text-center border"
                          style={{
                            background: r ? "#22c55e10" : "transparent",
                            borderColor: r ? "#22c55e40" : "var(--border)",
                          }}
                        >
                          <div className="text-[10px] text-muted-foreground">{w.split("-W")[1]}</div>
                          <div className="text-xs font-bold mt-0.5">{r ? "✅" : "—"}</div>
                        </div>
                      );
                    })}
                  </div>
                  {thisWeek && (
                    <div className="text-xs space-y-1.5 pt-2">
                      {thisWeek.vitorias && (
                        <div><span className="text-[#22c55e] font-semibold">🏆 Vitória:</span> {thisWeek.vitorias}</div>
                      )}
                      {thisWeek.gargalos && (
                        <div><span className="text-[#ef4444] font-semibold">🚧 Gargalo:</span> {thisWeek.gargalos}</div>
                      )}
                      {thisWeek.proxima_acao && (
                        <div><span className="text-primary font-semibold">🎯 Próxima ação:</span> {thisWeek.proxima_acao}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
