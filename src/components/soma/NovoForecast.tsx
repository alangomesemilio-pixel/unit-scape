import data from "@/data/soma-forecast-novo.json";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, Users, Calendar, Sparkles } from "lucide-react";

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
  const { meta, fases, responsaveis, rotinasSemana } = data as any;
  const totalReceita = fases.reduce((s: number, f: Fase) => s + f.metaReceita, 0);
  const totalEbitda = fases.reduce((s: number, f: Fase) => s + f.metaEbitda, 0);

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">TESTE · v{meta.versao}</Badge>
              <span className="text-xs text-muted-foreground">{meta.periodo}</span>
            </div>
            <h1 className="text-2xl font-bold">Novo Forecast Estratégico — {meta.empresa}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerado em {meta.geradoEm} · Importação do JSON estratégico
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <KPI label="Meta Semestre" value={fmtBRL(meta.metaSemestral)} accent="text-primary" />
            <KPI label="EBITDA Meta" value={fmtBRL(meta.ebitdaMeta)} accent="text-emerald-400" />
            <KPI label="Margem Meta" value={`${meta.margemMeta}%`} accent="text-amber-400" />
          </div>
        </div>

        {/* Totais calculados */}
        <Card className="p-4 border-primary/20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metric icon={TrendingUp} label="Receita projetada (soma fases)" value={fmtBRL(totalReceita)} />
            <Metric icon={Target} label="EBITDA projetado" value={fmtBRL(totalEbitda)} />
            <Metric
              icon={Sparkles}
              label="Margem EBITDA"
              value={`${((totalEbitda / totalReceita) * 100).toFixed(1)}%`}
            />
            <Metric icon={Calendar} label="Fases" value={`${fases.length} meses`} />
          </div>
        </Card>

        {/* Fases */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="size-4 text-primary" /> Fases · Jun → Dez
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {fases.map((f: Fase) => (
              <Card key={f.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-bold text-primary">{f.mes}</span>
                      <Badge variant="outline">{f.label}</Badge>
                      {f.crescimento ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                          +{f.crescimento}% MoM
                        </Badge>
                      ) : null}
                    </div>
                    {f.descricao && (
                      <p className="text-sm text-muted-foreground mt-2 max-w-md">{f.descricao}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Meta</div>
                    <div className="text-lg font-bold">{fmtBRL(f.metaReceita)}</div>
                    <div className="text-xs text-emerald-400">EBITDA {fmtBRL(f.metaEbitda)}</div>
                  </div>
                </div>

                {f.eventos && f.eventos.length > 0 && (
                  <div className="space-y-1 border-t border-border pt-3">
                    <div className="text-xs font-medium text-muted-foreground uppercase">Eventos</div>
                    {f.eventos.map((e, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>
                          {e.nome} <span className="text-muted-foreground">({e.canais.join(", ")})</span>
                        </span>
                        <span className="font-medium">{fmtBRL(e.meta)} · {e.pct}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {f.canais && f.canais.length > 0 && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="text-xs font-medium text-muted-foreground uppercase">Canais</div>
                    {f.canais.map((c) => (
                      <div key={c.id} className="bg-secondary/40 rounded-md p-3 space-y-1">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{c.nome}</span>
                            {c.responsavel && (
                              <span className="text-xs text-muted-foreground">· {c.responsavel}</span>
                            )}
                          </div>
                          <div className="text-sm font-semibold">
                            {fmtBRL(c.receita)}{" "}
                            <span className="text-xs text-muted-foreground font-normal">
                              · {c.margem}% margem
                              {c.pctTotal ? ` · ${c.pctTotal}%` : ""}
                            </span>
                          </div>
                        </div>
                        {c.estrategia && (
                          <p className="text-xs text-muted-foreground">{c.estrategia}</p>
                        )}
                        {c.kpis && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {c.kpis.map((k, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] font-normal">
                                {k}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {f.canaisNovos && f.canaisNovos.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
                      Novos canais
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {f.canaisNovos.map((c) => (
                        <Badge key={c} className="bg-primary/15 text-primary border-primary/30">
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

        {/* Responsáveis */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="size-4 text-primary" /> Responsáveis & OKRs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {responsaveis.map((r: any) => (
              <Card key={r.id} className="p-4 space-y-2">
                <div>
                  <div className="font-semibold">{r.nome}</div>
                  <div className="text-xs text-muted-foreground">{r.cargo}</div>
                </div>
                <p className="text-sm border-l-2 border-primary pl-2 italic">{r.okr}</p>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground mb-1">KPIs</div>
                  <div className="flex flex-wrap gap-1">
                    {r.kpis.map((k: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px] font-normal">
                        {k}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground mb-1">Rotinas</div>
                  <ul className="text-xs space-y-0.5 text-muted-foreground">
                    {r.rotinas.map((x: string, i: number) => (
                      <li key={i}>· {x}</li>
                    ))}
                  </ul>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Rotinas semana */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="size-4 text-primary" /> Rotinas semanais
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {Object.entries(rotinasSemana).map(([dia, items]) => (
              <Card key={dia} className="p-3 space-y-2">
                <div className="text-sm font-semibold capitalize">{dia}</div>
                {(items as any[]).map((it, i) => (
                  <div key={i} className="text-xs space-y-0.5 border-t border-border pt-2">
                    <div className="flex justify-between">
                      <span className="font-medium">{it.horario}</span>
                      <span className="text-muted-foreground">{it.duracao}min</span>
                    </div>
                    <div>{it.nome}</div>
                    <div className="text-muted-foreground">{it.participantes.join(", ")}</div>
                    {it.pauta && <div className="text-muted-foreground italic">{it.pauta}</div>}
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
