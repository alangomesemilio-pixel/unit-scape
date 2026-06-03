import data from "@/data/soma-forecast-g4.json";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  TrendingUp,
  Target,
  Calendar,
  Sparkles,
  Activity,
  Layers,
  AlertTriangle,
  Shield,
  Zap,
  CheckCircle2,
  ArrowDownRight,
  ArrowUpRight,
  Users,
  Flag,
} from "lucide-react";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtBRLShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return `R$ ${Math.round(n)}`;
};

type Cenario = "conservador" | "base" | "agressivo";

export function NovoForecast() {
  const { meta, camada1_unitEconomics: c1, camada2_canais: c2, camada3_cenarios: c3, camada4_gestao: c4 } = data as any;
  const [cenario, setCenario] = useState<Cenario>("base");
  const cenarioAtivo = c3[cenario];

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="secondary" className="text-xs">v{meta.versao}</Badge>
              <Badge variant="outline" className="text-xs">{meta.metodologia}</Badge>
              <span className="text-xs text-muted-foreground">{meta.periodo}</span>
            </div>
            <h1 className="text-2xl font-bold">Forecast Estratégico — {meta.empresa}</h1>
            <p className="text-xs text-muted-foreground mt-1">{meta.revisar}</p>
          </div>
          <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
            {(["conservador", "base", "agressivo"] as Cenario[]).map((c) => (
              <button
                key={c}
                onClick={() => setCenario(c)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                  cenario === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Cenário ativo destacado */}
        <Card className="p-5 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-2 mb-1">
                <Flag className="size-4 text-primary" />
                <span className="text-xs uppercase text-muted-foreground tracking-wider">Cenário {cenario}</span>
                <Badge variant="outline" className="text-[10px]">{cenarioAtivo.label}</Badge>
              </div>
              <p className="text-sm">{cenarioAtivo.descricao}</p>
              <p className="text-[11px] text-muted-foreground mt-2 italic">{cenarioAtivo.uso}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <KPI label="Receita semestre" value={fmtBRLShort(cenarioAtivo.projecaoSemestral)} accent="text-primary" />
              <KPI label="EBITDA semestre" value={fmtBRLShort(cenarioAtivo.ebitdaSemestral)} accent="text-emerald-400" />
            </div>
          </div>
        </Card>

        {/* ============ CAMADA 1 — Unit Economics ============ */}
        <section className="space-y-3">
          <SectionHeader icon={Activity} title="Camada 1 · Unit Economics" desc={c1.descricao} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <UnitCard label="Ticket médio" value={fmtBRL(c1.atual.ticketMedio)} />
            <UnitCard label="CAC" value={fmtBRL(c1.atual.cac)} />
            <UnitCard label="LTV" value={fmtBRL(c1.atual.ltv)} />
            <UnitCard label="LTV/CAC" value={`${c1.atual.ltvCac}x`} accent="text-emerald-400" />
            <UnitCard label="Margem bruta" value={`${c1.atual.margemBruta}%`} accent="text-emerald-400" />
            <UnitCard label="Recompra" value={`${c1.atual.taxaRecompra}%`} />
            <UnitCard label="Payback" value={`${c1.atual.paybackMeses} meses`} accent="text-emerald-400" />
            <UnitCard label="Churn mensal" value={`${c1.atual.churnMensal}%`} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-400" /> Diagnóstico
              </div>
              <DiagRow label="LTV/CAC" text={c1.diagnostico.ltvCac} />
              <DiagRow label="Margem" text={c1.diagnostico.margemBruta} />
              <DiagRow label="Payback" text={c1.diagnostico.payback} />
              <div className="pt-2 border-t border-border flex gap-2 items-start">
                <AlertTriangle className="size-3.5 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-300/90">{c1.diagnostico.alerta}</p>
              </div>
            </Card>
            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <Shield className="size-3.5 text-primary" /> Benchmarks G4
              </div>
              <BenchRow label="LTV/CAC mínimo" value={`${c1.benchmarks.ltvCacMinimo}x`} actual={c1.atual.ltvCac} target={c1.benchmarks.ltvCacMinimo} />
              <BenchRow label="LTV/CAC saudável" value={`${c1.benchmarks.ltvCacSaudavel}x`} actual={c1.atual.ltvCac} target={c1.benchmarks.ltvCacSaudavel} />
              <BenchRow label="LTV/CAC excelente" value={`${c1.benchmarks.ltvCacExcelente}x`} actual={c1.atual.ltvCac} target={c1.benchmarks.ltvCacExcelente} />
              <BenchRow label="Margem mínima" value={`${c1.benchmarks.margemBrutaMinima}%`} actual={c1.atual.margemBruta} target={c1.benchmarks.margemBrutaMinima} />
              <BenchRow label="Payback máximo" value={`${c1.benchmarks.paybackMaximoMeses}m`} actual={c1.atual.paybackMeses} target={c1.benchmarks.paybackMaximoMeses} inverted />
            </Card>
          </div>
        </section>

        {/* ============ CAMADA 2 — Canais ============ */}
        <section className="space-y-3">
          <SectionHeader icon={Layers} title="Camada 2 · Canais" desc={c2.descricao} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {c2.canais.map((canal: any) => (
              <Card key={canal.id} className={`p-4 space-y-2.5 ${!canal.ativo ? "opacity-70" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold">{canal.nome}</span>
                      {canal.ativo ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">ativo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">ativa em {canal.ativaDesde}</Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{canal.responsavel}</div>
                  </div>
                  {canal.receitaJun > 0 && (
                    <div className="text-right">
                      <div className="text-sm font-bold">{fmtBRLShort(canal.receitaJun)}</div>
                      <div className="text-[10px] text-muted-foreground">Jun · base</div>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-muted-foreground">
                  <span className="text-foreground/70">Driver:</span> {canal.driverPrincipal}
                </div>

                <div className="grid grid-cols-4 gap-2 text-center bg-secondary/30 rounded-md p-2">
                  <MicroStat label="Cresc." value={`+${canal.crescimentoMensal}%`} accent="text-emerald-400" />
                  <MicroStat label="Margem" value={`${canal.margemBruta}%`} />
                  <MicroStat label="CAC" value={canal.cac ? fmtBRLShort(canal.cac) : "—"} />
                  <MicroStat label="Payback" value={canal.paybackDias != null ? `${canal.paybackDias}d` : "—"} />
                </div>

                {canal.subCanais && (
                  <div className="space-y-1 border-t border-border pt-2">
                    <div className="text-[10px] font-medium uppercase text-muted-foreground">Sub-canais</div>
                    {canal.subCanais.map((sc: any) => (
                      <div key={sc.id} className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className={`size-1.5 rounded-full ${sc.ativo ? "bg-emerald-400" : "bg-muted-foreground/40"}`} />
                          {sc.nome}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {sc.ativo ? fmtBRLShort(sc.receita || 0) : `→ ${sc.ativaEm}`} · tk {fmtBRLShort(sc.ticket)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-border pt-2 space-y-1.5">
                  <div className="flex gap-2 items-start text-[11px]">
                    <Zap className="size-3 text-amber-400 mt-0.5 shrink-0" />
                    <span className="text-amber-300/90">{canal.gatilhoQueda}</span>
                  </div>
                  {canal.mitigacao && (
                    <div className="flex gap-2 items-start text-[11px]">
                      <Shield className="size-3 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{canal.mitigacao}</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* ============ CAMADA 3 — Cenários comparados ============ */}
        <section className="space-y-3">
          <SectionHeader icon={Target} title="Camada 3 · Cenários" desc={c3.descricao} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(["conservador", "base", "agressivo"] as Cenario[]).map((k) => {
              const s = c3[k];
              const isActive = cenario === k;
              const Icon = k === "conservador" ? ArrowDownRight : k === "agressivo" ? ArrowUpRight : Target;
              return (
                <Card
                  key={k}
                  className={`p-4 space-y-2 cursor-pointer transition-all ${
                    isActive ? "border-primary ring-1 ring-primary/30" : "hover:border-primary/40"
                  }`}
                  onClick={() => setCenario(k)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-primary" />
                      <span className="text-sm font-bold capitalize">{k}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{s.label}</Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Receita</span>
                      <span className="font-semibold">{fmtBRLShort(s.projecaoSemestral)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">EBITDA</span>
                      <span className="font-semibold text-emerald-400">{fmtBRLShort(s.ebitdaSemestral)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>×rec {s.multiplicadorReceita}</span>
                      <span>×cac {s.multiplicadorCac}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground border-t border-border pt-2">{s.uso}</p>
                </Card>
              );
            })}
          </div>
        </section>

        {/* ============ CAMADA 4 — Gestão ============ */}
        <section className="space-y-3">
          <SectionHeader icon={Calendar} title="Camada 4 · Gestão viva" desc={c4.descricao} />

          {/* Projeção mês a mês */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {c4.projecaoMesAMes.map((m: any) => (
              <Card key={m.mes} className="p-3 space-y-2">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-primary">{m.mes}</span>
                    <Badge variant="outline" className="text-[10px]">{m.fase}</Badge>
                    {m.crescimento && (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                        +{m.crescimento}%
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{fmtBRLShort(m.receitaBase)}</div>
                    <div className="text-[10px] text-emerald-400">EBITDA {fmtBRLShort(m.ebitdaBase)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {m.canaisAtivos.map((c: string) => (
                    <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/60">{c}</span>
                  ))}
                </div>
                {(m.novidades || m.eventos) && (
                  <ul className="text-[11px] space-y-0.5 border-t border-border pt-2">
                    {(m.novidades || m.eventos).map((n: string, i: number) => (
                      <li key={i} className="text-muted-foreground">→ {n}</li>
                    ))}
                  </ul>
                )}
                {m.restricao && (
                  <div className="text-[10px] text-amber-300/80 border-t border-border pt-2 flex gap-1.5">
                    <AlertTriangle className="size-3 shrink-0 mt-0.5" /> {m.restricao}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Rituais + gatilhos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <Users className="size-3.5 text-primary" /> Rituais de revisão
              </div>
              {c4.rituaisDeRevisao.map((r: any, i: number) => (
                <div key={i} className="border-l-2 border-primary/40 pl-3 space-y-0.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{r.frequencia}</span>
                    <span className="text-muted-foreground">{r.duracao}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{r.participantes.join(" · ")}</div>
                  <p className="text-[11px]">{r.pauta}</p>
                </div>
              ))}
            </Card>

            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <Zap className="size-3.5 text-amber-400" /> Gatilhos de ação
              </div>
              {c4.gatilhosDeAcao.map((g: any, i: number) => (
                <div key={i} className="text-[11px] space-y-0.5 border-t border-border pt-2 first:border-t-0 first:pt-0">
                  <div className="text-amber-300/90 font-medium">SE {g.condicao}</div>
                  <div className="text-muted-foreground">→ {g.acao}</div>
                  <div className="text-[10px] text-primary">@ {g.responsavel}</div>
                </div>
              ))}
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="border-l-2 border-primary pl-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
        <Icon className="size-4 text-primary" /> {title}
      </h2>
      <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
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

function UnitCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${accent ?? ""}`}>{value}</div>
    </Card>
  );
}

function MicroStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-xs font-semibold ${accent ?? ""}`}>{value}</div>
    </div>
  );
}

function DiagRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="text-[11px]">
      <span className="text-muted-foreground">{label}: </span>
      <span>{text}</span>
    </div>
  );
}

function BenchRow({ label, value, actual, target, inverted = false }: { label: string; value: string; actual: number; target: number; inverted?: boolean }) {
  const ok = inverted ? actual <= target : actual >= target;
  return (
    <div className="flex justify-between items-center text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span>{value}</span>
        <span className={`size-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
      </div>
    </div>
  );
}
