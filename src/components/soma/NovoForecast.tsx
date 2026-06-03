import data from "@/data/soma-forecast-novo.json";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, Calendar, Sparkles } from "lucide-react";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Canal = {
  id: string;
  nome: string;
  receita: number;
  margem: number;
  pctTotal?: number;
  crescimento?: number;
  responsavel?: string;
  estrategia?: string;
  kpis?: string[];
};

type Fase = {
  id: string;
  mes: string;
  label: string;
  metaReceita: number;
  metaEbitda: number;
  crescimento?: number;
  descricao?: string;
  eventos?: { nome: string; meta: number; pct: number; canais: string[] }[];
  canais?: Canal[];
  canaisNovos?: string[];
};

export function NovoForecast() {
  const { meta, fases, rotinasSemana } = data as any;
  const totalReceita = fases.reduce((s: number, f: Fase) => s + f.metaReceita, 0);
  const totalEbitda = fases.reduce((s: number, f: Fase) => s + f.metaEbitda, 0);

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header compacto */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">v{meta.versao}</Badge>
              <span className="text-xs text-muted-foreground">{meta.periodo}</span>
            </div>
            <h1 className="text-2xl font-bold">Forecast Estratégico — {meta.empresa}</h1>
            <p className="text-xs text-muted-foreground mt-1">
              OKRs e PDCA agora vivem na aba <span className="text-primary font-medium">OKRs &amp; PDCA</span>
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <KPI label="Meta Semestre" value={fmtBRL(meta.metaSemestral)} accent="text-primary" />
            <KPI label="EBITDA Meta" value={fmtBRL(meta.ebitdaMeta)} accent="text-emerald-400" />
            <KPI label="Margem" value={`${meta.margemMeta}%`} accent="text-amber-400" />
          </div>
        </div>

        {/* Totais */}
        <Card className="p-4 border-primary/20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metric icon={TrendingUp} label="Receita projetada" value={fmtBRL(totalReceita)} />
            <Metric icon={Target} label="EBITDA projetado" value={fmtBRL(totalEbitda)} />
            <Metric
              icon={Sparkles}
              label="Margem EBITDA"
              value={`${((totalEbitda / totalReceita) * 100).toFixed(1)}%`}
            />
            <Metric icon={Calendar} label="Fases" value={`${fases.length} meses`} />
          </div>
        </Card>

        {/* Fases — grid mais denso */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Calendar className="size-4 text-primary" /> Fases · Jun → Dez
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {fases.map((f: Fase) => (
              <Card key={f.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-primary">{f.mes}</span>
                      <Badge variant="outline" className="text-[10px]">{f.label}</Badge>
                      {f.crescimento ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                          +{f.crescimento}%
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{fmtBRL(f.metaReceita)}</div>
                    <div className="text-[10px] text-emerald-400">EBITDA {fmtBRL(f.metaEbitda)}</div>
                  </div>
                </div>

                {f.descricao && (
                  <p className="text-xs text-muted-foreground">{f.descricao}</p>
                )}

                {f.eventos && f.eventos.length > 0 && (
                  <div className="space-y-0.5 border-t border-border pt-2">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase">Eventos</div>
                    {f.eventos.map((e, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="truncate">{e.nome}</span>
                        <span className="font-medium tabular-nums">{fmtBRL(e.meta)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {f.canais && f.canais.length > 0 && (
                  <div className="space-y-1.5 border-t border-border pt-2">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase">Canais</div>
                    {f.canais.map((c) => (
                      <div key={c.id} className="bg-secondary/40 rounded-md px-2 py-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium truncate">{c.nome}</span>
                          <span className="font-semibold tabular-nums">
                            {fmtBRL(c.receita)}
                            <span className="text-[10px] text-muted-foreground font-normal ml-1">
                              {c.margem}%
                            </span>
                          </span>
                        </div>
                        {c.responsavel && (
                          <div className="text-[10px] text-muted-foreground">{c.responsavel}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {f.canaisNovos && f.canaisNovos.length > 0 && (
                  <div className="border-t border-border pt-2">
                    <div className="flex gap-1 flex-wrap">
                      {f.canaisNovos.map((c) => (
                        <Badge key={c} className="bg-primary/15 text-primary border-primary/30 text-[10px]">
                          + {c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>

        {/* Rotinas — compactas */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Calendar className="size-4 text-primary" /> Rotinas semanais
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {Object.entries(rotinasSemana).map(([dia, items]) => (
              <Card key={dia} className="p-3 space-y-1.5">
                <div className="text-xs font-semibold capitalize text-primary">{dia}</div>
                {(items as any[]).map((it, i) => (
                  <div key={i} className="text-[11px] space-y-0.5 border-t border-border pt-1.5">
                    <div className="flex justify-between font-medium">
                      <span>{it.horario}</span>
                      <span className="text-muted-foreground">{it.duracao}min</span>
                    </div>
                    <div>{it.nome}</div>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function KPI({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card className="px-3 py-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold ${accent ?? ""}`}>{value}</div>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="size-9 rounded-md bg-primary/15 text-primary flex items-center justify-center">
        <Icon className="size-4" />
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
        <div className="text-base font-bold">{value}</div>
      </div>
    </div>
  );
}
