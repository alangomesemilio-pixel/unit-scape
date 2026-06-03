import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getSomaKv, setSomaKv } from "@/lib/soma-store.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  Save,
  RotateCcw,
  TrendingUp,
  Target,
  Calendar,
  Zap,
  AlertTriangle,
  Activity,
  Gauge,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

// ============ METAS PRÉ-CONFIGURADAS ============
const METAS = {
  Jun: { total: 1402000, ebitda: 687000, canais: { Influenciadora: 864000, DTC: 238000, B2B: 300000 } as Record<string, number> },
  Jul: { total: 1612300, ebitda: 790000, canais: { Influenciadora: 993600, DTC: 273700, B2B: 345000, WhatsApp: 0 } as Record<string, number> },
  Ago: { total: 1854145, ebitda: 908731, canais: { Influenciadora: 1142640, DTC: 314755, B2B: 396750, WhatsApp: 0 } as Record<string, number> },
  Set: { total: 2132267, ebitda: 1044811, canais: { Influenciadora: 1314036, DTC: 361968, B2B: 456262, WhatsApp: 0, Assinatura: 0 } as Record<string, number> },
  Out: { total: 2452107, ebitda: 1201532, canais: { Influenciadora: 1511141, DTC: 416263, B2B: 524701, WhatsApp: 0, Assinatura: 0, Marketplace: 0 } as Record<string, number> },
  Dez: { total: 2819923, ebitda: 1381762, canais: { Influenciadora: 1737812, DTC: 478702, B2B: 603406, WhatsApp: 0, Assinatura: 0, Marketplace: 0 } as Record<string, number> },
} as const;

const META_SEMESTRAL = 12272742;
const EBITDA_SEMESTRAL = 6013836;

const MESES = ["Jun", "Jul", "Ago", "Set", "Out", "Dez"] as const;
type Mes = typeof MESES[number];

// Index do mês no calendário (para "dia atual" simulado)
const MES_INDEX: Record<Mes, number> = { Jun: 5, Jul: 6, Ago: 7, Set: 8, Out: 9, Dez: 11 };
const DIAS_NO_MES: Record<Mes, number> = { Jun: 30, Jul: 31, Ago: 31, Set: 30, Out: 31, Dez: 31 };

interface MesRealizado {
  canais: Record<string, number>;
  roas?: number;
  cac?: number;
  pedidos?: number;
  margem?: number;
}

interface DinamicoState {
  mesAtual: Mes;
  realizados: Record<Mes, MesRealizado>;
}

const STORE_KEY = "forecast.dinamico.v1";

function mesCorrenteDefault(): Mes {
  const now = new Date();
  const m = now.getMonth(); // 0-11
  const found = (Object.entries(MES_INDEX) as [Mes, number][]).find(([, idx]) => idx === m);
  return found ? found[0] : "Jul";
}

function defaultState(): DinamicoState {
  const empty: Record<Mes, MesRealizado> = {} as any;
  for (const m of MESES) empty[m] = { canais: {} };
  return { mesAtual: mesCorrenteDefault(), realizados: empty };
}

// formata para R$ legível
const brl = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
};
const brlExato = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function corPct(p: number): { bar: string; text: string; bg: string; label: string } {
  if (p >= 100) return { bar: "bg-purple-500", text: "text-purple-400", bg: "bg-purple-500/15", label: "Superou" };
  if (p >= 86) return { bar: "bg-emerald-500", text: "text-emerald-400", bg: "bg-emerald-500/15", label: "No alvo" };
  if (p >= 61) return { bar: "bg-amber-500", text: "text-amber-400", bg: "bg-amber-500/15", label: "Atenção" };
  return { bar: "bg-rose-500", text: "text-rose-400", bg: "bg-rose-500/15", label: "Crítico" };
}

