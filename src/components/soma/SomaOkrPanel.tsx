import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Flag, Plus, Trash2, Loader2, Save, Trophy, Target } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getSomaKv, setSomaKv } from "@/lib/soma-store.functions";
import { toast } from "sonner";
import seed from "@/data/okr-grax-model.json";

type Unit = "#" | "R$" | "%" | "x";

interface KR {
  id: string;
  codigo: string;
  titulo: string;
  nocaoSucesso: number;
  alcancado: number;
  unit: Unit;
  concluido: boolean;
}

interface Aspiration {
  id: string;
  codigo: string;
  titulo: string;
  accent: string;
  krs: KR[];
}

interface Period {
  id: string;
  label: string;
  aspirations: Aspiration[];
}

interface Model {
  periods: Period[];
}

const ACCENTS = ["#f28572", "#b78cff", "#9ad7c5", "#f5c97a", "#d6b4ff", "#ff9c8f"];

const fmtNum = (n: number, unit: Unit) => {
  if (unit === "R$") return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  if (unit === "%") return `${n.toFixed(1)}%`;
  if (unit === "x") return `${n.toFixed(2)}x`;
  return Math.round(n).toLocaleString("pt-BR");
};

const krProgress = (kr: KR) => {
  if (kr.concluido) return 100;
  if (kr.nocaoSucesso <= 0) return 0;
  return Math.max(0, Math.min(100, (kr.alcancado / kr.nocaoSucesso) * 100));
};

const aspProgress = (a: Aspiration) =>
  a.krs.length === 0 ? 0 : a.krs.reduce((s, k) => s + krProgress(k), 0) / a.krs.length;

const concluidosCount = (a: Aspiration) => a.krs.filter((k) => k.concluido).length;