export function ForecastDinamico() {
  const get = useServerFn(getSomaKv);
  const set = useServerFn(setSomaKv);

  const [state, setState] = useState<DinamicoState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const [hoje, setHoje] = useState(new Date());

  // load
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await get({ data: { key: STORE_KEY } });
        if (!cancel && r?.value) {
          const v = r.value as Partial<DinamicoState>;
          const merged = defaultState();
          if (v.mesAtual && MESES.includes(v.mesAtual as Mes)) merged.mesAtual = v.mesAtual as Mes;
          if (v.realizados) {
            for (const m of MESES) {
              if ((v.realizados as any)[m]) merged.realizados[m] = { canais: {}, ...(v.realizados as any)[m] };
            }
          }
          setState(merged);
        }
      } catch {
        // ignora
      } finally {
        if (!cancel) setLoaded(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [get]);

  // autosave debounced
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      set({ data: { key: STORE_KEY, value: state } }).catch(() => {});
    }, 800);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [state, loaded, set]);

  const mesAtual = state.mesAtual;
  const metaMes = METAS[mesAtual];
  const realMes = state.realizados[mesAtual] ?? { canais: {} };

  // total realizado do mês = soma dos canais
  const totalReal = useMemo(
    () => Object.values(realMes.canais || {}).reduce((s, v) => s + (Number(v) || 0), 0),
    [realMes],
  );
  const falta = Math.max(0, metaMes.total - totalReal);
  const pctMes = metaMes.total > 0 ? (totalReal / metaMes.total) * 100 : 0;

  // dia atual / projeção
  const ehMesCorrente = MES_INDEX[mesAtual] === hoje.getMonth();
  const totalDias = DIAS_NO_MES[mesAtual];
  const diaAtual = ehMesCorrente ? Math.min(hoje.getDate(), totalDias) : totalDias;
  const diasRestantes = Math.max(0, totalDias - diaAtual);
  const projecao = diaAtual > 0 ? (totalReal / diaAtual) * totalDias : 0;
  const ritmoAtual = diaAtual > 0 ? totalReal / diaAtual : 0;
  const ritmoNecessario = diasRestantes > 0 ? falta / diasRestantes : 0;
  const ritmoPct = ritmoNecessario > 0 ? (ritmoAtual / ritmoNecessario) * 100 : 100;
  const ritmoCor =
    ritmoPct >= 100
      ? { c: "text-emerald-400", bg: "bg-emerald-500/15", label: "🟢 No ritmo" }
      : ritmoPct >= 80
      ? { c: "text-amber-400", bg: "bg-amber-500/15", label: "🟡 Atenção" }
      : { c: "text-rose-400", bg: "bg-rose-500/15", label: "🔴 Ação necessária" };

  // acumulado semestral
  const realSemestre = useMemo(
    () =>
      MESES.reduce((s, m) => {
        const r = state.realizados[m]?.canais ?? {};
        return s + Object.values(r).reduce((a, b) => a + (Number(b) || 0), 0);
      }, 0),
    [state.realizados],
  );
  const projetadoSemestre = useMemo(() => {
    let acc = 0;
    for (const m of MESES) {
      const r = state.realizados[m]?.canais ?? {};
      const totalM = Object.values(r).reduce((a, b) => a + (Number(b) || 0), 0);
      if (m === mesAtual) {
        acc += Math.max(totalM, projecao);
      } else if (MES_INDEX[m] < hoje.getMonth()) {
        acc += totalM; // passado: usa o realizado
      } else if (totalM > 0) {
        acc += totalM; // futuro mas já preenchido
      } else {
        acc += METAS[m].total; // futuro vazio: usa meta
      }
    }
    return acc;
  }, [state.realizados, mesAtual, projecao, hoje]);
  const pctSemestre = META_SEMESTRAL > 0 ? (realSemestre / META_SEMESTRAL) * 100 : 0;
  const faltaSemestre = Math.max(0, META_SEMESTRAL - realSemestre);

  // ============ ALERTAS ============
  const alertas: { tipo: "danger" | "warn"; msg: string }[] = [];
  if (realMes.roas != null && realMes.roas < 3 && realMes.roas > 0)
    alertas.push({ tipo: "warn", msg: "ROAS abaixo de 3x — revisar criativos antes de escalar" });
  if (realMes.cac != null && realMes.cac > 100)
    alertas.push({ tipo: "warn", msg: "CAC acima de R$100 — pausar escala de mídia" });
  if (ehMesCorrente && diaAtual >= 15 && pctMes < 60)
    alertas.push({ tipo: "danger", msg: "Meta em risco — convocar reunião de emergência" });
  const realInfl = realMes.canais?.Influenciadora ?? 0;
  const metaInfl = metaMes.canais.Influenciadora ?? 0;
  if (metaInfl > 0 && realInfl < metaInfl * 0.5 && diaAtual >= 10)
    alertas.push({ tipo: "danger", msg: "Canal Influenciadora abaixo de 50% da meta" });
  if (realMes.margem != null && realMes.margem < 50 && realMes.margem > 0)
    alertas.push({ tipo: "warn", msg: "Margem bruta abaixo de 50% — revisar CMV" });

  // ============ HANDLERS ============
  function setRealCanal(canal: string, valor: number) {
    setState((s) => ({
      ...s,
      realizados: {
        ...s.realizados,
        [mesAtual]: { ...s.realizados[mesAtual], canais: { ...s.realizados[mesAtual].canais, [canal]: valor } },
      },
    }));
  }
  function setRealCampo<K extends keyof MesRealizado>(campo: K, valor: MesRealizado[K]) {
    setState((s) => ({
      ...s,
      realizados: { ...s.realizados, [mesAtual]: { ...s.realizados[mesAtual], [campo]: valor } },
    }));
  }
  function setRealMesQualquer(m: Mes, valor: number) {
    // distribui proporcional pelos canais da meta
    const meta = METAS[m];
    const canais = Object.entries(meta.canais).filter(([, v]) => v > 0);
    const somaMeta = canais.reduce((s, [, v]) => s + v, 0);
    const novosCanais: Record<string, number> = {};
    for (const [k, v] of canais) novosCanais[k] = somaMeta > 0 ? Math.round(valor * (v / somaMeta)) : 0;
    setState((s) => ({
      ...s,
      realizados: { ...s.realizados, [m]: { ...s.realizados[m], canais: novosCanais } },
    }));
  }
  function resetMes() {
    setState((s) => ({
      ...s,
      realizados: { ...s.realizados, [mesAtual]: { canais: {} } },
    }));
    toast.success(`Mês ${mesAtual} resetado`);
  }
  async function saveAgora() {
    try {
      await set({ data: { key: STORE_KEY, value: state } });
      toast.success("Progresso salvo");
    } catch {
      toast.error("Falha ao salvar");
    }
  }

  // canais disponíveis nesse mês (meta > 0 OU já preenchido)
  const canaisDoMes = useMemo(() => {
    const fromMeta = Object.entries(metaMes.canais);
    const set = new Set(fromMeta.map(([k]) => k));
    for (const k of Object.keys(realMes.canais || {})) set.add(k);
    return Array.from(set);
  }, [metaMes, realMes]);

  // dados gráfico
  const dadosGrafico = MESES.map((m) => {
    const real = Object.values(state.realizados[m]?.canais || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    return { mes: m, Meta: METAS[m].total, Realizado: real };
  });

  const cor = corPct(pctMes);

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">Tempo real</Badge>
              <span className="text-xs text-muted-foreground">
                Hoje: {hoje.toLocaleDateString("pt-BR")}
              </span>
            </div>
            <h1 className="text-2xl font-bold">Forecast Dinâmico — Soma</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Preencha o realizado e veja em tempo real o quanto falta para bater a meta.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* seletor mês */}
            <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
              {MESES.map((m) => (
                <button
                  key={m}
                  onClick={() => setState((s) => ({ ...s, mesAtual: m }))}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    mesAtual === m
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={resetMes}>
              <RotateCcw className="size-3.5 mr-1" /> Reset
            </Button>
            <Button size="sm" onClick={saveAgora}>
              <Save className="size-3.5 mr-1" /> Salvar
            </Button>
          </div>
        </div>

        {/* ALERTAS */}
        {alertas.length > 0 && (
          <div className="space-y-2">
            {alertas.map((a, i) => (
              <Card
                key={i}
                className={`p-3 border-l-4 ${
                  a.tipo === "danger"
                    ? "border-l-rose-500 bg-rose-500/10"
                    : "border-l-amber-500 bg-amber-500/10"
                }`}
              >
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle
                    className={`size-4 ${a.tipo === "danger" ? "text-rose-400" : "text-amber-400"}`}
                  />
                  <span className="font-medium">{a.msg}</span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ============ BARRA DE PROGRESSO GLOBAL ============ */}
        <Card className={`p-5 border-2 ${cor.bg} border-transparent`}>
          <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
            <div>
              <div className="text-xs uppercase text-muted-foreground tracking-wider">
                Meta de {mesAtual}
              </div>
              <div className="text-2xl font-bold">{brlExato(metaMes.total)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground tracking-wider">Realizado</div>
              <div className={`text-2xl font-bold ${cor.text}`}>{brlExato(totalReal)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground tracking-wider">
                {pctMes >= 100 ? "Excedente" : "Falta"}
              </div>
              <div className="text-2xl font-bold">
                {pctMes >= 100 ? brlExato(totalReal - metaMes.total) : brlExato(falta)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground tracking-wider">% Atingido</div>
              <div className={`text-2xl font-bold ${cor.text}`}>{pctMes.toFixed(1)}%</div>
            </div>
          </div>
          <div className="w-full h-4 rounded-full bg-secondary overflow-hidden relative">
            <div
              className={`h-full ${cor.bar} transition-all duration-500`}
              style={{ width: `${Math.min(100, pctMes)}%` }}
            />
            {pctMes > 100 && (
              <div
                className="absolute top-0 left-0 h-full bg-purple-500/40"
                style={{ width: "100%" }}
              />
            )}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>0</span>
            <span>60%</span>
            <span>85%</span>
            <span>100%</span>
          </div>
        </Card>

        {/* ============ PROJEÇÃO DE FECHAMENTO ============ */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="size-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">
              Projeção de fechamento — {mesAtual}
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MiniStat label="Dia atual" value={`${diaAtual} / ${totalDias}`} icon={Calendar} />
            <MiniStat label="Dias restantes" value={`${diasRestantes}`} icon={Calendar} />
            <MiniStat
              label="Projeção fechamento"
              value={brl(projecao)}
              icon={TrendingUp}
              accent={projecao >= metaMes.total ? "text-emerald-400" : "text-amber-400"}
            />
            <MiniStat label="Ritmo atual / dia" value={brl(ritmoAtual)} icon={Activity} />
            <MiniStat
              label="Ritmo necessário / dia"
              value={brl(ritmoNecessario)}
              icon={Zap}
              accent="text-primary"
            />
          </div>
          <div className={`mt-3 p-3 rounded-md ${ritmoCor.bg} flex items-center justify-between`}>
            <span className={`text-sm font-semibold ${ritmoCor.c}`}>{ritmoCor.label}</span>
            <span className="text-xs text-muted-foreground">
              {ritmoAtual >= ritmoNecessario
                ? `${(ritmoPct).toFixed(0)}% acima do mínimo necessário`
                : `Faltam ${brl(ritmoNecessario - ritmoAtual)} por dia`}
            </span>
          </div>
        </Card>

        {/* ============ PAINEL DE INPUT — CANAIS ============ */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target className="size-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">
              Como estou hoje — Canais ({mesAtual})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase text-muted-foreground border-b border-border">
                  <th className="text-left py-2 px-2">Canal</th>
                  <th className="text-right py-2 px-2">Realizado</th>
                  <th className="text-right py-2 px-2">Meta</th>
                  <th className="text-right py-2 px-2">%</th>
                  <th className="text-center py-2 px-2">Status</th>
                  <th className="w-1/3"></th>
                </tr>
              </thead>
              <tbody>
                {canaisDoMes.map((canal) => {
                  const meta = metaMes.canais[canal] ?? 0;
                  const real = realMes.canais?.[canal] ?? 0;
                  const p = meta > 0 ? (real / meta) * 100 : 0;
                  const c = corPct(p);
                  return (
                    <tr key={canal} className="border-b border-border/50">
                      <td className="py-2 px-2 font-medium">{canal}</td>
                      <td className="py-2 px-2 text-right">
                        <Input
                          type="number"
                          value={real || ""}
                          onChange={(e) => setRealCanal(canal, Number(e.target.value) || 0)}
                          className="h-8 text-right max-w-[140px] ml-auto"
                          placeholder="0"
                        />
                      </td>
                      <td className="py-2 px-2 text-right text-muted-foreground tabular-nums">
                        {meta > 0 ? brl(meta) : "—"}
                      </td>
                      <td className={`py-2 px-2 text-right font-semibold tabular-nums ${c.text}`}>
                        {meta > 0 ? `${p.toFixed(0)}%` : "—"}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`inline-block size-2.5 rounded-full ${c.bar}`} />
                      </td>
                      <td className="py-2 px-2">
                        {meta > 0 && (
                          <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div className={`h-full ${c.bar}`} style={{ width: `${Math.min(100, p)}%` }} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Métricas operacionais */}
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-border pt-4">
            <OpInput
              label="ROAS atual"
              value={realMes.roas}
              onChange={(v) => setRealCampo("roas", v)}
              step={0.1}
              suffix="x"
            />
            <OpInput
              label="CAC atual"
              value={realMes.cac}
              onChange={(v) => setRealCampo("cac", v)}
              prefix="R$"
            />
            <OpInput
              label="Pedidos realizados"
              value={realMes.pedidos}
              onChange={(v) => setRealCampo("pedidos", v)}
            />
            <OpInput
              label="Margem bruta"
              value={realMes.margem}
              onChange={(v) => setRealCampo("margem", v)}
              suffix="%"
            />
          </div>
        </Card>

        {/* ============ ACUMULADO SEMESTRAL ============ */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="size-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Acumulado semestral</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            <MiniStat label="Meta semestre" value={brl(META_SEMESTRAL)} icon={Target} />
            <MiniStat
              label="Realizado acumulado"
              value={brl(realSemestre)}
              icon={TrendingUp}
              accent="text-emerald-400"
            />
            <MiniStat
              label="Projetado até Dez"
              value={brl(projetadoSemestre)}
              icon={Activity}
              accent={projetadoSemestre >= META_SEMESTRAL ? "text-emerald-400" : "text-amber-400"}
            />
            <MiniStat label="Falta fechar" value={brl(faltaSemestre)} icon={Calendar} />
            <MiniStat
              label="% do semestre"
              value={`${pctSemestre.toFixed(1)}%`}
              icon={Gauge}
              accent={corPct(pctSemestre).text}
            />
          </div>
          <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full ${corPct(pctSemestre).bar} transition-all`}
              style={{ width: `${Math.min(100, pctSemestre)}%` }}
            />
          </div>
        </Card>

        {/* ============ HISTÓRICO MENSAL ============ */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="size-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">
              Histórico mensal — Realizado vs Meta
            </h3>
          </div>
          <div className="h-72 mb-4">
            <ResponsiveContainer>
              <BarChart data={dadosGrafico}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => brl(v)} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                  }}
                  formatter={(v: number) => brlExato(v)}
                />
                <Legend />
                <Bar dataKey="Meta" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Realizado" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase text-muted-foreground border-b border-border">
                  <th className="text-left py-2 px-2">Mês</th>
                  <th className="text-right py-2 px-2">Meta</th>
                  <th className="text-right py-2 px-2">Realizado</th>
                  <th className="text-right py-2 px-2">Desvio R$</th>
                  <th className="text-right py-2 px-2">Desvio %</th>
                  <th className="text-center py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {MESES.map((m) => {
                  const meta = METAS[m].total;
                  const real = Object.values(state.realizados[m]?.canais || {}).reduce(
                    (s, v) => s + (Number(v) || 0),
                    0,
                  );
                  const desvio = real - meta;
                  const desvioPct = meta > 0 ? (desvio / meta) * 100 : 0;
                  const p = meta > 0 ? (real / meta) * 100 : 0;
                  const c = corPct(p);
                  const futuro = MES_INDEX[m] > hoje.getMonth() && real === 0;
                  const isAtual = m === mesAtual;
                  return (
                    <tr
                      key={m}
                      className={`border-b border-border/50 ${isAtual ? "bg-primary/5" : ""}`}
                    >
                      <td className="py-2 px-2 font-medium">
                        {m} {isAtual && <Badge className="ml-1 text-[9px]">atual</Badge>}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">{brl(meta)}</td>
                      <td className="py-2 px-2 text-right">
                        <Input
                          type="number"
                          value={real || ""}
                          onChange={(e) => setRealMesQualquer(m, Number(e.target.value) || 0)}
                          className="h-7 text-right max-w-[130px] ml-auto"
                          placeholder="—"
                        />
                      </td>
                      <td
                        className={`py-2 px-2 text-right tabular-nums ${
                          futuro ? "text-muted-foreground" : desvio >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {futuro ? "—" : `${desvio >= 0 ? "+" : ""}${brl(desvio)}`}
                      </td>
                      <td
                        className={`py-2 px-2 text-right tabular-nums ${
                          futuro ? "text-muted-foreground" : c.text
                        }`}
                      >
                        {futuro ? "—" : `${desvioPct >= 0 ? "+" : ""}${desvioPct.toFixed(1)}%`}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {futuro ? (
                          <span className="text-xs text-muted-foreground">⏳</span>
                        ) : (
                          <span className={`inline-block size-2.5 rounded-full ${c.bar}`} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: any;
  accent?: string;
}) {
  return (
    <div className="bg-secondary/40 rounded-md p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground tracking-wider mb-1">
        <Icon className="size-3" /> {label}
      </div>
      <div className={`text-lg font-bold ${accent ?? ""}`}>{value}</div>
    </div>
  );
}

function OpInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</label>
      <div className="flex items-center gap-1 mt-1">
        {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
        <Input
          type="number"
          step={step ?? 1}
          value={value ?? ""}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="h-9"
          placeholder="0"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}