export function SomaOkrPanel() {
  const getKv = useServerFn(getSomaKv);
  const setKv = useServerFn(setSomaKv);
  const [model, setModel] = useState<Model>(seed as Model);
  const [fullState, setFullState] = useState<any>(null);
  const [periodId, setPeriodId] = useState<string>("anual");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getKv({ data: { key: "forecast.state" } })
      .then((r) => {
        if (!alive) return;
        const s = (r.value as any) ?? {};
        setFullState(s);
        if (s.somaOkrV2?.periods) setModel(s.somaOkrV2 as Model);
        setSavedAt(r.updatedAt ?? null);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [getKv]);

  const period = useMemo(
    () => model.periods.find((p) => p.id === periodId) ?? model.periods[0],
    [model, periodId],
  );

  const overall = useMemo(() => {
    if (!period || period.aspirations.length === 0) return 0;
    return period.aspirations.reduce((s, a) => s + aspProgress(a), 0) / period.aspirations.length;
  }, [period]);

  const updatePeriod = (next: Period) =>
    setModel((m) => ({ ...m, periods: m.periods.map((p) => (p.id === next.id ? next : p)) }));

  const setAspiration = (id: string, patch: Partial<Aspiration>) =>
    updatePeriod({ ...period!, aspirations: period!.aspirations.map((a) => (a.id === id ? { ...a, ...patch } : a)) });

  const removeAspiration = (id: string) =>
    updatePeriod({ ...period!, aspirations: period!.aspirations.filter((a) => a.id !== id) });

  const addAspiration = () => {
    const idx = period!.aspirations.length;
    updatePeriod({
      ...period!,
      aspirations: [
        ...period!.aspirations,
        {
          id: `asp-${Date.now()}`,
          codigo: `A${idx + 1}`,
          titulo: "NOVA ASPIRAÇÃO",
          accent: ACCENTS[idx % ACCENTS.length],
          krs: [],
        },
      ],
    });
  };

  const setKr = (aspId: string, krId: string, patch: Partial<KR>) =>
    updatePeriod({
      ...period!,
      aspirations: period!.aspirations.map((a) =>
        a.id !== aspId ? a : { ...a, krs: a.krs.map((k) => (k.id === krId ? { ...k, ...patch } : k)) },
      ),
    });

  const removeKr = (aspId: string, krId: string) =>
    updatePeriod({
      ...period!,
      aspirations: period!.aspirations.map((a) =>
        a.id !== aspId ? a : { ...a, krs: a.krs.filter((k) => k.id !== krId) },
      ),
    });

  const addKr = (aspId: string) =>
    updatePeriod({
      ...period!,
      aspirations: period!.aspirations.map((a) =>
        a.id !== aspId
          ? a
          : {
              ...a,
              krs: [
                ...a.krs,
                {
                  id: `kr-${Date.now()}`,
                  codigo: `${a.krs.length + 1}.1`,
                  titulo: "Novo Resultado-Chave",
                  nocaoSucesso: 0,
                  alcancado: 0,
                  unit: "#",
                  concluido: false,
                },
              ],
            },
      ),
    });

  const save = async () => {
    setSaving(true);
    try {
      const nextState = { ...(fullState ?? {}), graxOkr: model };
      await setKv({ data: { key: "forecast.state", value: nextState } });
      setFullState(nextState);
      setSavedAt(new Date().toISOString());
      toast.success("OKRs Grax salvos");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <Trophy className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">OKR Grupo Grax</h2>
            <p className="text-xs text-muted-foreground">
              Modelo Aspirações → Resultados-Chave · {period?.label} · {overall.toFixed(1)}% atingimento médio
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {savedAt && (
            <span className="text-xs text-muted-foreground">
              Salvo · {new Date(savedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={addAspiration} disabled={loading}>
            <Plus className="size-3.5 mr-1" /> Aspiração
          </Button>
          <Button size="sm" onClick={save} disabled={saving || loading}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Period tabs */}
      <div className="flex items-center gap-1 flex-wrap border-b border-border">
        {model.periods.map((p) => {
          const active = p.id === periodId;
          return (
            <button
              key={p.id}
              onClick={() => setPeriodId(p.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors -mb-px border-b-2 ${
                active
                  ? "text-primary border-primary bg-primary/5"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="h-2 rounded-full overflow-hidden bg-primary/10">
        <div
          className="h-full transition-all"
          style={{ width: `${Math.min(100, overall)}%`, background: "linear-gradient(90deg, #f28572, #f5c97a)" }}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin mr-2" /> Carregando OKRs…
        </div>
      ) : !period || period.aspirations.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Nenhuma aspiração neste período. Clique em "+ Aspiração" para criar.
        </div>
      ) : (
        <div className="space-y-4">
          {period.aspirations.map((asp) => {
            const prog = aspProgress(asp);
            const concl = concluidosCount(asp);
            return (
              <div
                key={asp.id}
                className="rounded-xl border p-4"
                style={{
                  borderColor: `${asp.accent}40`,
                  background: `linear-gradient(135deg, ${asp.accent}10, transparent)`,
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className="size-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm"
                      style={{ background: `${asp.accent}25`, color: asp.accent }}
                    >
                      {asp.codigo}
                    </div>
                    <div className="flex-1 min-w-0">
                      <input
                        value={asp.titulo}
                        onChange={(e) => setAspiration(asp.id, { titulo: e.target.value })}
                        className="bg-transparent font-bold text-base w-full focus:outline-none border-b border-transparent focus:border-primary/30 uppercase tracking-wide"
                      />
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Target className="size-3" /> {asp.krs.length} KRs
                        </span>
                        <span>
                          Concluídos: <strong>{concl}/{asp.krs.length}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-2xl font-light tabular-nums" style={{ color: asp.accent }}>
                        {prog.toFixed(1)}%
                      </div>
                    </div>
                    <button
                      onClick={() => removeAspiration(asp.id)}
                      className="text-muted-foreground hover:text-destructive p-1"
                      title="Remover aspiração"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                        <th className="py-1.5 px-2 text-left w-12">#</th>
                        <th className="py-1.5 px-2 text-left min-w-[260px]">Resultado-Chave</th>
                        <th className="py-1.5 px-2 text-left w-16">Unid.</th>
                        <th className="py-1.5 px-2 text-right w-28">Noção de Sucesso</th>
                        <th className="py-1.5 px-2 text-right w-24">Alcançado</th>
                        <th className="py-1.5 px-2 text-right w-[160px]">%</th>
                        <th className="py-1.5 px-2 text-center w-16">OK</th>
                        <th className="py-1.5 px-1 w-6"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {asp.krs.map((kr) => {
                        const p = krProgress(kr);
                        const color = p >= 90 ? "#9ad7c5" : p >= 60 ? "#f5c97a" : "#f28572";
                        return (
                          <tr key={kr.id} className="border-b border-border/60 hover:bg-secondary/30">
                            <td className="py-2 px-2">
                              <input
                                value={kr.codigo}
                                onChange={(e) => setKr(asp.id, kr.id, { codigo: e.target.value })}
                                className="bg-transparent w-10 focus:outline-none text-[11px] tabular-nums"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                value={kr.titulo}
                                onChange={(e) => setKr(asp.id, kr.id, { titulo: e.target.value })}
                                className="bg-transparent w-full focus:outline-none"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <select
                                value={kr.unit}
                                onChange={(e) => setKr(asp.id, kr.id, { unit: e.target.value as Unit })}
                                className="bg-transparent border-b border-border focus:outline-none text-[11px]"
                              >
                                <option value="#">#</option>
                                <option value="R$">R$</option>
                                <option value="%">%</option>
                                <option value="x">x</option>
                              </select>
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                value={kr.nocaoSucesso}
                                onChange={(e) =>
                                  setKr(asp.id, kr.id, { nocaoSucesso: parseFloat(e.target.value) || 0 })
                                }
                                className="bg-transparent w-24 text-right focus:outline-none tabular-nums font-medium"
                                style={{ color: asp.accent }}
                              />
                              <div className="text-[10px] text-muted-foreground">{fmtNum(kr.nocaoSucesso, kr.unit)}</div>
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                value={kr.alcancado}
                                onChange={(e) =>
                                  setKr(asp.id, kr.id, { alcancado: parseFloat(e.target.value) || 0 })
                                }
                                className="bg-transparent w-20 text-right focus:outline-none tabular-nums"
                              />
                              <div className="text-[10px] text-muted-foreground">{fmtNum(kr.alcancado, kr.unit)}</div>
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-2 justify-end">
                                <div className="h-1.5 w-20 rounded-full overflow-hidden bg-primary/10">
                                  <div className="h-full" style={{ width: `${p}%`, background: color }} />
                                </div>
                                <span className="tabular-nums w-10 text-right" style={{ color }}>
                                  {p.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <Checkbox
                                checked={kr.concluido}
                                onCheckedChange={(v) => setKr(asp.id, kr.id, { concluido: !!v })}
                              />
                            </td>
                            <td className="py-2 px-1 text-right">
                              <button
                                onClick={() => removeKr(asp.id, kr.id)}
                                className="text-muted-foreground opacity-50 hover:opacity-100"
                                title="Remover KR"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      <tr>
                        <td colSpan={8} className="pt-2">
                          <button
                            onClick={() => addKr(asp.id)}
                            className="text-[11px] flex items-center gap-1"
                            style={{ color: asp.accent }}
                          >
                            <Plus className="size-3" /> adicionar Resultado-Chave
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-[11px] text-muted-foreground italic border-t border-border pt-3">
        <Badge variant="outline" className="text-[10px] mr-1">Modelo Grax</Badge>
        Aspirações Anuais + Trimestres · sincroniza com cenário compartilhado <code>forecast.state.graxOkr</code>.
      </div>
    </Card>
  );
}
